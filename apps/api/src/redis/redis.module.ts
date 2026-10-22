import { Module, OnApplicationShutdown, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import type { Env } from '../config/env.schema';
import { ENV, AppConfigModule } from '../config/app-config.module';

export const REDIS = Symbol('REDIS');

/**
 * Módulo de Redis com ioredis.
 * Conexão única compartilhada; BullMQ (F3) usará conexões próprias
 * com `maxRetriesPerRequest: null` sobre os mesmos `REDIS_*`.
 */
@Module({})
export class RedisModule implements OnApplicationShutdown {
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
      ],
      exports: [REDIS],
    };
  }

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit();
  }
}
