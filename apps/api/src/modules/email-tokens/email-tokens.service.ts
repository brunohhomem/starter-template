import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { ENV } from '../../config/app-config.module';
import type { Env } from '../../config/env.schema';
import type { DatabaseTransaction } from '../../database/database.module';
import { EmailTokensRepository } from './email-tokens.repository';

type EmailTokenType = 'email_confirmation' | 'password_reset' | 'invite';

@Injectable()
export class EmailTokensService {
  constructor(
    private readonly emailTokensRepository: EmailTokensRepository,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async issue(
    userId: string,
    type: EmailTokenType,
    tx?: DatabaseTransaction,
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = this.calcExpiry(type);
    await this.emailTokensRepository.create(userId, type, tokenHash, expiresAt, tx);
    return { token, expiresAt };
  }

  async consume(token: string, type: EmailTokenType): Promise<string> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const emailToken = await this.emailTokensRepository.consume(tokenHash, type);
    if (!emailToken) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Token inválido, expirado ou já utilizado',
        code: 'AUTH_EMAIL_TOKEN_INVALID',
        requestId: '',
        path: '',
        timestamp: new Date().toISOString(),
      });
    }
    return emailToken.userId;
  }

  async invalidate(userId: string, type: EmailTokenType, tx?: DatabaseTransaction): Promise<void> {
    await this.emailTokensRepository.invalidateByUserAndType(userId, type, tx);
  }

  private calcExpiry(type: EmailTokenType): Date {
    const now = Date.now();
    if (type === 'email_confirmation') {
      return new Date(now + this.env.EMAIL_CONFIRM_TTL_HOURS * 3_600_000);
    }
    if (type === 'password_reset') {
      return new Date(now + this.env.PASSWORD_RESET_TTL_MINUTES * 60_000);
    }
    return new Date(now + this.env.INVITE_TTL_DAYS * 86_400_000);
  }
}
