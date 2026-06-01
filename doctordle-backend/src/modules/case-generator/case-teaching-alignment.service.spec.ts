import type { GenerationContext } from '../editorial/generation-context-builder.service';
import type { TeachingUnit } from '../education/education-teaching-rules.service';
import type { GeneratedCase } from './case-generator.types';
import { CaseTeachingAlignmentService } from './case-teaching-alignment.service';

const dkaPotassiumUnit: TeachingUnit = {
  id: 'potassium_before_insulin',
  label: 'Potassium before insulin',
  category: 'management_concept',
  importance: 'critical',
  rationale: 'Insulin can precipitate hypokalemia.',
  acceptableManifestations: [
    'check potassium before insulin',
    'replace potassium before insulin if low',
    'normal serum potassium may mask depleted total body potassium',
  ],
  appliesToEducation: true,
  appliesToCaseGeneration: true,
};

const dkaAcidosisUnit: TeachingUnit = {
  id: 'ketosis_acidosis_distinguishes_dka',
  label: 'Ketosis and acidosis distinguish DKA',
  category: 'investigation_concept',
  importance: 'critical',
  rationale: 'Ketosis with metabolic acidosis separates DKA from HHS.',
  acceptableManifestations: [
    'blood ketones with metabolic acidosis',
    'anion gap metabolic acidosis',
  ],
  appliesToEducation: true,
  appliesToCaseGeneration: true,
  avoidTooEarly: ['DKA', 'Kussmaul respirations'],
};

const appendicitisPeritonealUnit: TeachingUnit = {
  id: 'peritoneal_irritation',
  label: 'Peritoneal irritation',
  category: 'exam_mechanism',
  importance: 'critical',
  rationale: 'Peritoneal irritation separates appendicitis from diffuse mimics.',
  acceptableManifestations: [
    'Rovsing sign',
    'guarding',
    'rebound tenderness',
    'psoas sign',
  ],
  appliesToEducation: true,
  appliesToCaseGeneration: true,
};

function buildContext(
  overrides: Partial<GenerationContext> = {},
): GenerationContext {
  return {
    diagnosis: {
      id: 'registry-1',
      displayLabel: 'Diabetic ketoacidosis',
      canonicalName: 'diabetic ketoacidosis',
      aliases: ['DKA'],
    },
    conciseClinicalContext: '',
    learningGoals: [],
    mustInclude: [],
    avoid: [],
    mimics: [],
    discriminators: [],
    pitfalls: [],
    investigations: [],
    scoringSystems: [],
    managementAnchors: [],
    requiredTeachingUnits: [dkaPotassiumUnit, dkaAcidosisUnit],
    suggestedManifestations: [],
    difficultyStrategy: {
      targetDifficulty: 'medium',
      revealCoreUnitByClue: 3,
      avoidTooEarly: ['DKA', 'Kussmaul respirations'],
      allowAlternativeManifestations: true,
    },
    difficultyGuidance: {
      baselineDifficulty: 'INTERMEDIATE',
      targetDifficulty: 'medium',
      targetSolveClue: null,
      forbiddenEarlyClues: [],
      keepAliveDifferentials: ['HHS', 'gastroenteritis'],
    },
    sourceSummary: {
      hasEducation: true,
      hasCases: false,
      hasRules: true,
      hasGraphFacts: false,
    },
    ...overrides,
  };
}

function buildCase(overrides: Partial<GeneratedCase> = {}): GeneratedCase {
  return {
    answer: 'diabetic ketoacidosis',
    differentials: ['HHS', 'gastroenteritis', 'sepsis'],
    clues: [
      {
        order: 0,
        type: 'history',
        value: 'A young adult has vomiting, thirst, and dehydration after missed insulin.',
      },
      {
        order: 1,
        type: 'vital',
        value: 'HR is 118/min with dry mucous membranes.',
      },
      {
        order: 2,
        type: 'lab',
        value:
          'Glucose is 420 mg/dL, bicarbonate is 13 mEq/L, and beta-hydroxybutyrate is elevated.',
      },
      {
        order: 3,
        type: 'lab',
        value:
          'Serum potassium is checked before insulin because insulin can worsen hypokalemia.',
      },
      {
        order: 4,
        type: 'lab',
        value: 'Anion gap is elevated and venous pH is 7.22.',
      },
      {
        order: 5,
        type: 'lab',
        value: 'Ketones improve after fluid and insulin therapy.',
      },
    ],
    explanation: {
      diagnosis: 'Diabetic ketoacidosis',
      summary: 'Hyperglycemia with ketosis and acidosis supports DKA.',
      reasoning: ['Potassium safety matters before insulin therapy.'],
      keyFindings: ['Ketosis', 'Acidosis', 'Hyperglycemia'],
      differentialAnalysis: [
        {
          diagnosis: 'HHS',
          whyPlausibleEarly: 'Vomiting, dehydration, and hyperglycemia overlap early.',
          ruledOutByClues: [
            {
              clueOrder: 3,
              evidence: 'Ketones and metabolic acidosis are present.',
              reason: 'HHS has less ketosis and acidosis.',
            },
          ],
          finalReasonLessLikely: 'Ketosis and acidosis favor DKA.',
        },
      ],
    },
    ...overrides,
  };
}

describe('CaseTeachingAlignmentService', () => {
  const service = new CaseTeachingAlignmentService();

  it('marks DKA potassium teaching unit covered by a potassium clue', () => {
    const report = service.buildReport({
      caseData: buildCase(),
      diagnosisRegistryId: 'registry-1',
      generationContext: buildContext(),
      selectedTeachingUnits: [dkaPotassiumUnit],
    });

    expect(report.selectedUnits[0]).toEqual(
      expect.objectContaining({
        id: 'potassium_before_insulin',
        covered: true,
        firstClueIndex: 3,
      }),
    );
  });

  it('covers DKA potassium unit by alternative manifestation', () => {
    const report = service.buildReport({
      caseData: buildCase({
        clues: [
          ...buildCase().clues.slice(0, 3),
          {
            order: 3,
            type: 'lab',
            value:
              'The clinician notes that normal serum potassium may mask depleted total body potassium.',
          },
          ...buildCase().clues.slice(4),
        ],
      }),
      diagnosisRegistryId: 'registry-1',
      generationContext: buildContext(),
      selectedTeachingUnits: [dkaPotassiumUnit],
    });

    expect(report.selectedUnits[0].covered).toBe(true);
    expect(report.selectedUnits[0].matchedManifestations).toContain(
      'normal serum potassium may mask depleted total body potassium',
    );
  });

  it('covers appendicitis peritoneal irritation by rebound guarding or Rovsing', () => {
    const report = service.buildReport({
      caseData: buildCase({
        answer: 'appendicitis',
        differentials: ['gastroenteritis', 'renal colic'],
        clues: [
          {
            order: 0,
            type: 'history',
            value: 'Periumbilical pain migrates toward the right lower quadrant.',
          },
          {
            order: 1,
            type: 'exam',
            value: 'The abdomen has guarding and rebound tenderness near McBurney point.',
          },
        ],
      }),
      diagnosisRegistryId: 'registry-appendicitis',
      generationContext: buildContext({
        diagnosis: {
          id: 'registry-appendicitis',
          displayLabel: 'Appendicitis',
          canonicalName: 'appendicitis',
          aliases: [],
        },
      }),
      selectedTeachingUnits: [appendicitisPeritonealUnit],
    });

    expect(report.selectedUnits[0].covered).toBe(true);
    expect(report.selectedUnits[0].matchedManifestations).toEqual(
      expect.arrayContaining(['guarding', 'rebound tenderness']),
    );
  });

  it('warns when a selected teaching unit is missing', () => {
    const report = service.buildReport({
      caseData: buildCase({
        clues: buildCase().clues.filter((clue) => clue.order !== 3),
        explanation: {
          ...buildCase().explanation,
          reasoning: ['Fluids and insulin address ketosis after electrolyte review.'],
          keyFindings: ['Ketosis', 'Acidosis', 'Hyperglycemia'],
        },
      }),
      diagnosisRegistryId: 'registry-1',
      generationContext: buildContext(),
      selectedTeachingUnits: [dkaPotassiumUnit],
    });

    expect(report.selectedUnits[0].covered).toBe(false);
    expect(report.warnings).toContain(
      'missing_selected_teaching_unit:potassium_before_insulin',
    );
  });

  it('warns when a giveaway clue appears too early', () => {
    const report = service.buildReport({
      caseData: buildCase({
        clues: [
          {
            order: 0,
            type: 'lab',
            value:
              'DKA is evident with glucose 460 mg/dL, ketones, and metabolic acidosis.',
          },
          ...buildCase().clues.slice(1),
        ],
      }),
      diagnosisRegistryId: 'registry-1',
      generationContext: buildContext(),
      selectedTeachingUnits: [dkaAcidosisUnit],
    });

    expect(report.revealTiming.giveawayTooEarly).toBe(true);
    expect(report.revealTiming.earliestCoreRevealClue).toBe(0);
    expect(report.warnings).toContain('giveaway_clue_too_early');
  });

  it('does not require unselected diagnosis teaching units', () => {
    const report = service.buildReport({
      caseData: buildCase({
        clues: buildCase().clues.filter((clue) => clue.order !== 3),
        explanation: {
          ...buildCase().explanation,
          reasoning: ['Fluids and insulin address ketosis after electrolyte review.'],
          keyFindings: ['Ketosis', 'Acidosis', 'Hyperglycemia'],
        },
      }),
      diagnosisRegistryId: 'registry-1',
      generationContext: buildContext(),
      selectedTeachingUnits: [dkaAcidosisUnit],
    });

    expect(report.selectedUnits).toHaveLength(1);
    expect(report.warnings).not.toContain(
      'missing_selected_teaching_unit:potassium_before_insulin',
    );
  });

  it('lowers playability when mimics are killed too early', () => {
    const report = service.buildReport({
      caseData: buildCase({
        explanation: {
          ...buildCase().explanation,
          differentialAnalysis: [
            {
              diagnosis: 'HHS',
              whyPlausibleEarly: 'Hyperglycemia overlaps.',
              ruledOutByClues: [
                {
                  clueOrder: 1,
                  evidence: 'Ketones and acidosis are already present.',
                  reason: 'This makes HHS unlikely immediately.',
                },
              ],
              finalReasonLessLikely: 'Acidosis favors DKA.',
            },
          ],
        },
      }),
      diagnosisRegistryId: 'registry-1',
      generationContext: buildContext(),
      selectedTeachingUnits: [dkaAcidosisUnit],
    });

    expect(report.mimicPersistence.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('before the middle clues'),
      ]),
    );
    expect(report.playability.score).toBeLessThan(100);
  });
});
