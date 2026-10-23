import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp, resetDatabase, resetThrottle } from './integration-utils';
import { setupTestDatabase } from './integration-setup';

describe('Logging integration (T9 acceptance)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await setupTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  beforeEach(async () => {
    await resetDatabase();
    await resetThrottle();
  });

  it('request ID válido é aceito e ecoado no header x-request-id', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .set('x-request-id', 'valid-request-123')
      .expect(200);

    expect(response.headers['x-request-id']).toBe('valid-request-123');
  });

  it('request ID inválido é substituído por UUID no header x-request-id', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .set('x-request-id', 'invalid id with spaces')
      .expect(200);

    const requestId = response.headers['x-request-id'];
    expect(requestId).toBeDefined();
    expect(requestId).not.toBe('invalid id with spaces');
    expect(requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('request ID ausente gera UUID novo no header x-request-id', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200);

    const requestId = response.headers['x-request-id'];
    expect(requestId).toBeDefined();
    expect(requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('/api/health não aparece no log automático (verifica exclusão via header)', async () => {
    // A verificação real da exclusão do log é unitária em logger-options.ts
    // Aqui apenas confirmamos que a rota responde e o header x-request-id está presente
    const response = await request(app.getHttpServer()).get('/api/health').expect(200);

    expect(response.headers['x-request-id']).toBeDefined();
    expect(response.body).toEqual({
      status: 'ok',
      version: expect.any(String),
    });
  });

  it('rota inexistente devolve 404 com request ID no header (log ainda funciona)', async () => {
    const response = await request(app.getHttpServer()).get('/api/nonexistent').expect(404);

    expect(response.headers['x-request-id']).toBeDefined();
  });
});
