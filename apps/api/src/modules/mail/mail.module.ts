import { Module, Global } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailQueueService } from './mail-queue.service';
import { SmtpTransport } from './transports/smtp.transport';
import { ResendTransport } from './transports/resend.transport';
import { MemoryTransport } from './transports/memory.transport';
import { LoggingModule } from '../../common/logging/logger.module';

@Global()
@Module({
  imports: [LoggingModule.forRoot()],
  providers: [MailService, MailQueueService, SmtpTransport, ResendTransport, MemoryTransport],
  exports: [MailService, MailQueueService, MemoryTransport],
})
export class MailModule {}
