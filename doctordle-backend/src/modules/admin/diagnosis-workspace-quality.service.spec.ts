import {
  CaseEditorialStatus,
  DiagnosisEducationStatus,
  DiagnosisGraphCandidateStatus,
  DiagnosisGraphFactStatus,
  ValidationOutcome,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { EducationRevisionQualityAnalyzer } from '../education/education-revision-quality-analyzer.service';
import { CaseQualityProjectionService } from './case-quality-projection.service';
import { DiagnosisWorkspaceQualityService } from './diagnosis-workspace-quality.service';

describe('DiagnosisWorkspaceQualityService', () => {
  let prisma: { diagnosisRegistry: { findUnique: jest.Mock } };
  let analyzer: { listRevisions: jest.Mock };
  let service: DiagnosisWorkspaceQualityService;

  beforeEach(() => {
    prisma = {
      diagnosisRegistry: {
        findUnique: jest.fn(),
      },
    };
    analyzer = {
      listRevisions: jest.fn(),
    };
    service = new DiagnosisWorkspaceQualityService(
      prisma as unknown as PrismaService,
      analyzer as unknown as EducationRevisionQualityAnalyzer,
      new CaseQualityProjectionService(),
    );
  });

  it('returns a ready workspace', async () => {
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      registry({
        educationStatus: DiagnosisEducationStatus.PUBLISHED,
        cases: [strongCase()],
        graphFacts: [{ id: 'fact-1', status: DiagnosisGraphFactStatus.ACTIVE }],
      }),
    );
    analyzer.listRevisions.mockResolvedValue({
      revisions: [
        revision({
          version: 2,
          quality: { overallScore: 0.9, graphReadiness: 0.9 },
        }),
      ],
    });

    const result = await service.getSummary('registry-1');

    expect(result.overallWorkspaceStatus).toBe('ready');
    expect(result.educationQuality.score).toBe(0.9);
    expect(result.caseQuality.status).toBe('good');
    expect(result.graphReadiness.status).toBe('fact_ready');
    expect(result.editorialBrief.status).toBe(null);
  });

  it('shows editorial brief status', async () => {
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      registry({
        educationStatus: DiagnosisEducationStatus.PUBLISHED,
        cases: [strongCase()],
        graphFacts: [{ id: 'fact-1', status: DiagnosisGraphFactStatus.ACTIVE }],
        editorialBrief: { status: 'ACTIVE', version: 3 },
      }),
    );
    analyzer.listRevisions.mockResolvedValue({ revisions: [revision()] });

    const result = await service.getSummary('registry-1');

    expect(result.editorialBrief).toEqual({
      status: 'ACTIVE',
      version: 3,
      activeForGeneration: true,
    });
  });

  it('is blocked by education blockers', async () => {
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      registry({
        educationStatus: DiagnosisEducationStatus.NEEDS_REVIEW,
        cases: [strongCase()],
        graphFacts: [{ id: 'fact-1', status: DiagnosisGraphFactStatus.ACTIVE }],
      }),
    );
    analyzer.listRevisions.mockResolvedValue({
      revisions: [
        revision({
          quality: {
            blockers: ['no_comparative_differentials'],
            blockerCount: 1,
            sectionHealth: [
              sectionHealth({
                section: 'differentials',
                regenerationRecommended: true,
              }),
            ],
          },
        }),
      ],
    });

    const result = await service.getSummary('registry-1');

    expect(result.overallWorkspaceStatus).toBe('blocked');
    expect(result.blockers).toContain('education:no_comparative_differentials');
    expect(result.recommendedNextActions).toContain('Regenerate differentials');
  });

  it('is blocked by weak case quality', async () => {
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      registry({
        educationStatus: DiagnosisEducationStatus.PUBLISHED,
        cases: [weakCase()],
        graphFacts: [{ id: 'fact-1', status: DiagnosisGraphFactStatus.ACTIVE }],
      }),
    );
    analyzer.listRevisions.mockResolvedValue({
      revisions: [revision()],
    });

    const result = await service.getSummary('registry-1');

    expect(result.overallWorkspaceStatus).toBe('blocked');
    expect(result.caseQuality.status).toBe('blocker');
    expect(result.recommendedNextActions).toContain('Add or approve more cases');
  });

  it('returns insufficient data when education and usable cases are missing', async () => {
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      registry({
        educationStatus: null,
        cases: [],
        graphFacts: [],
      }),
    );
    analyzer.listRevisions.mockResolvedValue({ revisions: [] });

    const result = await service.getSummary('registry-1');

    expect(result.overallWorkspaceStatus).toBe('insufficient_data');
    expect(result.educationQuality.status).toBe('missing');
    expect(result.caseQuality.status).toBe('missing');
  });

  it('generates recommended actions from weak sections, cases, graph, and education status', async () => {
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      registry({
        educationStatus: DiagnosisEducationStatus.NEEDS_REVIEW,
        cases: [weakCase()],
        graphCandidates: [
          { id: 'candidate-1', status: DiagnosisGraphCandidateStatus.CANDIDATE },
        ],
        graphFacts: [],
      }),
    );
    analyzer.listRevisions.mockResolvedValue({
      revisions: [
        revision({
          quality: {
            warnings: ['weak_management_anchor_usefulness'],
            warningCount: 1,
            sectionHealth: [
              sectionHealth({
                section: 'investigations',
                regenerationRecommended: true,
              }),
              sectionHealth({
                section: 'management',
                warnings: ['weak_management_anchor_usefulness'],
              }),
            ],
          },
        }),
      ],
    });

    const result = await service.getSummary('registry-1');

    expect(result.recommendedNextActions).toEqual(
      expect.arrayContaining([
        'Regenerate investigations',
        'Review weak management anchors',
        'Add or approve more cases',
        'Improve graph discriminator coverage',
        'Publish education after blocker resolution',
      ]),
    );
  });
});

function registry(input: {
  educationStatus: DiagnosisEducationStatus | null;
  cases: unknown[];
  graphCandidates?: unknown[];
  graphFacts: unknown[];
  editorialBrief?: { status: string; version: number } | null;
}) {
  return {
    id: 'registry-1',
    canonicalName: 'appendicitis',
    displayLabel: 'Appendicitis',
    education: input.educationStatus
      ? { editorialStatus: input.educationStatus, version: 2 }
      : null,
    cases: input.cases,
    graphCandidates: input.graphCandidates ?? [],
    graphFacts: input.graphFacts,
    editorialBrief: input.editorialBrief ?? null,
  };
}

function revision(overrides: Partial<ReturnType<typeof revisionBase>> = {}) {
  return {
    ...revisionBase(),
    ...overrides,
    quality: {
      ...revisionBase().quality,
      ...(overrides.quality ?? {}),
    },
  };
}

function revisionBase() {
  return {
    id: 'revision-2',
    educationId: 'education-1',
    version: 2,
    editorialStatus: DiagnosisEducationStatus.PUBLISHED,
    source: 'AI_ASSISTED',
    createdByUserId: 'user-1',
    createdAt: '2026-01-02T00:00:00.000Z',
    changedSections: [],
    quality: {
      overallScore: 0.85,
      graphReadiness: 0.85,
      sectionScores: {},
      coverageScores: { overall: 1 },
      patternComplianceScores: {},
      warnings: [],
      blockers: [],
      coverageWarnings: [],
      sectionHealth: [],
      warningCount: 0,
      blockerCount: 0,
    },
  };
}

function sectionHealth(overrides: Record<string, unknown>) {
  return {
    section: 'differentials',
    score: 0.5,
    coverageScore: 1,
    patternComplianceScore: 1,
    blockers: [],
    warnings: [],
    regenerationRecommended: false,
    reason: null,
    ...overrides,
  };
}

function strongCase() {
  return {
    id: 'case-good',
    editorialStatus: CaseEditorialStatus.APPROVED,
    difficulty: 'medium',
    explanation: {
      generationQuality: {
        differentialPlausibilityScore: 0.92,
        clinicalEdgeValidityScore: 0.9,
        qualityScore: 0.88,
        teachingAlignment: {
          selectedUnits: [
            { id: 'migration', label: 'Migration', importance: 'critical', covered: true },
          ],
          revealTiming: { giveawayTooEarly: false, issues: [] },
          mimicPersistence: {
            earlyMimicsPresent: ['gastroenteritis'],
            issues: [],
          },
          playability: { score: 90, difficultyFit: 'fits', issues: [] },
          warnings: [],
        },
      },
    },
    validationRuns: [
      {
        outcome: ValidationOutcome.PASSED,
        summary: {},
        findings: { issues: [] },
      },
    ],
  };
}

function weakCase() {
  return {
    id: 'case-weak',
    editorialStatus: CaseEditorialStatus.APPROVED,
    difficulty: 'medium',
    explanation: null,
    validationRuns: [
      {
        outcome: ValidationOutcome.FAILED,
        summary: {},
        findings: {
          issues: [
            {
              validator: 'clue',
              severity: 'error',
              code: 'CLUES_TOO_SHORT',
              message: 'Too few clues',
            },
          ],
        },
      },
    ],
  };
}
