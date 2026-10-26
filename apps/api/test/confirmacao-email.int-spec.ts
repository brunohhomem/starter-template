import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp, resetDatabase, resetThrottle } from './integration-utils';
import { setupTestDatabase, teardownTestDatabase } from './integration-setup';
import { startTestWorker } from './test-worker';
import { MemoryTransport } from '../src/modules/mail/transports/memory.transport';
import { makeScenario } from './scenario';

describe('Confirmação de e-mail', () => {
  let app: INestApplication;
  let testWorker: Awaited<ReturnType<typeof startTestWorker>>;
  let memoryTransport: MemoryTransport;

  beforeAll(async () => {
    await setupTestDatabase();
    testWorker = await startTestWorker('');
    memoryTransport = testWorker.memoryTransport;
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp(app);
    await testWorker.close();
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
    memoryTransport.clear();
    await resetThrottle();
  });

  it('usuário confirma pelo link e depois reutiliza o link — 1º ok, 2º 400', async () => {
    const scenario = makeScenario(app, memoryTransport);
    await scenario.createUser({ email: 'confirma@teste.com' });

    const email = await scenario.lastEmailTo('confirma@teste.com');
    expect(email).toBeDefined();
    const token = scenario.extractLinkToken(email!);

    await request(app.getHttpServer()).post('/api/auth/email/confirm').send({ token }).expect(204);

    const res2 = await request(app.getHttpServer())
      .post('/api/auth/email/confirm')
      .send({ token })
      .expect(400);
    expect(res2.body.code).toBe('AUTH_EMAIL_TOKEN_INVALID');
  });

  it('usuário já confirmado pede reenvio — 409', async () => {
    const scenario = makeScenario(app, memoryTransport);
    const user = await scenario.createUser({ email: 'jaconfirmado@teste.com' });

    const email = await scenario.lastEmailTo('jaconfirmado@teste.com');
    const token = scenario.extractLinkToken(email!);
    await request(app.getHttpServer()).post('/api/auth/email/confirm').send({ token }).expect(204);

    const agent = await scenario.loginAs(user);
    const resend = await agent.post('/api/auth/email/resend').expect(409);
    expect(resend.body.code).toBe('AUTH_EMAIL_ALREADY_CONFIRMED');
  });
});
