import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp, resetDatabase, resetThrottle } from './integration-utils';
import {
  setupTestDatabase,
  teardownTestDatabase,
  getTestPool,
  getTestDb,
} from './integration-setup';
import { startTestWorker } from './test-worker';
import { MemoryTransport } from '../src/modules/mail/transports/memory.transport';
import { seedAdmin } from '../src/database/seed/admin.seed';
import { waitForEmail, extractToken } from './test-email-helpers';

describe('Convite', () => {
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

  async function loginAdmin(): Promise<string> {
    await seedAdmin(getTestDb());
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'Admin@12345' });
    return (loginRes.headers['set-cookie'] as string[])
      .map((cookie) => cookie.split(';')[0])
      .join('; ');
  }

  it('admin convida um e-mail novo; o convidado aceita — entra com o papel convidado', async () => {
    const adminCookies = await loginAdmin();

    const inviteRes = await request(app.getHttpServer())
      .post('/api/auth/invitations')
      .set('Cookie', adminCookies)
      .send({ email: 'convidado@teste.com', role: 'user' })
      .expect(201);

    expect(inviteRes.body.email).toBe('convidado@teste.com');
    expect(inviteRes.body.role).toBe('user');

    const email = await waitForEmail(memoryTransport, 'convidado@teste.com');
    expect(email).toBeDefined();
    const token = extractToken(email!, 'token');

    const acceptRes = await request(app.getHttpServer())
      .post('/api/auth/invitations/accept')
      .send({ token, password: 'SenhaConvidado123' })
      .expect(200);

    expect(acceptRes.body.user.email).toBe('convidado@teste.com');
    expect(acceptRes.body.user.role).toBe('user');
    expect(acceptRes.body.user.emailVerified).toBe(true);
  });

  it('admin convida um e-mail já cadastrado — 409', async () => {
    const adminCookies = await loginAdmin();

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'jaexiste@teste.com', password: 'SenhaForte123' });

    const pool = getTestPool();
    await pool.query(`UPDATE users SET last_login_at = now() WHERE email = 'jaexiste@teste.com'`);

    const res = await request(app.getHttpServer())
      .post('/api/auth/invitations')
      .set('Cookie', adminCookies)
      .send({ email: 'jaexiste@teste.com', role: 'user' })
      .expect(409);

    expect(res.body.code).toBe('AUTH_INVITE_EMAIL_TAKEN');
  });

  it('usuário comum tenta convidar — 403', async () => {
    const userRegRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'comum@teste.com', password: 'SenhaForte123' });
    const userCookies = (userRegRes.headers['set-cookie'] as string[])
      .map((cookie) => cookie.split(';')[0])
      .join('; ');

    const res = await request(app.getHttpServer())
      .post('/api/auth/invitations')
      .set('Cookie', userCookies)
      .send({ email: 'novo@teste.com', role: 'user' })
      .expect(403);

    expect(res.body).toBeDefined();
  });

  it('convidado reutiliza o link de convite — 400', async () => {
    const adminCookies = await loginAdmin();

    await request(app.getHttpServer())
      .post('/api/auth/invitations')
      .set('Cookie', adminCookies)
      .send({ email: 'reuse@teste.com', role: 'user' });

    const email = await waitForEmail(memoryTransport, 'reuse@teste.com');
    const token = extractToken(email!, 'token');

    await request(app.getHttpServer())
      .post('/api/auth/invitations/accept')
      .send({ token, password: 'SenhaConvidado123' })
      .expect(200);

    const res2 = await request(app.getHttpServer())
      .post('/api/auth/invitations/accept')
      .send({ token, password: 'SenhaConvidado123' })
      .expect(400);
    expect(res2.body.code).toBe('AUTH_EMAIL_TOKEN_INVALID');
  });
});
