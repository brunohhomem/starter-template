# Testes

## Ferramentas

| Onde                          | Ferramenta                                               |
| ----------------------------- | -------------------------------------------------------- |
| Unitário da API               | Vitest + SWC (`vitest.config.mjs`)                       |
| Integração da API             | Vitest + SWC (`vitest.integration.config.mjs`), em série |
| Unitário do web e do `shared` | Vitest e Testing Library                                 |
| E2E                           | Playwright, na fase em que a spec de E2E for aprovada    |

Cobertura é só relatório, sem gate.

## Cenários obrigatórios

Quando a fase correspondente existir, a suíte cobre: throttler, env ausente, seed idempotente, rotação e reuso de refresh token, guards e roles, toggle de cadastro, `must_change_password`, fluxos de e-mail, validação de upload, backup e restore, e mobile-first.

## Variáveis de ambiente e o cache do Turborepo

Toda variável de ambiente usada por uma tarefa precisa estar declarada em `env` ou `globalEnv` no `turbo.json`. Sem isso, o cache devolve um resultado velho.

## Vitest na API (unitários)

- Config: `apps/api/vitest.config.mjs`.
- Padrão de arquivos: `src/**/*.spec.ts`.
- Transformador: `unplugin-swc` com `decorators: true` e `decoratorMetadata: true`.
- Pool: `forks` (isolamento por processo, compatível com decorators do Nest).
- Imports: `describe`, `it`, `expect`, etc. de `vitest` diretamente.

## Vitest na API (integração)

- Config: `apps/api/vitest.integration.config.mjs` (usa SWC para transformar decorators).
- Padrão de arquivos: `test/**/*.int-spec.ts` (separados dos `*.spec.ts` unitários).
- `globalSetup`: `apps/api/test/integration-setup.ts` — garante banco `TEST_DB_NAME` (cria no `postgres` se faltar) e roda migrations.
- **Trava de segurança**: se `TEST_DB_NAME` não terminar em `_test`, recusa rodar.
- `resetDatabase()`: lista tabelas em `pg_tables` (schema `public`, exceto `drizzle_migrations`) e faz `TRUNCATE ... RESTART IDENTITY CASCADE`.
- `createTestApp()`: monta app com `configureApp` e `TestAppModule` (substitui `DatabaseModule` por `TestDatabaseModule` que usa o pool de teste).
- `closeTestApp()`: fecha a aplicação e limpa recursos.
- Turbo: tarefa `test:integration` com `cache: false` e envs declaradas (`DB_*`, `TEST_DB_NAME`, `REDIS_*`).

## Arquivos de integração

| Arquivo                              | Responsabilidade                                     |
| ------------------------------------ | ---------------------------------------------------- |
| `test/cadastro.int-spec.ts`          | Registro de usuário, validações de senha, flags      |
| `test/login.int-spec.ts`             | Login, papéis, CSRF, throttler                       |
| `test/sessao.int-spec.ts`            | Me, refresh, logout, cascata de banco                |
| `test/senha.int-spec.ts`             | Esqueci/reset senha, troca de senha, must_change     |
| `test/confirmacao-email.int-spec.ts` | Confirmar e reenviar e-mail de confirmação           |
| `test/convite.int-spec.ts`           | Convidar usuário e aceitar convite                   |
| `test/configuracoes.int-spec.ts`     | Configurações de e-mail (SMTP/Resend)                |
| `test/seguranca.int-spec.ts`         | Segurança de resposta, hash de tokens, XSS no e-mail |
| `test/database.int-spec.ts`          | Isolamento via TRUNCATE                              |
| `test/logging.int-spec.ts`           | Redação de campos sensíveis nos logs                 |

## Helpers compartilhados

- `test/test-email-helpers.ts` — `waitForEmail(transport, to)` e `extractToken(email, param)`.
- `test/scenario/index.ts` — `makeScenario(app, transport?)` retorna `{ createUser, loginAs, lastEmailTo, extractLinkToken }`.
  - `createUser({ email, password?, role?, isActive? })` — registra via API e ajusta via SQL se necessário.
  - `loginAs(user)` — faz login e retorna `{ accessCookie, refreshCookie, userId }`.
  - `lastEmailTo(email)` — espera e retorna o último e-mail enviado para o endereço.
  - `extractLinkToken(email, param?)` — extrai um parâmetro de query do link no e-mail.

## Execução

- Unitários: `pnpm test` (Vitest).
- Integração: `pnpm test:integration` (Vitest, em série).
- CI: job `integration` separado do `verify` (ver `.github/workflows/ci.yml`).
