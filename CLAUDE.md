@AGENTS.md

---

Regras de trabalho deste projeto. O fluxo (brainstorm → plano → execução por subagentes) é conduzido pela Superpowers. Este arquivo define COMO cada passo deve ser feito. Em caso de conflito entre uma skill e este arquivo, este arquivo vence.

## Projeto

- Stack: TypeScript — NestJS (API), Next.js (web), Drizzle ORM, pnpm (monorepo)
- Comandos:
  - testes: `pnpm test`
  - lint/types: `pnpm lint && pnpm typecheck`
  - subir o app: `pnpm dev`
- Infra local: Postgres e Redis rodam SOMENTE via Docker (`pnpm infra:up`).
- NUNCA instale programas, CLIs globais ou bancos na máquina. Dependências só no projeto.

## 1. Planejar pequeno, implementar aos poucos

- Todo plano é uma lista de incrementos pequenos. Cada incremento: a. entrega um comportamento observável; b. cabe em um commit; c. deixa testes e build verdes.
- Se um incremento passar de ~200 linhas de diff ou ~5 arquivos, quebre em dois.
- Na fase de descoberta (estrutura ainda incerta), prefira um incremento funcional e iterar a especificar tudo antes. O design certo emerge da iteração.
- Não replaneje o que já está no plano aprovado. Execute a lista existente.

## 2. Testes

- Feature nova: teste junto com o código, no mesmo commit.
- Bug: primeiro um teste de regressão que falha, depois a correção.
- TDD estrito (teste antes do código) para regra de negócio, cálculos, validações e integrações.
- Para scaffolding, telas e CRUD trivial, o teste pode vir logo depois do código, no mesmo incremento. Não apague código só porque o teste veio depois.
- Banco: teste contra Postgres real em container. Não use mock de ORM ou queries.
- Nunca enfraqueça, pule ou apague um teste para fazê-lo passar.

## 3. Commits

- Um commit por incremento concluído e verde. Nada de `git add .` às cegas: adicione só os arquivos da tarefa.
- Mensagem: Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`).
- Nunca commite com testes, lint ou typecheck falhando.
- Refatoração vai em commit separado, sem mudança de comportamento.

## 4. Simplicidade primeiro

- Escreva o mínimo de código que resolve o incremento atual.
- Sem abstrações, interfaces, generics ou configurações "para o futuro".
- Sem dependência nova se a solução couber em poucas linhas. Se adicionar, justifique no commit.
- Três repetições antes de extrair uma abstração.

## 5. Mudanças cirúrgicas

- Toque só no que a tarefa exige. Não reformate, renomeie ou "melhore" código fora do escopo.
- Não remova comentários, testes ou código que você não entende. Registre a dúvida.
- Achou um problema fora do escopo? Anote em `NOTES.md` e siga. Não corrija agora.

## 6. Código legível para agentes

- Arquivos pequenos (alvo < 300 linhas) e funções curtas.
- Nomes explícitos e buscáveis. Evite abreviações e nomes genéricos (`utils`, `helpers`, `data`).
- Tipos explícitos nas fronteiras (API, banco, funções exportadas).
- Erros com mensagem que diga o que falhou e com qual entrada.

## 7. Verificação

- "Pronto" exige evidência: testes verdes E o comportamento observado rodando (subir o app e chamar o endpoint, abrir a tela, rodar o script).
- Não confie só na própria revisão. Ao fim de cada feature, rode a revisão por subagente e liste no resumo o que NÃO foi verificado.

## 8. Autonomia

- Rode até o fim do plano sem pedir confirmação nem esperar ser mandado continuar.
- Diante de ambiguidade: escolha a opção mais simples e reversível, registre a suposição em `NOTES.md` e siga.
- Paradas obrigatórias (só estas): a. ação destrutiva ou irreversível (apagar dados, migration que remove coluna/tabela, force push); b. mudança de contrato público (API usada por terceiros, schema compartilhado); c. segredo, credencial ou custo financeiro envolvido; d. o mesmo erro persiste após 3 tentativas de correção com abordagens diferentes.
- Ao terminar: resumo curto com commits feitos, suposições registradas e pendências.
