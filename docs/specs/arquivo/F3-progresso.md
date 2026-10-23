# Progresso da F3 — E-mail, fluxos de token, configurações e auditoria

Spec: docs/specs/F3-email-e-configuracoes.md · Branch: feat/f3-email-settings · Modo: acompanhado · Comando de integração: pnpm test:integration
Numeração fixa. Retome da primeira tarefa não concluída, sem pedir confirmação.

| T   | Tarefa                                         | Status   | Commit  | Sessões OpenCode | Intervenção do gerente                                                                                          | Observações                                                                     |
| --- | ---------------------------------------------- | -------- | ------- | ---------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| T1  | Dependências, ambiente e transportes de e-mail | feita    | 853ad85 | 1                | sim (import paths, resend SDK type, lazy-init, env.schema.spec.ts mock, logger-options.spec.ts)                 |                                                                                 |
| T2  | Contratos em `packages/shared`                 | feita    | 14fc7ab | 1                | sim (vitest.config path, forgotPasswordResponse test, z.record 2 args, vitest/globals tsconfig, id-length lint) |                                                                                 |
| T3  | Entities e migrations                          | feita    | d6628c6 | 1                | não                                                                                                             | Drizzle gerou uma migration com ambas as tabelas (0002_create_email_tokens.sql) |
| T4  | Repositories                                   | feita    | c70e6cd | 1                | não                                                                                                             |                                                                                 |
| T5  | Templates React Email                          | feita    | eb2de44 | 1                | sim (jest.config tsx transform, SWC react runtime, naming-convention camelCase keys)                            |                                                                                 |
| T6  | Fila, processor, worker e limpeza              | pendente | —       | 0                | não                                                                                                             |                                                                                 |
| T7  | `EmailTokensService`                           | pendente | —       | 0                | não                                                                                                             |                                                                                 |
| T8  | Fluxo de confirmação de e-mail                 | pendente | —       | 0                | não                                                                                                             |                                                                                 |
| T9  | Fluxo de recuperação de senha                  | pendente | —       | 0                | não                                                                                                             |                                                                                 |
| T10 | Fluxo de convite                               | pendente | —       | 0                | não                                                                                                             |                                                                                 |
| T11 | Auditoria e configurações                      | pendente | —       | 0                | não                                                                                                             |                                                                                 |
| T12 | Testes transversais                            | pendente | —       | 0                | não                                                                                                             |                                                                                 |
| T13 | Swagger e documentação                         | pendente | —       | 0                | não                                                                                                             |                                                                                 |
| T14 | Fechamento (gerente)                           | pendente | —       | 0                | não                                                                                                             |                                                                                 |

## Decisões

| Data | Tarefa | Decisão | Motivo |
| ---- | ------ | ------- | ------ |

## Pendências

| T   | Descrição | Tentativas |
| --- | --------- | ---------- |

## Evidências

| T   | Comando                                           | Resultado                                                                  |
| --- | ------------------------------------------------- | -------------------------------------------------------------------------- |
| T1  | pnpm --filter @starter/api lint                   | 0 errors, 24 warnings                                                      |
| T1  | pnpm --filter @starter/api typecheck              | verde                                                                      |
| T1  | pnpm --filter @starter/api test                   | 132/132 passed                                                             |
| T2  | pnpm --filter shared test (via vitest.config.mjs) | 74/74 passed                                                               |
| T2  | pnpm --filter shared build                        | verde                                                                      |
| T2  | pnpm typecheck                                    | verde                                                                      |
| T3  | pnpm typecheck                                    | verde                                                                      |
| T3  | Migration SQL                                     | email_token_type enum + audit_logs + email_tokens + FKs + índices corretos |

## Gate pré-PR

| #   | Ciclo | Passos | Resultado |
| --- | ----- | ------ | --------- |
