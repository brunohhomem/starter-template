import { Test, TestingModule } from '@nestjs/testing';
import {
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { SessionsRepository } from './sessions.repository';
import { PasswordHasher } from './password-hasher';
import { TokenService } from './token.service';
import { CookieService } from './cookie.service';
import { SystemSettingsRepository } from '../settings/system-settings.repository';
import { AuthService } from './auth.service';
import { DATABASE } from '../../database/database.module';
import type { Response } from 'express';

describe('AuthService', () => {
  let authService: AuthService;
  let usersRepository: MockUsersRepository;
  let sessionsRepository: MockSessionsRepository;
  let passwordHasher: MockPasswordHasher;
  let tokenService: MockTokenService;
  let cookieService: MockCookieService;
  let systemSettingsRepository: MockSystemSettingsRepository;
  let mockDb: MockDatabase;
  let mockResponse: Response;

  interface MockUsersRepository {
    findByEmail: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    updatePasswordHash: jest.Mock;
    touchLastLogin: jest.Mock;
  }

  interface MockSessionsRepository {
    findByRefreshHash: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    revoke: jest.Mock;
    revokeAllByUser: jest.Mock;
    revokeFamily: jest.Mock;
    revokeAndCreateNew: jest.Mock;
  }

  interface MockPasswordHasher {
    hash: jest.Mock;
    verify: jest.Mock;
    dummyVerify: jest.Mock;
  }

  interface MockTokenService {
    signAccess: jest.Mock;
    verifyAccess: jest.Mock;
    generateRefreshToken: jest.Mock;
    hashRefreshToken: jest.Mock;
    accessTtlMinutes: number;
    refreshTtlDays: number;
    refreshReuseGraceSeconds: number;
    accessSecret: string;
  }

  interface MockCookieService {
    setAuthCookies: jest.Mock;
    clearAuthCookies: jest.Mock;
    getAccessToken: jest.Mock;
    getRefreshToken: jest.Mock;
  }

  interface MockSystemSettingsRepository {
    findByKey: jest.Mock;
  }

  interface MockDatabase {
    transaction: jest.Mock;
  }

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: '$2b$12$hashedpassword',
    role: 'user' as const,
    isActive: true,
    mustChangePassword: false,
    emailVerifiedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAdminUser = {
    ...mockUser,
    id: 'admin-123',
    email: 'admin@example.com',
    role: 'admin' as const,
    mustChangePassword: true,
  };

  const mockSession = {
    id: 'session-123',
    userId: 'user-123',
    familyId: 'family-123',
    refreshTokenHash: 'hash123',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    revokedAt: null,
    replacedBySessionId: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    usersRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      updatePasswordHash: jest.fn(),
      touchLastLogin: jest.fn(),
    } as MockUsersRepository;

    sessionsRepository = {
      findByRefreshHash: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      revoke: jest.fn(),
      revokeAllByUser: jest.fn(),
      revokeFamily: jest.fn(),
      revokeAndCreateNew: jest.fn(),
    } as MockSessionsRepository;

    passwordHasher = {
      hash: jest.fn(),
      verify: jest.fn(),
      dummyVerify: jest.fn(),
    } as MockPasswordHasher;

    tokenService = {
      signAccess: jest.fn(),
      verifyAccess: jest.fn(),
      generateRefreshToken: jest.fn(),
      hashRefreshToken: jest.fn(),
      accessTtlMinutes: 15,
      refreshTtlDays: 7,
      refreshReuseGraceSeconds: 10,
      accessSecret: 'secret',
    } as MockTokenService;

    cookieService = {
      setAuthCookies: jest.fn(),
      clearAuthCookies: jest.fn(),
      getAccessToken: jest.fn(),
      getRefreshToken: jest.fn(),
    } as MockCookieService;

    systemSettingsRepository = {
      findByKey: jest.fn(),
    } as MockSystemSettingsRepository;

    mockDb = {
      transaction: jest.fn((fn) => fn({} as Record<string, unknown>)),
    };

    mockResponse = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    } as unknown as Response;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersRepository, useValue: usersRepository },
        { provide: SessionsRepository, useValue: sessionsRepository },
        { provide: PasswordHasher, useValue: passwordHasher },
        { provide: TokenService, useValue: tokenService },
        { provide: CookieService, useValue: cookieService },
        { provide: SystemSettingsRepository, useValue: systemSettingsRepository },
        { provide: DATABASE, useValue: mockDb },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('cria usuário e retorna dados com cookies', async () => {
      systemSettingsRepository.findByKey.mockResolvedValue({
        key: 'registration_enabled',
        value: true,
      });
      usersRepository.findByEmail.mockResolvedValue(null);
      passwordHasher.hash.mockResolvedValue('$2b$12$newhash');
      usersRepository.create.mockResolvedValue(mockUser);
      tokenService.generateRefreshToken.mockReturnValue({
        token: 'refresh-token',
        hash: 'hash123',
      });
      tokenService.signAccess.mockReturnValue('access-token');
      mockDb.transaction.mockImplementation(async (fn) => fn({} as Record<string, unknown>));

      const result = await authService.register('test@example.com', 'Password@123', mockResponse);

      expect(systemSettingsRepository.findByKey).toHaveBeenCalledWith('registration_enabled');
      expect(usersRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(passwordHasher.hash).toHaveBeenCalledWith('Password@123');
      expect(usersRepository.create).toHaveBeenCalled();
      expect(sessionsRepository.create).toHaveBeenCalled();
      expect(tokenService.signAccess).toHaveBeenCalled();
      expect(cookieService.setAuthCookies).toHaveBeenCalledWith(
        mockResponse,
        'access-token',
        'refresh-token',
      );
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.mustChangePassword).toBe(false);
    });

    it('lança ForbiddenException se registro desativado', async () => {
      systemSettingsRepository.findByKey.mockResolvedValue({
        key: 'registration_enabled',
        value: false,
      });

      await expect(
        authService.register('test@example.com', 'Password@123', mockResponse),
      ).rejects.toThrow(ForbiddenException);
      expect(usersRepository.findByEmail).not.toHaveBeenCalled();
    });

    it('lança ForbiddenException se setting não existir', async () => {
      systemSettingsRepository.findByKey.mockResolvedValue(null);

      await expect(
        authService.register('test@example.com', 'Password@123', mockResponse),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lança ConflictException se email já cadastrado', async () => {
      systemSettingsRepository.findByKey.mockResolvedValue({
        key: 'registration_enabled',
        value: true,
      });
      usersRepository.findByEmail.mockResolvedValue(mockUser);

      await expect(
        authService.register('test@example.com', 'Password@123', mockResponse),
      ).rejects.toThrow(ConflictException);
    });

    it('normaliza email para lowercase', async () => {
      systemSettingsRepository.findByKey.mockResolvedValue({
        key: 'registration_enabled',
        value: true,
      });
      usersRepository.findByEmail.mockResolvedValue(null);
      passwordHasher.hash.mockResolvedValue('$2b$12$newhash');
      usersRepository.create.mockResolvedValue(mockUser);
      tokenService.generateRefreshToken.mockReturnValue({
        token: 'refresh-token',
        hash: 'hash123',
      });
      tokenService.signAccess.mockReturnValue('access-token');
      mockDb.transaction.mockImplementation(async (fn) => fn({} as Record<string, unknown>));

      await authService.register('TEST@EXAMPLE.COM', 'Password@123', mockResponse);

      expect(usersRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
    });
  });

  describe('login', () => {
    it('login bem-sucedido retorna usuário e define cookies', async () => {
      usersRepository.findByEmail.mockResolvedValue(mockUser);
      passwordHasher.verify.mockResolvedValue(true);
      tokenService.generateRefreshToken.mockReturnValue({
        token: 'refresh-token',
        hash: 'hash123',
      });
      tokenService.signAccess.mockReturnValue('access-token');
      usersRepository.touchLastLogin.mockResolvedValue(undefined);

      const result = await authService.login('test@example.com', 'Password@123', mockResponse);

      expect(usersRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(passwordHasher.verify).toHaveBeenCalledWith('Password@123', mockUser.passwordHash);
      expect(sessionsRepository.create).toHaveBeenCalled();
      expect(usersRepository.touchLastLogin).toHaveBeenCalledWith(mockUser.id);
      expect(cookieService.setAuthCookies).toHaveBeenCalledWith(
        mockResponse,
        'access-token',
        'refresh-token',
      );
      expect(result.user.email).toBe('test@example.com');
    });

    it('lança UnauthorizedException para usuário inexistente', async () => {
      usersRepository.findByEmail.mockResolvedValue(null);
      passwordHasher.dummyVerify.mockResolvedValue(undefined);

      await expect(
        authService.login('inexistente@example.com', 'Password@123', mockResponse),
      ).rejects.toThrow(UnauthorizedException);
      expect(passwordHasher.dummyVerify).toHaveBeenCalled();
    });

    it('lança UnauthorizedException para usuário inativo', async () => {
      usersRepository.findByEmail.mockResolvedValue({ ...mockUser, isActive: false });
      passwordHasher.dummyVerify.mockResolvedValue(undefined);

      await expect(
        authService.login('test@example.com', 'Password@123', mockResponse),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lança UnauthorizedException para senha incorreta', async () => {
      usersRepository.findByEmail.mockResolvedValue(mockUser);
      passwordHasher.verify.mockResolvedValue(false);

      await expect(
        authService.login('test@example.com', 'WrongPassword@123', mockResponse),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('mesmo erro para email inexistente e senha errada (prevenção de enumeração)', async () => {
      usersRepository.findByEmail.mockResolvedValue(null);
      passwordHasher.dummyVerify.mockResolvedValue(undefined);

      try {
        await authService.login('inexistente@example.com', 'Password@123', mockResponse);
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        const response = (error as UnauthorizedException).getResponse() as Record<string, unknown>;
        expect(response.code).toBe('AUTH_INVALID_CREDENTIALS');
      }

      usersRepository.findByEmail.mockResolvedValue(mockUser);
      passwordHasher.verify.mockResolvedValue(false);

      try {
        await authService.login('test@example.com', 'WrongPassword@123', mockResponse);
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        const response = (error as UnauthorizedException).getResponse() as Record<string, unknown>;
        expect(response.code).toBe('AUTH_INVALID_CREDENTIALS');
      }
    });
  });

  describe('refresh', () => {
    it('rotaciona token e retorna novo access token', async () => {
      tokenService.hashRefreshToken.mockReturnValue('hash123');
      sessionsRepository.findByRefreshHash.mockResolvedValue(mockSession);
      usersRepository.findById.mockResolvedValue(mockUser);
      tokenService.generateRefreshToken.mockReturnValue({
        token: 'new-refresh-token',
        hash: 'new-hash',
      });
      tokenService.signAccess.mockReturnValue('new-access-token');
      mockDb.transaction.mockImplementation(async (fn) => fn({} as Record<string, unknown>));
      sessionsRepository.revokeAndCreateNew.mockResolvedValue(undefined);

      const result = await authService.refresh('valid-refresh-token', mockResponse);

      expect(tokenService.hashRefreshToken).toHaveBeenCalledWith('valid-refresh-token');
      expect(sessionsRepository.findByRefreshHash).toHaveBeenCalledWith('hash123');
      expect(sessionsRepository.revokeAndCreateNew).toHaveBeenCalled();
      expect(cookieService.setAuthCookies).toHaveBeenCalledWith(
        mockResponse,
        'new-access-token',
        'new-refresh-token',
      );
      expect(result.user.email).toBe('test@example.com');
    });

    it('lança UnauthorizedException se refresh token ausente', async () => {
      await expect(authService.refresh('', mockResponse)).rejects.toThrow(UnauthorizedException);
      await expect(
        authService.refresh(undefined as unknown as string, mockResponse),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lança UnauthorizedException se sessão não encontrada', async () => {
      tokenService.hashRefreshToken.mockReturnValue('hash123');
      sessionsRepository.findByRefreshHash.mockResolvedValue(null);

      await expect(authService.refresh('invalid-token', mockResponse)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('lança UnauthorizedException se sessão expirada', async () => {
      tokenService.hashRefreshToken.mockReturnValue('hash123');
      sessionsRepository.findByRefreshHash.mockResolvedValue({
        ...mockSession,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(authService.refresh('expired-token', mockResponse)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('lança UnauthorizedException se usuário inativo e revoga família', async () => {
      tokenService.hashRefreshToken.mockReturnValue('hash123');
      sessionsRepository.findByRefreshHash.mockResolvedValue(mockSession);
      usersRepository.findById.mockResolvedValue({ ...mockUser, isActive: false });
      sessionsRepository.revokeFamily.mockResolvedValue(undefined);

      await expect(authService.refresh('valid-token', mockResponse)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(sessionsRepository.revokeFamily).toHaveBeenCalledWith(mockSession.familyId);
    });

    it('lança AUTH_REFRESH_REUSED se token reutilizado fora da janela de graça', async () => {
      const oldRevokedAt = new Date(Date.now() - 20 * 1000); // 20s atrás, fora da janela de 10s
      tokenService.hashRefreshToken.mockReturnValue('hash123');
      const sessionWithReuse = {
        ...mockSession,
        replacedBySessionId: 'other-session',
        revokedAt: oldRevokedAt,
      };
      sessionsRepository.findByRefreshHash.mockResolvedValue(sessionWithReuse);
      usersRepository.findById.mockResolvedValue(mockUser);
      sessionsRepository.revokeFamily.mockResolvedValue(undefined);

      try {
        await authService.refresh('reused-token', mockResponse);
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        const response = (error as UnauthorizedException).getResponse();
        expect(response).toEqual(expect.objectContaining({ code: 'AUTH_REFRESH_REUSED' }));
      }
      expect(sessionsRepository.revokeFamily).toHaveBeenCalled();
    });

    it('lança AUTH_REFRESH_REUSED sem revogar família se dentro da janela de graça', async () => {
      const recentRevokedAt = new Date(Date.now() - 5 * 1000); // 5s atrás, dentro da janela de 10s
      tokenService.hashRefreshToken.mockReturnValue('hash123');
      sessionsRepository.findByRefreshHash.mockResolvedValue({
        ...mockSession,
        replacedBySessionId: 'other-session',
        revokedAt: recentRevokedAt,
      });
      usersRepository.findById.mockResolvedValue(mockUser);

      try {
        await authService.refresh('reused-token', mockResponse);
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect((error as UnauthorizedException).getResponse()).toEqual(
          expect.objectContaining({ code: 'AUTH_REFRESH_REUSED' }),
        );
      }
      expect(sessionsRepository.revokeFamily).not.toHaveBeenCalled();
    });

    it('lança AUTH_REFRESH_INVALID se sessão revogada (não rotacionada)', async () => {
      tokenService.hashRefreshToken.mockReturnValue('hash123');
      sessionsRepository.findByRefreshHash.mockResolvedValue({
        ...mockSession,
        revokedAt: new Date(),
        replacedBySessionId: null,
      });

      try {
        await authService.refresh('revoked-token', mockResponse);
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        const response = (error as UnauthorizedException).getResponse() as Record<string, unknown>;
        expect(response.code).toBe('AUTH_REFRESH_INVALID');
      }
    });
  });

  describe('logout', () => {
    it('revoga sessão e limpa cookies', async () => {
      tokenService.hashRefreshToken.mockReturnValue('hash123');
      sessionsRepository.findByRefreshHash.mockResolvedValue({ ...mockSession, revokedAt: null });
      sessionsRepository.revoke.mockResolvedValue(undefined);

      await authService.logout('valid-refresh-token', mockResponse);

      expect(sessionsRepository.revoke).toHaveBeenCalledWith(mockSession.id);
      expect(cookieService.clearAuthCookies).toHaveBeenCalledWith(mockResponse);
    });

    it('não revoga se sessão já revogada', async () => {
      tokenService.hashRefreshToken.mockReturnValue('hash123');
      sessionsRepository.findByRefreshHash.mockResolvedValue({
        ...mockSession,
        revokedAt: new Date(),
      });

      await authService.logout('valid-refresh-token', mockResponse);

      expect(sessionsRepository.revoke).not.toHaveBeenCalled();
      expect(cookieService.clearAuthCookies).toHaveBeenCalledWith(mockResponse);
    });

    it('apenas limpa cookies se refresh token ausente', async () => {
      await authService.logout('', mockResponse);
      await authService.logout(undefined as unknown as string, mockResponse);

      expect(sessionsRepository.findByRefreshHash).not.toHaveBeenCalled();
      expect(cookieService.clearAuthCookies).toHaveBeenCalledTimes(2);
    });
  });

  describe('me', () => {
    it('retorna dados do usuário autenticado', async () => {
      usersRepository.findById.mockResolvedValue(mockUser);

      const result = await authService.me('user-123');

      expect(usersRepository.findById).toHaveBeenCalledWith('user-123');
      expect(result.user.id).toBe('user-123');
      expect(result.user.email).toBe('test@example.com');
    });

    it('lança UnauthorizedException se usuário não encontrado', async () => {
      usersRepository.findById.mockResolvedValue(null);

      await expect(authService.me('invalid-id')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('changePassword', () => {
    it('altera senha, revoga sessões e retorna novo usuário', async () => {
      usersRepository.findById.mockResolvedValue(mockUser);
      passwordHasher.verify.mockResolvedValueOnce(true); // current password
      passwordHasher.verify.mockResolvedValueOnce(false); // new != current
      passwordHasher.hash.mockResolvedValue('$2b$12$newhash');
      sessionsRepository.revokeAllByUser.mockResolvedValue(undefined);
      tokenService.generateRefreshToken.mockReturnValue({ token: 'new-refresh', hash: 'new-hash' });
      tokenService.signAccess.mockReturnValue('new-access');
      usersRepository.updatePasswordHash.mockResolvedValue(undefined);
      sessionsRepository.create.mockResolvedValue(undefined);

      const result = await authService.changePassword(
        'user-123',
        'Current@123',
        'NewPass@456',
        mockResponse,
      );

      expect(passwordHasher.verify).toHaveBeenNthCalledWith(
        1,
        'Current@123',
        mockUser.passwordHash,
      );
      expect(passwordHasher.verify).toHaveBeenNthCalledWith(
        2,
        'NewPass@456',
        mockUser.passwordHash,
      );
      expect(passwordHasher.hash).toHaveBeenCalledWith('NewPass@456');
      expect(sessionsRepository.revokeAllByUser).toHaveBeenCalledWith('user-123');
      expect(usersRepository.updatePasswordHash).toHaveBeenCalledWith(
        'user-123',
        '$2b$12$newhash',
        false,
      );
      expect(cookieService.setAuthCookies).toHaveBeenCalledWith(
        mockResponse,
        'new-access',
        'new-refresh',
      );
      expect(result.user.mustChangePassword).toBe(false);
    });

    it('lança UnauthorizedException se usuário não encontrado', async () => {
      usersRepository.findById.mockResolvedValue(null);

      await expect(
        authService.changePassword('invalid-id', 'Current@123', 'NewPass@456', mockResponse),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lança UnprocessableEntityException se senha atual incorreta', async () => {
      usersRepository.findById.mockResolvedValue(mockUser);
      passwordHasher.verify.mockResolvedValue(false);

      try {
        await authService.changePassword('user-123', 'Wrong@123', 'NewPass@456', mockResponse);
      } catch (error) {
        expect(error).toBeInstanceOf(UnprocessableEntityException);
        const response = (error as UnprocessableEntityException).getResponse() as Record<
          string,
          unknown
        >;
        expect(response.code).toBe('AUTH_CURRENT_PASSWORD_WRONG');
      }
    });

    it('lança UnprocessableEntityException se nova senha igual à atual', async () => {
      usersRepository.findById.mockResolvedValue(mockUser);
      passwordHasher.verify.mockResolvedValueOnce(true); // current password
      passwordHasher.verify.mockResolvedValueOnce(true); // new == current

      try {
        await authService.changePassword('user-123', 'Current@123', 'Current@123', mockResponse);
      } catch (error) {
        expect(error).toBeInstanceOf(UnprocessableEntityException);
        const response = (error as UnprocessableEntityException).getResponse() as Record<
          string,
          unknown
        >;
        expect(response.code).toBe('AUTH_PASSWORD_UNCHANGED');
      }
    });
  });
});
