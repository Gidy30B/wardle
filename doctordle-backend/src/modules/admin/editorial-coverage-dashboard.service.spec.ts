import {
  CaseEditorialStatus,
  DiagnosisEditorialOnboardingStatus,
  DiagnosisRegistryStatus,
} from '@prisma/client';
import { EditorialCoverageDashboardService } from './editorial-coverage-dashboard.service';
import { EditorialTriageProjectionService } from './editorial-triage-projection.service';

describe('EditorialCoverageDashboardService unsupported claim aggregation', () => {
  const now = new Date('2026-06-01T12:00:00.000Z');
  let prisma: { reasoningDraftValidationRun: { findMany: jest.Mock } };
  let service: EditorialCoverageDashboardService;

  beforeEach(() => {
    prisma = {
      reasoningDraftValidationRun: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    service = new EditorialCoverageDashboardService(
      prisma as never,
      {
        isRegistryPlayable: jest.fn().mockReturnValue(true),
        isGameplayEditorialStatus: jest.fn().mockReturnValue(true),
        validatePlayableClues: jest.fn().mockReturnValue({ valid: true }),
      } as never,
      {} as never,
      new EditorialTriageProjectionService(),
      undefined,
    );

    jest
      .spyOn(service as never, 'loadDiagnosisRows')
      .mockResolvedValue([diagnosisRow()]);
    jest
      .spyOn(service as never, 'loadDuplicateRiskCounts')
      .mockResolvedValue(new Map([['diagnosis-1', 0]]));
    jest
      .spyOn(service as never, 'loadReviewBacklogCounts')
      .mockResolvedValue(new Map([['diagnosis-1', 0]]));
    jest
      .spyOn(service as never, 'loadOneWayGraphTargets')
      .mockResolvedValue(new Set());
  });

  it('puts diagnoses with unsupported claims into the unsupported_claims queue', async () => {
    prisma.reasoningDraftValidationRun.findMany.mockResolvedValue([
      validationRun({
        unsupportedClaimSignals: [
          {
            sectionId: 'management',
            sectionType: 'education',
            claimId: 'claim-1',
            claimText: 'Antibiotics always cure appendicitis',
          },
        ],
      }),
    ]);

    const [diagnosis] = await service.getDiagnoses();

    expect(diagnosis.unsupportedClaims.unsupportedClaimCount).toBe(1);
    expect(diagnosis.unsupportedClaims.unsupportedClaimSectionTypes).toEqual([
      'education',
    ]);
    expect(diagnosis.unsupportedClaims.unsupportedClaimSignalsPreview[0]).toEqual(
      expect.objectContaining({
        claimId: 'claim-1',
        sectionId: 'management',
        sectionType: 'education',
        targetTab: 'education',
        repairable: true,
        severity: 'warning',
        blocksPublication: false,
      }),
    );
    expect(queueIds(diagnosis)).toContain('unsupported_claims');
  });

  it('raises publication risk for blocking unsupported claims', async () => {
    prisma.reasoningDraftValidationRun.findMany.mockResolvedValue([
      validationRun({
        trustTier: 'BLOCKED',
        validationStatus: 'FAILED',
        unsupportedClaimSignals: [
          {
            sectionId: 'management',
            sectionType: 'education',
            claimId: 'claim-1',
            claimText: 'CT is never needed',
          },
        ],
      }),
    ]);

    const [diagnosis] = await service.getDiagnoses();

    expect(diagnosis.unsupportedClaims.blockingUnsupportedClaimCount).toBe(1);
    expect(diagnosis.editorialTriage.publicationRisk.score).toBeGreaterThan(0);
  });

  it('returns a stable empty unsupported-claim payload without validation runs', async () => {
    const [diagnosis] = await service.getDiagnoses();

    expect(diagnosis.unsupportedClaims).toEqual({
      unsupportedClaimCount: 0,
      blockingUnsupportedClaimCount: 0,
      unsupportedClaimSeveritySummary: { blocker: 0, warning: 0 },
      unsupportedClaimSectionTypes: [],
      unsupportedClaimSignalsPreview: [],
    });
  });

  it('dedupes repeated claim signals across multiple validation runs', async () => {
    prisma.reasoningDraftValidationRun.findMany.mockResolvedValue([
      validationRun({
        id: 'run-1',
        unsupportedClaimSignals: [
          {
            sectionId: 'management',
            sectionType: 'education',
            claimId: 'claim-1',
            claimText: 'Appendicitis always requires surgery',
          },
        ],
      }),
      validationRun({
        id: 'run-2',
        unsupportedClaimSignals: [
          {
            sectionId: 'management',
            sectionType: 'education',
            claimId: 'claim-1',
            claimText: 'Appendicitis always requires surgery',
          },
        ],
      }),
    ]);

    const [diagnosis] = await service.getDiagnoses();

    expect(diagnosis.unsupportedClaims.unsupportedClaimCount).toBe(1);
    expect(diagnosis.unsupportedClaims.unsupportedClaimSignalsPreview).toHaveLength(1);
  });

  it('caps previews and degrades safely when claim metadata is missing', async () => {
    prisma.reasoningDraftValidationRun.findMany.mockResolvedValue([
      validationRun({
        unsupportedClaimSignals: [
          { message: 'Claim one needs support' },
          { message: 'Claim two needs support' },
          { message: 'Claim three needs support' },
          { message: 'Claim four needs support' },
        ],
      }),
    ]);

    const [diagnosis] = await service.getDiagnoses();

    expect(diagnosis.unsupportedClaims.unsupportedClaimCount).toBe(4);
    expect(diagnosis.unsupportedClaims.unsupportedClaimSignalsPreview).toHaveLength(3);
    expect(diagnosis.unsupportedClaims.unsupportedClaimSignalsPreview[0]).toEqual(
      expect.objectContaining({
        claimId: expect.any(String),
        sectionId: 'EDUCATION_SECTION:education-1',
        targetTab: 'education',
        repairable: true,
      }),
    );
  });

  function diagnosisRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'diagnosis-1',
      canonicalName: 'appendicitis',
      canonicalNormalized: 'appendicitis',
      displayLabel: 'Appendicitis',
      status: DiagnosisRegistryStatus.ACTIVE,
      active: true,
      isPlayable: true,
      isGeneratable: true,
      onboardingStatus: DiagnosisEditorialOnboardingStatus.COMPLETE,
      specialty: 'General Surgery',
      bodySystem: 'Gastrointestinal',
      category: 'Acute abdomen',
      updatedAt: now,
      education: {
        editorialStatus: 'APPROVED',
        publishedAt: now,
        version: 1,
        differentials: ['torsion'],
        examPearls: ['RLQ tenderness'],
        investigations: ['CBC'],
        management: ['Surgery consult'],
        pitfalls: ['Missed ectopic pregnancy'],
      },
      editorialBrief: { status: 'ACTIVE', version: 1 },
      teachingRules: [
        {
          id: 'rule-1',
          status: 'ACTIVE',
          category: 'differential_concept',
          requiredDifferentials: ['ovarian torsion'],
          appliesToGraph: true,
          appliesToCaseGeneration: true,
        },
      ],
      cases: [
        {
          id: 'case-1',
          editorialStatus: CaseEditorialStatus.APPROVED,
          diagnosisMappingStatus: 'MATCHED',
          clues: [{ type: 'symptom', value: 'RLQ pain' }],
          explanation: { summary: 'Appendicitis' },
          dailyCases: [],
        },
      ],
      graphFacts: [
        {
          id: 'fact-1',
          type: 'MIMIC',
          targetDiagnosisRegistryId: 'target-1',
        },
      ],
      sourceTeachingRelationships: [
        { id: 'rel-1', targetDiagnosisRegistryId: 'target-1' },
      ],
      evidenceRelationships: [],
      graphCandidates: [],
      caseDifferentialLinks: [
        { id: 'case-diff-1', diagnosisRegistryId: 'target-1', role: 'mimic' },
      ],
      educationDifferentialLinks: [],
      ...overrides,
    };
  }

  function validationRun(overrides: Record<string, unknown> = {}) {
    return {
      id: 'run-1',
      diagnosisRegistryId: 'diagnosis-1',
      artifactType: 'EDUCATION_SECTION',
      artifactId: 'education-1',
      trustTier: 'LOW_TRUST',
      validationStatus: 'NEEDS_REVIEW',
      unsupportedClaimSignals: [],
      createdAt: now,
      ...overrides,
    };
  }

  function queueIds(diagnosis: Awaited<ReturnType<EditorialCoverageDashboardService['getDiagnoses']>>[number]) {
    return diagnosis.editorialTriage.workflowQueues.map((queue) => queue.id);
  }
});
