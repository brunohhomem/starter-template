import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp, resetDatabase, resetThrottle } from './integration-utils';
import { setupTestDatabase, teardownTestDatabase } from './integration-setup';
import { makeScenario } from './scenario';

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

  it('Usuário entra com credenciais corretas', async () => {
    const scenario = makeScenario(app);
    const user = await scenario.createUser({ email: 'login@teste.com' });

    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(200);

    expect(res.body.user.email).toBe('login@teste.com');

    const cookies = res.headers['set-cookie'] as string[];
    expect(cookies.some((cookie) => cookie.startsWith('access_token='))).toBe(true);
    expect(cookies.some((cookie) => cookie.startsWith('refresh_token='))).toBe(true);
  });

  it('Usuário erra a senha / e-mail inexistente', async () => {
    const scenario = makeScenario(app);
    const user = await scenario.createUser({ email: 'login2@teste.com' });

    const wrongPassword = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: user.email, password: 'SenhaErrada123' })
      .expect(401);
    expect(wrongPassword.body.code).toBe('AUTH_INVALID_CREDENTIALS');

    const unknownEmail = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'inexistente@teste.com', password: 'SenhaForte123' })
      .expect(401);
    expect(unknownEmail.body.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('Usuário desativado tenta entrar', async () => {
    const scenario = makeScenario(app);
    const user = await scenario.createUser({ email: 'inativo@teste.com', isActive: false });

    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(401);

    expect(res.body.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('Força bruta numa conta', async () => {
    for (let idx = 0; idx < 5; idx++) {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'throttle@teste.com', password: 'SenhaErrada123' })
        .expect(401);
    }

    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'throttle@teste.com', password: 'SenhaErrada123' })
      .expect(429);

    expect(res.body.code).toBe('RATE_LIMITED');
    expect(parseInt(res.headers['retry-after'])).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'outro@teste.com', password: 'SenhaErrada123' })
      .expect(401);
  });
});
