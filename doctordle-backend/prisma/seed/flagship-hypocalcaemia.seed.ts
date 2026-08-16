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
 * FLAGSHIP CASE SEED - Hypocalcaemia
 *
 * Canonical diagnosis:
 * - Hypocalcaemia
 *
 * Clinical focus:
 * - Acute neuromuscular irritability after total thyroidectomy.
 * - Perioral and distal paraesthesia progressing to carpopedal spasm.
 * - Trousseau and Chvostek signs as examination evidence of tetany.
 * - True biochemical hypocalcaemia confirmed with low ionised calcium.
 * - Hyperphosphataemia and an inappropriately low PTH identifying
 *   postoperative hypoparathyroidism as the mechanism.
 *
 * Clue progression:
 * - history -> symptom -> exam -> lab -> lab -> lab
 *
 * Safety:
 * - Uses only supported clue types.
 * - Uses the canonical diagnosis rather than a descriptive answer label.
 * - Does not reveal the diagnosis or an accepted alias in clues 0-4.
 * - Validates exact clue-to-breakdown alignment.
 * - Reuses or creates the diagnosis registry and accepted aliases.
 * - Does not overwrite existing diagnosis education.
 * - Does not overwrite an existing case with the same title.
 * - Does not alter a scheduled DailyCase.
 *
 * Run:
 *   npx tsx prisma/seed/flagship-hypocalcaemia.seed.ts
 *
 * Railway:
 *   railway run npx tsx prisma/seed/flagship-hypocalcaemia.seed.ts
 */

const databaseUrl = resolvePgConnectionString(process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run the Hypocalcaemia seed.');
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
const seedVersion = 'flagship-hypocalcaemia-v1';

const canonicalName = 'hypocalcaemia';
const displayLabel = 'Hypocalcaemia';
const caseTitle =
  'Perioral Tingling and Painful Hand Spasms After Thyroid Surgery';

const aliasTerms = ['Hypocalcaemia', 'Hypocalcemia'];

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 41-year-old woman develops tingling around the mouth and in both hands approximately 30 hours after an uncomplicated total thyroidectomy for a multinodular goitre. Her preoperative calcium concentration was normal, and she has no chronic kidney disease, malabsorption, recent diarrhoea, or use of bisphosphonates or anticonvulsants.',
  },
  {
    order: 1,
    type: 'symptom',
    value:
      'Over the next two hours, the tingling becomes continuous and is followed by painful involuntary tightening of both hands and intermittent cramping of the feet. She remains fully conscious and reports no unilateral weakness, tongue biting, loss of bladder control, or previous similar episode.',
  },
  {
    order: 2,
    type: 'exam',
    value:
      'Inflation of a blood-pressure cuff above systolic pressure produces flexion of the wrists and metacarpophalangeal joints with extension of the fingers. Tapping over the facial nerve causes ipsilateral facial twitching. Deep-tendon reflexes are brisk, while power, sensation between spasms, speech, and cranial-nerve examination are otherwise normal.',
  },
  {
    order: 3,
    type: 'lab',
    value:
      'Serum total calcium is 1.66 mmol/L with albumin 41 g/L, and directly measured ionised calcium is 0.78 mmol/L. Sodium, potassium, and glucose are within their reference ranges.',
  },
  {
    order: 4,
    type: 'lab',
    value:
      'Serum phosphate is elevated at 1.88 mmol/L. Magnesium is 0.84 mmol/L, creatinine is 72 micromol/L, and 25-hydroxyvitamin D is 76 nmol/L, making magnesium depletion, renal failure, and severe vitamin D deficiency unlikely explanations.',
  },
  {
    order: 5,
    type: 'lab',
    value:
      'Intact parathyroid hormone is inappropriately low at 0.7 pmol/L, and repeat ionised calcium has fallen to 0.72 mmol/L. The acute postoperative timing, neuromuscular irritability, low calcium, high phosphate, and suppressed parathyroid hormone identify transient postoperative parathyroid failure as the cause.',
  },
] as const;

const differentials = [
  'Hypomagnesaemia',
  'Respiratory Alkalosis',
  'Acute Dystonic Reaction',
  'Hypoglycaemia',
  'Focal Seizure',
  'Peripheral Neuropathy',
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

const explanation = {
  diagnosis: displayLabel,
  summary:
    'Acute perioral and distal paraesthesia progressing to carpopedal spasm, positive Trousseau and Chvostek signs, and markedly reduced total and ionised calcium establish Hypocalcaemia. Hyperphosphataemia with an inappropriately low parathyroid hormone concentration after total thyroidectomy identifies postoperative hypoparathyroidism as the mechanism.',
  reasoning: [
    'The abrupt postoperative onset makes a new metabolic complication more likely than a chronic neurological disorder.',
    'Perioral paraesthesia, distal tingling, painful cramps, and carpopedal spasm reflect increased neuromuscular excitability.',
    'Trousseau sign reproduces a characteristic carpal spasm during temporary arterial occlusion, while Chvostek sign provides additional evidence of neuromuscular irritability.',
    'A normal albumin concentration shows that the low total calcium is not explained by hypoalbuminaemia.',
    'Directly measured ionised calcium confirms a true reduction in the physiologically active calcium fraction.',
    'High phosphate with normal renal function suggests impaired parathyroid hormone action rather than chronic kidney disease.',
    'Normal magnesium makes magnesium-induced impairment of parathyroid hormone release or action substantially less likely.',
    'An inappropriately low parathyroid hormone concentration after total thyroidectomy localises the cause to acute postoperative parathyroid dysfunction.',
    'The canonical diagnosis remains Hypocalcaemia; postoperative hypoparathyroidism is the underlying aetiology rather than the answer label.',
  ],
  clueBreakdown: [
    {
      clueOrder: 0,
      clueType: 'history',
      clue: clues[0].value,
      explanation:
        'This opening establishes an acute postoperative metabolic presentation and introduces thyroid surgery as a major risk for transient parathyroid dysfunction. The normal preoperative calcium and absence of chronic renal, gastrointestinal, or medication-related risk factors make a newly acquired postoperative process more likely.',
      diagnosticContribution:
        'Broadly raises suspicion for a calcium-regulation disorder without yet proving the electrolyte abnormality.',
    },
    {
      clueOrder: 1,
      clueType: 'symptom',
      clue: clues[1].value,
      explanation:
        'Symmetric perioral and distal paraesthesia progressing to painful bilateral hand and foot contraction is a classic sequence of neuromuscular irritability. Preserved consciousness and absence of focal or postictal features reduce the likelihood of seizure or stroke.',
      diagnosticContribution:
        'Narrows the case toward tetany from an electrolyte disturbance, especially reduced ionised calcium or magnesium.',
    },
    {
      clueOrder: 2,
      clueType: 'exam',
      clue: clues[2].value,
      explanation:
        'The cuff-induced carpal posture is Trousseau sign, and facial twitching after tapping the facial nerve is Chvostek sign. Together with brisk reflexes and an otherwise normal neurological examination, these findings support diffuse neuromuscular hyperexcitability rather than a focal neurological lesion.',
      diagnosticContribution:
        'Provides strong bedside evidence for hypocalcaemic tetany while preserving biochemical confirmation for later clues.',
    },
    {
      clueOrder: 3,
      clueType: 'lab',
      clue: clues[3].value,
      explanation:
        'Both total and ionised calcium are markedly reduced. Normal albumin excludes pseudo-hypocalcaemia from reduced protein binding, and normal glucose excludes hypoglycaemia as the cause of the neurological symptoms.',
      diagnosticContribution:
        'Biochemically confirms the canonical diagnosis of Hypocalcaemia.',
    },
    {
      clueOrder: 4,
      clueType: 'lab',
      clue: clues[4].value,
      explanation:
        'Hyperphosphataemia suggests reduced parathyroid hormone activity. Normal magnesium, preserved renal function, and adequate vitamin D reduce three important alternative mechanisms: magnesium depletion, chronic kidney disease, and severe vitamin D deficiency.',
      diagnosticContribution:
        'Moves from confirming the electrolyte disorder to identifying a low-PTH biochemical pattern.',
    },
    {
      clueOrder: 5,
      clueType: 'lab',
      clue: clues[5].value,
      explanation:
        'Parathyroid hormone should rise when calcium falls. Its suppression is therefore inappropriate and, in the immediate post-thyroidectomy setting, identifies postoperative hypoparathyroidism. The falling ionised calcium confirms an active severe process requiring urgent treatment.',
      diagnosticContribution:
        'Defines the mechanism and urgency without replacing Hypocalcaemia as the canonical diagnosis.',
    },
  ],
  keyFindings: [
    'Age 41 years',
    'Symptoms beginning 30 hours after total thyroidectomy',
    'Normal preoperative calcium',
    'Perioral paraesthesia',
    'Bilateral fingertip tingling',
    'Painful carpopedal spasm',
    'Intermittent pedal cramps',
    'Preserved consciousness',
    'Positive Trousseau sign',
    'Positive Chvostek sign',
    'Brisk deep-tendon reflexes',
    'Total calcium 1.66 mmol/L',
    'Albumin 41 g/L',
    'Ionised calcium 0.78 mmol/L falling to 0.72 mmol/L',
    'Phosphate 1.88 mmol/L',
    'Normal magnesium',
    'Normal renal function',
    'Adequate 25-hydroxyvitamin D',
    'Inappropriately low parathyroid hormone',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Hypomagnesaemia',
      whyPlausibleEarly:
        'Magnesium depletion can cause paraesthesia, cramps, tetany, and secondary reduction in calcium through impaired parathyroid hormone secretion or action.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence:
            'no diarrhoea, malabsorption, chronic alcohol exposure, or other clear magnesium-loss history',
          reason:
            'The opening history does not provide a strong source of magnesium depletion.',
        },
        {
          clueOrder: 4,
          evidence: 'serum magnesium is 0.84 mmol/L',
          reason:
            'A normal magnesium concentration makes magnesium deficiency an unlikely primary driver of the tetany and low calcium.',
        },
      ],
      finalReasonLessLikely:
        'The magnesium concentration is normal, while the postoperative low-PTH pattern directly explains the calcium disturbance.',
    },
    {
      diagnosis: 'Respiratory Alkalosis',
      whyPlausibleEarly:
        'Acute hyperventilation can reduce ionised calcium through increased albumin binding and produce perioral tingling and carpopedal spasm.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence:
            'symptoms develop after thyroid surgery without an episode of panic, sustained hyperventilation, or respiratory illness',
          reason:
            'The history provides a stronger postoperative endocrine trigger than a primary ventilation disorder.',
        },
        {
          clueOrder: 3,
          evidence:
            'markedly low total calcium with normal albumin as well as low ionised calcium',
          reason:
            'Respiratory alkalosis typically lowers ionised calcium through altered binding but does not usually produce this degree of true total-calcium reduction.',
        },
        {
          clueOrder: 5,
          evidence: 'suppressed parathyroid hormone after total thyroidectomy',
          reason:
            'The endocrine biochemical pattern identifies impaired calcium regulation rather than isolated alkalosis.',
        },
      ],
      finalReasonLessLikely:
        'True low total calcium, hyperphosphataemia, and low PTH are not explained by an isolated hyperventilation episode.',
    },
    {
      diagnosis: 'Acute Dystonic Reaction',
      whyPlausibleEarly:
        'Drug-induced dystonia may cause painful involuntary posturing of the hands, face, neck, or jaw.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence:
            'no dopamine-blocking antiemetic or antipsychotic exposure is described',
          reason:
            'Acute dystonia usually follows exposure to a causative medication.',
        },
        {
          clueOrder: 2,
          evidence:
            'reproducible Trousseau sign with Chvostek sign and brisk reflexes',
          reason:
            'These findings indicate generalized neuromuscular excitability rather than sustained focal dystonic posturing.',
        },
        {
          clueOrder: 3,
          evidence: 'confirmed marked reduction in total and ionised calcium',
          reason:
            'The biochemical abnormality directly accounts for the spasms.',
        },
      ],
      finalReasonLessLikely:
        'There is no drug trigger, and objective examination and calcium results establish metabolic tetany.',
    },
    {
      diagnosis: 'Hypoglycaemia',
      whyPlausibleEarly:
        'Low glucose can produce tremor, paraesthesia, confusion, seizure, and autonomic symptoms.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence:
            'preserved consciousness without confusion, diaphoresis, or a generalized convulsive episode',
          reason:
            'The symptom pattern is dominated by tetany rather than neuroglycopenia or an adrenergic response.',
        },
        {
          clueOrder: 3,
          evidence: 'serum glucose is within the reference range',
          reason:
            'Normal glucose excludes hypoglycaemia as the immediate cause.',
        },
      ],
      finalReasonLessLikely:
        'The glucose is normal, whereas calcium is markedly reduced and explains the neuromuscular findings.',
    },
    {
      diagnosis: 'Focal Seizure',
      whyPlausibleEarly:
        'A focal motor seizure can cause involuntary limb movements while consciousness remains preserved.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence:
            'symmetric painful hand and foot contraction without altered awareness, tongue biting, incontinence, or a postictal state',
          reason:
            'The bilateral sustained cramping pattern is more consistent with tetany than focal cortical motor activity.',
        },
        {
          clueOrder: 2,
          evidence:
            'spasm is reproducibly provoked by blood-pressure cuff inflation and accompanied by Chvostek sign',
          reason:
            'Provoked carpopedal spasm and facial-nerve hyperexcitability are metabolic bedside signs, not typical seizure findings.',
        },
        {
          clueOrder: 3,
          evidence: 'markedly low ionised calcium',
          reason:
            'The electrolyte abnormality provides a direct unifying explanation for the neuromuscular irritability.',
        },
      ],
      finalReasonLessLikely:
        'The provoked bilateral tetany and biochemical calcium deficiency are inconsistent with a primary focal seizure disorder.',
    },
    {
      diagnosis: 'Peripheral Neuropathy',
      whyPlausibleEarly:
        'Peripheral neuropathy can cause distal symmetric tingling and numbness in the hands and feet.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence: 'abrupt onset over hours after surgery',
          reason:
            'Most peripheral neuropathies evolve over a longer period rather than beginning suddenly after an operation.',
        },
        {
          clueOrder: 1,
          evidence: 'progression to painful carpopedal spasm',
          reason:
            'Tetanic contraction is not a typical manifestation of a sensory peripheral neuropathy.',
        },
        {
          clueOrder: 2,
          evidence:
            'brisk reflexes with positive Trousseau and Chvostek signs',
          reason:
            'Peripheral neuropathy commonly reduces reflexes, whereas this pattern reflects neuromuscular hyperexcitability.',
        },
      ],
      finalReasonLessLikely:
        'The acute course, brisk reflexes, tetany signs, and calcium results support a metabolic disorder rather than peripheral nerve disease.',
    },
  ],
  managementPearl:
    'Severe or symptomatic acute hypocalcaemia is a medical emergency. Place the patient on cardiac monitoring, obtain intravenous access, and give guideline-directed intravenous calcium gluconate while checking and correcting magnesium. Once stabilised, treat the underlying cause and establish oral calcium plus activated vitamin D when indicated.',
  generationQuality: {
    contentTier: 'FLAGSHIP',
    seedVersion,
    humanReviewed: true,
    canonicalDiagnosisVerified: true,
    discriminatorStrength: 'VERY_HIGH',
    clueProgressionVerified: true,
    breakdownClueReferencesValidated: true,
    expectedTeachingPoints: [
      'Use Hypocalcaemia as the canonical diagnosis rather than a descriptive postoperative label',
      'Perioral paraesthesia and carpopedal spasm are manifestations of neuromuscular irritability',
      'Trousseau sign is provoked carpal spasm during cuff inflation',
      'Chvostek sign supports neuromuscular excitability but is not diagnostic in isolation',
      'Ionised calcium confirms the physiologically active calcium deficit',
      'Normal albumin excludes an isolated low-total-calcium artefact',
      'High phosphate with low PTH suggests hypoparathyroidism',
      'Total thyroidectomy is an important cause of acute postoperative parathyroid dysfunction',
      'Severe symptomatic cases require urgent intravenous calcium and cardiac monitoring',
      'Magnesium must be measured and corrected because deficiency can prevent calcium correction',
    ],
    competencyDomains: [
      'Endocrinology',
      'Emergency Medicine',
      'Postoperative Care',
      'Electrolyte Interpretation',
      'Clinical Examination',
    ],
  },
};

const educationForFrontend = {
  title: displayLabel,
  summary:
    'Hypocalcaemia is a reduction in circulating calcium, best confirmed by ionised calcium when the clinical context or albumin concentration may distort total calcium interpretation. Acute falls increase neuromuscular excitability and may cause paraesthesia, tetany, seizures, laryngospasm, prolonged repolarisation, and arrhythmia.',
  recognitionPattern: [
    'Perioral tingling with distal paraesthesia',
    'Painful muscle cramps or carpopedal spasm',
    'Positive Trousseau sign',
    'Positive Chvostek sign in the appropriate clinical context',
    'Recent thyroid or parathyroid surgery',
    'Low total calcium confirmed by low ionised calcium',
    'High phosphate with low or inappropriately normal PTH in hypoparathyroidism',
  ],
  keySymptoms: [
    'Perioral numbness or tingling',
    'Fingertip and toe paraesthesia',
    'Painful muscle cramps',
    'Carpopedal spasm',
    'Generalised weakness or fatigue',
    'Confusion or seizure in severe cases',
    'Throat tightness, stridor, or dyspnoea from severe neuromuscular involvement',
    'Palpitations or syncope when cardiac conduction is affected',
  ],
  keySigns: [
    'Trousseau sign',
    'Chvostek sign',
    'Brisk reflexes',
    'Tetany',
    'Laryngospasm in severe disease',
    'Seizure in severe disease',
    'Prolonged QT interval on electrocardiography',
  ],
  examPearls: [
    {
      type: 'BEDSIDE_SIGN',
      title: 'Trousseau sign',
      content:
        'Inflate a blood-pressure cuff above systolic pressure for up to three minutes. A positive response is carpal spasm with wrist and metacarpophalangeal flexion, interphalangeal extension, and thumb adduction.',
      whyItMatters:
        'It demonstrates latent neuromuscular excitability and is more useful than relying on Chvostek sign alone.',
    },
    {
      type: 'BEDSIDE_SIGN',
      title: 'Chvostek sign',
      content:
        'Tap the facial nerve anterior to the ear. Ipsilateral facial-muscle contraction is a positive sign.',
      whyItMatters:
        'It may support the diagnosis but can be absent in true disease or present in healthy individuals, so it must be interpreted with symptoms and biochemistry.',
    },
    {
      type: 'SAFETY',
      title: 'Check the airway and cardiac rhythm',
      content:
        'Look for stridor, respiratory distress, seizure activity, hypotension, or an irregular pulse and obtain an electrocardiogram in symptomatic or severe cases.',
      whyItMatters:
        'Acute severe calcium deficiency can affect the airway, brain, and cardiac conduction.',
    },
  ],
  scoringSystems: [],
  investigations: [
    {
      test: 'Ionised calcium',
      interpretation:
        'A reduced ionised calcium directly confirms deficiency of the biologically active fraction and is especially useful when albumin or acid-base status may alter total calcium interpretation.',
      whyItMatters:
        'It is the most direct biochemical confirmation of clinically important calcium deficiency.',
    },
    {
      test: 'Total calcium with albumin',
      interpretation:
        'A low total calcium with normal albumin supports true deficiency. Albumin-adjustment equations are estimates and may be unreliable in critical illness.',
      whyItMatters:
        'It distinguishes true disease from a low total value caused only by reduced protein binding.',
    },
    {
      test: 'Parathyroid hormone',
      interpretation:
        'PTH should rise when calcium falls. A low or inappropriately normal result suggests hypoparathyroidism; a raised result suggests an appropriate response and directs attention toward vitamin D deficiency, renal disease, malabsorption, or other causes.',
      whyItMatters:
        'PTH is the central branching test for determining the mechanism.',
    },
    {
      test: 'Magnesium',
      interpretation:
        'Low magnesium can impair PTH release and action and can make calcium deficiency refractory to treatment.',
      whyItMatters:
        'Calcium may not correct until magnesium is replaced.',
    },
    {
      test: 'Phosphate and renal function',
      interpretation:
        'High phosphate with low PTH supports hypoparathyroidism. Renal impairment can cause phosphate retention and reduced calcitriol production with secondary hyperparathyroidism.',
      whyItMatters:
        'The pattern helps distinguish low-PTH disease from chronic kidney disease and vitamin D-related causes.',
    },
    {
      test: '25-hydroxyvitamin D',
      interpretation:
        'A low concentration supports vitamin D deficiency as a cause or contributor.',
      whyItMatters:
        'Vitamin D status affects both acute correction and longer-term replacement planning.',
    },
    {
      test: 'Electrocardiogram',
      interpretation:
        'QT prolongation is the characteristic conduction abnormality; severe disease may cause arrhythmia.',
      whyItMatters:
        'It determines monitoring intensity and supports safe intravenous calcium administration.',
    },
  ],
  differentialDistinguishers: [
    {
      diagnosis: 'Hypomagnesaemia',
      overlap:
        'Can cause paraesthesia, cramps, tetany, arrhythmia, and secondary low calcium.',
      distinguishingFeatures:
        'Low magnesium is present and the calcium deficit may remain refractory until magnesium is corrected.',
      decisiveClue:
        'A normal magnesium concentration with suppressed PTH after thyroid surgery favours postoperative hypoparathyroidism.',
    },
    {
      diagnosis: 'Respiratory Alkalosis',
      overlap:
        'Hyperventilation can cause perioral tingling and carpopedal spasm by reducing ionised calcium.',
      distinguishingFeatures:
        'Symptoms occur during hyperventilation; total calcium may remain normal and blood gas testing shows alkalosis.',
      decisiveClue:
        'Markedly low total calcium with high phosphate and low PTH indicates a true calcium-regulation disorder.',
    },
    {
      diagnosis: 'Acute Dystonic Reaction',
      overlap: 'Painful involuntary posturing can resemble carpopedal spasm.',
      distinguishingFeatures:
        'Usually follows dopamine-blocking medication and commonly involves the neck, jaw, eyes, or tongue without Trousseau sign.',
      decisiveClue:
        'Provoked tetany signs and low ionised calcium support Hypocalcaemia.',
    },
    {
      diagnosis: 'Focal Seizure',
      overlap: 'Involuntary limb movement may occur with preserved awareness.',
      distinguishingFeatures:
        'Movements follow a cortical distribution and are not reproducibly provoked by cuff inflation; postictal or electroencephalographic features may be present.',
      decisiveClue:
        'Bilateral carpopedal spasm with Trousseau sign and reduced ionised calcium indicates tetany.',
    },
  ],
  managementOverview: [
    {
      phase: 'Immediate assessment',
      actions: [
        'Assess airway, breathing, circulation, mental status, and seizure activity.',
        'Obtain intravenous access, electrocardiography, and cardiac monitoring in symptomatic or severe cases.',
        'Measure ionised or serum calcium, albumin, magnesium, phosphate, renal function, PTH, and vitamin D as appropriate.',
      ],
      rationale:
        'The urgency depends on symptoms, rate of decline, and cardiac or neurological involvement rather than the calcium value alone.',
    },
    {
      phase: 'Severe or symptomatic acute disease',
      actions: [
        'Give 10-20 mL of 10% calcium gluconate diluted in 50-100 mL of 5% dextrose intravenously over 10 minutes with electrocardiographic monitoring.',
        'Repeat the bolus if symptoms persist, then continue a titrated calcium-gluconate infusion according to local emergency guidance.',
        'Recheck calcium frequently and avoid rapid overcorrection.',
      ],
      rationale:
        'Intravenous calcium rapidly reduces neuromuscular and cardiac complications while the underlying cause is treated.',
    },
    {
      phase: 'Correct contributors and establish maintenance therapy',
      actions: [
        'Correct magnesium deficiency when present.',
        'Treat the underlying cause.',
        'For postoperative hypoparathyroidism, introduce oral calcium and activated vitamin D such as calcitriol or alfacalcidol under biochemical monitoring.',
        'Arrange serial calcium, phosphate, magnesium, renal-function, and PTH review.',
      ],
      rationale:
        'Ongoing replacement and monitoring prevent recurrence while allowing recovery of transient parathyroid function to be assessed.',
    },
  ],
  complications: [
    'Tetany',
    'Laryngospasm and airway compromise',
    'Seizure',
    'Prolonged QT interval',
    'Cardiac arrhythmia',
    'Heart failure or hypotension in severe cases',
    'Recurrent symptoms if the underlying cause is not corrected',
    'Hypercalcaemia, hypercalciuria, nephrolithiasis, or renal impairment from excessive replacement',
  ],
  pitfalls: [
    {
      type: 'DIAGNOSTIC',
      title: 'Using a descriptive postoperative label as the diagnosis',
      content:
        'Post-thyroidectomy hypoparathyroidism explains the mechanism, but the canonical case answer is Hypocalcaemia.',
      whyItMatters:
        'Separating the diagnosis from its cause keeps registry mapping and learner assessment consistent.',
      trapAvoided:
        'Do not use labels such as acute symptomatic postoperative hypocalcaemia as the canonical diagnosis.',
    },
    {
      type: 'DIAGNOSTIC',
      title: 'Relying on Chvostek sign alone',
      content:
        'Chvostek sign has limited specificity and sensitivity and should not substitute for biochemical confirmation.',
      whyItMatters:
        'Over-reliance may produce false-positive or false-negative conclusions.',
      trapAvoided:
        'Combine symptoms, Trousseau sign, calcium measurement, and aetiological tests.',
    },
    {
      type: 'LAB_INTERPRETATION',
      title: 'Ignoring albumin or ionised calcium',
      content:
        'A low total calcium may reflect low albumin, while acute alkalosis may lower ionised calcium despite a normal total value.',
      whyItMatters:
        'The wrong calcium measure can misclassify the patient.',
      trapAvoided:
        'Interpret total calcium with albumin and use ionised calcium when uncertainty is clinically important.',
    },
    {
      type: 'TREATMENT',
      title: 'Failing to check magnesium',
      content:
        'Magnesium deficiency can impair PTH secretion and action and make the calcium level refractory to replacement.',
      whyItMatters:
        'Repeated calcium dosing alone may fail.',
      trapAvoided:
        'Measure and correct magnesium early.',
    },
    {
      type: 'SAFETY',
      title: 'Giving intravenous calcium without monitoring',
      content:
        'Rapid calcium administration can cause cardiac complications and extravasation injury.',
      whyItMatters:
        'Administration rate, venous access, rhythm, and serial calcium require supervision.',
      trapAvoided:
        'Use guideline-directed dilution, electrocardiographic monitoring, and frequent reassessment.',
    },
  ],
  recallPrompts: [
    {
      prompt: 'What are the classic early symptoms of acute Hypocalcaemia?',
      answer:
        'Perioral tingling, distal paraesthesia, painful muscle cramps, and progression to carpopedal spasm.',
    },
    {
      prompt: 'What does Trousseau sign demonstrate?',
      answer:
        'Latent neuromuscular excitability producing carpal spasm during sustained blood-pressure cuff inflation.',
    },
    {
      prompt: 'Why is ionised calcium useful?',
      answer:
        'It directly measures the physiologically active calcium fraction and is not dependent on albumin concentration.',
    },
    {
      prompt:
        'What biochemical pattern suggests hypoparathyroidism as the cause?',
      answer:
        'Low calcium with high phosphate and a low or inappropriately normal PTH concentration.',
    },
    {
      prompt: 'Why must magnesium be checked?',
      answer:
        'Magnesium deficiency can suppress PTH secretion or action and prevent correction of the calcium level.',
    },
    {
      prompt:
        'What is the immediate treatment principle in severe symptomatic disease?',
      answer:
        'Urgent monitored intravenous calcium gluconate, followed by titrated replacement and treatment of the cause.',
    },
  ],
  references: [
    {
      citation:
        'Society for Endocrinology. Emergency management of acute hypocalcaemia in adult patients. Endocrine Connections. 2016;5:G7-G8. Addendum updated 2019.',
    },
    {
      citation:
        'Khan AA, et al. Evaluation and Management of Hypoparathyroidism: Summary Statement and Guidelines from the Second International Workshop. Journal of Bone and Mineral Research. 2022;37(12):2568-2585.',
    },
    {
      citation:
        'Bollerslev J, et al. Revised European Society of Endocrinology Clinical Practice Guideline: Treatment of Chronic Hypoparathyroidism in Adults. European Journal of Endocrinology. 2025;193(5):G49-G78.',
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

  if (canonicalName !== 'hypocalcaemia' || displayLabel !== 'Hypocalcaemia') {
    throw new Error(
      'The seed must use Hypocalcaemia as the canonical diagnosis and display label.',
    );
  }

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

  const expectedClueTypes = [
    'history',
    'symptom',
    'exam',
    'lab',
    'lab',
    'lab',
  ];

  clues.forEach((clue, index) => {
    if (clue.type !== expectedClueTypes[index]) {
      throw new Error(
        `Unexpected clue progression at order ${index}: expected ${expectedClueTypes[index]}, received ${clue.type}.`,
      );
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

  const clueBreakdown = explanation.clueBreakdown as ClueBreakdownEntry[];

  if (clueBreakdown.length !== clues.length) {
    throw new Error(
      `Expected ${clues.length} clue breakdown entries; received ${clueBreakdown.length}.`,
    );
  }

  clueBreakdown.forEach((entry, index) => {
    const sourceClue = clues[index];

    if (entry.clueOrder !== sourceClue.order) {
      throw new Error(
        `Breakdown clueOrder mismatch at index ${index}: expected ${sourceClue.order}, received ${entry.clueOrder}.`,
      );
    }

    if (entry.clueType !== sourceClue.type) {
      throw new Error(
        `Breakdown clueType mismatch at order ${sourceClue.order}: expected ${sourceClue.type}, received ${entry.clueType}.`,
      );
    }

    if (entry.clue !== sourceClue.value) {
      throw new Error(
        `Breakdown clue text does not exactly match clue ${sourceClue.order}.`,
      );
    }

    if (!entry.explanation.trim() || !entry.diagnosticContribution.trim()) {
      throw new Error(
        `Breakdown entry ${sourceClue.order} has empty reasoning content.`,
      );
    }
  });

  const differentialAnalysis =
    explanation.differentialAnalysis as DifferentialAnalysisEntry[];

  if (differentialAnalysis.length !== differentials.length) {
    throw new Error(
      `Expected differential analysis for all ${differentials.length} diagnoses; received ${differentialAnalysis.length}.`,
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
          `Empty evidence or reason in differential ${entry.diagnosis}.`,
        );
      }
    });
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
          specialty: 'Endocrinology',
          subspecialty: 'Calcium and Parathyroid Disorders',
          category: 'Electrolyte and Mineral Disorder',
          bodySystem: 'Endocrine / Metabolic',
          organSystem: 'Parathyroid Glands / Neuromuscular System',
          difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
          rarityBand: DiagnosisRarityBand.COMMON,
          clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
          ageGroup: DiagnosisAgeGroup.ADULT,
          urgencyLevel: DiagnosisUrgencyLevel.EMERGENT,
          preferredClueTypes: ['history', 'symptom', 'exam', 'lab'],
          notes:
            'Seeded flagship Hypocalcaemia case focused on acute postoperative neuromuscular irritability, true low ionised calcium, and low-PTH hyperphosphataemia after total thyroidectomy.',
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
          specialty: 'Endocrinology',
          subspecialty: 'Calcium and Parathyroid Disorders',
          category: 'Electrolyte and Mineral Disorder',
          bodySystem: 'Endocrine / Metabolic',
          organSystem: 'Parathyroid Glands / Neuromuscular System',
          difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
          rarityBand: DiagnosisRarityBand.COMMON,
          clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
          ageGroup: DiagnosisAgeGroup.ADULT,
          urgencyLevel: DiagnosisUrgencyLevel.EMERGENT,
          preferredClueTypes: ['history', 'symptom', 'exam', 'lab'],
          notes:
            'Seeded flagship Hypocalcaemia case focused on acute postoperative neuromuscular irritability, true low ionised calcium, and low-PTH hyperphosphataemia after total thyroidectomy.',
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
      'Skipped diagnosis education because Hypocalcaemia education already exists:',
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
        ? 'Skipped existing scheduled Hypocalcaemia case.'
        : 'Skipped existing Hypocalcaemia case to avoid overwriting authored content.',
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
      'Seeded complete frontend-aligned flagship Hypocalcaemia case with supported clue types, canonical diagnosis mapping, progressive neuromuscular and biochemical evidence, low-PTH postoperative mechanism, exact clue-breakdown alignment, and full diagnosis education.',
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
        'Created complete Hypocalcaemia revision with canonical diagnosis naming, six valid playable clues, exact clue-to-breakdown matching, postoperative low-PTH reasoning, differential analysis, and emergency management education.',
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
      validatorVersion: 'flagship-human-review:hypocalcaemia-v1',
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        canonicalDiagnosisVerified: true,
        clueProgressionVerified: true,
        breakdownClueReferencesValidated: true,
        playableClueCount: clues.length,
        clueTypes: clues.map((clue) => clue.type),
        duplicateSafe: true,
        doesNotOverwriteExistingEducation: true,
        doesNotOverwriteExistingCase: true,
        metadataVerified: {
          specialty: 'Endocrinology',
          subspecialty: 'Calcium and Parathyroid Disorders',
          category: 'Electrolyte and Mineral Disorder',
          bodySystem: 'Endocrine / Metabolic',
          organSystem: 'Parathyroid Glands / Neuromuscular System',
          difficultyBand: 'INTERMEDIATE',
          rarityBand: 'COMMON',
          clinicalSetting: 'EMERGENCY',
          ageGroup: 'ADULT',
          urgencyLevel: 'EMERGENT',
        },
        note:
          'Complete Hypocalcaemia flagship seed with the canonical diagnosis, six supported clues in history-symptom-exam-lab-lab-lab progression, no early answer-label leakage, exact clue-breakdown alignment, and postoperative hypoparathyroidism used only as the aetiology.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded Hypocalcaemia:', {
    registryId: params.diagnosisRegistryId,
    caseId: seededCase.id,
    revisionId: revision.id,
    publicNumber,
    educationId: params.educationId,
    diagnosis: displayLabel,
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
