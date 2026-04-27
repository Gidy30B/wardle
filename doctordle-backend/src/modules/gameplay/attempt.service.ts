import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { MetricsService } from '../../core/logger/metrics.service';
import { RewardOrchestrator } from './reward-orchestrator.service';

type AttemptRecordInput = {
  caseId: string;
  sessionId: string;
  userId: string;
  guess: string;
  normalizedGuess: string;
  selectedDiagnosisId?: string | null;
  selectedAliasId?: string | null;
  strictMatchedDiagnosisId?: string | null;
  strictMatchedAliasId?: string | null;
  strictMatchOutcome?: string | null;
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
    private readonly metrics: MetricsService,
    private readonly rewardOrchestrator: RewardOrchestrator,
  ) {}

  async recordAttempt(data: AttemptRecordInput) {
    const start = performance.now();
    this.validateAttempt(data);

    try {
      const attempt = await this.withTimeout(
        this.prisma.attempt.create({
          data: data as never,
        }),
        2000,
      );

      const latency = performance.now() - start;
      this.metrics.increment('attempt.created');
      this.metrics.observe('attempt.latency', latency);
      this.metrics.increment(`attempt.${data.result}`);

      await this.rewardOrchestrator.emitAttemptRecorded({
        caseId: data.caseId,
        sessionId: data.sessionId,
        userId: data.userId,
        score: data.score,
        result: data.result,
        evaluatorVersion: data.evaluatorVersion,
        latency,
      });

      return attempt;
    } catch (error) {
      this.metrics.increment('attempt.error');
      await this.rewardOrchestrator.emitAttemptRecordFailed({
        caseId: data.caseId,
        sessionId: data.sessionId,
        userId: data.userId,
        evaluatorVersion: data.evaluatorVersion,
        error,
      });
      throw error;
    }
  }

  async recordAttemptInTransaction(
    tx: Prisma.TransactionClient,
    data: AttemptRecordInput,
  ) {
    const start = performance.now();
    this.validateAttempt(data);

    try {
      const attempt = await tx.attempt.create({
        data: data as never,
      });

      const latency = performance.now() - start;
      this.metrics.increment('attempt.created');
      this.metrics.observe('attempt.latency', latency);
      this.metrics.increment(`attempt.${data.result}`);

      await this.rewardOrchestrator.emitAttemptRecorded({
        caseId: data.caseId,
        sessionId: data.sessionId,
        userId: data.userId,
        score: data.score,
        result: data.result,
        evaluatorVersion: data.evaluatorVersion,
        latency,
      });

      return attempt;
    } catch (error) {
      this.metrics.increment('attempt.error');
      await this.rewardOrchestrator.emitAttemptRecordFailed({
        caseId: data.caseId,
        sessionId: data.sessionId,
        userId: data.userId,
        evaluatorVersion: data.evaluatorVersion,
        error,
      });
      throw error;
    }
  }

  private validateAttempt(data: AttemptRecordInput): void {
    if (!Number.isFinite(data.score)) {
      throw new Error('Invalid evaluation score for attempt persistence');
    }
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        setTimeout(
          () =>
            reject(
              new Error(`Attempt persistence timed out at ${timeoutMs}ms`),
            ),
          timeoutMs,
        );
      }),
    ]);
  }
}
