import {
  AUTH_ERROR_CODES,
  AUTH_ERROR_MESSAGES,
  PEOPLE_ERROR_CODES,
  errorResponseSchema,
  type ErrorResponse,
} from '@starter/shared';
import axios from 'axios';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { toast } from 'sonner';

const CODE_MESSAGES: Record<string, string> = {
  ...AUTH_ERROR_MESSAGES,
  [PEOPLE_ERROR_CODES.PEOPLE_CPF_TAKEN]: 'Este CPF já está cadastrado',
  [PEOPLE_ERROR_CODES.USERS_NOT_FOUND]: 'Usuário não encontrado',
  [PEOPLE_ERROR_CODES.USERS_SELF_CHANGE_FORBIDDEN]: 'Você não pode alterar a própria conta',
};

const FIELD_BY_CODE: Record<string, string> = {
  [PEOPLE_ERROR_CODES.PEOPLE_CPF_TAKEN]: 'cpf',
  [AUTH_ERROR_CODES.AUTH_EMAIL_TAKEN]: 'email',
  [AUTH_ERROR_CODES.AUTH_INVITE_EMAIL_TAKEN]: 'email',
};

function readErrorBody(error: unknown): ErrorResponse | undefined {
  if (!axios.isAxiosError(error)) return undefined;
  const parsed = errorResponseSchema.safeParse(error.response?.data);
  if (!parsed.success) return undefined;
  return parsed.data;
}

function applyConflictField<T extends FieldValues>(
  body: ErrorResponse,
  setError: UseFormSetError<T>,
): boolean {
  if (!body.code) return false;
  const field = FIELD_BY_CODE[body.code];
  if (!field) return false;
  setError(field as Path<T>, { message: CODE_MESSAGES[body.code] ?? body.message });
  return true;
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
  if (body && setError && applyConflictField(body, setError)) return;

  const code = body?.code;
  if (code && CODE_MESSAGES[code]) {
    toast.error(CODE_MESSAGES[code]);
    return;
  }

  const requestId = body?.requestId ? ` (${body.requestId})` : '';
  toast.error(`Não foi possível concluir a ação${requestId}`);
}
