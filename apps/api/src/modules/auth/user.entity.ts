import {
  pgTable,
  text,
  boolean,
  timestamp,
  uuid,
  pgEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { coreColumns } from '../../database/columns/core-columns';

export const userRoleEnum = pgEnum('user_role', ['admin', 'user']);

export const users = pgTable(
  'users',
  {
    ...coreColumns,
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: userRoleEnum('role').notNull().default('user'),
    isActive: boolean('is_active').notNull().default(true),
    mustChangePassword: boolean('must_change_password').notNull().default(false),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  },
  (table) => ({
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
