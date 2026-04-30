import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import Redis from 'ioredis';
import { PrismaService } from '../../core/db/prisma.service';
import { getEnv } from '../../core/config/env.validation';
import { LeaderboardService } from '../gameplay/leaderboard.service';
import { RewardOrchestrator } from '../gameplay/reward-orchestrator.service';
import { StreakService } from '../gameplay/streak.service';
import { XpService } from '../gameplay/xp.service';
import { RedisPubSubService } from '../../core/redis/redis-pubsub.service';
import { GameCompletedJobPayload } from './queue.service';
import {
  GAME_COMPLETED_JOB_NAME,
  GAME_COMPLETION_QUEUE_NAME,
} from './queue.constants';

export function computeTimeToCompleteSeconds(input: {
  startedAt: Date | null | undefined;
  completedAt: Date | null | undefined;
}): number | null {
  if (!input.startedAt || !input.completedAt) {
    return null;
  }

  return Math.max(
    0,
    Math.round(
      (input.completedAt.getTime() - input.startedAt.getTime()) / 1000,
    ),
  );
}

@Injectable()
export class QueueProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueProcessor.name);
  private readonly lockTimeoutMs = 5 * 60 * 1000;
  private readonly durationSampleLimit = 500;
  private readonly connection: Redis;
  private worker?: Worker<GameCompletedJobPayload>;
  private readonly durationSamples: number[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly streakService: StreakService,
    private readonly xpService: XpService,
    private readonly leaderboardService: LeaderboardService,
    private readonly rewardOrchestrator: RewardOrchestrator,
    private readonly redisPubSub: RedisPubSubService,
  ) {
    const redisUrl = getEnv().REDIS_URL;
    this.connection = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
    void this.connection.connect().catch((error) => {
      this.logger.warn(
        JSON.stringify({
          event: 'queue.processor.connection.connect.failed',
          queue: GAME_COMPLETION_QUEUE_NAME,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    });
  }

  onModuleInit(): void {
    console.log('WORKER STARTED');

    this.worker = new Worker<GameCompletedJobPayload>(
      GAME_COMPLETION_QUEUE_NAME,
      async (job) => {
        console.log('PROCESSING JOB', job.name, job.data);

        if (job.name !== GAME_COMPLETED_JOB_NAME) {
          throw new Error(`Unexpected job name received: ${job.name}`);
        }

        const start = Date.now();
        const lagMs = Math.max(0, start - job.timestamp);
        let status: 'success' | 'failed' = 'success';
        let failureMessage: string | null = null;

        this.logger.log(
          JSON.stringify({
            event: 'queue.job.started',
            queue: GAME_COMPLETION_QUEUE_NAME,
            jobId: job.id,
            jobName: job.name,
            sessionId: job.data.sessionId,
            lagMs,
          }),
        );

        try {
          await this.processGameCompleted(job);
        } catch (error) {
          status = 'failed';
          failureMessage =
            error instanceof Error ? error.message : String(error);
          throw error;
        } finally {
          const durationMs = Date.now() - start;
          const p95DurationMs = this.recordDuration(durationMs);

          this.logger.log(
            JSON.stringify({
              event: 'queue.job.finished',
              queue: GAME_COMPLETION_QUEUE_NAME,
              jobId: job.id,
              jobName: job.name,
              sessionId: job.data.sessionId,
              status,
              lagMs,
              durationMs,
              p95DurationMs,
              error: failureMessage,
            }),
          );
        }
      },
      {
        connection: this.connection,
        concurrency: 5,
      },
    );

    this.worker.on('failed', (job, error) => {
      const attempts = job?.opts?.attempts ?? 1;
      const attemptsMade = job?.attemptsMade ?? 0;
      const isFinalFailure = attemptsMade >= attempts;

      this.logger.error(
        JSON.stringify({
          event: 'queue.job.failed',
          queue: GAME_COMPLETION_QUEUE_NAME,
          jobId: job?.id ?? null,
          jobName: job?.name ?? null,
          sessionId: job?.data?.sessionId ?? null,
          attempts,
          attemptsMade,
          finalFailure: isFinalFailure,
          error: error instanceof Error ? error.message : String(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );

      if (isFinalFailure) {
        this.logger.error(
          JSON.stringify({
            event: 'queue.job.max-retries-exhausted',
            queue: GAME_COMPLETION_QUEUE_NAME,
            jobId: job?.id ?? null,
            jobName: job?.name ?? null,
            sessionId: job?.data?.sessionId ?? null,
            attempts,
            attemptsMade,
          }),
        );
      }
    });

    this.worker.on('error', (error) => {
      this.logger.error(
        JSON.stringify({
          event: 'queue.worker.error',
          queue: GAME_COMPLETION_QUEUE_NAME,
          error: error instanceof Error ? error.message : String(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close().catch((error) => {
      this.logger.warn(
        JSON.stringify({
          event: 'queue.processor.worker.close.failed',
          queue: GAME_COMPLETION_QUEUE_NAME,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    });
    await this.connection.quit().catch((error) => {
      this.logger.warn(
        JSON.stringify({
          event: 'queue.processor.connection.quit.failed',
          queue: GAME_COMPLETION_QUEUE_NAME,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    });
  }

  private async processGameCompleted(
    job: Job<GameCompletedJobPayload>,
  ): Promise<void> {
    const payload = job.data;
    const claimAt = new Date();
    const staleBefore = new Date(claimAt.getTime() - this.lockTimeoutMs);
    const claimed = await this.prisma.gameSession.updateMany({
      where: {
        id: payload.sessionId,
        userId: payload.userId,
        status: 'completed',
        processedAt: null,
        OR: [
          {
            processingAt: null,
          },
          {
            processingAt: {
              lt: staleBefore,
            },
          },
        ],
      },
      data: {
        processingAt: claimAt,
      },
    });

    if (claimed.count === 0) {
      const existing = await this.prisma.gameSession.findUnique({
        where: { id: payload.sessionId },
        select: {
          userId: true,
          status: true,
          processingAt: true,
          processedAt: true,
        },
      });

      if (!existing) {
        throw new Error(
          `Game session not found for completed job ${payload.sessionId}`,
        );
      }

      if (existing.userId !== payload.userId) {
        throw new Error(`User mismatch for completed job ${payload.sessionId}`);
      }

      if (existing.status !== 'completed') {
        throw new Error(`Session ${payload.sessionId} is not completed yet`);
      }

      if (existing.processedAt) {
        this.logger.log(
          JSON.stringify({
            event: 'queue.job.skipped_already_processed',
            queue: GAME_COMPLETION_QUEUE_NAME,
            jobId: job.id,
            sessionId: payload.sessionId,
            processedAt: existing.processedAt.toISOString(),
          }),
        );
        return;
      }

      if (existing.processingAt && existing.processingAt >= staleBefore) {
        throw new Error(
          `Session ${payload.sessionId} is already locked for processing`,
        );
      }

      throw new Error(
        `Unable to claim session ${payload.sessionId} for processing`,
      );
    }

    try {
      const session = await this.prisma.gameSession.findUnique({
        where: { id: payload.sessionId },
        select: {
          id: true,
          userId: true,
          dailyCaseId: true,
          startedAt: true,
          completedAt: true,
          processingAt: true,
          processedAt: true,
          status: true,
          xpAwardedAt: true,
          attempts: {
            select: {
              score: true,
              result: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
          _count: {
            select: {
              attempts: true,
            },
          },
        },
      });

      if (!session) {
        throw new Error(
          `Game session not found for completed job ${payload.sessionId}`,
        );
      }

      if (session.userId !== payload.userId) {
        throw new Error(`User mismatch for completed job ${payload.sessionId}`);
      }

      if (session.status !== 'completed') {
        throw new Error(`Session ${payload.sessionId} is not completed yet`);
      }

      const completedAt = session.completedAt;
      if (!completedAt) {
        throw new Error(
          `Completed session ${payload.sessionId} is missing completedAt`,
        );
      }
      const timeToComplete = computeTimeToCompleteSeconds({
        startedAt: session.startedAt,
        completedAt: session.completedAt,
      });

      const latestAttempt = session.attempts[0];
      if (!latestAttempt) {
        throw new Error(
          `Completed session ${payload.sessionId} is missing attempts`,
        );
      }
      const completedCorrectly = latestAttempt.result === 'correct';

      if (completedCorrectly) {
        const streak = await this.streakService.updateOnCompletion({
          userId: payload.userId,
          completedAt,
        });

        const awardResult = await this.xpService.awardXpForSession({
          sessionId: payload.sessionId,
          userId: payload.userId,
          streak,
          attemptsCount: session._count.attempts,
        });

        if (
          !awardResult.applied &&
          awardResult.reason === 'session_not_found'
        ) {
          throw new Error(
            `Unable to award XP for session ${payload.sessionId}`,
          );
        }

        if (awardResult.applied) {
          this.logger.log({
            event: 'ws.publish',
            type: 'game.v1.reward.applied',
            userId: payload.userId,
          });

          await this.redisPubSub.publish('ws:events', {
            type: 'game.v1.reward.applied',
            userId: payload.userId,
            payload: {
              xp: awardResult.xpGained,
              streak,
            },
          });
        }
      }

      await this.leaderboardService.upsertCompletion({
        userId: payload.userId,
        dailyCaseId: session.dailyCaseId,
        score: latestAttempt.score,
        attemptsCount: session._count.attempts,
        completedAt,
        timeToComplete,
      });

      await this.prisma.gameSession.updateMany({
        where: {
          id: payload.sessionId,
          userId: payload.userId,
          processedAt: null,
        },
        data: {
          processedAt: new Date(),
          processingAt: null,
        },
      });

      if (completedCorrectly) {
        await this.rewardOrchestrator.emitRewardApplied({
          sessionId: payload.sessionId,
          userId: payload.userId,
        });
      }
    } catch (error) {
      await this.prisma.gameSession
        .updateMany({
          where: {
            id: payload.sessionId,
            userId: payload.userId,
            processingAt: claimAt,
            processedAt: null,
          },
          data: {
            processingAt: null,
          },
        })
        .catch((rollbackError) => {
          this.logger.error(
            JSON.stringify({
              event: 'queue.job.claim.rollback.failed',
              queue: GAME_COMPLETION_QUEUE_NAME,
              jobId: job.id,
              sessionId: payload.sessionId,
              error:
                rollbackError instanceof Error
                  ? rollbackError.message
                  : String(rollbackError),
            }),
          );
        });

      throw error;
    }
  }

  private recordDuration(durationMs: number): number {
    this.durationSamples.push(durationMs);

    if (this.durationSamples.length > this.durationSampleLimit) {
      this.durationSamples.shift();
    }

    const sorted = [...this.durationSamples].sort(
      (left, right) => left - right,
    );
    const p95Index = Math.min(
      sorted.length - 1,
      Math.max(0, Math.ceil(sorted.length * 0.95) - 1),
    );

    return sorted[p95Index] ?? durationMs;
  }
}
