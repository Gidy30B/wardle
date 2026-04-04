import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { AppLoggerService } from '../../core/logger/app-logger.service';
import { MetricsService } from '../../core/logger/metrics.service';

type AttemptRecordInput = {
  caseId: string;
  sessionId: string;
  userId: string;
  guess: string;
  normalizedGuess: string;
  score: number;
  result: string;
  signals: Prisma.InputJsonValue;
  evaluatorVersion: string;
  clueIndexAtAttempt?: number;
};

@Injectable()
export class AttemptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLoggerService,
    private readonly metrics: MetricsService,
  ) {}

  async recordAttempt(data: AttemptRecordInput) {
    const start = performance.now();
    this.validateAttempt(data);

    try {
      const attempt = await this.withTimeout(
        this.prisma.attempt.create({
          data,
        }),
        2000,
      );

      const latency = performance.now() - start;
      this.metrics.increment('attempt.created');
      this.metrics.observe('attempt.latency', latency);
      this.metrics.increment(`attempt.${data.result}`);

      this.logger.info(
        {
          caseId: data.caseId,
          sessionId: data.sessionId,
          userId: data.userId,
          score: data.score,
          result: data.result,
          evaluatorVersion: data.evaluatorVersion,
          latency,
        },
        'attempt.recorded',
      );

      return attempt;
    } catch (error) {
      this.metrics.increment('attempt.error');
      this.logger.error(
        {
          caseId: data.caseId,
          sessionId: data.sessionId,
          userId: data.userId,
          evaluatorVersion: data.evaluatorVersion,
          error,
        },
        'attempt.record_failed',
      );
      throw error;
    }
  }

  private validateAttempt(data: AttemptRecordInput): void {
    if (!Number.isFinite(data.score)) {
      throw new Error('Invalid evaluation score for attempt persistence');
    }
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        setTimeout(
          () => reject(new Error(`Attempt persistence timed out at ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  }
}
