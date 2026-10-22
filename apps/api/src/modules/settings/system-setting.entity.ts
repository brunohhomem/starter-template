import { pgTable, text, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';
import { coreColumns } from '../../database/columns/core-columns';

/**
 * Configurações de sistema chave-valor. Cada chave é única e o valor é JSONB
 * para suportar tipos estruturados (strings, números, booleanos, objetos, arrays).
 */
export const systemSettings = pgTable(
  'system_settings',
  {
    ...coreColumns,
    key: text('key').notNull(),
    value: jsonb('value').notNull(),
  },
  (table) => ({
    keyIdx: uniqueIndex('system_settings_key_idx').on(table.key),
  }),
);

export type SystemSetting = typeof systemSettings.$inferSelect;
export type NewSystemSetting = typeof systemSettings.$inferInsert;
