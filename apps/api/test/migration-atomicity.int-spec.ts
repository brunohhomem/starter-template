import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { getEnv } from '../src/config/load-env';
import { buildDatabaseConfig } from '../src/database/database-config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

/**
 * Teste de atomicidade de migration (T6 - prova obrigatória).
 *
 * Cria uma pasta de migrations temporária com dois statements:
 * 1. CREATE TABLE test_atomic (id serial PRIMARY KEY)
 * 2. INSERT INTO tabela_inexistente ... (faz falhar)
 *
 * Após o db:migrate, o primeiro statement NÃO deve estar aplicado.
 * Se aplicar parcialmente, o teste falha - o raciocínio de rollback do ADR
 * depende de a migration ser atômica.
 */
describe('Migration atomicity (T6 proof)', () => {
  let tempMigrationsDir: string;
  let testDbName: string;
  let testPool: Pool;

  beforeAll(async () => {
    const env = getEnv();
    // Ensure the test DB name ends with _test (safety lock)
    testDbName = `${env.TEST_DB_NAME}_atomicity_${Date.now()}_test`;

    // Criar diretório temporário para migrations
    tempMigrationsDir = mkdtempSync(join(tmpdir(), 'drizzle-migrations-'));
    const originalMigrationsDir = resolve(__dirname, '../src/database/migrations');

    // Copiar migrations existentes para o diretório temporário
    cpSync(originalMigrationsDir, tempMigrationsDir, { recursive: true });

    // Criar migration quebrada (segundo statement falha)
    const brokenMigration = `-- Migration quebrada para testar atomicidade
CREATE TABLE "test_atomic" (
  "id" serial PRIMARY KEY
);
--> statement-breakpoint
INSERT INTO "tabela_inexistente" ("coluna") VALUES ('teste');
`;

    // Escrever migration quebrada com timestamp posterior aos existentes
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
    writeFileSync(
      join(tempMigrationsDir, `${timestamp}_broken_atomicity_test.sql`),
      brokenMigration,
    );

    // Criar banco de teste isolado
    const adminConfig = buildDatabaseConfig({ ...env, DB_NAME: 'postgres' });
    const adminPool = new Pool({ ...adminConfig, idleTimeoutMillis: 5_000 });
    try {
      await adminPool.query(`CREATE DATABASE "${testDbName}"`);
    } catch (error: unknown) {
      const pgError = error as { code?: string };
      if (pgError.code !== '42P04') throw error;
    } finally {
      await adminPool.end();
    }

    // Conectar ao banco de teste
    const testConfig = buildDatabaseConfig({ ...env, DB_NAME: testDbName });
    testPool = new Pool({
      ...testConfig,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  });

  afterAll(async () => {
    // Limpar banco de teste
    if (testPool) {
      await testPool.end();
    }

    const env = getEnv();
    const adminConfig = buildDatabaseConfig({ ...env, DB_NAME: 'postgres' });
    const adminPool = new Pool({ ...adminConfig, idleTimeoutMillis: 5_000 });
    try {
      await adminPool.query(`DROP DATABASE IF EXISTS "${testDbName}"`);
    } catch {
      // Ignore errors
    } finally {
      await adminPool.end();
    }

    // Limpar diretório temporário
    rmSync(tempMigrationsDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // Reset database before each test
    const db = drizzle(testPool);
    const tablesResult = await testPool.query<{ tablename: string }>(`
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
  });

  it('migração com segundo statement falhando NÃO aplica o primeiro statement (atomicidade)', async () => {
    const db = drizzle(testPool);

    // Tentar rodar as migrations - deve falhar na migration quebrada
    try {
      await migrate(db, { migrationsFolder: tempMigrationsDir });
      throw new Error('Migration deveria ter falhado mas não falhou');
    } catch (error) {
      // Esperado: migration falha
      expect(error).toBeDefined();
    }

    // Verificar que a tabela test_atomic NÃO foi criada (rollback atômico)
    const tablesResult = await testPool.query<{ tablename: string }>(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public' AND tablename = 'test_atomic'
    `);

    expect(tablesResult.rows.length).toBe(0);
  });
});
