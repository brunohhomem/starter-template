import { Injectable, Inject } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';
import { ENV } from '../../../config/app-config.module';
import type { Env } from '../../../config/env.schema';
import type { MailTransport } from '../mail.transport';
import type { MailMessage } from '../mail.types';

@Injectable()
export class SmtpTransport implements MailTransport {
  private transporter: Transporter;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.transporter = createTransport({
      host: this.env.SMTP_HOST,
      port: this.env.SMTP_PORT,
      secure: this.env.SMTP_PORT === 465,
      ignoreTLS: this.env.NODE_ENV === 'development',
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: message.from,
      to: Array.isArray(message.to) ? message.to.join(', ') : message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      replyTo: message.replyTo,
      headers: message.headers,
    });
  }
}
