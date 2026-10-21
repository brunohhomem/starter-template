import { getEnv } from '../src/config/load-env';
import { buildDatabaseConfig } from '../src/database/database-config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

async function main(): Promise<void> {
  const env = getEnv();
  const config = buildDatabaseConfig(env);
  const pool = new Pool({
    ...config,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  const db = drizzle(pool);

  try {
    await migrate(db, {
      migrationsFolder: './src/database/migrations',
    });
    console.log('Migrations aplicadas com sucesso');
    process.exitCode = 0;
  } catch (error) {
    console.error('Erro ao aplicar migrations:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
