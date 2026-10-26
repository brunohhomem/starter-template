# Spec F3 — E-mail, fluxos de token, configurações e auditoria

> Spec executada. O fluxo vigente está no ADR 0002 e em `AGENTS.md`. O procedimento antigo de gerente ficou arquivado em `docs/specs/arquivo/`.

Versão: 1 · Depende de: **F2 concluída** (auth, sessões, guards, throttler, seed) · ADR: `docs/adr/0001-template-base-monorepo.md`

---

## 1. Objetivo

Entregar e-mail transacional e os fluxos que dependem dele: **confirmação de e-mail, recuperação de senha e convite**, via fila BullMQ com worker separado; **serviço e controller de `system_settings`** (liga/desliga do cadastro); **trilha de auditoria**; **limpeza periódica** de sessões e tokens expirados; e a API de **envio direto** (`MailService.sendNow`) que a F7 usará para mandar a chave do backup **fora da fila**.

## 2. Fora de escopo

Qualquer código em `apps/web` (F5/F6) · bloquear login de e-mail não confirmado (decisão 3.1) · troca de e-mail do usuário · notificações por outros canais · e-mails de marketing · backup (F7) · 2FA (F9).

## 3. Decisões já tomadas (não perguntar, não rediscutir)

| #    | Tema                    | Decisão                                                                                                                                                                                                                                                      |
| ---- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3.1  | Confirmação de e-mail   | Só marca `users.email_verified_at`. **Não bloqueia login.** `emailVerified` já é exposto por `/auth/me`                                                                                                                                                      |
| 3.2  | Drivers de e-mail       | `smtp` (Mailpit em dev, via `nodemailer`), `resend` (produção, SDK `resend`) e `memory` (somente `NODE_ENV=test`, guarda mensagens em memória para os testes). Interface única `MailTransport`                                                               |
| 3.3  | Produção                | `NODE_ENV=production` exige `MAIL_DRIVER=resend` e `RESEND_API_KEY`; qualquer outra combinação falha na subida                                                                                                                                               |
| 3.4  | Tokens de e-mail        | 32 bytes aleatórios, base64url. No banco só o **hash SHA-256 (hex)**. Uso único. Consumo **atômico** (um `UPDATE … WHERE used_at IS NULL AND expires_at > now() RETURNING`)                                                                                  |
| 3.5  | Token no payload do job | O job carrega o token em claro (o e-mail precisa do link). Mitigação obrigatória: `removeOnComplete: true`, `removeOnFail: { age: 3600 }`, no máximo 5 tentativas com backoff exponencial de 10 s (tudo termina em menos de 1 h). Risco aceito e documentado |
| 3.6  | Worker                  | Processo **separado** (`apps/api/src/worker.ts`, `NestFactory.createApplicationContext`). A API só **enfileira**; nunca processa. Em testes, o worker sobe dentro do processo do teste                                                                       |
| 3.7  | Falha ao enfileirar     | Não derruba a operação principal (cadastro, forgot). Loga `warn` sem dados pessoais e segue                                                                                                                                                                  |
| 3.8  | Anti-enumeração         | `POST /auth/password/forgot` responde **sempre 202** com o mesmo corpo, exista a conta ou não, e sem esperar o envio                                                                                                                                         |
| 3.9  | Reset de senha          | Troca o hash, zera `must_change_password`, **revoga todas as sessões** do usuário, invalida os outros tokens de reset dele. Resposta 204, **sem login automático**                                                                                           |
| 3.10 | Convite                 | Admin informa e-mail e papel. Cria o usuário com senha aleatória inalcançável (hash de 32 bytes aleatórios), `must_change_password=false`, `is_active=true`, `email_verified_at=null`. O aceite define a senha, confirma o e-mail e **autentica** (cookies)  |
| 3.11 | Cadastro                | O `register` da F2 passa a enfileirar a confirmação. O usuário continua autenticado ao se cadastrar                                                                                                                                                          |
| 3.12 | Idioma                  | E-mails em pt-BR, texto puro + HTML, sem imagens externas                                                                                                                                                                                                    |
| 3.13 | Segurança de template   | Nenhum valor vindo do usuário entra como HTML. React Email escapa por padrão; proibido `dangerouslySetInnerHTML`                                                                                                                                             |
| 3.14 | Auditoria               | Tabela `audit_logs` só de **ação administrativa e de segurança**. Nunca grava senha, token, hash nem corpo de requisição                                                                                                                                     |
| 3.15 | Settings                | `GET /settings/public` é público e só devolve `registrationEnabled`. O resto é admin                                                                                                                                                                         |
| 3.16 | Limpeza                 | Job diário no worker: apaga sessões expiradas há mais de 7 dias e tokens de e-mail expirados há mais de 7 dias                                                                                                                                               |
| 3.17 | Links                   | Montados com `WEB_ORIGIN`: `/confirm-email?token=`, `/reset-password?token=`, `/accept-invite?token=`. As páginas existem na F5/F6; aqui o link só precisa ser correto                                                                                       |

## 4. Referência R1 — Variáveis de ambiente (estender o schema existente)

| Variável                     | Obrigatória            | Padrão                                           | Validação                                            |
| ---------------------------- | ---------------------- | ------------------------------------------------ | ---------------------------------------------------- |
| `MAIL_DRIVER`                | não                    | `smtp`                                           | `smtp` \| `resend` \| `memory` (regras 3.2 e 3.3)    |
| `MAIL_FROM`                  | sim                    | `Starter <no-reply@localhost>` no `.env.example` | formato `Nome <e-mail>` ou e-mail                    |
| `APP_NAME`                   | não                    | `Starter Template`                               | string 1–60                                          |
| `SMTP_HOST`                  | não                    | `localhost`                                      | string                                               |
| `SMTP_PORT`                  | não                    | `1025`                                           | inteiro 1–65535                                      |
| `RESEND_API_KEY`             | só com driver `resend` | —                                                | string não vazia; **não** gerada por `keys:generate` |
| `EMAIL_CONFIRM_TTL_HOURS`    | não                    | `24`                                             | inteiro 1–168                                        |
| `PASSWORD_RESET_TTL_MINUTES` | não                    | `30`                                             | inteiro 5–240                                        |
| `INVITE_TTL_DAYS`            | não                    | `7`                                              | inteiro 1–30                                         |

Regras herdadas: falha rápida listando **todos** os problemas sem imprimir valores; nenhum `process.env` fora de `config/`; `.env.example` ganha todas as chaves; ambiente de teste usa `MAIL_DRIVER=memory`. Redis do BullMQ usa `REDIS_HOST`, `REDIS_PORT` e a senha já existentes, com conexão **própria** (`maxRetriesPerRequest: null`).

## 5. Referência R2 — Banco

**Enum** `email_token_type`: `'email_confirmation' | 'password_reset' | 'invite'`.

**`email_tokens`** (`coreColumns`):

| Coluna       | Tipo               | Regras                                                |
| ------------ | ------------------ | ----------------------------------------------------- |
| `user_id`    | uuid               | FK `users.id` **on delete cascade**, not null, índice |
| `type`       | `email_token_type` | not null                                              |
| `token_hash` | text               | not null, **unique**                                  |
| `expires_at` | timestamptz        | not null, índice                                      |
| `used_at`    | timestamptz        | null                                                  |

**`audit_logs`** (`coreColumns`):

| Coluna          | Tipo  | Regras                                             |
| --------------- | ----- | -------------------------------------------------- |
| `actor_user_id` | uuid  | FK `users.id` **on delete set null**, null, índice |
| `action`        | text  | not null, índice                                   |
| `target_type`   | text  | null                                               |
| `target_id`     | text  | null                                               |
| `metadata`      | jsonb | not null, default `{}`                             |
| `ip`            | text  | null                                               |

Migrations (nomes pela regra da F1): `create_email_tokens`, `create_audit_logs`. Cada uma atômica, com a prova de atomicidade da F1 repetida.

## 6. Referência R3 — Contratos em `packages/shared/src/` (pt-BR nas mensagens)

| Export                          | Definição                                                                                                                                                                     |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tokenSchema`                   | `z.string().min(32).max(128)` (base64url)                                                                                                                                     |
| `confirmEmailRequestSchema`     | `{ token }`                                                                                                                                                                   |
| `forgotPasswordRequestSchema`   | `{ email: emailSchema }`                                                                                                                                                      |
| `forgotPasswordResponseSchema`  | `{ message: string }` · texto fixo: `"Se o e-mail estiver cadastrado, enviaremos as instruções."`                                                                             |
| `resetPasswordRequestSchema`    | `{ token, newPassword: passwordSchema }`                                                                                                                                      |
| `createInvitationRequestSchema` | `{ email: emailSchema, role: z.enum(USER_ROLES) }`                                                                                                                            |
| `invitationResponseSchema`      | `{ id: uuid, email, role, expiresAt: string (ISO) }`                                                                                                                          |
| `acceptInvitationRequestSchema` | `{ token, password: passwordSchema }`                                                                                                                                         |
| `settingsResponseSchema`        | `{ registrationEnabled: boolean }`                                                                                                                                            |
| `publicSettingsResponseSchema`  | `{ registrationEnabled: boolean }`                                                                                                                                            |
| `updateSettingsRequestSchema`   | `{ registrationEnabled: boolean.optional() }` com `.refine` exigindo ao menos um campo                                                                                        |
| `auditLogSchema`                | `{ id, actorUserId: uuid\|null, action: string, targetType: string\|null, targetId: string\|null, metadata: record, ip: string\|null, createdAt: string }`                    |
| `auditLogsQuerySchema`          | `paginationQuerySchema` estendido com `action?: string`                                                                                                                       |
| `auditLogsResponseSchema`       | `paginatedResponseSchema(auditLogSchema)`                                                                                                                                     |
| `AUDIT_ACTIONS`                 | `settings.registration_changed`, `auth.password_reset_requested`, `auth.password_reset_completed`, `auth.email_confirmed`, `auth.invitation_sent`, `auth.invitation_accepted` |

Códigos de erro novos (acrescentar a `AUTH_ERROR_CODES`):

| `code`                         | HTTP | Quando                                                                    |
| ------------------------------ | ---- | ------------------------------------------------------------------------- |
| `AUTH_EMAIL_TOKEN_INVALID`     | 400  | token inexistente, expirado, já usado ou de outro tipo (**um código só**) |
| `AUTH_INVITE_EMAIL_TAKEN`      | 409  | convite para e-mail que já tem conta                                      |
| `AUTH_EMAIL_ALREADY_CONFIRMED` | 409  | pedir reenvio de confirmação para e-mail já confirmado                    |

## 7. Referência R4 — Endpoints (prefixo `/api`)

| Método e rota                   | Acesso      | Corpo                     | Sucesso                      | Efeito                                                               |
| ------------------------------- | ----------- | ------------------------- | ---------------------------- | -------------------------------------------------------------------- |
| `POST /auth/email/confirm`      | público     | `confirmEmailRequest`     | 204                          | consome token `email_confirmation`, seta `email_verified_at`, audita |
| `POST /auth/email/resend`       | autenticado | vazio                     | 202                          | invalida confirmações anteriores, emite e enfileira novo             |
| `POST /auth/password/forgot`    | público     | `forgotPasswordRequest`   | 202 `forgotPasswordResponse` | se existe e ativo: emite token, enfileira, audita                    |
| `POST /auth/password/reset`     | público     | `resetPasswordRequest`    | 204                          | regra 3.9, audita                                                    |
| `POST /auth/invitations`        | admin       | `createInvitationRequest` | 201 `invitationResponse`     | regra 3.10, enfileira, audita                                        |
| `POST /auth/invitations/accept` | público     | `acceptInvitationRequest` | 200 `authResponse` + cookies | consome `invite`, define senha, confirma e-mail, cria sessão, audita |
| `GET /settings/public`          | público     | —                         | 200 `publicSettingsResponse` | —                                                                    |
| `GET /settings`                 | admin       | —                         | 200 `settingsResponse`       | —                                                                    |
| `PATCH /settings`               | admin       | `updateSettingsRequest`   | 200 `settingsResponse`       | grava, audita com `metadata: { from, to }`                           |
| `GET /audit-logs`               | admin       | query `auditLogsQuery`    | 200 `auditLogsResponse`      | ordenado por `created_at` desc                                       |

**Throttlers novos** (mesma infraestrutura da F2):

| Nome           | Rota                         | Limite | Janela | Bloqueio | Chave       |
| -------------- | ---------------------------- | ------ | ------ | -------- | ----------- |
| `forgot`       | `POST /auth/password/forgot` | 3      | 60 min | 60 min   | IP + e-mail |
| `token-submit` | `confirm`, `reset`, `accept` | 10     | 15 min | 15 min   | IP          |
| `resend`       | `POST /auth/email/resend`    | 3      | 60 min | 60 min   | userId      |
| `invite`       | `POST /auth/invitations`     | 20     | 60 min | não      | userId      |

**Fila** (`mail`): jobs `send-email-confirmation`, `send-password-reset`, `send-invite`. Payload validado com zod **no processor** (entrada tratada como `unknown`): `{ to: email, token: string, expiresAt: ISO string }`. Opções: `attempts: 5`, `backoff: { type: 'exponential', delay: 10000 }`, `removeOnComplete: true`, `removeOnFail: { age: 3600 }`. Erro 4xx do Resend ou e-mail inválido lança `UnrecoverableError`. **Fila** `maintenance`: job repetível `cleanup-expired`, cron `0 6 * * *` (UTC), registrado no boot do worker, idempotente (ver tarefa T6 sobre a API de job scheduler da versão instalada).

**Textos (pt-BR)**

| Template             | Assunto                                | Corpo (essencial)                                                                                                       |
| -------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `email-confirmation` | `Confirme seu e-mail`                  | saudação, botão "Confirmar e-mail" com o link, validade em horas, "Se você não criou esta conta, ignore esta mensagem." |
| `password-reset`     | `Redefinição de senha`                 | botão "Redefinir senha", validade em minutos, "Se você não pediu, ignore. Sua senha continua a mesma."                  |
| `invite`             | `Você foi convidado para o {APP_NAME}` | botão "Aceitar convite", validade em dias                                                                               |

Todos terminam com o nome do app e repetem o link em texto puro.

## 8. Cartões de tarefa

Ordem fixa. **Numeração fixa T1–T14.** Campos de cada cartão:

- **Incluir no prompt**: blocos de referência que o gerente cola inline.
- **Escopo de arquivos**: o executor só pode criar/alterar estes caminhos (padrão do repositório prevalece sobre os nomes lógicos; localizar módulos existentes com `grep`). Qualquer outro arquivo alterado reprova a tarefa.
- **Aceite**: comandos que devem passar e comportamentos verificáveis.
- **Commit**: mensagem Conventional Commits.

### T1 — Dependências, ambiente e transportes de e-mail

- **Incluir:** R1.
- **Fazer:** instalar em `apps/api`: `bullmq`, `nodemailer`, `@types/nodemailer` (dev), `resend`, `react`, `react-dom`, `@react-email/components`, `@react-email/render`, `@types/react` (dev). Estender o schema de ambiente e `.env.example` (R1), incluindo a regra 3.3. Criar `MailTransport` (`send({ to, subject, html, text }) → Promise<void>`), `SmtpTransport`, `ResendTransport`, `MemoryTransport` (lista `sent` + `clear()`), e `MailService.sendNow(message)` que usa o transporte da config. Provider escolhe o driver pela config. Habilitar `jsx: react-jsx` no tsconfig da API.
- **Escopo:** `apps/api/src/config/**`, `apps/api/src/modules/mail/**`, `apps/api/package.json`, `apps/api/tsconfig*.json`, `pnpm-lock.yaml`, `.env.example`.
- **Aceite:** `pnpm lint`, `pnpm typecheck`; testes unitários: seleção de driver, `memory` recusado fora de `test`, produção sem `resend` falha listando o problema sem valores, `MemoryTransport` acumula e limpa, `ResendTransport` com SDK mockado (erro 4xx vira erro não recuperável classificável).
- **Commit:** `feat(api): add mail transports and config`

### T2 — Contratos em `packages/shared`

- **Incluir:** R3.
- **Fazer:** implementar todos os exports e os códigos novos; testes Vitest cobrindo: `updateSettingsRequest` vazio rejeitado, `forgotPasswordResponse` com texto fixo exportado como constante, `auditLogsQuery` herda limites de paginação.
- **Escopo:** `packages/shared/src/**`.
- **Aceite:** `pnpm --filter shared test`, `pnpm --filter shared build`, `pnpm typecheck`.
- **Commit:** `feat(shared): add email, settings and audit contracts`

### T3 — Entities e migrations

- **Incluir:** R2.
- **Fazer:** entities `email_tokens` e `audit_logs` no padrão das entities da F2, exportadas no schema central; gerar as migrations com os nomes de R2 usando o `db:generate` do projeto; repetir a prova de atomicidade.
- **Escopo:** `apps/api/src/database/**` (entities, migrations, meta).
- **Aceite:** `pnpm db:migrate` em banco limpo cria as tabelas; teste de integração: `uuid_extract_version(id)=7`, unique de `token_hash`, cascade ao apagar usuário, `set null` do `actor_user_id`; prova de atomicidade registrada no progresso.
- **Commit:** `feat(api): add email_tokens and audit_logs tables`

### T4 — Repositories

- **Incluir:** R2 e a assinatura abaixo.
- **Fazer:** `EmailTokensRepository`: `create(userId, type, tokenHash, expiresAt)`, `consume(tokenHash, type)` (UPDATE atômico retornando o registro ou `null`), `invalidateByUserAndType(userId, type)` (marca `used_at`), `deleteExpiredBefore(date)`. `AuditLogsRepository`: `create(entry)`, `list({ page, pageSize, action })` retornando itens + total no formato de paginação da F1. Adicionar ao `SessionsRepository` o que faltar para `deleteExpired(before)` (já existe na F2: apenas reutilizar).
- **Escopo:** `apps/api/src/modules/email-tokens/**`, `apps/api/src/modules/audit/**`.
- **Aceite:** testes de integração por método; **dois `consume` concorrentes do mesmo hash: exatamente um retorna registro**; `consume` com tipo errado, expirado ou já usado retorna `null`.
- **Commit:** `feat(api): add email tokens and audit repositories`

### T5 — Templates React Email

- **Incluir:** a tabela de textos de R4 e as decisões 3.12 e 3.13.
- **Fazer:** layout base + 3 templates em `.tsx`; função pura `renderEmail(template, props) → { subject, html, text }` com props tipadas (`appName`, `link`, `expiresInLabel`, `recipientName?`). `expiresInLabel` é calculado fora do template (ex.: "24 horas", "30 minutos", "7 dias"; singular correto).
- **Escopo:** `apps/api/src/modules/mail/templates/**`.
- **Aceite:** testes unitários: HTML contém o link e o botão; texto puro contém o link; valor com `<script>` em `appName` aparece escapado; assunto correto por template; singular/plural do rótulo de validade.
- **Commit:** `feat(api): add transactional email templates`

### T6 — Fila, processor, worker e limpeza

- **Incluir:** R1 (trecho Redis), decisões 3.5–3.7 e 3.16, bloco "Fila" de R4.
- **Fazer:** `MailQueueService.enqueue(job)` (produtor, na API); `MailProcessor` (consumidor) que valida o payload com zod, monta o link com `WEB_ORIGIN`, renderiza e chama `MailService.sendNow`; `WorkerModule` e `apps/api/src/worker.ts`; scripts `worker` e `worker:dev` no `package.json` da API; fila `maintenance` com o job `cleanup-expired`. **Verifique a API de agendamento repetível da versão instalada do BullMQ** (`upsertJobScheduler` nas v5 recentes; fallback `add` com `repeat`) e use a existente. Helper de teste `startTestWorker()` que sobe o worker no processo do teste e usa prefixo de fila único por suíte.
- **Escopo:** `apps/api/src/modules/mail/**`, `apps/api/src/modules/maintenance/**`, `apps/api/src/worker.ts`, `apps/api/test/**` (apenas helpers), `apps/api/package.json`.
- **Aceite:** testes de integração com Redis real e `MemoryTransport`: job processado entrega 1 mensagem; payload inválido não envia e vai para falha sem retry; erro recuperável retenta (mock que falha 2 vezes e passa); erro irrecuperável não retenta; após completar, **o job não existe mais no Redis**; `cleanup-expired` apaga sessões e tokens vencidos há mais de 7 dias e preserva os recentes; registrar o scheduler duas vezes não duplica.
- **Commit:** `feat(api): add mail queue, worker and cleanup job`

### T7 — `EmailTokensService`

- **Incluir:** decisões 3.4 e R2 (tabela `email_tokens`), TTLs de R1.
- **Fazer:** `issue(userId, type)` → `{ token, expiresAt }` (gera, grava hash, devolve o token em claro uma única vez); `consume(token, type)` → `userId` ou lança `AUTH_EMAIL_TOKEN_INVALID`; TTL por tipo vindo da config; `invalidate(userId, type)`.
- **Escopo:** `apps/api/src/modules/email-tokens/**`.
- **Aceite:** unitários: token tem ≥ 43 chars base64url, hash no banco ≠ token, TTL certo por tipo; integração: consumo duplo falha na segunda, tipo trocado falha.
- **Commit:** `feat(api): add email tokens service`

### T8 — Fluxo de confirmação de e-mail

- **Incluir:** R3 (confirm), R4 (linhas `confirm`, `resend`, throttlers `token-submit` e `resend`), decisões 3.1, 3.7, 3.11, e códigos de erro.
- **Fazer:** no `register` da F2, após criar o usuário, emitir token `email_confirmation` e enfileirar (falha só loga). `POST /auth/email/confirm` e `POST /auth/email/resend`. Registrar os dois throttlers.
- **Escopo:** `apps/api/src/modules/auth/**`, `apps/api/src/modules/mail/**` (apenas o necessário para enfileirar), `apps/api/src/app.module.ts`.
- **Aceite:** integração (worker de teste + `MemoryTransport`): cadastro gera 1 e-mail com link `WEB_ORIGIN/confirm-email?token=…`; confirmar com o token marca `email_verified_at`; reutilizar o token → 400; token expirado (forçar `expires_at` no passado) → 400; reenvio invalida o token anterior e envia outro; reenvio para conta já confirmada → 409; 4º reenvio na hora → 429; falha do Redis na fila **não** impede o cadastro; testes da F2 continuam verdes.
- **Commit:** `feat(api): add email confirmation flow`

### T9 — Fluxo de recuperação de senha

- **Incluir:** R3 (forgot, reset), R4 (linhas `forgot`, `reset`, throttlers `forgot` e `token-submit`), decisões 3.8 e 3.9.
- **Fazer:** `POST /auth/password/forgot` e `POST /auth/password/reset`. Resposta do forgot idêntica (status, corpo e headers de interesse) para conta existente, inexistente e inativa; o envio não bloqueia a resposta. No reset: transação única (consumir token, trocar hash, zerar `must_change_password`, revogar todas as sessões, invalidar outros tokens `password_reset`).
- **Escopo:** `apps/api/src/modules/auth/**`.
- **Aceite:** integração: forgot de conta existente → 202 e 1 e-mail; forgot de e-mail inexistente → 202 **com corpo idêntico** e 0 e-mails; conta inativa → 202 e 0 e-mails; reset válido troca a senha, login antigo falha, login novo funciona, **todas as sessões revogadas** (refresh antigo → 401); token reutilizado → 400; dois resets concorrentes com o mesmo token: um 204 e um 400; senha fraca → 400 sem consumir o token; 4º forgot do mesmo IP+e-mail na hora → 429.
- **Commit:** `feat(api): add password recovery flow`

### T10 — Fluxo de convite

- **Incluir:** R3 (convite), R4 (linhas `invitations`, throttler `invite`), decisão 3.10 e códigos.
- **Fazer:** `POST /auth/invitations` (`@Roles('admin')`) e `POST /auth/invitations/accept`. O usuário convidado nasce conforme 3.10; reconvidar um e-mail que tem **convite pendente** (usuário sem `last_login_at` e sem senha definida pelo aceite) invalida o token anterior e reenvia; e-mail com conta ativa → 409.
- **Escopo:** `apps/api/src/modules/auth/**`, `apps/api/src/modules/users/**` (apenas método de criação).
- **Aceite:** integração: admin convida → 201 e 1 e-mail com `/accept-invite?token=`; usuário comum convida → 403; anônimo → 401; aceitar define senha, marca e-mail confirmado, retorna cookies e `me` funciona; o papel convidado é respeitado; token reutilizado → 400; e-mail já ativo → 409; reconvite invalida o token antigo; antes do aceite, login com qualquer senha falha.
- **Commit:** `feat(api): add invitation flow`

### T11 — Auditoria e configurações

- **Incluir:** R3 (settings, audit), R4 (linhas `settings` e `audit-logs`), decisões 3.14 e 3.15, `AUDIT_ACTIONS`.
- **Fazer:** `AuditService.record({ actorUserId, action, targetType, targetId, metadata, ip })` com `metadata` sempre filtrado por uma lista de chaves permitidas (`from`, `to`, `role`, `email`); `SettingsService` e `SettingsController` usando o repository de `system_settings` da F1 (o formato de armazenamento do valor é o já definido lá); `AuditLogsController`. Ligar `record` nos fluxos T8–T10 (`auth.email_confirmed`, `auth.password_reset_requested`, `auth.password_reset_completed`, `auth.invitation_sent`, `auth.invitation_accepted`) e na alteração do cadastro.
- **Escopo:** `apps/api/src/modules/audit/**`, `apps/api/src/modules/settings/**`, `apps/api/src/modules/auth/**` (somente chamadas a `record`), `apps/api/src/app.module.ts`.
- **Aceite:** integração: `GET /settings/public` anônimo 200; `GET /settings` e `PATCH /settings` anônimo 401, usuário 403, admin 200; alterar `registrationEnabled` muda o comportamento do `register` imediatamente (403 `AUTH_REGISTRATION_DISABLED` / 201); cria 1 linha de auditoria com `from`/`to`; `GET /audit-logs` pagina e filtra por `action`; **nenhuma linha de auditoria contém senha, token ou hash** (varrer `metadata` de todos os fluxos); PATCH vazio → 400.
- **Commit:** `feat(api): add settings, audit logs and audit trail`

### T12 — Testes transversais

- **Incluir:** decisões 3.5, 3.7, 3.13 e o bloco "Fila" de R4.
- **Fazer:** suíte de integração extra: (a) payload do job no Redis não contém senha nem hash e o job some após o envio; (b) logs do pino capturados durante todos os fluxos não contêm token, senha nem e-mail completo do destinatário em nível `info`; (c) `MailService.sendNow` entrega direto sem passar pela fila (fila vazia, 1 mensagem) — contrato usado pela F7; (d) e-mail renderizado com nome/e-mail hostil (`"><img src=x onerror=…>`) sai escapado; (e) todos os endpoints novos aparecem no OpenAPI; (f) teste de regressão: toda rota nova sem `@Public()` retorna 401 anônimo.
- **Escopo:** `apps/api/test/**`.
- **Aceite:** `pnpm --filter api test:integration` (nome do script conforme a F1) verde.
- **Commit:** `test(api): add cross-cutting email and security tests`

### T13 — Swagger e documentação

- **Incluir:** R4.
- **Fazer:** decorators do Swagger (helpers zod da F1) nos endpoints novos, com respostas de erro; `docs/email.md` (drivers, fila, worker, como rodar `worker:dev`, fluxos, TTLs, limites, risco aceito do token no payload, como adicionar um template novo, como usar `sendNow`); acrescentar linha ao `AGENTS.md` apontando para `docs/email.md`; atualizar `docs/auth.md` com as rotas novas; atualizar o README (como subir Mailpit e abrir `http://localhost:8025`).
- **Escopo:** `docs/**`, `AGENTS.md`, `README.md`, decorators nos controllers.
- **Aceite:** `/api/docs` lista os endpoints novos; links dos docs válidos; `pnpm lint`.
- **Commit:** `docs: document email, queue and settings`

### T14 — Fechamento (feito pelo gerente, não pelo executor)

1. **Gate pré-PR, integralmente** (seção 6 de `docs/specs/GERENCIA-OPENCODE.md`): checkout limpo, `pnpm install --frozen-lockfile`, format check, lint, typecheck, build com `--force`, testes unitários e de integração, execução local de cada passo dos workflows, árvore limpa ao final. Corrigir o que falhar e repetir o gate inteiro (até 5 ciclos). **Sem gate verde não há `git push` nem PR.**
2. Conferir a Definição de Pronto.
3. Verificação manual com Mailpit real: subir API e worker, cadastrar um usuário, abrir `http://localhost:8025`, ver o e-mail e completar o fluxo do link com `curl`.
4. `git push`, PR (base conforme o prompt de execução), aguardar CI verde (máx. 3 ciclos de correção, cada um seguido do gate completo), **sem merge**.
5. Se o CI real falhar em algo que o gate não pegou, registrar em `docs/specs/CI-LICOES.md` e acrescentar o passo ao gate.
6. Relatório.

## 9. Dependências permitidas

`bullmq`, `nodemailer`, `@types/nodemailer`, `resend`, `react`, `react-dom`, `@types/react`, `@react-email/components`, `@react-email/render`. Qualquer outra → parada (c) do gerente.

## 10. Armadilhas conhecidas

1. BullMQ exige conexão ioredis própria com `maxRetriesPerRequest: null`; reutilizar o cliente da API quebra.
2. Prefixo de fila único por suíte de teste, senão suítes paralelas consomem jobs umas das outras.
3. `forgot` não pode esperar o envio nem variar de tempo conforme a conta existe.
4. `consume` tem que ser um único `UPDATE … RETURNING`; ler e depois atualizar abre corrida.
5. Jobs de limpeza repetíveis duplicam se registrados sem id estável.
6. React Email em `.tsx` exige `jsx: react-jsx`; sem isso o build quebra só no CI.
7. Não logar o token, nem o e-mail completo em `info`.
8. O link usa `WEB_ORIGIN` sem barra duplicada.
9. `memory` driver nunca pode ficar disponível fora de `test`.

## 11. Definição de Pronto

(1) T1–T14 `feita` (ou `parcial` com pendência justificada); (2) **gate pré-PR verde antes de abrir o PR**, com format, lint, typecheck, build sem cache, testes unitários e de integração e os passos dos workflows reproduzidos localmente em checkout limpo; (3) dois jobs de CI verdes; (4) migrations atômicas com prova; (5) verificação manual com Mailpit registrada; (6) nenhuma senha/token/hash em logs, auditoria, resposta ou job concluído; (7) `docs/email.md` pronto; (8) PR aberto, sem merge; (9) `docs/specs/F3-progresso.md` completo.

**Relatório final** (pt-BR, curto): tabela T1–T14 com status e commit · decisões tomadas · intervenções e o porquê · o que ficou de fora · link do PR e CI.
