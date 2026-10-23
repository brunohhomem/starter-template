import { INestApplicationContext, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppConfigModule, ENV } from '../src/config/app-config.module';
import { TestDatabaseModule } from './test-database.module';
import { LoggingModule } from '../src/common/logging/logger.module';
import { MailProcessor } from '../src/modules/mail/mail.processor';
import { MaintenanceProcessor } from '../src/modules/maintenance/maintenance.processor';
import { MailQueueService } from '../src/modules/mail/mail-queue.service';
import { MailService } from '../src/modules/mail/mail.service';
import { SmtpTransport } from '../src/modules/mail/transports/smtp.transport';
import { ResendTransport } from '../src/modules/mail/transports/resend.transport';
import { MemoryTransport } from '../src/modules/mail/transports/memory.transport';
import { QUEUE_PREFIX } from '../src/common/tokens/queue-prefix.token';
import { Logger } from 'nestjs-pino';
import type { Env } from '../src/config/env.schema';
import { DATABASE } from '../src/database/database.module';

export async function startTestWorker(queuePrefix: string): Promise<{
  app: INestApplicationContext;
  memoryTransport: MemoryTransport;
  mailProcessor: MailProcessor;
  maintenanceProcessor: MaintenanceProcessor;
  close: () => Promise<void>;
}> {
  @Module({
    imports: [AppConfigModule, TestDatabaseModule.forRoot(), LoggingModule.forRoot()],
    providers: [
      { provide: QUEUE_PREFIX, useValue: queuePrefix },
      SmtpTransport,
      ResendTransport,
      MemoryTransport,
      MailService,
      {
        provide: MailQueueService,
        useFactory: (env: Env, logger: Logger, prefix: string) =>
          new MailQueueService(env, logger, prefix),
        inject: [ENV, Logger, QUEUE_PREFIX],
      },
      {
        provide: MailProcessor,
        useFactory: (env: Env, mailService: MailService, logger: Logger, prefix: string) =>
          new MailProcessor(env, mailService, logger, prefix),
        inject: [ENV, MailService, Logger, QUEUE_PREFIX],
      },
      {
        provide: MaintenanceProcessor,

        useFactory: (env: Env, db: any, logger: Logger, prefix: string) =>
          new MaintenanceProcessor(env, db, logger, prefix),
        inject: [ENV, DATABASE, Logger, QUEUE_PREFIX],
      },
    ],
  })
  class DynamicTestWorkerModule {}

  const app = await NestFactory.createApplicationContext(DynamicTestWorkerModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));

  const mailProcessor = app.get(MailProcessor);
  const maintenanceProcessor = app.get(MaintenanceProcessor);
  const memoryTransport = app.get(MemoryTransport);

  // Wait for BullMQ Workers to be ready
  await new Promise<void>((resolve) => setTimeout(resolve, 1000));

  const close = async (): Promise<void> => {
    await app.close();
  };

  return { app, memoryTransport, mailProcessor, maintenanceProcessor, close };
}
