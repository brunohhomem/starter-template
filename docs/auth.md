# Autenticação

## Fluxo

1. **Cadastro** (`POST /api/auth/register`): cria usuário com `role=user`, inicia sessão, seta cookies.
2. **Login** (`POST /api/auth/login`): valida credenciais, cria nova sessão (nova `family_id`), seta cookies.
3. **Uso autenticado**: enviar cookie `access_token` automaticamente (httpOnly — gerenciado pelo browser).
4. **Renovação** (`POST /api/auth/refresh`): quando o access expirar (15 min), usar o `refresh_token` para obter novos cookies.
5. **Logout** (`POST /api/auth/logout`): revoga a sessão. Sempre retorna 204.

## Cookies

| Cookie          | Path        | Duração | Flags                             |
| --------------- | ----------- | ------- | --------------------------------- |
| `access_token`  | `/`         | 15 min  | `HttpOnly; SameSite=Lax; Secure`* |
| `refresh_token` | `/api/auth` | 7 dias  | `HttpOnly; SameSite=Lax; Secure`* |

*`Secure` ativo quando `COOKIE_SECURE=true` (padrão em produção, desativado em dev/teste).

Limpar cookies = mesmo nome, path e flags com `Max-Age=0`. Sem atributo `Domain` (host-only).

## Rotação e detecção de reuso do refresh token

- Cada `POST /auth/refresh` **revoga a sessão antiga** (`replaced_by_session_id`) e cria uma nova com a mesma `family_id`.
- **Reuso fora da janela de tolerância (10 s)**: revoga toda a família → `AUTH_REFRESH_REUSED`.
- **Reuso dentro da janela (10 s)**: apenas 401 sem revogar a família — evita falso positivo com múltiplas abas abrindo simultaneamente.

## Throttler

| Endpoint                        | Limite | Janela | Bloqueio | Chave       |
| ------------------------------- | ------ | ------ | -------- | ----------- |
| Todas as rotas (`default`)      | 120    | 60 s   | —        | IP          |
| `POST /auth/login`              | 5      | 15 min | 15 min   | IP + e-mail |
| `POST /auth/register`           | 5      | 60 min | 60 min   | IP          |
| `POST /auth/refresh`            | 30     | 60 s   | —        | IP          |
| `POST /auth/change-password`    | 5      | 15 min | 15 min   | userId      |
| `POST /auth/password/forgot`    | 3      | 60 min | 60 min   | IP + e-mail |
| `POST /auth/email/confirm`      | 10     | 15 min | 15 min   | IP          |
| `POST /auth/password/reset`     | 10     | 15 min | 15 min   | IP          |
| `POST /auth/invitations/accept` | 10     | 15 min | 15 min   | IP          |
| `POST /auth/email/resend`       | 3      | 60 min | 60 min   | userId      |
| `POST /auth/invitations`        | 20     | 60 min | —        | userId      |

Resposta 429 inclui header `Retry-After` (segundos) e `code: RATE_LIMITED`.
Redis indisponível: falha aberta — a requisição é permitida e um `warn` é logado.

## Seed do admin

```bash
pnpm db:seed
```

Comportamento idempotente:

- **Admin já existe**: não faz nada (não sobrescreve senha).
- **Admin não existe**: cria com `role=admin`, `must_change_password=true`, `email_verified_at=now()`.
  - `NODE_ENV=development`: senha fixa `Admin@12345`.
  - Outros ambientes: usa `ADMIN_INITIAL_PASSWORD` se definida; senão gera 24 chars aleatórios e **imprime uma única vez** no stdout.
- Insere `registration_enabled` em `system_settings` (`true` em dev/test, `false` em produção) **somente se não existir**.

## Variáveis de ambiente

| Variável                           | Obrigatório | Padrão                  | Descrição                                                                                                        |
| ---------------------------------- | ----------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `JWT_ACCESS_SECRET`                | sim         | —                       | Segredo HS256 ≥ 32 chars. `pnpm keys:generate` cria se ausente. **Rotacionar invalida todas as sessões ativas.** |
| `ADMIN_EMAIL`                      | sim         | —                       | E-mail do administrador inicial                                                                                  |
| `WEB_ORIGIN`                       | sim         | `http://localhost:3000` | Origin permitida para verificação CSRF. Sem barra final.                                                         |
| `ADMIN_INITIAL_PASSWORD`           | não         | —                       | Senha inicial do admin em produção                                                                               |
| `COOKIE_SECURE`                    | não         | `true` em prod          | Ativa flag `Secure` nos cookies                                                                                  |
| `TRUST_PROXY_HOPS`                 | não         | `0`                     | Número de proxies reversos confiáveis (1 atrás do Nginx)                                                         |
| `AUTH_ACCESS_TTL_MINUTES`          | não         | `15`                    | TTL do access token (1–120)                                                                                      |
| `AUTH_REFRESH_TTL_DAYS`            | não         | `7`                     | TTL do refresh token (1–90)                                                                                      |
| `AUTH_REFRESH_REUSE_GRACE_SECONDS` | não         | `10`                    | Janela de tolerância para reuso (0–60)                                                                           |
| `AUTH_BCRYPT_ROUNDS`               | não         | `12`                    | Rounds do bcrypt (use `4` em testes)                                                                             |

## Como proteger uma rota nova

Por padrão, **toda rota é protegida** pelo `JwtAuthGuard` global. Não é necessário nenhum decorator adicional.

**Exigir papel específico:**

```ts
@Roles('admin')
@Get('admin-only')
async adminRoute() { ... }
```

**Tornar pública (sem autenticação):**

```ts
// endpoint público: health check, não carrega dados sensíveis
@Public()
@Get('health')
async health() { ... }
```

> **Regra:** `@Public()` exige justificativa em comentário de uma linha imediatamente acima do decorator. Toda rota nova é protegida por padrão.

## Rotas de e-mail e convite (F3)

| Rota                            | Acesso      | HTTP | Descrição                                                   |
| ------------------------------- | ----------- | ---: | ----------------------------------------------------------- |
| `POST /auth/email/confirm`      | público     |  204 | Confirma o e-mail com o token do link                       |
| `POST /auth/email/resend`       | autenticado |  202 | Reenvia e-mail de confirmação (erro 409 se já confirmado)   |
| `POST /auth/password/forgot`    | público     |  202 | Solicita link de reset (sempre 202 — anti-enumeração)       |
| `POST /auth/password/reset`     | público     |  204 | Redefine a senha; revoga todas as sessões                   |
| `POST /auth/invitations`        | admin       |  201 | Convida um e-mail; retorna `{ id, email, role, expiresAt }` |
| `POST /auth/invitations/accept` | público     |  200 | Aceita o convite, define senha, inicia sessão               |

## Configurações (`/settings`)

| Rota                   | Acesso  | HTTP | Descrição                                        |
| ---------------------- | ------- | ---: | ------------------------------------------------ |
| `GET /settings/public` | público |  200 | `{ registrationEnabled }` — usado pelo frontend  |
| `GET /settings`        | admin   |  200 | Todas as configurações                           |
| `PATCH /settings`      | admin   |  200 | Atualiza `registrationEnabled`; audita a mudança |

## Limitações aceitas

- Mudança de papel ou desativação de usuário vale no **próximo refresh** (≤ 15 min) — o access token já emitido permanece válido.
- O token de e-mail trafega no payload da fila BullMQ e no link do e-mail — risco aceito; veja `docs/email.md`.
