import * as zod from 'zod';

export const roleSchema = zod.enum(['admin', 'user']);

export type Role = zod.infer<typeof roleSchema>;

export const Role = {
  admin: 'admin',
  user: 'user',
} as const;
