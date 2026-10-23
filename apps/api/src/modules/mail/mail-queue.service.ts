import { Injectable, Inject, Optional, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, JobsOptions } from 'bullmq';
import type { Env } from '../../config/env.schema';
import { ENV } from '../../config/app-config.module';
import IORedis from 'ioredis';
import { Logger } from 'nestjs-pino';
import { QUEUE_PREFIX } from '../../common/tokens/queue-prefix.token';

export type MailJob =
  | { type: 'send-email-confirmation'; payload: { to: string; token: string; expiresAt: string } }
  | { type: 'send-password-reset'; payload: { to: string; token: string; expiresAt: string } }
  | { type: 'send-invite'; payload: { to: string; token: string; expiresAt: string } };

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 10000 },
  removeOnComplete: true,
  removeOnFail: { age: 3600 },
};

@Injectable()
export class MailQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly queue: Queue<MailJob['payload']>;
  private readonly connection: IORedis;
  private readonly logger: Logger;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly loggerService: Logger,
    @Optional() @Inject(QUEUE_PREFIX) private readonly queuePrefix: string = '',
  ) {
    this.logger = loggerService;

    this.connection = new IORedis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
    });

    this.queue = new Queue('mail', { connection: this.connection, prefix: queuePrefix || 'bull' });
  }

  async onModuleInit(): Promise<void> {
    await this.queue.waitUntilReady();
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    await this.connection.quit();
  }

  async enqueue(job: MailJob): Promise<void> {
    try {
      await this.queue.add(job.type, job.payload, DEFAULT_JOB_OPTIONS);
    } catch (error) {
      this.logger.warn({ err: (error as Error).message }, 'Falha ao enfileirar e-mail');
    }
  }
}
