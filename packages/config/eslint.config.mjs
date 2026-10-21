import baseConfig from './eslint/base.mjs';

export default [
  {
    // Amostras inválidas de propósito. O turbo linta este pacote enquanto o teste ainda as grava.
    ignores: ['eslint/fixtures/apps/**'],
  },
  ...baseConfig,
];
