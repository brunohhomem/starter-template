import { Module } from '@nestjs/common';
import { AppConfigModule } from '../../config/app-config.module';
import { DatabaseModule } from '../../database/database.module';
import { MailModule } from '../mail/mail.module';
import { MailProcessor } from '../mail/mail.processor';
import { MaintenanceProcessor } from '../maintenance/maintenance.processor';
import { QUEUE_PREFIX } from '../../common/tokens/queue-prefix.token';

@Module({
  imports: [AppConfigModule, DatabaseModule, MailModule],
  providers: [{ provide: QUEUE_PREFIX, useValue: '' }, MailProcessor, MaintenanceProcessor],
})
export class WorkerModule {}
