import { Injectable, Inject } from '@nestjs/common';
import { ENV } from '../../config/app-config.module';
import type { Env } from '../../config/env.schema';
import type { MailMessage } from './mail.types';
import type { MailTransport } from './mail.transport';
import { SmtpTransport } from './transports/smtp.transport';
import { ResendTransport } from './transports/resend.transport';
import { MemoryTransport } from './transports/memory.transport';

@Injectable()
export class MailService {
  private readonly transport: MailTransport;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly smtpTransport: SmtpTransport,
    private readonly resendTransport: ResendTransport,
    private readonly memoryTransport: MemoryTransport,
  ) {
    this.transport = this.selectTransport();
  }

  private selectTransport(): MailTransport {
    if (this.env.MAIL_DRIVER === 'memory' && this.env.NODE_ENV !== 'test') {
      throw new Error('MAIL_DRIVER: memory driver só permitido em NODE_ENV=test');
    }
    if (this.env.NODE_ENV === 'production') {
      if (this.env.MAIL_DRIVER !== 'resend') {
        throw new Error('MAIL_DRIVER: deve ser "resend" em produção');
      }
      if (!this.env.RESEND_API_KEY || this.env.RESEND_API_KEY.trim() === '') {
        throw new Error('RESEND_API_KEY: obrigatório em produção com driver resend');
      }
    }
    switch (this.env.MAIL_DRIVER) {
      case 'smtp':
        return this.smtpTransport;
      case 'resend':
        return this.resendTransport;
      case 'memory':
        return this.memoryTransport;
      default:
        throw new Error(`Unknown mail driver: ${this.env.MAIL_DRIVER}`);
    }
  }

  async sendNow(message: MailMessage): Promise<void> {
    await this.transport.send(message);
  }

  getTransport(): MailTransport {
    return this.transport;
  }
}
