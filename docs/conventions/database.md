# Banco de Dados

## CoreColumns

Todas as entities herdam `coreColumns` (em `apps/api/src/database/columns/core-columns.ts`):

| Coluna      | Tipo                       | Detalhes                                                                                                     |
| ----------- | -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `id`        | `uuid`                     | PK, `default(sql`uuidv7()`)` — Postgres 18 tem `uuidv7()` nativo; ordenável por tempo, seguro para exposição |
| `isActive`  | `boolean`                  | Não nulo, padrão `true`; exclusão lógica sem `deleted_at`                                                    |
| `createdAt` | `timestamp with time zone` | Não nulo, padrão `now()`                                                                                     |
| `updatedAt` | `timestamp with time zone` | Não nulo, padrão `now()`, **atualizado pelo Drizzle** via `.$onUpdate(() => new Date())`                     |

> **Importante:** `$onUpdate` é aplicado **pelo Drizzle**, não pelo banco. SQL manual (`UPDATE ... SET ...`) **não** atualiza `updatedAt`. Use o repository/Drizzle para alterações.

Sem `organizationId`: o template é single-tenant (ADR 0001).

## UUID v7

O Postgres 18 traz `uuidv7()` nativo. A coluna `id` usa `default(sql`uuidv7()`)` e a prova de integração verifica `uuid_extract_version(id) = 7`.

## Migrations

- **Ferramenta:** `drizzle-kit` (dev) + migrator programático do `drizzle-orm` (runtime, `db:migrate`).
- **Pasta:** `apps/api/src/database/migrations/`.
- **Nomes:** a versão instalada do `drizzle-kit` nomeia como `0000_nome_da_migration.sql` (timestamp numérico + nome informado no `--name`). A ordenação é cronológica.
- **Wrapper `db:generate`:** exige nome no padrão `<verbo>_<objeto>[_<detalhe>]` (ex.: `create_users`, `add_avatar_to_people`). Verbos: `create`, `add`, `remove`, `rename`, `alter`, `drop`, `backfill`.
- **Sem `db:push`:** decisão deliberada — só migrations versionadas. `db:push` ignora histórico e não serve para deploy.

### Prova de atomicidade (T6)

Teste em `apps/api/test/migration-atomicity.int-spec.ts`: cria migration temporária com dois statements — o primeiro cria tabela, o segundo falha (insere em tabela inexistente). Após `db:migrate`, **o primeiro statement NÃO está aplicado**. Rollback é atômico; o ADR depende disso.

## Repository como única porta de acesso

- Controller **não** importa `drizzle-orm` nem `*.repository`.
- Service **não** importa `drizzle-orm`.
- Só `*.repository.ts` fala com o Drizzle.

## Banco de teste e `resetDatabase()`

- Variável `TEST_DB_NAME` **deve terminar em `_test`** (trava de segurança em `integration-setup.ts` e `integration-setup-env.ts`). Impede truncar o banco de desenvolvimento por engano.
- `setupTestDatabase()`: conecta ao banco `postgres`, cria `TEST_DB_NAME` se não existir, roda migrations.
- `resetDatabase()`: lista tabelas do schema `public` via `pg_tables`, executa `TRUNCATE ... RESTART IDENTITY CASCADE`, **excluindo `drizzle_migrations`**. Nenhuma tabela citada à mão.
- `createTestApp()`: monta app de teste com `configureApp` (T8) e `TestAppModule` (substitui `DatabaseModule` por `TestDatabaseModule` que usa o pool compartilhado).

## Configuração de conexão

Única fonte: `buildDatabaseConfig(env)` em `apps/api/src/database/database-config.ts`. Usa componentes `DB_*` (não URL) para evitar problemas de escape de senha. Consumida pelo app, scripts (`db-generate`, `db-migrate`, `db-studio`) e `drizzle.config.ts`.
