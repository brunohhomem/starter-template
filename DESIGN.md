# DESIGN.md

A semântica fica aqui. Os valores (cor, espaço, raio, sombra) ficam só no `globals.css`, que nasce na F5. Até lá, não invente um valor no lugar desse arquivo.

## Princípios

1. Mobile-first: o estilo base é o de mobile e só evolui com `min-width`.
2. Genérico e fácil de trocar: o template não carrega a marca de um produto.

## Tokens

Use o token semântico (`bg-primary`, `text-muted`, `border-border`). Não escreva hex, rgb nem oklch no componente. A fonte da verdade dos valores é o `globals.css`.

## Tema

Claro, escuro e sistema. O modo ativo fica na classe `dark` do documento. Trocar a paleta de um fork é editar o `globals.css`, não os componentes.

## Componentes

1. Componente de UI só vem do shadcn, em `components/ui`.
2. Ícone só vem do lucide.
3. No mobile, a sidebar vira drawer (Sheet).
4. Abaixo de `md`, tabela vira lista de cards.

## Estados

Toda tela que busca ou envia dado tem loading, vazio e erro. Feedback curto vai em toast.

## Acessibilidade

1. Alvo de toque de no mínimo 44px.
2. Campo de formulário com fonte de no mínimo 16px.
3. Contraste e foco visível nos controles interativos.

## Proibições

1. Hex, rgb ou oklch solto no componente.
2. Variante `max-*`.
3. `vh` no lugar de `dvh`.
4. Componente visual fora do shadcn.
