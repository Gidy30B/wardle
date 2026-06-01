import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TeachingRulesAdminService } from './teaching-rules-admin.service';

describe('TeachingRulesAdminService', () => {
  const diagnosisRegistryId = '11111111-1111-4111-8111-111111111111';
  const ruleId = '22222222-2222-4222-8222-222222222222';

  function buildRule(overrides: Record<string, unknown> = {}) {
    return {
      id: ruleId,
      diagnosisRegistryId,
      stableKey: 'potassium_before_insulin',
      title: 'Potassium before insulin',
      category: 'management_concept',
      importance: 'critical',
      rationale: 'Insulin can worsen hypokalemia.',
      acceptableManifestations: ['check potassium before insulin'],
      requiredDifferentials: [],
      expectedEvidence: {},
      difficultyHints: {},
      avoidTooEarly: false,
      appliesToEducation: true,
      appliesToCaseGeneration: true,
      appliesToGraph: false,
      status: 'NEEDS_REVIEW',
      source: 'EDITOR_CREATED',
      version: 1,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
      ...overrides,
    };
  }

  function buildService() {
    const prisma = {
      diagnosisRegistry: {
        findUnique: jest.fn().mockResolvedValue({
          id: diagnosisRegistryId,
          canonicalName: 'diabetic ketoacidosis',
          displayLabel: 'Diabetic Ketoacidosis',
          specialty: null,
          category: null,
          bodySystem: null,
          clinicalSetting: null,
          difficultyBand: null,
          aliases: [{ term: 'DKA' }],
        }),
      },
      diagnosisTeachingRule: {
        findMany: jest.fn().mockResolvedValue([buildRule()]),
        findUnique: jest.fn().mockResolvedValue(buildRule()),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(buildRule()),
        update: jest.fn().mockResolvedValue(buildRule({ status: 'APPROVED' })),
      },
    };
    const curriculumProvider = {
      getRules: jest.fn().mockResolvedValue({
        teachingUnits: [{ id: 'potassium_before_insulin' }],
      }),
    };
    const seedService = {
      seedLegacyTeachingRulesForDiagnosis: jest
        .fn()
        .mockResolvedValue({ rulesUpserted: 1 }),
    };

    return {
      prisma,
      curriculumProvider,
      seedService,
      service: new TeachingRulesAdminService(
        prisma as never,
        curriculumProvider as never,
        seedService as never,
      ),
    };
  }

  it('lists rules for diagnosis', async () => {
    const { service } = buildService();

    const result = await service.listRules(diagnosisRegistryId);

    expect(result.rules).toHaveLength(1);
    expect(result.rules[0]).toEqual(
      expect.objectContaining({
        stableKey: 'potassium_before_insulin',
        createdAt: '2026-06-01T00:00:00.000Z',
      }),
    );
  });

  it('creates a manual rule', async () => {
    const { prisma, service } = buildService();

    await service.createRule(diagnosisRegistryId, {
      stableKey: 'dka_vs_hhs',
      title: 'DKA vs HHS',
      category: 'differential_concept',
      importance: 'critical',
      acceptableManifestations: ['HHS lacks prominent ketoacidosis'],
    });

    expect(prisma.diagnosisTeachingRule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stableKey: 'dka_vs_hhs',
          status: 'NEEDS_REVIEW',
          source: 'EDITOR_CREATED',
        }),
      }),
    );
  });

  it('updates a rule', async () => {
    const { prisma, service } = buildService();

    await service.updateRule(ruleId, {
      title: 'Potassium safety before insulin',
      importance: 'high',
    });

    expect(prisma.diagnosisTeachingRule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ruleId },
        data: expect.objectContaining({
          title: 'Potassium safety before insulin',
          importance: 'high',
        }),
      }),
    );
  });

  it.each([
    ['approve', 'APPROVED'],
    ['reject', 'REJECTED'],
    ['deprecate', 'DEPRECATED'],
  ])('reviews a rule with %s', async (action, status) => {
    const { prisma, service } = buildService();

    await service.reviewRule(ruleId, action);

    expect(prisma.diagnosisTeachingRule.update).toHaveBeenCalledWith({
      where: { id: ruleId },
      data: { status },
    });
  });

  it('rejects duplicate stableKey', async () => {
    const { prisma, service } = buildService();
    prisma.diagnosisTeachingRule.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.createRule(diagnosisRegistryId, {
        stableKey: 'potassium_before_insulin',
        title: 'Potassium before insulin',
        category: 'management_concept',
        importance: 'critical',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('generated candidates do not become active', async () => {
    const { prisma, service } = buildService();
    prisma.diagnosisRegistry.findUnique.mockResolvedValueOnce({
      id: diagnosisRegistryId,
      canonicalName: 'diabetic ketoacidosis',
      displayLabel: 'Diabetic Ketoacidosis',
      education: {
        investigations: [
          {
            title: 'Ketones and acidosis',
            content: 'Ketones with metabolic acidosis distinguish DKA.',
          },
        ],
        differentials: [],
        examPearls: [],
        management: [],
        pitfalls: [],
      },
      graphFacts: [],
      graphCandidates: [],
      cases: [],
    });

    await service.generateCandidateRules(diagnosisRegistryId);

    expect(prisma.diagnosisTeachingRule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'CANDIDATE',
          source: 'GENERATED',
        }),
      }),
    );
  });

  it('validates selected teaching unit ids against provider output', async () => {
    const { service } = buildService();

    await expect(
      service.validateTeachingUnitIds(diagnosisRegistryId, ['missing_unit']),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('runs legacy seed for one diagnosis', async () => {
    const { seedService, service } = buildService();

    await service.seedLegacyRulesForDiagnosis(diagnosisRegistryId);

    expect(seedService.seedLegacyTeachingRulesForDiagnosis).toHaveBeenCalledWith(
      diagnosisRegistryId,
    );
  });
});
