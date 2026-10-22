import { INestApplication } from '@nestjs/common';
import { TestAppModule } from './test-app.module';
import { configureApp } from '../src/bootstrap';
import { getTestDb, getTestPool } from './integration-setup';
import { loadEnv } from '../src/config/load-env';

/**
 * Lista as tabelas dos schemas da aplicação em `information_schema`
 * e executa `TRUNCATE ... RESTART IDENTITY CASCADE`, excluindo o schema `drizzle`.
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
