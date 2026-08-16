import 'dotenv/config';
import {
  PrismaClient,
  CaseEditorialStatus,
  CaseSource,
  DiagnosisAgeGroup,
  DiagnosisAliasKind,
  DiagnosisClinicalSetting,
  DiagnosisDifficultyBand,
  DiagnosisEducationSource,
  DiagnosisEducationStatus,
  DiagnosisMappingMethod,
  DiagnosisMappingStatus,
  DiagnosisRarityBand,
  DiagnosisRegistryStatus,
  DiagnosisUrgencyLevel,
  PublishTrack,
  ValidationOutcome,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

function resolvePgConnectionString(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (!value.startsWith('prisma+postgres://')) return value;

  const parsed = new URL(value);
  const apiKey = parsed.searchParams.get('api_key');
  if (!apiKey) {
    throw new Error('DATABASE_URL uses prisma+postgres:// but is missing api_key.');
  }

  const payload = JSON.parse(
    Buffer.from(apiKey, 'base64url').toString('utf8'),
  ) as { databaseUrl?: unknown };

  if (typeof payload.databaseUrl !== 'string' || !payload.databaseUrl) {
    throw new Error(
      'DATABASE_URL uses prisma+postgres:// but api_key does not contain a databaseUrl.',
    );
  }

  return payload.databaseUrl;
}

const databaseUrl = resolvePgConnectionString(process.env.DATABASE_URL);
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run the Neuroleptic Malignant Syndrome seed.');
}

const pool = new Pool({ connectionString: databaseUrl, max: 1 });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function normalizeClinicalText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

async function getNextCasePublicNumber(): Promise<number> {
  const latest = await prisma.case.findFirst({
    where: { publicNumber: { not: null } },
    orderBy: { publicNumber: 'desc' },
    select: { publicNumber: true },
  });
  return (latest?.publicNumber ?? 0) + 1;
}

async function findAvailableInventoryPlaceholderDate(params: {
  preferredDate: Date;
  reusableCaseId?: string;
  displayLabel: string;
}): Promise<Date> {
  for (let offset = 0; offset < 365; offset += 1) {
    const candidateDate = addUtcDays(params.preferredDate, offset);
    const owner = await prisma.case.findUnique({
      where: { date: candidateDate },
      select: {
        id: true,
        dailyCases: { select: { id: true }, take: 1 },
      },
    });

    if (!owner) return candidateDate;
    if (params.reusableCaseId && owner.id === params.reusableCaseId) {
      return candidateDate;
    }
  }

  throw new Error(`No free inventory placeholder date for ${params.displayLabel}.`);
}

const now = new Date();
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 11, 10, 12, 0, 0));
const seedVersion = 'flagship-neuroleptic-malignant-syndrome-v1';

const canonicalName = 'neuroleptic malignant syndrome';
const displayLabel = 'Neuroleptic Malignant Syndrome';
const caseTitle = 'Hyperthermia, Rigidity and Autonomic Instability After Antipsychotic Escalation';

const aliasTerms = [
  'Neuroleptic Malignant Syndrome',
  'neuroleptic malignant syndrome',
  'NMS',
  'antipsychotic-induced neuroleptic malignant syndrome',
];

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 31-year-old man with schizophrenia was admitted four days ago for severe psychotic agitation. His haloperidol dose was increased substantially three days ago; no depot antipsychotic was given.',
  },
  {
    order: 1,
    type: 'symptom',
    value:
      'Over the next 48 hours he becomes confused and less interactive, with rapidly worsening generalized muscle stiffness, profuse sweating, and difficulty swallowing. He has no diarrhea, vomiting, or recent recreational drug exposure.',
  },
  {
    order: 2,
    type: 'vital',
    value:
      'Temperature is 40.0 C, pulse 138/min, respiratory rate 30/min, oxygen saturation 96% on room air, and repeated blood pressure measurements fluctuate from 176/104 to 108/64 mmHg.',
  },
  {
    order: 3,
    type: 'exam',
    value:
      'He is obtunded but arousable and has severe generalized uniform rigidity affecting the neck, trunk, and limbs. Deep tendon reflexes are reduced; there is no inducible clonus, ocular clonus, or marked hyperreflexia. There is no waxy flexibility, echophenomena, or purposeful posturing.',
  },
  {
    order: 4,
    type: 'lab',
    value:
      'Creatine kinase is 14,600 U/L, WBC 18.4 x10^9/L with neutrophilia, creatinine 168 micromol/L, and potassium 5.3 mmol/L. Urinalysis is strongly positive for heme with only 0-2 red cells per high-power field, supporting myoglobinuria.',
  },
  {
    order: 5,
    type: 'history',
    value:
      'Medication reconciliation confirms only the recent haloperidol escalation as a new neuropsychiatric exposure, with no serotonergic drug addition, no recent general anaesthesia, no abrupt withdrawal of levodopa or other dopaminergic therapy, and no environmental heat exposure. Examination and initial infection evaluation reveal no focal infectious source.',
  },
] as const;

const differentials = [
  'Serotonin Syndrome',
  'Malignant Catatonia',
  'Heat Stroke',
  'Malignant Hyperthermia',
  'Encephalitis',
  'Anticholinergic Toxicity',
];

const explanation = {
  diagnosis: displayLabel,
  summary:
    'Recent haloperidol escalation followed by subacute altered mental status, severe generalized rigidity, hyperthermia, autonomic instability, marked creatine kinase elevation, and myoglobinuria strongly supports Neuroleptic Malignant Syndrome.',
  reasoning: [
    'A recent substantial increase in a potent dopamine-blocking antipsychotic creates the key temporal exposure for this medication-associated emergency.',
    'Progressive confusion, generalized stiffness, diaphoresis, and dysphagia over roughly two days fit the typical subacute evolution rather than an instantaneous toxic or anaesthetic reaction.',
    'Marked hyperthermia, tachycardia, tachypnoea, and labile blood pressure establish severe autonomic dysfunction.',
    'Diffuse uniform rigidity with reduced reflexes and absence of clonus or hyperreflexia shifts the neuromuscular pattern away from serotonin toxicity; absence of waxy flexibility and echophenomena weakens malignant catatonia.',
    'Marked CK elevation with creatinine rise and myoglobinuria demonstrates rhabdomyolysis and systemic severity, a common complication of sustained rigidity.',
    'Medication reconciliation reinforces dopamine-blockade exposure while excluding serotonergic escalation, anaesthetic exposure, dopaminergic withdrawal, and environmental heat exposure as major competing triggers.',
  ],
  keyFindings: [
    'Recent haloperidol dose escalation',
    'Subacute altered mental status',
    'Severe generalized rigidity',
    'Hyperthermia',
    'Profuse diaphoresis',
    'Tachycardia and tachypnoea',
    'Labile blood pressure',
    'Reduced reflexes without clonus',
    'Marked creatine kinase elevation',
    'Acute kidney injury',
    'Myoglobinuria',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Serotonin Syndrome',
      whyPlausibleEarly:
        'Both syndromes can produce hyperthermia, altered mental status, autonomic instability, and elevated creatine kinase.',
      ruledOutByClues: [
        {
          clueOrder: 3,
          evidence: 'there is no inducible clonus, ocular clonus, or marked hyperreflexia',
          reason:
            'Serotonin toxicity more often produces neuromuscular hyperreactivity with clonus and hyperreflexia, whereas this examination shows a hyporeflexic rigid pattern.',
        },
        {
          clueOrder: 5,
          evidence: 'no serotonergic drug addition',
          reason:
            'The medication history does not identify the usual serotonergic trigger for serotonin syndrome.',
        },
      ],
      finalReasonLessLikely:
        'The combination of dopamine-blocker escalation, severe uniform rigidity, reduced reflexes, absent clonus, and no serotonergic change favors Neuroleptic Malignant Syndrome.',
    },
    {
      diagnosis: 'Malignant Catatonia',
      whyPlausibleEarly:
        'Malignant catatonia can produce fever, rigidity, autonomic instability, altered mental status, and elevated CK in a patient with severe psychiatric illness.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence: 'haloperidol dose was increased substantially three days ago',
          reason:
            'The syndrome follows a clear high-risk medication escalation, making a drug-induced syndrome more likely.',
        },
        {
          clueOrder: 3,
          evidence: 'There is no waxy flexibility, echophenomena, or purposeful posturing',
          reason:
            'Classic catatonic motor and behavioral signs are not demonstrated on examination.',
        },
      ],
      finalReasonLessLikely:
        'The temporal medication trigger and uniform rigid syndrome without characteristic catatonic signs favor Neuroleptic Malignant Syndrome, while malignant catatonia should still be reconsidered if the course is atypical or refractory.',
    },
    {
      diagnosis: 'Heat Stroke',
      whyPlausibleEarly:
        'Heat stroke can cause extreme hyperthermia, altered mental status, tachycardia, hypotension, and rhabdomyolysis.',
      ruledOutByClues: [
        {
          clueOrder: 5,
          evidence: 'no environmental heat exposure',
          reason:
            'There is no exertional or environmental heat trigger to explain the hyperthermia.',
        },
        {
          clueOrder: 3,
          evidence: 'severe generalized uniform rigidity',
          reason:
            'Profound sustained rigidity is much more characteristic of Neuroleptic Malignant Syndrome than classic heat stroke.',
        },
      ],
      finalReasonLessLikely:
        'The medication trigger and severe rigid syndrome are more coherent with Neuroleptic Malignant Syndrome than heat stroke.',
    },
    {
      diagnosis: 'Malignant Hyperthermia',
      whyPlausibleEarly:
        'Malignant hyperthermia can produce hyperthermia, rigidity, tachycardia, hyperkalaemia, acidosis, and rhabdomyolysis.',
      ruledOutByClues: [
        {
          clueOrder: 5,
          evidence: 'no recent general anaesthesia',
          reason:
            'Malignant hyperthermia classically follows exposure to triggering anaesthetic agents rather than antipsychotic dose escalation.',
        },
        {
          clueOrder: 0,
          evidence: 'haloperidol dose was increased substantially three days ago',
          reason:
            'A strong alternative trigger is present for Neuroleptic Malignant Syndrome.',
        },
      ],
      finalReasonLessLikely:
        'The absence of anaesthetic exposure and the subacute course after antipsychotic escalation argue strongly against malignant hyperthermia.',
    },
    {
      diagnosis: 'Encephalitis',
      whyPlausibleEarly:
        'Encephalitis can present with fever and altered mental status and must not be missed in an acutely unwell patient.',
      ruledOutByClues: [
        {
          clueOrder: 3,
          evidence: 'severe generalized uniform rigidity',
          reason:
            'The dominant diffuse rigidity syndrome is more typical of a medication-induced hypermetabolic syndrome than uncomplicated encephalitis.',
        },
        {
          clueOrder: 5,
          evidence: 'initial infection evaluation reveal no focal infectious source',
          reason:
            'The initial assessment does not identify an infectious focus, while a compelling medication trigger is present.',
        },
      ],
      finalReasonLessLikely:
        'The neuromuscular pattern, medication timing, and rhabdomyolysis profile favor Neuroleptic Malignant Syndrome, although CNS infection still requires directed exclusion when clinical uncertainty remains.',
    },
    {
      diagnosis: 'Anticholinergic Toxicity',
      whyPlausibleEarly:
        'Anticholinergic toxicity can cause hyperthermia, delirium, tachycardia, and autonomic disturbance.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'profuse sweating',
          reason:
            'Anticholinergic toxicity classically causes dry skin and impaired sweating rather than marked diaphoresis.',
        },
        {
          clueOrder: 3,
          evidence: 'severe generalized uniform rigidity',
          reason:
            'Profound generalized rigidity is not the characteristic neuromuscular pattern of anticholinergic toxicity.',
        },
      ],
      finalReasonLessLikely:
        'Diaphoresis, severe rigidity, rhabdomyolysis, and a recent antipsychotic escalation fit Neuroleptic Malignant Syndrome better than anticholinergic toxicity.',
    },
  ],
  clueBreakdown: clues.map((clue) => ({
    clueOrder: clue.order,
    clueType: clue.type,
    clue: clue.value,
    explanation: [
      'Establishes the temporal medication exposure and baseline context.',
      'Adds the characteristic subacute neurobehavioral, muscular, and autonomic symptom evolution.',
      'Shows severe hyperthermia and autonomic instability.',
      'Defines the high-yield rigid, hyporeflexic neuromuscular phenotype and key bedside discriminators.',
      'Demonstrates rhabdomyolysis and evolving renal injury as objective severity markers.',
      'Confirms the medication timeline and weakens major competing trigger-based diagnoses.',
    ][clue.order],
    diagnosticContribution: [
      'Introduces the precipitating exposure.',
      'Builds the syndrome before laboratory confirmation.',
      'Establishes physiological severity.',
      'Separates NMS from serotonin syndrome and malignant catatonia.',
      'Adds objective evidence of muscle injury and complications.',
      'Completes the trigger-based differential synthesis.',
    ][clue.order],
  })),
  clinicalPearl:
    'In a febrile patient with altered mental status and rigidity, medication timing and the neuromuscular examination are central: dopamine blockade plus diffuse rigidity and reduced reflexes points toward Neuroleptic Malignant Syndrome, while clonus and hyperreflexia shift concern toward serotonin toxicity.',
  managementPearl:
    'Treat Neuroleptic Malignant Syndrome as a medical emergency: stop the precipitating dopamine-blocking agent, provide intensive supportive care and active cooling, monitor for rhabdomyolysis and organ dysfunction, and involve critical care and psychiatry early.',
  generationQuality: {
    contentTier: 'FLAGSHIP',
    seedVersion,
    humanReviewed: true,
    discriminatorStrength: 'HIGH',
    expectedTeachingPoints: [
      'Recognize recent dopamine-blocking drug initiation or dose escalation as the key exposure',
      'Identify the core syndrome of hyperthermia, rigidity, altered mental status, and autonomic instability',
      'Use clonus and hyperreflexia to distinguish serotonin syndrome from the rigid hyporeflexic NMS pattern',
      'Interpret marked CK elevation and myoglobinuria as evidence of rhabdomyolysis and severity',
      'Differentiate NMS from malignant catatonia, heat stroke, malignant hyperthermia, encephalitis, and anticholinergic toxicity',
      'Prioritize immediate withdrawal of the precipitating agent and intensive supportive care',
    ],
    competencyDomains: [
      'Psychiatry',
      'Emergency Medicine',
      'Critical Care',
      'Clinical Pharmacology',
      'Clinical Reasoning',
    ],
  },
};

const educationForFrontend = {
  title: displayLabel,
  summary: {
    definition:
      'Neuroleptic Malignant Syndrome is a rare, life-threatening medication-associated hypermetabolic syndrome most often triggered by dopamine-receptor blockade or, less commonly, abrupt withdrawal of dopaminergic therapy.',
    highYieldTakeaway:
      'Think NMS when a patient develops subacute fever, severe generalized rigidity, altered mental status, and autonomic instability after starting or increasing a dopamine-blocking medication, especially when CK is markedly elevated.',
  },
  recognitionPattern: [
    {
      pattern: 'Recent dopamine-blocking exposure plus subacute deterioration',
      whyItMatters:
        'Initiation or dose escalation of an antipsychotic is the most important historical trigger and usually precedes symptom development by days rather than minutes.',
      progression:
        'Dopamine blockade -> rigidity and altered mental state -> hyperthermia and autonomic instability -> rhabdomyolysis and organ dysfunction.',
      discriminator:
        'The medication timeline strongly separates NMS from heat stroke, malignant hyperthermia, and many infectious mimics.',
      commonTrap:
        'Do not dismiss the syndrome because the patient has previously tolerated the same antipsychotic; dose escalation and physiologic stress can change risk.',
    },
    {
      pattern: 'Rigid hyporeflexic neuromuscular phenotype',
      whyItMatters:
        'Diffuse sustained rigidity is a core bedside feature and contributes to hyperthermia and muscle breakdown.',
      progression:
        'Increasing stiffness -> generalized sustained rigidity -> heat generation and CK rise.',
      discriminator:
        'Marked clonus and hyperreflexia favor serotonin toxicity; uniform rigidity with normal or reduced reflexes favors NMS.',
      commonTrap:
        'Severe serotonin toxicity can occasionally obscure reflex findings, so medication history and the full syndrome still matter.',
    },
    {
      pattern: 'Autonomic instability with muscle injury',
      whyItMatters:
        'Tachycardia, labile blood pressure, diaphoresis, and hyperthermia indicate systemic involvement, while CK elevation identifies muscle injury.',
      progression:
        'Autonomic dysregulation and rigidity -> dehydration and rhabdomyolysis -> electrolyte disturbance, acute kidney injury, arrhythmia, or respiratory failure.',
      discriminator:
        'Marked CK elevation supports NMS severity but is not specific enough to establish the diagnosis without the clinical context.',
      commonTrap:
        'Do not use CK as a stand-alone diagnostic test; interpret it with the medication exposure and examination.',
    },
  ],
  keySymptoms: [
    {
      symptom: 'Altered mental status',
      significance:
        'Confusion, agitation, mutism, or reduced responsiveness commonly develops as the syndrome evolves.',
      whyItMatters:
        'Mental-state change is one of the four major clinical domains of NMS.',
      discriminator:
        'A subacute change after antipsychotic escalation supports NMS over a primary psychiatric explanation alone.',
    },
    {
      symptom: 'Generalized muscle stiffness',
      significance:
        'Progressive stiffness reflects sustained muscle rigidity and may precede profound CK elevation.',
      whyItMatters:
        'Rigidity is a core feature and contributes directly to heat generation and rhabdomyolysis.',
      discriminator:
        'Uniform rigidity is more typical of NMS than the clonus-dominant pattern of serotonin syndrome.',
    },
    {
      symptom: 'Profuse diaphoresis and dysphagia',
      significance:
        'Autonomic activation and impaired swallowing are recognized accompanying features of severe NMS.',
      whyItMatters:
        'They reinforce systemic involvement and increase aspiration and dehydration risk.',
      discriminator:
        'Marked diaphoresis argues against a classic dry anticholinergic toxidrome.',
    },
  ],
  keySigns: [
    {
      finding: 'Severe generalized uniform rigidity',
      mechanism:
        'Abrupt reduction in central dopaminergic activity disrupts motor control, producing sustained rigidity that also increases metabolic heat production and muscle breakdown.',
      significance:
        'One of the most characteristic physical findings in classic NMS.',
      diagnosticImpact:
        'Strongly raises NMS probability when paired with fever and recent dopamine blockade.',
      discriminator:
        'Uniform rigidity contrasts with the clonus and hyperreflexia typical of serotonin toxicity.',
      trapAvoided:
        'Do not attribute severe rigidity to agitation or restraint without considering medication-associated hypermetabolic syndromes.',
    },
    {
      finding: 'Hyperthermia',
      mechanism:
        'Sustained muscle contraction and central thermoregulatory dysfunction produce excessive heat generation and impaired heat control.',
      significance:
        'High temperature marks severe systemic involvement and increases risk of organ injury.',
      diagnosticImpact:
        'Fever or hyperthermia completes the classic syndrome when combined with rigidity, mental-state change, and autonomic instability.',
      discriminator:
        'The trigger and neuromuscular pattern distinguish NMS from infection, heat stroke, and malignant hyperthermia.',
      trapAvoided:
        'Do not assume every fever in a psychiatric inpatient is infection before reviewing medications and examining tone and reflexes.',
    },
    {
      finding: 'Labile blood pressure with tachycardia',
      mechanism:
        'Sympathetic dysregulation causes unstable vascular tone and persistent autonomic activation.',
      significance:
        'Signals autonomic instability and potential cardiovascular deterioration.',
      diagnosticImpact:
        'Supports a systemic dysautonomic syndrome rather than isolated medication sedation or uncomplicated psychosis.',
      discriminator:
        'Autonomic instability occurs in several mimics, so it must be interpreted with the rigidity pattern and drug exposure.',
      trapAvoided:
        'Do not treat a single blood-pressure reading as reassuring when repeated values are fluctuating markedly.',
    },
    {
      finding: 'Reduced reflexes without clonus',
      mechanism:
        'The dominant motor abnormality in NMS is sustained rigidity rather than serotonergic neuromuscular hyperexcitability.',
      significance:
        'A careful reflex and clonus examination is one of the highest-yield bedside discriminators from serotonin syndrome.',
      diagnosticImpact:
        'Absence of clonus and marked hyperreflexia shifts probability toward NMS in the appropriate medication context.',
      discriminator:
        'Clonus and hyperreflexia favor serotonin toxicity; uniform rigidity with normal or reduced reflexes favors NMS.',
      trapAvoided:
        'Do not diagnose serotonin syndrome from fever and autonomic instability alone.',
    },
  ],
  examPearls: [
    {
      type: 'DISCRIMINATOR',
      title: 'Rigidity versus clonus',
      content:
        'Examine tone, deep tendon reflexes, and inducible or ocular clonus in every hyperthermic patient with psychotropic exposure.',
      whyItMatters:
        'The neuromuscular examination often separates NMS from serotonin toxicity more effectively than nonspecific laboratory abnormalities.',
      discriminator:
        'NMS favors diffuse sustained rigidity with normal or reduced reflexes; serotonin toxicity favors hyperreflexia and clonus.',
      managementImplication:
        'The distinction changes which offending medications must be stopped and which syndrome-specific treatments may be considered.',
      trapAvoided:
        'Do not use elevated CK alone to distinguish the two syndromes because severe serotonin toxicity can also raise CK.',
    },
    {
      type: 'MECHANISM',
      title: 'Rigidity drives complications',
      content:
        'Sustained muscle contraction can generate heat and cause muscle-cell injury, explaining hyperthermia, CK elevation, hyperkalaemia, and myoglobinuria.',
      whyItMatters:
        'It connects the bedside motor findings to the laboratory severity markers and organ complications.',
      discriminator:
        'Profound muscle injury is especially concerning when it follows a compatible dopamine-blocking exposure.',
      escalationImplication:
        'Marked CK elevation, electrolyte disturbance, renal injury, or respiratory compromise warrants intensive monitoring and escalation.',
      trapAvoided:
        'Do not regard CK elevation as an incidental laboratory abnormality in a rigid hyperthermic patient.',
    },
    {
      type: 'DISCRIMINATOR',
      title: 'NMS versus malignant catatonia',
      content:
        'Both syndromes can cause fever, rigidity, autonomic instability, and altered mental status, so the preceding behavioral syndrome and medication timeline matter.',
      whyItMatters:
        'Malignant catatonia can require a different psychiatric treatment pathway and may respond rapidly to benzodiazepines or electroconvulsive therapy.',
      discriminator:
        'A recent dopamine-blocker escalation with uniform rigidity favors NMS; a prominent catatonic behavioral prodrome with waxy flexibility, negativism, posturing, or echophenomena favors malignant catatonia.',
      managementImplication:
        'Persistent diagnostic uncertainty should prompt early psychiatry and critical-care collaboration rather than anchoring on one label.',
      trapAvoided:
        'Do not assume all fever and rigidity after antipsychotic exposure is NMS when catatonic features clearly preceded treatment.',
    },
  ],
  scoringSystems: [],
  investigations: [
    {
      test: 'Serum creatine kinase',
      expectedFinding:
        'Often markedly elevated when sustained rigidity causes rhabdomyolysis.',
      interpretation:
        'A high CK supports muscle injury and helps grade severity but is neither necessary nor specific enough to diagnose NMS by itself.',
      whyItMatters:
        'Serial CK helps track muscle injury alongside renal function and electrolytes.',
      managementImplication:
        'A marked rise should trigger close monitoring for hyperkalaemia, acute kidney injury, arrhythmia, and ongoing rhabdomyolysis.',
      commonTrap:
        'Do not exclude NMS solely because CK is only modestly elevated early in the course.',
    },
    {
      test: 'Renal function, electrolytes and urinalysis',
      expectedFinding:
        'Creatinine may rise, potassium may increase, and urine may be heme-positive with few red cells when myoglobin is present.',
      interpretation:
        'These findings identify rhabdomyolysis-related complications rather than the cause of the syndrome.',
      whyItMatters:
        'Renal injury and electrolyte disturbance are major preventable complications of severe NMS.',
      managementImplication:
        'Abnormalities require frequent reassessment and supportive correction in a monitored setting.',
      commonTrap:
        'Do not interpret heme-positive urine with few red cells as hematuria without considering myoglobinuria.',
    },
    {
      test: 'Full blood count and liver enzymes',
      expectedFinding:
        'Neutrophilic leukocytosis and mild transaminase elevation are common but nonspecific.',
      interpretation:
        'They support systemic stress but cannot reliably separate NMS from infection or other hyperthermic syndromes.',
      whyItMatters:
        'They contribute to severity assessment and help identify alternative diagnoses or organ injury.',
      managementImplication:
        'Trend abnormalities while simultaneously assessing for infectious and other competing causes.',
      commonTrap:
        'Do not diagnose sepsis from leukocytosis alone in a patient with a compelling medication-triggered rigid syndrome.',
    },
    {
      test: 'Targeted infection and neurologic evaluation',
      expectedFinding:
        'No specific NMS abnormality is expected; testing is selected to exclude meningitis, encephalitis, sepsis, structural brain disease, or other mimics when clinically indicated.',
      interpretation:
        'NMS remains a clinical diagnosis, so additional investigations are driven by uncertainty rather than a single confirmatory test.',
      whyItMatters:
        'Fever and altered mental status require active consideration of CNS infection and other emergencies.',
      managementImplication:
        'Do not delay urgent supportive care while pursuing exclusionary testing when NMS is strongly suspected.',
      commonTrap:
        'Avoid indiscriminate testing that delays treatment, but do not prematurely close the differential when infection remains plausible.',
    },
  ],
  managementOverview: [
    {
      action: 'Stop the precipitating dopamine-blocking medication',
      indication:
        'Suspected or confirmed NMS after recent initiation, dose escalation, or high-risk dopamine-antagonist exposure.',
      rationale:
        'Removing the precipitating dopamine blockade is the central first step in treatment.',
      nextStep:
        'Document the suspected reaction, review all medications, and avoid further dopamine-blocking exposure during the acute syndrome.',
      escalationImplication:
        'Do not wait for CK results or a perfect diagnostic workup before stopping the suspected trigger when the clinical syndrome is convincing.',
    },
    {
      action: 'Provide intensive supportive care and active cooling',
      indication:
        'Hyperthermia, autonomic instability, dehydration, or evolving organ dysfunction.',
      rationale:
        'Supportive care reduces secondary injury from hyperthermia, volume depletion, electrolyte disturbance, and dysautonomia.',
      nextStep:
        'Use continuous physiological monitoring, correct volume and electrolyte abnormalities, and reassess temperature and organ function frequently.',
      escalationImplication:
        'Severe hyperthermia, unstable haemodynamics, respiratory compromise, significant rhabdomyolysis, or renal injury warrants critical-care management.',
    },
    {
      action: 'Monitor and treat rhabdomyolysis-related complications',
      indication:
        'Marked CK elevation, myoglobinuria, hyperkalaemia, rising creatinine, or oliguria.',
      rationale:
        'Sustained rigidity can cause substantial muscle breakdown with acute kidney injury and arrhythmia risk.',
      nextStep:
        'Trend CK, creatinine, electrolytes, urine output, and cardiac rhythm while correcting abnormalities according to local critical-care protocols.',
      escalationImplication:
        'Progressive renal failure, refractory electrolyte abnormalities, arrhythmia, or worsening acidosis requires urgent specialist escalation.',
    },
    {
      action: 'Consider specialist-directed syndrome-specific therapy in severe or refractory disease',
      indication:
        'Persistent severe rigidity, hyperthermia, or autonomic instability despite withdrawal of the trigger and supportive care.',
      rationale:
        'Dopamine agonist or muscle-relaxant therapy is sometimes used in severe NMS, while benzodiazepines may help agitation or overlapping catatonic features.',
      nextStep:
        'Discuss bromocriptine, dantrolene, benzodiazepines, or other advanced measures with critical care, psychiatry, and clinical pharmacology according to local protocols.',
      escalationImplication:
        'Refractory illness or prominent catatonic features should prompt reconsideration of malignant catatonia and possible electroconvulsive therapy.',
    },
    {
      action: 'Plan cautious future antipsychotic reintroduction only after full recovery',
      indication:
        'Ongoing need for antipsychotic treatment after the acute syndrome has completely resolved.',
      rationale:
        'Recurrence can occur with premature or aggressive re-exposure.',
      nextStep:
        'Use specialist psychiatric oversight, allow an adequate recovery interval, choose a lower-risk strategy, and monitor closely for recurrent symptoms.',
      escalationImplication:
        'Any recurrent fever, rigidity, mental-state change, or autonomic instability after re-exposure requires immediate reassessment.',
    },
  ],
  differentialDistinguishers: [
    {
      diagnosis: 'Serotonin Syndrome',
      whyConfused:
        'Both can cause hyperthermia, altered mental status, autonomic instability, rigidity, and CK elevation after medication exposure.',
      distinguishingPoint:
        'Serotonin toxicity usually has a serotonergic trigger and neuromuscular hyperreactivity with clonus and hyperreflexia.',
      keySeparator:
        'Clonus/hyperreflexia favors serotonin syndrome; severe uniform rigidity with reduced reflexes after dopamine blockade favors NMS.',
      classicTrap:
        'Using fever or CK elevation alone to distinguish the syndromes.',
      managementConsequence:
        'Medication withdrawal priorities and syndrome-specific treatment differ, so the drug history and reflex examination must be explicit.',
    },
    {
      diagnosis: 'Malignant Catatonia',
      whyConfused:
        'Both can produce fever, rigidity, autonomic instability, mutism, agitation, and altered consciousness.',
      distinguishingPoint:
        'Malignant catatonia more often has a catatonic behavioral prodrome with posturing, negativism, waxy flexibility, or echophenomena.',
      keySeparator:
        'A clear dopamine-blocker escalation immediately preceding uniform rigidity favors NMS, while prominent catatonic signs preceding medication exposure favor malignant catatonia.',
      classicTrap:
        'Assuming that antipsychotic exposure automatically excludes malignant catatonia.',
      managementConsequence:
        'Malignant catatonia may require urgent benzodiazepine treatment and electroconvulsive therapy, so diagnostic uncertainty should trigger psychiatric reassessment.',
    },
    {
      diagnosis: 'Heat Stroke',
      whyConfused:
        'Both may cause extreme hyperthermia, encephalopathy, tachycardia, hypotension, and rhabdomyolysis.',
      distinguishingPoint:
        'Heat stroke requires a compatible environmental or exertional exposure and does not usually produce the classic dopamine-blockade-related rigid syndrome.',
      keySeparator:
        'Heat exposure favors heat stroke; recent antipsychotic escalation plus profound rigidity favors NMS.',
      classicTrap:
        'Attributing hyperthermia to warm weather without reviewing medications and muscle tone.',
      managementConsequence:
        'Both require immediate cooling and supportive care, but NMS additionally requires withdrawal of the dopamine-blocking trigger.',
    },
    {
      diagnosis: 'Malignant Hyperthermia',
      whyConfused:
        'Both can cause hyperthermia, rigidity, hyperkalaemia, acidosis, and rhabdomyolysis.',
      distinguishingPoint:
        'Malignant hyperthermia is linked to triggering anaesthetic exposure and usually begins in or around the peri-anaesthetic period.',
      keySeparator:
        'Recent general anaesthesia favors malignant hyperthermia; recent dopamine-blocker escalation favors NMS.',
      classicTrap:
        'Ignoring the exposure timeline when the physiological picture looks similar.',
      managementConsequence:
        'Malignant hyperthermia requires an anaesthesia emergency pathway, whereas NMS management centers on stopping dopamine blockade and intensive supportive care.',
    },
    {
      diagnosis: 'Encephalitis',
      whyConfused:
        'Fever and altered mental status can represent CNS infection, which is potentially fatal if missed.',
      distinguishingPoint:
        'Seizures, focal neurologic findings, meningism, CSF abnormalities, or compatible infectious features increase concern for encephalitis.',
      keySeparator:
        'A medication-triggered rigid dysautonomic syndrome with rhabdomyolysis favors NMS, but CNS infection must still be excluded when clinically plausible.',
      classicTrap:
        'Prematurely labeling all psychiatric-patient fever and confusion as a medication effect.',
      managementConsequence:
        'If CNS infection remains plausible, diagnostic and empiric infection pathways may need to proceed in parallel with NMS supportive care.',
    },
    {
      diagnosis: 'Anticholinergic Toxicity',
      whyConfused:
        'Both may cause delirium, hyperthermia, tachycardia, and autonomic disturbance.',
      distinguishingPoint:
        'Anticholinergic toxicity classically causes dry skin and mucosa, mydriasis, urinary retention, and reduced bowel sounds rather than profound generalized rigidity with diaphoresis.',
      keySeparator:
        'Dry anticholinergic findings favor anticholinergic toxicity; diaphoresis plus sustained rigidity after antipsychotic escalation favors NMS.',
      classicTrap:
        'Calling any hyperthermic delirium after medication exposure an anticholinergic toxidrome.',
      managementConsequence:
        'Correct syndrome identification determines which medications are stopped and which monitoring and antidotal strategies are considered.',
    },
  ],
  complications: [
    {
      complication: 'Rhabdomyolysis',
      whyItMatters:
        'Sustained rigidity can cause extensive muscle breakdown with major CK elevation and myoglobin release.',
    },
    {
      complication: 'Acute kidney injury',
      whyItMatters:
        'Myoglobinuria, dehydration, and systemic instability can impair renal function.',
    },
    {
      complication: 'Electrolyte disturbance and arrhythmia',
      whyItMatters:
        'Hyperkalaemia and other abnormalities from muscle injury can produce life-threatening cardiac complications.',
    },
    {
      complication: 'Respiratory failure',
      whyItMatters:
        'Severe chest-wall rigidity, reduced consciousness, aspiration, or systemic deterioration can compromise ventilation and airway protection.',
    },
    {
      complication: 'Disseminated intravascular coagulation and multiorgan failure',
      whyItMatters:
        'Severe uncontrolled hyperthermia and systemic injury can progress to critical multiorgan dysfunction.',
    },
  ],
  pitfalls: [
    {
      pitfall: 'Using CK as the diagnosis',
      consequence:
        'CK can be elevated in seizures, agitation, restraint, serotonin toxicity, heat illness, and many other causes of muscle injury.',
      saferHeuristic:
        'Diagnose NMS from the medication timeline plus the clinical syndrome, using CK to support severity and complications.',
    },
    {
      pitfall: 'Missing serotonin syndrome',
      consequence:
        'Fever, dysautonomia, and rigidity overlap, and incorrect labeling can obscure the responsible medication exposure.',
      saferHeuristic:
        'Always document serotonergic exposure, reflexes, and inducible or ocular clonus.',
    },
    {
      pitfall: 'Missing malignant catatonia',
      consequence:
        'Catatonia may worsen with dopamine blockade and can require a different urgent psychiatric treatment pathway.',
      saferHeuristic:
        'Ask whether catatonic behaviors preceded antipsychotic treatment and actively examine for posturing, negativism, waxy flexibility, and echophenomena.',
    },
    {
      pitfall: 'Delaying supportive care for confirmatory testing',
      consequence:
        'NMS has no single confirmatory test, and delay allows hyperthermia, rhabdomyolysis, renal injury, and autonomic instability to progress.',
      saferHeuristic:
        'Stop the suspected precipitating agent and begin emergency supportive care while excluding dangerous mimics in parallel.',
    },
  ],
  recallPrompts: [
    {
      type: 'DISTINGUISH',
      prompt: 'Which bedside neuromuscular finding most strongly shifts a hyperthermic psychotropic reaction toward serotonin syndrome rather than NMS?',
      answer: 'Inducible or spontaneous clonus with hyperreflexia.',
      explanation:
        'NMS usually produces severe sustained rigidity with normal or reduced reflexes, whereas serotonin toxicity is characterized by neuromuscular hyperreactivity.',
      linkedConcept: 'NMS versus serotonin syndrome',
      sourceSection: 'Differentials',
    },
    {
      type: 'WHY_IT_MATTERS',
      prompt: 'Why is the medication timeline essential when evaluating suspected NMS?',
      answer:
        'NMS usually follows initiation or dose escalation of dopamine-blocking therapy, or less commonly abrupt withdrawal of dopaminergic therapy.',
      explanation:
        'The exposure timeline is central because many competing hyperthermic syndromes share fever, altered mental status, and autonomic instability.',
      linkedConcept: 'Precipitating exposure',
      sourceSection: 'Clinical Pattern',
    },
    {
      type: 'SHORT_ANSWER',
      prompt: 'What laboratory pattern suggests rhabdomyolysis in NMS?',
      answer:
        'Marked CK elevation with possible hyperkalaemia, rising creatinine, and heme-positive urine with few red cells from myoglobinuria.',
      explanation:
        'Sustained rigidity causes skeletal-muscle injury, which can lead to renal and electrolyte complications.',
      linkedConcept: 'Rhabdomyolysis',
      sourceSection: 'Investigations',
    },
    {
      type: 'PEARL_RECALL',
      prompt: 'What is the first medication action when NMS is strongly suspected?',
      answer: 'Stop the precipitating dopamine-blocking medication.',
      explanation:
        'Withdrawal of the offending agent is the central first treatment step, alongside urgent supportive care.',
      linkedConcept: 'Immediate management',
      sourceSection: 'Management',
    },
    {
      type: 'DISTINGUISH',
      prompt: 'Which historical feature favors malignant hyperthermia over NMS?',
      answer: 'Recent exposure to a triggering general anaesthetic or depolarizing neuromuscular blocker.',
      explanation:
        'Malignant hyperthermia is tightly linked to anaesthetic exposure, while NMS is linked to dopamine blockade or dopaminergic withdrawal.',
      linkedConcept: 'NMS versus malignant hyperthermia',
      sourceSection: 'Differentials',
    },
  ],
  references: [
    { citation: 'StatPearls: Neuroleptic Malignant Syndrome, NCBI Bookshelf.' },
    { citation: 'American Psychiatric Association DSM-5-TR diagnostic framework for Neuroleptic Malignant Syndrome.' },
    { citation: 'Virolle J et al. Systematic review of antipsychotic-induced catatonia and Neuroleptic Malignant Syndrome. Schizophrenia Research. 2023.' },
  ],
};

function assertSeedShape(): void {
  const allowedClueTypes = new Set([
    'history',
    'symptom',
    'vital',
    'lab',
    'exam',
    'imaging',
  ]);

  if (clues.length !== 6) {
    throw new Error(`Expected exactly 6 clues; found ${clues.length}.`);
  }

  clues.forEach((clue, index) => {
    if (clue.order !== index) {
      throw new Error(`Clue order mismatch at index ${index}: found ${clue.order}.`);
    }
    if (!allowedClueTypes.has(clue.type)) {
      throw new Error(`Unsupported clue type at order ${clue.order}: ${clue.type}.`);
    }
    if (!clue.value.trim()) {
      throw new Error(`Empty clue value at order ${clue.order}.`);
    }
  });

  const earlyText = clues
    .filter((clue) => clue.order < 5)
    .map((clue) => normalizeClinicalText(clue.value))
    .join(' ');

  for (const phrase of [canonicalName, displayLabel]) {
    const normalized = normalizeClinicalText(phrase);
    if (earlyText.includes(normalized)) {
      throw new Error(`Diagnosis leakage before final clue: ${phrase}.`);
    }
  }

  const earlyRaw = clues
    .filter((clue) => clue.order < 5)
    .map((clue) => clue.value)
    .join(' ');
  if (/\bNMS\b/i.test(earlyRaw)) {
    throw new Error('Diagnosis acronym leakage before final clue: NMS.');
  }

  if (explanation.clueBreakdown.length !== clues.length) {
    throw new Error('Clue breakdown length does not match clue count.');
  }

  explanation.clueBreakdown.forEach((entry, index) => {
    const clue = clues[index];
    if (
      entry.clueOrder !== clue.order ||
      entry.clueType !== clue.type ||
      entry.clue !== clue.value
    ) {
      throw new Error(`Clue breakdown mismatch at clue ${index}.`);
    }
  });

  explanation.differentialAnalysis.forEach((differential) => {
    if (!differentials.includes(differential.diagnosis)) {
      throw new Error(`Differential analysis is not canonical: ${differential.diagnosis}.`);
    }

    differential.ruledOutByClues.forEach((evidence) => {
      const clue = clues.find((item) => item.order === evidence.clueOrder);
      if (!clue) {
        throw new Error(
          `Differential evidence references missing clue: ${differential.diagnosis} -> ${evidence.clueOrder}.`,
        );
      }

      if (!clue.value.toLowerCase().includes(evidence.evidence.toLowerCase())) {
        throw new Error(
          `Differential evidence not found: ${differential.diagnosis} -> ${evidence.evidence}`,
        );
      }
    });
  });

  if (educationForFrontend.keySigns.length < 3) {
    throw new Error('Education requires at least 3 structured key signs.');
  }

  educationForFrontend.keySigns.forEach((sign) => {
    if (!sign.finding || !sign.mechanism || !sign.diagnosticImpact || !sign.discriminator) {
      throw new Error(`Incomplete key sign education: ${sign.finding}.`);
    }
  });

  if (educationForFrontend.scoringSystems.length !== 0) {
    throw new Error('NMS seed should not invent a formal scoring system.');
  }

  educationForFrontend.investigations.forEach((investigation) => {
    if (
      !investigation.test ||
      !investigation.expectedFinding ||
      !investigation.interpretation ||
      !investigation.managementImplication
    ) {
      throw new Error(`Incomplete investigation education: ${investigation.test}.`);
    }
  });

  educationForFrontend.differentialDistinguishers.forEach((differential) => {
    if (
      !differential.diagnosis ||
      !differential.whyConfused ||
      !differential.keySeparator ||
      !differential.classicTrap ||
      !differential.managementConsequence
    ) {
      throw new Error(`Incomplete differential education: ${differential.diagnosis}.`);
    }
  });

  educationForFrontend.managementOverview.forEach((item) => {
    if (!item.action || !item.indication || !item.rationale || !item.nextStep) {
      throw new Error(`Incomplete management education: ${item.action}.`);
    }
  });

  educationForFrontend.pitfalls.forEach((item) => {
    if (!item.pitfall || !item.consequence || !item.saferHeuristic) {
      throw new Error(`Incomplete pitfall education: ${item.pitfall}.`);
    }
  });

  const allowedRecallTypes = new Set([
    'CLOZE',
    'SHORT_ANSWER',
    'DISTINGUISH',
    'PEARL_RECALL',
    'WHY_IT_MATTERS',
  ]);

  educationForFrontend.recallPrompts.forEach((prompt) => {
    if (!allowedRecallTypes.has(prompt.type)) {
      throw new Error(`Unsupported recall prompt type: ${prompt.type}.`);
    }
    if (!prompt.prompt || !prompt.answer || !prompt.explanation) {
      throw new Error(`Incomplete recall prompt: ${prompt.prompt}.`);
    }
  });
}

async function ensureRegistry() {
  const normalizedTerms = aliasTerms.map(normalizeClinicalText);
  const canonicalNormalized = normalizeClinicalText(canonicalName);

  const existing = await prisma.diagnosisRegistry.findFirst({
    where: {
      OR: [
        { canonicalNormalized: { in: normalizedTerms } },
        {
          aliases: {
            some: {
              normalizedTerm: { in: normalizedTerms },
              active: true,
            },
          },
        },
      ],
    },
    select: { id: true },
  });

  const registry = existing
    ? await prisma.diagnosisRegistry.update({
        where: { id: existing.id },
        data: {
          canonicalName,
          canonicalNormalized,
          displayLabel,
          status: DiagnosisRegistryStatus.ACTIVE,
          active: true,
          isPlayable: true,
          isGeneratable: true,
          specialty: 'Psychiatry',
          subspecialty: 'Consultation-Liaison Psychiatry',
          category: 'Medication-Induced Emergency',
          bodySystem: 'Behavioral Health',
          organSystem: 'Central Nervous System',
          difficultyBand: DiagnosisDifficultyBand.ADVANCED,
          rarityBand: DiagnosisRarityBand.UNCOMMON,
          clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
          ageGroup: DiagnosisAgeGroup.ADULT,
          urgencyLevel: DiagnosisUrgencyLevel.EMERGENT,
          preferredClueTypes: ['history', 'symptom', 'vital', 'exam', 'lab'],
          notes:
            'Seeded flagship Neuroleptic Malignant Syndrome case emphasizing medication timing, neuromuscular discrimination, autonomic instability, and rhabdomyolysis.',
        },
        select: { id: true, displayLabel: true },
      })
    : await prisma.diagnosisRegistry.create({
        data: {
          canonicalName,
          canonicalNormalized,
          displayLabel,
          status: DiagnosisRegistryStatus.ACTIVE,
          active: true,
          isPlayable: true,
          isGeneratable: true,
          specialty: 'Psychiatry',
          subspecialty: 'Consultation-Liaison Psychiatry',
          category: 'Medication-Induced Emergency',
          bodySystem: 'Behavioral Health',
          organSystem: 'Central Nervous System',
          difficultyBand: DiagnosisDifficultyBand.ADVANCED,
          rarityBand: DiagnosisRarityBand.UNCOMMON,
          clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
          ageGroup: DiagnosisAgeGroup.ADULT,
          urgencyLevel: DiagnosisUrgencyLevel.EMERGENT,
          preferredClueTypes: ['history', 'symptom', 'vital', 'exam', 'lab'],
          notes:
            'Seeded flagship Neuroleptic Malignant Syndrome case emphasizing medication timing, neuromuscular discrimination, autonomic instability, and rhabdomyolysis.',
        },
        select: { id: true, displayLabel: true },
      });

  for (const [rank, term] of aliasTerms.entries()) {
    await prisma.diagnosisAlias.upsert({
      where: {
        diagnosisRegistryId_normalizedTerm: {
          diagnosisRegistryId: registry.id,
          normalizedTerm: normalizeClinicalText(term),
        },
      },
      update: {
        term,
        active: true,
        acceptedForMatch: true,
        rank,
        kind:
          rank === 0
            ? DiagnosisAliasKind.CANONICAL
            : DiagnosisAliasKind.ACCEPTED,
      },
      create: {
        diagnosisRegistryId: registry.id,
        term,
        normalizedTerm: normalizeClinicalText(term),
        active: true,
        acceptedForMatch: true,
        rank,
        kind:
          rank === 0
            ? DiagnosisAliasKind.CANONICAL
            : DiagnosisAliasKind.ACCEPTED,
        source: seedVersion,
      },
    });
  }

  return registry;
}

async function ensureEducation(diagnosisRegistryId: string) {
  const existing = await prisma.diagnosisEducation.findUnique({
    where: { diagnosisRegistryId },
    select: { id: true, version: true },
  });

  if (existing) {
    console.log('Skipped existing Neuroleptic Malignant Syndrome education:', existing);
    return existing;
  }

  const education = await prisma.diagnosisEducation.create({
    data: {
      diagnosisRegistryId,
      title: educationForFrontend.title,
      summary: educationForFrontend.summary,
      clinicalPattern: educationForFrontend.recognitionPattern,
      keySymptoms: educationForFrontend.keySymptoms,
      keySigns: educationForFrontend.keySigns,
      examPearls: educationForFrontend.examPearls,
      scoringSystems: educationForFrontend.scoringSystems,
      investigations: educationForFrontend.investigations,
      differentials: educationForFrontend.differentialDistinguishers,
      management: educationForFrontend.managementOverview,
      complications: educationForFrontend.complications,
      pitfalls: educationForFrontend.pitfalls,
      recallPrompts: educationForFrontend.recallPrompts,
      references: educationForFrontend.references,
      editorialStatus: DiagnosisEducationStatus.PUBLISHED,
      source: DiagnosisEducationSource.MANUAL,
      reviewedAt: now,
      publishedAt: now,
      version: 1,
    },
    select: { id: true, version: true },
  });

  await prisma.diagnosisEducationRevision.create({
    data: {
      educationId: education.id,
      version: education.version,
      snapshot: {
        ...educationForFrontend,
        storedColumnMap: {
          recognitionPattern: 'clinicalPattern',
          managementOverview: 'management',
          differentialDistinguishers: 'differentials',
        },
      },
      editorialStatus: DiagnosisEducationStatus.PUBLISHED,
      source: DiagnosisEducationSource.MANUAL,
    },
  });

  return education;
}

async function ensureValidationRun(params: {
  caseId: string;
  revisionId: string;
}): Promise<void> {
  const existing = await prisma.caseValidationRun.findFirst({
    where: {
      caseId: params.caseId,
      revisionId: params.revisionId,
      validatorVersion: `flagship-human-review:${seedVersion}`,
    },
    select: { id: true },
  });

  if (existing) return;

  await prisma.caseValidationRun.create({
    data: {
      caseId: params.caseId,
      revisionId: params.revisionId,
      source: CaseSource.MANUAL,
      publishTrack: PublishTrack.DAILY,
      outcome: ValidationOutcome.PASSED,
      validatorVersion: `flagship-human-review:${seedVersion}`,
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        note:
          'Complete Neuroleptic Malignant Syndrome flagship seed with six playable clues, differential evidence checks, and frontend-aligned education.',
      },
      findings: [],
      completedAt: now,
    },
  });
}

async function ensureCase(params: {
  diagnosisRegistryId: string;
  educationId: string;
}) {
  const history = clues[0].value;
  const symptoms = [clues[1].value];

  const existingCases = await prisma.case.findMany({
    where: {
      diagnosisRegistryId: params.diagnosisRegistryId,
      title: caseTitle,
    },
    orderBy: [{ approvedAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      currentRevisionId: true,
      publicNumber: true,
      title: true,
      date: true,
      dailyCases: { select: { id: true }, take: 1 },
    },
  });

  const scheduledCase = existingCases.find((item) => item.dailyCases.length > 0);
  if (scheduledCase) {
    console.log('Skipped existing scheduled Neuroleptic Malignant Syndrome case:', scheduledCase);
    return;
  }

  const completeCase = existingCases.find(
    (item) => item.dailyCases.length === 0 && item.currentRevisionId,
  );

  if (completeCase?.currentRevisionId) {
    await ensureValidationRun({
      caseId: completeCase.id,
      revisionId: completeCase.currentRevisionId,
    });
    console.log('Skipped existing complete Neuroleptic Malignant Syndrome case:', completeCase);
    return;
  }

  const reusableCase = existingCases.find(
    (item) => item.dailyCases.length === 0 && !item.currentRevisionId,
  );

  const assignedDate = await findAvailableInventoryPlaceholderDate({
    preferredDate: inventoryPlaceholderDate,
    reusableCaseId: reusableCase?.id,
    displayLabel: caseTitle,
  });

  const publicNumber = reusableCase?.publicNumber ?? (await getNextCasePublicNumber());

  const caseData = {
    title: caseTitle,
    publicNumber,
    date: assignedDate,
    difficulty: 'advanced',
    history,
    symptoms,
    clues: clues as unknown as object,
    explanation: explanation as object,
    differentials,
    editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
    approvedAt: now,
    publishedAt: null,
    diagnosisRegistryId: params.diagnosisRegistryId,
    proposedDiagnosisText: displayLabel,
    diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
    diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
    diagnosisMappingConfidence: 1,
    diagnosisEditorialNote:
      'Seeded complete frontend-aligned flagship Neuroleptic Malignant Syndrome case with medication-trigger and neuromuscular differential teaching.',
  };

  const seededCase = reusableCase
    ? await prisma.case.update({
        where: { id: reusableCase.id },
        data: caseData,
        select: { id: true },
      })
    : await prisma.case.create({
        data: caseData,
        select: { id: true },
      });

  const latestRevision = await prisma.caseRevision.findFirst({
    where: { caseId: seededCase.id },
    orderBy: { revisionNumber: 'desc' },
    select: { revisionNumber: true },
  });

  const revision = await prisma.caseRevision.create({
    data: {
      caseId: seededCase.id,
      revisionNumber: (latestRevision?.revisionNumber ?? 0) + 1,
      source: CaseSource.MANUAL,
      publishTrack: PublishTrack.DAILY,
      title: caseTitle,
      date: assignedDate,
      difficulty: 'advanced',
      history,
      symptoms,
      clues: clues as unknown as object,
      explanation: explanation as object,
      differentials,
      diagnosisRegistryId: params.diagnosisRegistryId,
      proposedDiagnosisText: displayLabel,
      diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
      diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
      diagnosisMappingConfidence: 1,
      diagnosisEditorialNote:
        'Created complete Neuroleptic Malignant Syndrome revision with frontend-aligned explanation and education.',
    },
    select: { id: true },
  });

  await prisma.case.update({
    where: { id: seededCase.id },
    data: { currentRevisionId: revision.id },
  });

  await ensureValidationRun({ caseId: seededCase.id, revisionId: revision.id });

  console.log('Seeded Neuroleptic Malignant Syndrome:', {
    registryId: params.diagnosisRegistryId,
    caseId: seededCase.id,
    revisionId: revision.id,
    publicNumber,
    educationId: params.educationId,
    clueTypes: clues.map((clue) => clue.type),
  });
}

async function main() {
  assertSeedShape();
  console.log('Neuroleptic Malignant Syndrome seed validation passed.');

  const registry = await ensureRegistry();
  const education = await ensureEducation(registry.id);
  await ensureCase({
    diagnosisRegistryId: registry.id,
    educationId: education.id,
  });
}

main()
  .catch((error) => {
    console.error('Neuroleptic Malignant Syndrome seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
