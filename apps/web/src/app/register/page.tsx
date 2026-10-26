import { AuthFrame } from '@/components/layout/auth-frame';
import { RegisterForm } from '@/features/auth/components/register-form.client';

export const metadata = { title: 'Criar conta' };

export default function RegisterPage() {
  return (
    <AuthFrame
      title="Criar conta"
      description="Nome, e-mail e senha. CPF e telefone são opcionais."
    >
      <RegisterForm />
    </AuthFrame>
  );
}
