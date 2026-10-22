import eslintComments from '@eslint-community/eslint-plugin-eslint-comments';
import unicorn from 'eslint-plugin-unicorn';
import tseslint from 'typescript-eslint';

const metricRules = {
  complexity: ['warn', 10],
  'max-lines-per-function': ['warn', { max: 50, skipBlankLines: true, skipComments: true }],
  'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
  'max-params': ['warn', 4],
  'max-depth': ['warn', 3],
};

const metricExceptions = [
  '**/*.spec.ts',
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/seed/**',
  '**/*.entity.ts',
  '**/schema/**',
  '**/*.dto.ts',
  '**/migrations/**',
  '**/*.config.*',
];

const envAllowedPaths = ['apps/api/src/config/**/*.ts', 'packages/scripts/**/*.ts'];

const baseConfig = tseslint.config(
  {
    ignores: ['**/dist/**', '**/.next/**', '**/coverage/**', '**/.turbo/**', '**/next-env.d.ts'],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    plugins: {
      unicorn,
      'eslint-comments': eslintComments,
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      'no-var': 'error',
      'no-else-return': ['error', { allowElseIf: false }],
      'no-lonely-if': 'error',
      'no-nested-ternary': 'error',
      'id-length': ['error', { min: 2, exceptions: ['_'] }],
      'eslint-comments/require-description': 'error',
      'eslint-comments/no-unlimited-disable': 'error',
      'unicorn/filename-case': [
        'error',
        {
          case: 'kebabCase',
          ignore: ['^\\[.*\\]$', '\\.d\\.ts$'],
        },
      ],
      ...metricRules,
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'default',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
          filter: { regex: '^_$', match: false },
        },
        {
          selector: 'default',
          format: null,
          filter: { regex: '^_$', match: true },
        },
        { selector: 'import', format: ['camelCase', 'PascalCase'] },
        { selector: 'variable', format: ['camelCase', 'UPPER_CASE', 'PascalCase'] },
        { selector: 'function', format: ['camelCase', 'PascalCase'] },
        { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'objectLiteralProperty', format: ['camelCase', 'UPPER_CASE'] },
      ],
    },
  },
  {
    files: metricExceptions,
    rules: {
      complexity: 'off',
      'max-lines-per-function': 'off',
      'max-lines': 'off',
      'max-params': 'off',
      'max-depth': 'off',
    },
  },
);

export default baseConfig;
