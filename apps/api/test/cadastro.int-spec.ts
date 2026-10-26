import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp, resetDatabase, resetThrottle } from './integration-utils';
import { setupTestDatabase, teardownTestDatabase, getTestPool } from './integration-setup';
import { startTestWorker } from './test-worker';
import { MemoryTransport } from '../src/modules/mail/transports/memory.transport';
import { makeScenario } from './scenario';

describe('Cadastro', () => {
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

  it('Visitante se cadastra com dados válidos', async () => {
    const scenario = makeScenario(app, memoryTransport);

    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'novo@teste.com', password: 'SenhaForte123', fullName: 'João Silva' })
      .expect(201);

    expect(res.body).toMatchObject({
      user: {
        email: 'novo@teste.com',
        role: 'user',
        mustChangePassword: false,
        emailVerified: false,
      },
    });
    expect(res.body.user.id).toMatch(/^[0-9a-f-]{36}$/i);

    const cookies = res.headers['set-cookie'] as string[];
    const accessCookie = cookies.find((cookie) => cookie.startsWith('access_token='));
    const refreshCookie = cookies.find((cookie) => cookie.startsWith('refresh_token='));
    expect(accessCookie).toBeDefined();
    expect(refreshCookie).toBeDefined();
    expect(accessCookie).toMatch(/HttpOnly/);
    expect(accessCookie).toMatch(/SameSite=Lax/);
    expect(refreshCookie).toMatch(/Path=\/api\/auth/);

    const email = await scenario.lastEmailTo('novo@teste.com');
    expect(email).toBeDefined();
    expect(email!.subject).toBe('Confirme seu e-mail');
    const token = scenario.extractLinkToken(email!);
    expect(token).toBeTruthy();
  });

  it('Visitante se cadastra com e-mail inválido — 400, erro no campo email', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'nao-e-um-email', password: 'SenhaForte123', fullName: 'João Silva' })
      .expect(400);

    expect(Array.isArray(res.body.details)).toBe(true);
    const details = res.body.details as Array<{ path: (string | number)[]; message: string }>;
    expect(details.some((detail) => detail.path[0] === 'email')).toBe(true);
  });

  it('Visitante se cadastra com senha fora da política (curta, só letras, só números)', async () => {
    const cases = [
      { password: 'Curta1' },
      { password: 'ApenasLetras' },
      { password: '1234567890' },
    ];

    for (const { password } of cases) {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'politica@teste.com', password, fullName: 'João Silva' })
        .expect(400);

      expect(Array.isArray(res.body.details)).toBe(true);
      expect(res.body.details.length).toBeGreaterThan(0);
    }
  });

  it('Visitante se cadastra com e-mail já cadastrado', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'dup@teste.com', password: 'SenhaForte123', fullName: 'João Silva' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'dup@teste.com', password: 'OutraSenha123', fullName: 'João Silva' })
      .expect(409);

    expect(res.body.code).toBe('AUTH_EMAIL_TAKEN');
  });

  it('Visitante tenta se cadastrar com o cadastro desligado', async () => {
    const pool = getTestPool();
    await pool.query(`
      INSERT INTO system_settings (key, value) VALUES ('registration_enabled', 'false')
      ON CONFLICT (key) DO UPDATE SET value = 'false'
    `);

    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'desativado@teste.com', password: 'SenhaForte123', fullName: 'João Silva' })
      .expect(403);

    expect(res.body.code).toBe('AUTH_REGISTRATION_DISABLED');
  });

  it('Visitante envia role: admin no cadastro', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'role@teste.com',
        password: 'SenhaForte123',
        fullName: 'João Silva',
        role: 'admin',
      })
      .expect(201);

    expect(res.body.user.role).toBe('user');
  });

  it('Visitante se cadastra com CPF inválido — 400, erro no campo cpf', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'cpfinvalido@teste.com',
        password: 'SenhaForte123',
        fullName: 'João Silva',
        cpf: '000.000.000-00',
      })
      .expect(400);

    expect(Array.isArray(res.body.details)).toBe(true);
    const details = res.body.details as Array<{ path: (string | number)[]; message: string }>;
    expect(details.some((detail) => detail.path[0] === 'cpf')).toBe(true);
  });

  it('Visitante se cadastra com CPF já usado — 409', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'primeiro@teste.com',
        password: 'SenhaForte123',
        fullName: 'João Silva',
        cpf: '529.982.247-25',
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'segundo@teste.com',
        password: 'SenhaForte123',
        fullName: 'Maria Silva',
        cpf: '529.982.247-25',
      })
      .expect(409);

    expect(res.body.code).toBe('PEOPLE_CPF_TAKEN');
  });
});
