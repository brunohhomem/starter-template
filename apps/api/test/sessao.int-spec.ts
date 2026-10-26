import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp, resetDatabase, resetThrottle } from './integration-utils';
import { setupTestDatabase, teardownTestDatabase, getTestPool } from './integration-setup';
import { JwtService } from '@nestjs/jwt';
import { getEnv } from '../src/config/load-env';

describe('Sessão', () => {
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
  // ME
  // =============================================================================

  describe('Me', () => {
    let accessCookie: string;
    let refreshCookie: string;

    beforeEach(async () => {
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'me@teste.com', password: 'SenhaForte123' });

      const cookies = registerResponse.headers['set-cookie'] as string[];
      accessCookie = cookies.find((cookie) => cookie.startsWith('access_token='))!.split(';')[0];
      refreshCookie = cookies.find((cookie) => cookie.startsWith('refresh_token='))!.split(';')[0];
    });

    it('com cookie válido retorna dados do usuário', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', [accessCookie, refreshCookie])
        .expect(200);

      expect(response.body.user.email).toBe('me@teste.com');
      expect(response.body.user.role).toBe('user');
    });

    it('sem cookie retorna 401 AUTH_UNAUTHORIZED', async () => {
      const response = await request(app.getHttpServer()).get('/api/auth/me').expect(401);

      expect(response.body.code).toBe('AUTH_UNAUTHORIZED');
    });

    it('token adulterado retorna 401 AUTH_UNAUTHORIZED', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', ['access_token=token.adulterado.invalido', refreshCookie])
        .expect(401);

      expect(response.body.code).toBe('AUTH_UNAUTHORIZED');
    });

    it('token expirado retorna 401 AUTH_TOKEN_EXPIRED', async () => {
      const env = getEnv();
      const jwtService = new JwtService({ secret: env.JWT_ACCESS_SECRET });
      const expiredToken = jwtService.sign(
        {
          sub: '00000000-0000-0000-0000-000000000000',
          role: 'user',
          sid: '00000000-0000-0000-0000-000000000000',
          mcp: false,
        },
        { expiresIn: '-1h', algorithm: 'HS256' },
      );

      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', [`access_token=${expiredToken}`, refreshCookie])
        .expect(401);

      expect(response.body.code).toBe('AUTH_TOKEN_EXPIRED');
    });

    it('sessão revogada retorna 401 AUTH_UNAUTHORIZED', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', [accessCookie, refreshCookie])
        .expect(204);

      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', [accessCookie, refreshCookie])
        .expect(401);

      expect(response.body.code).toBe('AUTH_UNAUTHORIZED');
    });
  });

  // =============================================================================
  // REFRESH
  // =============================================================================

  describe('Refresh', () => {
    let refreshCookie: string;

    beforeEach(async () => {
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'refresh@teste.com', password: 'SenhaForte123' });

      const cookies = registerResponse.headers['set-cookie'] as string[];
      refreshCookie = cookies.find((cookie) => cookie.startsWith('refresh_token='))!.split(';')[0];
    });

    it('rotaciona tokens (cookie novo ≠ antigo, sessão antiga com revoked_at)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', [refreshCookie])
        .expect(200);

      expect(response.body.user.email).toBe('refresh@teste.com');

      const newCookies = response.headers['set-cookie'] as string[];
      const newAccessCookie = newCookies
        .find((cookie) => cookie.startsWith('access_token='))!
        .split(';')[0];
      const newRefreshCookie = newCookies
        .find((cookie) => cookie.startsWith('refresh_token='))!
        .split(';')[0];

      expect(newAccessCookie).not.toBe(refreshCookie);
      expect(newRefreshCookie).not.toBe(refreshCookie);

      const pool = getTestPool();
      const session = await pool.query(
        `SELECT revoked_at FROM sessions WHERE refresh_token_hash = (SELECT refresh_token_hash FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = 'refresh@teste.com') ORDER BY created_at ASC LIMIT 1)`,
      );
      expect(session.rows[0].revoked_at).not.toBeNull();
    });

    it('mantém mesma family_id', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', [refreshCookie])
        .expect(200);

      const pool = getTestPool();
      const sessions = await pool.query(
        `SELECT family_id FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = 'refresh@teste.com')`,
      );
      const familyIds = sessions.rows.map((row) => row.family_id);
      expect(new Set(familyIds).size).toBe(1);
    });

    it('reuso fora da janela de graça revoga família e me com access dessa família passa a 401', async () => {
      const firstRefresh = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', [refreshCookie])
        .expect(200);

      const firstCookies = firstRefresh.headers['set-cookie'] as string[];
      const firstRefreshCookie = firstCookies
        .find((cookie) => cookie.startsWith('refresh_token='))!
        .split(';')[0];

      const secondRefresh = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', [firstRefreshCookie])
        .expect(200);

      const secondCookies = secondRefresh.headers['set-cookie'] as string[];

      await new Promise((resolve) => setTimeout(resolve, 11000));

      const reuseResponse = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', [refreshCookie])
        .expect(401);

      expect(reuseResponse.body.code).toBe('AUTH_REFRESH_REUSED');

      const pool = getTestPool();
      const familySessions = await pool.query(
        `SELECT revoked_at FROM sessions WHERE family_id = (SELECT family_id FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = 'refresh@teste.com') LIMIT 1)`,
      );
      expect(familySessions.rows.every((row) => row.revoked_at !== null)).toBe(true);

      const meResponse = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', secondCookies)
        .expect(401);

      expect(meResponse.body.code).toBe('AUTH_UNAUTHORIZED');
    });

    it('reuso dentro da janela de graça retorna 401 sem revogar família', async () => {
      const firstRefresh = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', [refreshCookie])
        .expect(200);

      const firstCookies = firstRefresh.headers['set-cookie'] as string[];
      const firstRefreshCookie = firstCookies
        .find((cookie) => cookie.startsWith('refresh_token='))!
        .split(';')[0];

      const reuseResponse = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', [refreshCookie])
        .expect(401);

      expect(reuseResponse.body.code).toBe('AUTH_REFRESH_REUSED');

      const secondRefresh = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', [firstRefreshCookie])
        .expect(200);

      expect(secondRefresh.body.user.email).toBe('refresh@teste.com');
    });

    it('cookie ausente retorna 401 AUTH_REFRESH_INVALID', async () => {
      const response = await request(app.getHttpServer()).post('/api/auth/refresh').expect(401);

      expect(response.body.code).toBe('AUTH_REFRESH_INVALID');
    });

    it('sessão expirada retorna 401 AUTH_REFRESH_INVALID', async () => {
      const pool = getTestPool();
      const userResult = await pool.query(`SELECT id FROM users WHERE email = 'refresh@teste.com'`);
      const userId = userResult.rows[0].id;
      const familyId = '00000000-0000-0000-0000-000000000000';
      const expiredHash = 'expired_hash_' + Date.now();

      await pool.query(
        `
        INSERT INTO sessions (id, user_id, family_id, refresh_token_hash, expires_at, revoked_at)
        VALUES ('00000000-0000-0000-0000-000000000001', $1, $2, $3, NOW() - INTERVAL '1 day', NULL)
      `,
        [userId, familyId, expiredHash],
      );

      const response = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', ['refresh_token=token_expirado_qualquer'])
        .expect(401);

      expect(response.body.code).toBe('AUTH_REFRESH_INVALID');
    });

    it('usuário desativado entre refreshes retorna 401 AUTH_REFRESH_INVALID', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', [refreshCookie])
        .expect(200);

      const pool = getTestPool();
      await pool.query(`UPDATE users SET is_active = false WHERE email = 'refresh@teste.com'`);

      const response = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', [refreshCookie])
        .expect(401);

      expect(response.body.code).toBe('AUTH_REFRESH_INVALID');
    });
  });

  // =============================================================================
  // LOGOUT
  // =============================================================================

  describe('Logout', () => {
    let accessCookie: string;
    let refreshCookie: string;

    beforeEach(async () => {
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'logout@teste.com', password: 'SenhaForte123' });

      const cookies = registerResponse.headers['set-cookie'] as string[];
      accessCookie = cookies.find((cookie) => cookie.startsWith('access_token='))!.split(';')[0];
      refreshCookie = cookies.find((cookie) => cookie.startsWith('refresh_token='))!.split(';')[0];
    });

    it('revoga sessão e limpa cookies (Max-Age=0 ou Expires passado)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', [accessCookie, refreshCookie])
        .expect(204);

      const cookies = response.headers['set-cookie'] as string[];
      const clearedAccess = cookies.find((cookie) => cookie.startsWith('access_token='));
      const clearedRefresh = cookies.find((cookie) => cookie.startsWith('refresh_token='));

      const cookieCleared = (cookie: string) => /Max-Age=0|Expires=.*1970/.test(cookie);
      expect(clearedAccess).toBeDefined();
      expect(clearedRefresh).toBeDefined();
      expect(cookieCleared(clearedAccess!)).toBe(true);
      expect(cookieCleared(clearedRefresh!)).toBe(true);

      const pool = getTestPool();
      const session = await pool.query(
        `SELECT revoked_at FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = 'logout@teste.com')`,
      );
      expect(session.rows[0].revoked_at).not.toBeNull();
    });

    it('sem cookie retorna 204 (idempotente)', async () => {
      await request(app.getHttpServer()).post('/api/auth/logout').expect(204);
    });

    it('refresh depois do logout retorna 401', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', [accessCookie, refreshCookie])
        .expect(204);

      const response = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', [refreshCookie])
        .expect(401);

      expect(response.body.code).toBe('AUTH_REFRESH_INVALID');
    });
  });

  // =============================================================================
  // BANCO (Database)
  // =============================================================================

  describe('Banco', () => {
    it('cascade: apagar usuário remove sessões', async () => {
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'cascade@teste.com', password: 'SenhaForte123' })
        .expect(201);

      const cookies = registerResponse.headers['set-cookie'] as string[];
      const refreshCookie = cookies
        .find((cookie) => cookie.startsWith('refresh_token='))!
        .split(';')[0];

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'cascade@teste.com', password: 'SenhaForte123' })
        .expect(200);

      const pool = getTestPool();
      let sessions = await pool.query(
        `SELECT COUNT(*) FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = 'cascade@teste.com')`,
      );
      expect(parseInt(sessions.rows[0].count)).toBe(2);

      await pool.query(`DELETE FROM users WHERE email = 'cascade@teste.com'`);

      sessions = await pool.query(
        `SELECT COUNT(*) FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = 'cascade@teste.com')`,
      );
      expect(parseInt(sessions.rows[0].count)).toBe(0);
    });

    it('refresh_token_hash nunca igual ao token enviado', async () => {
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'hash@teste.com', password: 'SenhaForte123' })
        .expect(201);

      const cookies = registerResponse.headers['set-cookie'] as string[];
      const refreshCookie = cookies
        .find((cookie) => cookie.startsWith('refresh_token='))!
        .split(';')[0];
      const token = refreshCookie.replace('refresh_token=', '');

      const pool = getTestPool();
      const session = await pool.query(
        `SELECT refresh_token_hash FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = 'hash@teste.com')`,
      );

      expect(session.rows[0].refresh_token_hash).not.toBe(token);
      expect(session.rows[0].refresh_token_hash.length).toBe(64);
    });
  });
});
