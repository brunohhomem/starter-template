import { describe, expect, it } from 'vitest';
import { roleSchema } from './role';

describe('roleSchema', () => {
  it('aceita admin e user', () => {
    expect(roleSchema.parse('admin')).toBe('admin');
    expect(roleSchema.parse('user')).toBe('user');
  });

  it('rejeita outro valor', () => {
    expect(() => roleSchema.parse('guest')).toThrow();
  });
});
