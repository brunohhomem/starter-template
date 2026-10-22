import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AUTH_ERROR_CODES } from '@starter/shared/auth';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { role?: string } | undefined;

    if (!user || !user.role) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Acesso negado',
        code: AUTH_ERROR_CODES.AUTH_FORBIDDEN,
        requestId: '',
        path: request.url,
        timestamp: new Date().toISOString(),
      });
    }

    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Acesso negado',
        code: AUTH_ERROR_CODES.AUTH_FORBIDDEN,
        requestId: '',
        path: request.url,
        timestamp: new Date().toISOString(),
      });
    }

    return true;
  }
}
