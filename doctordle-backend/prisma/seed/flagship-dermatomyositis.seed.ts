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
 * FLAGSHIP CASE SEED - Dermatomyositis
 *
 * Clinical focus:
 * - Subacute symmetric proximal muscle weakness.
 * - Characteristic inflammatory skin findings.
 * - Elevated muscle enzymes and irritable myopathy.
 * - MRI evidence of active myositis.
 * - Histopathology and myositis-specific antibody confirmation.
 *
 * Education design:
 * - Case explanation is specific to the vignette.
 * - Diagnosis education is independent of the case.
 * - Covers systemic complications, malignancy assessment, ILD screening,
 *   treatment principles, rehabilitation, and diagnostic pitfalls.
 *
 * Safety:
 * - Reuses or creates the exact diagnosis registry and accepted aliases.
 * - Does not overwrite existing diagnosis education.
 * - Does not overwrite an existing case with the same title.
 * - Does not alter a scheduled DailyCase.
 *
 * Run:
 *   npx tsx prisma/seed/flagship-dermatomyositis.seed.ts
 *
 * Railway:
 *   railway run npx tsx prisma/seed/flagship-dermatomyositis.seed.ts
 */

const databaseUrl = resolvePgConnectionString(process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run the Dermatomyositis seed.');
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
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 8, 16, 12, 0, 0));
const seedVersion = 'flagship-dermatomyositis-v1';

const canonicalName = 'dermatomyositis';
const displayLabel = 'Dermatomyositis';
const caseTitle = 'Progressive Proximal Weakness with a Photosensitive Rash';

const taxonomy = {
  specialty: 'Rheumatology',
  subspecialty: 'Inflammatory Myopathy',
  category: 'Idiopathic Inflammatory Myopathy',
  bodySystem: 'Musculoskeletal',
  organSystem: 'Skeletal Muscle',
} as const;

const aliasTerms = [
  'Dermatomyositis',
  'Adult Dermatomyositis',
  'Idiopathic Dermatomyositis',
  'DM',
];

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 44-year-old woman reports eight weeks of progressive difficulty rising from low chairs, climbing stairs, lifting shopping bags, and keeping her arms raised while arranging her hair. The weakness is symmetric and affects the shoulders and hips more than the hands and feet. She has no numbness, diplopia, fluctuating weakness, recent intense exercise, or family history of muscle disease.',
  },
  {
    order: 1,
    type: 'symptom',
    value:
      'During the same period she has developed a photosensitive violaceous discoloration around the eyelids, an itchy erythematous eruption over the upper chest and shoulders, and rough scaly papules over the knuckles. She also reports mild difficulty swallowing dry food but no oral ulcers, Raynaud phenomenon, new medicines, or prolonged glucocorticoid use.',
  },
  {
    order: 2,
    type: 'exam',
    value:
      'Examination shows a violaceous periorbital eruption with mild oedema, erythematous scaly papules over the metacarpophalangeal and interphalangeal joints, periungual capillary changes, and a shawl-distribution rash over the shoulders. Neck flexion and shoulder and hip-girdle power are 4-/5 bilaterally, while distal power, sensation, coordination, and deep-tendon reflexes are preserved.',
  },
  {
    order: 3,
    type: 'lab',
    value:
      'Creatine kinase is 4,260 U/L and aldolase is elevated. Aspartate and alanine aminotransferases are raised with normal bilirubin and alkaline phosphatase. Urinalysis has no haematuria, thyroid-stimulating hormone and electrolytes are normal, and inflammatory markers are moderately elevated.',
  },
  {
    order: 4,
    type: 'imaging',
    value:
      'MRI of the thighs shows symmetric patchy oedema within the proximal muscle groups without fatty replacement or focal collection. Electromyography demonstrates short-duration, low-amplitude motor-unit potentials with spontaneous fibrillation activity, supporting an active irritable myopathy.',
  },
  {
    order: 5,
    type: 'lab',
    value:
      'A muscle biopsy shows perifascicular fibre atrophy with perivascular and perimysial inflammatory change, while a skin biopsy shows interface dermatitis. Anti-Mi-2 antibodies are positive. The integrated pattern of characteristic cutaneous disease, symmetric proximal inflammatory myopathy, elevated muscle enzymes, supportive MRI and electromyography, and compatible histopathology establishes Dermatomyositis.',
  },
] as const;

const differentials = [
  'Immune-Mediated Necrotizing Myopathy',
  'Inclusion Body Myositis',
  'Antisynthetase Syndrome',
  'Systemic Lupus Erythematosus with Myositis',
  'Hypothyroid Myopathy',
  'Drug-Induced Myopathy',
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
  'Subacute symmetric weakness that preferentially affects shoulder and hip-girdle muscles localizes the problem to skeletal muscle rather than a sensory neuropathy, neuromuscular-junction disorder, or central lesion.',
  'A photosensitive violaceous eyelid eruption, extensor knuckle papules, shawl-distribution rash, and emerging dysphagia connect the muscle syndrome to a characteristic systemic inflammatory process.',
  'Objective proximal and neck-flexor weakness with preserved distal strength, sensation, coordination, and reflexes confirms a myopathic pattern, while the characteristic skin and nailfold findings strongly narrow the inflammatory-myopathy differential.',
  'Marked creatine-kinase and aldolase elevation with muscle-associated aminotransferase elevation supports active muscle injury; normal thyroid and electrolyte testing reduces common metabolic mimics.',
  'Symmetric muscle oedema on MRI and an irritable myopathic electromyographic pattern provide anatomical and physiological evidence of active inflammatory myopathy and help select a biopsy site.',
  'Perifascicular atrophy with perivascular or perimysial inflammation, compatible skin histology, and anti-Mi-2 antibodies in the matching clinical context establishes Dermatomyositis and prompts assessment for systemic complications and associated malignancy.',
] as const;

const explanation = {
  diagnosis: displayLabel,
  summary:
    'Subacute symmetric proximal weakness, characteristic photosensitive skin findings, elevated muscle enzymes, MRI and electromyographic evidence of active myositis, perifascicular muscle pathology, and a compatible myositis-specific antibody profile establish Dermatomyositis.',
  reasoning: reasoningSteps.join('\n'),
  clueBreakdown: [
    {
      clueOrder: 0,
      clueType: 'history',
      clue: clues[0].value,
      explanation: reasoningSteps[0],
      diagnosticContribution:
        'Establishes a subacute proximal myopathic syndrome before the defining skin findings appear.',
    },
    {
      clueOrder: 1,
      clueType: 'symptom',
      clue: clues[1].value,
      explanation: reasoningSteps[1],
      diagnosticContribution:
        'Links the weakness to a photosensitive inflammatory dermatosis and identifies early bulbar involvement.',
    },
    {
      clueOrder: 2,
      clueType: 'exam',
      clue: clues[2].value,
      explanation: reasoningSteps[2],
      diagnosticContribution:
        'Objectively confirms proximal myopathy and demonstrates the high-yield cutaneous and periungual pattern.',
    },
    {
      clueOrder: 3,
      clueType: 'lab',
      clue: clues[3].value,
      explanation: reasoningSteps[3],
      diagnosticContribution:
        'Shows active muscle injury while reducing thyroid, electrolyte, hepatic, and urinary alternatives.',
    },
    {
      clueOrder: 4,
      clueType: 'imaging',
      clue: clues[4].value,
      explanation: reasoningSteps[4],
      diagnosticContribution:
        'Provides supportive imaging and electrodiagnostic evidence of active inflammatory myopathy.',
    },
    {
      clueOrder: 5,
      clueType: 'lab',
      clue: clues[5].value,
      explanation: reasoningSteps[5],
      diagnosticContribution:
        'Integrates pathology and serology with the phenotype to establish the canonical diagnosis.',
    },
  ],
  keyFindings: [
    'Subacute symmetric proximal weakness',
    'Difficulty rising, climbing stairs and performing overhead tasks',
    'Photosensitive violaceous eyelid eruption',
    'Scaly extensor-knuckle papules',
    'Shawl-distribution rash',
    'Periungual capillary changes',
    'Mild dysphagia',
    'Preserved sensation and reflexes',
    'Markedly elevated creatine kinase and aldolase',
    'Symmetric muscle oedema on MRI',
    'Irritable myopathy on electromyography',
    'Perifascicular muscle-fibre atrophy',
    'Compatible interface dermatitis',
    'Positive anti-Mi-2 antibodies',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Immune-Mediated Necrotizing Myopathy',
      whyPlausibleEarly:
        'Immune-mediated necrotizing myopathy can cause severe symmetric proximal weakness and very high muscle enzymes.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: 'violaceous periorbital eruption',
          reason:
            'A characteristic inflammatory skin eruption favours Dermatomyositis over a predominantly muscle-limited necrotizing myopathy.',
        },
        {
          clueOrder: 5,
          evidence: 'perifascicular fibre atrophy',
          reason:
            'Perifascicular atrophy and perivascular or perimysial inflammation are not the typical necrosis-dominant pattern.',
        },
      ],
      finalReasonLessLikely:
        'The defining skin phenotype and perifascicular pathology favour Dermatomyositis.',
    },
    {
      diagnosis: 'Inclusion Body Myositis',
      whyPlausibleEarly:
        'Inclusion body myositis is an inflammatory myopathy that may cause progressive weakness.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence: 'eight weeks',
          reason:
            'Inclusion body myositis usually progresses over years rather than several weeks.',
        },
        {
          clueOrder: 0,
          evidence: 'affects the shoulders and hips more than the hands and feet',
          reason:
            'Inclusion body myositis often disproportionately affects finger flexors and knee extensors.',
        },
        {
          clueOrder: 2,
          evidence: 'shawl-distribution rash',
          reason:
            'A characteristic inflammatory rash is not a feature of inclusion body myositis.',
        },
      ],
      finalReasonLessLikely:
        'The age-independent subacute proximal pattern, characteristic rash, marked enzymes, and perifascicular pathology do not fit inclusion body myositis.',
    },
    {
      diagnosis: 'Antisynthetase Syndrome',
      whyPlausibleEarly:
        'Antisynthetase syndrome can present with inflammatory myopathy and systemic autoimmune features.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'no oral ulcers, Raynaud phenomenon',
          reason:
            'The case lacks several associated connective-tissue features, although their absence alone is not exclusionary.',
        },
        {
          clueOrder: 5,
          evidence: 'Anti-Mi-2 antibodies are positive',
          reason:
            'The serologic and cutaneous pattern favours a classic Dermatomyositis phenotype rather than an antisynthetase-antibody syndrome.',
        },
      ],
      finalReasonLessLikely:
        'No interstitial-lung or mechanic-hand pattern is established, and the anti-Mi-2 phenotype with classic rash is more specific.',
    },
    {
      diagnosis: 'Systemic Lupus Erythematosus with Myositis',
      whyPlausibleEarly:
        'Systemic lupus erythematosus can cause photosensitivity, rash, and inflammatory muscle involvement.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'no oral ulcers, Raynaud phenomenon',
          reason:
            'Typical accompanying lupus features are not present in the history.',
        },
        {
          clueOrder: 2,
          evidence: 'erythematous scaly papules over the metacarpophalangeal and interphalangeal joints',
          reason:
            'The extensor-knuckle papules and heliotrope-type eruption are more characteristic of Dermatomyositis.',
        },
        {
          clueOrder: 5,
          evidence: 'perifascicular fibre atrophy',
          reason:
            'This histopathologic pattern strongly supports Dermatomyositis.',
        },
      ],
      finalReasonLessLikely:
        'The rash morphology, myositis-specific serology, and perifascicular pathology provide a more coherent explanation.',
    },
    {
      diagnosis: 'Hypothyroid Myopathy',
      whyPlausibleEarly:
        'Hypothyroidism can cause proximal weakness and elevated creatine kinase.',
      ruledOutByClues: [
        {
          clueOrder: 3,
          evidence: 'thyroid-stimulating hormone and electrolytes are normal',
          reason:
            'Normal thyroid testing makes hypothyroid myopathy unlikely.',
        },
        {
          clueOrder: 2,
          evidence: 'violaceous periorbital eruption',
          reason:
            'The characteristic inflammatory skin findings are not explained by hypothyroidism.',
        },
      ],
      finalReasonLessLikely:
        'Normal thyroid testing and the defining skin, imaging, antibody, and biopsy findings exclude hypothyroid myopathy.',
    },
    {
      diagnosis: 'Drug-Induced Myopathy',
      whyPlausibleEarly:
        'Several medicines can produce proximal weakness and raised muscle enzymes.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'no oral ulcers, Raynaud phenomenon, new medicines, or prolonged glucocorticoid use',
          reason:
            'There is no relevant medication exposure in the history.',
        },
        {
          clueOrder: 5,
          evidence: 'skin biopsy shows interface dermatitis',
          reason:
            'The combined characteristic skin pathology and perifascicular muscle pathology indicate an autoimmune inflammatory myopathy.',
        },
      ],
      finalReasonLessLikely:
        'No drug trigger is identified, and the integrated phenotype is specific for Dermatomyositis.',
    },
  ] satisfies DifferentialAnalysisEntry[],
  managementPearl:
    'Assess swallowing, respiratory symptoms, interstitial lung disease, cardiac involvement, functional impairment, and malignancy risk at diagnosis. Begin immunosuppressive treatment according to severity and organ involvement, combine it with sun protection and rehabilitation, and escalate urgently for severe dysphagia, respiratory weakness, rapidly progressive lung disease, or major systemic complications.',
  generationQuality: {
    contentTier: 'FLAGSHIP',
    seedVersion,
    humanReviewed: true,
    discriminatorStrength: 'HIGH',
    clueProgressionVerified: true,
    breakdownClueReferencesValidated: true,
    frontendReasoningStringVerified: true,
    educationIndependentOfCase: true,
    expectedTeachingPoints: [
      'Symmetric proximal weakness is the core muscle pattern',
      'Heliotrope-type eruption, Gottron papules, and shawl or V-sign rashes are high-yield skin clues',
      'Creatine kinase may be markedly elevated but can be normal in amyopathic or selected phenotypes',
      'MRI and electromyography support active myositis and can guide biopsy',
      'Perifascicular atrophy is a classic muscle-biopsy clue',
      'Myositis-specific antibodies help define phenotype and complication risk',
      'Interstitial lung disease, dysphagia, cardiac disease, calcinosis, and malignancy require active assessment',
      'Treatment combines immunosuppression, skin protection, rehabilitation, and complication-specific care',
    ],
    competencyDomains: [
      'Rheumatology',
      'Inflammatory Myopathy',
      'Dermatology',
      'Neuromuscular Medicine',
      'Internal Medicine',
      'Clinical Reasoning',
    ],
  },
};

const educationForFrontend = {
  title: displayLabel,
  summary: {
    definition:
      'Dermatomyositis is an idiopathic inflammatory myopathy characterized by a distinctive immune-mediated skin disease with variable skeletal-muscle and systemic involvement.',
    highYieldTakeaway:
      'Think Dermatomyositis when symmetric proximal weakness occurs with a heliotrope-type eyelid eruption, Gottron papules or sign, photosensitive shawl or V-sign rash, muscle-enzyme elevation, and supportive imaging, electrophysiology, serology, or pathology.',
  },
  recognitionPattern: [
    {
      pattern: 'Symmetric proximal muscle weakness',
      whyItMatters:
        'Patients struggle with stairs, rising from chairs, lifting objects, overhead tasks, neck flexion, and sometimes swallowing.',
      progression:
        'Immune-mediated muscle injury -> reduced proximal strength and endurance -> functional limitation -> possible bulbar or respiratory involvement.',
      discriminator:
        'Sensation is preserved and weakness is usually more prominent proximally than distally.',
      commonTrap:
        'Do not attribute raised aminotransferases automatically to liver disease when creatine kinase and the examination indicate muscle injury.',
    },
    {
      pattern: 'Characteristic cutaneous disease',
      whyItMatters:
        'Skin findings may precede, accompany, or occur without clinically apparent muscle weakness.',
      progression:
        'Photosensitive interface inflammation -> heliotrope-type eruption, extensor-joint papules or plaques, shawl or V-sign erythema, scalp disease, and periungual change.',
      discriminator:
        'Gottron papules over extensor joints and a heliotrope-type eruption strongly support the diagnosis.',
      commonTrap:
        'Do not require muscle weakness for every phenotype; clinically amyopathic disease is recognized.',
    },
    {
      pattern: 'Systemic and phenotype-specific complications',
      whyItMatters:
        'Interstitial lung disease, dysphagia, cardiac involvement, calcinosis and malignancy can determine prognosis.',
      progression:
        'Autoantibody-linked phenotype -> organ-specific risk -> need for targeted screening and multidisciplinary management.',
      discriminator:
        'Myositis-specific antibodies inform phenotype but must be interpreted with the clinical picture.',
      commonTrap:
        'Do not treat a positive antibody result as diagnostic in isolation.',
    },
  ],
  keySymptoms: [
    'Difficulty climbing stairs or rising from a chair',
    'Difficulty lifting or performing overhead tasks',
    'Neck weakness',
    'Dysphagia or nasal speech',
    'Photosensitive pruritic rash',
    'Scalp symptoms',
    'Dyspnoea or cough suggesting lung involvement',
    'Fatigue and functional decline',
  ],
  keySigns: [
    'Symmetric proximal weakness',
    'Heliotrope-type eyelid eruption',
    'Gottron papules or Gottron sign',
    'Shawl-sign or V-sign erythema',
    'Periungual capillary abnormalities',
    'Scalp erythema or scale',
    'Calcinosis in selected phenotypes',
    'Preserved sensation',
  ],
  examPearls: [
    {
      pearl:
        'Test functional proximal strength with chair rise, shoulder abduction, hip flexion and neck flexion rather than relying only on hand grip.',
      whyItMatters:
        'Distal strength may be preserved despite substantial disability.',
    },
    {
      pearl:
        'Inspect eyelids, extensor knuckles, nailfolds, scalp, upper chest, shoulders and lateral thighs.',
      whyItMatters:
        'Subtle skin findings may be missed without a directed examination.',
    },
    {
      pearl:
        'Assess swallowing, cough strength, respiratory symptoms and oxygenation.',
      whyItMatters:
        'Bulbar or respiratory involvement may require urgent evaluation.',
    },
  ],
  scoringSystems: [
    {
      name: '2017 EULAR/ACR Idiopathic Inflammatory Myopathy Classification Criteria',
      use:
        'Estimates the probability of an idiopathic inflammatory myopathy using clinical, laboratory and biopsy variables.',
      limitation:
        'Classification criteria support research consistency and do not replace expert diagnosis or phenotype assessment.',
    },
    {
      name: 'Manual Muscle Testing and Functional Measures',
      use:
        'Tracks muscle strength and functional response over time.',
      limitation:
        'Performance is influenced by pain, effort, chronic damage and examiner technique.',
    },
  ],
  investigations: [
    {
      test: 'Muscle enzymes',
      expected:
        'Creatine kinase and aldolase may rise; AST, ALT and LDH may also reflect muscle injury.',
      role:
        'Supports active myositis and provides a monitoring baseline.',
      limitation:
        'Enzymes can be normal in clinically amyopathic disease and selected antibody phenotypes.',
    },
    {
      test: 'Myositis-specific and associated antibodies',
      expected:
        'Phenotype-associated antibodies may include Mi-2, MDA5, TIF1-gamma, NXP2, SAE and antisynthetase antibodies.',
      role:
        'Helps define organ risks, malignancy association and expected clinical phenotype.',
      limitation:
        'Assay performance varies and results require clinical correlation.',
    },
    {
      test: 'MRI of skeletal muscle',
      expected:
        'Muscle oedema supports active inflammation; chronic fatty replacement suggests damage.',
      role:
        'Assesses distribution, supports diagnosis and helps select a biopsy site.',
      limitation:
        'Oedema is not specific and can occur with infection, denervation, trauma and other myopathies.',
    },
    {
      test: 'Electromyography',
      expected:
        'May show an irritable myopathic pattern with spontaneous activity.',
      role:
        'Supports myopathy and helps distinguish selected neurogenic mimics.',
      limitation:
        'Findings are supportive rather than disease-specific.',
    },
    {
      test: 'Muscle or skin biopsy',
      expected:
        'Muscle may show perifascicular atrophy and perivascular or perimysial inflammation; skin may show interface dermatitis.',
      role:
        'Provides tissue confirmation when phenotype, serology or alternative diagnoses require clarification.',
      limitation:
        'Sampling error and treatment can reduce diagnostic yield.',
    },
    {
      test: 'Systemic-complication assessment',
      expected:
        'Pulmonary-function testing and chest imaging assess interstitial lung disease; swallowing studies, ECG or cardiac imaging and age-appropriate cancer assessment are selected by phenotype and symptoms.',
      role:
        'Detects complications that alter urgency and treatment.',
      limitation:
        'Screening strategy should be individualized to antibody profile, age, symptoms and local guidance.',
    },
  ],
  differentialDistinguishers: [
    {
      diagnosis: 'Immune-Mediated Necrotizing Myopathy',
      distinguishingFeatures:
        'Usually severe muscle-predominant disease with extensive necrosis and less characteristic skin disease.',
    },
    {
      diagnosis: 'Inclusion Body Myositis',
      distinguishingFeatures:
        'Typically slowly progressive, often asymmetric, with finger-flexor and knee-extensor involvement and poor immunotherapy response.',
    },
    {
      diagnosis: 'Antisynthetase Syndrome',
      distinguishingFeatures:
        'Myositis occurs with antisynthetase antibodies and may include interstitial lung disease, arthritis, Raynaud phenomenon, fever and mechanic hands.',
    },
    {
      diagnosis: 'Systemic Lupus Erythematosus with Myositis',
      distinguishingFeatures:
        'Broader lupus manifestations and serology accompany muscle involvement; classic Dermatomyositis skin and muscle pathology may be absent.',
    },
    {
      diagnosis: 'Endocrine or Toxic Myopathy',
      distinguishingFeatures:
        'Exposure or endocrine testing supports the cause, and defining Dermatomyositis skin findings are absent.',
    },
  ],
  managementOverview: [
    {
      phase: 'Initial assessment',
      priorities:
        'Confirm phenotype, quantify weakness and function, evaluate swallowing and respiratory status, review medicines, and assess lung, cardiac and malignancy risks.',
    },
    {
      phase: 'Control active disease',
      priorities:
        'Use systemic glucocorticoids and an appropriate steroid-sparing immunomodulatory agent according to severity, organ involvement, comorbidity and specialist guidance.',
    },
    {
      phase: 'Severe or organ-threatening disease',
      priorities:
        'Escalate urgently for respiratory weakness, severe dysphagia, rapidly progressive interstitial lung disease, myocarditis or other major complications; intravenous immunoglobulin and additional immunosuppression may be required.',
    },
    {
      phase: 'Skin and rehabilitation care',
      priorities:
        'Use photoprotection and directed dermatologic therapy, and introduce supervised physiotherapy and graded rehabilitation as inflammation is controlled.',
    },
    {
      phase: 'Long-term monitoring',
      priorities:
        'Track strength, function, enzymes, treatment toxicity, organ complications and malignancy risk, while distinguishing active inflammation from fixed damage.',
    },
  ],
  complications: [
    'Dysphagia and aspiration',
    'Respiratory-muscle weakness',
    'Interstitial lung disease',
    'Cardiac involvement',
    'Calcinosis',
    'Infection and treatment toxicity',
    'Functional disability and contractures',
    'Associated malignancy in selected adult phenotypes',
  ],
  pitfalls: [
    'Diagnosing liver disease from aminotransferase elevation without checking muscle enzymes',
    'Missing clinically amyopathic disease because muscle strength is normal',
    'Treating classification criteria as mandatory diagnostic rules',
    'Ignoring interstitial lung disease or dysphagia screening',
    'Assuming every positive myositis antibody is diagnostic',
    'Failing to assess malignancy risk in adults',
    'Confusing active inflammation with chronic weakness from muscle damage or steroid myopathy',
  ],
  recallPrompts: [
    {
      question: 'What muscle pattern is typical?',
      answer:
        'Symmetric proximal weakness affecting shoulder and hip girdles, often with neck or bulbar involvement.',
    },
    {
      question: 'Which skin signs are most characteristic?',
      answer:
        'Heliotrope-type eyelid eruption, Gottron papules or sign, and photosensitive shawl or V-sign erythema.',
    },
    {
      question: 'Which biopsy clue is classic?',
      answer:
        'Perifascicular muscle-fibre atrophy with perivascular or perimysial inflammatory change.',
    },
    {
      question: 'Which complications require active screening?',
      answer:
        'Interstitial lung disease, dysphagia, respiratory weakness, cardiac disease and phenotype-appropriate malignancy risk.',
    },
    {
      question: 'Why can a normal creatine kinase be misleading?',
      answer:
        'Clinically amyopathic and selected antibody phenotypes may have little or no enzyme elevation.',
    },
  ],
  references: [
    {
      title: 'American College of Rheumatology: Inflammatory Myopathies',
      source: 'American College of Rheumatology',
      url: 'https://rheumatology.org/patients/inflammatory-myopathies',
    },
    {
      title:
        'EULAR/ACR Classification Criteria for Adult and Juvenile Idiopathic Inflammatory Myopathies',
      source: 'EULAR and American College of Rheumatology',
      url: 'https://www.eular.org/recommendations-eular-acr',
    },
    {
      title: 'Dermatomyositis: Practical Guidance and Unmet Needs',
      source: 'ImmunoTargets and Therapy, 2024',
      url: 'https://pubmed.ncbi.nlm.nih.gov/38464459/',
    },
    {
      title:
        'ACR Guideline for Screening and Monitoring Interstitial Lung Disease in Systemic Autoimmune Rheumatic Disease',
      source: 'American College of Rheumatology',
      url: 'https://rheumatology.org/api/asset/blt7e2cadfc7bc986fb',
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
    '44 year old',
    'eight weeks',
    '4260',
    'this patient',
    'this case',
    'her eyelids',
    'anti mi 2 antibodies are positive',
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
    ).includes('dermatomyositis')
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
    clinicalSetting: DiagnosisClinicalSetting.OUTPATIENT,
    ageGroup: DiagnosisAgeGroup.ADULT,
    urgencyLevel: DiagnosisUrgencyLevel.URGENT,
    preferredClueTypes: ['history', 'symptom', 'exam', 'lab', 'imaging'],
    notes:
      'Flagship Dermatomyositis registry entry focused on characteristic cutaneous disease, symmetric proximal inflammatory myopathy, muscle enzymes, MRI, electromyography, histopathology, phenotype-specific antibodies, systemic complications, and malignancy assessment.',
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
      'Skipped diagnosis education because Dermatomyositis education already exists:',
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
        ? 'Skipped existing scheduled Dermatomyositis case.'
        : 'Skipped existing Dermatomyositis case to avoid overwriting authored content.',
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
  const symptoms = [clues[0].value, clues[1].value];

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
      'Seeded complete frontend-aligned flagship Dermatomyositis case with six supported clues, progressive inflammatory-myopathy reasoning, exact clue breakdown alignment, pathology and antibody confirmation, and diagnosis-level education independent of the vignette.',
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
        'Created complete Dermatomyositis revision with six validated clue types, exact clue-to-breakdown alignment, string-based frontend reasoning, evidence-anchored differentials, and integrated clinical, biochemical, imaging, electrophysiological, serological, and pathological confirmation.',
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
      validatorVersion: 'flagship-human-review:dermatomyositis-v1',
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        clueProgressionVerified: true,
        breakdownClueReferencesValidated: true,
        frontendReasoningStringVerified: true,
        differentialEvidenceAnchoredToClues: true,
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
          clinicalSetting: 'OUTPATIENT',
          ageGroup: 'ADULT',
          urgencyLevel: 'URGENT',
        },
        note:
          'Complete Dermatomyositis flagship seed with six supported clue types, no early diagnosis-label leakage, exact clue and reasoning alignment, evidence-anchored differential analysis, integrated confirmation, and independent diagnosis education.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded Dermatomyositis:', {
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
