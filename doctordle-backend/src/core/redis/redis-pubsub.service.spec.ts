import Redis from 'ioredis';
import { resetEnvCacheForTests } from '../config/env.validation';
import { RedisPubSubService } from './redis-pubsub.service';

jest.mock('ioredis', () => jest.fn());

type MockRedisClient = {
  on: jest.Mock;
  publish: jest.Mock;
  subscribe: jest.Mock;
  quit: jest.Mock;
};

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

describe('RedisPubSubService', () => {
  const originalEnv = process.env;
  const RedisMock = Redis as unknown as jest.Mock;
  let clients: MockRedisClient[];

  function createMockClient(): MockRedisClient {
    return {
      on: jest.fn(),
      publish: jest.fn().mockResolvedValue(1),
      subscribe: jest.fn().mockResolvedValue(undefined),
      quit: jest.fn().mockResolvedValue(undefined),
    };
  }

  beforeEach(() => {
    process.env = { ...originalEnv, ...baseEnv };
    resetEnvCacheForTests();
    clients = [];
    RedisMock.mockImplementation(() => {
      const client = createMockClient();
      clients.push(client);
      return client;
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    resetEnvCacheForTests();
    jest.clearAllMocks();
  });

  it('does not create a subscriber on construction', () => {
    new RedisPubSubService();

    expect(RedisMock).toHaveBeenCalledTimes(1);
    expect(clients).toHaveLength(1);
    expect(clients[0].on).not.toHaveBeenCalledWith(
      'message',
      expect.any(Function),
    );
  });

  it('publishes without creating a subscriber', async () => {
    const service = new RedisPubSubService();

    await service.publish('ws:events', { type: 'test' });

    expect(RedisMock).toHaveBeenCalledTimes(1);
    expect(clients[0].publish).toHaveBeenCalledWith(
      'ws:events',
      JSON.stringify({ type: 'test' }),
    );
  });

  it('creates the subscriber lazily when subscribe is called', async () => {
    const service = new RedisPubSubService();
    const handler = jest.fn();

    await service.subscribe('ws:events', handler);

    expect(RedisMock).toHaveBeenCalledTimes(2);
    expect(clients[1].on).toHaveBeenCalledWith('message', expect.any(Function));
    expect(clients[1].subscribe).toHaveBeenCalledWith('ws:events');
  });

  it('routes subscribed messages to handlers', async () => {
    const service = new RedisPubSubService();
    const handler = jest.fn();

    await service.subscribe('ws:events', handler);
    const messageHandler = clients[1].on.mock.calls.find(
      ([eventName]) => eventName === 'message',
    )?.[1] as (channel: string, message: string) => void;

    messageHandler('ws:events', JSON.stringify({ type: 'game.v1.test' }));

    expect(handler).toHaveBeenCalledWith({ type: 'game.v1.test' });
  });

  it('destroys safely when no subscriber was created', async () => {
    const service = new RedisPubSubService();

    await service.onModuleDestroy();

    expect(clients[0].quit).toHaveBeenCalledTimes(1);
    expect(RedisMock).toHaveBeenCalledTimes(1);
  });
});
