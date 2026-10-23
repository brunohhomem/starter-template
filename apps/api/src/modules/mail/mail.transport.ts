import type { MailMessage } from './mail.types';

export interface MailTransport {
  send(message: MailMessage): Promise<void>;
}
