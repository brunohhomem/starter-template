import { Role } from '@starter/shared';

export function isAdmin(role: Role): boolean {
  return role === Role.admin;
}
