import { Injectable, Inject, Optional, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { Logger } from 'nestjs-pino';
import { lt, sql } from 'drizzle-orm';
import type { Env } from '../../config/env.schema';
import { ENV } from '../../config/app-config.module';
import type { Database } from '../../database/database.module';
import { DATABASE } from '../../database/database.module';
import { emailTokens } from '../../modules/email-tokens/email-token.entity';
import { sessions } from '../../modules/auth/session.entity';
import { QUEUE_PREFIX } from '../../common/tokens/queue-prefix.token';

@Injectable()
export class MaintenanceProcessor implements OnModuleInit, OnModuleDestroy {
  private worker: Worker<unknown, void, string> | null = null;
  private connection: IORedis | null = null;

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(DATABASE) private readonly db: Database,
    private readonly logger: Logger,
    @Optional() @Inject(QUEUE_PREFIX) private readonly queuePrefix: string = '',
  ) {}

  async onModuleInit(): Promise<void> {
    this.connection = new IORedis({
      host: this.env.REDIS_HOST,
      port: this.env.REDIS_PORT,
      password: this.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
    });

    this.worker = new Worker<unknown, void, string>(
      'maintenance',
      async (job: Job<unknown, void, string>) => {
        await this.processJob(job);
      },
      {
        connection: this.connection,
        prefix: this.queuePrefix || 'bull',
        concurrency: 1,
      },
    );

    this.worker.on('failed', (job: Job<unknown, void, string> | undefined, err: Error) => {
      if (job) {
        this.logger.warn(
          { jobId: job.id, jobName: job.name, err: err.message },
          'Job de manutenção falhou',
        );
      }
    });

    await this.worker.waitUntilReady();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    if (this.connection) {
      await this.connection.quit();
    }
  }

  private async processJob(job: Job<unknown, void, string>): Promise<void> {
    if (job.name !== 'cleanup-expired') {
      this.logger.warn({ jobName: job.name }, 'Job de manutenção desconhecido');
      return;
    }

    const sevenDaysAgo = sql`now() - interval '7 days'`;

    const deletedTokensResult = await this.db
      .delete(emailTokens)
      .where(lt(emailTokens.expiresAt, sevenDaysAgo));
    const deletedTokens = deletedTokensResult.rowCount ?? 0;

    const deletedSessionsResult = await this.db
      .delete(sessions)
      .where(lt(sessions.expiresAt, sevenDaysAgo));
    const deletedSessions = deletedSessionsResult.rowCount ?? 0;

    this.logger.log(
      { deletedTokens, deletedSessions },
      'Limpeza de tokens e sessões expirados concluída',
    );
  }
}
