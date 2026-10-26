import {
  acceptInvitationRequestSchema,
  cpfSchema,
  phoneSchema,
  registerRequestSchema,
  resetPasswordRequestSchema,
} from '@starter/shared';
import { z } from '@starter/shared/zod';

type DigitSchema = typeof cpfSchema;

function blankable(schema: DigitSchema) {
  return z.string().superRefine((value, ctx) => {
    if (value.replace(/\D/g, '').length === 0) return;
    const parsed = schema.safeParse(value);
    if (parsed.success) return;
    ctx.addIssue({
      code: 'custom',
      message: parsed.error.issues[0]?.message ?? 'Valor inválido',
    });
  });
}

export const optionalCpf = blankable(cpfSchema);
export const optionalPhone = blankable(phoneSchema);

export const registerFormSchema = registerRequestSchema.extend({
  cpf: optionalCpf,
  phone: optionalPhone,
});

export const acceptInviteFormSchema = acceptInvitationRequestSchema.omit({ token: true }).extend({
  cpf: optionalCpf,
  phone: optionalPhone,
});

export const resetPasswordFormSchema = resetPasswordRequestSchema.pick({ newPassword: true });

export function contactPayload(cpf: string, phone: string): { cpf?: string; phone?: string } {
  const payload: { cpf?: string; phone?: string } = {};
  if (cpf.replace(/\D/g, '').length > 0) payload.cpf = cpf;
  if (phone.replace(/\D/g, '').length > 0) payload.phone = phone;
  return payload;
}
