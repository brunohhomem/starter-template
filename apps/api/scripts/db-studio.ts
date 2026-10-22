import { spawnSync } from 'node:child_process';
import { getEnv } from '../src/config/load-env';

function main(): void {
  const env = getEnv();
  if (env.NODE_ENV === 'production') {
    console.error('db:studio não pode rodar em produção.');
    process.exit(1);
  }
  const result = spawnSync('drizzle-kit', ['studio'], {
    stdio: 'inherit',
    shell: true,
  });
  process.exit(result.status ?? 1);
}

void main();
