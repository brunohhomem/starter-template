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
import { seedAdmin } from '../src/database/seed/admin.seed';
import Redis from 'ioredis';
import { getEnv } from '../src/config/load-env';

describe('Login', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await setupTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp(app);
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
    await resetThrottle();
  });

  // =============================================================================
  // LOGIN
  // =============================================================================

  describe('Login', () => {
    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'login@teste.com', password: 'SenhaForte123' });
    });

    it('sucesso retorna cookies e dados do usuário', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'login@teste.com', password: 'SenhaForte123' })
        .expect(200);

      expect(response.body.user.email).toBe('login@teste.com');
      expect(response.body.user.role).toBe('user');

      const cookies = response.headers['set-cookie'] as string[];
      expect(cookies.some((cookie) => cookie.startsWith('access_token='))).toBe(true);
      expect(cookies.some((cookie) => cookie.startsWith('refresh_token='))).toBe(true);
    });

    it('senha errada retorna 401 AUTH_INVALID_CREDENTIALS', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'login@teste.com', password: 'SenhaErrada123' })
        .expect(401);

      expect(response.body.code).toBe('AUTH_INVALID_CREDENTIALS');
    });

    it('e-mail inexistente retorna mesmo 401 AUTH_INVALID_CREDENTIALS (tempo constante)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'inexistente@teste.com', password: 'SenhaForte123' })
        .expect(401);

      expect(response.body.code).toBe('AUTH_INVALID_CREDENTIALS');
    });

    it('usuário inativo retorna 401 AUTH_INVALID_CREDENTIALS', async () => {
      const pool = getTestPool();
      await pool.query(`UPDATE users SET is_active = false WHERE email = 'login@teste.com'`);

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'login@teste.com', password: 'SenhaForte123' })
        .expect(401);

      expect(response.body.code).toBe('AUTH_INVALID_CREDENTIALS');
    });

    it('atualiza last_login_at', async () => {
      const pool = getTestPool();
      const before = await pool.query(
        `SELECT last_login_at FROM users WHERE email = 'login@teste.com'`,
      );
      expect(before.rows[0].last_login_at).toBeNull();

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'login@teste.com', password: 'SenhaForte123' })
        .expect(200);

      const after = await pool.query(
        `SELECT last_login_at FROM users WHERE email = 'login@teste.com'`,
      );
      expect(after.rows[0].last_login_at).not.toBeNull();
    });
  });

  // =============================================================================
  // PAPÉIS (Roles)
  // =============================================================================

  describe('Papéis', () => {
    let adminAccessCookie: string;
    let adminRefreshCookie: string;
    let userAccessCookie: string;
    let userRefreshCookie: string;

    beforeEach(async () => {
      await seedAdmin(getTestDb());

      const adminLogin = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@example.com', password: 'Admin@12345' })
        .expect(200);

      const adminCookies = adminLogin.headers['set-cookie'] as string[];
      adminAccessCookie = adminCookies
        .find((cookie) => cookie.startsWith('access_token='))!
        .split(';')[0];
      adminRefreshCookie = adminCookies
        .find((cookie) => cookie.startsWith('refresh_token='))!
        .split(';')[0];

      const userRegister = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'user@teste.com', password: 'SenhaUser123' })
        .expect(201);

      const userCookies = userRegister.headers['set-cookie'] as string[];
      userAccessCookie = userCookies
        .find((cookie) => cookie.startsWith('access_token='))!
        .split(';')[0];
      userRefreshCookie = userCookies
        .find((cookie) => cookie.startsWith('refresh_token='))!
        .split(';')[0];
    });

    it('admin tem role=admin no token', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', [adminAccessCookie, adminRefreshCookie])
        .expect(200);

      expect(response.body.user.role).toBe('admin');
    });

    it('user tem role=user no token', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', [userAccessCookie, userRefreshCookie])
        .expect(200);

      expect(response.body.user.role).toBe('user');
    });

    it('anônimo em rota protegida retorna 401', async () => {
      const response = await request(app.getHttpServer()).get('/api/auth/me').expect(401);

      expect(response.body.code).toBe('AUTH_UNAUTHORIZED');
    });
  });

  // =============================================================================
  // CSRF
  // =============================================================================

  describe('CSRF', () => {
    let accessCookie: string;
    let refreshCookie: string;

    beforeEach(async () => {
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'csrf@teste.com', password: 'SenhaForte123' });

      const cookies = registerResponse.headers['set-cookie'] as string[];
      accessCookie = cookies.find((cookie) => cookie.startsWith('access_token='))!.split(';')[0];
      refreshCookie = cookies.find((cookie) => cookie.startsWith('refresh_token='))!.split(';')[0];
    });

    it('POST com Origin errada retorna 403 AUTH_CSRF_BLOCKED', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/change-password')
        .set('Cookie', [accessCookie, refreshCookie])
        .set('Origin', 'https://malicioso.com')
        .send({ currentPassword: 'SenhaForte123', newPassword: 'NovaSenha456' })
        .expect(403);

      expect(response.body.code).toBe('AUTH_CSRF_BLOCKED');
    });

    it('POST com Origin correta funciona', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/change-password')
        .set('Cookie', [accessCookie, refreshCookie])
        .set('Origin', 'http://localhost:3000')
        .send({ currentPassword: 'SenhaForte123', newPassword: 'NovaSenha456' })
        .expect(200);

      expect(response.body.user.mustChangePassword).toBe(false);
    });

    it('POST sem Origin funciona (curl, testes, server-to-server)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/change-password')
        .set('Cookie', [accessCookie, refreshCookie])
        .send({ currentPassword: 'SenhaForte123', newPassword: 'NovaSenha456' })
        .expect(200);

      expect(response.body.user.mustChangePassword).toBe(false);
    });

    it('GET com Origin errada funciona (apenas métodos não-seguros)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', [accessCookie, refreshCookie])
        .set('Origin', 'https://malicioso.com')
        .expect(200);

      expect(response.body.user.email).toBe('csrf@teste.com');
    });
  });

  // =============================================================================
  // THROTTLER
  // =============================================================================

  describe('Throttler', () => {
    it('50 usuários distintos, mesmo IP, 3 tentativas de login cada → nenhum 429', async () => {
      const promises = [];
      for (let userIdx = 0; userIdx < 50; userIdx++) {
        for (let attemptIdx = 0; attemptIdx < 3; attemptIdx++) {
          promises.push(
            request(app.getHttpServer())
              .post('/api/auth/login')
              .send({ email: `user${userIdx}@teste.com`, password: 'SenhaErrada123' }),
          );
        }
      }

      const responses = await Promise.all(promises);
      const rateLimited = responses.filter((resp) => resp.status === 429);
      expect(rateLimited.length).toBe(0);
    });

    it('mesmo e-mail, mesmo IP: 5 tentativas erradas → 401; 6ª → 429 com Retry-After > 0; e-mail diferente do mesmo IP continua com 401', async () => {
      for (let idx = 0; idx < 5; idx++) {
        await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email: 'throttle@teste.com', password: 'SenhaErrada123' })
          .expect(401);
      }

      const sixthResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'throttle@teste.com', password: 'SenhaErrada123' })
        .expect(429);

      expect(sixthResponse.body.code).toBe('RATE_LIMITED');
      expect(sixthResponse.headers['retry-after']).toBeDefined();
      expect(parseInt(sixthResponse.headers['retry-after'])).toBeGreaterThan(0);

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'outro@teste.com', password: 'SenhaErrada123' })
        .expect(401);
    });

    it('bloqueio por e-mail vale mesmo com senha correta (6ª com senha certa → 429)', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'throttle2@teste.com', password: 'SenhaCorreta123' })
        .expect(201);

      for (let idx = 0; idx < 5; idx++) {
        await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email: 'throttle2@teste.com', password: 'SenhaErrada123' })
          .expect(401);
      }

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'throttle2@teste.com', password: 'SenhaCorreta123' })
        .expect(429);

      expect(response.body.code).toBe('RATE_LIMITED');
    });

    it('IPs diferentes (via X-Forwarded-For com TRUST_PROXY_HOPS=1) não compartilham contador', async () => {
      for (let idx = 0; idx < 5; idx++) {
        await request(app.getHttpServer())
          .post('/api/auth/login')
          .set('X-Forwarded-For', '192.168.1.100')
          .send({ email: 'ip1@teste.com', password: 'SenhaErrada123' })
          .expect(401);
      }

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('X-Forwarded-For', '192.168.1.100')
        .send({ email: 'ip1@teste.com', password: 'SenhaErrada123' })
        .expect(429);

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('X-Forwarded-For', '192.168.1.101')
        .send({ email: 'ip2@teste.com', password: 'SenhaErrada123' })
        .expect(401);
    });

    it('default bloqueia a 121ª requisição no minuto', async () => {
      const promises = [];
      for (let idx = 0; idx < 120; idx++) {
        promises.push(request(app.getHttpServer()).get('/api/test/throttle'));
      }

      const responses = await Promise.all(promises);
      const rateLimited = responses.filter((resp) => resp.status === 429);
      expect(rateLimited.length).toBe(0);

      await request(app.getHttpServer()).get('/api/test/throttle').expect(429);
    });

    it('Redis fora do ar → requisição passa (fail-open)', async () => {
      const env = getEnv();
      const redis = new Redis({
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
      });
      await redis.quit();

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'failopen@teste.com', password: 'SenhaErrada123' });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('AUTH_INVALID_CREDENTIALS');
    });
  });
});
