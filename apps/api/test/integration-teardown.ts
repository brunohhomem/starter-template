import { teardownTestDatabase } from './integration-setup';

/**
 * Teardown global para testes de integração.
 * Encerra o pool de conexões do banco de teste.
 */
export default async function globalTeardown(): Promise<void> {
  await teardownTestDatabase();
}
