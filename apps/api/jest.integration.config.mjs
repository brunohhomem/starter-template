/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', useESM: false }],
  },
  testMatch: ['**/*.int-spec.ts'],
  globalSetup: '<rootDir>/test/integration-setup.ts',
  globalTeardown: '<rootDir>/test/integration-teardown.ts',
  setupFilesAfterEnv: ['<rootDir>/test/integration-setup-env.ts'],
  maxWorkers: 1,
  testTimeout: 30000,
  transformIgnorePatterns: ['/node_modules/'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};

export default config;
