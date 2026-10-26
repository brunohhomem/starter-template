'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { FORGOT_PASSWORD_RESPONSE_MESSAGE, forgotPasswordRequestSchema } from '@starter/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { onFormSubmit } from '@/lib/submit-form';
import { applyApiError } from '@/lib/api-error';

type ForgotValues = {
  email: string;
};

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const form = useForm<ForgotValues>({
    resolver: zodResolver(forgotPasswordRequestSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: ForgotValues) {
    try {
      await api.post('/auth/password/forgot', values);
      setSent(true);
    } catch (error) {
      applyApiError(error, form.setError);
    }
  }

  if (sent) return <Alert>{FORGOT_PASSWORD_RESPONSE_MESSAGE}</Alert>;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={onFormSubmit(form.handleSubmit(onSubmit))}
      noValidate
    >
      <Field id="email" label="E-mail" error={form.formState.errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
      </Field>
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? 'Enviando…' : 'Enviar link'}
      </Button>
    </form>
  );
}
