import { GenerationContextBuilder } from './generation-context-builder.service';
import type { EditorialIntentProjection } from './editorial-intent-projection.service';

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
  return {
    projectionService,
    service: new GenerationContextBuilder(projectionService as never),
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

    const context = await service.build({
      diagnosisRegistryId: 'registry-1',
      purpose: 'education',
    });

    expect(context.scoringSystems).toContain('Alvarado score');
    expect(context.investigations).toContain('CT abdomen');
    expect(context.pitfalls).toContain('Normal early WBC');
    expect(context.managementAnchors).toContain('surgical consultation');
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
});
