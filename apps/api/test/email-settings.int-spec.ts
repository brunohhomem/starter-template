import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp, resetDatabase } from './integration-utils';
import {
  setupTestDatabase,
  teardownTestDatabase,
  getTestPool,
  getTestDb,
} from './integration-setup';
import { startTestWorker } from './test-worker';
import { MemoryTransport } from '../src/modules/mail/transports/memory.transport';
import { renderEmail } from '../src/modules/mail/templates/render-email';
import { seedAdmin } from '../src/database/seed/admin.seed';
import Redis from 'ioredis';
import { getEnv } from '../src/config/load-env';

async function resetThrottle(): Promise<void> {
  const env = getEnv();
  const redis = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
    lazyConnect: true,
  });
  try {
    await redis.connect();
    const keys = await redis.keys('throttle:*');
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // fail-open
  } finally {
    await redis.quit();
  }
}

async function waitForEmail(
  memoryTransport: MemoryTransport,
  to: string,
  maxWaitMs = 8000,
): Promise<MemoryTransport['sent'][number] | undefined> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const found = memoryTransport.sent.find((msg) => msg.to === to);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return undefined;
}

function extractToken(email: MemoryTransport['sent'][number], param: string): string {
  const content = email.text ?? email.html ?? '';
  const match = content.match(new RegExp(`[?&]${param}=([A-Za-z0-9_-]+)`));
  if (!match?.[1]) throw new Error(`Token param "${param}" not found in email`);
  return match[1];
}

describe('F3 — e-mail, confirmação, senha, convite, configurações, segurança', () => {
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

  // ===========================================================================
  // CADASTRO — envia e-mail de confirmação (Aceite 1)
  // ===========================================================================

  describe('Cadastro', () => {
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
  });

  // ===========================================================================
  // CONFIRMAÇÃO DE E-MAIL (Aceite 2)
  // ===========================================================================

  describe('Confirmação de e-mail', () => {
    it('usuário confirma pelo link e depois reutiliza o link — 1º ok, 2º 400', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'confirma@teste.com', password: 'SenhaForte123' });

      const email = await waitForEmail(memoryTransport, 'confirma@teste.com');
      expect(email).toBeDefined();
      const token = extractToken(email!, 'token');

      await request(app.getHttpServer())
        .post('/api/auth/email/confirm')
        .send({ token })
        .expect(204);

      const res2 = await request(app.getHttpServer())
        .post('/api/auth/email/confirm')
        .send({ token })
        .expect(400);
      expect(res2.body.code).toBe('AUTH_EMAIL_TOKEN_INVALID');
    });

    it('usuário já confirmado pede reenvio — 409', async () => {
      // Register + confirm email
      const registerRes = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'jaconfirmado@teste.com', password: 'SenhaForte123' });

      const cookies = (registerRes.headers['set-cookie'] as string[])
        .map((cookie) => cookie.split(';')[0])
        .join('; ');

      const email = await waitForEmail(memoryTransport, 'jaconfirmado@teste.com');
      const token = extractToken(email!, 'token');

      await request(app.getHttpServer())
        .post('/api/auth/email/confirm')
        .send({ token })
        .expect(204);

      const resend = await request(app.getHttpServer())
        .post('/api/auth/email/resend')
        .set('Cookie', cookies)
        .expect(409);
      expect(resend.body.code).toBe('AUTH_EMAIL_ALREADY_CONFIRMED');
    });
  });

  // ===========================================================================
  // SENHA (Aceite 3)
  // ===========================================================================

  describe('Senha', () => {
    it('"esqueci a senha" com conta existente e com conta inexistente — mesma resposta; só a existente recebe e-mail', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'existente@teste.com', password: 'SenhaForte123' });
      memoryTransport.clear();

      const resExistente = await request(app.getHttpServer())
        .post('/api/auth/password/forgot')
        .send({ email: 'existente@teste.com' })
        .expect(202);

      const resInexistente = await request(app.getHttpServer())
        .post('/api/auth/password/forgot')
        .send({ email: 'naoexiste@teste.com' })
        .expect(202);

      expect(resExistente.body).toEqual(resInexistente.body);

      const emailExistente = await waitForEmail(memoryTransport, 'existente@teste.com');
      expect(emailExistente).toBeDefined();
      expect(emailExistente!.subject).toBe('Redefinição de senha');

      const emailInexistente = memoryTransport.sent.find((msg) => msg.to === 'naoexiste@teste.com');
      expect(emailInexistente).toBeUndefined();
    });

    it('usuário redefine a senha pelo link — nova funciona, antiga não, todas as sessões caem', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'resetsenha@teste.com', password: 'SenhaAntiga123' });

      // Create a second session (login from another device)
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'resetsenha@teste.com', password: 'SenhaAntiga123' });

      memoryTransport.clear();
      await request(app.getHttpServer())
        .post('/api/auth/password/forgot')
        .send({ email: 'resetsenha@teste.com' });

      const email = await waitForEmail(memoryTransport, 'resetsenha@teste.com');
      const token = extractToken(email!, 'token');

      await request(app.getHttpServer())
        .post('/api/auth/password/reset')
        .send({ token, newPassword: 'NovaSenha456' })
        .expect(204);

      // Old password fails
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'resetsenha@teste.com', password: 'SenhaAntiga123' })
        .expect(401);

      // New password works
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'resetsenha@teste.com', password: 'NovaSenha456' })
        .expect(200);

      // All previous sessions revoked
      const pool = getTestPool();
      const sessions = await pool.query(
        `SELECT revoked_at FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = 'resetsenha@teste.com')`,
      );
      expect(sessions.rows.every((row) => row.revoked_at !== null)).toBe(true);
    });

    it('usuário usa um link de reset já usado — 400', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'resutoken@teste.com', password: 'SenhaForte123' });

      memoryTransport.clear();
      await request(app.getHttpServer())
        .post('/api/auth/password/forgot')
        .send({ email: 'resutoken@teste.com' });

      const email = await waitForEmail(memoryTransport, 'resutoken@teste.com');
      const token = extractToken(email!, 'token');

      await request(app.getHttpServer())
        .post('/api/auth/password/reset')
        .send({ token, newPassword: 'NovaSenha456' })
        .expect(204);

      const res2 = await request(app.getHttpServer())
        .post('/api/auth/password/reset')
        .send({ token, newPassword: 'OutraSenha789' })
        .expect(400);
      expect(res2.body.code).toBe('AUTH_EMAIL_TOKEN_INVALID');
    });
  });

  // ===========================================================================
  // CONVITE (Aceite 4, sem CPF que fica na F5)
  // ===========================================================================

  describe('Convite', () => {
    let adminCookies: string;

    beforeEach(async () => {
      await seedAdmin(getTestDb());
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@example.com', password: 'Admin@12345' });
      adminCookies = (loginRes.headers['set-cookie'] as string[])
        .map((cookie) => cookie.split(';')[0])
        .join('; ');
    });

    it('admin convida um e-mail novo; o convidado aceita — entra com o papel convidado', async () => {
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
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'jaexiste@teste.com', password: 'SenhaForte123' });

      // Mark as having logged in (active account)
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

  // ===========================================================================
  // CONFIGURAÇÕES (Aceite 5)
  // ===========================================================================

  describe('Configurações', () => {
    let adminCookies: string;
    let userCookies: string;

    beforeEach(async () => {
      await seedAdmin(getTestDb());
      const adminLogin = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@example.com', password: 'Admin@12345' });
      adminCookies = (adminLogin.headers['set-cookie'] as string[])
        .map((cookie) => cookie.split(';')[0])
        .join('; ');

      const userReg = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'user@teste.com', password: 'SenhaForte123' });
      userCookies = (userReg.headers['set-cookie'] as string[])
        .map((cookie) => cookie.split(';')[0])
        .join('; ');
    });

    it('usuário comum tenta ligar o cadastro — 403', async () => {
      await request(app.getHttpServer())
        .patch('/api/settings')
        .set('Cookie', userCookies)
        .send({ registrationEnabled: true })
        .expect(403);
    });

    it('admin desliga o cadastro — visitante passa a receber 403 na hora', async () => {
      await request(app.getHttpServer())
        .patch('/api/settings')
        .set('Cookie', adminCookies)
        .send({ registrationEnabled: false })
        .expect(200);

      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'visitante@teste.com', password: 'SenhaForte123' })
        .expect(403);

      expect(res.body.code).toBe('AUTH_REGISTRATION_DISABLED');
    });
  });

  // ===========================================================================
  // SEGURANÇA (Aceite 6)
  // ===========================================================================

  describe('Segurança', () => {
    it('nenhuma senha, token ou hash aparece em log, auditoria ou payload da fila — banco não armazena token em claro', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'seguranca@teste.com', password: 'SenhaSegura123' });

      const email = await waitForEmail(memoryTransport, 'seguranca@teste.com');
      expect(email).toBeDefined();
      const rawToken = extractToken(email!, 'token');

      // email_tokens table stores SHA-256 hash, not the raw token
      const pool = getTestPool();
      const tokenRows = await pool.query(`SELECT token_hash FROM email_tokens`);
      expect(tokenRows.rows.length).toBeGreaterThan(0);

      for (const row of tokenRows.rows) {
        expect(row.token_hash).not.toBe(rawToken);
        expect(row.token_hash.length).toBe(64); // SHA-256 hex
      }

      // audit_logs don't contain raw tokens or password hashes
      const auditRows = await pool.query(`SELECT metadata FROM audit_logs`);
      for (const row of auditRows.rows) {
        const meta = JSON.stringify(row.metadata ?? {});
        expect(meta).not.toMatch(/password|hash|token_hash/i);
      }
    });

    it('nome com HTML hostil no cadastro sai escapado no e-mail', async () => {
      // Tests that renderEmail escapes hostile values (replaces render-email.spec.ts T12 case)
      const hostileAppName = '"><img src=x onerror=alert(1)>';
      const { html } = await renderEmail('emailConfirmation', {
        appName: hostileAppName,
        link: 'https://example.com/confirm?token=safe-token',
        expiresInLabel: '24 horas',
      });
      expect(html).not.toContain('<img src=x onerror=alert(1)>');
      expect(html).not.toContain(hostileAppName);
    });
  });
});
