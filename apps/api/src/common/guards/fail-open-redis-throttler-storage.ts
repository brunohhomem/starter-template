import { Injectable, Inject, Logger } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { REDIS } from '../../redis/redis.module';
import Redis from 'ioredis';

@Injectable()
export class FailOpenRedisThrottlerStorage implements ThrottlerStorage {
  protected readonly logger = new Logger(FailOpenRedisThrottlerStorage.name);

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const prefixedKey = `throttle:${key}`;
    const ttlMs = ttl;

    try {
      // Use a Lua script for atomic INCR + PEXPIRE
      const script = `
        local current = redis.call('INCR', KEYS[1])
        if current == 1 then
          redis.call('PEXPIRE', KEYS[1], ARGV[1])
        end
        local ttl = redis.call('PTTL', KEYS[1])
        return {current, ttl}
      `;

      const result = await this.redis.eval(script, 1, prefixedKey, ttlMs);
      const [totalHits, timeToExpire] = result as [number, number];

      const isBlocked = totalHits > limit;
      let timeToBlockExpire = 0;

      if (isBlocked && blockDuration > 0) {
        timeToBlockExpire = blockDuration;
      }

      return {
        totalHits,
        timeToExpire,
        isBlocked,
        timeToBlockExpire,
      };
    } catch (error) {
      // Fail-open: log warning and allow request
      this.logger.warn({
        message: 'Throttler Redis unavailable, failing open',
        key: prefixedKey,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return non-blocked record to allow request
      return {
        totalHits: 0,
        timeToExpire: ttlMs,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }
}
