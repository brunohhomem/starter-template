import Link from 'next/link';
import { ThemeMenu } from '@/components/layout/theme-menu.client';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="safe-bottom safe-top flex min-h-dvh flex-col px-4">
      <header className="mx-auto flex w-full items-center justify-between gap-3 py-4 md:w-[48rem]">
        <p className="text-sm font-medium">Starter template</p>
        <div className="flex items-center gap-2">
          <ThemeMenu />
          <Button asChild>
            <Link href="/login">Entrar</Link>
          </Button>
        </div>
      </header>
      <section className="mx-auto flex w-full flex-1 flex-col justify-center gap-4 py-16 md:w-[48rem]">
        <h1 className="text-3xl font-semibold tracking-tight">
          Um ponto de partida para o seu produto.
        </h1>
        <p className="text-base text-muted-foreground">
          Autenticação, convites e administração de usuários. Apague esta página no fork e coloque a
          sua.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/login">Entrar</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/register">Criar conta</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
