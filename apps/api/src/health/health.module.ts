import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/**
 * Módulo de health check.
 * Verifica banco (SELECT 1) e Redis (PING) com timeout de 3s.
 * Resposta mínima: { status: "ok" | "error", version: "x.y.z" }.
 * HTTP 200 quando saudável, 503 quando não.
 * DATABASE e REDIS são globais — não precisam ser re-importados aqui.
 */
@Module({
  imports: [],
  controllers: [HealthController],
  providers: [],
})
export class HealthModule {}
