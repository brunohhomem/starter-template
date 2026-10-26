import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp, resetDatabase, resetThrottle } from './integration-utils';
import { setupTestDatabase, teardownTestDatabase, getTestPool } from './integration-setup';
import { startTestWorker } from './test-worker';
import { MemoryTransport } from '../src/modules/mail/transports/memory.transport';
import { waitForEmail, extractToken } from './test-email-helpers';

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

  it('visitante se cadastra com dados válidos — e-mail de confirmação é enviado', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'novo@teste.com', password: 'SenhaForte123' })
      .expect(201);

    expect(res.body.user.emailVerified).toBe(false);

    const email = await waitForEmail(memoryTransport, 'novo@teste.com');
    expect(email).toBeDefined();
    expect(email!.subject).toBe('Confirme seu e-mail');
    const token = extractToken(email!, 'token');
    expect(token).toBeTruthy();
  });

  it('cria usuário e autentica, retorna cookies com flags corretas', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'novo2@teste.com', password: 'SenhaForte123' })
      .expect(201);

    expect(response.body).toMatchObject({
      user: {
        email: 'novo2@teste.com',
        role: 'user',
        mustChangePassword: false,
        emailVerified: false,
      },
    });
    expect(response.body.user.id).toMatch(/^[0-9a-f-]{36}$/i);

    const cookies = response.headers['set-cookie'] as string[];
    expect(cookies).toBeDefined();
    const accessCookie = cookies.find((cookie) => cookie.startsWith('access_token='));
    const refreshCookie = cookies.find((cookie) => cookie.startsWith('refresh_token='));
    expect(accessCookie).toBeDefined();
    expect(refreshCookie).toBeDefined();
    expect(accessCookie).toMatch(/HttpOnly/);
    expect(accessCookie).toMatch(/SameSite=Lax/);
    expect(refreshCookie).toMatch(/Path=\/api\/auth/);
  });

  it('retorna 409 para e-mail duplicado', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'dup@teste.com', password: 'SenhaForte123' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'dup@teste.com', password: 'OutraSenha123' })
      .expect(409);

    expect(response.body.code).toBe('AUTH_EMAIL_TAKEN');
  });

  it('normaliza e-mail para minúsculas', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'MAIUSCULO@TESTE.COM', password: 'SenhaForte123' })
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'maiusculo@teste.com', password: 'SenhaForte123' })
      .expect(200);

    expect(loginResponse.body.user.email).toBe('maiusculo@teste.com');
  });

  it('retorna 400 para senha fraca (menos de 10 bytes)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'fraco@teste.com', password: 'Curta1' })
      .expect(400);

    expect(response.body.details).toBeDefined();
    expect(Array.isArray(response.body.details)).toBe(true);
    expect(response.body.details.length).toBeGreaterThan(0);
  });

  it('retorna 400 para senha só letras', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'somasletras@teste.com', password: 'ApenasLetras' })
      .expect(400);

    expect(response.body.details).toBeDefined();
    expect(Array.isArray(response.body.details)).toBe(true);
    expect(response.body.details.length).toBeGreaterThan(0);
  });

  it('retorna 400 para senha só dígitos', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'somadigitos@teste.com', password: '1234567890' })
      .expect(400);

    expect(response.body.details).toBeDefined();
    expect(Array.isArray(response.body.details)).toBe(true);
    expect(response.body.details.length).toBeGreaterThan(0);
  });

  it('retorna 400 para senha > 72 bytes UTF-8', async () => {
    const longPassword = 'A'.repeat(73) + '1';
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'longa@teste.com', password: longPassword })
      .expect(400);

    expect(response.body.details).toBeDefined();
    expect(Array.isArray(response.body.details)).toBe(true);
    expect(response.body.details.length).toBeGreaterThan(0);
  });

  it('retorna 403 quando cadastro desativado via system_settings', async () => {
    const pool = getTestPool();
    await pool.query(`
      INSERT INTO system_settings (key, value) VALUES ('registration_enabled', 'false')
      ON CONFLICT (key) DO UPDATE SET value = 'false'
    `);

    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'desativado@teste.com', password: 'SenhaForte123' })
      .expect(403);

    expect(response.body.code).toBe('AUTH_REGISTRATION_DISABLED');
  });

  it('retorna 403 quando setting registration_enabled ausente', async () => {
    const pool = getTestPool();
    await pool.query(`DELETE FROM system_settings WHERE key = 'registration_enabled'`);

    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'semsetting@teste.com', password: 'SenhaForte123' })
      .expect(403);

    expect(response.body.code).toBe('AUTH_REGISTRATION_DISABLED');
  });

  it('sempre cria usuário com role=user mesmo se body enviar role', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'role@teste.com', password: 'SenhaForte123', role: 'admin' })
      .expect(201);

    expect(response.body.user.role).toBe('user');
  });
});
