import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { DATABASE } from '../../database/database.module';
import type { Database, DatabaseTransaction } from '../../database/database.module';
import { EmailTokensService } from '../email-tokens/email-tokens.service';
import { MailQueueService } from '../mail/mail-queue.service';
import { SystemSettingsRepository } from '../settings/system-settings.repository';
import { CookieService } from './cookie.service';
import { PasswordHasher } from './password-hasher';
import { SessionsRepository } from './sessions.repository';
import { TokenService } from './token.service';
import { UsersRepository } from './users.repository';
import { PeopleRepository } from '../people/people.repository';
import type { AuthUserResponse } from './auth-types';

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
    private readonly peopleRepository: PeopleRepository,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  private async withTransaction<T>(fn: (tx: DatabaseTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction(fn);
  }

  async register(
    email: string,
    password: string,
    fullName: string,
    cpf: string | undefined,
    phone: string | undefined,
    res: Response,
  ): Promise<AuthUserResponse> {
    const normalizedEmail = email.toLowerCase();

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

    if (cpf) {
      const cpfTaken = await this.peopleRepository.findByCpf(cpf);
      if (cpfTaken) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          message: 'CPF já cadastrado',
          code: 'PEOPLE_CPF_TAKEN',
          requestId: '',
          path: '/api/auth/register',
          timestamp: new Date().toISOString(),
        });
      }
    }

    const passwordHash = await this.passwordHasher.hash(password);

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

    this.cookieService.setAuthCookies(res, result.accessToken, result.refreshToken);

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

    if (session.replacedBySessionId) {
      const graceSeconds = this.tokenService.refreshReuseGraceSeconds;
      const now = new Date();
      const rotatedRecently =
        session.revokedAt && (now.getTime() - session.revokedAt.getTime()) / 1000 < graceSeconds;

      if (!rotatedRecently) {
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
}
