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
 * FLAGSHIP CASE SEED - Anterior Spinal Artery Syndrome
 *
 * Clinical focus:
 * - Hyperacute spinal cord dysfunction after thoracoabdominal aortic surgery.
 * - Acute spinal shock with flaccid paraplegia and areflexia.
 * - Loss of pain and temperature below a sensory level.
 * - Preservation of vibration and joint-position sense.
 * - Early MRI used to exclude a compressive emergency.
 * - Repeat diffusion-weighted MRI showing an anterior spinal cord infarction pattern.
 *
 * Safety:
 * - Reuses or creates the diagnosis registry and accepted aliases.
 * - Does not overwrite existing diagnosis education.
 * - Does not overwrite an existing case with the same title.
 * - Does not alter a scheduled DailyCase.
 *
 * Run:
 *   npx tsx prisma/seed/flagship-anterior-spinal-artery-syndrome.seed.ts
 *
 * Railway:
 *   railway run npx tsx prisma/seed/flagship-anterior-spinal-artery-syndrome.seed.ts
 */

const databaseUrl = resolvePgConnectionString(process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required to run the Anterior Spinal Artery Syndrome seed.',
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
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 2, 18, 12, 0, 0));
const seedVersion = 'flagship-anterior-spinal-artery-syndrome-v1';

const canonicalName = 'anterior spinal artery syndrome';
const displayLabel = 'Anterior Spinal Artery Syndrome';
const caseTitle =
  'Acute Paraplegia Following Thoracoabdominal Aortic Surgery';

const aliasTerms = [
  'Anterior Spinal Artery Syndrome',
  'anterior spinal cord syndrome',
  'anterior cord syndrome',
  'ventral cord syndrome',
  'anterior spinal artery infarction',
  'anterior spinal cord infarction',
];

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 68-year-old man develops sudden severe mid-thoracic back pain and rapidly progressive weakness of both legs two hours after open repair of a thoracoabdominal aortic aneurysm. The operative record documents approximately 25 minutes of marked hypotension during aortic cross-clamping.',
  },
  {
    order: 1,
    type: 'symptom',
    value:
      'Within 30 minutes he is unable to move either leg, describes numbness beginning around the umbilicus, and cannot pass urine. He has no facial weakness, speech disturbance, visual symptoms, or upper-limb weakness.',
  },
  {
    order: 2,
    type: 'exam',
    value:
      'Neurological examination shows flaccid paraplegia with 0/5 power in both lower limbs, absent knee and ankle reflexes, and mute plantar responses. Upper-limb power, cranial nerves, and cognition are normal.',
  },
  {
    order: 3,
    type: 'exam',
    value:
      'There is a sensory level at approximately T10. Pinprick and temperature sensation are absent below this level, while vibration at the ankles and great-toe joint-position sense remain intact. Anal tone is reduced and the bladder is distended.',
  },
  {
    order: 4,
    type: 'imaging',
    value:
      'Urgent MRI of the thoracic and lumbar spine performed three hours after symptom onset shows no epidural haematoma, abscess, disc extrusion, or other cord compression. The spinal cord signal is initially equivocal, and CT angiography shows an intact aortic repair without dissection.',
  },
  {
    order: 5,
    type: 'imaging',
    value:
      'Repeat MRI 24 hours later demonstrates restricted diffusion and a longitudinal pencil-like T2 hyperintensity involving the anterior two-thirds of the cord from T8 to the conus. Axial images show bilateral anterior-horn "owl-eye" signal with relative sparing of the posterior columns.',
  },
] as const;

const differentials = [
  'Postoperative Spinal Epidural Haematoma',
  'Acute Transverse Myelitis',
  'Guillain-Barre Syndrome',
  'Cauda Equina Syndrome',
  'Bilateral Anterior Cerebral Artery Infarction',
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

  if (new Set(differentials.map(normalizeClinicalText)).size !== differentials.length) {
    throw new Error('Differentials contain duplicate diagnoses.');
  }
}

const explanation = {
  diagnosis: displayLabel,
  summary:
    'Hyperacute bilateral leg paralysis after thoracoabdominal aortic surgery and prolonged hypotension, a thoracic sensory level, selective loss of pain and temperature with preserved vibration and proprioception, exclusion of compressive pathology, and delayed diffusion restriction in the anterior two-thirds of the cord support Anterior Spinal Artery Syndrome.',
  reasoning: [
    'The abrupt onset of severe back pain and bilateral leg weakness during a high-risk aortic perioperative setting favors a vascular spinal cord event over a gradually evolving inflammatory, infectious, or neoplastic myelopathy.',
    'Absence of cranial, cortical, visual, speech, and upper-limb findings localizes the acute deficit below the brain and cervical cord.',
    'Flaccid paraplegia and areflexia in the first hours reflect acute spinal shock; these findings do not exclude a spinal cord lesion and may later evolve into spasticity and hyperreflexia.',
    'A defined T10 sensory level localizes the lesion to the spinal cord rather than peripheral nerves or isolated lumbosacral roots.',
    'Loss of pain and temperature with preserved vibration and joint-position sense is the key tract pattern: spinothalamic and corticospinal structures are affected while the posterior columns are relatively spared.',
    'Urinary retention and reduced anal tone indicate autonomic involvement within an acute thoracic myelopathy.',
    'The first MRI appropriately excludes epidural haematoma and other surgically reversible compression; an early MRI can be normal or equivocal in cord ischaemia.',
    'Repeat MRI with restricted diffusion, longitudinal anterior-cord signal, bilateral anterior-horn involvement, and posterior-column sparing confirms an anterior spinal arterial territory infarction pattern.',
  ],
  keyFindings: [
    'Thoracoabdominal aortic aneurysm repair',
    'Prolonged intraoperative hypotension during aortic cross-clamping',
    'Sudden severe mid-thoracic back pain',
    'Weakness progressing to paraplegia within 30 minutes',
    'Urinary retention',
    'No cranial or cortical neurological deficits',
    'Acute flaccid paraplegia',
    'Absent lower-limb reflexes during spinal shock',
    'T10 sensory level',
    'Loss of pinprick and temperature below the lesion',
    'Preserved vibration and joint-position sense',
    'Reduced anal tone and distended bladder',
    'No epidural haematoma or cord compression',
    'Initially equivocal spinal cord MRI',
    'Restricted diffusion in the anterior two-thirds of the cord',
    'Pencil-like sagittal T2 hyperintensity',
    'Bilateral anterior-horn owl-eye pattern',
    'Relative posterior-column sparing',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Postoperative Spinal Epidural Haematoma',
      whyPlausibleEarly:
        'Acute back pain, paraplegia, sensory loss, and bladder dysfunction after major surgery may result from an expanding epidural haematoma compressing the cord.',
      ruledOutByClues: [
        {
          clueOrder: 3,
          evidence:
            'selective loss of pain and temperature with preserved vibration and joint-position sense',
          reason:
            'A sharply dissociated sensory pattern is more characteristic of selective anterior cord tract involvement than indiscriminate external cord compression.',
        },
        {
          clueOrder: 4,
          evidence:
            'urgent MRI shows no epidural haematoma or other cord compression',
          reason:
            'The defining structural cause is absent on the study required to exclude a surgically reversible compressive emergency.',
        },
        {
          clueOrder: 5,
          evidence:
            'restricted diffusion in the anterior two-thirds of the cord with posterior-column sparing',
          reason:
            'The follow-up imaging demonstrates an ischaemic vascular-territory pattern rather than extrinsic compression.',
        },
      ],
      finalReasonLessLikely:
        'Although postoperative epidural haematoma must be excluded immediately, MRI shows no compressive lesion and instead demonstrates anterior spinal cord infarction.',
    },
    {
      diagnosis: 'Acute Transverse Myelitis',
      whyPlausibleEarly:
        'Transverse myelitis can produce acute bilateral weakness, a sensory level, and bowel or bladder dysfunction.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence:
            'deficits reach severe intensity within 30 minutes after prolonged aortic cross-clamp hypotension',
          reason:
            'Hyperacute onset in a clear hypoperfusion setting is more typical of spinal cord ischaemia than inflammatory myelitis.',
        },
        {
          clueOrder: 3,
          evidence:
            'pain and temperature are lost while vibration and proprioception remain intact',
          reason:
            'Transverse myelitis more often causes a broader or less selectively dissociated sensory deficit.',
        },
        {
          clueOrder: 5,
          evidence:
            'restricted diffusion confined predominantly to the anterior two-thirds with bilateral anterior-horn signal',
          reason:
            'This distribution follows an arterial territory and supports infarction rather than a nonspecific inflammatory cord lesion.',
        },
      ],
      finalReasonLessLikely:
        'The hyperacute time course, peri-aortic hypoperfusion trigger, tract-selective examination, and diffusion-positive anterior-cord pattern favor vascular infarction.',
    },
    {
      diagnosis: 'Guillain-Barre Syndrome',
      whyPlausibleEarly:
        'Flaccid bilateral leg weakness and areflexia can initially suggest an acute inflammatory polyradiculoneuropathy.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence:
            'numbness begins at the umbilicus with early urinary retention',
          reason:
            'A defined truncal sensory level and early sphincter dysfunction point to the spinal cord rather than a length-dependent peripheral neuropathy.',
        },
        {
          clueOrder: 3,
          evidence:
            'T10 sensory level with selective loss of pain and temperature',
          reason:
            'Guillain-Barre syndrome does not produce a true spinal sensory level or dorsal-column-sparing anterior cord pattern.',
        },
        {
          clueOrder: 5,
          evidence:
            'intramedullary diffusion restriction in the anterior spinal cord',
          reason:
            'The MRI demonstrates a central nervous system infarction rather than a peripheral nerve-root disorder.',
        },
      ],
      finalReasonLessLikely:
        'Areflexia is explained by acute spinal shock; the sensory level, sphincter involvement, dissociated sensation, and cord MRI exclude Guillain-Barre syndrome.',
    },
    {
      diagnosis: 'Cauda Equina Syndrome',
      whyPlausibleEarly:
        'Flaccid paraplegia, reduced anal tone, urinary retention, and absent lower-limb reflexes can occur with severe lumbosacral root compression.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'numbness begins around the umbilicus',
          reason:
            'An umbilical sensory level is far above the lumbosacral dermatomes expected in cauda equina syndrome.',
        },
        {
          clueOrder: 3,
          evidence:
            'T10 sensory level with preserved vibration and joint-position sense',
          reason:
            'This is a tract-based spinal cord pattern rather than an asymmetric root or saddle-distribution neuropathy.',
        },
        {
          clueOrder: 4,
          evidence:
            'MRI shows no disc extrusion or other compressive lesion',
          reason:
            'There is no structural cauda equina compression.',
        },
        {
          clueOrder: 5,
          evidence:
            'abnormal signal is located within the anterior spinal cord from T8 to the conus',
          reason:
            'The lesion is intramedullary and extends above the cauda equina.',
        },
      ],
      finalReasonLessLikely:
        'The high sensory level and intramedullary anterior-cord infarction pattern localize the disorder to the spinal cord rather than lumbosacral roots.',
    },
    {
      diagnosis: 'Bilateral Anterior Cerebral Artery Infarction',
      whyPlausibleEarly:
        'Bilateral anterior cerebral artery territory injury can cause predominant leg weakness and urinary dysfunction.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence:
            'no facial weakness, speech disturbance, visual symptoms, or upper-limb weakness',
          reason:
            'The absence of cortical and cranial findings makes a cerebral hemispheric syndrome less likely.',
        },
        {
          clueOrder: 2,
          evidence:
            'cranial nerves and cognition are normal',
          reason:
            'There is no associated abulia, altered behavior, aphasia, or other cortical sign to support bilateral cerebral infarction.',
        },
        {
          clueOrder: 3,
          evidence:
            'a T10 sensory level with selective spinothalamic loss',
          reason:
            'A truncal sensory level and dissociated tract findings localize to the spinal cord.',
        },
        {
          clueOrder: 5,
          evidence:
            'MRI demonstrates restricted diffusion within the anterior thoracic spinal cord',
          reason:
            'Imaging directly identifies the symptomatic spinal lesion.',
        },
      ],
      finalReasonLessLikely:
        'The neurological examination and MRI localize the lesion to the thoracic spinal cord rather than the cerebral hemispheres.',
    },
  ],
  managementPearl:
    'Treat this as a time-critical acute myelopathy: stabilize airway and circulation, correct hypotension and hypoxaemia, obtain urgent MRI to exclude compressive lesions, investigate and treat the underlying vascular or aortic cause, involve neurology, spinal, vascular, and critical-care teams, provide venous-thromboembolism and pressure-injury prevention, manage bladder and bowel dysfunction, and begin early rehabilitation. Thrombolysis, anticoagulation, antiplatelet therapy, cerebrospinal-fluid drainage, or perfusion targets are cause- and context-dependent specialist decisions rather than universal treatment for every spontaneous spinal cord infarction.',
  generationQuality: {
    contentTier: 'FLAGSHIP',
    seedVersion,
    humanReviewed: true,
    discriminatorStrength: 'VERY_HIGH',
    clueProgressionVerified: true,
    expectedTeachingPoints: [
      'Anterior spinal artery syndrome causes bilateral motor dysfunction and loss of pain and temperature below the lesion',
      'Vibration and proprioception are relatively preserved because the posterior columns have a different arterial supply',
      'Acute spinal cord infarction may initially present with flaccidity and areflexia because of spinal shock',
      'Aortic surgery, aortic disease, and profound hypotension are major causes of anterior spinal cord ischaemia',
      'Urgent MRI must first exclude epidural haematoma and other compressive emergencies',
      'An early MRI may be normal or equivocal; repeat MRI with diffusion imaging can reveal infarction',
      'Pencil-like sagittal signal and bilateral anterior-horn owl-eye signal support anterior spinal arterial territory involvement',
    ],
    competencyDomains: [
      'Neurology',
      'Vascular Neurology',
      'Spinal Cord Localization',
      'Neuroradiology',
      'Emergency Neurology',
      'Perioperative Medicine',
    ],
  },
};

const educationForFrontend = {
  title: displayLabel,
  summary: {
    definition:
      'Anterior Spinal Artery Syndrome is an acute spinal cord syndrome caused by injury or ischaemia affecting the anterior two-thirds of the cord, including the corticospinal tracts, anterior horns, spinothalamic tracts, and autonomic pathways, with relative preservation of the posterior columns.',
    highYieldTakeaway:
      'Recognize hyperacute bilateral weakness with loss of pain and temperature below a sensory level but preserved vibration and proprioception, especially after aortic surgery, aortic pathology, or severe hypotension.',
  },
  recognitionPattern: [
    {
      pattern: 'Hyperacute painful myelopathy in a vascular-risk setting',
      whyItMatters:
        'Severe deficits reaching maximum intensity within minutes to a few hours strongly favor a vascular cord event over most inflammatory, infectious, or neoplastic myelopathies.',
      progression:
        'Back pain at the lesion level -> rapidly progressive bilateral weakness -> sensory level -> autonomic dysfunction.',
      discriminator:
        'Aortic surgery, aortic dissection, prolonged cross-clamping, or profound hypotension substantially increases the probability of spinal cord ischaemia.',
      commonTrap:
        'Do not assume postoperative paraplegia is residual anaesthesia or peripheral neuropathy without urgent spinal localization and imaging.',
    },
    {
      pattern: 'Anterior cord sensory dissociation',
      whyItMatters:
        'The sensory pattern links bedside examination directly to spinal vascular anatomy.',
      progression:
        'Spinothalamic dysfunction causes loss of pain and temperature, while relative posterior-column preservation maintains vibration and joint-position sense.',
      discriminator:
        'The combination of motor paralysis, pain-temperature loss, and preserved dorsal-column modalities is more specific than weakness alone.',
      commonTrap:
        'Do not document "reduced sensation" generically; test pinprick, temperature, vibration, and joint position separately.',
    },
    {
      pattern: 'Acute spinal shock followed by upper-motor-neuron signs',
      whyItMatters:
        'Immediately after cord infarction, the legs may be flaccid and areflexic even though the lesion interrupts descending upper-motor-neuron pathways.',
      progression:
        'Early flaccidity and areflexia -> evolving tone -> later spasticity, hyperreflexia, and extensor plantar responses.',
      discriminator:
        'A sensory level and sphincter dysfunction prevent misclassification as an isolated peripheral neuropathy.',
      commonTrap:
        'Do not exclude a spinal cord lesion because reflexes are absent during the acute phase.',
    },
    {
      pattern: 'Initially negative or equivocal MRI with later diffusion-positive disease',
      whyItMatters:
        'Cord ischaemia may not be visible on the first conventional MRI, particularly within the first several hours.',
      progression:
        'Urgent imaging excludes compression -> continued clinical suspicion -> repeat MRI with diffusion-weighted sequences demonstrates infarction.',
      discriminator:
        'Anterior-territory restricted diffusion, pencil-like sagittal signal, and bilateral anterior-horn signal support a vascular cause.',
      commonTrap:
        'Do not abandon the diagnosis after one early MRI if the examination and time course remain strongly vascular.',
    },
  ],
  keySymptoms: [
    {
      symptom: 'Sudden severe back or neck pain',
      significance:
        'Pain at the lesion level often accompanies acute spinal cord ischaemia and helps establish the hyperacute onset.',
    },
    {
      symptom: 'Rapid bilateral limb weakness',
      significance:
        'Paraparesis, paraplegia, quadriparesis, or quadriplegia depends on the rostrocaudal level and severity of the lesion.',
    },
    {
      symptom: 'Loss of pain and temperature below the lesion',
      significance:
        'This reflects bilateral spinothalamic tract involvement within the anterior spinal arterial territory.',
    },
    {
      symptom: 'Urinary retention or bowel dysfunction',
      significance:
        'Autonomic pathway involvement is common and may appear early in thoracic or conus-level infarction.',
    },
    {
      symptom: 'Relative preservation of vibration and position sense',
      significance:
        'Patients may still detect vibration or toe movement despite profound weakness and absent pinprick sensation.',
    },
  ],
  keySigns: [
    {
      finding: 'Bilateral motor weakness below a spinal level',
      significance:
        'Corticospinal tract and anterior-horn involvement causes severe motor dysfunction.',
      discriminator:
        'A clear spinal level separates cord disease from generalized peripheral neuropathy.',
    },
    {
      finding: 'Dissociated sensory loss',
      significance:
        'Pain and temperature are reduced or absent while vibration and proprioception remain relatively preserved.',
      discriminator:
        'This tract-selective pattern is the bedside hallmark of anterior cord involvement.',
    },
    {
      finding: 'Flaccidity and areflexia during acute spinal shock',
      significance:
        'Acute cord injury temporarily suppresses reflex activity below the lesion.',
      discriminator:
        'The later emergence of spasticity and hyperreflexia is expected, but clinicians should localize correctly before this evolution occurs.',
    },
    {
      finding: 'Sensory level on the trunk',
      significance:
        'A reproducible sensory level strongly supports a spinal cord lesion.',
      discriminator:
        'Peripheral neuropathies and cauda equina lesions do not usually produce a high, sharply defined truncal sensory level.',
    },
    {
      finding: 'Reduced anal tone or neurogenic bladder',
      significance:
        'Sphincter findings indicate autonomic involvement and increase urgency.',
      discriminator:
        'Early sphincter dysfunction is uncommon in uncomplicated Guillain-Barre syndrome and supports myelopathy.',
    },
  ],
  examPearls: [
    {
      type: 'DISCRIMINATOR',
      title: 'Test the dorsal columns separately',
      content:
        'Assess vibration at the ankles and great toes and test joint-position sense rather than recording all sensation as one domain.',
      whyItMatters:
        'Relative preservation of these modalities despite loss of pinprick and temperature reveals posterior-column sparing.',
      discriminator:
        'Pain-temperature loss with intact vibration-position sense supports anterior cord syndrome.',
      trapAvoided:
        'Do not miss the diagnosis by using only light touch as the sensory examination.',
    },
    {
      type: 'LOCALIZATION',
      title: 'Areflexia can still be a cord lesion',
      content:
        'In the first hours or days after severe cord injury, spinal shock can produce flaccid weakness and absent reflexes.',
      whyItMatters:
        'This prevents premature diagnosis of Guillain-Barre syndrome or cauda equina disease.',
      discriminator:
        'A truncal sensory level, sphincter involvement, and dissociated sensation maintain spinal cord localization.',
      trapAvoided:
        'Do not require spasticity or Babinski signs before diagnosing an acute cord syndrome.',
    },
    {
      type: 'ESCALATION',
      title: 'Exclude compression before accepting infarction',
      content:
        'Urgent MRI should evaluate the symptomatic spinal levels and often the broader spine when localization is uncertain.',
      whyItMatters:
        'Epidural haematoma, abscess, disc extrusion, and other compression may require immediate surgical treatment.',
      escalationImplication:
        'Acute paraplegia with back pain and sphincter dysfunction warrants emergency imaging and specialist review.',
      trapAvoided:
        'Do not delay imaging while waiting for the neurological examination to evolve.',
    },
    {
      type: 'IMAGING',
      title: 'An early normal MRI does not exclude cord ischaemia',
      content:
        'Conventional T2 signal may be absent or subtle early; diffusion-weighted imaging and repeat MRI can increase diagnostic confidence.',
      whyItMatters:
        'The clinical time course and tract pattern may be more informative than the first scan.',
      discriminator:
        'Restricted diffusion and anterior-territory signal on follow-up imaging favor infarction over many inflammatory mimics.',
      trapAvoided:
        'Do not close the diagnostic work-up after a single early non-compressive MRI.',
    },
  ],
  scoringSystems: [
    {
      id: 'isncsci-asia-classification',
      name:
        'International Standards for Neurological Classification of Spinal Cord Injury (ISNCSCI/ASIA)',
      use:
        'Documents the neurological level, sensory and motor deficits, sacral sparing, and completeness of spinal cord injury.',
      components: [
        'Standardized key muscle testing',
        'Pinprick and light-touch sensory testing',
        'Sacral sensory and motor examination',
        'Neurological level of injury',
        'ASIA Impairment Scale grade',
      ],
      caution:
        'This classification measures neurological impairment and prognosis; it does not determine whether the cause is infarction, inflammation, trauma, or compression.',
    },
  ],
  investigations: [
    {
      test: 'Urgent MRI of the spine with and without contrast when appropriate',
      interpretation:
        'First exclude epidural haematoma, abscess, disc extrusion, tumour, and other compressive lesions. Early cord signal may be normal or equivocal.',
      whyItMatters:
        'Compression is a time-critical, potentially reversible alternative diagnosis.',
    },
    {
      test: 'Diffusion-weighted MRI and apparent diffusion coefficient mapping',
      interpretation:
        'Restricted diffusion supports acute spinal cord infarction. Anterior-horn owl-eye signal and longitudinal pencil-like anterior-cord signal may be seen.',
      whyItMatters:
        'Diffusion imaging helps distinguish acute ischaemia from some inflammatory or non-ischaemic lesions.',
    },
    {
      test: 'Repeat spinal MRI when initial imaging is non-diagnostic',
      interpretation:
        'T2 and diffusion abnormalities may become more conspicuous after the first several hours or over the next one to two days.',
      whyItMatters:
        'A single early negative MRI should not overrule a strongly vascular clinical syndrome.',
    },
    {
      test: 'CT or MR angiography of the aorta and relevant vasculature',
      interpretation:
        'Evaluate for aortic dissection, aneurysm complications, graft problems, severe atherosclerosis, vertebral disease, or another vascular source.',
      whyItMatters:
        'Identifying a treatable underlying vascular cause changes urgent management.',
    },
    {
      test: 'Targeted vascular and embolic evaluation',
      interpretation:
        'Assess ECG or cardiac monitoring, echocardiography, glucose, lipids, blood count, coagulation profile, renal function, and selected thrombophilia or vasculitis studies according to age and context.',
      whyItMatters:
        'Spinal cord infarction is a syndrome with several possible mechanisms rather than a single uniform disease.',
    },
    {
      test: 'Cerebrospinal fluid analysis when an inflammatory or infectious mimic remains likely',
      interpretation:
        'A non-inflammatory result supports infarction, whereas pleocytosis, marked protein elevation, oligoclonal bands, or pathogen evidence may redirect the diagnosis.',
      whyItMatters:
        'Lumbar puncture is secondary to urgent imaging and should be selected according to the differential, procedural safety, and anticoagulation status.',
    },
  ],
  differentialDistinguishers: [
    {
      diagnosis: 'Postoperative Spinal Epidural Haematoma',
      overlap:
        'Acute back pain, paraplegia, a sensory level, and sphincter dysfunction after surgery.',
      distinguishingFeatures:
        'MRI demonstrates an epidural collection and cord compression rather than isolated anterior intramedullary diffusion restriction.',
      decisiveClue:
        'Emergency MRI excludes or identifies the compressive lesion.',
    },
    {
      diagnosis: 'Acute Transverse Myelitis',
      overlap:
        'Bilateral weakness, sensory level, and bowel or bladder dysfunction.',
      distinguishingFeatures:
        'Often evolves over hours to days, may have inflammatory CSF or associated systemic features, and usually lacks a clean anterior arterial-territory diffusion pattern.',
      decisiveClue:
        'Hyperacute maximal deficit plus vascular trigger and diffusion-positive anterior-cord imaging favor infarction.',
    },
    {
      diagnosis: 'Guillain-Barre Syndrome',
      overlap:
        'Flaccid weakness and areflexia.',
      distinguishingFeatures:
        'No true truncal sensory level, no selective spinothalamic loss, usually no early severe sphincter dysfunction, and no intramedullary cord lesion.',
      decisiveClue:
        'A spinal sensory level with dorsal-column sparing localizes to the cord.',
    },
    {
      diagnosis: 'Cauda Equina Syndrome',
      overlap:
        'Flaccid leg weakness, areflexia, saddle or lower-body sensory loss, and bladder dysfunction.',
      distinguishingFeatures:
        'Root-pattern weakness and sensory loss, often asymmetric, without a high thoracic sensory level; MRI may reveal lumbosacral root compression.',
      decisiveClue:
        'An intramedullary thoracic lesion and tract-selective sensory findings exclude isolated cauda equina disease.',
    },
    {
      diagnosis: 'Bilateral Anterior Cerebral Artery Infarction',
      overlap:
        'Predominant leg weakness and urinary dysfunction.',
      distinguishingFeatures:
        'Cortical features such as abulia, behavioral change, aphasia, or frontal release signs may occur; there is no spinal sensory level.',
      decisiveClue:
        'A T10 sensory level and spinal diffusion restriction localize the lesion to the cord.',
    },
  ],
  managementOverview: [
    {
      step: 'Stabilize airway, breathing, circulation, and spinal cord perfusion',
      rationale:
        'Correct hypoxaemia and hypotension promptly because ongoing systemic hypoperfusion may extend spinal cord injury.',
    },
    {
      step: 'Obtain emergency MRI and exclude a compressive cause',
      rationale:
        'Epidural haematoma, abscess, and other compression require different and potentially immediate surgical treatment.',
    },
    {
      step: 'Identify and treat the underlying vascular mechanism',
      rationale:
        'Management differs for aortic dissection, perioperative hypoperfusion, embolism, severe atherosclerotic disease, vasculitis, or another cause.',
    },
    {
      step: 'Use specialist-directed antithrombotic or reperfusion decisions',
      rationale:
        'Antiplatelet therapy, anticoagulation, or thrombolysis may be considered in selected contexts, but none is a universal treatment for all spinal cord infarctions.',
    },
    {
      step: 'Prevent secondary complications',
      rationale:
        'Provide venous-thromboembolism prophylaxis when safe, pressure-area care, bladder and bowel management, respiratory monitoring, pain control, and infection prevention.',
    },
    {
      step: 'Begin early multidisciplinary rehabilitation',
      rationale:
        'Physiotherapy, occupational therapy, mobility planning, spasticity management, autonomic care, and psychosocial support improve function and independence.',
    },
  ],
  complications: [
    'Persistent paraplegia or paraparesis',
    'Spasticity and painful muscle spasms after spinal shock resolves',
    'Neurogenic bladder and recurrent urinary tract infection',
    'Neurogenic bowel and constipation',
    'Pressure injuries',
    'Venous thromboembolism',
    'Neuropathic pain',
    'Autonomic dysfunction',
    'Respiratory failure with high cervical involvement',
    'Loss of mobility and functional independence',
  ],
  pitfalls: [
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Mistaking spinal shock for peripheral neuropathy',
      content:
        'Flaccidity and areflexia can occur immediately after a severe spinal cord lesion.',
      whyItMatters:
        'A sensory level, sphincter dysfunction, and tract-selective sensory loss preserve spinal localization.',
      trapAvoided:
        'Do not diagnose Guillain-Barre syndrome from areflexia alone.',
    },
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Treating a normal early MRI as exclusionary',
      content:
        'Cord infarction may be radiologically occult or subtle during the first hours.',
      whyItMatters:
        'Repeat MRI with diffusion sequences may demonstrate the lesion later.',
      trapAvoided:
        'Do not abandon a vascular diagnosis when the clinical pattern remains compelling.',
    },
    {
      type: 'ESCALATION',
      title: 'Failing to exclude epidural compression urgently',
      content:
        'Postoperative back pain and paraplegia may represent epidural haematoma or another compressive emergency.',
      whyItMatters:
        'Delay can remove the opportunity for effective decompression.',
      trapAvoided:
        'Do not proceed directly to lumbar puncture or rehabilitation before emergency imaging.',
    },
    {
      type: 'MANAGEMENT',
      title: 'Assuming one universal acute drug treatment',
      content:
        'Evidence for thrombolysis, anticoagulation, antiplatelet therapy, steroids, and neuroprotective drugs is limited or mechanism-dependent.',
      whyItMatters:
        'Treatment should target the cause, maintain physiology, prevent complications, and involve appropriate specialists.',
      trapAvoided:
        'Do not apply cerebral-stroke or inflammatory-myelitis protocols automatically without considering bleeding risk, aortic pathology, timing, and diagnostic certainty.',
    },
    {
      type: 'IMAGING',
      title: 'Calling the owl-eye sign pathognomonic',
      content:
        'Bilateral anterior-horn signal supports anterior spinal cord infarction but can occur in other cord disorders.',
      whyItMatters:
        'Imaging must be integrated with the time course, examination, diffusion findings, and exclusion of compression.',
      trapAvoided:
        'Do not diagnose the syndrome from one axial MRI sign in isolation.',
    },
  ],
  recallPrompts: [
    {
      id: 'asa-sensory-dissociation',
      type: 'SHORT_ANSWER',
      prompt:
        'Which sensory modalities are typically lost and preserved in Anterior Spinal Artery Syndrome?',
      answer:
        'Pain and temperature are lost below the lesion, while vibration and proprioception are relatively preserved.',
      explanation:
        'The anterior spinal circulation supplies the spinothalamic pathways, whereas the posterior columns are supplied mainly by the posterior spinal arteries.',
      linkedConcept: 'Spinal cord tract localization',
      sourceSection: 'Clinical Pattern',
      difficulty: 'BASIC',
    },
    {
      id: 'asa-acute-areflexia',
      type: 'WHY_IT_MATTERS',
      prompt:
        'Why can an acute anterior spinal cord infarction initially cause flaccidity and areflexia?',
      answer:
        'Acute spinal shock temporarily suppresses motor and reflex activity below the lesion before later upper-motor-neuron signs emerge.',
      explanation:
        'Recognizing spinal shock prevents misdiagnosis as Guillain-Barre syndrome or cauda equina disease.',
      linkedConcept: 'Spinal shock',
      sourceSection: 'Exam Pearls',
      difficulty: 'INTERMEDIATE',
    },
    {
      id: 'asa-early-mri',
      type: 'PEARL_RECALL',
      prompt:
        'What should be done when the first MRI excludes compression but is otherwise normal or equivocal despite a strongly vascular cord syndrome?',
      answer:
        'Maintain clinical suspicion and repeat spinal MRI with diffusion-weighted sequences.',
      explanation:
        'MRI abnormalities may lag behind symptom onset in acute spinal cord infarction.',
      linkedConcept: 'MRI timing in spinal cord infarction',
      sourceSection: 'Investigations',
      difficulty: 'INTERMEDIATE',
    },
    {
      id: 'asa-compression-vs-infarction',
      type: 'DISTINGUISH',
      prompt:
        'What is the decisive early distinction between postoperative epidural haematoma and anterior spinal cord infarction?',
      answer:
        'Emergency MRI identifies or excludes an epidural compressive lesion; infarction produces an intramedullary vascular-territory pattern, often on repeat diffusion imaging.',
      explanation:
        'Both can cause acute back pain and paraplegia, but only compression may require immediate decompression.',
      linkedConcept: 'Acute postoperative paraplegia',
      sourceSection: 'Differentials',
      difficulty: 'ADVANCED',
    },
    {
      id: 'asa-aortic-risk',
      type: 'CLOZE',
      prompt:
        'Aortic surgery and profound ______ are major risk settings for anterior spinal cord ischaemia.',
      answer: 'hypotension',
      explanation:
        'Aortic cross-clamping, interruption of radiculomedullary supply, and systemic hypoperfusion can compromise the anterior spinal circulation.',
      linkedConcept: 'Spinal cord vascular supply',
      sourceSection: 'Clinical Pattern',
      difficulty: 'BASIC',
    },
  ],
  references: [
    'Sandoval JI, De Jesus O. Anterior Spinal Artery Syndrome. StatPearls. Updated 2024.',
    'Zalewski NL, et al. Characteristics of Spontaneous Spinal Cord Infarction and Proposed Diagnostic Criteria. JAMA Neurology. 2019;76(1):56-63.',
    'Vargas MI, et al. Spinal Cord Ischemia: Practical Imaging Tips, Pearls, and Pitfalls. AJNR American Journal of Neuroradiology. 2015;36(5):825-830.',
    'Yadav N, et al. Spinal Cord Infarction: Clinical and Radiological Features. Journal of Stroke and Cerebrovascular Diseases. 2018;27(10):2810-2821.',
    'Nardone R, et al. Current and Emerging Treatment Options for Spinal Cord Ischemia. Drug Discovery Today. 2016;21(10):1632-1641.',
  ],
};

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
    select: {
      id: true,
      displayLabel: true,
    },
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
    category: 'Spinal Cord Vascular Disorders',
    bodySystem: 'Nervous System',
    organSystem: 'Spinal Cord',
    difficultyBand: DiagnosisDifficultyBand.ADVANCED,
    rarityBand: DiagnosisRarityBand.UNCOMMON,
    clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
    ageGroup: DiagnosisAgeGroup.ADULT,
    urgencyLevel: DiagnosisUrgencyLevel.EMERGENT,
    preferredClueTypes: ['history', 'symptom', 'exam', 'imaging'],
    notes:
      'Flagship neurology registry entry emphasizing hyperacute vascular myelopathy, anterior cord tract localization, peri-aortic hypoperfusion, urgent exclusion of compression, and delayed diffusion-positive MRI.',
  };

  const registry = existing
    ? await prisma.diagnosisRegistry.update({
        where: { id: existing.id },
        data: registryData,
        select: {
          id: true,
          displayLabel: true,
        },
      })
    : await prisma.diagnosisRegistry.create({
        data: registryData,
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

async function ensureEducation(diagnosisRegistryId: string) {
  const existing = await prisma.diagnosisEducation.findUnique({
    where: { diagnosisRegistryId },
    select: {
      id: true,
      version: true,
      editorialStatus: true,
    },
  });

  if (existing) {
    console.log(
      'Skipped existing Anterior Spinal Artery Syndrome diagnosis education to avoid overwriting editorial content.',
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
    select: {
      id: true,
      version: true,
      editorialStatus: true,
    },
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

async function seedCase(params: {
  diagnosisRegistryId: string;
  registryDisplayLabel: string;
  educationId: string;
}) {
  const existingCases = await prisma.case.findMany({
    where: {
      diagnosisRegistryId: params.diagnosisRegistryId,
      title: caseTitle,
    },
    orderBy: [{ approvedAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      title: true,
      publicNumber: true,
      editorialStatus: true,
      currentRevisionId: true,
      dailyCases: {
        select: {
          id: true,
          date: true,
        },
        take: 5,
      },
    },
  });

  if (existingCases.length > 0) {
    console.log(
      'Skipped existing Anterior Spinal Artery Syndrome case to avoid overwriting case content.',
      existingCases,
    );
    return;
  }

  const assignedDate = await findAvailableInventoryPlaceholderDate({
    preferredDate: inventoryPlaceholderDate,
    displayLabel: caseTitle,
  });

  const publicNumber = await getNextCasePublicNumber();
  const history = clues[0].value;
  const symptoms = [
    clues[0].value,
    clues[1].value,
  ];

  const caseData = {
    title: caseTitle,
    publicNumber,
    date: assignedDate,
    difficulty: 'advanced',
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
      'Seeded complete frontend-aligned flagship Anterior Spinal Artery Syndrome case with postoperative hypoperfusion, acute spinal shock, dissociated sensory loss, exclusion of compression, delayed diffusion-positive MRI, and full diagnosis education.',
  };

  const seededCase = await prisma.case.create({
    data: caseData,
    select: {
      id: true,
    },
  });

  const revision = await prisma.caseRevision.create({
    data: {
      caseId: seededCase.id,
      revisionNumber: 1,
      source: CaseSource.MANUAL,
      publishTrack: PublishTrack.DAILY,
      title: caseTitle,
      date: assignedDate,
      difficulty: 'advanced',
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
        'Created complete Anterior Spinal Artery Syndrome revision with clue-order-aligned differential analysis and full diagnosis education.',
    },
    select: {
      id: true,
    },
  });

  await prisma.case.update({
    where: { id: seededCase.id },
    data: {
      currentRevisionId: revision.id,
    },
  });

  await prisma.caseValidationRun.create({
    data: {
      caseId: seededCase.id,
      revisionId: revision.id,
      source: CaseSource.MANUAL,
      publishTrack: PublishTrack.DAILY,
      outcome: ValidationOutcome.PASSED,
      validatorVersion:
        'flagship-human-review:anterior-spinal-artery-syndrome-v1',
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        clueProgressionVerified: true,
        playableClueCount: clues.length,
        duplicateSafe: true,
        metadataVerified: {
          specialty: 'Neurology',
          subspecialty: 'Vascular Neurology',
          category: 'Spinal Cord Vascular Disorders',
          bodySystem: 'Nervous System',
          organSystem: 'Spinal Cord',
          difficultyBand: 'ADVANCED',
          rarityBand: 'UNCOMMON',
          clinicalSetting: 'EMERGENCY',
          ageGroup: 'ADULT',
          urgencyLevel: 'EMERGENT',
        },
        note:
          'Complete Anterior Spinal Artery Syndrome flagship seed with six supported playable clues, correctly aligned clueOrder references, non-compressive emergency exclusion, delayed diffusion-positive imaging, accepted aliases, and full education payload.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded Anterior Spinal Artery Syndrome:', {
    registryId: params.diagnosisRegistryId,
    registryDisplayLabel: params.registryDisplayLabel,
    caseId: seededCase.id,
    revisionId: revision.id,
    publicNumber,
    educationId: params.educationId,
    assignedDate: assignedDate.toISOString(),
    clueTypes: clues.map((clue) => clue.type),
  });
}

async function main() {
  assertSeedShape();

  const registry = await ensureRegistry();
  const education = await ensureEducation(registry.id);

  await seedCase({
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
