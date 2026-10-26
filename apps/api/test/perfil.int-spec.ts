import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp, resetDatabase, resetThrottle } from './integration-utils';
import { setupTestDatabase, teardownTestDatabase } from './integration-setup';
import { makeScenario } from './scenario';

describe('Perfil', () => {
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

  it('Usuário obtém o próprio perfil', async () => {
    const scenario = makeScenario(app);
    const user = await scenario.createUser({ email: 'perfil@teste.com' });
    const agent = await scenario.loginAs(user);

    const res = await agent.get('/api/me/profile').expect(200);

    expect(res.body).toMatchObject({
      email: 'perfil@teste.com',
      role: 'user',
      emailVerified: false,
      fullName: 'Usuário Teste',
      cpf: null,
      phone: null,
    });
  });

  it('Usuário atualiza o próprio nome e telefone', async () => {
    const scenario = makeScenario(app);
    const user = await scenario.createUser({ email: 'atualiza@teste.com' });
    const agent = await scenario.loginAs(user);

    const res = await agent
      .patch('/api/me/profile')
      .send({ fullName: 'Novo Nome', phone: '(11) 98765-4321' })
      .expect(200);

    expect(res.body.fullName).toBe('Novo Nome');
    expect(res.body.phone).toBe('11987654321');
  });

  it('Usuário altera o próprio CPF para um inválido', async () => {
    const scenario = makeScenario(app);
    const user = await scenario.createUser({ email: 'cpf@teste.com' });
    const agent = await scenario.loginAs(user);

    const res = await agent.patch('/api/me/profile').send({ cpf: '111.111.111-11' }).expect(400);

    expect(Array.isArray(res.body.details)).toBe(true);
    const details = res.body.details as Array<{ path: (string | number)[]; message: string }>;
    expect(details.some((detail) => detail.path[0] === 'cpf')).toBe(true);
  });
});
