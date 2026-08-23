import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DiagnosisEducationCandidateApplicationStatus,
  DiagnosisEducationCandidateReviewDecision,
  DiagnosisEducationCandidateScope,
  DiagnosisEducationCandidateStatus,
  DiagnosisEducationSource,
  DiagnosisEducationStatus,
  Prisma,
  ValidationOutcome,
  type DiagnosisEducation,
  type DiagnosisEducationCandidate,
} from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../../core/db/prisma.service';
import { DifferentialMappingService } from '../diagnosis-graph/differential-mapping.service';
import { ReasoningDraftValidationService } from '../admin/reasoning-draft-validation.service';
import type { EducationRegenerableSection } from './education-section-quality-classifier.service';

const EDUCATION_CANDIDATE_STALE_MESSAGE =
  'Education candidate base version is stale. Refresh before applying.';

const EDUCATION_JSON_FIELDS = [
  'summary',
  'clinicalPattern',
  'keySymptoms',
  'keySigns',
  'examPearls',
  'scoringSystems',
  'investigations',
  'differentials',
  'management',
  'complications',
  'pitfalls',
  'recallPrompts',
  'references',
] as const;

type EducationJsonField = (typeof EDUCATION_JSON_FIELDS)[number];
type EducationMaterial = Record<EducationJsonField, Prisma.InputJsonValue>;

type CandidateWithHistory = DiagnosisEducationCandidate & {
  reviewDecisions?: unknown[];
  applicationCommands?: unknown[];
};

@Injectable()
export class DiagnosisEducationCandidateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly differentialMappingService?: DifferentialMappingService,
    private readonly reasoningDraftValidationService?: ReasoningDraftValidationService,
  ) {}

  listForDiagnosis(diagnosisRegistryId: string) {
    return this.prisma.diagnosisEducationCandidate.findMany({
      where: { diagnosisRegistryId },
      include: this.candidateInclude(),
      orderBy: [{ createdAt: 'desc' }],
      take: 50,
    });
  }

  async getCandidate(candidateId: string) {
    const candidate = await this.prisma.diagnosisEducationCandidate.findUnique({
      where: { id: candidateId },
      include: this.candidateInclude(),
    });
    if (!candidate) {
      throw new NotFoundException('Diagnosis education candidate not found');
    }
    return candidate;
  }

  async createWholeCandidate(input: {
    diagnosisRegistryId: string;
    education: DiagnosisEducation | null;
    proposedEducation: EducationMaterial;
    inputContext: unknown;
    sourceArtifactIds?: unknown;
    validation: {
      blockers: string[];
      warnings: string[];
      metadata?: unknown;
      scores?: unknown;
    };
    generationProvider: string;
    generationModel: string;
    generatorVersion: string;
    promptVersion: string;
    createdByUserId: string;
  }) {
    const baseRevision = input.education
      ? await this.prisma.diagnosisEducationRevision.findUnique({
          where: {
            educationId_version: {
              educationId: input.education.id,
              version: input.education.version,
            },
          },
          select: { id: true },
        })
      : null;

    return this.prisma.$transaction(async (tx) => {
      const candidate = await tx.diagnosisEducationCandidate.create({
        data: {
          diagnosisRegistryId: input.diagnosisRegistryId,
          educationId: input.education?.id,
          scope: DiagnosisEducationCandidateScope.WHOLE,
          baseEducationVersion: input.education?.version,
          baseEducationRevisionId: baseRevision?.id,
          proposedEducation: input.proposedEducation,
          generationProvider: input.generationProvider,
          generationModel: input.generationModel,
          generatorVersion: input.generatorVersion,
          promptVersion: input.promptVersion,
          generationPurpose: 'AI_DIAGNOSIS_EDUCATION_WHOLE_GENERATION',
          inputContext: this.json(input.inputContext),
          contextHash: this.hash(input.inputContext),
          sourceArtifactIds: this.optionalJson(input.sourceArtifactIds),
          validationStatus: this.validationOutcome(input.validation.blockers),
          validationSummary: this.json({
            scope: 'WHOLE',
            blockerCount: input.validation.blockers.length,
            warningCount: input.validation.warnings.length,
            scores: input.validation.scores ?? null,
          }),
          validationBlockers: this.optionalJson(input.validation.blockers),
          validationWarnings: this.optionalJson(input.validation.warnings),
          validationMetadata: this.optionalJson(input.validation.metadata),
          createdByUserId: input.createdByUserId,
        },
      });
      await this.supersedeOpenCandidates(tx, candidate);
      return tx.diagnosisEducationCandidate.findUniqueOrThrow({
        where: { id: candidate.id },
        include: this.candidateInclude(),
      });
    });
  }

  async createSectionCandidate(input: {
    diagnosisRegistryId: string;
    education: DiagnosisEducation;
    section: EducationRegenerableSection;
    proposedSection: Prisma.InputJsonValue;
    proposedReferences: Prisma.InputJsonValue;
    inputContext: unknown;
    sourceArtifactIds?: unknown;
    validation: {
      blockers: string[];
      warnings: string[];
      metadata?: unknown;
      scores?: unknown;
    };
    generationProvider: string;
    generationModel: string;
    generatorVersion: string;
    promptVersion: string;
    createdByUserId: string;
  }) {
    const baseRevision =
      await this.prisma.diagnosisEducationRevision.findUnique({
        where: {
          educationId_version: {
            educationId: input.education.id,
            version: input.education.version,
          },
        },
        select: { id: true },
      });

    return this.prisma.$transaction(async (tx) => {
      const candidate = await tx.diagnosisEducationCandidate.create({
        data: {
          diagnosisRegistryId: input.diagnosisRegistryId,
          educationId: input.education.id,
          scope: DiagnosisEducationCandidateScope.SECTION,
          section: input.section,
          baseEducationVersion: input.education.version,
          baseEducationRevisionId: baseRevision?.id,
          originalSection: this.optionalJson(input.education[input.section]),
          proposedSection: input.proposedSection,
          proposedReferences: input.proposedReferences,
          generationProvider: input.generationProvider,
          generationModel: input.generationModel,
          generatorVersion: input.generatorVersion,
          promptVersion: input.promptVersion,
          generationPurpose: 'AI_DIAGNOSIS_EDUCATION_SECTION_REGENERATION',
          inputContext: this.json(input.inputContext),
          contextHash: this.hash(input.inputContext),
          sourceArtifactIds: this.optionalJson(input.sourceArtifactIds),
          validationStatus: this.validationOutcome(input.validation.blockers),
          validationSummary: this.json({
            scope: 'SECTION',
            section: input.section,
            blockerCount: input.validation.blockers.length,
            warningCount: input.validation.warnings.length,
            scores: input.validation.scores ?? null,
          }),
          validationBlockers: this.optionalJson(input.validation.blockers),
          validationWarnings: this.optionalJson(input.validation.warnings),
          validationMetadata: this.optionalJson(input.validation.metadata),
          createdByUserId: input.createdByUserId,
        },
      });
      await this.supersedeOpenCandidates(tx, candidate);
      return tx.diagnosisEducationCandidate.findUniqueOrThrow({
        where: { id: candidate.id },
        include: this.candidateInclude(),
      });
    });
  }

  async reviewCandidate(input: {
    candidateId: string;
    decision: DiagnosisEducationCandidateReviewDecision;
    rationale: string;
    reviewerUserId: string;
  }) {
    const rationale = input.rationale.trim();
    if (!rationale) {
      throw new BadRequestException('Candidate review rationale is required');
    }

    const candidate = await this.getCandidate(input.candidateId);
    if (
      candidate.reviewStatus !==
        DiagnosisEducationCandidateStatus.PENDING_REVIEW &&
      candidate.reviewStatus !== DiagnosisEducationCandidateStatus.NEEDS_CHANGES
    ) {
      throw new ConflictException(
        'Diagnosis education candidate is not awaiting review',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const decision =
        await tx.diagnosisEducationCandidateReviewDecisionRecord.create({
          data: {
            candidateId: input.candidateId,
            decision: input.decision,
            rationale,
            reviewerUserId: input.reviewerUserId,
          },
        });
      const now = new Date();
      const nextStatus =
        input.decision === DiagnosisEducationCandidateReviewDecision.ACCEPT
          ? DiagnosisEducationCandidateStatus.ACCEPTED
          : input.decision === DiagnosisEducationCandidateReviewDecision.REJECT
            ? DiagnosisEducationCandidateStatus.REJECTED
            : DiagnosisEducationCandidateStatus.NEEDS_CHANGES;

      await tx.diagnosisEducationCandidate.update({
        where: { id: input.candidateId },
        data: {
          reviewStatus: nextStatus,
          latestReviewDecisionId: decision.id,
          acceptedAt:
            nextStatus === DiagnosisEducationCandidateStatus.ACCEPTED
              ? now
              : null,
          acceptedByUserId:
            nextStatus === DiagnosisEducationCandidateStatus.ACCEPTED
              ? input.reviewerUserId
              : null,
        },
      });

      return tx.diagnosisEducationCandidate.findUniqueOrThrow({
        where: { id: input.candidateId },
        include: this.candidateInclude(),
      });
    });
  }

  async applyCandidate(input: {
    candidateId: string;
    idempotencyKey: string;
    rationale: string;
    authorityReferences?: string[];
    actorUserId: string;
  }) {
    const rationale = input.rationale.trim();
    const idempotencyKey = input.idempotencyKey.trim();
    if (!rationale || !idempotencyKey) {
      throw new BadRequestException(
        'Application idempotencyKey and rationale are required',
      );
    }

    const existingCommand =
      await this.prisma.diagnosisEducationCandidateApplicationCommand.findUnique(
        { where: { commandIdempotencyKey: idempotencyKey } },
      );
    if (existingCommand) {
      if (existingCommand.candidateId !== input.candidateId) {
        throw new ConflictException(
          'Application idempotency key was used for a different candidate',
        );
      }
      const candidate = await this.getCandidate(input.candidateId);
      if (existingCommand.status === DiagnosisEducationCandidateApplicationStatus.SUCCESS) {
        return candidate;
      }
      if (existingCommand.status === DiagnosisEducationCandidateApplicationStatus.CONFLICT) {
        throw new ConflictException(
          existingCommand.conflictReason ?? EDUCATION_CANDIDATE_STALE_MESSAGE,
        );
      }
    }

    let result: { candidateId: string; conflict: string | null };
    try {
      result = await this.prisma.$transaction(async (tx) => {
        const command =
          await tx.diagnosisEducationCandidateApplicationCommand.create({
          data: {
            candidateId: input.candidateId,
            commandAction: 'APPLY_DIAGNOSIS_EDUCATION_CANDIDATE',
            commandIdempotencyKey: idempotencyKey,
            commandFingerprint: this.hash({
              candidateId: input.candidateId,
              idempotencyKey,
            }),
            actorUserId: input.actorUserId,
            authorityRationale: rationale,
            authorityReferences: this.optionalJson(
              input.authorityReferences ?? [],
            ),
            status: DiagnosisEducationCandidateApplicationStatus.PENDING,
          },
        });

        const candidate =
          await tx.diagnosisEducationCandidate.findUnique({
          where: { id: input.candidateId },
        });
      if (!candidate) {
        throw new NotFoundException('Diagnosis education candidate not found');
      }
      if (candidate.reviewStatus === DiagnosisEducationCandidateStatus.APPLIED) {
        await this.markCommandSuccess(tx, command.id, candidate);
        return { candidateId: candidate.id, conflict: null as string | null };
      }
      if (
        candidate.reviewStatus !== DiagnosisEducationCandidateStatus.ACCEPTED ||
        candidate.supersededByCandidateId
      ) {
        const conflict =
          'Only accepted, non-superseded Education candidates can be applied';
        await this.markCommandConflict(tx, command.id, candidate.id, conflict);
        return { candidateId: candidate.id, conflict };
      }

      const claimed = await tx.diagnosisEducationCandidate.updateMany({
        where: {
          id: candidate.id,
          reviewStatus: DiagnosisEducationCandidateStatus.ACCEPTED,
          applicationStatus: {
            in: [
              DiagnosisEducationCandidateApplicationStatus.NOT_REQUESTED,
              DiagnosisEducationCandidateApplicationStatus.CONFLICT,
            ],
          },
        },
        data: {
          applicationStatus:
            DiagnosisEducationCandidateApplicationStatus.PENDING,
        },
      });
      if (claimed.count !== 1) {
        const current = await tx.diagnosisEducationCandidate.findUnique({
          where: { id: candidate.id },
        });
        if (
          current?.reviewStatus === DiagnosisEducationCandidateStatus.APPLIED
        ) {
          await this.markCommandSuccess(tx, command.id, current);
          return { candidateId: candidate.id, conflict: null };
        }
        const conflict =
          'Diagnosis education candidate application is already in progress';
        await this.markCommandConflict(tx, command.id, candidate.id, conflict);
        return { candidateId: candidate.id, conflict };
      }

      const currentEducation = await tx.diagnosisEducation.findUnique({
        where: { diagnosisRegistryId: candidate.diagnosisRegistryId },
      });
      const staleConflict = this.staleApplicationReason(
        candidate,
        currentEducation,
      );
      if (staleConflict) {
        await this.markCommandConflict(
          tx,
          command.id,
          candidate.id,
          staleConflict,
        );
        return { candidateId: candidate.id, conflict: staleConflict };
      }

      const saved = await this.applyMaterial(tx, candidate, currentEducation);
      const revision = await tx.diagnosisEducationRevision.create({
        data: {
          educationId: saved.id,
          version: saved.version,
          editorialStatus: saved.editorialStatus,
          source: saved.source,
          createdByUserId: input.actorUserId,
          snapshot: this.toRevisionSnapshot(saved),
        },
      });

      await tx.diagnosisEducationCandidate.update({
        where: { id: candidate.id },
        data: {
          reviewStatus: DiagnosisEducationCandidateStatus.APPLIED,
          applicationStatus:
            DiagnosisEducationCandidateApplicationStatus.SUCCESS,
          appliedAt: new Date(),
          appliedByUserId: input.actorUserId,
          resultingEducationId: saved.id,
          resultingEducationVersion: saved.version,
          resultingRevisionId: revision.id,
          applicationFailureReason: null,
        },
      });
      await tx.diagnosisEducationCandidateApplicationCommand.update({
        where: { id: command.id },
        data: {
          status: DiagnosisEducationCandidateApplicationStatus.SUCCESS,
          resultEducationId: saved.id,
          resultEducationVersion: saved.version,
          resultRevisionId: revision.id,
          completedAt: new Date(),
        },
      });

        return { candidateId: candidate.id, conflict: null };
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        return this.resolveExistingApplicationCommand(
          input.candidateId,
          idempotencyKey,
        );
      }
      throw error;
    }

    if (result.conflict) {
      throw new ConflictException(result.conflict);
    }

    const applied = await this.getCandidate(result.candidateId);
    if (applied.resultingEducationId) {
      await this.differentialMappingService
        ?.mapEducation(applied.resultingEducationId)
        .catch(() => undefined);
      await this.reasoningDraftValidationService?.runAfterGeneration({
        artifactType: 'EDUCATION',
        artifactId: applied.resultingEducationId,
      });
    }
    return applied;
  }

  private async resolveExistingApplicationCommand(
    candidateId: string,
    idempotencyKey: string,
  ) {
    const existingCommand =
      await this.prisma.diagnosisEducationCandidateApplicationCommand.findUnique(
        { where: { commandIdempotencyKey: idempotencyKey } },
      );
    if (!existingCommand || existingCommand.candidateId !== candidateId) {
      throw new ConflictException(
        'Application idempotency key was used for a different candidate',
      );
    }
    const candidate = await this.getCandidate(candidateId);
    if (
      existingCommand.status ===
      DiagnosisEducationCandidateApplicationStatus.SUCCESS
    ) {
      return candidate;
    }
    if (
      existingCommand.status ===
      DiagnosisEducationCandidateApplicationStatus.CONFLICT
    ) {
      throw new ConflictException(
        existingCommand.conflictReason ?? EDUCATION_CANDIDATE_STALE_MESSAGE,
      );
    }
    throw new ConflictException(
      'Diagnosis education candidate application is already in progress',
    );
  }

  private async supersedeOpenCandidates(
    tx: Prisma.TransactionClient,
    candidate: DiagnosisEducationCandidate,
  ) {
    await tx.diagnosisEducationCandidate.updateMany({
      where: {
        id: { not: candidate.id },
        diagnosisRegistryId: candidate.diagnosisRegistryId,
        scope: candidate.scope,
        section: candidate.section,
        reviewStatus: {
          in: [
            DiagnosisEducationCandidateStatus.PENDING_REVIEW,
            DiagnosisEducationCandidateStatus.NEEDS_CHANGES,
          ],
        },
        applicationStatus:
          DiagnosisEducationCandidateApplicationStatus.NOT_REQUESTED,
      },
      data: {
        reviewStatus: DiagnosisEducationCandidateStatus.SUPERSEDED,
        supersededByCandidateId: candidate.id,
      },
    });
  }

  private staleApplicationReason(
    candidate: DiagnosisEducationCandidate,
    currentEducation: DiagnosisEducation | null,
  ): string | null {
    if (candidate.baseEducationVersion === null) {
      return currentEducation
        ? 'Education now exists; candidate was generated before initial Education creation.'
        : null;
    }
    if (!currentEducation || currentEducation.id !== candidate.educationId) {
      return 'Candidate target Education no longer matches current Education.';
    }
    if (currentEducation.version !== candidate.baseEducationVersion) {
      return EDUCATION_CANDIDATE_STALE_MESSAGE;
    }
    return null;
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    );
  }

  private async applyMaterial(
    tx: Prisma.TransactionClient,
    candidate: DiagnosisEducationCandidate,
    currentEducation: DiagnosisEducation | null,
  ) {
    if (candidate.scope === DiagnosisEducationCandidateScope.WHOLE) {
      const material = this.asEducationMaterial(candidate.proposedEducation);
      if (!currentEducation) {
        const registry = await tx.diagnosisRegistry.findUnique({
          where: { id: candidate.diagnosisRegistryId },
          select: { displayLabel: true, canonicalName: true },
        });
        return tx.diagnosisEducation.create({
          data: {
            diagnosisRegistryId: candidate.diagnosisRegistryId,
            title: this.titleFromMaterial(
              material,
              registry?.displayLabel ?? registry?.canonicalName ?? 'Diagnosis education',
            ),
            ...material,
            editorialStatus: DiagnosisEducationStatus.NEEDS_REVIEW,
            source: DiagnosisEducationSource.AI_ASSISTED,
            version: 1,
            generatedAt: candidate.generatedAt,
            reviewedAt: null,
            reviewedByUserId: null,
            publishedAt: null,
          },
        });
      }

      const result = await tx.diagnosisEducation.updateMany({
        where: {
          id: currentEducation.id,
          version: currentEducation.version,
        },
        data: {
          title: this.titleFromMaterial(material, currentEducation.title),
          ...material,
          editorialStatus: DiagnosisEducationStatus.NEEDS_REVIEW,
          source: DiagnosisEducationSource.AI_ASSISTED,
          version: { increment: 1 },
          generatedAt: candidate.generatedAt,
          reviewedAt: null,
          reviewedByUserId: null,
          publishedAt: null,
        },
      });
      if (result.count !== 1) {
        throw new ConflictException(EDUCATION_CANDIDATE_STALE_MESSAGE);
      }
      return tx.diagnosisEducation.findUniqueOrThrow({
        where: { id: currentEducation.id },
      });
    }

    if (!currentEducation || !candidate.section) {
      throw new ConflictException('Section candidate target Education is missing');
    }
    const section = candidate.section as EducationRegenerableSection;
    const result = await tx.diagnosisEducation.updateMany({
      where: {
        id: currentEducation.id,
        version: currentEducation.version,
      },
      data: {
        [section]: candidate.proposedSection as Prisma.InputJsonValue,
        references:
          candidate.proposedReferences === null
            ? this.nullableJson(currentEducation.references)
            : this.nullableJson(candidate.proposedReferences),
        editorialStatus: DiagnosisEducationStatus.NEEDS_REVIEW,
        source: DiagnosisEducationSource.AI_ASSISTED,
        version: { increment: 1 },
        generatedAt: candidate.generatedAt,
        reviewedAt: null,
        reviewedByUserId: null,
        publishedAt: null,
      },
    });
    if (result.count !== 1) {
      throw new ConflictException(EDUCATION_CANDIDATE_STALE_MESSAGE);
    }
    return tx.diagnosisEducation.findUniqueOrThrow({
      where: { id: currentEducation.id },
    });
  }

  private async markCommandSuccess(
    tx: Prisma.TransactionClient,
    commandId: string,
    candidate: DiagnosisEducationCandidate,
  ) {
    await tx.diagnosisEducationCandidateApplicationCommand.update({
      where: { id: commandId },
      data: {
        status: DiagnosisEducationCandidateApplicationStatus.SUCCESS,
        resultEducationId: candidate.resultingEducationId,
        resultEducationVersion: candidate.resultingEducationVersion,
        resultRevisionId: candidate.resultingRevisionId,
        completedAt: new Date(),
      },
    });
  }

  private async markCommandConflict(
    tx: Prisma.TransactionClient,
    commandId: string,
    candidateId: string,
    conflict: string,
  ) {
    await tx.diagnosisEducationCandidate.update({
      where: { id: candidateId },
      data: {
        applicationStatus:
          DiagnosisEducationCandidateApplicationStatus.CONFLICT,
        applicationFailureReason: conflict,
      },
    });
    await tx.diagnosisEducationCandidateApplicationCommand.update({
      where: { id: commandId },
      data: {
        status: DiagnosisEducationCandidateApplicationStatus.CONFLICT,
        conflictReason: conflict,
        completedAt: new Date(),
      },
    });
  }

  private asEducationMaterial(value: Prisma.JsonValue | null): EducationMaterial {
    if (!this.isObject(value)) {
      throw new BadRequestException('Whole Education candidate is missing material');
    }
    const material: Partial<EducationMaterial> = {};
    for (const field of EDUCATION_JSON_FIELDS) {
      if (value[field] !== undefined && value[field] !== null) {
        material[field] = value[field] as Prisma.InputJsonValue;
      }
    }
    if (!material.summary) {
      throw new BadRequestException('Whole Education candidate is missing summary');
    }
    return material as EducationMaterial;
  }

  private titleFromMaterial(
    material: Partial<EducationMaterial>,
    fallback = 'Diagnosis education',
  ) {
    const summary = material.summary;
    const summaryRecord = this.isObject(summary)
      ? (summary as Record<string, unknown>)
      : null;
    if (typeof summaryRecord?.title === 'string') {
      return summaryRecord.title.trim() || fallback;
    }
    return fallback;
  }

  private validationOutcome(blockers: string[]) {
    return blockers.length ? ValidationOutcome.FAILED : ValidationOutcome.PASSED;
  }

  private candidateInclude() {
    return {
      latestReviewDecision: true,
      reviewDecisions: { orderBy: { decidedAt: 'desc' } },
      applicationCommands: { orderBy: { createdAt: 'desc' } },
    } satisfies Prisma.DiagnosisEducationCandidateInclude;
  }

  private hash(value: unknown) {
    return createHash('sha256')
      .update(JSON.stringify(value ?? null))
      .digest('hex');
  }

  private json(value: unknown): Prisma.InputJsonValue {
    return (value ?? {}) as Prisma.InputJsonValue;
  }

  private optionalJson(value: unknown): Prisma.InputJsonValue | undefined {
    return value === undefined || value === null
      ? undefined
      : (value as Prisma.InputJsonValue);
  }

  private nullableJson(
    value: Prisma.JsonValue | null,
  ): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
  }

  private toRevisionSnapshot(education: DiagnosisEducation): Prisma.InputJsonObject {
    return {
      title: education.title,
      summary: education.summary,
      clinicalPattern: this.snapshotJson(education.clinicalPattern),
      keySymptoms: this.snapshotJson(education.keySymptoms),
      keySigns: this.snapshotJson(education.keySigns),
      examPearls: this.snapshotJson(education.examPearls),
      scoringSystems: this.snapshotJson(education.scoringSystems),
      investigations: this.snapshotJson(education.investigations),
      differentials: this.snapshotJson(education.differentials),
      management: this.snapshotJson(education.management),
      complications: this.snapshotJson(education.complications),
      pitfalls: this.snapshotJson(education.pitfalls),
      recallPrompts: this.snapshotJson(education.recallPrompts),
      references: this.snapshotJson(education.references),
      editorialStatus: education.editorialStatus,
      source: education.source,
      reviewedAt: education.reviewedAt?.toISOString() ?? null,
      reviewedByUserId: education.reviewedByUserId,
      publishedAt: education.publishedAt?.toISOString() ?? null,
    };
  }

  private snapshotJson(value: Prisma.JsonValue | null) {
    return value === null ? null : (value as Prisma.InputJsonValue);
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}

export type DiagnosisEducationCandidateDto = CandidateWithHistory;
