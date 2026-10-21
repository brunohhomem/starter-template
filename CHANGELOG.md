# Changelog

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Não publicado]

### Alterado

- O ESLint fica em 9.39.5, com `eslint-plugin-unicorn` 65.0.1, para carregar o `eslint-config-next` 16.4.2 completo. A estável mais recente do ESLint é a 10.13.0 e a do Unicorn é a 78.0.0; os plugins trazidos pelo `eslint-config-next` só declaram suporte até o ESLint 9. Gatilho de revisão: subir para ESLint 10 quando o `eslint-config-next` aceitar.
- O `@starter/config` depende de `next` 16.4.2, `react` 19.3.1 e `react-dom` 19.3.1 porque o parser do `eslint-config-next` importa `next/dist/compiled/babel/eslint-parser`.
- O TypeScript fica em 6.0.3. A estável mais recente é a 7.0.2, ainda fora do intervalo aceito pelo `typescript-eslint` 8.72.0 e pelo `ts-jest`.
