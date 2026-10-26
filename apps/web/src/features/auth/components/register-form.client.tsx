'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { AuthResponse } from '@starter/shared';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { MaskedInput } from '@/components/ui/masked-input';
import { ErrorState, LoadingState } from '@/components/ui/screen-state';
import { usePublicSettings } from '@/features/settings/hooks/use-public-settings';
import { api } from '@/lib/api';
import { onFormSubmit } from '@/lib/submit-form';
import { applyApiError } from '@/lib/api-error';
import { formatCpf, formatPhone } from '@/lib/masks';
import { queryClient } from '@/lib/query-client';
import { ME_QUERY_KEY } from '../hooks/use-me';
import { contactPayload, registerFormSchema } from '../schemas/forms';

type RegisterValues = {
  fullName: string;
  email: string;
  password: string;
  cpf: string;
  phone: string;
};

export function RegisterForm() {
  const router = useRouter();
  const settings = usePublicSettings();
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { fullName: '', email: '', password: '', cpf: '', phone: '' },
  });

  async function onSubmit(values: RegisterValues) {
    try {
      const response = await api.post<AuthResponse>('/auth/register', {
        fullName: values.fullName,
        email: values.email,
        password: values.password,
        ...contactPayload(values.cpf, values.phone),
      });
      queryClient.setQueryData(ME_QUERY_KEY, response.data);
      await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      toast.success('Conta criada. Confirme o e-mail pelo link que enviamos.');
      router.push('/app');
    } catch (error) {
      applyApiError(error, form.setError);
    }
  }

  if (settings.isPending) return <LoadingState />;
  if (settings.isError) {
    return (
      <ErrorState
        title="Não foi possível carregar o cadastro"
        description="Tente de novo em instantes."
        onRetry={() => void settings.refetch()}
      />
    );
  }
  if (!settings.data.registrationEnabled) {
    return <Alert>O cadastro de novas contas está desligado.</Alert>;
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={onFormSubmit(form.handleSubmit(onSubmit))}
      noValidate
    >
      <Field id="fullName" label="Nome completo" error={form.formState.errors.fullName?.message}>
        <Input id="fullName" autoComplete="name" {...form.register('fullName')} />
      </Field>
      <Field id="email" label="E-mail" error={form.formState.errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
      </Field>
      <Field id="password" label="Senha" error={form.formState.errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          {...form.register('password')}
        />
      </Field>
      <MaskedInput
        id="cpf"
        name="cpf"
        label="CPF (opcional)"
        control={form.control}
        error={form.formState.errors.cpf?.message}
        autoComplete="off"
        format={formatCpf}
      />
      <MaskedInput
        id="phone"
        name="phone"
        label="Telefone (opcional)"
        control={form.control}
        error={form.formState.errors.phone?.message}
        autoComplete="tel"
        format={formatPhone}
      />
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? 'Criando…' : 'Criar conta'}
      </Button>
    </form>
  );
}
