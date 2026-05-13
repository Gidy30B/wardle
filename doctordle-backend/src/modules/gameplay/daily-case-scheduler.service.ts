import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { randomUUID } from 'crypto';
import { RedisCacheService } from '../../core/cache/redis-cache.service';
import { getEnv } from '../../core/config/env.validation';
import {
  DailyCasesService,
  type DailyCaseScheduleWindowResult,
  normalizeDailyDate,
} from './daily-cases.service';

const DAILY_CASE_SCHEDULE_CRON_JOB = 'daily-case-schedule-window';
const DAILY_CASE_SCHEDULE_LOCK_KEY = 'daily_case:scheduler:ensure_window';
const DAILY_CASE_SCHEDULE_LOCK_TTL_SECONDS = 15 * 60;

type DailyCaseSchedulerRunSource =
  | 'startup_catchup'
  | 'daily_cron'
  | 'manual_internal';

type DailyCaseSchedulerRunState =
  | 'running'
  | 'completed'
  | 'skipped_locked'
  | 'failed'
  | 'disabled';

type DailyCaseSchedulerConfig = {
  configuredEnabled: boolean;
  enabled: boolean;
  processRole: string;
  windowDays: number;
  timezone: string;
  cron: string;
};

type DailyCaseSchedulerRunRecord = {
  runId: string;
  source: DailyCaseSchedulerRunSource;
  state: DailyCaseSchedulerRunState;
  startedAt: string;
  completedAt?: string;
  startDate?: string;
  windowDays: number;
  timezone: string;
  cron?: string;
  lockKey: string;
  lockAcquired?: boolean;
  proceededWithoutRedisLock?: boolean;
  createdCount?: number;
  existingCount?: number;
  missingDates?: string[];
  error?: string;
};

export type DailyCaseSchedulerRunOutcome =
  | {
      status: 'completed';
      runId: string;
      source: DailyCaseSchedulerRunSource;
      result: DailyCaseScheduleWindowResult;
    }
  | {
      status: 'skipped_locked' | 'disabled';
      runId: string;
      source: DailyCaseSchedulerRunSource;
      lockKey: string;
      message: string;
    };

export type DailyCaseSchedulerStatus = {
  enabled: boolean;
  configuredEnabled: boolean;
  processRole: string;
  eligibleProcessRole: 'api';
  windowDays: number;
  timezone: string;
  cron: string;
  cronJobName: string;
  lockKey: string;
  lockTtlSeconds: number;
  running: boolean;
  activeRun: DailyCaseSchedulerRunRecord | null;
  lastRun: DailyCaseSchedulerRunRecord | null;
};

export function getTodayForScheduleTimezone(
  timezone: string,
  now: Date = new Date(),
): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const partMap = new Map(parts.map((part) => [part.type, part.value]));
  const year = partMap.get('year');
  const month = partMap.get('month');
  const day = partMap.get('day');

  if (!year || !month || !day) {
    throw new Error(`Unable to resolve schedule date for timezone ${timezone}`);
  }

  return normalizeDailyDate(`${year}-${month}-${day}T00:00:00.000Z`);
}

@Injectable()
export class DailyCaseSchedulerService
  implements OnModuleInit, OnApplicationBootstrap
{
  private readonly logger = new Logger(DailyCaseSchedulerService.name);
  private runtimeDisabledLogged = false;

  constructor(
    private readonly dailyCasesService: DailyCasesService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly redisCacheService: RedisCacheService,
  ) {}

  onModuleInit(): void {
    this.logRuntimeDisabledIfNeeded();
    this.registerDailyCron();
  }

  onApplicationBootstrap(): void {
    this.logRuntimeDisabledIfNeeded();
    void this.runStartupCatchup();
  }

  async runStartupCatchup(): Promise<void> {
    const config = this.getConfig();
    const runId = randomUUID();

    if (!config.enabled) {
      this.recordRun({
        runId,
        source: 'startup_catchup',
        state: 'disabled',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        windowDays: config.windowDays,
        timezone: config.timezone,
        lockKey: DAILY_CASE_SCHEDULE_LOCK_KEY,
      });
      this.logger.log(
        JSON.stringify({
          event: 'daily_case.schedule.startup_catchup.disabled',
          source: 'startup_catchup',
          processRole: config.processRole,
          configuredEnabled: config.configuredEnabled,
          windowDays: config.windowDays,
          timezone: config.timezone,
        }),
      );
      return;
    }

    try {
      await this.runEnsureWindowWithLock({
        runId,
        source: 'startup_catchup',
        startDate: getTodayForScheduleTimezone(config.timezone),
        windowDays: config.windowDays,
        timezone: config.timezone,
      });
    } catch {
      // runEnsureWindowWithLock logs and records failures. Startup catch-up must
      // never permanently block app boot.
    }
  }

  async runDailyCron(): Promise<void> {
    const config = this.getConfig();
    const runId = randomUUID();

    if (!config.enabled) {
      this.recordRun({
        runId,
        source: 'daily_cron',
        state: 'disabled',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        windowDays: config.windowDays,
        timezone: config.timezone,
        cron: config.cron,
        lockKey: DAILY_CASE_SCHEDULE_LOCK_KEY,
      });
      this.logger.log(
        JSON.stringify({
          event: 'daily_case.schedule.cron.disabled',
          source: 'daily_cron',
          processRole: config.processRole,
          configuredEnabled: config.configuredEnabled,
          windowDays: config.windowDays,
          timezone: config.timezone,
          cron: config.cron,
        }),
      );
      return;
    }

    try {
      await this.runEnsureWindowWithLock({
        runId,
        source: 'daily_cron',
        startDate: getTodayForScheduleTimezone(config.timezone),
        windowDays: config.windowDays,
        timezone: config.timezone,
        cron: config.cron,
      });
    } catch {
      // runEnsureWindowWithLock logs and records failures.
    }
  }

  async runManualEnsureWindow(input: {
    startDate?: Date | string;
    days?: number;
  }): Promise<DailyCaseSchedulerRunOutcome> {
    const config = this.getConfig();
    const runId = randomUUID();
    const startDate = input.startDate
      ? normalizeDailyDate(input.startDate)
      : getTodayForScheduleTimezone(config.timezone);

    return this.runEnsureWindowWithLock({
      runId,
      source: 'manual_internal',
      startDate,
      windowDays: input.days ?? config.windowDays,
      timezone: config.timezone,
    });
  }

  getStatus(): DailyCaseSchedulerStatus {
    const config = this.getConfig();
    return {
      enabled: config.enabled,
      configuredEnabled: config.configuredEnabled,
      processRole: config.processRole,
      eligibleProcessRole: 'api',
      windowDays: config.windowDays,
      timezone: config.timezone,
      cron: config.cron,
      cronJobName: DAILY_CASE_SCHEDULE_CRON_JOB,
      lockKey: DAILY_CASE_SCHEDULE_LOCK_KEY,
      lockTtlSeconds: DAILY_CASE_SCHEDULE_LOCK_TTL_SECONDS,
      running: this.activeRun !== null,
      activeRun: this.activeRun,
      lastRun: this.lastRun,
    };
  }

  private registerDailyCron(): void {
    const config = this.getConfig();

    if (!config.enabled) {
      this.logger.log(
        JSON.stringify({
          event: 'daily_case.schedule.cron.disabled',
          source: 'daily_cron',
          processRole: config.processRole,
          configuredEnabled: config.configuredEnabled,
          windowDays: config.windowDays,
          timezone: config.timezone,
          cron: config.cron,
        }),
      );
      return;
    }

    try {
      if (
        this.schedulerRegistry.doesExist('cron', DAILY_CASE_SCHEDULE_CRON_JOB)
      ) {
        this.schedulerRegistry.deleteCronJob(DAILY_CASE_SCHEDULE_CRON_JOB);
      }

      const job = CronJob.from({
        cronTime: config.cron,
        onTick: () => {
          void this.runDailyCron();
        },
        start: false,
        timeZone: config.timezone,
        waitForCompletion: true,
        name: DAILY_CASE_SCHEDULE_CRON_JOB,
      });

      this.schedulerRegistry.addCronJob(DAILY_CASE_SCHEDULE_CRON_JOB, job);
      job.start();
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'daily_case.schedule.cron.failed',
          source: 'daily_cron',
          windowDays: config.windowDays,
          timezone: config.timezone,
          cron: config.cron,
          error: error instanceof Error ? error.message : String(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private logRuntimeDisabledIfNeeded(): void {
    const config = this.getConfig();
    if (
      this.runtimeDisabledLogged ||
      !config.configuredEnabled ||
      config.processRole === 'api'
    ) {
      return;
    }

    this.runtimeDisabledLogged = true;
    this.logger.log(
      JSON.stringify({
        event: 'daily_case.schedule.runtime_disabled',
        processRole: config.processRole,
        configuredEnabled: config.configuredEnabled,
        eligibleProcessRole: 'api',
      }),
    );
  }

  private async runEnsureWindowWithLock(input: {
    runId: string;
    source: DailyCaseSchedulerRunSource;
    startDate: Date;
    windowDays: number;
    timezone: string;
    cron?: string;
  }): Promise<DailyCaseSchedulerRunOutcome> {
    const startedAt = new Date().toISOString();
    const activeRun: DailyCaseSchedulerRunRecord = {
      runId: input.runId,
      source: input.source,
      state: 'running',
      startedAt,
      startDate: input.startDate.toISOString(),
      windowDays: input.windowDays,
      timezone: input.timezone,
      cron: input.cron,
      lockKey: DAILY_CASE_SCHEDULE_LOCK_KEY,
    };
    this.activeRun = activeRun;

    this.logger.log(
      JSON.stringify({
        event: this.getRunEventName(input.source, 'started'),
        source: input.source,
        runId: input.runId,
        startDate: input.startDate.toISOString(),
        windowDays: input.windowDays,
        timezone: input.timezone,
        cron: input.cron,
        lockKey: DAILY_CASE_SCHEDULE_LOCK_KEY,
      }),
    );

    const lockValue = `${input.source}:${input.runId}`;
    const lockAcquired = await this.acquireSchedulerLock(
      input.source,
      lockValue,
    );
    activeRun.lockAcquired = lockAcquired === true;
    activeRun.proceededWithoutRedisLock = lockAcquired === null;

    if (lockAcquired === false) {
      const completedRun = this.completeRun(activeRun, {
        state: 'skipped_locked',
      });
      this.logger.warn(
        JSON.stringify({
          event: 'daily_case.schedule.lock.skipped',
          source: input.source,
          runId: input.runId,
          lockKey: DAILY_CASE_SCHEDULE_LOCK_KEY,
        }),
      );
      return {
        status: 'skipped_locked',
        runId: input.runId,
        source: input.source,
        lockKey: completedRun.lockKey,
        message: 'Daily case scheduler lock is already held',
      };
    }

    try {
      const result = await this.dailyCasesService.ensureScheduleWindow(
        input.startDate,
        input.windowDays,
        input.source,
      );
      this.completeRun(activeRun, {
        state: 'completed',
        createdCount: result.createdCount,
        existingCount: result.existingCount,
        missingDates: result.missingDates,
      });
      this.logger.log(
        JSON.stringify({
          event: this.getRunEventName(input.source, 'completed'),
          source: input.source,
          runId: input.runId,
          startDate: input.startDate.toISOString(),
          windowDays: input.windowDays,
          createdCount: result.createdCount,
          existingCount: result.existingCount,
          missingDates: result.missingDates,
          lockAcquired: lockAcquired === true,
          proceededWithoutRedisLock: lockAcquired === null,
        }),
      );
      return {
        status: 'completed',
        runId: input.runId,
        source: input.source,
        result,
      };
    } catch (error) {
      this.completeRun(activeRun, {
        state: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
      this.logger.error(
        JSON.stringify({
          event: this.getRunEventName(input.source, 'failed'),
          source: input.source,
          runId: input.runId,
          startDate: input.startDate.toISOString(),
          windowDays: input.windowDays,
          timezone: input.timezone,
          cron: input.cron,
          error: error instanceof Error ? error.message : String(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    } finally {
      if (lockAcquired === true) {
        const released = await this.redisCacheService.releaseLock(
          DAILY_CASE_SCHEDULE_LOCK_KEY,
          lockValue,
        );
        if (!released) {
          this.logger.warn(
            JSON.stringify({
              event: 'daily_case.schedule.lock.release_failed',
              source: input.source,
              runId: input.runId,
              lockKey: DAILY_CASE_SCHEDULE_LOCK_KEY,
            }),
          );
        }
      }
      if (this.activeRun?.runId === input.runId) {
        this.activeRun = null;
      }
    }
  }

  private async acquireSchedulerLock(
    source: DailyCaseSchedulerRunSource,
    lockValue: string,
  ): Promise<boolean | null> {
    const acquired = await this.redisCacheService.acquireLock(
      DAILY_CASE_SCHEDULE_LOCK_KEY,
      lockValue,
      DAILY_CASE_SCHEDULE_LOCK_TTL_SECONDS,
    );

    if (acquired === null) {
      this.logger.warn(
        JSON.stringify({
          event: 'daily_case.schedule.lock.unavailable',
          source,
          lockKey: DAILY_CASE_SCHEDULE_LOCK_KEY,
          lockTtlSeconds: DAILY_CASE_SCHEDULE_LOCK_TTL_SECONDS,
          fallback: 'postgres_advisory_lock',
        }),
      );
      return null;
    }

    this.logger.log(
      JSON.stringify({
        event: acquired
          ? 'daily_case.schedule.lock.acquired'
          : 'daily_case.schedule.lock.busy',
        source,
        lockKey: DAILY_CASE_SCHEDULE_LOCK_KEY,
        lockTtlSeconds: DAILY_CASE_SCHEDULE_LOCK_TTL_SECONDS,
      }),
    );
    return acquired;
  }

  private activeRun: DailyCaseSchedulerRunRecord | null = null;
  private lastRun: DailyCaseSchedulerRunRecord | null = null;

  private recordRun(run: DailyCaseSchedulerRunRecord): void {
    this.lastRun = run;
  }

  private completeRun(
    run: DailyCaseSchedulerRunRecord,
    patch: Partial<DailyCaseSchedulerRunRecord> & {
      state: DailyCaseSchedulerRunState;
    },
  ): DailyCaseSchedulerRunRecord {
    const completed: DailyCaseSchedulerRunRecord = {
      ...run,
      ...patch,
      completedAt: new Date().toISOString(),
    };
    this.lastRun = completed;
    return completed;
  }

  private getRunEventName(
    source: DailyCaseSchedulerRunSource,
    phase: 'started' | 'completed' | 'failed',
  ): string {
    if (source === 'startup_catchup') {
      return `daily_case.schedule.startup_catchup.${phase}`;
    }

    if (source === 'daily_cron') {
      return `daily_case.schedule.cron.${phase}`;
    }

    return `daily_case.schedule.manual.${phase}`;
  }

  private getConfig(): DailyCaseSchedulerConfig {
    const env = getEnv();
    const processRole = env.APP_PROCESS_ROLE;
    return {
      configuredEnabled: env.DAILY_SCHEDULER_ENABLED,
      enabled: env.DAILY_SCHEDULER_ENABLED && processRole === 'api',
      processRole,
      windowDays: env.DAILY_SCHEDULE_WINDOW_DAYS,
      timezone: env.DAILY_SCHEDULE_TIMEZONE,
      cron: env.DAILY_SCHEDULE_CRON,
    };
  }
}
