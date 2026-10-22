# Testes

## Ferramentas

| Onde                          | Ferramenta                                              |
| ----------------------------- | ------------------------------------------------------- |
| Unitário da API               | Jest e ts-jest                                          |
| Integração da API             | Vitest + SWC (decorators), execução em série (1 worker) |
| Unitário do web e do `shared` | Vitest e Testing Library                                |
| E2E                           | Playwright, na fase em que a spec de E2E for aprovada   |

Cobertura é só relatório, sem gate.

## Cenários obrigatórios

Quando a fase correspondente existir, a suíte cobre: throttler, env ausente, seed idempotente, rotação e reuso de refresh token, guards e roles, toggle de cadastro, `must_change_password`, fluxos de e-mail, validação de upload, backup e restore, e mobile-first.

## Variáveis de ambiente e o cache do Turborepo

Toda variável de ambiente usada por uma tarefa precisa estar declarada em `env` ou `globalEnv` no `turbo.json`. Sem isso, o cache devolve um resultado velho.

## Jest na API (unitários)

O transformador do Jest é o **ts-jest**. Ele é o caminho estável com os decorators do Nest (`experimentalDecorators` e `emitDecoratorMetadata`). O `@swc/jest` exige `@swc/core` e já teve diferença de metadata em relação ao `tsc` que o Nest usa no build.

O teste importa `describe`, `expect` e `it` de `@jest/globals`. O pnpm não deixa importar esse pacote só porque o `jest` o traz por baixo, então ele é dependência direta da API, na mesma versão que o Jest já usa.

## Vitest na API (integração)

- Config: `apps/api/vitest.integration.config.mjs` (usa SWC para transformar decorators).
- Padrão de arquivos: `*.int-spec.ts` (separados dos `*.spec.ts` unitários).
- `globalSetup`: `apps/api/test/integration-setup.ts` — garante banco `TEST_DB_NAME` (cria no `postgres` se faltar) e roda migrations.
- **Trava de segurança**: se `TEST_DB_NAME` não terminar em `_test`, recusa rodar.
- `resetDatabase()`: lista tabelas em `pg_tables` (schema `public`, exceto `drizzle_migrations`) e faz `TRUNCATE ... RESTART IDENTITY CASCADE`.
- `createTestApp()`: monta app com `configureApp` (T8) e `TestAppModule` (substitui `DatabaseModule` por `TestDatabaseModule` que usa o pool de teste).
- `closeTestApp()`: fecha a aplicação e limpa recursos.
- Turbo: tarefa `test:integration` com `cache: false` e envs declaradas (`DB_*`, `TEST_DB_NAME`, `REDIS_*`).

## Execução

- Unitários: `pnpm test` (Jest).
- Integração: `pnpm test:integration` (Vitest, em série).
- CI: job `integration` separado do `verify` (ver `.github/workflows/ci.yml`).
