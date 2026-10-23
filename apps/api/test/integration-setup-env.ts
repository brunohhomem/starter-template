import { getEnv, resetEnvCache } from '../src/config/load-env';

/**
 * Configuração de ambiente para testes de integração.
 * Garante que as variáveis necessárias estejam disponíveis.
 * O Turbo precisa delas declaradas para cache correto (F0).
 */

// Define NODE_ENV=test ANTES de carregar o env para que o cache seja correto
process.env.NODE_ENV = 'test';
process.env.MAIL_DRIVER = 'memory';

// Reseta o cache para forçar recarregamento com NODE_ENV=test
resetEnvCache();

const env = getEnv();

// Validação extra: TRAVA DE SEGURANÇA
const testDbName = env.TEST_DB_NAME ?? `${env.DB_NAME}_test`;
if (!testDbName.endsWith('_test')) {
  throw new Error(
    `TEST_DB_NAME ("${testDbName}") deve terminar em "_test". Recusando rodar testes de integração.`,
  );
}

console.log('[integration-setup-env] Ambiente de teste configurado:', {
  NODE_ENV: process.env.NODE_ENV,
  TEST_DB_NAME: testDbName,
  DB_HOST: env.DB_HOST,
  DB_PORT: env.DB_PORT,
  REDIS_HOST: env.REDIS_HOST,
  REDIS_PORT: env.REDIS_PORT,
});
