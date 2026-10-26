import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line @typescript-eslint/naming-convention -- padrão Node.js para __filename
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention -- padrão Node.js para __dirname
const __dirname = resolve(__filename, '..');
const TEST_DIR = resolve(__dirname, '..', '..', '..', '.test-keys');
const TEST_ENV = resolve(TEST_DIR, '.env');
const TEST_ENV_EXAMPLE = resolve(TEST_DIR, '.env.example');
const SCRIPTS_DIR = resolve(__dirname, '..');

const EXAMPLE_CONTENT = `# Teste
NODE_ENV=development
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
COOKIE_SECRET=
ENCRYPTION_KEY=
BACKUP_ENCRYPTION_KEY=
DB_PASSWORD=
REDIS_PASSWORD=
SEED_ADMIN_EMAIL=
`;

function setupTestEnv(content: string = EXAMPLE_CONTENT): void {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
  mkdirSync(TEST_DIR, { recursive: true });
  writeFileSync(TEST_ENV_EXAMPLE, content, 'utf-8');
}

function cleanupTestEnv(): void {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

function runKeysGenerate(args: string[] = []): { stdout: string; stderr: string; code: number } {
  const result = spawnSync(
    'node',
    ['--import=tsx', resolve(SCRIPTS_DIR, 'src', 'keys-generate.ts'), ...args],
    {
      cwd: SCRIPTS_DIR,
      encoding: 'utf-8',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        KEYS_ROOT_DIR: TEST_DIR,
        KEYS_ENV_FILE: TEST_ENV,
        KEYS_ENV_EXAMPLE_FILE: TEST_ENV_EXAMPLE,
      },
    },
  );
  return { stdout: result.stdout || '', stderr: result.stderr || '', code: result.status || 0 };
}

describe('keys:generate', () => {
  beforeEach(() => setupTestEnv());
  afterEach(() => cleanupTestEnv());

  it('não sobrescreve valores existentes', () => {
    writeFileSync(TEST_ENV, 'JWT_ACCESS_SECRET=valor-existente\n', 'utf-8');
    runKeysGenerate();
    const content = readFileSync(TEST_ENV, 'utf-8');
    expect(content).toContain('JWT_ACCESS_SECRET=valor-existente');
  });
});
