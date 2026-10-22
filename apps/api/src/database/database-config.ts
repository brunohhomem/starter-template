import type { Env } from '../config/env.schema';

export interface DatabaseConfig {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
  readonly database: string;
  readonly max: number;
}

/**
 * Única fonte da configuração de conexão: componentes `DB_*`, nunca URL,
 * para evitar problema de escape de senha. Usada pelo app, pelos scripts de
 * banco e pelo `drizzle.config.ts`.
 */
export function buildDatabaseConfig(env: Env): DatabaseConfig {
  return {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    max: env.DB_POOL_MAX ?? 10,
  };
}
