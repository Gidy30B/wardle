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
 * FLAGSHIP CASE SEED - Posterior Hip Dislocation
 *
 * Clinical focus:
 * - High-energy dashboard-type mechanism with the hip and knee flexed.
 * - Severe pain, inability to move or bear weight, and a fixed limb deformity.
 * - Shortened, flexed, adducted, internally rotated lower limb.
 * - Mandatory sciatic-nerve and distal vascular assessment before and after reduction.
 * - Plain radiographs establishing loss of femoroacetabular congruity.
 * - Cross-table lateral confirmation of posterior displacement.
 * - Urgent reduction followed by post-reduction radiographs and CT assessment.
 *
 * Education design:
 * - Case explanation is specific to the vignette.
 * - Diagnosis education is independent of the case and covers recognition,
 *   examination, imaging, reduction priorities, associated injuries,
 *   complications, rehabilitation principles, and common diagnostic traps.
 *
 * Safety:
 * - Reuses or creates the exact diagnosis registry and accepted aliases.
 * - Does not overwrite existing diagnosis education.
 * - Does not overwrite an existing case with the same title.
 * - Does not alter a scheduled DailyCase.
 *
 * Run:
 *   npx tsx prisma/seed/flagship-posterior-hip-dislocation.seed.ts
 *
 * Railway:
 *   railway run npx tsx prisma/seed/flagship-posterior-hip-dislocation.seed.ts
 */

const databaseUrl = resolvePgConnectionString(process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required to run the Posterior Hip Dislocation seed.',
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
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 6, 27, 12, 0, 0));
const seedVersion = 'flagship-posterior-hip-dislocation-v1';

const canonicalName = 'posterior hip dislocation';
const displayLabel = 'Posterior Hip Dislocation';
const caseTitle = 'Severe Hip Pain After a High-Speed Collision';

const taxonomy = {
  specialty: 'Orthopaedics',
  subspecialty: 'Orthopaedic Trauma',
  category: 'Traumatic Dislocation',
  bodySystem: 'Musculoskeletal',
  organSystem: 'Hip',
} as const;

const aliasTerms = [
  'Posterior Hip Dislocation',
  'Posterior Dislocation of the Hip',
  'Traumatic Posterior Hip Dislocation',
  'Posterior Femoroacetabular Dislocation',
];

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 29-year-old restrained front-seat passenger is brought after a high-speed frontal road collision. His right knee struck the dashboard while the hip and knee were flexed. He immediately developed severe deep groin and buttock pain and has been unable to stand or move the limb since the crash. He has no previous hip operation or prosthetic joint.',
  },
  {
    order: 1,
    type: 'symptom',
    value:
      'The pain is constant and becomes extreme with any attempted movement. He says the right leg feels shorter and locked in one position. He also reports tingling over the outer calf and dorsum of the foot but has no lower-back pain, saddle sensory loss, or urinary retention.',
  },
  {
    order: 2,
    type: 'exam',
    value:
      'The right lower limb appears shortened. The hip is held in slight flexion, adduction, and internal rotation, and any attempt to correct the position causes severe pain and firm resistance. There is no open wound, and the pelvis is haemodynamically stable on the initial trauma assessment.',
  },
  {
    order: 3,
    type: 'exam',
    value:
      'Before manipulation, ankle dorsiflexion and great-toe extension are weak, with reduced sensation over the dorsum of the foot. Plantar flexion is preserved. Dorsalis pedis and posterior tibial pulses are palpable, capillary refill is normal, and the foot is warm. The right knee is bruised and tender but has no gross deformity.',
  },
  {
    order: 4,
    type: 'imaging',
    value:
      'An anteroposterior pelvis radiograph shows an empty right acetabular socket with the femoral head displaced superiorly and laterally. The lesser trochanter is poorly profiled because the limb is internally rotated. No femoral-neck or intertrochanteric fracture is visible on the initial film.',
  },
  {
    order: 5,
    type: 'imaging',
    value:
      'A cross-table lateral view confirms that the femoral head lies behind the acetabulum. After urgent closed reduction under procedural sedation, repeat radiographs show restored alignment and CT demonstrates a concentric reduction with a small posterior acetabular-wall fracture and no incarcerated intra-articular fragment. These findings establish Posterior Hip Dislocation.',
  },
] as const;

const differentials = [
  'Anterior Hip Dislocation',
  'Femoral Neck Fracture',
  'Acetabular Fracture',
  'Intertrochanteric Femur Fracture',
  'Proximal Femoral Shaft Fracture',
  'Traumatic Hip Subluxation',
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
  'A force transmitted through a flexed knee during a frontal collision is a classic high-energy mechanism for traumatic displacement of the femoral head and also raises concern for associated knee, acetabular, and neurovascular injuries.',
  'Immediate severe hip pain, inability to bear weight or move the limb, and a fixed sensation of shortening indicate major structural hip trauma rather than a minor soft-tissue injury; distal sensory symptoms raise concern for sciatic-nerve involvement.',
  'A shortened limb held in flexion, adduction, and internal rotation is the characteristic deformity of posterior displacement, whereas anterior displacement usually produces abduction and external rotation.',
  'Weak dorsiflexion and great-toe extension with dorsal-foot sensory loss localise possible injury to the peroneal division of the sciatic nerve, making careful pre-reduction and post-reduction neurovascular documentation essential.',
  'The empty acetabulum with a superiorly and laterally displaced femoral head confirms complete loss of femoroacetabular congruity; the absence of a visible proximal femoral fracture makes an isolated fracture less likely.',
  'The lateral view proves posterior displacement, while post-reduction radiographs and CT confirm a concentric reduction and identify the associated posterior-wall injury without changing the canonical diagnosis.',
] as const;

const explanation = {
  diagnosis: displayLabel,
  summary:
    'A high-energy dashboard mechanism followed by immediate severe hip pain, inability to move the limb, a shortened flexed-adducted-internally rotated posture, sciatic-nerve findings, and imaging showing the femoral head behind the acetabulum establishes Posterior Hip Dislocation.',
  reasoning: reasoningSteps.join('\n'),
  clueBreakdown: [
    {
      clueOrder: 0,
      clueType: 'history',
      clue: clues[0].value,
      explanation: reasoningSteps[0],
      diagnosticContribution:
        'Introduces the classic high-energy mechanism and frames the injury as major hip trauma without naming the final diagnosis.',
    },
    {
      clueOrder: 1,
      clueType: 'symptom',
      clue: clues[1].value,
      explanation: reasoningSteps[1],
      diagnosticContribution:
        'Establishes severe fixed joint dysfunction and introduces possible sciatic-nerve involvement.',
    },
    {
      clueOrder: 2,
      clueType: 'exam',
      clue: clues[2].value,
      explanation: reasoningSteps[2],
      diagnosticContribution:
        'Provides the defining clinical posture and distinguishes posterior from anterior displacement.',
    },
    {
      clueOrder: 3,
      clueType: 'exam',
      clue: clues[3].value,
      explanation: reasoningSteps[3],
      diagnosticContribution:
        'Documents a clinically important sciatic-nerve deficit while confirming preserved distal perfusion before reduction.',
    },
    {
      clueOrder: 4,
      clueType: 'imaging',
      clue: clues[4].value,
      explanation: reasoningSteps[4],
      diagnosticContribution:
        'Confirms complete loss of hip-joint congruity and reduces the likelihood of an isolated proximal femoral fracture.',
    },
    {
      clueOrder: 5,
      clueType: 'imaging',
      clue: clues[5].value,
      explanation: reasoningSteps[5],
      diagnosticContribution:
        'Confirms the posterior direction, verifies successful reduction, and identifies an associated posterior acetabular-wall fracture.',
    },
  ] satisfies ClueBreakdownEntry[],
  keyFindings: [
    'High-energy frontal collision',
    'Force transmitted through a flexed knee',
    'Immediate severe groin and buttock pain',
    'Inability to stand or move the limb',
    'Subjective limb shortening and fixed position',
    'Shortened lower limb',
    'Hip flexion, adduction, and internal rotation',
    'Painful firm resistance to movement',
    'Weak ankle dorsiflexion and great-toe extension',
    'Reduced sensation over the dorsum of the foot',
    'Preserved distal pulses and capillary refill',
    'Empty acetabular socket on radiograph',
    'Superior and lateral femoral-head displacement',
    'Posterior displacement on cross-table lateral view',
    'Concentric alignment after reduction',
    'Small posterior acetabular-wall fracture on CT',
    'No incarcerated intra-articular fragment',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Anterior Hip Dislocation',
      whyPlausibleEarly:
        'Both anterior and posterior traumatic hip dislocations cause severe pain, inability to bear weight, fixed deformity, and loss of normal joint congruity.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: 'flexion, adduction, and internal rotation',
          reason:
            'This posture is characteristic of posterior displacement; anterior dislocation more often produces abduction and external rotation.',
        },
        {
          clueOrder: 5,
          evidence: 'femoral head lies behind the acetabulum',
          reason:
            'The lateral view directly confirms posterior rather than anterior displacement.',
        },
      ],
      finalReasonLessLikely:
        'The fixed posture and lateral radiograph both establish posterior direction.',
    },
    {
      diagnosis: 'Femoral Neck Fracture',
      whyPlausibleEarly:
        'A displaced femoral-neck fracture can cause acute hip pain, inability to bear weight, shortening, and painful movement after trauma.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: 'adduction, and internal rotation',
          reason:
            'Femoral-neck fractures more often produce shortening with external rotation rather than a fixed internally rotated posture.',
        },
        {
          clueOrder: 4,
          evidence: 'No femoral-neck or intertrochanteric fracture is visible',
          reason:
            'The radiograph shows displacement of an intact femoral head rather than a fracture through the femoral neck.',
        },
      ],
      finalReasonLessLikely:
        'Imaging demonstrates loss of joint congruity without a visible femoral-neck fracture.',
    },
    {
      diagnosis: 'Acetabular Fracture',
      whyPlausibleEarly:
        'High-energy dashboard trauma can fracture the acetabulum and produce severe hip pain, inability to bear weight, and associated sciatic-nerve injury.',
      ruledOutByClues: [
        {
          clueOrder: 4,
          evidence: 'empty right acetabular socket',
          reason:
            'The dominant abnormality is complete displacement of the femoral head from the socket, not a fracture alone.',
        },
        {
          clueOrder: 5,
          evidence: 'small posterior acetabular-wall fracture',
          reason:
            'CT identifies an associated fracture, but it is secondary to the primary joint displacement and does not replace the canonical diagnosis.',
        },
      ],
      finalReasonLessLikely:
        'An acetabular fracture is present as an associated injury, but the defining diagnosis is traumatic posterior loss of femoroacetabular congruity.',
    },
    {
      diagnosis: 'Intertrochanteric Femur Fracture',
      whyPlausibleEarly:
        'An intertrochanteric fracture causes acute hip pain, inability to bear weight, shortening, and a painful deformed limb after trauma.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: 'internal rotation',
          reason:
            'Intertrochanteric fractures usually produce external rotation rather than fixed internal rotation.',
        },
        {
          clueOrder: 4,
          evidence: 'No femoral-neck or intertrochanteric fracture is visible',
          reason: 'The proximal femur is intact on the initial radiograph.',
        },
      ],
      finalReasonLessLikely:
        'The limb posture and radiographs support joint displacement rather than an extracapsular proximal femoral fracture.',
    },
    {
      diagnosis: 'Proximal Femoral Shaft Fracture',
      whyPlausibleEarly:
        'High-energy collision can cause femoral-shaft injury with severe pain, shortening, deformity, and inability to move the limb.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence:
            'hip is held in slight flexion, adduction, and internal rotation',
          reason:
            'A reproducible fixed hip posture suggests joint displacement rather than an unstable shaft deformity.',
        },
        {
          clueOrder: 4,
          evidence: 'femoral head displaced superiorly and laterally',
          reason:
            'The radiograph localises the principal injury to the hip joint rather than the femoral shaft.',
        },
      ],
      finalReasonLessLikely:
        'Imaging identifies loss of femoroacetabular congruity and does not show a shaft fracture as the cause of shortening.',
    },
    {
      diagnosis: 'Traumatic Hip Subluxation',
      whyPlausibleEarly:
        'Partial transient displacement can follow high-energy trauma and produce hip pain, restricted movement, instability, and associated labral or acetabular injury.',
      ruledOutByClues: [
        {
          clueOrder: 4,
          evidence: 'empty right acetabular socket',
          reason:
            'An empty socket indicates complete rather than partial loss of joint congruity.',
        },
        {
          clueOrder: 5,
          evidence: 'femoral head lies behind the acetabulum',
          reason:
            'The femoral head is fully displaced posterior to the socket, which exceeds subluxation.',
        },
      ],
      finalReasonLessLikely:
        'Radiographs demonstrate complete displacement rather than incomplete or transient subluxation.',
    },
  ] satisfies DifferentialAnalysisEntry[],
  managementPearl:
    'Treat traumatic native-hip dislocation as an orthopaedic emergency. Complete trauma resuscitation and document sciatic-nerve and distal vascular function, but arrange reduction as soon as safely possible, particularly when a neurovascular deficit is present. Do not delay urgent reduction merely to obtain CT. After reduction, repeat the neurovascular examination, confirm concentric alignment radiographically, and obtain CT to assess acetabular or femoral-head fractures and intra-articular fragments.',
  generationQuality: {
    contentTier: 'FLAGSHIP',
    seedVersion,
    humanReviewed: true,
    discriminatorStrength: 'VERY_HIGH',
    clueProgressionVerified: true,
    breakdownClueReferencesValidated: true,
    frontendReasoningStringValidated: true,
    educationIndependentOfCase: true,
    expectedTeachingPoints: [
      'Posterior displacement commonly follows force transmitted through a flexed knee and hip',
      'The affected limb is typically shortened, flexed, adducted, and internally rotated',
      'Anterior displacement usually produces abduction and external rotation',
      'Sciatic-nerve function must be documented before and after reduction',
      'Urgent reduction reduces the duration of femoral-head vascular compromise',
      'A neurovascular deficit strengthens the need for immediate reduction',
      'Post-reduction radiographs and CT assess concentricity, fractures, and intra-articular fragments',
      'Associated acetabular, femoral-head, knee, and ligament injuries must be sought',
      'Avascular necrosis and post-traumatic osteoarthritis are important delayed complications',
    ],
    competencyDomains: [
      'Orthopaedics',
      'Orthopaedic Trauma',
      'Emergency Medicine',
      'Hip and Pelvic Trauma',
      'Neurovascular Examination',
      'Trauma Imaging',
      'Clinical Reasoning',
    ],
  },
};

const educationForFrontend = {
  title: displayLabel,
  summary: {
    definition:
      'Posterior Hip Dislocation is traumatic displacement of the femoral head behind the acetabulum. It is a high-energy orthopaedic emergency because prolonged displacement can compromise the blood supply to the femoral head and may injure the sciatic nerve, cartilage, acetabulum, or femoral head.',
    highYieldTakeaway:
      'Suspect Posterior Hip Dislocation after major trauma when the limb is shortened, flexed, adducted, and internally rotated. Document sciatic-nerve and distal vascular status, obtain prompt radiographs, and organise urgent reduction followed by post-reduction imaging.',
  },
  recognitionPattern: [
    {
      pattern: 'High-energy force through a flexed knee and hip',
      whyItMatters:
        'A posteriorly directed force transmitted along the femur can drive the femoral head through the posterior capsule and out behind the acetabulum.',
      progression:
        'Dashboard, fall, or contact-sport force -> capsulolabral disruption -> posterior displacement of the femoral head -> cartilage, bone, or nerve injury.',
      discriminator:
        'The mechanism also prompts examination for acetabular, femoral-head, knee, posterior cruciate ligament, and sciatic-nerve injury.',
      commonTrap:
        'Do not focus only on the visible hip deformity and miss associated injuries produced by the same high-energy event.',
    },
    {
      pattern: 'Shortened, adducted, internally rotated limb',
      whyItMatters:
        'The fixed posture reflects the position of the femoral head behind the acetabulum and tension in the surrounding soft tissues.',
      progression:
        'Posterior displacement -> apparent shortening -> flexion, adduction, and internal rotation -> severe pain with attempted movement.',
      discriminator:
        'Anterior dislocation more often produces abduction and external rotation, while many proximal femoral fractures produce external rotation.',
      commonTrap:
        'Do not repeatedly force the limb into neutral before imaging or appropriate sedation because this may worsen pain or associated injury.',
    },
    {
      pattern: 'Sciatic-nerve risk',
      whyItMatters:
        'The sciatic nerve lies close to the posterior hip and can be stretched or compressed, particularly its peroneal division.',
      progression:
        'Posterior femoral-head displacement -> nerve traction or compression -> weakness of ankle or toe movement and altered distal sensation.',
      discriminator:
        'A documented deficit before reduction distinguishes injury-related dysfunction from a deficit that appears after manipulation.',
      commonTrap:
        'Do not record only “neurovascularly intact”; document motor, sensory, pulses, warmth, and capillary refill before and after reduction.',
    },
    {
      pattern: 'Radiographic confirmation followed by post-reduction CT',
      whyItMatters:
        'Plain radiographs confirm displacement and screen for major fractures; CT after reduction assesses congruity, occult fractures, and intra-articular debris.',
      progression:
        'AP pelvis and appropriate lateral view -> urgent reduction -> repeat radiographs -> CT evaluation of associated injury.',
      discriminator:
        'CT should answer the post-reduction fracture and congruity questions and should not unnecessarily delay urgent reduction of an obvious native-hip dislocation.',
      commonTrap:
        'Do not assume that a palpable reduction “clunk” proves a safe concentric reduction.',
    },
  ],
  keySymptoms: [
    {
      symptom: 'Severe hip, groin, or buttock pain',
      significance:
        'Pain is usually immediate after high-energy trauma and is aggravated by any attempted movement.',
    },
    {
      symptom: 'Inability to stand, bear weight, or move the hip',
      significance:
        'Complete loss of joint congruity produces marked functional loss and a fixed painful posture.',
    },
    {
      symptom: 'A sensation that the limb is shortened or locked',
      significance:
        'Patients may notice deformity or inability to return the limb to a neutral position.',
    },
    {
      symptom: 'Distal numbness or weakness',
      significance:
        'May indicate sciatic-nerve injury and requires immediate documented motor and sensory assessment.',
    },
    {
      symptom: 'Pain at the knee or elsewhere after the same trauma',
      significance:
        'A dashboard mechanism may produce associated patellar, ligamentous, femoral, or acetabular injury.',
    },
  ],
  keySigns: [
    {
      finding: 'Shortened affected limb',
      significance:
        'Apparent shortening occurs because the femoral head is displaced from the acetabulum.',
      discriminator:
        'Shortening is not specific, so the rotational posture and imaging determine the injury pattern.',
    },
    {
      finding: 'Flexion, adduction, and internal rotation',
      significance:
        'This is the classic resting posture of posterior hip dislocation.',
      discriminator:
        'Abduction and external rotation favour anterior dislocation; external rotation with shortening may favour proximal femoral fracture.',
    },
    {
      finding: 'Painful fixed resistance to movement',
      significance:
        'The joint is mechanically displaced and surrounding muscles are in spasm.',
      discriminator:
        'Avoid repeated forceful range-of-motion testing once a major dislocation is suspected.',
    },
    {
      finding: 'Sciatic-nerve motor or sensory deficit',
      significance:
        'Weak ankle or toe dorsiflexion and altered dorsal-foot sensation may reflect peroneal-division injury.',
      discriminator:
        'Compare and document before and after reduction to identify recovery, persistence, or iatrogenic change.',
    },
    {
      finding: 'Distal vascular compromise',
      significance:
        'Absent pulses, delayed refill, coolness, or pallor indicates limb-threatening injury and urgent escalation.',
      discriminator:
        'Normal pulses do not remove the need for repeated vascular assessment after reduction.',
    },
  ],
  examPearls: [
    {
      type: 'TRAUMA',
      title: 'Complete the primary trauma survey',
      content:
        'Assess airway, breathing, circulation, disability, exposure, haemorrhage, pelvic stability, and other life-threatening injuries before focusing exclusively on the hip.',
      whyItMatters:
        'Traumatic native-hip dislocation usually results from major energy transfer and may coexist with serious injuries elsewhere.',
      discriminator:
        'The hip requires urgent treatment, but resuscitation priorities remain governed by the overall trauma assessment.',
      trapAvoided:
        'Do not allow a dramatic limb deformity to distract from occult chest, abdominal, spinal, pelvic, or head injury.',
    },
    {
      type: 'NEUROVASCULAR',
      title: 'Document the sciatic nerve precisely',
      content:
        'Assess ankle dorsiflexion, great-toe extension, plantar flexion, eversion, inversion, and sensation over relevant distal nerve territories, together with pulses and perfusion.',
      whyItMatters:
        'Posterior displacement can injure the sciatic nerve, and the timing of a deficit affects interpretation and management.',
      discriminator:
        'A pre-reduction examination provides the baseline against which post-reduction findings are judged.',
      trapAvoided:
        'Do not use a vague “NVI” entry without recording specific motor, sensory, and vascular findings.',
    },
    {
      type: 'SAFETY',
      title: 'Minimise unnecessary manipulation',
      content:
        'Support the limb in its presenting position, provide analgesia, and avoid repeated attempts to straighten or test the hip before definitive reduction conditions are available.',
      whyItMatters:
        'Forceful manipulation can worsen pain, neurovascular injury, chondral damage, or an associated fracture.',
      discriminator:
        'One controlled reduction strategy under adequate sedation or anaesthesia is safer than multiple poorly coordinated attempts.',
      trapAvoided:
        'Do not perform casual bedside traction without appropriate monitoring, expertise, and preparation.',
    },
    {
      type: 'ASSOCIATED_INJURY',
      title: 'Examine the knee and entire limb',
      content:
        'Inspect and palpate the knee, femur, pelvis, and distal limb and assess ligament stability when clinically safe after urgent priorities are addressed.',
      whyItMatters:
        'The same force that dislocates the hip may fracture the patella or femur or injure the posterior cruciate ligament.',
      discriminator:
        'Persistent pain after reduction should not automatically be attributed to the hip alone.',
      trapAvoided:
        'Do not miss a second injury because the hip abnormality explains the initial inability to walk.',
    },
  ],
  scoringSystems: [
    {
      name: 'Thompson-Epstein classification',
      purpose:
        'Describes posterior hip dislocations according to associated acetabular or femoral-head injury and helps communicate injury complexity.',
      components: [
        'Type I: simple dislocation or only a minor posterior-wall fragment',
        'Type II: dislocation with a large single posterior-wall fragment',
        'Type III: dislocation with comminution of the posterior acetabular wall',
        'Type IV: dislocation with acetabular-floor fracture',
        'Type V: dislocation with femoral-head fracture',
      ],
      interpretation:
        'The classification complements, but does not replace, CT description of fracture morphology, joint congruity, stability, and intra-articular fragments.',
      limitation:
        'Treatment decisions require the complete clinical and imaging picture rather than the class label alone.',
    },
  ],
  investigations: [
    {
      test: 'Anteroposterior pelvis radiograph',
      interpretation:
        'Shows loss of femoroacetabular congruity, femoral-head position, rotational clues, and major associated pelvic or proximal femoral fractures.',
      whyItMatters:
        'It is the rapid first-line confirmation test in a haemodynamically stable patient with suspected hip dislocation.',
    },
    {
      test: 'Cross-table lateral or other trauma-appropriate lateral view',
      interpretation:
        'Confirms whether the femoral head lies posterior or anterior to the acetabulum. Avoid forcing the hip into a frog-leg position.',
      whyItMatters:
        'Direction affects diagnosis, reduction planning, and interpretation of associated injury.',
    },
    {
      test: 'Post-reduction radiographs',
      interpretation:
        'Confirm restoration of alignment and screen for fractures or an obviously nonconcentric reduction.',
      whyItMatters:
        'A perceived reduction is not sufficient proof of normal joint congruity.',
    },
    {
      test: 'Post-reduction CT of a native hip',
      interpretation:
        'Assesses acetabular and femoral-head fractures, impaction, loose bodies, incarcerated fragments, and concentricity of reduction.',
      whyItMatters:
        'CT identifies injuries that may require operative management and may be occult on plain radiographs.',
    },
    {
      test: 'Imaging of the knee, femur, pelvis, or other injured regions',
      interpretation:
        'Tailor additional imaging to mechanism, examination findings, and the trauma survey.',
      whyItMatters:
        'High-energy mechanisms frequently produce associated injuries outside the hip joint.',
    },
    {
      test: 'Serial neurovascular examination',
      interpretation:
        'Compare motor, sensory, pulses, perfusion, and pain findings before and after reduction and during observation.',
      whyItMatters:
        'Neurological recovery or new deterioration may alter urgency and operative planning.',
    },
  ],
  differentialDistinguishers: [
    {
      diagnosis: 'Anterior Hip Dislocation',
      overlap:
        'Severe post-traumatic hip pain, inability to bear weight, fixed deformity, and loss of joint congruity.',
      distinguishingFeatures:
        'The limb is usually abducted and externally rotated, and imaging places the femoral head anterior to the acetabulum.',
      decisiveClue:
        'The resting posture and lateral radiograph define the direction of displacement.',
    },
    {
      diagnosis: 'Femoral Neck Fracture',
      overlap:
        'Hip pain, shortening, inability to bear weight, and painful movement after trauma.',
      distinguishingFeatures:
        'The limb is commonly externally rotated, and radiographs show a fracture through the femoral neck with the head remaining in the socket.',
      decisiveClue:
        'An intact femoral neck with the head outside the acetabulum indicates dislocation rather than an isolated neck fracture.',
    },
    {
      diagnosis: 'Acetabular Fracture',
      overlap:
        'High-energy mechanism, hip pain, sciatic-nerve risk, and inability to bear weight.',
      distinguishingFeatures:
        'An acetabular fracture may occur with or without dislocation and is defined by the fracture pattern rather than displacement alone.',
      decisiveClue:
        'Imaging should state both the joint position and any associated acetabular fracture; one does not exclude the other.',
    },
    {
      diagnosis: 'Intertrochanteric Femur Fracture',
      overlap:
        'Painful shortened limb and inability to bear weight after trauma.',
      distinguishingFeatures:
        'Often produces external rotation and radiographic fracture through the intertrochanteric region.',
      decisiveClue:
        'Radiographs show whether the proximal femur is fractured or the femoral head has left the acetabulum.',
    },
    {
      diagnosis: 'Traumatic Hip Subluxation',
      overlap:
        'Pain, instability, restricted movement, and possible acetabular or labral injury after trauma.',
      distinguishingFeatures:
        'Joint congruity is only partially or transiently lost rather than completely absent.',
      decisiveClue:
        'An empty acetabulum with the femoral head fully outside the socket establishes complete dislocation.',
    },
    {
      diagnosis: 'Prosthetic Hip Dislocation',
      overlap: 'Painful fixed hip deformity and loss of joint congruity.',
      distinguishingFeatures:
        'Occurs in a patient with hip arthroplasty and has prosthesis-specific causes, precautions, and imaging considerations.',
      decisiveClue:
        'History and radiographs distinguish a native femoral head from prosthetic components.',
    },
  ],
  managementOverview: [
    {
      step: 'Stabilise the trauma patient',
      rationale:
        'Address life-threatening injuries, haemorrhage, analgesia, monitoring, and resuscitation while protecting the injured limb.',
    },
    {
      step: 'Document pre-reduction neurovascular status',
      rationale:
        'Sciatic-nerve and vascular findings establish a baseline and may increase the urgency of reduction and specialist involvement.',
    },
    {
      step: 'Arrange urgent closed reduction',
      rationale:
        'Reduce as soon as safely possible under adequate procedural sedation or anaesthesia with appropriate expertise, monitoring, and muscle relaxation. A neurovascular deficit warrants immediate action.',
    },
    {
      step: 'Escalate when closed reduction is unsafe or unsuccessful',
      rationale:
        'Open reduction may be required for irreducibility, an incarcerated fragment, nonconcentric reduction, unstable fracture-dislocation, or other operative injury.',
    },
    {
      step: 'Repeat examination and imaging after reduction',
      rationale:
        'Reassess nerve and vascular function, confirm alignment radiographically, and obtain CT in a native hip to define associated fractures and loose bodies.',
    },
    {
      step: 'Plan weight-bearing and rehabilitation individually',
      rationale:
        'Restrictions and rehabilitation depend on joint stability, fracture pattern, cartilage injury, operative treatment, and specialist assessment.',
    },
    {
      step: 'Provide long-term surveillance',
      rationale:
        'Follow-up monitors for avascular necrosis, post-traumatic osteoarthritis, instability, persistent nerve dysfunction, and functional loss.',
    },
  ],
  complications: [
    'Avascular necrosis or osteonecrosis of the femoral head',
    'Sciatic-nerve injury, particularly peroneal-division dysfunction',
    'Post-traumatic osteoarthritis',
    'Acetabular or femoral-head fracture',
    'Chondral injury and intra-articular loose bodies',
    'Nonconcentric or unstable reduction',
    'Recurrent instability or redislocation',
    'Heterotopic ossification',
    'Persistent pain, stiffness, weakness, or reduced mobility',
    'Vascular injury or limb ischaemia',
  ],
  pitfalls: [
    {
      type: 'SAFETY',
      title: 'Delaying reduction for nonessential testing',
      content:
        'Once an obvious traumatic native-hip dislocation is recognised and the patient is adequately stabilised, prolonged delay for CT or routine investigations increases time out of joint.',
      whyItMatters:
        'Longer displacement may increase femoral-head vascular compromise and worsens the urgency of care.',
      trapAvoided:
        'Use CT after reduction unless a specific pre-reduction imaging question changes the immediate safe plan.',
    },
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Failing to define the direction',
      content:
        'The generic label “hip dislocation” does not distinguish posterior from anterior injury.',
      whyItMatters:
        'Direction is reflected in limb posture, mechanism, reduction planning, and associated injury patterns.',
      trapAvoided:
        'Record the resting posture and confirm direction with an appropriate lateral image.',
    },
    {
      type: 'NEUROVASCULAR',
      title: 'Omitting the pre-reduction nerve examination',
      content:
        'Sciatic-nerve dysfunction may exist before manipulation or become apparent afterward.',
      whyItMatters:
        'Without a baseline examination, the timing and cause of a deficit cannot be interpreted reliably.',
      trapAvoided:
        'Document named motor and sensory functions and distal perfusion before and after reduction.',
    },
    {
      type: 'SAFETY',
      title: 'Using repeated forceful reduction attempts',
      content:
        'Inadequate sedation, poor countertraction, an associated fracture, or an incarcerated fragment may prevent safe closed reduction.',
      whyItMatters:
        'Repeated force can produce iatrogenic fracture, nerve injury, or further cartilage damage.',
      trapAvoided:
        'Stop and escalate when the reduction is not progressing safely or the injury pattern requires operative management.',
    },
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Assuming the reduction is concentric',
      content:
        'A palpable clunk and improved limb posture do not exclude an incarcerated fragment or subtle malalignment.',
      whyItMatters:
        'A nonconcentric reduction can damage cartilage and may require surgery.',
      trapAvoided:
        'Obtain repeat radiographs and post-reduction CT in the native hip.',
    },
    {
      type: 'ASSOCIATED_INJURY',
      title: 'Ignoring the knee and remainder of the limb',
      content:
        'Dashboard-type force can injure the patella, posterior cruciate ligament, femur, or acetabulum.',
      whyItMatters:
        'Missed associated injuries impair recovery and may require separate treatment.',
      trapAvoided:
        'Perform a complete secondary survey and targeted imaging after immediate priorities are managed.',
    },
    {
      type: 'FOLLOW_UP',
      title: 'Ending follow-up after successful reduction',
      content:
        'Avascular necrosis and post-traumatic arthritis can appear later despite an apparently successful initial reduction.',
      whyItMatters:
        'Delayed complications may cause progressive pain, stiffness, or collapse of the femoral head.',
      trapAvoided:
        'Arrange orthopaedic follow-up and explain the importance of returning for new or persistent symptoms.',
    },
  ],
  recallPrompts: [
    {
      prompt:
        'What limb posture classically suggests Posterior Hip Dislocation?',
      answer:
        'A shortened limb held in flexion, adduction, and internal rotation.',
    },
    {
      prompt: 'What common mechanism produces Posterior Hip Dislocation?',
      answer:
        'A posteriorly directed force transmitted through the femur while the hip and knee are flexed, classically a knee striking a dashboard.',
    },
    {
      prompt: 'Which nerve is most at risk?',
      answer: 'The sciatic nerve, particularly its peroneal division.',
    },
    {
      prompt: 'When should neurovascular status be documented?',
      answer:
        'Before reduction, immediately after reduction, and serially during subsequent assessment.',
    },
    {
      prompt: 'Why is urgent reduction important?',
      answer:
        'It restores joint congruity and minimises the duration of vascular compromise to the femoral head and pressure on neurovascular structures.',
    },
    {
      prompt: 'What imaging is needed after reduction of a native hip?',
      answer:
        'Repeat radiographs to confirm alignment and CT to assess fractures, loose bodies, and concentricity.',
    },
    {
      prompt: 'What major delayed complication must be monitored?',
      answer:
        'Avascular necrosis of the femoral head, together with post-traumatic osteoarthritis.',
    },
    {
      prompt:
        'What resting posture is more typical of Anterior Hip Dislocation?',
      answer:
        'Abduction and external rotation rather than adduction and internal rotation.',
    },
  ],
  references: [
    {
      citation:
        'Merck Manual Professional Edition. Hip Dislocations. Reviewed 2025; updated 2026.',
    },
    {
      citation:
        'American Academy of Orthopaedic Surgeons. OrthoInfo: Hip Dislocation.',
    },
    {
      citation:
        'AO Foundation Surgery Reference. Acetabular posterior-wall fracture-dislocation assessment and post-reduction CT principles.',
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
    '29 year old',
    'right knee struck',
    'right lower limb',
    'small posterior acetabular wall fracture',
    'this patient',
    'this case',
    'his radiograph',
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
          preferredClueTypes: ['history', 'symptom', 'exam', 'imaging'],
          notes:
            'Seeded flagship Posterior Hip Dislocation case focused on high-energy mechanism, characteristic limb posture, sciatic-nerve assessment, urgent reduction, and post-reduction CT evaluation.',
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
          preferredClueTypes: ['history', 'symptom', 'exam', 'imaging'],
          notes:
            'Seeded flagship Posterior Hip Dislocation case focused on high-energy mechanism, characteristic limb posture, sciatic-nerve assessment, urgent reduction, and post-reduction CT evaluation.',
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
      'Skipped diagnosis education because Posterior Hip Dislocation education already exists:',
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
        ? 'Skipped existing scheduled Posterior Hip Dislocation case.'
        : 'Skipped existing Posterior Hip Dislocation case to avoid overwriting authored content.',
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
      'Seeded complete frontend-aligned flagship Posterior Hip Dislocation case with six valid playable clues, exact clue-breakdown alignment, sciatic-nerve reasoning, urgent reduction teaching, and diagnosis-level education independent of the vignette.',
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
        'Created complete Posterior Hip Dislocation revision with six supported clue types, frontend-compatible reasoning, neurovascular assessment, directional imaging confirmation, and post-reduction CT teaching.',
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
      validatorVersion: 'flagship-human-review:posterior-hip-dislocation-v1',
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
        note: 'Complete Posterior Hip Dislocation flagship seed with six supported clue types, no early diagnosis-label leakage, exact clue-to-breakdown alignment, directional clinical reasoning, sciatic-nerve assessment, urgent reduction priorities, and independent diagnosis education.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded Posterior Hip Dislocation:', {
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
