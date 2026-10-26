# Spec V1 — do ponto atual ao template pronto para forkar

| Campo     | Valor                                                                                              |
| --------- | -------------------------------------------------------------------------------------------------- |
| ADR       | `docs/adr/0002-template-enxuto-v1.md` (aceito)                                                     |
| Executor  | Claude Code, sozinho, sem OpenCode e sem gerente                                                   |
| Modo      | Autônomo: execute F3 → F4 → F5 → F6 do início ao fim, sem pedir confirmação nem "posso continuar?" |
| Aprovação | Bruno, 2026-10-23                                                                                  |

---

## 0. Regras de execução

1. **Leia antes de começar:** `AGENTS.md`, o ADR 0002 inteiro (a seção 5, de testes, é obrigatória) e `docs/conventions/*`.
2. **Uma branch e um PR por fase**, empilhados: cada fase sai da ponta da branch da fase anterior. O PR aponta para a branch anterior; o da F3 aponta para `main`. **Nunca faça merge**, force-push nem reescreva histórico. O merge é do Bruno, na ordem.
3. Faça um commit por entrega lógica (Conventional Commits, em inglês, no padrão do repositório). Não crie arquivo nem commit de progresso: o checklist da fase vai no corpo do PR e você o atualiza.
4. **Gate pré-PR**, obrigatório antes de cada `git push`: `pnpm install --frozen-lockfile`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm turbo run build --force`, `pnpm boot:check` (sobe `node dist/main.js` e `node dist/worker.js`, espera `GET /api/health` = 200 e derruba; falhou a subida, falhou o gate), `pnpm test`, `pnpm test:integration` (com `pnpm infra:up`) e cada `run:` de `.github/workflows/ci.yml` reproduzido localmente. O boot entra no gate e no CI porque o commit `d0b180a` mostrou que a suíte de integração não cobre a subida real: o pipe global de zod quebrava o processo compilado e os testes, que usam SWC, continuavam verdes. O job `e2e` usa o `node_modules` instalado no runner: `pnpm --filter` dentro da imagem do Playwright reinstala só o web e o boot perde o `pg`. Corrija o que falhar e repita o gate inteiro. Depois do push, espere o CI (`gh run watch`). Se o CI falhar em algo que o gate não pegou, corrija e acrescente o passo que faltou ao gate, nesta seção.
5. **Testes:** só casos de uso do catálogo do ADR 0002 (seção 5) e as garantias técnicas da lista fechada. Não escreva teste unitário de service, guard, schema, config ou enum. O nome do `it` é o texto do caso de uso do catálogo.
6. Decisão não coberta por esta spec ou pelo ADR: escolha a opção mais conservadora e reversível, registre-a na seção "Decisões" do corpo do PR e siga em frente.
7. Não instale programas na máquina. Dependências do projeto, via pnpm, só as listadas em cada fase. Docker só com os containers do `compose.dev.yaml`. Nada de `docker system prune`, `wsl --shutdown` ou reinício do Docker Desktop. Porta ocupada: mude só a porta do host no `.env`.
8. **Paradas obrigatórias** (as únicas em que você para e escreve um relatório): (a) uma migration falha a prova de atomicidade; (b) duas regras obrigatórias conflitam sem decisão possível; (c) a fase exige dependência fora da lista e não há alternativa; (d) falta credencial ou acesso externo; (e) uma ação destrutiva sai do escopo.
9. **Retomada:** se a sessão reiniciar, rode `git branch -a` e `gh pr list`, leia o checklist do PR aberto mais recente e continue do primeiro item não marcado.

## 1. Onde parou (verificado em 2026-10-23)

| Item                                                                | Estado                                                                                                                                                                                       |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F0, F1, F2                                                          | Mergeadas na `main`                                                                                                                                                                          |
| Branch atual                                                        | `feat/f3-email-settings`                                                                                                                                                                     |
| F3 T1–T5 (transportes, contratos, tabelas, repositories, templates) | Commitadas (`853ad85` … `eb2de44`)                                                                                                                                                           |
| F3 T6 (fila, worker, limpeza)                                       | **Sem commit.** `mail-queue.service.ts`, `mail.processor.ts`, `modules/maintenance`, `modules/worker`, `worker.ts`, `common/tokens`, `test/test-worker.ts`, `test/mail-queue.int-spec.ts`    |
| Último teste da T6 (`test-output.txt`)                              | 6 de 6 casos da fila falham com `0` mensagens/jobs: **o worker de teste não consome a fila**. Primeira suspeita: prefixo ou conexão diferente entre `MailQueueService` e `startTestWorker()` |
| `worker:dev`                                                        | Usa `ts-node` + `tsconfig-paths`, que entraram como dependências novas                                                                                                                       |
| Endpoints existentes                                                | Só `auth` (register, login, refresh, logout, me, change-password) e `health`. **Não há** settings, usuários nem pessoas                                                                      |
| `apps/web`                                                          | Só esqueleto: sem Tailwind, shadcn ou telas                                                                                                                                                  |
| Docs sem commit                                                     | ADR 0002, ADR 0001 arquivado, README, spec F3, `F3-progresso.md`, `GERENCIA-OPENCODE.md`, `docs/specs/prompts/`                                                                              |

## 2. F3 — e-mail, convite e configurações (branch atual)

**Arrumação (primeiro commit, `chore: archive old execution flow`):**

1. Mova `GERENCIA-OPENCODE.md`, `F3-progresso.md` e `prompts/` para `docs/specs/arquivo/`.
2. Commite `docs/adr/0002-*`, o 0001, o README, `docs/specs/F3-email-e-configuracoes.md` e esta spec.
3. Apague `test-output.txt`.
4. Acrescente `.claude/settings.local.json` e `test-output.txt` ao `.gitignore`.

**Contratos:** as seções 3 a 7, 9 e 10 de `docs/specs/F3-email-e-configuracoes.md` continuam valendo, com estas mudanças:

| Mudança                                                                                                                             | Motivo                                               |
| ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `GET /audit-logs`, `auditLogsQuerySchema` e `auditLogsResponseSchema` saem. `AuditService.record()` continua e é chamado nos fluxos | ADR 0002: auditoria só grava no v1                   |
| A T12 (testes transversais) sai. Os casos de "Segurança" do catálogo cobrem o que importava                                         | Política de casos de uso                             |
| `worker:dev` passa a `nest start --watch --entryFile worker`. `ts-node` e `tsconfig-paths` saem das dependências                    | O projeto já usa o Nest CLI; evita runtime duplicado |
| A seção 8 (cartões) vira só a lista de entregas abaixo. As seções 2 e 11 dessa spec (progresso, gerente, OpenCode) não valem mais   | Executor único                                       |

**Entregas:**

1. **Fila e worker.** Corrija o consumo no teste, commite a T6 e reduza `mail-queue.int-spec.ts` às duas garantias técnicas: "e-mail com falha temporária é reenviado" e "limpeza diária apaga sessões e tokens vencidos e preserva os recentes".
2. **`EmailTokensService`:** `issue`, `consume` atômico e `invalidate`.
3. **Confirmação de e-mail** e **recuperação de senha:** endpoints, throttlers, auditoria.
4. **Convite:** endpoints, throttler, auditoria.
5. **Configurações:** `GET /settings/public`, `GET /settings`, `PATCH /settings`, auditoria da mudança.
6. **Docs curtos:** `docs/email.md` (drivers, worker, como ver os e-mails no Mailpit em `http://localhost:8025`, TTLs, risco aceito do token no payload), as rotas novas em `docs/auth.md` e uma linha no `AGENTS.md`.

**Aceite (casos de uso, em `test/<funcionalidade>.int-spec.ts`):**

1. Cadastro com dados válidos envia e-mail de confirmação.
2. Confirmação de e-mail: todos os casos do catálogo.
3. Senha: os casos de "esqueci" e de reset.
4. Convite: todos os casos, menos "aceita com CPF inválido" (fica na F5).
5. Configurações: todos os casos.
6. Segurança: "nenhum segredo em log, auditoria ou fila" e "nome com HTML hostil sai escapado".
7. Verificação manual: subir API e worker, cadastrar, ver o e-mail no Mailpit e seguir o link com `curl`. Registre o resultado no PR.

PR: `feat: F3 email, invitations and settings` → `main`.

## 3. F4 — testes por caso de uso (branch `chore/f4-testes`, a partir da F3)

1. **Vitest em toda a API:** migre os unitários que sobrarem e apague Jest, `ts-jest`, `@jest/globals`, `jest.setup.ts` e as configs do Jest. `pnpm test` roda Vitest e `pnpm test:integration` continua separado.
2. **Limpeza:** aplique a tabela "Limpeza da suíte atual" do ADR 0002, arquivo por arquivo.
3. **Reescreva `auth.int-spec.ts`** em `cadastro.int-spec.ts`, `login.int-spec.ts`, `sessao.int-spec.ts` e `senha.int-spec.ts`. Os nomes dos `it` são os do catálogo, e os asserts são só os observáveis (status, `code`, campo com erro, efeito numa chamada seguinte).
4. **Crie os helpers de cenário** em `test/scenario/`: `createUser({ role, password, isActive })`, `loginAs(user)` (devolve um agente supertest com os cookies), `lastEmailTo(email)` e `extractLinkToken(email)`.
5. **Reescreva `docs/conventions/testing.md`** com a política do ADR 0002 (casos de uso, garantias técnicas, como usar os helpers, um exemplo completo).

**Aceite:**

1. Todo caso do catálogo de funcionalidades que já existem tem um `it` com o mesmo texto. Ficam de fora os casos de CPF, perfil e usuários (admin).
2. Unitários: só os dígitos verificadores do CPF, quando existir.
3. Nenhuma garantia técnica foi perdida.
4. Total de linhas de teste perto de 1,5 mil. Passar disso exige justificativa no PR.

PR: `chore: F4 use-case tests and single test runner` → `feat/f3-email-settings`.

## 4. F5 — pessoas, usuários e frontend (branch `feat/f5-frontend`, a partir da F4)

### 4.1 API

**Tabela `people`** (`coreColumns`), migration `create_people`:

| Coluna      | Tipo | Regras                                                |
| ----------- | ---- | ----------------------------------------------------- |
| `user_id`   | uuid | FK `users.id` on delete cascade, not null, **unique** |
| `full_name` | text | not null                                              |
| `cpf`       | text | null, **unique**, só os 11 dígitos                    |
| `phone`     | text | null, só dígitos (10 ou 11)                           |

O seed do admin cria a pessoa com `full_name = 'Administrador'`.

**Contratos em `shared`:**

| Export                                              | Definição                                                                                                                                    |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `cpfSchema`                                         | Aceita com ou sem máscara, normaliza para 11 dígitos e valida os dígitos verificadores. Rejeita sequência repetida. Mensagem: "CPF inválido" |
| `phoneSchema`                                       | Aceita com ou sem máscara e normaliza para 10 ou 11 dígitos                                                                                  |
| `fullNameSchema`                                    | `trim`, 2 a 120 caracteres                                                                                                                   |
| `registerRequest`                                   | Ganha `fullName` (obrigatório), `cpf?` e `phone?`                                                                                            |
| `acceptInvitationRequest`                           | Ganha `fullName`, `cpf?` e `phone?`                                                                                                          |
| `profileResponse`                                   | `{ email, role, emailVerified, fullName, cpf: string\|null, phone: string\|null }`                                                           |
| `updateProfileRequest`                              | `{ fullName?, cpf?, phone? }`, com ao menos um campo                                                                                         |
| `userListItem`                                      | `{ id, email, fullName, role, isActive, emailVerified, lastLoginAt: string\|null }`                                                          |
| `usersQuery`                                        | Paginação + `search?` (nome ou e-mail)                                                                                                       |
| `updateUserRoleRequest` / `updateUserStatusRequest` | `{ role }` / `{ isActive }`                                                                                                                  |

**Códigos de erro novos:**

| Código                        | HTTP | Quando                              |
| ----------------------------- | ---: | ----------------------------------- |
| `PEOPLE_CPF_TAKEN`            |  409 | CPF já usado por outra pessoa       |
| `USERS_NOT_FOUND`             |  404 | id inexistente                      |
| `USERS_SELF_CHANGE_FORBIDDEN` |  422 | admin muda o próprio role ou status |

**Endpoints** (o cadastro e o aceite do convite passam a criar a pessoa na mesma transação do usuário):

| Rota                      | Acesso      | Efeito                                                                        |
| ------------------------- | ----------- | ----------------------------------------------------------------------------- |
| `GET /me/profile`         | autenticado | Devolve `profileResponse`                                                     |
| `PATCH /me/profile`       | autenticado | Atualiza a pessoa                                                             |
| `GET /users`              | admin       | Lista paginada, ordenada por nome                                             |
| `PATCH /users/:id/role`   | admin       | Muda o role e audita `users.role_changed` (`from`/`to`)                       |
| `PATCH /users/:id/status` | admin       | Ativa ou desativa, audita `users.status_changed`; desativar revoga as sessões |

Módulos `people` e `users` seguem entity/dto/repository/service/controller.

**Aceite da API:** os casos do catálogo para cadastro com CPF inválido, convite com CPF inválido, perfil e usuários (admin), mais estes dois:

1. "Visitante se cadastra com CPF já usado" → 409.
2. "Usuário comum lista usuários" → 403.

### 4.2 Frontend

**Dependências permitidas (`apps/web`):**

1. `tailwindcss` v4 e `@tailwindcss/postcss`.
2. As dependências que o `shadcn` CLI pedir (`class-variance-authority`, `clsx`, `tailwind-merge`, `@radix-ui/*`, `sonner`).
3. `lucide-react`, `next-themes`, `@tanstack/react-query`, `axios`, `react-hook-form` e `@hookform/resolvers`.
4. Para a E2E da F6: `@playwright/test`.

**Base:**

1. Proxy de `/api` para a API em dev, via `rewrites` no `next.config.ts` com `API_ORIGIN`.
2. Tema claro, escuro e sistema, com tokens só no `globals.css`. Complete o `DESIGN.md` onde faltar (princípios, tokens, componentes, estados, acessibilidade, proibições). As decisões de frontend estão no ADR 0002, seção 6.
3. Axios com interceptor que faz **um** refresh por 401 e enfileira as requisições concorrentes.
4. `middleware.ts`: só checa a presença do cookie. Rotas públicas de auth redirecionam para `/app` quem está logado, e `/app/*` redireciona para `/login` quem não está.
5. Se `me.mustChangePassword` for verdadeiro, redireciona para `/change-password`.
6. Estados de loading, vazio e erro padronizados, com toasts.

**Telas** (rotas em inglês, texto em pt-BR):

| Rota                                  | Conteúdo                                                                                                  |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `/`                                   | Landing simples do template, fácil de apagar                                                              |
| `/login`                              | E-mail e senha; link para cadastro (só se `registrationEnabled`) e para esqueci a senha                   |
| `/register`                           | Nome, e-mail, senha, CPF e telefone opcionais, com máscara. Se o cadastro estiver desligado, mostra aviso |
| `/forgot-password`, `/reset-password` | Fluxos da F3                                                                                              |
| `/confirm-email`                      | Consome o token e mostra o resultado                                                                      |
| `/accept-invite`                      | Nome, senha, CPF e telefone opcionais                                                                     |
| `/change-password`                    | Troca obrigatória e voluntária                                                                            |
| `/app`                                | Início da área logada (shell com sidebar, que vira drawer no mobile)                                      |
| `/app/profile`                        | Dados pessoais e troca de senha                                                                           |
| `/app/users`                          | Admin: lista com busca, cards abaixo de `md`, convidar, mudar role, ativar/desativar                      |
| `/app/settings`                       | Admin: toggle de cadastro                                                                                 |
| 403, 404, 500                         | Páginas padrão                                                                                            |

**Aceite do front:**

1. Lint de fronteiras verde: nenhum `'use client'` em `page`/`layout` e nenhum `max-*`.
2. `pnpm build` verde.
3. Verificação manual de cada tela em 390×844 e 1280×800, sem scroll horizontal. Registre no PR (screenshots via Playwright são bem-vindas).
4. Sem testes unitários de componente.

Se a F5 passar de um dia de trabalho, divida em dois PRs: API + telas públicas, depois área logada.

PR: `feat: F5 people, users and web app` → `chore/f4-testes`.

## 5. F6 — pronto para forkar (branch `chore/f6-fechamento`, a partir da F5)

1. **E2E smoke** (Playwright, Chromium, viewport 390×844), um único teste: "admin entra, troca a senha obrigatória e chega à área logada sem scroll horizontal". Novo job `e2e` no CI com Postgres, Redis e Mailpit, rodando contra o build de produção e esperando `/api/health`. Use `@playwright/test` fixado, a imagem `mcr.microsoft.com/playwright` na mesma versão, `workers: 1`, `retries: 2` e o relatório como artifact.
2. **README:** o que é o template, requisitos (Node, pnpm, Docker), primeiro uso (`pnpm install`, `infra:up`, `keys:generate`, `db:migrate`, `db:seed`, `dev` da API, do worker e do web) e um **checklist pós-fork** (renomear `@starter/*`, nome do app, e-mail do admin, gerar chaves, apagar a landing, revisar `registration_enabled`).
3. **Revisão final:**
   1. `AGENTS.md` com os comandos atuais (sem Jest, com `worker:dev`) e índice atualizado.
   2. `docs/` sem referência a OpenCode, a fases antigas ou a itens adiados como se existissem.
   3. `CHANGELOG` com a entrada `v1.0.0`.

PR: `chore: F6 e2e smoke, readme and v1 review` → `feat/f5-frontend`.

## 6. Relatório final (no PR da F6 e em resposta ao Bruno)

Escreva em pt-BR, curto:

1. Tabela das fases com o PR, o estado do CI e o número de commits de cada uma.
2. Decisões tomadas sem consultar.
3. Desvios desta spec e o porquê.
4. O que ficou pendente.
5. Ordem de merge dos PRs.
