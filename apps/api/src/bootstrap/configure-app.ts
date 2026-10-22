import { INestApplication } from '@nestjs/common';
import type { Env } from '../config/env.schema';
import { setGlobalPrefix } from './prefix';
import { configureSecurity } from './security';
import { enableShutdownHooks } from './lifecycle';
import { configureSwagger } from './docs';

/**
 * Configuração comum da aplicação. Usada tanto por `main.ts` quanto
 * por `createTestApp()` nos testes de integração, para garantir
 * que o app de teste tenha exatamente o mesmo setup do app real.
 */
export function configureApp(app: INestApplication, env: Env): void {
  setGlobalPrefix(app);
  configureSecurity(app, env);
  enableShutdownHooks(app);
  configureSwagger(app, env);
}
