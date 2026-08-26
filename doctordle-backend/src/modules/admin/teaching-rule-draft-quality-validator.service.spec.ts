import {
  TeachingRuleDraftQualityValidator,
  type TeachingRuleDraft,
} from './teaching-rule-draft-quality-validator.service';

describe('TeachingRuleDraftQualityValidator', () => {
  const validator = new TeachingRuleDraftQualityValidator();

  it('passes diagnosis-specific atomic operational rules with Brief coverage', () => {
    const result = validator.validate({
      rules: [
        rule({
          title:
            'Dermatitis herpetiformis uses grouped extensor papulovesicles as an early diagnostic pattern.',
          category: 'finding_concept',
          sourceBriefGoalIndexes: [0],
          sourceConcepts: ['grouped extensor papulovesicles'],
        }),
        rule({
          title:
            'Dermatitis herpetiformis keeps bullous pemphigoid plausible until granular IgA and grouped extensor morphology separate them.',
          category: 'differential_concept',
          requiredDifferentials: [
            {
              registryId: null,
              diagnosis: 'Bullous pemphigoid',
              whyConfused:
                'Both can produce pruritic blistering eruptions in adults.',
              keySeparator:
                'Dermatitis herpetiformis favors grouped extensor papulovesicles and granular IgA.',
            },
          ],
          sourceBriefGoalIndexes: [1],
        }),
        rule({
          title:
            'Dermatitis herpetiformis uses perilesional direct immunofluorescence as a confirmatory discriminator.',
          category: 'investigation_concept',
          expectedEvidence: {
            evidenceExpected: true,
            evidenceClass: 'confirmatory investigation',
            reason:
              'Confirmatory investigation claim requires evidence review.',
          },
          sourceConcepts: ['perilesional direct immunofluorescence'],
        }),
        rule({
          title:
            'Dermatitis herpetiformis should not be excluded solely because gastrointestinal symptoms are absent.',
          category: 'pitfall_concept',
          expectedEvidence: {
            evidenceExpected: true,
            evidenceClass: 'diagnostic pitfall',
            reason: 'Diagnostic exclusion logic requires evidence review.',
          },
          sourceConcepts: ['gastrointestinal symptoms absent'],
        }),
        rule({
          title:
            'Dermatitis herpetiformis management teaching separates rapid symptom control from long-term gluten-free disease control.',
          category: 'management_concept',
          expectedEvidence: {
            evidenceExpected: true,
            evidenceClass: 'management principle',
            reason: 'Management principle requires evidence review.',
          },
          sourceConcepts: ['symptom control', 'gluten-free disease control'],
        }),
      ],
      context: context(),
    });

    expect(result.status).toBe('PASS');
    expect(result.blockers).toEqual([]);
    expect(result.qualitySignals).toEqual(
      expect.arrayContaining([
        'diagnosis_specific',
        'atomic',
        'operational',
        'evidence_expected',
      ]),
    );
  });

  it('blocks generic and workflow recommendations', () => {
    const result = validator.validate({
      rules: [
        rule({
          title: 'Recognize important clinical features.',
          acceptableManifestations: ['Use appropriate investigations.'],
        }),
        rule({
          title: 'Activate a reasoning path for Dermatitis herpetiformis.',
          acceptableManifestations: ['Improve discriminator coverage.'],
        }),
      ],
      context: context({ brief: emptyBrief() }),
    });

    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.stringContaining('generic_teaching_rule'),
        expect.stringContaining('workflow_recommendation_not_clinical_rule'),
      ]),
    );
  });

  it('blocks wrong diagnosis and weak differential separator', () => {
    const result = validator.validate({
      rules: [
        rule({
          title:
            'Bullous pemphigoid uses tense bullae and linear staining as its discriminator.',
          category: 'differential_concept',
          acceptableManifestations: ['Tense bullae with linear staining.'],
          requiredDifferentials: [
            {
              registryId: null,
              diagnosis: 'Eczema',
              whyConfused: 'Similar rash.',
              keySeparator: 'Tests.',
            },
          ],
        }),
      ],
      context: context({ brief: emptyBrief() }),
    });

    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.stringContaining('wrong_or_missing_target_diagnosis'),
        expect.stringContaining('differential_missing_meaningful_separator'),
      ]),
    );
  });

  it('warns on overloaded and unsupported precise management claims', () => {
    const result = validator.validate({
      rules: [
        rule({
          title:
            'Dermatitis herpetiformis management combines rash recognition, direct immunofluorescence confirmation, mimic separation and dapsone 100 mg for 8 weeks.',
          category: 'management_concept',
          expectedEvidence: {
            evidenceExpected: true,
            evidenceClass: 'management principle',
            reason: 'High-risk treatment details require evidence review.',
          },
        }),
      ],
      context: context({ brief: emptyBrief() }),
    });

    expect(result.status).toBe('PASS_WITH_WARNINGS');
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('multi_concept_overloaded_rule'),
        expect.stringContaining('unsupported_treatment_precision_or_threshold'),
      ]),
    );
  });

  it('detects missing critical Brief intent', () => {
    const result = validator.validate({
      rules: [
        rule({
          title:
            'Dermatitis herpetiformis uses grouped extensor papulovesicles as an early diagnostic pattern.',
          category: 'finding_concept',
        }),
      ],
      context: context(),
    });

    expect(result.status).toBe('BLOCKED');
    expect(result.coverage.missingCriticalIntent).toEqual(
      expect.arrayContaining([
        'mimics',
        'investigations',
        'pitfalls',
        'management_anchors',
      ]),
    );
  });
});

function rule(overrides: Partial<TeachingRuleDraft> = {}): TeachingRuleDraft {
  return {
    stableKeyHint: 'dh_rule',
    title:
      'Dermatitis herpetiformis uses grouped extensor papulovesicles as an early diagnostic pattern.',
    category: 'finding_concept',
    importance: 'high',
    rationale: 'Derived from approved Brief.',
    acceptableManifestations: [
      'Grouped extensor papulovesicles support Dermatitis herpetiformis reasoning.',
    ],
    requiredDifferentials: [],
    expectedEvidence: {
      evidenceExpected: false,
      evidenceClass: null,
      reason: null,
    },
    difficultyHints: {
      relevance: 'early pattern',
      clueTiming: 'early',
      revealConstraints: [],
    },
    avoidTooEarly: false,
    appliesToEducation: true,
    appliesToCaseGeneration: true,
    appliesToGraph: false,
    sourceBriefGoalIndexes: [],
    sourceConcepts: [],
    ...overrides,
  };
}

function context(
  overrides: Partial<ReturnType<typeof baseContext>> = {},
): ReturnType<typeof baseContext> {
  return {
    ...baseContext(),
    ...overrides,
  };
}

function baseContext() {
  return {
    diagnosisName: 'Dermatitis herpetiformis',
    canonicalName: 'dermatitis herpetiformis',
    aliases: ['Duhring disease'],
    brief: {
      learningGoals: [
        'Recognize Dermatitis herpetiformis from intensely pruritic grouped extensor papulovesicles.',
        'Distinguish Dermatitis herpetiformis from bullous pemphigoid using morphology and granular IgA.',
      ],
      requiredMimicNames: ['Bullous pemphigoid'],
      requiredPitfalls: [
        'Absence of gastrointestinal symptoms does not exclude Dermatitis herpetiformis.',
      ],
      keyInvestigations: [
        'Perilesional direct immunofluorescence shows granular IgA.',
      ],
      managementAnchors: [
        'Separate rapid symptom control from long-term gluten-free disease control.',
      ],
      difficultyGuidance: [
        'Preserve rash morphology before revealing confirmatory testing.',
      ],
    },
  };
}

function emptyBrief() {
  return {
    learningGoals: [],
    requiredMimicNames: [],
    requiredPitfalls: [],
    keyInvestigations: [],
    managementAnchors: [],
    difficultyGuidance: [],
  };
}
