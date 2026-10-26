import { pgTable, text, uuid, uniqueIndex } from 'drizzle-orm/pg-core';
import { coreColumns } from '../../database/columns/core-columns';
import { users } from '../auth/user.entity';

export const people = pgTable(
  'people',
  {
    ...coreColumns,
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    fullName: text('full_name').notNull(),
    cpf: text('cpf'),
    phone: text('phone'),
  },
  (table) => ({
    userIdIdx: uniqueIndex('people_user_id_idx').on(table.userId),
    cpfIdx: uniqueIndex('people_cpf_idx').on(table.cpf),
  }),
);

export type Person = typeof people.$inferSelect;
export type NewPerson = typeof people.$inferInsert;
