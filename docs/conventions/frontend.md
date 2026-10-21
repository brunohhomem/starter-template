# Frontend

## Servidor e cliente

1. `page.tsx` e `layout.tsx` não levam `'use client'`.
2. O que precisa de `'use client'` fica num `*.client.tsx` pequeno, importado pelo server component.
3. Hook só é chamado em `*.client.tsx`, em `hooks/` ou em `components/ui`. O shadcn, em `components/ui`, pode trazer `'use client'` sem o sufixo `.client`.

## Pastas

Feature em `features/<feature>/{components,hooks,api,schemas}`. Componente shadcn em `components/ui`. Layout em `components/layout`.

## Mobile-first

1. O estilo base é o de mobile. Só se evolui com `min-width` (`sm`, `md`, `lg`). Variante `max-*` não entra.
2. Sidebar vira drawer (Sheet) no mobile.
3. Tabela vira lista de cards abaixo de `md`.
4. Campo de formulário com fonte de no mínimo 16px e alvo de toque de no mínimo 44px.
5. Use `dvh` no lugar de `vh` e respeite as safe areas.
6. Quando o E2E existir, a suíte completa roda no viewport mobile (390×844) e o desktop (1280×800) fica só com smoke. Um fixture falha se a página tiver scroll horizontal ou alvo de toque abaixo do mínimo. Comparação de screenshot não faz parte da suíte.

Idioma da interface: pt-BR fixo. Formulário usa os schemas zod do `shared`.
