import { Html, Body, Container, Section, Text } from '@react-email/components';

interface LayoutProps {
  appName: string;
  children: React.ReactNode;
}

export function EmailLayout({ appName, children }: LayoutProps) {
  return (
    <Html lang="pt-BR">
      <Body
        style={{ fontFamily: 'sans-serif', backgroundColor: '#f9f9f9', margin: 0, padding: '24px' }}
      >
        <Container
          style={{
            maxWidth: '600px',
            margin: '0 auto',
            backgroundColor: '#ffffff',
            padding: '24px',
            borderRadius: '8px',
          }}
        >
          {children}
          <Section style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #eee' }}>
            <Text style={{ color: '#666', fontSize: '12px' }}>{appName}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
