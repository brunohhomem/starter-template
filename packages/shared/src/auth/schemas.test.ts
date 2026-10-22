import { describe, it, expect } from 'vitest';
import {
  emailSchema,
  passwordSchema,
  registerRequestSchema,
  loginRequestSchema,
  changePasswordRequestSchema,
  authUserSchema,
  authResponseSchema,
} from './schemas';

describe('auth schemas', () => {
  describe('emailSchema', () => {
    it('aceita e-mail válido e normaliza', () => {
      const result = emailSchema.parse('  User@Example.COM  ');
      expect(result).toBe('user@example.com');
    });

    it('rejeita e-mail inválido', () => {
      expect(() => emailSchema.parse('invalido')).toThrow();
      expect(() => emailSchema.parse('')).toThrow();
    });

    it('rejeita e-mail com mais de 254 chars', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      expect(() => emailSchema.parse(longEmail)).toThrow();
    });
  });

  describe('passwordSchema', () => {
    it('aceita senha válida (10-72 bytes, letra + dígito)', () => {
      expect(() => passwordSchema.parse('SenhaValida123')).not.toThrow();
      expect(() => passwordSchema.parse('A1b2C3d4E5')).not.toThrow();
    });

    it('rejeita senha com menos de 10 bytes', () => {
      expect(() => passwordSchema.parse('Curta1')).toThrow('pelo menos 10 bytes');
    });

    it('rejeita senha com mais de 72 bytes', () => {
      const long = 'A'.repeat(73);
      expect(() => passwordSchema.parse(long)).toThrow('no máximo 72 bytes');
    });

    it('rejeita senha só com letras', () => {
      expect(() => passwordSchema.parse('ApenasLetras')).toThrow('pelo menos um dígito');
    });

    it('rejeita senha só com dígitos', () => {
      expect(() => passwordSchema.parse('1234567890')).toThrow('pelo menos uma letra');
    });

    it('rejeita senha > 72 bytes UTF-8 (ex: emojis)', () => {
      const emoji = '😀'.repeat(19); // 19 * 4 = 76 bytes
      expect(() => passwordSchema.parse(emoji)).toThrow('excede 72 bytes');
    });

    it('aceita emoji dentro do limite de 72 bytes', () => {
      const emoji = '😀'.repeat(10) + 'A1'; // 10 * 4 + 2 = 42 bytes
      expect(() => passwordSchema.parse(emoji)).not.toThrow();
    });
  });

  describe('registerRequestSchema', () => {
    it('aceita payload válido', () => {
      const result = registerRequestSchema.parse({
        email: 'user@example.com',
        password: 'SenhaValida123',
      });
      expect(result.email).toBe('user@example.com');
    });

    it('rejeita e-mail duplicado não (validação de negócio é no service)', () => {
      expect(() =>
        registerRequestSchema.parse({ email: 'a', password: 'SenhaValida123' }),
      ).toThrow();
    });
  });

  describe('loginRequestSchema', () => {
    it('aceita payload válido', () => {
      const result = loginRequestSchema.parse({
        email: 'user@example.com',
        password: 'qualquer1',
      });
      expect(result.email).toBe('user@example.com');
    });

    it('não aplica política de senha forte', () => {
      expect(() => loginRequestSchema.parse({ email: 'a@b.com', password: 'x' })).not.toThrow();
    });

    it('limita senha a 72 chars', () => {
      expect(() =>
        loginRequestSchema.parse({ email: 'a@b.com', password: 'x'.repeat(73) }),
      ).toThrow();
    });
  });

  describe('changePasswordRequestSchema', () => {
    it('aceita payload válido', () => {
      const result = changePasswordRequestSchema.parse({
        currentPassword: 'Antiga123',
        newPassword: 'NovaSenha456',
      });
      expect(result.newPassword).toBe('NovaSenha456');
    });

    it('aplica política na nova senha', () => {
      expect(() =>
        changePasswordRequestSchema.parse({ currentPassword: 'Antiga123', newPassword: 'fraca' }),
      ).toThrow();
    });
  });

  describe('authUserSchema', () => {
    it('aceita usuário válido', () => {
      const result = authUserSchema.parse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'user@example.com',
        role: 'user',
        mustChangePassword: false,
        emailVerified: true,
      });
      expect(result.role).toBe('user');
    });
  });

  describe('authResponseSchema', () => {
    it('aceita resposta válida', () => {
      const result = authResponseSchema.parse({
        user: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          email: 'user@example.com',
          role: 'admin',
          mustChangePassword: true,
          emailVerified: false,
        },
      });
      expect(result.user.mustChangePassword).toBe(true);
    });
  });
});
