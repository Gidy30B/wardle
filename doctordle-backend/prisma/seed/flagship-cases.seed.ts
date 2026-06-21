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

const databaseUrl = resolvePgConnectionString(process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run Legg-Calvé-Perthes disease seed.');
}

const pool = new Pool({ connectionString: databaseUrl, max: 1 });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function resolvePgConnectionString(value: string | undefined): string | undefined {
  if (!value) return undefined;

  if (!value.startsWith('prisma+postgres://')) {
    return value;
  }

  const parsed = new URL(value);
  const apiKey = parsed.searchParams.get('api_key');
  if (!apiKey) {
    throw new Error('DATABASE_URL uses prisma+postgres:// but is missing api_key.');
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

  throw new Error(`No free inventory placeholder date for ${params.displayLabel}.`);
}

const now = new Date();
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 0, 18, 12, 0, 0));
const seedVersion = 'flagship-legg-calve-perthes-disease-v1';

const canonicalName = 'legg-calve-perthes disease';
const displayLabel = 'Legg-Calvé-Perthes Disease';
const caseTitle = 'Legg-Calvé-Perthes Disease with Avascular Necrosis of the Femoral Head';

const aliasTerms = [
  'Legg-Calvé-Perthes Disease',
  'Legg Calve Perthes Disease',
  'legg-calve-perthes disease',
  'perthes disease',
  'legg perthes disease',
  'coxa plana',
  'idiopathic avascular necrosis of the femoral head in children',
  'juvenile osteonecrosis of the femoral head',
];

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 7-year-old boy is brought with a gradual limp and intermittent left hip pain for two months, with no history of major trauma.',
  },
  {
    order: 1,
    type: 'symptom',
    value:
      'The pain is worse after running and sometimes radiates to the thigh and knee, but there is no fever, weight loss, or night pain.',
  },
  {
    order: 2,
    type: 'exam',
    value:
      'He walks with an antalgic gait and has mild wasting of the left thigh compared with the right side.',
  },
  {
    order: 3,
    type: 'exam',
    value:
      'Hip examination shows reduced abduction and markedly limited internal rotation of the left hip, while the knee examination is normal.',
  },
  {
    order: 4,
    type: 'imaging',
    value:
      'Anteroposterior pelvis and frog-lateral hip radiographs show sclerosis and flattening of the left femoral head with widening of the joint space.',
  },
  {
    order: 5,
    type: 'imaging',
    value:
      'MRI confirms avascular necrosis of the femoral head with early fragmentation, without slipped epiphysis or destructive infection.',
  },
] as const;

const differentials = [
  'Slipped Capital Femoral Epiphysis',
  'Transient Synovitis',
  'Septic Arthritis of the Hip',
  'Juvenile Idiopathic Arthritis',
  'Developmental Dysplasia of the Hip',
];

const explanation = {
  diagnosis: displayLabel,
  summary:
    'A school-aged boy with gradual limp, activity-related hip pain radiating to the knee, restricted hip abduction and internal rotation, and imaging showing sclerosis, flattening, and avascular necrosis of the femoral head supports Legg-Calvé-Perthes disease.',
  reasoning: [
    'A chronic atraumatic limp in a child suggests a hip disorder even when the child reports thigh or knee pain.',
    'Activity-related hip or referred knee pain without fever or systemic illness points away from acute infection.',
    'Antalgic gait and thigh wasting suggest a chronic painful hip process.',
    'Limited abduction and internal rotation are classic high-yield examination findings in Perthes disease.',
    'Radiographic femoral head sclerosis and flattening support osteonecrosis rather than transient synovitis.',
    'MRI confirmation of femoral head avascular necrosis with no slipped epiphysis or infection completes the diagnosis.',
  ],
  keyFindings: [
    'Age 7 years',
    'Male child',
    'Gradual limp',
    'Intermittent hip pain',
    'Pain radiating to thigh or knee',
    'Worse after activity',
    'No major trauma',
    'No fever or systemic illness',
    'Antalgic gait',
    'Thigh wasting',
    'Reduced hip abduction',
    'Limited internal rotation',
    'Normal knee examination',
    'Femoral head sclerosis',
    'Femoral head flattening',
    'Widened hip joint space',
    'MRI-confirmed avascular necrosis',
    'Early fragmentation of femoral head',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Slipped Capital Femoral Epiphysis',
      whyPlausibleEarly:
        'SCFE can cause limp, hip pain, thigh pain, or knee pain in older children and adolescents.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence: '7-year-old boy',
          reason:
            'SCFE is more typical in adolescents, especially overweight children, while Perthes commonly affects younger children around 4 to 10 years.',
        },
        {
          clueOrder: 5,
          evidence: 'MRI confirms avascular necrosis without slipped epiphysis',
          reason:
            'Absence of epiphyseal slip and presence of femoral head osteonecrosis favor Perthes disease.',
        },
      ],
      finalReasonLessLikely:
        'SCFE is less likely because imaging shows avascular necrosis and flattening rather than posterior-inferior displacement of the femoral epiphysis.',
    },
    {
      diagnosis: 'Transient Synovitis',
      whyPlausibleEarly:
        'Transient synovitis can present with limp and hip pain in a child.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence: 'symptoms for two months',
          reason:
            'Transient synovitis is usually acute and self-limiting rather than a progressive chronic limp.',
        },
        {
          clueOrder: 4,
          evidence: 'sclerosis and flattening of the femoral head',
          reason:
            'Structural femoral head changes are not expected in simple transient synovitis.',
        },
      ],
      finalReasonLessLikely:
        'Transient synovitis does not explain chronic symptoms with femoral head sclerosis, flattening, and MRI-confirmed osteonecrosis.',
    },
    {
      diagnosis: 'Septic Arthritis of the Hip',
      whyPlausibleEarly:
        'Septic arthritis is an important cause of limp and hip pain in children and must be considered early.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'no fever, weight loss, or night pain',
          reason:
            'Septic arthritis usually causes acute severe pain with fever, toxicity, and refusal to bear weight.',
        },
        {
          clueOrder: 5,
          evidence: 'no destructive infection on MRI',
          reason:
            'MRI does not support septic arthritis or adjacent osteomyelitis.',
        },
      ],
      finalReasonLessLikely:
        'The chronic course, absence of systemic illness, and imaging pattern favor Perthes disease over septic arthritis.',
    },
    {
      diagnosis: 'Juvenile Idiopathic Arthritis',
      whyPlausibleEarly:
        'Chronic limp and joint symptoms in a child can suggest juvenile idiopathic arthritis.',
      ruledOutByClues: [
        {
          clueOrder: 3,
          evidence: 'isolated hip restriction with normal knee examination',
          reason:
            'JIA often has inflammatory stiffness, swelling, or multiple joint involvement rather than isolated femoral head collapse.',
        },
        {
          clueOrder: 4,
          evidence: 'femoral head sclerosis and flattening',
          reason:
            'These are structural osteonecrotic changes typical of Perthes disease.',
        },
      ],
      finalReasonLessLikely:
        'JIA does not explain the classic radiographic and MRI findings of femoral head avascular necrosis.',
    },
    {
      diagnosis: 'Developmental Dysplasia of the Hip',
      whyPlausibleEarly:
        'Hip pathology and limp in a child can raise concern for developmental dysplasia.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence: 'gradual limp beginning at age 7 years',
          reason:
            'Developmental dysplasia usually presents earlier, often in infancy or toddler years.',
        },
        {
          clueOrder: 5,
          evidence: 'MRI confirms avascular necrosis of the femoral head',
          reason:
            'The primary pathology is osteonecrosis rather than acetabular dysplasia or dislocation.',
        },
      ],
      finalReasonLessLikely:
        'DDH is less likely because imaging localizes the problem to avascular necrosis and flattening of the femoral head.',
    },
  ],
  managementPearl:
    'Legg-Calvé-Perthes disease is idiopathic avascular necrosis of the capital femoral epiphysis in children. Management aims to maintain femoral head containment and range of motion, with urgency of orthopedic referral guided by age, severity, femoral head involvement, and loss of containment.',
  generationQuality: {
    contentTier: 'FLAGSHIP',
    seedVersion,
    humanReviewed: true,
    discriminatorStrength: 'HIGH',
    expectedTeachingPoints: [
      'Perthes disease commonly presents as chronic atraumatic limp in a boy aged 4 to 10 years',
      'Hip disease may present as thigh or knee pain',
      'Reduced abduction and internal rotation are key examination clues',
      'X-ray may show femoral head sclerosis, fragmentation, flattening, or coxa plana',
      'Management focuses on containment, range of motion, analgesia, activity modification, and orthopedic follow-up',
    ],
    competencyDomains: [
      'Orthopaedics',
      'Paediatrics',
      'Paediatric Orthopaedics',
      'Musculoskeletal Medicine',
      'Clinical Reasoning',
    ],
  },
};

const educationForFrontend = {
  title: displayLabel,
  summary: {
    definition:
      'Legg-Calvé-Perthes disease is idiopathic avascular necrosis of the capital femoral epiphysis in a child, leading to femoral head ischemia, fragmentation, remodeling, and possible deformity.',
    highYieldTakeaway:
      'Think Perthes disease in a 4- to 10-year-old boy with gradual limp, hip or referred knee pain, limited hip abduction and internal rotation, and femoral head sclerosis or flattening on imaging.',
  },
  recognitionPattern: [
    {
      pattern: 'Chronic atraumatic limp in a young boy',
      whyItMatters:
        'Perthes disease is often missed because the onset is gradual and the child may complain of knee or thigh pain rather than hip pain.',
      progression:
        'Temporary loss of femoral head blood supply -> epiphyseal necrosis -> sclerosis -> fragmentation -> flattening or coxa plana -> remodeling.',
      discriminator:
        'The combination of chronic limp, reduced hip motion, and femoral head changes separates Perthes from transient synovitis.',
      commonTrap:
        'Do not stop at a normal knee exam when the child reports knee pain; examine and image the hip.',
    },
    {
      pattern: 'Painful restricted hip abduction and internal rotation',
      whyItMatters:
        'Loss of abduction and internal rotation is one of the most useful bedside clues to hip pathology.',
      discriminator:
        'A normal knee with restricted hip movement points the diagnostic search back to the hip.',
      commonTrap:
        'Do not label the limp as muscular strain when hip range of motion is clearly reduced.',
    },
    {
      pattern: 'Femoral head osteonecrosis on imaging',
      whyItMatters:
        'Imaging confirms the structural disease and helps guide prognosis and orthopedic management.',
      discriminator:
        'Sclerosis, fragmentation, flattening, or coxa plana support Perthes disease over inflammatory or viral causes of limp.',
      commonTrap:
        'Early radiographs can be subtle; persistent symptoms may require repeat imaging or MRI.',
    },
  ],
  keySymptoms: [
    {
      symptom: 'Gradual limp',
      significance:
        'A slowly progressive limp is the usual presentation and may occur before severe pain develops.',
    },
    {
      symptom: 'Hip, groin, thigh, or knee pain',
      significance:
        'Hip pathology can refer pain to the thigh or knee, so knee pain should not exclude hip disease.',
    },
    {
      symptom: 'Pain worse with activity',
      significance:
        'Mechanical worsening after play or running supports a structural hip disorder.',
    },
  ],
  keySigns: [
    {
      finding: 'Antalgic gait',
      significance:
        'Suggests the child is reducing stance time on the painful side.',
    },
    {
      finding: 'Reduced hip abduction',
      significance:
        'A classic examination finding that reflects hip irritability and loss of containment mechanics.',
      discriminator:
        'Reduced hip abduction is more useful than isolated tenderness for localizing pathology to the hip.',
    },
    {
      finding: 'Limited internal rotation',
      significance:
        'A high-yield sign of pediatric hip pathology and a major clue in Perthes disease.',
      discriminator:
        'Limited internal rotation helps separate true hip disease from isolated knee pathology.',
    },
    {
      finding: 'Thigh wasting',
      significance:
        'Suggests chronicity and reduced use of the affected limb.',
    },
  ],
  examPearls: [
    {
      type: 'DISCRIMINATOR',
      title: 'Knee pain can be hip disease',
      content:
        'A child with knee pain and a limp needs hip examination because Perthes disease may refer pain to the thigh or knee.',
      whyItMatters:
        'This prevents missing the diagnosis when the knee exam is normal.',
      discriminator:
        'Normal knee findings plus reduced hip abduction or internal rotation localize the problem to the hip.',
      trapAvoided:
        'Do not treat persistent knee pain as a knee problem without checking hip range of motion.',
    },
    {
      type: 'DISCRIMINATOR',
      title: 'Chronic course separates Perthes from transient synovitis',
      content:
        'Transient synovitis is usually acute and self-limiting, while Perthes disease causes a persistent or progressive limp.',
      whyItMatters:
        'Duration of symptoms is a major clue in pediatric limp assessment.',
      discriminator:
        'Symptoms lasting weeks to months with radiographic femoral head changes favor Perthes disease.',
      trapAvoided:
        'Do not repeatedly diagnose transient synovitis when the limp persists.',
    },
    {
      type: 'MNEMONIC',
      title: 'PERTHES pattern',
      content:
        'PERTHES: Painful limp, Epiphyseal avascular necrosis, Reduced abduction/internal rotation, Thigh or knee referred pain, Hip x-ray changes, Early ortho follow-up, School-aged boy.',
      whyItMatters:
        'The mnemonic organizes the typical presentation and key discriminators.',
      discriminator:
        'It links the clinical presentation to the femoral head imaging abnormality.',
      trapAvoided:
        'Do not place this mnemonic under scoringSystems; it is a memory aid, not a formal score.',
    },
  ],
  scoringSystems: [],
  investigations: [
    {
      test: 'AP pelvis and frog-lateral hip radiographs',
      interpretation:
        'May show femoral head sclerosis, fragmentation, flattening, widening of the joint space, or coxa plana.',
      whyItMatters:
        'Plain radiographs are the first-line imaging test for suspected Perthes disease.',
    },
    {
      test: 'MRI hip',
      interpretation:
        'Detects early avascular necrosis and defines the extent of femoral head involvement when x-rays are normal or equivocal.',
      whyItMatters:
        'MRI is useful in early disease and helps separate Perthes disease from infection, tumor, or slipped epiphysis.',
    },
    {
      test: 'Full blood count and inflammatory markers',
      interpretation:
        'Usually normal or only mildly abnormal in Perthes disease.',
      whyItMatters:
        'Marked fever, leukocytosis, or very high inflammatory markers should raise concern for infection or inflammatory disease.',
    },
    {
      test: 'Hip ultrasound',
      interpretation:
        'May detect an effusion but does not define femoral head viability.',
      whyItMatters:
        'Useful when differentiating painful hip effusion, but x-ray or MRI is needed for Perthes disease assessment.',
    },
  ],
  managementOverview: [
    {
      step: 'Refer to orthopedics or pediatric orthopedics',
      rationale:
        'Management depends on age, stage, femoral head involvement, and containment.',
    },
    {
      step: 'Provide analgesia and activity modification',
      rationale:
        'Pain control and avoiding high-impact activity reduce symptoms while the femoral head remodels.',
    },
    {
      step: 'Maintain hip range of motion',
      rationale:
        'Physiotherapy and stretching help preserve abduction and internal rotation.',
    },
    {
      step: 'Use containment strategies when indicated',
      rationale:
        'Bracing or surgery may be needed to keep the femoral head contained within the acetabulum during healing.',
    },
    {
      step: 'Monitor with serial clinical and radiographic follow-up',
      rationale:
        'Disease evolves over years, and prognosis depends on femoral head shape at healing.',
    },
    {
      step: 'Escalate if older age, severe collapse, or loss of containment',
      rationale:
        'Children older than 6 to 8 years or those with extensive femoral head involvement have higher risk of poor outcome.',
    },
  ],
  differentialDistinguishers: [
    {
      diagnosis: 'Slipped Capital Femoral Epiphysis',
      whyConfused:
        'Both can cause limp with hip, thigh, or knee pain.',
      distinguishingPoint:
        'SCFE usually affects adolescents and shows epiphyseal slip rather than femoral head necrosis and flattening.',
      keySeparator:
        'Posterior-inferior epiphyseal displacement favors SCFE; avascular necrosis with coxa plana favors Perthes.',
      classicTrap:
        'Assuming every pediatric hip limp is Perthes without checking age, body habitus, and lateral hip imaging.',
    },
    {
      diagnosis: 'Transient Synovitis',
      whyConfused:
        'Both can present with limp and hip pain in children.',
      distinguishingPoint:
        'Transient synovitis is acute and self-limited; Perthes is persistent and produces femoral head changes.',
      keySeparator:
        'Symptoms for weeks to months plus sclerosis or flattening favor Perthes.',
      classicTrap:
        'Repeating symptomatic treatment without repeat assessment when the limp persists.',
    },
    {
      diagnosis: 'Septic Arthritis of the Hip',
      whyConfused:
        'A painful limp in a child can represent septic arthritis, which is urgent.',
      distinguishingPoint:
        'Septic arthritis usually has acute severe pain, fever, toxicity, refusal to bear weight, and raised inflammatory markers.',
      keySeparator:
        'A chronic afebrile limp with femoral head osteonecrosis favors Perthes.',
      classicTrap:
        'Missing septic arthritis when the child is febrile and unable to bear weight.',
    },
    {
      diagnosis: 'Juvenile Idiopathic Arthritis',
      whyConfused:
        'Chronic limp and reduced movement may suggest inflammatory arthritis.',
      distinguishingPoint:
        'JIA often has morning stiffness, swelling, multiple joint involvement, or systemic inflammatory features.',
      keySeparator:
        'Femoral head sclerosis, fragmentation, and flattening favor Perthes.',
      classicTrap:
        'Attributing persistent limp to arthritis without imaging the hip.',
    },
    {
      diagnosis: 'Developmental Dysplasia of the Hip',
      whyConfused:
        'Both may cause limp and abnormal hip mechanics.',
      distinguishingPoint:
        'DDH usually presents earlier and involves acetabular dysplasia or dislocation rather than femoral head osteonecrosis.',
      keySeparator:
        'Capital femoral epiphysis necrosis favors Perthes.',
      classicTrap:
        'Ignoring age of onset and the specific radiographic abnormality.',
    },
  ],
  complications: [
    {
      complication: 'Femoral head deformity',
      whyItMatters:
        'Residual flattening can impair hip mechanics and long-term function.',
    },
    {
      complication: 'Coxa plana',
      whyItMatters:
        'Flattening of the femoral head is a classic outcome of severe disease.',
    },
    {
      complication: 'Leg length discrepancy',
      whyItMatters:
        'Growth disturbance may cause shortening on the affected side.',
    },
    {
      complication: 'Reduced hip range of motion',
      whyItMatters:
        'Persistent stiffness may affect gait and function.',
    },
    {
      complication: 'Early osteoarthritis',
      whyItMatters:
        'Poor femoral head remodeling increases the risk of degenerative hip disease later in life.',
    },
  ],
  pitfalls: [
    {
      pitfall: 'Investigating only the knee when the child reports knee pain',
      consequence:
        'Misses referred pain from hip pathology.',
    },
    {
      pitfall: 'Calling persistent limp transient synovitis',
      consequence:
        'Delays diagnosis and orthopedic follow-up.',
    },
    {
      pitfall: 'Missing septic arthritis red flags',
      consequence:
        'A child with fever, toxicity, or refusal to bear weight needs urgent infection workup.',
    },
    {
      pitfall: 'Relying on one early normal x-ray',
      consequence:
        'Early Perthes disease can be subtle; persistent symptoms may require repeat imaging or MRI.',
    },
    {
      pitfall: 'Putting the PERTHES mnemonic under scoringSystems',
      consequence:
        'Pollutes scoringSystems with a mnemonic instead of reserving it for formal validated scores.',
    },
  ],
  recallPrompts: [
    {
      prompt: 'What age group is classic for Legg-Calvé-Perthes disease?',
      answer: 'Children around 4 to 10 years, especially boys.',
    },
    {
      prompt: 'What is the underlying pathology in Perthes disease?',
      answer: 'Idiopathic avascular necrosis of the capital femoral epiphysis.',
    },
    {
      prompt: 'Which hip movements are commonly restricted?',
      answer: 'Abduction and internal rotation.',
    },
    {
      prompt: 'Why can Perthes disease present as knee pain?',
      answer: 'Hip pathology can refer pain to the thigh or knee.',
    },
    {
      prompt: 'What x-ray findings support Perthes disease?',
      answer: 'Femoral head sclerosis, fragmentation, flattening, widened joint space, or coxa plana.',
    },
  ],
  references: [
    { citation: 'Nelson Textbook of Pediatrics.' },
    { citation: 'Rockwood and Wilkins’ Fractures in Children.' },
    { citation: 'AAOS and pediatric orthopedic guidance on Legg-Calvé-Perthes disease.' },
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
    select: { id: true },
  });

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
          specialty: 'Orthopaedics',
          subspecialty: 'Paediatric Orthopaedics',
          category: 'Avascular Necrosis',
          bodySystem: 'Musculoskeletal',
          organSystem: 'Hip',
          difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
          rarityBand: DiagnosisRarityBand.UNCOMMON,
          clinicalSetting: DiagnosisClinicalSetting.OUTPATIENT,
          ageGroup: DiagnosisAgeGroup.PEDIATRIC,
          urgencyLevel: DiagnosisUrgencyLevel.ROUTINE,
          preferredClueTypes: [
            'history',
            'symptom',
            'exam',
            'imaging',
          ],
          notes:
            'Seeded flagship Legg-Calvé-Perthes disease case with paediatric hip osteonecrosis teaching metadata.',
        },
        select: {
          id: true,
          displayLabel: true,
        },
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
          specialty: 'Orthopaedics',
          subspecialty: 'Paediatric Orthopaedics',
          category: 'Avascular Necrosis',
          bodySystem: 'Musculoskeletal',
          organSystem: 'Hip',
          difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
          rarityBand: DiagnosisRarityBand.UNCOMMON,
          clinicalSetting: DiagnosisClinicalSetting.OUTPATIENT,
          ageGroup: DiagnosisAgeGroup.PEDIATRIC,
          urgencyLevel: DiagnosisUrgencyLevel.ROUTINE,
          preferredClueTypes: [
            'history',
            'symptom',
            'exam',
            'imaging',
          ],
          notes:
            'Seeded flagship Legg-Calvé-Perthes disease case with paediatric hip osteonecrosis teaching metadata.',
        },
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
  registryDisplayLabel: string;
  educationId: string;
}) {
  const history = clues[0].value;
  const symptoms = [clues[1].value];

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

  const reusableCase = existingCases.find((c) => c.dailyCases.length === 0);
  const scheduledCase = existingCases.find((c) => c.dailyCases.length > 0);

  if (scheduledCase) {
    console.log('Skipped existing scheduled Legg-Calvé-Perthes disease case:', scheduledCase);
    return;
  }

  const assignedDate = await findAvailableInventoryPlaceholderDate({
    preferredDate: inventoryPlaceholderDate,
    reusableCaseId: reusableCase?.id,
    displayLabel: caseTitle,
  });

  const publicNumber =
    reusableCase?.publicNumber ?? (await getNextCasePublicNumber());

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
      'Seeded complete frontend-aligned flagship Legg-Calvé-Perthes disease case with education.',
  };

  const seededCase = reusableCase
    ? await prisma.case.update({
        where: { id: reusableCase.id },
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
        'Created complete Legg-Calvé-Perthes disease revision with education-aligned explanation.',
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
      validatorVersion: 'flagship-human-review:legg-calve-perthes-disease-v1',
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        note:
          'Complete Legg-Calvé-Perthes disease flagship seed with playable clue types and full education payload.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded Legg-Calvé-Perthes Disease:', {
    registryId: params.diagnosisRegistryId,
    caseId: seededCase.id,
    revisionId: revision.id,
    publicNumber,
    educationId: params.educationId,
    clueTypes: clues.map((c) => c.type),
  });
}

async function main() {
  const registry = await ensureRegistry();
  const education = await upsertEducation(registry.id);

  await upsertCase({
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
