'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { createInvitationRequestSchema, type UserRole } from '@starter/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { api } from '@/lib/api';
import { onFormSubmit } from '@/lib/submit-form';
import { applyApiError } from '@/lib/api-error';

type InviteValues = {
  email: string;
  role: UserRole;
};

type InviteUserDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function InviteUserDialog({ open, onOpenChange }: InviteUserDialogProps) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const form = useForm<InviteValues>({
    resolver: zodResolver(createInvitationRequestSchema),
    defaultValues: { email: '', role: 'user' },
  });

  async function onSubmit(values: InviteValues) {
    setPending(true);
    try {
      await api.post('/auth/invitations', values);
      toast.success('Convite enviado');
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      form.reset();
      onOpenChange(false);
    } catch (error) {
      applyApiError(error, form.setError);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Convidar usuário" description="O convidado recebe um link por e-mail.">
        <form
          className="flex flex-col gap-4"
          onSubmit={onFormSubmit(form.handleSubmit(onSubmit))}
          noValidate
        >
          <Field id="invite-email" label="E-mail" error={form.formState.errors.email?.message}>
            <Input
              id="invite-email"
              type="email"
              autoComplete="email"
              {...form.register('email')}
            />
          </Field>
          <Field id="invite-role" label="Papel" error={form.formState.errors.role?.message}>
            <NativeSelect id="invite-role" {...form.register('role')}>
              <option value="user">Usuário</option>
              <option value="admin">Administrador</option>
            </NativeSelect>
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Enviando…' : 'Enviar convite'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
