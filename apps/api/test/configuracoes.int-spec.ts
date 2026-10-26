import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp, resetDatabase, resetThrottle } from './integration-utils';
import { setupTestDatabase, teardownTestDatabase, getTestDb } from './integration-setup';
import { seedAdmin } from '../src/database/seed/admin.seed';
import { makeScenario } from './scenario';

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
    const scenario = makeScenario(app);
    const user = await scenario.createUser({ email: 'user@teste.com' });
    const agent = await scenario.loginAs(user);

    await agent.patch('/api/settings').send({ registrationEnabled: true }).expect(403);
  });

  it('admin desliga o cadastro — visitante passa a receber 403 na hora', async () => {
    await seedAdmin(getTestDb());
    const scenario = makeScenario(app);
    const agent = await scenario.loginAs({ email: 'admin@example.com', password: 'Admin@12345' });

    await agent.patch('/api/settings').send({ registrationEnabled: false }).expect(200);

    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'visitante@teste.com', password: 'SenhaForte123', fullName: 'Visitante' })
      .expect(403);

    expect(res.body.code).toBe('AUTH_REGISTRATION_DISABLED');
  });
});
