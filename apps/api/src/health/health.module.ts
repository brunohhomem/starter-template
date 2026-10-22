import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';

/**
 * Módulo de health check.
 * Verifica banco (SELECT 1) e Redis (PING) com timeout de 3s.
 * Resposta mínima: { status: "ok" | "error", version: "x.y.z" }.
 * HTTP 200 quando saudável, 503 quando não.
 */
@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [HealthController],
  providers: [],
})
export class HealthModule {}
