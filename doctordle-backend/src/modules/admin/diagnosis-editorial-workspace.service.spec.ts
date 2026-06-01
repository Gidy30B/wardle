import { NotFoundException } from '@nestjs/common';
import { CaseEditorialStatus } from '@prisma/client';
import { DiagnosisEditorialWorkspaceService } from './diagnosis-editorial-workspace.service';

describe('DiagnosisEditorialWorkspaceService', () => {
  const diagnosisRegistryId = 'diagnosis-1';
  const now = new Date('2026-06-01T12:00:00.000Z');
  let prisma: { diagnosisRegistry: { findUnique: jest.Mock } };
  let qualityService: { getSummary: jest.Mock };
  let coverageService: { getCoverage: jest.Mock };
  let teachingRulesService: { listRules: jest.Mock };
  let briefService: { getBrief: jest.Mock };
  let revisionAnalyzer: { listRevisions: jest.Mock };
  let caseQualityProjectionService: { buildProjection: jest.Mock };
  let graphCandidatesService: { listCandidates: jest.Mock };
  let service: DiagnosisEditorialWorkspaceService;

  beforeEach(() => {
    prisma = {
      diagnosisRegistry: {
        findUnique: jest.fn(),
      },
    };
    qualityService = {
      getSummary: jest.fn(),
    };
    coverageService = {
      getCoverage: jest.fn(),
    };
    teachingRulesService = {
      listRules: jest.fn(),
    };
    briefService = {
      getBrief: jest.fn(),
    };
    revisionAnalyzer = {
      listRevisions: jest.fn(),
    };
    caseQualityProjectionService = {
      buildProjection: jest.fn().mockReturnValue({
        dimensions: {},
        warnings: [],
        blockers: [],
        sourceSummary: {
          hasValidationRun: false,
          hasValidationFindings: false,
          hasGenerationQuality: false,
          hasTeachingAlignment: false,
        },
      }),
    };
    graphCandidatesService = {
      listCandidates: jest.fn(),
    };
    service = new DiagnosisEditorialWorkspaceService(
      prisma as never,
      qualityService as never,
      coverageService as never,
      teachingRulesService as never,
      briefService as never,
      revisionAnalyzer as never,
      caseQualityProjectionService as never,
      graphCandidatesService as never,
    );

    prisma.diagnosisRegistry.findUnique.mockResolvedValue(registry());
    qualityService.getSummary.mockResolvedValue(summary());
    coverageService.getCoverage.mockResolvedValue(coverage());
    teachingRulesService.listRules.mockResolvedValue({
      diagnosisRegistryId,
      diagnosisName: 'Appendicitis',
      rules: [rule()],
    });
    briefService.getBrief.mockResolvedValue({
      diagnosisRegistryId,
      diagnosisName: 'Appendicitis',
      brief: brief(),
    });
    revisionAnalyzer.listRevisions.mockResolvedValue({
      diagnosisRegistryId,
      revisions: [revision()],
    });
    graphCandidatesService.listCandidates.mockResolvedValue([]);
  });

  it('returns a complete unified projection for a diagnosis with full workspace data', async () => {
    const result = await service.getFullWorkspace(diagnosisRegistryId);

    expect(result.diagnosis.displayLabel).toBe('Appendicitis');
    expect(result.lifecycle.ready).toBe('complete');
    expect(result.workspaceSummary.status).toBe('ready');
    expect(result.coverageMatrix).toEqual([
      expect.objectContaining({
        teachingRuleId: 'rule-1',
        stableKey: 'rule_key',
        fullCoverageStatus: 'covered',
      }),
    ]);
    expect(result.teachingRules.summary.active).toBe(1);
    expect(result.editorialBrief.activeForGeneration).toBe(true);
    expect(result.education.id).toBe('education-1');
    expect(result.cases.summary.usable).toBe(1);
    expect(result.graph.readiness).toBe('fact_ready');
  });

  it('returns partial workspace and education action when teaching rules exist without education', async () => {
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      registry({ education: null, cases: [] }),
    );
    qualityService.getSummary.mockResolvedValue(
      summary({
        overallWorkspaceStatus: 'insufficient_data',
        educationQuality: {
          status: 'missing',
          version: null,
          score: null,
          graphReadiness: null,
          blockerCount: 0,
          warningCount: 0,
        },
        caseQuality: {
          status: 'missing',
          totalCases: 0,
          usableCases: 0,
          blockerCount: 0,
          warningCount: 0,
          strongestCaseId: null,
        },
      }),
    );
    coverageService.getCoverage.mockResolvedValue(
      coverage({
        teachingUnits: [
          coverageUnit({
            educationCoverage: 'unknown',
            caseCoverage: { count: 0, status: 'missing' },
            graphCoverage: 'covered',
            status: 'partial',
          }),
        ],
      }),
    );

    const result = await service.getFullWorkspace(diagnosisRegistryId);

    expect(result.lifecycle.education).toBe('not_started');
    expect(result.coverageGaps).toEqual([
      expect.objectContaining({
        missingCases: true,
        targetTab: 'cases',
      }),
    ]);
    expect(result.recommendedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'generate-education', enabled: true }),
      ]),
    );
  });

  it('shows case coverage gaps when education exists but cases are missing', async () => {
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(registry({ cases: [] }));
    coverageService.getCoverage.mockResolvedValue(
      coverage({
        teachingUnits: [
          coverageUnit({
            caseCoverage: { count: 0, status: 'missing' },
            status: 'partial',
            recommendedAction: 'Generate aligned case',
          }),
        ],
      }),
    );

    const result = await service.getFullWorkspace(diagnosisRegistryId);

    expect(result.cases.summary.total).toBe(0);
    expect(result.coverageGaps[0]).toEqual(
      expect.objectContaining({
        missingCases: true,
        recommendedAction: 'Generate aligned case',
      }),
    );
    expect(result.recommendedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'generate-targeted-case' }),
      ]),
    );
  });

  it('surfaces graph review action when candidates exist without active facts', async () => {
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      registry({ graphFacts: [] }),
    );
    qualityService.getSummary.mockResolvedValue(
      summary({
        graphReadiness: {
          status: 'review_needed',
          candidateCount: 1,
          factCount: 0,
          reviewableCandidateCount: 1,
        },
      }),
    );
    graphCandidatesService.listCandidates.mockResolvedValue([
      {
        id: 'candidate-1',
        status: 'CANDIDATE',
        type: 'MIMIC',
        rawText: 'Ovarian torsion',
      },
    ]);

    const result = await service.getFullWorkspace(diagnosisRegistryId);

    expect(result.graph.readiness).toBe('review_needed');
    expect(result.graph.reviewableCandidateCount).toBe(1);
    expect(result.recommendedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'review-graph-candidates' }),
      ]),
    );
  });

  it('returns a safe empty curriculum state when no teaching rules exist', async () => {
    teachingRulesService.listRules.mockResolvedValue({
      diagnosisRegistryId,
      diagnosisName: 'Appendicitis',
      rules: [],
    });
    coverageService.getCoverage.mockResolvedValue(coverage({ teachingUnits: [] }));

    const result = await service.getFullWorkspace(diagnosisRegistryId);

    expect(result.lifecycle.curriculum).toBe('not_started');
    expect(result.teachingRules.summary.total).toBe(0);
    expect(result.coverageMatrix).toEqual([]);
  });

  it('keeps partial data when an optional subsystem fails', async () => {
    graphCandidatesService.listCandidates.mockRejectedValue(new Error('graph offline'));

    const result = await service.getFullWorkspace(diagnosisRegistryId);

    expect(result.graph.candidates).toEqual([]);
    expect(result.workspaceSummary.warnings).toEqual(
      expect.arrayContaining([
        'Unable to load graph candidates: graph offline',
      ]),
    );
  });

  it('throws not found when the diagnosis registry entry is missing', async () => {
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(null);

    await expect(service.getFullWorkspace(diagnosisRegistryId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  function registry(overrides: Record<string, unknown> = {}) {
    return {
      id: diagnosisRegistryId,
      canonicalName: 'appendicitis',
      displayLabel: 'Appendicitis',
      specialty: 'Surgery',
      category: 'Acute abdomen',
      bodySystem: 'Gastrointestinal',
      difficultyBand: 'BASIC',
      aliases: [{ term: 'acute appendicitis' }],
      education: {
        id: 'education-1',
        editorialStatus: 'PUBLISHED',
        version: 2,
        updatedAt: now,
      },
      editorialBrief: brief(),
      cases: [
        {
          id: 'case-1',
          title: 'RLQ pain',
          difficulty: 'medium',
          editorialStatus: CaseEditorialStatus.APPROVED,
          updatedAt: now,
          explanation: {},
          validationRuns: [],
        },
      ],
      graphFacts: [
        {
          id: 'fact-1',
          type: 'MIMIC',
          label: 'Ovarian torsion',
          targetDiagnosisRegistryId: 'target-1',
          updatedAt: now,
        },
      ],
      ...overrides,
    };
  }

  function brief() {
    return {
      id: 'brief-1',
      status: 'ACTIVE',
      version: 3,
      summary: 'Teach appendicitis as a progressive RLQ pain pattern.',
      updatedAt: now,
    };
  }

  function rule(overrides: Record<string, unknown> = {}) {
    return {
      id: 'rule-1',
      diagnosisRegistryId,
      stableKey: 'rule_key',
      title: 'Migratory RLQ pain',
      category: 'finding_concept',
      importance: 'critical',
      rationale: null,
      acceptableManifestations: [],
      requiredDifferentials: [],
      expectedEvidence: {},
      difficultyHints: {},
      avoidTooEarly: false,
      appliesToEducation: true,
      appliesToCaseGeneration: true,
      appliesToGraph: true,
      status: 'ACTIVE',
      source: 'EDITOR_CREATED',
      version: 1,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      ...overrides,
    };
  }

  function coverage(overrides: Record<string, unknown> = {}) {
    return {
      diagnosisRegistryId,
      diagnosisName: 'Appendicitis',
      teachingUnits: [coverageUnit()],
      ...overrides,
    };
  }

  function coverageUnit(overrides: Record<string, unknown> = {}) {
    return {
      id: 'rule_key',
      title: 'Migratory RLQ pain',
      source: 'persisted_teaching_rule',
      status: 'covered',
      educationCoverage: 'covered',
      caseCoverage: {
        count: 1,
        status: 'covered',
      },
      graphCoverage: 'covered',
      relatedSections: ['summary'],
      relatedCaseIds: ['case-1'],
      relatedGraphFactIds: ['fact-1'],
      warnings: [],
      recommendedAction: 'Ready',
      ...overrides,
    };
  }

  function revision(): Record<string, unknown> {
    return {
      id: 'revision-1',
      educationId: 'education-1',
      version: 2,
      editorialStatus: 'PUBLISHED',
      source: 'GENERATED',
      createdByUserId: null,
      createdAt: now.toISOString(),
      changedSections: ['management'],
      quality: {
        overallScore: 0.92,
        graphReadiness: 0.9,
        sectionScores: {},
        coverageScores: { overall: 0.95 },
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

  function summary(overrides: Record<string, unknown> = {}) {
    return {
      diagnosisRegistryId,
      diagnosisName: 'Appendicitis',
      overallWorkspaceStatus: 'ready',
      educationQuality: {
        status: 'published',
        version: 2,
        score: 0.92,
        graphReadiness: 0.9,
        blockerCount: 0,
        warningCount: 0,
      },
      caseQuality: {
        status: 'good',
        totalCases: 1,
        usableCases: 1,
        blockerCount: 0,
        warningCount: 0,
        strongestCaseId: 'case-1',
      },
      teachingCoverage: {
        overall: 0.95,
        scores: { overall: 0.95 },
        missingItems: [],
      },
      graphReadiness: {
        status: 'fact_ready',
        candidateCount: 0,
        factCount: 1,
        reviewableCandidateCount: 0,
      },
      editorialBrief: {
        status: 'ACTIVE',
        version: 3,
        activeForGeneration: true,
      },
      revisionTrend: {
        latestVersion: 2,
        previousVersion: 1,
        overallDelta: 0.1,
        graphReadinessDelta: 0.1,
        direction: 'improved',
      },
      sectionHealth: [],
      blockers: [],
      warnings: [],
      recommendedNextActions: [],
      ...overrides,
    };
  }
});
