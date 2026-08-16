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
 * FLAGSHIP CASE SEED - Myasthenia Gravis
 *
 * Clinical focus:
 * - Fluctuating fatigable ocular, bulbar, neck, and proximal limb weakness.
 * - Symptoms worsen with activity and improve after rest.
 * - Pupils, sensation, reflexes, and central neurological signs are preserved.
 * - Repetitive nerve stimulation and acetylcholine-receptor antibodies confirm
 *   autoimmune neuromuscular-junction disease.
 * - Lambert-Eaton syndrome, botulism, brainstem stroke, multiple sclerosis,
 *   thyroid eye disease, and mitochondrial ophthalmoplegia are distinguished.
 *
 * Education design:
 * - Case explanation is specific to the vignette.
 * - Diagnosis education is independent of the case and covers presentation,
 *   diagnosis, genetic classification, emergencies, treatment principles,
 *   measurable residual disease, and common diagnostic traps.
 *
 * Safety:
 * - Reuses or creates the exact diagnosis registry and accepted aliases.
 * - Does not overwrite existing diagnosis education.
 * - Does not overwrite an existing case with the same title.
 * - Does not alter a scheduled DailyCase.
 *
 * Run:
 *   npx tsx prisma/seed/flagship-myasthenia-gravis.seed.ts
 *
 * Railway:
 *   railway run npx tsx prisma/seed/flagship-myasthenia-gravis.seed.ts
 */

const databaseUrl = resolvePgConnectionString(process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required to run the Myasthenia Gravis seed.',
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
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 6, 30, 12, 0, 0));
const seedVersion = 'flagship-myasthenia-gravis-v1';

const canonicalName = 'myasthenia gravis';
const displayLabel = 'Myasthenia Gravis';
const caseTitle = 'Fatigable Ptosis, Diplopia and Bulbar Weakness';

const taxonomy = {
  specialty: 'Neurology',
  subspecialty: 'Neuromuscular Medicine',
  category: 'Neuromuscular Junction Disorder',
  bodySystem: 'Nervous System',
  organSystem: 'Neuromuscular Junction',
} as const;

const aliasTerms = [
  'Myasthenia Gravis',
  'Autoimmune Myasthenia Gravis',
  'Generalized Myasthenia Gravis',
  'MG',
];

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 29-year-old woman reports an eight-week history of intermittent drooping of both upper eyelids and horizontal double vision. The symptoms are least noticeable on waking, become more obvious late in the day, worsen after prolonged reading or screen use, and improve after rest. She has no headache, eye pain, sensory symptoms, loss of consciousness, or previous neurological illness.',
  },
  {
    order: 1,
    type: 'symptom',
    value:
      'She has recently noticed that chewing tough food becomes difficult toward the end of a meal, her voice becomes soft and nasal after prolonged conversation, and her arms tire while washing or arranging her hair. The weakness fluctuates and improves after rest. She has no dry mouth, constipation, orthostatic dizziness, diarrhoeal illness, recent home-preserved food exposure, or limb numbness.',
  },
  {
    order: 2,
    type: 'exam',
    value:
      'She is alert with normal temperature, pulse, blood pressure, respiratory rate, and oxygen saturation. There is asymmetric bilateral ptosis that becomes more pronounced after 60 seconds of sustained upgaze, variable limitation of eye movements, and a positive Cogan lid-twitch sign. The pupils are equal and reactive, and there is no proptosis, lid retraction, or fixed restriction of an extraocular movement.',
  },
  {
    order: 3,
    type: 'exam',
    value:
      'Repeated shoulder abduction produces progressive proximal arm weakness, sustained counting causes increasing nasal speech, and neck flexion weakens with repetition. Limb power improves after a brief rest. Deep-tendon reflexes are normal throughout, plantar responses are flexor, and sensation, coordination, and sphincter function are normal. There is no limb ataxia, long-tract signs, sensory deficit, fasciculation, or muscle wasting.',
  },
  {
    order: 4,
    type: 'lab',
    value:
      'Repetitive nerve stimulation of the facial and spinal accessory nerves at 3 Hz shows a reproducible 14% decrement in compound muscle action-potential amplitude between the first and fourth responses. Routine sensory and motor nerve-conduction studies are normal, and serum creatine kinase is within the reference range.',
  },
  {
    order: 5,
    type: 'lab',
    value:
      'Serum acetylcholine-receptor binding antibodies are strongly positive, while muscle-specific kinase antibodies are negative. Thyroid-stimulating hormone and free thyroxine are normal. The fluctuating fatigable ocular, bulbar, neck, and proximal limb weakness with preserved pupils, sensation, and reflexes, a decremental response on repetitive stimulation, and disease-specific autoantibodies establishes Myasthenia Gravis. Chest imaging is required to assess the thymus.',
  },
] as const;

const differentials = [
  'Lambert-Eaton Myasthenic Syndrome',
  'Botulism',
  'Brainstem Stroke',
  'Multiple Sclerosis',
  'Thyroid Eye Disease',
  'Chronic Progressive External Ophthalmoplegia',
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
  'Daily fluctuation of ptosis and diplopia, worsening with sustained visual activity and improving after rest, indicates fatigable weakness rather than a fixed ocular-motor lesion.',
  'Fatigable chewing, nasal speech, and proximal arm weakness extend the process beyond the eyes and identify generalized involvement of skeletal muscles without sensory or autonomic symptoms.',
  'Objective worsening of ptosis with sustained upgaze, variable ophthalmoparesis, normal pupils, and absence of proptosis or fixed restriction strongly localize dysfunction to the neuromuscular junction.',
  'Reproducible proximal, neck, and bulbar fatigability with normal reflexes, sensation, coordination, and plantar responses supports a postsynaptic neuromuscular-junction disorder rather than neuropathy, myelopathy, or central nervous-system disease.',
  'A reproducible decrement on low-frequency repetitive nerve stimulation with normal routine nerve conduction and creatine kinase provides physiological evidence of impaired neuromuscular transmission rather than axonal neuropathy or primary myopathy.',
  'Strongly positive acetylcholine-receptor antibodies in the matching clinical and electrodiagnostic context confirms Myasthenia Gravis; thymic imaging and assessment of respiratory and bulbar severity guide subsequent management.',
] as const;

const explanation = {
  diagnosis: displayLabel,
  summary:
    'Fluctuating fatigable ocular, bulbar, neck, and proximal limb weakness that worsens with activity, improves with rest, spares pupils and sensation, produces a decremental response on repetitive nerve stimulation, and is accompanied by acetylcholine-receptor antibodies establishes Myasthenia Gravis.',
  reasoning: reasoningSteps.join('\n'),
  clueBreakdown: [
    {
      clueOrder: 0,
      clueType: 'history',
      clue: clues[0].value,
      explanation: reasoningSteps[0],
      diagnosticContribution:
        'Introduces a dynamic ocular-motor syndrome and establishes fatigability without naming its cause.',
    },
    {
      clueOrder: 1,
      clueType: 'symptom',
      clue: clues[1].value,
      explanation: reasoningSteps[1],
      diagnosticContribution:
        'Shows generalization to bulbar and proximal muscles while reducing autonomic, toxic, and sensory alternatives.',
    },
    {
      clueOrder: 2,
      clueType: 'exam',
      clue: clues[2].value,
      explanation: reasoningSteps[2],
      diagnosticContribution:
        'Demonstrates objective ocular fatigability and pupillary sparing, narrowing localization to the neuromuscular junction.',
    },
    {
      clueOrder: 3,
      clueType: 'exam',
      clue: clues[3].value,
      explanation: reasoningSteps[3],
      diagnosticContribution:
        'Confirms generalized fatigability and excludes major central, sensory, lower-motor-neuron, and presynaptic patterns.',
    },
    {
      clueOrder: 4,
      clueType: 'lab',
      clue: clues[4].value,
      explanation: reasoningSteps[4],
      diagnosticContribution:
        'Adds objective physiological evidence of defective neuromuscular transmission before serologic confirmation.',
    },
    {
      clueOrder: 5,
      clueType: 'lab',
      clue: clues[5].value,
      explanation: reasoningSteps[5],
      diagnosticContribution:
        'Establishes the canonical diagnosis and identifies the need for thymic and severity assessment.',
    },
  ],
  keyFindings: [
    'Fluctuating ptosis and diplopia',
    'Symptoms worsen with sustained activity',
    'Improvement after rest',
    'Fatigable chewing and nasal speech',
    'Proximal arm and neck weakness',
    'Objective worsening with sustained upgaze',
    'Cogan lid-twitch sign',
    'Pupils equal and reactive',
    'Normal sensation and coordination',
    'Normal deep-tendon reflexes',
    'No autonomic symptoms',
    'Normal routine nerve conduction',
    'Normal creatine kinase',
    'Decrement on repetitive nerve stimulation',
    'Positive acetylcholine-receptor antibodies',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Lambert-Eaton Myasthenic Syndrome',
      whyPlausibleEarly:
        'Lambert-Eaton syndrome also causes fatigable proximal weakness from impaired neuromuscular transmission.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'no dry mouth, constipation, orthostatic dizziness',
          reason:
            'Prominent autonomic symptoms are common in Lambert-Eaton syndrome but absent here.',
        },
        {
          clueOrder: 3,
          evidence: 'Deep-tendon reflexes are normal throughout',
          reason:
            'Lambert-Eaton syndrome usually causes reduced reflexes that may facilitate after exercise.',
        },
        {
          clueOrder: 5,
          evidence:
            'acetylcholine-receptor binding antibodies are strongly positive',
          reason:
            'Disease-specific postsynaptic antibodies support Myasthenia Gravis rather than a presynaptic calcium-channel disorder.',
        },
      ],
      finalReasonLessLikely:
        'Normal reflexes, absent autonomic symptoms, prominent ocular-bulbar involvement, and AChR antibodies favour Myasthenia Gravis.',
    },
    {
      diagnosis: 'Botulism',
      whyPlausibleEarly:
        'Botulism can produce diplopia, ptosis, bulbar weakness, and descending paralysis.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence:
            'no dry mouth, constipation, orthostatic dizziness, diarrhoeal illness, recent home-preserved food exposure',
          reason:
            'The toxic exposure and autonomic or gastrointestinal pattern expected in botulism is absent.',
        },
        {
          clueOrder: 2,
          evidence: 'The pupils are equal and reactive',
          reason:
            'Pupillary dysfunction is common in botulism but pupils are spared in typical autoimmune Myasthenia Gravis.',
        },
      ],
      finalReasonLessLikely:
        'The chronic fluctuating course, reactive pupils, absent autonomic syndrome, and AChR antibodies exclude botulism.',
    },
    {
      diagnosis: 'Brainstem Stroke',
      whyPlausibleEarly:
        'A brainstem lesion may produce diplopia, dysarthria, dysphagia, and limb weakness.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence: 'eight-week history',
          reason:
            'Stroke usually begins abruptly rather than fluctuating over several weeks with rest-related recovery.',
        },
        {
          clueOrder: 3,
          evidence: 'no limb ataxia, long-tract signs, sensory deficit',
          reason:
            'A structural brainstem lesion commonly produces additional central neurological signs.',
        },
      ],
      finalReasonLessLikely:
        'The temporal fluctuation, fatigability, normal central examination, decremental response, and antibodies do not fit stroke.',
    },
    {
      diagnosis: 'Multiple Sclerosis',
      whyPlausibleEarly:
        'Multiple sclerosis may cause diplopia and other brainstem symptoms in a young adult.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'The weakness fluctuates and improves after rest',
          reason:
            'Minute-to-hour fatigability with rest recovery is characteristic of neuromuscular transmission failure rather than a demyelinating relapse.',
        },
        {
          clueOrder: 3,
          evidence:
            'plantar responses are flexor, and sensation, coordination, and sphincter function are normal',
          reason:
            'There are no upper-motor-neuron, sensory, cerebellar, or sphincter findings to support central demyelination.',
        },
      ],
      finalReasonLessLikely:
        'The isolated fatigable motor syndrome with normal central neurological findings and AChR antibodies favours Myasthenia Gravis.',
    },
    {
      diagnosis: 'Thyroid Eye Disease',
      whyPlausibleEarly:
        'Thyroid eye disease can cause diplopia, eyelid abnormalities, and extraocular movement limitation.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence:
            'no proptosis, lid retraction, or fixed restriction of an extraocular movement',
          reason:
            'Thyroid orbitopathy typically causes orbital signs and restrictive rather than fluctuating ophthalmoparesis.',
        },
        {
          clueOrder: 5,
          evidence: 'Thyroid-stimulating hormone and free thyroxine are normal',
          reason:
            'Normal thyroid testing does not absolutely exclude euthyroid orbitopathy, but the complete clinical pattern strongly supports another diagnosis.',
        },
      ],
      finalReasonLessLikely:
        'Fatigability, rest response, pupillary sparing, absent orbital signs, and neuromuscular testing favour Myasthenia Gravis.',
    },
    {
      diagnosis: 'Chronic Progressive External Ophthalmoplegia',
      whyPlausibleEarly:
        'Mitochondrial external ophthalmoplegia can produce bilateral ptosis and impaired eye movements.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence:
            'worsen after prolonged reading or screen use, and improve after rest',
          reason:
            'Mitochondrial ophthalmoplegia is usually slowly progressive and relatively fixed rather than markedly fluctuating.',
        },
        {
          clueOrder: 4,
          evidence: '14% decrement',
          reason:
            'A reproducible decrement supports neuromuscular-junction transmission failure rather than a primary mitochondrial ophthalmoplegia.',
        },
      ],
      finalReasonLessLikely:
        'Marked fatigability, bulbar involvement, decremental physiology, and AChR antibodies establish an autoimmune junction disorder.',
    },
  ] satisfies DifferentialAnalysisEntry[],
  managementPearl:
    'Assess bulbar and respiratory function whenever weakness is generalized. Treat impending or established crisis as an emergency, avoid medicines that may worsen neuromuscular transmission when alternatives exist, use symptomatic and immunomodulatory treatment according to severity and antibody phenotype, and evaluate the thymus in confirmed disease.',
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
      'Fluctuating fatigable weakness that improves with rest is the central recognition pattern',
      'Ocular symptoms are common and may generalize to bulbar, neck, respiratory, and limb muscles',
      'Pupils and sensation are normally spared',
      'Normal reflexes help distinguish Myasthenia Gravis from Lambert-Eaton syndrome',
      'Repetitive nerve stimulation and single-fiber electromyography assess neuromuscular transmission',
      'AChR, MuSK, and selected LRP4 antibody testing supports diagnosis and phenotype definition',
      'Every confirmed patient requires thymic assessment',
      'Bulbar or respiratory deterioration requires urgent crisis assessment',
    ],
    competencyDomains: [
      'Neurology',
      'Neuromuscular Medicine',
      'Neuro-ophthalmology',
      'Electrodiagnostic Medicine',
      'Emergency Neurology',
      'Clinical Reasoning',
    ],
  },
};

const educationForFrontend = {
  title: displayLabel,
  summary: {
    definition:
      'Myasthenia Gravis is an autoimmune postsynaptic neuromuscular-junction disorder in which antibodies impair transmission, most commonly by targeting the acetylcholine receptor and less often MuSK or other junctional proteins.',
    highYieldTakeaway:
      'Suspect Myasthenia Gravis when weakness fluctuates, worsens with repeated activity, improves with rest, preferentially affects ocular, bulbar, neck, respiratory, or proximal limb muscles, and occurs without sensory loss or pupillary dysfunction.',
  },
  recognitionPattern: [
    {
      pattern: 'Fluctuating fatigable weakness',
      whyItMatters:
        'Variation during the day and worsening with repeated activation are more informative than weakness measured at one moment.',
      progression:
        'Reduced postsynaptic safety margin -> repeated activation exhausts effective transmission -> weakness becomes more obvious -> rest allows partial recovery.',
      discriminator:
        'Fixed weakness, sensory loss, or a clear upper-motor-neuron pattern suggests an alternative localization.',
      commonTrap:
        'Do not dismiss the disorder because strength appears normal early in an examination; test sustained and repeated activity safely.',
    },
    {
      pattern: 'Ocular-predominant presentation',
      whyItMatters:
        'Ptosis and diplopia are frequent initial manifestations and may remain ocular or precede generalized disease.',
      progression:
        'Variable extraocular and levator weakness -> asymmetric ptosis or changing diplopia -> worsening with sustained gaze.',
      discriminator:
        'Pupillary responses remain normal, and eye-movement limitation is variable rather than mechanically fixed.',
      commonTrap:
        'A normal scan does not exclude a neuromuscular-junction disorder, and isolated ocular disease may be antibody-negative on standard assays.',
    },
    {
      pattern: 'Bulbar, neck, respiratory, and proximal involvement',
      whyItMatters:
        'Chewing fatigue, dysarthria, dysphagia, weak neck flexion, weak cough, and breathlessness identify generalized disease and possible crisis risk.',
      progression:
        'Increasing junctional failure -> reduced airway protection and ventilatory muscle strength -> aspiration or respiratory failure if severe.',
      discriminator:
        'Sensation remains intact and weakness is not explained by pain, ataxia, or spasticity.',
      commonTrap:
        'Do not rely on oxygen saturation alone to exclude ventilatory failure; assess respiratory mechanics and clinical trajectory.',
    },
    {
      pattern: 'Postsynaptic rather than presynaptic junction failure',
      whyItMatters:
        'Recognizing the postsynaptic pattern separates Myasthenia Gravis from Lambert-Eaton syndrome and botulism.',
      progression:
        'Postsynaptic receptor dysfunction -> prominent ocular and bulbar fatigability -> reflexes generally preserved -> no primary autonomic syndrome.',
      discriminator:
        'Reduced reflexes, autonomic symptoms, and facilitation after exercise suggest a presynaptic disorder.',
      commonTrap:
        'Do not use one feature in isolation; integrate reflexes, autonomic symptoms, electrophysiology, and antibodies.',
    },
  ],
  keySymptoms: [
    {
      symptom: 'Ptosis',
      significance:
        'May be unilateral or bilateral, asymmetric, and variable during sustained upgaze or across the day.',
    },
    {
      symptom: 'Diplopia',
      significance:
        'Variable extraocular weakness may mimic individual cranial-nerve palsies but changes with fatigue and examination.',
    },
    {
      symptom: 'Bulbar fatigability',
      significance:
        'Chewing fatigue, nasal speech, dysarthria, dysphagia, and weak cough indicate generalized disease and aspiration risk.',
    },
    {
      symptom: 'Neck and proximal limb weakness',
      significance:
        'Difficulty holding the head up, climbing stairs, lifting the arms, or sustaining activity is common in generalized disease.',
    },
    {
      symptom: 'Breathlessness or orthopnoea',
      significance:
        'May indicate respiratory-muscle involvement and requires urgent assessment rather than routine outpatient review.',
    },
  ],
  keySigns: [
    {
      finding: 'Fatigable ptosis or ophthalmoparesis',
      significance:
        'Worsening with sustained gaze and improvement after rest supports impaired neuromuscular transmission.',
      discriminator:
        'Pupillary sparing and variability help separate the disorder from compressive third-nerve palsy and restrictive orbitopathy.',
    },
    {
      finding: 'Cogan lid-twitch sign',
      significance:
        'Transient overshoot of the upper eyelid after returning from downgaze may support ocular fatigability.',
      discriminator:
        'It is supportive rather than independently diagnostic and should be interpreted with the full pattern.',
    },
    {
      finding: 'Fatigable dysarthria or counting',
      significance:
        'Progressive nasal or slurred speech during sustained vocal effort demonstrates bulbar fatigability.',
      discriminator:
        'A fixed dysarthria with ataxia, sensory findings, or long-tract signs suggests central disease.',
    },
    {
      finding: 'Preserved pupils, sensation, and reflexes',
      significance:
        'These normal findings are central to localization at the postsynaptic neuromuscular junction.',
      discriminator:
        'Pupillary dysfunction suggests botulism or another autonomic process; reduced reflexes suggest Lambert-Eaton syndrome or neuropathy.',
    },
  ],
  examPearls: [
    {
      type: 'TECHNIQUE',
      title: 'Demonstrate fatigability safely',
      content:
        'Use sustained upgaze, repeated shoulder abduction, neck flexion, prolonged speech, or counting while observing for progressive weakness and recovery after rest.',
      whyItMatters:
        'Dynamic examination exposes transmission failure that may be absent during a brief static power assessment.',
      discriminator:
        'True fatigability is reproducible and anatomically consistent rather than limited by pain or poor effort.',
      trapAvoided:
        'Stop testing if bulbar or respiratory function is deteriorating; examination should not delay escalation.',
    },
    {
      type: 'OCULAR',
      title: 'Check pupils and orbital signs',
      content:
        'Assess pupils, proptosis, lid retraction, fixed extraocular restriction, and variability of ptosis or diplopia.',
      whyItMatters:
        'Pupillary sparing and absence of mechanical orbital signs refine ocular localization.',
      discriminator:
        'A dilated pupil, painful third-nerve palsy, or proptosis requires urgent evaluation for another cause.',
      trapAvoided:
        'Do not attribute every ptosis or diplopia syndrome to Myasthenia Gravis.',
    },
    {
      type: 'RESPIRATORY',
      title: 'Assess crisis risk directly',
      content:
        'Evaluate speech, swallowing, cough strength, secretion handling, respiratory rate, accessory-muscle use, neck flexion, forced vital capacity, and inspiratory strength when generalized weakness is present.',
      whyItMatters:
        'Respiratory decline can progress despite normal oxygen saturation until late.',
      discriminator:
        'Bulbar failure, weak cough, declining respiratory mechanics, or rapid progression requires monitored urgent care.',
      trapAvoided:
        'Do not reassure solely from pulse oximetry or the absence of cyanosis.',
    },
    {
      type: 'LOCALIZATION',
      title: 'Look for findings that should not be present',
      content:
        'Test sensation, reflexes, coordination, plantar responses, pupils, and autonomic function.',
      whyItMatters:
        'Unexpected abnormalities may reveal a central, peripheral-nerve, presynaptic, toxic, or mixed disorder.',
      discriminator:
        'Normal sensation and generally preserved reflexes support a postsynaptic junction disorder.',
      trapAvoided:
        'Do not force an atypical multisystem syndrome into a single-junction diagnosis.',
    },
  ],
  scoringSystems: [
    {
      name: 'MGFA Clinical Classification',
      purpose:
        'Describes ocular versus generalized disease and the predominant distribution and severity of weakness.',
      interpretation:
        'Class I is ocular-only disease; higher classes describe generalized weakness, with separate emphasis on limb or axial versus bulbar or respiratory involvement.',
      limitation:
        'It is a broad clinical classification and does not replace serial respiratory or functional assessment.',
    },
    {
      name: 'Myasthenia Gravis Activities of Daily Living profile',
      purpose:
        'Tracks patient-reported ocular, bulbar, respiratory, and limb impact over time.',
      interpretation:
        'Rising scores indicate greater functional burden and may help monitor response or deterioration.',
      limitation:
        'It complements but does not replace neurological examination, respiratory measurements, or crisis assessment.',
    },
  ],
  investigations: [
    {
      test: 'Acetylcholine-receptor antibodies',
      interpretation:
        'Binding antibodies are highly supportive in the correct clinical context; blocking and modulating assays may add information depending on laboratory practice.',
      whyItMatters:
        'AChR antibodies identify the most common autoimmune phenotype and influence thymectomy and treatment discussions.',
    },
    {
      test: 'MuSK and other antibody testing',
      interpretation:
        'MuSK testing is important when AChR antibodies are negative, especially with prominent bulbar, neck, or respiratory disease. Selected patients may undergo LRP4 or cell-based assays.',
      whyItMatters:
        'Seronegativity on one assay does not exclude the disease, and antibody phenotype can affect treatment response.',
    },
    {
      test: 'Repetitive nerve stimulation',
      interpretation:
        'A reproducible decrement with low-frequency stimulation supports impaired neuromuscular transmission. Testing clinically affected muscles improves yield.',
      whyItMatters:
        'It provides objective physiological confirmation and helps distinguish junctional weakness from many central or myopathic disorders.',
    },
    {
      test: 'Single-fiber electromyography',
      interpretation:
        'Increased jitter or blocking is highly sensitive for abnormal neuromuscular transmission but is not specific to one autoimmune diagnosis.',
      whyItMatters:
        'It is useful when routine testing and antibodies are unrevealing despite strong clinical suspicion.',
    },
    {
      test: 'Chest imaging',
      interpretation:
        'CT or MRI evaluates for thymoma and characterizes thymic tissue after diagnosis.',
      whyItMatters:
        'Thymoma requires surgical evaluation, and thymic status influences management in selected AChR-positive generalized disease.',
    },
    {
      test: 'Respiratory measurements',
      interpretation:
        'Serial forced vital capacity and inspiratory strength contribute to crisis assessment, but trends and bedside bulbar or respiratory findings are essential.',
      whyItMatters:
        'Early recognition of ventilatory failure enables monitored support before sudden decompensation.',
    },
    {
      test: 'Alternative-cause screening',
      interpretation:
        'Thyroid testing, creatine kinase, imaging, toxic or infectious evaluation, and other studies are selected according to the presentation.',
      whyItMatters:
        'Testing should confirm localization and exclude mimics rather than becoming an indiscriminate panel.',
    },
  ],
  differentialDistinguishers: [
    {
      diagnosis: 'Lambert-Eaton Myasthenic Syndrome',
      overlap: 'Proximal weakness and impaired neuromuscular transmission.',
      distinguishingFeatures:
        'Often has reduced reflexes, autonomic symptoms, relative ocular sparing, and facilitation after exercise or high-frequency stimulation.',
      decisiveClue:
        'Preserved reflexes, prominent ocular-bulbar fatigability, AChR antibodies, and a postsynaptic decrement pattern favour Myasthenia Gravis.',
    },
    {
      diagnosis: 'Botulism',
      overlap: 'Ptosis, diplopia, bulbar weakness, and descending paralysis.',
      distinguishingFeatures:
        'Acute toxic or foodborne setting, fixed or dilated pupils, autonomic dysfunction, and gastrointestinal symptoms may occur.',
      decisiveClue:
        'Reactive pupils, chronic fluctuation, no autonomic syndrome, and autoimmune testing argue against botulism.',
    },
    {
      diagnosis: 'Brainstem Disease',
      overlap: 'Diplopia, dysarthria, dysphagia, and weakness.',
      distinguishingFeatures:
        'Usually produces acute or fixed deficits with sensory, cerebellar, cranial-nerve, or long-tract abnormalities.',
      decisiveClue:
        'Pure fatigable motor weakness with rest recovery and normal central examination supports junctional disease.',
    },
    {
      diagnosis: 'Thyroid Eye Disease',
      overlap: 'Diplopia and eyelid abnormalities.',
      distinguishingFeatures:
        'Proptosis, lid retraction, orbital inflammation, and mechanically restricted eye movement are typical.',
      decisiveClue:
        'Variable fatigable ophthalmoparesis with no orbital signs favours Myasthenia Gravis.',
    },
    {
      diagnosis: 'Motor Neuron Disease',
      overlap: 'Bulbar, neck, and limb weakness.',
      distinguishingFeatures:
        'Progressive fixed weakness, atrophy, fasciculation, and upper- or lower-motor-neuron signs rather than ocular fatigability.',
      decisiveClue:
        'Ptosis, diplopia, normal bulk and reflex pattern, and decremental transmission argue against motor neuron disease.',
    },
    {
      diagnosis: 'Primary Myopathy',
      overlap: 'Proximal and neck weakness.',
      distinguishingFeatures:
        'Weakness is generally less fluctuating; creatine kinase, myopathic electromyography, rash, pain, or systemic findings may be present.',
      decisiveClue:
        'Ocular-bulbar fatigability, normal creatine kinase, and junctional electrophysiology support Myasthenia Gravis.',
    },
  ],
  managementOverview: [
    {
      step: 'Assess severity and crisis risk',
      rationale:
        'Bulbar or respiratory weakness, secretion difficulty, aspiration, rapid progression, or declining respiratory mechanics requires monitored urgent management.',
    },
    {
      step: 'Use symptomatic treatment when appropriate',
      rationale:
        'Acetylcholinesterase inhibition can improve transmission in many patients, but response varies and excessive dosing may worsen secretions or produce cholinergic effects.',
    },
    {
      step: 'Control autoimmune activity',
      rationale:
        'Corticosteroids and steroid-sparing immunotherapies are selected according to disease severity, phenotype, comorbidity, pregnancy considerations, and treatment response.',
    },
    {
      step: 'Treat significant exacerbation or crisis rapidly',
      rationale:
        'Plasma exchange or intravenous immunoglobulin provides short-term immunomodulation while airway, ventilation, infection, and precipitating factors are managed.',
    },
    {
      step: 'Evaluate the thymus',
      rationale:
        'Thymoma requires surgical evaluation; thymectomy may also benefit selected non-thymomatous AChR-positive generalized disease according to age, duration, and clinical context.',
    },
    {
      step: 'Review medicines and triggers',
      rationale:
        'Infection, surgery, pregnancy-related changes, treatment interruption, and medicines that impair neuromuscular transmission can precipitate worsening.',
    },
    {
      step: 'Monitor function and treatment toxicity',
      rationale:
        'Serial neurological, respiratory, functional, and laboratory assessment guides escalation, tapering, rehabilitation, vaccination, and complication prevention.',
    },
  ],
  complications: [
    'Myasthenic crisis with ventilatory failure',
    'Aspiration and aspiration pneumonia',
    'Malnutrition or dehydration from severe bulbar weakness',
    'Injury from diplopia or neck and limb weakness',
    'Treatment-related infection and metabolic complications',
    'Thymoma-associated disease',
    'Worsening triggered by infection, surgery, pregnancy-related change, or interacting medicines',
  ],
  pitfalls: [
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Relying on a single normal examination',
      content:
        'Weakness may fluctuate and appear minimal after rest or early in the day.',
      whyItMatters:
        'A brief static examination can miss a reproducible neuromuscular-junction disorder.',
      trapAvoided:
        'Use safe sustained or repeated tasks and document variability.',
    },
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Excluding disease after negative antibodies',
      content:
        'Standard antibody assays do not identify every patient, particularly in ocular or seronegative disease.',
      whyItMatters:
        'Premature exclusion delays electrodiagnostic testing and specialist review.',
      trapAvoided:
        'Use phenotype-directed MuSK, LRP4, cell-based, repetitive-stimulation, or single-fiber testing when appropriate.',
    },
    {
      type: 'SAFETY',
      title: 'Using oxygen saturation as the respiratory assessment',
      content:
        'Ventilatory muscle weakness may progress before oxygen saturation falls.',
      whyItMatters:
        'Late recognition increases the risk of emergency intubation and aspiration.',
      trapAvoided:
        'Assess bulbar function, cough, work of breathing, respiratory mechanics, and trend.',
    },
    {
      type: 'SAFETY',
      title: 'Missing bulbar deterioration',
      content:
        'Nasal speech, weak cough, choking, secretion pooling, and prolonged meals can precede respiratory failure.',
      whyItMatters:
        'Airway protection may fail even when limb weakness seems modest.',
      trapAvoided:
        'Escalate monitoring and swallowing or airway assessment when bulbar symptoms worsen.',
    },
    {
      type: 'TREATMENT',
      title: 'Ignoring medicines that worsen transmission',
      content:
        'Several antimicrobial, cardiac, anaesthetic, magnesium-containing, and neuromuscular-blocking medicines can worsen weakness in susceptible patients.',
      whyItMatters:
        'An avoidable medication exposure may precipitate severe deterioration.',
      trapAvoided:
        'Review current medicines and use specialist or pharmacy guidance rather than applying a memorized list without context.',
    },
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Assuming all diplopia is central or orbital',
      content:
        'Variable ophthalmoparesis can mimic individual cranial-nerve palsies or thyroid orbitopathy.',
      whyItMatters:
        'Failure to assess fatigability, pupils, and orbital signs may lead to incorrect localization.',
      trapAvoided:
        'Look for variability, rest response, pupillary sparing, and associated bulbar or proximal fatigability.',
    },
  ],
  recallPrompts: [
    {
      prompt: 'What is the core clinical pattern of Myasthenia Gravis?',
      answer:
        'Fluctuating fatigable skeletal-muscle weakness that worsens with repeated activity and improves with rest.',
    },
    {
      prompt: 'Which neurological functions are normally spared?',
      answer:
        'Sensation and pupils are spared, and deep-tendon reflexes are generally preserved.',
    },
    {
      prompt: 'Which muscle groups are commonly affected?',
      answer:
        'Extraocular, eyelid, bulbar, facial, neck, respiratory, and proximal limb muscles.',
    },
    {
      prompt: 'Which antibodies are tested first in many patients?',
      answer:
        'Acetylcholine-receptor antibodies, followed by MuSK and selected other assays when appropriate.',
    },
    {
      prompt:
        'What does low-frequency repetitive nerve stimulation demonstrate?',
      answer:
        'A reproducible decrement in compound muscle action-potential amplitude supporting impaired neuromuscular transmission.',
    },
    {
      prompt: 'Why is chest imaging performed after diagnosis?',
      answer:
        'To evaluate for thymoma and characterize thymic pathology relevant to management.',
    },
    {
      prompt: 'Which findings raise concern for myasthenic crisis?',
      answer:
        'Rapidly worsening bulbar or respiratory weakness, weak cough, secretion difficulty, aspiration, increased work of breathing, or declining respiratory mechanics.',
    },
    {
      prompt: 'How does Lambert-Eaton syndrome usually differ?',
      answer:
        'It more often causes reduced reflexes, autonomic symptoms, proximal leg weakness, and facilitation after exercise.',
    },
  ],
  references: [
    {
      citation:
        'Narayanaswami P, et al. International Consensus Guidance for Management of Myasthenia Gravis: 2020 Update. Neurology. 2021;96:114-122.',
    },
    {
      citation:
        'Sanders DB, et al. International Consensus Guidance for Management of Myasthenia Gravis: Executive Summary. Neurology. 2016;87:419-425.',
    },
    {
      citation:
        'Myasthenia Gravis Foundation of America. Diagnosing Myasthenia Gravis. Clinical education resource.',
    },
    {
      citation:
        'Myasthenia Gravis Foundation of America. Autoimmune Myasthenia Gravis. Clinical education resource.',
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
    '29 year old',
    'eight week',
    '60 seconds',
    '14 decrement',
    '3 hz',
    'this patient',
    'this case',
    'her eyelids',
    'her antibodies',
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
    ).includes('myasthenia')
  ) {
    throw new Error(
      `Cannot safely reuse registry ${aliasCandidate.id}: alias match belongs to ${aliasCandidate.displayLabel}.`,
    );
  }

  const existing = exactRegistry ?? aliasCandidate ?? null;

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
          preferredClueTypes: ['history', 'symptom', 'exam', 'lab'],
          notes:
            'Flagship Myasthenia Gravis registry entry focused on fluctuating fatigable weakness, ocular and bulbar involvement, preserved sensation and reflexes, electrodiagnostic confirmation, autoantibody testing, thymic assessment, and crisis recognition.',
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
          preferredClueTypes: ['history', 'symptom', 'exam', 'lab'],
          notes:
            'Flagship Myasthenia Gravis registry entry focused on fluctuating fatigable weakness, ocular and bulbar involvement, preserved sensation and reflexes, electrodiagnostic confirmation, autoantibody testing, thymic assessment, and crisis recognition.',
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
      'Skipped diagnosis education because Myasthenia Gravis education already exists:',
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
        ? 'Skipped existing scheduled Myasthenia Gravis case.'
        : 'Skipped existing Myasthenia Gravis case to avoid overwriting authored content.',
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
      'Seeded complete frontend-aligned flagship Myasthenia Gravis case with six supported clues, progressive neuromuscular-junction reasoning, exact clue breakdown alignment, electrodiagnostic and antibody confirmation, and diagnosis-level education independent of the vignette.',
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
        'Created complete Myasthenia Gravis revision with six validated clue types, exact clue-to-breakdown alignment, string-based frontend reasoning, neuromuscular-junction differential discrimination, and integrated electrodiagnostic and serologic confirmation.',
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
      validatorVersion: 'flagship-human-review:myasthenia-gravis-v1',
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
        note: 'Complete Myasthenia Gravis flagship seed with six supported clue types, no early diagnosis-label leakage, exact clue and reasoning alignment, evidence-anchored differential analysis, neuromuscular-junction confirmation, and independent diagnosis education.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded Myasthenia Gravis:', {
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
