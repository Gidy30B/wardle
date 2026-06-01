import { DiagnosisCurriculumProviderService } from './diagnosis-curriculum-provider.service';
import { EducationDraftQualityValidator } from './education-draft-quality-validator.service';
import { EducationKnowledgeRulesService } from './education-knowledge-rules.service';
import {
  EducationTeachingRulesService,
  type EducationTeachingRulePack,
} from './education-teaching-rules.service';

describe('DiagnosisCurriculumProviderService', () => {
  const legacyService = new EducationTeachingRulesService();
  const provider = new DiagnosisCurriculumProviderService(
    undefined,
    legacyService,
  );

  it.each([
    'appendicitis',
    'diabetic ketoacidosis',
    'pneumonia',
    'myocardial infarction',
    'ischemic stroke',
    'asthma',
    'sepsis',
    'heart failure',
  ])('returns legacy-parity curriculum for %s', async (canonicalName) => {
    const registry = { canonicalName };
    const legacyRules = legacyService.getRules(registry);

    expect(await provider.getRules(registry)).toEqual({
      ...legacyRules,
      teachingUnits:
        legacyRules?.teachingUnits.map((unit) => ({
          ...unit,
          source: 'legacy_teaching_rules',
        })) ?? [],
      source: 'legacy_teaching_rules',
    });
  });

  it('reads persisted rules before legacy rules', async () => {
    const legacyRules = legacyService.getRules({ canonicalName: 'appendicitis' });
    const prisma = {
      diagnosisTeachingRule: {
        findMany: jest.fn().mockResolvedValue(
          persistedRowsFor(legacyRules!, 'registry-1').map((row) =>
            row.stableKey === 'peritoneal_irritation'
              ? { ...row, title: 'Persisted peritoneal irritation' }
              : row,
          ),
        ),
      },
    };
    const persistedProvider = new DiagnosisCurriculumProviderService(
      prisma as never,
      legacyService,
    );

    const rules = await persistedProvider.getRules({
      id: 'registry-1',
      canonicalName: 'appendicitis',
    });

    expect(prisma.diagnosisTeachingRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          diagnosisRegistryId: 'registry-1',
          status: { in: ['ACTIVE', 'APPROVED'] },
        },
      }),
    );
    expect(rules?.source).toBe('persisted_teaching_rule');
    expect(
      rules?.teachingUnits.find((unit) => unit.id === 'peritoneal_irritation')
        ?.label,
    ).toBe('Persisted peritoneal irritation');
  });

  it('preserves hardcoded teaching unit ids exactly from persisted rows', async () => {
    const registry = { id: 'registry-1', canonicalName: 'appendicitis' };
    const legacyRules = legacyService.getRules(registry);
    const persistedProvider = new DiagnosisCurriculumProviderService(
      {
        diagnosisTeachingRule: {
          findMany: jest
            .fn()
            .mockResolvedValue(persistedRowsFor(legacyRules!, 'registry-1')),
        },
      } as never,
      legacyService,
    );

    const providerIds =
      (await persistedProvider.getRules(registry))?.teachingUnits.map(
        (unit) => unit.id,
      ) ?? [];
    const legacyIds = legacyRules?.teachingUnits.map((unit) => unit.id) ?? [];

    expect(providerIds).toEqual(legacyIds);
    expect(providerIds).toEqual(
      expect.arrayContaining([
        'migratory_rlq_pain',
        'peritoneal_irritation',
        'gastroenteritis_discriminator',
      ]),
    );
  });

  it('falls back to legacy packs if no persisted rules exist', async () => {
    const persistedProvider = new DiagnosisCurriculumProviderService(
      {
        diagnosisTeachingRule: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      } as never,
      legacyService,
    );

    const rules = await persistedProvider.getRules({
      id: 'registry-1',
      canonicalName: 'appendicitis',
    });

    expect(rules?.source).toBe('legacy_teaching_rules');
    expect(rules?.teachingUnits.map((unit) => unit.id)).toEqual(
      legacyService
        .getRules({ canonicalName: 'appendicitis' })
        ?.teachingUnits.map((unit) => unit.id),
    );
  });

  it('queries only active or approved persisted rules', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const persistedProvider = new DiagnosisCurriculumProviderService(
      { diagnosisTeachingRule: { findMany } } as never,
      legacyService,
    );

    await persistedProvider.getRules({
      id: 'registry-1',
      canonicalName: 'appendicitis',
    });

    expect(findMany.mock.calls[0][0].where.status).toEqual({
      in: ['ACTIVE', 'APPROVED'],
    });
  });

  it('delegates manifestation options without changing output', () => {
    const rules = legacyService.getRules({ canonicalName: 'appendicitis' });

    expect(provider.getManifestationOptions(rules)).toEqual(
      legacyService.getManifestationOptions(rules),
    );
  });

  it('delegates case teaching unit selection without changing output', () => {
    const rules = legacyService.getRules({
      canonicalName: 'diabetic ketoacidosis',
    });

    expect(
      provider.getCaseTeachingUnits({
        rules,
        difficulty: 'HARD',
        count: 2,
      }),
    ).toEqual(
      legacyService.getCaseTeachingUnits({
        rules,
        difficulty: 'HARD',
        count: 2,
      }),
    );
  });

  it('returns safe empty fallback for diagnoses without curriculum', async () => {
    const registry = { canonicalName: 'rare zebra syndrome' };

    expect(await provider.getRules(registry)).toBeNull();
    expect(await provider.getRulesOrEmpty(registry)).toEqual({
      diagnosisKey: 'rare zebra syndrome',
      teachingUnits: [],
      difficultyStrategy: {
        targetDifficulty: 'medium',
        revealCoreUnitByClue: 3,
        avoidTooEarly: [],
        allowAlternativeManifestations: true,
      },
      requiredDifferentials: [],
      requiredPitfalls: [],
      requiredFindings: [],
      requiredInvestigations: [],
      requiredExamMechanisms: [],
      requiredManagementAnchors: [],
      requiredRecallConcepts: [],
    });
  });

  it('keeps education quality warnings equivalent to legacy rule input', async () => {
    const validator = new EducationDraftQualityValidator();
    const guidance = new EducationKnowledgeRulesService().getGuidance({
      canonicalName: 'appendicitis',
    });
    const draft = {
      summary: { content: 'Appendicitis can cause abdominal pain.' },
      clinicalPattern: { content: 'Abdominal pain with nausea.' },
      differentials: [
        {
          content: 'Gastroenteritis can also cause abdominal pain.',
          whyItMatters: 'It can be confused with appendicitis.',
        },
      ],
      investigations: [
        {
          content: 'CBC can be useful.',
          whyItMatters: 'It helps with diagnosis.',
        },
      ],
      examPearls: [
        {
          content: 'Look for abdominal tenderness.',
          whyItMatters: 'It supports diagnosis.',
        },
      ],
      management: [
        {
          content: 'Consult surgery.',
          whyItMatters: 'Prompt treatment is necessary.',
        },
      ],
      pitfalls: [
        {
          content: 'Symptoms can be nonspecific.',
          whyItMatters: 'Clinical correlation is advised.',
        },
      ],
      recallPrompts: [
        {
          prompt: 'What is appendicitis?',
          answer: 'Inflammation of the appendix.',
        },
      ],
    };

    const providerResult = validator.validate({
      draft,
      guidance,
      teachingRules: await provider.getRules({ canonicalName: 'appendicitis' }),
    });
    const legacyResult = validator.validate({
      draft,
      guidance,
      teachingRules: legacyService.getRules({ canonicalName: 'appendicitis' }),
    });

    expect(providerResult.warnings).toEqual(legacyResult.warnings);
    expect(providerResult.blockers).toEqual(legacyResult.blockers);
    expect(providerResult.coverageWarnings).toEqual(
      legacyResult.coverageWarnings,
    );
  });
});

function persistedRowsFor(
  rules: EducationTeachingRulePack,
  diagnosisRegistryId: string,
) {
  return rules.teachingUnits.map((unit) => ({
    id: `row-${unit.id}`,
    diagnosisRegistryId,
    stableKey: unit.id,
    title: unit.label,
    category: unit.category,
    importance: unit.importance,
    rationale: unit.rationale,
    acceptableManifestations: unit.acceptableManifestations,
    requiredDifferentials: rules.requiredDifferentials,
    expectedEvidence: {
      requiredPitfalls: rules.requiredPitfalls,
      requiredFindings: rules.requiredFindings,
      requiredInvestigations: rules.requiredInvestigations,
      requiredExamMechanisms: rules.requiredExamMechanisms,
      requiredManagementAnchors: rules.requiredManagementAnchors,
      requiredRecallConcepts: rules.requiredRecallConcepts,
    },
    difficultyHints: {
      packDifficultyStrategy: rules.difficultyStrategy,
      unitAvoidTooEarly: unit.avoidTooEarly ?? [],
    },
    avoidTooEarly: Boolean(unit.avoidTooEarly?.length),
    appliesToEducation: unit.appliesToEducation,
    appliesToCaseGeneration: unit.appliesToCaseGeneration,
    appliesToGraph: false,
    status: 'ACTIVE',
    source: 'LEGACY_SEED',
    version: 1,
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-01T00:00:00.000Z'),
  }));
}
