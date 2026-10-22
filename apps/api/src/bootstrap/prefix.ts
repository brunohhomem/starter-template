import { INestApplication } from '@nestjs/common';

/** Define o prefixo global `/api` para todas as rotas. */
export function setGlobalPrefix(app: INestApplication): void {
  app.setGlobalPrefix('api');
}
