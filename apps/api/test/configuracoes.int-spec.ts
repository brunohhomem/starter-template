import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp, resetDatabase, resetThrottle } from './integration-utils';
import { setupTestDatabase, teardownTestDatabase, getTestDb } from './integration-setup';
import { seedAdmin } from '../src/database/seed/admin.seed';

describe('Configurações', () => {
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

  it('usuário comum tenta ligar o cadastro — 403', async () => {
    const userReg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'user@teste.com', password: 'SenhaForte123' });
    const userCookies = (userReg.headers['set-cookie'] as string[])
      .map((cookie) => cookie.split(';')[0])
      .join('; ');

    await request(app.getHttpServer())
      .patch('/api/settings')
      .set('Cookie', userCookies)
      .send({ registrationEnabled: true })
      .expect(403);
  });

  it('admin desliga o cadastro — visitante passa a receber 403 na hora', async () => {
    await seedAdmin(getTestDb());
    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'Admin@12345' });
    const adminCookies = (adminLogin.headers['set-cookie'] as string[])
      .map((cookie) => cookie.split(';')[0])
      .join('; ');

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
