import {
  Global,
  Inject,
  Injectable,
  Module,
  type OnApplicationShutdown,
  type Provider,
} from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle, type NodePgDatabase, type NodePgTransaction } from 'drizzle-orm/node-postgres';
import type { TablesRelationalConfig } from 'drizzle-orm';
import type { Env } from '../config/env.schema';
import { ENV } from '../config/app-config.module';
import { buildDatabaseConfig } from './database-config';
import * as schema from './schema';

/** Token com a instância Drizzle consumida pelos repositories. */
export const DATABASE = Symbol('DATABASE');

export type Database = NodePgDatabase<typeof schema>;
export type DatabaseTransaction = NodePgTransaction<
  Record<string, unknown>,
  TablesRelationalConfig
>;

/**
 * Dona do pool de conexões. Existe como provider para o Nest invocar
 * `onApplicationShutdown` e encerrar o pool no desligamento da aplicação.
 */
@Injectable()
export class DatabaseConnection implements OnApplicationShutdown {
  readonly pool: Pool;
  readonly db: Database;

  constructor(@Inject(ENV) env: Env) {
    this.pool = new Pool({
      ...buildDatabaseConfig(env),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    this.db = drizzle(this.pool, { schema });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}

const databaseProvider: Provider = {
  provide: DATABASE,
  useFactory: (connection: DatabaseConnection): Database => connection.db,
  inject: [DatabaseConnection],
};

@Global()
@Module({
  providers: [DatabaseConnection, databaseProvider],
  exports: [DATABASE],
})
export class DatabaseModule {}
