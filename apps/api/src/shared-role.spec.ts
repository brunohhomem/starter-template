import { describe, expect, it } from '@jest/globals';
import { Role } from '@starter/shared';

describe('Role', () => {
  it('expõe os papéis do contrato compartilhado', () => {
    expect(Role.admin).toBe('admin');
    expect(Role.user).toBe('user');
  });
});
