import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { JobsOptions, Queue } from 'bullmq';
import Redis from 'ioredis';
import { getEnv } from '../../core/config/env.validation';
import {
  AI_CONTENT_QUEUE_NAME,
  EXPLANATION_GENERATE_JOB_NAME,
  GAME_COMPLETED_JOB_NAME,
  GAME_COMPLETION_QUEUE_NAME,
  HINT_GENERATE_JOB_NAME,
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
  userId: string;
};

type QueueHealth = {
  waiting: number;
  active: number;
  failed: number;
  completed: number;
  lagMs: number;
};

export type QueueHealthSummary = {
  gameCompletion: QueueHealth;
  aiContent: QueueHealth;
};

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly connection: Redis;
  private readonly gameCompletionQueue: Queue<GameCompletedJobPayload>;
  private readonly aiContentQueue: Queue<
    HintGenerateJobPayload | ExplanationGenerateJobPayload
  >;
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
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    });

    this.gameCompletionQueue = new Queue<GameCompletedJobPayload>(
      GAME_COMPLETION_QUEUE_NAME,
      {
        connection: this.connection,
      },
    );
    this.aiContentQueue = new Queue<
      HintGenerateJobPayload | ExplanationGenerateJobPayload
    >(AI_CONTENT_QUEUE_NAME, {
      connection: this.connection,
    });
  }

  async enqueueGameCompleted(payload: GameCompletedJobPayload): Promise<void> {
    await this.assertEnqueueRateLimit(GAME_COMPLETION_QUEUE_NAME);

    const jobOptions: JobsOptions = {
      jobId: this.buildJobId(GAME_COMPLETED_JOB_NAME, payload.sessionId),
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

    const job = await this.gameCompletionQueue
      .add(GAME_COMPLETED_JOB_NAME, payload, jobOptions)
      .catch(async (error) => {
        const existing = await this.gameCompletionQueue.getJob(jobOptions.jobId!);
        if (existing) {
          this.logger.log(
            JSON.stringify({
              event: 'queue.job_skipped_duplicate',
              queue: GAME_COMPLETION_QUEUE_NAME,
              jobId: existing.id,
              jobName: GAME_COMPLETED_JOB_NAME,
              sessionId: payload.sessionId,
              userId: payload.userId,
            }),
          );
          return existing;
        }

        throw error;
      });

    this.logger.log(
      JSON.stringify({
        event: 'queue.job.enqueued',
        queue: GAME_COMPLETION_QUEUE_NAME,
        jobId: job.id,
        jobName: GAME_COMPLETED_JOB_NAME,
        sessionId: payload.sessionId,
        userId: payload.userId,
      }),
    );
  }

  async enqueueHint(caseId: string): Promise<void> {
    await this.addAiJob({
      caseId,
      jobName: HINT_GENERATE_JOB_NAME,
      payload: { caseId },
      jobId: this.getHintJobId(caseId),
    });
  }

  async enqueueExplanation(payload: ExplanationGenerateJobPayload): Promise<void> {
    await this.addAiJob({
      caseId: payload.caseId,
      jobName: EXPLANATION_GENERATE_JOB_NAME,
      payload,
      jobId: this.getExplanationJobId(payload.caseId, payload.userId),
    });
  }

  async getHealth(): Promise<QueueHealthSummary> {
    return {
      gameCompletion: await this.getQueueHealth(this.gameCompletionQueue),
      aiContent: await this.getQueueHealth(this.aiContentQueue),
    };
  }

  private async getQueueHealth<T extends object>(
    queue: Queue<T>,
  ): Promise<QueueHealth> {
    const counts = await queue.getJobCounts(
      'waiting',
      'active',
      'failed',
      'completed',
    );

    const waitingJobs = await queue.getWaiting(0, 0);
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

  private async assertEnqueueRateLimit(queueName: string): Promise<void> {
    const secondBucket = Math.floor(Date.now() / 1000);
    const key = `queue:enqueue:${queueName}:${secondBucket}`;
    const count = await this.connection.incr(key);

    if (count === 1) {
      await this.connection.expire(key, 2);
    }

    if (count > this.enqueueLimitPerSecond) {
      this.logger.warn(
        JSON.stringify({
          event: 'queue.enqueue.rate_limited',
          queue: queueName,
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

  private async addAiJob(input: {
    caseId: string;
    jobName: typeof HINT_GENERATE_JOB_NAME | typeof EXPLANATION_GENERATE_JOB_NAME;
    payload: HintGenerateJobPayload | ExplanationGenerateJobPayload;
    jobId: string;
  }): Promise<void> {
    await this.assertEnqueueRateLimit(AI_CONTENT_QUEUE_NAME);

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

    const job = await this.aiContentQueue
      .add(input.jobName, input.payload, jobOptions)
      .catch(async (error) => {
        const existing = await this.aiContentQueue.getJob(input.jobId);
        if (existing) {
          this.logger.log(
            JSON.stringify({
              event: 'queue.job_skipped_duplicate',
              queue: AI_CONTENT_QUEUE_NAME,
              caseId: input.caseId,
              jobId: existing.id,
              jobName: input.jobName,
            }),
          );
          return existing;
        }

        throw error;
      });

    this.logger.log(
      JSON.stringify({
        event: 'queue.job_enqueued',
        queue: AI_CONTENT_QUEUE_NAME,
        caseId: input.caseId,
        jobId: job.id,
        jobName: input.jobName,
      }),
    );
  }

  private getHintJobId(caseId: string): string {
    return this.buildJobId('hint', caseId);
  }

  private getExplanationJobId(caseId: string, userId: string): string {
    return this.buildJobId('explanation', `${caseId}_${userId}`);
  }

  private buildJobId(prefix: string, id: string): string {
    const normalizedPrefix = prefix.replace(/:/g, '_');
    const normalizedId = id.replace(/:/g, '_');

    return `${normalizedPrefix}_${normalizedId}`;
  }

  async onModuleDestroy(): Promise<void> {
    await this.gameCompletionQueue.close().catch((error) => {
      this.logger.warn(
        JSON.stringify({
          event: 'queue.close.failed',
          queue: GAME_COMPLETION_QUEUE_NAME,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    });
    await this.aiContentQueue.close().catch((error) => {
      this.logger.warn(
        JSON.stringify({
          event: 'queue.close.failed',
          queue: AI_CONTENT_QUEUE_NAME,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    });
    await this.connection.quit().catch((error) => {
      this.logger.warn(
        JSON.stringify({
          event: 'queue.connection.quit.failed',
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    });
  }
}
