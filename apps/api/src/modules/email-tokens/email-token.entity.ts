import { pgEnum, pgTable, text, timestamp, uuid, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { coreColumns } from '../../database/columns/core-columns';
import { users } from '../auth/user.entity';

export const emailTokenTypeEnum = pgEnum('email_token_type', [
  'email_confirmation',
  'password_reset',
  'invite',
]);

export const emailTokens = pgTable(
  'email_tokens',
  {
    ...coreColumns,
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: emailTokenTypeEnum('type').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
  },
  (table) => ({
    tokenHashIdx: uniqueIndex('email_tokens_token_hash_idx').on(table.tokenHash),
    userIdIdx: index('email_tokens_user_id_idx').on(table.userId),
    expiresAtIdx: index('email_tokens_expires_at_idx').on(table.expiresAt),
  }),
);

export type EmailToken = typeof emailTokens.$inferSelect;
export type NewEmailToken = typeof emailTokens.$inferInsert;
