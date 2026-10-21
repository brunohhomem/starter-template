# starter-template

Template de monorepo para uma API NestJS e um web Next.js, com o contrato compartilhado e a fundação de ferramentas já no lugar. O fim de linha é LF, o Turborepo orquestra os pacotes e o ESLint, os testes e o CI seguram o que a spec da fundação pede. Banco, autenticação e a UI do produto entram nas fases seguintes, cada uma com spec aprovada.

## Requisitos

- Node.js na versão do `.nvmrc` (24.22.1)
- pnpm 12.14.0, declarado em `packageManager`

No nvm-windows o `.nvmrc` não é lido sozinho. Rode `nvm use 24.22.1`.

Recomendado neste repositório: `git config --global core.autocrlf false`. O `.gitattributes` já grava texto com LF.

## Comandos

- `pnpm install`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm format` e `pnpm format:check`
- `pnpm --filter @starter/api start:dev`
- `pnpm --filter @starter/web dev`

## Estrutura

- `apps/api`: NestJS
- `apps/web`: Next.js
- `packages/shared`: contrato compartilhado
- `packages/config`: presets de TypeScript e ESLint
- `docs/adr`: decisões
- `docs/specs`: specs por fase
- `docs/conventions`: detalhe lido sob demanda

## Decisões

- ADR: [`docs/adr/0001-template-base-monorepo.md`](docs/adr/0001-template-base-monorepo.md)
- Spec desta fundação: [`docs/specs/F0-fundacao.md`](docs/specs/F0-fundacao.md)
