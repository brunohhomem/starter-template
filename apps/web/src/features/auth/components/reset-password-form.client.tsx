'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { onFormSubmit } from '@/lib/submit-form';
import { applyApiError } from '@/lib/api-error';
import { resetPasswordFormSchema } from '../schemas/forms';

type ResetValues = {
  newPassword: string;
};

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [done, setDone] = useState(false);
  const form = useForm<ResetValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { newPassword: '' },
  });

  async function onSubmit(values: ResetValues) {
    if (!token) return;
    try {
      await api.post('/auth/password/reset', { token, newPassword: values.newPassword });
      setDone(true);
    } catch (error) {
      applyApiError(error, form.setError);
    }
  }

  if (!token) {
    return <Alert>O link de redefinição está incompleto. Peça um novo e-mail.</Alert>;
  }

  if (done) {
    return (
      <div className="flex flex-col gap-3">
        <Alert>Senha redefinida. Entre com a senha nova.</Alert>
        <Button asChild>
          <Link href="/login">Ir para o login</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={onFormSubmit(form.handleSubmit(onSubmit))}
      noValidate
    >
      <Field id="newPassword" label="Nova senha" error={form.formState.errors.newPassword?.message}>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          {...form.register('newPassword')}
        />
      </Field>
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? 'Salvando…' : 'Redefinir senha'}
      </Button>
    </form>
  );
}
