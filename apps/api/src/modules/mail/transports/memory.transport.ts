import { Injectable } from '@nestjs/common';
import type { MailTransport } from '../mail.transport';
import type { MailMessage } from '../mail.types';

export interface SentMessage extends MailMessage {
  sentAt: Date;
}

@Injectable()
export class MemoryTransport implements MailTransport {
  public readonly sent: SentMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.sent.push({
      ...message,
      sentAt: new Date(),
    });
  }

  clear(): void {
    this.sent.length = 0;
  }
}
