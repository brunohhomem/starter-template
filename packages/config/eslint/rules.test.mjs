import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { ESLint } from 'eslint';

const repoRoot = path.resolve(import.meta.dirname, '../../..');
const fixtureRoots = [
  path.join(repoRoot, 'apps/api/src/lint-fixtures'),
  path.join(repoRoot, 'apps/web/src/lint-fixtures'),
];

const eslint = new ESLint({
  cwd: repoRoot,
  concurrency: 'off',
  globInputPaths: false,
  ignore: false,
  overrideConfigFile: path.join(repoRoot, 'eslint.config.mjs'),
});

function writeFixture(relativePath, source) {
  const absolutePath = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, source, 'utf8');
  return absolutePath;
}

async function lintFixture(relativePath, source) {
  const absolutePath = writeFixture(relativePath, source);
  const [result] = await eslint.lintFiles([absolutePath]);
  assert.ok(result, relativePath);
  const fatal = result.messages.filter((message) => message.fatal);
  assert.deepEqual(
    fatal.map((message) => message.message),
    [],
    relativePath,
  );
  return result;
}

function ruleMessages(result, ruleId) {
  return result.messages.filter((message) => message.ruleId === ruleId);
}

async function expectRule(relativePath, source, ruleId) {
  const result = await lintFixture(relativePath, source);
  const matched = ruleMessages(result, ruleId);
  const found = result.messages.map((message) => message.ruleId).join(',');
  assert.equal(matched.length > 0, true, `${relativePath}: ${found}`);
  assert.equal(
    matched.every((message) => message.severity === 2),
    true,
    relativePath,
  );
}

async function expectWarning(relativePath, source, ruleId) {
  const result = await lintFixture(relativePath, source);
  const matched = ruleMessages(result, ruleId);
  assert.equal(matched.length > 0, true, relativePath);
  assert.equal(
    matched.every((message) => message.severity === 1),
    true,
    relativePath,
  );
  assert.equal(result.errorCount, 0, relativePath);
}

async function expectClean(relativePath, source) {
  const result = await lintFixture(relativePath, source);
  assert.deepEqual(
    result.messages.map((message) => `${message.ruleId ?? 'fatal'}: ${message.message}`),
    [],
    relativePath,
  );
}

function disableComment(suffix) {
  return `eslint${'-disable'}${suffix}`;
}

test.after(() => {
  for (const fixtureRoot of fixtureRoots) {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('any é erro', async () => {
  await expectRule(
    'apps/api/src/lint-fixtures/explicit-any.ts',
    'export const value: any = 1;\n',
    '@typescript-eslint/no-explicit-any',
  );
});

test('else depois de return é erro', async () => {
  await expectRule(
    'apps/api/src/lint-fixtures/else-return.ts',
    [
      'export function readValue(value: number): number {',
      '  if (value > 0) {',
      '    return value;',
      '  } else {',
      '    return 0;',
      '  }',
      '}',
      '',
    ].join('\n'),
    'no-else-return',
  );
});

test('promise flutuante é erro', async () => {
  await expectRule(
    'apps/api/src/lint-fixtures/floating-promise.ts',
    [
      'async function loadValue(): Promise<void> {',
      '  return undefined;',
      '}',
      '',
      'export function runLoad(): void {',
      '  loadValue();',
      '}',
      '',
    ].join('\n'),
    '@typescript-eslint/no-floating-promises',
  );
});

test('nome de uma letra é erro', async () => {
  await expectRule(
    'apps/api/src/lint-fixtures/short-name.ts',
    'export const x = 1;\n',
    'id-length',
  );
});

test('controller não importa drizzle-orm nem repository', async () => {
  await expectRule(
    'apps/api/src/lint-fixtures/orders.controller.ts',
    "import { eq } from 'drizzle-orm';\n\nexport const filter = eq;\n",
    'no-restricted-imports',
  );
  await expectRule(
    'apps/api/src/lint-fixtures/people.controller.ts',
    "import { PeopleRepository } from './people.repository';\n\nexport const repository = PeopleRepository;\n",
    'no-restricted-imports',
  );
});

test('service não importa drizzle-orm e pode importar repository', async () => {
  await expectRule(
    'apps/api/src/lint-fixtures/orders.service.ts',
    "import { sql } from 'drizzle-orm/sql';\n\nexport const query = sql;\n",
    'no-restricted-imports',
  );
  await expectClean(
    'apps/api/src/lint-fixtures/people.service.ts',
    "import { PeopleRepository } from './people.repository';\n\nexport const repository = PeopleRepository;\n",
  );
});

test("'use client' em page.tsx e em arquivo sem .client é erro", async () => {
  const source =
    "'use client';\n\nexport default function SamplePage(): null {\n  return null;\n}\n";
  await expectRule('apps/web/src/lint-fixtures/page.tsx', source, 'no-restricted-syntax');
  await expectRule('apps/web/src/lint-fixtures/plain-widget.tsx', source, 'no-restricted-syntax');
});

test('hook fora de arquivo client é erro e dentro é permitido', async () => {
  const source = [
    'function useValue(): number {',
    '  return 1;',
    '}',
    '',
    'export function SampleWidget(): number {',
    '  return useValue();',
    '}',
    '',
  ].join('\n');
  await expectRule('apps/web/src/lint-fixtures/widget.tsx', source, 'no-restricted-syntax');
  await expectClean('apps/web/src/lint-fixtures/hooks/use-sample.tsx', source);
  await expectClean('apps/web/src/lint-fixtures/sample.client.tsx', `'use client';\n\n${source}`);
});

test('eslint-disable sem descrição é erro', async () => {
  await expectRule(
    'apps/api/src/lint-fixtures/disable-comment.ts',
    `// ${disableComment('-next-line id-length')}\nexport const value = 1;\n`,
    'eslint-comments/require-description',
  );
  await expectRule(
    'apps/api/src/lint-fixtures/unlimited-disable.ts',
    `/* ${disableComment('')} */\nexport const value = 1;\n`,
    'eslint-comments/no-unlimited-disable',
  );
});

test('métrica acima do limite é warning', async () => {
  await expectWarning(
    'apps/api/src/lint-fixtures/read-total.ts',
    [
      'export function readTotal(',
      '  first: number,',
      '  second: number,',
      '  third: number,',
      '  fourth: number,',
      '  fifth: number,',
      '): number {',
      '  return first + second + third + fourth + fifth;',
      '}',
      '',
    ].join('\n'),
    'max-params',
  );
});

test('arquivo válido passa limpo', async () => {
  await expectClean(
    'apps/api/src/lint-fixtures/read-value.ts',
    [
      'export function readValue(value: number): number {',
      '  if (value <= 0) {',
      '    return 0;',
      '  }',
      '',
      '  return value;',
      '}',
      '',
    ].join('\n'),
  );
});

test('filename-case aceita segmentos do Next e rejeita camelCase', async () => {
  const page = 'export default function SamplePage(): null {\n  return null;\n}\n';
  await expectClean('apps/web/src/lint-fixtures/[id]/page.tsx', page);
  await expectClean('apps/web/src/lint-fixtures/[userId]/page.tsx', page);
  await expectClean(
    'apps/web/src/lint-fixtures/SampleName.d.ts',
    'export type SampleName = {\n  value: number;\n};\n',
  );
  await expectRule(
    'apps/web/src/lint-fixtures/badName.ts',
    'export const value = 1;\n',
    'unicorn/filename-case',
  );
});
