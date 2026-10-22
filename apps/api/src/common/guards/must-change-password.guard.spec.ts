import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MustChangePasswordGuard } from './must-change-password.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AUTH_ERROR_CODES } from '@starter/shared/auth';

describe('MustChangePasswordGuard', () => {
  let guard: MustChangePasswordGuard;
  let reflector: MockReflector;

  interface MockReflector {
    getAllAndOverride: jest.Mock;
  }

  const createContext = (
    user: { mustChangePassword?: boolean } | undefined,
    method: string,
    path: string,
    isPublic = false,
  ): ExecutionContext => {
    const request = {
      method,
      url: path,
      route: { path },
      user,
    };

    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as MockReflector;

    const module: TestingModule = await Test.createTestingModule({
      providers: [MustChangePasswordGuard, { provide: Reflector, useValue: reflector }],
    }).compile();

    guard = module.get<MustChangePasswordGuard>(MustChangePasswordGuard);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('permite rota @Public()', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const context = createContext({ mustChangePassword: true }, 'GET', '/api/admin');

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('permite se usuário não tem mustChangePassword', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const context = createContext({ mustChangePassword: false }, 'GET', '/api/admin');

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('permite se user undefined', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const context = createContext(undefined, 'GET', '/api/admin');

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('permite GET /auth/me mesmo com mustChangePassword=true', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const context = createContext({ mustChangePassword: true }, 'GET', '/auth/me');

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('permite POST /auth/change-password mesmo com mustChangePassword=true', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const context = createContext({ mustChangePassword: true }, 'POST', '/auth/change-password');

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('permite POST /auth/logout mesmo com mustChangePassword=true', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const context = createContext({ mustChangePassword: true }, 'POST', '/auth/logout');

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('bloqueia GET /api/admin com mustChangePassword=true', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const context = createContext({ mustChangePassword: true }, 'GET', '/api/admin');

    try {
      await guard.canActivate(context);
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toEqual(
        expect.objectContaining({ code: AUTH_ERROR_CODES.AUTH_MUST_CHANGE_PASSWORD }),
      );
    }
  });

  it('bloqueia POST /api/outra-rota com mustChangePassword=true', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const context = createContext({ mustChangePassword: true }, 'POST', '/api/outra-rota');

    try {
      await guard.canActivate(context);
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toEqual(
        expect.objectContaining({ code: AUTH_ERROR_CODES.AUTH_MUST_CHANGE_PASSWORD }),
      );
    }
  });

  it('bloqueia PUT /auth/me com mustChangePassword=true (método não permitido)', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const context = createContext({ mustChangePassword: true }, 'PUT', '/auth/me');

    try {
      await guard.canActivate(context);
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toEqual(
        expect.objectContaining({ code: AUTH_ERROR_CODES.AUTH_MUST_CHANGE_PASSWORD }),
      );
    }
  });

  it('bloqueia DELETE /auth/logout com mustChangePassword=true (método não permitido)', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const context = createContext({ mustChangePassword: true }, 'DELETE', '/auth/logout');

    try {
      await guard.canActivate(context);
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toEqual(
        expect.objectContaining({ code: AUTH_ERROR_CODES.AUTH_MUST_CHANGE_PASSWORD }),
      );
    }
  });
});
