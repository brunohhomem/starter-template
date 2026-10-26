import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp, resetDatabase, resetThrottle } from './integration-utils';
import { setupTestDatabase, teardownTestDatabase, getTestDb } from './integration-setup';
import { seedAdmin } from '../src/database/seed/admin.seed';
import { makeScenario } from './scenario';

describe('Usuários (admin)', () => {
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

  async function loginAdmin() {
    await seedAdmin(getTestDb());
    const scenario = makeScenario(app);
    return scenario.loginAs({ email: 'admin@example.com', password: 'Admin@12345' });
  }

  it('Admin lista os usuários', async () => {
    const scenario = makeScenario(app);
    await scenario.createUser({ email: 'listado@teste.com' });
    const adminAgent = await loginAdmin();

    const res = await adminAgent.get('/api/users').expect(200);

    expect(res.body).toMatchObject({
      items: expect.arrayContaining([expect.objectContaining({ email: 'listado@teste.com' })]),
      meta: expect.objectContaining({ totalItems: expect.any(Number) }),
    });
  });

  it('Admin altera o role de um usuário', async () => {
    const scenario = makeScenario(app);
    const user = await scenario.createUser({ email: 'rolechange@teste.com' });
    const adminAgent = await loginAdmin();

    const listRes = await adminAgent.get('/api/users').expect(200);
    const target = (listRes.body.items as Array<{ id: string; email: string }>).find(
      (item) => item.email === 'rolechange@teste.com',
    );
    expect(target).toBeDefined();

    await adminAgent.patch(`/api/users/${target!.id}/role`).send({ role: 'admin' }).expect(200);

    const userAgent = await scenario.loginAs(user);
    const meRes = await userAgent.get('/api/auth/me').expect(200);
    expect(meRes.body.user.role).toBe('admin');
  });

  it('Admin desativa um usuário', async () => {
    const scenario = makeScenario(app);
    const user = await scenario.createUser({ email: 'desativa@teste.com' });
    const adminAgent = await loginAdmin();

    const listRes = await adminAgent.get('/api/users').expect(200);
    const target = (listRes.body.items as Array<{ id: string; email: string }>).find(
      (item) => item.email === 'desativa@teste.com',
    );
    expect(target).toBeDefined();

    await adminAgent.patch(`/api/users/${target!.id}/status`).send({ isActive: false }).expect(200);

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(401);
    expect(loginRes.body.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('Admin tenta mudar o próprio role', async () => {
    await seedAdmin(getTestDb());
    const scenario = makeScenario(app);
    const adminAgent = await scenario.loginAs({
      email: 'admin@example.com',
      password: 'Admin@12345',
    });

    const meRes = await adminAgent.get('/api/auth/me').expect(200);
    const adminId = meRes.body.user.id;

    const res = await adminAgent
      .patch(`/api/users/${adminId}/role`)
      .send({ role: 'user' })
      .expect(422);

    expect(res.body.code).toBe('USERS_SELF_CHANGE_FORBIDDEN');
  });

  it('Usuário comum lista usuários', async () => {
    const scenario = makeScenario(app);
    const user = await scenario.createUser({ email: 'comum@teste.com' });
    const agent = await scenario.loginAs(user);

    const res = await agent.get('/api/users').expect(403);

    expect(res.body).toBeDefined();
  });

  it('Usuário comum tenta mudar o role de outro usuário — 403', async () => {
    const scenario = makeScenario(app);
    await scenario.createUser({ email: 'alvo-role@teste.com' });
    const common = await scenario.createUser({ email: 'comum-role@teste.com' });
    const adminAgent = await loginAdmin();

    const listRes = await adminAgent.get('/api/users').expect(200);
    const target = (listRes.body.items as Array<{ id: string; email: string }>).find(
      (item) => item.email === 'alvo-role@teste.com',
    );
    expect(target).toBeDefined();

    const commonAgent = await scenario.loginAs(common);
    const res = await commonAgent
      .patch(`/api/users/${target!.id}/role`)
      .send({ role: 'admin' })
      .expect(403);

    expect(res.body.code).toBe('AUTH_FORBIDDEN');
  });

  it('Admin tenta desativar a si mesmo — 422', async () => {
    const adminAgent = await loginAdmin();
    const meRes = await adminAgent.get('/api/auth/me').expect(200);
    const adminId = meRes.body.user.id as string;

    const res = await adminAgent
      .patch(`/api/users/${adminId}/status`)
      .send({ isActive: false })
      .expect(422);

    expect(res.body.code).toBe('USERS_SELF_CHANGE_FORBIDDEN');
  });
});
