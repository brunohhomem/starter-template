import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const currentFilename = fileURLToPath(import.meta.url);
const currentDirname = dirname(currentFilename);
const ROOT_DIR = process.env.KEYS_ROOT_DIR
  ? resolve(process.env.KEYS_ROOT_DIR)
  : resolve(currentDirname, '..', '..', '..');
const ENV_FILE = process.env.KEYS_ENV_FILE
  ? resolve(process.env.KEYS_ENV_FILE)
  : resolve(ROOT_DIR, '.env');

type Encoding = 'base64url' | 'base64' | 'url-safe';

interface KeySpec {
  name: string;
  bytes: number;
  encoding: Encoding;
}

const KEY_SPECS: readonly KeySpec[] = [
  { name: 'JWT_ACCESS_SECRET', bytes: 64, encoding: 'base64url' },
  { name: 'JWT_REFRESH_SECRET', bytes: 64, encoding: 'base64url' },
  { name: 'COOKIE_SECRET', bytes: 64, encoding: 'base64url' },
  { name: 'ENCRYPTION_KEY', bytes: 32, encoding: 'base64' },
  { name: 'BACKUP_ENCRYPTION_KEY', bytes: 32, encoding: 'base64' },
  { name: 'DB_PASSWORD', bytes: 32, encoding: 'url-safe' },
  { name: 'REDIS_PASSWORD', bytes: 32, encoding: 'url-safe' },
] as const;

const KEY_NAMES = KEY_SPECS.map((specItem) => specItem.name);

const CONSEQUENCES: Record<string, string> = {
  JWT_ACCESS_SECRET: 'Todas as sessões são invalidadas (access tokens expiram em 15 min)',
  JWT_REFRESH_SECRET: 'Todas as sessões são invalidadas (refresh tokens expiram em 7 dias)',
  COOKIE_SECRET:
    'Todos os cookies assinados tornam-se inválidos; usuários precisam logar novamente',
  ENCRYPTION_KEY:
    'Dados cifrados com a chave antiga ficam ilegíveis; recuperar pelo arquivo de backup do .env',
  BACKUP_ENCRYPTION_KEY: 'Backups antigos só abrem com a chave antiga; guarde-a em local seguro',
  DB_PASSWORD: 'É preciso trocar também no serviço Postgres em execução; nada automático',
  REDIS_PASSWORD: 'É preciso trocar também no serviço Redis em execução; nada automático',
};

function generateBase64Url(bytes: number): string {
  return randomBytes(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function generateUrlSafe(byteCount: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let result = '';
  const random = randomBytes(byteCount);
  for (let index = 0; index < byteCount; index++) {
    const byteValue = random[index];
    if (byteValue !== undefined) {
      result += chars[byteValue % chars.length];
    }
  }
  return result;
}

function generateKey(spec: KeySpec): string {
  switch (spec.encoding) {
    case 'base64url':
      return generateBase64Url(spec.bytes);
    case 'base64':
      return randomBytes(spec.bytes).toString('base64');
    case 'url-safe':
      return generateUrlSafe(spec.bytes);
  }
}

function parseEnv(content: string): Map<string, string> {
  const map = new Map<string, string>();
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    map.set(key, value);
  }
  return map;
}

function serializeEnv(map: Map<string, string>, originalContent: string): string {
  const lines = originalContent.split('\n');
  const result: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      result.push(line);
      continue;
    }
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) {
      result.push(line);
      continue;
    }
    const key = trimmed.slice(0, eqIndex).trim();
    if (map.has(key)) {
      result.push(`${key}=${map.get(key)!}`);
      seen.add(key);
    } else {
      result.push(line);
    }
  }

  for (const [key, value] of map) {
    if (!seen.has(key)) {
      result.push(`${key}=${value}`);
    }
  }

  return result.join('\n');
}

async function confirmRotation(keyName: string, skipPrompt: boolean): Promise<boolean> {
  if (skipPrompt) return true;

  if (!stdin.isTTY) {
    console.error('Ambiente não interativo. Use --yes para confirmar.');
    return false;
  }

  const rl = createInterface({ input: stdin, output: stdout });
  const answer = await rl.question(
    `Digite o nome da chave para confirmar a rotação (${keyName}): `,
  );
  rl.close();
  return answer.trim() === keyName;
}

function writeEnvAtomically(map: Map<string, string>, originalContent: string): void {
  const newContent = serializeEnv(map, originalContent);
  const tempFile = `${ENV_FILE}.tmp`;
  writeFileSync(tempFile, newContent, { encoding: 'utf-8' });
  copyFileSync(tempFile, ENV_FILE);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const skipPrompt = args.includes('--yes') || args.includes('-y');
  const keyArg = args.find((arg) => !arg.startsWith('-'));

  if (!keyArg) {
    console.error('Uso: pnpm keys:rotate <NOME_DA_CHAVE> [--yes]');
    console.error('\nChaves disponíveis:');
    for (const name of KEY_NAMES) {
      console.error(`  ${name}`);
    }
    process.exit(1);
  }

  const keyName = keyArg.toUpperCase();
  const spec = KEY_SPECS.find((specItem) => specItem.name === keyName);

  if (!spec) {
    console.error(`Chave inválida: ${keyName}`);
    console.error('\nChaves disponíveis:');
    for (const name of KEY_NAMES) {
      console.error(`  ${name}`);
    }
    process.exit(1);
  }

  if (!existsSync(ENV_FILE)) {
    console.error('Arquivo .env não encontrado. Rode "pnpm keys:generate" primeiro.');
    process.exit(1);
  }

  const confirmed = await confirmRotation(keyName, skipPrompt);
  if (!confirmed) {
    console.error('Confirmação não confere. Operação cancelada.');
    process.exit(1);
  }

  const originalContent = readFileSync(ENV_FILE, 'utf-8');
  const envMap = parseEnv(originalContent);

  // Create backup
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = `${ENV_FILE}.bak-${timestamp}`;
  copyFileSync(ENV_FILE, backupFile);
  console.log(`Backup criado: ${backupFile}`);
  console.log(`  ⚠ Apague o backup após verificar a rotação: rm ${backupFile}`);

  // Show consequence
  console.log(`\n⚠️  Consequência da rotação de ${keyName}:`);
  console.log(`   ${CONSEQUENCES[keyName]}\n`);

  // Generate new value
  const newValue = generateKey(spec);
  envMap.set(keyName, newValue);

  writeEnvAtomically(envMap, originalContent);

  console.log(`✓ ${keyName} rotacionada com sucesso.`);
  console.log(`  Novo valor: (não exibido por segurança)`);
}

main().catch((err) => {
  console.error('Erro:', err.message);
  process.exit(1);
});
