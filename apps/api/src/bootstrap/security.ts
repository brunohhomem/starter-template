import { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import type { Env } from '../config/env.schema';

/**
 * Aplica cabeçalhos de segurança (helmet), CORS restrito a `APP_ORIGIN`
 * com `credentials: true` e configura `trust proxy` com `TRUST_PROXY_HOPS`.
 */
export function configureSecurity(app: INestApplication, env: Env): void {
  app.use(helmet());

  app.enableCors({
    origin: env.APP_ORIGIN,
    credentials: true,
  });

  if (env.TRUST_PROXY_HOPS > 0) {
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.set('trust proxy', env.TRUST_PROXY_HOPS);
  }
}
