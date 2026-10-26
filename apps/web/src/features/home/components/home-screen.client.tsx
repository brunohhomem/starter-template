'use client';

import Link from 'next/link';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { useState } from 'react';
import { toast } from 'sonner';
import { ME_QUERY_KEY, useMe } from '@/features/auth/hooks/use-me';
import { roleLabel } from '@/features/users/labels';
import { api } from '@/lib/api';
import { applyApiError } from '@/lib/api-error';
import { queryClient } from '@/lib/query-client';

export function HomeScreen() {
  const me = useMe();
  const [sending, setSending] = useState(false);
  const user = me.data?.user;

  async function resend() {
    setSending(true);
    try {
      await api.post('/auth/email/resend');
      await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      toast.success('Enviamos um novo e-mail de confirmação');
    } catch (error) {
      applyApiError(error);
    } finally {
      setSending(false);
    }
  }

  if (!user) return null;

  return (
    <div className="mx-auto flex w-full flex-col gap-6 md:w-[40rem]">
      <PageHeader title="Início" description="Área logada do template." />
      <p className="text-base">
        Olá, {user.email}. Seu papel é {roleLabel(user.role)}.
      </p>
      {user.emailVerified ? null : (
        <Alert>
          <span className="block">Seu e-mail ainda não foi confirmado.</span>
          <Button
            className="mt-3"
            variant="outline"
            disabled={sending}
            onClick={() => void resend()}
          >
            {sending ? 'Enviando…' : 'Reenviar confirmação'}
          </Button>
        </Alert>
      )}
      <Button asChild variant="outline">
        <Link href="/app/profile">Ver perfil</Link>
      </Button>
    </div>
  );
}
