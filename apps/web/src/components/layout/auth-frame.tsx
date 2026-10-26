import type { ReactNode } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeMenu } from './theme-menu.client';

type AuthFrameProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function AuthFrame({ title, description, children }: AuthFrameProps) {
  return (
    <main className="safe-bottom safe-top flex min-h-dvh flex-col bg-background px-4">
      <div className="mx-auto flex w-full flex-col gap-6 py-8 md:w-[28rem] md:py-16">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex h-11 items-center text-sm font-medium">
            Starter template
          </Link>
          <ThemeMenu />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </main>
  );
}
