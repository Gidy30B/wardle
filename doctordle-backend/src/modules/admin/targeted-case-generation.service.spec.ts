import { BadRequestException } from '@nestjs/common';
import { TargetedCaseGenerationService } from './targeted-case-generation.service';

describe('TargetedCaseGenerationService', () => {
  const diagnosisRegistryId = '11111111-1111-4111-8111-111111111111';
  const mimicDiagnosisId = '22222222-2222-4222-8222-222222222222';

  function buildService() {
    const prisma = {
      diagnosisRegistry: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: mimicDiagnosisId,
            displayLabel: 'Gastroenteritis',
            canonicalName: 'gastroenteritis',
          },
        ]),
      },
      aiDraftRevisionAudit: {
        create: jest.fn().mockResolvedValue({
          id: 'audit-1',
          reviewStatus: 'PENDING_REVIEW',
        }),
      },
    };
    const caseGenerator = {
      generateBatch: jest.fn().mockResolvedValue({
        batchId: 'batch-1',
        results: [
          {
            index: 0,
            status: 'created',
            caseId: '33333333-3333-4333-8333-333333333333',
            answer: 'Appendicitis',
          },
        ],
      }),
    };
    const caseReviewService = {
      getCaseDetail: jest.fn().mockResolvedValue({
        id: '33333333-3333-4333-8333-333333333333',
        title: 'Appendicitis',
        editorialStatus: 'DRAFT',
        validationRuns: [{ id: 'validation-1', outcome: 'PASSED' }],
        qualityProjection: { dimensions: {}, warnings: [], blockers: [] },
      }),
    };
    const teachingRulesAdminService = {
      validateTeachingUnitIds: jest.fn().mockResolvedValue(undefined),
    };
    const service = new TargetedCaseGenerationService(
      prisma as never,
      caseGenerator as never,
      caseReviewService as never,
      teachingRulesAdminService as never,
    );

    return { caseGenerator, caseReviewService, prisma, service, teachingRulesAdminService };
  }

  it('generates a case with selected teaching units and mimics', async () => {
    const { caseGenerator, service } = buildService();

    const result = await service.generate({
      diagnosisRegistryId,
      payload: {
        difficulty: 'MEDIUM',
        teachingUnitIds: ['migratory_rlq_pain'],
        mimicDiagnosisIds: [mimicDiagnosisId],
        clueRevealStrategy: 'late_discriminator',
      },
    });

    expect(caseGenerator.generateBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        count: 1,
        difficulty: 'medium',
        registryFirst: true,
        diagnosisRegistryIds: [diagnosisRegistryId],
        targetedCase: expect.objectContaining({
          teachingUnitIds: ['migratory_rlq_pain'],
          mimics: [
            {
              diagnosisRegistryId: mimicDiagnosisId,
              diagnosis: 'Gastroenteritis',
            },
          ],
          clueRevealStrategy: 'late_discriminator',
        }),
      }),
    );
    expect(result.generatedCase?.editorialStatus).toBe('DRAFT');
    expect(result.validation?.outcome).toBe('PASSED');
    expect(result.qualityProjection).toBeTruthy();
  });

  it('rejects invalid teachingUnitIds for the target diagnosis', async () => {
    const { service, teachingRulesAdminService } = buildService();
    teachingRulesAdminService.validateTeachingUnitIds.mockRejectedValueOnce(
      new BadRequestException('Invalid teachingUnitIds for diagnosis: missing'),
    );

    await expect(
      service.generate({
        diagnosisRegistryId,
        payload: {
          difficulty: 'MEDIUM',
          teachingUnitIds: ['missing'],
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('handles missing teaching units safely', async () => {
    const { caseGenerator, service } = buildService();

    await service.generate({
      diagnosisRegistryId,
      payload: {
        difficulty: 'EASY',
        teachingUnitIds: [],
      },
    });

    expect(caseGenerator.generateBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        targetedCase: expect.objectContaining({
          teachingUnitIds: [],
        }),
      }),
    );
  });

  it('rejects inactive or unknown mimic diagnoses', async () => {
    const { prisma, service } = buildService();
    prisma.diagnosisRegistry.findMany.mockResolvedValueOnce([]);

    await expect(
      service.generate({
        diagnosisRegistryId,
        payload: {
          difficulty: 'HARD',
          teachingUnitIds: ['peritoneal_irritation'],
          mimicDiagnosisIds: [mimicDiagnosisId],
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('generates targeted discriminator cases with draft audit governance', async () => {
    const { caseGenerator, prisma, service } = buildService();
    const target = {
      caseId: '33333333-3333-4333-8333-333333333333',
      diagnosisRegistryId,
      mimicDiagnosisId,
      mimicName: 'Gastroenteritis',
      discriminator: 'Migratory right lower quadrant pain',
      generationIntent: 'heuristic_only_repair' as const,
      learnerRisk: 'Learners may keep gastroenteritis alive too long.',
      editorialReason: 'Heuristic-only separation needs a governed draft.',
    };

    const result = await service.generateTargetedDiscriminatorCase({
      diagnosisRegistryId,
      payload: { target },
      userId: 'user-1',
    });

    expect(caseGenerator.generateBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        targetedCase: expect.objectContaining({
          discriminatorTarget: target,
          clueRevealStrategy: 'late_discriminator',
        }),
      }),
    );
    expect(prisma.aiDraftRevisionAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actionType: 'generate_targeted_discriminator_case',
          reviewStatus: 'PENDING_REVIEW',
          createdByUserId: 'user-1',
        }),
      }),
    );
    expect(result.audit.reviewStatus).toBe('PENDING_REVIEW');
  });

  it('creates reviewable clue revision proposals without mutating cases', async () => {
    const { prisma, service } = buildService();
    const target = {
      caseId: '33333333-3333-4333-8333-333333333333',
      diagnosisRegistryId,
      mimicName: 'GERD',
      discriminator: 'reflux and recumbency pattern',
      sourceClueOrder: 3,
      generationIntent: 'missing_discriminator_case' as const,
    };

    const result = await service.generateClueRevisionProposal({
      diagnosisRegistryId,
      payload: {
        target,
        existingClue: 'Upper abdominal pain after meals.',
      },
      userId: 'user-1',
    });

    expect(result.proposal.proposedClue).toContain(
      'reflux and recumbency pattern',
    );
    expect(prisma.aiDraftRevisionAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actionType: 'generate_clue_revision_proposal',
          affectedArtifactType: 'CASE_CLUE_REVISION_PROPOSAL',
          reviewStatus: 'PENDING_REVIEW',
        }),
      }),
    );
  });
});
