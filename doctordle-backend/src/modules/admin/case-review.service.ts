import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import {
  CaseEditorialStatus,
  CaseSource,
  Prisma,
  ReviewDecision,
  ValidationOutcome,
  type PrismaClient,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service.js';
import { CaseRevisionService } from '../case-validation/case-revision.service.js';
import { CaseValidationService } from '../case-validation/case-validation.service.js';
import { EditorialMetricsService } from '../editorial/editorial-metrics.service.js';
import { getApprovalResetFields } from '../editorial/policies/approval-policy.js';
import {
  canMoveToReadyToPublish,
  canStartEditorialReview,
  getEditorialStatusForReviewDecision,
  getEditorialStatusForValidationOutcome,
} from '../editorial/policies/editorial-transition.policy.js';
import {
  getEditorialStatusesForQueue,
  type EditorialQueueFilter,
} from '../editorial/policies/publish-policy.js';
import type { ListEditorialCasesDto } from './dto/list-editorial-cases.dto.js';
import type { SubmitCaseReviewDto } from './dto/submit-case-review.dto.js';

type ReviewTransactionClient = Prisma.TransactionClient | PrismaClient;

@Injectable()
export class CaseReviewService {
  private readonly logger = new Logger(CaseReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly caseRevisionService: CaseRevisionService,
    private readonly caseValidationService: CaseValidationService,
    private readonly editorialMetrics: EditorialMetricsService,
  ) {}

  async listEditorialCases(query: ListEditorialCasesDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const queueStatuses = query.status
      ? undefined
      : getEditorialStatusesForQueue(query.queue);
    const where: Prisma.CaseWhereInput = query.status
      ? {
          editorialStatus: query.status,
        }
      : queueStatuses
        ? {
            editorialStatus: {
              in: [...queueStatuses],
            },
          }
        : {};

    const [total, items] = await this.prisma.$transaction([
      this.prisma.case.count({ where }),
      this.prisma.case.findMany({
        where,
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          date: true,
          difficulty: true,
          editorialStatus: true,
          approvedAt: true,
          approvedByUserId: true,
          currentRevisionId: true,
          diagnosis: {
            select: {
              id: true,
              name: true,
              system: true,
            },
          },
          currentRevision: {
            select: {
              id: true,
              revisionNumber: true,
              source: true,
              createdAt: true,
            },
          },
          validationRuns: {
            orderBy: [{ startedAt: 'desc' }],
            take: 1,
            select: {
              id: true,
              revisionId: true,
              source: true,
              outcome: true,
              validatorVersion: true,
              startedAt: true,
              completedAt: true,
              summary: true,
            },
          },
          reviews: {
            orderBy: [{ createdAt: 'desc' }],
            take: 1,
            select: {
              id: true,
              revisionId: true,
              reviewerUserId: true,
              decision: true,
              notes: true,
              createdAt: true,
              decidedAt: true,
            },
          },
        },
      }),
    ]);

    return {
      items,
      page,
      pageSize,
      total,
      hasMore: page * pageSize < total,
      filters: {
        status: query.status ?? null,
        queue: (query.status ? 'all' : query.queue ?? 'all') as EditorialQueueFilter,
      },
    };
  }

  async getCaseDetail(caseId: string) {
    const caseRecord = await this.prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        title: true,
        date: true,
        difficulty: true,
        history: true,
        symptoms: true,
        labs: true,
        clues: true,
        explanation: true,
        differentials: true,
        diagnosisId: true,
        editorialStatus: true,
        approvedAt: true,
        approvedByUserId: true,
        currentRevisionId: true,
        diagnosis: {
          select: {
            id: true,
            name: true,
            system: true,
          },
        },
        currentRevision: {
          select: {
            id: true,
            revisionNumber: true,
            source: true,
            createdByUserId: true,
            createdAt: true,
            title: true,
            date: true,
            difficulty: true,
            history: true,
            symptoms: true,
            labs: true,
            clues: true,
            explanation: true,
            differentials: true,
            diagnosisId: true,
          },
        },
        validationRuns: {
          orderBy: [{ startedAt: 'desc' }],
          take: 1,
          select: {
            id: true,
            revisionId: true,
            source: true,
            publishTrack: true,
            outcome: true,
            validatorVersion: true,
            summary: true,
            findings: true,
            triggeredByUserId: true,
            startedAt: true,
            completedAt: true,
          },
        },
        reviews: {
          orderBy: [{ createdAt: 'desc' }],
          take: 1,
          select: {
            id: true,
            revisionId: true,
            reviewerUserId: true,
            decision: true,
            notes: true,
            source: true,
            publishTrack: true,
            createdAt: true,
            decidedAt: true,
          },
        },
      },
    });

    if (!caseRecord) {
      throw new NotFoundException(`Case not found: ${caseId}`);
    }

    return caseRecord;
  }

  async rerunValidation(caseId: string, triggeredByUserId: string) {
    this.logger.log(
      JSON.stringify({
        event: 'admin.case.validation_rerun.started',
        caseId,
        triggeredByUserId,
      }),
    );

    const result = await this.withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const caseRecord = await tx.case.findUnique({
            where: { id: caseId },
            select: {
              id: true,
              editorialStatus: true,
              currentRevisionId: true,
            },
          });

          if (!caseRecord) {
            throw new NotFoundException(`Case not found: ${caseId}`);
          }

          const startedAt = new Date();
          const snapshot =
            await this.caseRevisionService.getCurrentCaseSnapshotInTransaction(
              tx,
              caseId,
            );

          let validationReport;
          try {
            validationReport =
              this.caseValidationService.validateSnapshot(snapshot);
          } catch (error) {
            validationReport =
              this.caseValidationService.buildExecutionErrorReport(error);
          }

          const persistencePayload =
            this.caseValidationService.buildPersistencePayload(validationReport);

          const validationRun = await tx.caseValidationRun.create({
            data: {
              caseId,
              revisionId: caseRecord.currentRevisionId,
              source: CaseSource.ADMIN_EDIT,
              outcome: validationReport.outcome,
              validatorVersion: validationReport.validatorVersion,
              summary: persistencePayload.summary,
              findings: persistencePayload.findings,
              triggeredByUserId,
              startedAt,
              completedAt: new Date(),
            },
            select: {
              id: true,
              revisionId: true,
              outcome: true,
              validatorVersion: true,
              summary: true,
              findings: true,
              startedAt: true,
              completedAt: true,
            },
          });

          const nextEditorialStatus = getEditorialStatusForValidationOutcome({
            currentStatus: caseRecord.editorialStatus,
            outcome: validationReport.outcome,
          });
          const caseUpdate: Prisma.CaseUncheckedUpdateInput = nextEditorialStatus
            ? {
                editorialStatus: nextEditorialStatus,
              }
            : {};

          if (validationReport.outcome !== ValidationOutcome.PASSED) {
            Object.assign(caseUpdate, getApprovalResetFields());
          }

          const updatedCase = await tx.case.update({
            where: { id: caseId },
            data: caseUpdate,
            select: {
              id: true,
              editorialStatus: true,
              approvedAt: true,
              approvedByUserId: true,
              currentRevisionId: true,
            },
          });

          this.logger.log(
            JSON.stringify({
              event: 'admin.case.validation_rerun.completed',
              caseId,
              validationRunId: validationRun.id,
              revisionId: validationRun.revisionId,
              outcome: validationRun.outcome,
              editorialStatus: updatedCase.editorialStatus,
              triggeredByUserId,
            }),
          );

          return {
            case: updatedCase,
            validationRun,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      ),
    );

    this.editorialMetrics.recordValidationResult(
      CaseSource.ADMIN_EDIT,
      result.validationRun.outcome ?? ValidationOutcome.ERROR,
    );

    return result;
  }

  async startReview(caseId: string, reviewerUserId: string) {
    this.logger.log(
      JSON.stringify({
        event: 'admin.case.review.start_requested',
        caseId,
        reviewerUserId,
      }),
    );

    return this.withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const caseRecord = await tx.case.findUnique({
            where: { id: caseId },
            select: {
              id: true,
              editorialStatus: true,
              currentRevisionId: true,
            },
          });

          if (!caseRecord) {
            throw new NotFoundException(`Case not found: ${caseId}`);
          }

          if (!canStartEditorialReview(caseRecord.editorialStatus)) {
            throw new BadRequestException(
              'Published cases cannot be re-opened for review in Phase 4',
            );
          }

          const existingOpenReview = await tx.caseReview.findFirst({
            where: {
              caseId,
              revisionId: caseRecord.currentRevisionId,
              decision: null,
            },
            orderBy: [{ createdAt: 'desc' }],
            select: {
              id: true,
              revisionId: true,
              reviewerUserId: true,
              decision: true,
              notes: true,
              createdAt: true,
              decidedAt: true,
            },
          });

          const review =
            existingOpenReview
              ? await tx.caseReview.update({
                  where: {
                    id: existingOpenReview.id,
                  },
                  data: {
                    reviewerUserId,
                  },
                  select: {
                    id: true,
                    revisionId: true,
                    reviewerUserId: true,
                    decision: true,
                    notes: true,
                    createdAt: true,
                    decidedAt: true,
                  },
                })
              : await tx.caseReview.create({
                  data: {
                    caseId,
                    revisionId: caseRecord.currentRevisionId,
                    reviewerUserId,
                  },
                  select: {
                    id: true,
                    revisionId: true,
                    reviewerUserId: true,
                    decision: true,
                    notes: true,
                    createdAt: true,
                    decidedAt: true,
                  },
                });

          const updatedCase = await tx.case.update({
            where: { id: caseId },
            data: {
              editorialStatus: CaseEditorialStatus.REVIEW,
            },
            select: {
              id: true,
              editorialStatus: true,
              currentRevisionId: true,
              approvedAt: true,
              approvedByUserId: true,
            },
          });

          this.logger.log(
            JSON.stringify({
              event: 'admin.case.review.started',
              caseId,
              reviewId: review.id,
              revisionId: updatedCase.currentRevisionId,
              reviewerUserId,
            }),
          );

          return {
            case: updatedCase,
            review,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      ),
    );
  }

  async submitReview(
    caseId: string,
    reviewerUserId: string,
    input: SubmitCaseReviewDto,
  ) {
    this.logger.log(
      JSON.stringify({
        event: 'admin.case.review.submit_requested',
        caseId,
        reviewerUserId,
        decision: input.decision,
      }),
    );

    const result = await this.withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const caseRecord = await tx.case.findUnique({
            where: { id: caseId },
            select: {
              id: true,
              editorialStatus: true,
              currentRevisionId: true,
            },
          });

          if (!caseRecord) {
            throw new NotFoundException(`Case not found: ${caseId}`);
          }

          if (caseRecord.editorialStatus !== CaseEditorialStatus.REVIEW) {
            throw new BadRequestException(
              'Case must be in REVIEW before submitting a review',
            );
          }

          const openReview = await tx.caseReview.findFirst({
            where: {
              caseId,
              revisionId: caseRecord.currentRevisionId,
              decision: null,
            },
            orderBy: [{ createdAt: 'desc' }],
            select: {
              id: true,
            },
          });

          if (!openReview) {
            throw new BadRequestException(
              'No active review exists for the current revision',
            );
          }

          const review = await tx.caseReview.update({
            where: { id: openReview.id },
            data: {
              reviewerUserId,
              decision: input.decision,
              notes: this.normalizeOptionalString(input.notes) ?? null,
              decidedAt: new Date(),
            },
            select: {
              id: true,
              revisionId: true,
              reviewerUserId: true,
              decision: true,
              notes: true,
              createdAt: true,
              decidedAt: true,
            },
          });

          const nextEditorialStatus = getEditorialStatusForReviewDecision(
            input.decision,
          );
          const caseUpdate: Prisma.CaseUncheckedUpdateInput = {
            editorialStatus: nextEditorialStatus,
          };

          if (input.decision === ReviewDecision.APPROVED) {
            caseUpdate.approvedAt = new Date();
            caseUpdate.approvedByUserId = reviewerUserId;
          } else {
            Object.assign(caseUpdate, getApprovalResetFields());
          }

          const updatedCase = await tx.case.update({
            where: { id: caseId },
            data: caseUpdate,
            select: {
              id: true,
              editorialStatus: true,
              approvedAt: true,
              approvedByUserId: true,
              currentRevisionId: true,
            },
          });

          this.logger.log(
            JSON.stringify({
              event: 'admin.case.review.submitted',
              caseId,
              reviewId: review.id,
              revisionId: updatedCase.currentRevisionId,
              reviewerUserId,
              decision: review.decision,
              editorialStatus: updatedCase.editorialStatus,
            }),
          );

          return {
            case: updatedCase,
            review,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      ),
    );

    this.editorialMetrics.recordReviewOutcome(input.decision);

    return result;
  }

  async listRevisions(caseId: string) {
    await this.assertCaseExists(caseId);

    return this.prisma.caseRevision.findMany({
      where: {
        caseId,
      },
      orderBy: [{ revisionNumber: 'desc' }],
      select: {
        id: true,
        revisionNumber: true,
        source: true,
        publishTrack: true,
        title: true,
        date: true,
        difficulty: true,
        history: true,
        symptoms: true,
        labs: true,
        clues: true,
        explanation: true,
        differentials: true,
        diagnosisId: true,
        createdByUserId: true,
        createdAt: true,
        validationRuns: {
          orderBy: [{ startedAt: 'desc' }],
          take: 5,
          select: {
            id: true,
            outcome: true,
            validatorVersion: true,
            source: true,
            triggeredByUserId: true,
            startedAt: true,
            completedAt: true,
          },
        },
        reviews: {
          orderBy: [{ createdAt: 'desc' }],
          take: 5,
          select: {
            id: true,
            reviewerUserId: true,
            decision: true,
            notes: true,
            createdAt: true,
            decidedAt: true,
          },
        },
      },
    });
  }

  async restoreRevision(
    caseId: string,
    revisionId: string,
    createdByUserId: string,
  ) {
    this.logger.log(
      JSON.stringify({
        event: 'admin.case.revision.restore_requested',
        caseId,
        revisionId,
        createdByUserId,
      }),
    );

    const result = await this.withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const caseRecord = await tx.case.findUnique({
            where: { id: caseId },
            select: {
              id: true,
              editorialStatus: true,
            },
          });

          if (!caseRecord) {
            throw new NotFoundException(`Case not found: ${caseId}`);
          }

          const revision = await tx.caseRevision.findFirst({
            where: {
              id: revisionId,
              caseId,
            },
            select: {
              id: true,
              revisionNumber: true,
              title: true,
              date: true,
              difficulty: true,
              history: true,
              symptoms: true,
              labs: true,
              clues: true,
              explanation: true,
              differentials: true,
              diagnosisId: true,
            },
          });

          if (!revision) {
            throw new NotFoundException(
              `Revision ${revisionId} not found for case ${caseId}`,
            );
          }

          const snapshot = {
            caseId,
            title: revision.title,
            date: revision.date,
            difficulty: revision.difficulty,
            history: revision.history,
            symptoms: [...revision.symptoms],
            labs: revision.labs,
            clues: revision.clues,
            explanation: revision.explanation,
            differentials: [...revision.differentials],
            diagnosisId: revision.diagnosisId,
          };

          await tx.case.update({
            where: { id: caseId },
            data: {
              title: snapshot.title,
              date: snapshot.date,
              difficulty: snapshot.difficulty,
              history: snapshot.history,
              symptoms: snapshot.symptoms,
              labs: this.toNullableJsonValue(snapshot.labs),
              clues: this.toNullableJsonValue(snapshot.clues),
              explanation: this.toNullableJsonValue(snapshot.explanation),
              differentials: snapshot.differentials,
              diagnosisId: snapshot.diagnosisId,
              ...getApprovalResetFields(),
            },
          });

          const restoredRevision =
            await this.caseRevisionService.createRevisionFromSnapshotInTransaction(
              tx,
              {
                caseId,
                snapshot,
                source: CaseSource.RESTORED,
                createdByUserId,
              },
            );

          let validationReport;
          try {
            validationReport =
              this.caseValidationService.validateSnapshot(snapshot);
          } catch (error) {
            validationReport =
              this.caseValidationService.buildExecutionErrorReport(error);
          }

          const persistencePayload =
            this.caseValidationService.buildPersistencePayload(validationReport);

          const validationRun = await tx.caseValidationRun.create({
            data: {
              caseId,
              revisionId: restoredRevision.revisionId,
              source: CaseSource.RESTORED,
              outcome: validationReport.outcome,
              validatorVersion: validationReport.validatorVersion,
              summary: persistencePayload.summary,
              findings: persistencePayload.findings,
              triggeredByUserId: createdByUserId,
              startedAt: new Date(),
              completedAt: new Date(),
            },
            select: {
              id: true,
              outcome: true,
              validatorVersion: true,
              startedAt: true,
              completedAt: true,
            },
          });

          const updatedCase = await tx.case.update({
            where: { id: caseId },
            data: {
              editorialStatus:
                getEditorialStatusForValidationOutcome({
                  currentStatus: caseRecord.editorialStatus,
                  outcome: validationReport.outcome,
                }) ?? CaseEditorialStatus.VALIDATED,
              ...getApprovalResetFields(),
            },
            select: {
              id: true,
              editorialStatus: true,
              approvedAt: true,
              approvedByUserId: true,
              currentRevisionId: true,
            },
          });

          this.logger.log(
            JSON.stringify({
              event: 'admin.case.revision.restored',
              caseId,
              restoredFromRevisionId: revisionId,
              newRevisionId: restoredRevision.revisionId,
              newRevisionNumber: restoredRevision.revisionNumber,
              validationRunId: validationRun.id,
              validationOutcome: validationRun.outcome,
              previousEditorialStatus: caseRecord.editorialStatus,
              currentEditorialStatus: updatedCase.editorialStatus,
              createdByUserId,
            }),
          );

          return {
            case: updatedCase,
            restoredFromRevisionId: revisionId,
            revision: {
              id: restoredRevision.revisionId,
              revisionNumber: restoredRevision.revisionNumber,
              source: CaseSource.RESTORED,
              snapshot: restoredRevision.snapshot,
            },
            validationRun,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      ),
    );

    this.editorialMetrics.recordValidationResult(
      CaseSource.RESTORED,
      result.validationRun.outcome ?? ValidationOutcome.ERROR,
    );

    return result;
  }

  async markReadyToPublish(caseId: string) {
    this.logger.log(
      JSON.stringify({
        event: 'admin.case.ready_to_publish.requested',
        caseId,
      }),
    );

    const result = await this.withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const caseRecord = await tx.case.findUnique({
            where: { id: caseId },
            select: {
              id: true,
              editorialStatus: true,
              approvedAt: true,
              approvedByUserId: true,
            },
          });

          if (!caseRecord) {
            throw new NotFoundException(`Case not found: ${caseId}`);
          }

          if (!canMoveToReadyToPublish(caseRecord.editorialStatus)) {
            throw new BadRequestException(
              'Only APPROVED cases can be marked ready to publish',
            );
          }

          const updatedCase = await tx.case.update({
            where: { id: caseId },
            data: {
              editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
            },
            select: {
              id: true,
              editorialStatus: true,
              approvedAt: true,
              approvedByUserId: true,
              currentRevisionId: true,
            },
          });

          this.logger.log(
            JSON.stringify({
              event: 'admin.case.ready_to_publish.marked',
              caseId,
              approvedAt: updatedCase.approvedAt,
              approvedByUserId: updatedCase.approvedByUserId,
            }),
          );

          return updatedCase;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      ),
    );

    this.editorialMetrics.recordReadyToPublishTransition();

    return result;
  }

  async getEditorialStatusSummary() {
    const statuses = Object.values(CaseEditorialStatus);
    const results = await this.prisma.$transaction([
      this.prisma.case.count({
        where: {
          editorialStatus: null,
        },
      }),
      ...statuses.map((status) =>
        this.prisma.case.count({
          where: {
            editorialStatus: status,
          },
        }),
      ),
    ]);

    const [nullStatusCount, ...statusCounts] = results;
    const counts = Object.fromEntries(
      statuses.map((status, index) => [status, statusCounts[index] ?? 0]),
    ) as Record<CaseEditorialStatus, number>;

    return {
      counts,
      nullStatusCount,
      totalCases:
        nullStatusCount +
        statusCounts.reduce((sum, count) => sum + count, 0),
    };
  }

  async getValidationOutcomeSummary() {
    const grouped = await this.prisma.caseValidationRun.groupBy({
      by: ['source', 'outcome'],
      _count: {
        id: true,
      },
      orderBy: [{ source: 'asc' }, { outcome: 'asc' }],
    });

    const counts = Object.fromEntries(
      Object.values(CaseSource).map((source) => [
        source,
        Object.fromEntries(
          Object.values(ValidationOutcome).map((outcome) => [outcome, 0]),
        ),
      ]),
    ) as Record<CaseSource, Record<ValidationOutcome, number>>;

    for (const row of grouped) {
      if (row.source && row.outcome) {
        counts[row.source][row.outcome] = row._count.id ?? 0;
      }
    }

    return counts;
  }

  async getPublishAssignmentSummary() {
    const [approvedCases, readyToPublishCases] = await this.prisma.$transaction([
      this.prisma.case.count({
        where: {
          editorialStatus: CaseEditorialStatus.APPROVED,
        },
      }),
      this.prisma.case.count({
        where: {
          editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
        },
      }),
    ]);

    return {
      currentEligiblePool: {
        approvedCases,
        readyToPublishCases,
      },
      metrics: this.editorialMetrics.snapshot().assignments,
    };
  }

  private async assertCaseExists(caseId: string): Promise<void> {
    const existing = await this.prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException(`Case not found: ${caseId}`);
    }
  }

  private normalizeOptionalString(value?: string): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private toNullableJsonValue(
    value: Prisma.JsonValue | null,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
    return value === null ? Prisma.DbNull : (value as Prisma.InputJsonValue);
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
