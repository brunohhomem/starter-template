import {
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
  index,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { coreColumns } from '../../database/columns/core-columns';
import { users } from './user.entity';

export const sessions = pgTable(
  'sessions',
  {
    ...coreColumns,
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    familyId: uuid('family_id').notNull(),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    replacedBySessionId: uuid('replaced_by_session_id'),
    userAgent: text('user_agent'),
    ip: text('ip'),
  },
  (table) => ({
    refreshTokenHashIdx: uniqueIndex('sessions_refresh_token_hash_idx').on(table.refreshTokenHash),
    userIdIdx: index('sessions_user_id_idx').on(table.userId),
    familyIdIdx: index('sessions_family_id_idx').on(table.familyId),
    expiresAtIdx: index('sessions_expires_at_idx').on(table.expiresAt),
    replacedByIdx: index('sessions_replaced_by_idx').on(table.replacedBySessionId),
  }),
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
