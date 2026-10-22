import { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import type { Env } from '../config/env.schema';

/**
 * Aplica cabeçalhos de segurança (helmet), CORS restrito a `APP_ORIGIN`
 * com `credentials: true`, configura `cookieParser` e `trust proxy`
 * com `TRUST_PROXY_HOPS`.
 */
export function configureSecurity(app: INestApplication, env: Env): void {
  app.use(helmet());
  app.use(cookieParser(env.COOKIE_SECRET));

  app.enableCors({
    origin: env.APP_ORIGIN,
    credentials: true,
  });

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', env.TRUST_PROXY_HOPS);
}
