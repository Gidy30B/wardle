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
 * FLAGSHIP CASE SEED - Wolff-Parkinson-White Syndrome
 *
 * Clinical focus:
 * - Abrupt recurrent paroxysmal palpitations.
 * - Stable regular narrow-complex AV-node-dependent tachycardia.
 * - Resting ventricular pre-excitation with a short PR interval, delta wave,
 *   and widened QRS complex.
 * - Electrophysiological confirmation of an accessory atrioventricular pathway
 *   participating in orthodromic AVRT.
 *
 * Education design:
 * - The case explanation is vignette-specific.
 * - Diagnosis education is independent of the case and covers recognition,
 *   rhythm differentiation, emergency safety, risk assessment, and ablation.
 *
 * Safety:
 * - Reuses or creates the exact diagnosis registry and accepted aliases.
 * - Does not overwrite existing diagnosis education.
 * - Does not overwrite an existing case with the same title.
 * - Does not alter a scheduled DailyCase.
 *
 * Run:
 *   npx tsx prisma/seed/flagship-wolff-parkinson-white-syndrome.seed.ts
 *
 * Railway:
 *   railway run npx tsx prisma/seed/flagship-wolff-parkinson-white-syndrome.seed.ts
 */

const databaseUrl = resolvePgConnectionString(process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required to run the Wolff-Parkinson-White Syndrome seed.',
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
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 7, 1, 12, 0, 0));
const seedVersion = 'flagship-wolff-parkinson-white-syndrome-v1';

const canonicalName = 'wolff-parkinson-white syndrome';
const displayLabel = 'Wolff-Parkinson-White Syndrome';
const caseTitle = 'Abrupt Recurrent Palpitations in a Young Adult';

const taxonomy = {
  specialty: 'Cardiology',
  subspecialty: 'Electrophysiology',
  category: 'Accessory Pathway Arrhythmia',
  bodySystem: 'Cardiovascular',
  organSystem: 'Cardiac Conduction System',
} as const;

const aliasTerms = [
  'Wolff-Parkinson-White Syndrome',
  'Wolff Parkinson White Syndrome',
  'WPW Syndrome',
  'WPW',
  'Ventricular Pre-excitation Syndrome',
];

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 22-year-old man reports six months of recurrent episodes of a suddenly rapid heartbeat. Each episode starts and stops abruptly, usually lasts 10 to 30 minutes, and has occurred both at rest and during light activity. He has no known structural heart disease, stimulant use, thyroid disease, anaemia, fever, or previous cardiac surgery.',
  },
  {
    order: 1,
    type: 'symptom',
    value:
      'During the current episode he feels a very fast regular pounding in his chest with light-headedness and mild shortness of breath. He has no syncope, persistent chest pain, focal neurological symptoms, or family history of unexplained sudden death.',
  },
  {
    order: 2,
    type: 'vital',
    value:
      'Pulse is 196 beats/min and regular, blood pressure 112/68 mmHg, respiratory rate 20/min, oxygen saturation 99% on room air, and temperature 36.7°C. He is alert, speaking normally, and has warm extremities without signs of shock or heart failure.',
  },
  {
    order: 3,
    type: 'lab',
    value:
      'A 12-lead ECG recorded during symptoms shows a regular narrow-complex tachycardia at 196 beats/min with QRS duration 88 ms and small retrograde P waves immediately after each QRS complex. Vagal manoeuvres fail, but 6 mg intravenous adenosine terminates the rhythm and restores sinus rhythm.',
  },
  {
    order: 4,
    type: 'lab',
    value:
      'The post-conversion resting ECG shows sinus rhythm with a PR interval of 90 ms, a slurred initial upstroke of the QRS complex, QRS duration 132 ms, and secondary repolarisation changes. Echocardiography shows normal chamber size, valves, and ventricular function.',
  },
  {
    order: 5,
    type: 'lab',
    value:
      'Electrophysiology study identifies a left lateral atrioventricular accessory pathway capable of both antegrade and retrograde conduction, with inducible orthodromic atrioventricular re-entrant tachycardia. Radiofrequency ablation abolishes pathway conduction and the resting pre-excitation pattern, establishing Wolff-Parkinson-White Syndrome.',
  },
] as const;

const differentials = [
  'Atrioventricular Nodal Re-entrant Tachycardia',
  'Orthodromic AVRT with a Concealed Accessory Pathway',
  'Focal Atrial Tachycardia',
  'Atrial Flutter with 2:1 Conduction',
  'Sinus Tachycardia',
  'Ventricular Tachycardia',
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
  'Abrupt onset and termination of recurrent palpitations suggest a paroxysmal re-entrant tachycardia rather than a physiologically driven sinus tachycardia.',
  'A rapid regular pounding heartbeat with light-headedness and dyspnoea supports a clinically significant tachyarrhythmia while the absence of syncope or persistent chest pain lowers immediate high-risk features.',
  'A regular pulse near 200 beats/min with preserved blood pressure and perfusion indicates a haemodynamically stable supraventricular tachycardia presentation.',
  'A regular narrow-complex tachycardia with retrograde atrial activity and adenosine termination strongly supports an atrioventricular node-dependent re-entry mechanism such as AVRT or AVNRT.',
  'The short PR interval, slurred initial QRS upstroke, and widened QRS complex demonstrate manifest ventricular pre-excitation through an accessory atrioventricular pathway.',
  'Electrophysiological demonstration of a bidirectionally conducting accessory pathway with inducible orthodromic AVRT unifies the symptomatic tachycardia and resting pre-excitation as Wolff-Parkinson-White Syndrome.',
];

const breakdownDetails = [
  {
    explanation:
      'Abrupt onset and termination of recurrent palpitations suggest a paroxysmal re-entrant tachycardia rather than a physiologically driven sinus tachycardia.',
    diagnosticContribution:
      'Establishes a paroxysmal re-entry pattern and makes gradual physiologic tachycardias less likely.',
  },
  {
    explanation:
      'A rapid regular pounding heartbeat with light-headedness and dyspnoea supports a clinically significant tachyarrhythmia while the absence of syncope or persistent chest pain lowers immediate high-risk features.',
    diagnosticContribution:
      'Confirms that the episodes are symptomatic tachyarrhythmias while documenting the absence of major instability.',
  },
  {
    explanation:
      'A regular pulse near 200 beats/min with preserved blood pressure and perfusion indicates a haemodynamically stable supraventricular tachycardia presentation.',
    diagnosticContribution:
      'Classifies the current episode as a stable, regular tachycardia suitable for rhythm-based diagnostic evaluation.',
  },
  {
    explanation:
      'A regular narrow-complex tachycardia with retrograde atrial activity and adenosine termination strongly supports an atrioventricular node-dependent re-entry mechanism such as AVRT or AVNRT.',
    diagnosticContribution:
      'Narrows the mechanism to an AV-node-dependent supraventricular re-entry circuit.',
  },
  {
    explanation:
      'The short PR interval, slurred initial QRS upstroke, and widened QRS complex demonstrate manifest ventricular pre-excitation through an accessory atrioventricular pathway.',
    diagnosticContribution:
      'Demonstrates manifest accessory-pathway conduction during sinus rhythm.',
  },
  {
    explanation:
      'Electrophysiological demonstration of a bidirectionally conducting accessory pathway with inducible orthodromic AVRT unifies the symptomatic tachycardia and resting pre-excitation as Wolff-Parkinson-White Syndrome.',
    diagnosticContribution:
      'Confirms the accessory pathway, links it to the clinical tachycardia, and establishes the canonical diagnosis.',
  },
];

const clueBreakdown = clues.map((clue, index) => ({
  clueOrder: clue.order,
  clueType: clue.type,
  clue: clue.value,
  explanation: breakdownDetails[index].explanation,
  diagnosticContribution: breakdownDetails[index].diagnosticContribution,
})) satisfies ClueBreakdownEntry[];

const differentialAnalysis = [
  {
    diagnosis: 'Atrioventricular Nodal Re-entrant Tachycardia',
    whyPlausibleEarly:
      'AVNRT commonly presents with abrupt regular narrow-complex tachycardia that terminates with AV-nodal blockade.',
    ruledOutByClues: [
      {
        clueOrder: 4,
        evidence:
          'PR interval of 90 ms, a slurred initial upstroke of the QRS complex, QRS duration 132 ms',
        reason:
          'Manifest ventricular pre-excitation indicates an antegradely conducting accessory pathway, which AVNRT alone does not explain.',
      },
      {
        clueOrder: 5,
        evidence: 'left lateral atrioventricular accessory pathway',
        reason:
          'The electrophysiology study identifies an accessory pathway that participates in the clinical re-entry circuit.',
      },
    ],
    finalReasonLessLikely:
      'Although the tachycardia behaviour resembles AVNRT, the resting pre-excitation and demonstrated accessory pathway establish AVRT in WPW syndrome.',
  },
  {
    diagnosis: 'Orthodromic AVRT with a Concealed Accessory Pathway',
    whyPlausibleEarly:
      'A concealed pathway can conduct retrogradely and produce abrupt adenosine-sensitive narrow-complex orthodromic AVRT.',
    ruledOutByClues: [
      {
        clueOrder: 4,
        evidence:
          'PR interval of 90 ms, a slurred initial upstroke of the QRS complex',
        reason:
          'A concealed pathway does not conduct antegradely during sinus rhythm and therefore does not produce manifest pre-excitation.',
      },
      {
        clueOrder: 5,
        evidence: 'capable of both antegrade and retrograde conduction',
        reason:
          'Bidirectional pathway conduction confirms a manifest rather than concealed accessory pathway.',
      },
    ],
    finalReasonLessLikely:
      'The accessory pathway is manifest on the resting ECG and conducts in both directions.',
  },
  {
    diagnosis: 'Focal Atrial Tachycardia',
    whyPlausibleEarly:
      'Focal atrial tachycardia can cause a regular narrow-complex tachycardia with palpitations and light-headedness.',
    ruledOutByClues: [
      {
        clueOrder: 0,
        evidence: 'starts and stops abruptly',
        reason:
          'The abrupt paroxysmal pattern favours re-entry over the warm-up and cool-down behaviour often seen in automatic atrial tachycardia.',
      },
      {
        clueOrder: 3,
        evidence: 'retrograde P waves immediately after each QRS complex',
        reason:
          'This atrial timing supports retrograde activation through an AV re-entry circuit rather than a primary atrial focus.',
      },
      {
        clueOrder: 5,
        evidence:
          'inducible orthodromic atrioventricular re-entrant tachycardia',
        reason:
          'Electrophysiological induction demonstrates the actual re-entry mechanism.',
      },
    ],
    finalReasonLessLikely:
      'The atria are activated retrogradely as part of an accessory-pathway circuit rather than driving the tachycardia from a focal source.',
  },
  {
    diagnosis: 'Atrial Flutter with 2:1 Conduction',
    whyPlausibleEarly:
      'Atrial flutter can produce a rapid regular narrow-complex rhythm and may cause palpitations or dyspnoea.',
    ruledOutByClues: [
      {
        clueOrder: 3,
        evidence: 'small retrograde P waves immediately after each QRS complex',
        reason:
          'The tracing lacks continuous flutter activity and instead shows one retrograde atrial activation for each ventricular complex.',
      },
      {
        clueOrder: 3,
        evidence: 'adenosine terminates the rhythm',
        reason:
          'Termination indicates an AV-node-dependent re-entry circuit rather than merely transient AV block revealing ongoing flutter.',
      },
    ],
    finalReasonLessLikely:
      'The ECG and response to adenosine demonstrate AV-node-dependent re-entry rather than atrial flutter.',
  },
  {
    diagnosis: 'Sinus Tachycardia',
    whyPlausibleEarly:
      'A fast pulse with dyspnoea or light-headedness can reflect sinus tachycardia caused by physiological stress.',
    ruledOutByClues: [
      {
        clueOrder: 0,
        evidence: 'starts and stops abruptly',
        reason:
          'Sinus tachycardia usually accelerates and decelerates gradually in response to an underlying trigger.',
      },
      {
        clueOrder: 0,
        evidence:
          'no known structural heart disease, stimulant use, thyroid disease, anaemia, fever',
        reason:
          'Common physiological and secondary drivers are not present in the history.',
      },
      {
        clueOrder: 3,
        evidence: 'adenosine terminates the rhythm',
        reason:
          'Abrupt termination by transient AV-nodal block supports a re-entrant SVT rather than sinus tachycardia.',
      },
    ],
    finalReasonLessLikely:
      'The abrupt recurrent pattern and AV-node-dependent termination are incompatible with ordinary sinus tachycardia.',
  },
  {
    diagnosis: 'Ventricular Tachycardia',
    whyPlausibleEarly:
      'Any sudden rapid tachycardia with light-headedness must initially be assessed for a ventricular origin.',
    ruledOutByClues: [
      {
        clueOrder: 3,
        evidence: 'regular narrow-complex tachycardia',
        reason:
          'A QRS duration of 88 ms strongly favours supraventricular activation through the normal His-Purkinje system.',
      },
      {
        clueOrder: 4,
        evidence: 'normal chamber size, valves, and ventricular function',
        reason:
          'The absence of structural disease lowers the likelihood of scar-related ventricular tachycardia.',
      },
      {
        clueOrder: 5,
        evidence:
          'inducible orthodromic atrioventricular re-entrant tachycardia',
        reason:
          'Electrophysiology directly demonstrates a supraventricular re-entry mechanism.',
      },
    ],
    finalReasonLessLikely:
      'The narrow-complex ECG and electrophysiology findings establish AVRT rather than ventricular tachycardia.',
  },
] satisfies DifferentialAnalysisEntry[];

const explanation = {
  diagnosis: displayLabel,
  summary:
    'Recurrent abrupt palpitations, a stable regular narrow-complex AV-node-dependent tachycardia, a short PR interval with delta-wave pre-excitation in sinus rhythm, and electrophysiological demonstration of a bidirectionally conducting accessory pathway establish Wolff-Parkinson-White Syndrome.',
  reasoning: reasoningSteps.join('\n'),
  clueBreakdown,
  keyFindings: [
    'Abrupt onset and termination of recurrent palpitations',
    'Regular narrow-complex tachycardia',
    'Adenosine-sensitive AV-node-dependent re-entry',
    'Short PR interval',
    'Delta wave',
    'Widened QRS complex during sinus rhythm',
    'Normal cardiac structure and ventricular function',
    'Bidirectionally conducting accessory pathway',
    'Inducible orthodromic AVRT',
  ],
  differentials,
  differentialAnalysis,
  managementPearl:
    'First assess haemodynamic stability and rhythm type. Stable regular narrow-complex AVRT may respond to vagal manoeuvres or adenosine, but a rapid irregular broad-complex rhythm may represent pre-excited atrial fibrillation and should not be treated with isolated AV-nodal blockade. Symptomatic patients should be referred for electrophysiology assessment and consideration of definitive catheter ablation.',
  generationQuality: {
    contentTier: 'FLAGSHIP',
    seedVersion,
    humanReviewed: true,
    discriminatorStrength: 'HIGH',
    clueProgressionVerified: true,
    breakdownClueReferencesValidated: true,
    frontendReasoningCompatible: true,
    educationIndependentOfCase: true,
    expectedTeachingPoints: [
      'WPW syndrome combines manifest ventricular pre-excitation with symptomatic tachyarrhythmia',
      'The resting ECG pattern is a short PR interval, delta wave, and widened QRS complex',
      'Orthodromic AVRT is usually a regular narrow-complex tachycardia',
      'Pre-excited atrial fibrillation is an irregular broad-complex emergency',
      'Isolated AV-nodal blockers should be avoided in suspected pre-excited atrial fibrillation',
      'Catheter ablation is definitive treatment for an appropriate symptomatic accessory pathway',
    ],
    competencyDomains: [
      'Cardiology',
      'Electrophysiology',
      'ECG Interpretation',
      'Emergency Cardiology',
      'Clinical Reasoning',
    ],
  },
};

const educationForFrontend = {
  title: 'Wolff-Parkinson-White Syndrome',
  summary: {
    definition:
      'Wolff-Parkinson-White syndrome is the combination of manifest ventricular pre-excitation through an accessory atrioventricular pathway and symptomatic tachyarrhythmia. A pre-excitation ECG pattern without symptoms is not automatically synonymous with the syndrome.',
    highYieldTakeaway:
      'Recognise the resting ECG triad of a short PR interval, delta wave, and widened QRS complex, then determine whether the patient has symptomatic AVRT or another tachyarrhythmia and whether urgent or definitive electrophysiology management is required.',
  },
  recognitionPattern: [
    {
      pattern: 'Manifest ventricular pre-excitation in sinus rhythm',
      whyItMatters:
        'Accessory-pathway conduction activates part of the ventricle before the impulse reaches it through the AV node and His-Purkinje system.',
      progression:
        'Antegrade accessory-pathway conduction -> shortened atrioventricular delay -> early slurred ventricular activation -> fusion with normal conduction.',
      discriminator:
        'The typical resting ECG combines a PR interval of 120 ms or less, a delta wave, and a QRS duration greater than 120 ms.',
      commonTrap:
        'Do not diagnose the clinical syndrome from an ECG pattern alone without asking about tachyarrhythmia symptoms.',
    },
    {
      pattern: 'Abrupt paroxysmal supraventricular tachycardia',
      whyItMatters:
        'An accessory pathway can complete a macro-re-entrant circuit between atria and ventricles.',
      progression:
        'Premature beat -> unidirectional block -> conduction down one limb and return through the other -> sustained AVRT.',
      discriminator:
        'Orthodromic AVRT is usually regular and narrow because antegrade conduction travels through the AV node and His-Purkinje system.',
      commonTrap:
        'A narrow tachycardia in a patient with WPW is not necessarily pre-excited; the pathway may be used only for retrograde conduction during orthodromic AVRT.',
    },
    {
      pattern: 'Pre-excited atrial fibrillation',
      whyItMatters:
        'Rapid irregular conduction over an accessory pathway can produce very high ventricular rates and may degenerate into ventricular fibrillation.',
      progression:
        'Atrial fibrillation -> multiple atrial impulses reach the accessory pathway -> rapid irregular ventricular activation.',
      discriminator:
        'An irregular broad-complex tachycardia with beat-to-beat variation in QRS morphology should raise concern for pre-excited atrial fibrillation.',
      commonTrap:
        'Avoid isolated AV-nodal blockers in suspected pre-excited atrial fibrillation because they may favour conduction over the accessory pathway.',
    },
    {
      pattern:
        'Symptoms or high-risk pathway features prompt specialist assessment',
      whyItMatters:
        "Risk is determined by the pathway's ability to conduct rapidly and by the patient's arrhythmia history, occupation, comorbidity, and preferences.",
      progression:
        'Clinical assessment -> non-invasive or invasive risk stratification -> electrophysiology study when indicated -> catheter ablation for an appropriate pathway.',
      discriminator:
        'Syncope, documented tachyarrhythmia, pre-excited atrial fibrillation, or high-risk electrophysiological properties increase concern.',
      commonTrap:
        'Intermittent loss of pre-excitation may suggest lower risk but does not replace a complete specialist assessment when other concerning features are present.',
    },
  ],
  keySymptoms: [
    {
      symptom: 'Abrupt palpitations',
      significance:
        'Sudden onset and termination support a re-entrant tachycardia.',
    },
    {
      symptom: 'Light-headedness or presyncope',
      significance:
        'May reflect reduced cardiac output during rapid tachycardia and requires haemodynamic assessment.',
    },
    {
      symptom: 'Dyspnoea or chest discomfort',
      significance:
        'Can accompany tachycardia but persistent pain or instability requires evaluation for additional pathology.',
    },
    {
      symptom: 'Syncope',
      significance:
        'Raises concern for a high-risk arrhythmia and warrants urgent specialist evaluation.',
    },
  ],
  keySigns: [
    {
      finding: 'Rapid regular pulse during AVRT',
      significance:
        'Orthodromic AVRT commonly produces a regular narrow-complex tachycardia.',
      discriminator:
        'Irregularity or broad variable complexes should prompt assessment for pre-excited atrial fibrillation or another rhythm.',
    },
    {
      finding: 'Short PR interval',
      significance:
        'Reflects ventricular activation beginning earlier than expected through an accessory pathway.',
      discriminator:
        'It should be interpreted together with the delta wave and QRS widening.',
    },
    {
      finding: 'Delta wave',
      significance:
        'The slurred beginning of the QRS complex represents early ventricular myocardial activation outside the His-Purkinje system.',
      discriminator:
        'A delta wave distinguishes manifest pre-excitation from a concealed accessory pathway.',
    },
    {
      finding: 'Normal examination between episodes',
      significance:
        'Many affected patients have no abnormal cardiovascular findings between tachyarrhythmias.',
      discriminator:
        'A murmur, cardiomyopathy signs, or heart-failure findings suggest associated structural disease requiring further evaluation.',
    },
  ],
  examPearls: [
    {
      type: 'RHYTHM',
      title: 'Determine stability first',
      content:
        'Assess blood pressure, mental state, perfusion, chest pain, pulmonary oedema, and shock before attempting detailed rhythm classification.',
      whyItMatters:
        'Unstable tachycardia requires immediate synchronized cardioversion rather than prolonged diagnostic manoeuvres.',
      discriminator:
        'Instability is a management decision independent of the exact accessory-pathway location.',
      trapAvoided:
        'Do not delay cardioversion in an unstable patient while searching for a perfect ECG diagnosis.',
    },
    {
      type: 'ECG',
      title: 'Separate orthodromic AVRT from pre-excited atrial fibrillation',
      content:
        'A regular narrow-complex tachycardia is compatible with orthodromic AVRT, while a very rapid irregular broad-complex rhythm with changing morphology suggests pre-excited atrial fibrillation.',
      whyItMatters:
        'The medication safety profile differs substantially between these rhythms.',
      discriminator:
        'Regularity, QRS width, morphology variation, and atrial activity guide the distinction.',
      trapAvoided:
        'Do not use the same AV-nodal-blocking strategy for every tachyarrhythmia in a patient with pre-excitation.',
    },
    {
      type: 'HISTORY',
      title: 'Ask about syncope and sudden-death risk',
      content:
        'Document syncope, family history of unexplained sudden death, prior irregular tachycardia, exercise-related symptoms, and high-risk occupations or competitive sport.',
      whyItMatters:
        'These details influence urgency and the need for electrophysiological risk assessment.',
      discriminator:
        'Brief uncomplicated palpitations differ from syncope or documented pre-excited atrial fibrillation.',
      trapAvoided:
        'Do not dismiss a young patient as low risk based only on age.',
    },
    {
      type: 'STRUCTURE',
      title: 'Assess for associated heart disease',
      content:
        'Perform cardiovascular examination and echocardiography when appropriate to evaluate ventricular function, valves, and congenital or inherited associations.',
      whyItMatters:
        'Most patients have structurally normal hearts, but associated conditions can alter management.',
      discriminator:
        'Structural findings suggest an additional diagnosis rather than excluding pre-excitation.',
      trapAvoided:
        'Do not assume a normal resting examination excludes clinically important arrhythmia.',
    },
  ],
  scoringSystems: [],
  investigations: [
    {
      test: 'Twelve-lead ECG in sinus rhythm',
      interpretation:
        'Look for a PR interval of 120 ms or less, a delta wave, and a widened QRS complex. Pre-excitation may be intermittent.',
      whyItMatters:
        'This establishes manifest accessory-pathway conduction and may help approximate pathway location.',
    },
    {
      test: 'Twelve-lead ECG during tachycardia',
      interpretation:
        'Assess regularity, QRS width, atrial activity, RP relationship, and beat-to-beat morphology.',
      whyItMatters:
        'The tachycardia tracing differentiates orthodromic AVRT, antidromic AVRT, AVNRT, atrial tachycardia, flutter, ventricular tachycardia, and pre-excited atrial fibrillation.',
    },
    {
      test: 'Ambulatory ECG monitoring',
      interpretation:
        'Correlates intermittent symptoms with rhythm and may document AVRT, atrial fibrillation, or intermittent pre-excitation.',
      whyItMatters:
        'Many patients are in sinus rhythm by the time they reach medical care.',
    },
    {
      test: 'Echocardiography',
      interpretation:
        'Assesses ventricular function and structural heart disease.',
      whyItMatters:
        'Structural abnormalities may affect risk, differential diagnosis, and procedural planning.',
    },
    {
      test: 'Exercise testing or other non-invasive risk assessment',
      interpretation:
        'Abrupt loss of pre-excitation at higher rates may suggest a pathway with a longer antegrade refractory period, but interpretation requires expertise.',
      whyItMatters:
        'Non-invasive findings can contribute to assessment in selected asymptomatic patients.',
    },
    {
      test: 'Electrophysiology study',
      interpretation:
        'Defines accessory-pathway location, conduction properties, participation in tachycardia, and inducibility of arrhythmia.',
      whyItMatters:
        'It provides definitive mechanism assessment and allows catheter ablation during the same procedure when appropriate.',
    },
  ],
  differentialDistinguishers: [
    {
      diagnosis: 'Atrioventricular Nodal Re-entrant Tachycardia',
      overlap:
        'Abrupt regular narrow-complex tachycardia responsive to AV-nodal blockade.',
      distinguishingFeatures:
        'AVNRT does not cause a delta wave or manifest pre-excitation during sinus rhythm.',
      decisiveClue:
        'Resting pre-excitation or demonstration of an accessory pathway favours WPW-associated AVRT.',
    },
    {
      diagnosis: 'Concealed Accessory-Pathway AVRT',
      overlap: 'Orthodromic AVRT may look identical during tachycardia.',
      distinguishingFeatures:
        'A concealed pathway conducts retrogradely only and produces no resting delta wave.',
      decisiveClue:
        'Manifest pre-excitation proves antegrade pathway conduction.',
    },
    {
      diagnosis: 'Atrial Flutter',
      overlap: 'Can produce a rapid regular narrow-complex rhythm.',
      distinguishingFeatures:
        'Flutter activity continues despite transient AV block and is not terminated by AV-nodal blockade.',
      decisiveClue:
        'Adenosine termination of the entire tachycardia supports AV-node-dependent re-entry.',
    },
    {
      diagnosis: 'Ventricular Tachycardia',
      overlap:
        'Can present with sudden palpitations, presyncope, and a rapid rhythm.',
      distinguishingFeatures:
        'Usually broad-complex and more strongly associated with structural heart disease, although exceptions occur.',
      decisiveClue:
        'Electrophysiological demonstration of orthodromic AVRT confirms a supraventricular mechanism.',
    },
    {
      diagnosis: 'Sinus Tachycardia',
      overlap: 'Causes a fast regular pulse and may cause palpitations.',
      distinguishingFeatures:
        'Usually has a physiological driver and gradual acceleration and deceleration.',
      decisiveClue:
        'Abrupt onset, abrupt termination, and a re-entrant ECG pattern favour AVRT.',
    },
  ],
  managementOverview: [
    {
      step: 'Assess haemodynamic stability',
      rationale:
        'Hypotension, shock, altered consciousness, ischaemic chest discomfort, or acute heart failure requires immediate synchronized cardioversion.',
    },
    {
      step: 'Treat stable regular narrow-complex AVRT appropriately',
      rationale:
        'Vagal manoeuvres and adenosine are commonly used for AV-node-dependent regular narrow-complex tachycardia when no contraindication exists.',
    },
    {
      step: 'Recognise suspected pre-excited atrial fibrillation',
      rationale:
        'A rapid irregular broad-complex rhythm requires urgent expert management; isolated AV-nodal blockers should be avoided because they may increase accessory-pathway conduction.',
    },
    {
      step: 'Refer symptomatic patients for electrophysiology assessment',
      rationale:
        'Catheter ablation can eliminate the accessory pathway and is definitive treatment for recurrent symptomatic AVRT in suitable patients.',
    },
    {
      step: 'Risk-stratify asymptomatic pre-excitation',
      rationale:
        'Management depends on symptoms, pathway properties, occupation, sport, comorbidity, and patient preference rather than the ECG appearance alone.',
    },
    {
      step: 'Review after ablation',
      rationale:
        'Confirm loss of pre-excitation, assess recurrence, and provide advice about symptoms requiring reassessment.',
    },
  ],
  complications: [
    'Recurrent orthodromic or antidromic atrioventricular re-entrant tachycardia',
    'Pre-excited atrial fibrillation with dangerously rapid ventricular response',
    'Syncope or haemodynamic instability',
    'Rare degeneration to ventricular fibrillation and sudden cardiac death',
    'Tachycardia-mediated cardiomyopathy with frequent or sustained arrhythmia',
    'Procedural complications or recurrence after catheter ablation',
  ],
  pitfalls: [
    {
      type: 'TERMINOLOGY',
      title: 'Calling every pre-excitation ECG WPW syndrome',
      content:
        'Manifest pre-excitation without symptomatic tachyarrhythmia is an ECG pattern; the syndrome combines pre-excitation with clinical tachyarrhythmia.',
      whyItMatters:
        'Terminology affects counselling, risk assessment, and interpretation of the clinical record.',
      trapAvoided:
        'Document symptoms and rhythm history rather than relying on the ECG label alone.',
    },
    {
      type: 'SAFETY',
      title: 'Giving an AV-nodal blocker in pre-excited atrial fibrillation',
      content:
        'Blocking the AV node may favour rapid conduction over the accessory pathway.',
      whyItMatters:
        'The ventricular rate may accelerate and the rhythm may deteriorate.',
      trapAvoided:
        'Recognise the irregular broad-complex pattern and seek urgent rhythm-specific treatment.',
    },
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Assuming a narrow tachycardia excludes WPW',
      content:
        'Orthodromic AVRT usually has a narrow QRS because antegrade conduction travels through the AV node.',
      whyItMatters:
        'The accessory pathway may be used only as the retrograde limb during the tachycardia.',
      trapAvoided:
        'Review the sinus-rhythm ECG and the atrial timing during tachycardia.',
    },
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Missing intermittent pre-excitation',
      content:
        'The delta wave may vary or disappear, so one normal ECG does not exclude an accessory pathway.',
      whyItMatters:
        'Intermittent symptoms may require ambulatory monitoring or specialist testing.',
      trapAvoided:
        'Compare multiple tracings and correlate ECG findings with symptoms.',
    },
    {
      type: 'FOLLOW_UP',
      title: 'Failing to assess syncope or high-risk activity',
      content:
        'Syncope, competitive sport, professional driving, and other safety-sensitive work may change the urgency of risk assessment.',
      whyItMatters:
        'An apparently mild symptom history can have important safety implications.',
      trapAvoided:
        'Include occupational, exercise, and syncope history in every assessment.',
    },
  ],
  recallPrompts: [
    {
      prompt:
        'What three resting ECG features classically indicate manifest ventricular pre-excitation?',
      answer: 'A short PR interval, a delta wave, and a widened QRS complex.',
    },
    {
      prompt:
        'What is the usual mechanism of a regular narrow-complex tachycardia in symptomatic WPW?',
      answer:
        'Orthodromic atrioventricular re-entrant tachycardia, with antegrade conduction through the AV node and retrograde conduction through the accessory pathway.',
    },
    {
      prompt:
        'Which rhythm is particularly dangerous in a patient with a rapidly conducting accessory pathway?',
      answer:
        'Pre-excited atrial fibrillation with a very rapid irregular ventricular response.',
    },
    {
      prompt:
        'Why should isolated AV-nodal blockers be avoided in suspected pre-excited atrial fibrillation?',
      answer:
        'They may favour conduction through the accessory pathway and accelerate the ventricular rate.',
    },
    {
      prompt:
        'What is the definitive treatment for recurrent symptomatic accessory-pathway tachycardia?',
      answer:
        'Electrophysiology-guided catheter ablation of the accessory pathway.',
    },
    {
      prompt:
        'Does a pre-excitation ECG pattern without symptoms automatically equal WPW syndrome?',
      answer:
        'No. The syndrome requires manifest pre-excitation together with symptomatic tachyarrhythmia.',
    },
  ],
  references: [
    {
      citation:
        'European Society of Cardiology. Guidelines for the management of patients with supraventricular tachycardia.',
    },
    {
      citation:
        'American College of Cardiology, American Heart Association, and Heart Rhythm Society. Guideline for the Management of Adult Patients With Supraventricular Tachycardia.',
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
    throw new Error('Frontend reasoning must be stored as a string.');
  }

  const frontendReasoningSteps = explanation.reasoning
    .split(/\n+/)
    .map((step) => step.trim())
    .filter(Boolean);

  if (frontendReasoningSteps.length !== clues.length) {
    throw new Error(
      `Expected ${clues.length} frontend reasoning steps; received ${frontendReasoningSteps.length}.`,
    );
  }

  if (explanation.clueBreakdown.length !== clues.length) {
    throw new Error(
      `Expected ${clues.length} clue breakdown entries; received ${explanation.clueBreakdown.length}.`,
    );
  }

  explanation.clueBreakdown.forEach((entry, index) => {
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

    if (entry.explanation !== frontendReasoningSteps[index]) {
      throw new Error(
        `Clue breakdown explanation does not match frontend reasoning at order ${clue.order}.`,
      );
    }

    if (!entry.diagnosticContribution.trim()) {
      throw new Error(
        `Clue breakdown ${clue.order} has an empty diagnostic contribution.`,
      );
    }
  });

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
          `Differential evidence is not present in clue ${breakdown.clueOrder} for ${entry.diagnosis}: ${breakdown.evidence}.`,
        );
      }
    });
  });

  const educationText = normalizeClinicalText(
    JSON.stringify(educationForFrontend),
  );

  const caseSpecificEducationTerms = [
    '22 year old',
    'six months',
    '196 beats',
    '112 68',
    '6 mg',
    '90 ms',
    '132 ms',
    'left lateral',
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

  const relatedRegistry = exactRegistry
    ? null
    : await prisma.diagnosisRegistry.findFirst({
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

  const existing = exactRegistry ?? relatedRegistry;

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
          preferredClueTypes: ['history', 'symptom', 'vital', 'lab'],
          notes:
            'Seeded flagship Wolff-Parkinson-White syndrome case focused on paroxysmal AVRT, manifest ventricular pre-excitation, rhythm safety, and accessory-pathway ablation.',
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
          preferredClueTypes: ['history', 'symptom', 'vital', 'lab'],
          notes:
            'Seeded flagship Wolff-Parkinson-White syndrome case focused on paroxysmal AVRT, manifest ventricular pre-excitation, rhythm safety, and accessory-pathway ablation.',
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
      'Skipped diagnosis education because Wolff-Parkinson-White syndrome education already exists:',
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
        ? 'Skipped existing scheduled Wolff-Parkinson-White syndrome case.'
        : 'Skipped existing Wolff-Parkinson-White syndrome case to avoid overwriting authored content.',
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
      'Seeded complete frontend-aligned flagship Wolff-Parkinson-White syndrome case with six playable clues, AVRT mechanism, manifest pre-excitation, emergency rhythm safety, and independent diagnosis education.',
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
        'Created complete Wolff-Parkinson-White syndrome revision with exact clue-breakdown alignment, frontend-compatible reasoning, and electrophysiology-confirmed accessory-pathway teaching.',
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
      validatorVersion:
        'flagship-human-review:wolff-parkinson-white-syndrome-v1',
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        clueProgressionVerified: true,
        breakdownClueReferencesValidated: true,
        frontendReasoningCompatible: true,
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
        note: 'Complete Wolff-Parkinson-White syndrome flagship seed with six supported clue types, no early answer-label leakage, exact clue-to-breakdown alignment, ECG pre-excitation recognition, and accessory-pathway-confirmed AVRT.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded Wolff-Parkinson-White Syndrome:', {
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
