import baseConfig from './base.mjs';

const apiFiles = (suffix) => [`apps/api/src/**/${suffix}`, `src/**/${suffix}`];

const nestConfig = [
  ...baseConfig,
  {
    files: apiFiles('*.controller.ts'),
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'drizzle-orm', message: 'Controller não importa drizzle-orm.' }],
          patterns: [
            {
              group: ['drizzle-orm/*'],
              message: 'Controller não importa drizzle-orm.',
            },
            {
              group: ['**/*.repository', '**/*.repository.js', '**/*.repository.ts'],
              message: 'Controller não importa repository.',
            },
          ],
        },
      ],
    },
  },
  {
    files: apiFiles('*.service.ts'),
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'drizzle-orm', message: 'Service não importa drizzle-orm.' }],
          patterns: [
            {
              group: ['drizzle-orm/*'],
              message: 'Service não importa drizzle-orm.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/api/drizzle.config.ts', 'drizzle.config.ts'],
    languageOptions: {
      parserOptions: {
        projectService: false,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-restricted-syntax': 'off',
    },
  },
  {
    files: ['scripts/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: false,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-restricted-syntax': 'off',
    },
  },
  {
    files: ['**/test/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: false,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-restricted-syntax': 'off',
    },
  },
];

export default nestConfig;
