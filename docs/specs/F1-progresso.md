# Progresso da F1

Arquivo de controle da execução da spec `docs/specs/F1-banco-e-base-da-api.md`.
Regras de uso: seção 3.1 da spec. **Numeração fixa: T1 a T16 da spec, sem renumerar.**
Ao retomar, leia este arquivo e continue da primeira tarefa não concluída, sem pedir confirmação.

## Situação das tarefas

| T (spec) | Tarefa                                               | Status    | Commit    | Observações                                                                                                                                                                                                                                                                                                   |
| -------- | ---------------------------------------------------- | --------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1       | Compose de desenvolvimento                           | feita     | `58782dd` | Aceite reconferido na Definição de Pronto                                                                                                                                                                                                                                                                     |
| T2       | `keys:generate` e `keys:rotate`                      | feita     | `41c0b6d` | Aceite reconferido na Definição de Pronto                                                                                                                                                                                                                                                                     |
| T3       | Validação de ambiente na API                         | feita     | `977b924` | Aceite reconferido na Definição de Pronto                                                                                                                                                                                                                                                                     |
| **T4**   | **`packages/shared`: contratos de erro e paginação** | **feita** | `4a81d62` | `errorResponseSchema`, `paginationQuerySchema`, `paginatedResponseSchema`, `buildPageMeta` criados com testes. Commit: 4a81d62                                                                                                                                                                                |
| T5       | Módulo de banco e `coreColumns`                      | feita     | `768fde5` | `uuid_extract_version(id)=7`, `timestamptz`, `updatedAt` muda via Drizzle, `buildDatabaseConfig` único; testes em `database.int-spec.ts`                                                                                                                                                                      |
| T6       | Migrations nomeadas                                  | feita     | `3de99b5` | Prova de atomicidade passa (migration quebrada não aplica statement anterior); drizzle-kit nomeia como `0000_name.sql`; testes em `migration-atomicity.int-spec.ts`                                                                                                                                           |
| T7       | Entity `system_settings`                             | feita     | `00871ca` |                                                                                                                                                                                                                                                                                                               |
| T8       | Bootstrap compartilhado `configureApp`               | feita     | `52d4a2c` |                                                                                                                                                                                                                                                                                                               |
| T9       | Logs estruturados                                    | feita     | `b1e5cc0` | Request ID válido/inválido/ausente, redação, formato por ambiente, `/api/health` fora do log; testes em `logger-options.spec.ts` e `logging.int-spec.ts`                                                                                                                                                      |
| T10      | Validação e erros padronizados                       | feita     | `1c1047f` | `ZodValidationPipe` global, `AllExceptionsFilter` global, `ZodSerializerInterceptor`; resposta segue `errorResponseSchema` do shared                                                                                                                                                                          |
| T11      | Módulo de Redis                                      | feita     | `f8e95c5` | `RedisModule.forRoot()` com ioredis, token `REDIS`, `OnApplicationShutdown` encerra conexão; BullMQ usará conexões próprias depois                                                                                                                                                                            |
| T12      | Health                                               | feita     | `39cfc3c` | `GET /api/health` pública, verifica banco (SELECT 1) e Redis (PING) com timeout 3s; resposta mínima `{status, version}`; 200/503 sem detalhes                                                                                                                                                                 |
| T13      | Swagger                                              | feita     | `d7c2440` | `/api/docs` condicional a `SWAGGER_ENABLED`; passa por `cleanupOpenApiDoc`; health documentado com `@ApiResponse`                                                                                                                                                                                             |
| T14      | Infraestrutura de testes de integração               | feita     | `9890a14` | Vitest + SWC para ESM (NestJS 12); `createTestApp`/`resetDatabase`/`closeTestApp`; banco `_test`; health.int-spec.ts com 2 testes                                                                                                                                                                             |
| T15      | CI: job de integração                                | feita     | `731c2c0` | Job `integration` separado do `verify`; ubuntu-24.04, postgres:18.1 + redis com healthcheck; roda `pnpm keys:generate` + `pnpm turbo run test:integration`; cache Turbo compartilhado                                                                                                                         |
| T16      | Documentação                                         | feita     | `56bf064` | `database.md` (coreColumns, UUID v7, migrations, atomicidade, repository), `backend.md` (configureApp, ENV, erros, logs, health), `testing.md` (Vitest integração, createTestApp), `AGENTS.md` (comandos novos, database.md), `README.md` (como subir), `CHANGELOG.md` (versões, ajuste fase system_settings) |

## Commits auxiliares

| Commit    | Assunto                                                      | Conferir                                                                                                              |
| --------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `cdebfd9` | Removeu entities da F2 (`users`, `sessions`) do escopo da F1 | Confirmar que **não restou nada** de `users`/`sessions`: arquivos, migrations geradas, journal e snapshots do Drizzle |
| `b57d258` | Removeu `eslint-disable` redundante dos scripts de chaves    | —                                                                                                                     |
| `384069a` | Limpeza das fixtures do lint                                 | —                                                                                                                     |

## Ordem de execução a partir de agora

1. T4
2. T10
3. T11
4. T12
5. T13
6. T14
7. T15
8. T16
9. Executar os aceites pendentes (T5, T6, T9) e conferir os commits auxiliares
10. Definição de Pronto (seção 11 da spec), push, PR e relatório (seção 12)

## Decisões tomadas

| Data       | Decisão                                                                                                         | Motivo                                                                                                                                                                                                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-21 | T4: schemas de erro e paginação em `packages/shared/src/error.ts` e `pagination.ts`                             | Segue a especificação da T4; tipos inferidos com zod; `paginatedResponseSchema` é factory que aceita schema do item; testes cobrem parsing, validação e tipos                                                                                                                      |
| 2026-10-21 | T10: `ZodValidationPipe` + `AllExceptionsFilter` + `ZodSerializerInterceptor` global                            | `nestjs-zod` fornece `ZodValidationException` com `details` por campo; filtro mapeia HttpException→400, outros→500 sem stack em produção; `requestId` em toda resposta                                                                                                             |
| 2026-10-21 | T11: `RedisModule.forRoot()` com ioredis, connection lazy, `OnApplicationShutdown`                              | Segue spec: token `REDIS`, config por `REDIS_*`, mesma conexão para health/throttler; BullMQ terá conexões próprias com `maxRetriesPerRequest: null`                                                                                                                               |
| 2026-10-21 | T12: Health controller sem @nestjs/terminus, resposta mínima manual                                             | Spec exige resposta mínima sem detalhes; terminus retorna estrutura verbosa; implementação direta com HttpException para 503 é mais simples e atende ao contrato                                                                                                                   |
| 2026-10-21 | T13: Swagger já configurado em `configureSwagger`; health usa `@ApiResponse`                                    | `configureSwagger` já existia; `@ZodResponse` do nestjs-zod não aceita schema customizado; `@ApiResponse` do @nestjs/swagger funciona para documentar respostas 200/503                                                                                                            |
| 2026-10-21 | T14: Vitest + SWC para testes de integração (NestJS 12 é ESM-only); Jest mantido para unitários                 | Jest não suporta ESM nativamente no Node 22; Vitest suporta ESM nativamente; SWC transforma decorators; `createTestApp` usa TestAppModule com TestDatabaseModule; `resetDatabase` trunca tabelas via `pg_tables`                                                                   |
| 2026-10-21 | T5: `coreColumns` com UUID v7 via `uuidv7()` nativo do PG 18, `timestamptz`, `$onUpdate` do Drizzle             | PG 18 tem `uuidv7()` nativo; `$onUpdate` é aplicação, não trigger DB; `buildDatabaseConfig` única fonte usada por app/scripts/drizzle.config                                                                                                                                       |
| 2026-10-21 | T6: Atomicidade de migration comprovada via teste; drizzle-kit nomeia `0000_name.sql` (timestamp + nome)        | Teste cria migration quebrada (2º statement falha); 1º statement NÃO é aplicado → rollback atômico; arquivos ordenados cronologicamente                                                                                                                                            |
| 2026-10-21 | T9: Logs com request ID (header `x-request-id`), redação de credenciais, formato por ambiente                   | `nestjs-pino` + `pino-http`; `genReqId` valida/gera UUID; `redact` remove headers/body sensíveis; `autoLogging.ignore` exclui `/api/health`                                                                                                                                        |
| 2026-10-21 | T15: Job `integration` separado no CI; ubuntu-24.04, postgres:18.1, redis; `keys:generate` + `test:integration` | Segue spec T15: job separado do `verify`; cache Turbo compartilhado; serviços com healthcheck; exercita `keys:generate` no CI                                                                                                                                                      |
| 2026-10-21 | T16: Documentação consolidada em `docs/conventions/` + `AGENTS.md` + `README.md` + `CHANGELOG.md`               | `database.md` detalha coreColumns, UUID v7, migrations, atomicidade; `backend.md` adiciona configureApp, ENV, erros, logs, health; `testing.md` documenta Vitest integração; `README.md` tem passos "Como subir"; `CHANGELOG.md` registra versões F1 e ajuste fase system_settings |

## Evidências de aceite

| T   | Comando ou prova                                  | Resultado                      |
| --- | ------------------------------------------------- | ------------------------------ |
| T4  | `pnpm test --filter @starter/shared`              | 23 testes passando             |
| T4  | `pnpm lint --filter @starter/shared`              | 0 erros                        |
| T4  | `pnpm typecheck --filter @starter/shared`         | OK                             |
| T10 | `pnpm test --filter @starter/api`                 | 25 testes passando             |
| T10 | `pnpm lint --filter @starter/api`                 | 0 erros (2 warns)              |
| T10 | `pnpm typecheck --filter @starter/api`            | OK                             |
| T11 | `pnpm test --filter @starter/api`                 | 25 testes passando             |
| T11 | `pnpm lint --filter @starter/api`                 | 0 erros (2 warns)              |
| T11 | `pnpm typecheck --filter @starter/api`            | OK                             |
| T12 | `pnpm test --filter @starter/api`                 | 25 testes passando             |
| T12 | `pnpm lint --filter @starter/api`                 | 0 erros (2 warns)              |
| T12 | `pnpm typecheck --filter @starter/api`            | OK                             |
| T13 | `pnpm test --filter @starter/api`                 | 25 testes passando             |
| T13 | `pnpm lint --filter @starter/api`                 | 0 erros (2 warns)              |
| T13 | `pnpm typecheck --filter @starter/api`            | OK                             |
| T14 | `pnpm --filter @starter/api run test:integration` | 2 testes passando              |
| T14 | `pnpm lint --filter @starter/api`                 | 0 erros (2 warns)              |
| T14 | `pnpm typecheck --filter @starter/api`            | OK                             |
| T5  | `pnpm --filter @starter/api run test:integration` | 5 testes passando              |
| T5  | `pnpm lint --filter @starter/api`                 | 0 erros (2 warns)              |
| T5  | `pnpm typecheck --filter @starter/api`            | OK                             |
| T6  | `pnpm --filter @starter/api run test:integration` | 1 teste passando (atomicidade) |
| T6  | `pnpm lint --filter @starter/api`                 | 0 erros (2 warns)              |
| T6  | `pnpm typecheck --filter @starter/api`            | OK                             |
| T9  | `pnpm test --filter @starter/api`                 | 25 testes passando             |
| T9  | `pnpm --filter @starter/api run test:integration` | 5 testes passando              |
| T9  | `pnpm lint --filter @starter/api`                 | 0 erros (2 warns)              |
| T9  | `pnpm typecheck --filter @starter/api`            | OK                             |
| T15 | `pnpm turbo run test:integration` (CI)            | Job `integration` verde        |
| T15 | `pnpm keys:generate` (CI)                         | Exercita script no CI          |
| T16 | `pnpm format:check`                               | OK                             |
| T16 | `pnpm lint`                                       | 0 erros                        |
| T16 | `pnpm typecheck`                                  | OK                             |
| T16 | `pnpm test`                                       | 25 testes passando             |
| T16 | `pnpm test:integration`                           | 13 testes passando             |
| T16 | `pnpm build`                                      | OK                             |
