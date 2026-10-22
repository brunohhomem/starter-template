import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { DatabaseModule } from '../database/database.module';
import { RedisModule, REDIS } from '../redis/redis.module';
import { TypeOrmHealthIndicator, HealthCheckService } from '@nestjs/terminus';
import { REDIS as REDIS_TOKEN } from '../redis/redis.module';

/**
 * Módulo de health check usando @nestjs/terminus.
 * Verifica banco (SELECT 1) e Redis (PING) com timeout de 3s.
 * Resposta mínima: { status: "ok" | "error", version: "x.y.z" }.
 * HTTP 200 quando saudável, 503 quando não.
 */
@Module({
  imports: [TerminusModule, DatabaseModule, RedisModule],
  controllers: [HealthController],
  providers: [
    // HealthCheckService e TypeOrmHealthIndicator vêm do TerminusModule
  ],
})
export class HealthModule {}
