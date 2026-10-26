import { describe, expect, it } from 'vitest';
import { tokenSchema, resetPasswordRequestSchema } from './email';

describe('email contracts', () => {
  describe('tokenSchema', () => {
    it('aceita token válido (32-128 chars)', () => {
      expect(tokenSchema.safeParse('a'.repeat(32)).success).toBe(true);
      expect(tokenSchema.safeParse('b'.repeat(128)).success).toBe(true);
    });

    it('rejeita token fora do intervalo', () => {
      expect(tokenSchema.safeParse('a'.repeat(31)).success).toBe(false);
      expect(tokenSchema.safeParse('a'.repeat(129)).success).toBe(false);
    });
  });

  describe('resetPasswordRequestSchema', () => {
    it('rejeita senha fraca', () => {
      expect(
        resetPasswordRequestSchema.safeParse({
          token: 'a'.repeat(32),
          newPassword: 'weak',
        }).success,
      ).toBe(false);
    });
  });
});
