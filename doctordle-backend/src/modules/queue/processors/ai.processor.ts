import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import Redis from 'ioredis';
import { getEnv } from '../../../core/config/env.validation';
import { PrismaService } from '../../../core/db/prisma.service';
import { ExplanationService } from '../../ai/explanation.service';
import { HintService } from '../../ai/hint.service';
import {
  EXPLANATION_GENERATE_JOB_NAME,
  HINT_GENERATE_JOB_NAME,
  QUEUE_NAME,
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
          queue: QUEUE_NAME,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    });
  }

  onModuleInit(): void {
    this.worker = new Worker<AiJobPayload>(
      QUEUE_NAME,
      async (job) => {
        if (job.name === HINT_GENERATE_JOB_NAME) {
          await this.processHintJob(job as Job<HintGenerateJobPayload>);
          return;
        }

        if (job.name === EXPLANATION_GENERATE_JOB_NAME) {
          await this.processExplanationJob(job as Job<ExplanationGenerateJobPayload>);
        }
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
          queue: QUEUE_NAME,
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
          queue: QUEUE_NAME,
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
          queue: QUEUE_NAME,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    });

    await this.connection.quit().catch((error) => {
      this.logger.warn(
        JSON.stringify({
          event: 'queue.ai.connection.quit.failed',
          queue: QUEUE_NAME,
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
          queue: QUEUE_NAME,
          jobId: job.id,
          caseId,
        }),
      );
      return;
    }

    await this.hintService.getHint(caseId);

    this.logger.log(
      JSON.stringify({
        event: 'queue.ai.hint.generated',
        queue: QUEUE_NAME,
        jobId: job.id,
        caseId,
      }),
    );
  }

  private async processExplanationJob(
    job: Job<ExplanationGenerateJobPayload>,
  ): Promise<void> {
    const caseId = job.data.caseId;
    const existing = await this.prisma.explanationContent.findUnique({
      where: { caseId },
      select: { id: true },
    });

    if (existing) {
      this.logger.log(
        JSON.stringify({
          event: 'queue.ai.explanation.skipped_already_exists',
          queue: QUEUE_NAME,
          jobId: job.id,
          caseId,
        }),
      );
      return;
    }

    await this.explanationService.getExplanation(caseId);

    this.logger.log(
      JSON.stringify({
        event: 'queue.ai.explanation.generated',
        queue: QUEUE_NAME,
        jobId: job.id,
        caseId,
      }),
    );
  }
}