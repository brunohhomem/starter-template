import { validateEnv, type Env } from './env.schema';

const ENV_FILE = process.env.ENV_FILE ?? '.env';

let cachedEnv: Env | null = null;

export function loadEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  if (ENV_FILE !== '.env') {
    // Carregar arquivo .env customizado se especificado
    const fs = require('node:fs');
    const path = require('node:path');
    const envPath = path.resolve(ENV_FILE);
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      parseEnvContent(content);
    }
  } else {
    // Usar process.loadEnvFile (Node.js 20.6+)
    try {
      process.loadEnvFile();
    } catch {
      // loadEnvFile pode falhar se o arquivo não existir, o que é OK
    }
  }

  cachedEnv = validateEnv(process.env as Record<string, string | undefined>);
  return cachedEnv;
}

function parseEnvContent(content: string): void {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
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
