import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { Queue, JobsOptions } from 'bullmq';
import Redis from 'ioredis';
import { getEnv } from '../../core/config/env.validation';
import {
  EXPLANATION_GENERATE_JOB_NAME,
  GAME_COMPLETED_JOB_NAME,
  HINT_GENERATE_JOB_NAME,
  QUEUE_NAME,
} from './queue.constants';

export type GameCompletedJobPayload = {
  userId: string;
  sessionId: string;
};

export type HintGenerateJobPayload = {
  caseId: string;
};

export type ExplanationGenerateJobPayload = {
  caseId: string;
};

type QueueJobPayload =
  | GameCompletedJobPayload
  | HintGenerateJobPayload
  | ExplanationGenerateJobPayload;

type QueueHealth = {
  waiting: number;
  active: number;
  failed: number;
  completed: number;
  lagMs: number;
};

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly connection: Redis;
  private readonly queue: Queue<QueueJobPayload>;
  private readonly enqueueLimitPerSecond = 200;

  constructor() {
    const redisUrl = getEnv().REDIS_URL;
    this.connection = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
    void this.connection.connect().catch((error) => {
      this.logger.warn(
        JSON.stringify({
          event: 'queue.connection.connect.failed',
          queue: QUEUE_NAME,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    });

    this.queue = new Queue<QueueJobPayload>(QUEUE_NAME, {
      connection: this.connection,
    });
  }

  async enqueueGameCompleted(payload: GameCompletedJobPayload): Promise<void> {
    await this.assertEnqueueRateLimit();

    const jobOptions: JobsOptions = {
      jobId: `${GAME_COMPLETED_JOB_NAME}:${payload.sessionId}`,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: {
        age: 3600,
        count: 1000,
      },
      removeOnFail: {
        age: 86400,
        count: 5000,
      },
    };

    const job = await this.queue.add(GAME_COMPLETED_JOB_NAME, payload, jobOptions);

    this.logger.log(
      JSON.stringify({
        event: 'queue.job.enqueued',
        queue: QUEUE_NAME,
        jobId: job.id,
        jobName: GAME_COMPLETED_JOB_NAME,
        sessionId: payload.sessionId,
        userId: payload.userId,
      }),
    );
  }

  async enqueueHint(caseId: string): Promise<void> {
    await this.addAiJobIfNotExists({
      caseId,
      jobName: HINT_GENERATE_JOB_NAME,
      payload: { caseId },
      jobId: this.getHintJobId(caseId),
    });
  }

  async enqueueExplanation(caseId: string): Promise<void> {
    await this.addAiJobIfNotExists({
      caseId,
      jobName: EXPLANATION_GENERATE_JOB_NAME,
      payload: { caseId },
      jobId: this.getExplanationJobId(caseId),
    });
  }

  async getHealth(): Promise<QueueHealth> {
    const counts = await this.queue.getJobCounts(
      'waiting',
      'active',
      'failed',
      'completed',
    );

    const waitingJobs = await this.queue.getWaiting(0, 0);
    const oldestWaiting = waitingJobs[0];
    const lagMs = oldestWaiting
      ? Math.max(0, Date.now() - oldestWaiting.timestamp)
      : 0;

    return {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      failed: counts.failed ?? 0,
      completed: counts.completed ?? 0,
      lagMs,
    };
  }

  private async assertEnqueueRateLimit(): Promise<void> {
    const secondBucket = Math.floor(Date.now() / 1000);
    const key = `queue:enqueue:${QUEUE_NAME}:${secondBucket}`;
    const count = await this.connection.incr(key);

    if (count === 1) {
      await this.connection.expire(key, 2);
    }

    if (count > this.enqueueLimitPerSecond) {
      this.logger.warn(
        JSON.stringify({
          event: 'queue.enqueue.rate_limited',
          queue: QUEUE_NAME,
          key,
          count,
          limit: this.enqueueLimitPerSecond,
        }),
      );
      throw new HttpException(
        'Queue enqueue rate limit exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async addAiJobIfNotExists(input: {
    caseId: string;
    jobName: typeof HINT_GENERATE_JOB_NAME | typeof EXPLANATION_GENERATE_JOB_NAME;
    payload: HintGenerateJobPayload | ExplanationGenerateJobPayload;
    jobId: string;
  }): Promise<void> {
    const existing = await this.queue.getJob(input.jobId);
    if (existing) {
      this.logger.log(
        JSON.stringify({
          event: 'queue.job_skipped_duplicate',
          queue: QUEUE_NAME,
          caseId: input.caseId,
          jobId: input.jobId,
          jobName: input.jobName,
        }),
      );
      return;
    }

    await this.assertEnqueueRateLimit();

    const jobOptions: JobsOptions = {
      jobId: input.jobId,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: {
        age: 3600,
        count: 1000,
      },
      removeOnFail: {
        age: 86400,
        count: 5000,
      },
    };

    const job = await this.queue.add(input.jobName, input.payload, jobOptions);

    this.logger.log(
      JSON.stringify({
        event: 'queue.job_enqueued',
        queue: QUEUE_NAME,
        caseId: input.caseId,
        jobId: job.id,
        jobName: input.jobName,
      }),
    );
  }

  private getHintJobId(caseId: string): string {
    return `hint-${this.sanitizeJobIdPart(caseId)}`;
  }

  private getExplanationJobId(caseId: string): string {
    return `explanation-${this.sanitizeJobIdPart(caseId)}`;
  }

  private sanitizeJobIdPart(value: string): string {
    return value.replace(/[:\s]/g, '-');
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close().catch((error) => {
      this.logger.warn(
        JSON.stringify({
          event: 'queue.close.failed',
          queue: QUEUE_NAME,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    });
    await this.connection.quit().catch((error) => {
      this.logger.warn(
        JSON.stringify({
          event: 'queue.connection.quit.failed',
          queue: QUEUE_NAME,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    });
  }
}