import { getEnv } from '../src/config/load-env';
import { buildDatabaseConfig } from '../src/database/database-config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { seedAdmin } from '../src/database/seed/admin.seed';

async function main(): Promise<void> {
  const env = getEnv();

  if (env.NODE_ENV === 'test') {
    console.log('Seed não roda automaticamente em NODE_ENV=test');
    process.exitCode = 0;
    return;
  }

  const config = buildDatabaseConfig(env);
  const pool = new Pool({
    ...config,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  const db = drizzle(pool);

  try {
    const result = await seedAdmin(db);

    if (result.adminCreated) {
      console.log(`Admin criado: ${result.adminEmail}`);
      if (result.passwordGenerated) {
        console.log(`Senha inicial (apenas exibida uma vez): ${result.passwordGenerated}`);
      }
    }
    console.log(`registration_enabled = ${result.registrationEnabledValue}`);
    process.exitCode = 0;
  } catch (error) {
    console.error('Erro no seed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
