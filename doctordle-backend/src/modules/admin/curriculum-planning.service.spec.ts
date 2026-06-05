import {
  DiagnosisEditorialOnboardingStatus,
  DiagnosisEducationStatus,
  DiagnosisGraphCandidateType,
  DiagnosisGraphFactStatus,
  DiagnosisRegistryStatus,
} from '@prisma/client';
import { CurriculumPlanningService } from './curriculum-planning.service';

const weakChestPain = {
  diagnosisRegistryId: 'registry-mi',
  diagnosisName: 'Myocardial Infarction',
  canonicalName: 'Myocardial Infarction',
  specialty: 'Cardiology',
  bodySystem: 'Cardiovascular',
  category: 'Emergency',
  lifecycleState: DiagnosisRegistryStatus.ACTIVE,
  onboardingState: DiagnosisEditorialOnboardingStatus.RULES_STARTED,
  lifecycle: {
    active: true,
    playable: true,
    generatable: true,
    readiness: 'active',
  },
  teaching: {
    ruleCount: 0,
    activeRuleCount: 0,
    requiredDifferentialCount: 0,
    rulesWithoutRequiredDifferentials: 0,
    discriminatorRuleCount: 0,
  },
  differentials: {
    requiredDifferentialCoverage: 0,
    linkedDifferentialCount: 1,
    unresolvedMappings: 1,
    weakBreadth: true,
    oneWayRelationships: 0,
  },
  education: {
    status: null,
    completeness: 'missing',
    version: null,
  },
  inventory: {
    caseCount: 0,
    playableCaseCount: 0,
    dailyInventoryCount: 0,
  },
  graph: {
    relationshipCount: 0,
    mimicRelationshipCount: 0,
    pendingCandidateCount: 0,
  },
  risk: {
    duplicateRisk: 0,
    mergeRisk: 0,
    reviewBacklog: 2,
  },
  weaknesses: [
    'missing_playable_cases',
    'missing_teaching_rules',
    'unresolved_differentials',
    'missing_graph_coverage',
  ],
  recommendations: {
    recommendedTeachingRuleGeneration: true,
    recommendedDifferentialExpansion: true,
    recommendedGraphExpansion: true,
    recommendedCaseGeneration: true,
  },
  targetUrl: '/editorial/diagnoses/registry-mi',
} as const;

const stableAbdomen = {
  ...weakChestPain,
  diagnosisRegistryId: 'registry-pud',
  diagnosisName: 'Peptic Ulcer Disease',
  canonicalName: 'Peptic Ulcer Disease',
  specialty: 'Gastroenterology',
  bodySystem: 'Gastrointestinal',
  onboardingState: DiagnosisEditorialOnboardingStatus.COMPLETE,
  teaching: {
    ruleCount: 4,
    activeRuleCount: 4,
    requiredDifferentialCount: 4,
    rulesWithoutRequiredDifferentials: 0,
    discriminatorRuleCount: 2,
  },
  differentials: {
    requiredDifferentialCoverage: 100,
    linkedDifferentialCount: 4,
    unresolvedMappings: 0,
    weakBreadth: false,
    oneWayRelationships: 0,
  },
  education: {
    status: DiagnosisEducationStatus.PUBLISHED,
    completeness: 'complete',
    version: 2,
  },
  inventory: {
    caseCount: 3,
    playableCaseCount: 2,
    dailyInventoryCount: 1,
  },
  graph: {
    relationshipCount: 2,
    mimicRelationshipCount: 1,
    pendingCandidateCount: 0,
  },
  risk: {
    duplicateRisk: 0,
    mergeRisk: 0,
    reviewBacklog: 0,
  },
  weaknesses: [],
  recommendations: {
    recommendedTeachingRuleGeneration: false,
    recommendedDifferentialExpansion: false,
    recommendedGraphExpansion: false,
    recommendedCaseGeneration: false,
  },
  targetUrl: '/editorial/diagnoses/registry-pud',
} as const;

function buildService() {
  const prisma = {
    diagnosisRegistry: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'registry-mi',
          displayLabel: 'Myocardial Infarction',
          canonicalName: 'Myocardial Infarction',
          specialty: 'Cardiology',
        },
        {
          id: 'registry-pud',
          displayLabel: 'Peptic Ulcer Disease',
          canonicalName: 'Peptic Ulcer Disease',
          specialty: 'Gastroenterology',
        },
      ]),
    },
    caseDifferentialLink: {
      findMany: jest.fn().mockResolvedValue([
        { caseId: 'case-1', diagnosisRegistryId: 'registry-mi' },
        { caseId: 'case-1', diagnosisRegistryId: 'registry-pud' },
      ]),
    },
    educationDifferentialLink: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    diagnosisGraphFact: {
      findMany: jest.fn().mockResolvedValue([
        {
          diagnosisRegistryId: 'registry-mi',
          targetDiagnosisRegistryId: 'registry-pud',
          type: DiagnosisGraphCandidateType.MIMIC,
          status: DiagnosisGraphFactStatus.ACTIVE,
        },
      ]),
    },
  };
  const coverage = {
    getOverview: jest.fn().mockResolvedValue({
      inventory: {
        inventoryExhaustionForecast: {
          scheduledDays: 1,
          assignableCases: 0,
          estimatedExhaustionDays: 1,
        },
      },
      differentialCoverage: { unresolvedDifferentials: 1 },
    }),
    getDiagnoses: jest
      .fn()
      .mockResolvedValue([weakChestPain, stableAbdomen]),
    getSpecialties: jest.fn().mockResolvedValue([
      {
        specialty: 'Cardiology',
        diagnosisCount: 1,
        playableDiagnosisCount: 1,
        caseCount: 0,
        dailyInventoryCount: 0,
        educationCoveragePercent: 0,
        graphCoveragePercent: 0,
        unresolvedDifferentialCount: 1,
        weakDiagnosisCount: 1,
      },
      {
        specialty: 'Gastroenterology',
        diagnosisCount: 1,
        playableDiagnosisCount: 1,
        caseCount: 3,
        dailyInventoryCount: 1,
        educationCoveragePercent: 100,
        graphCoveragePercent: 100,
        unresolvedDifferentialCount: 0,
        weakDiagnosisCount: 0,
      },
    ]),
  };

  return {
    service: new CurriculumPlanningService(prisma as never, coverage as never),
    coverage,
  };
}

describe('CurriculumPlanningService', () => {
  it('scores weak diagnoses deterministically and ranks them first', async () => {
    const { service } = buildService();

    const overview = await service.getOverview();

    expect(overview.priorityDiagnoses[0]).toMatchObject({
      diagnosisRegistryId: 'registry-mi',
      priorityTier: 'high',
      track: 'chest_pain',
    });
    expect(overview.priorityDiagnoses[0].priorityScore).toBe(100);
    expect(overview.priorityDiagnoses[0].priorityReasons).toEqual(
      expect.arrayContaining([
        'No playable cases',
        'No active teaching rules',
        'Unresolved differential mappings',
        'No graph coverage',
      ]),
    );
    expect(overview.priorityDiagnoses[1].diagnosisRegistryId).toBe(
      'registry-pud',
    );
  });

  it('detects specialty undercoverage and inventory risk', async () => {
    const { service } = buildService();

    const overview = await service.getOverview();

    expect(overview.inventoryPlanning.specialtiesAtRisk[0]).toMatchObject({
      specialty: 'Cardiology',
      caseCount: 0,
      weakDiagnosisCount: 1,
    });
    expect(overview.inventoryPlanning.noCaseDiagnoses[0].diagnosisRegistryId).toBe(
      'registry-mi',
    );
  });

  it('groups tracks and dependency clusters', async () => {
    const { service } = buildService();

    const overview = await service.getOverview();

    expect(overview.tracks.map((track) => track.track)).toEqual(
      expect.arrayContaining(['chest_pain', 'acute_abdomen']),
    );
    expect(overview.dependencyClusters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'shared_differential',
          diagnosisIds: expect.arrayContaining(['registry-mi', 'registry-pud']),
        }),
        expect.objectContaining({
          type: 'mimic',
          diagnosisIds: expect.arrayContaining(['registry-mi', 'registry-pud']),
        }),
      ]),
    );
  });

  it('generates advisory recommendations and planning hooks', async () => {
    const { service } = buildService();

    const [diagnosis] = await service.getDiagnoses({ priorityTier: 'high' });

    expect(diagnosis.recommendations).toEqual(
      expect.arrayContaining([
        'Generate additional discriminator teaching',
        'Needs at least 2 playable cases',
        'Expand differential breadth',
        'Resolve unresolved differential mappings',
        'Graph mimic coverage weak',
      ]),
    );
    expect(diagnosis.planningHooks).toMatchObject({
      suggestedTeachingRuleExpansion: true,
      suggestedDifferentialExpansion: true,
      suggestedGraphExpansion: true,
      suggestedCaseGeneration: true,
      suggestedReviewPriority: 'high',
    });
  });

  it('passes coverage filters and filters planner-specific fields', async () => {
    const { service, coverage } = buildService();

    const diagnoses = await service.getDiagnoses({
      specialty: 'Cardiology',
      onboardingStatus: 'RULES_STARTED',
      lifecycleState: 'ACTIVE',
      lifecycleReadiness: 'active',
      track: 'chest_pain',
      priorityTier: 'high',
      playableOnly: true,
    });

    expect(coverage.getDiagnoses).toHaveBeenCalledWith({
      specialty: 'Cardiology',
      lifecycleState: 'ACTIVE',
      onboardingState: 'RULES_STARTED',
      playableOnly: true,
    });
    expect(diagnoses).toHaveLength(1);
    expect(diagnoses[0].diagnosisRegistryId).toBe('registry-mi');
  });
});
