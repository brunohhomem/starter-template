import { z } from '../zod';

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

export const passwordSchema = z
  .string()
  .min(10, 'A senha deve ter pelo menos 10 bytes')
  .max(72, 'A senha deve ter no máximo 72 bytes')
  .refine((val) => /[A-Za-z]/.test(val), 'A senha deve conter pelo menos uma letra')
  .refine((val) => /[0-9]/.test(val), 'A senha deve conter pelo menos um dígito')
  .refine((val) => Buffer.byteLength(val, 'utf8') <= 72, 'A senha excede 72 bytes UTF-8');

export const registerRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
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
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const USER_ROLES = ['admin', 'user'] as const;
export type UserRole = (typeof USER_ROLES)[number];
