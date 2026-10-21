import tseslint from 'typescript-eslint';

const baseConfig = tseslint.config({
  files: ['**/*.{js,mjs,cjs,ts,tsx}'],
  rules: {
    'no-var': 'error',
  },
});

export default baseConfig;
