'use client';

import type { ReactNode } from 'react';
import { Button } from './button';
import { Skeleton } from './skeleton';

export function LoadingState({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
      <p className="text-base font-medium">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

type ErrorStateProps = {
  title: string;
  description: string;
  onRetry?: () => void;
};

export function ErrorState({ title, description, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-lg border border-border px-4 py-8">
      <h1 className="text-base font-medium">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
      {onRetry ? (
        <Button type="button" variant="outline" onClick={onRetry}>
          Tentar de novo
        </Button>
      ) : null}
    </div>
  );
}

export function StatusPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <main className="safe-bottom flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="flex w-full flex-col gap-3 md:w-[28rem]">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
        {children}
      </div>
    </main>
  );
}
