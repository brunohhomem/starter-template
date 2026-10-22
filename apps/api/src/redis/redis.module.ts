import { Global, Module, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import type { Env } from '../config/env.schema';
import { ENV, AppConfigModule } from '../config/app-config.module';

export const REDIS = Symbol('REDIS');

/**
 * Módulo de Redis com ioredis.
 * Conexão única compartilhada; BullMQ (F3) usará conexões próprias
 * com `maxRetriesPerRequest: null` sobre os mesmos `REDIS_*`.
 * Global para que REDIS esteja disponível em todos os módulos (health, throttler, bullmq).
 */
@Global()
@Module({})
export class RedisModule {
  static forRoot() {
    return {
      module: RedisModule,
      imports: [AppConfigModule],
      providers: [
        {
          provide: REDIS,
          inject: [ENV],
          useFactory: (env: Env) => {
            const client = new Redis({
              host: env.REDIS_HOST,
              port: env.REDIS_PORT,
              password: env.REDIS_PASSWORD,
              maxRetriesPerRequest: 3,
              retryStrategy: (times) => {
                if (times > 3) return null;
                return Math.min(times * 100, 3000);
              },
              lazyConnect: true,
            });
            client.on('error', (err) => {
              // Evita unhandled rejection se a conexão falhar antes do uso
              console.error('[Redis] Connection error:', err.message);
            });
            return client;
          },
        },
        // Provider para OnApplicationShutdown que usa o REDIS
        {
          provide: 'REDIS_SHUTDOWN',
          inject: [REDIS],
          useFactory: (redis: Redis) => ({
            async onApplicationShutdown() {
              await redis.quit();
            },
          }),
        },
      ],
      exports: [REDIS],
    };
  }

  // Não implementa OnApplicationShutdown diretamente para evitar
  // injeção de REDIS no constructor da classe do módulo.
  // O shutdown é feito pelo provider 'REDIS_SHUTDOWN'.
}
