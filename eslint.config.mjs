import baseConfig from './packages/config/eslint/base.mjs';
import nestConfig from './packages/config/eslint/nest.mjs';
import nextConfig from './packages/config/eslint/next.mjs';

function isIgnoreOnly(config) {
  const keys = Object.keys(config);
  return keys.length > 0 && keys.every((key) => key === 'ignores' || key === 'name');
}

function prefixPattern(pattern, prefix) {
  if (Array.isArray(pattern)) {
    return pattern.map((item) => prefixPattern(item, prefix));
  }

  if (pattern.startsWith('!')) {
    return `!${prefix}${pattern.slice(1)}`;
  }

  return `${prefix}${pattern}`;
}

function scope(configs, prefix) {
  return configs.flatMap((config) => {
    if (isIgnoreOnly(config)) {
      return [];
    }

    const patterns = config.files ?? ['**/*'];
    return [{ ...config, files: patterns.map((pattern) => prefixPattern(pattern, prefix)) }];
  });
}

const ignoreBlocks = [];
const seenIgnores = new Set();

for (const config of [...baseConfig, ...nestConfig, ...nextConfig]) {
  if (isIgnoreOnly(config) && !seenIgnores.has(config)) {
    seenIgnores.add(config);
    ignoreBlocks.push(config);
  }
}

const processEnvAllowedPaths = [
  'apps/api/src/config/**',
  'packages/scripts/**',
  'apps/api/drizzle.config.ts',
  // O rewrite do Next é resolvido antes do app. Não há ENV token neste processo.
  'apps/web/next.config.ts',
  // O smoke E2E sobe o build fora do Nest e lê o admin semeado no .env.
  'apps/web/playwright.config.ts',
  'apps/web/e2e/**',
  '**/test/**/*.ts',
  'test/**/*.ts',
];

export default [
  ...ignoreBlocks,
  ...scope(baseConfig, ''),
  ...scope(baseConfig, 'packages/shared/'),
  ...scope(baseConfig, 'packages/config/'),
  ...scope(nestConfig, 'apps/api/'),
  ...scope(nextConfig, 'apps/web/'),
  {
    files: ['**/*.{ts,tsx,js,mjs,cjs}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message: 'Acesso direto a process.env é proibido. Use o módulo de config (ENV token).',
        },
      ],
    },
  },
  {
    files: processEnvAllowedPaths,
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
];
