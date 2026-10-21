/**
 * Agrega as entities de cada módulo. Cada feature declara sua tabela no
 * próprio `*.entity.ts`; este arquivo é o único que o Drizzle e as
 * migrations conhecem, para que `drizzle(pool, { schema })` carregue todas
 * as relações.
 *
 * A F1 ainda não tem entities (a primeira, `system_settings`, entra na T7);
 * `users` e `sessions` são escopo da F2 e não podem existir aqui.
 */
export {};
