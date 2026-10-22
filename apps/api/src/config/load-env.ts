import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { validateEnv, type Env } from './env.schema';

const ENV_FILE = process.env.ENV_FILE ?? '.env';

let cachedEnv: Env | null = null;

/**
 * Sobe na árvore de diretórios até achar o manifesto do workspace. O `pnpm`
 * e o `nest` executam a API com cwd em `apps/api`, mas o `.env` único mora
 * na raiz do repositório; sem isso o loader procuraria no lugar errado.
 */
function findRepoRoot(startDir: string): string {
  let current = startDir;
  while (true) {
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      // Chegou à raiz do disco sem achar o manifesto: devolve o ponto de
      // partida para a mensagem de erro apontar para um caminho previsível.
      return startDir;
    }
    current = parent;
  }
}

function resolveEnvFilePath(): string {
  if (ENV_FILE !== '.env') {
    return resolve(ENV_FILE);
  }
  return join(findRepoRoot(process.cwd()), '.env');
}

export function loadEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  const envFilePath = resolveEnvFilePath();
  if (existsSync(envFilePath)) {
    process.loadEnvFile(envFilePath);
  }

  cachedEnv = validateEnv(process.env as Record<string, string | undefined>);
  return cachedEnv;
}

export function getEnv(): Env {
  if (!cachedEnv) {
    return loadEnv();
  }
  return cachedEnv;
}

export function resetEnvCache(): void {
  cachedEnv = null;
}
