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
 * FLAGSHIP CASE SEED - Post-Traumatic Stress Disorder
 *
 * Clinical focus:
 * - Non-graphic exposure to a serious road traffic collision.
 * - Progressive demonstration of intrusion, avoidance, negative cognition/mood,
 *   and arousal/reactivity symptoms lasting longer than one month.
 * - Functional impairment with exclusion of acute stress disorder, adjustment
 *   disorder, primary mood/anxiety disorders, intoxication, and traumatic brain injury.
 * - The final clue confirms a DSM-5-TR-consistent Post-Traumatic Stress Disorder diagnosis.
 *
 * Education design:
 * - Case explanation is specific to the vignette.
 * - Diagnosis education is independent of the vignette and covers diagnostic clusters,
 *   assessment, differential diagnosis, trauma-informed examination, psychotherapy,
 *   medication principles, comorbidity, risk assessment, and follow-up.
 *
 * Safety:
 * - Reuses or creates the exact diagnosis registry and accepted aliases.
 * - Does not overwrite existing diagnosis education.
 * - Does not overwrite an existing case with the same title.
 * - Does not alter a scheduled DailyCase.
 *
 * Run:
 *   npx tsx prisma/seed/flagship-post-traumatic-stress-disorder.seed.ts
 *
 * Railway:
 *   railway run npx tsx prisma/seed/flagship-post-traumatic-stress-disorder.seed.ts
 */

const databaseUrl = resolvePgConnectionString(process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required to run the Post-Traumatic Stress Disorder seed.',
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
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 7, 13, 12, 0, 0));
const seedVersion = 'flagship-post-traumatic-stress-disorder-v1';

const canonicalName = 'post-traumatic stress disorder';
const displayLabel = 'Post-Traumatic Stress Disorder';
const caseTitle = 'Persistent Trauma Memories, Avoidance and Hyperarousal';

const taxonomy = {
  specialty: 'Psychiatry',
  subspecialty: 'Trauma- and Stressor-Related Disorders',
  category: 'Trauma-Related Disorder',
  bodySystem: 'Psychiatric',
  organSystem: 'Brain',
} as const;

const aliasTerms = [
  'Post-Traumatic Stress Disorder',
  'Posttraumatic Stress Disorder',
  'PTSD',
  'Post-Traumatic Stress Syndrome',
];

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 29-year-old teacher survived a high-speed road traffic collision four months ago in which another passenger sustained life-threatening injuries. She was medically assessed at the time and had no loss of consciousness, focal neurological deficit, or ongoing physical injury. Before the collision she had no psychiatric diagnosis, problematic substance use, or similar symptoms.',
  },
  {
    order: 1,
    type: 'symptom',
    value:
      'Several times each week she has unwanted vivid memories of the collision and distressing dreams related to it. Sudden braking sounds or the smell of petrol trigger intense fear, sweating, palpitations, and a sense that the event is happening again, although she remains aware of her current surroundings.',
  },
  {
    order: 2,
    type: 'history',
    value:
      'She avoids driving, refuses to use the road where the collision occurred, changes the subject when relatives mention it, and has stopped attending gatherings where the other passengers may be present. These avoidance behaviours have persisted rather than gradually resolving.',
  },
  {
    order: 3,
    type: 'symptom',
    value:
      'She describes persistent guilt about surviving, diminished interest in previously enjoyed activities, emotional detachment from family, poor concentration, irritability, exaggerated startle, hypervigilance in traffic, and fragmented sleep. The symptoms have reduced her teaching performance and caused repeated absence from work.',
  },
  {
    order: 4,
    type: 'exam',
    value:
      'Mental-state examination shows an anxious but alert and fully oriented patient with coherent speech, intact attention during the interview, and no hallucinations, delusions, elevated mood, pressured speech, or formal thought disorder. Neurological examination is normal. She becomes visibly distressed when discussing reminders but can distinguish memories from present reality.',
  },
  {
    order: 5,
    type: 'lab',
    value:
      'A structured diagnostic interview confirms exposure to threatened death or serious injury, recurrent intrusion symptoms, active avoidance, multiple negative cognition and mood changes, and several arousal and reactivity symptoms. The disturbance has lasted four months, causes clinically significant occupational and social impairment, and is not attributable to a substance, medication, or medical condition. These findings establish Post-Traumatic Stress Disorder.',
  },
] as const;

const differentials = [
  'Acute Stress Disorder',
  'Adjustment Disorder',
  'Major Depressive Disorder',
  'Generalized Anxiety Disorder',
  'Panic Disorder',
  'Traumatic Brain Injury',
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
  'Exposure to a serious collision involving threatened death or serious injury establishes an eligible traumatic stressor and provides the necessary context for a trauma-related disorder.',
  'Recurrent involuntary memories, trauma-related dreams, cue-triggered physiological distress, and reliving-like experiences establish the intrusion cluster rather than nonspecific anxiety alone.',
  'Persistent avoidance of external reminders and conversations demonstrates an active avoidance cluster, helping distinguish the condition from unavoidable sadness or isolated fear.',
  'Guilt, loss of interest, detachment, hypervigilance, startle, irritability, concentration difficulty, and disturbed sleep show both negative cognition/mood and arousal/reactivity clusters with meaningful functional impairment.',
  'Preserved orientation, coherent thought, intact reality testing, and a normal neurological examination reduce delirium, psychosis, mania, and ongoing neurological injury as primary explanations.',
  'A structured interview confirms all required symptom clusters, duration beyond one month, impairment, and exclusion of substance or medical causes, establishing Post-Traumatic Stress Disorder.',
] as const;

const explanation = {
  diagnosis: displayLabel,
  summary:
    'Following a qualifying traumatic event, the patient developed persistent intrusion symptoms, active avoidance, negative alterations in cognition and mood, and hyperarousal for longer than one month with occupational and social impairment, supporting Post-Traumatic Stress Disorder.',
  reasoning: reasoningSteps.join('\n'),
  clueBreakdown: [
    {
      clueOrder: 0,
      clueType: 'history',
      clue: clues[0].value,
      explanation: reasoningSteps[0],
      diagnosticContribution:
        'Establishes a qualifying traumatic exposure and a clear pre-event baseline without revealing the final diagnosis.',
    },
    {
      clueOrder: 1,
      clueType: 'symptom',
      clue: clues[1].value,
      explanation: reasoningSteps[1],
      diagnosticContribution:
        'Demonstrates multiple intrusion phenomena and physiological reactivity to trauma reminders.',
    },
    {
      clueOrder: 2,
      clueType: 'history',
      clue: clues[2].value,
      explanation: reasoningSteps[2],
      diagnosticContribution:
        'Adds persistent behavioural and cognitive avoidance of trauma-associated reminders.',
    },
    {
      clueOrder: 3,
      clueType: 'symptom',
      clue: clues[3].value,
      explanation: reasoningSteps[3],
      diagnosticContribution:
        'Completes the negative cognition/mood and arousal/reactivity clusters and documents impairment.',
    },
    {
      clueOrder: 4,
      clueType: 'exam',
      clue: clues[4].value,
      explanation: reasoningSteps[4],
      diagnosticContribution:
        'Uses mental-state and neurological findings to reduce important psychiatric and neurological mimics.',
    },
    {
      clueOrder: 5,
      clueType: 'lab',
      clue: clues[5].value,
      explanation: reasoningSteps[5],
      diagnosticContribution:
        'Confirms the full diagnostic pattern, duration, impairment, and exclusion requirements.',
    },
  ],
  keyFindings: [
    'Exposure to threatened death or serious injury',
    'Recurrent involuntary trauma memories',
    'Trauma-related distressing dreams',
    'Intense distress and physiological reactivity to reminders',
    'Avoidance of trauma-related places and conversations',
    'Persistent guilt and negative beliefs',
    'Loss of interest and emotional detachment',
    'Hypervigilance and exaggerated startle',
    'Irritability, poor concentration, and sleep disturbance',
    'Symptoms lasting longer than one month',
    'Occupational and social impairment',
    'Preserved orientation and reality testing',
    'No primary neurological explanation',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Acute Stress Disorder',
      whyPlausibleEarly:
        'Acute stress disorder can produce intrusion, avoidance, negative mood, dissociation, and arousal after a qualifying traumatic event.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence: 'four months ago',
          reason:
            'The traumatic event occurred well beyond the acute post-trauma diagnostic window.',
        },
        {
          clueOrder: 5,
          evidence: 'disturbance has lasted four months',
          reason:
            'Persistence beyond one month supports PTSD rather than acute stress disorder.',
        },
      ],
      finalReasonLessLikely:
        'The duration exceeds the acute stress disorder period and satisfies the longer-duration requirement for PTSD.',
    },
    {
      diagnosis: 'Adjustment Disorder',
      whyPlausibleEarly:
        'Adjustment disorder may follow a stressful event and cause anxiety, low mood, avoidance, and impaired functioning.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'unwanted vivid memories',
          reason:
            'Prominent trauma-specific intrusion symptoms are more characteristic of PTSD than adjustment disorder.',
        },
        {
          clueOrder: 2,
          evidence: 'avoids driving',
          reason:
            'Persistent trauma-linked avoidance forms a core diagnostic cluster rather than a nonspecific stress response.',
        },
      ],
      finalReasonLessLikely:
        'The patient meets the full trauma-specific symptom-cluster pattern, so adjustment disorder should not be used as a residual label.',
    },
    {
      diagnosis: 'Major Depressive Disorder',
      whyPlausibleEarly:
        'Guilt, loss of interest, withdrawal, poor concentration, sleep disturbance, and impaired work performance can occur in major depression.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'distressing dreams related to it',
          reason:
            'Trauma-specific intrusion and reliving phenomena are not explained by depression alone.',
        },
        {
          clueOrder: 2,
          evidence: 'changes the subject when relatives mention it',
          reason:
            'Active avoidance of trauma-related thoughts and reminders supports a trauma-related disorder.',
        },
      ],
      finalReasonLessLikely:
        'Depressive symptoms may coexist, but they do not account for the intrusion, avoidance, and hyperarousal clusters.',
    },
    {
      diagnosis: 'Generalized Anxiety Disorder',
      whyPlausibleEarly:
        'Generalized anxiety disorder may cause sleep disturbance, irritability, poor concentration, and persistent apprehension.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'sense that the event is happening again',
          reason:
            'Reliving-like episodes linked to a specific trauma are not typical of generalized worry.',
        },
        {
          clueOrder: 2,
          evidence: 'road where the collision occurred',
          reason:
            'Avoidance is specifically linked to trauma reminders rather than multiple everyday domains of worry.',
        },
      ],
      finalReasonLessLikely:
        'The anxiety is organized around a qualifying trauma and accompanied by intrusion and avoidance clusters.',
    },
    {
      diagnosis: 'Panic Disorder',
      whyPlausibleEarly:
        'Cue-triggered palpitations, sweating, and intense fear can resemble panic attacks.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence:
            'Sudden braking sounds or the smell of petrol trigger intense fear',
          reason:
            'The attacks are consistently linked to trauma reminders rather than recurrent unexpected panic attacks.',
        },
        {
          clueOrder: 3,
          evidence: 'hypervigilance in traffic',
          reason:
            'Persistent trauma-related hyperarousal extends beyond discrete panic episodes.',
        },
      ],
      finalReasonLessLikely:
        'Panic symptoms occur as part of cue-triggered trauma reactivity rather than a primary unexpected-panic syndrome.',
    },
    {
      diagnosis: 'Traumatic Brain Injury',
      whyPlausibleEarly:
        'A road collision can produce cognitive, emotional, sleep, and concentration symptoms after head injury.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence:
            'no loss of consciousness, focal neurological deficit, or ongoing physical injury',
          reason:
            'The initial history does not support significant traumatic brain injury.',
        },
        {
          clueOrder: 4,
          evidence: 'Neurological examination is normal',
          reason:
            'No current focal neurological abnormality is identified, while the symptoms form a trauma-specific psychiatric pattern.',
        },
      ],
      finalReasonLessLikely:
        'A primary post-traumatic neurological syndrome does not explain the organized intrusion, avoidance, cognition/mood, and arousal clusters.',
    },
  ],
  managementPearl:
    'Use a trauma-informed assessment that confirms symptom clusters, duration, impairment, comorbidity, and safety. Trauma-focused psychotherapy is central; medication may be added according to severity, preference, comorbidity, and access. Avoid forcing detailed recounting before stabilization and consent.',
  generationQuality: {
    contentTier: 'FLAGSHIP',
    seedVersion,
    humanReviewed: true,
    discriminatorStrength: 'HIGH',
    expectedTeachingPoints: [
      'PTSD requires exposure to a qualifying traumatic event',
      'The four symptom clusters are intrusion, avoidance, negative cognition or mood, and arousal or reactivity',
      'Symptoms must persist longer than one month and cause significant distress or impairment',
      'Acute stress disorder is distinguished principally by the earlier post-trauma timeframe',
      'Trauma-focused psychotherapy is a core evidence-based treatment',
    ],
    competencyDomains: [
      'Psychiatry',
      'Trauma- and Stressor-Related Disorders',
      'Mental State Examination',
      'Differential Diagnosis',
      'Trauma-Informed Care',
    ],
  },
};

const educationForFrontend = {
  title: displayLabel,
  summary: {
    definition:
      'Post-Traumatic Stress Disorder is a trauma- and stressor-related disorder that follows exposure to actual or threatened death, serious injury, or sexual violence and is characterized by persistent intrusion, avoidance, negative cognition or mood, and arousal or reactivity symptoms with impairment.',
    highYieldTakeaway:
      'Diagnose PTSD only when a qualifying trauma is followed by the required symptom clusters for longer than one month, with clinically significant distress or functional impairment and no better substance, medical, or psychiatric explanation.',
  },
  recognitionPattern: [
    {
      pattern: 'Trauma exposure followed by four symptom clusters',
      whyItMatters:
        'The diagnosis depends on both the nature of the exposure and the pattern of subsequent symptoms.',
      progression:
        'Qualifying trauma -> intrusive re-experiencing -> avoidance -> negative cognition or mood changes -> persistent hyperarousal and impairment.',
      discriminator:
        'The organized trauma-specific cluster pattern separates PTSD from nonspecific anxiety, depression, grief, or adjustment reactions.',
      commonTrap:
        'Do not diagnose PTSD from trauma exposure alone; many people experience trauma without developing the disorder.',
    },
    {
      pattern: 'Symptoms persist beyond one month',
      whyItMatters:
        'Duration distinguishes PTSD from acute stress disorder and from transient early stress responses.',
      progression:
        'Early post-trauma symptoms -> persistence beyond one month -> sustained distress or functional impairment.',
      discriminator:
        'Acute stress disorder occurs from three days to one month after trauma, whereas PTSD requires longer persistence.',
      commonTrap:
        'Do not label symptoms within the first few days as either acute stress disorder or PTSD without meeting the relevant duration threshold.',
    },
    {
      pattern: 'Trauma reminders trigger distress and avoidance',
      whyItMatters:
        'Cues can provoke vivid memories, physiological arousal, dissociation, or behavioural restriction.',
      progression:
        'Reminder -> intrusion or distress -> avoidance -> short-term relief -> longer-term maintenance of fear and impairment.',
      discriminator:
        'The symptoms are linked to the traumatic event rather than being free-floating or unexpected.',
      commonTrap:
        'Do not mistake avoidance for recovery; severe avoidance can conceal symptom burden while narrowing daily life.',
    },
    {
      pattern: 'Comorbidity is common',
      whyItMatters:
        'Depression, anxiety, substance-use disorders, sleep disorders, chronic pain, and dissociative symptoms may coexist.',
      progression:
        'Trauma-related symptoms -> impaired sleep and functioning -> secondary mood, anxiety, substance, or physical-health problems.',
      discriminator:
        'Comorbidity should be diagnosed separately when its criteria are met rather than assumed to be part of PTSD.',
      commonTrap:
        'Do not let one prominent symptom, such as depression or panic, obscure the full trauma-related pattern.',
    },
  ],
  keySymptoms: [
    {
      symptom: 'Intrusive memories, dreams, or reliving experiences',
      significance:
        'These are involuntary trauma-linked experiences rather than ordinary voluntary recollection.',
    },
    {
      symptom: 'Avoidance of thoughts, feelings, people, places, or activities',
      significance:
        'Avoidance may reduce immediate distress but maintain long-term symptoms and functional restriction.',
    },
    {
      symptom: 'Negative beliefs, guilt, detachment, or loss of interest',
      significance:
        'Persistent cognitive and emotional changes may resemble depression but remain linked to the traumatic event.',
    },
    {
      symptom:
        'Hypervigilance, exaggerated startle, irritability, and disturbed sleep',
      significance:
        'Persistent threat-system activation contributes to exhaustion, impaired concentration, and interpersonal difficulty.',
    },
    {
      symptom: 'Dissociative symptoms',
      significance:
        'Depersonalization or derealization may identify a dissociative subtype and influence assessment and treatment pacing.',
    },
  ],
  keySigns: [
    {
      finding: 'Distress or physiological reactivity to reminders',
      significance:
        'Observable anxiety, autonomic arousal, freezing, or dissociation during trauma reminders supports cue-linked reactivity.',
      discriminator:
        'The reaction should be interpreted within a broader symptom-cluster assessment, not as a stand-alone diagnostic sign.',
    },
    {
      finding: 'Avoidant interview behaviour',
      significance:
        'Reluctance to discuss or approach reminders may be clinically meaningful but may also reflect privacy, culture, shame, or lack of trust.',
      discriminator:
        'Use consent and trauma-informed pacing rather than confrontation.',
    },
    {
      finding: 'Preserved orientation and reality testing',
      significance:
        'Many patients remain fully oriented and recognize that memories or triggers relate to past events.',
      discriminator:
        'Persistent psychosis, delirium, mania, or focal neurological findings require additional diagnostic evaluation.',
    },
  ],
  examPearls: [
    {
      type: 'TRAUMA_INFORMED',
      title: 'Establish safety, choice, and consent',
      content:
        'Explain why questions are being asked, allow breaks, avoid unnecessary detail, and give the patient control over pacing whenever clinically safe.',
      whyItMatters:
        'A coercive or overly detailed interview may increase distress and reduce engagement.',
      discriminator:
        'Enough information is needed to establish exposure and symptom relationships without forcing a complete narrative.',
      trapAvoided:
        'Do not equate reluctance to disclose with absence of trauma or symptoms.',
    },
    {
      type: 'MENTAL_STATE',
      title: 'Assess the full mental state and functioning',
      content:
        'Document mood, anxiety, cognition, dissociation, psychosis, sleep, concentration, work or school function, relationships, and substance use.',
      whyItMatters:
        'The diagnosis requires impairment and commonly coexists with other psychiatric conditions.',
      discriminator:
        'Trauma-linked clusters should be distinguished from independent mood, anxiety, psychotic, neurological, and substance-related disorders.',
      trapAvoided: 'Do not rely only on a screening score.',
    },
    {
      type: 'SAFETY',
      title: 'Perform a proportionate safety assessment',
      content:
        "Assess acute risk, severe functional deterioration, domestic or environmental danger, substance use, and the patient's supports and protective factors.",
      whyItMatters:
        'Urgency and care setting depend on safety and function, not merely symptom count.',
      discriminator:
        'Immediate danger or inability to maintain basic safety requires urgent escalation.',
      trapAvoided:
        'Do not assume every trauma survivor has the same risk profile or treatment needs.',
    },
  ],
  scoringSystems: [
    {
      name: 'Clinician-Administered PTSD Scale for DSM-5 (CAPS-5)',
      purpose:
        'A structured clinician-administered interview assessing DSM-5 PTSD symptoms, duration, impairment, severity, and dissociative subtype.',
      interpretation:
        'It supports diagnostic assessment and severity tracking when administered by a trained clinician.',
      limitation:
        'It does not replace clinical judgement, assessment of comorbidity, or culturally informed interpretation.',
    },
    {
      name: 'PTSD Checklist for DSM-5 (PCL-5)',
      purpose:
        'A self-report measure used for screening, provisional assessment, and symptom monitoring.',
      interpretation:
        'Higher scores increase concern and can track change, but diagnosis requires clinical evaluation.',
      limitation:
        'Cut-points vary by setting and population, and a score alone cannot establish PTSD.',
    },
    {
      name: 'Primary Care PTSD Screen for DSM-5 (PC-PTSD-5)',
      purpose:
        'A brief primary-care screen for probable PTSD after trauma exposure.',
      interpretation:
        'A positive screen should lead to fuller diagnostic assessment.',
      limitation: 'It is not a diagnostic instrument.',
    },
  ],
  investigations: [
    {
      test: 'Structured clinical interview',
      interpretation:
        'Confirm the qualifying exposure, four symptom clusters, duration, distress or impairment, and exclusion criteria.',
      whyItMatters:
        'PTSD is a clinical diagnosis and requires more than a positive screening questionnaire.',
    },
    {
      test: 'Mental-state and functional assessment',
      interpretation:
        'Assess mood, anxiety, psychosis, cognition, dissociation, sleep, occupational or academic function, relationships, and daily activities.',
      whyItMatters:
        'Identifies severity, comorbidity, alternative explanations, and treatment priorities.',
    },
    {
      test: 'Targeted medical and neurological evaluation',
      interpretation:
        'Physical examination, laboratory testing, toxicology, or neuroimaging is guided by symptoms, medication exposure, head injury, substance use, and neurological findings.',
      whyItMatters:
        'There is no confirmatory laboratory test for PTSD; investigations are used to evaluate mimics and comorbidity.',
    },
    {
      test: 'Sleep and substance-use assessment',
      interpretation:
        'Evaluate insomnia, nightmares, sleep-disordered breathing, alcohol or drug use, and medication-related sleep effects.',
      whyItMatters:
        'Sleep and substance problems can worsen symptoms, impair treatment response, and require parallel management.',
    },
  ],
  differentialDistinguishers: [
    {
      diagnosis: 'Acute Stress Disorder',
      distinguishingFeatures:
        'Similar post-trauma symptoms occurring from three days to one month after exposure.',
      keyTestOrClue: 'Duration and timing relative to the traumatic event.',
    },
    {
      diagnosis: 'Adjustment Disorder',
      distinguishingFeatures:
        'Distress or impairment after a stressor without the full trauma-specific PTSD cluster pattern.',
      keyTestOrClue:
        'Absence of the required intrusion, avoidance, negative cognition/mood, and arousal combination.',
    },
    {
      diagnosis: 'Major Depressive Disorder',
      distinguishingFeatures:
        'Persistent depressed mood or anhedonia may occur without trauma-linked intrusion and avoidance.',
      keyTestOrClue:
        'Determine whether symptoms are trauma-specific and whether independent depressive criteria are met.',
    },
    {
      diagnosis: 'Panic Disorder',
      distinguishingFeatures:
        'Recurrent unexpected panic attacks and concern about further attacks rather than episodes consistently triggered by trauma reminders.',
      keyTestOrClue:
        'Unexpected versus cue-linked attacks and presence of the remaining PTSD clusters.',
    },
    {
      diagnosis: 'Traumatic Brain Injury',
      distinguishingFeatures:
        'Cognitive, emotional, sleep, and neurological symptoms following head trauma may overlap with PTSD.',
      keyTestOrClue:
        'Loss of consciousness, post-traumatic amnesia, neurological findings, injury chronology, and neurocognitive assessment.',
    },
    {
      diagnosis: 'Obsessive-Compulsive Disorder',
      distinguishingFeatures:
        'Intrusive thoughts and rituals are not necessarily memories of a qualifying traumatic event and are typically linked to compulsive neutralization.',
      keyTestOrClue:
        'Differentiate trauma memories and reminder avoidance from obsessions and compulsions.',
    },
  ],
  managementOverview: [
    {
      phase: 'Initial assessment and engagement',
      actions: [
        'Provide trauma-informed explanation and collaborative formulation',
        'Assess safety, current danger, function, comorbidity, sleep, and substance use',
        'Address urgent medical, social, housing, or safeguarding needs',
        'Agree on treatment priorities and patient preferences',
      ],
      rationale:
        'Safety, trust, and practical stability improve treatment engagement and allow appropriate selection of therapy intensity.',
    },
    {
      phase: 'Trauma-focused psychotherapy',
      actions: [
        'Offer an evidence-based trauma-focused treatment delivered by a trained clinician',
        'Common approaches include prolonged exposure, cognitive processing therapy, and trauma-focused cognitive behavioural therapy',
        'Eye movement desensitization and reprocessing is another evidence-based trauma-focused option',
        'Monitor symptoms, avoidance, functioning, engagement, and adverse effects',
      ],
      rationale:
        'Trauma-focused psychotherapies directly address maladaptive trauma memories, beliefs, avoidance, and threat responses.',
    },
    {
      phase: 'Medication when indicated',
      actions: [
        'Consider an evidence-supported antidepressant when medication is preferred, psychotherapy is unavailable, or comorbidity warrants it',
        'Discuss expected benefits, adverse effects, interactions, and adherence',
        'Avoid routine benzodiazepine treatment for core PTSD symptoms',
        'Reassess response and diagnosis rather than continuing ineffective treatment indefinitely',
      ],
      rationale:
        'Medication may reduce symptoms for some patients but should be individualized and integrated with psychological and social care.',
    },
    {
      phase: 'Follow-up and recovery',
      actions: [
        'Track symptoms and functional goals with clinical review and optional validated measures',
        'Treat comorbid depression, anxiety, sleep, pain, and substance-use problems',
        'Support graded return to valued activities, work, education, and relationships',
        'Develop a relapse and trigger-management plan',
      ],
      rationale:
        'Recovery includes restored function and quality of life, not only reduced symptom scores.',
    },
  ],
  complications: [
    {
      complication: 'Persistent occupational, academic, or social impairment',
      recognition:
        'Avoidance, poor sleep, concentration difficulty, irritability, and detachment progressively restrict daily life.',
      response:
        'Measure function explicitly and include graded rehabilitation and social support in the care plan.',
    },
    {
      complication: 'Depression and anxiety comorbidity',
      recognition:
        'Persistent low mood, anhedonia, generalized worry, panic, or severe guilt may meet additional diagnostic criteria.',
      response:
        'Assess and treat comorbid disorders rather than assuming all symptoms will resolve with one intervention.',
    },
    {
      complication: 'Substance-related harm',
      recognition:
        'Alcohol or drug use may be used to suppress memories, anxiety, or insomnia and can worsen function and treatment response.',
      response:
        'Use nonjudgmental screening and integrated treatment for both trauma symptoms and substance use.',
    },
    {
      complication: 'Chronic sleep disturbance',
      recognition:
        'Insomnia, nightmares, irregular sleep, and hypervigilance may persist independently of daytime symptom improvement.',
      response:
        'Assess sleep disorders and provide targeted behavioural and medical management.',
    },
  ],
  pitfalls: [
    {
      pitfall: 'Diagnosing PTSD from exposure alone',
      correction:
        'Confirm all required symptom clusters, duration, impairment, and exclusions.',
    },
    {
      pitfall: 'Forcing detailed trauma disclosure',
      correction:
        'Use trauma-informed consent and obtain only the detail needed for safe diagnosis and treatment planning.',
    },
    {
      pitfall: 'Using a screening score as the diagnosis',
      correction: 'Positive screens require a full clinical assessment.',
    },
    {
      pitfall: 'Missing acute stress disorder because timing is ignored',
      correction:
        'Always establish when the event occurred and how long symptoms have persisted.',
    },
    {
      pitfall: 'Attributing all symptoms to PTSD',
      correction:
        'Evaluate independent depression, anxiety, psychosis, neurological injury, substance use, sleep disorders, pain, and medical disease.',
    },
    {
      pitfall: 'Treating avoidance as a sign of recovery',
      correction:
        'Assess how much the person has restricted movement, relationships, work, and reminders to control distress.',
    },
  ],
  recallPrompts: [
    {
      prompt: 'What are the four DSM symptom clusters for PTSD?',
      answer:
        'Intrusion; avoidance; negative alterations in cognition and mood; and alterations in arousal and reactivity.',
    },
    {
      prompt: 'What duration separates PTSD from acute stress disorder?',
      answer:
        'PTSD requires persistence for longer than one month; acute stress disorder occurs from three days to one month after trauma.',
    },
    {
      prompt: 'Does a positive PCL-5 establish PTSD?',
      answer:
        'No. It is a screening and monitoring measure; diagnosis requires clinical assessment.',
    },
    {
      prompt: 'What is central to evidence-based treatment?',
      answer:
        'Trauma-focused psychotherapy delivered with informed consent, appropriate pacing, and attention to safety and comorbidity.',
    },
    {
      prompt: 'Why is functional assessment essential?',
      answer:
        'Clinically significant distress or impairment is part of the diagnosis and determines treatment urgency and recovery goals.',
    },
  ],
  references: [
    {
      citation:
        'American Psychiatric Association. Diagnostic and Statistical Manual of Mental Disorders, Fifth Edition, Text Revision. Posttraumatic Stress Disorder criteria.',
    },
    {
      citation:
        'U.S. Department of Veterans Affairs and Department of Defense. Clinical Practice Guideline for Management of Posttraumatic Stress Disorder and Acute Stress Disorder. 2023.',
    },
    {
      citation:
        'National Center for PTSD. Clinician-Administered PTSD Scale for DSM-5 (CAPS-5): assessment and diagnostic guidance.',
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
    'four months ago',
    'high speed road traffic collision',
    'another passenger',
    'teaching performance',
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
    ).includes('post-traumatic stress disorder')
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
          rarityBand: DiagnosisRarityBand.COMMON,
          clinicalSetting: DiagnosisClinicalSetting.OUTPATIENT,
          ageGroup: DiagnosisAgeGroup.ANY,
          urgencyLevel: DiagnosisUrgencyLevel.ROUTINE,
          preferredClueTypes: ['history', 'symptom', 'exam', 'lab'],
          notes:
            'Flagship Post-Traumatic Stress Disorder registry entry focused on qualifying trauma exposure, DSM-aligned symptom clusters, duration, functional impairment, trauma-informed assessment, differential diagnosis, and evidence-based treatment principles.',
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
          rarityBand: DiagnosisRarityBand.COMMON,
          clinicalSetting: DiagnosisClinicalSetting.OUTPATIENT,
          ageGroup: DiagnosisAgeGroup.ANY,
          urgencyLevel: DiagnosisUrgencyLevel.ROUTINE,
          preferredClueTypes: ['history', 'symptom', 'exam', 'lab'],
          notes:
            'Flagship Post-Traumatic Stress Disorder registry entry focused on qualifying trauma exposure, DSM-aligned symptom clusters, duration, functional impairment, trauma-informed assessment, differential diagnosis, and evidence-based treatment principles.',
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
      'Skipped diagnosis education because Post-Traumatic Stress Disorder education already exists:',
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
        ? 'Skipped existing scheduled Post-Traumatic Stress Disorder case.'
        : 'Skipped existing Post-Traumatic Stress Disorder case to avoid overwriting authored content.',
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
      'Seeded complete frontend-aligned flagship Post-Traumatic Stress Disorder case with six supported clues, progressive trauma-cluster reasoning, exact clue breakdown alignment, structured differential exclusion, DSM-aligned confirmation, and diagnosis-level education independent of the vignette.',
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
        'Created complete Post-Traumatic Stress Disorder revision with six validated clue types, exact clue-to-breakdown alignment, string-based frontend reasoning, evidence-anchored psychiatric and neurological differentials, and DSM-aligned diagnostic confirmation.',
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
        'flagship-human-review:post-traumatic-stress-disorder-v1',
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
          rarityBand: 'COMMON',
          clinicalSetting: 'OUTPATIENT',
          ageGroup: 'ANY',
          urgencyLevel: 'ROUTINE',
        },
        note: 'Complete Post-Traumatic Stress Disorder flagship seed with six supported clue types, no early diagnosis-label leakage, exact clue and reasoning alignment, evidence-anchored differential analysis, DSM-aligned duration and impairment confirmation, and independent diagnosis education.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded Post-Traumatic Stress Disorder:', {
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
