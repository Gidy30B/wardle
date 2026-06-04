import { BadRequestException } from '@nestjs/common';
import { AdminController } from './admin.controller';

describe('AdminController generateCases', () => {
  function buildController() {
    const caseGenerator = {
      generateBatch: jest.fn().mockResolvedValue({ batchId: 'batch-1' }),
    };
    const caseReviewService = {};
    const diagnosisEditorialWorkspaceService = {
      getFullWorkspace: jest
        .fn()
        .mockResolvedValue({ diagnosis: { id: 'registry-1' } }),
    };
    const diagnosisWorkspaceQualityService = {};
    const teachingUnitCoverageService = {};
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
    const diagnosisEditorialBriefService = {
      getBrief: jest.fn().mockResolvedValue({ brief: null }),
      generateBrief: jest.fn().mockResolvedValue({ id: 'brief-1' }),
      createBrief: jest.fn().mockResolvedValue({ id: 'brief-1' }),
      updateBrief: jest.fn().mockResolvedValue({ id: 'brief-1' }),
      reviewBrief: jest.fn().mockResolvedValue({ id: 'brief-1' }),
    };
    const differentialMappingService = {};
    const diagnosisRegistryCandidateService = {};

    return {
      caseGenerator,
      controller: new AdminController(
        caseGenerator as never,
        caseReviewService as never,
        diagnosisEditorialWorkspaceService as never,
        diagnosisWorkspaceQualityService as never,
        teachingUnitCoverageService as never,
        targetedCaseGenerationService as never,
        teachingRulesAdminService as never,
        diagnosisEditorialBriefService as never,
        differentialMappingService as never,
        diagnosisRegistryCandidateService as never,
      ),
      targetedCaseGenerationService,
      teachingRulesAdminService,
      diagnosisEditorialBriefService,
      diagnosisEditorialWorkspaceService,
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
