import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import Redis from 'ioredis';
import { getEnv } from '../../../core/config/env.validation';
import { PrismaService } from '../../../core/db/prisma.service';
import { RedisPubSubService } from '../../../core/redis/redis-pubsub.service';
import { ExplanationService } from '../../ai/explanation.service';
import { HintService } from '../../ai/hint.service';
import { NotificationProducerService } from '../../notifications/notification-producer.service';
import {
  AI_CONTENT_QUEUE_NAME,
  EXPLANATION_GENERATE_JOB_NAME,
  HINT_GENERATE_JOB_NAME,
} from '../queue.constants';
import {
  ExplanationGenerateJobPayload,
  HintGenerateJobPayload,
} from '../queue.service';

type AiJobPayload = HintGenerateJobPayload | ExplanationGenerateJobPayload;

@Injectable()
export class AiProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiProcessor.name);
  private readonly connection: Redis;
  private worker?: Worker<AiJobPayload>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly hintService: HintService,
    private readonly explanationService: ExplanationService,
    private readonly redisPubSub: RedisPubSubService,
    private readonly notificationProducer: NotificationProducerService,
  ) {
    const redisUrl = getEnv().REDIS_URL;
    this.connection = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
    void this.connection.connect().catch((error) => {
      this.logger.warn(
        JSON.stringify({
          event: 'queue.ai.connection.connect.failed',
          queue: AI_CONTENT_QUEUE_NAME,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    });
  }

  onModuleInit(): void {
    console.log('WORKER STARTED');

    this.worker = new Worker<AiJobPayload>(
      AI_CONTENT_QUEUE_NAME,
      async (job) => {
        console.log('PROCESSING JOB', job.name, job.data);

        if (job.name === HINT_GENERATE_JOB_NAME) {
          await this.processHintJob(job as Job<HintGenerateJobPayload>);
          return;
        }

        if (job.name === EXPLANATION_GENERATE_JOB_NAME) {
          await this.processExplanationJob(job as Job<ExplanationGenerateJobPayload>);
          return;
        }

        throw new Error(`Unexpected job name received: ${job.name}`);
      },
      {
        connection: this.connection,
        concurrency: 5,
      },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        JSON.stringify({
          event: 'queue.ai.job.failed',
          queue: AI_CONTENT_QUEUE_NAME,
          jobId: job?.id ?? null,
          jobName: job?.name ?? null,
          caseId: job?.data?.caseId ?? null,
          attempts: job?.opts?.attempts ?? 1,
          attemptsMade: job?.attemptsMade ?? 0,
          error: error instanceof Error ? error.message : String(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );
    });

    this.worker.on('error', (error) => {
      this.logger.error(
        JSON.stringify({
          event: 'queue.ai.worker.error',
          queue: AI_CONTENT_QUEUE_NAME,
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
          event: 'queue.ai.worker.close.failed',
          queue: AI_CONTENT_QUEUE_NAME,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    });

    await this.connection.quit().catch((error) => {
      this.logger.warn(
        JSON.stringify({
          event: 'queue.ai.connection.quit.failed',
          queue: AI_CONTENT_QUEUE_NAME,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    });
  }

  private async processHintJob(job: Job<HintGenerateJobPayload>): Promise<void> {
    const caseId = job.data.caseId;
    const existing = await this.prisma.hintContent.findUnique({
      where: { caseId },
      select: { id: true },
    });

    if (existing) {
      this.logger.log(
        JSON.stringify({
          event: 'queue.ai.hint.skipped_already_exists',
          queue: AI_CONTENT_QUEUE_NAME,
          jobId: job.id,
          caseId,
        }),
      );
      return;
    }

    await this.hintService.materializeHint(caseId);

    this.logger.log(
      JSON.stringify({
        event: 'queue.ai.hint.generated',
        queue: AI_CONTENT_QUEUE_NAME,
        jobId: job.id,
        caseId,
      }),
    );
  }

  private async processExplanationJob(
    job: Job<ExplanationGenerateJobPayload>,
  ): Promise<void> {
    const { caseId, userId } = job.data;
    const existing = await this.prisma.explanationContent.findUnique({
      where: { caseId },
      select: { id: true },
    });

    if (existing) {
      const content = await this.explanationService.getExplanation(caseId);

      if (!content) {
        throw new Error(
          `Explanation content missing for existing case ${caseId}`,
        );
      }

      this.logger.log({
        event: 'ws.publish',
        type: 'game.v1.explanation.ready',
        userId,
      });

      await this.redisPubSub.publish('ws:events', {
        type: 'game.v1.explanation.ready',
        userId,
        payload: {
          caseId,
          content,
        },
      });

      await this.notificationProducer.explanationReady({
        userId,
        caseId,
      });

      this.logger.log(
        JSON.stringify({
          event: 'queue.ai.explanation.skipped_already_exists',
          queue: AI_CONTENT_QUEUE_NAME,
          jobId: job.id,
          caseId,
        }),
      );
      return;
    }

    const content = await this.explanationService.materializeExplanation(caseId);

    this.logger.log({
      event: 'ws.publish',
      type: 'game.v1.explanation.ready',
      userId,
    });

    await this.redisPubSub.publish('ws:events', {
      type: 'game.v1.explanation.ready',
      userId,
      payload: {
        caseId,
        content,
      },
    });

    await this.notificationProducer.explanationReady({
      userId,
      caseId,
    });

    this.logger.log(
      JSON.stringify({
        event: 'queue.ai.explanation.generated',
        queue: AI_CONTENT_QUEUE_NAME,
        jobId: job.id,
        caseId,
      }),
    );
  }
}
