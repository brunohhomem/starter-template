import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { readWorkspaceValue, workspaceRoot } from './read-workspace-env.mjs';

const E2E_DATABASE = 'app_e2e';
const WEB_ORIGIN = 'http://127.0.0.1:3000';
const rootDir = workspaceRoot();
const apiDir = path.join(rootDir, 'apps/api');
const requireFromApi = createRequire(path.join(apiDir, 'package.json'));
const { Client } = requireFromApi('pg');

function childEnv() {
  return {
    ...process.env,
    DB_NAME: E2E_DATABASE,
    NODE_ENV: 'development',
    WEB_ORIGIN,
    APP_ORIGIN: WEB_ORIGIN,
  };
}

function runApiScript(scriptName) {
  const tsxCli = requireFromApi.resolve('tsx/cli');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [tsxCli, `scripts/${scriptName}.ts`], {
      cwd: apiDir,
      env: childEnv(),
      stdio: 'inherit',
    });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${scriptName} saiu com ${code}`));
    });
  });
}

async function recreateDatabase() {
  const client = new Client({
    host: readWorkspaceValue('DB_HOST', 'localhost'),
    port: Number(readWorkspaceValue('DB_PORT', '5432')),
    user: readWorkspaceValue('DB_USER', 'app'),
    password: readWorkspaceValue('DB_PASSWORD'),
    database: 'postgres',
  });
  await client.connect();
  try {
    await client.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [E2E_DATABASE],
    );
    await client.query(`DROP DATABASE IF EXISTS "${E2E_DATABASE}"`);
    await client.query(`CREATE DATABASE "${E2E_DATABASE}"`);
  } finally {
    await client.end();
  }
}

async function requirePasswordChange() {
  const client = new Client({
    host: readWorkspaceValue('DB_HOST', 'localhost'),
    port: Number(readWorkspaceValue('DB_PORT', '5432')),
    user: readWorkspaceValue('DB_USER', 'app'),
    password: readWorkspaceValue('DB_PASSWORD'),
    database: E2E_DATABASE,
  });
  const adminEmail = readWorkspaceValue('ADMIN_EMAIL', 'admin@example.com');
  await client.connect();
  try {
    const updated = await client.query(
      'UPDATE users SET must_change_password = true WHERE email = $1',
      [adminEmail],
    );
    if (updated.rowCount !== 1) {
      throw new Error(`Admin ${adminEmail} não foi semeado em ${E2E_DATABASE}`);
    }
  } finally {
    await client.end();
  }
}

function stopProcess(child) {
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
    return;
  }
  child.kill('SIGTERM');
}

await recreateDatabase();
await runApiScript('db-migrate');
await runApiScript('db-seed');
await requirePasswordChange();

const api = spawn(process.execPath, ['dist/main.js'], {
  cwd: apiDir,
  env: childEnv(),
  stdio: 'inherit',
});
const worker = spawn(process.execPath, ['dist/worker.js'], {
  cwd: apiDir,
  env: childEnv(),
  stdio: 'inherit',
});

let shuttingDown = false;

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  stopProcess(api);
  stopProcess(worker);
  process.exit(code);
}

api.on('exit', () => shutdown(1));
worker.on('exit', () => shutdown(1));
process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT', () => shutdown(0));

await new Promise(() => {});
