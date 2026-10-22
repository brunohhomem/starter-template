# Spec F1 — Banco e base da API

| Campo                  | Valor                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------- |
| Status                 | Aguardando aprovação para execução                                                  |
| Data                   | 2026-10-21                                                                          |
| Revisão                | v2: modo de execução autônoma (3.1), arquivo de progresso e numeração fixa          |
| ADR de origem          | `docs/adr/0001-template-base-monorepo.md` (v2)                                      |
| Pré-requisito          | F0 **mergeada na `main`** (inclui a correção das fixtures do lint e o ajuste de CI) |
| Executor               | Cursor                                                                              |
| Destino no repositório | `docs/specs/F1-banco-e-base-da-api.md`                                              |
| Branch sugerida        | `feat/f1-banco-e-base-da-api` (PR para `main`)                                      |

---

## 1. Objetivo

Entregar a **base da API** sobre a fundação da F0: infraestrutura local (Postgres 18, Redis, Mailpit), geração de chaves, validação de ambiente, Drizzle com migrations nomeadas, logs, erros padronizados, Swagger, health e a **infraestrutura de testes de integração** (inclusive no CI). Ao final, a API sobe com banco real, responde em `/api/health` e tem testes de integração rodando contra um Postgres de verdade.

## 2. Fora de escopo (não fazer na F1)

| Item                                                                | Fase                    |
| ------------------------------------------------------------------- | ----------------------- |
| `users`, `people`, sessões, tokens, guards, throttler, cookies      | F2                      |
| Seed do admin                                                       | F2                      |
| E-mail (BullMQ, templates, Resend/SMTP) e `audit_logs`              | F3                      |
| Storage e avatar                                                    | F4                      |
| Proxy `/api` do Next, qualquer tela, variáveis do web               | F5                      |
| Backup e restore (inclui validar `BACKUP_ENCRYPTION_KEY` no código) | F7                      |
| Compose de produção, PM2, Nginx, deploy, Dependabot                 | F8                      |
| Endpoint de health **detalhado** para admin                         | F2/F6 (precisa de auth) |
| Envio da chave de backup por e-mail                                 | F3                      |

Não instale nada fora da seção 8, a menos que não exista alternativa dentro dela (3.1, parada obrigatória c).

## 3. Regras de execução

1. Mesmas regras da seção 4 da spec da F0 (um commit por tarefa em Conventional Commits, nunca usar `eslint-disable`/`@ts-ignore`, não afrouxar regra, docs em pt-BR). **Quando a spec da F0 mandar "parar e perguntar", vale a seção 3.1 desta spec**, que prevalece.
2. Respeite as **camadas do ADR**: `entity`, `dto`, `repository`, `service`, `controller`, cada arquivo com uma responsabilidade. Nada de acesso a dados fora de `*.repository.ts`.
3. Use a versão estável mais recente de cada dependência, **um único `zod` (mesma major) em todo o workspace** (o `nestjs-zod` exige), e registre as versões no `CHANGELOG.md`.
4. **Nenhum segredo vai para o Git, para logs ou para a saída dos scripts** (exceção única e explícita: a chave de backup, na T2).
5. Onde o ADR afirma algo que esta spec manda **provar com teste** (ex.: migration transacional), se o teste falhar, **pare e reporte**: a decisão do ADR depende disso.
6. Ao final, entregue o relatório da seção 12.

### 3.1 Modo autônomo (leia antes de começar)

**Objetivo:** executar de T1 a T16 **sem interrupções**, até cumprir a Definição de Pronto (seção 11). O usuário não acompanha em tempo real e não quer precisar escrever "continue".

1. **A spec é a autorização.** Instalar as dependências da seção 8, criar e alterar os arquivos descritos nas tarefas, rodar comandos, criar a branch e fazer commits **já estão autorizados**. Não peça confirmação para nada disso.
2. **Nunca termine uma resposta com resumo de status seguido de pergunta** ("quero confirmar antes de...", "posso seguir?", "próximo passo: ..."). Terminou uma tarefa: registre no progresso e **comece a próxima na mesma execução**. Só existe resposta final quando a seção 11 estiver cumprida ou quando houver uma parada obrigatória (item 3).
3. **Paradas obrigatórias (as únicas):**

| #   | Parada                                                                                                                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| a   | Falha da prova de atomicidade de migration (T6)                                                                                           |
| b   | Conflito direto entre duas regras do ADR ou da spec que impeça cumprir a tarefa, sem opção neutra                                         |
| c   | Dependência fora da seção 8 sem nenhuma alternativa dentro dela                                                                           |
| d   | Ação que exija credencial, aprovação externa ou acesso que você não tem (ex.: `gh` sem login, Docker indisponível)                        |
| e   | Ação destrutiva fora do escopo: apagar volume de dados do usuário, reescrever histórico já enviado ao remoto, force push, apagar branches |

Ao parar: escreva o motivo, o que já foi feito e a opção recomendada. **Não pare por nada que não esteja nesta tabela.**

4. **Todo o resto você decide:** ambiguidade, nomes, detalhes de implementação, versões, estrutura de testes. Escolha a opção que melhor segue o ADR e as convenções, siga em frente e **registre a decisão** no progresso e no relatório. Dúvida não bloqueia: use o padrão proposto na spec.
5. **Falha de comando, teste ou lint não é motivo de parada.** Diagnostique, corrija e rode de novo. Só depois de **3 tentativas distintas** sem sucesso no mesmo problema aplique o item 3 (b ou d) e reporte.
6. **Numeração fixa.** Use sempre os números T1 a T16 desta spec, sem renumerar, fundir ou reordenar tarefas. Se parte de uma tarefa foi feita sob outro número, mantenha o número da spec, registre no progresso o que foi antecipado e **execute o aceite da tarefa original quando chegar nela**. Em especial: contratos de erro e paginação em `packages/shared` são a **T4**; logs são a **T9**; validação e erros são a **T10**.
7. **Arquivo de progresso.** Mantenha `docs/specs/F1-progresso.md`, com T1 a T16 (status, hash do commit, evidência do aceite) e as decisões tomadas, e **commite a cada tarefa**. Ao retomar depois de qualquer interrupção ou perda de contexto, **leia esse arquivo e continue da primeira tarefa não concluída**, sem pedir confirmação. No último commit, copie o conteúdo para a descrição da PR e remova o arquivo.
8. **Marque uma tarefa como concluída só depois de executar os comandos do aceite** e ver o resultado.
9. **Comunicação:** durante a execução, no máximo uma linha de progresso por tarefa, **nunca terminando em pergunta**. A mensagem longa é o relatório final (seção 12).

## 4. Fatos verificados (resolvem pendências do ADR)

| #   | Fato                                                                                                                                                                                                | Fonte                                | Efeito na spec                                                                         |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------- |
| 1   | A imagem `postgres:18` espera o volume em `/var/lib/postgresql`, **não** em `/var/lib/postgresql/data`; montar no caminho antigo falha ou cria volumes anônimos                                     | Issue `docker-library/postgres#1370` | T1                                                                                     |
| 2   | `drizzle-kit generate` aceita `--name`, e a pasta gerada combina timestamp com o nome                                                                                                               | Docs do Drizzle Kit                  | T6                                                                                     |
| 3   | A opção `migrations.prefix` **não aparece** na documentação atual do `drizzle.config.ts`; só `table` (padrão `__drizzle_migrations`) e `schema` (padrão `drizzle`)                                  | Docs do Drizzle                      | T6: não depender de `prefix`; **verificar** como a versão instalada nomeia os arquivos |
| 4   | `nestjs-zod` aceita `zod ^3.25.0 \|\| ^4.0.0`; com Swagger é preciso passar o documento por `cleanupOpenApiDoc`; o pipe global entra por `APP_PIPE` e a serialização por `ZodSerializerInterceptor` | README do `nestjs-zod`               | T8, T10, T13                                                                           |
| 5   | A tabela de migrations do Drizzle fica no schema `drizzle`, e o `resetDatabase()` **não** pode truncá-la                                                                                            | Docs do Drizzle                      | T14                                                                                    |

## 5. Estrutura esperada (acréscimos à F0)

```
├─ compose.dev.yaml
├─ .env.example                          (versionado; `.env` nunca)
├─ packages/
│  ├─ scripts/                           @starter/scripts: keys:generate, keys:rotate (+ testes)
│  └─ shared/src/                        + error.ts, pagination.ts
├─ apps/api/
│  ├─ drizzle.config.ts
│  ├─ scripts/                           db-generate.ts, db-migrate.ts, db-studio.ts
│  └─ src/
│     ├─ config/                         env.schema.ts, load-env.ts, app-config.module.ts
│     ├─ bootstrap/                      configure-app.ts + uma função por preocupação
│     ├─ common/                         filters/, logging/
│     ├─ database/                       database.module.ts, database-config.ts,
│     │                                  columns/core-columns.ts, schema.ts, migrations/
│     ├─ redis/                          redis.module.ts
│     ├─ health/                         health.module.ts, health.controller.ts
│     └─ modules/settings/               system-setting.entity.ts, system-settings.repository.ts
├─ docs/conventions/database.md
└─ .github/workflows/ci.yml              (+ job de integração)
```

---

## 6. Tarefas

### T1 — Compose de desenvolvimento

**Entregáveis:** `compose.dev.yaml` na raiz, com scripts de raiz `infra:up`, `infra:down`, `infra:logs` e `infra:reset` (`down -v`, com confirmação).

| Serviço    | Requisitos                                                                                                                                                                                                                                                                                                             |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `postgres` | Imagem **postgres 18** fixada na minor estável mais recente; volume nomeado montado em **`/var/lib/postgresql`**; usuário, senha e banco vindos de `DB_USER`, `DB_PASSWORD`, `DB_NAME`; porta publicada **somente em `127.0.0.1`**; healthcheck com `pg_isready`                                                       |
| `redis`    | Imagem estável fixada; `--requirepass` com `REDIS_PASSWORD`; **`--maxmemory-policy noeviction`** (exigido pelo BullMQ: qualquer outra política pode descartar jobs); **`--appendonly yes --appendfsync everysec`** (os jobs sobrevivem a reinício); porta em `127.0.0.1`; healthcheck com `redis-cli ping` autenticado |
| `mailpit`  | Imagem `axllent/mailpit` fixada; SMTP e UI web em `127.0.0.1`; sem uso no código ainda (F3)                                                                                                                                                                                                                            |

**Aceite**

1. `pnpm infra:up` deixa os três serviços `healthy`.
2. Os dados do Postgres persistem após `infra:down` e `infra:up`.
3. Nenhum serviço fica acessível fora de `127.0.0.1`.
4. Funciona no Docker Desktop do Windows, e o `compose.dev.yaml` está com LF.

### T2 — Registro de chaves, `.env.example`, `keys:generate` e `keys:rotate`

**Pacote:** `packages/scripts` (`@starter/scripts`), TypeScript executado com `tsx`, testes em Vitest, ESLint com o preset base.

**Registro de chaves geradas**

| Variável                | Geração                                       |
| ----------------------- | --------------------------------------------- |
| `JWT_ACCESS_SECRET`     | 64 bytes aleatórios, base64url                |
| `JWT_REFRESH_SECRET`    | 64 bytes aleatórios, base64url                |
| `COOKIE_SECRET`         | 64 bytes aleatórios, base64url                |
| `ENCRYPTION_KEY`        | **32 bytes** aleatórios, base64 (AES-256-GCM) |
| `BACKUP_ENCRYPTION_KEY` | **32 bytes** aleatórios, base64               |
| `DB_PASSWORD`           | 32 caracteres url-safe                        |
| `REDIS_PASSWORD`        | 32 caracteres url-safe                        |

Usar `node:crypto` (`randomBytes`), nunca `Math.random`.

**`pnpm keys:generate [--file <caminho>]`**

1. Se `.env` não existir, cria a partir do `.env.example`.
2. Preenche **somente** as chaves ausentes ou vazias. **Nunca sobrescreve** valor existente.
3. É idempotente: a segunda execução não altera nada.
4. Preserva ordem, comentários e fim de linha LF; grava de forma atômica (arquivo temporário + rename).
5. Imprime **nomes** do que gerou e do que já existia, **nunca valores**. Única exceção: `BACKUP_ENCRYPTION_KEY`, impressa **uma vez**, no momento da geração, em bloco destacado com o aviso "guarde no seu gerenciador de senhas". O envio dessa chave por e-mail ao admin em prod entra na F3.
6. Lista as variáveis que **você define** e continuam vazias (`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `ADMIN_INITIAL_PASSWORD`, credenciais de provedores externos).

**`pnpm keys:rotate <NOME>`** (só roda quando pedido; nenhum outro comando rotaciona)

1. Aceita apenas nomes do registro.
2. Pede confirmação digitando o nome da chave; `--yes` pula o prompt, mas o nome continua obrigatório.
3. Antes de alterar, copia o `.env` para `.env.bak-<timestamp>` (coberto pelo `.gitignore` via `.env*`).
4. Imprime a consequência de cada chave:

| Chave                           | Consequência exibida                                                                          |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| `JWT_*`, `COOKIE_SECRET`        | Todas as sessões são invalidadas                                                              |
| `ENCRYPTION_KEY`                | Dados cifrados com a chave antiga ficam ilegíveis; recuperar pelo arquivo de backup do `.env` |
| `BACKUP_ENCRYPTION_KEY`         | Backups antigos só abrem com a chave antiga; guarde-a                                         |
| `DB_PASSWORD`, `REDIS_PASSWORD` | É preciso trocar também no serviço em execução; instruções impressas, nada automático         |

**`.env.example`:** todas as variáveis da T3 **mais as que você define** (`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `ADMIN_INITIAL_PASSWORD`, vazias e comentadas como "definidas por você"), agrupadas, com comentários em pt-BR, valores vazios para as geradas e padrões de desenvolvimento para as demais (`DB_HOST=localhost`, `DB_PORT=5432`, `DB_USER=app`, `DB_NAME=app`, `REDIS_HOST=localhost`, `REDIS_PORT=6379`, `API_PORT=3001`, `APP_ORIGIN=http://localhost:3000`, `LOG_LEVEL=info`, `SWAGGER_ENABLED=true`, `TRUST_PROXY_HOPS=0`).

**Testes (Vitest):** gera só o que falta; não toca valores existentes; idempotência; preserva comentários e LF; `rotate` exige confirmação e cria o `.bak`; a saída **nunca contém valores** (exceto a chave de backup na geração); comprimentos corretos (32 bytes decodificados para `ENCRYPTION_KEY`).

**Aceite:** num clone limpo, `pnpm keys:generate` cria um `.env` completo; rodar de novo não muda nada (`git status` limpo e hash do `.env` igual).

### T3 — Validação de ambiente na API

| Item         | Requisito                                                                                                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Carregamento | Um único `.env` na raiz do repositório, lido com `process.loadEnvFile` (sem `dotenv`) **se existir**; no CI e em prod o ambiente pode vir do processo. Caminho sobrescrevível por `ENV_FILE`. |
| Schema       | zod, em `apps/api/src/config/env.schema.ts`, só com as variáveis que a API usa                                                                                                                |
| Falha        | Se algo faltar ou for inválido, a API **não sobe**: imprime **todos** os problemas (nome e motivo, **sem valores**) e sai com código 1                                                        |
| Acesso       | `AppConfigModule` global fornece o objeto tipado e imutável pelo token `ENV`. **Nenhum `process.env` fora de `config/`** (regra de ESLint com fixture, ver abaixo)                            |

**Variáveis validadas na F1**

| Variável                                                   | Regra                                                                                                                |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                                 | `development`, `production` ou `test` (`test` é só modo de execução automatizada; os ambientes reais são dev e prod) |
| `API_PORT`                                                 | Inteiro de porta                                                                                                     |
| `APP_ORIGIN`                                               | URL (origem permitida no CORS)                                                                                       |
| `TRUST_PROXY_HOPS`                                         | Inteiro ≥ 0. **Obrigatório explícito em produção** (sem padrão)                                                      |
| `LOG_LEVEL`                                                | Nível válido do pino                                                                                                 |
| `SWAGGER_ENABLED`                                          | Booleano; padrão `false` em produção                                                                                 |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`  | Obrigatórias. `DB_POOL_MAX` opcional                                                                                 |
| `TEST_DB_NAME`                                             | Opcional; padrão `<DB_NAME>_test`                                                                                    |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`               | Obrigatórias                                                                                                         |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET` | Mínimo de 32 bytes decodificados                                                                                     |
| `ENCRYPTION_KEY`                                           | Exatamente 32 bytes após o decode base64                                                                             |

**Regra de ESLint nova (T3):** proibir `process.env` fora de `apps/api/src/config/**` e de `packages/scripts/**`, com fixture no teste da config do lint (fixtures **dentro** do mini-monorepo isolado da F0).

**Testes:** todas as chaves ausentes aparecem juntas na mensagem; valores inválidos; sucesso devolve objeto tipado; regras extras de produção; **a mensagem de erro não contém valores**; teste cruzado garantindo que **toda chave do registro da T2 existe no `.env.example` e toda variável do schema existe no `.env.example`**.

**Aceite:** apagar `JWT_ACCESS_SECRET` do `.env` e rodar `pnpm --filter @starter/api start:dev` falha com mensagem legível e código 1.

### T4 — `packages/shared`: contratos de erro e paginação

| Item                            | Conteúdo                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `errorResponseSchema`           | `statusCode`, `error`, `message`, `details` opcional (lista de `{ path, message }`), `requestId`, `path`, `timestamp`                |
| `paginationQuerySchema`         | `page` (padrão 1), `pageSize` (padrão 20, máximo 100), `sortBy` opcional, `sortOrder` (`asc`/`desc`). Filtros ficam em cada feature. |
| `paginatedResponseSchema(item)` | `{ items, meta: { page, pageSize, totalItems, totalPages } }`                                                                        |
| `buildPageMeta`                 | Calcula o `meta`                                                                                                                     |

Tipos inferidos e exportados; testes Vitest. Consumo pela API e pelo web sem duplicar tipos (mecanismo da F0).

### T5 — Módulo de banco e `coreColumns`

| Item          | Requisito                                                                                                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Driver        | `pg` (Pool) com Drizzle                                                                                                                                                                                                        |
| Configuração  | **Uma única função** `buildDatabaseConfig(env)` (componentes `DB_*`, não URL, para evitar problemas de escape de senha), usada pelo app, pelos scripts e pelo `drizzle.config.ts`                                              |
| Provider      | Token `DATABASE` com a instância Drizzle; o `OnApplicationShutdown` encerra o pool                                                                                                                                             |
| `coreColumns` | `id` uuid PK com `default(sql\`uuidv7()\`)`; `isActive`boolean não nulo, padrão`true`; `createdAt`e`updatedAt`com`withTimezone: true`, padrão `now()`; `updatedAt`com`.$onUpdate(() => new Date())`. **Sem `organizationId`.** |
| `schema.ts`   | Agrega as entities exportadas pelos módulos                                                                                                                                                                                    |

**Atenção:** `$onUpdate` é aplicado **pelo Drizzle**, não pelo banco; SQL manual não atualiza `updatedAt`. Documentar na T16.

**Testes de integração:** conexão ok; `uuid_extract_version(id) = 7` para um registro novo; `createdAt` e `updatedAt` com fuso; `updatedAt` muda após `update` via Drizzle.

### T6 — Migrations nomeadas

**Entregáveis**

| Item                      | Requisito                                                                                                                                                                                                                                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `drizzle.config.ts`       | Dialeto `postgresql`, schema em `src/database/schema.ts`, saída em `src/database/migrations`, credenciais por `buildDatabaseConfig`                                                                                                                                                                 |
| `pnpm db:generate <nome>` | Wrapper que **recusa rodar sem nome** (sai com 1 sem chamar o drizzle-kit). Valida `^(create\|add\|remove\|rename\|alter\|drop\|backfill)_[a-z0-9]+(_[a-z0-9]+)*$` com mensagem listando os verbos e exemplos (`create_users`, `add_avatar_to_people`). Chama `drizzle-kit generate --name <nome>`. |
| `pnpm db:migrate`         | Executor **programático** com o migrator do `drizzle-orm` (sem depender do drizzle-kit em runtime); será usado pelo deploy na F8. Imprime quantas migrations aplicou; código de saída coerente                                                                                                      |
| `pnpm db:studio`          | Repassa ao `drizzle-kit studio`; **recusa em produção**                                                                                                                                                                                                                                             |
| Sem `db:push`             | Só migrations versionadas (decisão). Registrar o motivo em `database.md`.                                                                                                                                                                                                                           |

Migrations geradas são **commitadas**. Excluir a pasta `migrations/` do Prettier (já está fora das métricas do ESLint, ADR 3.2).

**Nomes dos arquivos:** não depender da opção `migrations.prefix` (não documentada). Verifique **como a versão instalada nomeia** os arquivos e confirme que (a) o nome descrito aparece e (b) a ordenação é cronológica. Registre o comportamento observado em `database.md`.

**Prova obrigatória (ADR 3.13, CD item 4):** teste de integração com uma pasta de migrations temporária cujo **segundo statement falha**; após o `db:migrate`, o **primeiro statement não pode estar aplicado**. Se aplicar parcialmente, **pare e reporte**: o raciocínio de rollback do ADR depende de a migration ser atômica.

**Aceite**

1. `pnpm db:generate` sem argumento falha; com nome inválido falha com a mensagem; com `create_system_settings` gera o arquivo.
2. `pnpm db:migrate` aplica e uma segunda execução não aplica nada.
3. O teste de atomicidade passa (ou foi reportado).

### T7 — Primeira entity: `system_settings`

> **Ajuste de fase:** a entity e a migration de `system_settings` saem da F3 e entram aqui, para dar um caso real ao pipeline (coreColumns, geração de migration, migrate, reset e integração). Service, controller e UI continuam na F3. Registrar no `CHANGELOG.md`.

| Arquivo                                          | Conteúdo                                                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `modules/settings/system-setting.entity.ts`      | Tabela com `coreColumns`, `key` (texto, único, não nulo), `value` (`jsonb`, não nulo) e tipos inferidos |
| `modules/settings/system-settings.repository.ts` | `findByKey`, `findAll`, `upsert(key, value)`; **único** lugar que fala com o Drizzle nesse módulo       |
| `modules/settings/settings.module.ts`            | Provê e exporta o repository (sem endpoints)                                                            |
| Migration                                        | Gerada pelo wrapper com o nome `create_system_settings`                                                 |

**Testes de integração:** `upsert` cria e atualiza sem duplicar; `findByKey` devolve `null` quando não existe; `id` é UUID v7; `updatedAt` muda no upsert de atualização.

### T8 — Bootstrap compartilhado

`configureApp(app, env)` aplica a configuração comum e é usado **tanto por `main.ts` quanto pelos testes** (`createTestApp`), para não divergirem. Ela só **orquestra** funções pequenas em `bootstrap/`, uma por preocupação (nada de função gigante):

| Função        | Responsabilidade                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| prefixo       | `setGlobalPrefix('api')`                                                                             |
| segurança     | `helmet`, CORS restrito a `APP_ORIGIN` com `credentials: true`, `trust proxy` com `TRUST_PROXY_HOPS` |
| logger        | Troca o logger do Nest pelo pino (T9)                                                                |
| ciclo de vida | `enableShutdownHooks()`                                                                              |
| docs          | Swagger (T13), condicional                                                                           |

`main.ts` valida o ambiente **primeiro** e só depois cria a aplicação. O `ZodValidationPipe` (`APP_PIPE`), o filtro de exceções (`APP_FILTER`) e o `ZodSerializerInterceptor` (`APP_INTERCEPTOR`) são registrados no `AppModule`.

**Testes:** presença de headers do `helmet`; CORS aceita `APP_ORIGIN` e rejeita outra origem; rotas respondem sob `/api`.

### T9 — Logs estruturados

`nestjs-pino`, em `common/logging/`.

| Requisito  | Detalhe                                                                                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Request ID | Usa `x-request-id` recebido **se válido** (alfanumérico, `-`/`_`, até 64 caracteres); senão gera com `crypto.randomUUID()`. Devolve no header `x-request-id`, inclui em **todas** as linhas de log e na resposta de erro |
| Redação    | Redigir `authorization`, `cookie`, `set-cookie` e campos `password`, `token`, `refreshToken`, `secret`; corpo de requisição **não** é logado por padrão                                                                  |
| Formato    | Legível (`pino-pretty`, só dev) em desenvolvimento; JSON em produção; silencioso em `test` salvo `LOG_LEVEL` explícito                                                                                                   |
| Ruído      | `/api/health` fora do log automático de requisições                                                                                                                                                                      |

**Testes:** request ID válido é aceito e ecoado; inválido é substituído; a redação funciona (teste unitário sobre a config); o header sempre volta.

### T10 — Validação e erros padronizados

| Item      | Requisito                                                                                                                                                                                                                                                                                                  |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Validação | `ZodValidationPipe` global. DTOs de entrada criados com `createZodDto` a partir dos schemas do `shared`                                                                                                                                                                                                    |
| Filtro    | `AllExceptionsFilter` (`APP_FILTER`), uma classe, uma responsabilidade. Mapeia: `HttpException`; erro de validação do `nestjs-zod` → **400** com `details` por campo (`path`, `message`); qualquer outro erro → **500** genérico, **sem stack e sem mensagem interna** em produção, logado com `requestId` |
| Contrato  | Toda resposta de erro obedece ao `errorResponseSchema` do `shared`                                                                                                                                                                                                                                         |
| Escopo    | Sem mapeamento de erros do Postgres nesta fase (cada feature trata os seus)                                                                                                                                                                                                                                |

**Testes de integração** (com um controller **só de teste**, registrado no módulo de teste e nunca no código de produção): query inválida devolve 400 com `details`; rota inexistente devolve 404 no formato padrão; erro inesperado devolve 500 sem stack; `requestId` presente; o corpo de cada erro faz `parse` com sucesso no `errorResponseSchema`.

### T11 — Módulo de Redis

`redis/redis.module.ts` com `ioredis`, token `REDIS`, configuração por `REDIS_*`, `OnApplicationShutdown` encerrando a conexão. Usado pelo health agora e pelo throttler (F2) depois. As filas (F3) usam os **mesmos `REDIS_*`**, mas com conexões próprias do BullMQ (workers com `maxRetriesPerRequest: null`). **Teste de integração:** `PING` com senha responde; credencial errada falha de forma legível.

### T12 — Health

| Item         | Requisito                                                                                                                                                                                                |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rota         | `GET /api/health`, **pública**                                                                                                                                                                           |
| Verificações | Banco (`SELECT 1`) e Redis (`PING`), cada uma com timeout de 3 s, via `@nestjs/terminus`                                                                                                                 |
| Resposta     | **Mínima**: `{ "status": "ok" \| "error", "version": "<versão do package.json da API>" }`. **Sem detalhes de componentes.** HTTP 200 quando saudável e **503** quando não (o deploy da F8 depende disso) |
| Log          | Não aparece no log automático de requisições                                                                                                                                                             |

**Decisão delegada:** como enxugar a resposta padrão do terminus para o formato mínimo (registrar no relatório).

**Testes:** saudável → 200 com o corpo mínimo; com um indicador falhando (teste unitário com doubles) → 503 e `status: "error"`; o corpo **não** contém nomes de componentes nem mensagens de erro.

### T13 — Swagger

| Item       | Requisito                                                                              |
| ---------- | -------------------------------------------------------------------------------------- |
| Rota       | `/api/docs`, só quando `SWAGGER_ENABLED=true` (padrão desligado em produção)           |
| Integração | Documento passa por `cleanupOpenApiDoc` do `nestjs-zod` antes do `SwaggerModule.setup` |
| Conteúdo   | Título, descrição, versão; `/api/health` documentado com `@ZodResponse`                |

**Testes:** habilitado → 200 e o JSON contém `/api/health`; desabilitado → 404.

### T14 — Infraestrutura de testes de integração

| Item                   | Requisito                                                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Separação              | Unitários em `*.spec.ts` (`pnpm test`); integração em `*.int-spec.ts` (`pnpm test:integration`)                                                                                      |
| Execução               | Integração **em série** (um worker)                                                                                                                                                  |
| `globalSetup`          | Garante que o banco `TEST_DB_NAME` **existe** (conecta ao banco de manutenção `postgres` e cria se faltar) e roda as migrations nele                                                 |
| **Trava de segurança** | Se o nome do banco de teste **não terminar em `_test`**, **recusa rodar**. Evita truncar o banco de desenvolvimento por engano. Testar a trava                                       |
| `resetDatabase()`      | Lista as tabelas dos schemas da aplicação em `information_schema` e executa `TRUNCATE ... RESTART IDENTITY CASCADE`, **excluindo o schema `drizzle`**. Nenhuma tabela é citada à mão |
| `createTestApp()`      | Monta o app de teste com `configureApp` (T8) e o módulo de teste                                                                                                                     |
| Turbo                  | Tarefa `test:integration` com `cache: false` e as envs (`DB_*`, `TEST_DB_NAME`, `REDIS_*`) declaradas                                                                                |

**Testes da infraestrutura:** o reset realmente esvazia as tabelas e preserva o histórico de migrations; a trava recusa um nome sem `_test`; duas execuções seguidas funcionam.

### T15 — CI: job de integração

Adicionar ao `ci.yml` um job `integration`, **separado** do `verify`.

| Item     | Requisito                                                                                                                                           |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runner   | `ubuntu-24.04`, `timeout-minutes` definido                                                                                                          |
| Serviços | `postgres:18.x` (mesma minor da T1) e `redis`, com healthcheck, ambos em `localhost`                                                                |
| Segredos | O job roda **`pnpm keys:generate`** para criar o `.env` (isso também exercita o script no CI), com as variáveis de conexão vindas do `.env.example` |
| Execução | `pnpm turbo run test:integration`                                                                                                                   |
| Cache    | Mesmo cache de pnpm e Turbo do `verify`                                                                                                             |

**Aceite:** PR com os dois jobs verdes. Provar que o job de integração **falha** quando uma migration está quebrada (commit de teste que não fica na PR final).

### T16 — Documentação

| Arquivo                        | Conteúdo                                                                                                                                                                                                                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/conventions/database.md` | `coreColumns` e UUID v7; ressalva do `$onUpdate`; **nomes de migration** e como a versão instalada nomeia os arquivos; regra expand/contract; resultado da **prova de atomicidade**; por que não há `db:push`; repository como única porta de acesso; banco de teste, trava `_test` e `resetDatabase()` |
| `docs/conventions/backend.md`  | `configureApp` compartilhado, acesso ao ambiente só por `ENV`, erros padronizados, logs e health                                                                                                                                                                                                        |
| `docs/conventions/testing.md`  | Integração, `createTestApp`, envs do Turbo                                                                                                                                                                                                                                                              |
| `AGENTS.md`                    | Comandos novos (`infra:up`, `keys:generate`, `db:*`, `test:integration`) e `database.md` no índice, mantendo ~120 linhas                                                                                                                                                                                |
| `README.md`                    | "Como subir o ambiente de desenvolvimento": `pnpm install` → `pnpm keys:generate` → `pnpm infra:up` → `pnpm db:migrate` → `pnpm --filter @starter/api start:dev`                                                                                                                                        |
| `CHANGELOG.md`                 | Versões escolhidas e o ajuste de fase (entity `system_settings` movida para a F1)                                                                                                                                                                                                                       |

---

## 7. Decisões já tomadas (não alterar)

| #   | Decisão                                                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------- |
| 1   | Driver `pg`; conexão por componentes `DB_*`, não por URL                                                   |
| 2   | `.env` único na raiz, lido com `process.loadEnvFile`; sem `dotenv` e sem `@nestjs/config`                  |
| 3   | `packages/scripts` abriga os scripts independentes da API; os scripts de banco ficam em `apps/api/scripts` |
| 4   | Sem `db:push`                                                                                              |
| 5   | Health público **mínimo**; o detalhado depende de auth e fica para depois                                  |
| 6   | Postgres 18 com volume em `/var/lib/postgresql`                                                            |
| 7   | `system_settings` (entity + repository + migration) entra na F1                                            |

## 8. Dependências permitidas

| Onde               | Pacotes                                                                                                                                                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/scripts` | `tsx`, `vitest`                                                                                                                                                                                                                               |
| `apps/api`         | `drizzle-orm`, `drizzle-kit` (dev), `pg`, `@types/pg`, `ioredis`, `zod`, `nestjs-zod`, `@nestjs/swagger`, `@nestjs/terminus`, `nestjs-pino`, `pino`, `pino-http`, `pino-pretty` (dev), `helmet`, `supertest`, `@types/supertest`, `tsx` (dev) |
| Raiz               | Nenhuma nova, salvo o que o Turbo/CI exigir (perguntar)                                                                                                                                                                                       |

Qualquer outro pacote só é permitido se não houver alternativa dentro da lista (3.1, parada obrigatória c); nesse caso registre a decisão no progresso.

## 9. Decisões delegadas ao executor

| #   | Decisão                                                                      | Critério                                              |
| --- | ---------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1   | Tags exatas das imagens (Postgres 18, Redis, Mailpit)                        | Última minor/patch estável; a mesma do Postgres no CI |
| 2   | Como enxugar a resposta do terminus (T12)                                    | A mais simples que não vaze detalhes                  |
| 3   | Estrutura do Jest com dois conjuntos (unit e integração)                     | A mais simples e estável com os decorators do Nest    |
| 4   | Como repassar argumentos pelos scripts da raiz (`pnpm --filter ... -- args`) | Funcionar em Windows e Linux                          |
| 5   | Como `typecheck` e `build` tratam `apps/api/scripts`                         | Tipados e lintados; fora do `dist` da API             |

## 10. Atenções específicas

| #   | Atenção                                                                                                                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Montar o volume do Postgres 18 em `/var/lib/postgresql`, e **não** em `/var/lib/postgresql/data`.                                                                                         |
| 2   | `.env` precisa ficar com LF. O `.gitignore` já cobre `.env*` (exceto `.env.example`), inclusive os `.bak`.                                                                                |
| 3   | Nenhuma saída, log ou teste pode imprimir valores de segredo (a única exceção é a chave de backup na geração). Há teste para isso.                                                        |
| 4   | A trava `_test` do banco de teste é obrigatória: um bug ali apagaria o banco de desenvolvimento.                                                                                          |
| 5   | O `$onUpdate` do Drizzle é de aplicação, não do banco.                                                                                                                                    |
| 6   | Toda env usada por uma tarefa do Turbo precisa estar declarada, senão o cache devolve resultado velho (regra da F0).                                                                      |
| 7   | Um único `zod` no workspace; versões diferentes quebram o `nestjs-zod` e o `shared`.                                                                                                      |
| 8   | Integrar o logger pino ao Nest com `bufferLogs` para que os logs de bootstrap também saiam no formato certo.                                                                              |
| 9   | As regras de ESLint da F0 continuam valendo: controller e service **não** importam `drizzle-orm`; só repository e módulo de banco.                                                        |
| 10  | Scripts em Windows: usar `node:path`, nunca concatenar caminhos com barras.                                                                                                               |
| 11  | Os dados de um job do BullMQ ficam em **texto claro** no Redis (e no arquivo AOF). Registrar em `docs/conventions/backend.md`: nunca colocar segredos de longa duração em payload de job. |

## 11. Definição de pronto

Na branch limpa e em um **clone novo**:

1. `pnpm install --frozen-lockfile`
2. `pnpm keys:generate` cria o `.env` completo; a segunda execução não altera nada
3. `pnpm infra:up` deixa Postgres, Redis e Mailpit `healthy`
4. `pnpm db:migrate` aplica `create_system_settings`; a segunda execução não aplica nada
5. `pnpm --filter @starter/api start:dev` sobe; `GET /api/health` devolve 200 com o corpo mínimo; `/api/docs` abre com `SWAGGER_ENABLED=true`
6. Apagar uma chave do `.env` impede o boot com mensagem legível e código 1
7. `pnpm format:check`, `pnpm lint` (0 erros), `pnpm typecheck`, `pnpm test`, `pnpm test:integration` e `pnpm build` verdes
8. O teste de atomicidade de migrations passou (ou foi reportado)
9. CI verde com os **dois** jobs (`verify` e `integration`), e provado que o job de integração falha com uma migration quebrada
10. `git ls-files --eol` sem `crlf`; nenhum segredo no Git; nenhum `eslint-disable`
11. `docs/specs/F1-progresso.md` com T1 a T16 concluídas e evidências, seu conteúdo copiado para a descrição da PR e o arquivo removido no último commit

## 12. Relatório que o Cursor deve devolver

| Seção                | Conteúdo                                                     |
| -------------------- | ------------------------------------------------------------ |
| Resultado por tarefa | T1 a T16: concluída, parcial ou bloqueada                    |
| Evidências           | Saída dos comandos da seção 11 e link do CI                  |
| Prova de atomicidade | Resultado do teste de migration (T6) e o que foi observado   |
| Nomes de migration   | Como a versão instalada do drizzle-kit nomeia os arquivos    |
| Versões              | Tabela das versões e tags de imagem escolhidas               |
| Decisões delegadas   | Escolha e motivo para cada item da seção 9                   |
| Desvios e conflitos  | Qualquer regra do ADR que conflitou ou tarefa alterada       |
| Warnings de métricas | Lista dos warnings atuais (já há código real para calibrar)  |
| Decisões autônomas   | Toda decisão tomada sob a regra 4 da seção 3.1, com o motivo |
