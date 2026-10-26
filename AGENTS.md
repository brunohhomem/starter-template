# AGENTS.md

Este repositório é o template base de um monorepo pnpm. A API é NestJS (`apps/api`), o web é Next.js (`apps/web`) e o contrato compartilhado fica em `packages/shared`. Os presets de TypeScript e ESLint ficam em `packages/config`.

## Comandos

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:integration`
- `pnpm build`
- `pnpm format` e `pnpm format:check`
- `pnpm --filter @starter/api start:dev`
- `pnpm worker:dev`
- `pnpm --filter @starter/web dev`
- `pnpm infra:up` / `pnpm infra:down` / `pnpm infra:logs` / `pnpm infra:reset`
- `pnpm keys:generate` [--file <caminho>] / `pnpm keys:rotate <NOME>` [--yes]
- `pnpm db:generate <nome>` / `pnpm db:migrate` / `pnpm db:seed` / `pnpm db:studio`
- `pnpm boot:check`
- `pnpm e2e`

## Fluxo

1. A decisão mora no ADR, em `docs/adr/`.
2. O trabalho mora numa spec em `docs/specs/`.
3. A spec precisa estar aprovada antes da execução.
4. Não implemente uma fase sem spec aprovada.

## Arquivos temporários gerados por scripts

- `keys:rotate` cria `.env.bak-<timestamp>` como backup antes de rotacionar. **Apague o arquivo após verificar que a rotação funcionou.** Nunca commite nem deixe acumulado no workspace.
- `keys:generate` cria `.env.tmp` durante a escrita atômica. O arquivo é sobrescrito a cada execução; apague se ficar órfão.
- Ambos já estão cobertos pelo `.gitignore` (regra `.env*`), mas acúmulo no disco é indesejado.

## Regras inegociáveis

1. Responsabilidade única. O checklist está em `docs/conventions/backend.md`.
2. Nomes descritivos e completos. Comentário explica o porquê, não o quê.
3. Guard clause: valide e falhe no início da função. Evite `else`.
4. Não renomeie para um nome curto, não divida uma função só para caber numa métrica e não use `eslint-disable` para satisfazer uma métrica.
5. Se uma regra de lint conflitar com o código natural, pare, diga qual regra e pergunte.
6. `any` só com `eslint-disable` e uma descrição. Dado de fora entra como `unknown` e é validado com zod.
7. Controller não importa `drizzle-orm` nem `*.repository`. Service não importa `drizzle-orm`.
8. `page.tsx` e `layout.tsx` não levam `'use client'`. O que precisa de cliente fica em `*.client.tsx`.
9. Hook só em `*.client.tsx`, em `hooks/` ou em `components/ui`.
10. Mobile-first: o estilo base é o de mobile e só cresce com `min-width`. Variante `max-*` não entra.
11. Testes são a rede de segurança de qualquer refatoração.
12. Texto de instrução não substitui o que o ESLint, os testes, o Husky e o CI já impõem.

## Índice

- Ao criar ou alterar UI, leia `DESIGN.md`.
- `apps/api`: `docs/conventions/backend.md`.
- `apps/web`: `docs/conventions/frontend.md`.
- Testes: `docs/conventions/testing.md`.
- Banco: `docs/conventions/database.md`.
- Decisões: `docs/adr/`.
- Ao mexer em versões, ESLint, Husky ou CI, leia `docs/conventions/tooling.md`.
- Autenticação: leia `docs/auth.md`. Toda rota nova é protegida por padrão; `@Public()` exige justificativa em comentário de uma linha.
- E-mail: leia `docs/email.md`. Drivers, fila BullMQ, TTLs dos tokens e risco aceito sobre o token no payload.
- Smoke E2E: `pnpm e2e`. O detalhe está em `docs/conventions/testing.md`.
