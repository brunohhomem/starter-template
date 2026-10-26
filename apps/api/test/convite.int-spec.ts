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
import { makeScenario } from './scenario';

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

  async function loginAdmin() {
    await seedAdmin(getTestDb());
    const scenario = makeScenario(app);
    return scenario.loginAs({ email: 'admin@example.com', password: 'Admin@12345' });
  }

  it('admin convida um e-mail novo; o convidado aceita — entra com o papel convidado', async () => {
    const adminAgent = await loginAdmin();
    const scenario = makeScenario(app, memoryTransport);

    const inviteRes = await adminAgent
      .post('/api/auth/invitations')
      .send({ email: 'convidado@teste.com', role: 'user' })
      .expect(201);

    expect(inviteRes.body.email).toBe('convidado@teste.com');
    expect(inviteRes.body.role).toBe('user');

    const email = await scenario.lastEmailTo('convidado@teste.com');
    expect(email).toBeDefined();
    const token = scenario.extractLinkToken(email!);

    const acceptRes = await request(app.getHttpServer())
      .post('/api/auth/invitations/accept')
      .send({ token, password: 'SenhaConvidado123', fullName: 'Convidado Teste' })
      .expect(200);

    expect(acceptRes.body.user.email).toBe('convidado@teste.com');
    expect(acceptRes.body.user.role).toBe('user');
    expect(acceptRes.body.user.emailVerified).toBe(true);
  });

  it('admin convida um e-mail já cadastrado — 409', async () => {
    const adminAgent = await loginAdmin();

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'jaexiste@teste.com', password: 'SenhaForte123', fullName: 'Já Existe' });

    const pool = getTestPool();
    await pool.query(`UPDATE users SET last_login_at = now() WHERE email = 'jaexiste@teste.com'`);

    const res = await adminAgent
      .post('/api/auth/invitations')
      .send({ email: 'jaexiste@teste.com', role: 'user' })
      .expect(409);

    expect(res.body.code).toBe('AUTH_INVITE_EMAIL_TAKEN');
  });

  it('usuário comum tenta convidar — 403', async () => {
    const scenario = makeScenario(app);
    const user = await scenario.createUser({ email: 'comum@teste.com' });
    const userAgent = await scenario.loginAs(user);

    const res = await userAgent
      .post('/api/auth/invitations')
      .send({ email: 'novo@teste.com', role: 'user' })
      .expect(403);

    expect(res.body).toBeDefined();
  });

  it('convidado aceita convite com CPF inválido — 400', async () => {
    const adminAgent = await loginAdmin();
    const scenario = makeScenario(app, memoryTransport);

    await adminAgent
      .post('/api/auth/invitations')
      .send({ email: 'cpfinvalido@convite.com', role: 'user' });

    const email = await scenario.lastEmailTo('cpfinvalido@convite.com');
    const token = scenario.extractLinkToken(email!);

    const res = await request(app.getHttpServer())
      .post('/api/auth/invitations/accept')
      .send({
        token,
        password: 'SenhaConvidado123',
        fullName: 'CPF Inválido',
        cpf: '111.111.111-11',
      })
      .expect(400);

    expect(Array.isArray(res.body.details)).toBe(true);
  });

  it('convidado reutiliza o link de convite — 400', async () => {
    const adminAgent = await loginAdmin();
    const scenario = makeScenario(app, memoryTransport);

    await adminAgent.post('/api/auth/invitations').send({ email: 'reuse@teste.com', role: 'user' });

    const email = await scenario.lastEmailTo('reuse@teste.com');
    const token = scenario.extractLinkToken(email!);

    await request(app.getHttpServer())
      .post('/api/auth/invitations/accept')
      .send({ token, password: 'SenhaConvidado123', fullName: 'Convidado Reuse' })
      .expect(200);

    const res2 = await request(app.getHttpServer())
      .post('/api/auth/invitations/accept')
      .send({ token, password: 'SenhaConvidado123', fullName: 'Convidado Reuse' })
      .expect(400);
    expect(res2.body.code).toBe('AUTH_EMAIL_TOKEN_INVALID');
  });
});
