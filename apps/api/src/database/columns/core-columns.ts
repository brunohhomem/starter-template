import { sql } from 'drizzle-orm';
import { boolean, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Colunas comuns a todas as entities:
 * - `id`: UUID v7 gerado pelo banco (Postgres 18 traz `uuidv7()` nativo),
 *   ordenável por tempo e seguro para exposição;
 * - `isActive`: exclusão lógica sem coluna `deleted_at`;
 * - `updatedAt`: mantido pelo Drizzle via `$onUpdate`, **não** pelo banco —
 *   SQL manual não atualiza esse campo.
 * Sem `organizationId`: o template é single-tenant (ADR 0001).
 */
export const coreColumns = {
  id: uuid('id')
    .primaryKey()
    .default(sql`uuidv7()`),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
