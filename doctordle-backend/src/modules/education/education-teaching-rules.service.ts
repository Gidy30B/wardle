import { Injectable } from '@nestjs/common';
import type { EducationRuleRegistryMetadata } from './education-knowledge-rules.service';

export type TeachingUnitCategory =
  | 'differential_concept'
  | 'finding_concept'
  | 'exam_mechanism'
  | 'investigation_concept'
  | 'pitfall_concept'
  | 'management_concept'
  | 'recall_concept';

export type TeachingUnitImportance = 'critical' | 'high' | 'supporting';

export type TeachingUnit = {
  id: string;
  label: string;
  category: TeachingUnitCategory;
  importance: TeachingUnitImportance;
  rationale: string;
  acceptableManifestations: string[];
  appliesToEducation: boolean;
  appliesToCaseGeneration: boolean;
  avoidTooEarly?: string[];
  source?: 'persisted_teaching_rule' | 'legacy_teaching_rules';
};

export type ManifestationOption = {
  teachingUnitId: string;
  teachingUnitLabel: string;
  manifestation: string;
  category: TeachingUnitCategory;
  importance: TeachingUnitImportance;
};

export type DifficultyStrategy = {
  targetDifficulty: 'easy' | 'medium' | 'hard';
  revealCoreUnitByClue?: number;
  avoidTooEarly: string[];
  allowAlternativeManifestations: boolean;
};

export type EducationTeachingRulePack = {
  diagnosisKey: string;
  teachingUnits: TeachingUnit[];
  difficultyStrategy: DifficultyStrategy;
  requiredDifferentials: string[];
  requiredPitfalls: string[];
  requiredFindings: string[];
  requiredInvestigations: string[];
  requiredExamMechanisms: string[];
  requiredManagementAnchors: string[];
  requiredRecallConcepts: string[];
  source?: 'persisted_teaching_rule' | 'legacy_teaching_rules';
};

type TeachingRulePackDefinition = {
  diagnosisKey: string;
  teachingUnits?: TeachingUnit[];
  difficultyStrategy?: Partial<DifficultyStrategy>;
  requiredDifferentials?: string[];
  requiredPitfalls?: string[];
  requiredFindings?: string[];
  requiredInvestigations?: string[];
  requiredExamMechanisms?: string[];
  requiredManagementAnchors?: string[];
  requiredRecallConcepts?: string[];
};

const DEFAULT_DIFFICULTY_STRATEGY: DifficultyStrategy = {
  targetDifficulty: 'medium',
  revealCoreUnitByClue: 3,
  avoidTooEarly: [],
  allowAlternativeManifestations: true,
};

const TEACHING_RULE_PACKS: TeachingRulePackDefinition[] = [
  {
    diagnosisKey: 'appendicitis',
    teachingUnits: [
      unit({
        id: 'migratory_rlq_pain',
        label: 'Migratory right lower quadrant pain',
        category: 'finding_concept',
        importance: 'critical',
        rationale:
          'Visceral periumbilical pain localizes to the right lower quadrant as parietal peritoneum becomes inflamed.',
        acceptableManifestations: [
          'migratory periumbilical pain',
          'pain migrating to the right lower quadrant',
          'progressive RLQ localization',
        ],
      }),
      unit({
        id: 'peritoneal_irritation',
        label: 'Peritoneal irritation',
        category: 'exam_mechanism',
        importance: 'critical',
        rationale:
          'Peritoneal irritation distinguishes appendicitis from many diffuse abdominal pain mimics.',
        acceptableManifestations: [
          'Rovsing sign',
          'guarding',
          'rebound tenderness',
          'psoas sign',
          'McBurney point tenderness',
        ],
        avoidTooEarly: ['CT-proven appendicitis', 'appendiceal enlargement'],
      }),
      unit({
        id: 'gastroenteritis_discriminator',
        label: 'Gastroenteritis discriminator',
        category: 'differential_concept',
        importance: 'critical',
        rationale:
          'Diffuse cramps and diarrhea favor gastroenteritis, whereas focal peritonism favors appendicitis.',
        acceptableManifestations: [
          'gastroenteritis',
          'diarrhea-predominant illness argues against appendicitis',
          'diffuse cramps rather than focal peritonism',
        ],
      }),
      unit({
        id: 'renal_colic_discriminator',
        label: 'Renal colic discriminator',
        category: 'differential_concept',
        importance: 'high',
        rationale:
          'Flank-to-groin pain and hematuria favor renal colic rather than appendiceal peritonism.',
        acceptableManifestations: ['renal colic', 'flank-to-groin pain', 'hematuria'],
      }),
      unit({
        id: 'normal_early_wbc_trap',
        label: 'Normal early WBC trap',
        category: 'pitfall_concept',
        importance: 'high',
        rationale:
          'A normal early white blood cell count can falsely reassure before inflammation evolves.',
        acceptableManifestations: [
          'normal white blood cell count early',
          'normal early WBC does not exclude appendicitis',
          'leukocytosis may be absent early',
        ],
      }),
      unit({
        id: 'surgical_readiness',
        label: 'Surgical readiness',
        category: 'management_concept',
        importance: 'critical',
        rationale:
          'Suspected appendicitis requires early surgical planning and preparation for definitive source control.',
        acceptableManifestations: [
          'surgical consultation',
          'NPO',
          'IV fluids',
          'early surgical review',
        ],
      }),
    ],
    difficultyStrategy: {
      targetDifficulty: 'medium',
      revealCoreUnitByClue: 3,
      avoidTooEarly: ['CT abdomen confirms appendicitis'],
    },
  },
  {
    diagnosisKey: 'diabetic ketoacidosis',
    teachingUnits: [
      unit({
        id: 'ketosis_acidosis_distinguishes_dka',
        label: 'Ketosis and acidosis distinguish DKA',
        category: 'investigation_concept',
        importance: 'critical',
        rationale:
          'DKA requires ketosis with metabolic acidosis, which separates it from HHS or isolated hyperglycemia.',
        acceptableManifestations: [
          'ketosis with acidosis distinguishes DKA',
          'blood ketones with metabolic acidosis',
          'anion gap metabolic acidosis',
          'low bicarbonate with elevated beta-hydroxybutyrate',
        ],
        avoidTooEarly: ['DKA', 'diabetic ketoacidosis'],
      }),
      unit({
        id: 'potassium_before_insulin',
        label: 'Potassium before insulin',
        category: 'management_concept',
        importance: 'critical',
        rationale:
          'Insulin shifts potassium intracellularly and can precipitate hypokalemia.',
        acceptableManifestations: [
          'check potassium before insulin',
          'replace potassium before insulin if low',
          'normal serum potassium may mask depleted total body potassium',
          'potassium can fall after insulin',
        ],
      }),
      unit({
        id: 'insulin_hypokalemia_trap',
        label: 'Potassium before insulin',
        category: 'pitfall_concept',
        importance: 'critical',
        rationale:
          'Treating DKA with insulin before potassium safety can uncover or worsen hypokalemia.',
        acceptableManifestations: [
          'potassium can fall after insulin',
          'normal or low potassium before insulin',
          'insulin before potassium replacement can precipitate hypokalemia',
        ],
        appliesToCaseGeneration: false,
      }),
      unit({
        id: 'metabolic_acidosis_compensation',
        label: 'Respiratory compensation for metabolic acidosis',
        category: 'exam_mechanism',
        importance: 'critical',
        rationale:
          'Kussmaul respirations reflect respiratory compensation for metabolic acidosis.',
        acceptableManifestations: [
          'Kussmaul respirations',
          'deep labored breathing',
          'low pCO2 on ABG/VBG',
          'tachypnea as respiratory compensation',
        ],
      }),
      unit({
        id: 'fluids_before_insulin',
        label: 'Fluids before insulin',
        category: 'management_concept',
        importance: 'critical',
        rationale:
          'Volume resuscitation improves perfusion and starts correction before insulin is layered in safely.',
        acceptableManifestations: [
          'fluid resuscitation before insulin',
          'initial isotonic fluids',
          'restore perfusion before insulin',
        ],
      }),
      unit({
        id: 'hhs_discriminator',
        label: 'HHS discriminator',
        category: 'differential_concept',
        importance: 'high',
        rationale:
          'HHS has severe hyperosmolar hyperglycemia without the same ketosis and acidosis pattern.',
        acceptableManifestations: [
          'hyperosmolar hyperglycemic state',
          'HHS lacks prominent ketoacidosis',
          'hyperosmolarity without marked ketones',
        ],
      }),
    ],
    difficultyStrategy: {
      targetDifficulty: 'medium',
      revealCoreUnitByClue: 4,
      avoidTooEarly: ['diabetic ketoacidosis', 'DKA', 'ketones and acidosis together'],
    },
  },
  {
    diagnosisKey: 'pneumonia',
    teachingUnits: [
      unit({
        id: 'consolidation_syndrome',
        label: 'Consolidation syndrome',
        category: 'finding_concept',
        importance: 'critical',
        rationale:
          'Focal consolidation explains crackles, egophony, dullness, and radiographic opacity.',
        acceptableManifestations: [
          'chest X-ray consolidation',
          'focal crackles',
          'egophony',
          'dullness to percussion',
          'lobar opacity',
        ],
      }),
      unit({
        id: 'bronchitis_discriminator',
        label: 'Bronchitis discriminator',
        category: 'differential_concept',
        importance: 'critical',
        rationale:
          'Bronchitis causes cough without focal consolidation or significant hypoxia.',
        acceptableManifestations: [
          'acute bronchitis',
          'bronchitis lacks focal consolidation',
          'normal chest imaging favors bronchitis',
        ],
      }),
      unit({
        id: 'pe_hf_mimics',
        label: 'PE and heart failure mimics',
        category: 'differential_concept',
        importance: 'high',
        rationale:
          'Pulmonary embolism and heart failure can mimic dyspnea and hypoxia but have different discriminators.',
        acceptableManifestations: [
          'pulmonary embolism',
          'heart failure',
          'hypoxia out of proportion raises pulmonary embolism concern',
          'volume overload favors heart failure',
        ],
      }),
      unit({
        id: 'severity_site_of_care',
        label: 'Severity guides site of care',
        category: 'management_concept',
        importance: 'critical',
        rationale:
          'Oxygenation and severity assessment determine outpatient versus inpatient management.',
        acceptableManifestations: [
          'severity assessment',
          'oxygen support',
          'site-of-care decision',
          'CURB-65',
        ],
      }),
    ],
    difficultyStrategy: {
      targetDifficulty: 'medium',
      revealCoreUnitByClue: 3,
      avoidTooEarly: ['lobar pneumonia', 'classic consolidation on first clue'],
    },
  },
  {
    diagnosisKey: 'myocardial infarction',
    teachingUnits: [
      unit({
        id: 'ischemic_symptom_pattern',
        label: 'Ischemic symptom pattern',
        category: 'finding_concept',
        importance: 'critical',
        rationale:
          'Pressure-like chest pain with autonomic symptoms raises concern for myocardial ischemia.',
        acceptableManifestations: [
          'ischemic chest pain',
          'diaphoresis',
          'radiation to the arm or jaw',
          'crushing chest pressure',
        ],
      }),
      unit({
        id: 'ecg_reperfusion_pathway',
        label: 'ECG drives reperfusion pathway',
        category: 'investigation_concept',
        importance: 'critical',
        rationale:
          'Dynamic ischemic ECG changes, especially ST elevation, drive immediate reperfusion decisions.',
        acceptableManifestations: [
          'ECG ST elevation',
          'dynamic ECG changes',
          'serial ECG',
          'reperfusion pathway for STEMI',
        ],
        avoidTooEarly: ['STEMI', 'ST elevation MI'],
      }),
      unit({
        id: 'troponin_dynamics',
        label: 'Troponin dynamics',
        category: 'investigation_concept',
        importance: 'high',
        rationale:
          'Troponin rise and fall supports myocardial injury but may lag early symptoms.',
        acceptableManifestations: [
          'troponin rise and fall',
          'serial troponins',
          'troponin before dynamic rise',
        ],
      }),
      unit({
        id: 'dissection_pe_mimics',
        label: 'Dissection and PE mimics',
        category: 'differential_concept',
        importance: 'critical',
        rationale:
          'Aortic dissection and pulmonary embolism can mimic chest pain but change immediate management.',
        acceptableManifestations: [
          'aortic dissection',
          'pulmonary embolism',
          'dissection must be separated from MI',
        ],
      }),
    ],
    difficultyStrategy: {
      targetDifficulty: 'medium',
      revealCoreUnitByClue: 3,
      avoidTooEarly: ['ST elevation', 'troponin rise on first clue'],
    },
  },
  {
    diagnosisKey: 'ischemic stroke',
    teachingUnits: [
      unit({
        id: 'focal_neurologic_deficit',
        label: 'Focal neurologic deficit',
        category: 'finding_concept',
        importance: 'critical',
        rationale:
          'Sudden focal deficits localize vascular territory and distinguish stroke from nonspecific altered mental status.',
        acceptableManifestations: [
          'facial droop',
          'arm drift',
          'aphasia',
          'neglect',
        ],
      }),
      unit({
        id: 'last_known_well',
        label: 'Last-known-well time',
        category: 'management_concept',
        importance: 'critical',
        rationale:
          'Last-known-well determines reperfusion eligibility and urgency.',
        acceptableManifestations: [
          'last-known-well time',
          'time-window assessment',
          'last known well controls reperfusion eligibility',
        ],
      }),
      unit({
        id: 'glucose_mimic_check',
        label: 'Glucose mimic check',
        category: 'investigation_concept',
        importance: 'critical',
        rationale:
          'Hypoglycemia can mimic stroke and must be checked early.',
        acceptableManifestations: [
          'glucose check',
          'hypoglycemia',
          'fingerstick glucose identifies stroke mimic',
        ],
      }),
      unit({
        id: 'ct_excludes_hemorrhage',
        label: 'CT excludes hemorrhage before thrombolysis',
        category: 'investigation_concept',
        importance: 'critical',
        rationale:
          'Non-contrast CT may be negative for early ischemia but is needed to exclude hemorrhage before thrombolysis.',
        acceptableManifestations: [
          'non-contrast CT head',
          'negative CT does not exclude ischemia',
          'exclude hemorrhage before thrombolysis',
        ],
      }),
    ],
    difficultyStrategy: {
      targetDifficulty: 'medium',
      revealCoreUnitByClue: 3,
      avoidTooEarly: ['ischemic stroke', 'large vessel occlusion on first clue'],
    },
  },
  legacyPack({
    diagnosisKey: 'asthma',
    requiredDifferentials: ['COPD', 'vocal cord dysfunction', 'heart failure'],
    requiredPitfalls: [
      'silent chest indicates severe obstruction',
      'fatigue before respiratory failure',
      'mistaking vocal cord dysfunction for asthma',
    ],
    requiredFindings: [
      'expiratory wheeze',
      'prolonged expiratory phase',
      'accessory muscle use',
    ],
    requiredInvestigations: [
      'spirometry with bronchodilator response',
      'peak flow',
      'oxygen saturation',
    ],
    requiredExamMechanisms: [
      'wheeze reflects narrowed expiratory airways',
      'silent chest reflects critically reduced airflow',
    ],
    requiredManagementAnchors: [
      'short-acting bronchodilator',
      'systemic corticosteroids',
      'severity-based escalation',
    ],
    requiredRecallConcepts: [
      'silent chest is a severe sign',
      'reversibility distinguishes asthma from fixed obstruction',
    ],
  }),
  legacyPack({
    diagnosisKey: 'sepsis',
    requiredDifferentials: ['anaphylaxis', 'pulmonary embolism', 'hemorrhage'],
    requiredPitfalls: [
      'afebrile sepsis',
      'normal blood pressure early',
      'missing source control',
    ],
    requiredFindings: ['hypotension', 'altered mental status', 'tachypnea'],
    requiredInvestigations: ['serum lactate', 'blood cultures', 'source cultures'],
    requiredExamMechanisms: [
      'altered mental status reflects organ dysfunction',
      'poor perfusion reflects shock physiology',
    ],
    requiredManagementAnchors: [
      'early antibiotics',
      'fluid resuscitation',
      'source control',
    ],
    requiredRecallConcepts: [
      'organ dysfunction distinguishes sepsis from simple infection',
      'source control prevents ongoing shock',
    ],
  }),
  legacyPack({
    diagnosisKey: 'heart failure',
    requiredDifferentials: ['pneumonia', 'COPD exacerbation', 'pulmonary embolism'],
    requiredPitfalls: [
      'normal BNP in obesity',
      'wheeze from cardiac asthma',
      'over-diuresis with renal injury',
    ],
    requiredFindings: ['S3 gallop', 'jugular venous distension', 'orthopnea'],
    requiredInvestigations: ['BNP', 'echocardiography', 'chest X-ray pulmonary edema'],
    requiredExamMechanisms: [
      'S3 reflects volume overload',
      'JVD reflects elevated right-sided filling pressure',
    ],
    requiredManagementAnchors: [
      'volume assessment',
      'diuresis when congested',
      'identify precipitating trigger',
    ],
    requiredRecallConcepts: [
      'cardiac asthma can mimic obstructive wheeze',
      'BNP limitations change interpretation',
    ],
  }),
];

@Injectable()
export class EducationTeachingRulesService {
  getSeedDiagnosisKeys(): string[] {
    return TEACHING_RULE_PACKS.map((pack) => pack.diagnosisKey);
  }

  getRules(
    registry: EducationRuleRegistryMetadata,
  ): EducationTeachingRulePack | null {
    const searchableText = [
      registry.canonicalName,
      registry.displayLabel,
      ...(registry.aliases ?? []).map((alias) =>
        typeof alias === 'string' ? alias : alias.term,
      ),
    ]
      .filter((value): value is string => Boolean(value))
      .join(' ');
    const normalized = this.normalize(searchableText);
    const definition = TEACHING_RULE_PACKS.find((pack) =>
      this.matchesDiagnosis(normalized, pack.diagnosisKey),
    );

    return definition ? this.materializePack(definition) : null;
  }

  getManifestationOptions(
    rules: EducationTeachingRulePack | null,
  ): ManifestationOption[] {
    return (rules?.teachingUnits ?? []).flatMap((teachingUnit) =>
      teachingUnit.acceptableManifestations.map((manifestation) => ({
        teachingUnitId: teachingUnit.id,
        teachingUnitLabel: teachingUnit.label,
        manifestation,
        category: teachingUnit.category,
        importance: teachingUnit.importance,
      })),
    );
  }

  getCaseTeachingUnits(input: {
    rules: EducationTeachingRulePack | null;
    difficulty?: string | null;
    count?: number;
  }): TeachingUnit[] {
    const caseUnits = (input.rules?.teachingUnits ?? []).filter(
      (unit) => unit.appliesToCaseGeneration,
    );
    const targetCount =
      input.count ??
      (this.normalize(input.difficulty ?? '') === 'hard'
        ? 2
        : this.normalize(input.difficulty ?? '') === 'easy'
          ? 4
          : 3);
    const critical = caseUnits.filter((unit) => unit.importance === 'critical');
    const remaining = caseUnits.filter((unit) => unit.importance !== 'critical');

    return [...critical, ...remaining].slice(0, targetCount);
  }

  private materializePack(
    definition: TeachingRulePackDefinition,
  ): EducationTeachingRulePack {
    const teachingUnits =
      definition.teachingUnits ??
      this.unitsFromLegacyDefinition(definition);

    return {
      diagnosisKey: definition.diagnosisKey,
      teachingUnits,
      difficultyStrategy: {
        ...DEFAULT_DIFFICULTY_STRATEGY,
        ...(definition.difficultyStrategy ?? {}),
        avoidTooEarly: [
          ...(definition.difficultyStrategy?.avoidTooEarly ?? []),
          ...teachingUnits.flatMap((unit) => unit.avoidTooEarly ?? []),
        ],
      },
      requiredDifferentials:
        definition.requiredDifferentials ??
        this.manifestationsFor(teachingUnits, 'differential_concept'),
      requiredPitfalls:
        definition.requiredPitfalls ??
        this.manifestationsFor(teachingUnits, 'pitfall_concept'),
      requiredFindings:
        definition.requiredFindings ??
        this.manifestationsFor(teachingUnits, 'finding_concept'),
      requiredInvestigations:
        definition.requiredInvestigations ??
        this.manifestationsFor(teachingUnits, 'investigation_concept'),
      requiredExamMechanisms:
        definition.requiredExamMechanisms ??
        this.manifestationsFor(teachingUnits, 'exam_mechanism'),
      requiredManagementAnchors:
        definition.requiredManagementAnchors ??
        this.manifestationsFor(teachingUnits, 'management_concept'),
      requiredRecallConcepts:
        definition.requiredRecallConcepts ??
        this.recallConceptsFor(teachingUnits),
    };
  }

  private unitsFromLegacyDefinition(
    definition: TeachingRulePackDefinition,
  ): TeachingUnit[] {
    const groups: Array<{
      category: TeachingUnitCategory;
      importance: TeachingUnitImportance;
      values: string[];
      prefix: string;
    }> = [
      {
        category: 'differential_concept',
        importance: 'critical',
        values: definition.requiredDifferentials ?? [],
        prefix: 'differential',
      },
      {
        category: 'pitfall_concept',
        importance: 'high',
        values: definition.requiredPitfalls ?? [],
        prefix: 'pitfall',
      },
      {
        category: 'finding_concept',
        importance: 'critical',
        values: definition.requiredFindings ?? [],
        prefix: 'finding',
      },
      {
        category: 'investigation_concept',
        importance: 'critical',
        values: definition.requiredInvestigations ?? [],
        prefix: 'investigation',
      },
      {
        category: 'exam_mechanism',
        importance: 'high',
        values: definition.requiredExamMechanisms ?? [],
        prefix: 'exam',
      },
      {
        category: 'management_concept',
        importance: 'critical',
        values: definition.requiredManagementAnchors ?? [],
        prefix: 'management',
      },
      {
        category: 'recall_concept',
        importance: 'supporting',
        values: definition.requiredRecallConcepts ?? [],
        prefix: 'recall',
      },
    ];

    return groups.flatMap((group) =>
      group.values.map((value) =>
        unit({
          id: `${group.prefix}_${this.normalize(value).replace(/\s+/g, '_')}`,
          label: value,
          category: group.category,
          importance: group.importance,
          rationale: `Legacy required teaching concept for ${definition.diagnosisKey}.`,
          acceptableManifestations: [value],
        }),
      ),
    );
  }

  private manifestationsFor(
    teachingUnits: TeachingUnit[],
    category: TeachingUnitCategory,
  ): string[] {
    return teachingUnits
      .filter((unit) => unit.category === category)
      .flatMap((unit) => unit.acceptableManifestations);
  }

  private recallConceptsFor(teachingUnits: TeachingUnit[]): string[] {
    return teachingUnits.map((unit) => unit.label);
  }

  private matchesDiagnosis(normalized: string, diagnosisKey: string): boolean {
    const key = this.normalize(diagnosisKey);
    if (normalized.includes(key)) {
      return true;
    }

    if (key === 'diabetic ketoacidosis') {
      return normalized.includes('dka');
    }

    if (key === 'myocardial infarction') {
      return (
        normalized.includes('mi') ||
        normalized.includes('stemi') ||
        normalized.includes('nstemi') ||
        normalized.includes('heart attack')
      );
    }

    return false;
  }

  private normalize(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

function unit(input: Omit<TeachingUnit, 'appliesToEducation' | 'appliesToCaseGeneration'> & {
  appliesToEducation?: boolean;
  appliesToCaseGeneration?: boolean;
}): TeachingUnit {
  return {
    ...input,
    appliesToEducation: input.appliesToEducation ?? true,
    appliesToCaseGeneration: input.appliesToCaseGeneration ?? true,
  };
}

function legacyPack(
  definition: Required<
    Pick<
      TeachingRulePackDefinition,
      | 'diagnosisKey'
      | 'requiredDifferentials'
      | 'requiredPitfalls'
      | 'requiredFindings'
      | 'requiredInvestigations'
      | 'requiredExamMechanisms'
      | 'requiredManagementAnchors'
      | 'requiredRecallConcepts'
    >
  >,
): TeachingRulePackDefinition {
  return definition;
}
