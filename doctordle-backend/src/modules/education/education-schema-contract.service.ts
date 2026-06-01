import { Injectable } from '@nestjs/common';

export type EducationContractSection =
  | 'differential'
  | 'investigation'
  | 'examPearl'
  | 'managementAnchor'
  | 'pitfall';

export type EducationSchemaField =
  | 'content'
  | 'whyItMatters'
  | 'discriminator'
  | 'managementImplication'
  | 'escalationImplication'
  | 'trapAvoided';

export type EducationSchemaContractDefinition = {
  id: EducationContractSection;
  label: string;
  canonicalFields: EducationSchemaField[];
  requiredSignals: string[];
  template: string;
  goodExample: Record<string, unknown>;
};

export type CanonicalTypedPearl = Record<EducationSchemaField, string | null> & {
  id: string | null;
  title: string | null;
  type: string | null;
};

const TYPED_PEARL_KEYS = [
  'id',
  'type',
  'title',
  'content',
  'whyItMatters',
  'discriminator',
  'managementImplication',
  'escalationImplication',
  'trapAvoided',
] as const;

@Injectable()
export class EducationSchemaContractService {
  private readonly typedPearlKeys = [...TYPED_PEARL_KEYS];

  private readonly contracts: EducationSchemaContractDefinition[] = [
    {
      id: 'differential',
      label: 'Differential comparison',
      canonicalFields: [
        'content',
        'discriminator',
        'managementImplication',
        'whyItMatters',
        'trapAvoided',
      ],
      requiredSignals: [
        'overlap in content',
        'explicit comparative discriminator',
        'management implication or trap avoided',
      ],
      template:
        'content names overlap and comparison; discriminator names separator; managementImplication or trapAvoided explains consequence.',
      goodExample: this.typedPearl({
        id: 'gastroenteritis-mimic',
        type: 'HIGH_YIELD_DISCRIMINATOR',
        title: 'Gastroenteritis mimic',
        content:
          'Both can cause early abdominal pain, nausea, and vomiting, but progressive RLQ localization with guarding favors appendicitis whereas diffuse cramps with prominent diarrhea favors gastroenteritis.',
        whyItMatters:
          'The separator changes urgency because missed appendicitis delays surgical evaluation and increases perforation risk.',
        discriminator:
          'RLQ peritonism rather than diffuse cramping with prominent diarrhea.',
        managementImplication:
          'Escalate toward surgical evaluation when focal peritoneal findings emerge.',
        trapAvoided:
          'Mislabeling focal peritonism as uncomplicated gastroenteritis.',
      }),
    },
    {
      id: 'investigation',
      label: 'Investigation interpretation',
      canonicalFields: ['content', 'whyItMatters', 'managementImplication'],
      requiredSignals: [
        'test and expected result in content',
        'interpretation in whyItMatters',
        'use or limit in managementImplication',
      ],
      template:
        'content names test plus expected finding; whyItMatters interprets what it supports or argues against; managementImplication says how it should be used.',
      goodExample: this.typedPearl({
        id: 'cbc-interpretation',
        type: 'INVESTIGATION',
        title: 'CBC',
        content:
          'CBC may show neutrophilic leukocytosis as supportive evidence of appendiceal inflammation.',
        whyItMatters:
          'Leukocytosis supports inflammation, but a normal early WBC does not exclude appendicitis.',
        managementImplication:
          'Interpret alongside evolving focal signs rather than using it as a standalone rule-out.',
        trapAvoided: 'Treating a normal early WBC as reassuring.',
      }),
    },
    {
      id: 'examPearl',
      label: 'Exam mechanism',
      canonicalFields: ['content', 'whyItMatters', 'discriminator'],
      requiredSignals: [
        'named finding in title or content',
        'mechanism in content',
        'diagnostic impact in whyItMatters',
      ],
      template:
        'content names finding and mechanism; whyItMatters explains probability shift; discriminator distinguishes a mimic.',
      goodExample: this.typedPearl({
        id: 'rovsing-sign',
        type: 'EXAM',
        title: 'Rovsing sign',
        content:
          'Left-sided palpation produces right-sided pain because inflamed peritoneum is irritated across the abdomen.',
        whyItMatters:
          'This favors appendicitis over uncomplicated gastroenteritis because diffuse mucosal illness should not cause focal contralateral peritoneal pain.',
        discriminator:
          'Focal contralateral peritoneal pain rather than diffuse cramping.',
      }),
    },
    {
      id: 'managementAnchor',
      label: 'Management anchor',
      canonicalFields: [
        'content',
        'whyItMatters',
        'managementImplication',
        'escalationImplication',
      ],
      requiredSignals: [
        'action and indication in content',
        'rationale in whyItMatters',
        'operational next step or escalation implication',
      ],
      template:
        'content states action and when; whyItMatters gives rationale; managementImplication/escalationImplication names next-step consequence.',
      goodExample: this.typedPearl({
        id: 'early-surgical-consult',
        type: 'MANAGEMENT',
        title: 'Early surgical consultation',
        content:
          'Request early surgical consultation when focal peritonism or high clinical suspicion suggests appendicitis.',
        whyItMatters:
          'Source control planning is needed because appendiceal inflammation can progress to perforation.',
        managementImplication:
          'Keep the patient NPO and align imaging, analgesia, and operative planning.',
        escalationImplication:
          'Delay increases perforation risk and broadens operative complexity.',
      }),
    },
    {
      id: 'pitfall',
      label: 'Pitfall trap',
      canonicalFields: ['content', 'whyItMatters', 'trapAvoided'],
      requiredSignals: [
        'specific trap in content',
        'consequence in whyItMatters',
        'safer heuristic in trapAvoided',
      ],
      template:
        'content names trap; whyItMatters names consequence; trapAvoided gives safer heuristic.',
      goodExample: this.typedPearl({
        id: 'normal-early-wbc',
        type: 'PITFALL',
        title: 'Normal early WBC',
        content:
          'A normal early WBC can falsely reassure before appendiceal inflammation evolves.',
        whyItMatters:
          'Overweighting the lab lowers suspicion incorrectly and can delay reassessment or imaging.',
        trapAvoided:
          'Do not use a normal early WBC to rule out appendicitis when focal pain is evolving.',
      }),
    },
  ];

  getTypedPearlKeys(): string[] {
    return [...this.typedPearlKeys];
  }

  getPromptContract() {
    return {
      typedPearlKeys: this.getTypedPearlKeys(),
      sections: this.contracts.map((contract) => ({
        id: contract.id,
        label: contract.label,
        canonicalFields: contract.canonicalFields,
        requiredSignals: contract.requiredSignals,
        template: contract.template,
        goodExample: contract.goodExample,
      })),
      recallPromptShape: {
        keys: [
          'id',
          'type',
          'prompt',
          'answer',
          'explanation',
          'linkedConcept',
          'sourceSection',
          'difficulty',
        ],
        instruction:
          'Ask why a finding changes probability, distinguishes a mimic, avoids a trap, or changes a next step.',
        goodExample: {
          id: 'rebound-vs-gastroenteritis',
          type: 'DISTINGUISH',
          prompt:
            'Why does focal rebound tenderness shift away from gastroenteritis in suspected appendicitis?',
          answer:
            'It reflects peritoneal irritation, which favors appendiceal inflammation rather than diffuse mucosal irritation.',
          explanation:
            'The reasoning target is the mechanism and discriminator, not recall of a definition.',
          linkedConcept: 'peritoneal irritation',
          sourceSection: 'examPearls',
          difficulty: 'INTERMEDIATE',
        },
      },
    };
  }

  getPromptPatterns() {
    return this.contracts.map((contract) => ({
      id: contract.id,
      label: contract.label,
      requiredElements: contract.requiredSignals,
      template: contract.template,
      goodExample: contract.goodExample,
    }));
  }

  compactGenerationContext(context: Record<string, unknown>) {
    const requiredTeachingUnits = this.asArray(context.requiredTeachingUnits)
      .map((unit) => this.asObject(unit))
      .filter((unit) => unit.importance === 'critical')
      .slice(0, 8)
      .map((unit) => ({
        id: unit.id,
        label: unit.label,
        category: unit.category,
        rationale: unit.rationale,
        acceptableManifestations: this.asArray(unit.acceptableManifestations)
          .slice(0, 3),
      }));

    return {
      diagnosis: context.diagnosis,
      conciseClinicalContext: context.conciseClinicalContext,
      learningGoals: this.asArray(context.learningGoals).slice(0, 5),
      requiredTeachingUnits,
      expectedNamedSigns: this.asArray(context.mustInclude).slice(0, 8),
      expectedScoringSystems: this.asArray(context.scoringSystems).slice(0, 5),
      expectedInvestigations: this.asArray(context.investigations).slice(0, 8),
      expectedMimics: this.asArray(context.mimics)
        .slice(0, 6)
        .map((mimic) => {
          const object = this.asObject(mimic);
          return object.diagnosis ?? mimic;
        }),
      targetDiscriminators: this.asArray(context.discriminators)
        .slice(0, 6)
        .map((discriminator) => {
          const object = this.asObject(discriminator);
          return {
            finding: object.finding,
            discriminatesFrom: object.discriminatesFrom,
            rationale: object.rationale,
          };
        }),
      expectedPitfalls: this.asArray(context.pitfalls).slice(0, 8),
      expectedManagementAnchors: this.asArray(context.managementAnchors).slice(
        0,
        8,
      ),
    };
  }

  readTypedPearl(value: unknown): CanonicalTypedPearl {
    const object = this.asObject(value);
    return {
      id: this.cleanString(object.id),
      type: this.cleanString(object.type),
      title: this.cleanString(object.title),
      content: this.cleanString(object.content),
      whyItMatters: this.cleanString(object.whyItMatters),
      discriminator: this.cleanString(object.discriminator),
      managementImplication: this.cleanString(object.managementImplication),
      escalationImplication: this.cleanString(object.escalationImplication),
      trapAvoided: this.cleanString(object.trapAvoided),
    };
  }

  canonicalText(
    value: unknown,
    fields: EducationSchemaField[] = [
      'content',
      'whyItMatters',
      'discriminator',
      'managementImplication',
      'escalationImplication',
      'trapAvoided',
    ],
  ): string {
    const pearl = this.readTypedPearl(value);
    return fields
      .map((field) => pearl[field])
      .filter((field): field is string => Boolean(field))
      .join(' ');
  }

  private typedPearl(
    overrides: Partial<Record<(typeof TYPED_PEARL_KEYS)[number], unknown>>,
  ): Record<string, unknown> {
    return {
      id: null,
      type: 'PATTERN_RECOGNITION',
      title: null,
      content: '',
      whyItMatters: null,
      discriminator: null,
      managementImplication: null,
      escalationImplication: null,
      trapAvoided: null,
      ...overrides,
    };
  }

  private asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private asObject(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private cleanString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }
}
