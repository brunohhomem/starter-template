import assert from 'node:assert/strict';
import test from 'node:test';
import baseConfig from './base.mjs';
import nestConfig from './nest.mjs';
import nextConfig from './next.mjs';

function hasNoVarError(configs) {
  return configs.some((config) => config.rules?.['no-var'] === 'error');
}

test('o preset base publica no-var como error', () => {
  assert.equal(Array.isArray(baseConfig), true);
  assert.equal(hasNoVarError(baseConfig), true);
});

test('os presets nest e next reaproveitam a regra do base', () => {
  assert.equal(hasNoVarError(nestConfig), true);
  assert.equal(hasNoVarError(nextConfig), true);
});
