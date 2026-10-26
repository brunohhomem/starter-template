'use client';

import type { SettingsResponse } from '@starter/shared';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { ErrorState, LoadingState } from '@/components/ui/screen-state';
import { Switch } from '@/components/ui/switch';
import { useMe } from '@/features/auth/hooks/use-me';
import { PUBLIC_SETTINGS_QUERY_KEY } from '@/features/settings/hooks/use-public-settings';
import { api } from '@/lib/api';
import { applyApiError } from '@/lib/api-error';
import { queryClient } from '@/lib/query-client';
import { useState } from 'react';
import { toast } from 'sonner';

const SETTINGS_QUERY_KEY = ['settings'] as const;

export function SettingsScreen() {
  const me = useMe();
  const [pending, setPending] = useState(false);
  const settings = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: async () => {
      const response = await api.get<SettingsResponse>('/settings');
      return response.data;
    },
    enabled: me.data?.user.role === 'admin',
  });

  async function updateRegistration(registrationEnabled: boolean) {
    setPending(true);
    try {
      await api.patch('/settings', { registrationEnabled });
      await queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: PUBLIC_SETTINGS_QUERY_KEY });
      toast.success(registrationEnabled ? 'Cadastro ligado' : 'Cadastro desligado');
    } catch (error) {
      applyApiError(error);
    } finally {
      setPending(false);
    }
  }

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
  if (me.data.user.role !== 'admin') {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader title="Acesso negado" description="Só administradores alteram configurações." />
        <Button asChild>
          <Link href="/app">Voltar ao início</Link>
        </Button>
      </div>
    );
  }
  if (settings.isPending) return <LoadingState />;
  if (settings.isError || !settings.data) {
    return (
      <ErrorState
        title="Não foi possível carregar as configurações"
        description="Tente de novo."
        onRetry={() => void settings.refetch()}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full flex-col gap-6 md:w-[40rem]">
      <PageHeader title="Configurações" description="Controle quem pode criar uma conta." />
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
        <div className="flex flex-col gap-1">
          <p className="text-base font-medium">Cadastro aberto</p>
          <p className="text-sm text-muted-foreground">
            Visitantes podem criar conta quando esta opção está ligada.
          </p>
        </div>
        <Switch
          checked={settings.data.registrationEnabled}
          disabled={pending}
          aria-label="Cadastro aberto"
          onCheckedChange={(checked) => void updateRegistration(checked)}
        />
      </div>
    </div>
  );
}
