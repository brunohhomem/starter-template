import Link from 'next/link';
import { AuthFrame } from '@/components/layout/auth-frame';
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form.client';

export const metadata = { title: 'Esqueci a senha' };

export default function ForgotPasswordPage() {
  return (
    <AuthFrame
      title="Esqueci a senha"
      description="Enviaremos um link se o e-mail estiver cadastrado."
    >
      <div className="flex flex-col gap-4">
        <ForgotPasswordForm />
        <Link href="/login" className="inline-flex h-11 items-center text-sm">
          Voltar ao login
        </Link>
      </div>
    </AuthFrame>
  );
}
