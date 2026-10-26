'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordRequestSchema, type AuthResponse } from '@starter/shared';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { onFormSubmit } from '@/lib/submit-form';
import { applyApiError } from '@/lib/api-error';
import { queryClient } from '@/lib/query-client';
import { ME_QUERY_KEY } from '../hooks/use-me';

type PasswordValues = {
  currentPassword: string;
  newPassword: string;
};

type PasswordFormProps = {
  onDone?: () => void;
};

export function PasswordForm({ onDone }: PasswordFormProps) {
  const form = useForm<PasswordValues>({
    resolver: zodResolver(changePasswordRequestSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });

  async function onSubmit(values: PasswordValues) {
    try {
      const response = await api.post<AuthResponse>('/auth/change-password', values);
      queryClient.setQueryData(ME_QUERY_KEY, response.data);
      await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      toast.success('Senha alterada');
      form.reset();
      onDone?.();
    } catch (error) {
      applyApiError(error, form.setError);
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={onFormSubmit(form.handleSubmit(onSubmit))}
      noValidate
    >
      <Field
        id="currentPassword"
        label="Senha atual"
        error={form.formState.errors.currentPassword?.message}
      >
        <Input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          {...form.register('currentPassword')}
        />
      </Field>
      <Field id="newPassword" label="Nova senha" error={form.formState.errors.newPassword?.message}>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          {...form.register('newPassword')}
        />
      </Field>
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? 'Salvando…' : 'Alterar senha'}
      </Button>
    </form>
  );
}
