import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { UsersRepository } from './users.repository';
import { SessionsRepository } from './sessions.repository';
import { PasswordHasher } from './password-hasher';
import { TokenService } from './token.service';
import { CookieService } from './cookie.service';
import { SystemSettingsRepository } from '../settings/system-settings.repository';
import type { Database, DatabaseTransaction } from '../../database/database.module';
import { DATABASE } from '../../database/database.module';
import { Inject } from '@nestjs/common';
import type { Response } from 'express';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly sessionsRepository: SessionsRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService,
    private readonly cookieService: CookieService,
    private readonly systemSettingsRepository: SystemSettingsRepository,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  private async withTransaction<T>(fn: (tx: DatabaseTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction(fn);
  }

  async register(
    email: string,
    password: string,
    res: Response,
  ): Promise<{
    user: {
      id: string;
      email: string;
      role: string;
      mustChangePassword: boolean;
      emailVerified: boolean;
    };
  }> {
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

  async login(
    email: string,
    password: string,
    res: Response,
  ): Promise<{
    user: {
      id: string;
      email: string;
      role: string;
      mustChangePassword: boolean;
      emailVerified: boolean;
    };
  }> {
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

  async refresh(
    refreshToken: string,
    res: Response,
  ): Promise<{
    user: {
      id: string;
      email: string;
      role: string;
      mustChangePassword: boolean;
      emailVerified: boolean;
    };
  }> {
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

  async me(
    userId: string,
  ): Promise<{
    user: {
      id: string;
      email: string;
      role: string;
      mustChangePassword: boolean;
      emailVerified: boolean;
    };
  }> {
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
  ): Promise<{
    user: {
      id: string;
      email: string;
      role: string;
      mustChangePassword: boolean;
      emailVerified: boolean;
    };
  }> {
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
}
