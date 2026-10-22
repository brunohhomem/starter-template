import { Module, Global } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../src/database/schema';
import { DATABASE } from '../src/database/database.module';
import { getTestPool } from './integration-setup';

export type Database = NodePgDatabase<typeof schema>;

/**
 * DatabaseModule de teste que usa o pool de teste já inicializado.
 * Não cria novo pool - usa o pool compartilhado do setup de testes.
 */
@Global()
@Module({})
export class TestDatabaseModule {
  static forRoot() {
    return {
      module: TestDatabaseModule,
      providers: [
        {
          provide: DATABASE,
          useFactory: () => {
            const testPool = getTestPool();
            return drizzle(testPool, { schema });
          },
        },
      ],
      exports: [DATABASE],
    };
  }
}
