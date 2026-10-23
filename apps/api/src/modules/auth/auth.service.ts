import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { AUDIT_ACTIONS, FORGOT_PASSWORD_RESPONSE_MESSAGE } from '@starter/shared';
import type { Response } from 'express';
import { DATABASE } from '../../database/database.module';
import type { Database, DatabaseTransaction } from '../../database/database.module';
import { AuditService } from '../audit/audit.service';
import { EmailTokensService } from '../email-tokens/email-tokens.service';
import type { MailJob } from '../mail/mail-queue.service';
import { MailQueueService } from '../mail/mail-queue.service';
import { SystemSettingsRepository } from '../settings/system-settings.repository';
import { CookieService } from './cookie.service';
import { PasswordHasher } from './password-hasher';
import { SessionsRepository } from './sessions.repository';
import { TokenService } from './token.service';
import { UsersRepository } from './users.repository';

type AuthUserResponse = {
  user: {
    id: string;
    email: string;
    role: string;
    mustChangePassword: boolean;
    emailVerified: boolean;
  };
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly sessionsRepository: SessionsRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService,
    private readonly cookieService: CookieService,
    private readonly systemSettingsRepository: SystemSettingsRepository,
    private readonly emailTokensService: EmailTokensService,
    private readonly mailQueueService: MailQueueService,
    private readonly auditService: AuditService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  private async withTransaction<T>(fn: (tx: DatabaseTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction(fn);
  }

  async register(email: string, password: string, res: Response): Promise<AuthUserResponse> {
    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase();

    // Check if registration is enabled
    const setting = await this.systemSettingsRepository.findByKey('registration_enabled');
    if (!setting || setting.value !== true) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Cadastro desativado',
        code: 'AUTH_REGISTRATION_DISABLED',
        requestId: '',
        path: '/api/auth/register',
        timestamp: new Date().toISOString(),
      });
    }

    // Check if email already exists
    const existingUser = await this.usersRepository.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: 'E-mail já cadastrado',
        code: 'AUTH_EMAIL_TAKEN',
        requestId: '',
        path: '/api/auth/register',
        timestamp: new Date().toISOString(),
      });
    }

    // Hash password
    const passwordHash = await this.passwordHasher.hash(password);

    // Create user and session in transaction
    const result = await this.withTransaction(async (tx) => {
      const user = await this.usersRepository.create(
        {
          email: normalizedEmail,
          passwordHash,
          role: 'user',
          isActive: true,
          mustChangePassword: false,
        },
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
        {
          id: sessionId,
          userId: user.id,
          familyId,
          refreshTokenHash,
          expiresAt,
        },
        tx,
      );

      const accessToken = this.tokenService.signAccess(
        { id: user.id, role: user.role },
        sessionId,
        user.mustChangePassword,
      );

      return { user, sessionId, accessToken, refreshToken };
    });

    this.cookieService.setAuthCookies(res, result.accessToken, result.refreshToken);

    // Fire-and-forget: enqueue confirmation email (decision 3.11 + 3.7)
    void this.emailTokensService
      .issue(result.user.id, 'email_confirmation')
      .then(({ token, expiresAt }) =>
        this.mailQueueService.enqueue({
          type: 'send-email-confirmation',
          payload: { to: result.user.email, token, expiresAt: expiresAt.toISOString() },
        }),
      )
      .catch(() => undefined);

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

  async login(email: string, password: string, res: Response): Promise<AuthUserResponse> {
    const user = await this.usersRepository.findByEmail(email);

    if (!user || !user.isActive) {
      await this.passwordHasher.dummyVerify();
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Credenciais inválidas',
        code: 'AUTH_INVALID_CREDENTIALS',
        requestId: '',
        path: '/api/auth/login',
        timestamp: new Date().toISOString(),
      });
    }

    const isValid = await this.passwordHasher.verify(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Credenciais inválidas',
        code: 'AUTH_INVALID_CREDENTIALS',
        requestId: '',
        path: '/api/auth/login',
        timestamp: new Date().toISOString(),
      });
    }

    // Create new session (new family)
    const sessionId = randomUUID();
    const familyId = randomUUID();
    const { token: refreshToken, hash: refreshTokenHash } =
      this.tokenService.generateRefreshToken();
    const expiresAt = new Date(Date.now() + this.tokenService.refreshTtlDays * 24 * 60 * 60 * 1000);

    await this.sessionsRepository.create({
      id: sessionId,
      userId: user.id,
      familyId,
      refreshTokenHash,
      expiresAt,
    });

    await this.usersRepository.touchLastLogin(user.id);

    const accessToken = this.tokenService.signAccess(
      { id: user.id, role: user.role },
      sessionId,
      user.mustChangePassword,
    );

    this.cookieService.setAuthCookies(res, accessToken, refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        emailVerified: !!user.emailVerifiedAt,
      },
    };
  }

  async refresh(refreshToken: string, res: Response): Promise<AuthUserResponse> {
    if (!refreshToken) {
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Sessão inválida ou expirada',
        code: 'AUTH_REFRESH_INVALID',
        requestId: '',
        path: '/api/auth/refresh',
        timestamp: new Date().toISOString(),
      });
    }

    const refreshTokenHash = this.tokenService.hashRefreshToken(refreshToken);
    const session = await this.sessionsRepository.findByRefreshHash(refreshTokenHash);

    if (!session) {
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Sessão inválida ou expirada',
        code: 'AUTH_REFRESH_INVALID',
        requestId: '',
        path: '/api/auth/refresh',
        timestamp: new Date().toISOString(),
      });
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Sessão inválida ou expirada',
        code: 'AUTH_REFRESH_INVALID',
        requestId: '',
        path: '/api/auth/refresh',
        timestamp: new Date().toISOString(),
      });
    }

    // Check if user is still active
    const user = await this.usersRepository.findById(session.userId);
    if (!user || !user.isActive) {
      await this.sessionsRepository.revokeFamily(session.familyId);
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Sessão inválida ou expirada',
        code: 'AUTH_REFRESH_INVALID',
        requestId: '',
        path: '/api/auth/refresh',
        timestamp: new Date().toISOString(),
      });
    }

    // Check for reuse (rotation detection) - only if session was rotated
    if (session.replacedBySessionId) {
      const graceSeconds = this.tokenService.refreshReuseGraceSeconds;
      const now = new Date();
      const rotatedRecently =
        session.revokedAt && (now.getTime() - session.revokedAt.getTime()) / 1000 < graceSeconds;

      if (!rotatedRecently) {
        // Reuse detected outside grace window - revoke entire family
        await this.sessionsRepository.revokeFamily(session.familyId);
        throw new UnauthorizedException({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Token de refresh já utilizado',
          code: 'AUTH_REFRESH_REUSED',
          requestId: '',
          path: '/api/auth/refresh',
          timestamp: new Date().toISOString(),
        });
      }

      // Reuse within grace window - just reject, don't revoke family
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Token de refresh já utilizado',
        code: 'AUTH_REFRESH_REUSED',
        requestId: '',
        path: '/api/auth/refresh',
        timestamp: new Date().toISOString(),
      });
    }

    // Normal revocation check (not rotated)
    if (session.revokedAt) {
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Sessão inválida ou expirada',
        code: 'AUTH_REFRESH_INVALID',
        requestId: '',
        path: '/api/auth/refresh',
        timestamp: new Date().toISOString(),
      });
    }

    // Rotate: revoke old session, create new one in same family
    const newSessionId = randomUUID();
    const { token: newRefreshToken, hash: newRefreshTokenHash } =
      this.tokenService.generateRefreshToken();
    const expiresAt = new Date(Date.now() + this.tokenService.refreshTtlDays * 24 * 60 * 60 * 1000);

    await this.withTransaction(async (tx) => {
      await this.sessionsRepository.revokeAndCreateNew(
        session.id,
        newSessionId,
        user.id,
        session.familyId,
        newRefreshTokenHash,
        expiresAt,
        tx,
      );
    });

    const accessToken = this.tokenService.signAccess(
      { id: user.id, role: user.role },
      newSessionId,
      user.mustChangePassword,
    );

    this.cookieService.setAuthCookies(res, accessToken, newRefreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        emailVerified: !!user.emailVerifiedAt,
      },
    };
  }

  async logout(refreshToken: string, res: Response): Promise<void> {
    if (refreshToken) {
      const refreshTokenHash = this.tokenService.hashRefreshToken(refreshToken);
      const session = await this.sessionsRepository.findByRefreshHash(refreshTokenHash);
      if (session && !session.revokedAt) {
        await this.sessionsRepository.revoke(session.id);
      }
    }
    this.cookieService.clearAuthCookies(res);
  }

  async me(userId: string): Promise<AuthUserResponse> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Não autorizado',
        code: 'AUTH_UNAUTHORIZED',
        requestId: '',
        path: '/api/auth/me',
        timestamp: new Date().toISOString(),
      });
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        emailVerified: !!user.emailVerifiedAt,
      },
    };
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

    // Revoke all sessions and create a new one
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

  async confirmEmail(token: string, ip?: string): Promise<void> {
    const userId = await this.emailTokensService.consume(token, 'email_confirmation');
    await this.usersRepository.verifyEmail(userId);
    void this.auditService
      .record({ actorUserId: userId, action: AUDIT_ACTIONS.AUTH_EMAIL_CONFIRMED, ip: ip ?? null })
      .catch(() => undefined);
  }

  async resendEmailConfirmation(userId: string): Promise<void> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Não autorizado',
        code: 'AUTH_UNAUTHORIZED',
        requestId: '',
        path: '/api/auth/email/resend',
        timestamp: new Date().toISOString(),
      });
    }
    if (user.emailVerifiedAt) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: 'E-mail já confirmado',
        code: 'AUTH_EMAIL_ALREADY_CONFIRMED',
        requestId: '',
        path: '/api/auth/email/resend',
        timestamp: new Date().toISOString(),
      });
    }
    await this.emailTokensService.invalidate(userId, 'email_confirmation');
    const { token, expiresAt } = await this.emailTokensService.issue(userId, 'email_confirmation');
    void this.mailQueueService
      .enqueue({
        type: 'send-email-confirmation',
        payload: { to: user.email, token, expiresAt: expiresAt.toISOString() },
      })
      .catch(() => undefined);
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
      // Re-invite: invalidate old token, issue new
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

    // Create new invited user with unreachable password
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
    res: Response,
    ip?: string,
  ): Promise<AuthUserResponse> {
    const newHash = await this.passwordHasher.hash(password);

    const result = await this.withTransaction(async (tx) => {
      const userId = await this.emailTokensService.consume(token, 'invite');
      const user = await this.usersRepository.activateFromInvite(userId, newHash, tx);

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
