import { z } from './zod';
import { paginationQuerySchema, paginatedResponseSchema } from './pagination';
import { fullNameSchema, cpfSchema, phoneSchema } from './auth/schemas';
import { USER_ROLES } from './auth/schemas';

export const profileResponseSchema = z.object({
  email: z.string(),
  role: z.enum(USER_ROLES),
  emailVerified: z.boolean(),
  fullName: z.string(),
  cpf: z.string().nullable(),
  phone: z.string().nullable(),
});

export const updateProfileRequestSchema = z
  .object({
    fullName: fullNameSchema.optional(),
    cpf: cpfSchema.optional(),
    phone: phoneSchema.optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Pelo menos um campo deve ser fornecido',
  });

export const userListItemSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  fullName: z.string().nullable(),
  role: z.enum(USER_ROLES),
  isActive: z.boolean(),
  emailVerified: z.boolean(),
  lastLoginAt: z.string().nullable(),
});

export const usersQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
});

export const usersListResponseSchema = paginatedResponseSchema(userListItemSchema);

export const updateUserRoleRequestSchema = z.object({
  role: z.enum(USER_ROLES),
});

export const updateUserStatusRequestSchema = z.object({
  isActive: z.boolean(),
});

export const PEOPLE_ERROR_CODES = {
  PEOPLE_CPF_TAKEN: 'PEOPLE_CPF_TAKEN',
  USERS_NOT_FOUND: 'USERS_NOT_FOUND',
  USERS_SELF_CHANGE_FORBIDDEN: 'USERS_SELF_CHANGE_FORBIDDEN',
} as const;

export type PeopleErrorCode = (typeof PEOPLE_ERROR_CODES)[keyof typeof PEOPLE_ERROR_CODES];

export type ProfileResponse = z.infer<typeof profileResponseSchema>;
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;
export type UserListItem = z.infer<typeof userListItemSchema>;
export type UsersQuery = z.infer<typeof usersQuerySchema>;
export type UsersListResponse = z.infer<typeof usersListResponseSchema>;
export type UpdateUserRoleRequest = z.infer<typeof updateUserRoleRequestSchema>;
export type UpdateUserStatusRequest = z.infer<typeof updateUserStatusRequestSchema>;
