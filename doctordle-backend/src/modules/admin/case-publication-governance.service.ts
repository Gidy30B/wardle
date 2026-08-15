import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  CaseEditorialStatus,
  CaseRevisionPublicationStanding,
  DiagnosisMappingStatus,
  Prisma,
  ValidationOutcome,
  type PrismaClient,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service.js';
import { CaseEligibilityPolicyService } from '../cases/case-eligibility-policy.service.js';
import { getCaseDiagnosisPublishReadiness } from '../editorial/policies/diagnosis-publish-readiness.policy.js';
import {
  resolveGovernedAuthority,
  type AuthorityTypeRegistry,
} from '../editorial-governance/authority-assignment/index.js';
import { stableStringify } from '../editorial-governance/governed-command/index.js';
import { buildCaseRevisionMaterialHash } from '../case-validation/case-revision-material.js';
import {
  APP008A_ACTION,
  APP008A_AUTHORITY_RECORD_ID,
  APP008A_AUTHORITY_TYPE,
  APP008A_AUTHORITY_TYPE_REGISTRY,
  createApp008aAuthorityTypeRegistry,
} from './app008a-authority-registry.js';
import { EditorialAuthorityAssignmentRepository } from './editorial-authority-assignment.repository.js';
import type { AuthorizeCaseRevisionPublicationDto } from './dto/authorize-case-revision-publication.dto.js';

type PublicationTransactionClient = Prisma.TransactionClient | PrismaClient;

type App008aUniqueConflictTarget =
  | 'commandIdempotencyKey'
  | 'activePublication'
  | 'serializableWriteConflict'
  | 'unknown';

export type PublicationReadinessConditionType =
  | 'CANONICAL_BLOCKER'
  | 'IMPLEMENTATION_BLOCKER'
  | 'WARNING'
  | 'DEFERRED_POLICY';

export type PublicationReadiness = {
  caseId: string;
  caseRevisionId: string;
  result: 'READY' | 'BLOCKED';
  blockers: Array<{
    code: string;
    type: PublicationReadinessConditionType;
    message: string;
  }>;
  warnings: Array<{
    code: string;
    type: PublicationReadinessConditionType;
    message: string;
  }>;
  publicationAuthorized: boolean;
  currentPublicationStanding: CaseRevisionPublicationStanding | null;
  activePublicationDecisionId: string | null;
  materialContextHash: string | null;
  validationRunId: string | null;
  approvalDecisionId: string | null;
  contentBoundaryClassification: {
    clinicallyMaterialExposureStable: string[];
    presentationalOrOrganizationalLiveOk: string[];
  };
};

const CASE_REVISION_PUBLICATION_SELECT = {
  id: true,
  caseId: true,
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
  diagnosisRegistryId: true,
  proposedDiagnosisText: true,
  diagnosisMappingStatus: true,
  diagnosisMappingMethod: true,
  diagnosisMappingConfidence: true,
  diagnosisEditorialNote: true,
} satisfies Prisma.CaseRevisionSelect;

@Injectable()
export class CasePublicationGovernanceService {
  private app008aPublicationTestHooks?: {
    beforeDecisionCreate?: () => Promise<void> | void;
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly caseEligibilityPolicy: CaseEligibilityPolicyService,
    @Inject(APP008A_AUTHORITY_TYPE_REGISTRY)
    private readonly publicationAuthorityTypeRegistry: AuthorityTypeRegistry = createApp008aAuthorityTypeRegistry(),
    private readonly editorialAuthorityAssignmentRepository: EditorialAuthorityAssignmentRepository = new EditorialAuthorityAssignmentRepository(),
  ) {}

  setApp008aPublicationTestHooksForTest(hooks?: {
    beforeDecisionCreate?: () => Promise<void> | void;
  }) {
    this.app008aPublicationTestHooks = hooks;
  }

  async getRevisionPublicationReadiness(caseId: string, revisionId: string) {
    return this.computeReadiness(this.prisma, { caseId, revisionId });
  }

  async getRevisionPublicationStanding(caseId: string, revisionId: string) {
    await this.assertCaseRevisionExists(caseId, revisionId);
    const [activePublicationDecision, history] = await Promise.all([
      (this.prisma as any).caseRevisionPublicationDecision.findFirst({
        where: {
          caseId,
          caseRevisionId: revisionId,
          standing: CaseRevisionPublicationStanding.AUTHORIZED,
        },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      }),
      (this.prisma as any).caseRevisionPublicationDecision.findMany({
        where: { caseId, caseRevisionId: revisionId },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      }),
    ]);

    return {
      publicationAuthorized: Boolean(activePublicationDecision),
      currentPublicationStanding:
        activePublicationDecision?.standing ??
        (history[0]?.standing as CaseRevisionPublicationStanding | undefined) ??
        null,
      activePublicationDecisionId: activePublicationDecision?.id ?? null,
      history,
    };
  }

  async listCasePublicationHistory(caseId: string) {
    await this.assertCaseExists(caseId);
    return (this.prisma as any).caseRevisionPublicationDecision.findMany({
      where: { caseId },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    });
  }

  async authorizeRevisionPublication(
    caseId: string,
    revisionId: string,
    actorUserId: string,
    input: AuthorizeCaseRevisionPublicationDto,
  ) {
    try {
      return await this.prisma.$transaction(
        (tx) =>
          this.authorizeRevisionPublicationInTransaction(tx, {
            caseId,
            revisionId,
            actorUserId,
            input,
          }),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      const conflictTarget =
        this.getApp008aReplayEligibleUniqueConflict(error) ??
        (this.isPrismaSerializableConflict(error)
          ? 'serializableWriteConflict'
          : null);
      if (conflictTarget === null) throw error;

      return this.resolvePublicationReplayAfterRollback({
        caseId,
        revisionId,
        actorUserId,
        input,
        conflictTarget,
      });
    }
  }

  private async authorizeRevisionPublicationInTransaction(
    tx: Prisma.TransactionClient,
    command: {
      caseId: string;
      revisionId: string;
      actorUserId: string;
      input: AuthorizeCaseRevisionPublicationDto;
    },
  ) {
    this.requireCommandInput(command);
    const commandFingerprint = await this.buildPublicationCommandFingerprint(
      tx,
      command,
    );
    const priorCommand = await (
      tx as any
    ).caseRevisionPublicationCommand.findUnique({
      where: {
        commandIdempotencyKey: command.input.commandIdempotencyKey,
      },
      select: {
        commandFingerprint: true,
        resultPublicationDecisionId: true,
        status: true,
      },
    });
    if (priorCommand) {
      return this.resolvePriorPublicationCommand(tx, {
        command,
        commandFingerprint,
        priorCommand,
      });
    }

    const readiness = await this.computeReadiness(tx, {
      caseId: command.caseId,
      revisionId: command.revisionId,
      actorUserId: command.actorUserId,
      authorityAssignmentReferences:
        command.input.authorityAssignmentReferences,
    });
    if (readiness.result !== 'READY') {
      throw new BadRequestException(
        `Case revision publication is blocked: ${readiness.blockers
          .map((blocker) => blocker.code)
          .join(', ')}`,
      );
    }
    if (command.input.expectedRevisionId !== command.revisionId) {
      throw new ConflictException(
        'Stale publication command: expected revision does not match target revision',
      );
    }
    if (
      command.input.expectedApprovalDecisionId !== readiness.approvalDecisionId
    ) {
      throw new ConflictException(
        'Stale publication command: expected approval decision does not match active approval evidence',
      );
    }
    if (
      command.input.expectedMaterialContextHash !==
      readiness.materialContextHash
    ) {
      throw new ConflictException(
        'Stale publication command: material context hash does not match target revision',
      );
    }
    if (
      command.input.expectedValidationRunId &&
      command.input.expectedValidationRunId !== readiness.validationRunId
    ) {
      throw new ConflictException(
        'Stale publication command: expected validation run does not match readiness basis',
      );
    }

    const activePublication = await (
      tx as any
    ).caseRevisionPublicationDecision.findFirst({
      where: {
        caseId: command.caseId,
        standing: CaseRevisionPublicationStanding.AUTHORIZED,
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      select: { id: true, caseRevisionId: true },
    });
    const expectedActive = this.normalizeOptionalString(
      command.input.expectedActivePublicationDecisionId ?? undefined,
    );
    if (activePublication && expectedActive !== activePublication.id) {
      throw new ConflictException(
        'Stale publication command: active publication decision changed',
      );
    }
    if (!activePublication && expectedActive) {
      throw new ConflictException(
        'Stale publication command: expected active publication decision is missing',
      );
    }

    const actor = await tx.user.findUnique({
      where: { id: command.actorUserId },
      select: { id: true },
    });
    if (!actor) {
      throw new BadRequestException('Missing publication actor');
    }
    const authority = await this.resolvePublicationAuthority(tx, {
      actorUserId: actor.id,
      revisionId: command.revisionId,
      caseId: command.caseId,
      idempotencyKey: command.input.commandIdempotencyKey,
      authorityAssignmentReferences:
        command.input.authorityAssignmentReferences,
    });

    if (!authority.authorized) {
      throw new BadRequestException(
        'Missing editorial publication authority for AUTHORIZE_CASE_REVISION_PUBLICATION',
      );
    }

    await this.app008aPublicationTestHooks?.beforeDecisionCreate?.();

    await (tx as any).caseRevisionPublicationCommand.create({
      data: {
        commandAction: APP008A_ACTION,
        commandIdempotencyKey: command.input.commandIdempotencyKey,
        commandFingerprint,
        caseId: command.caseId,
        expectedRevisionId: command.input.expectedRevisionId,
        expectedApprovalDecisionId: command.input.expectedApprovalDecisionId,
        status: 'PENDING',
      },
    });

    if (activePublication) {
      await (tx as any).caseRevisionPublicationDecision.update({
        where: { id: activePublication.id },
        data: {
          standing: CaseRevisionPublicationStanding.SUPERSEDED,
          standingReason: `Superseded by APP-008A publication of revision ${command.revisionId}`,
        },
      });
    }

    const decidedAt = new Date();
    const decisionId = randomUUID();
    const compatibilityProjection = {
      owner: APP008A_ACTION,
      caseId: command.caseId,
      fields: ['Case.editorialStatus', 'Case.publishedAt'],
      editorialStatus: CaseEditorialStatus.PUBLISHED,
      publishedAt: decidedAt.toISOString(),
    };
    const contentBoundarySnapshot = await this.buildContentBoundarySnapshot(
      tx,
      {
        caseId: command.caseId,
        revisionId: command.revisionId,
      },
    );
    const rationale =
      this.normalizeOptionalString(command.input.rationale) ??
      'Case revision publication authorized through governed APP-008A command.';

    const publicationDecision = await (
      tx as any
    ).caseRevisionPublicationDecision.create({
      data: {
        id: decisionId,
        commandAction: APP008A_ACTION,
        commandIdempotencyKey: command.input.commandIdempotencyKey,
        commandFingerprint,
        caseId: command.caseId,
        caseRevisionId: command.revisionId,
        expectedRevisionId: command.input.expectedRevisionId,
        approvalDecisionId: readiness.approvalDecisionId,
        expectedApprovalDecisionId: command.input.expectedApprovalDecisionId,
        materialContextHash: readiness.materialContextHash,
        expectedMaterialContextHash: command.input.expectedMaterialContextHash,
        validationRunId: readiness.validationRunId,
        expectedValidationRunId: command.input.expectedValidationRunId ?? null,
        reviewContextIdentity:
          (readiness as { reviewContextIdentity?: string | null })
            .reviewContextIdentity ?? null,
        actorUserId: command.actorUserId,
        approvalRecordId: APP008A_AUTHORITY_RECORD_ID,
        authorityAssignmentId: authority.evidence!.authorityAssignmentId,
        authorityEvidenceReference:
          authority.evidence!.authorityEvidenceReference,
        authorityScopeSnapshot: authority.evidence!.authorityScopeSnapshot,
        authorityResolvedAt: authority.evidence!.authorityResolvedAt,
        readinessResult: readiness.result,
        readinessSnapshot: readiness as unknown as Prisma.InputJsonValue,
        contentBoundarySnapshot,
        standing: CaseRevisionPublicationStanding.AUTHORIZED,
        supersedesPublicationId: activePublication?.id ?? null,
        decisionType: APP008A_ACTION,
        outcome: 'AUTHORIZED',
        effectiveAction: APP008A_ACTION,
        rationale,
        findings: [
          ...readiness.warnings.map((warning) => warning.code),
        ] as Prisma.InputJsonValue,
        compatibilityProjection,
        occurredAt: decidedAt,
        effectiveAt: decidedAt,
      },
    });

    await tx.case.update({
      where: { id: command.caseId },
      data: {
        editorialStatus: CaseEditorialStatus.PUBLISHED,
        publishedAt: decidedAt,
      },
      select: { id: true },
    });

    await (tx as any).caseRevisionPublicationCommand.update({
      where: { commandIdempotencyKey: command.input.commandIdempotencyKey },
      data: {
        status: 'SUCCESS',
        resultPublicationDecisionId: publicationDecision.id,
        completedAt: new Date(),
      },
    });

    return publicationDecision;
  }

  private async computeReadiness(
    client: PublicationTransactionClient,
    input: {
      caseId: string;
      revisionId: string;
      actorUserId?: string;
      authorityAssignmentReferences?: string[];
    },
  ): Promise<PublicationReadiness & { reviewContextIdentity?: string | null }> {
    const blockers: PublicationReadiness['blockers'] = [];
    const warnings: PublicationReadiness['warnings'] = [];
    const caseRecord = await client.case.findUnique({
      where: { id: input.caseId },
      select: {
        id: true,
        currentRevisionId: true,
        editorialStatus: true,
        diagnosisRegistryId: true,
        diagnosisMappingStatus: true,
        diagnosisRegistry: {
          select: {
            id: true,
            status: true,
            active: true,
            isPlayable: true,
          },
        },
      },
    });
    const revision = await client.caseRevision.findFirst({
      where: { id: input.revisionId, caseId: input.caseId },
      select: {
        ...CASE_REVISION_PUBLICATION_SELECT,
        contentHash: true,
      },
    });

    if (!caseRecord) {
      throw new NotFoundException(`Case not found: ${input.caseId}`);
    }
    if (!revision) {
      throw new NotFoundException(
        `Case revision not found: ${input.revisionId}`,
      );
    }
    if (caseRecord.currentRevisionId !== input.revisionId) {
      blockers.push({
        code: 'REVISION_IS_NOT_CURRENT',
        type: 'CANONICAL_BLOCKER',
        message:
          'Publication must target the current CaseRevision for the Case.',
      });
    }

    const materialContextHash = buildCaseRevisionMaterialHash({
      ...revision,
      diagnosisRegistryId: revision.diagnosisRegistryId ?? '',
    });
    const approvalDecision = await (
      client as any
    ).governedCaseRevisionApprovalDecision.findFirst({
      where: {
        caseId: input.caseId,
        targetRevisionId: input.revisionId,
        outcome: 'APPROVED',
        effectiveAction: 'APPROVE_CASE_REVISION',
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        targetRevisionId: true,
        reviewBasis: true,
        occurredAt: true,
      },
    });
    if (!approvalDecision) {
      blockers.push({
        code: 'APP006_APPROVAL_REQUIRED',
        type: 'CANONICAL_BLOCKER',
        message: 'Exact APP-006 CaseRevision approval is required.',
      });
    } else if (
      this.getApprovalMaterialContextHash(approvalDecision.reviewBasis) !==
      materialContextHash
    ) {
      blockers.push({
        code: 'APP006_APPROVAL_MATERIAL_CONTEXT_MISMATCH',
        type: 'CANONICAL_BLOCKER',
        message:
          'APP-006 approval material context no longer matches the revision.',
      });
    }

    const validationRun = await client.caseValidationRun.findFirst({
      where: {
        caseId: input.caseId,
        revisionId: input.revisionId,
      },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        outcome: true,
        completedAt: true,
        materialContextHash: true,
        reviewContextIdentity: true,
      },
    });
    if (!validationRun || !validationRun.completedAt) {
      blockers.push({
        code: 'VALIDATION_REQUIRED',
        type: 'IMPLEMENTATION_BLOCKER',
        message:
          'A completed validation run is required for publication readiness.',
      });
    } else if (validationRun.outcome !== ValidationOutcome.PASSED) {
      blockers.push({
        code: 'VALIDATION_NOT_PASSED',
        type: 'IMPLEMENTATION_BLOCKER',
        message: 'The latest validation run did not pass.',
      });
    } else if (validationRun.materialContextHash !== materialContextHash) {
      blockers.push({
        code: 'VALIDATION_MATERIAL_CONTEXT_MISMATCH',
        type: 'IMPLEMENTATION_BLOCKER',
        message: 'Validation material context does not match the revision.',
      });
    }

    const diagnosisReadiness = getCaseDiagnosisPublishReadiness({
      diagnosisRegistryId: revision.diagnosisRegistryId,
      diagnosisMappingStatus: revision.diagnosisMappingStatus,
      diagnosisRegistryStatus: caseRecord.diagnosisRegistry?.status ?? null,
    });
    if (
      revision.diagnosisMappingStatus !== DiagnosisMappingStatus.MATCHED ||
      !diagnosisReadiness.ready
    ) {
      blockers.push({
        code: 'DIAGNOSIS_MAPPING_NOT_READY',
        type: 'CANONICAL_BLOCKER',
        message:
          diagnosisReadiness.reason ??
          'Diagnosis mapping must be resolved for publication.',
      });
    }
    if (
      !this.caseEligibilityPolicy.isRegistryPlayable(
        caseRecord.diagnosisRegistry,
      )
    ) {
      blockers.push({
        code: 'DIAGNOSIS_REGISTRY_NOT_PLAYABLE',
        type: 'IMPLEMENTATION_BLOCKER',
        message:
          'Diagnosis registry must be active and playable for current scheduler compatibility.',
      });
    }

    const clueValidation = this.caseEligibilityPolicy.validatePlayableClues(
      revision.clues,
      { caseId: input.caseId },
    );
    if (!clueValidation.valid) {
      blockers.push({
        code: 'CASE_CLUES_NOT_PLAYABLE',
        type: 'IMPLEMENTATION_BLOCKER',
        message: `Case clues are not publishable: ${clueValidation.reasons.join(', ')}`,
      });
    }

    const activePublication = await (
      client as any
    ).caseRevisionPublicationDecision.findFirst({
      where: {
        caseId: input.caseId,
        standing: CaseRevisionPublicationStanding.AUTHORIZED,
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      select: { id: true, standing: true, caseRevisionId: true },
    });
    if (
      activePublication &&
      activePublication.caseRevisionId === input.revisionId
    ) {
      warnings.push({
        code: 'REVISION_ALREADY_AUTHORIZED_FOR_PUBLICATION',
        type: 'WARNING',
        message:
          'This revision already has an active APP-008A publication decision.',
      });
    } else if (activePublication) {
      warnings.push({
        code: 'ACTIVE_PUBLICATION_REQUIRES_EXPECTED_SUPERSESSION',
        type: 'WARNING',
        message:
          'Another revision is actively published and must be named for supersession.',
      });
    }
    if (caseRecord.editorialStatus === CaseEditorialStatus.PUBLISHED) {
      warnings.push({
        code: 'LEGACY_PUBLISHED_STATUS_IS_PROJECTION_ONLY',
        type: 'WARNING',
        message:
          'Case PUBLISHED status is not canonical APP-008 publication authority.',
      });
    }
    if (caseRecord.editorialStatus !== CaseEditorialStatus.READY_TO_PUBLISH) {
      warnings.push({
        code: 'READY_TO_PUBLISH_NOT_CANONICAL_READINESS',
        type: 'WARNING',
        message:
          'READY_TO_PUBLISH is compatibility workflow state, not canonical readiness.',
      });
    }

    if (input.actorUserId) {
      const authority = await this.resolvePublicationAuthority(client, {
        actorUserId: input.actorUserId,
        revisionId: input.revisionId,
        caseId: input.caseId,
        idempotencyKey: `readiness:${input.caseId}:${input.revisionId}`,
        authorityAssignmentReferences: input.authorityAssignmentReferences,
      });
      if (!authority.authorized) {
        blockers.push({
          code: 'PUBLICATION_AUTHORITY_REQUIRED',
          type: 'CANONICAL_BLOCKER',
          message:
            'Publication authority could not be resolved for this actor.',
        });
      }
    }

    return {
      caseId: input.caseId,
      caseRevisionId: input.revisionId,
      result: blockers.length === 0 ? 'READY' : 'BLOCKED',
      blockers,
      warnings,
      publicationAuthorized: Boolean(
        activePublication &&
        activePublication.caseRevisionId === input.revisionId &&
        activePublication.standing ===
          CaseRevisionPublicationStanding.AUTHORIZED,
      ),
      currentPublicationStanding: activePublication?.standing ?? null,
      activePublicationDecisionId: activePublication?.id ?? null,
      materialContextHash,
      validationRunId: validationRun?.id ?? null,
      reviewContextIdentity: validationRun?.reviewContextIdentity ?? null,
      approvalDecisionId: approvalDecision?.id ?? null,
      contentBoundaryClassification: {
        clinicallyMaterialExposureStable: [
          'CaseRevision.title',
          'CaseRevision.history',
          'CaseRevision.symptoms',
          'CaseRevision.labs',
          'CaseRevision.clues',
          'CaseRevision.explanation',
          'CaseRevision.differentials',
          'CaseRevision.proposedDiagnosisText',
          'CaseRevision.diagnosisRegistryId',
          'DiagnosisRegistry.canonicalName',
          'DiagnosisRegistry.displayLabel',
        ],
        presentationalOrOrganizationalLiveOk: [
          'DiagnosisRegistry.category',
          'DiagnosisRegistry.specialty',
          'DiagnosisRegistry.bodySystem',
        ],
      },
    };
  }

  private async resolvePublicationAuthority(
    client: PublicationTransactionClient,
    input: {
      actorUserId: string;
      caseId: string;
      revisionId: string;
      idempotencyKey: string;
      authorityAssignmentReferences?: string[];
    },
  ) {
    const authorityResolvedAt = new Date().toISOString();
    const assignments =
      await this.editorialAuthorityAssignmentRepository.loadCandidatesForApproval(
        client,
        {
          actorUserId: input.actorUserId,
          authorityType: APP008A_AUTHORITY_TYPE,
          decisionType: APP008A_ACTION,
          assignmentReferences: input.authorityAssignmentReferences,
        },
      );
    const resolution = resolveGovernedAuthority({
      actorContext: {
        actorType: 'USER',
        actorId: input.actorUserId,
        runtimeRoles: [],
        organizationContextIds: [],
        specialtyContextIds: [],
        authorityAssignmentReferences:
          input.authorityAssignmentReferences ?? [],
        correlationId: input.idempotencyKey,
        causationId: input.revisionId,
        requestedAt: authorityResolvedAt,
      },
      assignments,
      authorityTypeRegistry: this.publicationAuthorityTypeRegistry,
      request: {
        authorityType: APP008A_AUTHORITY_TYPE,
        decisionType: APP008A_ACTION,
        artifactType: 'CASE_REVISION',
        artifactId: input.caseId,
        artifactRevisionId: input.revisionId,
      },
      evaluatedAt: authorityResolvedAt,
      hasRequiredTechnicalAccess: true,
    });
    return {
      authorized:
        resolution.status === 'AUTHORIZED' &&
        Boolean(resolution.assignment) &&
        Boolean(resolution.od018AuthorityEvidence),
      assignment: resolution.assignment,
      evidence: resolution.od018AuthorityEvidence,
    };
  }

  private async buildPublicationCommandFingerprint(
    client: PublicationTransactionClient,
    command: {
      caseId: string;
      revisionId: string;
      actorUserId: string;
      input: AuthorizeCaseRevisionPublicationDto;
    },
  ) {
    return stableStringify({
      action: APP008A_ACTION,
      artifactType: 'CASE_REVISION',
      artifactId: command.caseId,
      artifactRevisionId: command.revisionId,
      expectedRevisionId: command.input.expectedRevisionId,
      expectedApprovalDecisionId: command.input.expectedApprovalDecisionId,
      expectedMaterialContextHash: command.input.expectedMaterialContextHash,
      expectedValidationRunId: command.input.expectedValidationRunId ?? null,
      expectedActivePublicationDecisionId:
        command.input.expectedActivePublicationDecisionId ?? null,
      actorUserId: command.actorUserId,
      requestedEffect: {
        authorizePublication: true,
        updateCompatibilityProjection: true,
        doesNotSchedule: true,
        doesNotBindLearnerExposure: true,
      },
      rationale: this.normalizeOptionalString(command.input.rationale) ?? null,
    });
  }

  private async resolvePublicationReplayAfterRollback(input: {
    caseId: string;
    revisionId: string;
    actorUserId: string;
    input: AuthorizeCaseRevisionPublicationDto;
    conflictTarget: App008aUniqueConflictTarget;
  }) {
    const commandFingerprint = await this.buildPublicationCommandFingerprint(
      this.prisma,
      input,
    );
    const priorCommand = await (
      this.prisma as any
    ).caseRevisionPublicationCommand.findUnique({
      where: {
        commandIdempotencyKey: input.input.commandIdempotencyKey,
      },
      select: {
        commandFingerprint: true,
        resultPublicationDecisionId: true,
        status: true,
      },
    });
    if (!priorCommand) {
      throw new ConflictException(
        `AUTHORIZE_CASE_REVISION_PUBLICATION could not be replayed after ${input.conflictTarget}`,
      );
    }
    return this.resolvePriorPublicationCommand(this.prisma, {
      command: input,
      commandFingerprint,
      priorCommand,
    });
  }

  private async resolvePriorPublicationCommand(
    client: PublicationTransactionClient,
    input: {
      command: {
        caseId: string;
        revisionId: string;
        actorUserId: string;
        input: AuthorizeCaseRevisionPublicationDto;
      };
      commandFingerprint: string;
      priorCommand: {
        commandFingerprint: string;
        resultPublicationDecisionId: string | null;
        status: string;
      };
    },
  ) {
    if (input.priorCommand.commandFingerprint !== input.commandFingerprint) {
      throw new ConflictException(
        'AUTHORIZE_CASE_REVISION_PUBLICATION idempotency key conflicts with a different command fingerprint',
      );
    }
    if (
      input.priorCommand.status !== 'SUCCESS' ||
      !input.priorCommand.resultPublicationDecisionId
    ) {
      throw new ConflictException(
        'AUTHORIZE_CASE_REVISION_PUBLICATION idempotency command is not yet replayable',
      );
    }

    const decision = await (
      client as any
    ).caseRevisionPublicationDecision.findFirst({
      where: {
        id: input.priorCommand.resultPublicationDecisionId,
        caseId: input.command.caseId,
        caseRevisionId: input.command.revisionId,
      },
    });
    if (!decision) {
      throw new ConflictException(
        'AUTHORIZE_CASE_REVISION_PUBLICATION idempotency result decision is missing',
      );
    }
    return decision;
  }

  private async buildContentBoundarySnapshot(
    client: PublicationTransactionClient,
    input: { caseId: string; revisionId: string },
  ) {
    const revision = await client.caseRevision.findFirstOrThrow({
      where: { id: input.revisionId, caseId: input.caseId },
      select: {
        id: true,
        caseId: true,
        title: true,
        history: true,
        symptoms: true,
        labs: true,
        clues: true,
        explanation: true,
        differentials: true,
        diagnosisRegistryId: true,
        proposedDiagnosisText: true,
        diagnosisMappingStatus: true,
        diagnosisMappingMethod: true,
        diagnosisMappingConfidence: true,
        diagnosisRegistry: {
          select: {
            id: true,
            canonicalName: true,
            displayLabel: true,
            status: true,
            active: true,
            isPlayable: true,
          },
        },
      },
    });

    return {
      classification: {
        clinicallyMaterialExposureStable: [
          'caseRevisionClinicalPayload',
          'diagnosisIdentitySnapshot',
        ],
        presentationalOrOrganizationalLiveOk: [
          'registry category/specialty/bodySystem',
        ],
      },
      caseRevisionClinicalPayload: {
        id: revision.id,
        caseId: revision.caseId,
        title: revision.title,
        history: revision.history,
        symptoms: revision.symptoms,
        labs: revision.labs,
        clues: revision.clues,
        explanation: revision.explanation,
        differentials: revision.differentials,
        proposedDiagnosisText: revision.proposedDiagnosisText,
        diagnosisMappingStatus: revision.diagnosisMappingStatus,
        diagnosisMappingMethod: revision.diagnosisMappingMethod,
        diagnosisMappingConfidence: revision.diagnosisMappingConfidence,
      },
      diagnosisIdentitySnapshot: revision.diagnosisRegistry
        ? {
            id: revision.diagnosisRegistry.id,
            canonicalName: revision.diagnosisRegistry.canonicalName,
            displayLabel: revision.diagnosisRegistry.displayLabel,
            status: revision.diagnosisRegistry.status,
            active: revision.diagnosisRegistry.active,
            isPlayable: revision.diagnosisRegistry.isPlayable,
          }
        : null,
    } as Prisma.InputJsonValue;
  }

  private requireCommandInput(command: {
    revisionId: string;
    input: AuthorizeCaseRevisionPublicationDto;
  }) {
    if (!this.normalizeOptionalString(command.input.expectedRevisionId)) {
      throw new BadRequestException(
        'AUTHORIZE_CASE_REVISION_PUBLICATION requires expectedRevisionId',
      );
    }
    if (command.input.expectedRevisionId !== command.revisionId) {
      throw new ConflictException(
        'Stale publication command: expected revision does not match route revision',
      );
    }
    if (
      !this.normalizeOptionalString(command.input.expectedApprovalDecisionId)
    ) {
      throw new BadRequestException(
        'AUTHORIZE_CASE_REVISION_PUBLICATION requires expectedApprovalDecisionId',
      );
    }
    if (
      !this.normalizeOptionalString(command.input.expectedMaterialContextHash)
    ) {
      throw new BadRequestException(
        'AUTHORIZE_CASE_REVISION_PUBLICATION requires expectedMaterialContextHash',
      );
    }
    if (!this.normalizeOptionalString(command.input.commandIdempotencyKey)) {
      throw new BadRequestException(
        'AUTHORIZE_CASE_REVISION_PUBLICATION requires commandIdempotencyKey',
      );
    }
  }

  private getApp008aReplayEligibleUniqueConflict(
    error: unknown,
  ): App008aUniqueConflictTarget | null {
    if (
      typeof error !== 'object' ||
      error === null ||
      !('code' in error) ||
      (error as { code?: string }).code !== 'P2002'
    ) {
      return null;
    }
    const target = (error as { meta?: { target?: unknown } }).meta?.target;
    const values = Array.isArray(target)
      ? target.map(String)
      : typeof target === 'string'
        ? [target]
        : [];
    if (values.some((value) => value.includes('commandIdempotencyKey'))) {
      return 'commandIdempotencyKey';
    }
    if (
      values.some(
        (value) =>
          value.includes(
            'CaseRevisionPublicationDecision_case_authorized_key',
          ) ||
          value.includes(
            'CaseRevisionPublicationDecision_revision_authorized_key',
          ),
      )
    ) {
      return 'activePublication';
    }
    return null;
  }

  private isPrismaSerializableConflict(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2034'
    );
  }

  private async assertCaseExists(caseId: string) {
    const record = await this.prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true },
    });
    if (!record) throw new NotFoundException(`Case not found: ${caseId}`);
  }

  private async assertCaseRevisionExists(caseId: string, revisionId: string) {
    const record = await this.prisma.caseRevision.findFirst({
      where: { id: revisionId, caseId },
      select: { id: true },
    });
    if (!record) {
      throw new NotFoundException(`Case revision not found: ${revisionId}`);
    }
  }

  private normalizeOptionalString(value?: string): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private getApprovalMaterialContextHash(
    value: Prisma.JsonValue,
  ): string | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return null;
    }
    const materialContextHash = (value as Record<string, unknown>)
      .materialContextHash;
    return typeof materialContextHash === 'string' &&
      materialContextHash.trim().length > 0
      ? materialContextHash.trim()
      : null;
  }
}
