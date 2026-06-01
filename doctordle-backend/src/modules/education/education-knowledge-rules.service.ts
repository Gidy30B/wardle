import { Injectable } from '@nestjs/common';

export type EducationKnowledgeRulePack = {
  diagnosisKey: string;
  expectedNamedSigns: string[];
  expectedScoringSystems: string[];
  expectedInvestigations: string[];
  expectedMimics: string[];
  expectedPitfalls: string[];
  expectedManagementAnchors: string[];
  forbiddenGenericPatterns: string[];
  atomicityGuidance: string[];
};

export type EducationRuleRegistryMetadata = {
  id?: string | null;
  canonicalName?: string | null;
  displayLabel?: string | null;
  aliases?: Array<{ term?: string | null } | string> | null;
  specialty?: string | null;
  category?: string | null;
  bodySystem?: string | null;
  clinicalSetting?: string | null;
  difficultyBand?: string | null;
};

const SHARED_FORBIDDEN_GENERIC_PATTERNS = [
  'may present with',
  'can present with',
  'important for diagnosis',
  'important for management',
  'clinical correlation is advised',
  'management depends on severity',
  'prompt treatment is necessary',
  'can lead to complications',
];

const SHARED_ATOMICITY_GUIDANCE = [
  'Use one clinical finding, sign, investigation, mimic, trap, or management anchor per item.',
  'Pair each finding with why it changes probability, what it distinguishes, or what action it anchors.',
  'Avoid broad syndrome paragraphs and bundled lists inside a single bullet.',
  'Prefer concrete named bedside signs, lab thresholds, imaging patterns, and discriminator phrases.',
];

const RULE_PACKS: EducationKnowledgeRulePack[] = [
  {
    diagnosisKey: 'appendicitis',
    expectedNamedSigns: [
      'McBurney point tenderness',
      'Rovsing sign',
      'psoas sign',
      'obturator sign',
      'rebound tenderness',
      'guarding',
    ],
    expectedScoringSystems: ['Alvarado score', 'MANTRELS', 'AIR score'],
    expectedInvestigations: [
      'CBC leukocytosis',
      'CRP',
      'ultrasound',
      'CT abdomen',
      'pregnancy test',
      'urinalysis',
    ],
    expectedMimics: [
      'gastroenteritis',
      'renal colic',
      'ectopic pregnancy',
      'ovarian torsion',
      'mesenteric adenitis',
    ],
    expectedPitfalls: [
      'normal white blood cell count early',
      'transient pain improvement after perforation',
      'retrocecal appendix',
      'pelvic appendix',
      'pregnancy or older adult atypical presentation',
    ],
    expectedManagementAnchors: [
      'surgical consultation',
      'NPO',
      'IV fluids',
      'analgesia',
      'antibiotics when complicated or operative pathway is likely',
      'risk stratification before imaging',
    ],
    forbiddenGenericPatterns: SHARED_FORBIDDEN_GENERIC_PATTERNS,
    atomicityGuidance: SHARED_ATOMICITY_GUIDANCE,
  },
  {
    diagnosisKey: 'diabetic ketoacidosis',
    expectedNamedSigns: [
      'Kussmaul respirations',
      'fruity breath',
      'dehydration',
      'altered mental status',
    ],
    expectedScoringSystems: ['anion gap', 'corrected sodium', 'serum osmolality'],
    expectedInvestigations: [
      'metabolic acidosis',
      'blood ketones',
      'beta-hydroxybutyrate',
      'anion gap',
      'potassium',
      'glucose',
      'venous blood gas',
    ],
    expectedMimics: [
      'hyperosmolar hyperglycemic state',
      'starvation ketosis',
      'alcoholic ketoacidosis',
      'sepsis',
      'gastroenteritis',
    ],
    expectedPitfalls: [
      'potassium can fall after insulin',
      'normal or low potassium before insulin',
      'cerebral edema risk',
      'missing infection trigger',
      'bicarbonate overuse',
    ],
    expectedManagementAnchors: [
      'fluid resuscitation',
      'potassium check before insulin',
      'insulin after potassium safety',
      'close electrolyte monitoring',
      'identify precipitating infection or missed insulin',
    ],
    forbiddenGenericPatterns: SHARED_FORBIDDEN_GENERIC_PATTERNS,
    atomicityGuidance: SHARED_ATOMICITY_GUIDANCE,
  },
  {
    diagnosisKey: 'pneumonia',
    expectedNamedSigns: [
      'bronchial breath sounds',
      'crackles',
      'egophony',
      'dullness to percussion',
      'increased tactile fremitus',
      'hypoxia',
    ],
    expectedScoringSystems: ['CURB-65', 'PSI', 'PORT score'],
    expectedInvestigations: [
      'chest X-ray consolidation',
      'lobar consolidation',
      'oxygen saturation',
      'sputum culture',
      'blood cultures',
      'procalcitonin',
    ],
    expectedMimics: [
      'acute bronchitis',
      'pulmonary embolism',
      'heart failure',
      'COPD exacerbation',
      'viral upper respiratory infection',
    ],
    expectedPitfalls: [
      'normal early chest X-ray',
      'atypical pneumonia with sparse auscultation',
      'anchoring on bronchitis',
      'missing pulmonary embolism',
      'heart failure mimicking pneumonia',
    ],
    expectedManagementAnchors: [
      'severity assessment',
      'oxygen support',
      'site-of-care decision',
      'timely antibiotics when bacterial pneumonia likely',
      'culture before antibiotics when severe without delaying care',
    ],
    forbiddenGenericPatterns: SHARED_FORBIDDEN_GENERIC_PATTERNS,
    atomicityGuidance: SHARED_ATOMICITY_GUIDANCE,
  },
  {
    diagnosisKey: 'myocardial infarction',
    expectedNamedSigns: ['diaphoresis', 'S4', 'hypotension', 'pulmonary edema'],
    expectedScoringSystems: ['TIMI score', 'GRACE score', 'HEART score'],
    expectedInvestigations: [
      'ECG ST elevation',
      'ST depression',
      'troponin rise and fall',
      'serial ECG',
      'posterior ECG leads',
    ],
    expectedMimics: [
      'unstable angina',
      'pericarditis',
      'aortic dissection',
      'pulmonary embolism',
      'GERD',
    ],
    expectedPitfalls: [
      'normal initial ECG',
      'atypical symptoms in diabetes or older adults',
      'posterior MI missed on standard ECG',
      'troponin before dynamic rise',
      'mistaking dissection for MI',
    ],
    expectedManagementAnchors: [
      'immediate ECG',
      'serial troponins',
      'reperfusion pathway for STEMI',
      'antiplatelet therapy when appropriate',
      'avoid delay when ECG is diagnostic',
    ],
    forbiddenGenericPatterns: SHARED_FORBIDDEN_GENERIC_PATTERNS,
    atomicityGuidance: SHARED_ATOMICITY_GUIDANCE,
  },
  {
    diagnosisKey: 'ischemic stroke',
    expectedNamedSigns: [
      'FAST',
      'facial droop',
      'arm drift',
      'aphasia',
      'visual field deficit',
      'neglect',
    ],
    expectedScoringSystems: ['NIHSS', 'ASPECTS', 'FAST'],
    expectedInvestigations: [
      'non-contrast CT head',
      'CT angiography',
      'glucose check',
      'last known well',
      'MRI diffusion restriction',
    ],
    expectedMimics: [
      'hypoglycemia',
      'seizure with Todd paresis',
      'migraine',
      'intracranial hemorrhage',
      'Bell palsy',
    ],
    expectedPitfalls: [
      'missing last-known-well time',
      'not checking glucose',
      'posterior circulation subtle symptoms',
      'assuming negative CT excludes ischemia',
      'seizure mimic',
    ],
    expectedManagementAnchors: [
      'stroke alert',
      'time-window assessment',
      'exclude hemorrhage before thrombolysis',
      'large vessel occlusion evaluation',
      'glucose correction',
    ],
    forbiddenGenericPatterns: SHARED_FORBIDDEN_GENERIC_PATTERNS,
    atomicityGuidance: SHARED_ATOMICITY_GUIDANCE,
  },
  {
    diagnosisKey: 'asthma',
    expectedNamedSigns: [
      'expiratory wheeze',
      'prolonged expiratory phase',
      'accessory muscle use',
      'silent chest',
      'pulsus paradoxus',
    ],
    expectedScoringSystems: ['peak expiratory flow', 'FEV1 reversibility'],
    expectedInvestigations: [
      'spirometry with bronchodilator response',
      'peak flow',
      'oxygen saturation',
      'arterial blood gas when severe',
      'chest X-ray when alternative diagnosis suspected',
    ],
    expectedMimics: [
      'COPD',
      'vocal cord dysfunction',
      'heart failure',
      'anaphylaxis',
      'foreign body aspiration',
    ],
    expectedPitfalls: [
      'silent chest indicates severe obstruction',
      'normal oxygen saturation can be falsely reassuring',
      'fatigue before respiratory failure',
      'mistaking vocal cord dysfunction for asthma',
    ],
    expectedManagementAnchors: [
      'short-acting bronchodilator',
      'systemic corticosteroids for exacerbation',
      'oxygen for hypoxemia',
      'severity-based escalation',
      'controller therapy review',
    ],
    forbiddenGenericPatterns: SHARED_FORBIDDEN_GENERIC_PATTERNS,
    atomicityGuidance: SHARED_ATOMICITY_GUIDANCE,
  },
  {
    diagnosisKey: 'sepsis',
    expectedNamedSigns: [
      'hypotension',
      'altered mental status',
      'tachypnea',
      'fever',
      'hypothermia',
      'poor perfusion',
    ],
    expectedScoringSystems: ['SOFA', 'qSOFA', 'SIRS', 'lactate'],
    expectedInvestigations: [
      'serum lactate',
      'blood cultures',
      'source cultures',
      'CBC',
      'creatinine',
      'bilirubin',
    ],
    expectedMimics: [
      'anaphylaxis',
      'pulmonary embolism',
      'hemorrhage',
      'adrenal crisis',
      'DKA',
    ],
    expectedPitfalls: [
      'afebrile sepsis',
      'normal blood pressure early',
      'delayed antibiotics after cultures',
      'missing source control',
      'anchoring on SIRS without organ dysfunction',
    ],
    expectedManagementAnchors: [
      'early antibiotics',
      'lactate-guided risk assessment',
      'fluid resuscitation',
      'vasopressors for persistent shock',
      'source control',
    ],
    forbiddenGenericPatterns: SHARED_FORBIDDEN_GENERIC_PATTERNS,
    atomicityGuidance: SHARED_ATOMICITY_GUIDANCE,
  },
  {
    diagnosisKey: 'heart failure',
    expectedNamedSigns: [
      'S3 gallop',
      'jugular venous distension',
      'bibasal crackles',
      'peripheral edema',
      'orthopnea',
      'hepatojugular reflux',
    ],
    expectedScoringSystems: ['NYHA class', 'BNP', 'NT-proBNP'],
    expectedInvestigations: [
      'BNP',
      'NT-proBNP',
      'chest X-ray pulmonary edema',
      'echocardiography',
      'ECG',
      'renal function',
    ],
    expectedMimics: [
      'pneumonia',
      'COPD exacerbation',
      'pulmonary embolism',
      'renal failure',
      'cirrhosis',
    ],
    expectedPitfalls: [
      'normal BNP in obesity',
      'wheeze from cardiac asthma',
      'mistaking edema for venous disease only',
      'over-diuresis with renal injury',
      'missing acute coronary trigger',
    ],
    expectedManagementAnchors: [
      'volume assessment',
      'diuresis when congested',
      'oxygen or ventilatory support if hypoxemic',
      'identify precipitating trigger',
      'guideline-directed chronic therapy after stabilization',
    ],
    forbiddenGenericPatterns: SHARED_FORBIDDEN_GENERIC_PATTERNS,
    atomicityGuidance: SHARED_ATOMICITY_GUIDANCE,
  },
];

@Injectable()
export class EducationKnowledgeRulesService {
  getGuidance(
    registry: EducationRuleRegistryMetadata,
  ): EducationKnowledgeRulePack | null {
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

    return (
      RULE_PACKS.find((pack) =>
        this.matchesDiagnosis(normalized, pack.diagnosisKey),
      ) ?? null
    );
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
