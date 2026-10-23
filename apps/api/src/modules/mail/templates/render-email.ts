import { render } from '@react-email/render';
import React from 'react';
import { EmailConfirmationTemplate } from './email-confirmation';
import { PasswordResetTemplate } from './password-reset';
import { InviteTemplate } from './invite';

export interface EmailConfirmationProps {
  appName: string;
  link: string;
  expiresInLabel: string;
  recipientName?: string;
}

export interface PasswordResetProps {
  appName: string;
  link: string;
  expiresInLabel: string;
  recipientName?: string;
}

export interface InviteProps {
  appName: string;
  link: string;
  expiresInLabel: string;
  recipientName?: string;
}

type TemplateMap = {
  emailConfirmation: EmailConfirmationProps;
  passwordReset: PasswordResetProps;
  invite: InviteProps;
};

export async function renderEmail<T extends keyof TemplateMap>(
  template: T,
  props: TemplateMap[T],
): Promise<{ subject: string; html: string; text: string }> {
  switch (template) {
    case 'emailConfirmation': {
      const templateProps = props as EmailConfirmationProps;
      const html = await render(React.createElement(EmailConfirmationTemplate, templateProps));
      const text = await render(React.createElement(EmailConfirmationTemplate, templateProps), {
        plainText: true,
      });
      return { subject: 'Confirme seu e-mail', html, text };
    }
    case 'passwordReset': {
      const templateProps = props as PasswordResetProps;
      const html = await render(React.createElement(PasswordResetTemplate, templateProps));
      const text = await render(React.createElement(PasswordResetTemplate, templateProps), {
        plainText: true,
      });
      return { subject: 'Redefinição de senha', html, text };
    }
    case 'invite': {
      const templateProps = props as InviteProps;
      const html = await render(React.createElement(InviteTemplate, templateProps));
      const text = await render(React.createElement(InviteTemplate, templateProps), {
        plainText: true,
      });
      return { subject: `Você foi convidado para o ${templateProps.appName}`, html, text };
    }
    default:
      throw new Error(`Unknown email template: ${String(template)}`);
  }
}

export function formatExpiresInLabel(value: number, unit: 'hours' | 'minutes' | 'days'): string {
  switch (unit) {
    case 'hours':
      return value === 1 ? '1 hora' : `${value} horas`;
    case 'minutes':
      return value === 1 ? '1 minuto' : `${value} minutos`;
    case 'days':
      return value === 1 ? '1 dia' : `${value} dias`;
  }
}
