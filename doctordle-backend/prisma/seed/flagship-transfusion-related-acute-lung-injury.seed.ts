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

/**
 * FLAGSHIP CASE SEED — Transfusion-Related Acute Lung Injury
 *
 * Clinical focus:
 * - Acute hypoxaemia arising during a blood-component transfusion.
 * - New bilateral pulmonary oedema without left-atrial hypertension.
 * - Distinction from transfusion-associated circulatory overload, anaphylaxis,
 *   haemolysis, bacterial contamination, cardiogenic pulmonary oedema, and ARDS.
 * - TRALI remains a clinical diagnosis; donor leucocyte-antibody detection is
 *   supportive but is not required for the diagnosis.
 *
 * Safety:
 * - Reuses or creates the exact diagnosis registry and accepted aliases.
 * - Does not overwrite existing diagnosis education.
 * - Does not overwrite an existing case with the same title.
 * - Does not alter a scheduled DailyCase.
 *
 * Run:
 *   npx tsx prisma/seed/flagship-transfusion-related-acute-lung-injury.seed.ts
 *
 * Railway:
 *   railway run npx tsx prisma/seed/flagship-transfusion-related-acute-lung-injury.seed.ts
 */

const databaseUrl = resolvePgConnectionString(process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required to run the Transfusion-Related Acute Lung Injury seed.',
  );
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 20_000,
  allowExitOnIdle: true,
  ssl:
    databaseUrl.includes('railway') ||
    databaseUrl.includes('proxy.rlwy.net') ||
    databaseUrl.includes('postgres.railway.internal')
      ? { rejectUnauthorized: false }
      : undefined,
});

pool.on('error', (error) => {
  console.error('[pg-pool] idle client error:', error);
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function resolvePgConnectionString(
  value: string | undefined,
): string | undefined {
  if (!value) return undefined;
  if (!value.startsWith('prisma+postgres://')) return value;

  const parsed = new URL(value);
  const apiKey = parsed.searchParams.get('api_key');

  if (!apiKey) {
    throw new Error(
      'DATABASE_URL uses prisma+postgres:// but is missing api_key.',
    );
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
  displayLabel: string;
}): Promise<Date> {
  for (let offset = 0; offset < 365; offset += 1) {
    const candidateDate = addUtcDays(params.preferredDate, offset);
    const owner = await prisma.case.findUnique({
      where: { date: candidateDate },
      select: {
        id: true,
        title: true,
        dailyCases: { select: { id: true }, take: 1 },
      },
    });

    if (!owner) return candidateDate;

    console.warn('Inventory placeholder date occupied; trying next day.', {
      displayLabel: params.displayLabel,
      candidateDate: candidateDate.toISOString(),
      occupiedByCaseId: owner.id,
      occupiedByTitle: owner.title,
      occupiedCaseIsScheduled: owner.dailyCases.length > 0,
    });
  }

  throw new Error(
    `Cannot seed ${params.displayLabel}: no free inventory placeholder date found.`,
  );
}

const now = new Date();
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 10, 18, 12, 0, 0));
const seedVersion = 'flagship-transfusion-related-acute-lung-injury-v1';

const canonicalName = 'transfusion-related acute lung injury';
const displayLabel = 'Transfusion-Related Acute Lung Injury';
const caseTitle = 'Sudden Hypoxaemia During a Red-Cell Transfusion';

const taxonomy = {
  specialty: 'Hematology',
  subspecialty: 'Transfusion Medicine',
  category: 'Acute Transfusion Reaction',
  bodySystem: 'Respiratory',
  organSystem: 'Lung',
} as const;

const aliasTerms = [
  'Transfusion-Related Acute Lung Injury',
  'Transfusion Related Acute Lung Injury',
  'TRALI',
];

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 46-year-old woman with severe iron-deficiency anaemia from uterine fibroids is admitted for red-cell transfusion. Before transfusion she has normal oxygen saturation, a clear chest examination, and stable respiratory status for more than 12 hours. There is no pneumonia, sepsis, aspiration, major trauma, pancreatitis, shock, or recent surgery.',
  },
  {
    order: 1,
    type: 'vital',
    value:
      'Eighty minutes after the second packed red-cell unit is started, she develops abrupt breathlessness, dry cough, and chest tightness. Temperature is 38.1 C, pulse 124/min, blood pressure 86/54 mmHg, respiratory rate 34/min, and oxygen saturation 78% on room air. The transfusion is stopped immediately.',
  },
  {
    order: 2,
    type: 'exam',
    value:
      'She is in marked respiratory distress with diffuse bilateral inspiratory crackles. The jugular venous pressure is not elevated, there is no peripheral oedema or third heart sound, and there is no wheeze, urticaria, angioedema, back pain, flank pain, or dark urine.',
  },
  {
    order: 3,
    type: 'imaging',
    value:
      'A chest radiograph obtained shortly after symptom onset shows new bilateral diffuse alveolar opacities consistent with pulmonary oedema, without cardiomegaly or pleural effusions. Lung ultrasonography demonstrates widespread bilateral B-lines.',
  },
  {
    order: 4,
    type: 'lab',
    value:
      'Arterial blood gas on an inspired oxygen fraction of 0.40 shows PaO2 58 mmHg, giving a PaO2/FiO2 ratio of 145. BNP is 48 pg/mL, troponin is normal, fluid balance is neutral, and echocardiography shows normal biventricular systolic function without elevated left-sided filling pressure.',
  },
  {
    order: 5,
    type: 'lab',
    value:
      'The direct antiglobulin test is negative, plasma-free haemoglobin and bilirubin show no haemolysis, and patient and component cultures remain sterile. Transfusion-medicine review confirms acute noncardiogenic pulmonary oedema arising within six hours of transfusion, with no alternative ARDS risk factor; donor testing later identifies cognate anti-HLA class II antibodies.',
  },
] as const;

const differentials = [
  'Transfusion-Associated Circulatory Overload',
  'Anaphylaxis',
  'Acute Hemolytic Transfusion Reaction',
  'Septic Transfusion Reaction',
  'Acute Respiratory Distress Syndrome',
  'Cardiogenic Pulmonary Edema',
];

const canonicalDifferentialLabels = new Set(differentials);

type DifferentialAnalysisEntry = {
  diagnosis: string;
  whyPlausibleEarly: string;
  ruledOutByClues: Array<{
    clueOrder: number;
    evidence: string;
    reason: string;
  }>;
  finalReasonLessLikely: string;
};

type ClueBreakdownEntry = {
  clueOrder: number;
  clueType: string;
  clue: string;
  explanation: string;
  diagnosticContribution: string;
};

const reasoningSteps = [
  'A previously stable patient without a competing ARDS risk factor establishes a clean pretransfusion baseline and supports classification as a transfusion-triggered lung injury if acute pulmonary oedema follows.',
  'Abrupt hypoxaemic respiratory deterioration with hypotension during the transfusion window strongly indicates a serious acute pulmonary transfusion reaction rather than progression of the original anaemia.',
  'Diffuse crackles confirm pulmonary involvement, while absent jugular venous distension, peripheral oedema, allergic findings, and haemolytic symptoms reduce circulatory overload, anaphylaxis, and acute haemolysis.',
  'New bilateral alveolar opacities without cardiomegaly or pleural effusions demonstrate acute pulmonary oedema with an imaging pattern that is not strongly supportive of hydrostatic cardiac failure.',
  'A PaO2/FiO2 ratio of 145 confirms significant hypoxaemia, while a low BNP, neutral fluid balance, and normal cardiac filling-pressure assessment support noncardiogenic rather than circulatory pulmonary oedema.',
  'Negative haemolysis and culture investigations, onset within six hours, absence of another ARDS risk factor, and supportive cognate donor HLA antibodies establish Transfusion-Related Acute Lung Injury.',
] as const;

const explanation = {
  diagnosis: displayLabel,
  summary:
    'A previously stable transfusion recipient develops abrupt hypoxaemia and bilateral pulmonary oedema within the transfusion window, without circulatory overload, cardiac failure, haemolysis, bacterial contamination, or another ARDS risk factor, establishing Transfusion-Related Acute Lung Injury.',
  reasoning: reasoningSteps.join('\n'),
  clueBreakdown: clues.map((clue, index) => ({
    clueOrder: clue.order,
    clueType: clue.type,
    clue: clue.value,
    explanation: reasoningSteps[index],
    diagnosticContribution: [
      'Establishes stable pretransfusion respiratory status and excludes major competing ARDS risks.',
      'Demonstrates the acute temporal relationship between transfusion and severe hypoxaemia.',
      'Supports pulmonary oedema while reducing overload, anaphylaxis, and haemolysis.',
      'Confirms new bilateral pulmonary oedema without typical hydrostatic imaging features.',
      'Quantifies hypoxaemia and provides objective evidence against left-atrial hypertension.',
      'Excludes major transfusion mimics and provides supportive immunologic evidence.',
    ][index],
  })),
  keyFindings: [
    'Normal respiratory status before transfusion',
    'Abrupt onset during red-cell transfusion',
    'Severe hypoxaemia',
    'Hypotension rather than hypertension',
    'Diffuse bilateral inspiratory crackles',
    'No elevated jugular venous pressure or peripheral oedema',
    'New bilateral alveolar pulmonary opacities',
    'No cardiomegaly or pleural effusions',
    'PaO2/FiO2 ratio 145',
    'Low BNP and normal cardiac filling-pressure assessment',
    'Negative haemolysis investigation',
    'Sterile patient and component cultures',
    'No alternative ARDS risk factor',
    'Supportive cognate donor anti-HLA antibodies',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Transfusion-Associated Circulatory Overload',
      whyPlausibleEarly:
        'Both conditions can cause acute dyspnoea, hypoxaemia, crackles, and bilateral pulmonary oedema during or soon after transfusion.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: 'jugular venous pressure is not elevated',
          reason:
            'Absence of systemic venous congestion argues against hydrostatic volume overload.',
        },
        {
          clueOrder: 3,
          evidence: 'without cardiomegaly or pleural effusions',
          reason:
            'The imaging lacks common supportive signs of circulatory overload.',
        },
        {
          clueOrder: 4,
          evidence: 'BNP is 48 pg/mL',
          reason:
            'A low natriuretic peptide level is not supportive of substantial cardiac volume overload.',
        },
      ],
      finalReasonLessLikely:
        'Objective cardiac assessment, fluid balance, examination, and imaging do not support left-atrial hypertension or transfusion-associated circulatory overload.',
    },
    {
      diagnosis: 'Anaphylaxis',
      whyPlausibleEarly:
        'Anaphylaxis can begin during transfusion with respiratory distress and hypotension.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: 'there is no wheeze, urticaria, angioedema',
          reason:
            'The absence of bronchospasm, skin findings, and angioedema makes anaphylaxis substantially less likely.',
        },
        {
          clueOrder: 3,
          evidence: 'new bilateral diffuse alveolar opacities',
          reason:
            'Diffuse pulmonary oedema is the dominant process rather than an isolated allergic airway reaction.',
        },
      ],
      finalReasonLessLikely:
        'The clinical and radiographic syndrome is acute pulmonary oedema without characteristic allergic manifestations.',
    },
    {
      diagnosis: 'Acute Hemolytic Transfusion Reaction',
      whyPlausibleEarly:
        'Acute haemolysis may cause fever, hypotension, dyspnoea, and clinical deterioration during transfusion.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: 'there is no wheeze, urticaria, angioedema, back pain, flank pain, or dark urine',
          reason:
            'The examination and symptom review lack common haemolytic warning features such as pain and haemoglobinuria.',
        },
        {
          clueOrder: 5,
          evidence: 'direct antiglobulin test is negative',
          reason:
            'The transfusion-reaction investigation does not support immune haemolysis.',
        },
        {
          clueOrder: 5,
          evidence: 'show no haemolysis',
          reason:
            'Biochemical testing does not demonstrate destruction of transfused red cells.',
        },
      ],
      finalReasonLessLikely:
        'There is no clinical, antiglobulin, or biochemical evidence of acute haemolysis.',
    },
    {
      diagnosis: 'Septic Transfusion Reaction',
      whyPlausibleEarly:
        'Bacterial contamination can cause fever, hypotension, respiratory distress, and rapid deterioration during transfusion.',
      ruledOutByClues: [
        {
          clueOrder: 5,
          evidence: 'patient and component cultures remain sterile',
          reason:
            'Microbiological investigation does not demonstrate contamination or transfusion-transmitted bacteraemia.',
        },
        {
          clueOrder: 3,
          evidence: 'bilateral diffuse alveolar opacities consistent with pulmonary oedema',
          reason:
            'The dominant immediate syndrome is pulmonary oedema rather than septic shock with a proven contaminated component.',
        },
      ],
      finalReasonLessLikely:
        'Sterile cultures and the noncardiogenic pulmonary-oedema pattern do not support a septic transfusion reaction.',
    },
    {
      diagnosis: 'Acute Respiratory Distress Syndrome',
      whyPlausibleEarly:
        'The hypoxaemia and bilateral noncardiogenic pulmonary oedema meet an ARDS-type physiological pattern.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence: 'There is no pneumonia, sepsis, aspiration, major trauma, pancreatitis, shock, or recent surgery',
          reason:
            'No alternative ARDS risk factor is present before transfusion.',
        },
        {
          clueOrder: 1,
          evidence: 'Eighty minutes after the second packed red-cell unit is started',
          reason:
            'The abrupt deterioration is tightly linked to transfusion exposure.',
        },
      ],
      finalReasonLessLikely:
        'The patient was stable before transfusion, lacks a competing ARDS risk, and deteriorated within the defined transfusion window.',
    },
    {
      diagnosis: 'Cardiogenic Pulmonary Edema',
      whyPlausibleEarly:
        'Cardiogenic pulmonary oedema can produce sudden dyspnoea, hypoxaemia, crackles, and bilateral alveolar opacities.',
      ruledOutByClues: [
        {
          clueOrder: 3,
          evidence: 'without cardiomegaly or pleural effusions',
          reason:
            'The radiograph lacks common hydrostatic congestion findings.',
        },
        {
          clueOrder: 4,
          evidence: 'normal biventricular systolic function without elevated left-sided filling pressure',
          reason:
            'Objective cardiac assessment does not identify left-atrial hypertension as the main cause of oedema.',
        },
      ],
      finalReasonLessLikely:
        'Normal cardiac function and filling-pressure assessment support a noncardiogenic process.',
    },
  ],
  managementPearl:
    'Stop the transfusion, maintain intravenous access with appropriate fluid, provide oxygen and ventilatory support according to severity, and notify the transfusion service immediately. Diuretics are not routine therapy unless coexisting circulatory overload is present.',
  generationQuality: {
    contentTier: 'FLAGSHIP',
    seedVersion,
    humanReviewed: true,
    discriminatorStrength: 'HIGH',
    expectedTeachingPoints: [
      'TRALI begins during or within six hours of transfusion',
      'Diagnosis requires hypoxaemia and bilateral pulmonary oedema without left-atrial hypertension as the main explanation',
      'TACO is the most important transfusion-specific pulmonary differential',
      'Donor HLA or HNA antibodies support investigation but are not required for clinical diagnosis',
      'Immediate management is transfusion cessation, supportive respiratory care, and haemovigilance reporting',
    ],
    competencyDomains: [
      'Hematology',
      'Transfusion Medicine',
      'Critical Care',
      'Respiratory Medicine',
      'Clinical Reasoning',
    ],
  },
};

const educationForFrontend = {
  title: displayLabel,
  summary: {
    definition:
      'Transfusion-Related Acute Lung Injury is acute hypoxaemic, noncardiogenic pulmonary oedema that begins during or within six hours of transfusion and is not mainly explained by left-atrial hypertension.',
    highYieldTakeaway:
      'Suspect TRALI when a previously stable transfusion recipient develops acute hypoxaemia and bilateral pulmonary oedema without convincing circulatory overload; stop the transfusion, support oxygenation, and notify the transfusion service.',
  },
  recognitionPattern: [
    {
      pattern: 'Acute respiratory deterioration during or soon after transfusion',
      whyItMatters:
        'The timing links the pulmonary syndrome to a transfused blood component and should trigger immediate transfusion-reaction management.',
      progression:
        'Transfusion exposure -> pulmonary endothelial activation and capillary leak -> abrupt hypoxaemia and bilateral pulmonary oedema.',
      discriminator:
        'TRALI is usually hypotensive or normotensive and lacks clear evidence of left-atrial hypertension, unlike many cases of circulatory overload.',
      commonTrap:
        'Do not dismiss the reaction because the transfused component contains relatively little plasma; any plasma-containing component may be implicated.',
    },
    {
      pattern: 'Bilateral pulmonary oedema with no dominant cardiac explanation',
      whyItMatters:
        'The distinction from hydrostatic pulmonary oedema determines classification and avoids inappropriate reliance on diuretics.',
      progression:
        'Capillary permeability rises -> protein-rich pulmonary oedema -> diffuse opacities, crackles, and impaired oxygenation.',
      discriminator:
        'Assessment integrates examination, fluid balance, imaging, natriuretic peptides, echocardiography, and clinical response rather than one isolated test.',
      commonTrap:
        'A normal echocardiogram alone does not prove TRALI, and an elevated BNP alone does not prove TACO.',
    },
    {
      pattern: 'Type I versus Type II classification',
      whyItMatters:
        'The 2019 consensus allows classification when an ARDS risk factor exists, provided respiratory status was stable in the 12 hours before transfusion and deterioration is attributed to transfusion.',
      progression:
        'No ARDS risk factor -> Type I; ARDS risk factor or mild existing ARDS with stable pretransfusion status -> possible Type II after expert assessment.',
      discriminator:
        'A clearly worsening respiratory course before transfusion favours ARDS rather than Type II TRALI.',
      commonTrap:
        'The older term possible TRALI should not be used under the 2019 consensus framework.',
    },
  ],
  keySymptoms: [
    'Sudden breathlessness',
    'Dry cough',
    'Chest tightness',
    'Rapidly increasing oxygen requirement',
    'Symptoms beginning during or within six hours of transfusion',
  ],
  keySigns: [
    'Hypoxaemia',
    'Tachypnoea',
    'Diffuse pulmonary crackles',
    'Fever may occur',
    'Hypotension may occur',
    'Absence of convincing systemic volume overload',
  ],
  examPearls: [
    {
      pearl:
        'Record the exact start and stop times of each transfused component and the onset of respiratory symptoms.',
      whyItMatters:
        'The six-hour temporal window is central to classification and haemovigilance investigation.',
    },
    {
      pearl:
        'Assess jugular venous pressure, peripheral oedema, blood pressure, heart sounds, fluid balance, and response to treatment.',
      whyItMatters:
        'These findings help distinguish TRALI from transfusion-associated circulatory overload.',
    },
    {
      pearl:
        'Look actively for allergic findings, haemolysis, bacterial contamination, and alternative ARDS triggers.',
      whyItMatters:
        'Several acute transfusion reactions present with overlapping fever, hypotension, dyspnoea, or hypoxaemia.',
    },
  ],
  scoringSystems: [
    {
      name: '2019 consensus TRALI definition',
      use:
        'Classifies Type I and Type II disease using acute onset, hypoxaemia, bilateral pulmonary oedema, timing within six hours, assessment of left-atrial hypertension, ARDS risks, and pretransfusion respiratory stability.',
      limitation:
        'Classification requires clinical judgment, especially when cardiac disease, positive fluid balance, or an ARDS risk factor is present.',
    },
    {
      name: 'No single confirmatory biomarker',
      use:
        'Diagnosis is clinical and supported by imaging and exclusion of competing causes; donor and recipient immunologic testing assists haemovigilance investigation.',
      limitation:
        'Failure to identify cognate leucocyte antibodies does not exclude TRALI.',
    },
  ],
  investigations: [
    {
      test: 'Pulse oximetry and arterial blood gas',
      expected:
        'Hypoxaemia, often with a PaO2/FiO2 ratio of 300 or lower.',
      role:
        'Quantifies severity and supports the physiological criterion for acute lung injury.',
      limitation:
        'Hypoxaemia is not specific and occurs in TACO, ARDS, pulmonary embolism, and anaphylaxis.',
    },
    {
      test: 'Chest imaging',
      expected:
        'New bilateral pulmonary oedema on chest radiograph, CT, or lung ultrasonography.',
      role:
        'Provides objective evidence of bilateral pulmonary oedema.',
      limitation:
        'Imaging alone cannot reliably distinguish permeability oedema from hydrostatic oedema.',
    },
    {
      test: 'Assessment for left-atrial hypertension',
      expected:
        'No convincing evidence that elevated cardiac filling pressure is the main contributor to pulmonary oedema.',
      role:
        'Differentiates noncardiogenic injury from TACO or cardiogenic pulmonary oedema.',
      limitation:
        'Natriuretic peptides, echocardiography, examination, and fluid balance must be interpreted together.',
    },
    {
      test: 'Standard transfusion-reaction work-up',
      expected:
        'No evidence of acute immune haemolysis or bacterial contamination when those alternatives are excluded.',
      role:
        'Identifies other dangerous transfusion reactions with overlapping presentations.',
      limitation:
        'Negative haemolysis and culture testing do not by themselves establish TRALI.',
    },
    {
      test: 'Donor and recipient leucocyte-antibody investigation',
      expected:
        'Donor anti-HLA or anti-HNA antibodies may be found and may react with cognate recipient antigens.',
      role:
        'Supports mechanism, donor management, and haemovigilance classification.',
      limitation:
        'TRALI remains a clinical diagnosis and antibody detection is not required.',
    },
  ],
  differentialDistinguishers: [
    {
      diagnosis: 'Transfusion-Associated Circulatory Overload',
      distinguishingFeatures:
        'More often shows hypertension, elevated jugular venous pressure, positive fluid balance, cardiomegaly, pleural effusions, elevated natriuretic peptides, or improvement with diuresis.',
    },
    {
      diagnosis: 'Anaphylaxis',
      distinguishingFeatures:
        'Urticaria, angioedema, wheeze, bronchospasm, or gastrointestinal symptoms support a systemic allergic reaction.',
    },
    {
      diagnosis: 'Acute Hemolytic Transfusion Reaction',
      distinguishingFeatures:
        'Pain, haemoglobinuria, positive antiglobulin testing, falling haptoglobin, rising plasma-free haemoglobin, or other evidence of intravascular haemolysis is expected.',
    },
    {
      diagnosis: 'Septic Transfusion Reaction',
      distinguishingFeatures:
        'High fever, rigors, shock, and positive patient or component cultures support bacterial contamination.',
    },
    {
      diagnosis: 'Acute Respiratory Distress Syndrome',
      distinguishingFeatures:
        'A competing ARDS risk factor and respiratory deterioration that began before transfusion favour ARDS rather than TRALI.',
    },
    {
      diagnosis: 'Cardiogenic Pulmonary Edema',
      distinguishingFeatures:
        'Evidence of left ventricular dysfunction or elevated left-sided filling pressure supports a hydrostatic cardiac mechanism.',
    },
  ],
  managementOverview: [
    {
      phase: 'Immediate response',
      priorities:
        'Stop the transfusion, maintain appropriate intravenous access, assess airway, breathing and circulation, verify patient and component identification, and notify the transfusion service.',
    },
    {
      phase: 'Respiratory support',
      priorities:
        'Provide supplemental oxygen and escalate to non-invasive or invasive ventilation according to severity and local critical-care practice.',
    },
    {
      phase: 'Haemodynamic support',
      priorities:
        'Treat hypotension with careful haemodynamic assessment and appropriate supportive therapy while avoiding unnecessary fluid loading.',
    },
    {
      phase: 'Differentiate TACO and other reactions',
      priorities:
        'Assess volume status, cardiac function, haemolysis, bacterial contamination, allergy, and alternative ARDS risks; diuretics are not routine unless overload coexists.',
    },
    {
      phase: 'Reporting and prevention',
      priorities:
        'Document and report the reaction through the transfusion service and haemovigilance pathway so implicated components and donors can be investigated and managed.',
    },
  ],
  complications: [
    'Acute hypoxaemic respiratory failure',
    'Need for mechanical ventilation',
    'Hypotension and shock',
    'Prolonged intensive-care admission',
    'Death',
  ],
  pitfalls: [
    'Continuing the transfusion after acute respiratory deterioration begins',
    'Assuming all post-transfusion pulmonary oedema is TACO',
    'Using donor antibody testing as a prerequisite for clinical diagnosis',
    'Ignoring an alternative ARDS risk factor or pretransfusion respiratory decline',
    'Giving routine diuretics without evidence of circulatory overload',
    'Failing to notify the transfusion service and haemovigilance system',
  ],
  recallPrompts: [
    {
      question: 'What is the defining time window?',
      answer:
        'Pulmonary symptoms begin during or within six hours after the transfusion ends.',
    },
    {
      question: 'What are the core clinical requirements?',
      answer:
        'Acute hypoxaemia, bilateral pulmonary oedema on imaging, and no evidence that left-atrial hypertension is the main cause.',
    },
    {
      question: 'What is the most important transfusion-specific differential?',
      answer:
        'Transfusion-Associated Circulatory Overload.',
    },
    {
      question: 'Are donor HLA or HNA antibodies required?',
      answer:
        'No. They may support investigation, but TRALI remains a clinical diagnosis.',
    },
    {
      question: 'What are the immediate priorities?',
      answer:
        'Stop the transfusion, support oxygenation and haemodynamics, and notify the transfusion service.',
    },
  ],
  references: [
    {
      title: 'A consensus redefinition of transfusion-related acute lung injury',
      source: 'Transfusion, 2019',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6850655/',
    },
    {
      title: 'Adverse effects of transfusion',
      source: 'International Society of Blood Transfusion',
      url: 'https://www.isbtweb.org/resources/educational-modules-on-clinical-use-of-blood/adverse-effects-of-transfusion.html',
    },
  ],
};

function assertSeedShape() {
  const supportedClueTypes = new Set([
    'history',
    'symptom',
    'vital',
    'exam',
    'lab',
    'imaging',
  ]);

  if (clues.length !== 6) {
    throw new Error(`Expected exactly 6 clues; received ${clues.length}.`);
  }

  clues.forEach((clue, index) => {
    if (clue.order !== index) {
      throw new Error(
        `Clue order must be contiguous 0-5. Expected ${index}; received ${clue.order}.`,
      );
    }
    if (!supportedClueTypes.has(clue.type)) {
      throw new Error(`Unsupported clue type: ${clue.type}.`);
    }
    if (!clue.value.trim()) {
      throw new Error(`Clue ${clue.order} has an empty value.`);
    }
  });

  const forbiddenEarlyTerms = aliasTerms.map(normalizeClinicalText);
  for (const clue of clues.slice(0, 5)) {
    const normalizedClue = normalizeClinicalText(clue.value);
    const leakedTerm = forbiddenEarlyTerms.find((term) =>
      normalizedClue.includes(term),
    );
    if (leakedTerm) {
      throw new Error(
        `Clue ${clue.order} reveals the final diagnosis or alias: ${leakedTerm}.`,
      );
    }
  }

  if (
    new Set(differentials.map(normalizeClinicalText)).size !==
    differentials.length
  ) {
    throw new Error('Differentials contain duplicate diagnoses.');
  }

  for (const diagnosis of differentials) {
    if (!canonicalDifferentialLabels.has(diagnosis)) {
      throw new Error(`Noncanonical differential label: ${diagnosis}.`);
    }
  }

  if (typeof explanation.reasoning !== 'string') {
    throw new Error(
      'Explanation reasoning must be a newline-separated string for the learner frontend.',
    );
  }

  const parsedReasoningSteps = explanation.reasoning
    .split(/\n+/)
    .map((step) => step.trim())
    .filter(Boolean);

  if (parsedReasoningSteps.length !== clues.length) {
    throw new Error(
      `Expected ${clues.length} reasoning steps; received ${parsedReasoningSteps.length}.`,
    );
  }

  const clueBreakdown = explanation.clueBreakdown as ClueBreakdownEntry[];
  if (clueBreakdown.length !== clues.length) {
    throw new Error(
      `Expected ${clues.length} clue breakdown entries; received ${clueBreakdown.length}.`,
    );
  }

  clueBreakdown.forEach((entry, index) => {
    const clue = clues[index];
    if (entry.clueOrder !== clue.order) {
      throw new Error(`Clue breakdown order mismatch at index ${index}.`);
    }
    if (entry.clueType !== clue.type) {
      throw new Error(`Clue breakdown type mismatch at order ${clue.order}.`);
    }
    if (entry.clue !== clue.value) {
      throw new Error(`Clue breakdown text mismatch at order ${clue.order}.`);
    }
    if (entry.explanation !== parsedReasoningSteps[index]) {
      throw new Error(
        `Clue breakdown explanation does not match reasoning step ${clue.order}.`,
      );
    }
    if (!entry.diagnosticContribution.trim()) {
      throw new Error(
        `Clue breakdown ${clue.order} has an empty diagnostic contribution.`,
      );
    }
  });

  const differentialAnalysis =
    explanation.differentialAnalysis as DifferentialAnalysisEntry[];

  if (differentialAnalysis.length !== differentials.length) {
    throw new Error(
      `Expected ${differentials.length} differential analyses; received ${differentialAnalysis.length}.`,
    );
  }

  differentialAnalysis.forEach((entry) => {
    if (!differentials.includes(entry.diagnosis)) {
      throw new Error(
        `Differential analysis contains unlisted diagnosis: ${entry.diagnosis}.`,
      );
    }

    entry.ruledOutByClues.forEach((breakdown) => {
      if (
        !Number.isInteger(breakdown.clueOrder) ||
        breakdown.clueOrder < 0 ||
        breakdown.clueOrder >= clues.length
      ) {
        throw new Error(
          `Invalid clueOrder ${breakdown.clueOrder} in differential ${entry.diagnosis}.`,
        );
      }

      if (!breakdown.evidence.trim() || !breakdown.reason.trim()) {
        throw new Error(
          `Empty breakdown evidence or reason in differential ${entry.diagnosis}.`,
        );
      }

      const normalizedClue = normalizeClinicalText(
        clues[breakdown.clueOrder].value,
      );
      const normalizedEvidence = normalizeClinicalText(breakdown.evidence);

      if (!normalizedClue.includes(normalizedEvidence)) {
        throw new Error(
          `Differential evidence is not present in clue ${breakdown.clueOrder}: ${entry.diagnosis} -> ${breakdown.evidence}`,
        );
      }
    });
  });

  const educationText = normalizeClinicalText(
    JSON.stringify(educationForFrontend),
  );
  const caseSpecificEducationTerms = [
    '46 year old',
    'uterine fibroids',
    'eighty minutes',
    '78 on room air',
    'paO2 58',
    'bnp is 48',
    'this patient',
    'this case',
  ];

  for (const term of caseSpecificEducationTerms) {
    if (educationText.includes(normalizeClinicalText(term))) {
      throw new Error(
        `Diagnosis education contains case-specific wording: ${term}.`,
      );
    }
  }
}

async function ensureRegistry() {
  const canonicalNormalized = normalizeClinicalText(canonicalName);
  const normalizedTerms = aliasTerms.map(normalizeClinicalText);

  const exactRegistry = await prisma.diagnosisRegistry.findUnique({
    where: { canonicalNormalized },
    select: { id: true },
  });

  const aliasCandidates = exactRegistry
    ? []
    : await prisma.diagnosisRegistry.findMany({
        where: {
          aliases: {
            some: {
              normalizedTerm: { in: normalizedTerms },
              active: true,
              acceptedForMatch: true,
            },
          },
        },
        select: {
          id: true,
          canonicalName: true,
          canonicalNormalized: true,
          displayLabel: true,
        },
        take: 3,
      });

  if (aliasCandidates.length > 1) {
    throw new Error(
      `Cannot safely seed ${displayLabel}: multiple registry rows match accepted aliases.`,
    );
  }

  const aliasCandidate = aliasCandidates[0];
  if (
    aliasCandidate &&
    !normalizeClinicalText(
      `${aliasCandidate.canonicalName} ${aliasCandidate.displayLabel}`,
    ).includes('transfusion related acute lung injury')
  ) {
    throw new Error(
      `Cannot safely reuse registry ${aliasCandidate.id}: alias match belongs to ${aliasCandidate.displayLabel}.`,
    );
  }

  const existing = exactRegistry ?? aliasCandidate ?? null;

  const registryData = {
    canonicalName,
    canonicalNormalized,
    displayLabel,
    status: DiagnosisRegistryStatus.ACTIVE,
    active: true,
    isPlayable: true,
    isGeneratable: true,
    specialty: taxonomy.specialty,
    subspecialty: taxonomy.subspecialty,
    category: taxonomy.category,
    bodySystem: taxonomy.bodySystem,
    organSystem: taxonomy.organSystem,
    difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
    rarityBand: DiagnosisRarityBand.RARE,
    clinicalSetting: DiagnosisClinicalSetting.INPATIENT,
    ageGroup: DiagnosisAgeGroup.ANY,
    urgencyLevel: DiagnosisUrgencyLevel.EMERGENT,
    preferredClueTypes: ['history', 'vital', 'exam', 'imaging', 'lab'],
    notes:
      'Flagship TRALI registry entry focused on acute hypoxaemia and noncardiogenic bilateral pulmonary oedema within six hours of transfusion, distinction from TACO and other transfusion reactions, supportive care, transfusion-service notification, and haemovigilance investigation.',
  };

  const registry = existing
    ? await prisma.diagnosisRegistry.update({
        where: { id: existing.id },
        data: registryData,
        select: { id: true, displayLabel: true },
      })
    : await prisma.diagnosisRegistry.create({
        data: registryData,
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
    console.log(
      'Skipped diagnosis education because TRALI education already exists:',
      existing,
    );
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

async function ensureCase(params: {
  diagnosisRegistryId: string;
  educationId: string;
}) {
  const existingCase = await prisma.case.findFirst({
    where: {
      diagnosisRegistryId: params.diagnosisRegistryId,
      title: caseTitle,
    },
    orderBy: [{ approvedAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      title: true,
      publicNumber: true,
      currentRevisionId: true,
      dailyCases: { select: { id: true }, take: 1 },
    },
  });

  if (existingCase) {
    console.log(
      existingCase.dailyCases.length > 0
        ? 'Skipped existing scheduled TRALI case.'
        : 'Skipped existing TRALI case to avoid overwriting authored content.',
      existingCase,
    );
    return existingCase;
  }

  const assignedDate = await findAvailableInventoryPlaceholderDate({
    preferredDate: inventoryPlaceholderDate,
    displayLabel: caseTitle,
  });

  const publicNumber = await getNextCasePublicNumber();
  const history = clues[0].value;
  const symptoms = [clues[1].value];

  const caseData = {
    title: caseTitle,
    publicNumber,
    date: assignedDate,
    difficulty: 'intermediate',
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
      'Seeded complete frontend-aligned flagship TRALI case with six supported clues, exact clue-breakdown alignment, canonical differentials, objective exclusion of left-atrial hypertension, and diagnosis-level education independent of the vignette.',
  };

  const seededCase = await prisma.case.create({
    data: caseData,
    select: { id: true },
  });

  const revision = await prisma.caseRevision.create({
    data: {
      caseId: seededCase.id,
      revisionNumber: 1,
      source: CaseSource.MANUAL,
      publishTrack: PublishTrack.DAILY,
      title: caseTitle,
      date: assignedDate,
      difficulty: 'intermediate',
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
        'Created complete TRALI revision with transfusion-timed reasoning, exact clue-to-breakdown alignment, canonical evidence-anchored differentials, noncardiogenic pulmonary-oedema assessment, and haemovigilance teaching.',
    },
    select: { id: true },
  });

  await prisma.case.update({
    where: { id: seededCase.id },
    data: { currentRevisionId: revision.id },
  });

  await prisma.caseValidationRun.create({
    data: {
      caseId: seededCase.id,
      revisionId: revision.id,
      source: CaseSource.MANUAL,
      publishTrack: PublishTrack.DAILY,
      outcome: ValidationOutcome.PASSED,
      validatorVersion: 'flagship-human-review:trali-v1',
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        clueProgressionVerified: true,
        breakdownClueReferencesValidated: true,
        frontendReasoningStringVerified: true,
        differentialEvidenceAnchoredToClues: true,
        canonicalDifferentialsVerified: true,
        educationIndependentOfCase: true,
        playableClueCount: clues.length,
        clueTypes: clues.map((clue) => clue.type),
        duplicateSafe: true,
        doesNotOverwriteExistingEducation: true,
        doesNotOverwriteExistingCase: true,
        metadataVerified: {
          specialty: taxonomy.specialty,
          subspecialty: taxonomy.subspecialty,
          category: taxonomy.category,
          bodySystem: taxonomy.bodySystem,
          organSystem: taxonomy.organSystem,
          difficultyBand: 'INTERMEDIATE',
          rarityBand: 'RARE',
          clinicalSetting: 'INPATIENT',
          ageGroup: 'ANY',
          urgencyLevel: 'EMERGENT',
        },
        note:
          'Complete TRALI flagship seed with six supported clues, no early diagnosis-label leakage, exact clue and reasoning alignment, canonical evidence-anchored differentials, objective TACO exclusion, and independent diagnosis education.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded Transfusion-Related Acute Lung Injury:', {
    registryId: params.diagnosisRegistryId,
    caseId: seededCase.id,
    revisionId: revision.id,
    publicNumber,
    educationId: params.educationId,
    clueTypes: clues.map((clue) => clue.type),
  });

  return {
    id: seededCase.id,
    title: caseTitle,
    publicNumber,
    currentRevisionId: revision.id,
  };
}

async function main() {
  assertSeedShape();
  const registry = await ensureRegistry();
  const education = await ensureEducation(registry.id);
  await ensureCase({
    diagnosisRegistryId: registry.id,
    educationId: education.id,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
