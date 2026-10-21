import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nextConfig from 'eslint-config-next';
import baseConfig from './base.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const useClientRestriction = {
  selector: 'ExpressionStatement[directive="use client"]',
  message: "A diretiva 'use client' só é permitida em *.client.ts(x) e em components/ui.",
};

const hookRestriction = {
  selector: 'CallExpression[callee.name=/^use[A-Z]/]',
  message: 'Hooks só são permitidos em *.client.tsx, em hooks/ ou em components/ui.',
};

function group(positive, negations) {
  return [positive, ...negations];
}

// Cada item de `files` é um AND. Negação solta no array seria um OR e não exclui.
const webBoundaries = [
  {
    files: [
      group('src/**/*.tsx', [
        '!src/**/*.client.tsx',
        '!src/**/hooks/**',
        '!src/**/components/ui/**',
      ]),
      group('apps/web/src/**/*.tsx', [
        '!apps/web/src/**/*.client.tsx',
        '!apps/web/src/**/hooks/**',
        '!apps/web/src/**/components/ui/**',
      ]),
    ],
    rules: {
      'no-restricted-syntax': ['error', useClientRestriction, hookRestriction],
    },
  },
  {
    files: [
      group('src/**/hooks/**/*.ts', [
        '!src/**/*.tsx',
        '!src/**/*.client.ts',
        '!src/**/components/ui/**',
      ]),
      group('src/**/hooks/**/*.tsx', ['!src/**/*.client.tsx', '!src/**/components/ui/**']),
      group('apps/web/src/**/hooks/**/*.ts', [
        '!apps/web/src/**/*.tsx',
        '!apps/web/src/**/*.client.ts',
        '!apps/web/src/**/components/ui/**',
      ]),
      group('apps/web/src/**/hooks/**/*.tsx', [
        '!apps/web/src/**/*.client.tsx',
        '!apps/web/src/**/components/ui/**',
      ]),
    ],
    rules: {
      'no-restricted-syntax': ['error', useClientRestriction],
    },
  },
  {
    files: [
      group('src/**/*.ts', [
        '!src/**/*.tsx',
        '!src/**/*.client.ts',
        '!src/**/hooks/**',
        '!src/**/components/ui/**',
      ]),
      group('apps/web/src/**/*.ts', [
        '!apps/web/src/**/*.tsx',
        '!apps/web/src/**/*.client.ts',
        '!apps/web/src/**/hooks/**',
        '!apps/web/src/**/components/ui/**',
      ]),
    ],
    rules: {
      'no-restricted-syntax': ['error', useClientRestriction],
    },
  },
];

// O bloco base vem depois do preset do Next: o último bloco substitui as opções da mesma regra.
const webConfig = [
  ...nextConfig,
  ...baseConfig,
  ...webBoundaries,
  {
    settings: {
      next: {
        rootDir: path.join(repoRoot, 'apps/web'),
      },
    },
  },
];

export default webConfig;
