import { BadRequestException } from '@nestjs/common';
import { AdminController } from './admin.controller';

describe('AdminController generateCases', () => {
  function buildController() {
    const caseGenerator = {
      generateBatch: jest.fn().mockResolvedValue({ batchId: 'batch-1' }),
    };
    const caseReviewService = {};
    const caseInventoryHealthService = {
      getInventoryHealth: jest.fn().mockResolvedValue({ totalCases: 0 }),
    };
    const diagnosisEditorialWorkspaceService = {
      getFullWorkspace: jest
        .fn()
        .mockResolvedValue({ diagnosis: { id: 'registry-1' } }),
    };
    const diagnosisWorkspaceQualityService = {};
    const teachingUnitCoverageService = {};
    const editorialReviewInboxService = {
      getInbox: jest.fn().mockResolvedValue({ summary: { total: 0 }, items: [] }),
    };
    const targetedCaseGenerationService = {
      generate: jest.fn().mockResolvedValue({ generatedCase: null }),
    };
    const teachingRulesAdminService = {
      listRules: jest.fn().mockResolvedValue({ rules: [] }),
      createRule: jest.fn().mockResolvedValue({ id: 'rule-1' }),
      updateRule: jest.fn().mockResolvedValue({ id: 'rule-1' }),
      reviewRule: jest.fn().mockResolvedValue({ id: 'rule-1' }),
      generateCandidateRules: jest.fn().mockResolvedValue({ rules: [] }),
      seedLegacyRulesForDiagnosis: jest
        .fn()
        .mockResolvedValue({ rulesUpserted: 0 }),
    };
    const editorialCoverageDashboardService = {
      getOverview: jest.fn().mockResolvedValue({ globalSummary: {} }),
      getDiagnoses: jest.fn().mockResolvedValue([]),
      getSpecialties: jest.fn().mockResolvedValue([]),
    };
    const curriculumPlanningService = {
      getOverview: jest.fn().mockResolvedValue({ summary: {} }),
      getDiagnoses: jest.fn().mockResolvedValue([]),
      getTracks: jest.fn().mockResolvedValue([]),
    };
    const diagnosisTeachingRelationshipService = {
      listRelationships: jest.fn().mockResolvedValue([]),
      generateCandidates: jest.fn().mockResolvedValue({ createdCount: 0 }),
      reviewRelationship: jest.fn().mockResolvedValue({ id: 'relationship-1' }),
      listForDiagnosis: jest.fn().mockResolvedValue([]),
    };
    const evidenceGraphService = {
      listNodes: jest.fn().mockResolvedValue([]),
      listRelationships: jest.fn().mockResolvedValue([]),
      generateCandidates: jest.fn().mockResolvedValue({ createdCount: 0 }),
      reviewRelationship: jest.fn().mockResolvedValue({ id: 'evidence-1' }),
      getForDiagnosis: jest.fn().mockResolvedValue({ relationships: [] }),
    };
    const evidenceCoverageService = {
      getOverview: jest.fn().mockResolvedValue({ summary: {} }),
      getDiagnoses: jest.fn().mockResolvedValue([]),
      getDiagnosis: jest.fn().mockResolvedValue({ diagnosisRegistryId: 'registry-1' }),
    };
    const reasoningPathService = {
      listPaths: jest.fn().mockResolvedValue([]),
      generateCandidates: jest.fn().mockResolvedValue({ createdCount: 0 }),
      buildGenerationContext: jest.fn().mockResolvedValue({ reasoningPath: { id: 'path-1' } }),
      reviewPath: jest.fn().mockResolvedValue({ id: 'path-1' }),
    };
    const diagnosisEditorialBriefService = {
      getBrief: jest.fn().mockResolvedValue({ brief: null }),
      generateBrief: jest.fn().mockResolvedValue({ id: 'brief-1' }),
      createBrief: jest.fn().mockResolvedValue({ id: 'brief-1' }),
      updateBrief: jest.fn().mockResolvedValue({ id: 'brief-1' }),
      reviewBrief: jest.fn().mockResolvedValue({ id: 'brief-1' }),
    };
    const differentialMappingService = {};
    const diagnosisRegistryCandidateService = {};
    const diagnosisEditorialOnboardingService = {
      getOnboarding: jest.fn().mockResolvedValue({ onboardingStatus: 'NEW' }),
      updateStatus: jest.fn().mockResolvedValue({ onboardingStatus: 'COMPLETE' }),
      getSummary: jest.fn().mockResolvedValue({ newlyCreatedDiagnoses: 0 }),
    };
    const diagnosisRegistryLifecyclePolicyService = {
      getLifecycle: jest.fn().mockResolvedValue({ diagnosisRegistryId: 'registry-1' }),
      performAction: jest.fn().mockResolvedValue({ registry: { id: 'registry-1' } }),
    };
    const diagnosisRegistryMergeAnalysisService = {
      analyzeMerge: jest.fn().mockResolvedValue({ allowed: true }),
      getMergeRelated: jest.fn().mockResolvedValue({ diagnosisRegistryId: 'registry-1' }),
    };
    const diagnosisRegistryMergeExecutionService = {
      executeMerge: jest.fn().mockResolvedValue({ mergeLogId: 'merge-log-1' }),
    };

    return {
      caseGenerator,
      controller: new AdminController(
        caseGenerator as never,
        caseReviewService as never,
        caseInventoryHealthService as never,
        diagnosisEditorialWorkspaceService as never,
        diagnosisWorkspaceQualityService as never,
        teachingUnitCoverageService as never,
        editorialReviewInboxService as never,
        targetedCaseGenerationService as never,
        teachingRulesAdminService as never,
        editorialCoverageDashboardService as never,
        curriculumPlanningService as never,
        diagnosisTeachingRelationshipService as never,
        evidenceGraphService as never,
        evidenceCoverageService as never,
        reasoningPathService as never,
        diagnosisEditorialBriefService as never,
        differentialMappingService as never,
        diagnosisRegistryCandidateService as never,
        diagnosisEditorialOnboardingService as never,
        diagnosisRegistryLifecyclePolicyService as never,
        diagnosisRegistryMergeAnalysisService as never,
        diagnosisRegistryMergeExecutionService as never,
      ),
      targetedCaseGenerationService,
      caseInventoryHealthService,
      editorialReviewInboxService,
      teachingRulesAdminService,
      editorialCoverageDashboardService,
      curriculumPlanningService,
      diagnosisTeachingRelationshipService,
      evidenceGraphService,
      evidenceCoverageService,
      reasoningPathService,
      diagnosisEditorialBriefService,
      diagnosisEditorialWorkspaceService,
      diagnosisEditorialOnboardingService,
      diagnosisRegistryLifecyclePolicyService,
      diagnosisRegistryMergeAnalysisService,
      diagnosisRegistryMergeExecutionService,
    };
  }

  it('passes explicit diagnosisRegistryIds to case generation', async () => {
    const { caseGenerator, controller } = buildController();

    await controller.generateCases({
      count: 1,
      diagnosisRegistryIds: ['11111111-1111-4111-8111-111111111111'],
    });

    expect(caseGenerator.generateBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        count: 1,
        registryFirst: true,
        diagnosisRegistryIds: ['11111111-1111-4111-8111-111111111111'],
      }),
    );
  });

  it('gets curriculum planner overview with filters', async () => {
    const { controller, curriculumPlanningService } = buildController();

    await controller.getCurriculumPlannerOverview(
      'Cardiology',
      'RULES_STARTED',
      undefined,
      'active',
      'ACTIVE',
      'high',
      'chest_pain',
      'true',
    );

    expect(curriculumPlanningService.getOverview).toHaveBeenCalledWith({
      specialty: 'Cardiology',
      onboardingStatus: 'RULES_STARTED',
      onboardingState: undefined,
      lifecycleReadiness: 'active',
      lifecycleState: 'ACTIVE',
      priorityTier: 'high',
      track: 'chest_pain',
      playableOnly: true,
    });
  });

  it('gets editorial review inbox with filters', async () => {
    const { controller, editorialReviewInboxService } = buildController();

    await controller.getEditorialReviewInbox(
      'cases',
      'urgent',
      'REVIEW',
      'Cardiology',
      '25',
      '2',
    );

    expect(editorialReviewInboxService.getInbox).toHaveBeenCalledWith({
      type: 'cases',
      severity: 'urgent',
      status: 'REVIEW',
      specialty: 'Cardiology',
      limit: 25,
      page: 2,
    });
  });

  it('gets case inventory health', async () => {
    const { controller, caseInventoryHealthService } = buildController();

    await controller.getCaseInventoryHealth();

    expect(caseInventoryHealthService.getInventoryHealth).toHaveBeenCalled();
  });

  it('generates diagnosis teaching relationship candidates', async () => {
    const { controller, diagnosisTeachingRelationshipService } =
      buildController();

    await controller.generateDiagnosisTeachingRelationshipCandidates({
      diagnosisRegistryId: '11111111-1111-4111-8111-111111111111',
    });

    expect(
      diagnosisTeachingRelationshipService.generateCandidates,
    ).toHaveBeenCalledWith({
      diagnosisRegistryId: '11111111-1111-4111-8111-111111111111',
    });
  });

  it('generates evidence graph candidates', async () => {
    const { controller, evidenceGraphService } = buildController();

    await controller.generateEvidenceGraphCandidates({
      diagnosisRegistryId: '11111111-1111-4111-8111-111111111111',
    });

    expect(evidenceGraphService.generateCandidates).toHaveBeenCalledWith({
      diagnosisRegistryId: '11111111-1111-4111-8111-111111111111',
    });
  });

  it('gets editorial coverage overview with filters', async () => {
    const { controller, editorialCoverageDashboardService } = buildController();

    await controller.getEditorialCoverageOverview(
      'Cardiology',
      'ACTIVE',
      'COMPLETE',
      'missing_graph_coverage',
      'true',
    );

    expect(editorialCoverageDashboardService.getOverview).toHaveBeenCalledWith({
      specialty: 'Cardiology',
      lifecycleState: 'ACTIVE',
      onboardingState: 'COMPLETE',
      coverageWeakness: 'missing_graph_coverage',
      playableOnly: true,
    });
  });

  it('gets evidence coverage overview with advisory filters', async () => {
    const { controller, evidenceCoverageService } = buildController();

    await controller.getEvidenceCoverageOverview(
      'Cardiology',
      'missing_lab_discriminator',
      'weak',
      'true',
      'READY_FOR_REVIEW',
    );

    expect(evidenceCoverageService.getOverview).toHaveBeenCalledWith({
      specialty: 'Cardiology',
      evidenceWeakness: 'missing_lab_discriminator',
      readinessTier: 'weak',
      playableOnly: true,
      onboardingStatus: 'READY_FOR_REVIEW',
    });
  });

  it('generates a targeted case from diagnosis workspace payload', async () => {
    const { controller, targetedCaseGenerationService } = buildController();

    await controller.generateTargetedCase(
      '11111111-1111-4111-8111-111111111111',
      {
        difficulty: 'MEDIUM',
        teachingUnitIds: ['migratory_rlq_pain'],
        mimicDiagnosisIds: ['22222222-2222-4222-8222-222222222222'],
        clueRevealStrategy: 'progressive_narrowing',
      },
    );

    expect(targetedCaseGenerationService.generate).toHaveBeenCalledWith({
      diagnosisRegistryId: '11111111-1111-4111-8111-111111111111',
      payload: {
        difficulty: 'MEDIUM',
        teachingUnitIds: ['migratory_rlq_pain'],
        mimicDiagnosisIds: ['22222222-2222-4222-8222-222222222222'],
        clueRevealStrategy: 'progressive_narrowing',
      },
    });
  });

  it('defaults count to targeted diagnosis count when count is omitted', async () => {
    const { caseGenerator, controller } = buildController();

    await controller.generateCases({
      diagnosisRegistryIds: [
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
      ],
    });

    expect(caseGenerator.generateBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        count: 2,
        diagnosisRegistryIds: [
          '11111111-1111-4111-8111-111111111111',
          '22222222-2222-4222-8222-222222222222',
        ],
      }),
    );
  });

  it('rejects invalid diagnosisRegistryIds', async () => {
    const { controller } = buildController();

    await expect(
      controller.generateCases({
        count: 1,
        diagnosisRegistryIds: ['not-a-uuid'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists teaching rules for a diagnosis workspace', async () => {
    const { controller, teachingRulesAdminService } = buildController();

    await controller.listDiagnosisTeachingRules(
      '11111111-1111-4111-8111-111111111111',
    );

    expect(teachingRulesAdminService.listRules).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
    );
  });

  it('reviews a teaching rule', async () => {
    const { controller, teachingRulesAdminService } = buildController();

    await controller.reviewTeachingRule(
      '33333333-3333-4333-8333-333333333333',
      { action: 'approve' },
    );

    expect(teachingRulesAdminService.reviewRule).toHaveBeenCalledWith(
      '33333333-3333-4333-8333-333333333333',
      'approve',
    );
  });

  it('gets an editorial brief for a diagnosis workspace', async () => {
    const { controller, diagnosisEditorialBriefService } = buildController();

    await controller.getDiagnosisEditorialBrief(
      '11111111-1111-4111-8111-111111111111',
    );

    expect(diagnosisEditorialBriefService.getBrief).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
    );
  });

  it('gets the full diagnosis editorial workspace read model', async () => {
    const { controller, diagnosisEditorialWorkspaceService } =
      buildController();

    await controller.getFullDiagnosisEditorialWorkspace(
      '11111111-1111-4111-8111-111111111111',
    );

    expect(
      diagnosisEditorialWorkspaceService.getFullWorkspace,
    ).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
  });

  it('reviews an editorial brief', async () => {
    const { controller, diagnosisEditorialBriefService } = buildController();

    await controller.reviewDiagnosisEditorialBrief(
      '11111111-1111-4111-8111-111111111111',
      { action: 'activate' },
    );

    expect(diagnosisEditorialBriefService.reviewBrief).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      'activate',
    );
  });

  it('gets registry onboarding state', async () => {
    const { controller, diagnosisEditorialOnboardingService } =
      buildController();

    await controller.getDiagnosisRegistryOnboarding(
      '11111111-1111-4111-8111-111111111111',
    );

    expect(
      diagnosisEditorialOnboardingService.getOnboarding,
    ).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
  });

  it('updates registry onboarding status', async () => {
    const { controller, diagnosisEditorialOnboardingService } =
      buildController();

    await controller.updateDiagnosisRegistryOnboardingStatus(
      '11111111-1111-4111-8111-111111111111',
      { action: 'mark_complete' },
    );

    expect(diagnosisEditorialOnboardingService.updateStatus).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      'mark_complete',
    );
  });

  it('gets registry lifecycle governance state', async () => {
    const { controller, diagnosisRegistryLifecyclePolicyService } =
      buildController();

    await controller.getDiagnosisRegistryLifecycle(
      '11111111-1111-4111-8111-111111111111',
    );

    expect(
      diagnosisRegistryLifecyclePolicyService.getLifecycle,
    ).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
  });

  it('updates registry lifecycle through policy service', async () => {
    const { controller, diagnosisRegistryLifecyclePolicyService } =
      buildController();

    await controller.updateDiagnosisRegistryLifecycle(
      '11111111-1111-4111-8111-111111111111',
      { user: { id: 'senior-1' } } as never,
      { action: 'mark_playable' },
    );

    expect(
      diagnosisRegistryLifecyclePolicyService.performAction,
    ).toHaveBeenCalledWith({
      diagnosisRegistryId: '11111111-1111-4111-8111-111111111111',
      reviewerUserId: 'senior-1',
      action: 'mark_playable',
    });
  });

  it('analyzes registry merge dry-run through merge analysis service', async () => {
    const { controller, diagnosisRegistryMergeAnalysisService } =
      buildController();

    await controller.analyzeDiagnosisRegistryMerge({
      sourceDiagnosisRegistryId: '11111111-1111-4111-8111-111111111111',
      targetDiagnosisRegistryId: '22222222-2222-4222-8222-222222222222',
    });

    expect(diagnosisRegistryMergeAnalysisService.analyzeMerge).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    );
  });

  it('gets registry merge-related suggestions', async () => {
    const { controller, diagnosisRegistryMergeAnalysisService } =
      buildController();

    await controller.getDiagnosisRegistryMergeRelated(
      '11111111-1111-4111-8111-111111111111',
    );

    expect(
      diagnosisRegistryMergeAnalysisService.getMergeRelated,
    ).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
  });

  it('executes registry merge through merge execution service', async () => {
    const { controller, diagnosisRegistryMergeExecutionService } =
      buildController();

    await controller.executeDiagnosisRegistryMerge(
      { user: { id: 'senior-1' } } as never,
      {
        sourceDiagnosisRegistryId: '11111111-1111-4111-8111-111111111111',
        targetDiagnosisRegistryId: '22222222-2222-4222-8222-222222222222',
        reason: 'Duplicate diagnosis',
        expectedAnalysisHash: 'hash-1',
      },
    );

    expect(
      diagnosisRegistryMergeExecutionService.executeMerge,
    ).toHaveBeenCalledWith({
      sourceDiagnosisRegistryId: '11111111-1111-4111-8111-111111111111',
      targetDiagnosisRegistryId: '22222222-2222-4222-8222-222222222222',
      performedByUserId: 'senior-1',
      reason: 'Duplicate diagnosis',
      expectedAnalysisHash: 'hash-1',
    });
  });

  it('allows editors to create draft-level teaching rules', async () => {
    const { controller, teachingRulesAdminService } = buildController();

    await controller.createDiagnosisTeachingRule(
      '11111111-1111-4111-8111-111111111111',
      { user: { role: 'editor' } } as never,
      { stableKey: 'rule-1', title: 'Draft rule', status: 'NEEDS_REVIEW' },
    );

    expect(teachingRulesAdminService.createRule).toHaveBeenCalled();
  });

  it('rejects editor attempts to activate teaching rules through draft update', async () => {
    const { controller } = buildController();

    await expect(
      controller.updateTeachingRule(
        '33333333-3333-4333-8333-333333333333',
        { user: { role: 'editor' } } as never,
        { status: 'ACTIVE' },
      ),
    ).rejects.toThrow('Requires senior editor');
  });

  it('allows senior editors to approve editorial briefs through draft update', async () => {
    const { controller, diagnosisEditorialBriefService } = buildController();

    await controller.updateDiagnosisEditorialBrief(
      '11111111-1111-4111-8111-111111111111',
      { user: { role: 'senior_editor' } } as never,
      { status: 'APPROVED', summary: 'Approved brief' },
    );

    expect(diagnosisEditorialBriefService.updateBrief).toHaveBeenCalled();
  });

  it('preserves old behavior when diagnosisRegistryIds is omitted', async () => {
    const { caseGenerator, controller } = buildController();

    await controller.generateCases({ count: 3, registryFirst: false });

    expect(caseGenerator.generateBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        count: 3,
        registryFirst: false,
        diagnosisRegistryIds: undefined,
      }),
    );
  });
});
