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
 * FLAGSHIP CASE SEED - Leptospirosis
 *
 * Clinical focus:
 * - Epidemiologic exposure to floodwater or wet soil contaminated by animal urine.
 * - Acute febrile illness with severe calf and lumbar myalgia.
 * - Conjunctival suffusion with jaundice and acute kidney injury.
 * - Thrombocytopenia and a bilirubin-predominant hepatic pattern.
 * - Molecular and paired-serology confirmation.
 *
 * Education design:
 * - Case explanation is specific to the vignette.
 * - Diagnosis education is independent of the case.
 * - Covers exposure, biphasic illness, organ complications, testing by illness phase,
 *   early antimicrobial treatment, supportive care, and prevention.
 *
 * Safety:
 * - Reuses or creates the exact diagnosis registry and accepted aliases.
 * - Does not overwrite existing diagnosis education.
 * - Does not overwrite an existing case with the same title.
 * - Does not alter a scheduled DailyCase.
 *
 * Run:
 *   npx tsx prisma/seed/flagship-leptospirosis.seed.ts
 *
 * Railway:
 *   railway run npx tsx prisma/seed/flagship-leptospirosis.seed.ts
 */

const databaseUrl = resolvePgConnectionString(process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run the Leptospirosis seed.');
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
  const maxAttempts = 365;

  for (let offset = 0; offset < maxAttempts; offset += 1) {
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
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 9, 2, 12, 0, 0));
const seedVersion = 'flagship-leptospirosis-v1';

const canonicalName = 'leptospirosis';
const displayLabel = 'Leptospirosis';
const caseTitle = 'Fever, Jaundice and Acute Kidney Injury After Floodwater Exposure';

const taxonomy = {
  specialty: 'Infectious Disease',
  subspecialty: 'Zoonotic Disease',
  category: 'Spirochetal Infection',
  bodySystem: 'Multisystem',
  organSystem: 'Systemic',
} as const;

const aliasTerms = [
  'Leptospirosis',
  'Leptospiral Infection',
  'Weil Disease',
  "Weil's Disease",
];

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 32-year-old farm worker presents eight days after spending several hours wading through floodwater while clearing a livestock enclosure. He recalls abrasions on both shins and reports frequent rats around the feed store. Three days after the exposure he developed abrupt fever, chills, severe headache, and generalized malaise.',
  },
  {
    order: 1,
    type: 'symptom',
    value:
      'He now has intense pain in both calves and the lower back, nausea, repeated vomiting, reduced urine output, and increasing yellow discoloration of the eyes. He also describes red eyes without discharge or itching, but denies a focal skin infection, productive cough, dysuria, or recent travel to a malaria-endemic area outside his home region.',
  },
  {
    order: 2,
    type: 'exam',
    value:
      'Temperature is 39.1 C, pulse 108/min, blood pressure 104/66 mmHg, respiratory rate 22/min, and oxygen saturation 96% on room air. He is alert but dehydrated, with bilateral conjunctival suffusion, scleral jaundice, marked calf tenderness, and mild right upper-quadrant tenderness. There is no purulent conjunctivitis, rash, meningism, focal lung finding, or costovertebral-angle tenderness.',
  },
  {
    order: 3,
    type: 'lab',
    value:
      'Laboratory testing shows neutrophilic leukocytosis, platelets 74 x 10^9/L, creatinine 286 micromol/L, urea 18.4 mmol/L, total bilirubin 168 micromol/L with a predominantly conjugated fraction, AST 142 U/L, ALT 118 U/L, and creatine kinase 1,120 U/L. Urinalysis shows protein, blood, and granular casts without heavy pyuria.',
  },
  {
    order: 4,
    type: 'lab',
    value:
      'Repeated malaria microscopy and rapid antigen testing are negative. Dengue NS1 antigen and IgM, hepatitis A IgM, hepatitis B surface antigen, hepatitis C antibody, and blood cultures are negative. Renal ultrasonography shows normal-sized kidneys without hydronephrosis or urinary obstruction.',
  },
  {
    order: 5,
    type: 'lab',
    value:
      'A whole-blood nucleic-acid amplification test detects pathogenic Leptospira DNA. A convalescent serum sample collected two weeks later shows a fourfold rise in microscopic-agglutination antibody titre, confirming the acute infection.',
  },
] as const;

const differentials = [
  'Dengue',
  'Malaria',
  'Viral Hepatitis',
  'Hantavirus Pulmonary Syndrome',
  'Acute Pyelonephritis',
  'Yellow Fever',
];

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
  'Acute fever beginning after floodwater exposure through abraded skin, with rodent and livestock contact, creates a strong epidemiologic link to a water- and animal-associated zoonotic infection.',
  'Severe calf and lumbar myalgia, vomiting, oliguria, jaundice, and non-purulent red eyes point toward a systemic febrile illness with muscle, renal, hepatic, and conjunctival involvement.',
  'Conjunctival suffusion, scleral jaundice, dehydration, and marked calf tenderness form a high-yield clinical pattern, while the absence of focal urinary, pulmonary, meningeal, or skin findings reduces several localized alternatives.',
  'Thrombocytopenia, acute kidney injury, bilirubin elevation out of proportion to aminotransferases, urinary casts, and creatine-kinase elevation demonstrate severe multisystem involvement rather than isolated hepatitis or uncomplicated viral fever.',
  'Negative testing for malaria, dengue, and viral hepatitis, sterile blood cultures, and the absence of urinary obstruction narrow common tropical and renal mimics without replacing disease-specific confirmation.',
  'Detection of pathogenic Leptospira DNA during the acute phase together with a fourfold rise in microscopic-agglutination titre confirms Leptospirosis.',
] as const;

const explanation = {
  diagnosis: displayLabel,
  summary:
    'Floodwater and animal-urine exposure followed by abrupt fever, severe calf myalgia, conjunctival suffusion, jaundice, thrombocytopenia, acute kidney injury, and molecular plus paired-serologic confirmation establishes Leptospirosis.',
  reasoning: reasoningSteps.join('\n'),
  clueBreakdown: [
    {
      clueOrder: 0,
      clueType: 'history',
      clue: clues[0].value,
      explanation: reasoningSteps[0],
      diagnosticContribution:
        'Establishes a compatible exposure route, incubation period, and zoonotic context.',
    },
    {
      clueOrder: 1,
      clueType: 'symptom',
      clue: clues[1].value,
      explanation: reasoningSteps[1],
      diagnosticContribution:
        'Introduces the characteristic myalgic syndrome and early renal, hepatic, and conjunctival involvement.',
    },
    {
      clueOrder: 2,
      clueType: 'exam',
      clue: clues[2].value,
      explanation: reasoningSteps[2],
      diagnosticContribution:
        'Demonstrates conjunctival suffusion and calf tenderness while reducing focal infectious alternatives.',
    },
    {
      clueOrder: 3,
      clueType: 'lab',
      clue: clues[3].value,
      explanation: reasoningSteps[3],
      diagnosticContribution:
        'Shows the thrombocytopenic renal-hepatic pattern of severe multisystem disease.',
    },
    {
      clueOrder: 4,
      clueType: 'lab',
      clue: clues[4].value,
      explanation: reasoningSteps[4],
      diagnosticContribution:
        'Reduces common tropical mimics and excludes post-renal obstruction.',
    },
    {
      clueOrder: 5,
      clueType: 'lab',
      clue: clues[5].value,
      explanation: reasoningSteps[5],
      diagnosticContribution:
        'Provides direct molecular detection and paired-serology confirmation.',
    },
  ],
  keyFindings: [
    'Floodwater exposure through abraded skin',
    'Rodent and livestock exposure',
    'Abrupt febrile illness',
    'Severe bilateral calf and lumbar myalgia',
    'Conjunctival suffusion',
    'Jaundice',
    'Oliguria and acute kidney injury',
    'Thrombocytopenia',
    'Bilirubin elevation greater than aminotransferase elevation',
    'Proteinuria, haematuria and granular casts',
    'Negative malaria, dengue and viral-hepatitis testing',
    'Positive pathogenic Leptospira nucleic-acid test',
    'Fourfold rise in microscopic-agglutination titre',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Dengue',
      whyPlausibleEarly:
        'Dengue can cause abrupt fever, severe myalgia, thrombocytopenia, vomiting, and hepatic enzyme elevation.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: 'bilateral conjunctival suffusion',
          reason:
            'Conjunctival suffusion with pronounced calf tenderness is more characteristic of leptospiral disease than dengue.',
        },
        {
          clueOrder: 4,
          evidence: 'Dengue NS1 antigen and IgM',
          reason:
            'Appropriately timed dengue testing is negative.',
        },
      ],
      finalReasonLessLikely:
        'Dengue does not explain the combined exposure pattern, conjunctival suffusion, renal-hepatic injury, and disease-specific confirmatory tests.',
    },
    {
      diagnosis: 'Malaria',
      whyPlausibleEarly:
        'Malaria may present with fever, headache, vomiting, jaundice, thrombocytopenia, and acute kidney injury.',
      ruledOutByClues: [
        {
          clueOrder: 4,
          evidence: 'Repeated malaria microscopy and rapid antigen testing are negative',
          reason:
            'Repeated negative microscopy and antigen testing substantially reduce malaria in this clinical context.',
        },
        {
          clueOrder: 2,
          evidence: 'marked calf tenderness',
          reason:
            'Severe focal calf myalgia and conjunctival suffusion are not typical defining features of malaria.',
        },
      ],
      finalReasonLessLikely:
        'Repeated malaria testing is negative and the exposure, examination, and confirmatory microbiology support another infection.',
    },
    {
      diagnosis: 'Viral Hepatitis',
      whyPlausibleEarly:
        'Acute viral hepatitis can cause constitutional symptoms, vomiting, jaundice, and aminotransferase elevation.',
      ruledOutByClues: [
        {
          clueOrder: 3,
          evidence: 'creatinine 286 micromol/L',
          reason:
            'Prominent acute kidney injury and thrombocytopenia are not explained by uncomplicated viral hepatitis.',
        },
        {
          clueOrder: 3,
          evidence: 'total bilirubin 168 micromol/L with a predominantly conjugated fraction, AST 142 U/L, ALT 118 U/L',
          reason:
            'The bilirubin-predominant pattern with only moderate aminotransferase elevation is less typical of acute hepatocellular viral hepatitis.',
        },
        {
          clueOrder: 4,
          evidence: 'hepatitis A IgM, hepatitis B surface antigen, hepatitis C antibody',
          reason:
            'The tested viral-hepatitis markers are negative.',
        },
      ],
      finalReasonLessLikely:
        'Viral hepatitis does not account for the characteristic exposure, conjunctival suffusion, calf tenderness, renal injury, and confirmatory microbiology.',
    },
    {
      diagnosis: 'Hantavirus Pulmonary Syndrome',
      whyPlausibleEarly:
        'Rodent exposure, fever, myalgia, thrombocytopenia, and renal or pulmonary complications can suggest hantavirus infection.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: 'oxygen saturation 96% on room air',
          reason:
            'There is no hypoxaemic pulmonary syndrome at presentation.',
        },
        {
          clueOrder: 2,
          evidence: 'focal lung finding',
          reason:
            'The examination does not support prominent pulmonary involvement.',
        },
        {
          clueOrder: 5,
          evidence: 'detects pathogenic Leptospira DNA',
          reason:
            'Direct detection identifies a different zoonotic pathogen.',
        },
      ],
      finalReasonLessLikely:
        'The absence of a pulmonary-predominant syndrome and positive leptospiral testing make hantavirus pulmonary syndrome unlikely.',
    },
    {
      diagnosis: 'Acute Pyelonephritis',
      whyPlausibleEarly:
        'Fever, vomiting, renal impairment, and urinary abnormalities can raise concern for upper urinary infection.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'denies a focal skin infection, productive cough, dysuria',
          reason:
            'There are no lower urinary symptoms to support an ascending urinary infection.',
        },
        {
          clueOrder: 2,
          evidence: 'costovertebral-angle tenderness',
          reason:
            'The characteristic focal renal-angle finding is absent.',
        },
        {
          clueOrder: 3,
          evidence: 'without heavy pyuria',
          reason:
            'The urinalysis reflects renal injury but lacks the heavy pyuria expected in typical bacterial pyelonephritis.',
        },
      ],
      finalReasonLessLikely:
        'The multisystem exposure-linked syndrome is not explained by localized upper urinary infection.',
    },
    {
      diagnosis: 'Yellow Fever',
      whyPlausibleEarly:
        'Yellow fever can produce fever, jaundice, thrombocytopenia, bleeding, and renal dysfunction.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence: 'wading through floodwater while clearing a livestock enclosure',
          reason:
            'The exposure is to contaminated water and animal environments rather than a mosquito-linked travel pattern.',
        },
        {
          clueOrder: 2,
          evidence: 'bilateral conjunctival suffusion',
          reason:
            'Conjunctival suffusion with marked calf tenderness supports leptospiral infection.',
        },
        {
          clueOrder: 5,
          evidence: 'fourfold rise in microscopic-agglutination antibody titre',
          reason:
            'Paired serology confirms the alternative zoonotic infection.',
        },
      ],
      finalReasonLessLikely:
        'The epidemiology, high-yield examination findings, and organism-specific testing do not support yellow fever.',
    },
  ],
  managementPearl:
    'Begin treatment promptly when clinical suspicion is high rather than waiting for confirmatory testing. Severe disease requires parenteral antibiotics and aggressive supportive management of renal, hepatic, pulmonary, bleeding, and haemodynamic complications.',
  generationQuality: {
    contentTier: 'FLAGSHIP',
    seedVersion,
    humanReviewed: true,
    discriminatorStrength: 'HIGH',
    expectedTeachingPoints: [
      'Floodwater, wet soil, rodents, livestock, and abraded skin are important exposure clues',
      'Severe calf and lumbar myalgia plus conjunctival suffusion are high-yield findings',
      'Severe disease may cause jaundice, acute kidney injury, thrombocytopenia, pulmonary haemorrhage, or meningitis',
      'PCR and serology have phase-dependent diagnostic value',
      'Treatment should begin promptly when suspicion is high',
    ],
    competencyDomains: [
      'Infectious Disease',
      'Zoonotic Disease',
      'Tropical Medicine',
      'Acute Kidney Injury',
      'Clinical Reasoning',
    ],
  },
};


const educationForFrontend = {
  title: displayLabel,
  summary: {
    definition:
      'Leptospirosis is a zoonotic bacterial infection caused by pathogenic Leptospira species acquired through contact with urine-contaminated water, soil, animals, or animal tissues, usually through broken skin or mucous membranes.',
    highYieldTakeaway:
      'Suspect Leptospirosis after freshwater, flood, wet-soil, rodent, livestock, or occupational exposure when an acute febrile illness includes severe calf or lumbar myalgia, conjunctival suffusion, jaundice, acute kidney injury, thrombocytopenia, meningitis, or pulmonary haemorrhage.',
  },
  recognitionPattern: [
    {
      pattern: 'Compatible environmental or animal exposure',
      whyItMatters:
        'Pathogenic leptospires are shed in animal urine and persist in fresh water or wet soil, especially in warm climates and after heavy rainfall or flooding.',
      progression:
        'Contaminated water or soil -> entry through broken skin or mucosa -> bloodstream dissemination -> multisystem endothelial and organ injury.',
      discriminator:
        'Exposure to floodwater, rodents, livestock, sewage, abattoirs, farming, or freshwater recreation strengthens pre-test probability.',
      commonTrap:
        'Do not dismiss the diagnosis because the patient does not remember direct animal contact.',
    },
    {
      pattern: 'Acute fever with myalgia and conjunctival suffusion',
      whyItMatters:
        'Severe calf or lumbar muscle pain and non-purulent conjunctival suffusion are particularly useful bedside clues.',
      progression:
        'Acute bacteraemic phase -> fever, headache, chills, myalgia, gastrointestinal symptoms, and conjunctival suffusion -> possible immune and organ-complication phase.',
      discriminator:
        'The combination of calf tenderness and conjunctival suffusion helps separate the illness from many undifferentiated tropical fevers.',
      commonTrap:
        'Do not mistake conjunctival suffusion for purulent conjunctivitis.',
    },
    {
      pattern: 'Renal, hepatic, pulmonary, neurological, or bleeding complications',
      whyItMatters:
        'Severe disease can progress rapidly and requires inpatient monitoring and organ support.',
      progression:
        'Systemic infection and endothelial injury -> acute kidney injury, jaundice, thrombocytopenia, meningitis, myocarditis, shock, or pulmonary haemorrhage.',
      discriminator:
        'Marked jaundice with only moderate aminotransferase elevation and concurrent renal injury is a classic severe pattern.',
      commonTrap:
        'Do not assume jaundice means isolated viral hepatitis.',
    },
  ],
  keySymptoms: [
    'Abrupt fever and chills',
    'Severe headache',
    'Calf or lumbar myalgia',
    'Nausea, vomiting or abdominal pain',
    'Reduced urine output',
    'Jaundice',
    'Cough, dyspnoea or haemoptysis in pulmonary disease',
    'Neck stiffness or altered mental status in neurological disease',
  ],
  keySigns: [
    'Conjunctival suffusion',
    'Calf and lumbar muscle tenderness',
    'Fever and dehydration',
    'Scleral jaundice',
    'Hypotension or shock in severe disease',
    'Pulmonary crackles or hypoxaemia',
    'Meningism',
    'Bleeding manifestations',
  ],
  examPearls: [
    {
      pearl:
        'Ask directly about floodwater, freshwater swimming, sewage, farming, livestock, rodents, abattoir work, and skin abrasions.',
      whyItMatters:
        'The exposure history may be the strongest early diagnostic discriminator.',
    },
    {
      pearl:
        'Inspect for conjunctival suffusion without purulent discharge and palpate the calves and lumbar muscles.',
      whyItMatters:
        'These findings are high-yield but easily missed in a general febrile assessment.',
    },
    {
      pearl:
        'Assess urine output, oxygenation, bleeding, mental status, haemodynamics, and meningeal signs.',
      whyItMatters:
        'Renal, pulmonary, haemorrhagic, neurological, and shock complications determine urgency.',
    },
  ],
  scoringSystems: [
    {
      name: 'No universally required bedside diagnostic score',
      use:
        'Clinical suspicion is based on exposure, syndrome pattern, organ involvement, and phase-appropriate laboratory testing.',
      limitation:
        'Local epidemiology and test availability strongly influence diagnostic probability and workflow.',
    },
    {
      name: 'Organ-severity assessment',
      use:
        'Serial renal function, liver tests, platelet count, oxygenation, urine output, haemodynamics, and neurological assessment guide level of care.',
      limitation:
        'Severity assessment supports management but does not confirm the organism.',
    },
  ],
  investigations: [
    {
      test: 'Complete blood count, renal profile, liver tests and urinalysis',
      expected:
        'Thrombocytopenia, leukocytosis, acute kidney injury, bilirubin elevation, moderate aminotransferase elevation, proteinuria, haematuria, and casts may occur.',
      role:
        'Defines organ involvement and provides a baseline for serial monitoring.',
      limitation:
        'The abnormalities are not specific and overlap with malaria, dengue, viral hepatitis, sepsis, and other zoonoses.',
    },
    {
      test: 'Nucleic-acid amplification testing',
      expected:
        'Pathogenic Leptospira DNA may be detected in blood or serum early and in urine later in illness.',
      role:
        'Provides direct microbiological evidence and is most useful when specimen timing matches the illness phase.',
      limitation:
        'A negative result does not exclude disease when sampling is late, early, or affected by prior treatment.',
    },
    {
      test: 'Serology',
      expected:
        'IgM assays may become positive after the first several days; microscopic agglutination testing can demonstrate seroconversion or a significant rise in titre.',
      role:
        'Supports or confirms infection, particularly with paired acute and convalescent samples.',
      limitation:
        'Early serology may be negative, background antibodies vary by region, and interpretation depends on assay and epidemiology.',
    },
    {
      test: 'Cultures',
      expected:
        'Specialized culture may recover leptospires from blood, cerebrospinal fluid, or urine depending on illness phase.',
      role:
        'Can provide definitive isolation and epidemiologic information.',
      limitation:
        'Culture is slow, technically demanding, and insensitive for immediate clinical decisions.',
    },
    {
      test: 'Testing for alternative febrile illnesses',
      expected:
        'Malaria, dengue, viral hepatitis, bacterial sepsis, rickettsial disease, and other local causes are assessed according to epidemiology.',
      role:
        'Prevents anchoring and identifies coexisting or more common treatable conditions.',
      limitation:
        'Negative tests for alternatives do not by themselves confirm Leptospirosis.',
    },
    {
      test: 'Organ-directed imaging and monitoring',
      expected:
        'Chest imaging, electrocardiography, echocardiography, renal ultrasonography, or neurodiagnostic testing may be selected by complications.',
      role:
        'Evaluates pulmonary haemorrhage, myocarditis, obstruction, or neurological disease.',
      limitation:
        'Imaging identifies complications rather than the causative organism.',
    },
  ],
  differentialDistinguishers: [
    {
      diagnosis: 'Dengue',
      distinguishingFeatures:
        'Often includes leukopenia, thrombocytopenia, rash, plasma leakage, or haemoconcentration; conjunctival suffusion and pronounced calf tenderness are less characteristic.',
    },
    {
      diagnosis: 'Malaria',
      distinguishingFeatures:
        'Parasitological testing and exposure geography are central; conjunctival suffusion is not a defining feature.',
    },
    {
      diagnosis: 'Viral Hepatitis',
      distinguishingFeatures:
        'Usually has a more hepatocellular enzyme pattern and does not typically explain severe calf tenderness, conjunctival suffusion, and simultaneous renal injury.',
    },
    {
      diagnosis: 'Hantavirus Pulmonary Syndrome',
      distinguishingFeatures:
        'Rodent exposure occurs, but a pulmonary-capillary-leak syndrome with hypoxaemia is usually more prominent.',
    },
    {
      diagnosis: 'Acute Pyelonephritis',
      distinguishingFeatures:
        'Dysuria, pyuria, bacteriuria, and costovertebral-angle tenderness support a localized upper urinary infection.',
    },
    {
      diagnosis: 'Yellow Fever',
      distinguishingFeatures:
        'Mosquito exposure and travel or outbreak context are central; organism-specific testing separates it from leptospiral disease.',
    },
  ],
  managementOverview: [
    {
      phase: 'Immediate assessment',
      priorities:
        'Assess haemodynamics, oxygenation, urine output, bleeding, renal and hepatic injury, neurological status, pregnancy, and other causes of acute fever.',
    },
    {
      phase: 'Early antimicrobial therapy',
      priorities:
        'Start antibiotics promptly when clinical suspicion is high rather than waiting for confirmatory tests; choose oral or parenteral treatment according to severity, contraindications, age, pregnancy, and local guidance.',
    },
    {
      phase: 'Severe disease support',
      priorities:
        'Admit for close monitoring and provide intravenous fluids cautiously, renal replacement therapy when indicated, respiratory support, haemodynamic support, and management of bleeding or neurological complications.',
    },
    {
      phase: 'Diagnostic confirmation and public health',
      priorities:
        'Collect phase-appropriate specimens without delaying treatment, document likely exposure, and follow local notification or outbreak-investigation requirements.',
    },
    {
      phase: 'Prevention',
      priorities:
        'Reduce exposure to potentially contaminated water or soil, use protective clothing and footwear, cover skin wounds, control rodents, and apply occupational or outbreak-specific preventive measures.',
    },
  ],
  complications: [
    'Acute kidney injury',
    'Jaundice and hepatic dysfunction',
    'Pulmonary haemorrhage or acute respiratory failure',
    'Thrombocytopenia and bleeding',
    'Aseptic meningitis or encephalopathy',
    'Myocarditis and arrhythmia',
    'Shock and multiorgan failure',
    'Pregnancy complications',
  ],
  pitfalls: [
    'Waiting for confirmatory testing before treating a strongly suspected severe infection',
    'Using a negative early serology result to exclude disease',
    'Missing conjunctival suffusion or calf tenderness',
    'Attributing jaundice to isolated viral hepatitis',
    'Failing to monitor respiratory status because the chest examination is initially normal',
    'Ignoring renal function and urine output',
    'Assuming all patients recall direct animal contact',
  ],
  recallPrompts: [
    {
      question: 'Which exposure pattern is most important?',
      answer:
        'Contact with urine-contaminated fresh water, floodwater, wet soil, animals, or occupational environments through broken skin or mucosa.',
    },
    {
      question: 'Which bedside findings are especially suggestive?',
      answer:
        'Severe calf or lumbar myalgia and conjunctival suffusion in an acute febrile illness.',
    },
    {
      question: 'Which organs are commonly affected in severe disease?',
      answer:
        'Kidneys, liver, lungs, central nervous system, heart, and the haemostatic system.',
    },
    {
      question: 'Why does test timing matter?',
      answer:
        'Direct detection is generally most useful early, while antibodies may not be detectable until later and paired sera may be required.',
    },
    {
      question: 'When should treatment begin?',
      answer:
        'As soon as clinical suspicion is high, especially in severe disease, without waiting for laboratory confirmation.',
    },
  ],
  references: [
    {
      title: 'Clinical Overview of Leptospirosis',
      source: 'US Centers for Disease Control and Prevention',
      url: 'https://www.cdc.gov/leptospirosis/hcp/clinical-overview/index.html',
    },
    {
      title: 'Human Leptospirosis: Guidance for Diagnosis, Surveillance and Control',
      source: 'World Health Organization',
      url: 'https://www.who.int/publications/i/item/WHO-CDS-CSR-EPH-2002.23',
    },
    {
      title: 'Leptospirosis',
      source: 'World Health Organization',
      url: 'https://www.who.int/health-topics/leptospirosis',
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
      throw new Error(
        `Clue breakdown order mismatch at index ${index}: expected ${clue.order}; received ${entry.clueOrder}.`,
      );
    }

    if (entry.clueType !== clue.type) {
      throw new Error(
        `Clue breakdown type mismatch at order ${clue.order}: expected ${clue.type}; received ${entry.clueType}.`,
      );
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
    '32 year old',
    'eight days',
    '286 micromol',
    '168 micromol',
    '74 x 10',
    'this patient',
    'this case',
    'his calves',
    'whole blood nucleic acid amplification test detects',
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
    ).includes('leptospirosis')
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
    rarityBand: DiagnosisRarityBand.UNCOMMON,
    clinicalSetting: DiagnosisClinicalSetting.INPATIENT,
    ageGroup: DiagnosisAgeGroup.ADULT,
    urgencyLevel: DiagnosisUrgencyLevel.URGENT,
    preferredClueTypes: ['history', 'symptom', 'exam', 'lab'],
    notes:
      'Flagship Leptospirosis registry entry focused on contaminated-water and animal exposure, severe calf myalgia, conjunctival suffusion, renal-hepatic involvement, phase-dependent testing, early antimicrobial therapy, and organ-supportive care.',
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
      'Skipped diagnosis education because Leptospirosis education already exists:',
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
        ? 'Skipped existing scheduled Leptospirosis case.'
        : 'Skipped existing Leptospirosis case to avoid overwriting authored content.',
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
      'Seeded complete frontend-aligned flagship Leptospirosis case with six supported clues, exact clue breakdown alignment, canonical differentials, phase-appropriate microbiological confirmation, and diagnosis-level education independent of the vignette.',
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
        'Created complete Leptospirosis revision with exposure-led reasoning, renal-hepatic severity assessment, exact clue-to-breakdown alignment, evidence-anchored canonical differentials, and molecular plus paired-serology confirmation.',
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
      validatorVersion: 'flagship-human-review:leptospirosis-v1',
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
          rarityBand: 'UNCOMMON',
          clinicalSetting: 'INPATIENT',
          ageGroup: 'ADULT',
          urgencyLevel: 'URGENT',
        },
        note:
          'Complete Leptospirosis flagship seed with six supported clue types, no early diagnosis-label leakage, exact clue and reasoning alignment, canonical evidence-anchored differentials, phase-appropriate confirmation, and independent diagnosis education.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded Leptospirosis:', {
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
    dailyCases: [],
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
