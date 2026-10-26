'use client';

import type { UserListItem, UsersListResponse } from '@starter/shared';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/screen-state';
import { useMe } from '@/features/auth/hooks/use-me';
import { api } from '@/lib/api';
import { roleLabel } from '../labels';
import { InviteUserDialog } from './invite-user-dialog.client';
import { RoleControl, StatusControl } from './user-controls.client';

function formatLastLogin(value: string | null): string {
  if (!value) return 'Nunca';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value),
  );
}

async function fetchUsers(page: number, search: string): Promise<UsersListResponse> {
  const response = await api.get<UsersListResponse>('/users', {
    params: {
      page,
      pageSize: 20,
      ...(search ? { search } : {}),
    },
  });
  return response.data;
}

function UserFacts({ item }: { item: UserListItem }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="truncate text-base font-medium">{item.fullName ?? item.email}</p>
      <p className="truncate text-sm text-muted-foreground">{item.email}</p>
      <div className="flex flex-wrap gap-2">
        <Badge>{roleLabel(item.role)}</Badge>
        <Badge tone={item.isActive ? 'ok' : 'warn'}>{item.isActive ? 'Ativo' : 'Inativo'}</Badge>
        <Badge tone={item.emailVerified ? 'ok' : 'warn'}>
          {item.emailVerified ? 'E-mail confirmado' : 'E-mail pendente'}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Último acesso: {formatLastLogin(item.lastLoginAt)}
      </p>
    </div>
  );
}

function UserActions({ item, currentUserId }: { item: UserListItem; currentUserId: string }) {
  const disabled = item.id === currentUserId;

  return (
    <div className="flex flex-col gap-2">
      {disabled ? <p className="text-sm text-muted-foreground">Sua conta</p> : null}
      <RoleControl userId={item.id} role={item.role} disabled={disabled} />
      <StatusControl userId={item.id} isActive={item.isActive} disabled={disabled} />
    </div>
  );
}

export function UsersScreen() {
  const me = useMe();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const users = useQuery({
    queryKey: ['users', page, search],
    queryFn: () => fetchUsers(page, search),
    enabled: me.data?.user.role === 'admin',
  });

  if (me.isPending) return <LoadingState />;
  if (me.isError || !me.data) {
    return (
      <ErrorState
        title="Não foi possível carregar a sessão"
        description="Tente de novo."
        onRetry={() => void me.refetch()}
      />
    );
  }

  const currentUser = me.data.user;
  if (currentUser.role !== 'admin') {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader title="Acesso negado" description="Só administradores gerenciam usuários." />
        <Button asChild>
          <Link href="/app">Voltar ao início</Link>
        </Button>
      </div>
    );
  }

  const items = users.data?.items ?? [];
  const totalPages = users.data?.meta.totalPages ?? 1;

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <PageHeader
          title="Usuários"
          description="Convide, mude o papel e ative ou desative contas."
        />
        <Button onClick={() => setInviteOpen(true)}>Convidar</Button>
      </div>
      <form
        className="flex flex-col gap-2 md:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setSearch(searchInput.trim());
        }}
      >
        <Input
          aria-label="Buscar por nome ou e-mail"
          placeholder="Nome ou e-mail"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
        />
        <Button type="submit">Buscar</Button>
      </form>
      {users.isPending ? <LoadingState /> : null}
      {users.isError ? (
        <ErrorState
          title="Não foi possível listar os usuários"
          description="Tente de novo."
          onRetry={() => void users.refetch()}
        />
      ) : null}
      {users.isSuccess && items.length === 0 ? (
        <EmptyState title="Nenhum usuário" description="A busca não encontrou contas." />
      ) : null}
      {users.isSuccess && items.length > 0 ? (
        <>
          <ul className="flex flex-col gap-3 md:hidden">
            {items.map((item) => (
              <li key={item.id} className="flex flex-col gap-3 rounded-lg border border-border p-4">
                <UserFacts item={item} />
                <UserActions item={item} currentUserId={currentUser.id} />
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-2 py-3 font-medium">Pessoa</th>
                  <th className="px-2 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border align-top">
                    <td className="px-2 py-3">
                      <UserFacts item={item} />
                    </td>
                    <td className="px-2 py-3">
                      <UserActions item={item} currentUserId={currentUser.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Anterior
            </Button>
            <p className="text-sm text-muted-foreground">
              Página {page} de {Math.max(totalPages, 1)}
            </p>
            <Button
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Próxima
            </Button>
          </div>
        </>
      ) : null}
      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}
