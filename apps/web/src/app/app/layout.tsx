import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell.client';

type LoggedInLayoutProps = {
  children: ReactNode;
};

export default function LoggedInLayout({ children }: LoggedInLayoutProps) {
  return <AppShell>{children}</AppShell>;
}
