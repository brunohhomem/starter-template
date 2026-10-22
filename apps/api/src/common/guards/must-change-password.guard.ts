import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AUTH_ERROR_CODES } from '@starter/shared/auth';

/**
 * Guard que bloqueia rotas protegidas quando o usuário tem must_change_password=true.
 * Exceções (permitidas mesmo com mustChangePassword=true):
 * - GET /auth/me
 * - POST /auth/change-password
 * - POST /auth/logout
 */
@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Skip if route is @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { mustChangePassword?: boolean } | undefined;

    // If no user or mustChangePassword is false, allow
    if (!user || !user.mustChangePassword) {
      return true;
    }

    // Allow specific endpoints even when mustChangePassword is true
    const method = request.method;
    const rawPath: string = request.route?.path ?? request.url ?? '';
    // Strip any global prefix (e.g. /api) so matching is prefix-agnostic
    const path = rawPath.replace(/^\/api/, '');

    const allowedPaths = ['/auth/me', '/auth/change-password', '/auth/logout'];
    const isAllowed = allowedPaths.some(
      (allowedPath) => path === allowedPath || path.startsWith(allowedPath + '/'),
    );

    if (isAllowed && (method === 'GET' || method === 'POST')) {
      return true;
    }

    throw new ForbiddenException({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Troca de senha obrigatória',
      code: AUTH_ERROR_CODES.AUTH_MUST_CHANGE_PASSWORD,
      requestId: '',
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
