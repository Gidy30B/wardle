import { Logger } from '@nestjs/common';
import {
  getEnv,
  resetEnvCacheForTests,
} from '../../core/config/env.validation';
import {
  DailyCaseSchedulerService,
  getTodayForScheduleTimezone,
} from './daily-case-scheduler.service';

jest.mock('cron', () => ({
  CronJob: {
    from: jest.fn((params: { name?: string }) => ({
      name: params.name,
      start: jest.fn(),
      stop: jest.fn(),
    })),
  },
}));

const baseEnv = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/doctordle',
  REDIS_URL: 'redis://localhost:6379',
  CLERK_JWT_ISSUER: 'https://example.clerk.accounts.dev',
  CLERK_JWT_AUDIENCE: 'doctordle',
  NODE_ENV: 'test',
  APP_PROCESS_ROLE: 'api',
  DEV_BYPASS_DAILY_LIMIT: 'false',
  ENABLE_DEV_REPLAY: 'false',
  DIAGNOSIS_REGISTRY_ENABLED: 'true',
  STRICT_ALIAS_MATCH_ENABLED: 'true',
  DIAGNOSIS_AUTOCOMPLETE_ENABLED: 'true',
  SELECTION_FIRST_SUBMISSION_ENABLED: 'true',
  DAILY_SCHEDULER_ENABLED: 'true',
  DAILY_SCHEDULE_WINDOW_DAYS: '7',
  DAILY_SCHEDULE_TIMEZONE: 'Africa/Nairobi',
  DAILY_SCHEDULE_CRON: '5 0 * * *',
  LOG_LEVEL: 'info',
  EMBEDDING_MODEL: 'text-embedding-3-small',
  SCORE_WEIGHT_EXACT: '1',
  SCORE_WEIGHT_SYNONYM: '0.8',
  SCORE_WEIGHT_FUZZY: '0.5',
  SCORE_WEIGHT_EMBEDDING: '0.4',
  SCORE_WEIGHT_ONTOLOGY: '0.3',
  EVALUATOR_VERSION: 'test',
};

function setSchedulerEnv(
  overrides: Partial<Record<string, string | undefined>> = {},
) {
  Object.assign(process.env, baseEnv, overrides);

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    }
  }

  resetEnvCacheForTests();
}

function createSchedulerFixture() {
  const dailyCasesService = {
    ensureScheduleWindow: jest.fn().mockResolvedValue({
      startDate: '2026-05-12',
      days: 7,
      createdCount: 1,
      existingCount: 0,
      missingDates: [],
      createdSlots: [],
      existingSlots: [],
      excludedCases: [],
    }),
  };
  const schedulerRegistry = {
    doesExist: jest.fn().mockReturnValue(false),
    deleteCronJob: jest.fn(),
    addCronJob: jest.fn(),
  };
  const redisCacheService = {
    acquireLock: jest.fn().mockResolvedValue(true),
    releaseLock: jest.fn().mockResolvedValue(true),
  };

  return {
    dailyCasesService,
    schedulerRegistry,
    redisCacheService,
    service: new DailyCaseSchedulerService(
      dailyCasesService as never,
      schedulerRegistry as never,
      redisCacheService as never,
    ),
  };
}

describe('DailyCaseSchedulerService', () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    setSchedulerEnv();
  });

  afterEach(() => {
    jest.useRealTimers();
    resetEnvCacheForTests();
    jest.restoreAllMocks();
  });

  it('loads safe scheduler defaults when env values are missing', () => {
    setSchedulerEnv({
      DAILY_SCHEDULER_ENABLED: undefined,
      APP_PROCESS_ROLE: undefined,
      DAILY_SCHEDULE_WINDOW_DAYS: undefined,
      DAILY_SCHEDULE_TIMEZONE: undefined,
      DAILY_SCHEDULE_CRON: undefined,
    });

    const env = getEnv();

    expect(env.DAILY_SCHEDULER_ENABLED).toBe(true);
    expect(env.APP_PROCESS_ROLE).toBe('api');
    expect(env.DAILY_SCHEDULE_WINDOW_DAYS).toBe(7);
    expect(env.DAILY_SCHEDULE_TIMEZONE).toBe('Africa/Nairobi');
    expect(env.DAILY_SCHEDULE_CRON).toBe('5 0 * * *');
  });

  it('startup catch-up calls ensureScheduleWindow with configured window days', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-11T22:30:00.000Z'));
    setSchedulerEnv({
      DAILY_SCHEDULE_WINDOW_DAYS: '9',
      DAILY_SCHEDULE_TIMEZONE: 'Africa/Nairobi',
    });
    const { service, dailyCasesService } = createSchedulerFixture();

    await service.runStartupCatchup();

    expect(dailyCasesService.ensureScheduleWindow).toHaveBeenCalledWith(
      new Date('2026-05-12T00:00:00.000Z'),
      9,
      'startup_catchup',
    );
  });

  it('startup catch-up skips when disabled', async () => {
    setSchedulerEnv({ DAILY_SCHEDULER_ENABLED: 'false' });
    const { service, dailyCasesService } = createSchedulerFixture();

    await service.runStartupCatchup();

    expect(dailyCasesService.ensureScheduleWindow).not.toHaveBeenCalled();
  });

  it('startup catch-up skips when process role is worker', async () => {
    setSchedulerEnv({
      APP_PROCESS_ROLE: 'worker',
      DAILY_SCHEDULER_ENABLED: 'true',
    });
    const { service, dailyCasesService } = createSchedulerFixture();

    await service.runStartupCatchup();

    expect(dailyCasesService.ensureScheduleWindow).not.toHaveBeenCalled();
    expect(service.getStatus()).toEqual(
      expect.objectContaining({
        configuredEnabled: true,
        enabled: false,
        processRole: 'worker',
        eligibleProcessRole: 'api',
      }),
    );
  });

  it('startup catch-up logs failure without throwing', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { service, dailyCasesService } = createSchedulerFixture();
    dailyCasesService.ensureScheduleWindow.mockRejectedValueOnce(
      new Error('database unavailable'),
    );

    await expect(service.runStartupCatchup()).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('daily_case.schedule.startup_catchup.failed'),
      expect.any(String),
    );
  });

  it('cron calls ensureScheduleWindow with configured window days', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-12T00:05:00.000Z'));
    setSchedulerEnv({
      DAILY_SCHEDULE_WINDOW_DAYS: '11',
      DAILY_SCHEDULE_TIMEZONE: 'Africa/Nairobi',
      DAILY_SCHEDULE_CRON: '5 0 * * *',
    });
    const { service, dailyCasesService } = createSchedulerFixture();

    await service.runDailyCron();

    expect(dailyCasesService.ensureScheduleWindow).toHaveBeenCalledWith(
      new Date('2026-05-12T00:00:00.000Z'),
      11,
      'daily_cron',
    );
  });

  it('skips scheduling when the Redis scheduler lock is already held', async () => {
    const { service, dailyCasesService, redisCacheService } =
      createSchedulerFixture();
    redisCacheService.acquireLock.mockResolvedValueOnce(false);

    const result = await service.runManualEnsureWindow({
      startDate: '2026-05-12',
      days: 7,
    });

    expect(result.status).toBe('skipped_locked');
    expect(redisCacheService.acquireLock).toHaveBeenCalledWith(
      'daily_case:scheduler:ensure_window',
      expect.stringContaining('manual_internal:'),
      900,
    );
    expect(dailyCasesService.ensureScheduleWindow).not.toHaveBeenCalled();
    expect(redisCacheService.releaseLock).not.toHaveBeenCalled();
  });

  it('proceeds with database locking when Redis lock is unavailable', async () => {
    const { service, dailyCasesService, redisCacheService } =
      createSchedulerFixture();
    redisCacheService.acquireLock.mockResolvedValueOnce(null);

    const result = await service.runManualEnsureWindow({
      startDate: '2026-05-12',
      days: 7,
    });

    expect(result.status).toBe('completed');
    expect(dailyCasesService.ensureScheduleWindow).toHaveBeenCalledWith(
      new Date('2026-05-12T00:00:00.000Z'),
      7,
      'manual_internal',
    );
    expect(redisCacheService.releaseLock).not.toHaveBeenCalled();
  });

  it('releases the Redis scheduler lock after a completed run', async () => {
    const { service, redisCacheService } = createSchedulerFixture();

    await service.runManualEnsureWindow({
      startDate: '2026-05-12',
      days: 7,
    });

    expect(redisCacheService.releaseLock).toHaveBeenCalledWith(
      'daily_case:scheduler:ensure_window',
      expect.stringContaining('manual_internal:'),
    );
  });

  it('exposes observable scheduler status', async () => {
    const { service } = createSchedulerFixture();

    await service.runManualEnsureWindow({
      startDate: '2026-05-12',
      days: 7,
    });

    expect(service.getStatus()).toEqual(
      expect.objectContaining({
        enabled: true,
        windowDays: 7,
        timezone: 'Africa/Nairobi',
        cron: '5 0 * * *',
        lockKey: 'daily_case:scheduler:ensure_window',
        lockTtlSeconds: 900,
        running: false,
        lastRun: expect.objectContaining({
          source: 'manual_internal',
          state: 'completed',
          createdCount: 1,
        }),
      }),
    );
  });

  it('cron skips when disabled', async () => {
    setSchedulerEnv({ DAILY_SCHEDULER_ENABLED: 'false' });
    const { service, dailyCasesService } = createSchedulerFixture();

    await service.runDailyCron();

    expect(dailyCasesService.ensureScheduleWindow).not.toHaveBeenCalled();
  });

  it('cron does not register when process role is worker', () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    setSchedulerEnv({
      APP_PROCESS_ROLE: 'worker',
      DAILY_SCHEDULER_ENABLED: 'true',
    });
    const { service, schedulerRegistry } = createSchedulerFixture();

    service.onModuleInit();

    expect(schedulerRegistry.addCronJob).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('daily_case.schedule.runtime_disabled'),
    );
  });

  it('logs runtime disabled once for ineligible process roles', () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    setSchedulerEnv({
      APP_PROCESS_ROLE: 'worker',
      DAILY_SCHEDULER_ENABLED: 'true',
    });
    const { service } = createSchedulerFixture();

    service.onModuleInit();
    service.onApplicationBootstrap();

    const runtimeDisabledLogs = logSpy.mock.calls.filter(([message]) =>
      String(message).includes('daily_case.schedule.runtime_disabled'),
    );
    expect(runtimeDisabledLogs).toHaveLength(1);
  });

  it('registers the configured daily cron job', () => {
    setSchedulerEnv({
      DAILY_SCHEDULE_CRON: '10 1 * * *',
      DAILY_SCHEDULE_TIMEZONE: 'Africa/Nairobi',
    });
    const { service, schedulerRegistry } = createSchedulerFixture();

    service.onModuleInit();

    expect(schedulerRegistry.addCronJob).toHaveBeenCalledWith(
      'daily-case-schedule-window',
      expect.objectContaining({
        name: 'daily-case-schedule-window',
      }),
    );
  });

  it('uses configured timezone to resolve the product day', () => {
    expect(
      getTodayForScheduleTimezone(
        'Africa/Nairobi',
        new Date('2026-05-11T22:30:00.000Z'),
      ),
    ).toEqual(new Date('2026-05-12T00:00:00.000Z'));
  });
});
