import { EducationSectionQualityClassifier } from './education-section-quality-classifier.service';
import type { EducationDraftQualityResult } from './education-draft-quality-validator.service';

describe('EducationSectionQualityClassifier', () => {
  const classifier = new EducationSectionQualityClassifier();

  it('recommends regeneration for weak differentials', () => {
    const summary = classifier.summarize(
      buildQualityResult({
        warnings: [
          'differential_missing_key_separator',
          'weak_comparative_differential_quality',
        ],
        blockers: ['no_comparative_differentials'],
        sectionScores: { differentials: 0.25 },
      }),
    );

    expect(summary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section: 'differentials',
          regenerationRecommended: true,
          blockers: ['no_comparative_differentials'],
        }),
      ]),
    );
  });

  it('maps coverage warnings to their owning section', () => {
    const summary = classifier.summarize(
      buildQualityResult({
        coverageWarnings: [
          {
            code: 'missing_required_investigation',
            item: 'ketones',
            section: 'investigations',
            severity: 'warning',
          },
        ],
        coverageScores: { investigations: 0.5 },
      }),
    );

    expect(summary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section: 'investigations',
          regenerationRecommended: true,
          warnings: expect.arrayContaining([
            'missing_required_investigation:ketones',
          ]),
        }),
      ]),
    );
  });
});

function buildQualityResult(
  overrides: Partial<EducationDraftQualityResult> & {
    sectionScores?: Partial<EducationDraftQualityResult['sectionScores']>;
    coverageScores?: Partial<EducationDraftQualityResult['coverageScores']>;
  } = {},
): EducationDraftQualityResult {
  return {
    warnings: overrides.warnings ?? [],
    blockers: overrides.blockers ?? [],
    coverageWarnings: overrides.coverageWarnings ?? [],
    scores: {
      clinicalSpecificityScore: 1,
      atomicityScore: 1,
      differentialReasoningScore: 1,
      investigationInterpretationScore: 1,
      pitfallQualityScore: 1,
      managementAnchorScore: 1,
      recallReasoningScore: 1,
      graphReadinessScore: 1,
      ...(overrides.scores ?? {}),
    },
    sectionScores: {
      differentials: 1,
      investigations: 1,
      examPearls: 1,
      pitfalls: 1,
      management: 1,
      recallPrompts: 1,
      ...(overrides.sectionScores ?? {}),
    },
    coverageScores: {
      differentials: 1,
      pitfalls: 1,
      findings: 1,
      investigations: 1,
      examMechanisms: 1,
      managementAnchors: 1,
      recallConcepts: 1,
      overall: 1,
      ...(overrides.coverageScores ?? {}),
    },
    patternComplianceScores: {
      differential: 1,
      investigation: 1,
      examPearl: 1,
      managementAnchor: 1,
      pitfall: 1,
      recallPrompt: 1,
      overall: 1,
      ...(overrides.patternComplianceScores ?? {}),
    },
  };
}
