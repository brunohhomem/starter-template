import { defineConfig } from 'drizzle-kit';
import { getEnv } from './src/config/load-env';
import { buildDatabaseConfig } from './src/database/database-config';

export default defineConfig({
  schema: './src/database/schema.ts',
  out: './src/database/migrations',
  dialect: 'postgresql',
  dbCredentials: buildDatabaseConfig(getEnv()),
});
