import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { getEnv } from '../config/env.validation';

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly client: Redis;

  constructor() {
    const redisUrl = getEnv().REDIS_URL;
    this.client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    this.client.on('error', (error) => {
      this.logger.warn(
        JSON.stringify({
          event: 'redis.client.error',
          error: error.message,
        }),
      );
    });
    void this.client.connect().catch((error) => {
      this.logger.warn(
        JSON.stringify({
          event: 'redis.connect.failed',
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    });
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key).catch((error) => {
      this.logger.warn(
        JSON.stringify({
          event: 'redis.get.failed',
          key,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      return null;
    });
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds).catch((error) => {
        this.logger.warn(
          JSON.stringify({
            event: 'redis.set.failed',
            key,
            ttlSeconds,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      });
      return;
    }

    await this.client.set(key, value).catch((error) => {
      this.logger.warn(
        JSON.stringify({
          event: 'redis.set.failed',
          key,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    });
  }

  async acquireLock(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean | null> {
    try {
      const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'redis.lock.acquire.failed',
          key,
          ttlSeconds,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      return null;
    }
  }

  async releaseLock(key: string, value: string): Promise<boolean> {
    try {
      const released = await this.client.eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        1,
        key,
        value,
      );
      return released === 1;
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'redis.lock.release.failed',
          key,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      return false;
    }
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const count = await this.client.incr(key).catch((error) => {
      this.logger.warn(
        JSON.stringify({
          event: 'redis.incr.failed',
          key,
          ttlSeconds,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      return 0;
    });
    if (count === 1) {
      await this.client.expire(key, ttlSeconds).catch((error) => {
        this.logger.warn(
          JSON.stringify({
            event: 'redis.expire.failed',
            key,
            ttlSeconds,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      });
    }

    return count;
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key).catch((error) => {
      this.logger.warn(
        JSON.stringify({
          event: 'redis.del.failed',
          key,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    });
  }

  async deleteByPrefix(prefix: string): Promise<number> {
    try {
      let cursor = '0';
      let deleted = 0;

      do {
        const [nextCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          `${prefix}*`,
          'COUNT',
          '100',
        );
        cursor = nextCursor;

        if (keys.length > 0) {
          deleted += await this.client.del(...keys);
        }
      } while (cursor !== '0');

      return deleted;
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'redis.scan.delete-prefix.failed',
          prefix,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      return 0;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit().catch((error) => {
      this.logger.warn(
        JSON.stringify({
          event: 'redis.quit.failed',
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    });
  }
}
