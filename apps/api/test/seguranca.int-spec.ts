import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp, resetDatabase, resetThrottle } from './integration-utils';
import { setupTestDatabase, teardownTestDatabase, getTestPool } from './integration-setup';
import { startTestWorker } from './test-worker';
import { MemoryTransport } from '../src/modules/mail/transports/memory.transport';
import { renderEmail } from '../src/modules/mail/templates/render-email';
import { waitForEmail, extractToken } from './test-email-helpers';

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

  it('nenhuma senha, token ou hash aparece em log, auditoria ou payload da fila — banco não armazena token em claro', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'seguranca@teste.com', password: 'SenhaSegura123' });

    const email = await waitForEmail(memoryTransport, 'seguranca@teste.com');
    expect(email).toBeDefined();
    const rawToken = extractToken(email!, 'token');

    const pool = getTestPool();
    const tokenRows = await pool.query(`SELECT token_hash FROM email_tokens`);
    expect(tokenRows.rows.length).toBeGreaterThan(0);

    for (const row of tokenRows.rows) {
      expect(row.token_hash).not.toBe(rawToken);
      expect(row.token_hash.length).toBe(64); // SHA-256 hex
    }

    const auditRows = await pool.query(`SELECT metadata FROM audit_logs`);
    for (const row of auditRows.rows) {
      const meta = JSON.stringify(row.metadata ?? {});
      expect(meta).not.toMatch(/password|hash|token_hash/i);
    }
  });

  it('resposta do login não contém password/hash/token no corpo', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'security@teste.com', password: 'SenhaForte123' })
      .expect(401);

    const bodyStr = JSON.stringify(response.body);
    expect(bodyStr).not.toContain('password');
    expect(bodyStr).not.toContain('hash');
    expect(bodyStr).not.toContain('token');
  });

  it('resposta do register não contém password/hash/token no corpo', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'security2@teste.com', password: 'SenhaForte123' })
      .expect(201);

    const bodyStr = JSON.stringify(response.body);
    expect(bodyStr).not.toContain('password');
    expect(bodyStr).not.toContain('hash');
    expect(bodyStr).not.toContain('token');
  });

  it('nome com HTML hostil no cadastro sai escapado no e-mail', async () => {
    const hostileAppName = '"><img src=x onerror=alert(1)>';
    const { html } = await renderEmail('emailConfirmation', {
      appName: hostileAppName,
      link: 'https://example.com/confirm?token=safe-token',
      expiresInLabel: '24 horas',
    });
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).not.toContain(hostileAppName);
  });
});
