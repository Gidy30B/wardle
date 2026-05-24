import {
  AI_CONTENT_QUEUE_NAME,
  GAME_COMPLETION_QUEUE_NAME,
  NOTIFICATION_QUEUE_NAME,
} from './queue.constants';
import { QueueService } from './queue.service';
import { resetEnvCacheForTests } from '../../core/config/env.validation';

const baseEnv = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/doctordle',
  REDIS_URL: 'redis://localhost:6379',
  CLERK_JWT_ISSUER: 'https://example.clerk.accounts.dev',
  CLERK_JWT_AUDIENCE: 'doctordle',
  NODE_ENV: 'test',
  APP_PROCESS_ROLE: 'api',
  LOG_LEVEL: 'info',
  EMBEDDING_MODEL: 'text-embedding-3-small',
  SCORE_WEIGHT_EXACT: '1',
  SCORE_WEIGHT_SYNONYM: '0.8',
  SCORE_WEIGHT_FUZZY: '0.5',
  SCORE_WEIGHT_EMBEDDING: '0.4',
  SCORE_WEIGHT_ONTOLOGY: '0.3',
  EVALUATOR_VERSION: 'test',
};

function createQueue(overrides: Partial<{
  getJobCounts: jest.Mock;
  getWaiting: jest.Mock;
  getFailed: jest.Mock;
  isPaused: jest.Mock;
}> = {}) {
  return {
    getJobCounts: jest.fn().mockResolvedValue({
      waiting: 1,
      active: 2,
      delayed: 3,
      failed: 4,
      completed: 5,
    }),
    getWaiting: jest.fn().mockResolvedValue([
      {
        timestamp: Date.now() - 12_000,
      },
    ]),
    getFailed: jest.fn().mockResolvedValue([
      {
        failedReason: 'example failure',
      },
    ]),
    isPaused: jest.fn().mockResolvedValue(false),
    ...overrides,
  };
}

function getPrivateMethod<T extends (...args: never[]) => unknown>(
  name: string,
): T {
  return QueueService.prototype[name] as T;
}

describe('Queue naming safety', () => {
  it('keeps BullMQ queue names colon-free', () => {
    expect(GAME_COMPLETION_QUEUE_NAME).not.toContain(':');
    expect(AI_CONTENT_QUEUE_NAME).not.toContain(':');
    expect(NOTIFICATION_QUEUE_NAME).not.toContain(':');
  });

  it('sanitizes generated custom job ids so they are colon-free', () => {
    const buildJobId = QueueService.prototype[
      'buildJobId'
    ] as unknown as (prefix: string, id: string) => string;

    expect(
      buildJobId('notification:create', 'reward:xp:session-1:user-1'),
    ).toBe('notification_create_reward_xp_session-1_user-1');
    expect(buildJobId('game:completed', 'session:1')).toBe(
      'game_completed_session_1',
    );
  });
});

describe('Queue health observability', () => {
  beforeEach(() => {
    Object.assign(process.env, baseEnv);
    resetEnvCacheForTests();
  });

  afterEach(() => {
    resetEnvCacheForTests();
    jest.restoreAllMocks();
  });

  it('returns read-only queue counts and oldest waiting job age', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(100_000);
    const getQueueHealth = getPrivateMethod(
      'getQueueHealth',
    ) as unknown as (queue: ReturnType<typeof createQueue>, name: string) => Promise<unknown>;
    const queue = createQueue({
      getWaiting: jest.fn().mockResolvedValue([{ timestamp: 88_000 }]),
    });

    await expect(
      getQueueHealth.call(
        {
          logger: { warn: jest.fn() },
          sanitizeError: getPrivateMethod('sanitizeError'),
        },
        queue,
        GAME_COMPLETION_QUEUE_NAME,
      ),
    ).resolves.toEqual({
      name: GAME_COMPLETION_QUEUE_NAME,
      waiting: 1,
      active: 2,
      delayed: 3,
      failed: 4,
      completed: 5,
      paused: false,
      oldestWaitingJobAgeSeconds: 12,
      latestFailedReason: 'example failure',
    });
  });

  it('handles empty queues without oldest waiting age or failed reason', async () => {
    const getQueueHealth = getPrivateMethod(
      'getQueueHealth',
    ) as unknown as (queue: ReturnType<typeof createQueue>, name: string) => Promise<unknown>;
    const queue = createQueue({
      getWaiting: jest.fn().mockResolvedValue([]),
      getFailed: jest.fn().mockResolvedValue([]),
      isPaused: jest.fn().mockResolvedValue(true),
    });

    await expect(
      getQueueHealth.call(
        {
          logger: { warn: jest.fn() },
          sanitizeError: getPrivateMethod('sanitizeError'),
        },
        queue,
        AI_CONTENT_QUEUE_NAME,
      ),
    ).resolves.toEqual({
      name: AI_CONTENT_QUEUE_NAME,
      waiting: 1,
      active: 2,
      delayed: 3,
      failed: 4,
      completed: 5,
      paused: true,
      oldestWaitingJobAgeSeconds: null,
    });
  });

  it('reports a single queue read failure without throwing', async () => {
    const warn = jest.fn();
    const getQueueHealth = getPrivateMethod(
      'getQueueHealth',
    ) as unknown as (queue: ReturnType<typeof createQueue>, name: string) => Promise<unknown>;
    const queue = createQueue({
      getJobCounts: jest.fn().mockRejectedValue(new Error('Redis unavailable')),
    });

    await expect(
      getQueueHealth.call(
        {
          logger: { warn },
          sanitizeError: getPrivateMethod('sanitizeError'),
        },
        queue,
        NOTIFICATION_QUEUE_NAME,
      ),
    ).resolves.toEqual({
      name: NOTIFICATION_QUEUE_NAME,
      waiting: 0,
      active: 0,
      delayed: 0,
      failed: 0,
      completed: 0,
      paused: false,
      oldestWaitingJobAgeSeconds: null,
      error: 'Redis unavailable',
    });
    expect(warn).toHaveBeenCalled();
  });

  it('returns Redis ping latency on success', async () => {
    jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_007);
    const getRedisHealth = getPrivateMethod(
      'getRedisHealth',
    ) as unknown as () => Promise<unknown>;

    await expect(
      getRedisHealth.call({
        connection: { ping: jest.fn().mockResolvedValue('PONG') },
        logger: { warn: jest.fn() },
        sanitizeError: getPrivateMethod('sanitizeError'),
      }),
    ).resolves.toEqual({
      connected: true,
      pingMs: 7,
    });
  });

  it('returns sanitized Redis ping failure details', async () => {
    const getRedisHealth = getPrivateMethod(
      'getRedisHealth',
    ) as unknown as () => Promise<unknown>;

    await expect(
      getRedisHealth.call({
        connection: {
          ping: jest
            .fn()
            .mockRejectedValue(
              new Error('connect redis://user:secret@example.test:6379 failed'),
            ),
        },
        logger: { warn: jest.fn() },
        sanitizeError: getPrivateMethod('sanitizeError'),
      }),
    ).resolves.toEqual({
      connected: false,
      pingMs: null,
      error: 'connect redis://***@example.test:6379 failed',
    });
  });

  it('returns all known queue snapshots and degrades on queue errors', async () => {
    const getHealth = QueueService.prototype.getHealth;
    const getRedisHealth = getPrivateMethod(
      'getRedisHealth',
    ) as unknown as () => Promise<unknown>;
    const getQueueHealth = getPrivateMethod(
      'getQueueHealth',
    ) as unknown as (queue: ReturnType<typeof createQueue>, name: string) => Promise<unknown>;

    await expect(
      getHealth.call({
        connection: { ping: jest.fn().mockResolvedValue('PONG') },
        gameCompletionQueue: createQueue(),
        aiContentQueue: createQueue({
          getJobCounts: jest.fn().mockRejectedValue(new Error('read failed')),
        }),
        notificationQueue: createQueue(),
        logger: { warn: jest.fn() },
        sanitizeError: getPrivateMethod('sanitizeError'),
        getRedisHealth,
        getQueueHealth,
      }),
    ).resolves.toMatchObject({
      status: 'degraded',
      role: 'api',
      redis: {
        connected: true,
      },
      gameCompletion: {
        name: GAME_COMPLETION_QUEUE_NAME,
      },
      aiContent: {
        name: AI_CONTENT_QUEUE_NAME,
        error: 'read failed',
      },
      notifications: {
        name: NOTIFICATION_QUEUE_NAME,
      },
    });
  });
});
