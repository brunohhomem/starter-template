import {
  Injectable,
  Inject,
  HttpException,
  HttpStatus,
  Logger,
  type ExecutionContext,
} from '@nestjs/common';
import {
  ThrottlerGuard,
  ThrottlerLimitDetail,
  type ThrottlerModuleOptions,
} from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { REDIS } from '../../redis/redis.module';
import type Redis from 'ioredis';
import { AUTH_ERROR_CODES } from '@starter/shared/auth';
import { ThrottlerStorage } from '@nestjs/throttler/dist/throttler-storage.interface';

interface RequestWithBody {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: Record<string, unknown>;
  user?: { userId?: string } | undefined;
  url?: string;
}

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override readonly logger = new Logger(AppThrottlerGuard.name);

  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
    @Inject(REDIS) private readonly redis: Redis,
  ) {
    super(options, storageService, reflector);
  }

  protected override generateKey(context: ExecutionContext, suffix: string, name: string): string {
    const request = context.switchToHttp().getRequest<RequestWithBody>();

    switch (name) {
      case 'login': {
        const email = (request.body?.email as string | undefined)?.toLowerCase() ?? '';
        const ip = this.getIp(request);
        return `throttle:login:${ip}:${email}`;
      }
      case 'register': {
        const ip = this.getIp(request);
        return `throttle:register:${ip}`;
      }
      case 'refresh': {
        const ip = this.getIp(request);
        return `throttle:refresh:${ip}`;
      }
      case 'change-password': {
        const user = request.user;
        return `throttle:change-password:${user?.userId ?? this.getIp(request)}`;
      }
      case 'forgot': {
        const email = (request.body?.email as string | undefined)?.toLowerCase() ?? '';
        const ip = this.getIp(request);
        return `throttle:forgot:${ip}:${email}`;
      }
      case 'token-submit': {
        const ip = this.getIp(request);
        return `throttle:token-submit:${ip}`;
      }
      case 'resend': {
        const user = request.user;
        return `throttle:resend:${user?.userId ?? this.getIp(request)}`;
      }
      case 'invite': {
        const user = request.user;
        return `throttle:invite:${user?.userId ?? this.getIp(request)}`;
      }
      default: {
        const userId = request.user?.userId;
        if (userId) return `throttle:default:user:${userId}`;
        return `throttle:default:${this.getIp(request)}`;
      }
    }
  }

  private getIp(request: RequestWithBody): string {
    const forwarded = request.headers['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim();
    return request.ip || forwardedIp || 'unknown';
  }

  protected override async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const request = context.switchToHttp().getRequest<RequestWithBody>();
    const response = context.switchToHttp().getResponse();

    const retryAfter = Math.ceil(throttlerLimitDetail.timeToExpire / 1000);

    response.setHeader('Retry-After', retryAfter);

    const requestId = request.headers['x-request-id'];
    const requestIdStr = Array.isArray(requestId) ? requestId[0] : (requestId ?? '');

    throw new HttpException(
      {
        statusCode: 429,
        error: 'Too Many Requests',
        message: 'Muitas requisições, tente novamente mais tarde',
        code: AUTH_ERROR_CODES.RATE_LIMITED,
        requestId: requestIdStr ?? '',
        path: request.url ?? '',
        timestamp: new Date().toISOString(),
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
