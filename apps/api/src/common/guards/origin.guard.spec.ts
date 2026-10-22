import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OriginGuard } from './origin.guard';
import { ENV } from '../../config/app-config.module';
import { AUTH_ERROR_CODES } from '@starter/shared/auth';

describe('OriginGuard', () => {
  let guard: OriginGuard;
  let reflector: MockReflector;
  let mockEnv: { [key: string]: string };

  interface MockReflector {
    getAllAndOverride: jest.Mock;
  }

  const createContext = (
    method: string,
    origin: string | undefined,
    isPublic = false,
  ): ExecutionContext => {
    const request = {
      method,
      headers: { origin },
      url: '/api/test',
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
    mockEnv = {
      WEB_ORIGIN: 'http://localhost:3000',
      NODE_ENV: 'development',
    };

    reflector = {
      getAllAndOverride: jest.fn(),
    } as MockReflector;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OriginGuard,
        { provide: Reflector, useValue: reflector },
        { provide: ENV, useValue: mockEnv },
      ],
    }).compile();

    guard = module.get<OriginGuard>(OriginGuard);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('permite rota @Public()', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const context = createContext('POST', 'http://evil.com', true);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('permite GET sem verificar Origin', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const context = createContext('GET', 'http://evil.com');

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('bloqueia PUT com Origin incorreto', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const context = createContext('PUT', 'http://evil.com');

    try {
      await guard.canActivate(context);
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toEqual(
        expect.objectContaining({ code: AUTH_ERROR_CODES.AUTH_CSRF_BLOCKED }),
      );
    }
  });

  it('bloqueia PATCH com Origin incorreto', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const context = createContext('PATCH', 'http://evil.com');

    try {
      await guard.canActivate(context);
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toEqual(
        expect.objectContaining({ code: AUTH_ERROR_CODES.AUTH_CSRF_BLOCKED }),
      );
    }
  });

  it('bloqueia DELETE com Origin incorreto', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const context = createContext('DELETE', 'http://evil.com');

    try {
      await guard.canActivate(context);
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toEqual(
        expect.objectContaining({ code: AUTH_ERROR_CODES.AUTH_CSRF_BLOCKED }),
      );
    }
  });

  it('permite PUT com Origin correto', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const context = createContext('PUT', 'http://localhost:3000');

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('permite PATCH com Origin correto', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const context = createContext('PATCH', 'http://localhost:3000');

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('permite DELETE com Origin correto', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const context = createContext('DELETE', 'http://localhost:3000');

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('permite POST com Origin correto', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const context = createContext('POST', 'http://localhost:3000');

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('bloqueia POST com Origin incorreto', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const context = createContext('POST', 'http://evil.com');

    try {
      await guard.canActivate(context);
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toEqual(
        expect.objectContaining({ code: AUTH_ERROR_CODES.AUTH_CSRF_BLOCKED }),
      );
    }
  });

  it('permite POST sem header Origin (curl, testes, server-to-server)', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const context = createContext('POST', undefined);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('permite POST com Origin vazio', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const context = createContext('POST', '');

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });
});
