# E-mail

## Drivers

| Ambiente              | Driver            | Como ver                                   |
| --------------------- | ----------------- | ------------------------------------------ |
| `development` / teste | `MemoryTransport` | `startTestWorker` + `memoryTransport.sent` |
| `development` (infra) | SMTP → Mailpit    | <http://localhost:8025>                    |
| `production`          | SMTP (externo)    | Variáveis `MAIL_*` em `.env`               |

O transporte é selecionado em `MailModule` via `APP_CONFIG.NODE_ENV`. Em testes de integração o `MailProcessor` roda com `MemoryTransport`; basta chamar `startTestWorker('')` antes do app e aguardar `waitForEmail()` para inspecionar o que foi enviado.

## Fila (BullMQ)

Os e-mails são enfileirados de forma assíncrona em `MailQueueService.enqueue()` e processados pelo `MailProcessor`. Isso evita que uma falha de SMTP quebre a resposta HTTP — o job é retentado automaticamente pelo BullMQ.

O prefixo da fila é controlado pelo token `QUEUE_PREFIX` (padrão: string vazia → nome efetivo `'bull'`). Em testes, `startTestWorker('')` usa o mesmo prefixo vazio para consumir da mesma fila que o app de teste.

## Templates

Os templates ficam em `apps/api/src/modules/mail/templates/`. Cada template é renderizado por `renderEmail(name, context)` que retorna `{ subject, html, text }`. O HTML é gerado com `mjml`; o campo `text` é extrato simples para clientes que não suportam HTML.

## TTLs dos tokens de e-mail

| Tipo                  | TTL padrão | Variável de ambiente            |
| --------------------- | ---------- | ------------------------------- |
| Confirmação de e-mail | 24 h       | `EMAIL_TOKEN_CONFIRM_TTL_HOURS` |
| Reset de senha        | 1 h        | `EMAIL_TOKEN_RESET_TTL_HOURS`   |
| Convite               | 72 h       | `EMAIL_TOKEN_INVITE_TTL_HOURS`  |

## Risco aceito: token no payload da fila

O token bruto (antes do hash SHA-256) trafega no payload do job BullMQ e no link do e-mail. Isso significa que quem tiver acesso de leitura ao Redis consegue extrair o token antes que ele seja consumido. Decisão registrada em `docs/adr/0002-template-enxuto-v1.md` — aceitável para a fase V1; para ambientes de alta sensibilidade, considere cifrar o payload ou usar um canal fora do Redis.

## Variáveis de ambiente

| Variável    | Obrigatório | Padrão      | Descrição                            |
| ----------- | ----------- | ----------- | ------------------------------------ |
| `MAIL_HOST` | prod        | `localhost` | Host do servidor SMTP                |
| `MAIL_PORT` | prod        | `1025`      | Porta SMTP (1025 = Mailpit dev)      |
| `MAIL_USER` | não         | —           | Usuário SMTP (deixe vazio sem auth)  |
| `MAIL_PASS` | não         | —           | Senha SMTP                           |
| `MAIL_FROM` | não         | `noreply@…` | Endereço remetente padrão            |
| `APP_URL`   | sim         | —           | URL base usada nos links dos e-mails |
| `APP_NAME`  | não         | `Starter`   | Nome exibido nos templates           |
