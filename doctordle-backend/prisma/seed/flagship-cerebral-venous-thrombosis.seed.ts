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
 * FLAGSHIP CASE SEED - Cerebral Venous Thrombosis
 *
 * Clinical focus:
 * - Progressive new headache with features of raised intracranial pressure.
 * - Papilloedema and transient visual obscurations.
 * - Evolution to focal seizure and transient focal neurological deficit.
 * - Venous-pattern haemorrhagic lesion not respecting a typical arterial territory.
 * - CT venography confirmation of superior sagittal sinus thrombosis.
 *
 * Education design:
 * - The case explanation is vignette-specific and clue-order aligned.
 * - Diagnosis education is independent of the case and covers recognition,
 *   risk factors, imaging, treatment principles, complications, differentials,
 *   and common diagnostic traps.
 * - explanation.reasoning is intentionally stored as ONE STRING because the
 *   current Wardle learner normalizer does not consume a string[] reasoning field.
 *
 * Safety:
 * - Reuses or creates the diagnosis registry and accepted aliases.
 * - Does not overwrite existing diagnosis education.
 * - Does not overwrite an existing case with the same title.
 * - Does not alter a scheduled DailyCase.
 *
 * Run:
 *   npx tsx prisma/seed/flagship-cerebral-venous-thrombosis.seed.ts
 *
 * Railway:
 *   railway run npx tsx prisma/seed/flagship-cerebral-venous-thrombosis.seed.ts
 */

const databaseUrl = resolvePgConnectionString(process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required to run the Cerebral Venous Thrombosis seed.',
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
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 6, 26, 12, 0, 0));
const seedVersion = 'flagship-cerebral-venous-thrombosis-v1';

const canonicalName = 'cerebral venous thrombosis';
const displayLabel = 'Cerebral Venous Thrombosis';
const caseTitle = 'Progressive Headache, Visual Obscurations, and a Focal Seizure';

const aliasTerms = [
  'Cerebral Venous Thrombosis',
  'Cerebral Venous Sinus Thrombosis',
  'CVT',
  'CVST',
  'Dural Venous Sinus Thrombosis',
];

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 27-year-old woman presents with a new headache that has progressively intensified over six days. It began as a diffuse pressure and has become persistent enough to wake her from sleep. She has intermittent nausea but no previous history of recurrent migraine, recent head trauma, or similar headaches.',
  },
  {
    order: 1,
    type: 'symptom',
    value:
      'The headache is worse when she lies flat, coughs, or strains. During the past two days she has had several brief episodes in which her vision dims for a few seconds before returning to normal. She has no fever, neck stiffness, photophobia, purulent ear symptoms, or persistent vomiting.',
  },
  {
    order: 2,
    type: 'exam',
    value:
      'She is alert and oriented. Fundoscopy shows bilateral optic-disc swelling with blurred disc margins. Pupils are equal and reactive, there is no meningism, and cranial nerve, limb power, tone, reflex, coordination, and sensory examination are initially normal.',
  },
  {
    order: 3,
    type: 'history',
    value:
      'While awaiting further assessment she has a brief focal seizure beginning with rhythmic jerking of the right hand and arm, followed by transient right-arm weakness that improves over the next hour. Further history reveals that she started a combined estrogen-containing oral contraceptive about eight weeks ago. She is not pregnant or postpartum and has no known malignancy or previous venous thromboembolism.',
  },
  {
    order: 4,
    type: 'imaging',
    value:
      'Non-contrast CT of the brain shows a small left parasagittal frontal haemorrhagic lesion with surrounding oedema. The abnormality does not conform to a single arterial vascular territory, and there is no diffuse subarachnoid blood or large mass lesion.',
  },
  {
    order: 5,
    type: 'imaging',
    value:
      'CT venography demonstrates a long segment central filling defect with non-opacification of the superior sagittal sinus and involvement of adjacent cortical veins, confirming thrombosis of the cerebral venous drainage pathway.',
  },
] as const;

const differentials = [
  'Migraine with Aura',
  'Idiopathic Intracranial Hypertension',
  'Subarachnoid Haemorrhage',
  'Arterial Ischaemic Stroke',
  'Intracranial Space-Occupying Lesion',
  'Meningitis',
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
  'A new headache that worsens progressively over several days is a secondary-headache warning pattern rather than a typical recurrent primary headache. At this stage, intracranial pressure disorders, infection, vascular disease, and mass lesions remain open possibilities.',
  'Worsening on lying flat, coughing, and straining together with transient visual obscurations suggests raised intracranial pressure. The absence of fever, meningism, and a thunderclap onset weakens meningitis and aneurysmal subarachnoid haemorrhage without excluding other intracranial causes.',
  'Bilateral papilloedema objectively confirms raised intracranial pressure. A normal initial focal neurological examination keeps idiopathic intracranial hypertension in the differential, but papilloedema itself does not establish the cause.',
  'A focal motor seizure followed by transient unilateral weakness changes the syndrome from isolated intracranial hypertension to a focal cortical process. Recent estrogen exposure adds a venous thrombotic risk factor and makes cerebral venous disease substantially more likely.',
  'A parasagittal haemorrhagic lesion with oedema that does not respect an arterial territory is characteristic of impaired venous drainage and venous infarction. Its parasagittal location also fits pathology involving the superior sagittal sinus and adjacent cortical veins.',
  'Direct venographic demonstration of a superior sagittal sinus filling defect and adjacent cortical venous non-opacification establishes the diagnosis. The canonical diagnosis is Cerebral Venous Thrombosis; the superior sagittal sinus is the principal anatomical site in this case.',
] as const;

const clueBreakdown: ClueBreakdownEntry[] = clues.map((clue, index) => ({
  clueOrder: clue.order,
  clueType: clue.type,
  clue: clue.value,
  explanation: reasoningSteps[index],
  diagnosticContribution: [
    'Introduces a progressive secondary-headache syndrome without prematurely localising the pathology.',
    'Adds raised-intracranial-pressure physiology while keeping multiple structural and vascular causes open.',
    'Objectively establishes raised intracranial pressure and makes a primary uncomplicated headache disorder much less likely.',
    'Adds cortical irritation, a focal deficit, and a thrombotic risk factor, sharply increasing the probability of a cerebral venous disorder.',
    'Provides a venous-pattern parenchymal injury that distinguishes the syndrome from a conventional arterial-territory stroke.',
    'Directly confirms thrombosis of the cerebral venous system and completes the diagnostic pathway.',
  ][index],
}));

const explanation = {
  diagnosis: displayLabel,
  summary:
    'A progressive headache with positional and Valsalva worsening, transient visual obscurations, papilloedema, focal seizure, transient focal weakness, recent estrogen exposure, and a parasagittal haemorrhagic lesion outside a typical arterial territory points to impaired cerebral venous drainage. CT venography confirms superior sagittal sinus and cortical venous thrombosis.',
  reasoning: reasoningSteps.join('\n\n'),
  clueBreakdown,
  keyFindings: [
    'Progressive new headache over several days',
    'Headache worse supine and with coughing or straining',
    'Transient visual obscurations',
    'Bilateral papilloedema',
    'Focal motor seizure',
    'Transient unilateral weakness after the seizure',
    'Recent estrogen-containing contraceptive exposure',
    'Parasagittal haemorrhagic lesion with oedema outside an arterial territory',
    'Superior sagittal sinus filling defect on CT venography',
    'Adjacent cortical venous thrombosis',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Migraine with Aura',
      whyPlausibleEarly:
        'Headache, nausea, transient visual symptoms, and transient neurological symptoms may occur with migraine.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence: 'new progressively worsening headache with no recurrent migraine history',
          reason:
            'A new progressive headache over several days is less typical of an established primary migraine pattern and should trigger evaluation for secondary causes.',
        },
        {
          clueOrder: 2,
          evidence: 'bilateral papilloedema',
          reason:
            'Papilloedema is objective evidence of raised intracranial pressure and is not explained by uncomplicated migraine.',
        },
        {
          clueOrder: 5,
          evidence: 'superior sagittal sinus filling defect on venography',
          reason:
            'Direct venographic evidence identifies a structural vascular cause for the headache syndrome.',
        },
      ],
      finalReasonLessLikely:
        'The raised intracranial pressure, seizure, venous-pattern haemorrhagic lesion, and abnormal venography establish a secondary vascular disorder rather than migraine.',
    },
    {
      diagnosis: 'Idiopathic Intracranial Hypertension',
      whyPlausibleEarly:
        'Headache, transient visual obscurations, and papilloedema can form a classic raised-intracranial-pressure presentation.',
      ruledOutByClues: [
        {
          clueOrder: 3,
          evidence: 'focal motor seizure and transient focal weakness',
          reason:
            'New focal cortical neurological events are atypical for uncomplicated idiopathic intracranial hypertension and require evaluation for a secondary structural or vascular cause.',
        },
        {
          clueOrder: 4,
          evidence: 'parasagittal haemorrhagic lesion with surrounding oedema',
          reason:
            'A focal haemorrhagic parenchymal lesion is not an expected feature of idiopathic intracranial hypertension.',
        },
        {
          clueOrder: 5,
          evidence: 'superior sagittal sinus and cortical venous thrombosis',
          reason:
            'Cerebral venous thrombosis is a defined secondary cause of raised intracranial pressure and excludes an idiopathic label.',
        },
      ],
      finalReasonLessLikely:
        'The intracranial hypertension has a demonstrated venous thrombotic cause and is therefore not idiopathic.',
    },
    {
      diagnosis: 'Subarachnoid Haemorrhage',
      whyPlausibleEarly:
        'Severe headache with nausea can reflect intracranial haemorrhage.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence: 'progressive headache over six days rather than abrupt maximal-at-onset pain',
          reason:
            'Aneurysmal subarachnoid haemorrhage classically presents with sudden severe headache reaching maximal intensity rapidly.',
        },
        {
          clueOrder: 1,
          evidence: 'no meningism and no thunderclap onset',
          reason:
            'The clinical pattern is less supportive of meningeal blood irritation.',
        },
        {
          clueOrder: 4,
          evidence: 'no diffuse subarachnoid blood on non-contrast CT',
          reason:
            'The imaging pattern instead shows a focal parasagittal haemorrhagic lesion with venous characteristics.',
        },
      ],
      finalReasonLessLikely:
        'The tempo, examination, parenchymal imaging pattern, and venography favour venous thrombosis rather than aneurysmal subarachnoid haemorrhage.',
    },
    {
      diagnosis: 'Arterial Ischaemic Stroke',
      whyPlausibleEarly:
        'A focal seizure followed by unilateral weakness can accompany a focal cerebral vascular event.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence: 'headache and raised-pressure symptoms evolve for several days before focal deficit',
          reason:
            'The subacute headache-predominant prodrome is less typical of an abrupt arterial occlusion syndrome.',
        },
        {
          clueOrder: 4,
          evidence: 'haemorrhagic lesion with oedema not respecting a single arterial territory',
          reason:
            'Venous infarcts commonly cross arterial boundaries and may be haemorrhagic because impaired venous outflow raises capillary pressure.',
        },
        {
          clueOrder: 5,
          evidence: 'direct superior sagittal sinus thrombosis on CT venography',
          reason:
            'The vascular lesion is in the cerebral venous system rather than an arterial circulation.',
        },
      ],
      finalReasonLessLikely:
        'The lesion distribution and venography localise the vascular problem to venous outflow rather than an arterial occlusion.',
    },
    {
      diagnosis: 'Intracranial Space-Occupying Lesion',
      whyPlausibleEarly:
        'Progressive headache, papilloedema, focal seizure, and focal neurological deficit can occur with a brain tumour or other mass lesion.',
      ruledOutByClues: [
        {
          clueOrder: 4,
          evidence: 'small haemorrhagic parasagittal lesion without a large mass lesion',
          reason:
            'CT does not show a space-occupying process sufficient to explain the syndrome and instead shows a vascular-pattern lesion.',
        },
        {
          clueOrder: 5,
          evidence: 'superior sagittal sinus filling defect and adjacent cortical venous thrombosis',
          reason:
            'Venography directly identifies the mechanism responsible for intracranial hypertension and cortical injury.',
        },
      ],
      finalReasonLessLikely:
        'A venous thrombotic lesion explains the raised pressure, seizure, and haemorrhagic cortical injury without evidence of a primary mass.',
    },
    {
      diagnosis: 'Meningitis',
      whyPlausibleEarly:
        'Headache, nausea, neurological deterioration, and seizures can occur with central nervous system infection.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'no fever, neck stiffness, photophobia, or persistent vomiting',
          reason:
            'The absence of systemic and meningeal inflammatory features weakens meningitis, although atypical infection remains possible early.',
        },
        {
          clueOrder: 2,
          evidence: 'no meningism with papilloedema as the dominant examination finding',
          reason:
            'The examination localises the syndrome more strongly to raised intracranial pressure than meningeal irritation.',
        },
        {
          clueOrder: 5,
          evidence: 'venographically proven superior sagittal sinus thrombosis',
          reason:
            'The venous occlusion provides a direct non-infectious explanation for the clinical syndrome.',
        },
      ],
      finalReasonLessLikely:
        'There is no infectious syndrome and venous imaging establishes the diagnosis.',
    },
  ] satisfies DifferentialAnalysisEntry[],
  managementPearl:
    'Treat Cerebral Venous Thrombosis as an acute cerebrovascular emergency. Confirm the venous diagnosis with appropriate neurovascular imaging, assess for intracranial haemorrhage, mass effect, seizures and raised intracranial pressure, and start therapeutic anticoagulation when appropriate after contraindications are assessed. A haemorrhagic venous infarct caused by the thrombosis is not by itself a reason to assume anticoagulation is contraindicated. Treat seizures when they occur, address provoking factors, and escalate urgently for neurological deterioration, impending herniation, or thrombus progression despite appropriate therapy.',
  generationQuality: {
    contentTier: 'FLAGSHIP',
    seedVersion,
    humanReviewed: true,
    discriminatorStrength: 'HIGH',
    clueProgressionVerified: true,
    breakdownClueReferencesValidated: true,
    reasoningStoredAsString: true,
    educationIndependentOfCase: true,
    expectedTeachingPoints: [
      'CVT can present primarily as a progressive headache before focal neurological signs develop',
      'Raised intracranial pressure may cause papilloedema and transient visual obscurations',
      'Focal seizures and deficits suggest cortical involvement rather than isolated primary headache',
      'Pregnancy, puerperium, estrogen exposure and other prothrombotic states are important risk factors',
      'Venous infarcts may be haemorrhagic and often do not respect arterial vascular territories',
      'CT venography or MR venography is required to demonstrate venous sinus or cortical vein occlusion',
      'A normal D-dimer cannot reliably exclude CVT when clinical suspicion is high',
      'Treatment requires anticoagulation and management of complications, with escalation for clinical deterioration',
    ],
    competencyDomains: [
      'Neurology',
      'Vascular Neurology',
      'Emergency Medicine',
      'Neuroimaging',
      'Headache Medicine',
      'Thrombosis',
      'Clinical Reasoning',
    ],
  },
};

const educationForFrontend = {
  title: displayLabel,
  summary: {
    definition:
      'Cerebral Venous Thrombosis is thrombosis of the intracranial dural venous sinuses, cortical veins, or deep cerebral veins, causing impaired venous drainage. The resulting rise in venous and capillary pressure can produce intracranial hypertension, vasogenic or cytotoxic oedema, venous infarction, and intracranial haemorrhage.',
    highYieldTakeaway:
      'Think of Cerebral Venous Thrombosis when a new or unusual headache is accompanied by papilloedema, seizures, focal deficits, encephalopathy, or a haemorrhagic brain lesion that does not fit a conventional arterial territory—especially when a prothrombotic risk factor is present.',
  },
  recognitionPattern: [
    {
      pattern: 'Progressive or unusual headache',
      whyItMatters:
        'Headache is the most common presenting symptom and may precede neurological deficits by days.',
      progression:
        'Venous outflow obstruction -> increased venous and intracranial pressure -> progressive headache, often worsened by manoeuvres that further increase intracranial pressure.',
      discriminator:
        'A new progressive headache with papilloedema, seizure, focal deficit, or atypical neuroimaging should trigger venous imaging rather than being labelled a primary headache disorder.',
      commonTrap:
        'Do not require a thunderclap headache; CVT often evolves subacutely.',
    },
    {
      pattern: 'Raised intracranial pressure syndrome',
      whyItMatters:
        'Venous sinus obstruction can impair cerebrospinal-fluid absorption and raise intracranial pressure even before focal brain injury appears.',
      progression:
        'Dural sinus obstruction -> impaired pressure homeostasis -> papilloedema, transient visual obscurations, sixth-nerve palsy, and headache.',
      discriminator:
        'Secondary venous causes must be excluded before calling a papilloedema syndrome idiopathic intracranial hypertension.',
      commonTrap:
        'Normal limb power and sensation do not exclude CVT when papilloedema and concerning headache features are present.',
    },
    {
      pattern: 'Cortical irritation and focal neurological dysfunction',
      whyItMatters:
        'Cortical venous congestion can cause seizures, focal deficits, and encephalopathy.',
      progression:
        'Venous congestion -> oedema or venous infarction -> cortical irritation -> seizure and focal neurological deficit.',
      discriminator:
        'Seizure at presentation is more characteristic of CVT than of many common arterial ischaemic strokes, particularly in younger adults.',
      commonTrap:
        'Do not dismiss transient post-seizure weakness as the whole diagnosis when a preceding progressive headache suggests an underlying structural cause.',
    },
    {
      pattern: 'Venous-pattern brain injury',
      whyItMatters:
        'Venous infarction behaves differently from arterial infarction and may be haemorrhagic.',
      progression:
        'Blocked venous drainage -> elevated capillary pressure -> oedema, blood-brain-barrier disruption, tissue injury, and possible haemorrhage.',
      discriminator:
        'Haemorrhagic or oedematous lesions crossing arterial boundaries, particularly parasagittal or bilateral lesions, should raise suspicion for venous occlusion.',
      commonTrap:
        'Do not assume that intracerebral blood automatically excludes a thrombotic diagnosis.',
    },
  ],
  keySymptoms: [
    {
      symptom: 'Headache',
      significance:
        'May be progressive, diffuse, migraine-like, thunderclap, or associated with features of raised intracranial pressure. The pattern is variable, so context and accompanying neurological findings matter.',
    },
    {
      symptom: 'Transient visual obscurations or visual disturbance',
      significance:
        'May reflect papilloedema from raised intracranial pressure or involvement of visual pathways.',
    },
    {
      symptom: 'Seizure',
      significance:
        'Often indicates cortical involvement from venous congestion, oedema, infarction, or haemorrhage.',
    },
    {
      symptom: 'Focal weakness, sensory change, or language disturbance',
      significance:
        'Can result from focal venous infarction and may fluctuate as venous congestion evolves.',
    },
    {
      symptom: 'Altered mental status',
      significance:
        'May occur with extensive thrombosis, deep venous involvement, seizures, diffuse oedema, or raised intracranial pressure.',
    },
  ],
  keySigns: [
    {
      finding: 'Papilloedema',
      significance:
        'Indicates raised intracranial pressure and is a key clue in headache-predominant CVT.',
      discriminator:
        'Its presence demands evaluation for a secondary intracranial cause rather than assumption of a primary headache disorder.',
    },
    {
      finding: 'Focal neurological deficit',
      significance:
        'Suggests parenchymal injury from venous infarction or haemorrhage.',
      discriminator:
        'Deficits that accompany headache, seizure, or lesions outside arterial territories support a venous mechanism.',
    },
    {
      finding: 'Reduced level of consciousness',
      significance:
        'May indicate extensive thrombosis, seizures, deep venous system involvement, mass effect, or impending herniation.',
      discriminator:
        'Clinical deterioration requires urgent repeat assessment and escalation.',
    },
    {
      finding: 'Sixth cranial nerve palsy',
      significance:
        'Can occur as a false-localising sign of raised intracranial pressure.',
      discriminator:
        'It supports intracranial hypertension but does not identify the cause without imaging.',
    },
  ],
  examPearls: [
    {
      type: 'HISTORY',
      title: 'Characterise the headache trajectory',
      content:
        'Ask whether the headache is new, progressive, unusual for the patient, worsened by lying flat or Valsalva, associated with visual obscurations, seizures, focal symptoms, or altered mental status.',
      whyItMatters:
        'CVT is often delayed because the early syndrome can resemble migraine or another primary headache.',
      discriminator:
        'Progression plus neurological or raised-pressure features is more important than any single headache descriptor.',
      trapAvoided:
        'Do not require thunderclap onset before considering a cerebral vascular cause.',
    },
    {
      type: 'RISK',
      title: 'Search for provoking factors',
      content:
        'Assess pregnancy and puerperium, estrogen-containing hormones, prior venous thromboembolism, active malignancy, inflammatory disease, systemic or local infection, dehydration, haematological disorders, and relevant inherited or acquired thrombophilia when clinically indicated.',
      whyItMatters:
        'Risk-factor identification supports diagnosis and helps determine duration and secondary-prevention strategy.',
      discriminator:
        'A risk factor strengthens suspicion but is not required; CVT can occur without an immediately identified trigger.',
      trapAvoided:
        'Do not stop investigating solely because the patient lacks a classic prothrombotic history.',
    },
    {
      type: 'EXAM',
      title: 'Look specifically for intracranial hypertension and focal cortical signs',
      content:
        'Assess mental status, visual acuity, pupils, ocular movements, fundoscopy, cranial nerves, motor and sensory function, reflexes, coordination, language, and signs of meningism.',
      whyItMatters:
        'Papilloedema, sixth-nerve palsy, seizure-related findings, or a focal deficit can convert an apparently isolated headache into an urgent secondary-headache syndrome.',
      discriminator:
        'Papilloedema plus focal or seizure phenomena should strongly prompt venous neuroimaging.',
      trapAvoided:
        'Do not treat a normal initial limb examination as evidence against CVT.',
    },
    {
      type: 'SAFETY',
      title: 'Recognise deterioration early',
      content:
        'Repeatedly reassess consciousness, focal deficits, seizures, vision, severe headache, vomiting, and signs of mass effect or herniation.',
      whyItMatters:
        'CVT can worsen through thrombus propagation, expanding oedema or haemorrhage, recurrent seizures, or rising intracranial pressure.',
      discriminator:
        'New drowsiness, pupillary change, progressive deficit, or refractory seizures requires urgent escalation.',
      trapAvoided:
        'Do not rely on the initial scan or neurological examination when the clinical state is changing.',
    },
  ],
  scoringSystems: [],
  investigations: [
    {
      test: 'Non-contrast CT brain',
      interpretation:
        'May be normal or may show venous infarction, oedema, intracranial haemorrhage, or occasionally a hyperdense thrombosed sinus. A normal non-contrast CT does not exclude CVT.',
      whyItMatters:
        'It rapidly identifies haemorrhage, mass effect, and alternative diagnoses but is not sufficient as the sole venous test when suspicion remains.',
    },
    {
      test: 'CT venography',
      interpretation:
        'Demonstrates failure of venous opacification, intraluminal filling defects, or occluded dural sinus and cortical venous segments.',
      whyItMatters:
        'It is a widely available definitive imaging approach for suspected CVT and can be performed immediately after non-contrast CT.',
    },
    {
      test: 'MRI brain with MR venography',
      interpretation:
        'Can demonstrate thrombus, absent venous flow, venous infarction, oedema, microhaemorrhage, and deep venous involvement with superior tissue characterisation.',
      whyItMatters:
        'MRI/MRV is particularly useful when CT findings are equivocal, cortical-vein thrombosis is suspected, or detailed parenchymal assessment is required.',
    },
    {
      test: 'D-dimer',
      interpretation:
        'An elevated result may support venous thrombosis, but a normal result does not reliably exclude CVT, especially with isolated headache or a longer symptom duration.',
      whyItMatters:
        'Clinical suspicion and appropriate venous imaging should take precedence over a negative D-dimer when the presentation is concerning.',
    },
    {
      test: 'Full blood count, renal function, liver tests, coagulation profile and pregnancy testing when relevant',
      interpretation:
        'These tests assess anaemia, thrombocytopenia, organ function, baseline haemostasis, pregnancy status, and treatment considerations.',
      whyItMatters:
        'They support safe acute management and can reveal contributing systemic disease.',
    },
    {
      test: 'Targeted thrombosis and provoking-factor assessment',
      interpretation:
        'Testing should be guided by age, personal and family venous-thromboembolism history, provoking factors, recurrent thrombosis, unusual clinical context, and whether the result would change management.',
      whyItMatters:
        'Indiscriminate thrombophilia testing can be misleading, while targeted assessment may identify a persistent risk factor that affects secondary prevention.',
    },
    {
      test: 'Lumbar puncture',
      interpretation:
        'May show raised opening pressure but is not the diagnostic test for CVT and should only be considered after appropriate neuroimaging has excluded a mass lesion or other contraindication.',
      whyItMatters:
        'Raised opening pressure can support intracranial hypertension, but venous imaging is required to identify a thrombotic cause.',
    },
  ],
  differentialDistinguishers: [
    {
      diagnosis: 'Migraine with Aura',
      overlap:
        'Headache, nausea, transient visual symptoms, sensory symptoms, or weakness.',
      distinguishingFeatures:
        'Migraine usually has a recurrent stereotyped pattern and does not cause papilloedema, venous infarction, or abnormal cerebral venography.',
      decisiveClue:
        'Papilloedema, seizure, a new focal deficit, or venous-pattern imaging should trigger evaluation for secondary headache including CVT.',
    },
    {
      diagnosis: 'Idiopathic Intracranial Hypertension',
      overlap:
        'Headache, papilloedema, pulsatile tinnitus, transient visual obscurations, and sixth-nerve palsy.',
      distinguishingFeatures:
        'Idiopathic intracranial hypertension should not produce a focal haemorrhagic venous infarct or demonstrable sinus thrombosis.',
      decisiveClue:
        'Venous imaging is required to exclude CVT before the raised intracranial pressure is considered idiopathic.',
    },
    {
      diagnosis: 'Subarachnoid Haemorrhage',
      overlap: 'Severe headache, vomiting, seizure, and altered consciousness.',
      distinguishingFeatures:
        'Aneurysmal subarachnoid haemorrhage more commonly has abrupt thunderclap onset and subarachnoid blood on imaging.',
      decisiveClue:
        'Venographic sinus occlusion and venous-pattern parenchymal injury support CVT.',
    },
    {
      diagnosis: 'Arterial Ischaemic Stroke',
      overlap: 'Focal deficit, seizure, infarction, and sometimes haemorrhagic transformation.',
      distinguishingFeatures:
        'Arterial strokes generally conform to an arterial territory and more often present abruptly, whereas CVT frequently has a headache-predominant prodrome and venous-pattern lesions.',
      decisiveClue:
        'CTV or MRV demonstrating venous sinus or cortical vein occlusion establishes the venous mechanism.',
    },
    {
      diagnosis: 'Intracranial Space-Occupying Lesion',
      overlap:
        'Progressive headache, papilloedema, seizures, focal deficits, and raised intracranial pressure.',
      distinguishingFeatures:
        'Structural imaging shows a mass rather than a thrombosed venous structure, although malignancy may itself be a CVT risk factor.',
      decisiveClue:
        'Venography directly demonstrates the obstructed cerebral venous channel.',
    },
    {
      diagnosis: 'Meningitis',
      overlap: 'Headache, vomiting, seizures, encephalopathy, and raised intracranial pressure.',
      distinguishingFeatures:
        'Fever, meningism, systemic infection, inflammatory cerebrospinal-fluid findings, or an infectious source make meningitis more likely.',
      decisiveClue:
        'Venous imaging proving thrombosis identifies CVT, although infection can occasionally precipitate septic cerebral venous thrombosis.',
    },
  ],
  managementOverview: [
    {
      step: 'Stabilise and assess neurological severity',
      rationale:
        'Address airway, breathing, circulation, level of consciousness, seizures, focal deficits, vision, intracranial pressure, and evidence of impending herniation.',
    },
    {
      step: 'Confirm the venous diagnosis promptly',
      rationale:
        'CT venography or MR venography is required because non-contrast CT alone can be normal or non-specific.',
    },
    {
      step: 'Start therapeutic anticoagulation when appropriate',
      rationale:
        'Anticoagulation is the foundation of acute treatment because it limits thrombus propagation and supports recanalisation. A haemorrhagic venous infarct caused by CVT does not automatically preclude anticoagulation; the overall bleeding context and contraindications must be assessed.',
    },
    {
      step: 'Treat seizures and neurological complications',
      rationale:
        'Clinical seizures require treatment, and recurrent seizures, extensive cortical injury, or status epilepticus may require specialist neurological management.',
    },
    {
      step: 'Manage raised intracranial pressure and visual risk',
      rationale:
        'Papilloedema, visual decline, mass effect, and severe intracranial hypertension require active management with neurology, stroke, ophthalmology, critical-care, or neurosurgical input as appropriate.',
    },
    {
      step: 'Escalate selected deteriorating cases',
      rationale:
        'Endovascular treatment may be considered in carefully selected patients with clinical deterioration or thrombus progression despite appropriate medical therapy. Decompressive surgery can be life-saving when malignant oedema or haemorrhage threatens herniation.',
    },
    {
      step: 'Identify and address provoking factors',
      rationale:
        'Review pregnancy and puerperium, estrogen exposure, infection, inflammatory disease, malignancy, haematological disease, and other prothrombotic conditions to guide treatment and prevention.',
    },
    {
      step: 'Plan secondary prevention and follow-up',
      rationale:
        'The duration and choice of longer-term anticoagulation depend on whether the event was provoked, persistent risk factors, recurrence risk, bleeding risk, pregnancy considerations, and specialist guidance. Follow-up should also address headache, seizures, cognition, mood, vision, and functional recovery.',
    },
  ],
  complications: [
    'Venous cerebral infarction',
    'Intracerebral or subarachnoid haemorrhage',
    'Cerebral oedema and mass effect',
    'Raised intracranial pressure and visual loss',
    'Seizures and status epilepticus',
    'Focal neurological disability',
    'Encephalopathy or coma',
    'Thrombus propagation',
    'Brain herniation',
    'Recurrent venous thromboembolism',
    'Persistent headache, cognitive symptoms, fatigue, or mood disturbance after the acute event',
  ],
  pitfalls: [
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Calling a progressive headache migraine without looking for secondary features',
      content:
        'CVT may initially present with headache alone, particularly before focal neurological findings develop.',
      whyItMatters:
        'Diagnostic delay allows progression to seizure, infarction, haemorrhage, or worsening intracranial pressure.',
      trapAvoided:
        'Ask whether the headache is new, progressive, unusual, positional, associated with visual obscurations, papilloedema, seizure, or focal symptoms.',
    },
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Diagnosing idiopathic intracranial hypertension before excluding venous thrombosis',
      content:
        'CVT can produce the same headache, papilloedema, and visual symptoms as idiopathic intracranial hypertension.',
      whyItMatters:
        'Missing the venous cause changes treatment and exposes the patient to thrombus progression.',
      trapAvoided:
        'Obtain appropriate venous imaging when evaluating unexplained intracranial hypertension.',
    },
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Using a normal non-contrast CT to exclude CVT',
      content:
        'Non-contrast CT can be normal or show non-specific findings in CVT.',
      whyItMatters:
        'A negative initial CT may falsely reassure clinicians despite a high-risk clinical syndrome.',
      trapAvoided:
        'Proceed to CT venography or MR venography when suspicion remains.',
    },
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Using a normal D-dimer as a definitive rule-out test',
      content:
        'D-dimer sensitivity is imperfect, particularly in isolated headache and more prolonged presentations.',
      whyItMatters:
        'A false-negative result can delay definitive venous imaging.',
      trapAvoided:
        'Base the need for imaging on the whole clinical picture rather than D-dimer alone.',
    },
    {
      type: 'SAFETY',
      title: 'Assuming haemorrhage means the process cannot be thrombotic',
      content:
        'Venous infarction is frequently haemorrhagic because venous congestion raises capillary pressure.',
      whyItMatters:
        'Misinterpreting haemorrhage can obscure the underlying venous occlusion and delay disease-specific treatment.',
      trapAvoided:
        'Consider venous thrombosis when haemorrhage is atypically located, associated with disproportionate oedema, or does not respect an arterial territory.',
    },
    {
      type: 'SAFETY',
      title: 'Missing neurological deterioration',
      content:
        'Thrombus propagation, recurrent seizure, expanding haemorrhage, oedema, or rising intracranial pressure can cause rapid clinical decline.',
      whyItMatters:
        'Selected patients may require critical care, endovascular rescue, or decompressive surgery.',
      trapAvoided:
        'Repeat neurological assessment and imaging when the clinical state worsens.',
    },
    {
      type: 'FOLLOW_UP',
      title: 'Stopping at the acute diagnosis without evaluating the trigger',
      content:
        'CVT may be provoked by pregnancy or puerperium, estrogen exposure, infection, systemic inflammation, malignancy, haematological disease, or another thrombotic condition.',
      whyItMatters:
        'The cause influences recurrence risk, prevention, future hormone or pregnancy counselling, and duration of therapy.',
      trapAvoided:
        'Perform a targeted provoking-factor assessment rather than treating the clot as an isolated event.',
    },
  ],
  recallPrompts: [
    {
      prompt: 'What is the most common presenting symptom of Cerebral Venous Thrombosis?',
      answer: 'Headache.',
    },
    {
      prompt:
        'Which examination finding suggests raised intracranial pressure in a headache-predominant CVT presentation?',
      answer: 'Papilloedema.',
    },
    {
      prompt:
        'Which neurological event commonly suggests cortical involvement in CVT?',
      answer: 'A focal or generalised seizure.',
    },
    {
      prompt:
        'What imaging pattern should make a haemorrhagic brain lesion suspicious for venous rather than arterial infarction?',
      answer:
        'A haemorrhagic or oedematous lesion that does not respect a conventional arterial vascular territory.',
    },
    {
      prompt: 'Which imaging studies directly evaluate the cerebral venous system?',
      answer: 'CT venography or MR venography.',
    },
    {
      prompt: 'Can a normal D-dimer reliably exclude CVT in every patient?',
      answer:
        'No. If clinical suspicion is significant, appropriate venous imaging is still required.',
    },
    {
      prompt:
        'Does a haemorrhagic venous infarct automatically exclude therapeutic anticoagulation?',
      answer:
        'No. Haemorrhagic venous infarction is part of the disease spectrum; anticoagulation decisions are based on the full clinical context and contraindications.',
    },
    {
      prompt:
        'Name major provoking settings that should be considered in CVT.',
      answer:
        'Pregnancy or puerperium, estrogen exposure, infection, malignancy, inflammatory disease, haematological disease, and other inherited or acquired prothrombotic states.',
    },
    {
      prompt:
        'Why must CVT be excluded before diagnosing idiopathic intracranial hypertension?',
      answer:
        'Because venous sinus thrombosis can produce the same raised-intracranial-pressure syndrome but requires disease-specific treatment.',
    },
  ],
  references: [
    {
      citation:
        'Saposnik G, et al. Diagnosis and Management of Cerebral Venous Thrombosis: A Scientific Statement From the American Heart Association. Stroke. 2024;55:e77-e90.',
    },
    {
      citation:
        'Ferro JM, et al. European Stroke Organization guideline for the diagnosis and treatment of cerebral venous thrombosis - endorsed by the European Academy of Neurology. Eur J Neurol. 2017;24:1203-1213.',
    },
    {
      citation:
        'Weimar C, et al. New recommendations on cerebral venous and dural sinus thrombosis from the German consensus-based (S2k) guideline. Neurological Research and Practice. 2024.',
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

  if (reasoningSteps.length !== clues.length) {
    throw new Error(
      `Expected one reasoning step per clue; received ${reasoningSteps.length} reasoning steps for ${clues.length} clues.`,
    );
  }

  if (typeof explanation.reasoning !== 'string' || !explanation.reasoning.trim()) {
    throw new Error('explanation.reasoning must be stored as one non-empty string.');
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

    if (!entry.explanation.trim() || !entry.diagnosticContribution.trim()) {
      throw new Error(
        `Clue breakdown ${clue.order} has an empty explanation or diagnostic contribution.`,
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
    });
  });

  const educationText = normalizeClinicalText(
    JSON.stringify(educationForFrontend),
  );

  const caseSpecificEducationTerms = [
    '27 year old',
    'six days',
    'eight weeks ago',
    'right arm',
    'left parasagittal',
    'this patient',
    'this case',
    'her headache',
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
    specialty: 'Neurology',
    subspecialty: 'Vascular Neurology',
    category: 'Cerebral Venous Thrombotic Disorder',
    bodySystem: 'Neurological',
    organSystem: 'Brain / Cerebral Venous System',
    difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
    rarityBand: DiagnosisRarityBand.UNCOMMON,
    clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
    ageGroup: DiagnosisAgeGroup.ADULT,
    urgencyLevel: DiagnosisUrgencyLevel.EMERGENT,
    preferredClueTypes: ['history', 'symptom', 'exam', 'imaging'],
    notes:
      'Seeded flagship Cerebral Venous Thrombosis case focused on progressive secondary headache, intracranial hypertension, papilloedema, focal seizure, venous-pattern haemorrhagic injury, and confirmatory cerebral venography.',
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
      'Skipped diagnosis education because Cerebral Venous Thrombosis education already exists:',
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
        ? 'Skipped existing scheduled Cerebral Venous Thrombosis case.'
        : 'Skipped existing Cerebral Venous Thrombosis case to avoid overwriting authored content.',
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
  const symptoms = [clues[0].value, clues[1].value, clues[3].value];

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
      'Seeded complete frontend-aligned flagship Cerebral Venous Thrombosis case with six supported clues, a progressive raised-intracranial-pressure to focal-cortical progression, venous-pattern imaging, exact clue-breakdown alignment, reasoning stored as a frontend-compatible string, and diagnosis-level education independent of the case.',
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
        'Created complete Cerebral Venous Thrombosis revision with six supported clue types, exact clue-to-breakdown matching, secondary-headache reasoning, cortical seizure evolution, venous infarction interpretation, and confirmatory CT venography.',
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
      validatorVersion: 'flagship-human-review:cerebral-venous-thrombosis-v1',
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        clueProgressionVerified: true,
        breakdownClueReferencesValidated: true,
        reasoningStoredAsString: true,
        educationIndependentOfCase: true,
        playableClueCount: clues.length,
        clueTypes: clues.map((clue) => clue.type),
        duplicateSafe: true,
        doesNotOverwriteExistingEducation: true,
        doesNotOverwriteExistingCase: true,
        metadataVerified: {
          specialty: 'Neurology',
          subspecialty: 'Vascular Neurology',
          category: 'Cerebral Venous Thrombotic Disorder',
          bodySystem: 'Neurological',
          organSystem: 'Brain / Cerebral Venous System',
          difficultyBand: 'INTERMEDIATE',
          rarityBand: 'UNCOMMON',
          clinicalSetting: 'EMERGENCY',
          ageGroup: 'ADULT',
          urgencyLevel: 'EMERGENT',
        },
        note:
          'Complete Cerebral Venous Thrombosis flagship seed with six supported clue types, no early diagnosis-label leakage, exact clue-to-breakdown alignment, learner-compatible string reasoning, progressive raised-intracranial-pressure and cortical localisation, venous-pattern neuroimaging, and independent diagnosis education.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded Cerebral Venous Thrombosis:', {
    registryId: params.diagnosisRegistryId,
    caseId: seededCase.id,
    revisionId: revision.id,
    publicNumber,
    educationId: params.educationId,
    assignedDate: assignedDate.toISOString(),
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
