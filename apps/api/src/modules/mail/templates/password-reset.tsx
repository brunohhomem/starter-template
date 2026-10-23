import { Button, Link, Section, Text } from '@react-email/components';
import { EmailLayout } from './layout';
import type { PasswordResetProps } from './render-email';

export function PasswordResetTemplate({
  appName,
  link,
  expiresInLabel,
  recipientName,
}: PasswordResetProps) {
  return (
    <EmailLayout appName={appName}>
      <Section>
        {recipientName && <Text>Olá, {recipientName}!</Text>}
        <Text>Redefina sua senha clicando no botão abaixo.</Text>
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
          Redefinir senha
        </Button>
        <Text style={{ marginTop: '16px' }}>Este link expira em {expiresInLabel}.</Text>
        <Text>Se você não pediu, ignore. Sua senha continua a mesma.</Text>
        <Text style={{ marginTop: '16px' }}>
          Ou acesse diretamente: <Link href={link}>{link}</Link>
        </Text>
      </Section>
    </EmailLayout>
  );
}
