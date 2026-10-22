import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import type { Env } from '../config/env.schema';

/**
 * Configura Swagger em `/api/docs` apenas quando `SWAGGER_ENABLED=true`.
 * O documento passa por `cleanupOpenApiDoc` do `nestjs-zod` antes do setup.
 */
export function configureSwagger(app: INestApplication, env: Env): void {
  if (!env.SWAGGER_ENABLED) {
    return;
  }

  const config = new DocumentBuilder()
    .setTitle('Starter API')
    .setDescription('API base do template monorepo')
    .setVersion('1.0')
    .addCookieAuth('access_token')
    .addCookieAuth('refresh_token')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const cleaned = cleanupOpenApiDoc(document);

  SwaggerModule.setup('api/docs', app, cleaned);
}
