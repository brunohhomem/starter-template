import { Suspense } from 'react';
import { AuthFrame } from '@/components/layout/auth-frame';
import { LoadingState } from '@/components/ui/screen-state';
import { AcceptInviteForm } from '@/features/auth/components/accept-invite-form.client';

export const metadata = { title: 'Aceitar convite' };

export default function AcceptInvitePage() {
  return (
    <AuthFrame title="Aceitar convite" description="Defina seu nome e uma senha para entrar.">
      <Suspense fallback={<LoadingState />}>
        <AcceptInviteForm />
      </Suspense>
    </AuthFrame>
  );
}
