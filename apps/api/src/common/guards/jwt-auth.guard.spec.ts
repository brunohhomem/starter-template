import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TokenService, AccessTokenPayload } from '../../modules/auth/token.service';
import { SessionsRepository } from '../../modules/auth/sessions.repository';
import { AUTH_ERROR_CODES } from '@starter/shared/auth';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: MockReflector;
  let tokenService: MockTokenService;
  let sessionsRepository: MockSessionsRepository;

  const mockUser = {
    userId: 'user-123',
    role: 'user',
    sessionId: 'session-123',
    mustChangePassword: false,
  };

  interface MockRequestCookies {
    [key: string]: string;
  }

  const mockRequest = {
    cookies: { ['access_token']: 'valid-token' } as MockRequestCookies,
    user: undefined,
    url: '/api/test',
  };

  const mockContext = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => mockRequest,
    }),
  } as unknown as ExecutionContext;

  interface MockReflector {
    getAllAndOverride: jest.Mock;
  }

  interface MockTokenService {
    verifyAccess: jest.Mock;
  }

  interface MockSessionsRepository {
    findById: jest.Mock;
  }

  interface Session {
    id: string;
    revokedAt: Date | null;
  }

  beforeEach(async () => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as MockReflector;

    tokenService = {
      verifyAccess: jest.fn(),
    } as MockTokenService;

    sessionsRepository = {
      findById: jest.fn(),
    } as MockSessionsRepository;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        { provide: Reflector, useValue: reflector },
        { provide: TokenService, useValue: tokenService },
        { provide: SessionsRepository, useValue: sessionsRepository },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest.cookies = { ['access_token']: 'valid-token' } as MockRequestCookies;
    mockRequest.user = undefined;
  });

  it('permite rota @Public()', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(true);
    expect(tokenService.verifyAccess).not.toHaveBeenCalled();
  });

  it('lança AUTH_UNAUTHORIZED se access_token ausente', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    mockRequest.cookies = {};

    try {
      await guard.canActivate(mockContext);
    } catch (error) {
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).getResponse()).toEqual(
        expect.objectContaining({ code: AUTH_ERROR_CODES.AUTH_UNAUTHORIZED }),
      );
    }
  });

  it('lança AUTH_TOKEN_EXPIRED se token expirado', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    tokenService.verifyAccess.mockResolvedValue({ payload: null, error: 'expired' });

    try {
      await guard.canActivate(mockContext);
    } catch (error) {
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).getResponse()).toEqual(
        expect.objectContaining({ code: AUTH_ERROR_CODES.AUTH_TOKEN_EXPIRED }),
      );
    }
  });

  it('lança AUTH_UNAUTHORIZED se token inválido', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    tokenService.verifyAccess.mockResolvedValue({ payload: null, error: 'invalid' });

    try {
      await guard.canActivate(mockContext);
    } catch (error) {
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).getResponse()).toEqual(
        expect.objectContaining({ code: AUTH_ERROR_CODES.AUTH_UNAUTHORIZED }),
      );
    }
  });

  it('lança AUTH_UNAUTHORIZED se sessão não encontrada', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    tokenService.verifyAccess.mockResolvedValue({
      payload: { sub: 'user-123', role: 'user', sid: 'session-123', mcp: false },
      error: undefined,
    });
    sessionsRepository.findById.mockResolvedValue(null);

    try {
      await guard.canActivate(mockContext);
    } catch (error) {
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).getResponse()).toEqual(
        expect.objectContaining({ code: AUTH_ERROR_CODES.AUTH_UNAUTHORIZED }),
      );
    }
  });

  it('lança AUTH_UNAUTHORIZED se sessão revogada', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    tokenService.verifyAccess.mockResolvedValue({
      payload: { sub: 'user-123', role: 'user', sid: 'session-123', mcp: false },
      error: undefined,
    });
    sessionsRepository.findById.mockResolvedValue({
      id: 'session-123',
      revokedAt: new Date(),
    } as Session);

    try {
      await guard.canActivate(mockContext);
    } catch (error) {
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).getResponse()).toEqual(
        expect.objectContaining({ code: AUTH_ERROR_CODES.AUTH_UNAUTHORIZED }),
      );
    }
  });

  it('anexa user ao request e retorna true se tudo válido', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    tokenService.verifyAccess.mockResolvedValue({
      payload: { sub: 'user-123', role: 'user', sid: 'session-123', mcp: false },
      error: undefined,
    });
    sessionsRepository.findById.mockResolvedValue({
      id: 'session-123',
      revokedAt: null,
    } as Session);

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(true);
    expect(mockRequest.user).toEqual({
      userId: 'user-123',
      role: 'user',
      sessionId: 'session-123',
      mustChangePassword: false,
    });
  });
});
