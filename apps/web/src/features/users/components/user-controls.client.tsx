'use client';

import type { UserRole } from '@starter/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { api } from '@/lib/api';
import { applyApiError } from '@/lib/api-error';

type RoleControlProps = {
  userId: string;
  role: UserRole;
  disabled: boolean;
};

export function RoleControl({ userId, role, disabled }: RoleControlProps) {
  const queryClient = useQueryClient();
  const [nextRole, setNextRole] = useState<UserRole>(role);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    try {
      await api.patch(`/users/${userId}/role`, { role: nextRole });
      toast.success('Papel atualizado');
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (error) {
      applyApiError(error);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
      <NativeSelect
        aria-label="Papel"
        value={nextRole}
        disabled={disabled || pending}
        onChange={(event) => setNextRole(event.target.value as UserRole)}
      >
        <option value="user">Usuário</option>
        <option value="admin">Administrador</option>
      </NativeSelect>
      <Button disabled={disabled || pending || nextRole === role} onClick={() => void save()}>
        Alterar papel
      </Button>
    </div>
  );
}

type StatusControlProps = {
  userId: string;
  isActive: boolean;
  disabled: boolean;
};

export function StatusControl({ userId, isActive, disabled }: StatusControlProps) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    try {
      await api.patch(`/users/${userId}/status`, { isActive: !isActive });
      toast.success(isActive ? 'Usuário desativado' : 'Usuário ativado');
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (error) {
      applyApiError(error);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="outline" disabled={disabled || pending} onClick={() => void toggle()}>
      {isActive ? 'Desativar' : 'Ativar'}
    </Button>
  );
}
