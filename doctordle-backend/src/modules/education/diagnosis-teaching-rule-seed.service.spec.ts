import { seedLegacyDiagnosisTeachingRules } from './diagnosis-teaching-rule-seed.service';
import { EducationTeachingRulesService } from './education-teaching-rules.service';

describe('seedLegacyDiagnosisTeachingRules', () => {
  const legacyService = new EducationTeachingRulesService();

  function buildPrisma() {
    return {
      diagnosisRegistry: {
        findFirst: jest
          .fn()
          .mockImplementation(({ where }: { where: { OR: unknown[] } }) =>
            Promise.resolve({ id: `registry-${where.OR.length}` }),
          ),
      },
      diagnosisTeachingRule: {
        upsert: jest.fn().mockResolvedValue({ id: 'rule-1' }),
      },
    };
  }

  it('creates teaching rules from hardcoded legacy packs', async () => {
    const prisma = buildPrisma();
    const summary = await seedLegacyDiagnosisTeachingRules(
      prisma as never,
      legacyService,
    );
    const expectedCount = legacyService
      .getSeedDiagnosisKeys()
      .map((diagnosisKey) =>
        legacyService.getRules({ canonicalName: diagnosisKey }),
      )
      .reduce((sum, rules) => sum + (rules?.teachingUnits.length ?? 0), 0);

    expect(summary.rulesUpserted).toBe(expectedCount);
    expect(summary.diagnosesSkipped).toBe(0);
    expect(prisma.diagnosisTeachingRule.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          diagnosisRegistryId_stableKey: expect.objectContaining({
            stableKey: 'migratory_rlq_pain',
          }),
        }),
        create: expect.objectContaining({
          stableKey: 'migratory_rlq_pain',
          source: 'LEGACY_SEED',
          status: 'ACTIVE',
        }),
      }),
    );
  });

  it('is idempotent by upserting stable keys', async () => {
    const prisma = buildPrisma();

    await seedLegacyDiagnosisTeachingRules(prisma as never, legacyService);
    await seedLegacyDiagnosisTeachingRules(prisma as never, legacyService);

    expect(prisma.diagnosisTeachingRule.upsert).toHaveBeenCalled();
    for (const call of prisma.diagnosisTeachingRule.upsert.mock.calls) {
      expect(call[0].where.diagnosisRegistryId_stableKey.stableKey).toBe(
        call[0].create.stableKey,
      );
    }
  });

  it('skips diagnoses without a matching registry row', async () => {
    const prisma = buildPrisma();
    prisma.diagnosisRegistry.findFirst.mockResolvedValue(null);

    const summary = await seedLegacyDiagnosisTeachingRules(
      prisma as never,
      legacyService,
    );

    expect(summary.diagnosesMatched).toBe(0);
    expect(summary.diagnosesSkipped).toBe(
      legacyService.getSeedDiagnosisKeys().length,
    );
    expect(prisma.diagnosisTeachingRule.upsert).not.toHaveBeenCalled();
  });
});
