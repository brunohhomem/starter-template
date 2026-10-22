import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { Env } from '../../config/env.schema';
import { ENV } from '../../config/app-config.module';
import { Reflector } from '@nestjs/core';
import { AUTH_ERROR_CODES } from '@starter/shared/auth';

@Injectable()
export class OriginGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(ENV) private readonly env: Env,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Skip if route is @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method;

    // Only check on mutating methods
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return true;
    }

    const origin = request.headers.origin;

    // If no Origin header (curl, tests, server-to-server), allow
    if (!origin) {
      return true;
    }

    // Check if origin matches WEB_ORIGIN
    const webOrigin = this.env.WEB_ORIGIN;

    if (origin !== webOrigin) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Requisição bloqueada por política de origem',
        code: AUTH_ERROR_CODES.AUTH_CSRF_BLOCKED,
        requestId: '',
        path: request.url,
        timestamp: new Date().toISOString(),
      });
    }

    return true;
  }
}
