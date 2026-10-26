import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AUDIT_ACTIONS } from '@starter/shared';
import { AuditService } from '../audit/audit.service';
import { EmailTokensService } from '../email-tokens/email-tokens.service';
import { MailQueueService } from '../mail/mail-queue.service';
import { UsersRepository } from './users.repository';

@Injectable()
export class EmailConfirmationService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly emailTokensService: EmailTokensService,
    private readonly mailQueueService: MailQueueService,
    private readonly auditService: AuditService,
  ) {}

  async confirmEmail(token: string, ip?: string): Promise<void> {
    const userId = await this.emailTokensService.consume(token, 'email_confirmation');
    await this.usersRepository.verifyEmail(userId);
    void this.auditService
      .record({ actorUserId: userId, action: AUDIT_ACTIONS.AUTH_EMAIL_CONFIRMED, ip: ip ?? null })
      .catch(() => undefined);
  }

  async resendEmailConfirmation(userId: string): Promise<void> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Não autorizado',
        code: 'AUTH_UNAUTHORIZED',
        requestId: '',
        path: '/api/auth/email/resend',
        timestamp: new Date().toISOString(),
      });
    }
    if (user.emailVerifiedAt) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: 'E-mail já confirmado',
        code: 'AUTH_EMAIL_ALREADY_CONFIRMED',
        requestId: '',
        path: '/api/auth/email/resend',
        timestamp: new Date().toISOString(),
      });
    }
    await this.emailTokensService.invalidate(userId, 'email_confirmation');
    const { token, expiresAt } = await this.emailTokensService.issue(userId, 'email_confirmation');
    void this.mailQueueService
      .enqueue({
        type: 'send-email-confirmation',
        payload: { to: user.email, token, expiresAt: expiresAt.toISOString() },
      })
      .catch(() => undefined);
  }
}
