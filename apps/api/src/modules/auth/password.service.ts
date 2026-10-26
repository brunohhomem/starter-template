import {
  Inject,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AUDIT_ACTIONS, FORGOT_PASSWORD_RESPONSE_MESSAGE } from '@starter/shared';
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
import type { AuthUserResponse } from './auth-types';

@Injectable()
export class PasswordService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly sessionsRepository: SessionsRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService,
    private readonly cookieService: CookieService,
    private readonly emailTokensService: EmailTokensService,
    private readonly mailQueueService: MailQueueService,
    private readonly auditService: AuditService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  private async withTransaction<T>(fn: (tx: DatabaseTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction(fn);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    res: Response,
  ): Promise<AuthUserResponse> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Não autorizado',
        code: 'AUTH_UNAUTHORIZED',
        requestId: '',
        path: '/api/auth/change-password',
        timestamp: new Date().toISOString(),
      });
    }

    const isValid = await this.passwordHasher.verify(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: 'Unprocessable Entity',
        message: 'Senha atual incorreta',
        code: 'AUTH_CURRENT_PASSWORD_WRONG',
        requestId: '',
        path: '/api/auth/change-password',
        timestamp: new Date().toISOString(),
      });
    }

    const newHash = await this.passwordHasher.hash(newPassword);
    const isSame = await this.passwordHasher.verify(newPassword, user.passwordHash);
    if (isSame) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: 'Unprocessable Entity',
        message: 'A nova senha deve ser diferente da atual',
        code: 'AUTH_PASSWORD_UNCHANGED',
        requestId: '',
        path: '/api/auth/change-password',
        timestamp: new Date().toISOString(),
      });
    }

    await this.sessionsRepository.revokeAllByUser(userId);

    const sessionId = randomUUID();
    const familyId = randomUUID();
    const { token: refreshToken, hash: refreshTokenHash } =
      this.tokenService.generateRefreshToken();
    const expiresAt = new Date(Date.now() + this.tokenService.refreshTtlDays * 24 * 60 * 60 * 1000);

    await this.sessionsRepository.create({
      id: sessionId,
      userId,
      familyId,
      refreshTokenHash,
      expiresAt,
    });

    await this.usersRepository.updatePasswordHash(userId, newHash, false);

    const accessToken = this.tokenService.signAccess(
      { id: user.id, role: user.role },
      sessionId,
      false,
    );

    this.cookieService.setAuthCookies(res, accessToken, refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        mustChangePassword: false,
        emailVerified: !!user.emailVerifiedAt,
      },
    };
  }

  async forgotPassword(email: string, ip?: string): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase();
    const user = await this.usersRepository.findByEmail(normalizedEmail);

    if (user && user.isActive) {
      await this.emailTokensService.invalidate(user.id, 'password_reset');
      const { token, expiresAt } = await this.emailTokensService.issue(user.id, 'password_reset');
      void this.mailQueueService
        .enqueue({
          type: 'send-password-reset',
          payload: { to: user.email, token, expiresAt: expiresAt.toISOString() },
        })
        .catch(() => undefined);
      void this.auditService
        .record({
          actorUserId: user.id,
          action: AUDIT_ACTIONS.AUTH_PASSWORD_RESET_REQUESTED,
          ip: ip ?? null,
        })
        .catch(() => undefined);
    }

    return { message: FORGOT_PASSWORD_RESPONSE_MESSAGE };
  }

  async resetPassword(token: string, newPassword: string, ip?: string): Promise<void> {
    const newHash = await this.passwordHasher.hash(newPassword);

    await this.withTransaction(async (tx) => {
      const userId = await this.emailTokensService.consume(token, 'password_reset');
      await this.usersRepository.updatePasswordHash(userId, newHash, false, tx);
      await this.sessionsRepository.revokeAllByUser(userId, tx);
      await this.emailTokensService.invalidate(userId, 'password_reset', tx);
      void this.auditService
        .record({
          actorUserId: userId,
          action: AUDIT_ACTIONS.AUTH_PASSWORD_RESET_COMPLETED,
          ip: ip ?? null,
        })
        .catch(() => undefined);
    });
  }
}
