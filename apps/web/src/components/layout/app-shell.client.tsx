'use client';

import axios from 'axios';
import { Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorState, LoadingState } from '@/components/ui/screen-state';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useMe } from '@/features/auth/hooks/use-me';
import { roleLabel } from '@/features/users/labels';
import { api } from '@/lib/api';
import { applyApiError } from '@/lib/api-error';
import { queryClient } from '@/lib/query-client';
import { cn } from '@/lib/cn';
import { ThemeMenu } from './theme-menu.client';

const NAV_ITEMS = [
  { href: '/app', label: 'Início' },
  { href: '/app/profile', label: 'Perfil' },
] as const;

const ADMIN_ITEMS = [
  { href: '/app/users', label: 'Usuários' },
  { href: '/app/settings', label: 'Configurações' },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === '/app') return pathname === '/app';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({
  pathname,
  isAdmin,
  onNavigate,
}: {
  pathname: string;
  isAdmin: boolean;
  onNavigate?: () => void;
}) {
  const items = isAdmin ? [...NAV_ITEMS, ...ADMIN_ITEMS] : [...NAV_ITEMS];

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(pathname, item.href) ? 'page' : undefined}
          onClick={onNavigate}
          className={cn(
            'inline-flex h-11 items-center rounded-md px-3 text-sm',
            isActive(pathname, item.href) ? 'bg-accent text-accent-foreground' : 'hover:bg-accent',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const me = useMe();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!me.data?.user.mustChangePassword) return;
    router.replace('/change-password');
  }, [me.data, router]);

  async function logout() {
    try {
      await api.post('/auth/logout');
      queryClient.clear();
      router.push('/login');
    } catch (error) {
      applyApiError(error);
    }
  }

  if (me.isPending || me.data?.user.mustChangePassword) return <LoadingState />;

  if (me.isError) {
    const status = axios.isAxiosError(me.error) ? me.error.response?.status : undefined;
    if (status === 401) return <LoadingState label="Redirecionando…" />;
    return (
      <main className="safe-bottom mx-auto flex min-h-dvh w-full flex-col justify-center px-4 md:w-[28rem]">
        <ErrorState
          title="Não foi possível carregar a sessão"
          description="Tente de novo."
          onRetry={() => void me.refetch()}
        />
      </main>
    );
  }

  const isAdmin = me.data.user.role === 'admin';

  return (
    <div className="flex min-h-dvh w-full bg-background">
      <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r border-border p-4 md:flex">
        <Link href="/app" className="inline-flex h-11 items-center text-sm font-semibold">
          Starter template
        </Link>
        <NavLinks pathname={pathname} isAdmin={isAdmin} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="safe-top flex items-center justify-between gap-3 border-b border-border px-4 py-2">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="icon" variant="outline" className="md:hidden" aria-label="Abrir menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent title="Menu">
              <NavLinks pathname={pathname} isAdmin={isAdmin} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <p className="hidden text-sm text-muted-foreground md:block">
            {me.data.user.email} · {roleLabel(me.data.user.role)}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <ThemeMenu />
            <Button variant="outline" onClick={() => void logout()}>
              Sair
            </Button>
          </div>
        </header>
        <main className="safe-bottom min-w-0 flex-1 px-4 py-6">{children}</main>
      </div>
    </div>
  );
}
