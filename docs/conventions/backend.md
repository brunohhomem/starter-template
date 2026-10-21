# Backend

## Consumo do `@starter/shared`

O `@starter/shared` é compilado com `tsc` para **CommonJS** e declarações (`.d.ts`), num único build. O `package.json` expõe `types` e `default` para o mesmo artefato.

Essa é a ligação mais simples que funciona nos dois apps sem duplicar tipos: o Nest compila para CommonJS e faz `require` do pacote; o Next resolve o mesmo JavaScript e os tipos pelo campo `exports`. Um build duplo ESM e CJS exigiria dois `tsconfig` e um passo extra de extensão, sem ganho nesta fase.
