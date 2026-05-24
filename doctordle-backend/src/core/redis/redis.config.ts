import type { RedisOptions } from 'ioredis';
import { getEnv } from '../config/env.validation';

export function getRedisUrl(): string {
  return getEnv().REDIS_URL;
}

export function getRedisConnectionOptions(
  overrides: RedisOptions = {},
): RedisOptions {
  const redisUrl = getRedisUrl();
  const usesTls = redisUrl.startsWith('rediss://');

  return {
    ...(usesTls ? { tls: {} } : {}),
    ...overrides,
  };
}
