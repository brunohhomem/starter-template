import { describe, it, expect } from 'vitest';
import { setupTestDatabase } from './integration-setup';
import { resetEnvCache } from '../src/config/load-env';

describe('Database integration', () => {
  it('recusa rodar quando TEST_DB_NAME não termina em _test', async () => {
    const saved = process.env.TEST_DB_NAME;
    process.env.TEST_DB_NAME = 'meu_banco_sem_sufixo';
    resetEnvCache();

    try {
      await expect(setupTestDatabase()).rejects.toThrow('deve terminar em "_test"');
    } finally {
      process.env.TEST_DB_NAME = saved;
      resetEnvCache();
    }
  });
});
