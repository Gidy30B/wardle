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
 * FLAGSHIP CASE SEED — Pemphigus Vulgaris
 *
 * Clinical focus:
 * - Persistent painful oral erosions preceding fragile flaccid skin blisters.
 * - Friction-induced superficial epidermal separation and non-scarring erosions.
 * - Suprabasal acantholysis and intercellular epidermal IgG/C3.
 * - Distinction from pemphigoid, paraneoplastic, infectious, linear IgA, and necrolytic disorders.
 *
 * Safety:
 * - Reuses or creates the exact diagnosis registry and accepted aliases.
 * - Does not overwrite existing diagnosis education.
 * - Does not overwrite an existing case with the same title.
 * - Does not alter a scheduled DailyCase.
 *
 * Run:
 *   npx tsx prisma/seed/flagship-pemphigus-vulgaris.seed.ts
 *
 * Railway:
 *   railway run npx tsx prisma/seed/flagship-pemphigus-vulgaris.seed.ts
 */

const databaseUrl = resolvePgConnectionString(process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required to run the Pemphigus Vulgaris seed.',
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
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 11, 3, 12, 0, 0));
const seedVersion = 'flagship-pemphigus-vulgaris-v1';

const canonicalName = 'pemphigus vulgaris';
const displayLabel = 'Pemphigus Vulgaris';
const caseTitle = 'Painful Oral Erosions with Fragile Blisters';

const taxonomy = {
  specialty: 'Dermatology',
  subspecialty: 'Autoimmune Blistering Disease',
  category: 'Intraepidermal Blistering Disorder',
  bodySystem: 'Integumentary',
  organSystem: 'Skin and Mucous Membranes',
} as const;

const aliasTerms = [
  'Pemphigus Vulgaris',
  'pemphigus vulgaris',
  'PV',
  'Mucocutaneous Pemphigus Vulgaris',
  'Mucosal Pemphigus Vulgaris',
];

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 47-year-old woman has had six weeks of painful oral erosions that make eating difficult. Ten days ago she developed fragile blisters on the scalp, upper chest, and back. She takes no new medicines, has had no recent infection, reports no similar illness in household contacts, and has no unintentional weight loss.',
  },
  {
    order: 1,
    type: 'symptom',
    value:
      'The blisters arise on apparently normal skin, rupture with minor friction, and leave painful raw areas. Pain is more prominent than itch. She denies conjunctival inflammation, genital erosions, fever, sore throat, or malaise.',
  },
  {
    order: 2,
    type: 'exam',
    value:
      'Oral examination shows multiple irregular erosions on the buccal mucosa and palate. The scalp and trunk have flaccid bullae and crusted erosions; gentle lateral pressure on clinically normal-appearing perilesional skin extends the superficial separation. There are no tense bullae, target lesions, honey-coloured crusts, or skin detachment over large confluent areas.',
  },
  {
    order: 3,
    type: 'vital',
    value:
      'Temperature is 36.8 C, pulse 92/min, blood pressure 118/72 mmHg, respiratory rate 16/min, and oxygen saturation 99% on room air. She is alert and mildly dehydrated. Erosions involve approximately 8% of body surface area, with no purulent exudate, lymphadenopathy, ocular scarring, or respiratory involvement.',
  },
  {
    order: 4,
    type: 'lab',
    value:
      'Histopathology from the edge of a fresh blister shows a suprabasal intraepidermal split with acantholytic keratinocytes. Basal keratinocytes remain attached to the basement membrane in a row-of-tombstones pattern, without a full-thickness epidermal necrosis pattern.',
  },
  {
    order: 5,
    type: 'lab',
    value:
      'Direct immunofluorescence of perilesional skin shows intercellular IgG and C3 throughout the epidermis in a net-like pattern. Serum ELISA detects high titres of anti-desmoglein 3 and anti-desmoglein 1 antibodies, confirming the autoimmune intraepidermal blistering disorder.',
  },
] as const;

const differentials = [
  'Bullous Pemphigoid',
  'Mucous Membrane Pemphigoid',
  'Paraneoplastic Pemphigus',
  'Linear IgA Bullous Dermatosis',
  'Stevens-Johnson Syndrome',
  'Bullous Impetigo',
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
  'Painful oral erosions preceding a blistering skin eruption suggest an autoimmune mucocutaneous blistering disease rather than an isolated infectious or irritant disorder.',
  'Fragile blisters that rupture with minor friction and cause more pain than itch indicate a superficial epidermal split rather than the deeper, tense blister of a subepidermal disorder.',
  'Flaccid bullae, widespread erosions, mucosal involvement, and extension of superficial separation with lateral pressure create the classic clinical pattern of keratinocyte adhesion failure.',
  'Clinical stability without fever, purulent exudate, large confluent detachment, or prominent systemic illness lowers the probability of bacterial toxin disease and severe epidermal necrolysis while identifying dehydration as an immediate complication.',
  'Suprabasal acantholysis with basal keratinocytes remaining attached to the basement membrane localizes the structural failure to desmosomal adhesion within the epidermis.',
  'Intercellular epidermal IgG and C3 with anti-desmoglein 3 and 1 antibodies establishes Pemphigus Vulgaris with mucocutaneous involvement.',
] as const;

const diagnosticContributions = [
  'Establishes a mucosal-first course typical of a desmosomal autoimmune blistering disorder.',
  'Localizes the blister plane clinically to a fragile superficial epidermal roof.',
  'Adds the characteristic morphology and friction-induced extension of epidermal separation.',
  'Assesses severity and reduces competing infectious or epidermal-necrolysis explanations.',
  'Provides the defining histological level and mechanism of acantholysis.',
  'Provides disease-specific immunopathological and serological confirmation.',
] as const;

const differentialAnalysis: DifferentialAnalysisEntry[] = [
  {
    diagnosis: 'Bullous Pemphigoid',
    whyPlausibleEarly:
      'Both disorders can cause an autoimmune blistering eruption in adults and may initially appear as widespread erosions after blisters rupture.',
    ruledOutByClues: [
      {
        clueOrder: 2,
        evidence: 'flaccid bullae',
        reason:
          'Bullous pemphigoid usually produces tense pruritic bullae because its split is subepidermal.',
      },
      {
        clueOrder: 4,
        evidence: 'suprabasal intraepidermal split',
        reason:
          'The intraepidermal suprabasal split conflicts with the subepidermal blister of bullous pemphigoid.',
      },
    ],
    finalReasonLessLikely:
      'Prominent early oral disease, flaccid bullae, suprabasal acantholysis, and intercellular epidermal immunoreactants favor the target diagnosis.',
  },
  {
    diagnosis: 'Mucous Membrane Pemphigoid',
    whyPlausibleEarly:
      'Both can begin with painful oral erosions and may involve additional mucosal surfaces.',
    ruledOutByClues: [
      {
        clueOrder: 3,
        evidence: 'no purulent exudate, lymphadenopathy, ocular scarring, or respiratory involvement',
        reason:
          'Absence of scarring mucosal disease reduces a pemphigoid disorder whose major danger is cicatricial ocular or airway injury.',
      },
      {
        clueOrder: 5,
        evidence: 'intercellular IgG and C3 throughout the epidermis',
        reason:
          'Mucous membrane pemphigoid instead shows immunoreactants along the basement-membrane zone.',
      },
    ],
    finalReasonLessLikely:
      'The non-scarring mucocutaneous phenotype and intercellular rather than linear basement-membrane immunofluorescence favor the target diagnosis.',
  },
  {
    diagnosis: 'Paraneoplastic Pemphigus',
    whyPlausibleEarly:
      'Both may cause severe painful stomatitis with a polymorphous blistering or erosive eruption.',
    ruledOutByClues: [
      {
        clueOrder: 0,
        evidence: 'has no unintentional weight loss',
        reason:
          'No constitutional clue suggests an occult lymphoproliferative or other associated neoplasm, although absence alone does not exclude it.',
      },
      {
        clueOrder: 4,
        evidence: 'without a full-thickness epidermal necrosis pattern',
        reason:
          'Paraneoplastic pemphigus often has a mixed interface and keratinocyte-necrosis pattern in addition to acantholysis.',
      },
    ],
    finalReasonLessLikely:
      'The straightforward suprabasal acantholytic pattern and desmoglein profile, without neoplastic or severe polymorphous clues, favor classic pemphigus vulgaris.',
  },
  {
    diagnosis: 'Linear IgA Bullous Dermatosis',
    whyPlausibleEarly:
      'Both can involve skin and mucosa and may produce widespread blistering lesions.',
    ruledOutByClues: [
      {
        clueOrder: 5,
        evidence: 'intercellular IgG and C3 throughout the epidermis',
        reason:
          'Linear IgA bullous dermatosis requires linear IgA deposition at the basement-membrane zone rather than intercellular IgG.',
      },
    ],
    finalReasonLessLikely:
      'The immunofluorescence class and location directly oppose linear IgA bullous dermatosis.',
  },
  {
    diagnosis: 'Stevens-Johnson Syndrome',
    whyPlausibleEarly:
      'Both can cause painful oral erosions, epidermal fragility, and widespread denuded skin.',
    ruledOutByClues: [
      {
        clueOrder: 0,
        evidence: 'takes no new medicines, has had no recent infection',
        reason:
          'The absence of a typical medication or infectious trigger lowers the probability of acute epidermal necrolysis.',
      },
      {
        clueOrder: 2,
        evidence: 'There are no tense bullae, target lesions, honey-coloured crusts, or skin detachment over large confluent areas',
        reason:
          'The absence of targetoid lesions and confluent epidermal detachment argues against Stevens-Johnson syndrome.',
      },
    ],
    finalReasonLessLikely:
      'A six-week mucosal-first course with suprabasal acantholysis and intercellular IgG is incompatible with the acute full-thickness necrosis pattern of Stevens-Johnson syndrome.',
  },
  {
    diagnosis: 'Bullous Impetigo',
    whyPlausibleEarly:
      'Both can cause superficial fragile bullae that rupture and leave erosions or crusts.',
    ruledOutByClues: [
      {
        clueOrder: 2,
        evidence: 'no tense bullae, target lesions, honey-coloured crusts, or skin detachment over large confluent areas',
        reason:
          'The lack of characteristic honey-coloured crusting and the prominent oral disease argue against bullous impetigo.',
      },
      {
        clueOrder: 5,
        evidence: 'anti-desmoglein 3 and anti-desmoglein 1 antibodies',
        reason:
          'Disease-specific autoantibodies identify an autoimmune rather than staphylococcal toxin-mediated process.',
      },
    ],
    finalReasonLessLikely:
      'Chronic painful mucosal disease, autoimmune immunofluorescence, and desmoglein antibodies exclude bullous impetigo.',
  },
];

const explanation = {
  diagnosis: displayLabel,
  summary:
    'A mucosal-first course followed by fragile flaccid bullae, friction-induced epidermal separation, suprabasal acantholysis, and intercellular epidermal IgG and C3 with anti-desmoglein antibodies establishes Pemphigus Vulgaris.',
  reasoning: reasoningSteps.join('\n'),
  keyFindings: [
    'Painful oral erosions preceding skin disease',
    'Fragile flaccid bullae',
    'Pain more prominent than itch',
    'Friction-induced extension of superficial epidermal separation',
    'Suprabasal acantholysis',
    'Row-of-tombstones basal keratinocytes',
    'Intercellular epidermal IgG and C3',
    'Anti-desmoglein 3 and 1 antibodies',
  ],
  differentials,
  differentialAnalysis,
  clueBreakdown: clues.map((clue, index) => ({
    clueOrder: clue.order,
    clueType: clue.type,
    clue: clue.value,
    explanation: reasoningSteps[index],
    diagnosticContribution: diagnosticContributions[index],
  })),
  clinicalPearl:
    'For suspected autoimmune blistering disease, take routine histology from the edge of a fresh lesion and direct immunofluorescence from intact perilesional tissue; an eroded specimen can destroy the diagnostic immunoreactant pattern.',
  managementPearl:
    'Pemphigus vulgaris requires specialist dermatology care, supportive wound and oral management, rapid disease control with systemic therapy, and a steroid-sparing strategy—commonly rituximab for moderate-to-severe disease—while actively preventing infection and treatment toxicity.',
  generationQuality: {
    contentTier: 'FLAGSHIP',
    seedVersion,
    humanReviewed: true,
    discriminatorStrength: 'HIGH',
    expectedTeachingPoints: [
      'Recognize painful oral erosions that precede fragile flaccid skin blisters',
      'Understand that suprabasal acantholysis produces the clinical fragility and Nikolsky phenomenon',
      'Use lesional histology and perilesional direct immunofluorescence correctly',
      'Interpret anti-desmoglein 3 and 1 antibodies in relation to mucosal and cutaneous disease',
      'Separate pemphigus vulgaris from subepidermal, infectious, paraneoplastic, and epidermal-necrolysis disorders',
      'Treat systemic disease while preventing infection, dehydration, malnutrition, and immunosuppressive toxicity',
    ],
    competencyDomains: [
      'Dermatology',
      'Autoimmune Blistering Disease',
      'Oral Medicine',
      'Dermatopathology',
      'Clinical Reasoning',
    ],
  },
};

const educationForFrontend = {
  title: displayLabel,
  summary: {
    definition:
      'Pemphigus vulgaris is an autoimmune intraepidermal blistering disease caused mainly by IgG autoantibodies against desmoglein 3, often with desmoglein 1. Loss of desmosomal adhesion produces suprabasal acantholysis, painful mucosal erosions, and fragile flaccid skin blisters.',
    highYieldTakeaway:
      'Think of pemphigus vulgaris when persistent painful oral erosions precede fragile flaccid bullae. Confirm with suprabasal acantholysis on lesional histology and intercellular epidermal IgG or C3 on perilesional direct immunofluorescence.',
  },
  recognitionPattern: [
    {
      id: 'mucosal-first-pattern',
      type: 'PATTERN_RECOGNITION',
      title: 'Mucosal disease often comes first',
      content:
        'Persistent painful oral erosions commonly precede cutaneous blisters because desmoglein 3 is a major adhesion protein in mucosal epithelium.',
      whyItMatters:
        'Recognizing the sequence prevents weeks of treating the oral disease as aphthae, candidiasis, or nonspecific stomatitis while autoimmune blistering progresses.',
      discriminator:
        'Persistent widespread irregular erosions rather than a few recurrent discrete aphthous ulcers.',
      trapAvoided:
        'Do not wait for intact skin blisters before considering an autoimmune blistering disorder.',
    },
    {
      id: 'superficial-fragile-blister-pattern',
      type: 'PATTERN_RECOGNITION',
      title: 'Fragile superficial blister roof',
      content:
        'Suprabasal loss of keratinocyte adhesion leaves only the upper epidermis as the blister roof, so bullae are flaccid, rupture easily, and often present as erosions rather than intact blisters.',
      whyItMatters:
        'Blister tension is a bedside clue to the level of tissue separation and helps distinguish intraepidermal pemphigus from subepidermal pemphigoid disorders.',
      discriminator:
        'Flaccid easily ruptured bullae rather than tense pruritic bullae.',
      trapAvoided:
        'Do not exclude pemphigus merely because few intact blisters remain at examination.',
    },
    {
      id: 'desmosomal-autoimmunity-pattern',
      type: 'PATTERN_RECOGNITION',
      title: 'Desmosomal adhesion failure',
      content:
        'Anti-desmoglein antibodies disrupt keratinocyte adhesion, producing acantholysis clinically, a suprabasal split histologically, and intercellular epidermal immunoreactants on direct immunofluorescence.',
      whyItMatters:
        'The same mechanism connects the bedside morphology, histology, immunofluorescence, and serology into one coherent diagnostic model.',
      discriminator:
        'Intercellular epidermal autoimmunity rather than linear basement-membrane autoimmunity.',
      trapAvoided:
        'Do not interpret each test in isolation from the blister level and morphology.',
    },
  ],
  keySymptoms: [
    {
      finding: 'Painful oral erosions',
      whyItMatters:
        'Mucosal epithelial separation exposes richly innervated tissue and can make eating, drinking, and oral hygiene difficult.',
      diagnosticImpact:
        'Persistent multifocal oral erosions before skin disease strongly raise suspicion for pemphigus vulgaris.',
      discriminator:
        'Painful irregular widespread erosions rather than predominantly itchy skin disease or isolated recurrent aphthae.',
    },
    {
      finding: 'Painful skin erosions',
      whyItMatters:
        'Fragile bullae often rupture before review, leaving raw tender surfaces rather than obvious intact blisters.',
      diagnosticImpact:
        'Painful denudation with little itch supports an erosive intraepidermal process.',
      discriminator:
        'Pain-dominant erosions rather than the intense itch that often precedes bullous pemphigoid bullae.',
    },
    {
      finding: 'Difficulty eating or swallowing',
      whyItMatters:
        'Oral and pharyngeal erosions can reduce intake and cause dehydration, weight loss, or malnutrition.',
      diagnosticImpact:
        'Functional impact helps grade disease severity and determines whether inpatient supportive care is needed.',
      discriminator:
        'Reduced intake from persistent mucosal erosions rather than nausea or gastrointestinal obstruction.',
    },
  ],
  keySigns: [
    {
      id: 'oral-irregular-erosions',
      finding: 'Irregular oral erosions',
      description:
        'Fragile mucosal blisters rupture rapidly because suprabasal keratinocyte adhesion is lost, so intact oral vesicles are uncommon and broad irregular erosions predominate.',
      whyItMatters:
        'The morphology and persistence shift probability toward an autoimmune blistering disease rather than isolated aphthous ulceration.',
      diagnosticImpact:
        'Mucosal-predominant disease strongly supports desmoglein 3 involvement.',
      discriminator:
        'Broad ragged erosions rather than discrete round ulcers with a clean erythematous halo.',
      trapAvoided:
        'Do not require visible intact oral blisters before suspecting pemphigus.',
    },
    {
      id: 'flaccid-bullae',
      finding: 'Flaccid bullae',
      description:
        'The blister lies within the epidermis, so its roof is thin and collapses because only superficial epidermal layers cover the fluid cavity.',
      whyItMatters:
        'Blister flaccidity is a practical clue to an intraepidermal split.',
      diagnosticImpact:
        'It favors pemphigus over bullous pemphigoid and other subepidermal disorders that retain the full epidermis as a tense roof.',
      discriminator:
        'Easily ruptured flaccid blister rather than a firm tense blister.',
      trapAvoided:
        'Do not classify the disease from crusts alone; inspect the edge of a fresh lesion.',
    },
    {
      id: 'nikolsky-phenomenon',
      finding: 'Positive Nikolsky sign',
      description:
        'Tangential pressure extends superficial epidermal separation because acantholysis has weakened keratinocyte-to-keratinocyte adhesion beyond the visible blister margin.',
      whyItMatters:
        'The sign demonstrates clinically active epidermal fragility and helps select a fresh perilesional site for biopsy.',
      diagnosticImpact:
        'It supports an intraepidermal or necrolytic process but is not specific by itself.',
      discriminator:
        'Friction-induced extension of the superficial split rather than a stable tense subepidermal roof.',
      trapAvoided:
        'Do not treat a positive Nikolsky sign as diagnostic without histology and immunofluorescence.',
    },
    {
      id: 'non-scarring-healing',
      finding: 'Healing without primary scarring',
      description:
        'The split is superficial to the basement membrane, so re-epithelialization usually occurs without the cicatricial damage typical of deeper mucous membrane pemphigoid.',
      whyItMatters:
        'The healing pattern helps distinguish superficial intraepidermal disease from scarring subepidermal mucosal disorders.',
      diagnosticImpact:
        'Absence of ocular or mucosal scarring reduces mucous membrane pemphigoid, although early disease still requires careful examination.',
      discriminator:
        'Non-scarring erosions rather than progressive conjunctival, oral, or airway cicatrization.',
      trapAvoided:
        'Do not overlook ocular, nasal, genital, or laryngeal examination when symptoms suggest additional mucosal disease.',
    },
  ],
  examPearls: [
    {
      id: 'nikolsky-mechanism',
      type: 'EXAM',
      title: 'Nikolsky sign reflects acantholysis',
      content:
        'Gentle tangential pressure produces or extends an erosion because autoantibody-mediated loss of desmosomal adhesion has weakened clinically normal-appearing epidermis.',
      whyItMatters:
        'This mechanism raises suspicion for an active intraepidermal blistering process but does not distinguish pemphigus from every necrolytic disorder.',
      discriminator:
        'Superficial shearing with a fragile roof rather than a stable tense subepidermal blister.',
      trapAvoided:
        'Do not repeatedly provoke the sign over large areas because additional trauma creates avoidable erosions.',
    },
    {
      id: 'blister-tension-mechanism',
      type: 'EXAM',
      title: 'Blister tension localizes the split',
      content:
        'A flaccid blister forms because the split is suprabasal and only a thin superficial epidermal roof remains, whereas a subepidermal blister retains the entire epidermis and is usually tense.',
      whyItMatters:
        'The mechanical difference narrows the differential before pathology results return.',
      discriminator:
        'Flaccid pain-dominant bullae over tense itch-dominant bullae.',
      trapAvoided:
        'Do not infer blister level from an old eroded lesion with no remaining roof.',
    },
    {
      id: 'mucosal-distribution-mechanism',
      type: 'EXAM',
      title: 'Mucosal involvement reflects desmoglein distribution',
      content:
        'Prominent oral disease occurs because desmoglein 3 is important for mucosal keratinocyte adhesion and its loss is not fully compensated by desmoglein 1 in mucosa.',
      whyItMatters:
        'The mucosal-first phenotype raises suspicion for pemphigus vulgaris over pemphigus foliaceus, which generally spares mucosa.',
      discriminator:
        'Persistent mucosal erosions rather than a purely superficial seborrhoeic skin eruption.',
      trapAvoided:
        'Do not label a patient with pemphigus foliaceus when meaningful mucosal disease is present.',
    },
    {
      id: 'erosion-infection-check',
      type: 'EXAM',
      title: 'Examine erosions for secondary infection',
      content:
        'Purulence, expanding erythema, warmth, malodour, or systemic instability indicates bacterial colonization may have progressed to infection through the disrupted epidermal barrier.',
      whyItMatters:
        'Infection can mimic disease activity and becomes more dangerous once systemic immunosuppression begins.',
      discriminator:
        'New inflammatory change or systemic illness rather than clean painful autoimmune erosions alone.',
      managementImplication:
        'Culture suspicious lesions and treat infection while reassessing immunosuppressive intensity.',
      trapAvoided:
        'Do not automatically escalate immunosuppression for every new crusted lesion.',
    },
  ],
  scoringSystems: [
    {
      id: 'pdai',
      name: 'Pemphigus Disease Area Index',
      use:
        'Quantifies activity and damage across skin, scalp, and mucosal sites to document baseline severity and response over time.',
      components: [
        'Skin activity',
        'Scalp activity',
        'Mucosal activity',
        'Skin damage or post-inflammatory change',
      ],
      caution:
        'PDAI measures severity and treatment response; it does not replace diagnostic histology and immunofluorescence.',
    },
  ],
  investigations: [
    {
      id: 'lesional-histology',
      type: 'INVESTIGATION',
      title: 'Lesional histopathology',
      content:
        'Biopsy the edge of a fresh blister for routine histology; the expected finding is suprabasal acantholysis with basal keratinocytes remaining attached to the basement membrane.',
      whyItMatters:
        'The finding localizes the split within the epidermis and supports desmosomal adhesion failure.',
      discriminator:
        'Suprabasal acantholysis rather than a subepidermal split or full-thickness keratinocyte necrosis.',
      managementImplication:
        'Use histology together with direct immunofluorescence rather than as a standalone diagnosis.',
      trapAvoided:
        'Do not biopsy only the centre of an old eroded lesion because the diagnostic architecture may be lost.',
    },
    {
      id: 'perilesional-dif',
      type: 'INVESTIGATION',
      title: 'Perilesional direct immunofluorescence',
      content:
        'Biopsy intact perilesional skin or appropriately selected mucosa; the expected finding is intercellular epidermal IgG, usually with C3, in a net-like pattern.',
      whyItMatters:
        'This demonstrates tissue-bound autoantibodies in their anatomical location and is the key confirmatory investigation.',
      discriminator:
        'Intercellular epidermal staining rather than linear basement-membrane-zone staining.',
      managementImplication:
        'Send the specimen in the correct transport medium and repeat from a better site when clinicopathological suspicion remains high after a negative result.',
      trapAvoided:
        'Do not take direct immunofluorescence from the eroded centre, where immunoreactants may be destroyed.',
    },
    {
      id: 'desmoglein-elisa',
      type: 'INVESTIGATION',
      title: 'Desmoglein 1 and 3 ELISA',
      content:
        'Serum testing may show anti-desmoglein 3 antibodies in mucosal disease and both anti-desmoglein 3 and 1 antibodies in mucocutaneous disease.',
      whyItMatters:
        'The antibody profile supports diagnosis, helps explain phenotype, and may assist longitudinal monitoring when interpreted with clinical activity.',
      discriminator:
        'Desmoglein-directed antibodies rather than BP180, BP230, or linear IgA patterns of major mimics.',
      managementImplication:
        'Use titres as complementary data; treatment decisions should follow clinical disease activity rather than serology alone.',
      trapAvoided:
        'Do not replace direct immunofluorescence with ELISA when the diagnosis is uncertain.',
    },
    {
      id: 'treatment-baseline-screening',
      type: 'INVESTIGATION',
      title: 'Baseline assessment before systemic immunosuppression',
      content:
        'Full blood count, renal and liver tests, infection screening, vaccination review, pregnancy assessment when relevant, and bone-health risk evaluation identify treatment constraints and preventable complications.',
      whyItMatters:
        'Systemic corticosteroids, rituximab, azathioprine, and mycophenolate have different infection, marrow, hepatic, reproductive, and metabolic risks.',
      discriminator:
        'Safety screening does not confirm pemphigus but determines which induction and maintenance options can be used safely.',
      managementImplication:
        'Complete drug-specific screening and prevention measures before or alongside urgent therapy according to disease severity.',
      trapAvoided:
        'Do not begin prolonged immunosuppression without a documented safety and monitoring plan.',
    },
  ],
  differentialDistinguishers: [
    {
      id: 'bullous-pemphigoid-differential',
      type: 'HIGH_YIELD_DISCRIMINATOR',
      title: 'Bullous Pemphigoid',
      content:
        'Both are autoimmune blistering diseases in adults, but bullous pemphigoid more often causes intense itch and tense bullae with less prominent mucosal disease.',
      whyItMatters:
        'The distinction predicts a different blister level, immunofluorescence pattern, disease course, and treatment discussion.',
      discriminator:
        'Subepidermal split with linear basement-membrane IgG or C3 rather than suprabasal acantholysis with intercellular epidermal IgG.',
      managementImplication:
        'Choose biopsy sites and serology that test the blister level and immunological target rather than treating morphology alone.',
      trapAvoided:
        'Calling every autoimmune blistering disease pemphigoid in an older adult.',
    },
    {
      id: 'mucous-membrane-pemphigoid-differential',
      type: 'HIGH_YIELD_DISCRIMINATOR',
      title: 'Mucous Membrane Pemphigoid',
      content:
        'Both can produce chronic painful oral erosions, but mucous membrane pemphigoid is a subepidermal disease with greater risk of scarring at ocular, oral, genital, and airway sites.',
      whyItMatters:
        'Missing cicatricial ocular or laryngeal involvement can cause irreversible visual or airway harm.',
      discriminator:
        'Scarring mucosal disease with linear basement-membrane immunoreactants rather than non-scarring suprabasal acantholysis and intercellular staining.',
      managementImplication:
        'Perform symptom-directed ocular and airway assessment urgently when scarring disease is possible.',
      trapAvoided:
        'Assuming all chronic oral erosions with few skin lesions are pemphigus vulgaris.',
    },
    {
      id: 'paraneoplastic-pemphigus-differential',
      type: 'HIGH_YIELD_DISCRIMINATOR',
      title: 'Paraneoplastic Pemphigus',
      content:
        'Both can cause severe stomatitis and blistering, but paraneoplastic pemphigus often has refractory mucositis, polymorphous lesions, interface dermatitis, keratinocyte necrosis, and an associated neoplasm.',
      whyItMatters:
        'Recognition changes the investigation toward an underlying tumour and alerts the team to serious pulmonary and systemic complications.',
      discriminator:
        'Mixed acantholytic-interface pathology and broader autoantibody targets with neoplastic context rather than classic suprabasal acantholysis alone.',
      managementImplication:
        'Investigate for an associated neoplasm when clinical, pathological, or serological features are atypical for classic pemphigus vulgaris.',
      trapAvoided:
        'Labeling severe refractory stomatitis as ordinary pemphigus without reviewing systemic context.',
    },
    {
      id: 'linear-iga-differential',
      type: 'HIGH_YIELD_DISCRIMINATOR',
      title: 'Linear IgA Bullous Dermatosis',
      content:
        'Both may involve skin and mucosa, but linear IgA disease often has tense annular or clustered blisters and linear IgA at the basement-membrane zone.',
      whyItMatters:
        'The immunoreactant class and location identify a distinct disease with a different treatment pathway.',
      discriminator:
        'Linear IgA basement-membrane staining rather than intercellular epidermal IgG and C3.',
      managementImplication:
        'Confirm the direct immunofluorescence pattern before selecting disease-specific systemic therapy.',
      trapAvoided:
        'Using the presence of mucosal lesions alone to identify the autoimmune blistering disease.',
    },
    {
      id: 'sjs-differential',
      type: 'HIGH_YIELD_DISCRIMINATOR',
      title: 'Stevens-Johnson Syndrome',
      content:
        'Both can cause painful mucosal erosions and epidermal detachment, but Stevens-Johnson syndrome is usually acute, systemically unwell, trigger-associated, and characterized by targetoid lesions and full-thickness epidermal necrosis.',
      whyItMatters:
        'The acute necrolysis pathway requires immediate withdrawal of the culprit and critical supportive care rather than routine escalation of chronic autoimmune blistering therapy.',
      discriminator:
        'Acute targetoid necrolysis with full-thickness keratinocyte death rather than a chronic mucosal-first suprabasal acantholytic process.',
      managementImplication:
        'Review medication and infection exposure and obtain urgent pathology when the tempo or morphology suggests epidermal necrolysis.',
      trapAvoided:
        'Using a positive Nikolsky sign as proof of pemphigus.',
    },
    {
      id: 'bullous-impetigo-differential',
      type: 'HIGH_YIELD_DISCRIMINATOR',
      title: 'Bullous Impetigo',
      content:
        'Both can form superficial fragile bullae through disruption of desmoglein 1, but bullous impetigo is toxin-mediated, often localized, and commonly develops characteristic crusting without chronic oral disease.',
      whyItMatters:
        'Confusing infection with autoimmunity can either delay antibiotics or expose a patient to inappropriate immunosuppression.',
      discriminator:
        'Positive bacterial culture and toxin-mediated superficial cleavage rather than intercellular autoantibodies and anti-desmoglein serology.',
      managementImplication:
        'Culture suspicious lesions when infection is plausible before escalating immunosuppression.',
      trapAvoided:
        'Assuming every superficial acantholytic blister is autoimmune.',
    },
  ],
  managementOverview: [
    {
      id: 'specialist-severity-assessment',
      type: 'MANAGEMENT',
      title: 'Coordinate specialist care and assess severity',
      content:
        'Arrange dermatology-led care when pemphigus vulgaris is suspected or confirmed, and assess mucosal intake, body-surface involvement, infection, pain, airway symptoms, and functional compromise.',
      whyItMatters:
        'Severity determines whether outpatient therapy is safe or admission is needed for hydration, nutrition, wound care, analgesia, and rapid systemic treatment.',
      managementImplication:
        'Document baseline activity with a reproducible tool such as PDAI and identify urgent supportive-care needs.',
      escalationImplication:
        'Admit or escalate urgently for dehydration, extensive denudation, infection, airway involvement, or inability to maintain oral intake.',
      trapAvoided:
        'Do not grade severity only by the number of intact blisters because most lesions may already be eroded.',
    },
    {
      id: 'rapid-disease-control',
      type: 'MANAGEMENT',
      title: 'Induce rapid disease control',
      content:
        'Use systemic corticosteroid therapy when active clinically significant disease requires rapid suppression, with dose and route individualized to severity and comorbidity.',
      whyItMatters:
        'Rapid control stops new blister formation and allows existing erosions to heal while slower steroid-sparing therapy takes effect.',
      managementImplication:
        'Define disease control as cessation of new lesions with healing of established lesions, then taper rather than maintaining unnecessarily high exposure.',
      escalationImplication:
        'Continued new blistering despite appropriate induction requires reassessment of diagnosis, infection, adherence, and treatment intensity.',
      trapAvoided:
        'Do not continue high-dose corticosteroids indefinitely without a taper and toxicity-prevention plan.',
    },
    {
      id: 'rituximab-steroid-sparing',
      type: 'MANAGEMENT',
      title: 'Use an effective steroid-sparing strategy',
      content:
        'Consider rituximab with short-term corticosteroid therapy as a first-line option for moderate-to-severe pemphigus vulgaris when screening and access permit.',
      whyItMatters:
        'B-cell depletion improves disease control and reduces cumulative corticosteroid exposure in appropriate patients.',
      managementImplication:
        'Complete infection and vaccination review, counsel about infusion and delayed infectious risks, and plan longitudinal monitoring.',
      escalationImplication:
        'Relapse or incomplete response requires specialist reassessment of timing, retreatment, adherence, antibody activity, and alternative agents.',
      trapAvoided:
        'Do not administer B-cell-depleting therapy without screening and a plan for infection prevention and follow-up.',
    },
    {
      id: 'alternative-adjuvants',
      type: 'MANAGEMENT',
      title: 'Select alternative conventional adjuvants when indicated',
      content:
        'Use agents such as azathioprine or mycophenolate mofetil when rituximab is unsuitable, unavailable, or not selected, after drug-specific safety assessment.',
      whyItMatters:
        'Steroid-sparing therapy lowers cumulative corticosteroid toxicity but has a delayed onset and distinct marrow, hepatic, reproductive, and infectious risks.',
      managementImplication:
        'Match the agent to comorbidity, reproductive plans, laboratory profile, monitoring capacity, and local protocols.',
      escalationImplication:
        'Toxicity, treatment failure, or progressive disease requires prompt specialist adjustment rather than passive continuation.',
      trapAvoided:
        'Do not use an adjuvant without baseline testing and scheduled laboratory monitoring.',
    },
    {
      id: 'supportive-skin-oral-care',
      type: 'MANAGEMENT',
      title: 'Protect skin, mouth, nutrition, and hydration',
      content:
        'Provide gentle wound care, non-adherent dressings, oral hygiene, pain control, nutritional support, and fluid replacement when erosions impair intake or cause significant losses.',
      whyItMatters:
        'Barrier disruption and oral pain drive infection, dehydration, malnutrition, sleep disturbance, and reduced adherence.',
      managementImplication:
        'Involve wound-care, oral-medicine, dietetic, nursing, and pain teams according to the sites and severity involved.',
      escalationImplication:
        'Worsening intake, weight loss, electrolyte disturbance, or spreading infection should trigger inpatient-level support.',
      trapAvoided:
        'Do not treat immune activity while neglecting the complications caused by open erosions.',
    },
    {
      id: 'monitor-remission-and-toxicity',
      type: 'MANAGEMENT',
      title: 'Monitor disease activity and treatment harm',
      content:
        'Review new lesion formation, healing, mucosal function, infection, PDAI trend, laboratory toxicity, bone health, metabolic effects, and vaccination needs throughout treatment.',
      whyItMatters:
        'Both uncontrolled disease and immunosuppressive toxicity can be life-threatening, and serology may lag behind clinical response.',
      managementImplication:
        'Taper therapy according to sustained clinical control while maintaining relapse surveillance and drug-specific monitoring.',
      escalationImplication:
        'New lesions during taper require confirmation of relapse and exclusion of infection or treatment injury before intensification.',
      trapAvoided:
        'Do not make treatment decisions from antibody titres alone.',
    },
  ],
  complications: [
    'Secondary bacterial, viral, or fungal infection',
    'Sepsis',
    'Dehydration and electrolyte disturbance',
    'Malnutrition and weight loss',
    'Pain and impaired oral intake',
    'Thromboembolic complications during severe inflammatory illness or hospitalization',
    'Corticosteroid metabolic, skeletal, cardiovascular, and infectious toxicity',
    'Immunosuppressant-related marrow, hepatic, reproductive, or infectious toxicity',
    'Relapse during treatment taper',
  ],
  pitfalls: [
    {
      id: 'wrong-dif-biopsy-site',
      type: 'PITFALL',
      title: 'Biopsying the eroded centre for direct immunofluorescence',
      content:
        'An old eroded lesion can lose epidermis and tissue-bound immunoreactants, producing a falsely negative or uninterpretable direct immunofluorescence result.',
      whyItMatters:
        'A false negative can delay diagnosis or send treatment toward the wrong blistering disorder.',
      trapAvoided:
        'Take direct immunofluorescence from intact perilesional tissue and routine histology from the edge of a fresh lesion.',
    },
    {
      id: 'oral-erosions-dismissed',
      type: 'PITFALL',
      title: 'Treating persistent oral erosions as nonspecific ulcers',
      content:
        'Mucosal disease can precede the skin eruption for weeks or months and may be repeatedly labeled aphthous disease, candidiasis, or trauma.',
      whyItMatters:
        'Delay permits progressive pain, poor intake, additional mucosal involvement, and cutaneous disease.',
      trapAvoided:
        'Escalate persistent multifocal erosions for specialist examination and immunobullous biopsy rather than repeating empiric topical therapy indefinitely.',
    },
    {
      id: 'nikolsky-overcalled',
      type: 'PITFALL',
      title: 'Treating the Nikolsky sign as disease-specific',
      content:
        'A positive Nikolsky sign can occur in several fragile or necrolytic epidermal disorders and therefore cannot identify pemphigus vulgaris alone.',
      whyItMatters:
        'Overconfidence can miss Stevens-Johnson syndrome, toxic epidermal necrolysis, staphylococcal toxin disease, or another pemphigus subtype.',
      trapAvoided:
        'Use the sign to recognize epidermal fragility, then confirm blister level and immunopathology.',
    },
    {
      id: 'serology-alone',
      type: 'PITFALL',
      title: 'Using desmoglein ELISA as the only diagnostic test',
      content:
        'Serology can be negative, discordant, or difficult to interpret and does not directly show where antibodies bind in tissue.',
      whyItMatters:
        'Diagnosis without clinicopathological correlation increases false classification and inappropriate long-term immunosuppression.',
      trapAvoided:
        'Correlate morphology, histology, direct immunofluorescence, and serology.',
    },
    {
      id: 'infection-called-relapse',
      type: 'PITFALL',
      title: 'Mistaking secondary infection for autoimmune relapse',
      content:
        'New crusting, pain, erythema, or erosions during immunosuppression can reflect bacterial or viral infection rather than increased autoantibody activity.',
      whyItMatters:
        'Escalating immunosuppression during unrecognized infection can worsen sepsis and tissue injury.',
      trapAvoided:
        'Examine for infection, culture or test suspicious lesions, and reassess before intensifying therapy.',
    },
    {
      id: 'supportive-care-neglected',
      type: 'PITFALL',
      title: 'Focusing only on immunosuppression',
      content:
        'Open erosions and oral pain can cause fluid loss, malnutrition, infection, and major functional decline even while immune therapy is being arranged.',
      whyItMatters:
        'Preventable supportive-care failure can drive admission, treatment interruption, and mortality.',
      trapAvoided:
        'Pair disease-modifying therapy with wound care, oral care, analgesia, hydration, nutrition, and infection surveillance.',
    },
  ],
  recallPrompts: [
    {
      id: 'flaccid-versus-tense',
      type: 'DISTINGUISH',
      prompt:
        'Why do flaccid rather than tense bullae favor pemphigus vulgaris over bullous pemphigoid?',
      answer:
        'Pemphigus splits within the epidermis, leaving a thin fragile roof, whereas pemphigoid splits below the epidermis and retains a stronger tense roof.',
      explanation:
        'The bedside mechanics indicate the anatomical blister level and narrow the differential before pathology returns.',
      linkedConcept: 'blister level',
      sourceSection: 'examPearls',
      difficulty: 'INTERMEDIATE',
    },
    {
      id: 'why-oral-first',
      type: 'WHY_IT_MATTERS',
      prompt:
        'Why can painful oral erosions precede skin lesions in pemphigus vulgaris?',
      answer:
        'Desmoglein 3 is central to mucosal adhesion, and loss of its function is poorly compensated in mucosa.',
      explanation:
        'The desmoglein distribution model connects antibody target with the mucosal-first phenotype.',
      linkedConcept: 'desmoglein compensation',
      sourceSection: 'clinicalPattern',
      difficulty: 'ADVANCED',
    },
    {
      id: 'dif-site',
      type: 'WHY_IT_MATTERS',
      prompt:
        'Why should direct immunofluorescence be taken from intact perilesional tissue rather than an erosion?',
      answer:
        'An eroded centre may have lost the epidermis and tissue-bound immunoreactants, causing a false-negative or uninterpretable result.',
      explanation:
        'Correct sampling preserves the anatomical antibody pattern needed for confirmation.',
      linkedConcept: 'immunofluorescence biopsy site',
      sourceSection: 'investigations',
      difficulty: 'INTERMEDIATE',
    },
    {
      id: 'dif-separator',
      type: 'DISTINGUISH',
      prompt:
        'What direct immunofluorescence pattern separates pemphigus vulgaris from pemphigoid disorders?',
      answer:
        'Pemphigus shows intercellular epidermal IgG, often with C3, whereas pemphigoid disorders show linear staining along the basement-membrane zone.',
      explanation:
        'The location of immunoreactants identifies whether adhesion failure is between keratinocytes or at the dermoepidermal junction.',
      linkedConcept: 'immunoreactant location',
      sourceSection: 'differentials',
      difficulty: 'INTERMEDIATE',
    },
    {
      id: 'positive-nikolsky-trap',
      type: 'WHY_IT_MATTERS',
      prompt:
        'Why is a positive Nikolsky sign insufficient to diagnose pemphigus vulgaris?',
      answer:
        'It demonstrates epidermal fragility but can occur in other autoimmune, toxin-mediated, and necrolytic disorders.',
      explanation:
        'The sign raises suspicion and guides sampling, but histology and immunofluorescence provide disease-specific classification.',
      linkedConcept: 'Nikolsky specificity',
      sourceSection: 'pitfalls',
      difficulty: 'INTERMEDIATE',
    },
    {
      id: 'rituximab-why',
      type: 'WHY_IT_MATTERS',
      prompt:
        'Why is rituximab commonly paired with a short-term corticosteroid strategy in moderate-to-severe pemphigus vulgaris?',
      answer:
        'Corticosteroids provide rapid control while B-cell depletion provides effective steroid-sparing disease control and reduces cumulative corticosteroid exposure.',
      explanation:
        'The management logic balances speed of induction against long-term treatment toxicity.',
      linkedConcept: 'induction and steroid sparing',
      sourceSection: 'management',
      difficulty: 'ADVANCED',
    },
  ],
  references: [
    'Murrell DF, et al. Diagnosis and management of pemphigus: recommendations of an international panel of experts. Journal of the American Academy of Dermatology. 2020.',
    'Joly P, et al. Updated S2K guidelines on the management of pemphigus vulgaris and foliaceus initiated by the European Academy of Dermatology and Venereology. Journal of the European Academy of Dermatology and Venereology. 2020.',
    'Harman KE, et al. British Association of Dermatologists guidelines for the management of pemphigus vulgaris. British Journal of Dermatology. 2017.',
  ],
};

function assertWardleEducationQuality(): void {
  const requireString = (
    value: unknown,
    label: string,
  ): asserts value is string => {
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`Education quality failure: ${label} is missing.`);
    }
  };

  const requireObjectArray = (
    value: unknown,
    label: string,
  ): Array<Record<string, unknown>> => {
    if (!Array.isArray(value) || value.length === 0) {
      throw new Error(`Education quality failure: ${label} must be a non-empty array.`);
    }

    return value.map((item, index) => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        throw new Error(
          `Education quality failure: ${label}[${index}] must be a structured object.`,
        );
      }
      return item as Record<string, unknown>;
    });
  };

  const keySigns = requireObjectArray(
    educationForFrontend.keySigns,
    'keySigns',
  );
  keySigns.forEach((sign, index) => {
    requireString(sign.finding, `keySigns[${index}].finding`);
    requireString(sign.description, `keySigns[${index}].description`);
    requireString(sign.whyItMatters, `keySigns[${index}].whyItMatters`);
    requireString(sign.discriminator, `keySigns[${index}].discriminator`);
  });

  const typedSections = [
    ['examPearls', educationForFrontend.examPearls],
    ['investigations', educationForFrontend.investigations],
    ['differentialDistinguishers', educationForFrontend.differentialDistinguishers],
    ['managementOverview', educationForFrontend.managementOverview],
    ['pitfalls', educationForFrontend.pitfalls],
  ] as const;

  typedSections.forEach(([sectionName, value]) => {
    const items = requireObjectArray(value, sectionName);
    items.forEach((item, index) => {
      requireString(item.id, `${sectionName}[${index}].id`);
      requireString(item.type, `${sectionName}[${index}].type`);
      requireString(item.title, `${sectionName}[${index}].title`);
      requireString(item.content, `${sectionName}[${index}].content`);
      requireString(
        item.whyItMatters,
        `${sectionName}[${index}].whyItMatters`,
      );
    });
  });

  requireObjectArray(
    educationForFrontend.examPearls,
    'examPearls',
  ).forEach((item, index) => {
    requireString(item.discriminator, `examPearls[${index}].discriminator`);
    if (
      !/\b(?:because|due to|reflects|indicates|produces|mechanism)\b/i.test(
        String(item.content),
      )
    ) {
      throw new Error(
        `Education quality failure: examPearls[${index}] does not explain a mechanism.`,
      );
    }
  });

  requireObjectArray(
    educationForFrontend.investigations,
    'investigations',
  ).forEach((item, index) => {
    requireString(
      item.managementImplication,
      `investigations[${index}].managementImplication`,
    );
  });

  requireObjectArray(
    educationForFrontend.differentialDistinguishers,
    'differentialDistinguishers',
  ).forEach((item, index) => {
    requireString(
      item.discriminator,
      `differentialDistinguishers[${index}].discriminator`,
    );
    requireString(
      item.trapAvoided,
      `differentialDistinguishers[${index}].trapAvoided`,
    );
  });

  requireObjectArray(
    educationForFrontend.managementOverview,
    'managementOverview',
  ).forEach((item, index) => {
    requireString(
      item.managementImplication,
      `managementOverview[${index}].managementImplication`,
    );
    requireString(
      item.escalationImplication,
      `managementOverview[${index}].escalationImplication`,
    );
  });

  requireObjectArray(
    educationForFrontend.pitfalls,
    'pitfalls',
  ).forEach((item, index) => {
    requireString(item.trapAvoided, `pitfalls[${index}].trapAvoided`);
  });

  const recallPrompts = requireObjectArray(
    educationForFrontend.recallPrompts,
    'recallPrompts',
  );
  recallPrompts.forEach((prompt, index) => {
    requireString(prompt.id, `recallPrompts[${index}].id`);
    requireString(prompt.type, `recallPrompts[${index}].type`);
    requireString(prompt.prompt, `recallPrompts[${index}].prompt`);
    requireString(prompt.answer, `recallPrompts[${index}].answer`);
    requireString(prompt.explanation, `recallPrompts[${index}].explanation`);
    requireString(prompt.linkedConcept, `recallPrompts[${index}].linkedConcept`);
    requireString(prompt.sourceSection, `recallPrompts[${index}].sourceSection`);
    requireString(prompt.difficulty, `recallPrompts[${index}].difficulty`);
  });

  const allowedRecallTypes = new Set([
    'CLOZE',
    'SHORT_ANSWER',
    'DISTINGUISH',
    'PEARL_RECALL',
    'WHY_IT_MATTERS',
  ]);
  recallPrompts.forEach((prompt, index) => {
    if (!allowedRecallTypes.has(String(prompt.type))) {
      throw new Error(
        `Education quality failure: unsupported recall type at index ${index}: ${String(prompt.type)}.`,
      );
    }
  });
}

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
    '47 year old',
    'six weeks',
    'ten days ago',
    '8 of body surface area',
    'pulse 92',
    'blood pressure 118 72',
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

  assertWardleEducationQuality();
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
    ).includes('pemphigus vulgaris')
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
      'Flagship pemphigus vulgaris registry entry focused on mucosal-first disease, fragile flaccid bullae, Nikolsky phenomenon, suprabasal acantholysis, intercellular IgG and C3, desmoglein serology, structured differential reasoning, specialist systemic therapy, and supportive care.',
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
      'Skipped diagnosis education because pemphigus vulgaris education already exists:',
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
        ? 'Skipped existing scheduled pemphigus vulgaris case.'
        : 'Skipped existing pemphigus vulgaris case to avoid overwriting authored content.',
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
      'Seeded complete frontend-aligned flagship Pemphigus Vulgaris case with six supported clues, exact clue-breakdown alignment, canonical differentials, histopathological localization, immunopathological confirmation, and diagnosis-level education independent of the vignette.',
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
        'Created complete pemphigus vulgaris revision with progressive mucocutaneous reasoning, exact clue-to-breakdown alignment, canonical evidence-anchored differentials, suprabasal histopathology, and intercellular immunofluorescence teaching.',
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
      validatorVersion: 'flagship-human-review:pemphigus-vulgaris-v1',
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
          'Complete Pemphigus Vulgaris flagship seed with six supported clues, no early diagnosis-label leakage, exact clue and reasoning alignment, canonical evidence-anchored differentials, suprabasal acantholysis, intercellular immunofluorescence, structured management teaching, and independent diagnosis education.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded Pemphigus Vulgaris:', {
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
