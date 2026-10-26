import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { StatusPage } from '@/components/ui/screen-state';

export default function NotFound() {
  return (
    <StatusPage title="Página não encontrada" description="O endereço não existe neste template.">
      <Button asChild>
        <Link href="/">Voltar ao início</Link>
      </Button>
    </StatusPage>
  );
}
