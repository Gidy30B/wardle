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
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { CaseEligibilityPolicyService } from '../../src/modules/cases/case-eligibility-policy.service';
import { CaseValidationService } from '../../src/modules/case-validation/case-validation.service';

const databaseUrl = resolvePgConnectionString(process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required to run the obsessive-compulsive disorder seed.',
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
const caseEligibilityPolicy = new CaseEligibilityPolicyService();
const caseValidationService = new CaseValidationService();

function resolvePgConnectionString(
  value: string | undefined,
): string | undefined {
  if (!value) return undefined;

  if (!value.startsWith('prisma+postgres://')) {
    return value;
  }

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
  reusableCaseId?: string;
  displayLabel: string;
}): Promise<Date> {
  for (let offset = 0; offset < 365; offset += 1) {
    const candidateDate = addUtcDays(params.preferredDate, offset);

    const owner = await prisma.case.findUnique({
      where: { date: candidateDate },
      select: {
        id: true,
        dailyCases: { select: { id: true }, take: 1 },
      },
    });

    if (!owner) return candidateDate;
    if (params.reusableCaseId && owner.id === params.reusableCaseId) {
      return candidateDate;
    }
  }

  throw new Error(
    `No free inventory placeholder date for ${params.displayLabel}.`,
  );
}

const now = new Date();
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 2, 1, 12, 0, 0));
const seedVersion = 'flagship-obsessive-compulsive-disorder-v1';

const canonicalName = 'obsessive-compulsive disorder';
const displayLabel = 'Obsessive-Compulsive Disorder';
const caseTitle =
  'Intrusive Doubts and Repetitive Checking in Obsessive-Compulsive Disorder';

const aliasTerms = ['Obsessive-Compulsive Disorder', 'OCD'];

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 24-year-old university student reports six months of repeatedly returning home to check the front door and electrical appliances, causing frequent lateness for classes.',
  },
  {
    order: 1,
    type: 'symptom',
    value:
      'The student experiences recurrent intrusive thoughts that the house may be burgled or destroyed by fire because something was left unsecured, despite remembering that each item was already checked.',
  },
  {
    order: 2,
    type: 'symptom',
    value:
      'To reduce the anxiety, the student checks every switch in a fixed sequence, photographs the appliances, and repeatedly pulls the door handle; the routine now occupies about two hours each day.',
  },
  {
    order: 3,
    type: 'history',
    value:
      'The thoughts are unwanted and distressing, and the student attempts to resist them, but anxiety increases until the checking ritual is completed; the relief is only temporary.',
  },
  {
    order: 4,
    type: 'exam',
    value:
      'Mental state examination shows an anxious but cooperative patient with organized speech and goal-directed thought; there are no hallucinations, formal thought disorder, or sustained manic or depressive symptoms.',
  },
  {
    order: 5,
    type: 'exam',
    value:
      'The student acknowledges that the feared outcomes are probably exaggerated but remains unable to dismiss them completely; a Yale-Brown Obsessive Compulsive Scale assessment gives a total score of 27.',
  },
] as const;

const differentials = [
  'Generalized Anxiety Disorder',
  'Delusional Disorder',
  'Obsessive-Compulsive Personality Disorder',
  'Major Depressive Disorder with Rumination',
  'Schizophrenia Spectrum Disorder',
];

const explanation = {
  diagnosis: displayLabel,
  summary:
    'Recurrent intrusive and unwanted doubts, repetitive checking performed to neutralize anxiety, temporary relief after the ritual, preserved thought organization, partial insight, and marked functional impairment support obsessive-compulsive disorder.',
  reasoning: [
    'Repeated checking that disrupts daily functioning suggests a pathological ritual rather than ordinary caution.',
    'Recurrent feared consequences that intrude despite memory of prior checking represent obsessional doubt.',
    'A fixed checking sequence performed for approximately two hours daily is a compulsion with clinically significant time burden.',
    'Resistance, distress, and temporary relief after ritual completion demonstrate the obsession-compulsion cycle.',
    'Organized thought with no hallucinations or sustained mood syndrome makes primary psychotic and mood disorders less likely.',
    'Recognition that the fears are probably exaggerated supports OCD with partial insight, while the Y-BOCS score documents substantial symptom burden.',
  ],
  keyFindings: [
    'Six-month history of repetitive checking',
    'Recurrent intrusive doubts about burglary and fire',
    'Thoughts persist despite remembering prior checking',
    'Fixed checking sequence',
    'Photographing appliances for reassurance',
    'Repeated pulling of the door handle',
    'Approximately two hours occupied each day',
    'Thoughts experienced as unwanted and distressing',
    'Attempts to resist the thoughts',
    'Anxiety relieved temporarily by the ritual',
    'Academic impairment from frequent lateness',
    'Organized speech and goal-directed thought',
    'No hallucinations or formal thought disorder',
    'No sustained manic or depressive syndrome',
    'Partial recognition that fears are exaggerated',
    'Y-BOCS total score of 27',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Generalized Anxiety Disorder',
      whyPlausibleEarly:
        'Both conditions can produce persistent anxiety, reassurance seeking, and impaired concentration.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence:
            'recurrent intrusive thoughts that the house may be burgled or destroyed by fire despite remembering that each item was already checked',
          reason:
            'OCD thoughts are intrusive and repetitive, whereas generalized anxiety usually consists of excessive worry across several real-life domains.',
        },
        {
          clueOrder: 2,
          evidence:
            'to reduce the anxiety, the student checks every switch in a fixed sequence',
          reason:
            'Rigid neutralizing rituals are characteristic of compulsions and are not a defining feature of generalized anxiety disorder.',
        },
      ],
      finalReasonLessLikely:
        'Generalized anxiety disorder does not adequately explain the intrusive obsessional doubt and repetitive, rule-bound checking ritual.',
    },
    {
      diagnosis: 'Delusional Disorder',
      whyPlausibleEarly:
        'A strong conviction that catastrophe will occur can initially appear delusional, particularly when insight is reduced.',
      ruledOutByClues: [
        {
          clueOrder: 3,
          evidence:
            'the thoughts are unwanted and distressing, and the student attempts to resist them',
          reason:
            'Obsessions are experienced as intrusive and resisted, while delusions are generally held as true rather than recognized as unwanted mental events.',
        },
        {
          clueOrder: 5,
          evidence:
            'the student acknowledges that the feared outcomes are probably exaggerated',
          reason:
            'Partial insight and uncertainty favor an obsession over a fixed delusional belief.',
        },
      ],
      finalReasonLessLikely:
        'The beliefs are intrusive, resisted, and linked to anxiety-reducing rituals rather than fixed convictions held without doubt.',
    },
    {
      diagnosis: 'Obsessive-Compulsive Personality Disorder',
      whyPlausibleEarly:
        'Repetitive routines, orderliness, and excessive control can be confused with obsessive-compulsive symptoms.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence:
            'recurrent intrusive thoughts that the house may be burgled or destroyed by fire',
          reason:
            'OCPD is an enduring personality pattern and does not require recurrent intrusive obsessions.',
        },
        {
          clueOrder: 3,
          evidence:
            'the thoughts are unwanted and distressing, and the student attempts to resist them',
          reason:
            'OCD symptoms are usually distressing and ego-dystonic, whereas OCPD traits are often experienced as appropriate or necessary.',
        },
      ],
      finalReasonLessLikely:
        'The presentation is driven by distressing obsessions and neutralizing compulsions rather than a pervasive ego-syntonic pattern of perfectionism and control.',
    },
    {
      diagnosis: 'Major Depressive Disorder with Rumination',
      whyPlausibleEarly:
        'Depressive rumination can cause repetitive thoughts, impaired concentration, and functional decline.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence:
            'to reduce the anxiety, the student checks every switch in a fixed sequence, photographs the appliances, and repeatedly pulls the door handle',
          reason:
            'A neutralizing compulsion linked to a feared consequence is more characteristic of OCD than depressive rumination.',
        },
        {
          clueOrder: 4,
          evidence: 'there are no sustained manic or depressive symptoms',
          reason:
            'The mental state examination does not establish a major depressive episode as the primary syndrome.',
        },
      ],
      finalReasonLessLikely:
        'The repetitive thoughts are obsessional and followed by compulsive checking, without a sustained depressive syndrome.',
    },
    {
      diagnosis: 'Schizophrenia Spectrum Disorder',
      whyPlausibleEarly:
        'Poor-insight obsessive fears may be mistaken for psychotic beliefs.',
      ruledOutByClues: [
        {
          clueOrder: 4,
          evidence:
            'organized speech and goal-directed thought; there are no hallucinations, formal thought disorder',
          reason:
            'The examination lacks core psychotic features such as hallucinations, formal thought disorder, or disorganized behavior.',
        },
        {
          clueOrder: 5,
          evidence:
            'the student acknowledges that the feared outcomes are probably exaggerated',
          reason:
            'Residual insight and active doubt favor OCD rather than a firmly held psychotic belief.',
        },
      ],
      finalReasonLessLikely:
        'The patient has obsessional doubt and compulsions with preserved thought organization rather than a primary psychotic syndrome.',
    },
  ],
  managementPearl:
    'First-line management centers on cognitive behavioral therapy with exposure and response prevention, an SSRI when indicated, or combined treatment when functional impairment is severe. Treatment should reduce avoidance, reassurance seeking, and ritual completion rather than repeatedly confirming the feared belief.',
  generationQuality: {
    contentTier: 'FLAGSHIP',
    seedVersion,
    humanReviewed: true,
    discriminatorStrength: 'HIGH',
    expectedTeachingPoints: [
      'OCD requires obsessions, compulsions, or both that are time-consuming or cause clinically significant impairment',
      'Obsessions are intrusive and unwanted; compulsions are performed to reduce distress or prevent a feared event',
      'Temporary relief after a ritual reinforces the obsession-compulsion cycle',
      'Poor or partial insight does not automatically indicate a psychotic disorder',
      'OCD must be separated from generalized worry, depressive rumination, delusion, and OCPD traits',
      'CBT with exposure and response prevention and SSRIs are core evidence-based treatments',
    ],
    competencyDomains: [
      'Psychiatry',
      'Obsessive-Compulsive and Related Disorders',
      'Mental State Examination',
      'Clinical Reasoning',
      'Psychological Treatment',
    ],
  },
};

const educationForFrontend = {
  title: displayLabel,
  summary: {
    definition:
      'Obsessive-compulsive disorder is characterized by recurrent obsessions, compulsions, or both that are time-consuming or cause clinically significant distress or functional impairment.',
    highYieldTakeaway:
      'Think OCD when intrusive unwanted thoughts generate anxiety and the patient performs repetitive behaviors or mental acts to neutralize that anxiety, obtaining only temporary relief.',
  },
  recognitionPattern: [
    {
      pattern: 'Intrusive thought followed by neutralizing ritual',
      whyItMatters:
        'The relationship between the thought and the behavior is more diagnostic than the content of either symptom alone.',
      progression:
        'Intrusive obsession -> rising anxiety -> compulsion or mental ritual -> temporary relief -> reinforcement of the cycle.',
      discriminator:
        'The ritual is performed to reduce distress or prevent a feared outcome, not because it is pleasurable.',
      commonTrap:
        'Do not label repeated checking as ordinary caution when it is time-consuming, rigid, and functionally impairing.',
    },
    {
      pattern: 'Ego-dystonic symptoms with variable insight',
      whyItMatters:
        'Patients often recognize that their fears or rituals are excessive, although insight may be partial or absent.',
      discriminator:
        'Intrusiveness, resistance, and distress support obsessional thinking even when conviction becomes strong.',
      commonTrap:
        'Do not diagnose psychosis solely because an OCD belief is held with poor insight.',
    },
    {
      pattern: 'Substantial time burden and avoidance',
      whyItMatters:
        'Severity is determined not only by symptom content but by time consumed, distress, avoidance, and functional impairment.',
      discriminator:
        'More than one hour daily or clear impairment separates clinically significant OCD from common checking habits.',
      commonTrap:
        'Do not dismiss symptoms because the patient remains aware that the fear may be unreasonable.',
    },
  ],
  keySymptoms: [
    {
      symptom: 'Recurrent intrusive thoughts, images, or urges',
      significance:
        'These are experienced as unwanted and commonly provoke anxiety or distress.',
    },
    {
      symptom:
        'Repeated checking, washing, ordering, counting, or mental rituals',
      significance:
        'Compulsions are performed according to rigid rules or in response to an obsession.',
    },
    {
      symptom: 'Attempts to suppress, resist, or neutralize thoughts',
      significance:
        'Resistance and neutralization help distinguish obsessions from ordinary preferences or fixed beliefs.',
    },
    {
      symptom: 'Avoidance and reassurance seeking',
      significance:
        'Avoidance and repeated reassurance can maintain the disorder even when overt rituals are less visible.',
    },
  ],
  keySigns: [
    {
      finding: 'Visible anxiety when a ritual is interrupted',
      significance:
        'Distress on preventing the compulsion supports its anxiety-neutralizing function.',
      discriminator:
        'The behavior is not simply a preferred routine; interruption produces marked distress or fear.',
    },
    {
      finding: 'Preserved organization of speech and thought',
      significance:
        'Patients with OCD can have intense fears while retaining coherent thought processes.',
      discriminator:
        'Organized thought and absent hallucinations make a primary psychotic disorder less likely.',
    },
    {
      finding: 'Good, poor, or absent insight',
      significance:
        'Insight exists on a spectrum and should be documented rather than used as an all-or-none exclusion criterion.',
      discriminator:
        'Intrusiveness, distress, ritualized neutralization, and the broader mental state remain essential when insight is poor.',
    },
  ],
  examPearls: [
    {
      type: 'DISCRIMINATOR',
      title: 'Ask what the ritual prevents',
      content:
        'Identify the feared consequence, the ritual used to neutralize it, and the duration of relief after the ritual.',
      whyItMatters:
        'This reveals the obsession-compulsion link and separates compulsions from habits or personality traits.',
      discriminator:
        'A rigid act performed to reduce obsessional anxiety strongly supports OCD.',
      trapAvoided:
        'Do not record only the repetitive behavior without eliciting the thought or fear that drives it.',
    },
    {
      type: 'DISCRIMINATOR',
      title: 'Assess insight without excluding OCD',
      content:
        'Ask whether the patient believes the feared outcome is definitely true, probably true, possibly true, or probably exaggerated.',
      whyItMatters:
        'Insight may vary over time and can become poor in severe OCD.',
      discriminator:
        'Partial doubt, intrusiveness, resistance, and ritualized relief favor OCD over a fixed delusion.',
      trapAvoided:
        'Do not equate poor insight automatically with schizophrenia or delusional disorder.',
    },
    {
      type: 'DISCRIMINATOR',
      title: 'Distinguish OCD from OCPD',
      content:
        'OCD consists of intrusive obsessions and compulsions; OCPD is a pervasive personality pattern of perfectionism, rigidity, and control.',
      whyItMatters:
        'The names are similar, but the clinical syndromes and treatment formulations differ.',
      discriminator:
        'Ego-dystonic rituals favor OCD; ego-syntonic personality traits favor OCPD.',
      trapAvoided:
        'Do not diagnose OCPD simply because a patient with OCD is orderly or repetitive.',
    },
    {
      type: 'MNEMONIC',
      title: 'OCD cycle',
      content:
        'Obsession -> Concern rises -> Doing the compulsion -> brief relief -> cycle repeats.',
      whyItMatters:
        'The sequence emphasizes negative reinforcement and the purpose of response prevention.',
      discriminator:
        'Temporary relief after a ritual is a central clue to compulsive behavior.',
      trapAvoided:
        'Do not place this memory aid under scoringSystems; it is not a validated scale.',
    },
  ],
  scoringSystems: [
    {
      name: 'Yale-Brown Obsessive Compulsive Scale',
      abbreviation: 'Y-BOCS',
      use: 'Clinician-rated assessment of obsession and compulsion severity, including time occupied, interference, distress, resistance, and control.',
      interpretation:
        'Use the total score to quantify baseline symptom burden and monitor change over treatment; interpret it alongside functional assessment and clinical judgment.',
      limitation:
        'The scale measures severity after OCD is suspected or diagnosed and should not replace a diagnostic interview.',
    },
  ],
  investigations: [
    {
      test: 'Comprehensive psychiatric assessment',
      interpretation:
        'Establish the form, content, frequency, triggers, resistance, insight, avoidance, and functional effect of obsessions and compulsions.',
      whyItMatters:
        'Diagnosis is clinical and depends on identifying the obsession-compulsion relationship.',
    },
    {
      test: 'Yale-Brown Obsessive Compulsive Scale',
      interpretation:
        'Quantifies the severity of obsessions and compulsions and provides a baseline for monitoring treatment response.',
      whyItMatters:
        'A structured measure can reveal symptom burden that is underestimated during a brief interview.',
    },
    {
      test: 'Mood, psychosis, tic, substance, and neurodevelopmental assessment',
      interpretation:
        'Identifies common comorbidity and alternative explanations for repetitive thoughts or behaviors.',
      whyItMatters:
        'Treatment planning changes when symptoms occur with depression, psychosis, tic disorders, or another primary condition.',
    },
    {
      test: 'Targeted physical examination or laboratory testing when indicated',
      interpretation:
        'Testing is guided by history, medication planning, substance exposure, neurological findings, or suspicion of a medical contributor.',
      whyItMatters:
        'There is no routine laboratory test that confirms primary OCD.',
    },
  ],
  managementOverview: [
    {
      step: 'Provide psychoeducation and formulate the obsession-compulsion cycle',
      rationale:
        'Understanding negative reinforcement helps the patient see why rituals provide short-term relief but maintain symptoms over time.',
    },
    {
      step: 'Offer cognitive behavioral therapy including exposure and response prevention',
      rationale:
        'ERP gradually exposes the patient to feared cues while preventing the usual ritual, allowing anxiety to reduce without compulsive neutralization.',
    },
    {
      step: 'Offer an SSRI when clinically indicated',
      rationale:
        'SSRIs are evidence-based pharmacological treatments for OCD and may be selected according to severity, preference, availability, previous response, and comorbidity.',
    },
    {
      step: 'Use combined ERP-based CBT and an SSRI for severe functional impairment or inadequate response to one modality',
      rationale:
        'Combined treatment may be appropriate when symptoms are severe or remain significantly impairing.',
    },
    {
      step: 'Reduce reassurance, avoidance, and family accommodation',
      rationale:
        'Repeated reassurance and participation in rituals can unintentionally reinforce symptoms.',
    },
    {
      step: 'Review adherence, treatment dose, duration, comorbidity, and diagnosis when response is inadequate',
      rationale:
        'Apparent resistance may reflect incomplete ERP, insufficient medication trial, unrecognized comorbidity, or an incorrect formulation.',
    },
    {
      step: 'Refer complex or treatment-resistant illness to specialist mental health services',
      rationale:
        'Specialist review supports advanced psychological treatment, medication optimization, and coordinated care.',
    },
  ],
  differentialDistinguishers: [
    {
      diagnosis: 'Generalized Anxiety Disorder',
      whyConfused:
        'Both cause persistent anxiety, worry, reassurance seeking, and functional impairment.',
      distinguishingPoint:
        'GAD involves excessive worry across several domains; OCD involves intrusive obsessions and ritualized neutralizing acts.',
      keySeparator:
        'A fixed compulsion performed to neutralize a recurrent intrusive thought favors OCD.',
      classicTrap:
        'Calling all repetitive fearful thoughts generalized anxiety without asking about rituals or mental neutralization.',
    },
    {
      diagnosis: 'Delusional Disorder',
      whyConfused:
        'OCD with poor insight may involve strongly held catastrophic beliefs.',
      distinguishingPoint:
        'Obsessions are typically intrusive, distressing, and linked to compulsions, while delusions are fixed beliefs not usually resisted as unwanted thoughts.',
      keySeparator:
        'Intrusiveness plus ritualized anxiety relief favors OCD even when insight is limited.',
      classicTrap:
        'Using insight alone rather than the complete phenomenology to separate OCD from psychosis.',
    },
    {
      diagnosis: 'Obsessive-Compulsive Personality Disorder',
      whyConfused:
        'Both may involve order, repetition, control, and inflexibility.',
      distinguishingPoint:
        'OCPD is a pervasive ego-syntonic personality pattern; OCD is defined by intrusive obsessions and distressing compulsions.',
      keySeparator:
        'Unwanted obsessional anxiety and neutralizing rituals favor OCD.',
      classicTrap: 'Assuming similar names indicate the same disorder.',
    },
    {
      diagnosis: 'Major Depressive Disorder with Rumination',
      whyConfused:
        'Both can cause repetitive negative thinking and impaired concentration.',
      distinguishingPoint:
        'Depressive rumination is mood-congruent and not usually neutralized by rigid compulsions.',
      keySeparator:
        'A repetitive act that temporarily reduces obsessional fear favors OCD.',
      classicTrap:
        'Treating repetitive thoughts as depression without establishing a sustained depressive syndrome.',
    },
    {
      diagnosis: 'Schizophrenia Spectrum Disorder',
      whyConfused:
        'Poor-insight OCD may be mistaken for a psychotic belief system.',
      distinguishingPoint:
        'Schizophrenia spectrum disorders usually include additional psychotic or disorganization features not explained by obsessions and compulsions.',
      keySeparator:
        'Preserved thought organization, absent hallucinations, and a clear obsession-compulsion cycle favor OCD.',
      classicTrap:
        'Diagnosing psychosis solely because a feared outcome is strongly believed.',
    },
  ],
  complications: [
    {
      complication: 'Academic or occupational impairment',
      whyItMatters:
        'Time-consuming rituals and avoidance can cause lateness, reduced productivity, and loss of opportunities.',
    },
    {
      complication: 'Social isolation and family conflict',
      whyItMatters:
        'Avoidance, reassurance seeking, and family accommodation can disrupt relationships and increase dependence.',
    },
    {
      complication: 'Comorbid depressive or anxiety disorders',
      whyItMatters:
        'Comorbidity increases overall impairment and should be assessed during treatment planning.',
    },
    {
      complication: 'Physical consequences of compulsions',
      whyItMatters:
        'Repeated washing, checking, or other rituals may cause skin injury, fatigue, sleep disruption, or other behavior-specific problems.',
    },
    {
      complication: 'Chronic avoidance and narrowing of daily activities',
      whyItMatters:
        'Avoidance can become as disabling as overt compulsions and may persist unless directly addressed in treatment.',
    },
  ],
  pitfalls: [
    {
      pitfall: 'Diagnosing psychosis solely because insight is poor',
      consequence:
        'OCD may be missed when intrusive fears are strongly held; assess resistance, distress, compulsions, and the complete mental state.',
    },
    {
      pitfall: 'Confusing OCD with OCPD',
      consequence:
        'A personality description may replace recognition of treatable obsessions and compulsions.',
    },
    {
      pitfall: 'Asking only about visible rituals',
      consequence:
        'Mental counting, praying, reviewing, neutralizing, reassurance seeking, and avoidance may remain undetected.',
    },
    {
      pitfall: 'Providing repeated reassurance as the main intervention',
      consequence:
        'Reassurance may briefly reduce anxiety while reinforcing the cycle and increasing future reassurance seeking.',
    },
    {
      pitfall: 'Stopping treatment assessment after symptom reduction',
      consequence:
        'Residual avoidance, family accommodation, and functional impairment may continue despite fewer overt rituals.',
    },
    {
      pitfall: 'Putting the OCD cycle mnemonic under scoringSystems',
      consequence:
        'ScoringSystems should contain validated instruments such as Y-BOCS rather than memory aids.',
    },
  ],
  recallPrompts: [
    {
      prompt: 'What defines an obsession?',
      answer:
        'A recurrent intrusive and unwanted thought, image, or urge that causes distress and is often resisted or neutralized.',
    },
    {
      prompt: 'What defines a compulsion?',
      answer:
        'A repetitive behavior or mental act performed according to rigid rules or in response to an obsession to reduce distress or prevent a feared event.',
    },
    {
      prompt: 'What clinical sequence characterizes OCD?',
      answer:
        'Obsession, rising anxiety, compulsion, temporary relief, and reinforcement of the cycle.',
    },
    {
      prompt: 'How is OCD distinguished from OCPD?',
      answer:
        'OCD has intrusive ego-dystonic obsessions and compulsions; OCPD is a pervasive, often ego-syntonic pattern of perfectionism and control.',
    },
    {
      prompt: 'What is the core psychological treatment for OCD?',
      answer:
        'Cognitive behavioral therapy including exposure and response prevention.',
    },
    {
      prompt: 'Which scale commonly measures OCD severity?',
      answer: 'The Yale-Brown Obsessive Compulsive Scale, or Y-BOCS.',
    },
  ],
  references: [
    {
      citation:
        'National Institute for Health and Care Excellence. Obsessive-compulsive disorder and body dysmorphic disorder: treatment. Clinical guideline CG31; reviewed 2024.',
    },
    {
      citation:
        'American Psychiatric Association. Diagnostic and Statistical Manual of Mental Disorders, Fifth Edition, Text Revision.',
    },
    {
      citation:
        'World Health Organization. International Classification of Diseases, Eleventh Revision: Obsessive-compulsive disorder.',
    },
    {
      citation:
        'Sadock BJ, Sadock VA, Ruiz P. Kaplan and Sadock’s Synopsis of Psychiatry.',
    },
  ],
};

function validateStaticSeedContent() {
  const history = clues[0].value;
  const symptoms = [clues[1].value, clues[2].value, clues[3].value];

  const clueValidation = caseEligibilityPolicy.validatePlayableClues(clues, {
    minimumPlayableClues: 6,
  });

  if (!clueValidation.valid) {
    throw new Error(
      `${displayLabel} clues are not playable: ${clueValidation.reasons.join(', ') || 'unknown reason'}.`,
    );
  }

  const validation = caseValidationService.validateSnapshot({
    caseId: 'seed-static-validation',
    title: caseTitle,
    date: inventoryPlaceholderDate,
    difficulty: 'medium',
    history,
    symptoms,
    labs: null,
    clues: clues as unknown as object[],
    explanation: explanation as unknown as object,
    differentials,
    diagnosisId: null,
    diagnosisRegistryId: 'seed-static-registry',
    proposedDiagnosisText: displayLabel,
    diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
    diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
    diagnosisMappingConfidence: 1,
    diagnosisEditorialNote:
      'Static validation for flagship obsessive-compulsive disorder seed.',
  });

  if (validation.outcome !== 'PASSED') {
    throw new Error(
      `${displayLabel} static validation failed: ${validation.issues.map((issue) => `${issue.code}: ${issue.message}`).join('; ')}`,
    );
  }

  validateDifferentialAnalysisGrounding();
  validateScoringSystems();

  console.log('Static obsessive-compulsive disorder seed validation passed:', {
    playableClueCount: clueValidation.playableClueCount,
    clueOrders: clueValidation.clues.map((clue) => clue.order),
    clueTypes: clueValidation.clues.map((clue) => clue.type),
    scoringSystems: educationForFrontend.scoringSystems.map(
      (system) => system.abbreviation,
    ),
  });
}

function validateDifferentialAnalysisGrounding() {
  const analysis = explanation.differentialAnalysis;
  const expectedDifferentials = new Set(
    differentials.map(normalizeClinicalText),
  );
  const seen = new Set<string>();
  const clueByOrder = new Map(clues.map((clue) => [clue.order, clue.value]));

  if (analysis.length !== differentials.length) {
    throw new Error(
      `${displayLabel} differentialAnalysis must include exactly one item per differential.`,
    );
  }

  for (const item of analysis) {
    const normalizedDiagnosis = normalizeClinicalText(item.diagnosis);

    if (!expectedDifferentials.has(normalizedDiagnosis)) {
      throw new Error(
        `${displayLabel} differentialAnalysis contains an unlisted differential: ${item.diagnosis}.`,
      );
    }

    if (seen.has(normalizedDiagnosis)) {
      throw new Error(
        `${displayLabel} differentialAnalysis contains a duplicate differential: ${item.diagnosis}.`,
      );
    }
    seen.add(normalizedDiagnosis);

    if (!item.whyPlausibleEarly.trim() || !item.finalReasonLessLikely.trim()) {
      throw new Error(
        `${displayLabel} differentialAnalysis for ${item.diagnosis} is missing required explanatory text.`,
      );
    }

    if (item.ruledOutByClues.length === 0) {
      throw new Error(
        `${displayLabel} differentialAnalysis for ${item.diagnosis} must cite at least one clue.`,
      );
    }

    let previousOrder = -1;
    for (const ruleOut of item.ruledOutByClues) {
      const clueText = clueByOrder.get(ruleOut.clueOrder);
      if (!clueText) {
        throw new Error(
          `${displayLabel} differentialAnalysis for ${item.diagnosis} references invalid clueOrder ${ruleOut.clueOrder}.`,
        );
      }

      if (ruleOut.clueOrder < previousOrder) {
        throw new Error(
          `${displayLabel} differentialAnalysis for ${item.diagnosis} cites clues out of order.`,
        );
      }
      previousOrder = ruleOut.clueOrder;

      if (!ruleOut.evidence.trim() || !ruleOut.reason.trim()) {
        throw new Error(
          `${displayLabel} differentialAnalysis for ${item.diagnosis} has an incomplete clue explanation.`,
        );
      }

      if (!isEvidenceGroundedInClue(ruleOut.evidence, clueText)) {
        throw new Error(
          `${displayLabel} differentialAnalysis for ${item.diagnosis} has evidence that is not grounded in clue ${ruleOut.clueOrder}: ${ruleOut.evidence}`,
        );
      }
    }
  }

  if (seen.size !== expectedDifferentials.size) {
    throw new Error(
      `${displayLabel} differentialAnalysis is missing one or more listed differentials.`,
    );
  }
}

function validateScoringSystems() {
  if (educationForFrontend.scoringSystems.length !== 1) {
    throw new Error(
      `${displayLabel} should seed exactly one compatible scoring system: Y-BOCS.`,
    );
  }

  const [system] = educationForFrontend.scoringSystems;
  if (
    normalizeClinicalText(system.name) !==
      'yale brown obsessive compulsive scale' ||
    system.abbreviation !== 'Y-BOCS'
  ) {
    throw new Error(
      `${displayLabel} scoringSystems must contain the Yale-Brown Obsessive Compulsive Scale only.`,
    );
  }

  const scoringCorpus = Object.values(system).join(' ');
  if (/\bmnemonic|cycle repeats|memory aid\b/i.test(scoringCorpus)) {
    throw new Error(
      `${displayLabel} scoringSystems contains mnemonic content instead of a validated instrument.`,
    );
  }
}

function isEvidenceGroundedInClue(evidence: string, clueText: string): boolean {
  const normalizedEvidence = normalizeClinicalText(evidence);
  const normalizedClue = normalizeClinicalText(clueText);

  if (!normalizedEvidence || !normalizedClue) {
    return false;
  }

  if (
    normalizedClue.includes(normalizedEvidence) ||
    normalizedEvidence.includes(normalizedClue)
  ) {
    return true;
  }

  const evidenceTokens = extractMeaningfulTokens(normalizedEvidence);
  if (evidenceTokens.length === 0) {
    return false;
  }

  const clueTokens = new Set(extractMeaningfulTokens(normalizedClue));
  const overlap = evidenceTokens.filter((token) =>
    clueTokens.has(token),
  ).length;

  return overlap / evidenceTokens.length >= 0.6;
}

function extractMeaningfulTokens(value: string): string[] {
  return value
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
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

  const registryData = {
    canonicalName,
    canonicalNormalized,
    displayLabel,
    status: DiagnosisRegistryStatus.ACTIVE,
    active: true,
    isPlayable: true,
    isGeneratable: true,
    specialty: 'Psychiatry',
    subspecialty: 'Anxiety and Obsessive-Compulsive Disorders',
    category: 'Obsessive-Compulsive and Related Disorders',
    bodySystem: 'Mental Health',
    organSystem: 'Brain and Behavior',
    difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
    rarityBand: DiagnosisRarityBand.COMMON,
    clinicalSetting: DiagnosisClinicalSetting.OUTPATIENT,
    ageGroup: DiagnosisAgeGroup.ADULT,
    urgencyLevel: DiagnosisUrgencyLevel.ROUTINE,
    preferredClueTypes: ['history', 'symptom', 'exam'],
    notes:
      'Seeded flagship obsessive-compulsive disorder case emphasizing obsession-compulsion phenomenology, insight, and differentiation from psychosis and OCPD.',
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
  educationId: string;
}) {
  const history = clues[0].value;
  const symptoms = [clues[1].value, clues[2].value, clues[3].value];

  const clueValidation = caseEligibilityPolicy.validatePlayableClues(clues, {
    minimumPlayableClues: 6,
  });

  if (!clueValidation.valid) {
    throw new Error(
      `${displayLabel} clues are not playable: ${clueValidation.reasons.join(', ') || 'unknown reason'}.`,
    );
  }

  const preflightValidation = caseValidationService.validateSnapshot({
    caseId: 'seed-preflight',
    title: caseTitle,
    date: inventoryPlaceholderDate,
    difficulty: 'medium',
    history,
    symptoms,
    labs: null,
    clues: clues as unknown as object[],
    explanation: explanation as unknown as object,
    differentials,
    diagnosisId: null,
    diagnosisRegistryId: params.diagnosisRegistryId,
    proposedDiagnosisText: displayLabel,
    diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
    diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
    diagnosisMappingConfidence: 1,
    diagnosisEditorialNote:
      'Preflight validation for flagship obsessive-compulsive disorder seed.',
  });

  if (preflightValidation.outcome !== 'PASSED') {
    throw new Error(
      `${displayLabel} case failed Wardle validation: ${preflightValidation.issues.map((issue) => `${issue.code}: ${issue.message}`).join('; ')}`,
    );
  }

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
  const targetCase = scheduledCase ?? reusableCase;

  if (scheduledCase) {
    console.log(
      `One-off production update enabled for scheduled ${displayLabel} case:`,
      scheduledCase,
    );
  }

  const assignedDate =
    targetCase?.date ??
    (await findAvailableInventoryPlaceholderDate({
      preferredDate: inventoryPlaceholderDate,
      reusableCaseId: reusableCase?.id,
      displayLabel: caseTitle,
    }));

  const publicNumber =
    targetCase?.publicNumber ?? (await getNextCasePublicNumber());

  const caseData = {
    title: caseTitle,
    publicNumber,
    date: assignedDate,
    difficulty: 'medium',
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
      'Seeded complete frontend-aligned flagship obsessive-compulsive disorder case with education.',
  };

  const seededCase = targetCase
    ? await prisma.case.update({
        where: { id: targetCase.id },
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
      difficulty: 'medium',
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
        'Created complete obsessive-compulsive disorder revision with clue-aligned reasoning and education.',
    },
    select: { id: true },
  });

  await prisma.case.update({
    where: { id: seededCase.id },
    data: { currentRevisionId: revision.id },
  });

  const validationReport = caseValidationService.validateSnapshot({
    caseId: seededCase.id,
    title: caseTitle,
    date: assignedDate,
    difficulty: 'medium',
    history,
    symptoms,
    labs: null,
    clues: clues as unknown as object[],
    explanation: explanation as unknown as object,
    differentials,
    diagnosisId: null,
    diagnosisRegistryId: params.diagnosisRegistryId,
    proposedDiagnosisText: displayLabel,
    diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
    diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
    diagnosisMappingConfidence: 1,
    diagnosisEditorialNote:
      'Stored validation for flagship obsessive-compulsive disorder seed.',
  });
  const validationPayload =
    caseValidationService.buildPersistencePayload(validationReport);
  const validationSummary =
    validationPayload.summary &&
    typeof validationPayload.summary === 'object' &&
    !Array.isArray(validationPayload.summary)
      ? validationPayload.summary
      : {};

  await prisma.caseValidationRun.create({
    data: {
      caseId: seededCase.id,
      revisionId: revision.id,
      source: CaseSource.MANUAL,
      publishTrack: PublishTrack.DAILY,
      outcome: validationReport.outcome,
      validatorVersion: validationReport.validatorVersion,
      summary: {
        ...validationSummary,
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        wardleClueValidation: {
          playableClueCount: clueValidation.playableClueCount,
          clueTypes: clueValidation.clues.map((clue) => clue.type),
          clueOrders: clueValidation.clues.map((clue) => clue.order),
        },
        note: 'Complete obsessive-compulsive disorder flagship seed with six playable clues, clue-aligned differential analysis, and full education payload.',
      },
      findings: validationPayload.findings,
      completedAt: now,
    },
  });

  const persisted = await prisma.case.findUniqueOrThrow({
    where: { id: seededCase.id },
    select: {
      id: true,
      clues: true,
      currentRevisionId: true,
      currentRevision: {
        select: {
          id: true,
          clues: true,
        },
      },
    },
  });

  const persistedCaseClues = caseEligibilityPolicy.validatePlayableClues(
    persisted.clues,
    { caseId: persisted.id, minimumPlayableClues: 6 },
  );
  const persistedRevisionClues = caseEligibilityPolicy.validatePlayableClues(
    persisted.currentRevision?.clues,
    { caseId: persisted.id, minimumPlayableClues: 6 },
  );

  if (!persistedCaseClues.valid || !persistedRevisionClues.valid) {
    throw new Error(
      `Persisted ${displayLabel} clues are not playable. Case reasons: ${persistedCaseClues.reasons.join(', ') || 'none'}; revision reasons: ${persistedRevisionClues.reasons.join(', ') || 'none'}.`,
    );
  }

  if (
    persisted.currentRevisionId !== revision.id ||
    persisted.currentRevision?.id !== revision.id
  ) {
    throw new Error(
      `Case ${seededCase.id} currentRevisionId does not point to revision ${revision.id}.`,
    );
  }

  console.log('Seeded Obsessive-Compulsive Disorder:', {
    registryId: params.diagnosisRegistryId,
    caseId: seededCase.id,
    revisionId: revision.id,
    publicNumber,
    educationId: params.educationId,
    validationOutcome: validationReport.outcome,
    validatorVersion: validationReport.validatorVersion,
    clueTypes: persistedCaseClues.clues.map((clue) => clue.type),
    clueOrders: persistedCaseClues.clues.map((clue) => clue.order),
  });
}

async function main() {
  validateStaticSeedContent();

  const registry = await ensureRegistry();
  const education = await upsertEducation(registry.id);

  await upsertCase({
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
