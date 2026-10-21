import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync, readdirSync } from 'node:fs';
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
        // eslint-disable-next-line @typescript-eslint/naming-convention -- nomes de variáveis de ambiente
        NODE_ENV: 'test',
        // eslint-disable-next-line @typescript-eslint/naming-convention -- nomes de variáveis de ambiente
        KEYS_ROOT_DIR: TEST_DIR,
        // eslint-disable-next-line @typescript-eslint/naming-convention -- nomes de variáveis de ambiente
        KEYS_ENV_FILE: TEST_ENV,
        // eslint-disable-next-line @typescript-eslint/naming-convention -- nomes de variáveis de ambiente
        KEYS_ENV_EXAMPLE_FILE: TEST_ENV_EXAMPLE,
      },
    },
  );
  return { stdout: result.stdout || '', stderr: result.stderr || '', code: result.status || 0 };
}

function runKeysRotate(
  keyName: string,
  args: string[] = [],
): { stdout: string; stderr: string; code: number } {
  const result = spawnSync(
    'node',
    ['--import=tsx', resolve(SCRIPTS_DIR, 'src', 'keys-rotate.ts'), keyName, ...args],
    {
      cwd: SCRIPTS_DIR,
      encoding: 'utf-8',
      env: {
        ...process.env,
        // eslint-disable-next-line @typescript-eslint/naming-convention -- nomes de variáveis de ambiente
        NODE_ENV: 'test',
        // eslint-disable-next-line @typescript-eslint/naming-convention -- nomes de variáveis de ambiente
        KEYS_ROOT_DIR: TEST_DIR,
        // eslint-disable-next-line @typescript-eslint/naming-convention -- nomes de variáveis de ambiente
        KEYS_ENV_FILE: TEST_ENV,
        // eslint-disable-next-line @typescript-eslint/naming-convention -- nomes de variáveis de ambiente
        KEYS_ENV_EXAMPLE_FILE: TEST_ENV_EXAMPLE,
      },
    },
  );
  return { stdout: result.stdout || '', stderr: result.stderr || '', code: result.status || 0 };
}

describe('keys:generate', () => {
  beforeEach(() => setupTestEnv());
  afterEach(() => cleanupTestEnv());

  it('cria .env a partir do .env.example se não existir', async () => {
    const result = await runKeysGenerate();
    expect(result.code).toBe(0);
    expect(existsSync(TEST_ENV)).toBe(true);
  });

  it('gera apenas chaves ausentes ou vazias', async () => {
    await runKeysGenerate();
    const firstRun = readFileSync(TEST_ENV, 'utf-8');
    const hash1 = firstRun;

    await runKeysGenerate();
    const secondRun = readFileSync(TEST_ENV, 'utf-8');

    expect(secondRun).toBe(hash1);
  });

  it('não sobrescreve valores existentes', async () => {
    writeFileSync(TEST_ENV, 'JWT_ACCESS_SECRET=valor-existente\n', 'utf-8');
    await runKeysGenerate();
    const content = readFileSync(TEST_ENV, 'utf-8');
    expect(content).toContain('JWT_ACCESS_SECRET=valor-existente');
  });

  it('preserva comentários e ordem do .env.example', async () => {
    const customExample = `# Comentário inicial
NODE_ENV=development
# Comentário do meio
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
`;
    setupTestEnv(customExample);
    await runKeysGenerate();
    const content = readFileSync(TEST_ENV, 'utf-8');
    expect(content).toContain('# Comentário inicial');
    expect(content).toContain('# Comentário do meio');
  });

  it('mantém LF no final das linhas', async () => {
    await runKeysGenerate();
    const content = readFileSync(TEST_ENV, 'utf-8');
    expect(content).not.toContain('\r\n');
  });

  it('imprime BACKUP_ENCRYPTION_KEY apenas na geração', async () => {
    const result1 = await runKeysGenerate();
    expect(result1.stdout).toContain('BACKUP_ENCRYPTION_KEY GERADA');

    const result2 = await runKeysGenerate();
    expect(result2.stdout).not.toContain('BACKUP_ENCRYPTION_KEY GERADA');
  });

  it('lista variáveis definidas pelo usuário que estão vazias', async () => {
    const result = await runKeysGenerate();
    expect(result.stdout).toContain('SEED_ADMIN_EMAIL');
  });

  it('gera chaves com comprimento correto (ENCRYPTION_KEY = 32 bytes base64)', async () => {
    await runKeysGenerate();
    const content = readFileSync(TEST_ENV, 'utf-8');
    const match = content.match(/ENCRYPTION_KEY=(.+)/);
    expect(match).toBeTruthy();
    expect(match![1]).toBeDefined();
    const decoded = Buffer.from(match![1] as string, 'base64');
    expect(decoded.length).toBe(32);
  });
});

describe('keys:rotate', () => {
  beforeEach(() => setupTestEnv());
  afterEach(() => cleanupTestEnv());

  it('exige confirmação digitando o nome da chave', async () => {
    await runKeysGenerate();
    const result = await runKeysRotate('JWT_ACCESS_SECRET');
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('Confirmação não confere');
  });

  it('rotação com --yes pula o prompt', async () => {
    await runKeysGenerate();
    const result = await runKeysRotate('JWT_ACCESS_SECRET', ['--yes']);
    expect(result.code).toBe(0);
  });

  it('cria arquivo .bak antes de alterar', async () => {
    await runKeysGenerate();
    await runKeysRotate('JWT_ACCESS_SECRET', ['--yes']);
    const backups = readdirSync(TEST_DIR).filter((fileName: string) =>
      fileName.startsWith('.env.bak-'),
    );
    expect(backups.length).toBe(1);
  });

  it('exibe consequência da rotação', async () => {
    await runKeysGenerate();
    const result = await runKeysRotate('ENCRYPTION_KEY', ['--yes']);
    expect(result.stdout).toContain('ilegíveis');
  });

  it('recusa chave inválida', async () => {
    await runKeysGenerate();
    const result = await runKeysRotate('CHAVE_INEXISTENTE');
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('Chave inválida');
  });

  it('não imprime valores das chaves na saída', async () => {
    await runKeysGenerate();
    const result = await runKeysRotate('JWT_ACCESS_SECRET', ['--yes']);
    // Check that no base64-like strings appear in stdout (simplified check)
    expect(result.stdout).not.toMatch(/[A-Za-z0-9+/=]{40,}/);
  });
});
