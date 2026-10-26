import type { ReactNode } from 'react';
import { Providers } from '@/components/providers.client';
import './globals.css';

export const metadata = {
  title: {
    default: 'Starter template',
    template: '%s · Starter template',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
