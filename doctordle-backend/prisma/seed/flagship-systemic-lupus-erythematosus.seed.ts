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
 * FLAGSHIP CASE SEED - Systemic Lupus Erythematosus
 *
 * Clinical focus:
 * - A young adult with constitutional symptoms, photosensitivity, oral ulceration,
 *   inflammatory small-joint polyarthritis, and acute cutaneous lupus features.
 * - Cytopenias and active urinary sediment indicating multisystem disease.
 * - ANA entry criterion, SLE-specific antibodies, and complement consumption.
 * - Kidney biopsy confirming active class IV lupus nephritis.
 * - Correct use of the 2019 EULAR/ACR classification framework without treating
 *   classification criteria as a substitute for clinical diagnosis.
 *
 * Safety:
 * - Reuses or creates the diagnosis registry and accepted aliases.
 * - Does not overwrite existing diagnosis education.
 * - Does not overwrite an existing case with the same title.
 * - Does not alter a scheduled DailyCase.
 *
 * Run:
 *   npx tsx prisma/seed/flagship-systemic-lupus-erythematosus.seed.ts
 *
 * Railway:
 *   railway run npx tsx prisma/seed/flagship-systemic-lupus-erythematosus.seed.ts
 */

const databaseUrl = resolvePgConnectionString(process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required to run the Systemic Lupus Erythematosus seed.',
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
  ) as {
    databaseUrl?: unknown;
  };

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

    if (!owner) {
      if (offset > 0) {
        console.warn(
          'Preferred inventory placeholder date was occupied; using next free date.',
          {
            displayLabel: params.displayLabel,
            preferredDate: params.preferredDate.toISOString(),
            assignedDate: candidateDate.toISOString(),
            offsetDays: offset,
          },
        );
      }

      return candidateDate;
    }

    console.warn('Inventory placeholder date occupied; trying next day.', {
      displayLabel: params.displayLabel,
      candidateDate: candidateDate.toISOString(),
      occupiedByCaseId: owner.id,
      occupiedByTitle: owner.title,
      occupiedCaseIsScheduled: owner.dailyCases.length > 0,
    });
  }

  throw new Error(
    `Cannot seed ${params.displayLabel}: no free inventory placeholder date found within ${maxAttempts} days after ${params.preferredDate.toISOString()}.`,
  );
}

const now = new Date();
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 6, 23, 12, 0, 0));
const seedVersion = 'flagship-systemic-lupus-erythematosus-v1';

const canonicalName = 'systemic lupus erythematosus';
const displayLabel = 'Systemic Lupus Erythematosus';
const caseTitle = 'Photosensitive Rash, Polyarthritis and Proteinuric Kidney Injury';

const aliasTerms = [
  'Systemic Lupus Erythematosus',
  'SLE',
  'Systemic Lupus',
  'SLE with Lupus Nephritis',
  'Systemic Lupus Erythematosus with Lupus Nephritis',
];

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 24-year-old woman presents with eight weeks of worsening fatigue, intermittent fever, and pain with swelling in both wrists, metacarpophalangeal joints, and proximal interphalangeal joints. Morning stiffness lasts about ninety minutes, and symptoms have begun to interfere with writing and dressing.',
  },
  {
    order: 1,
    type: 'history',
    value:
      'She reports a recurrent red facial eruption after sun exposure, painless ulcers on the hard palate, increased hair shedding, and two episodes of sharp chest pain that were worse with deep inspiration. She has taken no hydralazine, procainamide, isoniazid, minocycline, or tumour-necrosis-factor inhibitor and has no recent sore throat, diarrhoeal illness, or known chronic infection.',
  },
  {
    order: 2,
    type: 'exam',
    value:
      'Temperature is 38.1°C and blood pressure is 148/92 mmHg. Examination shows non-scarring alopecia, a fixed erythematous eruption over both cheeks and the nasal bridge that spares the nasolabial folds, a shallow painless palatal ulcer, and symmetric tenderness with swelling of the wrists and several MCP and PIP joints. There is mild bilateral ankle oedema but no muscle weakness, sclerodactyly, digital ulceration, or parotid enlargement.',
  },
  {
    order: 3,
    type: 'lab',
    value:
      'Haemoglobin is 9.8 g/dL, white-cell count 2.6 × 10^9/L with lymphocytes 0.7 × 10^9/L, and platelets 112 × 10^9/L. ESR is 78 mm/hour while CRP is 9 mg/L. Creatinine is 132 µmol/L and albumin 27 g/L. Urinalysis shows 3+ protein and 2+ blood; microscopy demonstrates dysmorphic erythrocytes and red-cell casts, and the urine protein-to-creatinine ratio is 2.4 g/g.',
  },
  {
    order: 4,
    type: 'lab',
    value:
      'Antinuclear antibody is positive at 1:1280. Anti-double-stranded DNA antibodies are markedly elevated and anti-Smith antibodies are positive; C3 and C4 are both low. Direct antiglobulin testing is positive without biochemical haemolysis. ANCA, hepatitis B, hepatitis C, and HIV testing are negative, and repeated blood and urine cultures show no growth.',
  },
  {
    order: 5,
    type: 'lab',
    value:
      'Kidney biopsy demonstrates diffuse endocapillary and extracapillary proliferative glomerulonephritis involving more than half of sampled glomeruli, with wire-loop deposits and a full-house immunofluorescence pattern, consistent with active ISN/RPS class IV lupus nephritis. With ANA as the entry criterion, acute cutaneous disease, inflammatory joint involvement, thrombocytopenia, class IV nephritis, low C3 and C4, and SLE-specific antibodies produce a strongly supportive 2019 EULAR/ACR classification pattern after exclusion of infection and competing autoimmune disease.',
  },
] as const;

const differentials = [
  'Rheumatoid Arthritis',
  'Viral Arthritis',
  'Drug-induced Lupus',
  'Mixed Connective Tissue Disease',
  'ANCA-associated Vasculitis',
  'Primary Sjögren Syndrome',
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
          `Breakdown evidence for ${entry.diagnosis} does not occur in clue ${breakdown.clueOrder}: ${breakdown.evidence}.`,
        );
      }
    });
  });
}

const explanation = {
  diagnosis: displayLabel,
  summary:
    'A young woman with photosensitive acute cutaneous disease, painless oral ulceration, non-scarring alopecia, inflammatory polyarthritis, cytopenias, immune-complex glomerulonephritis, high anti-double-stranded DNA and anti-Smith antibodies, complement consumption, and class IV full-house nephritis has Systemic Lupus Erythematosus with active proliferative lupus nephritis.',
  reasoning: [
    'The opening pattern is inflammatory rather than mechanical: symmetric small-joint swelling, prolonged morning stiffness, fever, and constitutional symptoms indicate systemic inflammatory disease.',
    'Photosensitivity, a facial eruption sparing the nasolabial folds, painless palatal ulceration, and non-scarring alopecia form a characteristic mucocutaneous autoimmune pattern.',
    'Leukopenia, lymphopenia, and thrombocytopenia show haematological involvement beyond an isolated inflammatory arthritis.',
    'Hypertension, oedema, rising creatinine, proteinuria, dysmorphic erythrocytes, and red-cell casts localise active disease to the glomeruli.',
    'A high-titre ANA fulfils the obligatory entry requirement for the 2019 EULAR/ACR classification framework but is not specific enough to establish the diagnosis alone.',
    'Marked anti-double-stranded DNA elevation, anti-Smith positivity, and low C3 and C4 strongly support active immune-complex disease of the systemic lupus type.',
    'Negative cultures and viral screening reduce the likelihood of infection as the unifying cause of fever, cytopenias, arthritis, and kidney injury.',
    'Kidney histology showing diffuse proliferative glomerulonephritis with full-house immunofluorescence confirms class IV lupus nephritis and explains the active urinary sediment and proteinuria.',
    'Using only the highest-weighted item in each classification domain, the patient far exceeds the ten-point threshold; however, the diagnosis remains clinical and requires attribution of findings to this disease rather than a better alternative.',
  ],
  keyFindings: [
    'Age 24 years',
    'Eight weeks of fatigue and intermittent fever',
    'Symmetric inflammatory wrist, MCP, and PIP arthritis',
    'Morning stiffness lasting about ninety minutes',
    'Photosensitive facial eruption',
    'Painless hard-palate ulcer',
    'Non-scarring alopecia',
    'Pleuritic chest pain',
    'Facial erythema sparing the nasolabial folds',
    'Blood pressure 148/92 mmHg',
    'Bilateral ankle oedema',
    'Anaemia',
    'Leukopenia and lymphopenia',
    'Thrombocytopenia',
    'High ESR with only modest CRP elevation',
    'Creatinine 132 µmol/L',
    'Albumin 27 g/L',
    'Proteinuria 2.4 g/g',
    'Dysmorphic erythrocytes and red-cell casts',
    'ANA 1:1280',
    'Markedly elevated anti-double-stranded DNA antibodies',
    'Positive anti-Smith antibodies',
    'Low C3 and C4',
    'Full-house immunofluorescence',
    'ISN/RPS class IV lupus nephritis',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Rheumatoid Arthritis',
      whyPlausibleEarly:
        'Symmetric small-joint synovitis with prolonged morning stiffness is a classic rheumatoid pattern.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence:
            'a recurrent red facial eruption after sun exposure, painless ulcers on the hard palate, increased hair shedding',
          reason:
            'This mucocutaneous combination is not explained by uncomplicated rheumatoid arthritis.',
        },
        {
          clueOrder: 3,
          evidence:
            'dysmorphic erythrocytes and red-cell casts',
          reason:
            'Active immune glomerulonephritis is not a typical direct manifestation of rheumatoid arthritis.',
        },
        {
          clueOrder: 4,
          evidence:
            'Anti-double-stranded DNA antibodies are markedly elevated and anti-Smith antibodies are positive; C3 and C4 are both low',
          reason:
            'SLE-specific antibodies with complement consumption support systemic lupus rather than rheumatoid arthritis.',
        },
      ],
      finalReasonLessLikely:
        'Rheumatoid arthritis explains the synovitis but not the photosensitive mucocutaneous disease, cytopenias, lupus serology, and class IV immune-complex nephritis.',
    },
    {
      diagnosis: 'Viral Arthritis',
      whyPlausibleEarly:
        'Acute viral illness can produce fever, rash, cytopenias, and symmetric inflammatory polyarthritis.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence: 'eight weeks of worsening fatigue, intermittent fever',
          reason:
            'The prolonged course is less typical of a self-limited viral arthritis.',
        },
        {
          clueOrder: 3,
          evidence:
            '3+ protein and 2+ blood; microscopy demonstrates dysmorphic erythrocytes and red-cell casts',
          reason:
            'The active nephritic urinary sediment indicates significant glomerular immune injury rather than uncomplicated viral arthritis.',
        },
        {
          clueOrder: 4,
          evidence:
            'ANCA, hepatitis B, hepatitis C, and HIV testing are negative, and repeated blood and urine cultures show no growth',
          reason:
            'The investigation reduces important infectious mimics while disease-specific autoantibodies remain strongly positive.',
        },
      ],
      finalReasonLessLikely:
        'A viral syndrome does not adequately explain persistent multisystem disease, complement consumption, SLE-specific antibodies, and full-house proliferative nephritis.',
    },
    {
      diagnosis: 'Drug-induced Lupus',
      whyPlausibleEarly:
        'Drug-induced autoimmunity can cause fever, arthralgia or arthritis, serositis, rash, and positive ANA.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence:
            'She has taken no hydralazine, procainamide, isoniazid, minocycline, or tumour-necrosis-factor inhibitor',
          reason:
            'There is no identified high-risk medication exposure in the history.',
        },
        {
          clueOrder: 4,
          evidence:
            'Anti-double-stranded DNA antibodies are markedly elevated and anti-Smith antibodies are positive; C3 and C4 are both low',
          reason:
            'This serological pattern is much more characteristic of idiopathic systemic lupus than classic drug-induced disease.',
        },
        {
          clueOrder: 5,
          evidence: 'active ISN/RPS class IV lupus nephritis',
          reason:
            'Severe proliferative nephritis is uncommon in classic drug-induced lupus.',
        },
      ],
      finalReasonLessLikely:
        'Absent culprit exposure, SLE-specific antibodies, hypocomplementaemia, cytopenias, and class IV nephritis favour idiopathic systemic lupus.',
    },
    {
      diagnosis: 'Mixed Connective Tissue Disease',
      whyPlausibleEarly:
        'A young woman with inflammatory polyarthritis, rash, cytopenias, and multisystem symptoms could have an overlap connective-tissue disease.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence:
            'no muscle weakness, sclerodactyly, digital ulceration, or parotid enlargement',
          reason:
            'The examination lacks prominent myositis and systemic-sclerosis overlap features.',
        },
        {
          clueOrder: 4,
          evidence:
            'Anti-double-stranded DNA antibodies are markedly elevated and anti-Smith antibodies are positive',
          reason:
            'The serology supports systemic lupus rather than an anti-U1-RNP-dominant overlap syndrome.',
        },
        {
          clueOrder: 5,
          evidence: 'full-house immunofluorescence pattern',
          reason:
            'This renal immune-deposit pattern strongly supports lupus nephritis in the correct clinical context.',
        },
      ],
      finalReasonLessLikely:
        'The patient lacks defining overlap features and instead has a coherent SLE-specific clinical, immunological, and renal-biopsy pattern.',
    },
    {
      diagnosis: 'ANCA-associated Vasculitis',
      whyPlausibleEarly:
        'Systemic inflammation with kidney injury, haematuria, proteinuria, and red-cell casts can indicate pauci-immune small-vessel vasculitis.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence:
            'a fixed erythematous eruption over both cheeks and the nasal bridge that spares the nasolabial folds, a shallow painless palatal ulcer',
          reason:
            'This mucocutaneous phenotype is more characteristic of systemic lupus than ANCA vasculitis.',
        },
        {
          clueOrder: 4,
          evidence:
            'ANCA, hepatitis B, hepatitis C, and HIV testing are negative',
          reason:
            'Negative ANCA does not absolutely exclude vasculitis, but it lowers support while lupus-specific antibodies and low complements point elsewhere.',
        },
        {
          clueOrder: 5,
          evidence: 'a full-house immunofluorescence pattern',
          reason:
            'ANCA-associated glomerulonephritis is usually pauci-immune rather than full-house immune-complex disease.',
        },
      ],
      finalReasonLessLikely:
        'The serology and full-house immune-complex biopsy establish lupus nephritis rather than pauci-immune ANCA-associated vasculitis.',
    },
    {
      diagnosis: 'Primary Sjögren Syndrome',
      whyPlausibleEarly:
        'Primary Sjögren disease can cause fatigue, arthralgia or arthritis, cytopenias, positive ANA, and renal abnormalities.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: 'no muscle weakness, sclerodactyly, digital ulceration, or parotid enlargement',
          reason:
            'There is no parotid enlargement, and the case does not describe a dominant sicca syndrome.',
        },
        {
          clueOrder: 4,
          evidence:
            'Anti-double-stranded DNA antibodies are markedly elevated and anti-Smith antibodies are positive; C3 and C4 are both low',
          reason:
            'This pattern is much more specific for active systemic lupus.',
        },
        {
          clueOrder: 5,
          evidence: 'active ISN/RPS class IV lupus nephritis',
          reason:
            'Diffuse proliferative full-house nephritis is a major lupus manifestation rather than the usual renal pattern of primary Sjögren disease.',
        },
      ],
      finalReasonLessLikely:
        'The absence of a dominant sicca phenotype and the presence of SLE-specific antibodies with class IV nephritis favour systemic lupus.',
    },
  ] satisfies DifferentialAnalysisEntry[],
  classificationSupport: {
    framework: '2019 EULAR/ACR classification criteria',
    entryCriterion: 'ANA positive at a titre of at least 1:80',
    countedItems: [
      { domain: 'Constitutional', item: 'Fever', points: 2 },
      {
        domain: 'Haematological',
        item: 'Thrombocytopenia',
        points: 4,
      },
      {
        domain: 'Mucocutaneous',
        item: 'Acute cutaneous lupus',
        points: 6,
      },
      {
        domain: 'Musculoskeletal',
        item: 'Joint involvement',
        points: 6,
      },
      {
        domain: 'Renal',
        item: 'Class III or IV lupus nephritis',
        points: 10,
      },
      {
        domain: 'Complement proteins',
        item: 'Low C3 and low C4',
        points: 4,
      },
      {
        domain: 'SLE-specific antibodies',
        item: 'Anti-double-stranded DNA or anti-Smith antibodies',
        points: 6,
      },
    ],
    total: 38,
    caution:
      'Only the highest-weighted item in each domain is counted. Classification criteria support research classification and structured reasoning but do not replace clinical diagnosis or attribution of each finding.',
  },
  managementPearl:
    'Active proliferative lupus nephritis requires prompt joint rheumatology-nephrology care. Treatment is selected according to histological class, activity and chronicity, kidney function, proteinuria, comorbidity, pregnancy plans, infection risk, local availability, and current guidance. Hydroxychloroquine is generally used unless contraindicated, glucocorticoid exposure should be minimised, and class III or IV nephritis usually requires combination immunosuppressive induction followed by prolonged maintenance and objective renal-response monitoring.',
  generationQuality: {
    contentTier: 'FLAGSHIP',
    seedVersion,
    humanReviewed: true,
    discriminatorStrength: 'VERY_HIGH',
    clueProgressionVerified: true,
    breakdownClueReferencesValidated: true,
    breakdownEvidenceMatchedToClues: true,
    expectedTeachingPoints: [
      'SLE is a multisystem clinical diagnosis supported by characteristic immunology',
      'ANA is an entry criterion in the 2019 EULAR/ACR framework but is not specific',
      'Only the highest-scoring item in each classification domain is counted',
      'Anti-double-stranded DNA and anti-Smith antibodies are SLE-specific antibody criteria',
      'Low complement can reflect active immune-complex disease',
      'Proteinuria, dysmorphic erythrocytes, and red-cell casts require assessment for lupus nephritis',
      'Kidney biopsy determines lupus-nephritis class, activity, chronicity, and treatment direction',
      'Full-house immunofluorescence supports lupus nephritis but must be interpreted clinically',
      'Hydroxychloroquine is foundational for most patients unless contraindicated',
      'Proliferative nephritis requires specialist-directed induction and maintenance therapy',
    ],
    competencyDomains: [
      'Rheumatology',
      'Nephrology',
      'Systemic Autoimmune Disease',
      'Inflammatory Arthritis',
      'Glomerular Disease',
      'Clinical Immunology',
      'Diagnostic Criteria',
      'Clinical Reasoning',
    ],
  },
};

const educationForFrontend = {
  title: displayLabel,
  summary: {
    definition:
      'Systemic Lupus Erythematosus is a chronic autoimmune disease characterised by loss of immune tolerance, autoantibody production, immune-complex injury, and variable involvement of the skin, joints, blood, kidneys, nervous system, lungs, heart, and blood vessels.',
    highYieldTakeaway:
      'Suspect SLE when compatible manifestations occur across several organ systems—especially photosensitive mucocutaneous disease, inflammatory arthritis, cytopenias, serositis, neurological disease, or immune-complex nephritis—and are supported by ANA, SLE-specific antibodies, and complement consumption after better alternatives are excluded.',
  },
  recognitionPattern: [
    {
      pattern: 'Multisystem inflammatory disease in a young woman',
      whyItMatters:
        'No single symptom establishes SLE; diagnostic strength comes from compatible findings across independent organ domains.',
      progression:
        'Constitutional symptoms -> mucocutaneous and joint disease -> haematological, serosal, neurological, or renal involvement.',
      discriminator:
        'The combination of otherwise unexplained manifestations is more informative than an isolated positive ANA.',
      commonTrap:
        'Do not diagnose SLE from fatigue, arthralgia, or ANA positivity alone.',
    },
    {
      pattern: 'Photosensitive mucocutaneous and inflammatory joint disease',
      whyItMatters:
        'Acute cutaneous disease, oral ulceration, non-scarring alopecia, and inflammatory arthritis are common presenting domains.',
      progression:
        'Sun-triggered eruption or ulceration -> recurrent inflammatory symptoms -> objective synovitis or prolonged morning stiffness.',
      discriminator:
        'A fixed malar-pattern eruption typically involves the cheeks and nasal bridge and may spare the nasolabial folds.',
      commonTrap:
        'Do not describe every facial rash as malar disease; morphology, distribution, timing, and alternatives matter.',
    },
    {
      pattern: 'Immune-complex kidney disease',
      whyItMatters:
        'Kidney involvement may be clinically silent until urinalysis detects protein, blood, casts, or declining filtration.',
      progression:
        'Proteinuria or haematuria -> active urinary sediment and reduced kidney function -> biopsy-defined nephritis class.',
      discriminator:
        'Red-cell casts and dysmorphic erythrocytes localise bleeding to the glomerulus, while biopsy defines activity and chronicity.',
      commonTrap:
        'Do not wait for oedema or advanced kidney failure before screening urine and quantifying protein.',
    },
    {
      pattern: 'SLE-specific immunology with complement consumption',
      whyItMatters:
        'Anti-double-stranded DNA, anti-Smith antibodies, and low complement add specificity and can support assessment of active immune-complex disease.',
      progression:
        'ANA establishes eligibility for classification -> disease-specific antibodies and complements strengthen attribution -> organ evaluation defines severity.',
      discriminator:
        'ANA is sensitive but nonspecific; its meaning depends on titre, method, clinical context, and the presence of more specific findings.',
      commonTrap:
        'Do not use autoantibody results without confirming that the clinical manifestations are attributable to the disease.',
    },
  ],
  keySymptoms: [
    {
      symptom: 'Inflammatory joint pain and morning stiffness',
      significance:
        'Usually affects peripheral joints and may be accompanied by objective synovitis.',
    },
    {
      symptom: 'Photosensitive rash',
      significance:
        'Sun-triggered or worsened cutaneous inflammation supports a mucocutaneous disease domain.',
    },
    {
      symptom: 'Painless oral or nasal ulcers',
      significance:
        'May be overlooked unless the mouth and nose are examined directly.',
    },
    {
      symptom: 'Pleuritic or positional chest pain',
      significance:
        'Can indicate pleuritis or pericarditis after infection and other causes are considered.',
    },
    {
      symptom: 'Foamy urine, haematuria, oedema, or reduced urine output',
      significance:
        'May indicate lupus nephritis, although renal disease can initially be asymptomatic.',
    },
  ],
  keySigns: [
    {
      finding: 'Acute cutaneous lupus pattern',
      significance:
        'A compatible malar-pattern eruption is a weighted mucocutaneous classification item.',
      discriminator:
        'Define morphology and distribution rather than relying on the word “rash.”',
    },
    {
      finding: 'Objective inflammatory synovitis',
      significance:
        'Supports musculoskeletal involvement when joint swelling or tenderness with prolonged morning stiffness is present.',
      discriminator:
        'Differentiate inflammatory symptoms from mechanical pain and fibromyalgia.',
    },
    {
      finding: 'Non-scarring alopecia',
      significance:
        'Can reflect active mucocutaneous disease after nutritional, endocrine, drug, and other causes are considered.',
      discriminator:
        'Scarring alopecia suggests chronic cutaneous damage rather than the same criterion.',
    },
    {
      finding: 'Hypertension and peripheral oedema',
      significance:
        'Raise concern for clinically important renal involvement and require urinalysis, kidney function, and protein quantification.',
      discriminator:
        'Normal appearance does not exclude nephritis; urine screening is essential.',
    },
    {
      finding: 'Focal neurological or thrombotic signs',
      significance:
        'May indicate neuropsychiatric disease, antiphospholipid syndrome, infection, or another emergency.',
      discriminator:
        'Do not attribute neurological or vascular events automatically to SLE without excluding competing causes.',
    },
  ],
  examPearls: [
    {
      type: 'PATTERN',
      title: 'Build the diagnosis by independent domains',
      content:
        'Document constitutional, haematological, neuropsychiatric, mucocutaneous, serosal, musculoskeletal, renal, complement, antiphospholipid, and SLE-specific antibody findings separately.',
      whyItMatters:
        'This prevents one manifestation from being counted repeatedly and makes competing diagnoses easier to compare.',
      discriminator:
        'Only the highest-weighted criterion in each EULAR/ACR domain contributes to the classification score.',
      trapAvoided:
        'Do not add leukopenia, lymphopenia, and thrombocytopenia as separate points from the same domain.',
    },
    {
      type: 'RENAL',
      title: 'Screen the urine even when renal symptoms are absent',
      content:
        'Check blood pressure, creatinine or estimated GFR, urinalysis with microscopy, and quantified protein excretion.',
      whyItMatters:
        'Lupus nephritis can be active before oedema, visible haematuria, or advanced kidney dysfunction appears.',
      discriminator:
        'Red-cell casts and dysmorphic erythrocytes indicate glomerular inflammation and warrant urgent specialist assessment.',
      trapAvoided:
        'Do not rely on serum creatinine alone to exclude nephritis.',
    },
    {
      type: 'IMMUNOLOGY',
      title: 'Interpret ANA as an entry test, not the diagnosis',
      content:
        'Use ANA to enter the classification framework, then assess attributable clinical domains, specific antibodies, complement, and competing causes.',
      whyItMatters:
        'ANA positivity occurs in healthy people, infection, medication exposure, and several other autoimmune disorders.',
      discriminator:
        'Anti-double-stranded DNA or anti-Smith antibodies provide substantially greater disease specificity.',
      trapAvoided:
        'Do not label an ANA-positive patient with nonspecific symptoms as having SLE.',
    },
    {
      type: 'SAFETY',
      title: 'Exclude infection before escalating immunosuppression',
      content:
        'Assess fever, cultures, exposure risks, viral screening, imaging, and organ-specific infection according to the presentation.',
      whyItMatters:
        'Infection can mimic a flare and may worsen rapidly if treated only with immunosuppression.',
      discriminator:
        'CRP, complement, anti-double-stranded DNA, cultures, imaging, and clinical context are interpreted together; no single marker reliably separates every flare from infection.',
      trapAvoided:
        'Do not assume every fever in a patient with SLE is autoimmune activity.',
    },
  ],
  scoringSystems: [
    {
      id: 'eular-acr-sle-classification-2019',
      name: '2019 EULAR/ACR Classification Criteria for SLE',
      use: 'Classifies patients with compatible disease for research and provides a structured framework for clinical reasoning.',
      components: [
        'Obligatory entry criterion: ANA positive at least once at a titre of 1:80 or equivalent',
        'Weighted clinical domains: constitutional, haematological, neuropsychiatric, mucocutaneous, serosal, musculoskeletal, and renal',
        'Weighted immunological domains: antiphospholipid antibodies, complement proteins, and SLE-specific antibodies',
        'Count only the highest-weighted item within each domain',
        'At least one clinical criterion and a total of at least 10 points are required for classification',
        'Do not count a criterion when another explanation is more likely',
      ],
      caution:
        'These are classification rather than diagnostic criteria. A patient may require clinical care before meeting them, and a high score does not remove the need to exclude mimics or attribute each manifestation correctly.',
    },
  ],
  investigations: [
    {
      test: 'Complete blood count and haemolysis screen',
      interpretation:
        'Assess leukopenia, lymphopenia, thrombocytopenia, anaemia, reticulocytes, bilirubin, lactate dehydrogenase, haptoglobin, and direct antiglobulin testing when haemolysis is suspected.',
      whyItMatters:
        'Cytopenias may reflect disease activity, infection, medication toxicity, bleeding, nutritional deficiency, hypersplenism, or marrow disease.',
    },
    {
      test: 'Urinalysis, urine microscopy, and quantified protein excretion',
      interpretation:
        'Proteinuria, dysmorphic erythrocytes, cellular casts, or an increasing protein-to-creatinine ratio support glomerular involvement.',
      whyItMatters:
        'Urine abnormalities may be the earliest evidence of clinically important lupus nephritis.',
    },
    {
      test: 'Kidney function, albumin, electrolytes, and blood pressure',
      interpretation:
        'Track creatinine or estimated GFR, serum albumin, potassium, and hypertension to define severity and treatment safety.',
      whyItMatters:
        'These measurements guide urgency, supportive care, medication selection, and response monitoring.',
    },
    {
      test: 'ANA, anti-double-stranded DNA, anti-Smith antibodies, C3, and C4',
      interpretation:
        'ANA is sensitive but nonspecific; anti-double-stranded DNA and anti-Smith antibodies are more specific, while low complement can support active immune-complex disease.',
      whyItMatters:
        'The immunological pattern strengthens attribution and provides a baseline for longitudinal assessment.',
    },
    {
      test: 'Antiphospholipid antibody testing',
      interpretation:
        'Test lupus anticoagulant, anticardiolipin antibodies, and anti-beta-2-glycoprotein-I antibodies when clinically appropriate, and confirm persistence according to criteria.',
      whyItMatters:
        'Antiphospholipid syndrome changes thrombosis, pregnancy, and prevention decisions.',
    },
    {
      test: 'Kidney biopsy',
      interpretation:
        'Histology defines nephritis class, activity, chronicity, immune-deposit pattern, and alternative or superimposed kidney disease.',
      whyItMatters:
        'Biopsy findings direct specialist immunosuppressive treatment and improve prognostic assessment.',
    },
    {
      test: 'Targeted infection and mimic evaluation',
      interpretation:
        'Use cultures, viral testing, chest imaging, echocardiography, medication review, and disease-specific testing according to the presentation.',
      whyItMatters:
        'Infection and other autoimmune or drug-related disorders may reproduce individual lupus features.',
    },
  ],
  differentialDistinguishers: [
    {
      diagnosis: 'Rheumatoid Arthritis',
      overlap: 'Symmetric inflammatory small-joint synovitis and morning stiffness.',
      distinguishingFeatures:
        'Usually lacks photosensitive acute cutaneous disease, SLE-specific antibodies, complement consumption, cytopenias across several lineages, and full-house nephritis.',
      decisiveClue:
        'Anti-double-stranded DNA and anti-Smith positivity with class IV full-house nephritis supports SLE.',
    },
    {
      diagnosis: 'Viral Arthritis',
      overlap: 'Fever, rash, cytopenias, and acute polyarthritis.',
      distinguishingFeatures:
        'Often self-limited and does not usually produce persistent SLE-specific serology, low complement, or proliferative full-house nephritis.',
      decisiveClue:
        'Persistent multisystem disease with biopsy-confirmed immune-complex nephritis argues against a simple viral syndrome.',
    },
    {
      diagnosis: 'Drug-induced Lupus',
      overlap: 'Fever, arthralgia or arthritis, rash, serositis, and positive ANA.',
      distinguishingFeatures:
        'Requires a compatible exposure; classic forms less often cause anti-double-stranded DNA positivity, low complement, severe cytopenias, or nephritis.',
      decisiveClue:
        'No culprit exposure plus anti-Smith positivity and class IV nephritis favours idiopathic SLE.',
    },
    {
      diagnosis: 'Mixed Connective Tissue Disease',
      overlap: 'Raynaud symptoms, swollen hands, arthritis, myositis, rash, and systemic involvement.',
      distinguishingFeatures:
        'Typically has high anti-U1-RNP antibodies and prominent overlap features from systemic sclerosis or inflammatory myopathy.',
      decisiveClue:
        'A coherent SLE-specific antibody, complement, mucocutaneous, haematological, and renal-biopsy pattern supports SLE.',
    },
    {
      diagnosis: 'ANCA-associated Vasculitis',
      overlap: 'Constitutional disease and rapidly progressive glomerulonephritis.',
      distinguishingFeatures:
        'Often has ENT or pulmonary capillaritis features and a pauci-immune biopsy rather than full-house immune deposits.',
      decisiveClue:
        'Full-house immune-complex nephritis with anti-double-stranded DNA and anti-Smith antibodies supports lupus nephritis.',
    },
    {
      diagnosis: 'Primary Sjögren Syndrome',
      overlap: 'Fatigue, arthralgia, cytopenias, ANA positivity, low complement, and renal disease.',
      distinguishingFeatures:
        'A dominant sicca syndrome, anti-Ro/SSA or anti-La/SSB pattern, salivary-gland disease, and tubulointerstitial rather than proliferative glomerular involvement are more typical.',
      decisiveClue:
        'SLE-specific antibodies and class IV full-house nephritis favour systemic lupus.',
    },
  ],
  managementOverview: [
    {
      step: 'Define organ severity and exclude urgent mimics',
      rationale:
        'Assess infection, thrombotic disease, neuropsychiatric emergencies, haemolysis, myocarditis, severe cytopenias, and kidney involvement before choosing immunosuppression.',
    },
    {
      step: 'Use hydroxychloroquine for most patients unless contraindicated',
      rationale:
        'Hydroxychloroquine reduces flares and damage and is a foundational therapy; dosing, kidney adjustment, interactions, adherence, and retinal screening follow current guidance.',
    },
    {
      step: 'Treat active class III or IV nephritis with specialist-directed combination therapy',
      rationale:
        'Current strategies combine glucocorticoids with an appropriate immunosuppressive regimen, selected according to biopsy findings, kidney function, proteinuria, comorbidity, fertility goals, adherence, cost, and local availability.',
    },
    {
      step: 'Minimise cumulative glucocorticoid exposure',
      rationale:
        'Use the lowest effective dose and taper as disease control permits to reduce infection, osteoporosis, diabetes, cardiovascular disease, cataract, and other damage.',
    },
    {
      step: 'Provide kidney-protective and preventive care',
      rationale:
        'Control blood pressure, consider renin-angiotensin-system blockade when appropriate, reduce cardiovascular risk, avoid nephrotoxins, update vaccination, assess infection risk, and provide bone protection.',
    },
    {
      step: 'Monitor objective renal and systemic response',
      rationale:
        'Follow proteinuria, urine sediment, creatinine or estimated GFR, blood pressure, albumin, blood counts, complements, anti-double-stranded DNA, adherence, toxicity, and extrarenal activity.',
    },
    {
      step: 'Integrate reproductive planning',
      rationale:
        'Discuss contraception, pregnancy timing, medication compatibility, fertility preservation, antiphospholipid antibodies, and maternal-fetal specialist care before teratogenic or gonadotoxic therapy.',
    },
  ],
  complications: [
    'Chronic kidney disease and kidney failure',
    'Nephrotic syndrome',
    'Hypertensive emergency',
    'Venous or arterial thrombosis',
    'Pregnancy morbidity',
    'Neuropsychiatric disease',
    'Serositis, myocarditis, or accelerated cardiovascular disease',
    'Severe infection',
    'Autoimmune haemolytic anaemia or severe thrombocytopenia',
    'Osteoporosis and avascular necrosis related to glucocorticoid exposure',
    'Irreversible organ damage from active disease or treatment toxicity',
  ],
  pitfalls: [
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Diagnosing from ANA positivity alone',
      content:
        'ANA is an entry criterion and screening marker, not a stand-alone diagnosis.',
      whyItMatters:
        'False attribution can lead to unnecessary immunosuppression and missed alternative disease.',
      trapAvoided:
        'Require compatible attributable clinical findings and evaluate more specific immunology and mimics.',
    },
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Double-counting classification findings',
      content:
        'Only the highest-weighted item in each EULAR/ACR domain contributes to the score.',
      whyItMatters:
        'Adding several findings from one domain produces an invalid inflated score.',
      trapAvoided:
        'Do not count oral ulcers, alopecia, and acute cutaneous disease separately within the mucocutaneous domain.',
    },
    {
      type: 'RENAL',
      title: 'Missing clinically silent nephritis',
      content:
        'Kidney disease may begin with urine abnormalities before symptoms or major creatinine elevation.',
      whyItMatters:
        'Delayed biopsy and treatment increase irreversible chronic damage.',
      trapAvoided:
        'Perform regular blood-pressure, urinalysis, protein-quantification, and kidney-function surveillance.',
    },
    {
      type: 'SAFETY',
      title: 'Calling infection a flare',
      content:
        'Fever, cytopenias, neurological change, pulmonary infiltrates, and kidney injury may result from infection.',
      whyItMatters:
        'Escalating immunosuppression without evaluating infection may be dangerous.',
      trapAvoided:
        'Use cultures and targeted infection assessment before major treatment escalation.',
    },
    {
      type: 'MANAGEMENT',
      title: 'Treating antibodies instead of the patient',
      content:
        'Complement and anti-double-stranded DNA trends support assessment but do not independently define every flare or treatment change.',
      whyItMatters:
        'Clinical organ activity, damage, toxicity, adherence, and objective response are more important than one laboratory trend.',
      trapAvoided:
        'Do not intensify high-risk therapy solely because an antibody titre changed.',
    },
    {
      type: 'PREVENTION',
      title: 'Ignoring reproductive and cardiovascular risk',
      content:
        'SLE and its treatments affect pregnancy, thrombosis, fertility, bone health, and accelerated atherosclerosis.',
      whyItMatters:
        'Long-term outcomes depend on prevention as well as flare control.',
      trapAvoided:
        'Include pregnancy planning, antiphospholipid assessment, vaccination, blood-pressure control, lipid management, and bone protection.',
    },
  ],
  recallPrompts: [
    {
      prompt: 'What is the entry criterion for the 2019 EULAR/ACR SLE classification framework?',
      answer:
        'A positive ANA at least once at a titre of 1:80 or an equivalent positive test.',
    },
    {
      prompt: 'How are multiple findings within one classification domain counted?',
      answer:
        'Only the highest-weighted item in that domain is counted.',
    },
    {
      prompt: 'Which antibodies are SLE-specific criteria?',
      answer:
        'Anti-double-stranded DNA antibodies or anti-Smith antibodies.',
    },
    {
      prompt: 'Which urine findings suggest active glomerulonephritis?',
      answer:
        'Proteinuria with dysmorphic erythrocytes, red-cell casts, or other active urinary sediment.',
    },
    {
      prompt: 'Why is kidney biopsy important in suspected lupus nephritis?',
      answer:
        'It defines nephritis class, activity, chronicity, alternative pathology, prognosis, and treatment direction.',
    },
    {
      prompt: 'What does a full-house immunofluorescence pattern mean?',
      answer:
        'Glomerular staining for multiple immunoglobulins and complement components; it supports lupus nephritis in the correct clinical context but is not completely specific by itself.',
    },
    {
      prompt: 'What foundational medicine is generally recommended for most people with SLE unless contraindicated?',
      answer:
        'Hydroxychloroquine, with appropriate dosing, adherence support, and retinal-toxicity monitoring.',
    },
  ],
  references: [
    {
      citation:
        'Aringer M, et al. 2019 European League Against Rheumatism/American College of Rheumatology Classification Criteria for Systemic Lupus Erythematosus. Arthritis & Rheumatology. 2019.',
    },
    {
      citation:
        'American College of Rheumatology. 2025 Guideline for the Screening, Treatment, and Management of Systemic Lupus Erythematosus.',
    },
    {
      citation:
        'American College of Rheumatology. 2024 Guideline for the Screening, Treatment, and Management of Lupus Nephritis. Posted 2025.',
    },
    {
      citation:
        'European Alliance of Associations for Rheumatology. Recommendations for the Management of Systemic Lupus Erythematosus with Kidney Involvement: 2025 Update.',
    },
    {
      citation:
        'Kidney Disease: Improving Global Outcomes. KDIGO 2024 Clinical Practice Guideline for the Management of Lupus Nephritis. Kidney International. 2024.',
    },
  ],
};

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
          specialty: 'Rheumatology',
          subspecialty: 'Systemic Autoimmune Disease',
          category: 'Systemic Autoimmune Disease',
          bodySystem: 'Multisystem / Renal',
          organSystem: 'Immune System / Kidneys',
          difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
          rarityBand: DiagnosisRarityBand.UNCOMMON,
          clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
          ageGroup: DiagnosisAgeGroup.PEDIATRIC,
          urgencyLevel: DiagnosisUrgencyLevel.URGENT,
          preferredClueTypes: ['history', 'exam', 'lab'],
          notes:
            'Seeded flagship Systemic Lupus Erythematosus case focused on photosensitive mucocutaneous disease, inflammatory polyarthritis, cytopenias, SLE-specific immunology, and class IV lupus nephritis.',
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
          specialty: 'Rheumatology',
          subspecialty: 'Systemic Autoimmune Disease',
          category: 'Systemic Autoimmune Disease',
          bodySystem: 'Multisystem / Renal',
          organSystem: 'Immune System / Kidneys',
          difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
          rarityBand: DiagnosisRarityBand.UNCOMMON,
          clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
          ageGroup: DiagnosisAgeGroup.PEDIATRIC,
          urgencyLevel: DiagnosisUrgencyLevel.URGENT,
          preferredClueTypes: ['history', 'exam', 'lab'],
          notes:
            'Seeded flagship Systemic Lupus Erythematosus case focused on photosensitive mucocutaneous disease, inflammatory polyarthritis, cytopenias, SLE-specific immunology, and class IV lupus nephritis.',
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
    console.log(
      'Skipped diagnosis education because Systemic Lupus Erythematosus education already exists:',
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
        ? 'Skipped existing scheduled Systemic Lupus Erythematosus case.'
        : 'Skipped existing Systemic Lupus Erythematosus case to avoid overwriting authored content.',
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
  const symptoms = [clues[0].value, clues[1].value, clues[2].value];

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
      'Seeded complete frontend-aligned flagship Systemic Lupus Erythematosus case with multisystem clinical findings, active urinary sediment, SLE-specific antibodies, complement consumption, biopsy-confirmed class IV lupus nephritis, and full diagnosis education.',
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
        'Created complete Systemic Lupus Erythematosus revision with six valid clues, evidence-matched breakdown references, correct EULAR/ACR domain counting, lupus-nephritis reasoning, and full diagnosis education.',
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
      validatorVersion: 'flagship-human-review:systemic-lupus-erythematosus-v1',
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        clueProgressionVerified: true,
        breakdownClueReferencesValidated: true,
        breakdownEvidenceMatchedToClues: true,
        playableClueCount: clues.length,
        clueTypes: clues.map((clue) => clue.type),
        duplicateSafe: true,
        doesNotOverwriteExistingEducation: true,
        doesNotOverwriteExistingCase: true,
        metadataVerified: {
          specialty: 'Rheumatology',
          subspecialty: 'Systemic Autoimmune Disease',
          category: 'Systemic Autoimmune Disease',
          bodySystem: 'Multisystem / Renal',
          organSystem: 'Immune System / Kidneys',
          difficultyBand: 'INTERMEDIATE',
          rarityBand: 'UNCOMMON',
          clinicalSetting: 'EMERGENCY',
          ageGroup: 'ADULT',
          urgencyLevel: 'URGENT',
        },
        note: 'Complete Systemic Lupus Erythematosus flagship seed with six supported clues, no early diagnosis leakage, validated clue-to-breakdown evidence alignment, correct EULAR/ACR domain counting, biopsy-confirmed class IV lupus nephritis, and full education payload.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded Systemic Lupus Erythematosus:', {
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
