import { Suspense } from 'react';
import { AuthFrame } from '@/components/layout/auth-frame';
import { LoadingState } from '@/components/ui/screen-state';
import { ConfirmEmail } from '@/features/auth/components/confirm-email.client';

export const metadata = { title: 'Confirmar e-mail' };

export default function ConfirmEmailPage() {
  return (
    <AuthFrame title="Confirmar e-mail" description="Estamos validando o link que você abriu.">
      <Suspense fallback={<LoadingState />}>
        <ConfirmEmail />
      </Suspense>
    </AuthFrame>
  );
}
