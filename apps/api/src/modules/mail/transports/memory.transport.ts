import { Injectable } from '@nestjs/common';
import type { MailTransport } from '../mail.transport';
import type { MailMessage } from '../mail.types';

export interface SentMessage extends MailMessage {
  sentAt: Date;
}

@Injectable()
export class MemoryTransport implements MailTransport {
  public readonly sent: SentMessage[] = [];
  private _failCount = 0;

  async send(message: MailMessage): Promise<void> {
    if (this._failCount > 0) {
      this._failCount--;
      throw new Error('Transient transport failure (test simulation)');
    }
    this.sent.push({
      ...message,
      sentAt: new Date(),
    });
  }

  clear(): void {
    this.sent.length = 0;
    this._failCount = 0;
  }

  failNextN(count: number): void {
    this._failCount = count;
  }
}
