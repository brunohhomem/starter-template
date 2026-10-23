import { INestApplication } from '@nestjs/common';
import Redis from 'ioredis';
import { TestAppModule } from './test-app.module';
import { configureApp } from '../src/bootstrap';
import { getTestDb, getTestPool } from './integration-setup';
import { getEnv, loadEnv } from '../src/config/load-env';

/**
 * Lista as tabelas dos schemas da aplicação em `information_schema`
 * e executa `TRUNCATE ... RESTART IDENTITY CASCADE`.
 * A tabela `system_settings` é truncada e re-seedada com registration_enabled=true para NODE_ENV=test.
 * Nenhuma tabela é citada à mão.
 */
export async function resetDatabase(): Promise<void> {
  const db = getTestDb();
  const pool = getTestPool();

  // Busca todas as tabelas do schema público (exceto schema drizzle)
  const tablesResult = await pool.query<{ tablename: string }>(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  `);

  const tables = tablesResult.rows
    .map((row) => row.tablename)
    .filter((name) => !name.startsWith('_') && name !== 'drizzle_migrations');

  if (tables.length > 0) {
    const tableNames = tables.map((tableName) => `"${tableName}"`).join(', ');
    await db.execute(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE`);
  }

  // Re-seed system_settings with registration_enabled=true for test environment
  await pool.query(`
    INSERT INTO system_settings (key, value) VALUES ('registration_enabled', 'true'::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = 'true'::jsonb
  `);
}

/**
 * Limpa todas as chaves de throttle do Redis para isolar testes.
 */
export async function resetThrottle(): Promise<void> {
  const env = getEnv();
  const redis = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
    lazyConnect: true,
  });
  try {
    await redis.connect();
    const keys = await redis.keys('throttle:*');
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // fail-open
  } finally {
    await redis.quit();
  }
}

/**
 * Cria uma instância da aplicação de teste com o mesmo setup do app real.
 * Usa `configureApp` (T8) para garantir paridade.
 * Usa TestAppModule que substitui o DatabaseModule pelo TestDatabaseModule.
 */
export async function createTestApp(): Promise<INestApplication> {
  const env = loadEnv();

  // Sobrescreve DB_NAME para usar o banco de teste (embora o TestDatabaseModule use o pool direto)
  const testEnv = { ...env, DB_NAME: env.TEST_DB_NAME ?? `${env.DB_NAME}_test` };

  const { NestFactory } = await import('@nestjs/core');
  const { Logger } = await import('nestjs-pino');

  const application = await NestFactory.create(TestAppModule, { bufferLogs: true });
  application.useLogger(application.get(Logger));

  configureApp(application, testEnv);

  await application.init();
  return application;
}

/**
 * Fecha a aplicação de teste e limpa recursos.
 */
export async function closeTestApp(app: INestApplication): Promise<void> {
  await app.close();
}
