# Spec F0 — Fundação do monorepo

| Campo                  | Valor                                                     |
| ---------------------- | --------------------------------------------------------- |
| Status                 | Aguardando aprovação para execução                        |
| Data                   | 2026-10-21                                                |
| ADR de origem          | `docs/adr/0001-template-base-monorepo.md` (v2, aprovada)  |
| Executor               | Cursor                                                    |
| Destino no repositório | `docs/specs/F0-fundacao.md`                               |
| Branch sugerida        | `chore/f0-fundacao` (PR para `main`, para exercitar o CI) |

---

## 1. Objetivo

Deixar pronta a **base de ferramentas** do monorepo, provando de ponta a ponta que o pipeline funciona: instalar, lintar, checar tipos, testar e buildar, localmente e no CI. Esta fase não tem funcionalidade de produto. Os apps são esqueletos mínimos, existem só para exercitar o tooling.

## 2. Estado atual do repositório

| Item         | Situação                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| Git          | Inicializado, branch `main`, `origin` em `github.com/brunohhomem/starter-template`, 1 commit (`first commit`) |
| Arquivos     | `README.md` (só o título) e `docs/adr/0001-template-base-monorepo.md`                                         |
| Fim de linha | O `README.md` está com **CRLF na working tree** e LF no índice. Serve de caso real para a tarefa T1.          |
| Máquina      | Windows com nvm-windows                                                                                       |

## 3. Fora de escopo (não fazer na F0)

| Item                                                     | Fase         |
| -------------------------------------------------------- | ------------ |
| Docker, Postgres, Redis, Mailpit, Drizzle                | F1           |
| Validação de env, `keys:generate`, logs, Swagger, health | F1           |
| Auth, e-mail, storage, backup                            | F2 em diante |
| Tailwind, shadcn, tema, layout                           | F5           |
| Playwright e E2E                                         | F8           |
| Deploy, PM2, Nginx, Dependabot                           | F8           |

Não instale nada fora da lista de dependências desta spec. Se achar necessário, **pare e pergunte**.

## 4. Regras de execução

1. Trabalhe na branch `chore/f0-fundacao`, com **um commit por tarefa** (T1, T2, ...), em Conventional Commits (ex.: `chore: configura normalização de fim de linha`).
2. Use a **versão estável mais recente** de cada dependência no momento da execução, conferindo compatibilidade entre elas (principalmente ESLint × plugins × typescript-eslint). Fixe pelo lockfile e registre as versões escolhidas no `CHANGELOG.md`.
3. **Nunca** use `eslint-disable`, `@ts-ignore` ou afrouxe uma regra para fazer algo passar. Se uma regra do ADR conflitar com o resultado natural, **pare, informe qual regra, explique o conflito e pergunte**.
4. Não renomeie para nomes curtos nem fragmente código artificialmente para agradar uma métrica.
5. Se um plugin ou regra do ADR não for compatível com a versão atual do ESLint, **não descarte em silêncio**: reporte e proponha alternativa.
6. Todo texto novo de documentação em **pt-BR**.
7. Ao final, entregue o relatório da seção 12.

## 5. Estrutura final esperada

```
starter-template/
├─ apps/
│  ├─ api/                    NestJS mínimo
│  └─ web/                    Next.js mínimo (App Router)
├─ packages/
│  ├─ config/                 presets de tsconfig e ESLint
│  └─ shared/                 zod, enums, constantes
├─ docs/
│  ├─ adr/0001-template-base-monorepo.md   (já existe)
│  ├─ specs/F0-fundacao.md                 (esta spec)
│  └─ conventions/            backend.md, frontend.md, testing.md
├─ .cursor/rules/             backend.mdc, frontend.mdc
├─ .github/workflows/ci.yml
├─ .husky/                    pre-commit, commit-msg
├─ .vscode/                   settings.json, extensions.json
├─ AGENTS.md  CLAUDE.md  DESIGN.md  README.md  CHANGELOG.md
├─ .editorconfig  .gitattributes  .gitignore  .nvmrc  .npmrc
├─ .prettierrc.json  .prettierignore
├─ commitlint.config.mjs  lint-staged.config.mjs  eslint.config.mjs
└─ package.json  pnpm-workspace.yaml  turbo.json
```

Escopo dos pacotes: `@starter/api`, `@starter/web`, `@starter/shared`, `@starter/config`. O script `init:project` (F10) renomeará o escopo depois.

---

## 6. Tarefas

### T1 — Fim de linha e padrão de editor

**Entregáveis**

| Arquivo                   | Conteúdo                                                                                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.gitattributes`          | `* text=auto eol=lf`, mais marcação `binary` para imagens e fontes                                                                                                               |
| `.editorconfig`           | `root = true`, `charset = utf-8`, `end_of_line = lf`, `indent_style = space`, `indent_size = 2`, `insert_final_newline = true`, `trim_trailing_whitespace = true` (exceto `.md`) |
| `.prettierrc.json`        | `endOfLine: "lf"`, aspas simples, ponto e vírgula, `trailingComma: "all"`, `printWidth: 100`                                                                                     |
| `.prettierignore`         | `node_modules`, `.next`, `dist`, `.turbo`, `coverage`, `pnpm-lock.yaml`                                                                                                          |
| `.vscode/settings.json`   | `files.eol: "\n"`, formatar ao salvar com Prettier, ESLint com flat config                                                                                                       |
| `.vscode/extensions.json` | Recomendações: Prettier, ESLint, EditorConfig                                                                                                                                    |
| `.gitignore`              | `node_modules`, `.turbo`, `.next`, `dist`, `coverage`, `.env*` com exceção de `!.env.example`, logs e arquivos de SO                                                             |

Depois, rodar `git add --renormalize .` e commitar o resultado.

**Aceite**

1. `git ls-files --eol` mostra `i/lf` **e** `w/lf` em todos os arquivos de texto, inclusive o `README.md` (que hoje está `w/crlf`).
2. Abrir qualquer arquivo no VS Code e salvar não introduz CRLF.
3. O README (T12) documenta a recomendação `git config --global core.autocrlf false`.

### T2 — Versões de Node e pnpm

**Entregáveis**

| Arquivo               | Conteúdo                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------- |
| `.nvmrc`              | Versão exata do **Node LTS vigente**                                                         |
| `package.json` (raiz) | `private: true`, `packageManager` com a versão exata do pnpm, `engines` para `node` e `pnpm` |
| `.npmrc`              | `engine-strict=true`                                                                         |
| `pnpm-workspace.yaml` | `apps/*` e `packages/*`                                                                      |

Scripts na raiz: `build`, `lint`, `lint:fix`, `typecheck`, `test`, `format`, `format:check`, `prepare` (Husky). Todos via `turbo run`, exceto `format`/`prepare`.

**Aceite**

1. Com um Node fora do intervalo de `engines`, `pnpm install` **falha** com mensagem clara (testar alterando temporariamente `engines`).
2. `pnpm -v` bate com `packageManager`.
3. O README explica que o nvm-windows **não lê** o `.nvmrc` e que é preciso rodar `nvm use <versão>`.

### T3 — Turborepo

**Entregáveis:** `turbo.json` com as tarefas abaixo.

| Tarefa             | Configuração                                                 |
| ------------------ | ------------------------------------------------------------ |
| `build`            | `dependsOn: ["^build"]`, `outputs` de `dist/**` e `.next/**` |
| `lint`             | Cacheável                                                    |
| `typecheck`        | `dependsOn: ["^build"]`                                      |
| `test`             | `dependsOn: ["^build"]`                                      |
| `test:integration` | `cache: false` (declarada, sem uso na F0)                    |
| `test:e2e`         | `cache: false` (declarada, sem uso na F0)                    |

**Regra a documentar em `docs/conventions/testing.md`:** toda variável de ambiente usada por uma tarefa precisa estar declarada em `env`/`globalEnv`, senão o cache devolve resultado velho.

**Aceite:** a segunda execução de `pnpm turbo run lint typecheck test build` aparece como `FULL TURBO` (cache hit) sem alterações no código.

### T4 — `packages/config`

**Entregáveis**

| Item                | Detalhe                                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Presets de tsconfig | `base.json` (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`), `node.json` (API), `next.json` (web) |
| Presets de ESLint   | `base`, `nest` e `next`, exportados como configs flat                                                                                        |
| Consumo             | Todos os apps e pacotes herdam daqui; nenhum repete configuração                                                                             |

**Aceite:** alterar uma regra no preset base reflete nos três consumidores (`api`, `web`, `shared`) sem editar mais nada.

### T5 — `packages/shared`

**Entregáveis**

| Item            | Detalhe                                                                   |
| --------------- | ------------------------------------------------------------------------- |
| Dependência     | `zod`                                                                     |
| Conteúdo mínimo | `Role` (`admin`, `user`) e `roleSchema`, com tipos inferidos              |
| Teste           | Vitest cobrindo `roleSchema` (aceita `admin`/`user`, rejeita outro valor) |

O conteúdo é mínimo de propósito: serve para provar a ligação entre pacotes. Paginação, DTOs e demais schemas entram nas fases seguintes.

**Decisão delegada ao executor (registrar no relatório):** o mecanismo de consumo do `shared` por `apps/api` (Nest, tipicamente CommonJS) e `apps/web` (Next). Escolha o **mais simples que funcione sem duplicar tipos** (por exemplo, build do `shared` com `tsc` ou `tsup` gerando CJS e ESM com `exports` corretos). Documente a escolha em `docs/conventions/backend.md`.

**Aceite:** `apps/api` e `apps/web` importam `Role` de `@starter/shared` com tipos completos, e `pnpm build` funciona do zero.

### T6 — `apps/api` (NestJS mínimo)

**Entregáveis**

| Item    | Detalhe                                                                                 |
| ------- | --------------------------------------------------------------------------------------- |
| Código  | `AppModule` e `main.ts`. **Sem** controller de exemplo, sem "Hello World".              |
| Scripts | `start:dev`, `build`, `lint`, `typecheck`, `test`                                       |
| Testes  | Jest. Um teste de "fiação" que importa `Role` de `@starter/shared` e confere os valores |

**Aceite:** `pnpm --filter @starter/api start:dev` sobe sem erro, e `pnpm turbo run test --filter @starter/api` passa.

### T7 — `apps/web` (Next.js mínimo)

**Entregáveis**

| Item   | Detalhe                                                                                                                                   |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Código | App Router, TypeScript, uma `page.tsx` (server component) com um título simples, `layout.tsx` básico. **Sem Tailwind e sem shadcn** (F5). |
| Lint   | Rodar o **ESLint CLI diretamente**, sem depender de `next lint`                                                                           |
| Testes | Vitest + Testing Library. Um teste de "fiação" que importa `Role` do `shared`                                                             |

**Aceite:** `pnpm --filter @starter/web dev` abre a página, `build` passa, `test` passa.

### T8 — ESLint calibrado (a tarefa mais importante da F0)

Config em `packages/config/eslint`, consumida pela raiz. Todas as regras vêm da seção 3.2 do ADR.

**Regras e níveis**

| Categoria     | Regras                                                                                                                                                                 | Nível    |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Fluxo         | `no-else-return` (`allowElseIf: false`), `no-lonely-if`, `no-nested-ternary`                                                                                           | error    |
| Tipos e async | `@typescript-eslint/no-explicit-any`, `no-floating-promises`, `no-misused-promises` (com informação de tipo, via `projectService`)                                     | error    |
| Nomes         | `id-length` (mínimo 2, exceção só `_`), `@typescript-eslint/naming-convention`, `unicorn/filename-case` em kebab-case (ignorando padrões do Next como `[id]`, `.d.ts`) | error    |
| Desativação   | `eslint-comments/require-description`, `no-unlimited-disable`, `reportUnusedDisableDirectives: "error"`                                                                | error    |
| Métricas      | `complexity` 10, `max-lines-per-function` 50, `max-lines` 300, `max-params` 4, `max-depth` 3 (sem contar linhas em branco e comentários)                               | **warn** |

**Fronteiras entre camadas (error)**

| Arquivos                                                                        | Proibição                                                                                                                                              |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/api/src/**/*.controller.ts`                                               | Importar `drizzle-orm`, `drizzle-orm/*` ou `*.repository`                                                                                              |
| `apps/api/src/**/*.service.ts`                                                  | Importar `drizzle-orm` ou `drizzle-orm/*`                                                                                                              |
| `apps/web/src/**` (exceto `*.client.ts(x)` e `components/ui/**`)                | Diretiva `'use client'`, via `no-restricted-syntax` com o seletor `ExpressionStatement[directive="use client"]`. Isso cobre `page.tsx` e `layout.tsx`. |
| `apps/web/src/**/*.tsx` (exceto `*.client.tsx`, `hooks/**`, `components/ui/**`) | Chamar hooks (`CallExpression` cujo callee casa com `/^use[A-Z]/`)                                                                                     |

**Atenção ao flat config:** quando dois blocos casam o mesmo arquivo, o **último substitui** as opções da mesma regra, não as soma. Monte as listas de `no-restricted-syntax` por **conjuntos de arquivos exclusivos** (cliente/ui sem restrição; `hooks/**` só com a restrição de `'use client'`; o restante com as duas). O `components/ui/**` (shadcn, F5) fica isento porque o shadcn gera arquivos com `'use client'` sem o sufixo `.client`.

**Exceções às métricas** (override, só as métricas ficam `off`): `*.spec.ts`, `*.test.ts(x)`, `**/seed/**`, `*.entity.ts`, `**/schema/**`, `*.dto.ts`, `**/migrations/**`, `*.config.*`.

**Teste da própria configuração:** criar um teste em `packages/config` que usa a API do ESLint (`lintText` com `filePath` virtual) e confirma, com **fixtures inválidas**, que cada regra de error dispara com o `ruleId` esperado, e que fixtures válidas passam limpas. Cobrir ao menos: `any`, `else` após `return`, promise flutuante, nome de 1 letra, controller importando `drizzle-orm`, service importando `drizzle-orm`, `'use client'` em `page.tsx`, `'use client'` em arquivo sem `.client`, hook em arquivo sem `.client`, `eslint-disable` sem descrição, e as métricas disparando como **warn** (não error).

**Aceite**

1. `pnpm lint` passa sem erros em todo o repositório.
2. O teste da configuração passa e **falha** se uma regra for removida (provar removendo uma regra temporariamente).
3. Nenhum `eslint-disable` no repositório.

### T9 — Git hooks (Husky, lint-staged, commitlint)

**Entregáveis**

| Arquivo                  | Conteúdo                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `.husky/pre-commit`      | `pnpm lint-staged`                                                                                                             |
| `.husky/commit-msg`      | `pnpm commitlint --edit "$1"`                                                                                                  |
| `lint-staged.config.mjs` | Código (`ts, tsx, js, mjs, cjs`): `eslint --fix` e `prettier --write`. Demais (`json, md, yml, yaml, css`): `prettier --write` |
| `commitlint.config.mjs`  | `@commitlint/config-conventional`                                                                                              |

**Decisão delegada ao executor:** como rodar o ESLint **com informação de tipo** no lint-staged num monorepo (por exemplo, a partir da raiz com `projectService`). Se ficar lento ou instável, reporte antes de simplificar.

**Aceite**

1. `git commit -m "teste"` é **rejeitado**; `git commit -m "chore: exemplo"` passa.
2. Um arquivo staged com `any` **bloqueia** o commit; um arquivo mal formatado é corrigido automaticamente.
3. Os hooks funcionam no Windows (Git for Windows) e os arquivos de `.husky/` estão com LF.

### T10 — Instruções para agentes de IA

Baseado na seção 3.14 do ADR. **Não invente regras novas**: o conteúdo vem das seções 3.2, 3.11 e 3.13 do ADR. Se algo estiver ambíguo, pergunte.

| Arquivo                        | Conteúdo                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AGENTS.md`                    | **Até ~120 linhas.** Descrição do projeto (um parágrafo), comandos, fluxo (ADR → spec → aprovação → execução; não implementar sem spec aprovada), regras inegociáveis em lista numerada, e **índice** dizendo quando ler cada documento (UI → `DESIGN.md`; `apps/api` → `docs/conventions/backend.md`; `apps/web` → `frontend.md`; testes → `testing.md`; decisões → `docs/adr/`) |
| `CLAUDE.md`                    | Apenas `@AGENTS.md`                                                                                                                                                                                                                                                                                                                                                               |
| `DESIGN.md`                    | Seções do ADR 3.14 (princípios, tokens como semântica, componentes, estados, acessibilidade, proibições). Sem valores de cor: aponta o `globals.css`, que só nasce na F5.                                                                                                                                                                                                         |
| `docs/conventions/backend.md`  | Camadas (entity, dto, repository, service, controller), guard clauses, zod, `unknown` + zod em integrações, **checklist de SRP**, mecanismo de consumo do `shared` (T5)                                                                                                                                                                                                           |
| `docs/conventions/frontend.md` | Separação `'use client'`, pastas por feature, **mobile-first** completo (ADR 3.11)                                                                                                                                                                                                                                                                                                |
| `docs/conventions/testing.md`  | Jest na API, Vitest no web e no `shared`, regra de `env` no Turbo (T3), cenários obrigatórios do ADR 3.13                                                                                                                                                                                                                                                                         |
| `.cursor/rules/backend.mdc`    | `globs: apps/api/**`, `alwaysApply: false`, uma linha mandando ler `docs/conventions/backend.md`                                                                                                                                                                                                                                                                                  |
| `.cursor/rules/frontend.mdc`   | `globs: apps/web/**`, `alwaysApply: false`, uma linha mandando ler `docs/conventions/frontend.md` e `DESIGN.md`                                                                                                                                                                                                                                                                   |

**Aceite**

1. `CLAUDE.md` contém só o import (mais, no máximo, uma nota específica do Claude).
2. `AGENTS.md` tem no máximo ~120 linhas e todos os caminhos citados existem.
3. As regras de `.cursor/rules` são finas: nenhum conteúdo duplicado dos documentos de `docs/conventions/`.

### T11 — CI mínimo (GitHub Actions)

**Entregável:** `.github/workflows/ci.yml`.

| Item         | Detalhe                                                                                                                                                                                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Gatilhos     | `pull_request` e `push` na `main`                                                                                                                                                                                                                                                          |
| Segurança    | `permissions: contents: read`; `concurrency` cancelando execuções antigas da mesma ref                                                                                                                                                                                                     |
| Passos       | Checkout (`fetch-depth: 0`), pnpm via `pnpm/action-setup` (versão vinda do `packageManager`), `actions/setup-node` com `node-version-file: .nvmrc` e `cache: pnpm`, `pnpm install --frozen-lockfile`, cache da pasta `.turbo` (`actions/cache`, chave por `github.sha` com `restore-keys`) |
| Verificações | `pnpm format:check`; **guarda de fim de linha**: falha se `git ls-files --eol` mostrar `i/crlf` ou `i/mixed`; `pnpm turbo run lint typecheck test build`; em PR, `commitlint` sobre o intervalo de commits da PR                                                                           |
| Ações        | Fixadas na **major** mais recente (confirmar a versão atual de cada uma)                                                                                                                                                                                                                   |

**Aceite:** abrir uma PR de teste e anexar o link da execução **verde**. Também provar que o CI **falha** com um commit fora do padrão ou com CRLF no índice.

### T12 — README e CHANGELOG

| Arquivo        | Conteúdo                                                                                                                                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`    | O que é o template (2 a 3 frases), requisitos (Node via `.nvmrc`, pnpm), nota do nvm-windows, recomendação `core.autocrlf false`, comandos principais, estrutura de pastas e links para o ADR e para esta spec |
| `CHANGELOG.md` | Formato Keep a Changelog; entrada da F0 com **as versões escolhidas** das dependências principais                                                                                                              |

---

## 7. Dependências permitidas

| Onde              | Pacotes                                                                                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Raiz              | `turbo`, `prettier`, `husky`, `lint-staged`, `@commitlint/cli`, `@commitlint/config-conventional`, `typescript`, `eslint`                                         |
| `packages/config` | `typescript-eslint`, `@eslint-community/eslint-plugin-eslint-comments`, `eslint-plugin-unicorn`, `eslint-plugin-react-hooks` e a config oficial do ESLint do Next |
| `packages/shared` | `zod`, `vitest`                                                                                                                                                   |
| `apps/api`        | `@nestjs/*` mínimos para subir, `reflect-metadata`, `rxjs`, `jest` e o transformador de TS escolhido (ts-jest ou swc)                                             |
| `apps/web`        | `next`, `react`, `react-dom`, `vitest`, `@testing-library/react`, `jsdom`                                                                                         |

Qualquer outro pacote exige pergunta antes.

## 8. Decisões delegadas ao executor

| #   | Decisão                                            | Critério                                                      |
| --- | -------------------------------------------------- | ------------------------------------------------------------- |
| 1   | Mecanismo de consumo do `shared` (T5)              | O mais simples que funciona nos dois apps, sem duplicar tipos |
| 2   | Transformador de TS no Jest (ts-jest ou swc)       | O mais estável com decorators do Nest                         |
| 3   | Estratégia do ESLint com tipos no lint-staged (T9) | Rápida e confiável; reportar se precisar simplificar          |

Registrar cada uma no relatório final e em `docs/conventions/`.

## 9. Atenções específicas

| #   | Atenção                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | O ESLint em flat config **substitui** as opções de uma regra no último bloco que casa. Isso vale para `no-restricted-syntax` e `no-restricted-imports` (T8). |
| 2   | O `projectService` do typescript-eslint em monorepo exige configuração correta de `tsconfig` por pacote.                                                     |
| 3   | No Windows, os hooks do Husky rodam via Git for Windows; garantir LF nos arquivos de `.husky/`.                                                              |
| 4   | Plugins de ESLint costumam atrasar nas majors do ESLint. Conferir compatibilidade antes de fixar versões.                                                    |
| 5   | A Next removeu ou deprecou o `next lint` nas versões recentes; por isso o ESLint CLI direto.                                                                 |
| 6   | O CI não pode ser verificado localmente: a evidência é a execução real numa PR.                                                                              |

## 10. Definição de pronto

Todos os itens abaixo devem estar verdes, na branch limpa e em um clone novo:

1. `pnpm install --frozen-lockfile`
2. `pnpm format:check`
3. `pnpm lint` (0 erros; warnings listados no relatório)
4. `pnpm typecheck`
5. `pnpm test` (inclui o teste da configuração do ESLint)
6. `pnpm build`
7. `git ls-files --eol` sem nenhum `crlf`
8. Hooks provados (commit ruim bloqueado, commit bom aceito)
9. CI verde numa PR real e CI vermelho provado nos dois casos da T11
10. Nenhum `eslint-disable` e nenhum `any` sem descrição no código

## 11. Entregáveis finais

A PR `chore/f0-fundacao` com os commits por tarefa e o relatório da seção 12.

## 12. Relatório que o Cursor deve devolver

| Seção                | Conteúdo                                                                    |
| -------------------- | --------------------------------------------------------------------------- |
| Resultado por tarefa | T1 a T12: concluída, parcial ou bloqueada                                   |
| Evidências           | Saída dos comandos da seção 10 e link da execução do CI                     |
| Versões              | Tabela das versões escolhidas                                               |
| Decisões delegadas   | Escolha e motivo para cada item da seção 8                                  |
| Desvios e conflitos  | Qualquer regra do ADR que conflitou, plugin incompatível ou tarefa alterada |
| Warnings de métricas | Lista dos warnings atuais (serve de base para calibrar os limites)          |
