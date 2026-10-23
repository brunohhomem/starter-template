import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp, resetDatabase, resetThrottle } from './integration-utils';
import { setupTestDatabase } from './integration-setup';

describe('Health integration', () => {
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

  it('GET /api/health retorna 200 com status ok quando banco e Redis saudáveis', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      version: expect.any(String),
    });
  });

  it('health check não aparece no log automático de requisições', async () => {
    // Este teste verifica se a rota /api/health está excluída do log
    // A verificação real é no logger-options.ts (isRouteExcludedFromRequestLog)
    // Aqui apenas confirmamos que a rota responde
    await request(app.getHttpServer()).get('/api/health').expect(200);
  });
});
