# Ferramentas

## ESLint

O ESLint do monorepo é o **9.39.5**, com `eslint-plugin-unicorn` **65.0.1** e o `eslint-config-next` **16.4.2** completo. As versões estão fixadas sem intervalo no `packages/config`.

A estável mais recente do ESLint no momento da F0 é a 10.13.0, e a do Unicorn é a 78.0.0. Elas não entram porque o `eslint-config-next` 16.4.2 depende de `eslint-plugin-import`, `eslint-plugin-jsx-a11y` e `eslint-plugin-react`, que só declaram suporte até o ESLint 9. O Unicorn 78, por sua vez, exige ESLint `>=10.4`. Ficar no ESLint 10 obrigaria a descartar a config oficial do Next.

Gatilho de revisão: subir para ESLint 10 quando o `eslint-config-next` aceitar.

O preset `next` importa o `eslint-config-next` completo. O parser desse pacote carrega `next/dist/compiled/babel/eslint-parser`, então `@starter/config` também depende de `next`, `react` e `react-dom` nas versões exatas do app. Sem o `next` ao lado da config, o preset não chega a ser avaliado. O `apps/web` declara os mesmos pacotes de novo, porque é ele que executa a aplicação.

O `next build` instala `@types/react` quando o projeto TypeScript ainda não o tem. A versão gravada é a **19.3.0**. Sem esse pacote, o JSX não tem tipos.

As regras de fluxo, nomes, async e métricas ficam no preset `base`. `no-floating-promises` e `no-misused-promises` usam `projectService`. O `next-env.d.ts` fica fora do lint: é gerado pelo Next e aponta para `.next`.

`unicorn/filename-case` exige kebab-case e ignora dois padrões do Next: o segmento dinâmico `[...]` (como `[id]` e `[userId]`) e qualquer arquivo `.d.ts`. Sem o primeiro, um diretório `[userId]` falha; sem o segundo, um `SampleName.d.ts` falha.

O ADR pede `@typescript-eslint/naming-convention` sem listar os formatos. Os formatos usados são camelCase no padrão, PascalCase em tipos, funções e imports (componente React e o valor `Role`), e `UPPER_CASE` em constantes. O nome `_` fica livre, na mesma exceção do `id-length`.

No flat config, um padrão `!` solto dentro de `files` não exclui os outros: cada item é um OR. A exclusão de `*.client`, `hooks/` e `components/ui` entra como array interno (AND) para os blocos de `'use client'` e de hooks não se substituírem.

O plugin do Next procura `pages` ou `app` a partir do diretório de trabalho, e o glob que ele usa ignora o `cwd` do ESLint. O preset aponta `rootDir` para o caminho absoluto de `apps/web`, para o lint do pacote e o lint a partir da raiz acharem `src/app`.

O `lint-staged` roda na raiz. O `eslint --fix` usa o `eslint.config.mjs` da raiz, com `projectService`, para cada arquivo staged continuar enxergando o `tsconfig` do próprio pacote.

## TypeScript

O TypeScript do monorepo é o **6.0.3**. A estável mais recente é a 7.0.2, que o `typescript-eslint` 8.72.0 (`typescript` `<6.1.0`) ainda não aceita.

## pnpm

O pnpm 12 aplica `engineStrict` a partir do `pnpm-workspace.yaml`. O `.npmrc` mantém `engine-strict=true`, como pedido na spec, mas sozinho ele não faz o `pnpm install` falhar. O `allowBuilds` de `unrs-resolver` libera o script nativo que o `eslint-config-next` precisa para resolver imports. O de `@parcel/watcher` libera o watcher que o `@nestjs/cli` usa no `start:dev`.
