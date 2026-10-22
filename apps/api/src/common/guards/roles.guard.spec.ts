import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AUTH_ERROR_CODES } from '@starter/shared/auth';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: MockReflector;

  interface MockReflector {
    getAllAndOverride: jest.Mock;
  }

  const createContext = (
    userRole: string | undefined,
    requiredRoles: string[] = [],
  ): ExecutionContext => {
    const request = {
      user: userRole ? { role: userRole } : undefined,
      url: '/api/admin',
    };

    const handler = {
      [ROLES_KEY]: requiredRoles,
    };

    const classRef = {
      [ROLES_KEY]: [],
    };

    return {
      getHandler: () => handler,
      getClass: () => classRef,
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
      providers: [RolesGuard, { provide: Reflector, useValue: reflector }],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('permite se não houver roles requeridas', async () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    const context = createContext('user', []);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('permite se roles requeridas for undefined', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = createContext('user');

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('permite admin com role admin', async () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    const context = createContext('admin', ['admin']);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('permite user com role user', async () => {
    reflector.getAllAndOverride.mockReturnValue(['user']);
    const context = createContext('user', ['user']);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('permite se usuário tem uma das roles requeridas', async () => {
    reflector.getAllAndOverride.mockReturnValue(['admin', 'manager']);
    const context = createContext('admin', ['admin', 'manager']);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('lança AUTH_FORBIDDEN se usuário não tem role requerida', async () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    const context = createContext('user', ['admin']);

    try {
      await guard.canActivate(context);
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toEqual(
        expect.objectContaining({ code: AUTH_ERROR_CODES.AUTH_FORBIDDEN }),
      );
    }
  });

  it('lança AUTH_FORBIDDEN se user undefined', async () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    const context = createContext(undefined, ['admin']);

    try {
      await guard.canActivate(context);
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toEqual(
        expect.objectContaining({ code: AUTH_ERROR_CODES.AUTH_FORBIDDEN }),
      );
    }
  });

  it('lança AUTH_FORBIDDEN se user sem role', async () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    const request = { user: {}, url: '/api/admin' };
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    try {
      await guard.canActivate(context);
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toEqual(
        expect.objectContaining({ code: AUTH_ERROR_CODES.AUTH_FORBIDDEN }),
      );
    }
  });
});
