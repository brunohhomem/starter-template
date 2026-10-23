import { Button, Link, Section, Text } from '@react-email/components';
import { EmailLayout } from './layout';
import type { EmailConfirmationProps } from './render-email';

export function EmailConfirmationTemplate({
  appName,
  link,
  expiresInLabel,
  recipientName,
}: EmailConfirmationProps) {
  return (
    <EmailLayout appName={appName}>
      <Section>
        {recipientName && <Text>Olá, {recipientName}!</Text>}
        <Text>Confirme seu endereço de e-mail clicando no botão abaixo.</Text>
        <Button
          href={link}
          style={{
            backgroundColor: '#000',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: '4px',
            display: 'inline-block',
            textDecoration: 'none',
          }}
        >
          Confirmar e-mail
        </Button>
        <Text style={{ marginTop: '16px' }}>Este link expira em {expiresInLabel}.</Text>
        <Text>Se você não criou esta conta, ignore esta mensagem.</Text>
        <Text style={{ marginTop: '16px' }}>
          Ou acesse diretamente: <Link href={link}>{link}</Link>
        </Text>
      </Section>
    </EmailLayout>
  );
}
