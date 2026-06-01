import { ValidationOutcome } from '@prisma/client';
import { CaseQualityProjectionService } from './case-quality-projection.service';

describe('CaseQualityProjectionService', () => {
  const service = new CaseQualityProjectionService();

  it('builds a strong case projection from validation and alignment signals', () => {
    const projection = service.buildProjection({
      difficulty: 'medium',
      explanation: explanationWithQuality({
        differentialPlausibilityScore: 0.91,
        clinicalEdgeValidityScore: 0.94,
        qualityScore: 0.88,
        teachingAlignment: alignment({
          selectedUnits: [
            unit('migration', true, 'critical'),
            unit('peritoneal-irritation', true, 'high'),
          ],
        }),
      }),
      validationRuns: [
        {
          outcome: ValidationOutcome.PASSED,
          summary: {},
          findings: { issues: [] },
        },
      ],
    });

    expect(projection.dimensions.clinicalValidity.status).toBe('good');
    expect(projection.dimensions.differentialPlausibility.status).toBe('good');
    expect(projection.dimensions.teachingAlignment.status).toBe('good');
    expect(projection.dimensions.playability.status).toBe('good');
    expect(projection.blockers).toEqual([]);
  });

  it('builds a weak case projection from failed validation signals', () => {
    const projection = service.buildProjection({
      difficulty: 'medium',
      explanation: explanationWithQuality({
        differentialPlausibilityScore: 0.4,
        clinicalEdgeValidityScore: 0.45,
        qualityScore: 0.5,
      }),
      validationRuns: [
        {
          outcome: ValidationOutcome.FAILED,
          summary: {},
          findings: {
            issues: [
              issue('structure', 'error', 'DIAGNOSIS_MAPPING_NOT_MATCHED'),
              issue('differential', 'error', 'DIFFERENTIALS_EMPTY'),
              issue('clue', 'error', 'CLUES_TOO_SHORT'),
            ],
          },
        },
      ],
    });

    expect(projection.dimensions.clinicalValidity.status).toBe('blocker');
    expect(projection.dimensions.differentialPlausibility.status).toBe('blocker');
    expect(projection.dimensions.playability.status).toBe('blocker');
    expect(projection.blockers).toEqual(
      expect.arrayContaining([
        'DIAGNOSIS_MAPPING_NOT_MATCHED',
        'DIFFERENTIALS_EMPTY',
        'CLUES_TOO_SHORT',
      ]),
    );
  });

  it('returns safe fallback states when validation data is missing', () => {
    const projection = service.buildProjection({
      difficulty: 'medium',
      explanation: null,
      validationRuns: [],
    });

    expect(projection.sourceSummary.hasValidationRun).toBe(false);
    expect(projection.dimensions.clinicalValidity.status).toBe('unknown');
    expect(projection.dimensions.teachingAlignment.status).toBe('unknown');
    expect(projection.dimensions.revealTiming.status).toBe('unknown');
  });

  it('flags teaching alignment failure', () => {
    const projection = service.buildProjection({
      explanation: explanationWithQuality({
        teachingAlignment: alignment({
          selectedUnits: [unit('potassium-before-insulin', false, 'critical')],
          warnings: ['missing_selected_teaching_unit:potassium-before-insulin'],
        }),
      }),
      validationRuns: [
        {
          outcome: ValidationOutcome.PASSED,
          summary: {},
          findings: { issues: [] },
        },
      ],
    });

    expect(projection.dimensions.teachingAlignment.status).toBe('blocker');
    expect(projection.dimensions.teachingAlignment.blockers).toContain(
      'critical_teaching_unit_missing:potassium-before-insulin',
    );
  });

  it('flags reveal timing and clue sequencing weakness when detectable', () => {
    const projection = service.buildProjection({
      explanation: explanationWithQuality({
        teachingAlignment: alignment({
          revealTiming: {
            earliestCoreRevealClue: 1,
            giveawayTooEarly: true,
            issues: ['Clue 1 reveals DKA before clue 3.'],
          },
          playability: {
            score: 62,
            difficultyFit: 'too_easy',
            issues: ['A high-specificity clue appears too early.'],
          },
        }),
      }),
      validationRuns: [
        {
          outcome: ValidationOutcome.PASSED,
          summary: {},
          findings: {
            issues: [
              issue('difficulty', 'warning', 'DIFFICULTY_HARD_TOO_FEW_CLUES'),
            ],
          },
        },
      ],
    });

    expect(projection.dimensions.revealTiming.status).toBe('warning');
    expect(projection.dimensions.playability.status).toBe('warning');
    expect(projection.dimensions.difficultyFit.status).toBe('warning');
  });
});

function explanationWithQuality(generationQuality: Record<string, unknown>) {
  return {
    diagnosis: 'Appendicitis',
    summary: 'Appendicitis case.',
    reasoning: ['Reasoning'],
    keyFindings: ['Finding'],
    generationQuality,
  };
}

function alignment(overrides: Record<string, unknown> = {}) {
  return {
    selectedUnits: [unit('migration', true, 'critical')],
    revealTiming: {
      giveawayTooEarly: false,
      issues: [],
    },
    mimicPersistence: {
      earlyMimicsPresent: ['gastroenteritis'],
      mimicsStillPlausibleUntilClue: 3,
      issues: [],
    },
    playability: {
      score: 90,
      difficultyFit: 'fits',
      issues: [],
    },
    warnings: [],
    ...overrides,
  };
}

function unit(id: string, covered: boolean, importance: string) {
  return {
    id,
    label: id,
    importance,
    covered,
    matchedManifestations: covered ? [id] : [],
    evidence: covered ? [`Clue 2: ${id}`] : [],
  };
}

function issue(validator: string, severity: 'error' | 'warning', code: string) {
  return {
    validator,
    severity,
    code,
    message: code,
  };
}
