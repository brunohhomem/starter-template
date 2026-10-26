import { AUTH_ERROR_MESSAGES, PEOPLE_ERROR_CODES, type ErrorResponse } from '@starter/shared';
import axios from 'axios';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { toast } from 'sonner';

const CODE_MESSAGES: Record<string, string> = {
  ...AUTH_ERROR_MESSAGES,
  [PEOPLE_ERROR_CODES.PEOPLE_CPF_TAKEN]: 'Este CPF já está cadastrado',
  [PEOPLE_ERROR_CODES.USERS_NOT_FOUND]: 'Usuário não encontrado',
  [PEOPLE_ERROR_CODES.USERS_SELF_CHANGE_FORBIDDEN]: 'Você não pode alterar a própria conta',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readErrorBody(error: unknown): ErrorResponse | undefined {
  if (!axios.isAxiosError(error)) return undefined;
  const data: unknown = error.response?.data;
  if (!isRecord(data)) return undefined;
  if (typeof data.message !== 'string') return undefined;
  return data as ErrorResponse;
}

export function applyApiError<T extends FieldValues>(
  error: unknown,
  setError?: UseFormSetError<T>,
): void {
  const body = readErrorBody(error);
  const details = body?.details ?? [];
  let appliedField = false;

  if (setError) {
    for (const detail of details) {
      const field = detail.path[0];
      if (typeof field !== 'string') continue;
      setError(field as Path<T>, { message: detail.message });
      appliedField = true;
    }
  }

  if (appliedField) return;

  const code = body?.code;
  if (code && CODE_MESSAGES[code]) {
    toast.error(CODE_MESSAGES[code]);
    return;
  }

  const requestId = body?.requestId ? ` (${body.requestId})` : '';
  toast.error(`Não foi possível concluir a ação${requestId}`);
}
