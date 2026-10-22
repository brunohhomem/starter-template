import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const currentFilename = fileURLToPath(import.meta.url);
const currentDirname = dirname(currentFilename);
const ROOT_DIR = process.env.KEYS_ROOT_DIR
  ? resolve(process.env.KEYS_ROOT_DIR)
  : resolve(currentDirname, '..', '..', '..');
const ENV_FILE = process.env.KEYS_ENV_FILE
  ? resolve(process.env.KEYS_ENV_FILE)
  : resolve(ROOT_DIR, '.env');
const ENV_EXAMPLE_FILE = process.env.KEYS_ENV_EXAMPLE_FILE
  ? resolve(process.env.KEYS_ENV_EXAMPLE_FILE)
  : resolve(ROOT_DIR, '.env.example');

type Encoding = 'base64url' | 'base64' | 'url-safe';

interface KeySpec {
  name: string;
  bytes: number;
  encoding: Encoding;
}

const GENERATED_KEYS: readonly KeySpec[] = [
  { name: 'JWT_ACCESS_SECRET', bytes: 64, encoding: 'base64url' },
  { name: 'JWT_REFRESH_SECRET', bytes: 64, encoding: 'base64url' },
  { name: 'COOKIE_SECRET', bytes: 64, encoding: 'base64url' },
  { name: 'ENCRYPTION_KEY', bytes: 32, encoding: 'base64' },
  { name: 'BACKUP_ENCRYPTION_KEY', bytes: 32, encoding: 'base64' },
  { name: 'DB_PASSWORD', bytes: 32, encoding: 'url-safe' },
  { name: 'REDIS_PASSWORD', bytes: 32, encoding: 'url-safe' },
] as const;

const USER_DEFINED_KEYS = [
  'ADMIN_EMAIL',
  'SEED_ADMIN_EMAIL',
  'SEED_ADMIN_PASSWORD',
  'ADMIN_INITIAL_PASSWORD',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
] as const;

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

function loadEnvExample(): Map<string, string> {
  if (!existsSync(ENV_EXAMPLE_FILE)) {
    throw new Error('Arquivo .env.example não encontrado');
  }
  const content = readFileSync(ENV_EXAMPLE_FILE, 'utf-8');
  return parseEnv(content);
}

function loadOrCreateEnv(): { content: string; map: Map<string, string> } {
  let content = '';
  if (existsSync(ENV_FILE)) {
    content = readFileSync(ENV_FILE, 'utf-8');
  } else {
    if (!existsSync(ENV_EXAMPLE_FILE)) {
      throw new Error('Arquivo .env.example não encontrado');
    }
    content = readFileSync(ENV_EXAMPLE_FILE, 'utf-8');
  }
  return { content, map: parseEnv(content) };
}

function writeEnvAtomically(map: Map<string, string>, originalContent: string): void {
  const newContent = serializeEnv(map, originalContent);
  const tempFile = `${ENV_FILE}.tmp`;
  writeFileSync(tempFile, newContent, { encoding: 'utf-8' });
  copyFileSync(tempFile, ENV_FILE);
  // Note: On Windows, we can't easily do atomic rename without a separate call
  // but copyFileSync overwrites atomically on POSIX
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const fileArg = args.find((arg) => arg.startsWith('--file='));
  const envFile = fileArg ? fileArg.split('=')[1] : ENV_FILE;

  const exampleMap = loadEnvExample();
  const { content: originalContent, map: envMap } = loadOrCreateEnv();

  const generated: string[] = [];
  const existing: string[] = [];

  for (const spec of GENERATED_KEYS) {
    const currentValue = envMap.get(spec.name);
    if (!currentValue || currentValue.trim() === '') {
      const value = generateKey(spec);
      envMap.set(spec.name, value);
      generated.push(spec.name);

      // Special handling for BACKUP_ENCRYPTION_KEY - print once
      if (spec.name === 'BACKUP_ENCRYPTION_KEY') {
        console.log('\n============================================================');
        console.log('⚠️  BACKUP_ENCRYPTION_KEY GERADA (apenas desta vez):');
        console.log(`   ${value}`);
        console.log('   Guarde no seu gerenciador de senhas!');
        console.log('============================================================\n');
      }
    } else {
      existing.push(spec.name);
    }
  }

  // Propaga USER_DEFINED_KEYS do process.env para o .env quando ainda estão vazios
  const injected: string[] = [];
  for (const name of USER_DEFINED_KEYS) {
    const inFile = envMap.get(name);
    const inEnv = process.env[name];
    if ((!inFile || inFile.trim() === '') && inEnv && inEnv.trim() !== '') {
      envMap.set(name, inEnv);
      injected.push(name);
    }
  }

  writeEnvAtomically(envMap, originalContent);

  if (generated.length > 0) {
    console.log('Chaves geradas:');
    for (const name of generated) {
      console.log(`  ✓ ${name}`);
    }
  }
  if (injected.length > 0) {
    console.log('Variáveis copiadas do ambiente:');
    for (const name of injected) {
      console.log(`  ✓ ${name}`);
    }
  }
  if (existing.length > 0) {
    console.log('Chaves já existentes (mantidas):');
    for (const name of existing) {
      console.log(`  - ${name}`);
    }
  }

  const userDefinedEmpty: string[] = [];
  for (const name of USER_DEFINED_KEYS) {
    const value = envMap.get(name);
    if (!value || value.trim() === '') {
      userDefinedEmpty.push(name);
    }
  }

  if (userDefinedEmpty.length > 0) {
    console.log('\nVariáveis que você define (ainda vazias):');
    for (const name of userDefinedEmpty) {
      console.log(`  ⚠ ${name}`);
    }
  }

  console.log('\n✓ Concluído');
}

main().catch((err) => {
  console.error('Erro:', err.message);
  process.exit(1);
});
