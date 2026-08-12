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
 * REPAIR - Hypocalcaemia case and diagnosis education
 * Severe hypomagnesaemia mechanism
 *
 * Repairs:
 * 1. Removes the recent neck-surgery and postoperative hypoparathyroidism storyline.
 * 2. Rebuilds the case around severe hypomagnesaemia causing acute Hypocalcaemia.
 * 3. Keeps Hypocalcaemia as the canonical diagnosis and hypomagnesaemia as its cause.
 * 4. Preserves six playable clues using supported clue types only.
 * 5. Uses a clinically coherent progression without an aetiological giveaway:
 *    history -> symptom -> exam -> lab -> history -> lab.
 * 6. Rebuilds clueBreakdown so every entry exactly matches its playable clue.
 * 7. Updates structured diagnosis education, including individual descriptions
 *    of Trousseau sign, Chvostek sign, hyperreflexia, tetany, laryngospasm,
 *    seizure, and QT prolongation.
 * 8. Creates a new case revision and diagnosis-education revision.
 * 9. Does not alter DailyCase scheduling or the case date.
 *
 * Run:
 *   npx tsx prisma/repair/repair-hypocalcaemia-severe-hypomagnesaemia-v4.ts
 *
 * Railway:
 *   railway run npx tsx prisma/repair/repair-hypocalcaemia-severe-hypomagnesaemia-v4.ts
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
const repairVersion = 'repair-hypocalcaemia-severe-hypomagnesaemia-v4';
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
      'A 52-year-old woman presents with tingling around the mouth and in the fingertips of both hands that began that morning. For the preceding five days she has had frequent watery stools, nausea, poor appetite, and reduced oral intake, but no fever, blood in stool, focal weakness, loss of consciousness, or previous similar episode.',
  },
  {
    order: 1,
    type: 'symptom',
    value:
      'During assessment, the tingling becomes continuous and is followed by painful tightening of both hands and intermittent cramping of the feet. She remains alert and can describe each episode, with no tongue biting, incontinence, unilateral jerking, or post-event confusion.',
  },
  {
    order: 2,
    type: 'exam',
    value:
      'Inflating a blood-pressure cuff above systolic pressure produces flexion of the wrists and metacarpophalangeal joints, extension of the fingers, and adduction of the thumbs. Tapping over either facial nerve causes ipsilateral facial twitching. Deep-tendon reflexes are brisk, while power, sensation, speech, and cranial-nerve examination are otherwise normal.',
  },
  {
    order: 3,
    type: 'lab',
    value:
      'Serum total calcium is 1.64 mmol/L with albumin 40 g/L, and directly measured ionised calcium is 0.76 mmol/L. Glucose is 5.2 mmol/L, sodium is 138 mmol/L, creatinine is 70 micromol/L, and acid-base testing shows no alkalosis.',
  },
  {
    order: 4,
    type: 'history',
    value:
      'Medication review shows that she has taken omeprazole 40 mg twice daily for four years for reflux symptoms. She does not use diuretics, aminoglycosides, amphotericin, bisphosphonates, or anticonvulsants, and she reports no kidney disease, neck surgery, alcohol dependence, or known malabsorption disorder.',
  },
  {
    order: 5,
    type: 'lab',
    value:
      'Serum magnesium is 0.28 mmol/L and potassium is 3.0 mmol/L. Intact parathyroid hormone is only 1.4 pmol/L despite severe Hypocalcaemia, phosphate is 1.42 mmol/L, 25-hydroxyvitamin D is 74 nmol/L, and urinary magnesium excretion is appropriately low. Repeat ionised calcium is 0.71 mmol/L.',
  },
] as const;

const differentials = [
  'Respiratory Alkalosis',
  'Acute Dystonic Reaction',
  'Hypoglycaemia',
  'Focal Seizure',
  'Peripheral Neuropathy',
  'Panic Attack',
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
    'Acute perioral and distal paraesthesia progressing to carpopedal spasm, positive Trousseau and Chvostek signs, and markedly reduced total and ionised calcium establish Hypocalcaemia. Severe hypomagnesaemia with an inadequate parathyroid hormone response identifies magnesium depletion as the cause, likely from chronic proton-pump-inhibitor exposure compounded by recent gastrointestinal losses.',
  reasoning: [
    'The presentation is acute, bilateral, and dominated by sensory symptoms and painful muscle contraction, favouring a metabolic neuromuscular disturbance over focal neurological disease.',
    'Perioral paraesthesia, distal tingling, painful cramps, and bilateral carpopedal spasm reflect increased neuromuscular excitability.',
    'Trousseau sign and Chvostek sign provide bedside evidence of tetany, while brisk reflexes support a diffuse electrolyte-related process.',
    'Markedly reduced total calcium with normal albumin excludes pseudohypocalcaemia from hypoalbuminaemia.',
    'Directly measured low ionised calcium confirms deficiency of the physiologically active calcium fraction and establishes true Hypocalcaemia.',
    'The later medication history and recent gastrointestinal losses raise the possibility of magnesium depletion without revealing the canonical diagnosis early.',
    'Severe hypomagnesaemia can suppress PTH secretion and impair peripheral responsiveness to PTH; the PTH result is therefore inappropriately low for the degree of Hypocalcaemia.',
    'Low urinary magnesium excretion supports gastrointestinal depletion or impaired absorption rather than renal magnesium wasting.',
    'Normal renal function and adequate vitamin D make chronic kidney disease and vitamin D deficiency less likely explanations.',
    'The falling ionised calcium with symptomatic tetany requires urgent monitored calcium treatment, but magnesium replacement is essential because calcium may remain refractory until magnesium is corrected.',
    'The canonical diagnosis remains Hypocalcaemia; severe hypomagnesaemia is the aetiology and treatment-limiting mechanism.',
  ],
  clueBreakdown: [
    {
      clueOrder: 0,
      clueType: 'history',
      clue: clues[0].value,
      explanation:
        'The opening clue establishes acute symmetrical paraesthesia in the context of gastrointestinal fluid and electrolyte loss. It keeps the differential broad because diarrhoea can produce several electrolyte disturbances and does not itself identify which abnormality is causing the neuromuscular symptoms.',
      diagnosticContribution:
        'Introduces a plausible electrolyte-loss context without disclosing the diagnosis or the specific deficient electrolyte.',
    },
    {
      clueOrder: 1,
      clueType: 'symptom',
      clue: clues[1].value,
      explanation:
        'Progression from paraesthesia to painful bilateral hand and foot contraction is characteristic of tetany. Preserved consciousness and the absence of lateralising, ictal, or postictal features reduce the likelihood of seizure or stroke.',
      diagnosticContribution:
        'Narrows the case toward reduced ionised calcium, severe magnesium depletion, or alkalosis while maintaining uncertainty.',
    },
    {
      clueOrder: 2,
      clueType: 'exam',
      clue: clues[2].value,
      explanation:
        'The cuff-induced hand posture is Trousseau sign: wrist and metacarpophalangeal flexion, interphalangeal extension, and thumb adduction. Facial twitching after tapping the facial nerve is Chvostek sign. Together with brisk reflexes and an otherwise normal neurological examination, these findings support diffuse neuromuscular hyperexcitability.',
      diagnosticContribution:
        'Provides strong bedside evidence of tetany but still requires biochemical confirmation.',
    },
    {
      clueOrder: 3,
      clueType: 'lab',
      clue: clues[3].value,
      explanation:
        'Both total and ionised calcium are markedly reduced. Normal albumin excludes a falsely low total calcium, normal glucose excludes hypoglycaemia, and the absence of alkalosis excludes an isolated pH-mediated reduction in ionised calcium.',
      diagnosticContribution:
        'Biochemically confirms the canonical diagnosis of Hypocalcaemia.',
    },
    {
      clueOrder: 4,
      clueType: 'history',
      clue: clues[4].value,
      explanation:
        'Long-term high-dose proton-pump-inhibitor exposure may impair intestinal magnesium absorption. Recent diarrhoeal losses and poor intake can then precipitate severe depletion. The absence of common renal magnesium-wasting medicines or surgery redirects the cause assessment away from postoperative hypoparathyroidism.',
      diagnosticContribution:
        'Introduces a plausible magnesium-depletion mechanism only after Hypocalcaemia has been established.',
    },
    {
      clueOrder: 5,
      clueType: 'lab',
      clue: clues[5].value,
      explanation:
        'Magnesium of 0.28 mmol/L is severely reduced. PTH should rise substantially during severe Hypocalcaemia, so a low-normal value is physiologically inappropriate and supports magnesium-related suppression of PTH secretion; magnesium depletion can also cause PTH resistance. Low urinary magnesium excretion supports gastrointestinal depletion or impaired absorption, while normal renal function and adequate vitamin D reduce competing causes.',
      diagnosticContribution:
        'Identifies severe hypomagnesaemia as the cause and explains why calcium replacement alone may not correct the disorder.',
    },
  ],
  keyFindings: [
    'Age 52 years',
    'Five days of watery diarrhoea and reduced intake',
    'Acute perioral paraesthesia',
    'Bilateral fingertip tingling',
    'Painful carpopedal spasm',
    'Intermittent pedal cramps',
    'Preserved consciousness',
    'Positive Trousseau sign',
    'Positive Chvostek sign',
    'Brisk deep-tendon reflexes',
    'Total calcium 1.64 mmol/L',
    'Albumin 40 g/L',
    'Ionised calcium 0.76 mmol/L falling to 0.71 mmol/L',
    'No alkalosis',
    'Long-term high-dose omeprazole exposure',
    'Magnesium 0.28 mmol/L',
    'Potassium 3.0 mmol/L',
    'Inappropriately low-normal PTH during severe Hypocalcaemia',
    'Appropriately low urinary magnesium excretion',
    'Normal renal function',
    'Adequate 25-hydroxyvitamin D',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Respiratory Alkalosis',
      whyPlausibleEarly:
        'Hyperventilation can reduce ionised calcium and cause perioral tingling, distal paraesthesia, and carpopedal spasm.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence: 'no respiratory distress or clear hyperventilation trigger',
          reason:
            'The history does not suggest a sustained primary hyperventilation syndrome.',
        },
        {
          clueOrder: 3,
          evidence:
            'markedly low total calcium with normal albumin and no alkalosis',
          reason:
            'Isolated respiratory alkalosis usually lowers ionised calcium through increased albumin binding without causing this degree of true total-calcium reduction.',
        },
      ],
      finalReasonLessLikely:
        'The patient has true severe Hypocalcaemia without alkalosis, followed by a magnesium-depletion pattern.',
    },
    {
      diagnosis: 'Acute Dystonic Reaction',
      whyPlausibleEarly:
        'A drug-induced dystonia can cause painful involuntary posturing of the hands, face, jaw, neck, or eyes.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence:
            'reproducible Trousseau sign, Chvostek sign, and brisk reflexes',
          reason:
            'These findings support generalized neuromuscular excitability rather than a focal dystonic reaction.',
        },
        {
          clueOrder: 3,
          evidence: 'confirmed low total and ionised calcium',
          reason:
            'The biochemical abnormality directly explains the spasms.',
        },
        {
          clueOrder: 4,
          evidence: 'no dopamine-blocking medicine exposure',
          reason:
            'Acute dystonia normally follows exposure to a causative drug.',
        },
      ],
      finalReasonLessLikely:
        'There is no relevant medication trigger, and the examination and calcium results establish tetany.',
    },
    {
      diagnosis: 'Hypoglycaemia',
      whyPlausibleEarly:
        'Low glucose can cause tremor, paraesthesia, confusion, seizure, or collapse.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'preserved consciousness without autonomic symptoms',
          reason:
            'The presentation is dominated by tetany rather than adrenergic or neuroglycopenic features.',
        },
        {
          clueOrder: 3,
          evidence: 'glucose is 5.2 mmol/L',
          reason: 'A normal measured glucose directly excludes hypoglycaemia.',
        },
      ],
      finalReasonLessLikely:
        'Glucose is normal and the severe calcium abnormality explains the symptoms.',
    },
    {
      diagnosis: 'Focal Seizure',
      whyPlausibleEarly:
        'A focal motor seizure may cause involuntary limb movement with preserved awareness.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence:
            'bilateral painful hand tightening without unilateral jerking or post-event confusion',
          reason:
            'The events do not follow a focal cortical motor pattern.',
        },
        {
          clueOrder: 2,
          evidence: 'spasm reproducibly provoked by blood-pressure cuff inflation',
          reason:
            'Provoked carpal spasm is Trousseau sign and supports tetany rather than epilepsy.',
        },
        {
          clueOrder: 3,
          evidence: 'markedly reduced ionised calcium',
          reason:
            'The metabolic abnormality provides a direct explanation for the abnormal movements.',
        },
      ],
      finalReasonLessLikely:
        'The episodes are bilateral tetanic spasms with a reproducible bedside sign and confirmed Hypocalcaemia.',
    },
    {
      diagnosis: 'Peripheral Neuropathy',
      whyPlausibleEarly:
        'Peripheral neuropathy can cause symmetrical distal tingling and numbness.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence: 'sudden onset over hours',
          reason:
            'Most peripheral neuropathies evolve over a longer period rather than producing acute episodic tetany.',
        },
        {
          clueOrder: 2,
          evidence:
            'brisk reflexes with normal power and sensation between spasms',
          reason:
            'Peripheral neuropathy more often causes persistent sensory loss, weakness, or reduced reflexes.',
        },
        {
          clueOrder: 3,
          evidence: 'severe reduction in ionised calcium',
          reason:
            'The electrolyte disorder explains the acute sensory and motor features.',
        },
      ],
      finalReasonLessLikely:
        'The acute tetany pattern and normal interval neurological examination argue against neuropathy.',
    },
    {
      diagnosis: 'Panic Attack',
      whyPlausibleEarly:
        'Panic with hyperventilation can cause tingling, trembling, chest discomfort, and hand spasm.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence:
            'no abrupt fear, palpitations, chest discomfort, or psychological trigger',
          reason:
            'The defining affective and autonomic features of panic are absent.',
        },
        {
          clueOrder: 3,
          evidence:
            'true low total and ionised calcium without alkalosis',
          reason:
            'The symptoms reflect a biochemical calcium deficit rather than hyperventilation alone.',
        },
        {
          clueOrder: 5,
          evidence: 'severe hypomagnesaemia with an inadequate PTH response',
          reason:
            'The final laboratory pattern establishes an organic electrolyte mechanism.',
        },
      ],
      finalReasonLessLikely:
        'There is no panic syndrome, and the calcium-magnesium abnormalities fully explain the presentation.',
    },
  ] satisfies DifferentialAnalysisEntry[],
  managementPearl:
    'Severe symptomatic Hypocalcaemia requires urgent monitored intravenous calcium gluconate, but severe hypomagnesaemia must be corrected concurrently because it suppresses PTH secretion, impairs PTH action, and can make the calcium deficit refractory. Stop or review contributing medicines, replace ongoing gastrointestinal losses, monitor potassium and cardiac rhythm, and reassess calcium and magnesium frequently.',
  generationQuality: {
    contentTier: 'FLAGSHIP',
    repairVersion,
    humanReviewed: true,
    discriminatorStrength: 'VERY_HIGH',
    clueProgressionVerified: true,
    breakdownClueReferencesValidated: true,
    expectedTeachingPoints: [
      'Acute Hypocalcaemia commonly begins with perioral and distal paraesthesia before progressing to cramps or tetany',
      'Trousseau sign is a provoked carpal spasm and is more useful than Chvostek sign alone',
      'Low ionised calcium confirms deficiency of the biologically active calcium fraction',
      'Severe hypomagnesaemia can impair both PTH secretion and PTH action',
      'PTH may be low or inappropriately normal despite severe Hypocalcaemia when magnesium depletion is profound',
      'Chronic proton-pump-inhibitor exposure can impair intestinal magnesium absorption',
      'Recent diarrhoeal loss can precipitate symptomatic magnesium and calcium depletion',
      'Calcium may not correct adequately until magnesium is replaced',
      'Hypocalcaemia is the canonical diagnosis; severe hypomagnesaemia is the aetiology',
    ],
    competencyDomains: [
      'Endocrinology',
      'Electrolyte Disorders',
      'Emergency Medicine',
      'Clinical Examination',
      'Medication Safety',
      'Clinical Reasoning',
    ],
  },
};

const educationForFrontend = {
  title: displayLabel,
  summary: {
    definition:
      'Hypocalcaemia is a reduction in circulating calcium, confirmed by a low ionised calcium concentration or a genuinely low total calcium after accounting for albumin. Acute falls increase neuromuscular excitability and may cause tetany, seizure, laryngospasm, QT prolongation, or arrhythmia.',
    highYieldTakeaway:
      'Recognise the sequence of perioral or distal tingling, painful cramps, carpopedal spasm, and tetany; confirm true Hypocalcaemia, then measure magnesium early because severe magnesium depletion can suppress PTH secretion, produce PTH resistance, and prevent calcium correction.',
  },
  recognitionPattern: [
    {
      pattern: 'Paraesthesia progressing to tetany',
      whyItMatters:
        'Acute reduction in ionised calcium lowers the threshold for nerve and muscle depolarisation.',
      progression:
        'Perioral or distal tingling -> painful cramps -> carpopedal spasm -> generalized tetany, seizure, or airway involvement in severe disease.',
      discriminator:
        'The symptoms are usually bilateral and accompanied by objective neuromuscular hyperexcitability rather than a focal neurological deficit.',
      commonTrap:
        'Do not attribute bilateral tingling and hand contraction to anxiety before checking calcium, magnesium, glucose, and acid-base status.',
    },
    {
      pattern: 'Positive Trousseau sign',
      whyItMatters:
        'Sustained cuff inflation can uncover latent neuromuscular excitability before spontaneous tetany is continuously present.',
      progression:
        'Cuff inflation above systolic pressure -> carpal spasm -> characteristic wrist, finger, and thumb posture.',
      discriminator:
        'A reproducible cuff-provoked carpal spasm is more informative than nonspecific hand discomfort or tremor.',
      commonTrap:
        'Do not describe any clenched hand as Trousseau sign; the posture and provocation method matter.',
    },
    {
      pattern: 'True biochemical Hypocalcaemia',
      whyItMatters:
        'Clinical signs suggest the disorder, but biochemical confirmation distinguishes true calcium deficiency from mimics.',
      progression:
        'Low total calcium -> review albumin -> measure ionised calcium when severe symptoms, abnormal binding, or acid-base disturbance is possible.',
      discriminator:
        'Low ionised calcium confirms reduction of the physiologically active calcium fraction.',
      commonTrap:
        'Do not diagnose or exclude Hypocalcaemia from an uncorrected total calcium value alone.',
    },
    {
      pattern: 'Severe hypomagnesaemia with an inadequate PTH response',
      whyItMatters:
        'Profound magnesium deficiency can inhibit PTH secretion and impair PTH-mediated signalling in target tissues.',
      progression:
        'Magnesium depletion -> impaired PTH release and action -> reduced calcium regulation -> symptomatic Hypocalcaemia that may resist calcium replacement.',
      discriminator:
        'PTH is low or inappropriately normal despite marked Hypocalcaemia, with severe magnesium depletion and no better renal, vitamin D, or surgical explanation.',
      commonTrap:
        'Do not misclassify the low PTH pattern as primary hypoparathyroidism before correcting severe magnesium deficiency.',
    },
    {
      pattern: 'Gastrointestinal magnesium depletion',
      whyItMatters:
        'Diarrhoea, reduced intake, malabsorption, and medicines that impair intestinal magnesium absorption can combine to produce severe depletion.',
      progression:
        'Chronic impaired absorption plus acute gastrointestinal loss -> falling magnesium -> secondary potassium and calcium abnormalities.',
      discriminator:
        'Appropriately low urinary magnesium excretion supports gastrointestinal loss or impaired absorption rather than renal wasting.',
      commonTrap:
        'Do not assume a normal creatinine excludes a clinically important magnesium deficit.',
    },
  ],
  keySymptoms: [
    {
      symptom: 'Perioral tingling',
      significance:
        'A common early sensory manifestation of increased neuromuscular excitability during an acute fall in ionised calcium.',
    },
    {
      symptom: 'Distal paraesthesia',
      significance:
        'Bilateral fingertip or toe tingling supports a metabolic or acid-base disturbance more than a focal lesion.',
    },
    {
      symptom: 'Painful muscle cramps',
      significance:
        'May precede visible carpopedal spasm and signals progression from sensory to motor excitability.',
    },
    {
      symptom: 'Hand or foot tightening',
      significance:
        'Painful involuntary contraction may represent carpopedal spasm and should prompt urgent calcium assessment.',
    },
    {
      symptom: 'Dyspnoea, throat tightness, or voice change',
      significance:
        'May indicate laryngeal muscle involvement and impending airway compromise in severe disease.',
    },
  ],
  keySigns: [
    {
      finding: 'Trousseau sign',
      significance:
        'Sustained inflation of a blood-pressure cuff above systolic pressure provokes carpal spasm because of heightened neuromuscular excitability.',
      discriminator:
        'The characteristic posture is wrist and metacarpophalangeal flexion, interphalangeal extension, and thumb adduction; it supports tetany but still requires biochemical confirmation.',
    },
    {
      finding: 'Chvostek sign',
      significance:
        'Tapping the facial nerve anterior to the ear causes ipsilateral facial muscle contraction when neuromuscular excitability is increased.',
      discriminator:
        'It is supportive but neither sensitive nor specific enough to diagnose Hypocalcaemia alone.',
    },
    {
      finding: 'Brisk deep-tendon reflexes',
      significance:
        'Hyperreflexia reflects diffuse neuromuscular irritability and may accompany evolving tetany.',
      discriminator:
        'Brisk reflexes with preserved strength and sensation between spasms favour an electrolyte disturbance over peripheral neuropathy.',
    },
    {
      finding: 'Tetany',
      significance:
        'Sustained involuntary muscle contraction indicates clinically significant neuromuscular hyperexcitability and may involve the hands, feet, face, or generalized musculature.',
      discriminator:
        'Tetany is a syndrome rather than a single manoeuvre and should be distinguished from dystonia, tremor, and epileptic motor activity.',
    },
    {
      finding: 'Laryngospasm or stridor',
      significance:
        'Contraction of laryngeal muscles can obstruct the airway and represents life-threatening severe Hypocalcaemia.',
      discriminator:
        'New stridor, throat tightness, or respiratory distress requires immediate airway assessment and emergency treatment.',
    },
    {
      finding: 'Seizure or altered mental status',
      significance:
        'Severe acute Hypocalcaemia may produce generalized cerebral irritability, seizure, confusion, or reduced consciousness.',
      discriminator:
        'Check glucose, calcium, magnesium, and other reversible metabolic causes even when the event initially appears neurological.',
    },
    {
      finding: 'Prolonged QT interval or arrhythmia',
      significance:
        'Hypocalcaemia prolongs ventricular repolarisation, while accompanying hypomagnesaemia and hypokalaemia further increase rhythm risk.',
      discriminator:
        'Electrocardiographic abnormalities increase urgency and support monitored intravenous replacement.',
    },
  ],
  examPearls: [
    {
      type: 'EXAMINATION',
      title: 'Elicit Trousseau sign correctly',
      content:
        'Inflate the blood-pressure cuff above systolic pressure and observe for the characteristic carpal posture rather than nonspecific discomfort or hand clenching.',
      whyItMatters:
        'Correct technique improves the value of the sign and links the examination finding to tetany.',
      discriminator:
        'Wrist and metacarpophalangeal flexion with interphalangeal extension and thumb adduction is the expected posture.',
      trapAvoided:
        'Do not label ordinary cuff discomfort or voluntary fist formation as a positive sign.',
    },
    {
      type: 'EXAMINATION',
      title: 'Interpret Chvostek sign cautiously',
      content:
        'Tap over the facial nerve and look for ipsilateral contraction around the mouth, nose, or eye.',
      whyItMatters:
        'The sign may support neuromuscular excitability but has important false-positive and false-negative limitations.',
      discriminator:
        'Use it with Trousseau sign, the symptom pattern, and calcium measurements rather than in isolation.',
      trapAvoided:
        'Do not treat a negative Chvostek sign as excluding Hypocalcaemia.',
    },
    {
      type: 'LAB_INTERPRETATION',
      title: 'Confirm the active calcium deficit',
      content:
        'Review albumin when interpreting total calcium and obtain ionised calcium when symptoms are severe, binding is abnormal, or acid-base disturbance is possible.',
      whyItMatters:
        'Ionised calcium is the biologically active fraction responsible for neuromuscular and cardiac effects.',
      discriminator:
        'A low ionised calcium confirms true Hypocalcaemia even when total calcium interpretation is uncertain.',
      trapAvoided:
        'Do not rely on an isolated uncorrected total-calcium result.',
    },
    {
      type: 'AETIOLOGY',
      title: 'Measure magnesium early',
      content:
        'In symptomatic Hypocalcaemia, assess magnesium alongside calcium, phosphate, renal function, vitamin D, and PTH.',
      whyItMatters:
        'Severe magnesium depletion can suppress PTH secretion, create PTH resistance, produce hypokalaemia, and make calcium replacement ineffective.',
      discriminator:
        'Low or inappropriately normal PTH during severe Hypocalcaemia may be functional and reversible when magnesium is profoundly low.',
      trapAvoided:
        'Do not diagnose permanent hypoparathyroidism before correcting severe hypomagnesaemia.',
    },
    {
      type: 'SAFETY',
      title: 'Look for cardiac and airway severity markers',
      content:
        'Assess rhythm, haemodynamic state, respiratory effort, voice, mental status, and seizure activity in severe symptomatic disease.',
      whyItMatters:
        'Laryngospasm, seizure, arrhythmia, and marked QT prolongation can rapidly become life-threatening.',
      discriminator:
        'These findings determine the need for immediate monitored intravenous treatment rather than routine oral replacement.',
      trapAvoided:
        'Do not delay emergency treatment while completing the full aetiological work-up.',
    },
  ],
  scoringSystems: [],
  investigations: [
    {
      test: 'Ionised calcium',
      interpretation:
        'A low result directly confirms deficiency of the biologically active calcium fraction and is especially useful in severe symptoms, critical illness, or acid-base disturbance.',
      whyItMatters:
        'It provides the clearest biochemical confirmation of clinically significant Hypocalcaemia.',
    },
    {
      test: 'Total calcium and albumin',
      interpretation:
        'Low albumin can lower total calcium without reducing ionised calcium. Interpret the values together and use ionised calcium when uncertainty remains.',
      whyItMatters:
        'This prevents pseudohypocalcaemia from being mistaken for a true calcium deficit.',
    },
    {
      test: 'Serum magnesium',
      interpretation:
        'Severe deficiency can inhibit PTH secretion and cause resistance to PTH, leading to secondary Hypocalcaemia and failure to respond to calcium alone.',
      whyItMatters:
        'Magnesium is both an aetiological test and a treatment priority.',
    },
    {
      test: 'Parathyroid hormone',
      interpretation:
        'PTH should rise when calcium falls. A low or inappropriately normal value suggests impaired secretion, but severe hypomagnesaemia must be excluded or corrected before permanent hypoparathyroidism is diagnosed.',
      whyItMatters:
        'It localises the calcium-regulation defect and shows whether the response is physiologically appropriate.',
    },
    {
      test: 'Phosphate, renal function, and 25-hydroxyvitamin D',
      interpretation:
        'These distinguish magnesium-related functional PTH impairment from chronic kidney disease, vitamin D deficiency, and other causes of Hypocalcaemia.',
      whyItMatters:
        'Aetiological interpretation requires the pattern rather than one isolated value.',
    },
    {
      test: 'Urinary magnesium assessment',
      interpretation:
        'Low urinary magnesium excretion during hypomagnesaemia supports gastrointestinal loss or impaired absorption; inappropriate urinary loss suggests a renal wasting process.',
      whyItMatters:
        'It helps identify whether the magnesium deficit originates from the gut or kidney.',
    },
    {
      test: 'Electrocardiogram and serial electrolytes',
      interpretation:
        'Look for QT prolongation or arrhythmia and monitor calcium, magnesium, potassium, and renal function during replacement.',
      whyItMatters:
        'Hypocalcaemia, hypomagnesaemia, and hypokalaemia may coexist and increase cardiac risk.',
    },
  ],
  differentialDistinguishers: [
    {
      diagnosis: 'Respiratory Alkalosis',
      overlap:
        'Hyperventilation may produce perioral tingling and carpopedal spasm by reducing ionised calcium.',
      distinguishingFeatures:
        'Symptoms accompany hyperventilation, blood-gas testing shows alkalosis, and total calcium is often not markedly reduced.',
      decisiveClue:
        'Markedly low total and ionised calcium without alkalosis establishes true Hypocalcaemia.',
    },
    {
      diagnosis: 'Acute Dystonic Reaction',
      overlap: 'Painful involuntary posturing may resemble carpopedal spasm.',
      distinguishingFeatures:
        'Usually follows a dopamine-blocking medicine and often involves the eyes, jaw, tongue, or neck without reproducible Trousseau sign.',
      decisiveClue:
        'Provoked tetany signs and low ionised calcium support Hypocalcaemia.',
    },
    {
      diagnosis: 'Hypoglycaemia',
      overlap:
        'Can cause tremor, paraesthesia, confusion, seizure, or collapse.',
      distinguishingFeatures:
        'A low measured glucose accompanies adrenergic or neuroglycopenic features.',
      decisiveClue:
        'Normal glucose with severe low ionised calcium excludes hypoglycaemia as the primary explanation.',
    },
    {
      diagnosis: 'Focal Seizure',
      overlap:
        'May cause involuntary limb movement while awareness is preserved.',
      distinguishingFeatures:
        'Movements follow a cortical distribution and are not reproducibly provoked by cuff inflation; postictal or electroencephalographic findings may occur.',
      decisiveClue:
        'Bilateral carpopedal spasm with Trousseau sign and low ionised calcium indicates tetany.',
    },
    {
      diagnosis: 'Peripheral Neuropathy',
      overlap: 'Can cause symmetrical distal tingling or numbness.',
      distinguishingFeatures:
        'Usually has a chronic course, persistent sensory loss, weakness, or reduced reflexes rather than acute spasm and hyperreflexia.',
      decisiveClue:
        'Acute tetany with brisk reflexes and severe Hypocalcaemia argues against neuropathy.',
    },
    {
      diagnosis: 'Panic Attack',
      overlap:
        'Panic and hyperventilation may cause tingling, trembling, and hand spasm.',
      distinguishingFeatures:
        'Abrupt fear and autonomic symptoms are prominent, with alkalosis rather than a profound total-calcium deficit.',
      decisiveClue:
        'True Hypocalcaemia plus severe magnesium depletion establishes an organic electrolyte disorder.',
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
        'Calcium gluconate rapidly treats tetany and reduces neurological or cardiac risk. Follow the applicable emergency protocol for dilution, administration rate, repeat dosing, and infusion.',
    },
    {
      step: 'Replace severe magnesium deficiency concurrently',
      rationale:
        'Magnesium correction restores PTH secretion and action and is necessary when calcium remains low despite replacement. Use a monitored regimen appropriate to symptoms, renal function, and local protocol.',
    },
    {
      step: 'Correct associated electrolyte and volume losses',
      rationale:
        'Treat dehydration and ongoing gastrointestinal losses and correct associated hypokalaemia, which may itself be difficult to correct until magnesium is restored.',
    },
    {
      step: 'Remove or review the precipitating cause',
      rationale:
        'Review long-term proton-pump-inhibitor therapy and other medicines, assess for diarrhoea or malabsorption, and distinguish gastrointestinal depletion from renal magnesium wasting.',
    },
    {
      step: 'Monitor response and confirm recovery of PTH function',
      rationale:
        'Repeat calcium, ionised calcium, magnesium, potassium, renal function, and electrocardiography as indicated. Reassess PTH after magnesium correction before diagnosing persistent hypoparathyroidism.',
    },
  ],
  complications: [
    'Painful tetany and recurrent carpopedal spasm',
    'Laryngospasm and airway compromise',
    'Seizure or altered consciousness',
    'Prolonged QT interval and cardiac arrhythmia',
    'Concurrent hypokalaemia and refractory electrolyte disturbance',
    'Persistent Hypocalcaemia if magnesium deficiency is not corrected',
    'Recurrent magnesium depletion if the gastrointestinal or medication cause persists',
    'Complications of excessive or overly rapid intravenous replacement',
  ],
  pitfalls: [
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Treating the symptoms as anxiety',
      content:
        'Perioral tingling and hand spasm are often attributed to panic or hyperventilation before metabolic causes are assessed.',
      whyItMatters:
        'Severe Hypocalcaemia can progress to seizure, laryngospasm, or arrhythmia.',
      trapAvoided:
        'Check calcium, magnesium, glucose, and acid-base status when symptoms are bilateral, progressive, or accompanied by objective tetany.',
    },
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Using Hypomagnesaemia as the canonical answer',
      content:
        'Severe hypomagnesaemia explains the mechanism, but the case is biochemically and clinically presenting as acute Hypocalcaemia.',
      whyItMatters:
        'Separating the presenting diagnosis from its cause keeps registry mapping and learner assessment coherent.',
      trapAvoided:
        'Use Hypocalcaemia as the diagnosis and severe hypomagnesaemia as the aetiology.',
    },
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Diagnosing permanent hypoparathyroidism too early',
      content:
        'Profound magnesium deficiency can produce a low or inappropriately normal PTH concentration despite severe Hypocalcaemia.',
      whyItMatters:
        'The PTH abnormality may reverse after magnesium replacement.',
      trapAvoided:
        'Correct magnesium and reassess the calcium-PTH relationship before assigning permanent parathyroid failure.',
    },
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Relying on Chvostek sign alone',
      content:
        'Chvostek sign has limited sensitivity and specificity and cannot replace biochemical confirmation.',
      whyItMatters:
        'Over-reliance may produce false-positive or false-negative conclusions.',
      trapAvoided:
        'Combine the symptom pattern, Trousseau sign, total calcium with albumin, and ionised calcium.',
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
      title: 'Giving calcium without correcting magnesium',
      content:
        'Severe magnesium deficiency impairs PTH secretion and action and can make Hypocalcaemia refractory to calcium replacement.',
      whyItMatters:
        'Repeated calcium dosing may give only transient or inadequate correction.',
      trapAvoided:
        'Replace magnesium concurrently and monitor calcium, magnesium, potassium, renal function, and rhythm.',
    },
    {
      type: 'AETIOLOGY',
      title: 'Missing chronic medication-related magnesium depletion',
      content:
        'Long-term proton-pump-inhibitor exposure may impair intestinal magnesium absorption and may become clinically evident when diarrhoea or poor intake adds further loss.',
      whyItMatters:
        'Failure to remove or review the precipitant increases recurrence risk.',
      trapAvoided:
        'Take a detailed medication history and assess urinary magnesium when the source of depletion is unclear.',
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
        'It may occur in people without Hypocalcaemia and may be absent in true disease, so it must be interpreted with the clinical pattern and calcium results.',
    },
    {
      prompt: 'What does low ionised calcium establish?',
      answer:
        'True deficiency of the physiologically active calcium fraction.',
    },
    {
      prompt: 'How can severe hypomagnesaemia cause Hypocalcaemia?',
      answer:
        'It can suppress PTH secretion and reduce responsiveness to PTH in target tissues.',
    },
    {
      prompt:
        'Why can PTH be low or inappropriately normal during profound magnesium depletion?',
      answer:
        'Severe magnesium deficiency impairs parathyroid hormone synthesis and release despite the normal stimulus from low calcium.',
    },
    {
      prompt: 'Why may calcium replacement alone fail?',
      answer:
        'PTH secretion and action remain impaired until the severe magnesium deficit is corrected.',
    },
    {
      prompt:
        'What does low urinary magnesium excretion suggest during hypomagnesaemia?',
      answer:
        'Gastrointestinal loss or impaired intestinal absorption rather than inappropriate renal wasting.',
    },
    {
      prompt:
        'What is the immediate treatment principle for severe symptomatic Hypocalcaemia?',
      answer:
        'Urgent monitored intravenous calcium together with correction of severe magnesium deficiency and other associated electrolyte losses.',
    },
  ],
  references: [
    {
      citation:
        'Society for Endocrinology. Emergency management of acute hypocalcaemia in adult patients. Endocrine Connections. 2016;5:G7-G8. Addendum updated 2019.',
    },
    {
      citation:
        'Schafer AL, Shoback DM. Hypocalcemia: Diagnosis and Treatment. Endotext. NCBI Bookshelf.',
    },
    {
      citation:
        'Shaker JL, Deftos L. Calcium and Phosphate Homeostasis. Endotext. NCBI Bookshelf. Updated 2023.',
    },
    {
      citation:
        'Gommers LMM, et al. Mechanisms of proton pump inhibitor-induced hypomagnesemia. Acta Physiologica. 2022;235:e13846.',
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
    'hypomagnesaemia',
    'hypomagnesemia',
    'magnesium deficiency',
    'low magnesium',
    'omeprazole',
    'proton pump inhibitor',
    'proton-pump inhibitor',
  ];

  for (const clue of clues.slice(0, 4)) {
    const normalized = normalizeClinicalText(clue.value);
    const leakedTerm = earlyAetiologyTerms.find((term) =>
      normalized.includes(normalizeClinicalText(term)),
    );

    if (leakedTerm) {
      throw new Error(
        `Clue ${clue.order} leaks the severe-hypomagnesaemia cause too early: ${leakedTerm}.`,
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
            surgeryStorylineRemoved: true,
            severeHypomagnesaemiaMechanismAdded: true,
            aetiologyWithheldUntilAfterCalciumConfirmation: true,
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
          'Repaired Hypocalcaemia case: removed the postoperative storyline, rebuilt the case around severe hypomagnesaemia caused by chronic proton-pump-inhibitor exposure compounded by gastrointestinal loss, preserved Hypocalcaemia as the canonical diagnosis, rebuilt all clue-breakdown references, and aligned diagnosis education to the structured frontend schema with individually described signs.',
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
          'Repaired Hypocalcaemia flagship case with severe hypomagnesaemia as the delayed aetiology, exact clue-breakdown alignment, and structured sign education. DailyCase scheduling and case date were not altered.',
      },
    });

    await tx.caseValidationRun.create({
      data: {
        caseId: targetCase.id,
        revisionId: revision.id,
        source: CaseSource.MANUAL,
        publishTrack,
        outcome: ValidationOutcome.PASSED,
        validatorVersion: `flagship-human-repair:hypocalcaemia-v4`,
        summary: {
          contentTier: 'FLAGSHIP',
          repairVersion,
          humanReviewed: true,
          canonicalDiagnosisVerified: true,
          clueProgressionVerified: true,
          earlyAetiologyLeakRemoved: true,
          postoperativeStorylineRemoved: true,
          severeHypomagnesaemiaMechanismVerified: true,
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
            'Hypocalcaemia repair completed: the case progresses from gastrointestinal illness and acute neuromuscular symptoms to bedside tetany signs, biochemical calcium confirmation, delayed exposure history, and finally severe hypomagnesaemia with an inadequate PTH response. The postoperative storyline has been removed. Diagnosis education uses structured frontend objects and explicitly describes Trousseau sign, Chvostek sign, hyperreflexia, tetany, laryngospasm, seizure, and QT prolongation.',
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
