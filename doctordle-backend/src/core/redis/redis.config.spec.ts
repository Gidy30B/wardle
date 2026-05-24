import { resetEnvCacheForTests } from '../config/env.validation';
import {
  getRedisConnectionOptions,
  getRedisUrl,
} from './redis.config';

const baseEnv = {
  DATABASE_URL: 'postgres://localhost:5432/doctordle',
  REDIS_URL: 'redis://localhost:6379',
  CLERK_JWT_ISSUER: 'https://example.clerk.accounts.dev',
  CLERK_JWT_AUDIENCE: 'wardle',
  NODE_ENV: 'test',
  APP_PROCESS_ROLE: 'api',
  LOG_LEVEL: 'test',
  EMBEDDING_MODEL: 'text-embedding-3-small',
  SCORE_WEIGHT_EXACT: '1',
  SCORE_WEIGHT_SYNONYM: '1',
  SCORE_WEIGHT_FUZZY: '1',
  SCORE_WEIGHT_EMBEDDING: '1',
  SCORE_WEIGHT_ONTOLOGY: '1',
  EVALUATOR_VERSION: 'test',
};

describe('redis config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, ...baseEnv };
    resetEnvCacheForTests();
  });

  afterEach(() => {
    process.env = originalEnv;
    resetEnvCacheForTests();
  });

  it('uses redis:// without TLS options', () => {
    process.env.REDIS_URL = 'redis://:secret@localhost:6379';

    expect(getRedisUrl()).toBe('redis://:secret@localhost:6379');
    expect(getRedisConnectionOptions()).not.toHaveProperty('tls');
  });

  it('uses rediss:// with TLS options', () => {
    process.env.REDIS_URL = 'rediss://:secret@example.redis:6380';

    expect(getRedisUrl()).toBe('rediss://:secret@example.redis:6380');
    expect(getRedisConnectionOptions()).toEqual({ tls: {} });
  });

  it('preserves caller overrides without exposing password-derived debug data', () => {
    process.env.REDIS_URL = 'rediss://:secret@example.redis:6380';

    const options = getRedisConnectionOptions({
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });

    expect(options).toEqual({
      tls: {},
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    expect(JSON.stringify(options)).not.toContain('secret');
  });
});
