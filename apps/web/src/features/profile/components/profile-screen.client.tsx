'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { fullNameSchema, type ProfileResponse } from '@starter/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from '@starter/shared/zod';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { MaskedInput } from '@/components/ui/masked-input';
import { Button } from '@/components/ui/button';
import { ErrorState, LoadingState } from '@/components/ui/screen-state';
import { PasswordForm } from '@/features/auth/components/password-form.client';
import { contactPayload, optionalCpf, optionalPhone } from '@/features/auth/schemas/forms';
import { api } from '@/lib/api';
import { onFormSubmit } from '@/lib/submit-form';
import { applyApiError } from '@/lib/api-error';
import { formatCpf, formatPhone } from '@/lib/masks';

const profileFormSchema = z.object({
  fullName: fullNameSchema,
  cpf: optionalCpf,
  phone: optionalPhone,
});

type ProfileValues = {
  fullName: string;
  cpf: string;
  phone: string;
};

const PROFILE_QUERY_KEY = ['profile'] as const;

async function fetchProfile(): Promise<ProfileResponse> {
  const response = await api.get<ProfileResponse>('/me/profile');
  return response.data;
}

export function ProfileScreen() {
  const profile = useQuery({ queryKey: PROFILE_QUERY_KEY, queryFn: fetchProfile });
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { fullName: '', cpf: '', phone: '' },
  });

  useEffect(() => {
    if (!profile.data) return;
    form.reset({
      fullName: profile.data.fullName,
      cpf: profile.data.cpf ? formatCpf(profile.data.cpf) : '',
      phone: profile.data.phone ? formatPhone(profile.data.phone) : '',
    });
  }, [profile.data, form]);

  const save = useMutation({
    mutationFn: async (values: ProfileValues) => {
      const body = {
        fullName: values.fullName,
        ...contactPayload(values.cpf, values.phone),
      };
      const response = await api.patch<ProfileResponse>('/me/profile', body);
      return response.data;
    },
    onSuccess: async (data) => {
      toast.success('Perfil atualizado');
      await profile.refetch();
      form.reset({
        fullName: data.fullName,
        cpf: data.cpf ? formatCpf(data.cpf) : '',
        phone: data.phone ? formatPhone(data.phone) : '',
      });
    },
    onError: (error) => applyApiError(error, form.setError),
  });

  if (profile.isPending) return <LoadingState />;
  if (profile.isError || !profile.data) {
    return (
      <ErrorState
        title="Não foi possível carregar o perfil"
        description="Tente de novo."
        onRetry={() => void profile.refetch()}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full flex-col gap-6 md:w-[40rem]">
      <PageHeader title="Perfil" description="Dados pessoais e senha." />
      <Card>
        <CardHeader>
          <CardTitle>Dados pessoais</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={onFormSubmit(
              form.handleSubmit((values) => {
                save.mutate(values);
              }),
            )}
            noValidate
          >
            <Field id="email" label="E-mail">
              <Input id="email" value={profile.data.email} readOnly />
            </Field>
            <Field
              id="fullName"
              label="Nome completo"
              error={form.formState.errors.fullName?.message}
            >
              <Input id="fullName" autoComplete="name" {...form.register('fullName')} />
            </Field>
            <MaskedInput
              id="cpf"
              name="cpf"
              label="CPF"
              control={form.control}
              error={form.formState.errors.cpf?.message}
              autoComplete="off"
              format={formatCpf}
            />
            <MaskedInput
              id="phone"
              name="phone"
              label="Telefone"
              control={form.control}
              error={form.formState.errors.phone?.message}
              autoComplete="tel"
              format={formatPhone}
            />
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Senha</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
