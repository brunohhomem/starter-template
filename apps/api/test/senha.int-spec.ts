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
import { waitForEmail, extractToken } from './test-email-helpers';
import { seedAdmin } from '../src/database/seed/admin.seed';

describe('Senha', () => {
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

  it('"esqueci a senha" com conta existente e com conta inexistente — mesma resposta; só a existente recebe e-mail', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'existente@teste.com', password: 'SenhaForte123' });
    await waitForEmail(memoryTransport, 'existente@teste.com');
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
    await waitForEmail(memoryTransport, 'resetsenha@teste.com');

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

    const pool = getTestPool();
    const sessions = await pool.query(
      `SELECT revoked_at FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = 'resetsenha@teste.com')`,
    );
    expect(sessions.rows.every((row) => row.revoked_at !== null)).toBe(true);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'resetsenha@teste.com', password: 'SenhaAntiga123' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'resetsenha@teste.com', password: 'NovaSenha456' })
      .expect(200);
  });

  it('usuário usa um link de reset já usado — 400', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'resutoken@teste.com', password: 'SenhaForte123' });
    await waitForEmail(memoryTransport, 'resutoken@teste.com');
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

  it('usuário usa um link de reset expirado — 400', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'exptoken@teste.com', password: 'SenhaForte123' });
    await waitForEmail(memoryTransport, 'exptoken@teste.com');
    memoryTransport.clear();

    await request(app.getHttpServer())
      .post('/api/auth/password/forgot')
      .send({ email: 'exptoken@teste.com' });

    const email = await waitForEmail(memoryTransport, 'exptoken@teste.com');
    const token = extractToken(email!, 'token');

    const pool = getTestPool();
    await pool.query(
      `UPDATE email_tokens
       SET expires_at = now() - interval '1 hour'
       WHERE token_hash = encode(sha256($1::bytea), 'hex')`,
      [token],
    );

    const res = await request(app.getHttpServer())
      .post('/api/auth/password/reset')
      .send({ token, newPassword: 'NovaSenha456' })
      .expect(400);
    expect(res.body.code).toBe('AUTH_EMAIL_TOKEN_INVALID');
  });

  // =============================================================================
  // CHANGE-PASSWORD
  // =============================================================================

  describe('Change-password', () => {
    let accessCookie: string;
    let refreshCookie: string;

    beforeEach(async () => {
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'changepwd@teste.com', password: 'SenhaAtual123' });

      const cookies = registerResponse.headers['set-cookie'] as string[];
      accessCookie = cookies.find((cookie) => cookie.startsWith('access_token='))!.split(';')[0];
      refreshCookie = cookies.find((cookie) => cookie.startsWith('refresh_token='))!.split(';')[0];
    });

    it('sucesso revoga outras sessões e mantém login com cookies novos', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'changepwd@teste.com', password: 'SenhaAtual123' })
        .expect(200);

      const response = await request(app.getHttpServer())
        .post('/api/auth/change-password')
        .set('Cookie', [accessCookie, refreshCookie])
        .send({ currentPassword: 'SenhaAtual123', newPassword: 'NovaSenha456' })
        .expect(200);

      expect(response.body.user.mustChangePassword).toBe(false);

      const newCookies = response.headers['set-cookie'] as string[];
      expect(newCookies.some((cookie) => cookie.startsWith('access_token='))).toBe(true);
      expect(newCookies.some((cookie) => cookie.startsWith('refresh_token='))).toBe(true);

      const pool = getTestPool();
      const sessions = await pool.query(
        `SELECT revoked_at FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = 'changepwd@teste.com')`,
      );
      const activeSessions = sessions.rows.filter((row) => row.revoked_at === null);
      expect(activeSessions.length).toBe(1);
    });

    it('senha atual errada retorna 422 AUTH_CURRENT_PASSWORD_WRONG', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/change-password')
        .set('Cookie', [accessCookie, refreshCookie])
        .send({ currentPassword: 'SenhaErrada123', newPassword: 'NovaSenha456' })
        .expect(422);

      expect(response.body.code).toBe('AUTH_CURRENT_PASSWORD_WRONG');
    });

    it('nova senha igual à atual retorna 422 AUTH_PASSWORD_UNCHANGED', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/change-password')
        .set('Cookie', [accessCookie, refreshCookie])
        .send({ currentPassword: 'SenhaAtual123', newPassword: 'SenhaAtual123' })
        .expect(422);

      expect(response.body.code).toBe('AUTH_PASSWORD_UNCHANGED');
    });

    it('zera must_change_password', async () => {
      const pool = getTestPool();
      await pool.query(
        `UPDATE users SET must_change_password = true WHERE email = 'changepwd@teste.com'`,
      );

      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'changepwd@teste.com', password: 'SenhaAtual123' })
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'] as string[];
      const newAccessCookie = cookies
        .find((cookie) => cookie.startsWith('access_token='))!
        .split(';')[0];
      const newRefreshCookie = cookies
        .find((cookie) => cookie.startsWith('refresh_token='))!
        .split(';')[0];

      await request(app.getHttpServer())
        .post('/api/auth/change-password')
        .set('Cookie', [newAccessCookie, newRefreshCookie])
        .send({ currentPassword: 'SenhaAtual123', newPassword: 'NovaSenha456' })
        .expect(200);

      const user = await pool.query(
        `SELECT must_change_password FROM users WHERE email = 'changepwd@teste.com'`,
      );
      expect(user.rows[0].must_change_password).toBe(false);
    });

    it('login com a senha antiga falha após troca', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/change-password')
        .set('Cookie', [accessCookie, refreshCookie])
        .send({ currentPassword: 'SenhaAtual123', newPassword: 'NovaSenha456' })
        .expect(200);

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'changepwd@teste.com', password: 'SenhaAtual123' })
        .expect(401);

      expect(response.body.code).toBe('AUTH_INVALID_CREDENTIALS');
    });
  });

  // =============================================================================
  // MUST_CHANGE_PASSWORD
  // =============================================================================

  describe('must_change_password', () => {
    beforeEach(async () => {
      await seedAdmin(getTestDb());
    });

    it('admin recém-semeado: me 200, change-password 200, rota protegida qualquer 403, logout 204', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@example.com', password: 'Admin@12345' })
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'] as string[];
      const accessCookie = cookies
        .find((cookie) => cookie.startsWith('access_token='))!
        .split(';')[0];
      const refreshCookie = cookies
        .find((cookie) => cookie.startsWith('refresh_token='))!
        .split(';')[0];

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', [accessCookie, refreshCookie])
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/auth/change-password')
        .set('Cookie', [accessCookie, refreshCookie])
        .send({ currentPassword: 'Admin@12345', newPassword: 'NovaSenhaAdmin123' })
        .expect(200);
    });
  });
});
