/**
 * Orquestrador de dev: API + worker sobem primeiro; web só começa quando
 * GET /api/health retornar 200. Lê API_PORT do .env (fallback: 3001).
 */
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { request } from 'node:http';

const POLL_INTERVAL_MS = 2_000;
const TIMEOUT_MS = 120_000;

function readApiPort() {
  const envPath = new URL('../.env', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
  if (!existsSync(envPath)) return 3001;
  const content = readFileSync(envPath, 'utf8');
  const match = content.match(/^API_PORT=(\d+)/m);
  return match ? parseInt(match[1], 10) : 3001;
}

function spawnProcess(cmd, args, label) {
  const child = spawn(cmd, args, {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env },
  });
  child.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error(`[dev] ${label} saiu com código ${code}`);
      process.exit(code);
    }
  });
  return child;
}

function pollHealth(port) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + TIMEOUT_MS;

    function attempt() {
      const req = request(
        { hostname: 'localhost', port, path: '/api/health', method: 'GET', timeout: 2000 },
        (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            scheduleNext();
          }
          res.resume();
        },
      );
      req.on('error', scheduleNext);
      req.on('timeout', () => {
        req.destroy();
        scheduleNext();
      });
      req.end();
    }

    function scheduleNext() {
      if (Date.now() + POLL_INTERVAL_MS > deadline) {
        reject(
          new Error(`API não respondeu em ${TIMEOUT_MS / 1000}s. Verifique infra (pnpm infra:up).`),
        );
        return;
      }
      setTimeout(attempt, POLL_INTERVAL_MS);
    }

    attempt();
  });
}

async function main() {
  const port = readApiPort();

  console.log('[dev] Iniciando API e worker...');
  spawnProcess('pnpm', ['--filter', '@starter/api', 'start:dev'], 'api');
  spawnProcess('pnpm', ['worker:dev'], 'worker');

  console.log(`[dev] Aguardando API em :${port}/api/health...`);
  await pollHealth(port);

  console.log('[dev] API pronta — iniciando web...');
  spawnProcess('pnpm', ['--filter', '@starter/web', 'dev'], 'web');
}

main().catch((err) => {
  console.error('[dev]', err.message);
  process.exit(1);
});
