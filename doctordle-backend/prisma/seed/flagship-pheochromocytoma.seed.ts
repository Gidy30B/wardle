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
 * FLAGSHIP CASE SEED - Pheochromocytoma
 *
 * Clinical focus:
 * - Recurrent brief attacks of headache, palpitations, diaphoresis, tremor, and pallor.
 * - Paroxysmal severe hypertension documented during an attack.
 * - Markedly elevated plasma free metanephrines.
 * - Adrenal mass localized only after biochemical evidence.
 * - Safe management teaching: alpha-adrenergic blockade before any beta-blockade,
 *   volume re-expansion, specialist preparation, and adrenalectomy.
 *
 * Seed behavior:
 * - Reuses the canonical registry or an accepted alias when present.
 * - Creates the registry and aliases when absent.
 * - Seeds exactly six supported playable clues.
 * - Keeps differentialAnalysis clueOrder references aligned to clue order 0-5.
 * - Publishes complete frontend-aligned diagnosis education.
 * - Does not overwrite a scheduled DailyCase.
 *
 * Run:
 *   npx tsx prisma/seed/flagship-pheochromocytoma.seed.ts
 *
 * Railway:
 *   railway run npx tsx prisma/seed/flagship-pheochromocytoma.seed.ts
 */

const databaseUrl = resolvePgConnectionString(process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required to run the Pheochromocytoma seed.',
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

function resolvePgConnectionString(value: string | undefined): string | undefined {
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
  reusableCaseId?: string;
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
        diagnosisRegistryId: true,
        currentRevisionId: true,
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

    if (params.reusableCaseId && owner.id === params.reusableCaseId) {
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
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 2, 22, 12, 0, 0));
const seedVersion = 'flagship-pheochromocytoma-v1';

const canonicalName = 'pheochromocytoma';
const displayLabel = 'Pheochromocytoma';
const caseTitle =
  'Recurrent Adrenergic Attacks with Paroxysmal Severe Hypertension';

const aliasTerms = [
  'Pheochromocytoma',
  'phaeochromocytoma',
  'adrenal pheochromocytoma',
  'adrenal phaeochromocytoma',
  'catecholamine-secreting adrenal tumour',
  'catecholamine-secreting adrenal tumor',
];

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 38-year-old woman presents with six months of recurrent sudden episodes of pounding headache, rapid heartbeat, and drenching sweating. Each attack lasts about 15 to 30 minutes and resolves spontaneously.',
  },
  {
    order: 1,
    type: 'symptom',
    value:
      'During the attacks she becomes pale, shaky, and intensely anxious, with nausea and a sense of impending collapse. The episodes are becoming more frequent and may follow emotional stress or vigorous activity. Between attacks she is usually well.',
  },
  {
    order: 2,
    type: 'vital',
    value:
      'While being assessed she develops a typical attack: blood pressure is 224/126 mmHg, pulse 124/min and regular, respiratory rate 22/min, oxygen saturation 98% on room air, and temperature 36.8 C. Thirty minutes later the symptoms settle and blood pressure falls to 142/86 mmHg.',
  },
  {
    order: 3,
    type: 'exam',
    value:
      'During the episode she is visibly pale and clammy with a fine tremor. Cardiovascular examination reveals tachycardia without a murmur or signs of heart failure. There is no goitre, thyroid bruit, lid lag, exophthalmos, flushing, wheeze, or urticaria.',
  },
  {
    order: 4,
    type: 'lab',
    value:
      'Plasma free normetanephrine is 5.8 times the upper reference limit and plasma free metanephrine is 3.4 times the upper reference limit on a properly collected sample after supine rest. TSH and free T4 are normal.',
  },
  {
    order: 5,
    type: 'imaging',
    value:
      'Contrast-enhanced CT of the abdomen, obtained after biochemical confirmation, shows a 4.2 cm well-defined heterogeneous mass arising from the right adrenal gland with no local invasion or distant lesion identified.',
  },
] as const;

const differentials = [
  'Panic Disorder',
  'Thyrotoxicosis',
  'Primary Hypertension',
  'Hypoglycaemia',
  'Carcinoid Syndrome',
];

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

  const normalizedDiagnosisTerms = aliasTerms.map(normalizeClinicalText);

  for (const clue of clues.slice(0, 4)) {
    const normalizedClue = normalizeClinicalText(clue.value);
    const leakedTerm = normalizedDiagnosisTerms.find((term) =>
      normalizedClue.includes(term),
    );

    if (leakedTerm) {
      throw new Error(
        `Clue ${clue.order} reveals the final diagnosis or alias too early: ${leakedTerm}.`,
      );
    }
  }

  if (
    new Set(differentials.map(normalizeClinicalText)).size !==
    differentials.length
  ) {
    throw new Error('Differentials contain duplicate diagnoses.');
  }
}

const explanation = {
  diagnosis: displayLabel,
  summary:
    'Brief recurrent adrenergic attacks with pounding headache, palpitations, diaphoresis, pallor, tremor, documented paroxysmal severe hypertension, markedly elevated plasma free metanephrines, and a localized adrenal mass support pheochromocytoma.',
  reasoning: [
    'The opening pattern is episodic rather than continuously progressive: sudden headache, palpitations, and sweating occurring together suggest intermittent catecholamine excess but remain broad enough to include panic disorder, thyrotoxicosis, hypoglycaemia, and arrhythmia.',
    'Pallor and tremor during discrete attacks strengthen an adrenergic mechanism. Complete or near-complete recovery between episodes is more typical of paroxysmal hormone release than persistent thyrotoxicosis.',
    'Documented blood pressure of 224/126 mmHg and regular tachycardia during a typical attack convert a subjective symptom history into objective paroxysmal haemodynamic instability.',
    'Absence of goitre, thyroid eye signs, persistent fever, flushing, wheeze, and urticaria weakens several important mimics without by itself proving the final diagnosis.',
    'Marked elevations of plasma free normetanephrine and metanephrine on an appropriately collected sample provide strong biochemical evidence of a catecholamine-secreting chromaffin tumour.',
    'Imaging is used after biochemical confirmation to localize the source. A right adrenal mass in this context identifies an adrenal pheochromocytoma rather than an extra-adrenal paraganglioma.',
  ],
  keyFindings: [
    'Age 38 years',
    'Recurrent sudden attacks lasting 15 to 30 minutes',
    'Pounding headache',
    'Rapid regular heartbeat',
    'Drenching sweating',
    'Pallor',
    'Fine tremor',
    'Nausea and intense anxiety during attacks',
    'Well between episodes',
    'Blood pressure 224/126 mmHg during a typical attack',
    'Pulse 124/min during a typical attack',
    'Substantial blood-pressure fall after the episode settles',
    'No goitre or thyroid eye signs',
    'No flushing, wheeze, or urticaria',
    'Plasma free normetanephrine 5.8 times the upper reference limit',
    'Plasma free metanephrine 3.4 times the upper reference limit',
    'Normal thyroid function',
    'Right adrenal mass on CT',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Panic Disorder',
      whyPlausibleEarly:
        'Abrupt attacks of palpitations, sweating, tremor, nausea, anxiety, and a sense of impending collapse can closely resemble panic attacks.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence:
            'blood pressure 224/126 mmHg documented during a typical attack',
          reason:
            'Panic can transiently increase blood pressure, but recurrent extreme paroxysmal hypertension should prompt investigation for a secondary catecholamine-mediated cause.',
        },
        {
          clueOrder: 4,
          evidence:
            'marked elevation of both plasma free normetanephrine and metanephrine',
          reason:
            'This biochemical pattern is not explained by primary panic disorder.',
        },
        {
          clueOrder: 5,
          evidence: 'right adrenal mass after biochemical confirmation',
          reason:
            'The biochemical and anatomical findings provide a unifying endocrine diagnosis.',
        },
      ],
      finalReasonLessLikely:
        'Anxiety is part of the adrenergic attack, but panic disorder does not explain the marked metanephrine elevation and adrenal tumour.',
    },
    {
      diagnosis: 'Thyrotoxicosis',
      whyPlausibleEarly:
        'Palpitations, sweating, tremor, anxiety, and weight or heat-related symptoms can suggest excess thyroid hormone.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'discrete brief attacks with wellness between episodes',
          reason:
            'Thyrotoxicosis usually produces more persistent symptoms rather than complete recovery between short attacks.',
        },
        {
          clueOrder: 3,
          evidence:
            'no goitre, thyroid bruit, lid lag, or exophthalmos',
          reason:
            'The focused examination does not support clinically overt Graves disease.',
        },
        {
          clueOrder: 4,
          evidence: 'normal TSH and free T4',
          reason:
            'Normal thyroid function excludes thyrotoxicosis as the cause of the attacks.',
        },
      ],
      finalReasonLessLikely:
        'The temporal pattern, normal thyroid evaluation, metanephrine elevation, and adrenal mass favor pheochromocytoma.',
    },
    {
      diagnosis: 'Primary Hypertension',
      whyPlausibleEarly:
        'Severe hypertension is common and may be discovered during headache or palpitations.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence:
            'recurrent stereotyped attacks of headache, palpitations, and diaphoresis',
          reason:
            'A repeated symptom cluster suggests episodic mediator release rather than uncomplicated primary hypertension.',
        },
        {
          clueOrder: 2,
          evidence:
            'extreme blood-pressure rise during an attack followed by substantial improvement within 30 minutes',
          reason:
            'Marked paroxysmal fluctuation is a clue to secondary hypertension.',
        },
        {
          clueOrder: 4,
          evidence: 'markedly elevated plasma free metanephrines',
          reason:
            'The biochemical abnormality identifies a catecholamine-mediated secondary cause.',
        },
      ],
      finalReasonLessLikely:
        'Primary hypertension does not explain the stereotyped adrenergic attacks, biochemical findings, and adrenal lesion.',
    },
    {
      diagnosis: 'Hypoglycaemia',
      whyPlausibleEarly:
        'Hypoglycaemia can produce sweating, tremor, palpitations, anxiety, pallor, and a sense of impending collapse.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence:
            'paroxysmal hypertensive crisis with regular tachycardia',
          reason:
            'The dominant objective abnormality is extreme hypertension rather than documented low glucose.',
        },
        {
          clueOrder: 4,
          evidence:
            'marked elevation of plasma free normetanephrine and metanephrine',
          reason:
            'This supports autonomous catecholamine production rather than a normal counter-regulatory response to low glucose.',
        },
        {
          clueOrder: 5,
          evidence: 'right adrenal mass',
          reason:
            'The lesion anatomically localizes the source of catecholamine excess.',
        },
      ],
      finalReasonLessLikely:
        'Hypoglycaemia may mimic the adrenergic symptoms but does not explain the biochemical and imaging findings.',
    },
    {
      diagnosis: 'Carcinoid Syndrome',
      whyPlausibleEarly:
        'Episodic autonomic symptoms and palpitations can raise concern for another secretory neuroendocrine tumour.',
      ruledOutByClues: [
        {
          clueOrder: 3,
          evidence: 'pallor without flushing, wheeze, or urticaria',
          reason:
            'The examination lacks the typical vasodilatory and bronchospastic pattern expected in carcinoid syndrome.',
        },
        {
          clueOrder: 4,
          evidence:
            'marked elevation of plasma free metanephrines',
          reason:
            'The measured metabolites specifically support catecholamine excess rather than serotonin-mediated symptoms.',
        },
        {
          clueOrder: 5,
          evidence: 'adrenal mass',
          reason:
            'An adrenal chromaffin tumour fits the biochemical pattern better than a serotonin-secreting gastrointestinal or bronchial neuroendocrine tumour.',
        },
      ],
      finalReasonLessLikely:
        'The attacks are adrenergic and pale rather than flushing and bronchospastic, and the biochemical result localizes the hormonal pathway.',
    },
  ],
  managementPearl:
    'Treat this as a specialist endocrine and perioperative problem. Confirm biochemistry, localize the tumour, assess hereditary risk, establish alpha-adrenergic blockade before any beta-blocker is considered, restore contracted intravascular volume, and proceed to adrenalectomy after appropriate multidisciplinary preparation.',
  generationQuality: {
    contentTier: 'FLAGSHIP',
    seedVersion,
    humanReviewed: true,
    clueProgressionVerified: true,
    discriminatorStrength: 'HIGH',
    expectedTeachingPoints: [
      'Pheochromocytoma may cause episodic headache, palpitations, diaphoresis, pallor, tremor, and paroxysmal hypertension',
      'Objective blood pressure recorded during a typical attack is a major discriminator',
      'Initial biochemical testing uses plasma free or urinary fractionated metanephrines',
      'Imaging should follow convincing biochemical evidence rather than precede it',
      'Preoperative alpha-adrenergic blockade must precede beta-blockade',
      'Adrenal pheochromocytoma should prompt consideration of genetic assessment and long-term follow-up',
    ],
    competencyDomains: [
      'Endocrinology',
      'Adrenal Disorders',
      'Secondary Hypertension',
      'Clinical Reasoning',
      'Perioperative Medicine',
    ],
  },
};

const educationForFrontend = {
  title: displayLabel,
  summary: {
    definition:
      'Pheochromocytoma is a catecholamine-producing tumour arising from adrenal chromaffin cells. A similar tumour arising outside the adrenal gland is termed a paraganglioma.',
    highYieldTakeaway:
      'Think pheochromocytoma when recurrent adrenergic attacks are accompanied by documented paroxysmal or sustained hypertension; confirm with plasma free or urinary fractionated metanephrines before anatomical localization.',
  },
  recognitionPattern: [
    {
      pattern: 'Paroxysmal adrenergic attacks',
      whyItMatters:
        'The combination of sudden headache, palpitations, sweating, pallor, and tremor suggests episodic catecholamine release.',
      progression:
        'Intermittent catecholamine secretion -> abrupt vasoconstriction and cardiac stimulation -> headache, pallor, sweating, tremor, tachycardia, and blood-pressure surges -> increasing attack frequency or cardiovascular complications.',
      discriminator:
        'The most useful separator is objective hypertension or tachycardia recorded during a stereotyped attack, followed by biochemical confirmation.',
      commonTrap:
        'Do not stop at panic disorder when attacks are associated with extreme or highly variable blood pressure.',
    },
    {
      pattern: 'Paroxysmal or sustained secondary hypertension',
      whyItMatters:
        'Pheochromocytoma may present with episodic crises, sustained hypertension, or alternating hypertension and relative hypotension.',
      discriminator:
        'Large blood-pressure swings combined with adrenergic symptoms increase suspicion for a catecholamine-mediated cause.',
      commonTrap:
        'A normal blood pressure between attacks does not exclude the diagnosis.',
    },
    {
      pattern: 'Biochemistry before localization',
      whyItMatters:
        'Metanephrines are continuously produced within catecholamine-secreting tumours and are preferred initial biochemical markers.',
      discriminator:
        'Marked elevations, especially at least three times the upper reference limit, are less likely to be false positives than borderline results.',
      commonTrap:
        'Do not interpret a mild elevation without reviewing posture, stress, medications, acute illness, and assay conditions.',
    },
  ],
  keySymptoms: [
    {
      symptom: 'Episodic pounding headache',
      significance:
        'Commonly accompanies abrupt catecholamine-mediated blood-pressure elevation.',
    },
    {
      symptom: 'Palpitations',
      significance:
        'Reflect beta-adrenergic cardiac stimulation and may occur with regular tachycardia.',
    },
    {
      symptom: 'Profuse sweating',
      significance:
        'A frequent autonomic manifestation during attacks.',
    },
    {
      symptom: 'Tremor and intense anxiety',
      significance:
        'May mimic panic disorder but should be interpreted with objective haemodynamic findings.',
    },
    {
      symptom: 'Nausea or abdominal discomfort',
      significance:
        'Can accompany severe sympathetic activation and should not distract from the cardiovascular pattern.',
    },
  ],
  keySigns: [
    {
      finding: 'Paroxysmal severe hypertension',
      significance:
        "A major discriminator when documented during the patient's typical symptoms.",
      discriminator:
        'Extreme episodic blood-pressure elevation is less typical of uncomplicated panic disorder.',
    },
    {
      finding: 'Tachycardia',
      significance:
        'Supports adrenergic stimulation, although some patients may have a normal rate or reflex bradycardia.',
    },
    {
      finding: 'Pallor and clamminess',
      significance:
        'Vasoconstriction favors pheochromocytoma over flushing syndromes.',
      discriminator:
        'Carcinoid syndrome and mast-cell mediator release more often produce flushing rather than pallor.',
    },
    {
      finding: 'Orthostatic blood-pressure fall',
      significance:
        'May reflect chronic catecholamine-related volume contraction, although it is not required for diagnosis.',
    },
  ],
  examPearls: [
    {
      type: 'DISCRIMINATOR',
      title: 'Capture the vital signs during an attack',
      content:
        'Blood pressure and pulse recorded while the patient is experiencing the usual symptoms can transform a vague history into objective evidence of paroxysmal haemodynamic instability.',
      whyItMatters:
        'The same symptoms may occur in panic disorder, thyrotoxicosis, hypoglycaemia, and arrhythmia.',
      discriminator:
        'A severe blood-pressure surge during a stereotyped episode strongly supports investigation for secondary hypertension.',
      trapAvoided:
        'Do not dismiss repeatedly normal clinic readings when attacks occur outside the consultation.',
    },
    {
      type: 'DISCRIMINATOR',
      title: 'Pallor points toward vasoconstriction',
      content:
        'Catecholamine-mediated vasoconstriction may make the patient pale and clammy during an attack.',
      whyItMatters:
        'This helps distinguish an adrenergic crisis from conditions dominated by vasodilatory flushing.',
      discriminator:
        'Pallor favors catecholamine excess; flushing with wheeze or diarrhoea suggests other mediator syndromes.',
      trapAvoided:
        'Do not treat all episodic autonomic symptoms as equivalent.',
    },
    {
      type: 'SAFETY',
      title: 'Alpha blockade precedes beta blockade',
      content:
        'A beta-blocker must not be introduced before adequate alpha-adrenergic blockade in a functional pheochromocytoma.',
      whyItMatters:
        'Blocking beta effects first can leave alpha-mediated vasoconstriction unopposed and worsen hypertension.',
      discriminator:
        'This sequencing principle is specific and clinically important in catecholamine-secreting tumours.',
      trapAvoided:
        'Do not treat tachycardia in isolation before controlling alpha-mediated vasoconstriction.',
    },
  ],
  scoringSystems: [],
  investigations: [
    {
      test: 'Plasma free metanephrines',
      interpretation:
        'A recommended initial biochemical test; marked elevation strongly supports a catecholamine-secreting chromaffin tumour when sampling conditions are appropriate.',
      commonTrap:
        'Upright posture, acute illness, stress, and some medicines may contribute to false-positive or borderline results.',
    },
    {
      test: 'Twenty-four-hour urinary fractionated metanephrines',
      interpretation:
        'An accepted alternative initial biochemical test, particularly where standardized supine plasma sampling is impractical.',
      commonTrap:
        'Confirm collection completeness and avoid relying on an unvalidated spot urine sample.',
    },
    {
      test: 'CT abdomen and pelvis',
      interpretation:
        'Common first-choice anatomical imaging after clear biochemical evidence because it localizes adrenal and many extra-adrenal tumours.',
      commonTrap:
        'Do not image first and then assume every adrenal incidentaloma is functional.',
    },
    {
      test: 'MRI',
      interpretation:
        'Useful when radiation should be limited, contrast is unsuitable, or disease is suspected in locations where MRI performs better.',
    },
    {
      test: 'Genetic assessment',
      interpretation:
        'Pheochromocytoma and paraganglioma have important hereditary associations; testing should be considered through shared decision-making and specialist counselling.',
      commonTrap:
        'Young age, multifocal disease, extra-adrenal disease, recurrence, or family history should not be ignored.',
    },
  ],
  differentialDistinguishers: [
    {
      diagnosis: 'Panic Disorder',
      keySeparator:
        'Extreme paroxysmal hypertension and marked metanephrine elevation point to a catecholamine-secreting tumour rather than primary panic disorder.',
    },
    {
      diagnosis: 'Thyrotoxicosis',
      keySeparator:
        'Thyrotoxicosis is usually more persistent and is supported by suppressed TSH and elevated thyroid hormones.',
    },
    {
      diagnosis: 'Primary Hypertension',
      keySeparator:
        'Stereotyped adrenergic attacks, large blood-pressure swings, and abnormal metanephrines indicate a secondary cause.',
    },
    {
      diagnosis: 'Hypoglycaemia',
      keySeparator:
        'Document low plasma glucose during symptoms; metanephrine elevation and an adrenal mass support pheochromocytoma instead.',
    },
    {
      diagnosis: 'Carcinoid Syndrome',
      keySeparator:
        'Flushing, diarrhoea, and bronchospasm favor carcinoid syndrome, whereas pallor and hypertensive adrenergic attacks favor pheochromocytoma.',
    },
  ],
  managementOverview: [
    {
      step: 'Specialist multidisciplinary assessment',
      rationale:
        'Endocrinology, anaesthesia, surgery, genetics, and radiology input reduce diagnostic and perioperative risk.',
    },
    {
      step: 'Alpha-adrenergic blockade',
      rationale:
        'Functional tumours require preoperative blockade, with alpha blockade used first to control vasoconstriction and blood pressure.',
    },
    {
      step: 'Volume and sodium repletion after alpha blockade',
      rationale:
        'Chronic catecholamine excess contracts intravascular volume; appropriate repletion helps reduce severe hypotension after tumour removal.',
    },
    {
      step: 'Add beta-blockade only when indicated and only after alpha blockade',
      rationale:
        'Persistent tachycardia may require beta-blockade, but premature beta-blockade risks unopposed alpha-mediated vasoconstriction.',
    },
    {
      step: 'Definitive tumour resection',
      rationale:
        'Adrenalectomy is the definitive treatment for a localized adrenal pheochromocytoma after adequate preparation.',
    },
    {
      step: 'Postoperative biochemical and long-term follow-up',
      rationale:
        'Follow-up detects persistent, recurrent, new, or metastatic disease and is particularly important in hereditary syndromes.',
    },
  ],
  complications: [
    {
      complication: 'Hypertensive emergency',
      significance:
        'Severe vasoconstriction can cause encephalopathy, retinal injury, aortic complications, or acute kidney injury.',
    },
    {
      complication: 'Arrhythmia and myocardial injury',
      significance:
        'Catecholamine excess may cause tachyarrhythmia, myocardial infarction, or stress/catecholamine cardiomyopathy.',
    },
    {
      complication: 'Pulmonary oedema',
      significance:
        'Acute cardiac dysfunction or extreme afterload can produce respiratory compromise.',
    },
    {
      complication: 'Perioperative haemodynamic collapse',
      significance:
        'Tumour manipulation can provoke severe hypertension, while removal may be followed by profound hypotension.',
    },
    {
      complication: 'Persistent, recurrent, or metastatic disease',
      significance:
        'Long-term surveillance is needed because recurrence or metastasis may occur after apparently complete resection.',
    },
  ],
  pitfalls: [
    {
      pitfall: 'Diagnosing panic disorder without checking blood pressure during attacks',
      consequence:
        'A potentially dangerous endocrine cause of episodic symptoms may be missed.',
    },
    {
      pitfall: 'Using imaging as the first diagnostic test',
      consequence:
        'An incidental adrenal lesion may be incorrectly assumed to explain nonspecific symptoms.',
    },
    {
      pitfall: 'Overcalling a borderline metanephrine elevation',
      consequence:
        'Poor sampling conditions, stress, acute illness, and medication effects can generate false-positive results.',
    },
    {
      pitfall: 'Starting beta-blockade before alpha-blockade',
      consequence:
        'Unopposed alpha-mediated vasoconstriction can precipitate or worsen severe hypertension.',
    },
    {
      pitfall: 'Ignoring hereditary risk',
      consequence:
        'Associated tumours, family risk, multifocal disease, and lifelong surveillance needs may be missed.',
    },
  ],
  recallPrompts: [
    {
      prompt: 'What symptom cluster should raise suspicion for pheochromocytoma?',
      answer:
        'Recurrent attacks of headache, palpitations, sweating, pallor, tremor, and hypertension.',
    },
    {
      prompt: 'What are the preferred initial biochemical tests?',
      answer:
        'Plasma free metanephrines or twenty-four-hour urinary fractionated metanephrines.',
    },
    {
      prompt: 'Why are metanephrines preferred to measuring catecholamines alone?',
      answer:
        'Tumours continuously produce metanephrines even when catecholamine release is intermittent.',
    },
    {
      prompt: 'When should anatomical imaging be performed?',
      answer:
        'After clear biochemical evidence of a catecholamine-secreting tumour.',
    },
    {
      prompt: 'What medication sequence is essential before surgery?',
      answer:
        'Establish alpha-adrenergic blockade before considering beta-blockade.',
    },
    {
      prompt: 'Why is sodium and fluid repletion used during preparation?',
      answer:
        'To reverse catecholamine-related intravascular volume contraction and reduce postoperative hypotension.',
    },
    {
      prompt: 'What is the definitive treatment for a localized adrenal pheochromocytoma?',
      answer:
        'Adrenalectomy after adequate multidisciplinary preoperative preparation.',
    },
  ],
  references: [
    {
      citation:
        'Lenders JWM, et al. Pheochromocytoma and Paraganglioma: An Endocrine Society Clinical Practice Guideline. Journal of Clinical Endocrinology & Metabolism. 2014;99(6):1915-1942.',
    },
    {
      citation:
        'Plouin PF, et al. European Society of Endocrinology Clinical Practice Guideline for long-term follow-up of patients operated on for a pheochromocytoma or paraganglioma. European Journal of Endocrinology. 2016;174:G1-G10.',
    },
    {
      citation:
        'Williams Textbook of Endocrinology. Adrenal Medulla, Pheochromocytoma, and Paraganglioma.',
    },
  ],
};

async function ensureRegistry() {
  const normalizedTerms = aliasTerms.map(normalizeClinicalText);
  const canonicalNormalized = normalizeClinicalText(canonicalName);

  const canonicalRegistry = await prisma.diagnosisRegistry.findUnique({
    where: { canonicalNormalized },
    select: { id: true },
  });

  const aliasRegistry = canonicalRegistry
    ? null
    : await prisma.diagnosisRegistry.findFirst({
        where: {
          aliases: {
            some: {
              normalizedTerm: { in: normalizedTerms },
              active: true,
            },
          },
        },
        select: { id: true },
      });

  const existing = canonicalRegistry ?? aliasRegistry;

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
          subspecialty: 'Adrenal Disorders',
          category: 'Catecholamine-Secreting Tumour',
          bodySystem: 'Endocrine',
          organSystem: 'Adrenal Gland',
          difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
          rarityBand: DiagnosisRarityBand.UNCOMMON,
          clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
          ageGroup: DiagnosisAgeGroup.ADULT,
          urgencyLevel: DiagnosisUrgencyLevel.URGENT,
          preferredClueTypes: [
            'history',
            'symptom',
            'vital',
            'exam',
            'lab',
            'imaging',
          ],
          notes:
            'Flagship pheochromocytoma registry entry emphasizing paroxysmal adrenergic attacks, documented hypertensive crisis, metanephrine confirmation, adrenal localization, and safe perioperative sequencing.',
        },
        select: {
          id: true,
          displayLabel: true,
        },
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
          subspecialty: 'Adrenal Disorders',
          category: 'Catecholamine-Secreting Tumour',
          bodySystem: 'Endocrine',
          organSystem: 'Adrenal Gland',
          difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
          rarityBand: DiagnosisRarityBand.UNCOMMON,
          clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
          ageGroup: DiagnosisAgeGroup.ADULT,
          urgencyLevel: DiagnosisUrgencyLevel.URGENT,
          preferredClueTypes: [
            'history',
            'symptom',
            'vital',
            'exam',
            'lab',
            'imaging',
          ],
          notes:
            'Flagship pheochromocytoma registry entry emphasizing paroxysmal adrenergic attacks, documented hypertensive crisis, metanephrine confirmation, adrenal localization, and safe perioperative sequencing.',
        },
        select: {
          id: true,
          displayLabel: true,
        },
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

async function upsertEducation(diagnosisRegistryId: string) {
  const existing = await prisma.diagnosisEducation.findUnique({
    where: { diagnosisRegistryId },
    select: { id: true, version: true },
  });

  const education = existing
    ? await prisma.diagnosisEducation.update({
        where: { id: existing.id },
        data: {
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
          version: { increment: 1 },
        },
        select: { id: true, version: true },
      })
    : await prisma.diagnosisEducation.create({
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

async function upsertCase(params: {
  diagnosisRegistryId: string;
  registryDisplayLabel: string;
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

  const reusableCase = existingCases.find(
    (candidate) => candidate.dailyCases.length === 0,
  );
  const scheduledCase = existingCases.find(
    (candidate) => candidate.dailyCases.length > 0,
  );

  if (scheduledCase) {
    console.log(
      'Skipped existing scheduled Pheochromocytoma case:',
      scheduledCase,
    );
    return;
  }

  const assignedDate = await findAvailableInventoryPlaceholderDate({
    preferredDate: inventoryPlaceholderDate,
    reusableCaseId: reusableCase?.id,
    displayLabel: caseTitle,
  });

  const publicNumber =
    reusableCase?.publicNumber ?? (await getNextCasePublicNumber());

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
      'Seeded complete frontend-aligned flagship Pheochromocytoma case with paroxysmal symptoms, documented hypertensive attack, biochemical confirmation, adrenal localization, differential analysis, and diagnosis education.',
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
        'Created complete Pheochromocytoma revision with clue-order-aligned differential analysis and full diagnosis education.',
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
      validatorVersion: 'flagship-human-review:pheochromocytoma-v1',
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        clueProgressionVerified: true,
        metadataVerified: {
          specialty: 'Endocrinology',
          subspecialty: 'Adrenal Disorders',
          category: 'Catecholamine-Secreting Tumour',
          bodySystem: 'Endocrine',
          organSystem: 'Adrenal Gland',
          difficultyBand: 'INTERMEDIATE',
          rarityBand: 'UNCOMMON',
          clinicalSetting: 'EMERGENCY',
          ageGroup: 'ADULT',
          urgencyLevel: 'URGENT',
        },
        note:
          'Complete Pheochromocytoma flagship seed with six supported playable clues, correctly aligned clueOrder references, canonical aliases, full education payload, and alpha-before-beta safety teaching.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded Pheochromocytoma:', {
    registryId: params.diagnosisRegistryId,
    registryDisplayLabel: params.registryDisplayLabel,
    caseId: seededCase.id,
    revisionId: revision.id,
    publicNumber,
    educationId: params.educationId,
    clueTypes: clues.map((clue) => clue.type),
  });
}

async function main() {
  assertSeedShape();

  const registry = await ensureRegistry();
  const education = await upsertEducation(registry.id);

  await upsertCase({
    diagnosisRegistryId: registry.id,
    registryDisplayLabel: registry.displayLabel,
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
