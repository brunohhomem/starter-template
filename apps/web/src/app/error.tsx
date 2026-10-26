'use client';

import { ErrorState } from '@/components/ui/screen-state';

type AppErrorProps = {
  reset: () => void;
};

export default function AppError({ reset }: AppErrorProps) {
  return (
    <main className="safe-bottom flex min-h-dvh items-center px-4">
      <div className="mx-auto w-full md:w-[28rem]">
        <ErrorState
          title="Algo deu errado"
          description="Não foi possível carregar esta página."
          onRetry={reset}
        />
      </div>
    </main>
  );
}
