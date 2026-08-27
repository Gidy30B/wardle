import { EducationSectionCoverageService } from './education-section-coverage.service';
import type { EducationTeachingRulePack } from './education-teaching-rules.service';

describe('EducationSectionCoverageService', () => {
  const service = new EducationSectionCoverageService();

  it('flags Cerebral Palsy management concepts lost by a narrower proposal', () => {
    const repairSpecification = service.buildRepairSpecification({
      section: 'management',
      baseEducationId: 'education-cp',
      baseVersion: 7,
      currentSection: cerebralPalsyManagementCurrent(),
      teachingRules: null,
    });

    const comparison = service.compare({
      repairSpecification,
      proposedSection: cerebralPalsyManagementWithoutLongitudinalCoverage(),
    });

    expect(comparison.coverageRegression).toBe(true);
    expect(comparison.lost.map((change) => change.concept.label)).toEqual(
      expect.arrayContaining([
        'Orthopaedic surveillance',
        'Family and long-term planning',
      ]),
    );
    expect(comparison.coverageRegressionConcepts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Orthopaedic surveillance' }),
        expect.objectContaining({ label: 'Family and long-term planning' }),
      ]),
    );
  });

  it('allows consolidation when all Cerebral Palsy management concepts remain covered', () => {
    const repairSpecification = service.buildRepairSpecification({
      section: 'management',
      baseEducationId: 'education-cp',
      baseVersion: 7,
      currentSection: cerebralPalsyManagementCurrent(),
      teachingRules: null,
    });

    const comparison = service.compare({
      repairSpecification,
      proposedSection: [
        pearl(
          'diagnosis-therapy',
          'Management diagnosis and therapy plan',
          'Coordinate multidisciplinary diagnosis with gross motor function classification while planning physiotherapy and occupational therapy for function and participation.',
        ),
        pearl(
          'tone-comorbidity',
          'Tone and comorbidity management',
          'Treat spasticity when it limits care or function and screen for seizures, nutrition, sleep, pain, and communication comorbidities.',
        ),
        pearl(
          'surveillance-family',
          'Surveillance and family planning',
          'Maintain orthopaedic surveillance for hips and contractures while aligning long-term family planning, school support, equipment, and transition goals.',
        ),
      ],
    });

    expect(comparison.coverageRegression).toBe(false);
    expect(comparison.lost).toEqual([]);
    expect(comparison.consolidated.length).toBeGreaterThan(0);
  });

  it('does not count removal of a pure duplicate as coverage loss', () => {
    const repairSpecification = service.buildRepairSpecification({
      section: 'investigations',
      baseEducationId: 'education-1',
      baseVersion: 2,
      currentSection: [
        pearl(
          'renal-ultrasound-1',
          'Renal ultrasound',
          'Renal ultrasound shows kidney size and obstruction patterns that influence diagnostic likelihood and next investigation.',
        ),
        pearl(
          'renal-ultrasound-2',
          'Renal ultrasound',
          'Renal ultrasound demonstrates kidney size and obstruction patterns that influence diagnostic likelihood and next investigation.',
        ),
      ],
      teachingRules: null,
    });

    const comparison = service.compare({
      repairSpecification,
      proposedSection: [
        pearl(
          'renal-ultrasound',
          'Renal ultrasound',
          'Renal ultrasound demonstrates kidney size and obstruction patterns that influence diagnostic likelihood and next investigation.',
        ),
      ],
    });

    expect(comparison.coverageRegression).toBe(false);
    expect(comparison.lost).toEqual([]);
  });

  it('marks missing approved Teaching Rule coverage as a regression', () => {
    const repairSpecification = service.buildRepairSpecification({
      section: 'management',
      baseEducationId: 'education-1',
      baseVersion: 2,
      currentSection: [
        pearl(
          'support',
          'Supportive management',
          'Coordinate therapy and monitoring when symptoms affect function.',
        ),
      ],
      teachingRules: teachingRulesWithManagementRequirement(
        'orthopaedic_surveillance',
        'Orthopaedic surveillance',
        ['hip surveillance', 'contracture monitoring'],
      ),
    });

    const comparison = service.compare({
      repairSpecification,
      proposedSection: [
        pearl(
          'support',
          'Supportive management',
          'Coordinate therapy and monitoring when symptoms affect function.',
        ),
      ],
    });

    expect(comparison.coverageRegression).toBe(true);
    expect(comparison.lost).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          concept: expect.objectContaining({
            source: 'teaching_rule',
            sourceId: 'orthopaedic_surveillance',
          }),
        }),
      ]),
    );
  });

  it('preserves investigation, exam, and differential concepts across semantic wording', () => {
    const sections = [
      {
        section: 'investigations' as const,
        current: pearl(
          'anti-pla2r',
          'Anti-PLA2R antibody',
          'Anti-PLA2R antibody positivity supports primary membranous nephropathy and changes diagnostic likelihood.',
        ),
        proposed: pearl(
          'pla2r',
          'PLA2R serology',
          'Positive PLA2R serology favors primary membranous nephropathy and guides biopsy interpretation.',
        ),
      },
      {
        section: 'examPearls' as const,
        current: pearl(
          'periorbital-edema',
          'Periorbital edema',
          'Periorbital edema reflects nephrotic sodium retention and increases likelihood of nephrotic syndrome.',
        ),
        proposed: pearl(
          'edema',
          'Periorbital edema',
          'Morning periorbital swelling occurs because nephrotic sodium retention shifts fluid into loose tissues.',
        ),
      },
      {
        section: 'differentials' as const,
        current: pearl(
          'minimal-change',
          'Minimal change disease',
          'Both cause nephrotic syndrome, but minimal change disease lacks PLA2R-associated adult membranous features.',
        ),
        proposed: pearl(
          'minimal-change-disease',
          'Minimal change disease',
          'Both can mimic nephrotic syndrome, whereas PLA2R positivity favors membranous nephropathy rather than minimal change disease.',
        ),
      },
    ];

    for (const scenario of sections) {
      const repairSpecification = service.buildRepairSpecification({
        section: scenario.section,
        baseEducationId: 'education-1',
        baseVersion: 1,
        currentSection: [scenario.current],
        teachingRules: null,
      });

      const comparison = service.compare({
        repairSpecification,
        proposedSection: [scenario.proposed],
      });

      expect(comparison.coverageRegression).toBe(false);
      expect(comparison.lost).toEqual([]);
    }
  });
});

function cerebralPalsyManagementCurrent() {
  return [
    pearl(
      'multidisciplinary-diagnosis',
      'Multidisciplinary diagnosis and GMFCS classification',
      'Use multidisciplinary diagnosis and gross motor function classification to define severity, functional goals, and communication needs.',
    ),
    pearl(
      'therapy',
      'Physiotherapy and occupational therapy',
      'Start physiotherapy and occupational therapy to preserve range, strengthen function, support equipment needs, and reduce contractures.',
    ),
    pearl(
      'spasticity',
      'Spasticity management',
      'Treat spasticity when tone limits hygiene, comfort, sleep, or function, escalating from therapy to medicines or focal treatment.',
    ),
    pearl(
      'comorbidity',
      'Comorbidity screening',
      'Screen for seizures, feeding difficulty, nutrition, pain, sleep, vision, hearing, and communication comorbidities during follow-up.',
    ),
    pearl(
      'orthopaedic-surveillance',
      'Orthopaedic surveillance',
      'Maintain orthopaedic surveillance for hip displacement, scoliosis, gait deterioration, and contractures because mobility can worsen silently.',
    ),
    pearl(
      'family-planning',
      'Family and long-term planning',
      'Include family goals, school support, equipment, transition planning, and respite needs in the long-term care plan.',
    ),
  ];
}

function cerebralPalsyManagementWithoutLongitudinalCoverage() {
  return [
    pearl(
      'diagnosis',
      'Multidisciplinary diagnosis and GMFCS classification',
      'Coordinate multidisciplinary diagnosis with gross motor function classification to set severity, function, and communication goals.',
    ),
    pearl(
      'therapy',
      'Physiotherapy and occupational therapy',
      'Use physiotherapy and occupational therapy when motor impairment limits function, range, equipment use, or participation.',
    ),
    pearl(
      'spasticity',
      'Spasticity management',
      'Treat spasticity when tone causes pain, hygiene difficulty, sleep disruption, or function loss.',
    ),
    pearl(
      'comorbidity',
      'Comorbidity screening',
      'Screen for seizures, feeding difficulty, nutrition, sleep, pain, vision, hearing, and communication comorbidities.',
    ),
  ];
}

function pearl(id: string, title: string, content: string) {
  return {
    id,
    type: 'MANAGEMENT',
    title,
    content,
    whyItMatters:
      'This changes operational planning because missing the concept weakens diagnosis-specific education.',
    discriminator: 'Specific concept rather than generic supportive care.',
    managementImplication:
      'Use this concept to guide review, monitoring, escalation, or follow-up.',
    escalationImplication:
      'Delayed recognition can weaken longitudinal care or diagnostic reasoning.',
    trapAvoided: 'Avoid replacing a specific anchor with generic prose.',
  };
}

function teachingRulesWithManagementRequirement(
  id: string,
  label: string,
  acceptableManifestations: string[],
): EducationTeachingRulePack {
  return {
    diagnosisKey: 'cerebral_palsy',
    teachingUnits: [
      {
        id,
        label,
        category: 'management_concept',
        importance: 'critical',
        rationale: 'Required by approved teaching rule.',
        acceptableManifestations,
        appliesToEducation: true,
        appliesToCaseGeneration: true,
        source: 'persisted_teaching_rule',
      },
    ],
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
    requiredManagementAnchors: acceptableManifestations,
    requiredRecallConcepts: [],
    source: 'persisted_teaching_rule',
  };
}
