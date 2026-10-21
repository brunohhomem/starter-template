# Testes

## Variáveis de ambiente e o cache do Turborepo

Toda variável de ambiente usada por uma tarefa precisa estar declarada em `env` ou `globalEnv` no `turbo.json`. Sem isso, o cache devolve um resultado velho.

## Jest na API

O transformador do Jest é o **ts-jest**. Ele é o caminho estável com os decorators do Nest (`experimentalDecorators` e `emitDecoratorMetadata`). O `@swc/jest` exige `@swc/core` e já teve diferença de metadata em relação ao `tsc` que o Nest usa no build.

O teste importa `describe`, `expect` e `it` de `@jest/globals`. O pnpm não deixa importar esse pacote só porque o `jest` o traz por baixo, então ele é dependência direta da API, na mesma versão que o Jest já usa.
