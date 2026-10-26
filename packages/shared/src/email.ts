import { z } from './zod';
import {
  emailSchema,
  passwordSchema,
  fullNameSchema,
  cpfSchema,
  phoneSchema,
} from './auth/schemas';
import { paginationQuerySchema, paginatedResponseSchema } from './pagination';
import { USER_ROLES } from './auth/schemas';

// Token
export const tokenSchema = z.string().min(32).max(128);

// Confirmação de e-mail
export const confirmEmailRequestSchema = z.object({ token: tokenSchema });

// Recuperação de senha
export const forgotPasswordRequestSchema = z.object({ email: emailSchema });
export const FORGOT_PASSWORD_RESPONSE_MESSAGE =
  'Se o e-mail estiver cadastrado, enviaremos as instruções.';
export const forgotPasswordResponseSchema = z.object({ message: z.string() });

// Reset de senha
export const resetPasswordRequestSchema = z.object({
  token: tokenSchema,
  newPassword: passwordSchema,
});

// Convite
export const createInvitationRequestSchema = z.object({
  email: emailSchema,
  role: z.enum(USER_ROLES),
});
export const invitationResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  role: z.enum(USER_ROLES),
  expiresAt: z.string(),
});
export const acceptInvitationRequestSchema = z.object({
  token: tokenSchema,
  password: passwordSchema,
  fullName: fullNameSchema,
  cpf: cpfSchema.optional(),
  phone: phoneSchema.optional(),
});

// Settings
export const settingsResponseSchema = z.object({ registrationEnabled: z.boolean() });
export const publicSettingsResponseSchema = z.object({ registrationEnabled: z.boolean() });
export const updateSettingsRequestSchema = z
  .object({ registrationEnabled: z.boolean().optional() })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Pelo menos um campo deve ser fornecido',
  });

// Auditoria
export const AUDIT_ACTIONS = {
  SETTINGS_REGISTRATION_CHANGED: 'settings.registration_changed',
  AUTH_PASSWORD_RESET_REQUESTED: 'auth.password_reset_requested',
  AUTH_PASSWORD_RESET_COMPLETED: 'auth.password_reset_completed',
  AUTH_EMAIL_CONFIRMED: 'auth.email_confirmed',
  AUTH_INVITATION_SENT: 'auth.invitation_sent',
  AUTH_INVITATION_ACCEPTED: 'auth.invitation_accepted',
  USERS_ROLE_CHANGED: 'users.role_changed',
  USERS_STATUS_CHANGED: 'users.status_changed',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const auditLogSchema = z.object({
  id: z.string().uuid(),
  actorUserId: z.string().uuid().nullable(),
  action: z.string(),
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  ip: z.string().nullable(),
  createdAt: z.string(),
});

export const auditLogsQuerySchema = paginationQuerySchema.extend({
  action: z.string().optional(),
});

export const auditLogsResponseSchema = paginatedResponseSchema(auditLogSchema);

// Types
export type Token = z.infer<typeof tokenSchema>;
export type ConfirmEmailRequest = z.infer<typeof confirmEmailRequestSchema>;
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>;
export type ForgotPasswordResponse = z.infer<typeof forgotPasswordResponseSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;
export type CreateInvitationRequest = z.infer<typeof createInvitationRequestSchema>;
export type InvitationResponse = z.infer<typeof invitationResponseSchema>;
export type AcceptInvitationRequest = z.infer<typeof acceptInvitationRequestSchema>;
export type SettingsResponse = z.infer<typeof settingsResponseSchema>;
export type PublicSettingsResponse = z.infer<typeof publicSettingsResponseSchema>;
export type UpdateSettingsRequest = z.infer<typeof updateSettingsRequestSchema>;
export type AuditLog = z.infer<typeof auditLogSchema>;
export type AuditLogsQuery = z.infer<typeof auditLogsQuerySchema>;
export type AuditLogsResponse = z.infer<typeof auditLogsResponseSchema>;
