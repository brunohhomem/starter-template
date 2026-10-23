import { describe, expect, it } from 'vitest';
import {
  tokenSchema,
  confirmEmailRequestSchema,
  forgotPasswordRequestSchema,
  FORGOT_PASSWORD_RESPONSE_MESSAGE,
  forgotPasswordResponseSchema,
  resetPasswordRequestSchema,
  createInvitationRequestSchema,
  invitationResponseSchema,
  acceptInvitationRequestSchema,
  settingsResponseSchema,
  publicSettingsResponseSchema,
  updateSettingsRequestSchema,
  AUDIT_ACTIONS,
  auditLogSchema,
  auditLogsQuerySchema,
  auditLogsResponseSchema,
} from './email';

describe('email contracts', () => {
  describe('tokenSchema', () => {
    it('aceita token válido (32-128 chars)', () => {
      const validToken = 'a'.repeat(32);
      expect(tokenSchema.safeParse(validToken).success).toBe(true);

      const maxToken = 'b'.repeat(128);
      expect(tokenSchema.safeParse(maxToken).success).toBe(true);
    });

    it('rejeita token muito curto', () => {
      expect(tokenSchema.safeParse('a'.repeat(31)).success).toBe(false);
    });

    it('rejeita token muito longo', () => {
      expect(tokenSchema.safeParse('a'.repeat(129)).success).toBe(false);
    });
  });

  describe('confirmEmailRequestSchema', () => {
    it('valida request com token válido', () => {
      const result = confirmEmailRequestSchema.safeParse({ token: 'a'.repeat(32) });
      expect(result.success).toBe(true);
    });

    it('rejeita token inválido', () => {
      expect(confirmEmailRequestSchema.safeParse({ token: 'short' }).success).toBe(false);
    });
  });

  describe('forgotPasswordRequestSchema', () => {
    it('valida e-mail válido', () => {
      expect(forgotPasswordRequestSchema.safeParse({ email: 'test@example.com' }).success).toBe(
        true,
      );
    });

    it('rejeita e-mail inválido', () => {
      expect(forgotPasswordRequestSchema.safeParse({ email: 'invalid' }).success).toBe(false);
    });
  });

  describe('FORGOT_PASSWORD_RESPONSE_MESSAGE', () => {
    it('é a string esperada', () => {
      expect(FORGOT_PASSWORD_RESPONSE_MESSAGE).toBe(
        'Se o e-mail estiver cadastrado, enviaremos as instruções.',
      );
    });
  });

  describe('forgotPasswordResponseSchema', () => {
    it('valida o corpo com a constante', () => {
      const result = forgotPasswordResponseSchema.safeParse({
        message: FORGOT_PASSWORD_RESPONSE_MESSAGE,
      });
      expect(result.success).toBe(true);
    });

    it('valida qualquer string como mensagem', () => {
      const result = forgotPasswordResponseSchema.safeParse({
        message: 'Mensagem diferente',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('resetPasswordRequestSchema', () => {
    it('valida request com token e nova senha válidos', () => {
      const result = resetPasswordRequestSchema.safeParse({
        token: 'a'.repeat(32),
        newPassword: 'ValidPass123',
      });
      expect(result.success).toBe(true);
    });

    it('rejeita token inválido', () => {
      expect(
        resetPasswordRequestSchema.safeParse({
          token: 'short',
          newPassword: 'ValidPass123',
        }).success,
      ).toBe(false);
    });

    it('rejeita senha fraca', () => {
      expect(
        resetPasswordRequestSchema.safeParse({
          token: 'a'.repeat(32),
          newPassword: 'weak',
        }).success,
      ).toBe(false);
    });
  });

  describe('createInvitationRequestSchema', () => {
    it('valida convite com e-mail e role válidos', () => {
      expect(
        createInvitationRequestSchema.safeParse({ email: 'test@example.com', role: 'admin' })
          .success,
      ).toBe(true);
      expect(
        createInvitationRequestSchema.safeParse({ email: 'test@example.com', role: 'user' })
          .success,
      ).toBe(true);
    });

    it('rejeita role inválida', () => {
      expect(
        createInvitationRequestSchema.safeParse({ email: 'test@example.com', role: 'invalid' })
          .success,
      ).toBe(false);
    });

    it('rejeita e-mail inválido', () => {
      expect(
        createInvitationRequestSchema.safeParse({ email: 'invalid', role: 'user' }).success,
      ).toBe(false);
    });
  });

  describe('invitationResponseSchema', () => {
    it('valida resposta de convite completa', () => {
      const result = invitationResponseSchema.safeParse({
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        role: 'user',
        expiresAt: '2026-12-31T23:59:59.000Z',
      });
      expect(result.success).toBe(true);
    });

    it('rejeita UUID inválido', () => {
      expect(
        invitationResponseSchema.safeParse({
          id: 'not-a-uuid',
          email: 'test@example.com',
          role: 'user',
          expiresAt: '2026-12-31T23:59:59.000Z',
        }).success,
      ).toBe(false);
    });
  });

  describe('acceptInvitationRequestSchema', () => {
    it('valida aceite de convite com token e senha válidos', () => {
      const result = acceptInvitationRequestSchema.safeParse({
        token: 'a'.repeat(32),
        password: 'ValidPass123',
      });
      expect(result.success).toBe(true);
    });

    it('rejeita token inválido', () => {
      expect(
        acceptInvitationRequestSchema.safeParse({
          token: 'short',
          password: 'ValidPass123',
        }).success,
      ).toBe(false);
    });

    it('rejeita senha fraca', () => {
      expect(
        acceptInvitationRequestSchema.safeParse({
          token: 'a'.repeat(32),
          password: 'weak',
        }).success,
      ).toBe(false);
    });
  });

  describe('settingsResponseSchema', () => {
    it('valida resposta de settings', () => {
      expect(settingsResponseSchema.safeParse({ registrationEnabled: true }).success).toBe(true);
      expect(settingsResponseSchema.safeParse({ registrationEnabled: false }).success).toBe(true);
    });
  });

  describe('publicSettingsResponseSchema', () => {
    it('valida resposta pública de settings', () => {
      expect(publicSettingsResponseSchema.safeParse({ registrationEnabled: true }).success).toBe(
        true,
      );
    });
  });

  describe('updateSettingsRequestSchema', () => {
    it('rejeita objeto vazio', () => {
      expect(updateSettingsRequestSchema.safeParse({}).success).toBe(false);
    });

    it('aceita registrationEnabled true', () => {
      expect(updateSettingsRequestSchema.safeParse({ registrationEnabled: true }).success).toBe(
        true,
      );
    });

    it('aceita registrationEnabled false', () => {
      expect(updateSettingsRequestSchema.safeParse({ registrationEnabled: false }).success).toBe(
        true,
      );
    });
  });

  describe('AUDIT_ACTIONS', () => {
    it('contém todas as ações esperadas', () => {
      expect(AUDIT_ACTIONS.SETTINGS_REGISTRATION_CHANGED).toBe('settings.registration_changed');
      expect(AUDIT_ACTIONS.AUTH_PASSWORD_RESET_REQUESTED).toBe('auth.password_reset_requested');
      expect(AUDIT_ACTIONS.AUTH_PASSWORD_RESET_COMPLETED).toBe('auth.password_reset_completed');
      expect(AUDIT_ACTIONS.AUTH_EMAIL_CONFIRMED).toBe('auth.email_confirmed');
      expect(AUDIT_ACTIONS.AUTH_INVITATION_SENT).toBe('auth.invitation_sent');
      expect(AUDIT_ACTIONS.AUTH_INVITATION_ACCEPTED).toBe('auth.invitation_accepted');
    });
  });

  describe('auditLogSchema', () => {
    it('valida log de auditoria completo', () => {
      const result = auditLogSchema.safeParse({
        id: '123e4567-e89b-12d3-a456-426614174000',
        actorUserId: '123e4567-e89b-12d3-a456-426614174001',
        action: 'auth.password_reset_requested',
        targetType: 'user',
        targetId: '123e4567-e89b-12d3-a456-426614174002',
        metadata: { ip: '192.168.1.1' },
        ip: '192.168.1.1',
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      expect(result.success).toBe(true);
    });

    it('permite actorUserId nulo', () => {
      const result = auditLogSchema.safeParse({
        id: '123e4567-e89b-12d3-a456-426614174000',
        actorUserId: null,
        action: 'auth.password_reset_requested',
        targetType: null,
        targetId: null,
        metadata: {},
        ip: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('auditLogsQuerySchema', () => {
    it('herda limites de paginação', () => {
      expect(auditLogsQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
      expect(auditLogsQuerySchema.safeParse({ pageSize: 100 }).success).toBe(true);
      const parsed = auditLogsQuerySchema.parse({});
      expect(parsed.page).toBe(1);
      expect(parsed.pageSize).toBe(20);
    });

    it('aceita filtro de action opcional', () => {
      const result = auditLogsQuerySchema.safeParse({
        page: 2,
        pageSize: 50,
        action: 'auth.password_reset_requested',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.action).toBe('auth.password_reset_requested');
      }
    });
  });

  describe('auditLogsResponseSchema', () => {
    it('valida resposta paginada de audit logs', () => {
      const result = auditLogsResponseSchema.safeParse({
        items: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            actorUserId: '123e4567-e89b-12d3-a456-426614174001',
            action: 'auth.password_reset_requested',
            targetType: 'user',
            targetId: '123e4567-e89b-12d3-a456-426614174002',
            metadata: {},
            ip: '192.168.1.1',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        meta: {
          page: 1,
          pageSize: 20,
          totalItems: 1,
          totalPages: 1,
        },
      });
      expect(result.success).toBe(true);
    });
  });
});
