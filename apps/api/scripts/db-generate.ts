import { spawnSync } from 'node:child_process';
import { isValidMigrationName, printMigrationNameHelp } from '../src/database/migration-name';

const name = process.argv[2];

if (!name) {
  console.error('db:generate exige o nome da migration.');
  printMigrationNameHelp();
  process.exit(1);
}

if (!isValidMigrationName(name)) {
  console.error(`Nome de migration inválido: "${name}".`);
  printMigrationNameHelp();
  process.exit(1);
}

// shell: true resolve o drizzle-kit.CMD de node_modules/.bin no Windows; o
// nome já validado só contém [a-z0-9_], então não há injeção de shell.
const result = spawnSync('drizzle-kit', ['generate', '--name', name], {
  stdio: 'inherit',
  shell: true,
});
process.exit(result.status ?? 1);
