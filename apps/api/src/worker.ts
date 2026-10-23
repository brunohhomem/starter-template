import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { loadEnv } from './config/load-env';
import { WorkerModule } from './modules/worker/worker.module';
import { Logger } from 'nestjs-pino';
import IORedis from 'ioredis';
import { Queue } from 'bullmq';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const connection = new IORedis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
  });

  // Use 'bull' prefix to match WorkerModule's QUEUE_PREFIX default ('')
  const maintenanceQueue = new Queue('maintenance', { connection, prefix: 'bull' });

  // BullMQ v6: use upsertJobScheduler for repeatable jobs
  await maintenanceQueue.upsertJobScheduler(
    'cleanup-expired',
    { pattern: '0 6 * * *' },
    { name: 'cleanup-expired', data: {} },
  );

  await maintenanceQueue.close();
  await connection.quit();

  console.log('[worker] Workers iniciados e scheduler registrado');
}

void bootstrap();
