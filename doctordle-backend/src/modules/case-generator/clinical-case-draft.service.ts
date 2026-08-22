import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CaseSource,
  ClinicalCaseDraftReviewDecision,
  ClinicalCaseDraftStatus,
  DiagnosisMappingMethod,
  DiagnosisMappingStatus,
  Prisma,
  ValidationOutcome,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service.js';
import { CaseValidationService } from '../case-validation/case-validation.service.js';
import type { CaseRevisionSnapshot } from '../case-validation/case-validation.types.js';
import {
  buildCaseRevisionMaterialHash,
  normalizeForMaterialHash,
} from '../case-validation/case-revision-material.js';
import { stableStringify } from '../editorial-governance/governed-command/index.js';
import type {
  GeneratedCase,
  PlannedGenerationSlot,
} from './case-generator.types.js';

type DraftTarget = NonNullable<PlannedGenerationSlot['diagnosis']>;

type PersistClinicalCaseDraftInput = {
  generatedCase: GeneratedCase;
  target: DraftTarget;
  difficulty: string;
  generationContext: unknown;
  generationPurpose?: string;
  selectionSource?: string | null;
  sourceIssue?: unknown;
  createdByUserId?: string | null;
};

type ReviewClinicalCaseDraftInput = {
  draftId: string;
  decision: ClinicalCaseDraftReviewDecision;
  reviewerUserId?: string | null;
  rationale?: string | null;
};

type ApplyClinicalCaseDraftInput = {
  draftId: string;
  idempotencyKey: string;
  actorUserId?: string | null;
};

@Injectable()
export class ClinicalCaseDraftService {
  private caseDateCursor = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly caseValidationService: CaseValidationService,
  ) {}

  async persistGeneratedDraft(input: PersistClinicalCaseDraftInput) {
    const draftId = randomUUID();
    const snapshot = this.toSnapshot({
      draftId,
      generatedCase: input.generatedCase,
      target: input.target,
      difficulty: input.difficulty,
    });
    const validationReport =
      this.caseValidationService.validateSnapshot(snapshot);
    const validationPayload =
      this.caseValidationService.buildPersistencePayload(validationReport);
    const context = this.buildGenerationContext(input);
    const generationContextHash = this.hashJson(context);
    const generatedContent = this.toGeneratedContent({
      generatedCase: input.generatedCase,
      target: input.target,
      difficulty: input.difficulty,
      snapshot,
    });
    const blockingFindings = validationReport.issues.filter(
      (issue) => issue.severity === 'error',
    );
    const warningFindings = validationReport.issues.filter(
      (issue) => issue.severity === 'warning',
    );

    return this.prisma.clinicalCaseDraft.create({
      data: {
        id: draftId,
        diagnosisRegistryId: input.target.diagnosisRegistryId,
        generationPurpose:
          input.generationPurpose ?? 'AI_CLINICAL_CASE_GENERATION',
        generationMethod: 'registry_target',
        selectionSource: input.selectionSource ?? null,
        sourceIssue: this.toNullableJson(input.sourceIssue),
        generationContext: this.toJson(context),
        generationContextHash,
        generatedContent: this.toJson(generatedContent),
        validationStatus: validationReport.outcome,
        validationSummary: validationPayload.summary,
        validationFindings: validationPayload.findings,
        blockingFindings: this.toNullableJson({ issues: blockingFindings }),
        warningFindings: this.toNullableJson({ issues: warningFindings }),
        reviewStatus: ClinicalCaseDraftStatus.PENDING_REVIEW,
        createdByUserId: input.createdByUserId ?? null,
      },
      include: this.defaultInclude(),
    });
  }

  async getDraft(draftId: string) {
    const draft = await this.prisma.clinicalCaseDraft.findUnique({
      where: { id: draftId },
      include: this.defaultInclude(),
    });
    if (!draft) {
      throw new NotFoundException(`Clinical Case Draft not found: ${draftId}`);
    }
    return this.toReadModel(draft);
  }

  async reviewDraft(input: ReviewClinicalCaseDraftInput) {
    return this.prisma.$transaction(async (tx) => {
      const draft = await tx.clinicalCaseDraft.findUnique({
        where: { id: input.draftId },
        select: { id: true, reviewStatus: true },
      });
      if (!draft) {
        throw new NotFoundException(
          `Clinical Case Draft not found: ${input.draftId}`,
        );
      }
      if (draft.reviewStatus === ClinicalCaseDraftStatus.APPLIED) {
        throw new ConflictException('Applied Clinical Case Draft cannot be reviewed');
      }
      if (draft.reviewStatus === ClinicalCaseDraftStatus.SUPERSEDED) {
        throw new ConflictException('Superseded Clinical Case Draft cannot be reviewed');
      }

      const decisionRecord =
        await tx.clinicalCaseDraftReviewDecisionRecord.create({
          data: {
            draftId: input.draftId,
            decision: input.decision,
            reviewerUserId: input.reviewerUserId ?? null,
            rationale: input.rationale?.trim() || null,
          },
        });
      const nextStatus = this.statusFromDecision(input.decision);
      await tx.clinicalCaseDraft.update({
        where: { id: input.draftId },
        data: {
          reviewStatus: nextStatus,
          latestReviewDecisionId: decisionRecord.id,
          acceptedAt:
            input.decision === ClinicalCaseDraftReviewDecision.ACCEPT
              ? decisionRecord.decidedAt
              : null,
          acceptedByUserId:
            input.decision === ClinicalCaseDraftReviewDecision.ACCEPT
              ? input.reviewerUserId ?? null
              : null,
        },
      });
      return decisionRecord;
    });
  }

  async applyAcceptedDraft(input: ApplyClinicalCaseDraftInput) {
    if (!input.idempotencyKey?.trim()) {
      throw new BadRequestException('idempotencyKey is required');
    }
    const commandFingerprint = this.buildApplicationFingerprint(input);

    return this.withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const priorCommand =
            await tx.clinicalCaseDraftApplicationCommand.findUnique({
              where: { commandIdempotencyKey: input.idempotencyKey },
            });
          if (priorCommand) {
            return this.resolvePriorApplicationCommand(tx, {
              priorCommand,
              commandFingerprint,
            });
          }

          const draft = await tx.clinicalCaseDraft.findUnique({
            where: { id: input.draftId },
          });
          if (!draft) {
            throw new NotFoundException(
              `Clinical Case Draft not found: ${input.draftId}`,
            );
          }
          if (draft.reviewStatus !== ClinicalCaseDraftStatus.ACCEPTED) {
            if (
              draft.reviewStatus === ClinicalCaseDraftStatus.APPLIED &&
              draft.resultingCaseId &&
              draft.resultingCaseRevisionId
            ) {
              throw new ConflictException(
                'Clinical Case Draft has already been applied',
              );
            }
            throw new ConflictException(
              'Only accepted Clinical Case Drafts can be applied',
            );
          }
          if (draft.validationStatus !== ValidationOutcome.PASSED) {
            throw new ConflictException(
              'Clinical Case Draft application requires passed validation',
            );
          }

          await tx.clinicalCaseDraftApplicationCommand.create({
            data: {
              draftId: input.draftId,
              commandAction: 'APPLY_ACCEPTED_CLINICAL_CASE_DRAFT',
              commandIdempotencyKey: input.idempotencyKey,
              commandFingerprint,
              actorUserId: input.actorUserId ?? null,
              status: 'PENDING',
            },
          });

          const stateGate = await tx.clinicalCaseDraft.updateMany({
            where: {
              id: input.draftId,
              reviewStatus: ClinicalCaseDraftStatus.ACCEPTED,
              resultingCaseId: null,
              resultingCaseRevisionId: null,
            },
            data: {
              reviewStatus: ClinicalCaseDraftStatus.APPLIED,
              appliedAt: new Date(),
              appliedByUserId: input.actorUserId ?? null,
            },
          });
          if (stateGate.count !== 1) {
            throw new ConflictException(
              'Clinical Case Draft application lost the acceptance state race',
            );
          }

          const snapshot = this.snapshotFromDraft(draft);
          const caseId = randomUUID();
          const revisionId = randomUUID();
          const date = this.nextCaseDate();
          const contentHash = buildCaseRevisionMaterialHash({
            ...snapshot,
            date,
            source: CaseSource.GENERATED,
          });

          await tx.case.create({
            data: {
              id: caseId,
              publicNumber: await this.getNextCasePublicNumber(tx),
              title: snapshot.title,
              date,
              difficulty: snapshot.difficulty,
              history: snapshot.history,
              symptoms: snapshot.symptoms,
              labs: this.toNullableJson(snapshot.labs),
              clues: this.toNullableJson(snapshot.clues),
              explanation: this.toNullableJson(snapshot.explanation),
              differentials: snapshot.differentials,
              diagnosisId: snapshot.diagnosisId,
              diagnosisRegistryId: snapshot.diagnosisRegistryId,
              proposedDiagnosisText: snapshot.proposedDiagnosisText,
              diagnosisMappingStatus: snapshot.diagnosisMappingStatus,
              diagnosisMappingMethod: snapshot.diagnosisMappingMethod,
              diagnosisMappingConfidence: snapshot.diagnosisMappingConfidence,
              diagnosisEditorialNote: snapshot.diagnosisEditorialNote,
            },
          });
          await tx.caseRevision.create({
            data: {
              id: revisionId,
              caseId,
              revisionNumber: 1,
              contentHash,
              changeSummary: 'Initial revision from accepted Clinical Case Draft',
              changeReason: 'APPLY_ACCEPTED_CLINICAL_CASE_DRAFT',
              materialChange: this.toJson({
                draftId: input.draftId,
                controlledApplication: true,
              }),
              source: CaseSource.GENERATED,
              title: snapshot.title,
              date,
              difficulty: snapshot.difficulty,
              history: snapshot.history,
              symptoms: snapshot.symptoms,
              labs: this.toNullableJson(snapshot.labs),
              clues: this.toNullableJson(snapshot.clues),
              explanation: this.toNullableJson(snapshot.explanation),
              differentials: snapshot.differentials,
              diagnosisId: snapshot.diagnosisId,
              diagnosisRegistryId: snapshot.diagnosisRegistryId,
              proposedDiagnosisText: snapshot.proposedDiagnosisText,
              diagnosisMappingStatus: snapshot.diagnosisMappingStatus,
              diagnosisMappingMethod: snapshot.diagnosisMappingMethod,
              diagnosisMappingConfidence: snapshot.diagnosisMappingConfidence,
              diagnosisEditorialNote: snapshot.diagnosisEditorialNote,
              createdByUserId: input.actorUserId ?? null,
            },
          });
          await tx.case.update({
            where: { id: caseId },
            data: { currentRevisionId: revisionId },
          });
          await tx.clinicalCaseDraft.update({
            where: { id: input.draftId },
            data: {
              resultingCaseId: caseId,
              resultingCaseRevisionId: revisionId,
            },
          });
          await tx.clinicalCaseDraftApplicationCommand.update({
            where: { commandIdempotencyKey: input.idempotencyKey },
            data: {
              status: 'SUCCESS',
              resultCaseId: caseId,
              resultCaseRevisionId: revisionId,
              completedAt: new Date(),
            },
          });

          return {
            status: 'applied' as const,
            draftId: input.draftId,
            caseId,
            caseRevisionId: revisionId,
            idempotencyKey: input.idempotencyKey,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }

  toReadModel(draft: any) {
    return {
      id: draft.id,
      diagnosisRegistryId: draft.diagnosisRegistryId,
      diagnosis: draft.diagnosisRegistry,
      generationPurpose: draft.generationPurpose,
      generationMethod: draft.generationMethod,
      selectionSource: draft.selectionSource,
      sourceIssue: draft.sourceIssue,
      generatedContent: draft.generatedContent,
      generationContext: draft.generationContext,
      generationContextHash: draft.generationContextHash,
      validation: {
        status: draft.validationStatus,
        summary: draft.validationSummary,
        findings: draft.validationFindings,
        blockingFindings: draft.blockingFindings,
        warningFindings: draft.warningFindings,
      },
      reviewStatus: draft.reviewStatus,
      latestReviewDecision: draft.latestReviewDecision,
      reviewDecisions: draft.reviewDecisions,
      applicationAllowed:
        draft.reviewStatus === ClinicalCaseDraftStatus.ACCEPTED &&
        draft.validationStatus === ValidationOutcome.PASSED,
      resultingCaseId: draft.resultingCaseId,
      resultingCaseRevisionId: draft.resultingCaseRevisionId,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    };
  }

  private defaultInclude() {
    return {
      diagnosisRegistry: {
        select: {
          id: true,
          displayLabel: true,
          canonicalName: true,
          specialty: true,
          bodySystem: true,
          category: true,
        },
      },
      latestReviewDecision: true,
      reviewDecisions: {
        orderBy: { decidedAt: 'asc' as const },
      },
    };
  }

  private statusFromDecision(decision: ClinicalCaseDraftReviewDecision) {
    if (decision === ClinicalCaseDraftReviewDecision.ACCEPT) {
      return ClinicalCaseDraftStatus.ACCEPTED;
    }
    if (decision === ClinicalCaseDraftReviewDecision.REJECT) {
      return ClinicalCaseDraftStatus.REJECTED;
    }
    return ClinicalCaseDraftStatus.CHANGES_REQUESTED;
  }

  private toSnapshot(input: {
    draftId: string;
    generatedCase: GeneratedCase;
    target: DraftTarget;
    difficulty: string;
  }): CaseRevisionSnapshot {
    const history =
      input.generatedCase.clues.find((clue) => clue.type === 'history')?.value ??
      input.generatedCase.clues[0]?.value ??
      input.target.displayLabel;
    const symptoms = input.generatedCase.clues
      .filter((clue) => clue.type === 'symptom')
      .map((clue) => clue.value);

    return {
      caseId: input.draftId,
      title: input.target.displayLabel,
      date: new Date(0),
      difficulty: input.difficulty,
      history,
      symptoms,
      labs: null,
      clues: input.generatedCase.clues as Prisma.JsonValue,
      explanation: this.toPersistedExplanation(input.generatedCase),
      differentials: input.generatedCase.differentials,
      diagnosisId: input.target.legacyDiagnosisId,
      diagnosisRegistryId: input.target.diagnosisRegistryId,
      proposedDiagnosisText: input.target.displayLabel,
      diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
      diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
      diagnosisMappingConfidence: 1,
      diagnosisEditorialNote: null,
    };
  }

  private snapshotFromDraft(draft: {
    id: string;
    generatedContent: Prisma.JsonValue;
  }): CaseRevisionSnapshot {
    const content = draft.generatedContent as { snapshot?: CaseRevisionSnapshot };
    if (!content?.snapshot) {
      throw new BadRequestException(
        'Clinical Case Draft does not contain an application snapshot',
      );
    }
    return {
      ...content.snapshot,
      date: new Date(content.snapshot.date),
    };
  }

  private toGeneratedContent(input: {
    generatedCase: GeneratedCase;
    target: DraftTarget;
    difficulty: string;
    snapshot: CaseRevisionSnapshot;
  }) {
    return {
      generatedCase: input.generatedCase,
      target: input.target,
      difficulty: input.difficulty,
      snapshot: {
        ...input.snapshot,
        date: input.snapshot.date.toISOString(),
      },
    };
  }

  private toPersistedExplanation(generatedCase: GeneratedCase) {
    const generationQuality = (
      generatedCase.explanation as GeneratedCase['explanation'] & {
        generationQuality?: unknown;
      }
    ).generationQuality;
    return {
      ...generatedCase.explanation,
      differentials: generatedCase.differentials,
      ...(generationQuality ? { generationQuality } : {}),
    } as Prisma.JsonValue;
  }

  private buildGenerationContext(input: PersistClinicalCaseDraftInput) {
    return {
      diagnosisRegistryId: input.target.diagnosisRegistryId,
      target: input.target,
      generationContext: input.generationContext ?? null,
      generationPurpose: input.generationPurpose ?? 'AI_CLINICAL_CASE_GENERATION',
      selectionSource: input.selectionSource ?? null,
      sourceIssue: input.sourceIssue ?? null,
      generatorVersion: 'case-generator:v2',
      generationMethod: 'registry_target',
      generatedAt: new Date().toISOString(),
    };
  }

  private buildApplicationFingerprint(input: ApplyClinicalCaseDraftInput) {
    return stableStringify(
      normalizeForMaterialHash({
        action: 'APPLY_ACCEPTED_CLINICAL_CASE_DRAFT',
        draftId: input.draftId,
      }),
    );
  }

  private async resolvePriorApplicationCommand(
    tx: Prisma.TransactionClient,
    input: {
      priorCommand: {
        commandFingerprint: string;
        status: string;
        resultCaseId: string | null;
        resultCaseRevisionId: string | null;
      };
      commandFingerprint: string;
    },
  ) {
    if (input.priorCommand.commandFingerprint !== input.commandFingerprint) {
      throw new ConflictException(
        'Conflicting Clinical Case Draft application idempotency key',
      );
    }
    if (
      input.priorCommand.status === 'SUCCESS' &&
      input.priorCommand.resultCaseId &&
      input.priorCommand.resultCaseRevisionId
    ) {
      return {
        status: 'applied' as const,
        draftId: (
          await tx.clinicalCaseDraftApplicationCommand.findFirstOrThrow({
            where: {
              resultCaseId: input.priorCommand.resultCaseId,
              resultCaseRevisionId: input.priorCommand.resultCaseRevisionId,
            },
            select: { draftId: true },
          })
        ).draftId,
        caseId: input.priorCommand.resultCaseId,
        caseRevisionId: input.priorCommand.resultCaseRevisionId,
      };
    }
    throw new ConflictException(
      'Clinical Case Draft application command is not replayable',
    );
  }

  private hashJson(value: unknown): string {
    return createHash('sha256')
      .update(stableStringify(normalizeForMaterialHash(value)))
      .digest('hex');
  }

  private nextCaseDate(): Date {
    const nextTimestamp = Math.max(Date.now(), this.caseDateCursor + 1);
    this.caseDateCursor = nextTimestamp;
    return new Date(nextTimestamp);
  }

  private async getNextCasePublicNumber(
    client: Prisma.TransactionClient,
  ): Promise<number> {
    const latest = await client.case.findFirst({
      where: { publicNumber: { not: null } },
      orderBy: { publicNumber: 'desc' },
      select: { publicNumber: true },
    });

    return (latest?.publicNumber ?? 0) + 1;
  }

  private async withSerializableRetry<T>(operation: () => Promise<T>) {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (!this.isPrismaSerializableConflict(error)) {
          throw error;
        }
      }
    }
    throw lastError;
  }

  private isPrismaSerializableConflict(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2034'
    );
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
  }

  private toNullableJson(
    value: unknown,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
    if (value === null || value === undefined) return Prisma.DbNull;
    return this.toJson(value);
  }
}
