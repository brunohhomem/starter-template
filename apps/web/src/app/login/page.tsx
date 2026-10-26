import { Suspense } from 'react';
import { AuthFrame } from '@/components/layout/auth-frame';
import { LoadingState } from '@/components/ui/screen-state';
import { LoginForm } from '@/features/auth/components/login-form.client';

export const metadata = { title: 'Entrar' };

export default function LoginPage() {
  return (
    <AuthFrame title="Entrar" description="Use o e-mail e a senha da sua conta.">
      <Suspense fallback={<LoadingState />}>
        <LoginForm />
      </Suspense>
    </AuthFrame>
  );
}
