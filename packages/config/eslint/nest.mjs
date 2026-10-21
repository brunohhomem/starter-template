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
];

export default nestConfig;
