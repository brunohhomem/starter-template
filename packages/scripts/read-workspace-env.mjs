import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function workspaceRoot() {
  return rootDir;
}

export function readWorkspaceValue(name, fallback = '') {
  const fromProcess = process.env[name]?.trim();
  if (fromProcess) return fromProcess;

  const envPath = path.join(rootDir, '.env');
  if (!existsSync(envPath)) return fallback;

  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    if (trimmed.slice(0, separator).trim() !== name) continue;
    const value = trimmed.slice(separator + 1).trim();
    if (value) return value;
  }

  return fallback;
}
