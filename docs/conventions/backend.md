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

## Bootstrap compartilhado (`configureApp`)

`configureApp(app, env)` em `apps/api/src/bootstrap/configure-app.ts` é usado **tanto por `main.ts` quanto pelos testes** (`createTestApp`), para não divergirem. Ela orquestra funções pequenas, uma por preocupação:

| Função        | Responsabilidade                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| prefixo       | `setGlobalPrefix('api')`                                                                             |
| segurança     | `helmet`, CORS restrito a `APP_ORIGIN` com `credentials: true`, `trust proxy` com `TRUST_PROXY_HOPS` |
| logger        | Troca o logger do Nest pelo pino (logs estruturados)                                                 |
| ciclo de vida | `enableShutdownHooks()`                                                                              |
| docs          | Swagger (condicional a `SWAGGER_ENABLED`)                                                            |

`main.ts` valida o ambiente **primeiro** e só depois cria a aplicação.

## Acesso ao ambiente só por `ENV`

- `AppConfigModule` global fornece o objeto tipado e imutável pelo token `ENV`.
- **Nenhum `process.env` fora de `apps/api/src/config/**` e `packages/scripts/**`** (regra de ESLint com fixture).

## Erros padronizados

- `ZodValidationPipe` global (`APP_PIPE`).
- `AllExceptionsFilter` global (`APP_FILTER`): `HttpException`→código próprio; erro de validação do `nestjs-zod`→400 com `details` por campo (`path`, `message`); qualquer outro→500 genérico, **sem stack e sem mensagem interna** em produção, logado com `requestId`.
- `ZodSerializerInterceptor` global (`APP_INTERCEPTOR`): serializa resposta com zod.
- Toda resposta de erro obedece ao `errorResponseSchema` do `shared`.

## Logs estruturados

`nestjs-pino` em `common/logging/`:

| Requisito  | Detalhe                                                                                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Request ID | Usa `x-request-id` recebido **se válido** (alfanumérico, `-`/`_`, até 64 chars); senão gera com `crypto.randomUUID()`. Devolve no header `x-request-id`, inclui em **todas** as linhas de log e na resposta de erro |
| Redação    | Redige `authorization`, `cookie`, `set-cookie` e campos `password`, `token`, `refreshToken`, `secret`; corpo de requisição **não** é logado por padrão                                                              |
| Formato    | Legível (`pino-pretty`, só dev) em desenvolvimento; JSON em produção; silencioso em `test` salvo `LOG_LEVEL` explícito                                                                                              |
| Ruído      | `/api/health` fora do log automático de requisições                                                                                                                                                                 |

## Health

- Rota: `GET /api/health`, **pública**.
- Verificações: Banco (`SELECT 1`) e Redis (`PING`), cada uma com timeout de 3 s.
- Resposta: **Mínima**: `{ "status": "ok" \| "error", "version": "<versão do package.json da API>" }`. **Sem detalhes de componentes.** HTTP 200 quando saudável e **503** quando não.
- Log: Não aparece no log automático de requisições.
