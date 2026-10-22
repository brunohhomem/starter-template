# Progresso da F2

Spec: docs/specs/F2-autenticacao.md · Numeração fixa T1–T13 · Retome da primeira tarefa não concluída, sem pedir confirmação.

| T   | Tarefa                             | Status (pendente/em andamento/feita/parcial) | Commit | Observações                                                                                                                 |
| --- | ---------------------------------- | -------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------- |
| T1  | Dependências, ambiente e chaves    | feita                                        |        | Deps instaladas, env estendido, keys:generate ok, lint/typecheck/build verdes                                               |
| T2  | Contratos em shared                | feita                                        |        | Schemas zod, AUTH_ERROR_CODES, testes vitest verdes                                                                         |
| T3  | Entities e migrations              | feita                                        |        | Users/Sessions entities, migrations create_users/create_sessions, uuid v7, unique constraints, cascade, atomicidade provada |
| T4  | Repositories                       | feita                                        |        | UsersRepository e SessionsRepository com todos os métodos necessários, transações via DATABASE                              |
| T5  | Serviços de infraestrutura de auth | feita                                        |        | PasswordHasher (bcrypt), TokenService (JWT HS256, refresh opaco SHA-256), CookieService (httpOnly, SameSite=Lax, Secure)    |
| T6  | AuthService e AuthController       | pendente                                     |        |                                                                                                                             |
| T7  | Guards e decorators                | pendente                                     |        |                                                                                                                             |
| T8  | Throttler com Redis                | pendente                                     |        |                                                                                                                             |
| T9  | Seed do admin                      | pendente                                     |        |                                                                                                                             |
| T10 | Testes unitários                   | pendente                                     |        |                                                                                                                             |
| T11 | Testes de integração               | pendente                                     |        |                                                                                                                             |
| T12 | Swagger e documentação             | pendente                                     |        |                                                                                                                             |
| T13 | Fechamento                         | pendente                                     |        |                                                                                                                             |

## Decisões tomadas

| Data | Decisão | Motivo |
| ---- | ------- | ------ |

## Pendências

| T   | Descrição | Tentativas |
| --- | --------- | ---------- |

## Evidências de aceite

| T   | Comando ou prova | Resultado |
| --- | ---------------- | --------- |
