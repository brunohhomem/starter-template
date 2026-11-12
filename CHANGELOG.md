# Changelog

Todas as mudanças notáveis neste projeto serão documentadas aqui.

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

---

## [Unreleased]

### Added

- `scripts/dev.mjs`: orquestrador de dev — API e worker sobem primeiro; web só inicia
  após `GET /api/health` retornar 200, evitando erros de conexão no arranque.
- `CLAUDE.md`: regras de trabalho do projeto (planejamento incremental, testes, commits,
  simplicidade, mudanças cirúrgicas, legibilidade e autonomia).

### Changed

- `package.json`: script `dev` agora chama `node scripts/dev.mjs` em vez de
  `turbo run dev worker:dev` diretamente, garantindo ordem de inicialização.
- `apps/api/src/database/seed/admin.seed.ts`: `ADMIN_INITIAL_PASSWORD` tem prioridade
  sobre o fallback `Admin@12345`; em produção sem a variável ainda gera senha aleatória.
- `.env.example`: comentário em `ADMIN_INITIAL_PASSWORD` documenta o comportamento de
  fallback em cada ambiente.
- `.github/workflows/ci.yml`:
  - `integration` e `e2e` agora dependem de `verify` (`needs: [verify]`); se lint,
    tipos ou testes unitários falharem, os jobs seguintes não iniciam.
  - `fetch-depth` reduzido para `1` em `integration` e `e2e` (histório completo só é
    necessário em `verify` para o commitlint).
  - Job `e2e`: substituído Docker `mcr.microsoft.com/playwright` (~1.5 GB por run) por
    install nativo do Chromium com cache em `~/.cache/ms-playwright` (invalidado apenas
    quando `apps/web/package.json` muda); cache miss instala com `--with-deps`; cache
    hit reinstala apenas as deps do sistema.
  - Turbo cache compartilhado entre `verify` → `e2e` via chave `turbo-${{ github.sha
}}`; build de produção no `e2e` vira hit de cache e não custa rebuild.
