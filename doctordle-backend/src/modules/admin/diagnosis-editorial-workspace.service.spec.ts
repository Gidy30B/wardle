import { NotFoundException } from '@nestjs/common';
import { CaseEditorialStatus } from '@prisma/client';
import { DiagnosisEditorialWorkspaceService } from './diagnosis-editorial-workspace.service';

describe('DiagnosisEditorialWorkspaceService', () => {
  const diagnosisRegistryId = 'diagnosis-1';
  const now = new Date('2026-06-01T12:00:00.000Z');
  let prisma: {
    diagnosisRegistry: { findUnique: jest.Mock };
    reasoningDraftValidationRun: { findMany: jest.Mock };
    caseLearningGoalCoverage: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    caseEscalationAnnotation: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    aiDraftRevisionAudit: {
      findMany: jest.Mock;
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    diagnosisEducation: { findUnique: jest.Mock; update: jest.Mock };
    case: { findFirst: jest.Mock };
  };
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
      reasoningDraftValidationRun: {
        findMany: jest.fn(),
      },
      caseLearningGoalCoverage: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      caseEscalationAnnotation: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      aiDraftRevisionAudit: {
        findMany: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      diagnosisEducation: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      case: {
        findFirst: jest.fn(),
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
    prisma.reasoningDraftValidationRun.findMany.mockResolvedValue([]);
    prisma.caseLearningGoalCoverage.findMany.mockResolvedValue([]);
    prisma.caseEscalationAnnotation.findMany.mockResolvedValue([]);
    prisma.aiDraftRevisionAudit.findMany.mockResolvedValue([]);
    prisma.aiDraftRevisionAudit.create.mockResolvedValue({
      id: 'repair-1',
      reviewStatus: 'PENDING_REVIEW',
    });
    prisma.aiDraftRevisionAudit.findFirst.mockResolvedValue(null);
    prisma.aiDraftRevisionAudit.update.mockResolvedValue({
      id: 'audit-1',
      reviewStatus: 'ACCEPTED',
    });
    prisma.diagnosisEducation.findUnique.mockResolvedValue({
      id: 'education-1',
      editorialStatus: 'DRAFT',
      management: [],
    });
    prisma.diagnosisEducation.update.mockResolvedValue({ id: 'education-1' });
    prisma.case.findFirst.mockResolvedValue({ id: 'case-1' });
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
    expect(result.maturityBreakdown).toEqual(
      expect.objectContaining({ overall: expect.any(Number) }),
    );
  });

  it('returns unsupported claims grouped by section', async () => {
    prisma.reasoningDraftValidationRun.findMany.mockResolvedValue([
      {
        id: 'run-1',
        artifactType: 'EDUCATION_SECTION',
        artifactId: 'education-1',
        trustTier: 'BLOCKED',
        validationStatus: 'FAILED',
        unsupportedClaimSignals: [
          {
            sectionId: 'management',
            sectionType: 'education',
            claimId: 'claim-1',
            claimText: 'Antibiotics always cure appendicitis',
            evidenceIds: ['evidence-1'],
          },
        ],
        createdAt: now,
      },
    ]);

    const result = await service.getFullWorkspace(diagnosisRegistryId);

    expect(result.unsupportedClaimsBySection).toEqual([
      expect.objectContaining({
        claimId: 'claim-1',
        sectionId: 'management',
        blocksPublication: true,
      }),
    ]);
    expect(result.editorialPrioritization.publicationRisk.score).toBeGreaterThan(0);
    expect(result.editorialPrioritization.highestImpactFixes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'repair_unsupported_claims',
          targetTab: 'education',
        }),
      ]),
    );
  });

  it('uses persisted case-to-learning-goal coverage when available', async () => {
    prisma.caseLearningGoalCoverage.findMany.mockResolvedValue([
      {
        caseId: 'case-1',
        case: { id: 'case-1', title: 'RLQ pain' },
        learningGoalId: 'goal-1',
        learningGoal: 'Distinguish appendicitis from ovarian torsion',
        coverageStrength: 85,
        coveredDiscriminators: ['migration'],
        missingDiscriminators: [],
        coveredMimics: ['torsion'],
        missingMimics: [],
        evidenceSource: 'editorial_annotation',
        updatedAt: now,
      },
    ]);

    const result = await service.getFullWorkspace(diagnosisRegistryId);

    expect(result.caseLearningGoalCoverage).toEqual([
      expect.objectContaining({
        caseId: 'case-1',
        learningGoalId: 'goal-1',
        coverageStrength: 85,
      }),
    ]);
    expect(result.learningGoalCoverage).toEqual([
      expect.objectContaining({
        learningGoalId: 'goal-1',
        coveredByCaseIds: ['case-1'],
        coveragePct: 85,
      }),
    ]);
  });

  it('uses explicit escalation annotations before inferred fallback', async () => {
    prisma.caseEscalationAnnotation.findMany.mockResolvedValue([
      {
        caseId: 'case-1',
        case: { id: 'case-1', title: 'RLQ pain' },
        escalationType: 'sepsis',
        covered: true,
        evidenceStrength: 90,
        reasoningPathId: null,
        notes: 'Explicitly reviewed',
        updatedAt: now,
      },
    ]);

    const result = await service.getFullWorkspace(diagnosisRegistryId);

    expect(result.caseEscalationCoverage).toEqual([
      expect.objectContaining({
        escalationType: 'sepsis',
        coverageSource: 'explicit',
        status: 'explicitly_covered',
      }),
    ]);
    expect(result.escalationCoverage.coversEscalation).toBe(true);
  });

  it('creates a draft audit entry for claim repair', async () => {
    prisma.reasoningDraftValidationRun.findMany.mockResolvedValue([
      {
        id: 'run-1',
        artifactType: 'EDUCATION_SECTION',
        artifactId: 'education-1',
        trustTier: 'BLOCKED',
        validationStatus: 'FAILED',
        unsupportedClaimSignals: [
          {
            sectionId: 'management',
            claimId: 'claim-1',
            claimText: 'Appendicitis always requires surgery',
            evidenceIds: ['evidence-1'],
          },
        ],
        createdAt: now,
      },
    ]);

    const result = await service.repairUnsupportedClaim({
      diagnosisRegistryId,
      claimId: 'claim-1',
      userId: 'admin-1',
    });

    expect(prisma.aiDraftRevisionAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actionType: 'repair_unsupported_claim',
          reviewStatus: 'PENDING_REVIEW',
          createdByUserId: 'admin-1',
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        repairId: 'repair-1',
        auditId: 'repair-1',
        targetClaimId: 'claim-1',
        targetSectionId: 'management',
        targetTab: 'education',
        originalClaim: 'Appendicitis always requires surgery',
        proposedClaim: expect.stringContaining('can'),
        reviewStatus: 'PENDING_REVIEW',
      }),
    );
  });

  it('accepts a draft repair and applies it only to a draft education artifact', async () => {
    prisma.aiDraftRevisionAudit.findFirst.mockResolvedValue({
      id: 'audit-1',
      diagnosisRegistryId,
      affectedArtifactType: 'EDUCATION_SECTION',
      affectedArtifactId: 'education-1',
      sourceIssue: { sectionId: 'management' },
      generatedOutput: {
        originalClaim: 'Appendicitis always requires surgery',
        proposedClaim: 'Appendicitis can require surgery.',
        evidenceIds: ['evidence-1'],
      },
    });

    await service.decideAiDraftRevision({
      diagnosisRegistryId,
      auditId: 'audit-1',
      decision: 'accept',
      userId: 'admin-1',
      note: 'Looks good',
    });

    expect(prisma.diagnosisEducation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'education-1' },
        data: expect.objectContaining({
          editorialStatus: 'DRAFT',
          management: expect.arrayContaining([
            expect.objectContaining({
              type: 'CLAIM_REPAIR',
              originalClaim: 'Appendicitis always requires surgery',
              acceptedClaim: 'Appendicitis can require surgery.',
              proposedClaim: 'Appendicitis can require surgery.',
              evidenceIds: ['evidence-1'],
              reviewerUserId: 'admin-1',
              sourceAuditId: 'audit-1',
            }),
          ]),
        }),
      }),
    );
    expect(prisma.aiDraftRevisionAudit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reviewStatus: 'ACCEPTED',
          reviewerUserId: 'admin-1',
          reviewNote: 'Looks good',
        }),
      }),
    );
  });

  it('does not duplicate an accepted repair for the same audit', async () => {
    prisma.aiDraftRevisionAudit.findFirst.mockResolvedValue({
      id: 'audit-1',
      diagnosisRegistryId,
      affectedArtifactType: 'EDUCATION_SECTION',
      affectedArtifactId: 'education-1',
      sourceIssue: { sectionId: 'management' },
      generatedOutput: {
        originalClaim: 'Appendicitis always requires surgery',
        proposedClaim: 'Appendicitis can require surgery.',
        evidenceIds: ['evidence-1'],
      },
    });
    prisma.diagnosisEducation.findUnique.mockResolvedValue({
      id: 'education-1',
      editorialStatus: 'DRAFT',
      management: [
        {
          type: 'CLAIM_REPAIR',
          originalClaim: 'Appendicitis always requires surgery',
          acceptedClaim: 'Appendicitis can require surgery.',
          sourceAuditId: 'audit-1',
        },
      ],
    });

    await service.decideAiDraftRevision({
      diagnosisRegistryId,
      auditId: 'audit-1',
      decision: 'accept',
      userId: 'admin-1',
    });

    const updateArg = prisma.diagnosisEducation.update.mock.calls[0][0];
    expect(updateArg.data.management).toHaveLength(1);
  });

  it('does not apply accepted repairs to published education artifacts', async () => {
    prisma.aiDraftRevisionAudit.findFirst.mockResolvedValue({
      id: 'audit-1',
      diagnosisRegistryId,
      affectedArtifactType: 'EDUCATION_SECTION',
      affectedArtifactId: 'education-1',
      sourceIssue: { sectionId: 'management' },
      generatedOutput: {
        originalClaim: 'Appendicitis always requires surgery',
        proposedClaim: 'Appendicitis can require surgery.',
        evidenceIds: ['evidence-1'],
      },
    });
    prisma.diagnosisEducation.findUnique.mockResolvedValue({
      id: 'education-1',
      editorialStatus: 'PUBLISHED',
      management: [],
    });

    await expect(
      service.decideAiDraftRevision({
        diagnosisRegistryId,
        auditId: 'audit-1',
        decision: 'accept',
        userId: 'admin-1',
      }),
    ).rejects.toThrow('Accepted claim repairs can only update draft education artifacts');
    expect(prisma.diagnosisEducation.update).not.toHaveBeenCalled();
  });

  it('returns accepted repairs from draft education section payload', async () => {
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      registry({
        education: {
          id: 'education-1',
          editorialStatus: 'DRAFT',
          version: 3,
          updatedAt: now,
          management: [
            {
              type: 'CLAIM_REPAIR',
              originalClaim: 'Appendicitis always requires surgery',
              acceptedClaim: 'Appendicitis can require surgery.',
              evidenceIds: ['evidence-1'],
              acceptedAt: now.toISOString(),
              reviewerUserId: 'admin-1',
              sourceAuditId: 'audit-1',
            },
          ],
        },
      }),
    );

    const result = await service.getFullWorkspace(diagnosisRegistryId);

    expect(result.education.acceptedRepairs).toEqual([
      expect.objectContaining({
        section: 'management',
        originalClaim: 'Appendicitis always requires surgery',
        acceptedClaim: 'Appendicitis can require surgery.',
        evidenceIds: ['evidence-1'],
        reviewerUserId: 'admin-1',
        sourceAuditId: 'audit-1',
      }),
    ]);
  });

  it('rejects a draft revision without applying output', async () => {
    prisma.aiDraftRevisionAudit.findFirst.mockResolvedValue({
      id: 'audit-1',
      diagnosisRegistryId,
      affectedArtifactType: 'EDUCATION_SECTION',
      affectedArtifactId: 'education-1',
      sourceIssue: {},
      generatedOutput: {},
    });

    await service.decideAiDraftRevision({
      diagnosisRegistryId,
      auditId: 'audit-1',
      decision: 'reject',
      userId: 'admin-1',
    });

    expect(prisma.diagnosisEducation.update).not.toHaveBeenCalled();
    expect(prisma.aiDraftRevisionAudit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reviewStatus: 'REJECTED' }),
      }),
    );
  });

  it('creates and audits learning-goal coverage annotations', async () => {
    prisma.caseLearningGoalCoverage.upsert = jest.fn().mockResolvedValue({
      id: 'coverage-1',
      caseId: 'case-1',
      case: { id: 'case-1', title: 'RLQ pain' },
      learningGoalId: 'goal-1',
      learningGoal: 'Distinguish appendicitis',
      coverageStrength: 80,
      coveredDiscriminators: ['migration'],
      missingDiscriminators: [],
      coveredMimics: [],
      missingMimics: ['torsion'],
      evidenceSource: 'editorial_annotation',
      updatedAt: now,
    });

    const result = await service.upsertCaseLearningGoalCoverage({
      diagnosisRegistryId,
      payload: {
        caseId: 'case-1',
        learningGoalId: 'goal-1',
        learningGoal: 'Distinguish appendicitis',
        coverageStrength: 80,
      },
      userId: 'admin-1',
    });

    expect(result.coverageStrength).toBe(80);
    expect(prisma.aiDraftRevisionAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actionType: 'create_case_learning_goal_coverage',
          reviewStatus: 'ACCEPTED',
        }),
      }),
    );
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
      learningGoals: [
        'Distinguish appendicitis from ovarian torsion',
      ],
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
