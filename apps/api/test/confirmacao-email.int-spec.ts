import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp, resetDatabase, resetThrottle } from './integration-utils';
import { setupTestDatabase, teardownTestDatabase } from './integration-setup';
import { startTestWorker } from './test-worker';
import { MemoryTransport } from '../src/modules/mail/transports/memory.transport';
import { waitForEmail, extractToken } from './test-email-helpers';

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
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'confirma@teste.com', password: 'SenhaForte123' });

    const email = await waitForEmail(memoryTransport, 'confirma@teste.com');
    expect(email).toBeDefined();
    const token = extractToken(email!, 'token');

    await request(app.getHttpServer()).post('/api/auth/email/confirm').send({ token }).expect(204);

    const res2 = await request(app.getHttpServer())
      .post('/api/auth/email/confirm')
      .send({ token })
      .expect(400);
    expect(res2.body.code).toBe('AUTH_EMAIL_TOKEN_INVALID');
  });

  it('usuário já confirmado pede reenvio — 409', async () => {
    const registerRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'jaconfirmado@teste.com', password: 'SenhaForte123' });

    const cookies = (registerRes.headers['set-cookie'] as string[])
      .map((cookie) => cookie.split(';')[0])
      .join('; ');

    const email = await waitForEmail(memoryTransport, 'jaconfirmado@teste.com');
    const token = extractToken(email!, 'token');

    await request(app.getHttpServer()).post('/api/auth/email/confirm').send({ token }).expect(204);

    const resend = await request(app.getHttpServer())
      .post('/api/auth/email/resend')
      .set('Cookie', cookies)
      .expect(409);
    expect(resend.body.code).toBe('AUTH_EMAIL_ALREADY_CONFIRMED');
  });
});
