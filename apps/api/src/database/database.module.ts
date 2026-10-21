import { Global, Module, type Provider } from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ENV } from '../config/app-config.module';
import * as schema from './schema';

export const DRIZZLE = Symbol('DRIZZLE');
export const PG_POOL = Symbol('PG_POOL');

const poolProvider: Provider = {
  provide: PG_POOL,
  useFactory: (env: Readonly<ReturnType<typeof import('../config/load-env').getEnv>>) => {
    return new Pool({
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
      max: env.DB_POOL_MAX ?? 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  },
  inject: [ENV],
};

const drizzleProvider: Provider = {
  provide: DRIZZLE,
  useFactory: (pool: Pool): NodePgDatabase<typeof schema> => {
    return drizzle(pool, { schema });
  },
  inject: [PG_POOL],
};

@Global()
@Module({
  providers: [poolProvider, drizzleProvider],
  exports: [PG_POOL, DRIZZLE],
})
export class DatabaseModule {}

export type Database = NodePgDatabase<typeof schema>;
