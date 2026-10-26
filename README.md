# starter-template

Monorepo para fork. A API é NestJS, o web é Next.js e o contrato compartilhado fica em `packages/shared`. O v1 já traz autenticação, pessoas, convites, e-mail, configurações e a área logada.

## Requisitos

- Node.js na versão do `.nvmrc` (24.22.1). No nvm-windows: `nvm use 24.22.1`.
- pnpm 12.14.0, declarado em `packageManager`.
- Docker, para Postgres 18, Redis e Mailpit.

O `.gitattributes` grava texto com LF.

## Primeiro uso

O Compose lê senha e porta do `.env`. Gere as chaves antes de subir a infra.

```bash
pnpm install
pnpm keys:generate
pnpm infra:up
pnpm db:migrate
pnpm db:seed
pnpm --filter @starter/api start:dev
pnpm worker:dev
pnpm --filter @starter/web dev
```

- `pnpm keys:generate` cria o `.env` e não sobrescreve valor que já existe.
- `pnpm infra:up` sobe Postgres, Redis e Mailpit. Os e-mails de desenvolvimento aparecem em `http://localhost:8025`.
- `pnpm db:seed` cria o admin de `ADMIN_EMAIL`. Em development a senha inicial é `Admin@12345` e a troca obrigatória fica desligada. Em production a senha é aleatória, aparece uma vez no terminal e a troca é obrigatória.
- A API fica em `http://localhost:3001` e o web em `http://localhost:3000`. `GET /api/health` responde `200`.

## Checklist pós-fork

- [ ] Renomear os pacotes `@starter/*` e o nome do app na landing e no título.
- [ ] Definir `ADMIN_EMAIL` e gerar as chaves de novo com `pnpm keys:generate`.
- [ ] Apagar a landing em `apps/web/src/app/page.tsx` se o produto não for usá-la.
- [ ] Revisar `registration_enabled`: ligado em development, desligado em production, até um admin mudar em `/app/settings`.

## Comandos

- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm build`
- `pnpm format` e `pnpm format:check`
- `pnpm --filter @starter/api start:dev`, `pnpm worker:dev`, `pnpm --filter @starter/web dev`
- `pnpm infra:up` / `pnpm infra:down` / `pnpm infra:logs` / `pnpm infra:reset`
- `pnpm keys:generate` [--file <caminho>] / `pnpm keys:rotate <NOME>` [--yes]
- `pnpm db:generate <nome>` / `pnpm db:migrate` / `pnpm db:seed` / `pnpm db:studio`
- `pnpm boot:check` sobe o build de produção da API e do worker e espera `GET /api/health`
- `pnpm e2e` roda o smoke mobile contra o build de produção

## Onde ler

- Decisões: [`docs/adr/0002-template-enxuto-v1.md`](docs/adr/0002-template-enxuto-v1.md)
- Autenticação: [`docs/auth.md`](docs/auth.md)
- E-mail: [`docs/email.md`](docs/email.md)
- Agentes: [`AGENTS.md`](AGENTS.md)
