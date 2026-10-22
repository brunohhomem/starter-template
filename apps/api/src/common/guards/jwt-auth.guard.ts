import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TokenService } from '../../modules/auth/token.service';
import { SessionsRepository } from '../../modules/auth/sessions.repository';
import { AUTH_ERROR_CODES } from '@starter/shared/auth';

interface JwtUser {
  userId: string;
  role: string;
  sessionId: string;
  mustChangePassword: boolean;
}

interface AuthenticatedRequest extends Request {
  user: JwtUser;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
    private readonly sessionsRepository: SessionsRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const accessToken = request.cookies?.access_token;

    if (!accessToken) {
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Não autorizado',
        code: AUTH_ERROR_CODES.AUTH_UNAUTHORIZED,
        requestId: '',
        path: request.url,
        timestamp: new Date().toISOString(),
      });
    }

    const { payload, error } = await this.tokenService.verifyAccess(accessToken);

    if (error === 'expired') {
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Token expirado',
        code: AUTH_ERROR_CODES.AUTH_TOKEN_EXPIRED,
        requestId: '',
        path: request.url,
        timestamp: new Date().toISOString(),
      });
    }

    if (error === 'invalid' || !payload) {
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Não autorizado',
        code: AUTH_ERROR_CODES.AUTH_UNAUTHORIZED,
        requestId: '',
        path: request.url,
        timestamp: new Date().toISOString(),
      });
    }

    // Check if session is revoked
    const session = await this.sessionsRepository.findById(payload.sid);
    if (!session || session.revokedAt) {
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Não autorizado',
        code: AUTH_ERROR_CODES.AUTH_UNAUTHORIZED,
        requestId: '',
        path: request.url,
        timestamp: new Date().toISOString(),
      });
    }

    request.user = {
      userId: payload.sub,
      role: payload.role,
      sessionId: payload.sid,
      mustChangePassword: payload.mcp,
    } satisfies JwtUser;

    return true;
  }
}
