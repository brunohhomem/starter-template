import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, getTestDb } from './integration-setup';
import { resetDatabase } from './integration-utils';
import { startTestWorker } from './test-worker';
import { MailQueueService } from '../src/modules/mail/mail-queue.service';
import { MemoryTransport } from '../src/modules/mail/transports/memory.transport';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { loadEnv } from '../src/config/load-env';
import { sessions } from '../src/modules/auth/session.entity';
import { emailTokens } from '../src/modules/email-tokens/email-token.entity';
import { users } from '../src/modules/auth/user.entity';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

describe('Mail Queue — garantias técnicas', () => {
  let testWorker: Awaited<ReturnType<typeof startTestWorker>>;
  let memoryTransport: MemoryTransport;
  let mailQueueService: MailQueueService;
  let queue: Queue;
  let maintenanceQueue: Queue;
  let connection: IORedis;
  let queuePrefix: string;

  beforeAll(async () => {
    await setupTestDatabase();
    const env = loadEnv();
    queuePrefix = `test-${Date.now()}-`;

    testWorker = await startTestWorker(queuePrefix);
    memoryTransport = testWorker.memoryTransport;
    mailQueueService = testWorker.app.get(MailQueueService);

    connection = new IORedis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
    });

    queue = new Queue('mail', { connection, prefix: queuePrefix });
    maintenanceQueue = new Queue('maintenance', { connection, prefix: queuePrefix });
    await queue.waitUntilReady();
    await maintenanceQueue.waitUntilReady();
  });

  afterAll(async () => {
    await queue.close();
    await maintenanceQueue.close();
    await connection.quit();
    await testWorker.close();
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
    memoryTransport.clear();
    await queue.obliterate({ force: true });
    await maintenanceQueue.obliterate({ force: true });
  });

  it('e-mail com falha temporária é reenviado', async () => {
    memoryTransport.failNextN(2);

    await queue.add(
      'send-email-confirmation',
      {
        to: 'retry@example.com',
        token: 'retry-token',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      },
      { attempts: 5, backoff: { type: 'fixed', delay: 300 }, removeOnComplete: true },
    );

    const start = Date.now();
    while (Date.now() - start < 15000) {
      if (memoryTransport.sent.length >= 1) break;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    expect(memoryTransport.sent.length).toBe(1);
    expect(memoryTransport.sent[0]?.to).toBe('retry@example.com');
  });

  it('limpeza diária apaga sessões e tokens vencidos e preserva os recentes', async () => {
    const db = getTestDb();
    const now = new Date();
    const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

    const userId1 = randomUUID();
    const userId2 = randomUUID();
    await db.insert(users).values({
      id: userId1,
      email: 'user1@test.com',
      passwordHash: 'hash',
    });
    await db.insert(users).values({
      id: userId2,
      email: 'user2@test.com',
      passwordHash: 'hash',
    });

    const expiredSessionId = randomUUID();
    await db.insert(sessions).values({
      id: expiredSessionId,
      userId: userId1,
      familyId: randomUUID(),
      refreshTokenHash: 'hash-1',
      expiresAt: eightDaysAgo,
    });

    const recentSessionId = randomUUID();
    await db.insert(sessions).values({
      id: recentSessionId,
      userId: userId2,
      familyId: randomUUID(),
      refreshTokenHash: 'hash-2',
      expiresAt: oneDayAgo,
    });

    await db.insert(emailTokens).values({
      userId: userId1,
      type: 'email_confirmation',
      tokenHash: 'token-hash-1',
      expiresAt: eightDaysAgo,
    });

    await db.insert(emailTokens).values({
      userId: userId2,
      type: 'password_reset',
      tokenHash: 'token-hash-2',
      expiresAt: oneDayAgo,
    });

    const cleanupJob = await maintenanceQueue.add('cleanup-expired', {});

    const start = Date.now();
    let state = '';
    while (Date.now() - start < 15000) {
      state = await cleanupJob.getState();
      if (state === 'completed' || state === 'failed') break;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    expect(state).toBe('completed');

    const expiredSession = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, expiredSessionId));
    expect(expiredSession.length).toBe(0);

    const recentSession = await db.select().from(sessions).where(eq(sessions.id, recentSessionId));
    expect(recentSession.length).toBe(1);

    const expiredToken = await db
      .select()
      .from(emailTokens)
      .where(eq(emailTokens.tokenHash, 'token-hash-1'));
    expect(expiredToken.length).toBe(0);

    const recentToken = await db
      .select()
      .from(emailTokens)
      .where(eq(emailTokens.tokenHash, 'token-hash-2'));
    expect(recentToken.length).toBe(1);
  });
});
