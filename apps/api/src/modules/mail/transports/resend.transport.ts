import { Injectable, Inject } from '@nestjs/common';
import { Resend } from 'resend';
import type { CreateEmailOptions } from 'resend';
import { ENV } from '../../../config/app-config.module';
import type { Env } from '../../../config/env.schema';
import type { MailTransport } from '../mail.transport';
import type { MailMessage } from '../mail.types';
import { UnrecoverableMailError } from '../mail.errors';

@Injectable()
export class ResendTransport implements MailTransport {
  private _client: Resend | null = null;

  constructor(@Inject(ENV) private readonly env: Env) {}

  private resendClient(): Resend {
    if (!this._client) {
      this._client = new Resend(this.env.RESEND_API_KEY);
    }
    return this._client;
  }

  /** Only for testing: allows injecting a mock Resend client */
  setClientForTesting(client: Resend): void {
    this._client = client;
  }

  async send(message: MailMessage): Promise<void> {
    const to = Array.isArray(message.to) ? message.to : [message.to];
    const payload: CreateEmailOptions = {
      from: message.from,
      to,
      subject: message.subject,
      ...(message.text !== undefined && { text: message.text }),
      ...(message.html !== undefined && { html: message.html }),
      ...(message.replyTo !== undefined && { replyTo: message.replyTo }),
      ...(message.headers !== undefined && { headers: message.headers }),
    } as CreateEmailOptions;
    const result = await this.resendClient().emails.send(payload);

    if (result.error) {
      const statusCode = (result.error as { statusCode?: number }).statusCode;
      if (statusCode && statusCode >= 400 && statusCode < 500) {
        throw new UnrecoverableMailError(`Resend error: ${result.error.message}`);
      }
      throw new Error(`Resend error: ${result.error.message}`);
    }
  }
}
