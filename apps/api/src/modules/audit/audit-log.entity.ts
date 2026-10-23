import { pgTable, text, uuid, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { coreColumns } from '../../database/columns/core-columns';
import { users } from '../auth/user.entity';

export const auditLogs = pgTable(
  'audit_logs',
  {
    ...coreColumns,
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    metadata: jsonb('metadata')
      .notNull()
      .default(sql`'{}'::jsonb`),
    ip: text('ip'),
  },
  (table) => ({
    actorUserIdIdx: index('audit_logs_actor_user_id_idx').on(table.actorUserId),
    actionIdx: index('audit_logs_action_idx').on(table.action),
  }),
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
