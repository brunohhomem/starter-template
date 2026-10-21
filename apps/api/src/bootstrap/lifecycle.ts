import { INestApplication } from '@nestjs/common';

/** Habilita os hooks de desligamento gracioso do NestJS. */
export function enableShutdownHooks(app: INestApplication): void {
  app.enableShutdownHooks();
}
