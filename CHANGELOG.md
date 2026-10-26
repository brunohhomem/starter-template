# Changelog

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [1.0.0] - 2026-10-26

### Adicionado

- Fundação do monorepo: normalização LF, Turborepo, presets de TypeScript e ESLint, `@starter/shared`, esqueletos da API e do web, hooks de commit, instruções para agentes e CI.
- O preset de ESLint aplica as regras da seção 3.2 do ADR. `unicorn/filename-case` ignora segmentos `[...]` do Next e arquivos `.d.ts`.
- Hooks de commit com `husky` 9.1.7, `lint-staged` 17.6.0, `prettier` 3.9.10 e `@commitlint/cli` / `@commitlint/config-conventional` 21.2.4.
- Node 24.22.1 e pnpm 12.14.0
- TypeScript 6.0.3 e `typescript-eslint` 8.72.0
- ESLint 9.39.5, `eslint-plugin-unicorn` 65.0.1, `eslint-config-next` 16.4.2, `eslint-plugin-react-hooks` 7.1.1 e `@eslint-community/eslint-plugin-eslint-comments` 4.8.1
- Next 16.4.2, React 19.3.1, React DOM 19.3.1 e `@types/react` 19.3.0
- NestJS 12.2.0 (`common`, `core`, `platform-express`), `@nestjs/cli` 12.0.10, `reflect-metadata` 0.2.2 e `rxjs` 7.8.2
- Vitest 5.0.5, `@testing-library/react` 16.3.3, `jsdom` 30.1.3, zod 4.6.7 e `@playwright/test` 1.64.1
- Autenticação com cookies, pessoas, convites, e-mail com fila, configurações e a área logada no web
- Smoke E2E no CI, contra o build de produção, em viewport 390×844
- Turborepo 2.11.10, Prettier 3.9.10, Husky 9.1.7 e lint-staged 17.6.0
- GitHub Actions nas majors `actions/checkout` v7, `actions/setup-node` v7, `actions/cache` v6 e `pnpm/action-setup` v6
- **F1 — Banco e base da API:**
  - `drizzle-orm` 0.44.2, `drizzle-kit` 0.31.1, `pg` 8.13.1, `@types/pg` 8.11.10
  - `ioredis` 6.0.0, `nestjs-pino` 4.2.0, `pino` 9.5.0, `pino-http` 10.3.0, `pino-pretty` 13.0.0
  - `@nestjs/swagger` 12.0.2, `@nestjs/terminus` 12.1.0, `nestjs-zod` 5.5.0, `helmet` 8.3.0
  - `supertest` 7.2.1, `@types/supertest` 7.2.1
  - `unplugin-swc` 1.5.1, `@swc/core` 1.16.18 (para testes de integração Vitest + decorators)
  - `tsx` 4.23.15 (scripts de banco)
- **F1 — Ajuste de fase:** entity `system_settings` + repository + migration `create_system_settings` movida da F3 para F1 (dá caso real ao pipeline: coreColumns, geração de migration, migrate, reset, integração).

### Alterado

- O teste das regras do ESLint grava as fixtures num monorepo isolado em `packages/config/eslint/fixtures`, com `tsconfig` e config que reutilizam os presets. O diretório é `fixtures` porque `unicorn/filename-case` rejeita `__fixtures__`. O Turborepo pode lintar, checar tipos e buildar os apps ao mesmo tempo.
- O runner do CI é `ubuntu-24.04`, pinado para a imagem não mudar quando o GitHub apontar o rótulo `latest` para o Ubuntu 26. O job `verify` encerra em 15 minutos.
- O ESLint fica em 9.39.5, com `eslint-plugin-unicorn` 65.0.1, para carregar o `eslint-config-next` 16.4.2 completo. A estável mais recente do ESLint é a 10.13.0 e a do Unicorn é a 78.0.0; os plugins trazidos pelo `eslint-config-next` só declaram suporte até o ESLint 9. Gatilho de revisão: subir para ESLint 10 quando o `eslint-config-next` aceitar.
- O `@starter/config` depende de `next` 16.4.2, `react` 19.3.1 e `react-dom` 19.3.1 porque o parser do `eslint-config-next` importa `next/dist/compiled/babel/eslint-parser`.
- O `apps/web` depende de `@types/react` 19.3.0. O `next build` recusa checar o TypeScript sem os tipos do JSX.
- O TypeScript fica em 6.0.3. A estável mais recente é a 7.0.2, ainda fora do intervalo aceito pelo `typescript-eslint` 8.72.0.

### Removido

- Jest, `@jest/globals` e `ts-jest`. O runner da API, do web e do `shared` é o Vitest.
