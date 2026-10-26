import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { StatusPage } from '@/components/ui/screen-state';

export const metadata = { title: 'Acesso negado' };

export default function ForbiddenPage() {
  return (
    <StatusPage title="Acesso negado" description="Você não tem permissão para ver esta página.">
      <Button asChild>
        <Link href="/">Voltar ao início</Link>
      </Button>
    </StatusPage>
  );
}
