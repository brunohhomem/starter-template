import { z } from '../zod';

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

// O bundle de produção do browser reescreve o global `Buffer` do Node e a
// validação passa a lançar. TextEncoder existe nos dois lados.
function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export const passwordSchema = z
  .string()
  .min(10, 'A senha deve ter pelo menos 10 bytes')
  .max(72, 'A senha deve ter no máximo 72 bytes')
  .refine((val) => /[A-Za-z]/.test(val), 'A senha deve conter pelo menos uma letra')
  .refine((val) => /[0-9]/.test(val), 'A senha deve conter pelo menos um dígito')
  .refine((val) => utf8ByteLength(val) <= 72, 'A senha excede 72 bytes UTF-8');

export const fullNameSchema = z.string().trim().min(2).max(120);

export const phoneSchema = z
  .string()
  .transform((val) => val.replace(/\D/g, ''))
  .refine((val) => val.length === 10 || val.length === 11, 'Telefone inválido');

function isValidCpf(cpf: string): boolean {
  let sum = 0;
  for (let idx = 0; idx < 9; idx++) {
    sum += parseInt(cpf.charAt(idx)) * (10 - idx);
  }
  let first = (sum * 10) % 11;
  if (first >= 10) first = 0;
  if (first !== parseInt(cpf.charAt(9))) return false;

  sum = 0;
  for (let idx = 0; idx < 10; idx++) {
    sum += parseInt(cpf.charAt(idx)) * (11 - idx);
  }
  let second = (sum * 10) % 11;
  if (second >= 10) second = 0;
  return second === parseInt(cpf.charAt(10));
}

export const cpfSchema = z
  .string()
  .transform((val) => val.replace(/\D/g, ''))
  .refine((val) => val.length === 11, 'CPF inválido')
  .refine((val) => !/^(.)\1+$/.test(val), 'CPF inválido')
  .refine(isValidCpf, 'CPF inválido');

export const registerRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: fullNameSchema,
  cpf: cpfSchema.optional(),
  phone: phoneSchema.optional(),
});

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
});

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: passwordSchema,
});

export const authUserSchema = z.object({
  id: z.string().uuid(),
  email: emailSchema,
  role: z.enum(['admin', 'user']),
  mustChangePassword: z.boolean(),
  emailVerified: z.boolean(),
});

export const authResponseSchema = z.object({
  user: authUserSchema,
});

export type Email = z.infer<typeof emailSchema>;
export type Password = z.infer<typeof passwordSchema>;
export type FullName = z.infer<typeof fullNameSchema>;
export type Phone = z.infer<typeof phoneSchema>;
export type Cpf = z.infer<typeof cpfSchema>;
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const USER_ROLES = ['admin', 'user'] as const;
export type UserRole = (typeof USER_ROLES)[number];
