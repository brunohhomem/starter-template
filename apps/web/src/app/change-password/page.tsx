import { AuthFrame } from '@/components/layout/auth-frame';
import { ChangePasswordScreen } from '@/features/auth/components/change-password-screen.client';

export const metadata = { title: 'Alterar senha' };

export default function ChangePasswordPage() {
  return (
    <AuthFrame title="Alterar senha" description="Informe a senha atual e escolha uma nova.">
      <ChangePasswordScreen />
    </AuthFrame>
  );
}
