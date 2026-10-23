import { renderEmail, formatExpiresInLabel } from './render-email';

describe('renderEmail', () => {
  const baseProps = {
    appName: 'Test App',
    link: 'https://example.com/confirm?token=abc123',
    expiresInLabel: '24 horas',
  };

  describe('emailConfirmation', () => {
    it('HTML contém o link e o botão', async () => {
      const { html } = await renderEmail('emailConfirmation', baseProps);
      expect(html).toContain(baseProps.link);
      expect(html).toContain('Confirmar e-mail');
    });

    it('texto puro contém o link', async () => {
      const { text } = await renderEmail('emailConfirmation', baseProps);
      expect(text).toContain(baseProps.link);
    });

    it('assunto correto', async () => {
      const { subject } = await renderEmail('emailConfirmation', baseProps);
      expect(subject).toBe('Confirme seu e-mail');
    });

    it('valor hostil em appName é escapado', async () => {
      const { html } = await renderEmail('emailConfirmation', {
        ...baseProps,
        appName: '\"><img src=x onerror=alert(1)>',
      });
      expect(html).not.toContain('<img src=x onerror=alert(1)>');
    });
  });

  describe('passwordReset', () => {
    it('HTML contém o link e o botão', async () => {
      const { html } = await renderEmail('passwordReset', {
        ...baseProps,
        expiresInLabel: '30 minutos',
      });
      expect(html).toContain(baseProps.link);
      expect(html).toContain('Redefinir senha');
    });

    it('assunto correto', async () => {
      const { subject } = await renderEmail('passwordReset', {
        ...baseProps,
        expiresInLabel: '30 minutos',
      });
      expect(subject).toBe('Redefinição de senha');
    });
  });

  describe('invite', () => {
    it('HTML contém o link e o botão', async () => {
      const { html } = await renderEmail('invite', { ...baseProps, expiresInLabel: '7 dias' });
      expect(html).toContain(baseProps.link);
      expect(html).toContain('Aceitar convite');
    });

    it('assunto usa appName', async () => {
      const { subject } = await renderEmail('invite', { ...baseProps, expiresInLabel: '7 dias' });
      expect(subject).toBe('Você foi convidado para o Test App');
    });
  });
});

describe('formatExpiresInLabel', () => {
  it('singular hora', () => expect(formatExpiresInLabel(1, 'hours')).toBe('1 hora'));
  it('plural horas', () => expect(formatExpiresInLabel(24, 'hours')).toBe('24 horas'));
  it('singular minuto', () => expect(formatExpiresInLabel(1, 'minutes')).toBe('1 minuto'));
  it('plural minutos', () => expect(formatExpiresInLabel(30, 'minutes')).toBe('30 minutos'));
  it('singular dia', () => expect(formatExpiresInLabel(1, 'days')).toBe('1 dia'));
  it('plural dias', () => expect(formatExpiresInLabel(7, 'days')).toBe('7 dias'));
});
