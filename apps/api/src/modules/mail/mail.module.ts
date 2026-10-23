import { Module, Global } from '@nestjs/common';
import { MailService } from './mail.service';
import { SmtpTransport } from './transports/smtp.transport';
import { ResendTransport } from './transports/resend.transport';
import { MemoryTransport } from './transports/memory.transport';

@Global()
@Module({
  providers: [MailService, SmtpTransport, ResendTransport, MemoryTransport],
  exports: [MailService],
})
export class MailModule {}
