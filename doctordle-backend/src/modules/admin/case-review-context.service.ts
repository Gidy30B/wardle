import { createHash } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CaseEditorialStatus,
  ValidationOutcome,
  type Prisma,
  type PrismaClient,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service.js';
import { CaseEligibilityPolicyService } from '../cases/case-eligibility-policy.service.js';
import { getCaseDiagnosisPublishReadiness } from '../editorial/policies/diagnosis-publish-readiness.policy.js';
import { CaseQualityProjectionService } from './case-quality-projection.service.js';

export const CASE_REVIEW_CONTEXT_SCHEMA_VERSION = 1;

export type CaseReviewContextPurpose =
  | 'REVIEW_OPENING'
  | 'DECISION_SUBMISSION'
  | 'PUBLICATION_READINESS';

export type CaseReviewQuestion =
  | 'IS_CURRENT_CASE_REVISION_READY_FOR_EDITORIAL_DECISION'
  | 'IS_APPROVED_CASE_REVISION_READY_TO_PUBLISH';

export type CaseReviewContextIssueSeverity = 'blocker' | 'warning';

export type CaseReviewContextIssueDomain =
  | 'case_revision'
  | 'validation'
  | 'diagnosis_readiness'
  | 'clinical_content'
  | 'reasoning'
  | 'differentials'
  | 'evidence'
  | 'teaching'
  | 'ai_provenance'
  | 'clue_revision_drafts'
  | 'publication_readiness';

export type CaseReviewContextIssue = {
  code: string;
  severity: CaseReviewContextIssueSeverity;
  domain: CaseReviewContextIssueDomain;
  message: string;
  sourceId: string | null;
};

export type CaseReviewContext = {
  schemaVersion: number;
  assembledAt: string;
  purpose: CaseReviewContextPurpose;
  reviewQuestion: CaseReviewQuestion;
  reviewIdentity: {
    caseReviewId: string | null;
    openedRevisionId: string | null;
    reviewerUserId: string | null;
    decision: string | null;
    decidedAt: string | null;
  };
  caseIdentity: {
    caseId: string;
    publicNumber: number | null;
    title: string;
    diagnosisRegistryId: string | null;
    proposedDiagnosisText: string;
  };
  caseRevision: {
    id: string | null;
    revisionNumber: number | null;
    source: string | null;
    createdByUserId: string | null;
    createdAt: string | null;
    title: string;
    difficulty: string;
    symptomsCount: number;
    clueCount: number;
    differentialCount: number;
    diagnosisRegistryId: string | null;
    diagnosisMappingStatus: string | null;
  };
  currentCaseState: {
    editorialStatus: CaseEditorialStatus | null;
    approvedAt: string | null;
    approvedByUserId: string | null;
    currentRevisionId: string | null;
    updatedAt: string | null;
  };
  validation: {
    latestRunId: string | null;
    latestRevisionId: string | null;
    outcome: ValidationOutcome | null;
    validatorVersion: string | null;
    completedAt: string | null;
    findings: Prisma.JsonValue | null;
    summary: Prisma.JsonValue | null;
  };
  diagnosisReadiness: {
    ready: boolean;
    reason: string | null;
    diagnosisRegistryStatus: string | null;
    diagnosisMappingStatus: string | null;
  };
  clinicalContentAssessment: {
    qualityProjection: ReturnType<
      CaseQualityProjectionService['buildProjection']
    >;
    clueProgression: {
      status: 'available' | 'unavailable';
      analysisVersion: string | null;
      generatedAt: string | null;
      prematureLeakFlag: boolean | null;
      unresolvedAmbiguityFlag: boolean | null;
      ambiguityScore: number | null;
      unresolvedMimicCount: number | null;
      weakEliminationCount: number | null;
    };
    playableClues: {
      valid: boolean;
      reasons: string[];
    };
  };
  reasoningState: {
    status: 'available' | 'unavailable';
    paths: Array<{
      id: string;
      normalizedKey: string;
      title: string;
      reasoningGoal: string;
      generationPurpose: string;
      readinessScore: number;
      status: string;
      reviewedByUserId: string | null;
      reviewedAt: string | null;
      updatedAt: string;
    }>;
  };
  differentialState: {
    listed: string[];
    linked: Array<{
      id: string;
      diagnosisRegistryId: string;
      role: string;
      confidence: number | null;
      sourceText: string;
    }>;
    discriminatorAnnotations: Array<{
      id: string;
      clueOrder: number;
      eliminatedDiagnosisId: string | null;
      eliminatedDiagnosisName: string;
      eliminationStrength: string;
      reviewedAt: string | null;
      updatedAt: string;
    }>;
  };
  evidenceState: {
    status: 'available' | 'unavailable';
    relationships: Array<{
      id: string;
      evidenceNodeId: string;
      relationshipType: string;
      status: string;
      strength: number;
      discriminatorWeight: number;
      reviewedByUserId: string | null;
      reviewedAt: string | null;
      updatedAt: string;
    }>;
  };
  teachingDependencies: {
    status: 'available' | 'unavailable';
    rules: Array<{
      id: string;
      stableKey: string;
      title: string;
      category: string;
      importance: string;
      status: string;
      version: number;
      updatedAt: string;
    }>;
    relationships: Array<{
      id: string;
      targetDiagnosisRegistryId: string;
      relationshipType: string;
      teachingPurpose: string;
      strength: number;
      status: string;
      reviewedAt: string | null;
      updatedAt: string;
    }>;
  };
  aiProvenance: {
    status: 'available' | 'unavailable';
    audits: Array<{
      id: string;
      actionType: string;
      affectedArtifactType: string;
      affectedArtifactId: string;
      reviewStatus: string;
      editorDecision: string | null;
      reviewerUserId: string | null;
      decisionAt: string | null;
      updatedAt: string;
    }>;
  };
  clueRevisionDraftState: {
    status: 'available' | 'unavailable';
    drafts: Array<{
      id: string;
      sourceAuditId: string;
      clueOrder: number | null;
      clueIndex: number | null;
      status: string;
      decisionByUserId: string | null;
      decisionAt: string | null;
      appliedByUserId: string | null;
      appliedAt: string | null;
      updatedAt: string;
    }>;
  };
  blockers: CaseReviewContextIssue[];
  warnings: CaseReviewContextIssue[];
  publicationReadinessInputs: {
    approvedAt: string | null;
    approvedByUserId: string | null;
    diagnosisReady: boolean;
    playableCluesReady: boolean;
    latestValidationPassed: boolean;
    unresolvedBlockerCount: number;
    unresolvedWarningCount: number;
  };
  componentHashes: CaseReviewComponentHashes;
  contentHash: string;
};

export type CaseReviewComponentHashes = {
  caseRevision: string;
  validation: string;
  diagnosisReadiness: string;
  evidence: string;
  reasoning: string;
  teachingDependencies: string;
  aiProvenance: string;
  clueRevisionDrafts: string;
  blockers: string;
  warnings: string;
};

export type CaseReviewStalenessReason =
  | 'CASE_REVISION_CHANGED'
  | 'VALIDATION_CHANGED'
  | 'VALIDATION_FAILED'
  | 'VALIDATION_POLICY_CHANGED'
  | 'DIAGNOSIS_READINESS_CHANGED'
  | 'EVIDENCE_CHANGED'
  | 'REASONING_CHANGED'
  | 'TEACHING_DEPENDENCIES_CHANGED'
  | 'AI_PROVENANCE_CHANGED'
  | 'CLUE_DRAFT_STATE_CHANGED'
  | 'BLOCKERS_CHANGED'
  | 'WARNINGS_CHANGED';

export type CaseReviewStalenessDifference = {
  reason: CaseReviewStalenessReason;
  previousHash: string | null;
  currentHash: string | null;
};

type CaseReviewContextClient =
  | Prisma.TransactionClient
  | PrismaClient
  | PrismaService;

const HASH_VOLATILE_KEYS = new Set(['assembledAt']);

const SET_LIKE_ARRAY_PATHS = new Set([
  'reasoningState.paths',
  'differentialState.linked',
  'differentialState.discriminatorAnnotations',
  'evidenceState.relationships',
  'teachingDependencies.rules',
  'teachingDependencies.relationships',
  'aiProvenance.audits',
  'clueRevisionDraftState.drafts',
  'blockers',
  'warnings',
]);

const CASE_REVIEW_CONTEXT_CASE_SELECT = {
  id: true,
  publicNumber: true,
  title: true,
  date: true,
  difficulty: true,
  history: true,
  symptoms: true,
  labs: true,
  clues: true,
  explanation: true,
  differentials: true,
  editorialStatus: true,
  approvedAt: true,
  approvedByUserId: true,
  currentRevisionId: true,
  diagnosisRegistryId: true,
  proposedDiagnosisText: true,
  diagnosisMappingStatus: true,
  diagnosisMappingMethod: true,
  diagnosisMappingConfidence: true,
  diagnosisEditorialNote: true,
  diagnosisRegistry: {
    select: {
      status: true,
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
      diagnosisRegistryId: true,
      diagnosisMappingStatus: true,
      diagnosisMappingMethod: true,
      diagnosisMappingConfidence: true,
      diagnosisEditorialNote: true,
    },
  },
  validationRuns: {
    orderBy: [{ startedAt: 'desc' }],
    take: 1,
    select: {
      id: true,
      revisionId: true,
      outcome: true,
      validatorVersion: true,
      summary: true,
      findings: true,
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
      decidedAt: true,
    },
  },
  differentialLinks: {
    orderBy: [{ role: 'asc' }, { sourceText: 'asc' }],
    select: {
      id: true,
      diagnosisRegistryId: true,
      role: true,
      confidence: true,
      sourceText: true,
    },
  },
} satisfies Prisma.CaseSelect;

@Injectable()
export class CaseReviewContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly caseQualityProjectionService: CaseQualityProjectionService,
    private readonly caseEligibilityPolicy: CaseEligibilityPolicyService,
  ) {}

  async assembleContext(input: {
    caseId: string;
    purpose: CaseReviewContextPurpose;
    reviewQuestion?: CaseReviewQuestion;
    caseReviewId?: string | null;
    client?: CaseReviewContextClient;
    assembledAt?: Date;
  }): Promise<CaseReviewContext> {
    const client = input.client ?? this.prisma;
    const assembledAt = input.assembledAt ?? new Date();
    const caseRecord = await client.case.findUnique({
      where: { id: input.caseId },
      select: CASE_REVIEW_CONTEXT_CASE_SELECT,
    });

    if (!caseRecord) {
      throw new NotFoundException(`Case not found: ${input.caseId}`);
    }

    const diagnosisRegistryId = caseRecord.diagnosisRegistryId;
    const [
      progression,
      discriminatorAnnotations,
      reasoningPaths,
      evidence,
      teachingRules,
      teachingRelationships,
      aiAudits,
      clueDrafts,
    ] = await Promise.all([
      client.caseClueProgressionAnalysis.findUnique({
        where: { caseId: caseRecord.id },
        select: {
          analysisVersion: true,
          generatedAt: true,
          prematureLeakFlag: true,
          unresolvedAmbiguityFlag: true,
          ambiguityScore: true,
          unresolvedMimicCount: true,
          weakEliminationCount: true,
        },
      }),
      client.caseClueDiscriminatorAnnotation.findMany({
        where: { caseId: caseRecord.id },
        orderBy: [{ clueOrder: 'asc' }, { eliminatedDiagnosisName: 'asc' }],
        select: {
          id: true,
          clueOrder: true,
          eliminatedDiagnosisId: true,
          eliminatedDiagnosisName: true,
          eliminationStrength: true,
          reviewedAt: true,
          updatedAt: true,
        },
      }),
      diagnosisRegistryId
        ? client.reasoningPath.findMany({
            where: { diagnosisRegistryId },
            orderBy: [
              { status: 'asc' },
              { readinessScore: 'desc' },
              { updatedAt: 'desc' },
            ],
            select: {
              id: true,
              normalizedKey: true,
              title: true,
              reasoningGoal: true,
              generationPurpose: true,
              readinessScore: true,
              status: true,
              reviewedByUserId: true,
              reviewedAt: true,
              updatedAt: true,
            },
          })
        : Promise.resolve([]),
      diagnosisRegistryId
        ? client.diagnosisEvidenceRelationship.findMany({
            where: { diagnosisRegistryId },
            orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
            select: {
              id: true,
              evidenceNodeId: true,
              relationshipType: true,
              status: true,
              strength: true,
              discriminatorWeight: true,
              reviewedByUserId: true,
              reviewedAt: true,
              updatedAt: true,
            },
          })
        : Promise.resolve([]),
      diagnosisRegistryId
        ? client.diagnosisTeachingRule.findMany({
            where: { diagnosisRegistryId },
            orderBy: [{ status: 'asc' }, { stableKey: 'asc' }],
            select: {
              id: true,
              stableKey: true,
              title: true,
              category: true,
              importance: true,
              status: true,
              version: true,
              updatedAt: true,
            },
          })
        : Promise.resolve([]),
      diagnosisRegistryId
        ? client.diagnosisTeachingRelationship.findMany({
            where: { sourceDiagnosisRegistryId: diagnosisRegistryId },
            orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
            select: {
              id: true,
              targetDiagnosisRegistryId: true,
              relationshipType: true,
              teachingPurpose: true,
              strength: true,
              status: true,
              reviewedAt: true,
              updatedAt: true,
            },
          })
        : Promise.resolve([]),
      client.aiDraftRevisionAudit.findMany({
        where: {
          OR: [
            { caseId: caseRecord.id },
            {
              affectedArtifactType: 'case',
              affectedArtifactId: caseRecord.id,
            },
          ],
        },
        orderBy: [{ updatedAt: 'desc' }],
        select: {
          id: true,
          actionType: true,
          affectedArtifactType: true,
          affectedArtifactId: true,
          reviewStatus: true,
          editorDecision: true,
          reviewerUserId: true,
          decisionAt: true,
          updatedAt: true,
        },
      }),
      client.caseClueRevisionDraft.findMany({
        where: { caseId: caseRecord.id },
        orderBy: [{ updatedAt: 'desc' }],
        select: {
          id: true,
          sourceAuditId: true,
          clueOrder: true,
          clueIndex: true,
          status: true,
          decisionByUserId: true,
          decisionAt: true,
          appliedByUserId: true,
          appliedAt: true,
          updatedAt: true,
        },
      }),
    ]);

    const latestValidation = caseRecord.validationRuns[0] ?? null;
    const latestReview = input.caseReviewId
      ? await client.caseReview.findUnique({
          where: { id: input.caseReviewId },
          select: {
            id: true,
            revisionId: true,
            reviewerUserId: true,
            decision: true,
            decidedAt: true,
          },
        })
      : (caseRecord.reviews[0] ?? null);
    const diagnosisReadiness = getCaseDiagnosisPublishReadiness({
      diagnosisRegistryId: caseRecord.diagnosisRegistryId,
      diagnosisMappingStatus: caseRecord.diagnosisMappingStatus,
      diagnosisRegistryStatus: caseRecord.diagnosisRegistry?.status ?? null,
    });
    const qualityProjection =
      this.caseQualityProjectionService.buildProjection(caseRecord);
    const playableClues = this.caseEligibilityPolicy.validatePlayableClues(
      caseRecord.clues,
      { caseId: caseRecord.id },
    );

    const contextWithoutHashes = {
      schemaVersion: CASE_REVIEW_CONTEXT_SCHEMA_VERSION,
      assembledAt: assembledAt.toISOString(),
      purpose: input.purpose,
      reviewQuestion:
        input.reviewQuestion ??
        (input.purpose === 'PUBLICATION_READINESS'
          ? 'IS_APPROVED_CASE_REVISION_READY_TO_PUBLISH'
          : 'IS_CURRENT_CASE_REVISION_READY_FOR_EDITORIAL_DECISION'),
      reviewIdentity: {
        caseReviewId: latestReview?.id ?? input.caseReviewId ?? null,
        openedRevisionId: latestReview?.revisionId ?? null,
        reviewerUserId: latestReview?.reviewerUserId ?? null,
        decision: latestReview?.decision ?? null,
        decidedAt: normalizeDate(latestReview?.decidedAt ?? null),
      },
      caseIdentity: {
        caseId: caseRecord.id,
        publicNumber: caseRecord.publicNumber ?? null,
        title: caseRecord.title,
        diagnosisRegistryId: caseRecord.diagnosisRegistryId,
        proposedDiagnosisText: caseRecord.proposedDiagnosisText,
      },
      caseRevision: {
        id: caseRecord.currentRevision?.id ?? null,
        revisionNumber: caseRecord.currentRevision?.revisionNumber ?? null,
        source: caseRecord.currentRevision?.source ?? null,
        createdByUserId: caseRecord.currentRevision?.createdByUserId ?? null,
        createdAt: normalizeDate(caseRecord.currentRevision?.createdAt ?? null),
        title: caseRecord.currentRevision?.title ?? caseRecord.title,
        difficulty:
          caseRecord.currentRevision?.difficulty ?? caseRecord.difficulty,
        symptomsCount:
          caseRecord.currentRevision?.symptoms?.length ??
          caseRecord.symptoms.length,
        clueCount: countClues(
          caseRecord.currentRevision?.clues ?? caseRecord.clues,
        ),
        differentialCount:
          caseRecord.currentRevision?.differentials?.length ??
          caseRecord.differentials.length,
        diagnosisRegistryId:
          caseRecord.currentRevision?.diagnosisRegistryId ??
          caseRecord.diagnosisRegistryId,
        diagnosisMappingStatus:
          caseRecord.currentRevision?.diagnosisMappingStatus ??
          caseRecord.diagnosisMappingStatus,
      },
      currentCaseState: {
        editorialStatus: caseRecord.editorialStatus,
        approvedAt: normalizeDate(caseRecord.approvedAt),
        approvedByUserId: caseRecord.approvedByUserId,
        currentRevisionId: caseRecord.currentRevisionId,
        updatedAt: null,
      },
      validation: {
        latestRunId: latestValidation?.id ?? null,
        latestRevisionId: latestValidation?.revisionId ?? null,
        outcome: latestValidation?.outcome ?? null,
        validatorVersion: latestValidation?.validatorVersion ?? null,
        completedAt: normalizeDate(latestValidation?.completedAt ?? null),
        findings: latestValidation?.findings ?? null,
        summary: latestValidation?.summary ?? null,
      },
      diagnosisReadiness: {
        ready: diagnosisReadiness.ready,
        reason: diagnosisReadiness.reason ?? null,
        diagnosisRegistryStatus: caseRecord.diagnosisRegistry?.status ?? null,
        diagnosisMappingStatus: caseRecord.diagnosisMappingStatus,
      },
      clinicalContentAssessment: {
        qualityProjection,
        clueProgression: progression
          ? {
              status: 'available' as const,
              analysisVersion: progression.analysisVersion,
              generatedAt: normalizeDate(progression.generatedAt),
              prematureLeakFlag: progression.prematureLeakFlag,
              unresolvedAmbiguityFlag: progression.unresolvedAmbiguityFlag,
              ambiguityScore: progression.ambiguityScore,
              unresolvedMimicCount: progression.unresolvedMimicCount,
              weakEliminationCount: progression.weakEliminationCount,
            }
          : {
              status: 'unavailable' as const,
              analysisVersion: null,
              generatedAt: null,
              prematureLeakFlag: null,
              unresolvedAmbiguityFlag: null,
              ambiguityScore: null,
              unresolvedMimicCount: null,
              weakEliminationCount: null,
            },
        playableClues: {
          valid: playableClues.valid,
          reasons: playableClues.reasons,
        },
      },
      reasoningState: {
        status: diagnosisRegistryId
          ? ('available' as const)
          : ('unavailable' as const),
        paths: reasoningPaths.map((path) => ({
          ...path,
          reasoningGoal: String(path.reasoningGoal),
          generationPurpose: String(path.generationPurpose),
          status: String(path.status),
          reviewedAt: normalizeDate(path.reviewedAt),
          updatedAt: normalizeRequiredDate(path.updatedAt),
        })),
      },
      differentialState: {
        listed: caseRecord.differentials,
        linked: caseRecord.differentialLinks.map((link) => ({
          id: link.id,
          diagnosisRegistryId: link.diagnosisRegistryId,
          role: String(link.role),
          confidence: link.confidence,
          sourceText: link.sourceText,
        })),
        discriminatorAnnotations: discriminatorAnnotations.map((item) => ({
          ...item,
          reviewedAt: normalizeDate(item.reviewedAt),
          updatedAt: normalizeRequiredDate(item.updatedAt),
        })),
      },
      evidenceState: {
        status: diagnosisRegistryId
          ? ('available' as const)
          : ('unavailable' as const),
        relationships: evidence.map((item) => ({
          ...item,
          relationshipType: String(item.relationshipType),
          status: String(item.status),
          reviewedAt: normalizeDate(item.reviewedAt),
          updatedAt: normalizeRequiredDate(item.updatedAt),
        })),
      },
      teachingDependencies: {
        status: diagnosisRegistryId
          ? ('available' as const)
          : ('unavailable' as const),
        rules: teachingRules.map((rule) => ({
          ...rule,
          updatedAt: normalizeRequiredDate(rule.updatedAt),
        })),
        relationships: teachingRelationships.map((relationship) => ({
          ...relationship,
          relationshipType: String(relationship.relationshipType),
          teachingPurpose: String(relationship.teachingPurpose),
          status: String(relationship.status),
          reviewedAt: normalizeDate(relationship.reviewedAt),
          updatedAt: normalizeRequiredDate(relationship.updatedAt),
        })),
      },
      aiProvenance: {
        status: 'available' as const,
        audits: aiAudits.map((audit) => ({
          ...audit,
          reviewStatus: String(audit.reviewStatus),
          decisionAt: normalizeDate(audit.decisionAt),
          updatedAt: normalizeRequiredDate(audit.updatedAt),
        })),
      },
      clueRevisionDraftState: {
        status: 'available' as const,
        drafts: clueDrafts.map((draft) => ({
          ...draft,
          decisionAt: normalizeDate(draft.decisionAt),
          appliedAt: normalizeDate(draft.appliedAt),
          updatedAt: normalizeRequiredDate(draft.updatedAt),
        })),
      },
    };

    const blockers = buildBlockers(contextWithoutHashes);
    const warnings = buildWarnings(contextWithoutHashes);
    const publicationReadinessInputs = {
      approvedAt: contextWithoutHashes.currentCaseState.approvedAt,
      approvedByUserId: contextWithoutHashes.currentCaseState.approvedByUserId,
      diagnosisReady: contextWithoutHashes.diagnosisReadiness.ready,
      playableCluesReady:
        contextWithoutHashes.clinicalContentAssessment.playableClues.valid,
      latestValidationPassed:
        contextWithoutHashes.validation.outcome === ValidationOutcome.PASSED,
      unresolvedBlockerCount: blockers.length,
      unresolvedWarningCount: warnings.length,
    };

    const contextForHash = {
      ...contextWithoutHashes,
      blockers,
      warnings,
      publicationReadinessInputs,
    };
    const componentHashes = computeCaseReviewComponentHashes(contextForHash);
    const contentHash = sha256Canonical({
      ...contextForHash,
      componentHashes,
    });

    return {
      ...contextForHash,
      componentHashes,
      contentHash,
    };
  }
}

export function canonicalizeForHash(value: unknown): unknown {
  return canonicalize(value, []);
}

export function canonicalSerialize(value: unknown): string {
  return JSON.stringify(canonicalizeForHash(value));
}

export function sha256Canonical(value: unknown): string {
  return createHash('sha256').update(canonicalSerialize(value)).digest('hex');
}

export function computeCaseReviewComponentHashes(
  context: Omit<CaseReviewContext, 'componentHashes' | 'contentHash'>,
): CaseReviewComponentHashes {
  return {
    caseRevision: sha256Canonical({
      schemaVersion: context.schemaVersion,
      caseRevision: context.caseRevision,
    }),
    validation: sha256Canonical({
      schemaVersion: context.schemaVersion,
      validation: context.validation,
    }),
    diagnosisReadiness: sha256Canonical({
      schemaVersion: context.schemaVersion,
      diagnosisReadiness: context.diagnosisReadiness,
    }),
    evidence: sha256Canonical({
      schemaVersion: context.schemaVersion,
      evidenceState: context.evidenceState,
    }),
    reasoning: sha256Canonical({
      schemaVersion: context.schemaVersion,
      reasoningState: context.reasoningState,
    }),
    teachingDependencies: sha256Canonical({
      schemaVersion: context.schemaVersion,
      teachingDependencies: context.teachingDependencies,
    }),
    aiProvenance: sha256Canonical({
      schemaVersion: context.schemaVersion,
      aiProvenance: context.aiProvenance,
    }),
    clueRevisionDrafts: sha256Canonical({
      schemaVersion: context.schemaVersion,
      clueRevisionDraftState: context.clueRevisionDraftState,
    }),
    blockers: sha256Canonical({
      schemaVersion: context.schemaVersion,
      blockers: context.blockers,
    }),
    warnings: sha256Canonical({
      schemaVersion: context.schemaVersion,
      warnings: context.warnings,
    }),
  };
}

export function compareCaseReviewContextStaleness(
  previous: Pick<CaseReviewContext, 'componentHashes' | 'validation'>,
  current: Pick<CaseReviewContext, 'componentHashes' | 'validation'>,
): CaseReviewStalenessDifference[] {
  const differences: CaseReviewStalenessDifference[] = [];
  const add = (
    reason: CaseReviewStalenessReason,
    previousHash: string | null,
    currentHash: string | null,
  ) => {
    if (!differences.some((item) => item.reason === reason)) {
      differences.push({ reason, previousHash, currentHash });
    }
  };

  compareHash('caseRevision', 'CASE_REVISION_CHANGED');
  compareHash('validation', 'VALIDATION_CHANGED');
  if (
    current.validation.outcome &&
    current.validation.outcome !== ValidationOutcome.PASSED
  ) {
    add(
      'VALIDATION_FAILED',
      previous.componentHashes.validation,
      current.componentHashes.validation,
    );
  }
  if (
    previous.validation.validatorVersion !== current.validation.validatorVersion
  ) {
    add(
      'VALIDATION_POLICY_CHANGED',
      previous.componentHashes.validation,
      current.componentHashes.validation,
    );
  }
  compareHash('diagnosisReadiness', 'DIAGNOSIS_READINESS_CHANGED');
  compareHash('evidence', 'EVIDENCE_CHANGED');
  compareHash('reasoning', 'REASONING_CHANGED');
  compareHash('teachingDependencies', 'TEACHING_DEPENDENCIES_CHANGED');
  compareHash('aiProvenance', 'AI_PROVENANCE_CHANGED');
  compareHash('clueRevisionDrafts', 'CLUE_DRAFT_STATE_CHANGED');
  compareHash('blockers', 'BLOCKERS_CHANGED');
  compareHash('warnings', 'WARNINGS_CHANGED');

  return differences;

  function compareHash(
    component: keyof CaseReviewComponentHashes,
    reason: CaseReviewStalenessReason,
  ) {
    if (
      previous.componentHashes[component] !== current.componentHashes[component]
    ) {
      add(
        reason,
        previous.componentHashes[component],
        current.componentHashes[component],
      );
    }
  }
}

function canonicalize(value: unknown, path: string[]): unknown {
  if (value === undefined) return null;
  if (value === null) return null;
  if (value instanceof Date) return normalizeDate(value);
  if (Array.isArray(value)) {
    const items = value.map((item, index) =>
      canonicalize(item, [...path, String(index)]),
    );
    const semanticPath = path
      .filter((segment) => !/^\d+$/.test(segment))
      .join('.');
    if (SET_LIKE_ARRAY_PATHS.has(semanticPath)) {
      return [...items].sort(compareCanonicalValues);
    }
    return items;
  }
  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      if (HASH_VOLATILE_KEYS.has(key)) continue;
      result[key] = canonicalize(source[key], [...path, key]);
    }
    return result;
  }
  return value;
}

function compareCanonicalValues(left: unknown, right: unknown): number {
  return JSON.stringify(left).localeCompare(JSON.stringify(right));
}

function normalizeDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function normalizeRequiredDate(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function countClues(value: Prisma.JsonValue | null): number {
  return Array.isArray(value) ? value.length : 0;
}

function buildBlockers(
  context: Omit<
    CaseReviewContext,
    | 'componentHashes'
    | 'contentHash'
    | 'blockers'
    | 'warnings'
    | 'publicationReadinessInputs'
  >,
): CaseReviewContextIssue[] {
  const blockers: CaseReviewContextIssue[] = [];
  if (!context.caseRevision.id) {
    blockers.push(
      issue(
        'MISSING_CURRENT_REVISION',
        'case_revision',
        'Case has no current revision.',
        null,
      ),
    );
  }
  if (context.validation.outcome !== ValidationOutcome.PASSED) {
    blockers.push(
      issue(
        'VALIDATION_NOT_PASSED',
        'validation',
        'Latest validation has not passed.',
        context.validation.latestRunId,
      ),
    );
  }
  if (!context.diagnosisReadiness.ready) {
    blockers.push(
      issue(
        'DIAGNOSIS_NOT_READY',
        'diagnosis_readiness',
        `Diagnosis is not ready: ${context.diagnosisReadiness.reason ?? 'unknown'}.`,
        context.caseIdentity.diagnosisRegistryId,
      ),
    );
  }
  for (const detail of context.clinicalContentAssessment.qualityProjection
    .blockers) {
    blockers.push(
      issue(
        'QUALITY_BLOCKER',
        'clinical_content',
        detail,
        context.caseIdentity.caseId,
      ),
    );
  }
  if (!context.clinicalContentAssessment.playableClues.valid) {
    for (const reason of context.clinicalContentAssessment.playableClues
      .reasons) {
      blockers.push(
        issue(
          'PLAYABLE_CLUE_BLOCKER',
          'clinical_content',
          reason,
          context.caseIdentity.caseId,
        ),
      );
    }
  }
  const pendingAi = context.aiProvenance.audits.filter((audit) =>
    ['PENDING_REVIEW', 'NEEDS_CHANGES'].includes(audit.reviewStatus),
  );
  if (pendingAi.length > 0) {
    blockers.push(
      issue(
        'AI_REVIEW_PENDING',
        'ai_provenance',
        'AI-generated content affecting this case still requires human review.',
        pendingAi[0]?.id ?? null,
      ),
    );
  }
  const appliedDrafts = context.clueRevisionDraftState.drafts.filter(
    (draft) => draft.status === 'APPLIED',
  );
  if (appliedDrafts.length > 0) {
    blockers.push(
      issue(
        'CLUE_DRAFT_APPLIED_AFTER_REVIEW_CONTEXT',
        'clue_revision_drafts',
        'A clue revision draft has been applied and must be considered for freshness.',
        appliedDrafts[0]?.id ?? null,
      ),
    );
  }
  return blockers;
}

function buildWarnings(
  context: Omit<
    CaseReviewContext,
    | 'componentHashes'
    | 'contentHash'
    | 'blockers'
    | 'warnings'
    | 'publicationReadinessInputs'
  >,
): CaseReviewContextIssue[] {
  const warnings: CaseReviewContextIssue[] = [];
  for (const detail of context.clinicalContentAssessment.qualityProjection
    .warnings) {
    warnings.push(
      issue(
        'QUALITY_WARNING',
        'clinical_content',
        detail,
        context.caseIdentity.caseId,
        'warning',
      ),
    );
  }
  if (
    context.evidenceState.status === 'available' &&
    context.evidenceState.relationships.length === 0
  ) {
    warnings.push(
      issue(
        'NO_EVIDENCE_RELATIONSHIPS',
        'evidence',
        'No diagnosis-level evidence relationships are available for this case diagnosis.',
        context.caseIdentity.diagnosisRegistryId,
        'warning',
      ),
    );
  }
  if (
    context.reasoningState.status === 'available' &&
    context.reasoningState.paths.length === 0
  ) {
    warnings.push(
      issue(
        'NO_REASONING_PATHS',
        'reasoning',
        'No reasoning paths are available for this case diagnosis.',
        context.caseIdentity.diagnosisRegistryId,
        'warning',
      ),
    );
  }
  if (
    context.teachingDependencies.status === 'available' &&
    context.teachingDependencies.rules.length === 0
  ) {
    warnings.push(
      issue(
        'NO_TEACHING_RULES',
        'teaching',
        'No teaching rules are available for this case diagnosis.',
        context.caseIdentity.diagnosisRegistryId,
        'warning',
      ),
    );
  }
  return warnings;
}

function issue(
  code: string,
  domain: CaseReviewContextIssueDomain,
  message: string,
  sourceId: string | null,
  severity: CaseReviewContextIssueSeverity = 'blocker',
): CaseReviewContextIssue {
  return {
    code,
    severity,
    domain,
    message,
    sourceId,
  };
}
