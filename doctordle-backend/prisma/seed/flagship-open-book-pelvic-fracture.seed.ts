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
 * FLAGSHIP CASE SEED - Open-Book Pelvic Fracture
 *
 * Clinical focus:
 * - High-energy anteroposterior compression mechanism.
 * - Pelvic-ring injury as a concealed source of major retroperitoneal bleeding.
 * - Avoidance of repeated pelvic compression or distracting manipulation.
 * - Early circumferential stabilization centred over the greater trochanters.
 * - Deliberate screening for urethral, bladder, rectal, vaginal, neurologic,
 *   abdominal, and lower-limb injuries.
 * - AP radiography followed by contrast-enhanced CT in a sufficiently stable patient.
 * - Rotational instability with preserved vertical alignment in an APC-II pattern.
 *
 * Education design:
 * - Case explanation is specific to the vignette.
 * - Diagnosis education is independent of the case and covers recognition,
 *   classification, haemorrhage control, imaging, associated injuries,
 *   definitive stabilization, complications, and common diagnostic traps.
 *
 * Safety:
 * - Reuses or creates the exact diagnosis registry and accepted aliases.
 * - Does not overwrite existing diagnosis education.
 * - Does not overwrite an existing case with the same title.
 * - Does not alter a scheduled DailyCase.
 *
 * Run:
 *   npx tsx prisma/seed/flagship-open-book-pelvic-fracture.seed.ts
 *
 * Railway:
 *   railway run npx tsx prisma/seed/flagship-open-book-pelvic-fracture.seed.ts
 */

const databaseUrl = resolvePgConnectionString(process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required to run the Open-Book Pelvic Fracture seed.',
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
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 6, 29, 12, 0, 0));
const seedVersion = 'flagship-open-book-pelvic-fracture-v1';

const canonicalName = 'open-book pelvic fracture';
const displayLabel = 'Open-Book Pelvic Fracture';
const caseTitle = 'Pelvic Pain and Shock After a High-Energy Collision';

const taxonomy = {
  specialty: 'Orthopaedics',
  subspecialty: 'Orthopaedic Trauma',
  category: 'Pelvic Ring Injury',
  bodySystem: 'Musculoskeletal',
  organSystem: 'Pelvis',
} as const;

const aliasTerms = [
  'Open-Book Pelvic Fracture',
  'Open Book Pelvic Fracture',
  'Open-Book Pelvic Ring Injury',
  'Anteroposterior Compression Pelvic Injury',
  'APC Pelvic Ring Injury',
];

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 36-year-old man is brought after a high-speed motorcycle collision. He was thrown forward and his lower abdomen and pelvis were compressed from front to back between the fuel tank and another vehicle. He immediately developed severe central pelvic and lower-back pain and has been unable to stand. There was no fall from height and no previous pelvic operation.',
  },
  {
    order: 1,
    type: 'vital',
    value:
      'He is pale and anxious with a pulse of 124/min, blood pressure 88/56 mmHg, respiratory rate 24/min, temperature 36.2°C, and oxygen saturation 97% on supplemental oxygen. The extremities are cool and capillary refill is delayed. There is no major external bleeding, and the initial extended focused trauma ultrasound shows no intraperitoneal free fluid or pericardial collection.',
  },
  {
    order: 2,
    type: 'exam',
    value:
      'There is marked suprapubic and posterior pelvic tenderness with bruising across the lower abdomen and perineum. Both legs are the same length, neither hip is fixed in rotation, and distal pulses and motor function are intact. The pelvis is not repeatedly compressed during examination. A circumferential binder is applied over the greater trochanters while haemorrhage resuscitation continues.',
  },
  {
    order: 3,
    type: 'lab',
    value:
      'Initial tests show haemoglobin 9.2 g/dL, lactate 5.1 mmol/L, base deficit 8 mmol/L, and creatinine 94 micromol/L. Urinalysis shows microscopic blood, but there is no blood at the urethral meatus and he can pass a small volume of urine. Cross-matched blood is prepared while serial physiology and haemoglobin are monitored.',
  },
  {
    order: 4,
    type: 'imaging',
    value:
      'An anteroposterior pelvis radiograph obtained with circumferential stabilization in place shows residual separation of the pubic symphysis measuring 3.6 cm and widening of the anterior aspects of both sacroiliac joints. There is no cephalad displacement of either hemipelvis, no acetabular fracture, and both femoral heads remain congruent with their sockets.',
  },
  {
    order: 5,
    type: 'imaging',
    value:
      'Contrast-enhanced CT confirms wide pubic-symphysis diastasis with bilateral anterior sacroiliac-joint disruption, while the posterior sacroiliac ligaments remain intact and there is no vertical translation. A moderate extraperitoneal pelvic haematoma is present without active arterial contrast extravasation. The pattern is rotationally unstable but vertically stable, establishing an anteroposterior-compression type II Open-Book Pelvic Fracture.',
  },
] as const;

const differentials = [
  'Lateral Compression Pelvic Ring Injury',
  'Vertical Shear Pelvic Ring Injury',
  'Acetabular Fracture',
  'Proximal Femur Fracture',
  'Isolated Pubic Rami Fracture',
  'Hip Dislocation',
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
  'A high-energy force that compresses the pelvis from front to back raises immediate concern for disruption of the anterior pelvic ring and possible opening of the sacroiliac complexes, while the inability to stand indicates more than a minor soft-tissue injury.',
  'Haemorrhagic shock without external bleeding or intraperitoneal fluid makes the retroperitoneal pelvis an important occult bleeding source and requires simultaneous resuscitation, stabilization, and exclusion of other thoracic, abdominal, and long-bone sources.',
  'Central pelvic tenderness and perineal bruising support pelvic-ring trauma; equal limb length and absence of a fixed rotational hip deformity make vertical shear, proximal femoral fracture, and hip dislocation less immediately likely. Avoiding repeated pelvic compression prevents disruption of early clot formation.',
  'Anaemia, hyperlactataemia, and base deficit support significant acute blood loss and tissue hypoperfusion. Microscopic haematuria prompts assessment for urinary injury, while the absence of meatal blood and preserved voiding reduce—but do not eliminate—the likelihood of major urethral disruption.',
  'Pubic-symphysis separation with bilateral anterior sacroiliac widening demonstrates external rotation of the hemipelves; preserved vertical alignment and congruent hips argue against vertical shear, acetabular disruption, or hip dislocation.',
  'CT confirms anterior sacroiliac-ligament disruption with an intact posterior complex, defining a rotationally unstable but vertically stable APC-II injury. The pelvic haematoma explains the shock, while absence of arterial extravasation does not exclude clinically important predominantly venous or cancellous bleeding.',
] as const;

const explanation = {
  diagnosis: displayLabel,
  summary:
    'A high-energy anteroposterior compression mechanism followed by pelvic pain, occult haemorrhagic shock, central pelvic tenderness, pubic-symphysis diastasis, bilateral anterior sacroiliac widening, and preserved posterior and vertical stability establishes an APC-II Open-Book Pelvic Fracture.',
  reasoning: reasoningSteps.join('\n'),
  clueBreakdown: [
    {
      clueOrder: 0,
      clueType: 'history',
      clue: clues[0].value,
      explanation: reasoningSteps[0],
      diagnosticContribution:
        'Introduces the direction of force and a major pelvic-ring injury without stating the final diagnosis.',
    },
    {
      clueOrder: 1,
      clueType: 'vital',
      clue: clues[1].value,
      explanation: reasoningSteps[1],
      diagnosticContribution:
        'Establishes haemorrhagic shock with no obvious external or intraperitoneal source, making pelvic bleeding a major concern.',
    },
    {
      clueOrder: 2,
      clueType: 'exam',
      clue: clues[2].value,
      explanation: reasoningSteps[2],
      diagnosticContribution:
        'Localises the injury to the pelvic ring, reduces several hip and femoral alternatives, and demonstrates safe early stabilization.',
    },
    {
      clueOrder: 3,
      clueType: 'lab',
      clue: clues[3].value,
      explanation: reasoningSteps[3],
      diagnosticContribution:
        'Objectively supports acute blood loss and hypoperfusion while screening for associated urinary-tract injury.',
    },
    {
      clueOrder: 4,
      clueType: 'imaging',
      clue: clues[4].value,
      explanation: reasoningSteps[4],
      diagnosticContribution:
        'Shows the defining external-rotation pelvic-ring pattern and excludes hip dislocation and major acetabular injury.',
    },
    {
      clueOrder: 5,
      clueType: 'imaging',
      clue: clues[5].value,
      explanation: reasoningSteps[5],
      diagnosticContribution:
        'Defines APC-II mechanical stability, identifies the retroperitoneal haematoma, and establishes the canonical diagnosis.',
    },
  ] satisfies ClueBreakdownEntry[],
  keyFindings: [
    'High-energy anteroposterior compression mechanism',
    'Immediate severe central pelvic pain',
    'Inability to stand',
    'Haemorrhagic shock without major external bleeding',
    'Negative extended focused trauma ultrasound for intraperitoneal fluid',
    'Suprapubic and posterior pelvic tenderness',
    'Lower abdominal and perineal bruising',
    'Equal leg lengths and no fixed hip deformity',
    'Pelvic binder positioned over the greater trochanters',
    'Anaemia with raised lactate and base deficit',
    'Microscopic haematuria without meatal blood',
    'Pubic-symphysis diastasis greater than 2.5 cm',
    'Bilateral anterior sacroiliac-joint widening',
    'No vertical hemipelvic translation',
    'Intact posterior sacroiliac ligament complex',
    'Extraperitoneal pelvic haematoma',
    'Rotational instability with vertical stability',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Lateral Compression Pelvic Ring Injury',
      whyPlausibleEarly:
        'High-energy pelvic trauma, pelvic pain, shock, and pelvic-ring tenderness can occur with either compression pattern.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence: 'compressed from front to back',
          reason:
            'The force direction favours external rotation rather than inward collapse of the hemipelvis.',
        },
        {
          clueOrder: 4,
          evidence: 'separation of the pubic symphysis measuring 3.6 cm',
          reason:
            'Symphyseal opening is inconsistent with the typical internal-rotation and ramus-overlap pattern of lateral compression.',
        },
      ],
      finalReasonLessLikely:
        'The mechanism and imaging show pelvic-ring opening rather than lateral inward compression.',
    },
    {
      diagnosis: 'Vertical Shear Pelvic Ring Injury',
      whyPlausibleEarly:
        'Severe pelvic pain and haemodynamic instability can reflect a vertically unstable pelvic-ring injury.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: 'Both legs are the same length',
          reason:
            'Major cephalad displacement of one hemipelvis may produce apparent limb-length asymmetry.',
        },
        {
          clueOrder: 5,
          evidence: 'there is no vertical translation',
          reason:
            'The CT directly excludes vertical displacement and complete posterior-ring instability.',
        },
      ],
      finalReasonLessLikely:
        'The posterior ligament complex and vertical alignment remain intact despite rotational instability.',
    },
    {
      diagnosis: 'Acetabular Fracture',
      whyPlausibleEarly:
        'High-energy trauma can produce deep pelvic or hip pain, inability to bear weight, bleeding, and associated femoral-head injury.',
      ruledOutByClues: [
        {
          clueOrder: 4,
          evidence: 'no acetabular fracture',
          reason:
            'The initial radiograph does not show disruption of the acetabular columns or walls.',
        },
        {
          clueOrder: 4,
          evidence: 'both femoral heads remain congruent with their sockets',
          reason:
            'Preserved femoroacetabular congruity argues against a fracture-dislocation centred on the acetabulum.',
        },
      ],
      finalReasonLessLikely:
        'Imaging localises the instability to the pelvic ring rather than the acetabular articular surface.',
    },
    {
      diagnosis: 'Proximal Femur Fracture',
      whyPlausibleEarly:
        'A proximal femoral fracture can cause severe pain and inability to stand after high-energy trauma.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: 'Both legs are the same length',
          reason:
            'A displaced proximal femoral fracture commonly produces shortening and external rotation.',
        },
        {
          clueOrder: 4,
          evidence: 'both femoral heads remain congruent with their sockets',
          reason:
            'The radiographic abnormality is pelvic-ring widening rather than disruption of the proximal femur.',
        },
      ],
      finalReasonLessLikely:
        'The clinical posture and radiographs do not show a proximal femoral fracture pattern.',
    },
    {
      diagnosis: 'Isolated Pubic Rami Fracture',
      whyPlausibleEarly:
        'Pubic-ramus injury can cause anterior pelvic pain, tenderness, and difficulty mobilising.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'blood pressure 88/56 mmHg',
          reason:
            'Profound shock is disproportionate to a straightforward isolated stable ramus fracture and suggests major ring disruption or another bleeding source.',
        },
        {
          clueOrder: 5,
          evidence: 'bilateral anterior sacroiliac-joint disruption',
          reason:
            'Posterior-ring involvement proves that the injury is not confined to the anterior pubic rami.',
        },
      ],
      finalReasonLessLikely:
        'The injury involves both the anterior ring and sacroiliac complexes and is mechanically unstable.',
    },
    {
      diagnosis: 'Hip Dislocation',
      whyPlausibleEarly:
        'High-energy trauma with severe pelvic or hip pain and inability to move may initially suggest traumatic hip dislocation.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: 'neither hip is fixed in rotation',
          reason:
            'Hip dislocation usually produces a characteristic fixed deformity and painful loss of congruity.',
        },
        {
          clueOrder: 4,
          evidence: 'both femoral heads remain congruent with their sockets',
          reason:
            'Radiographs confirm that neither femoral head is displaced from the acetabulum.',
        },
      ],
      finalReasonLessLikely:
        'The hip joints are congruent and the abnormality lies in the pelvic ring.',
    },
  ] satisfies DifferentialAnalysisEntry[],
  managementPearl:
    'Treat suspected unstable pelvic-ring injury as a haemorrhage emergency: continue trauma resuscitation, apply a correctly positioned circumferential binder over the greater trochanters, avoid repeated pelvic compression, assess for associated genitourinary and perineal injury, and coordinate orthopaedic and trauma haemorrhage control. Definitive treatment depends on mechanical stability, physiology, associated injuries, and local capabilities.',
  generationQuality: {
    contentTier: 'FLAGSHIP',
    seedVersion,
    humanReviewed: true,
    discriminatorStrength: 'HIGH',
    clueProgressionVerified: true,
    breakdownClueReferencesValidated: true,
    frontendReasoningStringValidated: true,
    educationIndependentOfCase: true,
    expectedTeachingPoints: [
      'Anteroposterior compression opens the anterior pelvic ring and may disrupt the sacroiliac complexes',
      'Pelvic fracture is an occult source of major retroperitoneal haemorrhage',
      'A binder belongs over the greater trochanters rather than the iliac crests',
      'Do not repeatedly spring or compress a suspected unstable pelvis',
      'APC-II injuries are rotationally unstable but retain posterior vertical stability',
      'Blood at the urethral meatus or inability to void should prompt urethral-injury assessment before blind catheterisation',
      'Absence of CT arterial extravasation does not exclude important pelvic bleeding',
      'Definitive haemorrhage and fixation strategy is guided by physiology and injury pattern',
    ],
    competencyDomains: [
      'Orthopaedics',
      'Orthopaedic Trauma',
      'Emergency Medicine',
      'Trauma Surgery',
      'Pelvic Ring Imaging',
      'Haemorrhage Control',
      'Clinical Reasoning',
    ],
  },
};

const educationForFrontend = {
  title: displayLabel,
  summary: {
    definition:
      'An Open-Book Pelvic Fracture is an anteroposterior-compression pelvic-ring injury in which external rotation of one or both hemipelves widens the pubic symphysis or anterior ring and may progressively disrupt the sacroiliac ligament complex.',
    highYieldTakeaway:
      'Recognise the combination of a high-energy front-to-back compression mechanism, severe pelvic pain, shock without an obvious source, and radiographic pelvic-ring opening. Stabilise the ring early, avoid repeated pelvic manipulation, search for associated injuries, and classify both haemodynamic and mechanical instability.',
  },
  recognitionPattern: [
    {
      pattern: 'Anteroposterior compression with pelvic-ring opening',
      whyItMatters:
        'The force externally rotates the hemipelves, disrupts the anterior ring, and can progressively injure the sacroiliac ligaments.',
      progression:
        'Anterior compression force -> symphyseal or pubic-ring disruption -> anterior sacroiliac opening -> possible complete posterior-ring failure.',
      discriminator:
        'Symphyseal diastasis and anterior sacroiliac widening contrast with the inward rotation and ramus overlap typical of lateral-compression injuries.',
      commonTrap:
        'Do not assume that an apparently reduced radiograph excludes the injury; a correctly applied binder can partly close the pelvic ring.',
    },
    {
      pattern: 'Pelvic injury with occult haemorrhagic shock',
      whyItMatters:
        'Venous plexus injury, cancellous-bone bleeding, and arterial injury can produce large retroperitoneal blood loss without visible external haemorrhage.',
      progression:
        'Pelvic-ring disruption -> vascular and bony bleeding -> loss of tamponade -> hypoperfusion and shock.',
      discriminator:
        'Persistent shock after excluding thoracic, intraperitoneal, external, and long-bone sources increases concern for pelvic haemorrhage.',
      commonTrap:
        'A negative abdominal focused ultrasound does not exclude retroperitoneal pelvic bleeding.',
    },
    {
      pattern: 'Mechanical stability differs across APC grades',
      whyItMatters:
        'The integrity of the posterior sacroiliac complex determines whether the injury is only rotationally unstable or also vertically unstable.',
      progression:
        'APC-I: limited anterior opening -> APC-II: anterior sacroiliac disruption with posterior complex intact -> APC-III: complete posterior-ring disruption.',
      discriminator:
        'APC-II is generally rotationally unstable but vertically stable; APC-III is unstable in both planes.',
      commonTrap:
        'Do not use symphyseal width alone as an absolute measure of ligament injury; integrate CT morphology and specialist stability assessment.',
    },
    {
      pattern: 'Associated genitourinary and perineal injury',
      whyItMatters:
        'Pelvic-ring disruption can injure the urethra, bladder, rectum, vagina, nerves, and soft tissues, altering immediate management.',
      progression:
        'Ring displacement and fragment movement -> soft-tissue traction or laceration -> urinary, rectal, neurologic, or open injury.',
      discriminator:
        'Meatal blood, inability to void, gross haematuria, perineal wound, rectal or vaginal bleeding, or neurologic deficit requires targeted assessment.',
      commonTrap:
        'Do not perform blind urethral catheterisation when major urethral disruption is suspected.',
    },
  ],
  keySymptoms: [
    {
      symptom: 'Severe central pelvic, groin, buttock, or lower-back pain',
      significance:
        'Reflects pelvic-ring and sacroiliac injury and is usually aggravated by movement or attempted weight bearing.',
    },
    {
      symptom: 'Inability to stand or transfer weight',
      significance:
        'Suggests a mechanically important pelvic injury rather than a minor soft-tissue contusion.',
    },
    {
      symptom: 'Dizziness, weakness, thirst, or collapse',
      significance:
        'May indicate occult blood loss and reduced tissue perfusion.',
    },
    {
      symptom: 'Difficulty voiding or visible urinary blood',
      significance:
        'Raises concern for urethral or bladder injury associated with pelvic trauma.',
    },
    {
      symptom: 'Perineal, genital, or rectal symptoms',
      significance:
        'May identify an open pelvic injury or associated soft-tissue and hollow-viscus damage.',
    },
  ],
  keySigns: [
    {
      finding: 'Shock physiology',
      significance:
        'Tachycardia, hypotension, cool peripheries, altered mentation, and delayed capillary refill may reflect major pelvic haemorrhage.',
      discriminator:
        'Continue searching for other bleeding sources even when a pelvic-ring injury is visible.',
    },
    {
      finding: 'Suprapubic, sacroiliac, or posterior pelvic tenderness',
      significance:
        'Supports pelvic-ring injury when interpreted with mechanism and imaging.',
      discriminator:
        'Tenderness is not a reason to repeatedly compress or spring the pelvis.',
    },
    {
      finding: 'Perineal, scrotal, labial, or lower-abdominal bruising',
      significance:
        'Suggests significant pelvic soft-tissue injury and should prompt assessment for open and genitourinary injury.',
      discriminator:
        'Inspect carefully without delaying haemorrhage control or destabilising the ring.',
    },
    {
      finding: 'Blood at the urethral meatus',
      significance:
        'Is a warning sign for urethral disruption, especially in men with pelvic-ring trauma.',
      discriminator:
        'Obtain appropriate urethral imaging before routine catheter passage when disruption is suspected.',
    },
    {
      finding: 'Neurologic or distal vascular deficit',
      significance:
        'May indicate lumbosacral plexus, nerve-root, or vascular injury and must be documented serially.',
      discriminator:
        'A normal initial examination does not replace reassessment after stabilization and definitive treatment.',
    },
  ],
  examPearls: [
    {
      type: 'SAFETY',
      title: 'Do not repeatedly spring the pelvis',
      content:
        'Use mechanism, pain, inspection, physiology, and imaging. Repeated compression can disturb clot formation and worsen bleeding.',
      whyItMatters:
        'Physical instability testing has limited value in a patient already suspected of major pelvic trauma.',
      discriminator:
        'A stable-feeling pelvis does not exclude an important ring injury, especially after binder placement.',
      trapAvoided:
        'Avoid repeated anteroposterior and lateral compression manoeuvres.',
    },
    {
      type: 'PROCEDURE',
      title: 'Place circumferential stabilization correctly',
      content:
        'Centre the binder or sheet over the greater trochanters, maintain skin protection, and document application time and distal examination.',
      whyItMatters:
        'Trochanteric placement more effectively reduces pelvic volume and anterior-ring opening than placement over the iliac crests.',
      discriminator:
        'A high abdominal binder may be ineffective and can leave the ring open.',
      trapAvoided:
        'Do not place the device around the waist or iliac wings.',
    },
    {
      type: 'ASSOCIATED_INJURY',
      title: 'Examine beyond the bones',
      content:
        'Inspect the perineum, genitalia, rectum, vagina when clinically indicated, abdomen, spine, hips, knees, and lower limbs; assess distal pulses and neurologic function.',
      whyItMatters:
        'Mortality and disability may result from haemorrhage, open injury, urinary disruption, abdominal trauma, nerve injury, or associated long-bone trauma.',
      discriminator:
        'The pelvic radiograph does not define every clinically important injury.',
      trapAvoided:
        'Do not let the striking ring injury end the trauma survey.',
    },
    {
      type: 'CLASSIFICATION',
      title: 'Describe mechanical and physiological severity',
      content:
        'Record the Young-Burgess or AO/OTA pattern, posterior-ring integrity, vertical displacement, haemodynamic status, and associated injuries.',
      whyItMatters:
        'Treatment depends on both mechanical instability and the patient’s response to resuscitation.',
      discriminator:
        'The same radiographic pattern may require different immediate haemorrhage-control pathways depending on physiology.',
      trapAvoided:
        'Do not treat classification as a substitute for ongoing clinical assessment.',
    },
  ],
  scoringSystems: [
    {
      name: 'Young-Burgess Anteroposterior Compression Classification',
      purpose:
        'Describes progressive pelvic-ring opening and ligament disruption after anteroposterior compression.',
      components: [
        'APC-I: limited anterior-ring opening with posterior structures functionally intact',
        'APC-II: anterior sacroiliac disruption with intact posterior sacroiliac complex; rotational instability',
        'APC-III: complete anterior and posterior sacroiliac disruption; rotational and vertical instability',
      ],
      interpretation:
        'Increasing grade generally reflects greater posterior-ring disruption, mechanical instability, haemorrhage risk, and need for operative stabilization.',
      caution:
        'Traditional symphyseal-width thresholds are useful clues but do not perfectly predict ligament integrity in every patient.',
    },
    {
      name: 'WSES Pelvic Trauma Classification',
      purpose:
        'Integrates pelvic-ring mechanical stability with haemodynamic status to guide early management.',
      components: [
        'Mechanical fracture pattern',
        'Haemodynamic stability or instability',
        'Associated injuries and response to resuscitation',
      ],
      interpretation:
        'Management urgency and haemorrhage-control strategy are driven by physiology as well as morphology.',
      caution:
        'Use alongside local trauma pathways and available surgical and interventional resources.',
    },
  ],
  investigations: [
    {
      test: 'Trauma-bay anteroposterior pelvis radiograph',
      interpretation:
        'May show symphyseal diastasis, pubic fractures, sacroiliac widening, vertical displacement, acetabular injury, or hip dislocation. Binder reduction can make widening appear smaller.',
      whyItMatters:
        'Provides rapid pattern recognition in major trauma and may immediately alter stabilization and haemorrhage management.',
    },
    {
      test: 'Contrast-enhanced CT of the abdomen and pelvis',
      interpretation:
        'Defines anterior and posterior ring injuries, acetabular and sacral fractures, haematoma, associated organ injury, and possible arterial contrast extravasation.',
      whyItMatters:
        'CT guides classification, operative planning, and selection of haemorrhage-control interventions in sufficiently stable patients.',
    },
    {
      test: 'Haemoglobin, blood gas, lactate, and base deficit',
      interpretation:
        'Serial trends support assessment of blood loss, shock severity, resuscitation response, and ongoing haemorrhage; an early haemoglobin can underestimate acute loss.',
      whyItMatters:
        'Physiological deterioration may precede definitive imaging evidence of the bleeding source.',
    },
    {
      test: 'Blood grouping, cross-match, coagulation profile, fibrinogen, and platelets',
      interpretation:
        'Prepare for haemostatic resuscitation and identify trauma-associated coagulopathy.',
      whyItMatters:
        'Unstable pelvic injury may require rapid blood-component support and correction of coagulopathy.',
    },
    {
      test: 'Extended focused trauma ultrasound',
      interpretation:
        'Assesses intraperitoneal, pericardial, and selected thoracic findings but does not exclude retroperitoneal pelvic haemorrhage.',
      whyItMatters:
        'Helps identify competing bleeding sources during early resuscitation.',
    },
    {
      test: 'Retrograde urethrography',
      interpretation:
        'Assesses urethral integrity when meatal blood, inability to void, significant perineal injury, or other features suggest disruption.',
      whyItMatters:
        'Prevents blind catheter passage through a disrupted urethra and defines the injury pathway.',
    },
    {
      test: 'CT cystography or conventional cystography',
      interpretation:
        'Evaluates bladder rupture when gross haematuria, pelvic fracture pattern, or clinical findings create sufficient concern.',
      whyItMatters:
        'Routine contrast CT without dedicated bladder filling may miss bladder injury.',
    },
    {
      test: 'Pelvic angiography',
      interpretation:
        'Identifies and permits embolisation of arterial pelvic bleeding in selected patients with instability or ongoing haemorrhage.',
      whyItMatters:
        'Arterial bleeding may require targeted endovascular control after mechanical stabilization and resuscitation.',
    },
  ],
  differentialDistinguishers: [
    {
      diagnosis: 'Lateral Compression Pelvic Ring Injury',
      overlap:
        'Pelvic pain, shock, pubic fractures, sacroiliac injury, and high-energy trauma.',
      distinguishingFeatures:
        'The hemipelvis rotates internally, often producing pubic-ramus overlap or sacral compression rather than anterior-ring opening.',
      decisiveClue:
        'Symphyseal diastasis with anterior sacroiliac widening favours anteroposterior compression.',
    },
    {
      diagnosis: 'Vertical Shear Pelvic Ring Injury',
      overlap:
        'Severe pain, haemorrhage, posterior-ring injury, and mechanical instability.',
      distinguishingFeatures:
        'Cephalad hemipelvic translation, complete posterior instability, and possible limb-length asymmetry.',
      decisiveClue:
        'Preserved vertical alignment and intact posterior sacroiliac structures favour APC-II rather than vertical shear.',
    },
    {
      diagnosis: 'Acetabular Fracture',
      overlap:
        'High-energy mechanism, deep pelvic or hip pain, and inability to bear weight.',
      distinguishingFeatures:
        'Fracture lines involve the acetabular columns or walls and may disturb femoroacetabular congruity.',
      decisiveClue:
        'A widened pelvic ring with intact acetabular articular surfaces supports an open-book injury.',
    },
    {
      diagnosis: 'Proximal Femur Fracture',
      overlap:
        'Pain, inability to stand, bleeding, and high-energy trauma.',
      distinguishingFeatures:
        'Localised proximal femoral fracture, shortening, external rotation, and absence of pelvic-ring widening.',
      decisiveClue:
        'Pelvic radiographs localise the disruption to the symphysis and sacroiliac joints.',
    },
    {
      diagnosis: 'Isolated Pubic Rami Fracture',
      overlap:
        'Anterior pelvic pain and pubic tenderness.',
      distinguishingFeatures:
        'Usually lacks major posterior-ring disruption and is often mechanically stable.',
      decisiveClue:
        'Sacroiliac-joint widening establishes a ring injury beyond isolated rami fractures.',
    },
    {
      diagnosis: 'Hip Dislocation',
      overlap:
        'High-energy trauma, severe pain, and inability to move or bear weight.',
      distinguishingFeatures:
        'Fixed limb deformity and loss of femoroacetabular congruity rather than symphyseal and sacroiliac widening.',
      decisiveClue:
        'Both femoral heads remain located while the pelvic ring is externally rotated.',
    },
  ],
  managementOverview: [
    {
      step: 'Perform simultaneous trauma resuscitation and haemorrhage control',
      rationale:
        'Address airway and breathing threats, control visible bleeding, obtain rapid vascular access, warm the patient, activate blood-product support when indicated, and search for all major bleeding sources.',
    },
    {
      step: 'Apply circumferential pelvic stabilization',
      rationale:
        'A binder centred over the greater trochanters reduces pelvic volume and motion while definitive haemorrhage control and stabilization are organised.',
    },
    {
      step: 'Avoid unnecessary pelvic manipulation',
      rationale:
        'Repeated compression can destabilise clot and provides little additional information once a significant injury is suspected.',
    },
    {
      step: 'Classify physiology and mechanical instability',
      rationale:
        'Haemodynamic response, posterior-ring integrity, vertical displacement, and associated injuries determine the immediate pathway.',
    },
    {
      step: 'Control persistent pelvic haemorrhage',
      rationale:
        'Depending on physiology, bleeding pattern, local expertise, and resources, options include resuscitative pelvic stabilization, preperitoneal packing, external fixation or pelvic C-clamp in selected patterns, and angiographic embolisation.',
    },
    {
      step: 'Investigate associated genitourinary and open injuries',
      rationale:
        'Urethral, bladder, rectal, vaginal, neurologic, vascular, abdominal, spinal, and limb injuries can alter priorities and operative planning.',
    },
    {
      step: 'Plan definitive pelvic-ring stabilization',
      rationale:
        'Rotationally unstable injuries commonly require specialist fixation after haemodynamic stabilization and complete injury definition.',
    },
    {
      step: 'Prevent and monitor complications',
      rationale:
        'Provide thromboprophylaxis when safe, pressure and skin care around binders, infection prevention for open injuries, pain control, rehabilitation, and follow-up for healing and function.',
    },
  ],
  complications: [
    'Massive retroperitoneal haemorrhage and haemorrhagic shock',
    'Trauma-associated coagulopathy and hypothermia',
    'Urethral or bladder disruption',
    'Rectal, vaginal, or open perineal injury',
    'Lumbosacral plexus or peripheral nerve injury',
    'Pelvic vascular injury and limb ischaemia',
    'Deep infection, particularly in open injuries',
    'Venous thromboembolism',
    'Malunion, nonunion, pelvic asymmetry, and chronic instability',
    'Chronic pain, gait disturbance, sexual dysfunction, and urinary dysfunction',
    'Pressure injury or skin necrosis from prolonged or misplaced binder use',
  ],
  pitfalls: [
    {
      type: 'SAFETY',
      title: 'Repeatedly compressing the pelvis',
      content:
        'A suspected unstable pelvic ring should not be repeatedly sprung during examination.',
      whyItMatters:
        'Manipulation may increase bleeding and disrupt clot formation without reliably excluding injury.',
      trapAvoided:
        'Use mechanism, physiology, inspection, tenderness, and imaging instead.',
    },
    {
      type: 'PROCEDURE',
      title: 'Placing the binder too high',
      content:
        'A binder around the abdomen or iliac crests does not adequately close the pelvic ring.',
      whyItMatters:
        'Incorrect placement reduces haemorrhage-control benefit and may obscure ongoing instability.',
      trapAvoided:
        'Centre circumferential pressure over the greater trochanters.',
    },
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Using a negative FAST to dismiss pelvic bleeding',
      content:
        'Focused ultrasound does not evaluate most retroperitoneal haemorrhage.',
      whyItMatters:
        'A patient can have life-threatening pelvic blood loss with no intraperitoneal free fluid.',
      trapAvoided:
        'Continue pelvic haemorrhage assessment when physiology and mechanism remain concerning.',
    },
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Assuming no CT blush means no active haemorrhage',
      content:
        'Pelvic bleeding may be intermittent or predominantly venous and cancellous.',
      whyItMatters:
        'Physiology and ongoing transfusion requirement remain central even when arterial extravasation is absent.',
      trapAvoided:
        'Treat the patient’s haemodynamic course, not a single imaging sign.',
    },
    {
      type: 'SAFETY',
      title: 'Blind catheterisation despite urethral warning signs',
      content:
        'Meatal blood, inability to void, or major perineal trauma may indicate urethral disruption.',
      whyItMatters:
        'Catheter passage can worsen injury or create a false passage.',
      trapAvoided:
        'Use the appropriate urethral assessment pathway first.',
    },
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Letting the binder hide the injury',
      content:
        'Circumferential stabilization may substantially reduce symphyseal and sacroiliac widening.',
      whyItMatters:
        'A near-normal AP radiograph under a binder may underestimate the original mechanical injury.',
      trapAvoided:
        'Interpret imaging with the mechanism, pre-binder findings, CT, and specialist assessment.',
    },
    {
      type: 'SAFETY',
      title: 'Leaving the binder unreviewed for prolonged periods',
      content:
        'Prolonged compression can cause skin and soft-tissue injury.',
      whyItMatters:
        'Temporary stabilization requires documented skin checks and timely transition to definitive management.',
      trapAvoided:
        'Record placement time and establish a review and removal plan.',
    },
  ],
  recallPrompts: [
    {
      prompt: 'What mechanism classically produces an open-book pelvic injury?',
      answer: 'High-energy anteroposterior compression that externally rotates the hemipelves.',
    },
    {
      prompt: 'Where should a pelvic binder be positioned?',
      answer: 'Centred over the greater trochanters, not the iliac crests or waist.',
    },
    {
      prompt: 'Why should the pelvis not be repeatedly compressed?',
      answer: 'Repeated manipulation can worsen bleeding and disrupt early clot formation.',
    },
    {
      prompt: 'What is the mechanical stability of an APC-II injury?',
      answer: 'It is rotationally unstable but generally vertically stable because the posterior sacroiliac complex remains intact.',
    },
    {
      prompt: 'Does a negative abdominal FAST exclude pelvic haemorrhage?',
      answer: 'No. Most pelvic haemorrhage is retroperitoneal and may not appear as intraperitoneal free fluid.',
    },
    {
      prompt: 'Which finding should raise concern for urethral injury?',
      answer: 'Blood at the urethral meatus, inability to void, or significant perineal trauma.',
    },
    {
      prompt: 'What does APC-III imply?',
      answer: 'Complete posterior-ring disruption with both rotational and vertical instability.',
    },
    {
      prompt: 'Does absence of arterial contrast extravasation exclude important bleeding?',
      answer: 'No. Bleeding may be venous, cancellous, intermittent, or temporarily tamponaded.',
    },
  ],
  references: [
    {
      citation:
        'AO Foundation Surgery Reference. Pelvic ring: incomplete posterior-arch disruption and open-book injury principles.',
    },
    {
      citation:
        'Coccolini F, et al. Pelvic trauma: WSES classification and guidelines. World Journal of Emergency Surgery. 2017;12:5.',
    },
    {
      citation:
        'Joint Trauma System. Pelvic Fracture Care Clinical Practice Guideline. Version 1.1, February 2026.',
    },
    {
      citation:
        'Eastern Association for the Surgery of Trauma. Pelvic Fracture Hemorrhage Practice Management Guideline.',
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
      'Explanation reasoning must be a newline-separated string for the current learner frontend.',
    );
  }

  const renderedReasoningSteps = explanation.reasoning
    .split(/\n{2,}|\n/)
    .map((step) => step.trim())
    .filter(Boolean);

  if (renderedReasoningSteps.length !== clues.length) {
    throw new Error(
      `Expected ${clues.length} frontend reasoning steps; received ${renderedReasoningSteps.length}.`,
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

    if (entry.explanation !== renderedReasoningSteps[index]) {
      throw new Error(
        `Clue breakdown explanation does not match frontend reasoning step at order ${clue.order}.`,
      );
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

      const sourceClue = normalizeClinicalText(
        clues[breakdown.clueOrder].value,
      );
      const normalizedEvidence = normalizeClinicalText(breakdown.evidence);

      if (!sourceClue.includes(normalizedEvidence)) {
        throw new Error(
          `Differential evidence is not present in clue ${breakdown.clueOrder}: ${entry.diagnosis} -> ${breakdown.evidence}.`,
        );
      }
    });
  });

  const educationText = normalizeClinicalText(
    JSON.stringify(educationForFrontend),
  );

  const caseSpecificEducationTerms = [
    '36 year old',
    'motorcycle collision',
    'blood pressure 88 56',
    'haemoglobin 9 2',
    'lactate 5 1',
    'pubic symphysis measuring 3 6',
    'this patient',
    'this case',
    'his pelvis',
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
          clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
          ageGroup: DiagnosisAgeGroup.ANY,
          urgencyLevel: DiagnosisUrgencyLevel.EMERGENT,
          preferredClueTypes: ['history', 'vital', 'exam', 'lab', 'imaging'],
          notes:
            'Seeded flagship Open-Book Pelvic Fracture case focused on anteroposterior compression, occult haemorrhage, safe pelvic stabilization, APC-II imaging, associated-injury assessment, and definitive trauma management.',
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
          clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
          ageGroup: DiagnosisAgeGroup.ANY,
          urgencyLevel: DiagnosisUrgencyLevel.EMERGENT,
          preferredClueTypes: ['history', 'vital', 'exam', 'lab', 'imaging'],
          notes:
            'Seeded flagship Open-Book Pelvic Fracture case focused on anteroposterior compression, occult haemorrhage, safe pelvic stabilization, APC-II imaging, associated-injury assessment, and definitive trauma management.',
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
      'Skipped diagnosis education because Open-Book Pelvic Fracture education already exists:',
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
        ? 'Skipped existing scheduled Open-Book Pelvic Fracture case.'
        : 'Skipped existing Open-Book Pelvic Fracture case to avoid overwriting authored content.',
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
      'Seeded complete frontend-aligned flagship Open-Book Pelvic Fracture case with six valid playable clues, exact clue-breakdown alignment, occult-haemorrhage reasoning, APC-II classification, safe binder teaching, and diagnosis-level education independent of the vignette.',
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
        'Created complete Open-Book Pelvic Fracture revision with six supported clue types, frontend-compatible reasoning, shock assessment, pelvic-ring imaging confirmation, and associated-injury teaching.',
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
        'flagship-human-review:open-book-pelvic-fracture-v1',
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        clueProgressionVerified: true,
        breakdownClueReferencesValidated: true,
        frontendReasoningStringValidated: true,
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
          clinicalSetting: 'EMERGENCY',
          ageGroup: 'ANY',
          urgencyLevel: 'EMERGENT',
        },
        note:
          'Complete Open-Book Pelvic Fracture flagship seed with six supported clue types, no early diagnosis-label leakage, exact clue-to-breakdown alignment, mechanism-to-imaging reasoning, occult-haemorrhage recognition, pelvic stabilization priorities, and independent diagnosis education.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded Open-Book Pelvic Fracture:', {
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
