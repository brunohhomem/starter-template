import { Button, Link, Section, Text } from '@react-email/components';
import { EmailLayout } from './layout';
import type { InviteProps } from './render-email';

export function InviteTemplate({ appName, link, expiresInLabel, recipientName }: InviteProps) {
  return (
    <EmailLayout appName={appName}>
      <Section>
        {recipientName && <Text>Olá, {recipientName}!</Text>}
        <Text>Você foi convidado para o {appName}.</Text>
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
          Aceitar convite
        </Button>
        <Text style={{ marginTop: '16px' }}>Este convite expira em {expiresInLabel}.</Text>
        <Text style={{ marginTop: '16px' }}>
          Ou acesse diretamente: <Link href={link}>{link}</Link>
        </Text>
      </Section>
    </EmailLayout>
  );
}
