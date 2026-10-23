# ADR 0001 — Template base de projetos (monorepo)

| Campo                  | Valor                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Status                 | **Arquivado** em 2026-10-23, substituído pelo [ADR 0002](0002-template-enxuto-v1.md)                                            |
| Data                   | 2026-10-21                                                                                                                      |
| Revisão                | v2 (2026-10-21): instruções para IA independentes de ferramenta e `DESIGN.md` (3.14), checklist de responsabilidade única (3.2) |
| Decisor                | Bruno                                                                                                                           |
| Destino no repositório | `docs/adr/0001-template-base-monorepo.md`                                                                                       |

---

## 1. Contexto

Todo projeto novo repete o mesmo trabalho inicial: monorepo, login, cadastro, e-mails, backup, chaves de criptografia, CI/CD e layout. Este ADR define um **template** (repositório base do GitHub, "Template repository") que já nasce com tudo isso pronto, para que um projeto novo comece direto na regra de negócio.

A implementação será feita pelo Cursor, em tarefas pequenas derivadas deste ADR. Nenhuma tarefa é criada antes da aprovação deste documento.

## 2. Objetivos e não-objetivos

**Objetivos**

1. Projeto novo funcionando (login, e-mail, banco, testes, deploy) em minutos, via script de inicialização.
2. Código limpo, com responsabilidade única, reutilizável e legível por humanos, mesmo sendo escrito por IA.
3. Segurança correta por padrão, com recursos opcionais desligados.
4. Mobile-first em toda tela, garantido por teste automatizado.
5. Instruções para agentes de IA independentes de ferramenta (Cursor, Claude Code ou outra), com a garantia real vinda de lint, testes e CI.

**Não-objetivos (fora do template)**

| Item                                                         | Motivo                                                      |
| ------------------------------------------------------------ | ----------------------------------------------------------- |
| Multi-tenant (`organizationId`)                              | Cada projeto estende as colunas base se precisar            |
| i18n                                                         | Interface fixa em pt-BR                                     |
| S3 / MinIO                                                   | Armazenamento local atrás de uma interface, trocável depois |
| Sentry e observabilidade externa                             | Logs estruturados bastam por enquanto                       |
| Backup remoto                                                | Backup local por decisão consciente (ver seção 5)           |
| Dockerfiles das aplicações                                   | API e web sobem por PM2                                     |
| Remote cache do Turborepo                                    | Só cache local e do CI                                      |
| Gate de cobertura de testes                                  | Cobertura apenas reportada                                  |
| Regra de negócio em Server Actions ou Route Handlers do Next | A regra de negócio mora só no NestJS                        |

---

## 3. Decisões

### 3.1 Monorepo e ferramentas

| Decisão                                                                                                                                                                                                                            | Motivo                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **pnpm** como gerenciador                                                                                                                                                                                                          | Mais rápido que npm, menos disco e estrito: não deixa importar pacote não declarado                     |
| **Turborepo** como orquestrador                                                                                                                                                                                                    | Ordem correta de build/lint/test e cache por hash de entrada; ganho real no CI                          |
| Estrutura: `apps/web` (Next.js), `apps/api` (NestJS), `packages/shared`, `packages/config`                                                                                                                                         | `shared` é o motivo do monorepo: contrato único entre front e back                                      |
| `packages/shared`: schemas zod, tipos, enums (roles), constantes e schema de paginação                                                                                                                                             | Zero duplicação de DTO                                                                                  |
| `packages/config`: presets de tsconfig e ESLint                                                                                                                                                                                    | Um lugar só para ajustar regras                                                                         |
| `.nvmrc` + `engines` no `package.json` + `engine-strict=true` no `.npmrc` + `packageManager`                                                                                                                                       | nvm-windows não lê `.nvmrc` sozinho; `engines` + `engine-strict` fazem o install falhar com Node errado |
| `.editorconfig`, ESLint, Prettier                                                                                                                                                                                                  | Padrão único de estilo                                                                                  |
| Husky + lint-staged + commitlint (Conventional Commits)                                                                                                                                                                            | Barra lixo antes do commit                                                                              |
| **Fim de linha LF** em tudo: `.gitattributes` (`* text=auto eol=lf`), `.editorconfig` (`end_of_line = lf`), Prettier (`endOfLine: "lf"`), `.vscode/settings.json` (`files.eol: "\n"`), `git add --renormalize .` no commit inicial | Acaba a briga CRLF/LF entre Windows e Linux                                                             |
| Scripts utilitários em **Node/TS**, não bash                                                                                                                                                                                       | Rodam igual no Windows e no Linux                                                                       |
| Variáveis de ambiente declaradas no `turbo.json` (`globalEnv`/`env`); tarefas de integração e E2E com `cache: false`                                                                                                               | Evita resultado velho vindo do cache                                                                    |

### 3.2 Convenções de código

**Princípios**

1. Clean code e SOLID, principalmente **responsabilidade única**.
2. Código reutilizável sempre que possível.
3. Código **entendível por humanos**: nomes descritivos e completos (nada de `x`, `tmp`, `data2`), comentário explica o _porquê_ e não o _quê_.
4. **Guard clauses**: validar e falhar cedo, no início da função. Evitar `else` ao máximo. Nunca executar o código inteiro para só no final checar erro.
5. Pastas por feature.

**Camadas do backend (cada arquivo tem uma responsabilidade)**

| Arquivo           | Responsabilidade única                                                     |
| ----------------- | -------------------------------------------------------------------------- |
| `*.entity.ts`     | Tabela Drizzle e tipos inferidos (`InferSelectModel`)                      |
| `*.dto.ts`        | Schemas zod de entrada e saída (via `nestjs-zod`, reaproveitando `shared`) |
| `*.repository.ts` | Acesso a dados (queries)                                                   |
| `*.service.ts`    | Regra de negócio                                                           |
| `*.controller.ts` | HTTP: valida, delega ao service, responde                                  |

**Frontend: separação servidor e cliente**

1. `page.tsx` e `layout.tsx` **nunca** levam `'use client'`.
2. Todo componente que precisa de `'use client'` fica em arquivo próprio `*.client.tsx`, pequeno (folha), importado por server components.
3. Pastas por feature: `features/<feature>/{components,hooks,api,schemas}`. Componentes shadcn em `components/ui`, layout em `components/layout`.

**Calibração do ESLint**

| Categoria                | Regras                                                                                                                                                                 | Nível                                              |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Fronteiras entre camadas | Controller não importa `drizzle-orm` nem `*.repository`; service não importa `drizzle-orm`; `page`/`layout` sem `'use client'`; hooks só em `*.client.tsx` ou `hooks/` | **error**                                          |
| Fluxo                    | `no-else-return` (sem `allowElseIf`), `no-lonely-if`, `no-nested-ternary`                                                                                              | **error**                                          |
| Tipos e async            | `no-explicit-any`, `no-floating-promises`, `no-misused-promises`                                                                                                       | **error**                                          |
| Nomes                    | `id-length` (mínimo 2, exceções pontuais), `naming-convention`, `filename-case` (kebab-case com sufixos `.service.ts`, `.client.tsx`)                                  | **error**                                          |
| Desativação              | `eslint-comments/require-description` e `reportUnusedDisableDirectives`                                                                                                | **error**                                          |
| Métricas                 | `complexity` 10, `max-lines-per-function` 50, `max-lines` 300, `max-params` 4, `max-depth` 3                                                                           | **warn** (permanente até calibrar com código real) |

**Dados de terceiros e `any`**

Dado vindo de serviço externo entra como `unknown` e é validado com zod na camada de integração (`integrations/`). `any` só com `eslint-disable` **com descrição**.

**Exceções às métricas** (override por padrão de arquivo): seeds, schemas/entities, DTOs, migrations, arquivos de configuração e testes. Entity ou DTO com 50 atributos é aceitável.

**Regra para a IA (resumo no `AGENTS.md`, detalhe em `docs/conventions/`; ver 3.14)**

1. Nunca renomear para nomes curtos, dividir funções artificialmente nem usar `eslint-disable` só para satisfazer uma métrica.
2. Se uma regra conflitar com o código natural, **parar, informar qual regra, explicar o conflito e perguntar**.
3. Testes automatizados são a rede de segurança de qualquer refatoração.

**Checklist de responsabilidade única (SRP)**

Nenhuma ferramenta verifica SRP sozinha: as regras de fronteira pegam a mistura entre camadas e as métricas só dão sintoma. A verificação dentro de cada unidade é este checklist, aplicado por quem escreve e por quem revisa:

1. Descreva o que a função faz em uma frase. Se aparecer um "e" (valida **e** salva **e** envia e-mail), divida.
2. Quantos motivos diferentes teriam para mudar essa função? Mais de um indica mais de uma responsabilidade.
3. Se o nome honesto da função precisa de "And" ou "Manager", ela faz coisa demais.
4. Se testar a unidade exige muitos mocks, ela provavelmente depende de coisa demais.

### 3.3 Backend (NestJS)

| Decisão        | Detalhe                                                                                                                                      |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Módulos        | `auth`, `users`, `people`, `mail`, `storage`, `settings`, `audit`, `health`; comuns em `common/` (guards, decorators, filters, interceptors) |
| Validação      | zod em todo lugar, schemas compartilhados via `packages/shared`                                                                              |
| Documentação   | Swagger/OpenAPI em `/api/docs`, **desligado em prod por padrão** (flag por env)                                                              |
| Erros          | Filtro global com formato padrão de resposta                                                                                                 |
| Logs           | `pino` com request ID                                                                                                                        |
| Health         | `/api/health` com `@nestjs/terminus` (banco e Redis); resposta pública mínima (`status` e versão), detalhes só para admin                    |
| Segurança HTTP | `helmet`, CORS restrito à origem configurada, `trust proxy` ligado atrás do Nginx                                                            |
| Paginação      | Contrato único (página, tamanho, ordenação, filtros) em `shared`, reutilizado por todas as listagens                                         |

### 3.4 Banco de dados

| Decisão                                   | Detalhe                                                                                                                                                                                                                                                                    |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PostgreSQL 18**, imagem fixada na minor | Estável desde setembro de 2025; traz `uuidv7()` nativo                                                                                                                                                                                                                     |
| ORM                                       | Drizzle                                                                                                                                                                                                                                                                    |
| Colunas base (`coreColumns`)              | `id` uuid PK com `default(sql\`uuidv7()\`)`, `isActive`boolean (default true),`createdAt`e`updatedAt`com`withTimezone: true`; `updatedAt`com`.$onUpdate(() => new Date())`. Sem `organizationId`.                                                                          |
| Tabelas iniciais                          | `users`, `people`, `sessions` (refresh tokens), `email_tokens`, `system_settings`, `audit_logs`                                                                                                                                                                            |
| `users` vs `people`                       | Relação 1:1. `users` guarda credenciais e role; `people` guarda dados pessoais                                                                                                                                                                                             |
| `people`                                  | Nome completo, telefone, data de nascimento, documento (CPF, opcional), avatar. **Sem endereço.**                                                                                                                                                                          |
| Migrations                                | Wrapper `pnpm db:generate <nome_descritivo>` que **recusa rodar sem nome**. Padrão `<verbo>_<objeto>` em snake_case (`create_users`, `add_avatar_to_people`), com prefixo temporal para evitar conflito entre branches (confirmar a opção do drizzle-kit na versão usada). |
| Regra de migration                        | Compatível com o código da versão anterior: adiciona primeiro, remove só um deploy depois (expand/contract)                                                                                                                                                                |
| Seed                                      | Idempotente (upsert por e-mail), cria **somente o admin** (ver 3.5)                                                                                                                                                                                                        |
| Banco de teste                            | Banco `app_test` no mesmo Postgres; migrations no `globalSetup`; helper `resetDatabase()` com `TRUNCATE ... RESTART IDENTITY CASCADE` sobre as tabelas listadas em `information_schema`; suites de integração em série                                                     |

### 3.5 Autenticação e segurança

| Decisão                | Detalhe                                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transporte de token    | Cookies **httpOnly**, `Secure` em prod, `SameSite=Lax` (JavaScript não lê o token)                                                                                  |
| Access token           | JWT de 15 minutos                                                                                                                                                   |
| Refresh token          | 7 dias, com **rotação**; guardado com hash no banco; reutilização de refresh antigo revoga a sessão                                                                 |
| Sessões                | Tabela de sessões, logout atual e logout em todos os dispositivos                                                                                                   |
| Hash de senha          | **bcrypt**, custo configurável por env                                                                                                                              |
| Política de senha      | Regras no schema zod do `shared`; troca de senha logado exige senha atual                                                                                           |
| CSRF                   | Domínio único + `SameSite=Lax` + verificação do header `Origin` em requisições que alteram estado                                                                   |
| Guards                 | `JwtAuthGuard` global (rotas públicas com `@Public()`), `RolesGuard` com `@Roles()`, guard de `must_change_password`                                                |
| Roles                  | RBAC simples: coluna `role` com enum `admin` e `user`                                                                                                               |
| Tokens de e-mail       | Confirmação, reset de senha e convite: uso único, com expiração, guardados com hash                                                                                 |
| Login                  | Exige e-mail confirmado (com reenvio). Usuário criado por admin já nasce confirmado.                                                                                |
| `must_change_password` | Obriga trocar a senha no primeiro login; bloqueia as demais rotas até a troca                                                                                       |
| Audit log              | Registra eventos de autenticação e ações administrativas (quem, o quê, quando, IP)                                                                                  |
| Redirecionamento       | Com token válido, rotas públicas e de autenticação redirecionam para a área logada (middleware do Next só checa a **presença** do cookie; o Nest valida de verdade) |

**Rate limiting (throttler)**

1. `@nestjs/throttler` com storage em **Redis** (em memória, cada instância do PM2 contaria separado).
2. `trust proxy` no Nest e `X-Forwarded-For` no Nginx, para o IP real chegar ao app.
3. Chave do login = **IP + e-mail**, mais um lockout progressivo por conta com limite maior.
4. **Testes automatizados obrigatórios**: várias pessoas distintas atrás do mesmo IP **não** se bloqueiam; força bruta em uma conta **é** bloqueada; o IP é lido corretamente atrás do proxy.

### 3.6 Usuários, pessoas e configurações do sistema

| Decisão           | Detalhe                                                                                                                                                                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cadastro público  | Controlado pela configuração `registration_enabled` na tabela `system_settings` (chave/valor), alterada por **toggle na UI**, só para admin, sem restart. Valor padrão proposto: desligado em prod, ligado em dev.                                   |
| Criação por admin | Admin cria o usuário com senha temporária + `must_change_password`                                                                                                                                                                                   |
| Convite           | Admin convida por e-mail; link com token; convidado define senha e dados pessoais. Funciona mesmo com o cadastro público desligado.                                                                                                                  |
| Seed do admin     | **Dev:** senha de teste padrão (env) + `must_change_password`. **Prod:** `ADMIN_INITIAL_PASSWORD` do `.env`; se vazia, o script gera senha aleatória, imprime **uma vez** e marca `must_change_password`. E-mail do admin vem de `SEED_ADMIN_EMAIL`. |
| Avatar            | Ver 3.8; fallback com iniciais no front                                                                                                                                                                                                              |

### 3.7 E-mail

| Decisão                             | Detalhe                                                                                                                           |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Interface `MailService` com drivers | **SMTP** em dev (apontando para o Mailpit) e **Resend** em prod                                                                   |
| Mailpit                             | Container de dev que captura os e-mails e mostra numa UI web; no CI, os testes de integração leem a API dele para seguir os links |
| Fila                                | **BullMQ + Redis**, com retentativas; o processor é uma classe separada do serviço de envio                                       |
| Templates                           | React Email, em pt-BR, com visual neutro e fácil de trocar                                                                        |
| Fluxos                              | Confirmação de cadastro, recuperação de senha, convite de usuário, envio da chave de backup (3.9)                                 |

### 3.8 Arquivos e avatar

| Decisão                                         | Detalhe                                                                                        |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Interface `StorageService` + `LocalDiskStorage` | Troca futura por S3/R2 vira uma classe nova                                                    |
| Diretório de uploads                            | `UPLOADS_DIR`, **fora** da pasta do release (senão some a cada deploy)                         |
| Validação                                       | Tipo real do arquivo (magic bytes) e tamanho máximo por env (`UPLOAD_MAX_BYTES`)               |
| Conversão                                       | `sharp`: redimensiona e converte (ex.: webp); dimensão e qualidade por env                     |
| Entrega                                         | Endpoint do Nest com cache de navegador (Nginx direto fica para depois)                        |
| Nginx                                           | `client_max_body_size` acompanha o limite do env (documentado e conferido no script de deploy) |
| Backup                                          | Uploads **não** entram no backup (decisão consciente, documentada)                             |

### 3.9 Variáveis de ambiente e chaves

| Decisão                 | Detalhe                                                                                                                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Arquivos                | `.env.example` versionado; `.env` no `.gitignore`                                                                                                                                                                                                |
| Ambientes               | Apenas **dev** e **prod** (testes usam variáveis `TEST_*`)                                                                                                                                                                                       |
| Validação               | zod no boot, por app; se faltar chave, o app **não sobe** e lista o que falta. Com teste automatizado de chave ausente.                                                                                                                          |
| `pnpm keys:generate`    | Gera **somente o que não existe**, nunca sobrescreve: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET`, `ENCRYPTION_KEY` (AES-256-GCM, para campos sensíveis como segredo de 2FA), `BACKUP_ENCRYPTION_KEY`, senhas de Postgres e Redis |
| Rotação                 | Só quando pedida: `pnpm keys:rotate <nome>`. Desligada por padrão.                                                                                                                                                                               |
| O que o dev define      | Apenas e-mail e senha do admin (e credenciais de provedores externos)                                                                                                                                                                            |
| Chave de backup em prod | Na **geração**, o script **imprime no terminal** e **envia por e-mail ao admin**. Se o envio falhar, o script falha alto e a chave continua impressa. Não reenvia a cada deploy.                                                                 |

### 3.10 Backup

| Decisão           | Detalhe                                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Escopo            | Somente PostgreSQL                                                                                                      |
| Destino           | Diretório local (`BACKUP_DIR`)                                                                                          |
| Formato           | `pg_dump` (via container) → gzip → criptografia AES-256-GCM com `BACKUP_ENCRYPTION_KEY`                                 |
| Agendamento       | Diário, via cron do sistema ou do PM2 (definido na spec)                                                                |
| Retenção          | Configurável por env (proposta: 7 diários + 4 semanais)                                                                 |
| Restore           | `pnpm db:restore <arquivo>` com confirmação explícita                                                                   |
| Verificação       | `pnpm backup:verify` restaura o último dump num banco temporário e confere; roda periodicamente e também em teste no CI |
| Backup pré-deploy | Mesmo script, acionado pelo pipeline                                                                                    |

### 3.11 Frontend

| Decisão              | Detalhe                                                                                                                                                                                                                                                                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js (App Router) | Páginas públicas em SSR/estáticas; área logada em client components                                                                                                                                                                                                                                                                                            |
| Dados                | Axios (com interceptor: um refresh automático por 401, sem disparar vários refresh simultâneos) + **TanStack Query**                                                                                                                                                                                                                                           |
| Formulários          | react-hook-form + zod (schemas do `shared`)                                                                                                                                                                                                                                                                                                                    |
| UI                   | shadcn/ui + lucide-react; tema claro, escuro e sistema (`next-themes`) com tokens CSS neutros, fáceis de substituir                                                                                                                                                                                                                                            |
| Idioma               | pt-BR fixo                                                                                                                                                                                                                                                                                                                                                     |
| Telas                | Landing (visitante), login, cadastro, esqueci/redefinir senha, confirmação de e-mail, aceitar convite, perfil (dados pessoais, avatar, troca de senha), usuários (lista, convidar, criar, mudar role, ativar/desativar), configurações do sistema (toggle de cadastro), página de sistema para admin (health detalhado), `/health` público mínimo, 403/404/500 |
| Landing              | Instruções e imagens explicando o que é o template, fácil de apagar; imagens geradas por script do Playwright                                                                                                                                                                                                                                                  |
| Estados              | Loading, vazio e erro padronizados; toasts                                                                                                                                                                                                                                                                                                                     |
| Design               | `DESIGN.md` descreve a **semântica** dos tokens e os padrões de layout; os **valores** (cores, espaçamentos) ficam só no `globals.css`                                                                                                                                                                                                                         |

**Mobile-first (regra obrigatória)**

1. Estilo base escrito para mobile; só se evolui com variantes `min-width` (`sm:`, `md:`, `lg:`). Variantes `max-*` são proibidas por convenção.
2. Sidebar vira drawer (Sheet do shadcn) no mobile.
3. Tabelas viram lista de cards abaixo de `md`.
4. Campos de formulário com fonte de no mínimo 16px (evita zoom no iOS) e alvos de toque de no mínimo 44px.
5. `dvh` no lugar de `vh` e respeito às safe areas.
6. **Testes:** o Playwright tem dois projetos em Chromium: `mobile` (390×844) com a **suíte completa** e `desktop` (1280×800) só com **smoke**. Um fixture roda em toda página visitada e falha se houver scroll horizontal ou alvo de toque abaixo do mínimo. Comparação de screenshots não faz parte da suíte (instável).

### 3.12 Infra e deploy

| Decisão            | Detalhe                                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Compose de dev     | Postgres 18, Redis, Mailpit; portas expostas                                                                                |
| Compose de prod    | Postgres 18 e Redis presos em `127.0.0.1`, senha vinda do env, `restart: always`                                            |
| Aplicações         | API e web sobem por **PM2** (`ecosystem.config.cjs`)                                                                        |
| Proxy              | **Nginx** em domínio único: `/` → web, `/api` → api; HTTPS; `X-Forwarded-*`. Em dev, o Next faz proxy de `/api` (sem CORS). |
| Layout no servidor | `releases/<timestamp>`, symlink `current`, pasta `shared/` (`.env`, uploads, backups)                                       |

### 3.13 Testes e CI/CD

**Testes**

| Tipo                           | Ferramenta                        |
| ------------------------------ | --------------------------------- |
| Unitários e integração da API  | Jest (nativo do Nest) + Supertest |
| Unitários do web e do `shared` | Vitest + Testing Library          |
| E2E                            | Playwright                        |
| Cobertura                      | Apenas reportada, sem gate        |

Cenários obrigatórios: throttler (3.5), env ausente, seed idempotente, rotação e reuso de refresh token, guards e roles, toggle de cadastro, `must_change_password`, fluxos de e-mail via Mailpit, validação de upload, backup e restore, mobile-first.

**CI (GitHub Actions)**

1. Pipeline: install (cache do pnpm) → lint → typecheck → unit → build → integração (service containers: Postgres 18, Redis, Mailpit) → E2E.
2. Cache do Turbo via `actions/cache` na pasta `.turbo`.
3. **Playwright estável:** versão do `@playwright/test` fixada e imagem `mcr.microsoft.com/playwright` na mesma versão; só Chromium; `workers: 1`, `retries: 2`, trace no primeiro retry; relatório como artifact; roda contra o build de produção esperando `/health`; job **separado** dos unitários.
4. Dependabot semanal e agrupado.

**CD**

1. Merge na `main` roda o CI; se passar, o deploy dispara automaticamente (sem tag).
2. O GitHub Actions entra na VPS por SSH e roda o script de deploy (TS): dump pré-deploy → instala e builda → migration → troca o symlink → `pm2 reload` → espera `/health`.
3. Se o `/health` falhar: volta o symlink e recarrega o PM2 **automaticamente**.
4. **Banco:** migration que falha se desfaz sozinha (DDL transacional). O restore do banco é **manual** (`pnpm db:restore`) e só automático com `ROLLBACK_RESTORE_DB=true`, porque restaurar apagaria o que os usuários gravaram depois do dump.
5. Mantém os N últimos releases.

### 3.14 Documentação e ferramentas de IA

1. `README` com "como usar este template" e checklist pós-criação.
2. `pnpm init:project`: renomeia o projeto, pede e-mail e senha do admin, gera as chaves e remove módulos opcionais.
3. Instruções para agentes de IA com fonte única e independente de ferramenta (estrutura abaixo).
4. `docs/adr/` com este ADR e `CHANGELOG` com notas de migração.
5. Atualizações do template: GitHub Template repository + remote `template` para `cherry-pick` pontual. Previsto um ciclo de atualização de dependências por ano.

**Estrutura das instruções para IA**

| Arquivo               | Papel                                                                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `AGENTS.md`           | **Fonte única** e curta: princípios inegociáveis, comandos do projeto, fluxo ADR → spec e índice dos demais documentos                          |
| `CLAUDE.md`           | Apenas `@AGENTS.md` (import), mais algo específico do Claude se surgir                                                                          |
| `DESIGN.md`           | Princípios de layout (abaixo)                                                                                                                   |
| `docs/conventions/`   | `backend.md`, `frontend.md`, `testing.md`: detalhe lido sob demanda, incluindo o checklist de SRP (3.2), mobile-first, camadas e `'use client'` |
| `.cursor/rules/*.mdc` | **Opcional e fino**: um glob que manda ler o documento correspondente em `docs/conventions/`                                                    |

Decisões:

1. O Cursor lê `AGENTS.md` e `CLAUDE.md`; o Claude Code lê `CLAUDE.md` e não lê `.cursor/rules`. Por isso a fonte é o `AGENTS.md`, o formato mais amplo entre as ferramentas.
2. `CLAUDE.md` usa **import** (`@AGENTS.md`), não symlink, porque symlink exige modo desenvolvedor no Windows. O template também não depende do fallback do Claude Code para `AGENTS.md`, que varia por versão.
3. O `AGENTS.md` referencia o `DESIGN.md` ("ao criar ou alterar UI, leia `DESIGN.md`"), pois nem toda ferramenta o carrega sozinha.
4. `AGENTS.md` fica curto: só o inegociável e o índice. O resto vive em `docs/conventions/`.
5. Regra escrita é um pedido, não uma garantia. A parte independente de ferramenta é a que o ESLint, os testes, o Husky e o CI impõem (3.2 e 3.13).

**Conteúdo do `DESIGN.md`**

1. Princípios: mobile-first, genérico e fácil de trocar.
2. Tokens: o que cada um significa (ex.: use `bg-primary`, nunca hex), apontando o `globals.css` como fonte da verdade.
3. Componentes: só shadcn, ícones só lucide; padrões de layout (drawer no mobile, cards no lugar de tabela abaixo de `md`).
4. Estados padrão: loading, vazio, erro e toasts.
5. Acessibilidade: alvos de toque, contraste e foco.
6. Proibições: hex solto, variantes `max-*`, `vh`, componente fora do shadcn.

### 3.15 Recursos opcionais (prontos e desligados por padrão)

| Recurso                      | Ativação                                                             |
| ---------------------------- | -------------------------------------------------------------------- |
| 2FA (TOTP)                   | Flag; qualquer usuário pode ligar na própria conta quando habilitado |
| Login social (Google/GitHub) | Flag + credenciais no `.env`                                         |

---

## 4. Fases de implementação (base para as tarefas)

| Fase | Conteúdo                                                                                                                                                          |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F0   | Fundação: monorepo, tooling, LF, Husky/commitlint, ESLint calibrado, `AGENTS.md`, `CLAUDE.md` (import), `DESIGN.md` inicial, `docs/conventions/`, CI mínimo       |
| F1   | Banco e base da API: compose dev, Drizzle, `coreColumns`, wrapper de migrations, validação de env, `keys:generate`, logs, erros, Swagger, health, infra de testes |
| F2   | Auth: users, sessions, tokens, guards, throttler (com testes), seed do admin                                                                                      |
| F3   | E-mail (fila, templates, Mailpit), fluxos de confirmação, reset e convite, `system_settings`, audit log                                                           |
| F4   | Pessoas, avatar e `StorageService`                                                                                                                                |
| F5   | Frontend base: layout mobile-first, tema, Axios/TanStack Query, páginas de auth, middleware                                                                       |
| F6   | Frontend funcional: perfil, usuários, configurações, página de sistema, `/health`, landing                                                                        |
| F7   | Backup, restore e verificação                                                                                                                                     |
| F8   | E2E completo (Playwright mobile + smoke desktop), deploy, rollback, Dependabot                                                                                    |
| F9   | Opcionais: 2FA e login social (desligados)                                                                                                                        |
| F10  | `init:project`, README, revisão final do template                                                                                                                 |

---

## 5. Consequências e riscos

| #   | Risco                                                                       | Mitigação                                                                                  |
| --- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1   | Backup local no mesmo disco da VPS: se o disco morrer, perde banco e backup | Aceito conscientemente. Backup remoto (rclone) fica como evolução futura.                  |
| 2   | Perder a chave de backup torna os dumps ilegíveis                           | Chave impressa e enviada por e-mail na geração; guardar também no gerenciador de senhas    |
| 3   | Chave de backup viaja por e-mail                                            | Enviar só na geração; conta admin com 2FA recomendada                                      |
| 4   | Template e projetos derivados divergem                                      | Template repo + `cherry-pick` + CHANGELOG; ciclo anual de atualização                      |
| 5   | Métricas de lint levam a refatoração artificial                             | Métricas só em `warn`, regra de a IA informar o conflito, nomes protegidos por `id-length` |
| 6   | E2E mobile + desktop aumenta o tempo do CI e a chance de flaky              | Desktop só smoke; Playwright com versão fixada, retries e job separado                     |
| 7   | Migrations sem down                                                         | Dump pré-deploy, expand/contract, restore manual com comando pronto                        |
| 8   | Superfície extra dos opcionais (2FA, social)                                | Fase final e desligados por padrão                                                         |
| 9   | Uploads fora do backup                                                      | Documentado; entram no backup se um projeto exigir                                         |
| 10  | Seed de admin com senha em prod                                             | Senha vinda do env ou aleatória impressa uma vez, mais `must_change_password`              |
| 11  | Instruções para IA são só pedido, e cada ferramenta lê arquivos diferentes  | Fonte única em `AGENTS.md`; garantia real por lint, testes, Husky e CI                     |

## 6. Pendências para aprovação

| #   | Ponto                                         | Padrão proposto                                                                                                                       |
| --- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Valor inicial de `registration_enabled`       | Desligado em prod, ligado em dev                                                                                                      |
| 2   | "Redirecionar em qualquer rota quando logado" | Vale para landing, login, cadastro e demais rotas públicas de autenticação; páginas de utilidade (`/health`, termos) ficam acessíveis |
| 3   | Framework de testes                           | Jest na API, Vitest no web e no `shared`                                                                                              |
| 4   | Retenção de backup                            | 7 diários + 4 semanais, ajustável por env                                                                                             |
| 5   | Swagger em prod                               | Desligado por padrão                                                                                                                  |

## 7. Alternativas descartadas

| Alternativa                                          | Por que não                                                                |
| ---------------------------------------------------- | -------------------------------------------------------------------------- |
| Fork do repositório                                  | Histórico em comum gera conflitos de merge; Template repo é mais limpo     |
| Copier / pacotes privados para auth                  | Mais pesado do que o ganho para um único mantenedor                        |
| Server Actions / Route Handlers com regra de negócio | Duplica lógica já existente no NestJS                                      |
| Testcontainers                                       | Mais lento e com atrito no Windows; banco `app_test` resolve               |
| Restore automático do banco como padrão              | Apaga dados gravados depois do dump                                        |
| JWT verificado no middleware do Next                 | Exigiria o secret no front; o Nest já valida                               |
| UUID v4                                              | Postgres 18 oferece `uuidv7()` nativo, melhor para índices                 |
| `CLAUDE.md` como symlink de `AGENTS.md`              | Symlink no Windows exige modo desenvolvedor; o import `@AGENTS.md` resolve |
| Regras só em `.cursor/rules`                         | O Claude Code não as lê; prende o projeto a uma ferramenta                 |
