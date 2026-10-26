'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { loginRequestSchema, type AuthResponse } from '@starter/shared';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { onFormSubmit } from '@/lib/submit-form';
import { applyApiError } from '@/lib/api-error';
import { queryClient } from '@/lib/query-client';
import { ME_QUERY_KEY } from '../hooks/use-me';
import { safeAppPath } from '../lib/next-path';
import { usePublicSettings } from '@/features/settings/hooks/use-public-settings';

type LoginValues = {
  email: string;
  password: string;
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const settings = usePublicSettings();
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: LoginValues) {
    try {
      const response = await api.post<AuthResponse>('/auth/login', values);
      queryClient.setQueryData(ME_QUERY_KEY, response.data);
      await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      if (response.data.user.mustChangePassword) {
        router.push('/change-password');
        return;
      }
      router.push(safeAppPath(searchParams.get('next')));
    } catch (error) {
      applyApiError(error, form.setError);
    }
  }

  const registrationEnabled = settings.data?.registrationEnabled === true;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={onFormSubmit(form.handleSubmit(onSubmit))}
      noValidate
    >
      <Field id="email" label="E-mail" error={form.formState.errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(form.formState.errors.email)}
          {...form.register('email')}
        />
      </Field>
      <Field id="password" label="Senha" error={form.formState.errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(form.formState.errors.password)}
          {...form.register('password')}
        />
      </Field>
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? 'Entrando…' : 'Entrar'}
      </Button>
      <div className="flex flex-col gap-2 text-sm">
        <Link href="/forgot-password" className="inline-flex h-11 items-center">
          Esqueci a senha
        </Link>
        {registrationEnabled ? (
          <Link href="/register" className="inline-flex h-11 items-center">
            Criar conta
          </Link>
        ) : null}
      </div>
    </form>
  );
}
