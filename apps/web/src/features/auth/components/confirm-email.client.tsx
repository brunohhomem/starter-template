'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/screen-state';
import { api } from '@/lib/api';
import { applyApiError } from '@/lib/api-error';

type ConfirmStatus = 'loading' | 'success' | 'error' | 'missing';

export function ConfirmEmail() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<ConfirmStatus>(token ? 'loading' : 'missing');

  useEffect(() => {
    if (!token) return;

    let active = true;

    async function confirm() {
      try {
        await api.post('/auth/email/confirm', { token });
        if (active) setStatus('success');
      } catch (error) {
        if (!active) return;
        applyApiError(error);
        setStatus('error');
      }
    }

    void confirm();

    return () => {
      active = false;
    };
  }, [token]);

  if (status === 'loading') return <LoadingState label="Confirmando e-mail…" />;
  if (status === 'success') {
    return (
      <div className="flex flex-col gap-3">
        <Alert>E-mail confirmado.</Alert>
        <Button asChild>
          <Link href="/app">Ir para a área logada</Link>
        </Button>
      </div>
    );
  }
  if (status === 'missing') {
    return <Alert>O link de confirmação está incompleto.</Alert>;
  }

  return (
    <Alert>Não foi possível confirmar este link. Ele pode ter expirado ou já ter sido usado.</Alert>
  );
}
