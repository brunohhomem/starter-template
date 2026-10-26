import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const apiDir = path.join(rootDir, 'apps/api');
const requireFromApi = createRequire(path.join(apiDir, 'package.json'));
const { Client } = requireFromApi('pg');

const HEALTH_ATTEMPTS = 60;

function readEnvFile() {
  const envPath = path.join(rootDir, '.env');
  const values = new Map();
  if (!existsSync(envPath)) return values;

  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    values.set(trimmed.slice(0, separator).trim(), trimmed.slice(separator + 1).trim());
  }

  return values;
}

function pick(name, fileValues, fallback) {
  const fromProcess = process.env[name]?.trim();
  if (fromProcess) return fromProcess;
  const fromFile = fileValues.get(name)?.trim();
  if (fromFile) return fromFile;
  return fallback;
}

function assertDatabaseName(name) {
  if (/^[A-Za-z0-9_]+$/.test(name)) return;
  throw new Error(`DB_NAME inválido para criar o banco: ${name}`);
}

async function ensureDatabase(config) {
  assertDatabaseName(config.database);
  const client = new Client({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: 'postgres',
  });
  await client.connect();
  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      config.database,
    ]);
    if (existing.rowCount === 0) {
      await client.query(`CREATE DATABASE "${config.database}"`);
    }
  } finally {
    await client.end();
  }
}

function startProcess(entry) {
  const entryPath = path.join(apiDir, 'dist', entry);
  if (!existsSync(entryPath)) {
    throw new Error(`Build ausente: ${entryPath}`);
  }
  return spawn(process.execPath, [entryPath], {
    cwd: apiDir,
    stdio: 'inherit',
  });
}

function stopProcess(child) {
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
    return;
  }
  child.kill('SIGTERM');
}

async function waitForHealth(port, children) {
  const url = `http://127.0.0.1:${port}/api/health`;
  for (let attempt = 0; attempt < HEALTH_ATTEMPTS; attempt += 1) {
    for (const child of children) {
      if (child.exitCode !== null) {
        throw new Error(`Processo encerrou com código ${child.exitCode} antes do health`);
      }
    }
    try {
      const response = await fetch(url);
      if (response.status === 200) return;
    } catch {
      // A API ainda está subindo.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`GET /api/health não retornou 200 em ${url}`);
}

const fileValues = readEnvFile();
const config = {
  host: pick('DB_HOST', fileValues, 'localhost'),
  port: Number(pick('DB_PORT', fileValues, '5432')),
  user: pick('DB_USER', fileValues, 'app'),
  password: pick('DB_PASSWORD', fileValues, ''),
  database: pick('DB_NAME', fileValues, 'app'),
};
const apiPort = pick('API_PORT', fileValues, '3001');

let api;
let worker;

try {
  await ensureDatabase(config);
  api = startProcess('main.js');
  worker = startProcess('worker.js');
  await waitForHealth(apiPort, [api, worker]);
  console.log('Build de produção respondeu 200 em /api/health');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
} finally {
  stopProcess(api);
  stopProcess(worker);
}
