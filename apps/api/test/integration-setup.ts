import { getEnv } from '../src/config/load-env';
import { buildDatabaseConfig } from '../src/database/database-config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../src/database/schema';

/**
 * Configuração para testes de integração.
 * - Garante que o banco de teste existe (conecta ao `postgres` e cria se faltar).
 * - Roda as migrations no banco de teste.
 * - Trava de segurança: recusa se `TEST_DB_NAME` não terminar em `_test`.
 *
 * Esta função é chamada uma vez no setup dos testes.
 */

let testPool: Pool | null = null;
let testDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

export async function setupTestDatabase(): Promise<void> {
  const env = getEnv();
  const testDbName = env.TEST_DB_NAME ?? `${env.DB_NAME}_test`;

  // Trava de segurança: evita truncar o banco de desenvolvimento por engano
  if (!testDbName.endsWith('_test')) {
    throw new Error(
      `TEST_DB_NAME ("${testDbName}") deve terminar em "_test" para evitar acidentes.`,
    );
  }

  // Se já inicializado, não faz nada
  if (testPool) {
    return;
  }

  // Conecta ao banco de manutenção (postgres) para criar o banco de teste se não existir
  const adminConfig = buildDatabaseConfig({ ...env, DB_NAME: 'postgres' });
  const adminPool = new Pool({ ...adminConfig, idleTimeoutMillis: 5_000 });
  try {
    await adminPool.query(`CREATE DATABASE "${testDbName}"`);
    console.log(`[test-setup] Banco de teste "${testDbName}" criado`);
  } catch (error: unknown) {
    const pgError = error as { code?: string };
    if (pgError.code !== '42P04') {
      // 42P04 = database already exists
      throw error;
    }
    console.log(`[test-setup] Banco de teste "${testDbName}" já existe`);
  } finally {
    await adminPool.end();
  }

  // Conecta ao banco de teste e roda migrations
  const testConfig = buildDatabaseConfig({ ...env, DB_NAME: testDbName });
  testPool = new Pool({
    ...testConfig,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  testDb = drizzle(testPool, { schema });

  try {
    await migrate(testDb, { migrationsFolder: './src/database/migrations' });
    console.log('[test-setup] Migrations aplicadas no banco de teste');
  } catch (error) {
    console.error('[test-setup] Erro ao aplicar migrations:', error);
    throw error;
  }
}

export async function teardownTestDatabase(): Promise<void> {
  if (testPool) {
    await testPool.end();
    testPool = null;
    testDb = null;
  }
}

export function getTestDb() {
  if (!testDb) {
    throw new Error('Test database not initialized. Call setupTestDatabase() first.');
  }
  return testDb;
}

export function getTestPool() {
  if (!testPool) {
    throw new Error('Test pool not initialized. Call setupTestDatabase() first.');
  }
  return testPool;
}

export default setupTestDatabase;
