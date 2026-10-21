import tseslint from 'typescript-eslint';

const baseConfig = tseslint.config(
  {
    ignores: ['**/dist/**', '**/.next/**', '**/coverage/**', '**/.turbo/**'],
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    rules: {
      'no-var': 'error',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
    },
    rules: {
      'no-var': 'error',
    },
  },
);

export default baseConfig;
