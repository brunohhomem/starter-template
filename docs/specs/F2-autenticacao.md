# Spec F2 — Autenticação, usuários, sessões e throttler

> **EXECUÇÃO DE PONTA A PONTA, SEM INTERVENÇÃO HUMANA.**
> Esta spec foi escrita para ser executada do início ao fim por um agente independente, sem confirmações. Todas as informações necessárias estão aqui: variáveis, tabelas, endpoints, valores, regras, testes e critérios de aceite. **Toda ambiguidade já tem decisão registrada** (seção 4 e regras de decisão da seção 3). Se algo parecer faltar, aplique a regra de decisão da seção 3.2, registre em "Decisões tomadas" no arquivo de progresso e siga em frente. **Só existem 5 motivos para parar** (seção 3.1).

Versão: 1 · Depende de: **F1 concluída** (PR da F1 com CI verde; contratos de erro/paginação em `packages/shared`, módulo de banco, Redis, health, `configureApp`, infraestrutura de testes de integração) · ADR: `docs/adr/0001-template-base-monorepo.md`

---

## 1. Objetivo

Entregar autenticação completa da API: cadastro (com chave liga/desliga), login, sessões com refresh rotativo e detecção de reuso, logout, `me`, troca de senha, papéis (`admin`/`user`), guards, proteção CSRF, throttler sobre Redis com testes obrigatórios, e seed do admin. **Sem e-mail** (confirmação, recuperação e convite são F3) e **sem frontend** (F5/F6).

## 2. Fora de escopo (não implementar)

E-mails e tabela de tokens de e-mail (F3) · controller/service de `system_settings` e tela de configurações (F3/F6) · `audit_logs` (F3) · people/avatar (F4) · 2FA e login social (F9) · job de limpeza de sessões expiradas (F3, via BullMQ; aqui só o método do repository) · qualquer código em `apps/web`.

## 3. Modo autônomo

### 3.1 Os únicos 5 motivos para parar

Parar significa: escrever o motivo no arquivo de progresso, commitar o que está íntegro, abrir/atualizar o PR como rascunho e encerrar com o relatório. **Em qualquer outro caso, decida e continue.**

| #   | Motivo                                                                       | Exemplo                                                                 |
| --- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| a   | A prova de atomicidade da migration falha                                    | migration parcial aplicada após erro                                    |
| b   | Conflito entre duas regras obrigatórias, sem decisão possível pela seção 3.2 | regra de lint obriga X, spec obriga o contrário                         |
| c   | Dependência fora da seção 8 sem alternativa dentro da lista                  | pacote inexistente e sem fallback                                       |
| d   | Credencial ou acesso externo ausente                                         | `gh` não autenticado, Docker parado e não iniciável                     |
| e   | Ação destrutiva fora do escopo                                               | apagar branch alheia, `reset --hard` em trabalho não commitado de outro |

Proibido: encerrar a resposta com pergunta, pedir "posso prosseguir?", parar para confirmar escolha de nome/estrutura/valor que esta spec ou a seção 3.2 cobre.

### 3.2 Regras de decisão para ambiguidades

1. **Estrutura de pastas/nomes**: copie o padrão do módulo `health` e do módulo de banco da F1 (entity/dto/repository/service/controller; `*.client.tsx` não se aplica aqui). Se a spec dá um caminho lógico e o repositório usa outro padrão, **vale o padrão do repositório**.
2. **Nomes de arquivos de schema de ambiente/config**: localize com `grep -rn "envSchema\|buildDatabaseConfig" apps/api/src` e estenda o que existe. Não crie um segundo schema.
3. **Formato de erro**: use `errorResponseSchema` e o `AllExceptionsFilter` da F1. Erros de domínio carregam `code` da seção 6.4.
4. **Versão de biblioteca**: instale a última estável compatível; fixe a versão exata no `package.json` (sem `^`) se o repositório já fixa; senão siga o padrão do repositório.
5. **Se um teste falhar**: corrija o código (nunca o teste para "passar") até 3 tentativas distintas; persistindo, registre em "Pendências" no progresso, marque a tarefa `parcial` e **siga para a próxima**; no relatório final o item aparece como não resolvido. Isso não é motivo de parada.
6. **Lint de métricas** (warn-only) não bloqueia; erros de lint bloqueiam o commit e devem ser corrigidos.
7. **Windows/CRLF**: arquivos novos em LF (o repositório já normaliza).
8. **Commits**: um por tarefa, Conventional Commits, escopo `api` ou `shared` ou `config` ou `docs`. Mensagem termina com as linhas de coautoria exigidas pelo ambiente, se houver.

### 3.3 Arquivo de progresso

Crie `docs/specs/F2-progresso.md` **na primeira ação** (modelo na seção 12) e atualize ao fim de cada tarefa (status, commit, evidência). **Numeração fixa T1–T13: não renumerar, não pular, não fundir.** Ao retomar, leia o arquivo e continue da primeira tarefa não concluída, sem pedir confirmação.

## 4. Decisões já tomadas (não perguntar, não rediscutir)

| Tema                         | Decisão                                                                                                                                                                                                                                               |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transporte de tokens         | Cookies `httpOnly`, `SameSite=Lax`, `Secure` quando `COOKIE_SECURE=true`. Nenhum token no corpo da resposta nem em `localStorage`                                                                                                                     |
| Access token                 | JWT HS256, 15 min, assinado com `JWT_ACCESS_SECRET`. Claims: `sub` (userId), `role`, `sid` (sessionId), `mcp` (mustChangePassword), `iat`, `exp`                                                                                                      |
| Refresh token                | **Opaco**: 48 bytes aleatórios (`crypto.randomBytes`) em base64url. Guardado **somente como hash SHA-256 (hex)** em `sessions.refresh_token_hash`. 7 dias                                                                                             |
| Rotação                      | A cada `/auth/refresh`: sessão antiga revogada com `replaced_by_session_id`, nova sessão na mesma `family_id`                                                                                                                                         |
| Reuso                        | Refresh de sessão já rotacionada **fora** da janela de tolerância (10 s) revoga **toda a família** e retorna `AUTH_REFRESH_REUSED`. **Dentro** da janela: apenas 401 `AUTH_REFRESH_REUSED` sem revogar a família (evita falso positivo com duas abas) |
| Hash de senha                | bcrypt, 12 rounds (`AUTH_BCRYPT_ROUNDS`, 4 em teste). Atrás de uma abstração `PasswordHasher`. Senhas > 72 bytes UTF-8 são **rejeitadas pela validação** (limite do bcrypt)                                                                           |
| Política de senha            | 10 a 72 bytes, ao menos 1 letra e 1 dígito. Mesma regra no zod do shared e no serviço                                                                                                                                                                 |
| E-mail                       | `trim` + minúsculas, validado por zod, único. Salvo normalizado                                                                                                                                                                                       |
| Papéis                       | `admin` e `user` (enum Postgres `user_role`). Cadastro público sempre cria `user`                                                                                                                                                                     |
| Usuário desativado           | `is_active=false` bloqueia login e refresh                                                                                                                                                                                                            |
| Cadastro                     | Entra e já autentica (seta cookies). Depende de `system_settings` chave `registration_enabled`                                                                                                                                                        |
| Enumeração de e-mail         | Login: erro genérico `AUTH_INVALID_CREDENTIALS` e tempo constante (compara com hash dummy se o usuário não existe). Cadastro: e-mail duplicado retorna 409 `AUTH_EMAIL_TAKEN` (aceito conscientemente; F3 pode endurecer)                             |
| CSRF                         | `SameSite=Lax` + verificação de `Origin` em métodos não seguros: se `Origin` presente e diferente de `WEB_ORIGIN` → 403 `AUTH_CSRF_BLOCKED`. Sem `Origin` (curl, testes, server-to-server) → permitido                                                |
| Troca de senha               | Exige senha atual; nova ≠ atual; revoga **todas as outras** sessões do usuário; zera `must_change_password`; emite novos cookies                                                                                                                      |
| `must_change_password`       | Enquanto verdadeiro, qualquer rota protegida retorna 403 `AUTH_MUST_CHANGE_PASSWORD`, exceto `GET /auth/me`, `POST /auth/change-password` e `POST /auth/logout`                                                                                       |
| Mudança de papel/desativação | Vale no próximo refresh (≤ 15 min) para o access token já emitido. Aceito e documentado                                                                                                                                                               |
| Passport                     | **Não usar.** Guard próprio com `@nestjs/jwt`                                                                                                                                                                                                         |
| Throttler                    | `@nestjs/throttler` com storage em Redis. Valores na seção 7.8                                                                                                                                                                                        |
| IP real                      | `trust proxy` configurado por `TRUST_PROXY_HOPS` (0 em dev/teste, 1 em produção atrás do Nginx)                                                                                                                                                       |

## 5. Variáveis de ambiente (adicionar ao schema existente)

| Variável                           | Obrigatória              | Padrão                                         | Validação                     | Gerada por `keys:generate`?               |
| ---------------------------------- | ------------------------ | ---------------------------------------------- | ----------------------------- | ----------------------------------------- |
| `JWT_ACCESS_SECRET`                | sim                      | —                                              | string ≥ 32 chars             | **sim**, 48 bytes base64url, só se faltar |
| `ADMIN_EMAIL`                      | sim (todos os ambientes) | —                                              | e-mail                        | **não** (Bruno define)                    |
| `ADMIN_INITIAL_PASSWORD`           | não                      | —                                              | política de senha se presente | **não**                                   |
| `WEB_ORIGIN`                       | sim                      | `http://localhost:3000` em `.env.example`      | URL sem barra final           | não                                       |
| `COOKIE_SECURE`                    | não                      | `true` se `NODE_ENV=production`, senão `false` | boolean                       | não                                       |
| `TRUST_PROXY_HOPS`                 | não                      | `0`                                            | inteiro 0–5                   | não                                       |
| `AUTH_ACCESS_TTL_MINUTES`          | não                      | `15`                                           | inteiro 1–120                 | não                                       |
| `AUTH_REFRESH_TTL_DAYS`            | não                      | `7`                                            | inteiro 1–90                  | não                                       |
| `AUTH_REFRESH_REUSE_GRACE_SECONDS` | não                      | `10`                                           | inteiro 0–60                  | não                                       |
| `AUTH_BCRYPT_ROUNDS`               | não                      | `12`                                           | inteiro 4–15                  | não                                       |

Regras: seguem a T3 da F1 (falha rápida listando **todos** os problemas sem imprimir valores; nenhum `process.env` fora de `config/`). `.env.example` ganha todas as chaves, com `ADMIN_EMAIL=` vazio e comentário. O ambiente de teste (`apps/api/test`) define valores válidos para todas (`AUTH_BCRYPT_ROUNDS=4`, `ADMIN_EMAIL=admin@example.test`).

## 6. Contratos

### 6.1 Banco

**Enum** `user_role`: `'admin' | 'user'`.

**Tabela `users`** (`coreColumns`: `id` uuidv7, `created_at`, `updated_at`):

| Coluna                 | Tipo        | Regras                                 |
| ---------------------- | ----------- | -------------------------------------- |
| `email`                | text        | not null, **unique**, sempre minúsculo |
| `password_hash`        | text        | not null                               |
| `role`                 | `user_role` | not null, default `'user'`             |
| `is_active`            | boolean     | not null, default `true`               |
| `must_change_password` | boolean     | not null, default `false`              |
| `email_verified_at`    | timestamptz | null (usado na F3)                     |
| `last_login_at`        | timestamptz | null                                   |

**Tabela `sessions`** (`coreColumns`):

| Coluna                   | Tipo        | Regras                                                |
| ------------------------ | ----------- | ----------------------------------------------------- |
| `user_id`                | uuid        | FK `users.id` **on delete cascade**, not null, índice |
| `family_id`              | uuid        | not null, índice                                      |
| `refresh_token_hash`     | text        | not null, **unique**                                  |
| `expires_at`             | timestamptz | not null, índice                                      |
| `revoked_at`             | timestamptz | null                                                  |
| `replaced_by_session_id` | uuid        | null                                                  |
| `user_agent`             | text        | null, truncado em 255                                 |
| `ip`                     | text        | null                                                  |

Migrations (nomes pela regra da F1): `create_users`, `create_sessions` (a do enum entra em `create_users`). Cada uma atômica, com a prova da T6 da F1 repetida para a nova migration.

### 6.2 Contratos em `packages/shared/src/auth/`

Exportar do índice do pacote. Textos de erro de validação em pt-BR.

| Export                        | Definição                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| `USER_ROLES`                  | `['admin','user'] as const` · tipo `UserRole`                                                           |
| `emailSchema`                 | `z.string().trim().toLowerCase().email().max(254)`                                                      |
| `passwordSchema`              | string, regras da seção 4 (bytes UTF-8 ≤ 72 via `Buffer.byteLength`/`TextEncoder`)                      |
| `registerRequestSchema`       | `{ email, password }`                                                                                   |
| `loginRequestSchema`          | `{ email: emailSchema, password: string min(1) max(72) }` (login **não** aplica a política, só limites) |
| `changePasswordRequestSchema` | `{ currentPassword, newPassword: passwordSchema }`                                                      |
| `authUserSchema`              | `{ id: uuid, email, role, mustChangePassword: boolean, emailVerified: boolean }`                        |
| `authResponseSchema`          | `{ user: authUserSchema }`                                                                              |
| `AUTH_ERROR_CODES`            | ver 6.4                                                                                                 |

Tipos exportados via `z.infer`. Testes unitários (Vitest) cobrindo limites das senhas (9/10/72/73 bytes, emoji que passa de 72 bytes com menos de 72 caracteres, só letras, só dígitos) e normalização do e-mail.

### 6.3 Endpoints (prefixo global `/api` já existente)

| Método e rota                | Acesso                               | Corpo                   | Sucesso            | Efeitos                                                                    |
| ---------------------------- | ------------------------------------ | ----------------------- | ------------------ | -------------------------------------------------------------------------- |
| `POST /auth/register`        | público                              | `registerRequest`       | 201 `authResponse` | cria usuário `user`, cria sessão, seta cookies                             |
| `POST /auth/login`           | público                              | `loginRequest`          | 200 `authResponse` | valida, `last_login_at`, cria sessão nova (nova `family_id`), seta cookies |
| `POST /auth/refresh`         | público (usa cookie `refresh_token`) | vazio                   | 200 `authResponse` | rotaciona; seta cookies novos                                              |
| `POST /auth/logout`          | público (usa cookie `refresh_token`) | vazio                   | 204                | revoga a sessão do cookie se existir; limpa cookies; **sempre 204**        |
| `GET /auth/me`               | autenticado                          | —                       | 200 `authResponse` | lê do banco (não do token)                                                 |
| `POST /auth/change-password` | autenticado                          | `changePasswordRequest` | 200 `authResponse` | regras da seção 4                                                          |

**Cookies**

| Nome            | Conteúdo    | `Path`      | `Max-Age`      | Flags                                                     |
| --------------- | ----------- | ----------- | -------------- | --------------------------------------------------------- |
| `access_token`  | JWT         | `/`         | TTL do access  | `HttpOnly; SameSite=Lax; Secure` conforme `COOKIE_SECURE` |
| `refresh_token` | token opaco | `/api/auth` | TTL do refresh | idem                                                      |

Limpar = mesmo nome/path/flags com `Max-Age=0`. Sem `Domain` (host-only).

### 6.4 Códigos de erro

| `code`                        | HTTP | Quando                                                            |
| ----------------------------- | ---- | ----------------------------------------------------------------- |
| `AUTH_INVALID_CREDENTIALS`    | 401  | e-mail/senha inválidos, ou usuário inativo (mesma resposta)       |
| `AUTH_UNAUTHORIZED`           | 401  | sem access token / assinatura inválida / sessão do token revogada |
| `AUTH_TOKEN_EXPIRED`          | 401  | access token expirado                                             |
| `AUTH_REFRESH_INVALID`        | 401  | cookie ausente, hash desconhecido, expirada, usuário inativo      |
| `AUTH_REFRESH_REUSED`         | 401  | reuso de refresh rotacionado                                      |
| `AUTH_FORBIDDEN`              | 403  | papel insuficiente                                                |
| `AUTH_MUST_CHANGE_PASSWORD`   | 403  | `mcp=true` em rota não liberada                                   |
| `AUTH_REGISTRATION_DISABLED`  | 403  | cadastro desligado                                                |
| `AUTH_EMAIL_TAKEN`            | 409  | e-mail já cadastrado                                              |
| `AUTH_CSRF_BLOCKED`           | 403  | `Origin` não permitida                                            |
| `AUTH_PASSWORD_UNCHANGED`     | 422  | nova senha igual à atual                                          |
| `AUTH_CURRENT_PASSWORD_WRONG` | 422  | senha atual incorreta                                             |
| `RATE_LIMITED`                | 429  | throttler (com `Retry-After` em segundos)                         |

Todos no formato `errorResponseSchema` da F1. Mensagens em pt-BR, sem revelar existência de conta.

## 7. Tarefas

Ordem fixa. Cada tarefa termina com: `pnpm lint`, `pnpm typecheck`, testes da tarefa, commit, atualização do progresso.

### T1 — Dependências, ambiente e chaves

1. Instalar em `apps/api`: `@nestjs/jwt`, `@nestjs/throttler`, `cookie-parser`, `@types/cookie-parser` (dev), `bcrypt` (ver regra abaixo). Tentar `@nest-lab/throttler-storage-redis`; ver T8.
2. **Regra do bcrypt**: instale `bcrypt`. Se o pnpm bloquear o script de build, adicione `bcrypt` a `pnpm.onlyBuiltDependencies` do `package.json` raiz e reinstale. Se `require('bcrypt')` ainda falhar (Windows/CI), troque por `bcryptjs` (mesmo formato de hash `$2b$`, compatível) **sem alterar nada além do adaptador** `PasswordHasher`. Registre a escolha em "Decisões".
3. Estender o schema de ambiente (seção 5), `.env.example`, e o `keys:generate`/`keys:rotate` da F1 para incluir `JWT_ACCESS_SECRET` (gera só se faltar; `rotate` avisa que **invalida todas as sessões ativas**). Atualizar os testes do script de chaves.
4. `configureApp`: `app.use(cookieParser())` e `app.set('trust proxy', TRUST_PROXY_HOPS)`. Verificar se a F1 já usa Express (`@nestjs/platform-express`); se for Fastify, ajustar para o equivalente e registrar.

**Aceite:** app não sobe sem `JWT_ACCESS_SECRET`/`ADMIN_EMAIL`/`WEB_ORIGIN` e a mensagem lista todos os faltantes sem valores; `keys:generate` cria apenas a chave que falta e não toca nas outras; testes do script passam.

### T2 — Contratos em `packages/shared`

Implementar a seção 6.2 e `AUTH_ERROR_CODES` (6.4) com testes Vitest. **Aceite:** build do shared e testes verdes; API e web (typecheck) enxergam os exports.

### T3 — Entities e migrations

Entities `users` e `sessions` conforme 6.1 (padrão das entities da F1, `coreColumns`), exportadas no schema central. Gerar migrations com `db:generate` usando os nomes `create_users` e `create_sessions`. Repetir a prova de atomicidade da F1/T6 para elas. **Aceite:** `db:migrate` em banco limpo cria as tabelas; `uuid_extract_version(id)=7`; unique de `email` e de `refresh_token_hash` existem; cascade de `user_id` funciona (teste de integração); prova de atomicidade registrada.

### T4 — Repositories

`UsersRepository` (`findById`, `findByEmail`, `create`, `updatePasswordHash(id, hash, mustChange)`, `touchLastLogin`) e `SessionsRepository` (`create`, `findByRefreshHash`, `revoke(id, replacedBy?)`, `revokeFamily(familyId)`, `revokeAllByUserExcept(userId, sessionId)`, `revokeAllByUser`, `deleteExpired(before)`). São o único acesso a dados. Operações compostas (rotação) recebem uma transação. **Aceite:** testes de integração por método, incluindo `deleteExpired`.

### T5 — Serviços de infraestrutura de auth

- `PasswordHasher` (`hash`, `verify`, `dummyVerify()` que gasta o mesmo custo).
- `TokenService`: `signAccess(user, sessionId)`, `verifyAccess(token)` (distingue expirado de inválido), `generateRefreshToken()` → `{ token, hash }`, `hashRefreshToken(token)`.
- `CookieService`: `setAuthCookies(res, access, refresh)`, `clearAuthCookies(res)`, leitura dos cookies; lê flags/TTLs da config tipada.

**Aceite:** testes unitários: hash≠senha, verify ok/falha, dummyVerify não lança; JWT assinado/expirado/adulterado; token de refresh tem ≥ 64 chars base64url e hash é determinístico; cookies com as flags da tabela 6.3 nos dois modos de `COOKIE_SECURE`.

### T6 — `AuthService` e `AuthController`

Implementar a seção 6.3 integralmente com as decisões da seção 4. Pontos obrigatórios:

1. **Register**: lê `registration_enabled` via repository de `system_settings` da F1 (se faltar método de leitura por chave, adicionar ao repository). Valor ausente = **desligado**. Verifica antes de criar usuário.
2. **Login**: busca por e-mail; se não existe ou inativo → `dummyVerify()` e `AUTH_INVALID_CREDENTIALS`.
3. **Refresh**: lógica de rotação e reuso da seção 4, dentro de **uma transação**; usuário inativo → `AUTH_REFRESH_INVALID` e revoga a família.
4. **Logout**: idempotente.
5. **Change-password**: seção 4; a sessão atual é preservada? **Não**: revogar todas e criar uma nova (novos cookies).
6. `authUserSchema.emailVerified = email_verified_at != null`.
7. Controller só valida (pipe zod da F1), chama o service e manipula cookies; sem regra de negócio.

**Aceite:** coberto pelos testes da T11. Nenhum arquivo acima dos limites de métricas sem justificativa.

### T7 — Guards e decorators

- `@Public()`, `@Roles(...roles)`, `@CurrentUser()` (extrai `{ userId, role, sessionId, mustChangePassword }` do request).
- `JwtAuthGuard` global (`APP_GUARD`): rotas `@Public()` passam; senão lê `access_token` do cookie, valida, **confere que a sessão `sid` não está revogada** (consulta ao `SessionsRepository`; cache não é necessário), anexa o usuário ao request. Erros: `AUTH_UNAUTHORIZED`/`AUTH_TOKEN_EXPIRED`.
- `RolesGuard` global: sem `@Roles` passa; com, exige papel → `AUTH_FORBIDDEN`.
- `MustChangePasswordGuard` global: regra da seção 4.
- `OriginGuard` global (primeiro da cadeia depois do throttler): regra de CSRF da seção 4, só em POST/PUT/PATCH/DELETE.
- Ordem de registro: Throttler → Origin → JwtAuth → Roles → MustChangePassword.
- Marcar `@Public()` em: register, login, refresh, logout, `/health`, rotas do Swagger. **Todo o resto passa a exigir autenticação** (conferir o health da F1 continua público e os testes dele passam).

**Aceite:** testes de integração da T11 (matriz de guards).

### T8 — Throttler com Redis

1. `ThrottlerModule.forRootAsync` com os throttlers nomeados abaixo e storage em Redis com prefixo `throttle:`.
2. **Regra do storage**: tente `@nest-lab/throttler-storage-redis`. Se for incompatível com a versão instalada do `@nestjs/throttler` ou com o cliente Redis da F1, implemente um `RedisThrottlerStorage` próprio (contrato `ThrottlerStorage` do pacote: `increment(key, ttl, limit, blockDuration, throttlerName)` retornando `totalHits`, `timeToExpire`, `isBlocked`, `timeToBlockExpire`), usando o cliente `ioredis` do módulo Redis da F1, com `INCR`/`PEXPIRE` atômicos (script Lua ou `MULTI`). **Verifique na documentação/tipos instalados se `ttl` está em ms ou s** e converta. Registre a escolha.
3. `getTracker` customizado por throttler (classe `AppThrottlerGuard extends ThrottlerGuard`):

| Throttler         | Onde                         | Limite       | Janela | Bloqueio | Chave                            |
| ----------------- | ---------------------------- | ------------ | ------ | -------- | -------------------------------- |
| `default`         | todas as rotas               | 120 req      | 60 s   | —        | IP                               |
| `login`           | `POST /auth/login`           | 5 tentativas | 15 min | 15 min   | IP + e-mail normalizado do corpo |
| `register`        | `POST /auth/register`        | 5            | 60 min | 60 min   | IP                               |
| `refresh`         | `POST /auth/refresh`         | 30           | 60 s   | —        | IP                               |
| `change-password` | `POST /auth/change-password` | 5            | 15 min | 15 min   | userId                           |

Rotas com throttler específico usam `@SkipThrottle({ default: true })` + `@Throttle({ nome: {...} })` conforme a API instalada. `/health` é isento de todos. 4. Resposta 429 no formato de erro da F1, `code: RATE_LIMITED`, header `Retry-After` (segundos). 5. Se o Redis estiver indisponível, **falhar aberto** (permitir a requisição) e logar `warn`, nunca derrubar o login. Teste cobrindo.

**Aceite (testes obrigatórios, integração com Redis real):**

- 50 usuários distintos, mesmo IP, 3 tentativas de login cada → **nenhum** 429.
- Mesmo e-mail, mesmo IP: 5 tentativas erradas → 401; a 6ª → 429 com `Retry-After` > 0; e-mail **diferente** do mesmo IP continua com 401.
- Bloqueio por e-mail vale mesmo com a senha correta (a 6ª com senha certa → 429).
- IPs diferentes (via `X-Forwarded-For` com `TRUST_PROXY_HOPS=1` no teste) não compartilham contador.
- `default` bloqueia a 121ª requisição no minuto.
- Redis fora do ar → requisição passa.
- Helper `resetThrottle()` (apaga `throttle:*`) chamado no `beforeEach` de **todos** os testes de integração de auth.

### T9 — Seed do admin e configuração inicial

Script `apps/api/src/database/seed/admin.seed.ts` + comando `pnpm --filter api db:seed` e `pnpm db:seed` na raiz. Idempotente:

1. Se já existe usuário com `ADMIN_EMAIL`: não faz nada (nunca sobrescreve senha); imprime "admin já existe".
2. Senão cria `role=admin`, `must_change_password=true`, `email_verified_at=now()`. Senha:
   - `NODE_ENV=development`: fixa `Admin@12345`.
   - qualquer outro: `ADMIN_INITIAL_PASSWORD` se definida (validada pela política); senão gera 24 caracteres aleatórios e **imprime uma única vez** em stdout (nunca em log estruturado).
3. Insere `registration_enabled` em `system_settings` **somente se não existir**: `true` em `development`/`test`, `false` nos demais.
4. Roda dentro de transação. Nunca executa em `NODE_ENV=test` automaticamente (testes chamam a função explicitamente).

**Aceite:** testes de integração: primeira execução cria; segunda não altera; senha do dev funciona no login e retorna `mustChangePassword=true`; produção sem `ADMIN_INITIAL_PASSWORD` gera senha aleatória que passa na política; setting criado com o valor certo por ambiente e **não sobrescrito** se já existir.

### T10 — Testes unitários

Jest em `apps/api`: `PasswordHasher`, `TokenService`, `CookieService`, `AuthService` (com repositories mockados: ramos de login inexistente/inativo/senha errada, rotação, reuso dentro e fora da janela, change-password), guards (cada um isolado, incluindo `OriginGuard` com e sem `Origin`). **Aceite:** verdes; cada regra da seção 4 tem ao menos um teste.

### T11 — Testes de integração

Usar a infraestrutura da F1/T14 (`createTestApp`, `resetDatabase`, guard `_test`). Casos obrigatórios (nome do `it` em pt-BR):

| Grupo                | Casos                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cadastro             | cria e autentica; cookies com flags; 409 e-mail duplicado; e-mail normalizado; senha fraca → 400 com issues zod; cadastro desligado → 403; ausência do setting → 403; role sempre `user` mesmo se o corpo enviar `role`                                                                                                                                                          |
| Login                | sucesso; senha errada e e-mail inexistente com **mesmo corpo e status**; usuário inativo → 401; `last_login_at` atualizado                                                                                                                                                                                                                                                       |
| Me                   | com cookie ok; sem cookie 401; token adulterado 401; token expirado → `AUTH_TOKEN_EXPIRED` (assinar com `exp` no passado); sessão revogada → 401                                                                                                                                                                                                                                 |
| Refresh              | rotaciona (cookie novo ≠ antigo, sessão antiga com `revoked_at`); mesma família; reuso fora da janela revoga família (todas as sessões da família com `revoked_at`) e `me` com o access dessa família passa a 401; reuso dentro da janela → 401 sem revogar a família; cookie ausente → `AUTH_REFRESH_INVALID`; sessão expirada → idem; usuário desativado entre refreshes → 401 |
| Logout               | revoga sessão; cookies limpos (`Max-Age=0`); sem cookie → 204; refresh depois do logout → 401                                                                                                                                                                                                                                                                                    |
| Change-password      | sucesso revoga as outras sessões e mantém login com cookies novos; senha atual errada 422; nova igual 422; zera `must_change_password`; login com a senha antiga falha                                                                                                                                                                                                           |
| must_change_password | admin recém-semeado: `me` 200, `change-password` 200, rota protegida qualquer → 403 `AUTH_MUST_CHANGE_PASSWORD`, `logout` 204                                                                                                                                                                                                                                                    |
| Papéis               | rota de teste com `@Roles('admin')` (controller de teste registrado só no ambiente de teste): admin 200, user 403, anônimo 401                                                                                                                                                                                                                                                   |
| CSRF                 | POST com `Origin` errada → 403; `Origin` correta → ok; sem `Origin` → ok; GET com `Origin` errada → ok                                                                                                                                                                                                                                                                           |
| Throttler            | todos os cenários da T8                                                                                                                                                                                                                                                                                                                                                          |
| Banco                | cascade: apagar usuário remove sessões; `refresh_token_hash` nunca igual ao token enviado                                                                                                                                                                                                                                                                                        |
| Segurança            | resposta do login não contém `password`/`hash`/token no corpo; nenhum log contém a senha ou o token (capturar logs do pino no teste)                                                                                                                                                                                                                                             |

**Aceite:** todos verdes localmente **e** no job de integração do CI.

### T12 — Swagger e documentação

Decorators do Swagger (via os helpers zod da F1, `cleanupOpenApiDoc`) nos 6 endpoints, incluindo respostas de erro e a descrição de cookies (`ApiCookieAuth`). Criar `docs/auth.md` (fluxo, cookies, rotação/reuso, throttler, seed, variáveis, como proteger uma rota nova com `@Roles`/`@Public`, limitações aceitas da seção 4). Acrescentar uma linha em `AGENTS.md` apontando para `docs/auth.md` e a regra "toda rota nova é protegida por padrão; `@Public()` exige justificativa em comentário de uma linha". **Aceite:** `/api/docs` (dev) lista os endpoints; links do doc válidos.

### T13 — Fechamento

1. Rodar do zero: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, testes de integração, `pnpm build`.
2. Conferir a Definição de Pronto (seção 11).
3. `git push`, abrir PR (base conforme prompt de execução), aguardar os **dois jobs de CI verdes** (se falharem, corrigir e repetir; máx. 3 ciclos), **não fazer merge**.
4. Produzir o relatório (seção 11 de formato).

## 8. Dependências permitidas

`@nestjs/jwt`, `@nestjs/throttler`, `@nest-lab/throttler-storage-redis`, `cookie-parser`, `@types/cookie-parser`, `bcrypt`, `bcryptjs` (fallback), `@types/bcrypt`. Qualquer outra → parada (c), salvo utilitário de teste já presente no repositório.

## 9. Decisões delegadas ao agente (decidir e registrar, sem perguntar)

Nomes internos de classes/arquivos seguindo o padrão do repositório · estrutura exata dos DTOs de resposta de teste · forma da transação (helper da F1 ou `db.transaction`) · escolha bcrypt/bcryptjs (T1.2) · escolha storage do throttler (T8.2) · ordem dos testes · mensagens pt-BR (curtas, sem jargão).

## 10. Armadilhas conhecidas

1. Guard global + `/health`: esquecer o `@Public()` quebra o health check e o CI.
2. `ThrottlerGuard` roda **antes** do pipe de validação: ler `req.body.email` com cuidado (string? senão usar só o IP).
3. Cookie `Secure` em HTTP local: por isso `COOKIE_SECURE=false` em dev/teste.
4. `Path=/api/auth` do refresh: a rota de refresh e logout **precisam** estar sob esse prefixo.
5. Rotação em transação: sem isso, duas requisições simultâneas criam duas sessões filhas.
6. bcrypt trunca silenciosamente em 72 bytes: por isso a validação rejeita.
7. Testes de integração compartilham Redis: sempre `resetThrottle()` no `beforeEach`.
8. Não logar corpo de requisições de auth; conferir a redação do pino da F1.
9. `keys:rotate` agora invalida sessões; o aviso precisa dizer isso.

## 11. Definição de Pronto e relatório

**Pronto quando:** (1) T1–T13 `feita` (ou `parcial` com pendência registrada e justificada); (2) lint, typecheck, build, testes unitários e de integração verdes localmente; (3) dois jobs de CI verdes no PR; (4) migrations atômicas com prova; (5) nenhum `process.env` fora de `config/`; (6) nenhuma senha/token/hash em logs ou respostas; (7) `docs/auth.md` e `AGENTS.md` atualizados; (8) seed idempotente provado; (9) matriz da T11 inteira implementada; (10) `docs/specs/F2-progresso.md` completo; (11) PR aberto, sem merge.

**Formato do relatório final** (curto, em pt-BR): tabela T1–T13 com status e commit · decisões tomadas (incluindo bcrypt/bcryptjs e storage do throttler) · pendências e testes não resolvidos · desvios da spec e motivo · link do PR e status dos jobs · comandos para validar manualmente (5 linhas).

## 12. Modelo do arquivo de progresso (`docs/specs/F2-progresso.md`)

```markdown
# Progresso da F2

Spec: docs/specs/F2-autenticacao.md · Numeração fixa T1–T13 · Retome da primeira tarefa não concluída, sem pedir confirmação.

| T   | Tarefa                             | Status (pendente/em andamento/feita/parcial) | Commit | Observações |
| --- | ---------------------------------- | -------------------------------------------- | ------ | ----------- |
| T1  | Dependências, ambiente e chaves    | pendente                                     |        |             |
| T2  | Contratos em shared                | pendente                                     |        |             |
| T3  | Entities e migrations              | pendente                                     |        |             |
| T4  | Repositories                       | pendente                                     |        |             |
| T5  | Serviços de infraestrutura de auth | pendente                                     |        |             |
| T6  | AuthService e AuthController       | pendente                                     |        |             |
| T7  | Guards e decorators                | pendente                                     |        |             |
| T8  | Throttler com Redis                | pendente                                     |        |             |
| T9  | Seed do admin                      | pendente                                     |        |             |
| T10 | Testes unitários                   | pendente                                     |        |             |
| T11 | Testes de integração               | pendente                                     |        |             |
| T12 | Swagger e documentação             | pendente                                     |        |             |
| T13 | Fechamento                         | pendente                                     |        |             |

## Decisões tomadas

| Data | Decisão | Motivo |
| ---- | ------- | ------ |

## Pendências

| T   | Descrição | Tentativas |
| --- | --------- | ---------- |

## Evidências de aceite

| T   | Comando ou prova | Resultado |
| --- | ---------------- | --------- |
```
