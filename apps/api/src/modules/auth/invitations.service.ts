import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { AUDIT_ACTIONS } from '@starter/shared';
import type { Response } from 'express';
import { DATABASE } from '../../database/database.module';
import type { Database, DatabaseTransaction } from '../../database/database.module';
import { AuditService } from '../audit/audit.service';
import { EmailTokensService } from '../email-tokens/email-tokens.service';
import { MailQueueService } from '../mail/mail-queue.service';
import { CookieService } from './cookie.service';
import { PasswordHasher } from './password-hasher';
import { SessionsRepository } from './sessions.repository';
import { TokenService } from './token.service';
import { UsersRepository } from './users.repository';
import { PeopleRepository } from '../people/people.repository';
import type { AuthUserResponse } from './auth-types';

@Injectable()
export class InvitationsService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly sessionsRepository: SessionsRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService,
    private readonly cookieService: CookieService,
    private readonly emailTokensService: EmailTokensService,
    private readonly mailQueueService: MailQueueService,
    private readonly auditService: AuditService,
    private readonly peopleRepository: PeopleRepository,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  private async withTransaction<T>(fn: (tx: DatabaseTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction(fn);
  }

  async inviteUser(
    adminUserId: string,
    email: string,
    role: 'admin' | 'user',
    ip?: string,
  ): Promise<{ id: string; email: string; role: string; expiresAt: string }> {
    const normalizedEmail = email.toLowerCase();
    const existingUser = await this.usersRepository.findByEmail(normalizedEmail);

    if (existingUser) {
      const isPending = !existingUser.lastLoginAt && !existingUser.emailVerifiedAt;
      if (!isPending) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          message: 'Este e-mail já possui uma conta',
          code: 'AUTH_INVITE_EMAIL_TAKEN',
          requestId: '',
          path: '/api/auth/invitations',
          timestamp: new Date().toISOString(),
        });
      }
      await this.emailTokensService.invalidate(existingUser.id, 'invite');
      const { token, expiresAt } = await this.emailTokensService.issue(existingUser.id, 'invite');
      void this.mailQueueService
        .enqueue({
          type: 'send-invite',
          payload: { to: existingUser.email, token, expiresAt: expiresAt.toISOString() },
        })
        .catch(() => undefined);
      void this.auditService
        .record({
          actorUserId: adminUserId,
          action: AUDIT_ACTIONS.AUTH_INVITATION_SENT,
          targetType: 'user',
          targetId: existingUser.id,
          metadata: { email: existingUser.email, role: existingUser.role },
          ip: ip ?? null,
        })
        .catch(() => undefined);
      return {
        id: existingUser.id,
        email: existingUser.email,
        role: existingUser.role,
        expiresAt: expiresAt.toISOString(),
      };
    }

    const unreachablePassword = randomBytes(32).toString('base64url');
    const passwordHash = await this.passwordHasher.hash(unreachablePassword);

    const newUser = await this.usersRepository.create({
      email: normalizedEmail,
      passwordHash,
      role,
      isActive: true,
      mustChangePassword: false,
    });

    const { token, expiresAt } = await this.emailTokensService.issue(newUser.id, 'invite');
    void this.mailQueueService
      .enqueue({
        type: 'send-invite',
        payload: { to: newUser.email, token, expiresAt: expiresAt.toISOString() },
      })
      .catch(() => undefined);
    void this.auditService
      .record({
        actorUserId: adminUserId,
        action: AUDIT_ACTIONS.AUTH_INVITATION_SENT,
        targetType: 'user',
        targetId: newUser.id,
        metadata: { email: newUser.email, role: newUser.role },
        ip: ip ?? null,
      })
      .catch(() => undefined);

    return {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async acceptInvitation(
    token: string,
    password: string,
    fullName: string,
    cpf: string | undefined,
    phone: string | undefined,
    res: Response,
    ip?: string,
  ): Promise<AuthUserResponse> {
    if (cpf) {
      const cpfTaken = await this.peopleRepository.findByCpf(cpf);
      if (cpfTaken) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          message: 'CPF já cadastrado',
          code: 'PEOPLE_CPF_TAKEN',
          requestId: '',
          path: '/api/auth/invitations/accept',
          timestamp: new Date().toISOString(),
        });
      }
    }

    const newHash = await this.passwordHasher.hash(password);

    const result = await this.withTransaction(async (tx) => {
      const userId = await this.emailTokensService.consume(token, 'invite');
      const user = await this.usersRepository.activateFromInvite(userId, newHash, tx);

      await this.peopleRepository.create(
        { userId: user.id, fullName, cpf: cpf ?? null, phone: phone ?? null },
        tx,
      );

      const sessionId = randomUUID();
      const familyId = randomUUID();
      const { token: refreshToken, hash: refreshTokenHash } =
        this.tokenService.generateRefreshToken();
      const expiresAt = new Date(
        Date.now() + this.tokenService.refreshTtlDays * 24 * 60 * 60 * 1000,
      );

      await this.sessionsRepository.create(
        { id: sessionId, userId: user.id, familyId, refreshTokenHash, expiresAt },
        tx,
      );

      const accessToken = this.tokenService.signAccess(
        { id: user.id, role: user.role },
        sessionId,
        user.mustChangePassword,
      );

      return { user, sessionId, accessToken, refreshToken };
    });

    void this.auditService
      .record({
        actorUserId: result.user.id,
        action: AUDIT_ACTIONS.AUTH_INVITATION_ACCEPTED,
        ip: ip ?? null,
      })
      .catch(() => undefined);

    this.cookieService.setAuthCookies(res, result.accessToken, result.refreshToken);

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role,
        mustChangePassword: result.user.mustChangePassword,
        emailVerified: !!result.user.emailVerifiedAt,
      },
    };
  }
}
