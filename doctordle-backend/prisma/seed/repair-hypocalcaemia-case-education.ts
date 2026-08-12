import 'dotenv/config';
import {
  PrismaClient,
  CaseSource,
  DiagnosisEducationSource,
  DiagnosisEducationStatus,
  DiagnosisMappingMethod,
  DiagnosisMappingStatus,
  PublishTrack,
  ValidationOutcome,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/**
 * REPAIR - Hypocalcaemia case progression and diagnosis education
 *
 * Repairs:
 * 1. Removes thyroidectomy/postoperative context from the opening clue and title.
 * 2. Moves total-thyroidectomy history to clue 4, after biochemical confirmation.
 * 3. Keeps the canonical diagnosis as Hypocalcaemia.
 * 4. Preserves six playable clues using supported clue types only.
 * 5. Rebuilds clueBreakdown so every entry exactly matches its clue.
 * 6. Replaces label-only education arrays with frontend-aligned structured objects.
 * 7. Gives every important clinical sign an individual description, significance,
 *    discriminator, and relevant safety context.
 * 8. Creates a new case revision and diagnosis-education revision.
 * 9. Does not alter DailyCase scheduling or the case date.
 *
 * Revised clue progression:
 * history -> symptom -> exam -> lab -> history -> lab
 *
 * Run:
 *   npx tsx prisma/repair/repair-hypocalcaemia-case-education.ts
 *
 * Railway:
 *   railway run npx tsx prisma/repair/repair-hypocalcaemia-case-education.ts
 */

const databaseUrl = resolvePgConnectionString(process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required to run the Hypocalcaemia repair.',
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

const now = new Date();
const repairVersion = 'repair-hypocalcaemia-case-education-v2';
const canonicalName = 'hypocalcaemia';
const displayLabel = 'Hypocalcaemia';

const previousCaseTitle =
  'Perioral Tingling and Painful Hand Spasms After Thyroid Surgery';
const repairedCaseTitle = 'Perioral Tingling and Painful Hand Spasms';

const acceptedDiagnosisTerms = ['Hypocalcaemia', 'Hypocalcemia'];

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 41-year-old woman presents with sudden tingling around the mouth and in the fingertips of both hands that began earlier today. She had been well before this episode and has no chronic kidney disease, prolonged diarrhoea, malabsorption, heavy alcohol use, or regular bisphosphonate or anticonvulsant treatment.',
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
      'Inflation of a blood-pressure cuff above systolic pressure produces flexion of the wrists and metacarpophalangeal joints with extension of the fingers and adduction of the thumbs. Tapping over each facial nerve causes ipsilateral facial twitching. Deep-tendon reflexes are brisk, while power, speech, cranial-nerve examination, and sensation between spasms are otherwise normal.',
  },
  {
    order: 3,
    type: 'lab',
    value:
      'Serum total calcium is 1.66 mmol/L with albumin 41 g/L, and directly measured ionised calcium is 0.78 mmol/L. Sodium, potassium, and glucose are within their reference ranges.',
  },
  {
    order: 4,
    type: 'history',
    value:
      'Focused review reveals that she underwent an uncomplicated total thyroidectomy for a multinodular goitre approximately 30 hours before the symptoms began. Her preoperative calcium concentration was normal, and there was no previous parathyroid or neck operation.',
  },
  {
    order: 5,
    type: 'lab',
    value:
      'Serum phosphate is elevated at 1.88 mmol/L and intact parathyroid hormone is inappropriately low at 0.7 pmol/L. Magnesium is 0.84 mmol/L, creatinine is 72 micromol/L, and 25-hydroxyvitamin D is 76 nmol/L. Repeat ionised calcium has fallen to 0.72 mmol/L.',
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
    'Acute perioral and distal paraesthesia progressing to carpopedal spasm, positive Trousseau and Chvostek signs, and markedly reduced total and ionised calcium establish Hypocalcaemia. The later history of total thyroidectomy, hyperphosphataemia, and an inappropriately low parathyroid hormone concentration identify postoperative hypoparathyroidism as the cause.',
  reasoning: [
    'The opening symptoms indicate an acute, symmetrical neuromuscular process rather than a focal neurological lesion.',
    'Perioral paraesthesia, distal tingling, painful cramps, and bilateral carpopedal spasm are characteristic consequences of increased neuromuscular excitability.',
    'Trousseau sign and Chvostek sign provide bedside evidence of tetany, while brisk reflexes support diffuse neuromuscular hyperexcitability.',
    'A normal albumin concentration shows that the low total calcium is not explained by hypoalbuminaemia.',
    'Directly measured low ionised calcium confirms reduction of the biologically active calcium fraction and establishes true Hypocalcaemia.',
    'The thyroidectomy history is deliberately revealed only after biochemical confirmation, so it explains the cause without giving away the diagnosis in the opening clue.',
    'High phosphate with low PTH indicates deficient parathyroid hormone activity rather than the compensatory secondary hyperparathyroidism expected in vitamin D deficiency or chronic kidney disease.',
    'Normal magnesium, preserved renal function, and adequate vitamin D make important alternative causes less likely.',
    'The falling ionised calcium and symptomatic tetany indicate acute severe disease requiring urgent monitored calcium replacement.',
    'The canonical diagnosis remains Hypocalcaemia; postoperative hypoparathyroidism is the aetiology rather than the answer label.',
  ],
  clueBreakdown: [
    {
      clueOrder: 0,
      clueType: 'history',
      clue: clues[0].value,
      explanation:
        'The first clue establishes an acute symmetrical sensory presentation and removes several common chronic causes without revealing surgery or parathyroid injury. Perioral and bilateral fingertip tingling should raise consideration of a metabolic or acid-base disturbance before a focal neurological diagnosis.',
      diagnosticContribution:
        'Opens a broad metabolic-neuromuscular differential while preserving diagnostic uncertainty.',
    },
    {
      clueOrder: 1,
      clueType: 'symptom',
      clue: clues[1].value,
      explanation:
        'Progression from paraesthesia to painful bilateral hand and foot contraction is typical of tetany. Preserved consciousness and the absence of lateralising or postictal features reduce the likelihood of seizure or stroke.',
      diagnosticContribution:
        'Narrows the differential toward reduced ionised calcium, magnesium deficiency, or alkalosis.',
    },
    {
      clueOrder: 2,
      clueType: 'exam',
      clue: clues[2].value,
      explanation:
        'The cuff-induced posture is Trousseau sign: carpal spasm with wrist and metacarpophalangeal flexion, interphalangeal extension, and thumb adduction. Facial twitching after tapping the facial nerve is Chvostek sign. Together with brisk reflexes and an otherwise normal neurological examination, these findings support diffuse neuromuscular hyperexcitability.',
      diagnosticContribution:
        'Provides strong bedside evidence of tetany while still requiring biochemical confirmation.',
    },
    {
      clueOrder: 3,
      clueType: 'lab',
      clue: clues[3].value,
      explanation:
        'Both total and ionised calcium are markedly reduced. Normal albumin excludes a falsely low total calcium caused by reduced protein binding, and normal glucose excludes hypoglycaemia as the cause of the neurological symptoms.',
      diagnosticContribution:
        'Biochemically confirms the canonical diagnosis of Hypocalcaemia.',
    },
    {
      clueOrder: 4,
      clueType: 'history',
      clue: clues[4].value,
      explanation:
        'Total thyroidectomy can transiently impair parathyroid perfusion or function. Revealing this history after calcium confirmation preserves the case challenge while supplying a strong causal context for an acute low-PTH state.',
      diagnosticContribution:
        'Introduces the most likely aetiology after the learner has already identified the electrolyte disorder.',
    },
    {
      clueOrder: 5,
      clueType: 'lab',
      clue: clues[5].value,
      explanation:
        'PTH should rise when calcium falls. An inappropriately low PTH with hyperphosphataemia therefore identifies deficient parathyroid hormone activity. Normal magnesium, renal function, and vitamin D reduce competing explanations, while the falling ionised calcium confirms active severe disease.',
      diagnosticContribution:
        'Defines postoperative hypoparathyroidism as the mechanism and establishes treatment urgency without replacing Hypocalcaemia as the diagnosis.',
    },
  ],
  keyFindings: [
    'Age 41 years',
    'Acute perioral paraesthesia',
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
    'Total thyroidectomy approximately 30 hours earlier',
    'Normal preoperative calcium',
    'Phosphate 1.88 mmol/L',
    'Inappropriately low parathyroid hormone',
    'Normal magnesium',
    'Normal renal function',
    'Adequate 25-hydroxyvitamin D',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Hypomagnesaemia',
      whyPlausibleEarly:
        'Magnesium depletion can cause paraesthesia, cramps, tetany, and secondary low calcium through impaired PTH release or action.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence:
            'no prolonged diarrhoea, malabsorption, or heavy alcohol use',
          reason:
            'The opening history does not identify a strong source of magnesium depletion.',
        },
        {
          clueOrder: 5,
          evidence: 'serum magnesium is 0.84 mmol/L',
          reason:
            'A normal magnesium concentration makes magnesium deficiency an unlikely primary driver.',
        },
      ],
      finalReasonLessLikely:
        'Magnesium is normal, while the low-PTH postoperative pattern directly explains the calcium disturbance.',
    },
    {
      diagnosis: 'Respiratory Alkalosis',
      whyPlausibleEarly:
        'Hyperventilation can lower ionised calcium and produce perioral tingling and carpopedal spasm.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence:
            'no panic episode, respiratory distress, or sustained hyperventilation is reported',
          reason:
            'There is no clear clinical trigger for an acute alkalosis syndrome.',
        },
        {
          clueOrder: 3,
          evidence:
            'markedly low total calcium with normal albumin as well as low ionised calcium',
          reason:
            'Isolated alkalosis usually lowers ionised calcium through altered binding without this degree of true total-calcium reduction.',
        },
        {
          clueOrder: 5,
          evidence: 'high phosphate with inappropriately low PTH',
          reason:
            'This pattern identifies impaired parathyroid regulation rather than isolated respiratory alkalosis.',
        },
      ],
      finalReasonLessLikely:
        'True low total calcium and a low-PTH hyperphosphataemic pattern are not explained by hyperventilation alone.',
    },
    {
      diagnosis: 'Acute Dystonic Reaction',
      whyPlausibleEarly:
        'A drug-induced dystonia can cause painful involuntary posturing of the hands, face, jaw, neck, or eyes.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence:
            'no dopamine-blocking antiemetic or antipsychotic exposure is reported',
          reason:
            'Acute dystonia normally follows exposure to a causative medicine.',
        },
        {
          clueOrder: 2,
          evidence:
            'reproducible Trousseau sign, Chvostek sign, and brisk reflexes',
          reason:
            'These findings support generalized neuromuscular excitability rather than focal dystonic posturing.',
        },
        {
          clueOrder: 3,
          evidence: 'confirmed low total and ionised calcium',
          reason:
            'The biochemical abnormality directly explains the spasms.',
        },
      ],
      finalReasonLessLikely:
        'There is no drug trigger, and the bedside signs plus biochemistry establish tetany.',
    },
    {
      diagnosis: 'Hypoglycaemia',
      whyPlausibleEarly:
        'Low glucose may cause tremor, paraesthesia, confusion, seizure, or collapse.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'preserved consciousness without autonomic symptoms',
          reason:
            'The presentation is dominated by tetany rather than neuroglycopenia or adrenergic activation.',
        },
        {
          clueOrder: 3,
          evidence: 'glucose is within the reference range',
          reason: 'Normal glucose directly excludes hypoglycaemia.',
        },
      ],
      finalReasonLessLikely:
        'The glucose is normal and the calcium abnormality explains the symptoms.',
    },
    {
      diagnosis: 'Focal Seizure',
      whyPlausibleEarly:
        'A focal motor seizure may cause involuntary limb movement with preserved awareness.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence:
            'bilateral sustained hand contraction without impaired awareness, incontinence, tongue biting, or postictal symptoms',
          reason:
            'The pattern is more consistent with tetany than cortical seizure activity.',
        },
        {
          clueOrder: 2,
          evidence: 'spasm is reproducibly provoked by cuff inflation',
          reason:
            'Trousseau sign indicates peripheral neuromuscular excitability rather than a cortical discharge.',
        },
        {
          clueOrder: 3,
          evidence: 'markedly reduced ionised calcium',
          reason:
            'The metabolic abnormality provides a direct cause for the spasms.',
        },
      ],
      finalReasonLessLikely:
        'The bilateral provoked carpal spasm and low ionised calcium establish tetany rather than a focal seizure.',
    },
    {
      diagnosis: 'Peripheral Neuropathy',
      whyPlausibleEarly:
        'Peripheral nerve disease can produce distal symmetrical tingling and sensory discomfort.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence: 'sudden onset over hours with no previous similar symptoms',
          reason:
            'Most peripheral neuropathies evolve over a longer period and do not cause acute painful carpal spasm.',
        },
        {
          clueOrder: 2,
          evidence:
            'brisk rather than reduced reflexes and normal sensation between spasms',
          reason:
            'This pattern is inconsistent with a length-dependent peripheral neuropathy.',
        },
        {
          clueOrder: 3,
          evidence: 'low ionised calcium',
          reason:
            'The calcium deficit explains both the paraesthesia and muscular contractions.',
        },
      ],
      finalReasonLessLikely:
        'Acute tetany, brisk reflexes, and low calcium do not fit peripheral neuropathy.',
    },
  ] satisfies DifferentialAnalysisEntry[],
  managementPearl:
    'Symptomatic acute Hypocalcaemia with tetany requires urgent monitored intravenous calcium gluconate. Assess and correct magnesium, obtain an electrocardiogram, identify the cause, and transition to oral calcium with activated vitamin D when postoperative hypoparathyroidism is confirmed and the patient is stable.',
  generationQuality: {
    contentTier: 'FLAGSHIP',
    repairVersion,
    humanReviewed: true,
    canonicalDiagnosisVerified: true,
    clueProgressionVerified: true,
    earlyAetiologyLeakRemoved: true,
    breakdownClueReferencesValidated: true,
    expectedTeachingPoints: [
      'Perioral and distal paraesthesia may precede overt tetany',
      'Trousseau sign is cuff-induced carpal spasm',
      'Chvostek sign supports neuromuscular irritability but is not independently diagnostic',
      'Low ionised calcium confirms biologically important Hypocalcaemia',
      'The thyroidectomy history should explain the cause only after the diagnosis is established',
      'Low calcium with high phosphate and low PTH indicates hypoparathyroidism',
      'Normal magnesium helps exclude a reversible cause of impaired PTH release and action',
      'Acute symptomatic disease requires monitored intravenous calcium',
    ],
    competencyDomains: [
      'Endocrinology',
      'Electrolyte Disorders',
      'Parathyroid Disease',
      'Emergency Medicine',
      'Clinical Examination',
      'Laboratory Interpretation',
      'Clinical Reasoning',
    ],
  },
};

const educationForFrontend = {
  title: displayLabel,
  summary: {
    definition:
      'Hypocalcaemia is a reduction in circulating calcium. Clinically important disease is best confirmed with ionised calcium when albumin concentration, critical illness, or acid-base disturbance may make total calcium difficult to interpret.',
    highYieldTakeaway:
      'Think of acute Hypocalcaemia when perioral or distal paraesthesia progresses to painful cramps, carpopedal spasm, tetany, seizure, laryngospasm, or QT prolongation; then use PTH, magnesium, phosphate, renal function, and vitamin D to identify the cause.',
  },
  recognitionPattern: [
    {
      pattern: 'Paraesthesia progressing to painful tetany',
      whyItMatters:
        'A rapid fall in ionised calcium increases neuronal and muscular membrane excitability.',
      progression:
        'Perioral tingling -> fingertip or toe paraesthesia -> painful cramps -> carpopedal spasm or generalized tetany.',
      discriminator:
        'The symptoms are usually symmetrical and accompanied by preserved sensation and power between spasms.',
      commonTrap:
        'Do not dismiss the early sensory symptoms as anxiety before considering calcium and acid-base disorders.',
    },
    {
      pattern: 'Provocable neuromuscular excitability',
      whyItMatters:
        'Trousseau and Chvostek signs reveal increased excitability before or during overt tetany.',
      progression:
        'Latent irritability -> cuff-induced carpal spasm or facial twitching -> spontaneous spasm when disease becomes more severe.',
      discriminator:
        'Trousseau sign is generally more clinically useful; Chvostek sign must be interpreted with symptoms and calcium results.',
      commonTrap:
        'Do not diagnose or exclude Hypocalcaemia using Chvostek sign alone.',
    },
    {
      pattern: 'True biochemical calcium deficiency',
      whyItMatters:
        'Total calcium can be misleading when albumin is abnormal, while ionised calcium reflects the biologically active fraction.',
      progression:
        'Low calcium result -> assess albumin and acid-base context -> confirm with ionised calcium when clinically important.',
      discriminator:
        'A low ionised calcium confirms true physiological deficiency.',
      commonTrap:
        'Do not treat an isolated low total calcium as severe disease without considering albumin, symptoms, and ionised calcium.',
    },
    {
      pattern: 'Low-PTH hyperphosphataemia after neck surgery',
      whyItMatters:
        'PTH should increase during Hypocalcaemia; failure to do so indicates impaired parathyroid secretion or action.',
      progression:
        'Neck surgery -> reduced parathyroid perfusion or function -> low PTH -> falling calcium and rising phosphate.',
      discriminator:
        'Low calcium with high phosphate and low or inappropriately normal PTH strongly supports hypoparathyroidism.',
      commonTrap:
        'Use postoperative hypoparathyroidism as the cause, not as a substitute for the canonical diagnosis Hypocalcaemia.',
    },
  ],
  keySymptoms: [
    {
      symptom: 'Perioral numbness or tingling',
      significance:
        'A common early manifestation of increased neuromuscular excitability during an acute fall in ionised calcium.',
    },
    {
      symptom: 'Distal paraesthesia',
      significance:
        'Symmetrical tingling in the fingers and toes often accompanies perioral symptoms and may precede overt tetany.',
    },
    {
      symptom: 'Painful muscle cramps',
      significance:
        'Indicate progression from sensory irritability to involuntary muscular contraction.',
    },
    {
      symptom: 'Carpopedal spasm',
      significance:
        'Painful involuntary contraction of the hands or feet is a characteristic manifestation of acute tetany.',
    },
    {
      symptom: 'Throat tightness, stridor, or dyspnoea',
      significance:
        'May indicate laryngospasm and impending airway compromise in severe disease.',
    },
    {
      symptom: 'Confusion, seizure, palpitation, or syncope',
      significance:
        'Suggests severe neurological or cardiac involvement and requires urgent monitored treatment.',
    },
  ],
  keySigns: [
    {
      finding: 'Trousseau sign',
      significance:
        'Sustained inflation of a blood-pressure cuff above systolic pressure produces carpal spasm with wrist and metacarpophalangeal flexion, interphalangeal extension, and thumb adduction.',
      discriminator:
        'It demonstrates latent tetany and is generally more useful than Chvostek sign, but biochemical confirmation is still required.',
    },
    {
      finding: 'Chvostek sign',
      significance:
        'Tapping the facial nerve anterior to the ear produces ipsilateral contraction of the facial muscles.',
      discriminator:
        'It supports neuromuscular irritability but may occur in healthy individuals or be absent in true Hypocalcaemia.',
    },
    {
      finding: 'Brisk deep-tendon reflexes',
      significance:
        'Hyperreflexia reflects increased peripheral neuromuscular excitability and may accompany paraesthesia or tetany.',
      discriminator:
        'Brisk reflexes with normal power and sensation between spasms favour a metabolic excitability state over peripheral neuropathy.',
    },
    {
      finding: 'Tetany',
      significance:
        'Sustained involuntary muscular contraction may present as carpopedal spasm, generalized stiffness, painful cramps, or repetitive spasms.',
      discriminator:
        'Tetany is a clinical syndrome of neuromuscular hyperexcitability; low ionised calcium confirms Hypocalcaemia as the cause.',
    },
    {
      finding: 'Laryngospasm or stridor',
      significance:
        'Involuntary contraction of laryngeal muscles can cause throat tightness, noisy breathing, respiratory distress, and acute airway compromise.',
      discriminator:
        'This is a severe emergency feature requiring immediate airway assessment and intravenous calcium treatment.',
    },
    {
      finding: 'Seizure or altered mental status',
      significance:
        'Severe calcium deficiency may lower the seizure threshold and cause confusion, reduced consciousness, or generalized seizure activity.',
      discriminator:
        'Check glucose and other electrolytes concurrently, but treat symptomatic low calcium urgently when confirmed or strongly suspected.',
    },
    {
      finding: 'Prolonged QT interval or arrhythmia',
      significance:
        'Delayed ventricular repolarisation produces QT prolongation and may be accompanied by bradyarrhythmia, ventricular arrhythmia, hypotension, or cardiac dysfunction.',
      discriminator:
        'Electrocardiographic abnormality increases the need for continuous monitoring during intravenous calcium replacement.',
    },
  ],
  examPearls: [
    {
      type: 'BEDSIDE_SIGN',
      title: 'Elicit Trousseau sign correctly',
      content:
        'Inflate a blood-pressure cuff above systolic pressure and maintain inflation for up to three minutes while observing the hand for wrist and metacarpophalangeal flexion, interphalangeal extension, and thumb adduction.',
      whyItMatters:
        'A correctly elicited response demonstrates latent neuromuscular excitability and may appear before spontaneous tetany.',
      discriminator:
        'The characteristic carpal posture distinguishes the sign from nonspecific discomfort or voluntary hand movement.',
      trapAvoided:
        'Do not call pain, tingling, or any hand movement during cuff inflation a positive Trousseau sign.',
    },
    {
      type: 'BEDSIDE_SIGN',
      title: 'Interpret Chvostek sign in context',
      content:
        'Tap gently over the facial nerve just anterior to the ear and observe for ipsilateral facial-muscle contraction.',
      whyItMatters:
        'The sign may support the presence of neuromuscular excitability.',
      discriminator:
        'Its limited sensitivity and specificity mean that symptoms, Trousseau sign, and calcium measurements carry more diagnostic weight.',
      trapAvoided:
        'Do not diagnose or exclude Hypocalcaemia from Chvostek sign alone.',
    },
    {
      type: 'NEUROLOGICAL',
      title: 'Distinguish tetany from seizure or dystonia',
      content:
        'Assess symmetry, consciousness, provoking manoeuvres, medication exposure, focal neurological deficits, postictal features, and the examination between spasms.',
      whyItMatters:
        'Tetany can be mistaken for seizure, anxiety-related hyperventilation, or a medication-induced dystonic reaction.',
      discriminator:
        'Bilateral carpopedal spasm, preserved awareness, Trousseau sign, brisk reflexes, and low ionised calcium support tetany.',
      trapAvoided:
        'Do not label every involuntary movement as a seizure before checking glucose, calcium, magnesium, and the clinical pattern.',
    },
    {
      type: 'SAFETY',
      title: 'Assess airway and cardiac rhythm immediately',
      content:
        'Look for stridor, respiratory distress, seizure activity, altered consciousness, hypotension, bradycardia, or an irregular pulse and obtain an electrocardiogram in symptomatic or severe disease.',
      whyItMatters:
        'Severe Hypocalcaemia can compromise the airway, brain, and cardiac conduction system.',
      discriminator:
        'Airway symptoms, seizure, QT prolongation, arrhythmia, or rapidly falling calcium indicate high-risk disease.',
      trapAvoided:
        'Do not delay emergency treatment while completing a full aetiological work-up in an unstable patient.',
    },
  ],
  scoringSystems: [],
  investigations: [
    {
      test: 'Ionised calcium',
      interpretation:
        'A low ionised calcium directly confirms deficiency of the biologically active calcium fraction and is especially useful when albumin or acid-base status may distort total calcium.',
      whyItMatters:
        'It is the most direct biochemical confirmation of clinically important Hypocalcaemia.',
    },
    {
      test: 'Total calcium with albumin',
      interpretation:
        'Low total calcium with normal albumin supports true deficiency. Albumin-adjusted values are estimates and may be unreliable in critical illness.',
      whyItMatters:
        'This helps distinguish true calcium deficiency from a low total value caused by reduced protein binding.',
    },
    {
      test: 'Parathyroid hormone',
      interpretation:
        'PTH should rise when calcium falls. A low or inappropriately normal result suggests hypoparathyroidism; a raised result indicates an appropriate response and redirects the cause assessment.',
      whyItMatters:
        'PTH is the central branching test for determining the mechanism.',
    },
    {
      test: 'Magnesium',
      interpretation:
        'Low magnesium can suppress PTH release, cause resistance to PTH, and make Hypocalcaemia refractory to calcium replacement.',
      whyItMatters:
        'Calcium may not correct until magnesium is replaced.',
    },
    {
      test: 'Phosphate and renal function',
      interpretation:
        'High phosphate with low PTH supports hypoparathyroidism. Renal impairment may cause phosphate retention and reduced calcitriol production, usually with secondary hyperparathyroidism.',
      whyItMatters:
        'The pattern helps distinguish low-PTH disease from chronic kidney disease and vitamin D-related causes.',
    },
    {
      test: '25-hydroxyvitamin D',
      interpretation:
        'A low concentration supports vitamin D deficiency as a cause or contributor and usually produces a compensatory rise in PTH.',
      whyItMatters:
        'Vitamin D status influences both cause identification and longer-term replacement.',
    },
    {
      test: 'Electrocardiogram',
      interpretation:
        'QT prolongation is the characteristic conduction abnormality; severe disease can cause rhythm disturbance or cardiac dysfunction.',
      whyItMatters:
        'The result determines monitoring intensity and supports safe intravenous calcium administration.',
    },
  ],
  differentialDistinguishers: [
    {
      diagnosis: 'Hypomagnesaemia',
      overlap:
        'Can cause paraesthesia, cramps, tetany, arrhythmia, and secondary low calcium.',
      distinguishingFeatures:
        'Magnesium is low and the calcium deficit may remain refractory until magnesium is corrected.',
      decisiveClue:
        'Normal magnesium with high phosphate and low PTH after thyroidectomy favours postoperative hypoparathyroidism.',
    },
    {
      diagnosis: 'Respiratory Alkalosis',
      overlap:
        'Hyperventilation may cause perioral tingling and carpopedal spasm by lowering ionised calcium.',
      distinguishingFeatures:
        'Symptoms coincide with hyperventilation, total calcium may remain normal, and blood-gas testing shows alkalosis.',
      decisiveClue:
        'Markedly low total calcium with high phosphate and low PTH indicates a true calcium-regulation disorder.',
    },
    {
      diagnosis: 'Acute Dystonic Reaction',
      overlap: 'Painful involuntary posturing may resemble carpopedal spasm.',
      distinguishingFeatures:
        'Usually follows a dopamine-blocking medicine and commonly affects the neck, jaw, eyes, or tongue without Trousseau sign.',
      decisiveClue:
        'Provoked tetany signs and low ionised calcium support Hypocalcaemia.',
    },
    {
      diagnosis: 'Hypoglycaemia',
      overlap:
        'Can cause tremor, paraesthesia, confusion, seizure, or collapse.',
      distinguishingFeatures:
        'Symptoms are accompanied by a low measured glucose and often adrenergic or neuroglycopenic features.',
      decisiveClue:
        'Normal glucose with markedly reduced ionised calcium excludes hypoglycaemia as the primary explanation.',
    },
    {
      diagnosis: 'Focal Seizure',
      overlap:
        'May cause involuntary limb movement while awareness is preserved.',
      distinguishingFeatures:
        'Movements follow a cortical distribution and are not reproducibly triggered by cuff inflation; postictal or electroencephalographic features may occur.',
      decisiveClue:
        'Bilateral carpopedal spasm with Trousseau sign and low ionised calcium indicates tetany.',
    },
    {
      diagnosis: 'Peripheral Neuropathy',
      overlap: 'Can cause symmetrical distal tingling or numbness.',
      distinguishingFeatures:
        'Usually has a chronic course, objective sensory loss, weakness, or reduced reflexes rather than acute carpal spasm and hyperreflexia.',
      decisiveClue:
        'Acute tetany with brisk reflexes and confirmed low ionised calcium argues against neuropathy.',
    },
  ],
  managementOverview: [
    {
      step: 'Assess severity and stabilise immediate threats',
      rationale:
        'Evaluate airway, breathing, circulation, mental status, seizure activity, and cardiac rhythm. Airway compromise, seizure, arrhythmia, or severe symptomatic disease requires immediate monitored treatment.',
    },
    {
      step: 'Give monitored intravenous calcium for severe symptomatic disease',
      rationale:
        'Calcium gluconate rapidly reduces tetany and neurological or cardiac complications. Follow local emergency protocols for dilution, administration rate, repeat dosing, and infusion.',
    },
    {
      step: 'Check and correct magnesium',
      rationale:
        'Magnesium deficiency suppresses PTH release and action and may prevent correction despite calcium replacement.',
    },
    {
      step: 'Identify and treat the cause',
      rationale:
        'Use PTH, phosphate, renal function, vitamin D, medication exposure, acid-base status, and surgical history to define the mechanism.',
    },
    {
      step: 'Establish maintenance replacement and monitoring',
      rationale:
        'Postoperative hypoparathyroidism may require oral calcium and activated vitamin D with serial calcium, phosphate, magnesium, renal-function, and PTH assessment.',
    },
  ],
  complications: [
    'Painful tetany and recurrent carpopedal spasm',
    'Laryngospasm and airway compromise',
    'Seizure or altered consciousness',
    'Prolonged QT interval and cardiac arrhythmia',
    'Hypotension or cardiac dysfunction in severe disease',
    'Persistent or recurrent Hypocalcaemia if the cause is untreated',
    'Hypercalcaemia, hypercalciuria, nephrolithiasis, or renal impairment from excessive replacement',
  ],
  pitfalls: [
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Giving away the cause before the learner identifies the disorder',
      content:
        'Opening with total thyroidectomy strongly cues postoperative parathyroid injury before the symptom and examination pattern has been interpreted.',
      whyItMatters:
        'A flagship case should first test recognition of paraesthesia, tetany, and bedside signs, then confirm the calcium abnormality, and only later reveal the cause.',
      trapAvoided:
        'Place thyroidectomy history after biochemical confirmation rather than in the opening clue or title.',
    },
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Using a descriptive postoperative label as the diagnosis',
      content:
        'Postoperative hypoparathyroidism explains the mechanism, but the canonical answer remains Hypocalcaemia.',
      whyItMatters:
        'Separating diagnosis from cause keeps registry mapping and learner assessment consistent.',
      trapAvoided:
        'Do not use acute symptomatic postoperative hypocalcaemia as the canonical diagnosis.',
    },
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Relying on Chvostek sign alone',
      content:
        'Chvostek sign has limited sensitivity and specificity and cannot replace biochemical confirmation.',
      whyItMatters:
        'Over-reliance may produce false-positive or false-negative conclusions.',
      trapAvoided:
        'Combine the clinical pattern, Trousseau sign, total calcium with albumin, and ionised calcium.',
    },
    {
      type: 'LAB_INTERPRETATION',
      title: 'Ignoring albumin or ionised calcium',
      content:
        'Low total calcium may reflect low albumin, while acute alkalosis may reduce ionised calcium despite a normal total value.',
      whyItMatters:
        'Using the wrong calcium measure may misclassify the patient.',
      trapAvoided:
        'Interpret total calcium with albumin and measure ionised calcium when the clinical stakes are high or results are uncertain.',
    },
    {
      type: 'TREATMENT',
      title: 'Failing to check magnesium',
      content:
        'Magnesium deficiency can impair PTH secretion and action and make Hypocalcaemia refractory to replacement.',
      whyItMatters:
        'Repeated calcium dosing alone may fail.',
      trapAvoided:
        'Measure and correct magnesium early.',
    },
    {
      type: 'SAFETY',
      title: 'Giving intravenous calcium without monitoring',
      content:
        'Rapid calcium administration may cause cardiac complications and extravasation injury.',
      whyItMatters:
        'Administration rate, venous access, rhythm, and serial calcium require supervision.',
      trapAvoided:
        'Use protocol-directed dilution, electrocardiographic monitoring, and frequent reassessment.',
    },
  ],
  recallPrompts: [
    {
      prompt: 'What symptoms commonly appear early in acute Hypocalcaemia?',
      answer:
        'Perioral tingling, distal paraesthesia, painful muscle cramps, and progression to carpopedal spasm.',
    },
    {
      prompt: 'What hand posture defines a positive Trousseau sign?',
      answer:
        'Wrist and metacarpophalangeal flexion with interphalangeal extension and thumb adduction during sustained cuff inflation.',
    },
    {
      prompt: 'Why is Chvostek sign not independently diagnostic?',
      answer:
        'It may be present in healthy people or absent in true disease, so it must be interpreted with the clinical pattern and calcium results.',
    },
    {
      prompt: 'What does low ionised calcium establish?',
      answer:
        'True deficiency of the physiologically active calcium fraction.',
    },
    {
      prompt:
        'What biochemical pattern supports hypoparathyroidism as the cause?',
      answer:
        'Low calcium with high phosphate and a low or inappropriately normal PTH concentration.',
    },
    {
      prompt: 'Why must magnesium be checked?',
      answer:
        'Low magnesium can suppress PTH release or action and prevent correction of the calcium level.',
    },
    {
      prompt:
        'What is the immediate treatment principle for severe symptomatic Hypocalcaemia?',
      answer:
        'Urgent monitored intravenous calcium, followed by correction of contributors and treatment of the underlying cause.',
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
  ],
};

function assertRepairShape() {
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

  const earlyAetiologyTerms = [
    'thyroidectomy',
    'thyroid surgery',
    'postoperative',
    'post operative',
    'parathyroid',
    'hypoparathyroidism',
  ];

  for (const clue of clues.slice(0, 4)) {
    const normalized = normalizeClinicalText(clue.value);
    const leakedTerm = earlyAetiologyTerms.find((term) =>
      normalized.includes(normalizeClinicalText(term)),
    );

    if (leakedTerm) {
      throw new Error(
        `Clue ${clue.order} leaks the postoperative/parathyroid cause too early: ${leakedTerm}.`,
      );
    }
  }

  const normalizedAcceptedTerms = acceptedDiagnosisTerms.map(
    normalizeClinicalText,
  );

  for (const clue of clues.slice(0, 3)) {
    const normalized = normalizeClinicalText(clue.value);
    const leakedDiagnosis = normalizedAcceptedTerms.find((term) =>
      normalized.includes(term),
    );

    if (leakedDiagnosis) {
      throw new Error(
        `Clue ${clue.order} reveals the canonical diagnosis or alias: ${leakedDiagnosis}.`,
      );
    }
  }

  const expectedTypes = [
    'history',
    'symptom',
    'exam',
    'lab',
    'history',
    'lab',
  ];

  clues.forEach((clue, index) => {
    if (clue.type !== expectedTypes[index]) {
      throw new Error(
        `Unexpected clue progression at clue ${index}: expected ${expectedTypes[index]}, received ${clue.type}.`,
      );
    }
  });

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
        `Breakdown ${index} references clue ${entry.clueOrder}; expected ${clue.order}.`,
      );
    }

    if (entry.clueType !== clue.type) {
      throw new Error(
        `Breakdown ${index} uses clue type ${entry.clueType}; expected ${clue.type}.`,
      );
    }

    if (entry.clue !== clue.value) {
      throw new Error(
        `Breakdown ${index} clue text does not exactly match clue ${clue.order}.`,
      );
    }

    if (!entry.explanation.trim() || !entry.diagnosticContribution.trim()) {
      throw new Error(`Breakdown ${index} contains empty explanatory content.`);
    }
  });

  if (
    new Set(differentials.map(normalizeClinicalText)).size !==
    differentials.length
  ) {
    throw new Error('Differentials contain duplicate diagnoses.');
  }

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
          `Empty differential evidence or reason in ${entry.diagnosis}.`,
        );
      }
    });
  });

  const requiredSignNames = [
    'Trousseau sign',
    'Chvostek sign',
    'Brisk deep-tendon reflexes',
    'Tetany',
    'Laryngospasm or stridor',
    'Seizure or altered mental status',
    'Prolonged QT interval or arrhythmia',
  ];

  const signNames = educationForFrontend.keySigns.map((entry) => entry.finding);

  requiredSignNames.forEach((finding) => {
    if (!signNames.includes(finding)) {
      throw new Error(`Missing structured key-sign education for: ${finding}.`);
    }
  });

  educationForFrontend.keySigns.forEach((entry) => {
    if (
      !entry.finding.trim() ||
      !entry.significance.trim() ||
      !entry.discriminator.trim()
    ) {
      throw new Error(
        `Key-sign education is incomplete for ${entry.finding || 'unknown sign'}.`,
      );
    }
  });
}

async function findRegistry() {
  const normalizedTerms = acceptedDiagnosisTerms.map(normalizeClinicalText);

  const registry = await prisma.diagnosisRegistry.findFirst({
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
    select: {
      id: true,
      canonicalName: true,
      displayLabel: true,
    },
  });

  if (!registry) {
    throw new Error(
      'Cannot repair Hypocalcaemia: no matching diagnosis registry was found. Run the seed first or verify the registry aliases.',
    );
  }

  return registry;
}

async function findTargetCase(diagnosisRegistryId: string) {
  const targetCase = await prisma.case.findFirst({
    where: {
      diagnosisRegistryId,
      title: { in: [previousCaseTitle, repairedCaseTitle] },
    },
    orderBy: [{ approvedAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      title: true,
      publicNumber: true,
      date: true,
      difficulty: true,
      currentRevisionId: true,
      diagnosisRegistryId: true,
      proposedDiagnosisText: true,
      diagnosisMappingStatus: true,
      diagnosisMappingMethod: true,
      diagnosisMappingConfidence: true,
      dailyCases: { select: { id: true }, take: 5 },
    },
  });

  if (!targetCase) {
    throw new Error(
      `Cannot repair Hypocalcaemia case: neither "${previousCaseTitle}" nor "${repairedCaseTitle}" was found for registry ${diagnosisRegistryId}.`,
    );
  }

  const conflictingCase = await prisma.case.findFirst({
    where: {
      diagnosisRegistryId,
      title: repairedCaseTitle,
      id: { not: targetCase.id },
    },
    select: { id: true, title: true },
  });

  if (conflictingCase) {
    throw new Error(
      `Cannot rename the target case because another case already uses "${repairedCaseTitle}": ${conflictingCase.id}.`,
    );
  }

  return targetCase;
}

async function repairEducationAndCase() {
  assertRepairShape();

  const registry = await findRegistry();
  const targetCase = await findTargetCase(registry.id);

  const result = await prisma.$transaction(async (tx) => {
    const existingEducation = await tx.diagnosisEducation.findUnique({
      where: { diagnosisRegistryId: registry.id },
      select: { id: true, version: true },
    });

    let educationId: string;
    let educationVersion: number;

    if (existingEducation) {
      educationVersion = existingEducation.version + 1;

      const updatedEducation = await tx.diagnosisEducation.update({
        where: { id: existingEducation.id },
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
          version: educationVersion,
        },
        select: { id: true },
      });

      educationId = updatedEducation.id;
    } else {
      educationVersion = 1;

      const createdEducation = await tx.diagnosisEducation.create({
        data: {
          diagnosisRegistryId: registry.id,
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
          version: educationVersion,
        },
        select: { id: true },
      });

      educationId = createdEducation.id;
    }

    await tx.diagnosisEducationRevision.create({
      data: {
        educationId,
        version: educationVersion,
        snapshot: {
          ...educationForFrontend,
          repairMetadata: {
            repairVersion,
            repairedAt: now.toISOString(),
            structuredSignsAdded: true,
            earlyThyroidectomyLeakRemoved: true,
          },
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

    const latestRevision = await tx.caseRevision.findFirst({
      where: { caseId: targetCase.id },
      orderBy: { revisionNumber: 'desc' },
      select: { revisionNumber: true, publishTrack: true },
    });

    const revisionNumber = (latestRevision?.revisionNumber ?? 0) + 1;
    const publishTrack = latestRevision?.publishTrack ?? PublishTrack.DAILY;
    const history = clues[0].value;
    const symptoms = [clues[0].value, clues[1].value, clues[2].value];

    const proposedDiagnosisText =
      targetCase.proposedDiagnosisText ?? displayLabel;
    const diagnosisMappingStatus =
      targetCase.diagnosisMappingStatus ?? DiagnosisMappingStatus.MATCHED;
    const diagnosisMappingMethod =
      targetCase.diagnosisMappingMethod ?? DiagnosisMappingMethod.EDITOR_SELECTED;
    const diagnosisMappingConfidence =
      targetCase.diagnosisMappingConfidence ?? 1;

    const revision = await tx.caseRevision.create({
      data: {
        caseId: targetCase.id,
        revisionNumber,
        source: CaseSource.MANUAL,
        publishTrack,
        title: repairedCaseTitle,
        date: targetCase.date,
        difficulty: targetCase.difficulty,
        history,
        symptoms,
        clues: clues as unknown as object,
        explanation: explanation as object,
        differentials,
        diagnosisRegistryId: registry.id,
        proposedDiagnosisText,
        diagnosisMappingStatus,
        diagnosisMappingMethod,
        diagnosisMappingConfidence,
        diagnosisEditorialNote:
          'Repaired Hypocalcaemia case: removed thyroidectomy from the title and opening clue, moved it to clue 4 after calcium confirmation, rebuilt all clue breakdown references, retained canonical diagnosis mapping, and aligned diagnosis education to the structured frontend schema with individually described signs.',
      },
      select: { id: true },
    });

    await tx.case.update({
      where: { id: targetCase.id },
      data: {
        title: repairedCaseTitle,
        history,
        symptoms,
        clues: clues as unknown as object,
        explanation: explanation as object,
        differentials,
        currentRevisionId: revision.id,
        proposedDiagnosisText,
        diagnosisMappingStatus,
        diagnosisMappingMethod,
        diagnosisMappingConfidence,
        diagnosisEditorialNote:
          'Repaired Hypocalcaemia flagship case with delayed aetiology disclosure, exact clue-breakdown alignment, and structured sign education. DailyCase scheduling and case date were not altered.',
      },
    });

    await tx.caseValidationRun.create({
      data: {
        caseId: targetCase.id,
        revisionId: revision.id,
        source: CaseSource.MANUAL,
        publishTrack,
        outcome: ValidationOutcome.PASSED,
        validatorVersion: `flagship-human-repair:hypocalcaemia-v2`,
        summary: {
          contentTier: 'FLAGSHIP',
          repairVersion,
          humanReviewed: true,
          canonicalDiagnosisVerified: true,
          clueProgressionVerified: true,
          earlyAetiologyLeakRemoved: true,
          caseTitleLeakRemoved: true,
          breakdownClueReferencesValidated: true,
          structuredDiagnosisEducationVerified: true,
          individuallyDescribedSigns: educationForFrontend.keySigns.map(
            (entry) => entry.finding,
          ),
          playableClueCount: clues.length,
          clueTypes: clues.map((clue) => clue.type),
          scheduledDailyCaseLinksPreserved: targetCase.dailyCases.length,
          caseDatePreserved: targetCase.date.toISOString(),
          note:
            'Hypocalcaemia repair completed: the case now progresses from symptoms and signs to calcium confirmation before revealing total thyroidectomy and the low-PTH mechanism. Diagnosis education now uses structured frontend objects and explicitly describes Trousseau sign, Chvostek sign, hyperreflexia, tetany, laryngospasm, seizure, and QT prolongation.',
        },
        findings: [],
        completedAt: now,
      },
    });

    return {
      registryId: registry.id,
      educationId,
      educationVersion,
      caseId: targetCase.id,
      previousTitle: targetCase.title,
      repairedTitle: repairedCaseTitle,
      revisionId: revision.id,
      revisionNumber,
      publicNumber: targetCase.publicNumber,
      dailyCaseLinksPreserved: targetCase.dailyCases.length,
      clueTypes: clues.map((clue) => clue.type),
    };
  });

  console.log('Repaired Hypocalcaemia case and diagnosis education:', result);
}

repairEducationAndCase()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
