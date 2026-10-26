import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp, resetDatabase, resetThrottle } from './integration-utils';
import { setupTestDatabase, teardownTestDatabase, getTestPool } from './integration-setup';
import { startTestWorker } from './test-worker';
import { MemoryTransport } from '../src/modules/mail/transports/memory.transport';
import { renderEmail } from '../src/modules/mail/templates/render-email';
import { makeScenario } from './scenario';

describe('Segurança', () => {
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

  it('Nenhuma senha, token ou hash aparece em log, auditoria ou payload da fila — banco não armazena token em claro', async () => {
    const scenario = makeScenario(app, memoryTransport);
    await scenario.createUser({ email: 'seguranca@teste.com', password: 'SenhaSegura123' });

    const email = await scenario.lastEmailTo('seguranca@teste.com');
    expect(email).toBeDefined();
    const rawToken = scenario.extractLinkToken(email!);

    const pool = getTestPool();
    const tokenRows = await pool.query(`SELECT token_hash FROM email_tokens`);
    expect(tokenRows.rows.length).toBeGreaterThan(0);

    for (const row of tokenRows.rows) {
      expect(row.token_hash).not.toBe(rawToken);
      expect(row.token_hash.length).toBe(64);
    }

    const auditRows = await pool.query(`SELECT metadata FROM audit_logs`);
    for (const row of auditRows.rows) {
      const meta = JSON.stringify(row.metadata ?? {});
      expect(meta).not.toMatch(/password|hash|token_hash/i);
    }

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'seguranca_x@teste.com', password: 'SenhaForte123' })
      .expect(401);
    expect(JSON.stringify(loginRes.body)).not.toContain('password');
    expect(JSON.stringify(loginRes.body)).not.toContain('hash');

    const registerRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'seguranca2@teste.com',
        password: 'SenhaForte123',
        fullName: 'Segurança Dois',
      })
      .expect(201);
    expect(JSON.stringify(registerRes.body)).not.toContain('password');
    expect(JSON.stringify(registerRes.body)).not.toContain('hash');
    expect(JSON.stringify(registerRes.body)).not.toContain('token');
  });

  it('Requisição que altera estado vinda de outra origem', async () => {
    const scenario = makeScenario(app);
    const user = await scenario.createUser({ email: 'csrf@teste.com' });
    const agent = await scenario.loginAs(user);

    const res = await agent
      .post('/api/auth/change-password')
      .set('Origin', 'https://malicioso.com')
      .send({ currentPassword: 'SenhaForte123', newPassword: 'NovaSenha456' })
      .expect(403);

    expect(res.body.code).toBe('AUTH_CSRF_BLOCKED');
  });

  it('Nome com HTML hostil no cadastro', async () => {
    const hostileAppName = '"><img src=x onerror=alert(1)>';
    const { html } = await renderEmail('emailConfirmation', {
      appName: hostileAppName,
      link: 'https://example.com/confirm?token=safe-token',
      expiresInLabel: '24 horas',
    });
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).not.toContain(hostileAppName);
  });

  it('30 usuários autenticados no mesmo IP navegam sem receber 429', async () => {
    const pool = getTestPool();
    const password = 'SenhaForte123';
    const passwordHash = await bcrypt.hash(password, 4);
    const scenario = makeScenario(app);
    const agents = [];

    for (let index = 0; index < 30; index += 1) {
      const email = `navegacao-${index}@teste.com`;
      await pool.query(
        'INSERT INTO users (email, password_hash, role, email_verified_at) VALUES ($1, $2, $3, now())',
        [email, passwordHash, 'user'],
      );
      agents.push(await scenario.loginAs({ email, password }));
    }

    await resetThrottle();

    for (const agent of agents) {
      for (let visit = 0; visit < 5; visit += 1) {
        const response = await agent.get('/api/auth/me');
        expect(response.status).toBe(200);
      }
    }
  }, 120_000);
});
