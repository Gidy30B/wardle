import { Injectable, Logger } from '@nestjs/common';
import {
  CaseSource,
  Prisma,
  ValidationOutcome,
  type PrismaClient,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service.js';
import { EditorialMetricsService } from '../editorial/editorial-metrics.service.js';
import type { ShadowValidationResult } from './case-validation.types.js';
import { CaseRevisionService } from './case-revision.service.js';
import { CaseValidationService } from './case-validation.service.js';

type OrchestratorTransactionClient = Prisma.TransactionClient | PrismaClient;

@Injectable()
export class CaseValidationOrchestrator {
  private readonly logger = new Logger(CaseValidationOrchestrator.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly caseRevisionService: CaseRevisionService,
    private readonly caseValidationService: CaseValidationService,
    private readonly editorialMetrics: EditorialMetricsService,
  ) {}

  async runShadowForGeneratedCase(input: {
    caseId: string;
  }): Promise<ShadowValidationResult> {
    this.logger.log(
      JSON.stringify({
        event: 'case.validation.shadow.started',
        caseId: input.caseId,
        source: CaseSource.GENERATED,
      }),
    );

    const startedAt = new Date();

    try {
      const result = await this.withSerializableRetry(() =>
        this.prisma.$transaction(
          async (tx) =>
            this.runShadowForGeneratedCaseInTransaction(tx, {
              caseId: input.caseId,
              startedAt,
            }),
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        ),
      );

      if (result.status === 'skipped') {
        this.logger.log(
          JSON.stringify({
            event: 'case.validation.shadow.skipped_duplicate',
            caseId: result.caseId,
            existingRevisionId: result.existingRevisionId,
            existingValidationRunId: result.existingValidationRunId,
          }),
        );
        return result;
      }

      this.logger.log(
        JSON.stringify({
          event: 'case.validation.shadow.completed',
          caseId: result.caseId,
          revisionId: result.revisionId,
          revisionNumber: result.revisionNumber,
          validationRunId: result.validationRunId,
          outcome: result.outcome,
          issueCounts: result.issueCounts,
        }),
      );

      this.editorialMetrics.recordValidationResult(
        CaseSource.GENERATED,
        result.outcome,
      );

      return result;
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'case.validation.shadow.failed',
          caseId: input.caseId,
          error: error instanceof Error ? error.message : String(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async runShadowForGeneratedCaseInTransaction(
    tx: OrchestratorTransactionClient,
    input: { caseId: string; startedAt: Date },
  ): Promise<ShadowValidationResult> {
    await this.acquireGeneratedCaseLock(tx, input.caseId);

    const existingGeneratedRun = await tx.caseValidationRun.findFirst({
      where: {
        caseId: input.caseId,
        source: CaseSource.GENERATED,
      },
      orderBy: {
        startedAt: 'desc',
      },
      select: {
        id: true,
        revisionId: true,
      },
    });

    if (existingGeneratedRun?.revisionId) {
      return {
        status: 'skipped',
        caseId: input.caseId,
        reason: 'generated_event_already_processed',
        existingRevisionId: existingGeneratedRun.revisionId,
        existingValidationRunId: existingGeneratedRun.id,
      };
    }

    const revisionResult =
      await this.caseRevisionService.createRevisionForGeneratedCaseInTransaction(
        tx,
        { caseId: input.caseId },
      );

    let validationReport;
    try {
      validationReport = this.caseValidationService.validateSnapshot(
        revisionResult.snapshot,
      );
    } catch (error) {
      validationReport =
        this.caseValidationService.buildExecutionErrorReport(error);
    }

    const persistencePayload =
      this.caseValidationService.buildPersistencePayload(validationReport);

    const validationRun = await tx.caseValidationRun.create({
      data: {
        caseId: input.caseId,
        revisionId: revisionResult.revisionId,
        source: CaseSource.GENERATED,
        outcome: validationReport.outcome,
        validatorVersion: validationReport.validatorVersion,
        summary: persistencePayload.summary,
        findings: persistencePayload.findings,
        startedAt: input.startedAt,
        completedAt: new Date(),
      },
      select: {
        id: true,
      },
    });

    const validationDurationMs = Date.now() - input.startedAt.getTime();
    this.logger.log(
      JSON.stringify({
        event: 'case.validation.shadow.persisted',
        caseId: input.caseId,
        revisionId: revisionResult.revisionId,
        validationRunId: validationRun.id,
        source: CaseSource.GENERATED,
        outcome: validationReport.outcome,
        validationDurationMs,
        issueCounts: validationReport.issueCounts,
        validationStatus:
          validationReport.outcome === ValidationOutcome.PASSED
            ? 'pass'
            : validationReport.outcome === ValidationOutcome.FAILED
              ? 'fail'
              : 'error',
      }),
    );

    return {
      status: 'created',
      caseId: input.caseId,
      revisionId: revisionResult.revisionId,
      revisionNumber: revisionResult.revisionNumber,
      validationRunId: validationRun.id,
      outcome: validationReport.outcome,
      issueCounts: validationReport.issueCounts,
    };
  }

  private async acquireGeneratedCaseLock(
    tx: OrchestratorTransactionClient,
    caseId: string,
  ): Promise<void> {
    const lockKey = `case_validation:generated:${caseId}`;

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
  }

  private async withSerializableRetry<T>(
    operation: () => Promise<T>,
    maxAttempts = 3,
  ): Promise<T> {
    let attempt = 0;

    while (true) {
      try {
        return await operation();
      } catch (error) {
        attempt += 1;
        const maybePrismaError = error as { code?: string };
        if (maybePrismaError.code !== 'P2034' || attempt >= maxAttempts) {
          throw error;
        }
      }
    }
  }
}
