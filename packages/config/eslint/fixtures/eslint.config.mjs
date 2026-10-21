import baseConfig from '../base.mjs';
import nestConfig from '../nest.mjs';
import nextConfig from '../next.mjs';

const fixtureRoot = import.meta.dirname;

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

// Raiz de um monorepo mínimo. O cwd do teste e o tsconfigRootDir ficam aqui para as
// regras por caminho e o projectService verem apps/api e apps/web sem gravar nos apps reais.
export default [
  ...ignoreBlocks,
  ...scope(baseConfig, ''),
  ...scope(nestConfig, 'apps/api/'),
  ...scope(nextConfig, 'apps/web/'),
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: fixtureRoot,
      },
    },
  },
];
