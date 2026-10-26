import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp, resetDatabase, resetThrottle } from './integration-utils';
import { setupTestDatabase, teardownTestDatabase, getTestDb } from './integration-setup';
import { startTestWorker } from './test-worker';
import { MemoryTransport } from '../src/modules/mail/transports/memory.transport';
import { seedAdmin } from '../src/database/seed/admin.seed';
import { makeScenario } from './scenario';

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

  it('"Esqueci a senha" com conta existente e com conta inexistente', async () => {
    const scenario = makeScenario(app, memoryTransport);
    await scenario.createUser({ email: 'existente@teste.com' });
    await scenario.lastEmailTo('existente@teste.com');
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

    const emailExistente = await scenario.lastEmailTo('existente@teste.com');
    expect(emailExistente).toBeDefined();
    expect(emailExistente!.subject).toBe('Redefinição de senha');

    const emailInexistente = memoryTransport.sent.find((msg) => msg.to === 'naoexiste@teste.com');
    expect(emailInexistente).toBeUndefined();
  });

  it('Usuário redefine a senha pelo link', async () => {
    const scenario = makeScenario(app, memoryTransport);
    await scenario.createUser({ email: 'resetsenha@teste.com', password: 'SenhaAntiga123' });
    await scenario.lastEmailTo('resetsenha@teste.com');

    memoryTransport.clear();
    await request(app.getHttpServer())
      .post('/api/auth/password/forgot')
      .send({ email: 'resetsenha@teste.com' });

    const email = await scenario.lastEmailTo('resetsenha@teste.com');
    const token = scenario.extractLinkToken(email!);

    await request(app.getHttpServer())
      .post('/api/auth/password/reset')
      .send({ token, newPassword: 'NovaSenha456' })
      .expect(204);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'resetsenha@teste.com', password: 'SenhaAntiga123' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'resetsenha@teste.com', password: 'NovaSenha456' })
      .expect(200);
  });

  it('Usuário usa um link de reset já usado ou expirado', async () => {
    const scenario = makeScenario(app, memoryTransport);
    await scenario.createUser({ email: 'resutoken@teste.com' });
    await scenario.lastEmailTo('resutoken@teste.com');
    memoryTransport.clear();

    await request(app.getHttpServer())
      .post('/api/auth/password/forgot')
      .send({ email: 'resutoken@teste.com' });

    const email = await scenario.lastEmailTo('resutoken@teste.com');
    const token = scenario.extractLinkToken(email!);

    await request(app.getHttpServer())
      .post('/api/auth/password/reset')
      .send({ token, newPassword: 'NovaSenha456' })
      .expect(204);

    const res = await request(app.getHttpServer())
      .post('/api/auth/password/reset')
      .send({ token, newPassword: 'OutraSenha789' })
      .expect(400);
    expect(res.body.code).toBe('AUTH_EMAIL_TOKEN_INVALID');
  });

  it('Usuário troca a senha informando a senha atual errada', async () => {
    const scenario = makeScenario(app, memoryTransport);
    const user = await scenario.createUser({
      email: 'changepwd@teste.com',
      password: 'SenhaAtual123',
    });
    await scenario.lastEmailTo('changepwd@teste.com');
    const agent = await scenario.loginAs(user);

    const res = await agent
      .post('/api/auth/change-password')
      .send({ currentPassword: 'SenhaErrada123', newPassword: 'NovaSenha456' })
      .expect(422);

    expect(res.body.code).toBe('AUTH_CURRENT_PASSWORD_WRONG');
  });

  it('Admin recém-criado pelo seed tenta usar o sistema sem trocar a senha', async () => {
    await seedAdmin(getTestDb());
    const scenario = makeScenario(app);
    const agent = await scenario.loginAs({ email: 'admin@example.com', password: 'Admin@12345' });

    await agent.get('/api/auth/me').expect(200);

    await agent
      .post('/api/auth/change-password')
      .send({ currentPassword: 'Admin@12345', newPassword: 'NovaSenhaAdmin123' })
      .expect(200);
  });
});
