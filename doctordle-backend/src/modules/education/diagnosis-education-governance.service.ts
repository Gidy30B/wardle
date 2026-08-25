import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  DiagnosisEducationPublicationStanding,
  DiagnosisEducationRevisionApprovalOutcome,
  DiagnosisEducationRevisionApprovalStanding,
  DiagnosisEducationStatus,
  Prisma,
  type DiagnosisEducation,
  type DiagnosisEducationRevision,
  type PrismaClient,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { stableStringify } from '../editorial-governance/governed-command/index';
import { DiagnosisGraphExtractionService } from '../diagnosis-graph/diagnosis-graph-extraction.service';

type GovernanceClient = Prisma.TransactionClient | PrismaClient | PrismaService;

export type EducationPublicationReadiness = {
  educationId: string;
  diagnosisRegistryId: string;
  educationRevisionId: string;
  version: number;
  result: 'READY' | 'BLOCKED' | 'STALE';
  blockers: Array<{ code: string; message: string }>;
  warnings: Array<{ code: string; message: string }>;
  approvalDecisionId: string | null;
  activePublicationDecisionId: string | null;
  currentEducationVersion: number;
  materialContextHash: string;
};

type RevisionWithEducation = DiagnosisEducationRevision & {
  education: DiagnosisEducation;
};

const APPROVE_ACTION = 'educationRevision.approve';
const PUBLICATION_ACTION = 'educationPublication.authorizeRevision';
const WITHDRAW_ACTION = 'educationPublication.withdraw';
const PUBLICATION_CHANNEL = 'LEARNER';

@Injectable()
export class DiagnosisEducationGovernanceService {
  private readonly logger = new Logger(DiagnosisEducationGovernanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly diagnosisGraphExtractionService?: DiagnosisGraphExtractionService,
  ) {}

  async getPublicationReadiness(educationId: string, revisionId: string) {
    return this.computePublicationReadiness(this.prisma, {
      educationId,
      revisionId,
    });
  }

  async getCurrentRevisionTarget(educationId: string, expectedVersion: number) {
    const education = await this.prisma.diagnosisEducation.findUnique({
      where: { id: educationId },
      include: {
        revisions: {
          where: { version: expectedVersion },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 1,
        },
      },
    });
    if (!education) {
      throw new NotFoundException('Diagnosis education not found');
    }
    if (education.version !== expectedVersion) {
      throw new ConflictException(
        `Stale education governance command: expected version ${expectedVersion}, current version ${education.version}`,
      );
    }
    const revision = education.revisions[0];
    if (!revision) {
      throw new ConflictException(
        'Current Diagnosis Education version has no revision snapshot to govern',
      );
    }
    return {
      educationId: education.id,
      diagnosisRegistryId: education.diagnosisRegistryId,
      revisionId: revision.id,
      version: revision.version,
    };
  }

  async getStandingPublishedRevisionForDiagnosis(
    diagnosisRegistryId: string,
    client: GovernanceClient = this.prisma,
  ) {
    const canonical = await (
      client as any
    ).diagnosisEducationPublicationDecision.findFirst({
      where: {
        diagnosisRegistryId,
        publicationChannel: PUBLICATION_CHANNEL,
        standing: DiagnosisEducationPublicationStanding.AUTHORIZED,
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      include: {
        education: { include: { diagnosisRegistry: true } },
        educationRevision: true,
      },
    });

    if (canonical) {
      return {
        mode: 'CANONICAL' as const,
        publicationDecision: canonical,
        education: canonical.education,
        revision: canonical.educationRevision,
      };
    }

    const legacy = await client.diagnosisEducation.findFirst({
      where: {
        diagnosisRegistryId,
        editorialStatus: DiagnosisEducationStatus.PUBLISHED,
      },
      orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
      include: {
        diagnosisRegistry: true,
        revisions: {
          where: { editorialStatus: DiagnosisEducationStatus.PUBLISHED },
          orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
          take: 1,
        },
      },
    });

    if (legacy?.revisions[0]) {
      return {
        mode: 'LEGACY_COMPATIBILITY' as const,
        publicationDecision: null,
        education: legacy,
        revision: legacy.revisions[0],
      };
    }

    return null;
  }

  async getStandingPublishedRevisionForEducation(
    educationId: string,
    client: GovernanceClient = this.prisma,
  ) {
    const education = await client.diagnosisEducation.findUnique({
      where: { id: educationId },
      select: { diagnosisRegistryId: true },
    });
    if (!education) {
      return null;
    }
    return this.getStandingPublishedRevisionForDiagnosis(
      education.diagnosisRegistryId,
      client,
    );
  }

  async decideRevision(input: {
    educationId: string;
    revisionId: string;
    expectedVersion: number;
    outcome: DiagnosisEducationRevisionApprovalOutcome;
    idempotencyKey: string;
    rationale: string;
    authorityReferences?: string[];
    actorUserId: string;
  }) {
    this.assertCommandInput(input.idempotencyKey, input.rationale);
    const commandFingerprint = this.commandFingerprint({
      action: APPROVE_ACTION,
      educationId: input.educationId,
      revisionId: input.revisionId,
      expectedVersion: input.expectedVersion,
      outcome: input.outcome,
      actorUserId: input.actorUserId,
    });

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await (
          tx as any
        ).diagnosisEducationRevisionApprovalDecision.findUnique({
          where: { commandIdempotencyKey: input.idempotencyKey },
        });
        if (existing) {
          if (existing.commandFingerprint !== commandFingerprint) {
            throw new ConflictException(
              'Education approval idempotency key was used for a different command',
            );
          }
          return existing;
        }

        const revision = await this.getOrCreateCurrentRevision(tx, {
          educationId: input.educationId,
          revisionId: input.revisionId,
          expectedVersion: input.expectedVersion,
          actorUserId: input.actorUserId,
        });
        const education = revision.education;

        if (education.version !== input.expectedVersion) {
          throw new ConflictException(
            `Stale education approval: expected version ${input.expectedVersion}, current version ${education.version}`,
          );
        }

        const materialContextHash = this.materialHash(revision.snapshot);
        const supersededStanding =
          input.outcome === DiagnosisEducationRevisionApprovalOutcome.APPROVED
            ? await (
                tx as any
              ).diagnosisEducationRevisionApprovalDecision.findFirst({
                where: {
                  educationId: education.id,
                  outcome: DiagnosisEducationRevisionApprovalOutcome.APPROVED,
                  standing:
                    DiagnosisEducationRevisionApprovalStanding.STANDING,
                },
                orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
              })
            : null;

        if (supersededStanding) {
          await (
            tx as any
          ).diagnosisEducationRevisionApprovalDecision.update({
            where: { id: supersededStanding.id },
            data: {
              standing: DiagnosisEducationRevisionApprovalStanding.SUPERSEDED,
              standingReason: `Superseded by ${APPROVE_ACTION} for revision ${revision.id}`,
              supersededAt: new Date(),
            },
          });
        }

        const now = new Date();
        const projectionStatus = this.projectionStatusForOutcome(input.outcome);
        const decision = await (
          tx as any
        ).diagnosisEducationRevisionApprovalDecision.create({
          data: {
            commandAction: APPROVE_ACTION,
            commandIdempotencyKey: input.idempotencyKey,
            commandFingerprint,
            educationId: education.id,
            diagnosisRegistryId: education.diagnosisRegistryId,
            educationRevisionId: revision.id,
            version: revision.version,
            outcome: input.outcome,
            standing:
              input.outcome === DiagnosisEducationRevisionApprovalOutcome.APPROVED
                ? DiagnosisEducationRevisionApprovalStanding.STANDING
                : DiagnosisEducationRevisionApprovalStanding.NON_STANDING,
            standingReason:
              input.outcome === DiagnosisEducationRevisionApprovalOutcome.APPROVED
                ? 'Current standing approved Education revision.'
                : 'Non-approval outcome; no approval standing conferred.',
            actorUserId: input.actorUserId,
            authorityRationale: input.rationale,
            authorityReferences: (input.authorityReferences ?? []) as Prisma.InputJsonValue,
            materialContextHash,
            materialContextSnapshot: this.materialContext(revision),
            validationContextSnapshot: this.validationContext(revision),
            assessmentContextSnapshot: this.assessmentContext(
              revision,
              input.outcome,
            ),
            compatibilityProjection: {
              owner: APPROVE_ACTION,
              educationId: education.id,
              educationRevisionId: revision.id,
              version: revision.version,
              editorialStatus: projectionStatus,
            },
            supersedesDecisionId: supersededStanding?.id ?? null,
            occurredAt: now,
          },
        });

        await tx.diagnosisEducation.update({
          where: { id: education.id },
          data: {
            editorialStatus: projectionStatus,
            reviewedAt:
              input.outcome ===
              DiagnosisEducationRevisionApprovalOutcome.APPROVED
                ? now
                : education.reviewedAt,
            reviewedByUserId:
              input.outcome ===
              DiagnosisEducationRevisionApprovalOutcome.APPROVED
                ? input.actorUserId
                : education.reviewedByUserId,
            publishedAt: null,
          },
          select: { id: true },
        });
        await tx.diagnosisEducationRevision.update({
          where: { id: revision.id },
          data: { editorialStatus: projectionStatus },
          select: { id: true },
        });

        return decision;
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        const existing = await (
          this.prisma as any
        ).diagnosisEducationRevisionApprovalDecision.findUnique({
          where: { commandIdempotencyKey: input.idempotencyKey },
        });
        if (existing?.commandFingerprint === commandFingerprint) {
          return existing;
        }
      }
      throw error;
    }
  }

  async authorizePublication(input: {
    educationId: string;
    revisionId: string;
    expectedVersion: number;
    expectedApprovalDecisionId: string;
    expectedActivePublicationDecisionId?: string | null;
    idempotencyKey: string;
    rationale: string;
    authorityReferences?: string[];
    actorUserId: string;
  }) {
    this.assertCommandInput(input.idempotencyKey, input.rationale);
    const commandFingerprint = this.commandFingerprint({
      action: PUBLICATION_ACTION,
      educationId: input.educationId,
      revisionId: input.revisionId,
      expectedVersion: input.expectedVersion,
      expectedApprovalDecisionId: input.expectedApprovalDecisionId,
      expectedActivePublicationDecisionId:
        input.expectedActivePublicationDecisionId ?? null,
      actorUserId: input.actorUserId,
    });

    let publication: any;
    try {
      publication = await this.prisma.$transaction(async (tx) => {
        const existing = await (
          tx as any
        ).diagnosisEducationPublicationDecision.findUnique({
          where: { commandIdempotencyKey: input.idempotencyKey },
        });
        if (existing) {
          if (existing.commandFingerprint !== commandFingerprint) {
            throw new ConflictException(
              'Education publication idempotency key was used for a different command',
            );
          }
          return existing;
        }

        const readiness = await this.computePublicationReadiness(tx, {
          educationId: input.educationId,
          revisionId: input.revisionId,
        });
        if (readiness.currentEducationVersion !== input.expectedVersion) {
          throw new ConflictException(
            `Stale education publication: expected version ${input.expectedVersion}, current version ${readiness.currentEducationVersion}`,
          );
        }
        if (readiness.result !== 'READY') {
          throw new BadRequestException({
            message: 'Diagnosis education revision is not publication-ready',
            readiness,
          });
        }
        if (readiness.approvalDecisionId !== input.expectedApprovalDecisionId) {
          throw new ConflictException(
            'Publication approval decision expectation is stale',
          );
        }
        if (
          (input.expectedActivePublicationDecisionId ?? null) !==
          readiness.activePublicationDecisionId
        ) {
          throw new ConflictException(
            'Active Education publication expectation is stale',
          );
        }

        if (readiness.activePublicationDecisionId) {
          await (
            tx as any
          ).diagnosisEducationPublicationDecision.update({
            where: { id: readiness.activePublicationDecisionId },
            data: {
              standing: DiagnosisEducationPublicationStanding.SUPERSEDED,
              standingReason: `Superseded by ${PUBLICATION_ACTION} for revision ${input.revisionId}`,
            },
          });
        }

        const revision = await this.getRevision(tx, {
          educationId: input.educationId,
          revisionId: input.revisionId,
        });
        const now = new Date();
        const created = await (
          tx as any
        ).diagnosisEducationPublicationDecision.create({
          data: {
            commandAction: PUBLICATION_ACTION,
            commandIdempotencyKey: input.idempotencyKey,
            commandFingerprint,
            educationId: readiness.educationId,
            diagnosisRegistryId: readiness.diagnosisRegistryId,
            educationRevisionId: readiness.educationRevisionId,
            version: readiness.version,
            approvalDecisionId: readiness.approvalDecisionId,
            expectedApprovalDecisionId: input.expectedApprovalDecisionId,
            expectedActivePublicationId:
              input.expectedActivePublicationDecisionId ?? null,
            actorUserId: input.actorUserId,
            authorityRationale: input.rationale,
            authorityReferences: (input.authorityReferences ?? []) as Prisma.InputJsonValue,
            publicationChannel: PUBLICATION_CHANNEL,
            readinessResult: readiness.result,
            readinessSnapshot: readiness as unknown as Prisma.InputJsonValue,
            materialContextHash: readiness.materialContextHash,
            materialContextSnapshot: this.materialContext(revision),
            standing: DiagnosisEducationPublicationStanding.AUTHORIZED,
            standingReason: 'Current standing published Diagnosis Education revision.',
            supersedesPublicationId:
              readiness.activePublicationDecisionId ?? null,
            compatibilityProjection: {
              owner: PUBLICATION_ACTION,
              educationId: readiness.educationId,
              educationRevisionId: readiness.educationRevisionId,
              version: readiness.version,
              editorialStatus: DiagnosisEducationStatus.PUBLISHED,
              publishedAt: now.toISOString(),
            },
            occurredAt: now,
            effectiveAt: now,
          },
        });

        await tx.diagnosisEducation.update({
          where: { id: readiness.educationId },
          data: {
            editorialStatus: DiagnosisEducationStatus.PUBLISHED,
            publishedAt: now,
            reviewedAt: now,
            reviewedByUserId: input.actorUserId,
          },
          select: { id: true },
        });
        await tx.diagnosisEducationRevision.update({
          where: { id: readiness.educationRevisionId },
          data: { editorialStatus: DiagnosisEducationStatus.PUBLISHED },
          select: { id: true },
        });

        return created;
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        const existing = await (
          this.prisma as any
        ).diagnosisEducationPublicationDecision.findUnique({
          where: { commandIdempotencyKey: input.idempotencyKey },
        });
        if (existing?.commandFingerprint === commandFingerprint) {
          return existing;
        }
      }
      throw error;
    }

    await this.diagnosisGraphExtractionService
      ?.extractFromPublishedEducationRevision(publication.educationRevisionId)
      .catch((error) => {
        this.logger.error(
          JSON.stringify({
            event: 'diagnosis_graph.education_revision_extraction.failed',
            educationRevisionId: publication.educationRevisionId,
            error: error instanceof Error ? error.message : String(error),
          }),
          error instanceof Error ? error.stack : undefined,
        );
      });

    return publication;
  }

  async withdrawPublication(input: {
    publicationDecisionId: string;
    rationale: string;
    actorUserId: string;
  }) {
    const rationale = input.rationale.trim();
    if (!rationale) {
      throw new BadRequestException('Withdrawal rationale is required');
    }
    const publication = await (
      this.prisma as any
    ).diagnosisEducationPublicationDecision.findUnique({
      where: { id: input.publicationDecisionId },
    });
    if (!publication) {
      throw new NotFoundException('Diagnosis education publication not found');
    }
    if (publication.standing !== DiagnosisEducationPublicationStanding.AUTHORIZED) {
      return publication;
    }
    return this.prisma.$transaction(async (tx) => {
      const withdrawn = await (
        tx as any
      ).diagnosisEducationPublicationDecision.update({
        where: { id: input.publicationDecisionId },
        data: {
          standing: DiagnosisEducationPublicationStanding.WITHDRAWN,
          standingReason: `Withdrawn by ${WITHDRAW_ACTION}`,
          withdrawnAt: new Date(),
          withdrawnByUserId: input.actorUserId,
          withdrawalRationale: rationale,
        },
      });
      await tx.diagnosisEducation.update({
        where: { id: publication.educationId },
        data: {
          editorialStatus: DiagnosisEducationStatus.APPROVED,
          publishedAt: null,
        },
        select: { id: true },
      });
      return withdrawn;
    });
  }

  async computePublicationReadiness(
    client: GovernanceClient,
    input: { educationId: string; revisionId: string },
  ): Promise<EducationPublicationReadiness> {
    const revision = await this.getRevision(client, input);
    const education = revision.education;
    const blockers: EducationPublicationReadiness['blockers'] = [];
    const warnings: EducationPublicationReadiness['warnings'] = [];
    const materialContextHash = this.materialHash(revision.snapshot);

    if (education.version !== revision.version) {
      blockers.push({
        code: 'STALE_REVISION',
        message: `Revision ${revision.version} is not current Education version ${education.version}.`,
      });
    }

    const approval = await (
      client as any
    ).diagnosisEducationRevisionApprovalDecision.findFirst({
      where: {
        educationId: education.id,
        educationRevisionId: revision.id,
        version: revision.version,
        outcome: DiagnosisEducationRevisionApprovalOutcome.APPROVED,
        standing: DiagnosisEducationRevisionApprovalStanding.STANDING,
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    });

    if (!approval) {
      blockers.push({
        code: 'MISSING_STANDING_APPROVAL_DECISION',
        message:
          'Revision lacks a standing exact-revision Education approval decision.',
      });
    } else if (approval.materialContextHash !== materialContextHash) {
      blockers.push({
        code: 'STALE_APPROVAL_MATERIAL_CONTEXT',
        message:
          'Standing approval was recorded against different revision material.',
      });
    }

    for (const blocker of this.publishBlockersForSnapshot(revision.snapshot)) {
      blockers.push({ code: blocker, message: blocker });
    }

    const activePublication = await (
      client as any
    ).diagnosisEducationPublicationDecision.findFirst({
      where: {
        educationId: education.id,
        publicationChannel: PUBLICATION_CHANNEL,
        standing: DiagnosisEducationPublicationStanding.AUTHORIZED,
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      select: { id: true, educationRevisionId: true },
    });

    return {
      educationId: education.id,
      diagnosisRegistryId: education.diagnosisRegistryId,
      educationRevisionId: revision.id,
      version: revision.version,
      result:
        blockers.some((blocker) => blocker.code === 'STALE_REVISION')
          ? 'STALE'
          : blockers.length
            ? 'BLOCKED'
            : 'READY',
      blockers,
      warnings,
      approvalDecisionId: approval?.id ?? null,
      activePublicationDecisionId: activePublication?.id ?? null,
      currentEducationVersion: education.version,
      materialContextHash,
    };
  }

  private async getOrCreateCurrentRevision(
    tx: Prisma.TransactionClient,
    input: {
      educationId: string;
      revisionId: string;
      expectedVersion: number;
      actorUserId: string;
    },
  ): Promise<RevisionWithEducation> {
    const education = await tx.diagnosisEducation.findUnique({
      where: { id: input.educationId },
    });
    if (!education) {
      throw new NotFoundException('Diagnosis education not found');
    }
    if (education.version !== input.expectedVersion) {
      throw new ConflictException(
        `Stale education approval: expected version ${input.expectedVersion}, current version ${education.version}`,
      );
    }
    const existing = await tx.diagnosisEducationRevision.findFirst({
      where: {
        id: input.revisionId,
        educationId: education.id,
        version: education.version,
      },
    });
    if (existing) {
      return { ...existing, education };
    }
    const revisionAtVersion = await tx.diagnosisEducationRevision.findUnique({
      where: {
        educationId_version: {
          educationId: education.id,
          version: education.version,
        },
      },
      select: { id: true },
    });
    if (revisionAtVersion && revisionAtVersion.id !== input.revisionId) {
      throw new ConflictException(
        'Education approval target revision does not match the current version revision',
      );
    }
    if (revisionAtVersion) {
      throw new ConflictException('Education approval target revision is stale');
    }
    const created = await tx.diagnosisEducationRevision.create({
      data: {
        id: input.revisionId,
        educationId: education.id,
        version: education.version,
        editorialStatus: education.editorialStatus,
        source: education.source,
        createdByUserId: input.actorUserId,
        snapshot: this.snapshotFromEducation(education),
      },
    });
    return { ...created, education };
  }

  private async getRevision(
    client: GovernanceClient,
    input: { educationId: string; revisionId: string },
  ): Promise<RevisionWithEducation> {
    const revision = await client.diagnosisEducationRevision.findFirst({
      where: { id: input.revisionId, educationId: input.educationId },
      include: { education: true },
    });
    if (!revision) {
      throw new NotFoundException('Diagnosis education revision not found');
    }
    return revision;
  }

  private projectionStatusForOutcome(
    outcome: DiagnosisEducationRevisionApprovalOutcome,
  ) {
    if (outcome === DiagnosisEducationRevisionApprovalOutcome.APPROVED) {
      return DiagnosisEducationStatus.APPROVED;
    }
    if (outcome === DiagnosisEducationRevisionApprovalOutcome.REJECTED) {
      return DiagnosisEducationStatus.REJECTED;
    }
    return DiagnosisEducationStatus.NEEDS_EDIT;
  }

  private assertCommandInput(idempotencyKey: string, rationale: string) {
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException('Command idempotency key is required');
    }
    if (!rationale?.trim()) {
      throw new BadRequestException('Authority rationale is required');
    }
  }

  private commandFingerprint(value: unknown) {
    return this.hash(stableStringify(value));
  }

  private materialHash(value: unknown) {
    return this.hash(stableStringify(value));
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private materialContext(revision: DiagnosisEducationRevision) {
    return {
      educationRevisionId: revision.id,
      educationId: revision.educationId,
      version: revision.version,
      snapshotHash: this.materialHash(revision.snapshot),
      snapshot: revision.snapshot,
    } as Prisma.InputJsonObject;
  }

  private validationContext(revision: DiagnosisEducationRevision) {
    return {
      validationSource: 'snapshot_publish_blockers',
      blockers: this.publishBlockersForSnapshot(revision.snapshot),
    } as Prisma.InputJsonObject;
  }

  private assessmentContext(
    revision: DiagnosisEducationRevision,
    outcome: DiagnosisEducationRevisionApprovalOutcome,
  ) {
    return {
      action: APPROVE_ACTION,
      educationRevisionId: revision.id,
      version: revision.version,
      outcome,
    } as Prisma.InputJsonObject;
  }

  private publishBlockersForSnapshot(snapshot: Prisma.JsonValue) {
    const body = this.asRecord(snapshot);
    const blockers: string[] = [];
    const summary = this.asRecord(body.summary);
    const summaryText = String(summary.definition ?? body.summary ?? '').trim();
    if (!summaryText) {
      blockers.push('missing_summary');
    }
    const fullText = stableStringify(body);
    if (/\b\d+(?:\.\d+)?\s?(?:mg|mcg|g|units|iu|ml|mL)\b/i.test(fullText)) {
      blockers.push('contains_drug_dosing');
    }
    if (/\b(?:you should|your doctor|go to the emergency room)\b/i.test(fullText)) {
      blockers.push('contains_patient_specific_advice');
    }
    const hasHighRisk = Boolean(
      body.management || body.scoringSystems || body.investigations,
    );
    const references = Array.isArray(body.references) ? body.references : [];
    if (hasHighRisk && references.length === 0) {
      blockers.push('high_risk_sections_need_references');
    }
    return blockers;
  }

  private snapshotFromEducation(
    education: DiagnosisEducation,
  ): Prisma.InputJsonObject {
    return {
      title: education.title,
      summary: education.summary,
      clinicalPattern: education.clinicalPattern,
      keySymptoms: education.keySymptoms,
      keySigns: education.keySigns,
      examPearls: education.examPearls,
      scoringSystems: education.scoringSystems,
      investigations: education.investigations,
      differentials: education.differentials,
      management: education.management,
      complications: education.complications,
      pitfalls: education.pitfalls,
      recallPrompts: education.recallPrompts,
      references: education.references,
      editorialStatus: education.editorialStatus,
      source: education.source,
      reviewedAt: education.reviewedAt?.toISOString() ?? null,
      reviewedByUserId: education.reviewedByUserId,
      publishedAt: education.publishedAt?.toISOString() ?? null,
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
