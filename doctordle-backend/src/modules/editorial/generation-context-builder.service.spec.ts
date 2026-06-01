import { GenerationContextBuilder } from './generation-context-builder.service';
import type { EditorialIntentProjection } from './editorial-intent-projection.service';
import { EducationTeachingRulesService } from '../education/education-teaching-rules.service';

function buildProjection(
  overrides: Partial<EditorialIntentProjection> = {},
): EditorialIntentProjection {
  return {
    diagnosis: {
      id: 'registry-1',
      displayLabel: 'Appendicitis',
      canonicalName: 'appendicitis',
      specialty: 'General Surgery',
      category: 'Inflammatory',
      bodySystem: 'Gastrointestinal',
      clinicalSetting: 'EMERGENCY',
      difficultyBand: 'BASIC',
      aliases: ['Acute appendicitis'],
    },
    learningGoals: ['Teach migratory pain and peritoneal irritation.'],
    requiredFindings: [
      'Periumbilical pain migrated to RLQ',
      'Mild leukocytosis',
    ],
    requiredSigns: ['McBurney point tenderness', 'Rovsing sign', 'psoas sign'],
    requiredSymptoms: ['Anorexia'],
    requiredInvestigations: ['CT abdomen', 'CBC leukocytosis'],
    requiredScoringSystems: ['Alvarado score', 'AIR score'],
    requiredMimics: ['gastroenteritis', 'renal colic'],
    keyDiscriminators: [
      {
        finding:
          'Localized peritoneal signs argue against gastroenteritis.',
        targetDiagnosis: 'gastroenteritis',
        rationale:
          'Unlike gastroenteritis, focal peritonism favors appendicitis.',
        source: 'case:case-1',
      },
    ],
    pitfallsToTeach: ['Normal early WBC', 'Do not reveal CT too early'],
    managementAnchors: ['surgical consultation', 'NPO'],
    editorPearls: ['Use atomic findings.'],
    difficultyGuidance: {
      baselineDifficulty: 'BASIC',
      targetDifficulty: 'medium',
      targetSolveClue: null,
      forbiddenEarlyClues: ['RAW_FULL_CASE_PAYLOAD_SHOULD_NOT_APPEAR'],
      keepAliveDifferentials: ['gastroenteritis'],
    },
    provenance: [],
    completeness: {
      hasRules: true,
      hasEducation: true,
      hasCases: true,
      hasGraphFacts: false,
      missing: ['graph_facts'],
    },
    ...overrides,
  };
}

function buildService(projection = buildProjection()) {
  const projectionService = {
    build: jest.fn().mockResolvedValue(projection),
  };
  const editorialBriefService = {
    getApprovedBriefContext: jest.fn().mockResolvedValue(null),
  };
  return {
    projectionService,
    editorialBriefService,
    service: new GenerationContextBuilder(
      projectionService as never,
      undefined,
      editorialBriefService as never,
    ),
  };
}

describe('GenerationContextBuilder', () => {
  it('builds compact education context', async () => {
    const { service } = buildService();

    const context = await service.build({
      diagnosisRegistryId: 'registry-1',
      purpose: 'education',
    });

    expect(context.diagnosis.displayLabel).toBe('Appendicitis');
    expect(context.conciseClinicalContext).toContain('Appendicitis');
    expect(context.mustInclude).toEqual(
      expect.arrayContaining([
        'McBurney point tenderness',
        'Rovsing sign',
        'Periumbilical pain migrated to RLQ',
      ]),
    );
    expect(context.mimics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          diagnosis: 'gastroenteritis',
          keySeparator:
            'Localized peritoneal signs argue against gastroenteritis.',
        }),
      ]),
    );
  });

  it('does not include full raw case payloads', async () => {
    const { service } = buildService();

    const context = await service.build({
      diagnosisRegistryId: 'registry-1',
      purpose: 'education',
    });

    expect(JSON.stringify(context)).not.toContain('FULL_RAW_CASE_PAYLOAD');
  });

  it('includes required rule pack guidance', async () => {
    const { service } = buildService();
    const legacyRules = new EducationTeachingRulesService().getRules({
      canonicalName: 'appendicitis',
    });

    const context = await service.build({
      diagnosisRegistryId: 'registry-1',
      purpose: 'education',
    });

    expect(context.scoringSystems).toContain('Alvarado score');
    expect(context.investigations).toContain('CT abdomen');
    expect(context.pitfalls).toContain('Normal early WBC');
    expect(context.managementAnchors).toContain('surgical consultation');
    expect(context.requiredTeachingUnits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'peritoneal_irritation',
          label: 'Peritoneal irritation',
        }),
      ]),
    );
    expect(context.suggestedManifestations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          teachingUnitId: 'peritoneal_irritation',
          manifestation: 'Rovsing sign',
        }),
      ]),
    );
    expect(context.requiredTeachingUnits.map((unit) => unit.id)).toEqual(
      legacyRules?.teachingUnits.map((unit) => unit.id),
    );
  });

  it('includes published education concepts when present', async () => {
    const { service } = buildService(
      buildProjection({
        learningGoals: ['Education-derived learning goal'],
      }),
    );

    const context = await service.build({
      diagnosisRegistryId: 'registry-1',
      purpose: 'education',
    });

    expect(context.learningGoals).toContain('Education-derived learning goal');
    expect(context.sourceSummary.hasEducation).toBe(true);
  });

  it('includes approved editorial brief context when present', async () => {
    const { service, editorialBriefService } = buildService();
    editorialBriefService.getApprovedBriefContext.mockResolvedValueOnce({
      id: 'brief-1',
      status: 'APPROVED',
      version: 2,
      summary: 'Teach appendicitis with staged mimic persistence.',
      learningGoals: ['Use staged RLQ reasoning.'],
      requiredTeachingRuleIds: ['rule-1'],
      requiredMimicIds: ['mimic-1'],
      requiredPitfalls: ['Do not overtrust normal WBC.'],
      keyInvestigations: ['CT interpretation'],
      managementAnchors: ['early surgical consult'],
      difficultyGuidance: ['Avoid early CT reveal.'],
      caseGenerationGuidance: ['Preserve gastroenteritis early.'],
      educationGuidance: ['Emphasize discriminators.'],
      graphGuidance: ['Promote mechanism facts.'],
    });

    const context = await service.build({
      diagnosisRegistryId: 'registry-1',
      purpose: 'case',
    });

    expect(context.editorialBrief?.id).toBe('brief-1');
    expect(context.learningGoals).toContain('Use staged RLQ reasoning.');
    expect(context.difficultyGuidance.forbiddenEarlyClues).toContain(
      'Avoid early CT reveal.',
    );
    expect(context.sourceSummary.hasEditorialBrief).toBe(true);
  });

  it('excludes inactive editorial brief context', async () => {
    const { service, editorialBriefService } = buildService();
    editorialBriefService.getApprovedBriefContext.mockResolvedValueOnce(null);

    const context = await service.build({
      diagnosisRegistryId: 'registry-1',
      purpose: 'education',
    });

    expect(context.editorialBrief).toBeNull();
    expect(context.sourceSummary.hasEditorialBrief).toBe(false);
  });

  it('includes case-derived mimics and discriminators when present', async () => {
    const { service } = buildService();

    const context = await service.build({
      diagnosisRegistryId: 'registry-1',
      purpose: 'case',
    });

    expect(context.mimics.map((item) => item.diagnosis)).toContain(
      'gastroenteritis',
    );
    expect(context.discriminators).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          discriminatesFrom: 'gastroenteritis',
        }),
      ]),
    );
  });

  it('returns stable output for same inputs', async () => {
    const { service } = buildService();

    const first = await service.build({
      diagnosisRegistryId: 'registry-1',
      purpose: 'graph',
    });
    const second = await service.build({
      diagnosisRegistryId: 'registry-1',
      purpose: 'graph',
    });

    expect(second).toEqual(first);
  });

  it('includes DKA concept-guided generation units and manifestations', async () => {
    const { service } = buildService(
      buildProjection({
        diagnosis: {
          ...buildProjection().diagnosis,
          displayLabel: 'Diabetic ketoacidosis',
          canonicalName: 'diabetic ketoacidosis',
          aliases: ['DKA'],
        },
      }),
    );

    const context = await service.build({
      diagnosisRegistryId: 'registry-1',
      purpose: 'education',
    });

    expect(context.requiredTeachingUnits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'potassium_before_insulin',
          importance: 'critical',
        }),
        expect.objectContaining({
          id: 'metabolic_acidosis_compensation',
        }),
      ]),
    );
    expect(context.suggestedManifestations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          manifestation: 'deep labored breathing',
        }),
      ]),
    );
  });

  it('uses hard difficulty to delay giveaway manifestations in case context', async () => {
    const { service } = buildService(
      buildProjection({
        diagnosis: {
          ...buildProjection().diagnosis,
          displayLabel: 'Diabetic ketoacidosis',
          canonicalName: 'diabetic ketoacidosis',
          difficultyBand: 'ADVANCED',
          aliases: ['DKA'],
        },
        difficultyGuidance: {
          baselineDifficulty: 'ADVANCED',
          targetDifficulty: 'hard',
          targetSolveClue: null,
          forbiddenEarlyClues: ['ketones and acidosis together'],
          keepAliveDifferentials: ['sepsis', 'gastroenteritis'],
        },
      }),
    );

    const context = await service.build({
      diagnosisRegistryId: 'registry-1',
      purpose: 'case',
    });

    expect(context.difficultyStrategy.targetDifficulty).toBe('hard');
    expect(context.difficultyStrategy.revealCoreUnitByClue).toBe(4);
    expect(context.difficultyStrategy.avoidTooEarly).toEqual(
      expect.arrayContaining([
        'diabetic ketoacidosis',
        'DKA',
        'ketones and acidosis together',
      ]),
    );
  });
});
