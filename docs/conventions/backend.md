# Backend

## Camadas

Cada arquivo tem uma responsabilidade.

| Arquivo           | Responsabilidade                                        |
| ----------------- | ------------------------------------------------------- |
| `*.entity.ts`     | Tabela Drizzle e tipos inferidos (`InferSelectModel`)   |
| `*.dto.ts`        | Schemas zod de entrada e saída, reaproveitando `shared` |
| `*.repository.ts` | Acesso a dados                                          |
| `*.service.ts`    | Regra de negócio                                        |
| `*.controller.ts` | HTTP: valida, delega ao service e responde              |

Controller não importa `drizzle-orm` nem `*.repository`. Service não importa `drizzle-orm`. Pastas são por feature.

## Guard clauses

Valide e falhe no início da função. Evite `else`. Não percorra o corpo inteiro para só no final descobrir que a entrada era inválida.

## zod

A validação de entrada e de saída usa zod. Schema compartilhado entre API e web mora em `packages/shared`.

Dado que chega de um serviço externo entra como `unknown` na camada de integração (`integrations/`) e só segue depois do parse do zod. `any` só com `eslint-disable` e uma descrição do motivo.

## Checklist de responsabilidade única

1. Descreva o que a função faz em uma frase. Se aparecer um "e" (valida e salva e envia e-mail), divida.
2. Quantos motivos diferentes teriam para mudar essa função? Mais de um indica mais de uma responsabilidade.
3. Se o nome honesto precisa de "And" ou "Manager", ela faz coisa demais.
4. Se testar a unidade exige muitos mocks, ela provavelmente depende de coisa demais.

## Consumo do `@starter/shared`

O `@starter/shared` é compilado com `tsc` para **CommonJS** e declarações (`.d.ts`), num único build. O `package.json` expõe `types` e `default` para o mesmo artefato.

Essa é a ligação mais simples que funciona nos dois apps sem duplicar tipos: o Nest compila para CommonJS e faz `require` do pacote; o Next resolve o mesmo JavaScript e os tipos pelo campo `exports`. Um build duplo ESM e CJS exigiria dois `tsconfig` e um passo extra de extensão, sem ganho nesta fase.
