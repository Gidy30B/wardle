import {
  CaseEditorialStatus,
  DiagnosisMappingMethod,
  DiagnosisMappingStatus,
  ValidationOutcome,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { CaseEligibilityPolicyService } from '../cases/case-eligibility-policy.service';
import { CaseQualityProjectionService } from './case-quality-projection.service';
import {
  CaseReviewContextService,
  canonicalSerialize,
  compareCaseReviewContextStaleness,
  sha256Canonical,
  type CaseReviewComponentHashes,
  type CaseReviewContext,
  type CaseReviewStalenessReason,
} from './case-review-context.service';

describe('case review context canonical hashing', () => {
  it('serializes objects deterministically regardless of key order', () => {
    expect(canonicalSerialize({ b: 2, a: 1 })).toBe(
      canonicalSerialize({ a: 1, b: 2 }),
    );
    expect(sha256Canonical({ b: 2, a: 1 })).toBe(
      sha256Canonical({ a: 1, b: 2 }),
    );
  });

  it('sorts configured set-like arrays with stable semantics', () => {
    const left = {
      schemaVersion: 1,
      blockers: [
        { code: 'B', domain: 'validation' },
        { code: 'A', domain: 'case_revision' },
      ],
    };
    const right = {
      schemaVersion: 1,
      blockers: [
        { code: 'A', domain: 'case_revision' },
        { code: 'B', domain: 'validation' },
      ],
    };

    expect(sha256Canonical(left)).toBe(sha256Canonical(right));
  });

  it('preserves meaningful ordered-array differences', () => {
    expect(sha256Canonical({ clues: ['first', 'second'] })).not.toBe(
      sha256Canonical({ clues: ['second', 'first'] }),
    );
  });

  it('normalizes dates and excludes volatile assembledAt from hashes', () => {
    expect(
      sha256Canonical({ createdAt: new Date('2026-01-01T00:00:00Z') }),
    ).toBe(sha256Canonical({ createdAt: '2026-01-01T00:00:00.000Z' }));
    expect(
      sha256Canonical({
        schemaVersion: 1,
        assembledAt: '2026-01-01T00:00:00.000Z',
        value: 'same',
      }),
    ).toBe(
      sha256Canonical({
        schemaVersion: 1,
        assembledAt: '2026-01-02T00:00:00.000Z',
        value: 'same',
      }),
    );
  });

  it('includes schema version in hash semantics', () => {
    expect(sha256Canonical({ schemaVersion: 1, value: 'x' })).not.toBe(
      sha256Canonical({ schemaVersion: 2, value: 'x' }),
    );
  });

  it('does not mutate source objects during canonicalization', () => {
    const source = {
      blockers: [
        { code: 'B', domain: 'validation' },
        { code: 'A', domain: 'case_revision' },
      ],
    };
    const before = JSON.stringify(source);

    canonicalSerialize(source);

    expect(JSON.stringify(source)).toBe(before);
  });
});

describe('case review context staleness comparison', () => {
  const baseHashes: CaseReviewComponentHashes = {
    caseRevision: 'case-revision',
    validation: 'validation',
    diagnosisReadiness: 'diagnosis',
    evidence: 'evidence',
    reasoning: 'reasoning',
    teachingDependencies: 'teaching',
    aiProvenance: 'ai',
    clueRevisionDrafts: 'drafts',
    blockers: 'blockers',
    warnings: 'warnings',
  };

  function context(
    overrides: Partial<
      Pick<CaseReviewContext, 'componentHashes' | 'validation'>
    >,
  ): Pick<CaseReviewContext, 'componentHashes' | 'validation'> {
    return {
      componentHashes: baseHashes,
      validation: {
        latestRunId: 'validation-1',
        latestRevisionId: 'revision-1',
        outcome: ValidationOutcome.PASSED,
        validatorVersion: 'validator:v1',
        completedAt: '2026-01-01T00:00:00.000Z',
        findings: null,
        summary: null,
      },
      ...overrides,
    };
  }

  it.each<[keyof CaseReviewComponentHashes, CaseReviewStalenessReason]>([
    ['caseRevision', 'CASE_REVISION_CHANGED'],
    ['validation', 'VALIDATION_CHANGED'],
    ['diagnosisReadiness', 'DIAGNOSIS_READINESS_CHANGED'],
    ['evidence', 'EVIDENCE_CHANGED'],
    ['reasoning', 'REASONING_CHANGED'],
    ['teachingDependencies', 'TEACHING_DEPENDENCIES_CHANGED'],
    ['aiProvenance', 'AI_PROVENANCE_CHANGED'],
    ['clueRevisionDrafts', 'CLUE_DRAFT_STATE_CHANGED'],
    ['blockers', 'BLOCKERS_CHANGED'],
    ['warnings', 'WARNINGS_CHANGED'],
  ])('reports %s as %s', (component, reason) => {
    const currentHashes = {
      ...baseHashes,
      [component]: `${component}:changed`,
    };

    expect(
      compareCaseReviewContextStaleness(
        context({}),
        context({ componentHashes: currentHashes }),
      ),
    ).toEqual(expect.arrayContaining([expect.objectContaining({ reason })]));
  });

  it('reports failed validation and validator policy changes', () => {
    const result = compareCaseReviewContextStaleness(
      context({}),
      context({
        componentHashes: { ...baseHashes, validation: 'validation:changed' },
        validation: {
          latestRunId: 'validation-2',
          latestRevisionId: 'revision-1',
          outcome: ValidationOutcome.FAILED,
          validatorVersion: 'validator:v2',
          completedAt: '2026-01-01T00:00:00.000Z',
          findings: null,
          summary: null,
        },
      }),
    );

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: 'VALIDATION_CHANGED' }),
        expect.objectContaining({ reason: 'VALIDATION_FAILED' }),
        expect.objectContaining({ reason: 'VALIDATION_POLICY_CHANGED' }),
      ]),
    );
  });
});

describe('CaseReviewContextService', () => {
  function buildFixture() {
    const caseRecord = {
      id: 'case-1',
      publicNumber: 12,
      title: 'Acute dyspnea',
      date: new Date('2026-01-01T00:00:00.000Z'),
      difficulty: 'medium',
      history: 'History',
      symptoms: ['dyspnea'],
      labs: null,
      clues: [{ order: 0, type: 'history', value: 'History clue' }],
      explanation: { summary: 'Reasoning' },
      differentials: ['Asthma'],
      editorialStatus: CaseEditorialStatus.VALIDATED,
      approvedAt: null,
      approvedByUserId: null,
      currentRevisionId: 'revision-1',
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      diagnosisRegistryId: 'registry-1',
      proposedDiagnosisText: 'Pulmonary embolism',
      diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
      diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
      diagnosisMappingConfidence: 1,
      diagnosisEditorialNote: null,
      diagnosisRegistry: { status: 'ACTIVE' },
      currentRevision: {
        id: 'revision-1',
        revisionNumber: 3,
        source: 'MANUAL',
        createdByUserId: 'editor-1',
        createdAt: new Date('2026-01-01T01:00:00.000Z'),
        title: 'Acute dyspnea',
        date: new Date('2026-01-01T00:00:00.000Z'),
        difficulty: 'medium',
        history: 'History',
        symptoms: ['dyspnea'],
        labs: null,
        clues: [{ order: 0, type: 'history', value: 'History clue' }],
        explanation: { summary: 'Reasoning' },
        differentials: ['Asthma'],
        diagnosisRegistryId: 'registry-1',
        diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
        diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
        diagnosisMappingConfidence: 1,
        diagnosisEditorialNote: null,
      },
      validationRuns: [
        {
          id: 'validation-1',
          revisionId: 'revision-1',
          outcome: ValidationOutcome.PASSED,
          validatorVersion: 'validator:v1',
          summary: { ok: true },
          findings: [],
          completedAt: new Date('2026-01-01T02:00:00.000Z'),
        },
      ],
      reviews: [
        {
          id: 'review-1',
          revisionId: 'revision-1',
          reviewerUserId: 'editor-2',
          decision: null,
          decidedAt: null,
        },
      ],
      differentialLinks: [
        {
          id: 'link-1',
          diagnosisRegistryId: 'registry-2',
          role: 'MIMIC',
          confidence: 0.75,
          sourceText: 'Asthma',
        },
      ],
    };

    const prisma = {
      case: { findUnique: jest.fn().mockResolvedValue(caseRecord) },
      caseClueProgressionAnalysis: {
        findUnique: jest.fn().mockResolvedValue({
          analysisVersion: 'heuristic_v1',
          generatedAt: new Date('2026-01-01T02:05:00.000Z'),
          prematureLeakFlag: false,
          unresolvedAmbiguityFlag: false,
          ambiguityScore: 0.2,
          unresolvedMimicCount: 0,
          weakEliminationCount: 0,
        }),
      },
      caseClueDiscriminatorAnnotation: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'annotation-1',
            clueOrder: 0,
            eliminatedDiagnosisId: 'registry-2',
            eliminatedDiagnosisName: 'Asthma',
            eliminationStrength: 'strong',
            reviewedAt: null,
            updatedAt: new Date('2026-01-01T02:06:00.000Z'),
          },
        ]),
      },
      reasoningPath: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'path-1',
            normalizedKey: 'pe-main',
            title: 'VTE reasoning',
            reasoningGoal: 'DIAGNOSE',
            generationPurpose: 'DAILY_CASE',
            readinessScore: 90,
            status: 'ACTIVE',
            reviewedByUserId: 'editor-2',
            reviewedAt: new Date('2026-01-01T02:10:00.000Z'),
            updatedAt: new Date('2026-01-01T02:10:00.000Z'),
          },
        ]),
      },
      diagnosisEvidenceRelationship: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'evidence-1',
            evidenceNodeId: 'node-1',
            relationshipType: 'SUPPORTS',
            status: 'ACTIVE',
            strength: 4,
            discriminatorWeight: 2,
            reviewedByUserId: 'editor-2',
            reviewedAt: null,
            updatedAt: new Date('2026-01-01T02:11:00.000Z'),
          },
        ]),
      },
      diagnosisTeachingRule: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'rule-1',
            stableKey: 'pleuritic-pain',
            title: 'Pleuritic pain',
            category: 'discriminator',
            importance: 'high',
            status: 'ACTIVE',
            version: 1,
            updatedAt: new Date('2026-01-01T02:12:00.000Z'),
          },
        ]),
      },
      diagnosisTeachingRelationship: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      aiDraftRevisionAudit: { findMany: jest.fn().mockResolvedValue([]) },
      caseClueRevisionDraft: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const quality = new CaseQualityProjectionService();
    const eligibility = {
      validatePlayableClues: jest
        .fn()
        .mockReturnValue({ valid: true, reasons: [] }),
    } as unknown as CaseEligibilityPolicyService;
    const service = new CaseReviewContextService(
      prisma as unknown as PrismaService,
      quality,
      eligibility,
    );

    return { service, prisma, caseRecord };
  }

  it('assembles representative canonical context and component hashes', async () => {
    const { service, prisma } = buildFixture();

    const context = await service.assembleContext({
      caseId: 'case-1',
      purpose: 'REVIEW_OPENING',
      assembledAt: new Date('2026-01-01T03:00:00.000Z'),
    });

    expect(context.schemaVersion).toBe(1);
    expect(context.caseIdentity.caseId).toBe('case-1');
    expect(context.caseRevision.id).toBe('revision-1');
    expect(context.validation.latestRunId).toBe('validation-1');
    expect(context.diagnosisReadiness.ready).toBe(true);
    expect(context.evidenceState.relationships).toHaveLength(1);
    expect(context.reasoningState.paths).toHaveLength(1);
    expect(context.teachingDependencies.rules).toHaveLength(1);
    expect(context.componentHashes.caseRevision).toHaveLength(64);
    expect(context.contentHash).toHaveLength(64);
    expect(context.blockers).toEqual([]);
    expect(prisma.reasoningPath.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { diagnosisRegistryId: 'registry-1' } }),
    );
  });

  it('handles missing optional diagnosis dependencies explicitly', async () => {
    const { service, prisma, caseRecord } = buildFixture();
    prisma.case.findUnique.mockResolvedValueOnce({
      ...caseRecord,
      diagnosisRegistryId: null,
      diagnosisRegistry: null,
      diagnosisMappingStatus: DiagnosisMappingStatus.UNRESOLVED,
      currentRevision: null,
      validationRuns: [],
      reviews: [],
      clues: [],
    });

    const context = await service.assembleContext({
      caseId: 'case-1',
      purpose: 'DECISION_SUBMISSION',
    });

    expect(context.caseRevision.id).toBeNull();
    expect(context.reasoningState.status).toBe('unavailable');
    expect(context.evidenceState.status).toBe('unavailable');
    expect(context.teachingDependencies.status).toBe('unavailable');
    expect(context.blockers.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        'MISSING_CURRENT_REVISION',
        'VALIDATION_NOT_PASSED',
        'DIAGNOSIS_NOT_READY',
      ]),
    );
  });
});
