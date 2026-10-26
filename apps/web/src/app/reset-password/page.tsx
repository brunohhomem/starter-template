import { Suspense } from 'react';
import { AuthFrame } from '@/components/layout/auth-frame';
import { LoadingState } from '@/components/ui/screen-state';
import { ResetPasswordForm } from '@/features/auth/components/reset-password-form.client';

export const metadata = { title: 'Redefinir senha' };

export default function ResetPasswordPage() {
  return (
    <AuthFrame title="Redefinir senha" description="Escolha uma senha nova para a conta.">
      <Suspense fallback={<LoadingState />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthFrame>
  );
}
