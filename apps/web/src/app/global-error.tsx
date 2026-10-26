'use client';

import './globals.css';

type GlobalErrorProps = {
  reset: () => void;
};

export default function GlobalError({ reset }: GlobalErrorProps) {
  return (
    <html lang="pt-BR">
      <body>
        <main className="safe-bottom flex min-h-dvh items-center px-4">
          <div className="mx-auto flex w-full flex-col gap-3 md:w-[28rem]">
            <h1 className="text-2xl font-semibold">Algo deu errado</h1>
            <p className="text-sm text-muted-foreground">Não foi possível carregar o aplicativo.</p>
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-md border border-input px-4 text-sm"
              onClick={() => reset()}
            >
              Tentar de novo
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
