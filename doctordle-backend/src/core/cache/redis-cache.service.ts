import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { getEnv } from '../config/env.validation';

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor() {
    const redisUrl = getEnv().REDIS_URL;
    this.client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    this.client.on('error', () => undefined);
    void this.client.connect().catch(() => undefined);
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key).catch(() => null);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds).catch(() => undefined);
      return;
    }

    await this.client.set(key, value).catch(() => undefined);
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const count = await this.client.incr(key).catch(() => 0);
    if (count === 1) {
      await this.client.expire(key, ttlSeconds).catch(() => undefined);
    }

    return count;
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key).catch(() => undefined);
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
    } catch {
      return 0;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit().catch(() => undefined);
  }
}
