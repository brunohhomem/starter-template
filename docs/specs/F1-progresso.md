# Progresso da F1

Arquivo de controle da execução da spec `docs/specs/F1-banco-e-base-da-api.md`.
Regras de uso: seção 3.1 da spec. **Numeração fixa: T1 a T16 da spec, sem renumerar.**
Ao retomar, leia este arquivo e continue da primeira tarefa não concluída, sem pedir confirmação.

## Situação das tarefas

| T (spec) | Tarefa                                               | Status                          | Commit    | Observações                                                                                                                              |
| -------- | ---------------------------------------------------- | ------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| T1       | Compose de desenvolvimento                           | feita                           | `58782dd` | Aceite reconferido na Definição de Pronto                                                                                                |
| T2       | `keys:generate` e `keys:rotate`                      | feita                           | `41c0b6d` | Aceite reconferido na Definição de Pronto                                                                                                |
| T3       | Validação de ambiente na API                         | feita                           | `977b924` | Aceite reconferido na Definição de Pronto                                                                                                |
| **T4**   | **`packages/shared`: contratos de erro e paginação** | **feita**                       | `4a81d62` | `errorResponseSchema`, `paginationQuerySchema`, `paginatedResponseSchema`, `buildPageMeta` criados com testes. Commit: 4a81d62           |
| T5       | Módulo de banco e `coreColumns`                      | feita sob o nome "T4" do agente | `768fde5` | **Executar o aceite da T5:** `uuid_extract_version(id) = 7`, `timestamptz`, `updatedAt` mudando via Drizzle, `buildDatabaseConfig` único |
| T6       | Migrations nomeadas                                  | feita                           | `3de99b5` | **Executar o aceite da T6**, inclusive a **prova de atomicidade** e o registro de como o drizzle-kit nomeia os arquivos                  |
| T7       | Entity `system_settings`                             | feita                           | `00871ca` |                                                                                                                                          |
| T8       | Bootstrap compartilhado `configureApp`               | feita                           | `52d4a2c` |                                                                                                                                          |
| T9       | Logs estruturados                                    | feita sob o nome "T5" do agente | `b1e5cc0` | **Executar o aceite da T9** (request ID válido e inválido, redação, formato por ambiente, `/api/health` fora do log)                     |
| T10      | Validação e erros padronizados                       | pendente                        | —         | Depende da T4                                                                                                                            |
| T11      | Módulo de Redis                                      | pendente                        | —         |                                                                                                                                          |
| T12      | Health                                               | pendente                        | —         |                                                                                                                                          |
| T13      | Swagger                                              | pendente                        | —         |                                                                                                                                          |
| T14      | Infraestrutura de testes de integração               | pendente                        | —         |                                                                                                                                          |
| T15      | CI: job de integração                                | pendente                        | —         |                                                                                                                                          |
| T16      | Documentação                                         | pendente                        | —         |                                                                                                                                          |

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

| Data       | Decisão                                                                             | Motivo                                                                                                                                                        |
| ---------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-21 | T4: schemas de erro e paginação em `packages/shared/src/error.ts` e `pagination.ts` | Segue a especificação da T4; tipos inferidos com zod; `paginatedResponseSchema` é factory que aceita schema do item; testes cobrem parsing, validação e tipos |

## Evidências de aceite

| T   | Comando ou prova                          | Resultado          |
| --- | ----------------------------------------- | ------------------ |
| T4  | `pnpm test --filter @starter/shared`      | 23 testes passando |
| T4  | `pnpm lint --filter @starter/shared`      | 0 erros            |
| T4  | `pnpm typecheck --filter @starter/shared` | OK                 |
