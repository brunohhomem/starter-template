# ADR 0002 — Template base enxuto (v1)

| Campo     | Valor                                                   |
| --------- | ------------------------------------------------------- |
| Status    | Aceito em 2026-10-23. F3 a F6 concluídas em 2026-10-26. |
| Data      | 2026-10-23                                              |
| Substitui | ADR 0001 (arquivado)                                    |
| Decisor   | Bruno                                                   |

---

## 1. Contexto

O ADR 0001 previa 11 fases (F0–F10). Em cerca de 2 dias, F0–F2 foram concluídas e a F3 está pela metade, mas:

1. Ainda não há nada utilizável no navegador.
2. Há mais linhas de teste (~5,1 mil) do que de código (~4,4 mil), e boa parte testa o óbvio.
3. As specs têm ~400 linhas e a execução passa por 3 agentes. Na F3, o gerente corrigiu 3 das 5 tarefas do executor.
4. Parte do escopo (deploy, backup, 2FA, upload, rotação de chaves) foi decidida no abstrato, sem um projeto real pedindo.

Com este ADR, o template passa a ser **o mínimo que todo projeto precisa no dia 1, pronto para forkar**. O resto entra quando um projeto real pedir.

O parágrafo acima é o motivo da decisão. O que foi entregue está na seção 8.

## 2. Decisões que continuam valendo

Estas decisões vêm do 0001 sem mudança. O detalhe fica em `docs/conventions/`, que passa a ser a referência viva.

| Tema         | Decisão                                                                                                                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo     | pnpm + Turborepo; `apps/web`, `apps/api`, `packages/shared`, `packages/config`; LF; Husky + commitlint; Node e pnpm fixados                                                                   |
| Código       | SRP, guard clauses, nomes descritivos; entity/dto/repository/service/controller; `'use client'` só em `*.client.tsx`; ESLint com fronteiras em error e métricas em warn                       |
| Banco        | Postgres 18, Drizzle, `coreColumns` com `uuidv7()`, migrations nomeadas, seed idempotente do admin                                                                                            |
| API          | NestJS, zod via `shared`, filtro de erro padrão, pino com request ID, health, Swagger desligado em prod                                                                                       |
| Auth         | Cookies httpOnly, access de 15 min, refresh de 7 dias com rotação e detecção de reuso, sessões, bcrypt, checagem de `Origin`, guards (JWT, roles, `must_change_password`), throttler em Redis |
| Env e chaves | Validação zod no boot; `keys:generate` nunca sobrescreve. O `keys:rotate` já existe e fica como está, sem evolução                                                                            |
| Frontend     | Next (App Router), Axios + TanStack Query, react-hook-form + zod, shadcn + lucide, next-themes, pt-BR fixo, mobile-first                                                                      |
| IA           | `AGENTS.md` como fonte única, `CLAUDE.md` importa, `DESIGN.md`, `docs/conventions/`                                                                                                           |

## 3. Escopo do v1

| #   | Entrega                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Fundação, banco, base da API e auth (F0–F2, concluídas)                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2   | E-mail (fila, worker, templates, Mailpit), confirmação de e-mail, reset de senha, **convite**, **toggle de cadastro** (`system_settings`), audit log mínimo (só grava, sem endpoint de listagem) e limpeza de expirados                                                                                                                                                                                                                                                                |
| 3   | Suíte de testes por casos de uso (seção 5)                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 4   | **Pessoas**: tabela `people` 1:1 com `users` (nome completo, CPF validado por dígito verificador, telefone), preenchida no cadastro e no aceite do convite, editável no perfil. Frontend: layout mobile-first com tema; login, cadastro, esqueci/redefinir senha, confirmar e-mail, aceitar convite, troca obrigatória de senha; perfil (dados e senha, sem avatar); usuários (lista, convidar, mudar role, ativar/desativar); configurações (toggle de cadastro); páginas 403/404/500 |
| 5   | Pronto para forkar: README com checklist pós-criação, 1 E2E smoke em viewport mobile, revisão final                                                                                                                                                                                                                                                                                                                                                                                    |

## 4. Fora do v1

| Item                                                                  | Entra quando                                                                |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Deploy (PM2, Nginx, releases, rollback)                               | O primeiro projeto for para produção, num ADR próprio de infra              |
| Backup, restore, verificação e envio da chave de backup por e-mail    | Junto com o deploy                                                          |
| Dependabot, compose de produção                                       | Junto com o deploy                                                          |
| Avatar, `StorageService`, upload com `sharp`                          | Um projeto precisar de arquivos                                             |
| 2FA e login social                                                    | Um projeto pedir                                                            |
| Criação de usuário pelo admin com senha temporária                    | O convite não bastar                                                        |
| Listagem e tela de audit log                                          | Um projeto precisar consultar a trilha                                      |
| `init:project`                                                        | O checklist do README mostrar, depois de 2 ou 3 forks, que vale automatizar |
| Página de sistema (health detalhado), landing com screenshots geradas | Sem previsão                                                                |
| E2E completo (suíte mobile + desktop, fixture de toque e scroll)      | O smoke não bastar                                                          |

## 5. Política de testes: casos de uso

Todo teste é um **caso de uso**: um ator tenta uma ação e o teste confere o resultado que esse ator veria. Exemplos: "visitante tenta se cadastrar com CPF inválido", "admin convida um e-mail já cadastrado", "usuário comum tenta mudar o role de outro usuário". Teste que não se descreve assim, como 1 + 1 = 2, schema, enum ou configuração, não é escrito.

**Como escrever**

1. Um caso de uso é um `it`, com o nome em pt-BR dizendo ator, ação e resultado: `it('usuário comum não consegue mudar o role de outro usuário')`.
2. O teste passa pela API (HTTP), com banco, Redis e fila reais. Nunca chama o service direto.
3. Confere o que o cliente vê: status, código de erro, campo com erro e o efeito observável por outra chamada à API (por exemplo, depois do reset, o login com a senha antiga falha). Não confere coluna, tabela nem formato interno. A exceção são os casos de segurança, que podem inspecionar o armazenamento para provar que um segredo não foi gravado.
4. O arranjo usa helpers de cenário (`createUser({ role })`, `loginAs(user)`, `lastEmailTo(email)`), para o teste ler como história.
5. Um arquivo por funcionalidade: `cadastro.int-spec.ts`, `convite.int-spec.ts`, `usuarios.int-spec.ts` etc.
6. O aceite de toda spec lista os casos de uso que a fase cobre. O catálogo abaixo cresce junto com o projeto.
7. Unitário é exceção: só para função pura com muitas variações que não valem um HTTP cada uma (por exemplo, os dígitos verificadores do CPF).

**Garantias técnicas (lista fechada, não são casos de uso):** atomicidade de migration; `keys:generate` não sobrescreve chave existente; trava que impede truncar um banco que não seja de teste; env ausente impede a subida e lista as chaves; e-mail com falha temporária é reenviado; limpeza diária apaga sessões e tokens vencidos e preserva os recentes.

**Catálogo de casos de uso do v1**

| Funcionalidade        | Caso de uso                                                                     | Esperado                                                     |
| --------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Cadastro              | Visitante se cadastra com dados válidos                                         | 201, autenticado, e-mail de confirmação enviado              |
|                       | Visitante se cadastra com CPF inválido                                          | 400, erro no campo `cpf`                                     |
|                       | Visitante se cadastra com e-mail inválido                                       | 400, erro no campo `email`                                   |
|                       | Visitante se cadastra com senha fora da política (curta, só letras, só números) | 400, erro no campo `password`                                |
|                       | Visitante se cadastra com e-mail já cadastrado                                  | 409                                                          |
|                       | Visitante tenta se cadastrar com o cadastro desligado                           | 403                                                          |
|                       | Visitante envia `role: admin` no cadastro                                       | Conta nasce como `user`                                      |
| Login                 | Usuário entra com credenciais corretas                                          | 200 e acesso ao `/me`                                        |
|                       | Usuário erra a senha / e-mail inexistente                                       | 401, mesma resposta nos dois                                 |
|                       | Usuário desativado tenta entrar                                                 | 401                                                          |
|                       | Força bruta numa conta                                                          | 429; outro usuário no mesmo IP continua entrando             |
| Sessão                | Anônimo acessa rota protegida                                                   | 401                                                          |
|                       | Refresh antigo é reutilizado depois da rotação                                  | Sessão derrubada                                             |
|                       | Usuário faz logout e tenta renovar a sessão                                     | 401                                                          |
|                       | Admin desativa um usuário logado                                                | Usuário perde o acesso no próximo refresh                    |
| Senha                 | Usuário troca a senha informando a senha atual errada                           | 422                                                          |
|                       | Admin recém-criado pelo seed tenta usar o sistema sem trocar a senha            | 403 até trocar                                               |
|                       | "Esqueci a senha" com conta existente e com conta inexistente                   | Mesma resposta; só a existente recebe e-mail                 |
|                       | Usuário redefine a senha pelo link                                              | Senha nova funciona, a antiga não, todas as sessões caem     |
|                       | Usuário usa um link de reset já usado ou expirado                               | 400                                                          |
| Confirmação de e-mail | Usuário confirma pelo link e depois reutiliza o link                            | 1º ok, 2º 400                                                |
|                       | Usuário já confirmado pede reenvio                                              | 409                                                          |
| Convite               | Admin convida um e-mail novo; o convidado aceita                                | Convidado define senha e dados e entra com o papel convidado |
|                       | Admin convida um e-mail já cadastrado                                           | 409                                                          |
|                       | Usuário comum tenta convidar                                                    | 403                                                          |
|                       | Convidado aceita com CPF inválido                                               | 400, erro no campo `cpf`                                     |
|                       | Convidado reutiliza o link de convite                                           | 400                                                          |
| Usuários (admin)      | Usuário comum tenta mudar o role de outro usuário                               | 403                                                          |
|                       | Admin muda o role de um usuário                                                 | O novo papel vale no próximo acesso                          |
|                       | Admin desativa um usuário                                                       | O usuário não entra mais                                     |
|                       | Admin tenta rebaixar ou desativar a si mesmo                                    | 422 (evita ficar sem admin)                                  |
| Configurações         | Usuário comum tenta ligar o cadastro                                            | 403                                                          |
|                       | Admin desliga o cadastro                                                        | Visitante passa a receber 403 na hora                        |
| Perfil                | Usuário altera o próprio CPF para um inválido                                   | 400, erro no campo `cpf`                                     |
| Segurança             | Nenhuma senha, token ou hash aparece em log, auditoria ou payload da fila       | —                                                            |
|                       | 30 usuários autenticados no mesmo IP navegam                                    | Nenhum recebe 429                                            |
|                       | Requisição que altera estado vinda de outra origem                              | 403                                                          |
|                       | Nome com HTML hostil no cadastro                                                | Sai escapado no e-mail                                       |

**Runner único na API:** Vitest para tudo. O Jest sai. Motivo: dois runners significam duas configs de transform e decorators (a F3 T5 já precisou de intervenção por isso), e a integração já roda em Vitest + SWC sem diferença de metadata.

**Limpeza da suíte atual (F4)**

| Arquivo(s)                                                          | Linhas | Ação                                                                                                                                                    |
| ------------------------------------------------------------------- | -----: | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test/auth.int-spec.ts`                                             |  1.147 | Reescrever como casos de uso do catálogo, em arquivos por funcionalidade; tirar os asserts de detalhe interno (`family_id`, colunas, formato de cookie) |
| `auth.service.spec.ts`                                              |    615 | Remover (coberto pela integração)                                                                                                                       |
| `shared/email.test.ts`                                              |    312 | Reduzir ao que tem regra própria; remover o que só exercita o zod                                                                                       |
| `eslint/rules.test.mjs`, `presets.test.mjs`                         |    291 | Remover                                                                                                                                                 |
| `mail.service.spec.ts`                                              |    239 | Remover (fluxos cobertos na integração com `MemoryTransport`)                                                                                           |
| `scripts/keys.test.ts`                                              |    200 | Reduzir à garantia técnica: não sobrescreve o que existe                                                                                                |
| Guards `*.spec.ts` (jwt, origin, must-change-password, roles)       |    700 | Remover; garantir 1 cenário por guard na integração                                                                                                     |
| `logger-options.spec.ts` + `logging.int-spec.ts`                    |    263 | Um único teste: redação de senha, token e cookie                                                                                                        |
| `cookie.service.spec`, `token.service.spec`, `password-hasher.spec` |    435 | Remover                                                                                                                                                 |
| `shared/pagination.test`, `shared/error.test`                       |    253 | Remover                                                                                                                                                 |
| `shared/auth/schemas.test.ts`                                       |    143 | Remover (a política de senha vira caso de uso de cadastro)                                                                                              |
| `env.schema.spec.ts`                                                |    136 | Reduzir a: env ausente impede a subida e lista as chaves; produção exige Resend                                                                         |
| `migration-atomicity.int-spec.ts`                                   |    137 | Manter                                                                                                                                                  |
| `database.int-spec.ts`                                              |    117 | Manter só o que impede truncar um banco que não seja de teste                                                                                           |
| `render-email.spec.ts`                                              |     76 | Remover (escape de valor hostil fica no teste de segurança da F3)                                                                                       |
| `health.int-spec.ts`                                                |     38 | Manter                                                                                                                                                  |
| `role.test`, `shared-role.spec`, `role-wiring.test.tsx`             |     37 | Remover                                                                                                                                                 |

Meta: de ~5,1 mil para ~1,5 mil linhas de teste, cobrindo todo o catálogo. O `docs/conventions/testing.md` é reescrito com esta política.

## 6. Frontend

| #   | Decisão                                                                                                                                                                                                                                                                             | Por quê                                                                                                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Regra de negócio só no NestJS.** O Next não usa Server Actions nem Route Handlers                                                                                                                                                                                                 | Evita duas fontes de verdade e lógica duplicada; o Next é só interface                                                                                                                                         |
| 2   | **Onde buscar dados:** páginas públicas sem dado de usuário são server components estáticos. Tudo que depende do usuário logado roda no cliente, com TanStack Query + Axios. Server component não chama a API autenticada                                                           | O cookie httpOnly vai sozinho no mesmo domínio (proxy `/api`). Repassar cookie e refazer refresh no servidor é complexidade sem ganho para área logada. Custo aceito: a área logada abre com estado de loading |
| 3   | **Estado de autenticação:** a query `['me']` é a fonte única. Login, logout, aceite de convite e troca de senha invalidam essa query. O layout da área logada redireciona para `/login` em 401 e para `/change-password` se `mustChangePassword`; o menu de admin depende do `role` | Uma fonte só evita estado de auth duplicado em context, store e cookie                                                                                                                                         |
| 4   | **Middleware só checa a presença do cookie** para redirecionar rápido; quem valida de verdade é a API                                                                                                                                                                               | Verificar JWT no middleware exigiria o secret no front                                                                                                                                                         |
| 5   | **Interceptor do Axios:** um refresh por vez, com as requisições concorrentes em fila. Se o refresh falhar, limpa o cache do TanStack e vai para `/login`                                                                                                                           | Vários refresh simultâneos disparam a detecção de reuso e derrubam a sessão                                                                                                                                    |
| 6   | **Formulários validam no cliente com os mesmos schemas do `shared`** (`zodResolver`). A API continua sendo a verdade                                                                                                                                                                | Feedback imediato sem duplicar regra                                                                                                                                                                           |
| 7   | **Erro da API vira erro de campo por um helper único:** `details[].path` → `setError` no campo; `code` → mensagem pt-BR de um mapa único de códigos; o resto vira toast genérico com o `requestId`                                                                                  | O "CPF inválido" aparece no campo, igual em toda tela, e o `requestId` liga o erro ao log                                                                                                                      |
| 8   | **Máscaras (CPF, telefone) com funções próprias**, sem biblioteca. O valor enviado à API é o que o schema do `shared` normaliza                                                                                                                                                     | São duas máscaras; uma dependência não se paga                                                                                                                                                                 |
| 9   | **Visual:** shadcn com tokens neutros só no `globals.css`; a referência de layout é o `DESIGN.md`                                                                                                                                                                                   | Trocar a identidade visual de um fork é trocar tokens, não componentes                                                                                                                                         |
| 10  | **Testes no front:** nenhum teste unitário de componente. A garantia vem do lint de fronteiras, do typecheck, do build, dos casos de uso da API e do E2E smoke (F6)                                                                                                                 | O comportamento já está provado na API; teste de componente aqui seria o "1 + 1 = 2"                                                                                                                           |
| 11  | **Rotas em inglês, textos em pt-BR**                                                                                                                                                                                                                                                | Os links dos e-mails já usam `/confirm-email`, `/reset-password` e `/accept-invite`                                                                                                                            |

## 7. Fluxo de execução

1. A spec tem 1 página: objetivo, contratos (env, tabelas, endpoints, telas), decisões que não se rediscutem, aceite e fora de escopo. O detalhe interno fica com as convenções e o lint.
2. Um executor único (Claude Code ou Cursor) roda a spec inteira numa sessão, com um commit por entrega lógica. A cadeia gerente + OpenCode sai, e o `GERENCIA-OPENCODE.md` é arquivado.
3. Não há arquivo de progresso nem commits de progresso. O checklist vai no corpo do PR.
4. O gate pré-PR continua: reproduzir o CI localmente antes do push.
5. As paradas obrigatórias continuam: ação destrutiva, credencial ausente, dependência fora da lista e conflito entre regras.
6. A partir da F5, cada fase entrega back e tela juntos quando tiver as duas partes.

## 8. Fases

F3 a F6 foram entregues. A tabela registra o que cada uma cobriu.

| Fase | Conteúdo                                                                                                    | Observação                                                                |
| ---- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| F3   | Fila, worker e limpeza; `EmailTokensService`; confirmação e reset; convite; toggle de cadastro; docs curtos | A T12 saiu; os casos de segurança do catálogo cobrem o que importava dela |
| F4   | Testes enxutos (seção 5) e migração para Vitest                                                             | O Jest não faz parte do template                                          |
| F5   | Pessoas (API) e frontend v1 (seção 3, item 4)                                                               | Entregue em dois PRs                                                      |
| F6   | README com checklist pós-fork, smoke E2E mobile (login, troca de senha, área logada, sem scroll horizontal) | Template v1 pronto para forkar                                            |

## 9. Consequências e riscos

| Risco                                                               | Mitigação                                                                              |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Sem deploy pronto, o primeiro projeto real paga o setup de produção | Aceito. Vira um ADR de infra quando houver o primeiro deploy                           |
| Menos testes deixam passar regressão em detalhe interno             | A integração cobre o comportamento observável; o detalhe interno pode mudar livremente |
| O executor único deriva numa spec longa                             | Specs curtas; dividir a fase em PRs quando passar de um dia                            |
| Itens adiados viram dívida esquecida                                | A seção 4 tem gatilho explícito para cada item                                         |
| A migração para Vitest quebra decorators ou metadata                | A migração foi feita. A integração roda em Vitest + SWC                                |

## 10. Decisões da aprovação

Fechadas com o padrão abaixo. Não são trabalho em aberto.

| #   | Ponto                                   | Decisão                            |
| --- | --------------------------------------- | ---------------------------------- |
| 1   | Criação direta de usuário pelo admin    | Fora do v1 (o convite cobre)       |
| 2   | Runner de testes da API                 | Vitest, desde a F4                 |
| 3   | Audit log sem endpoint de listagem      | Sem endpoint no v1                 |
| 4   | Valor inicial de `registration_enabled` | Desligado em prod, ligado em dev   |
| 5   | CPF no cadastro                         | Opcional; se informado, é validado |
| 6   | Admin rebaixar ou desativar a si mesmo  | Proibido (422)                     |
