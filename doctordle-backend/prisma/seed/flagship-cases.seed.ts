
import {
  PrismaClient,
  CaseEditorialStatus,
  DiagnosisEducationSource,
  DiagnosisEducationStatus,
  DiagnosisMappingMethod,
  DiagnosisMappingStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run the Sickle Cell Disease flagship seed.');
}

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function normalizeClinicalText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const now = new Date();
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 0, 12, 12, 0, 0));
const seedVersion = 'flagship-sickle-cell-disease-v1';

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

async function findAvailableInventoryPlaceholderDate(params: {
  preferredDate: Date;
  reusableCaseId?: string;
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
      return candidateDate;
    }

    if (params.reusableCaseId && owner.id === params.reusableCaseId) {
      return candidateDate;
    }
  }

  throw new Error(
    `Cannot seed ${params.displayLabel}: no free inventory placeholder date found.`,
  );
}

async function getNextCasePublicNumber(): Promise<number> {
  const latest = await prisma.case.findFirst({
    where: { publicNumber: { not: null } },
    orderBy: { publicNumber: 'desc' },
    select: { publicNumber: true },
  });

  return (latest?.publicNumber ?? 0) + 1;
}

// ─── Clues ────────────────────────────────────────────────────────────────────

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'An 8-year-old child is brought to the emergency department with severe pain in both legs and the lower back that began suddenly overnight.',
  },
  {
    order: 1,
    type: 'history',
    value:
      'The mother reports multiple similar episodes since early childhood, often triggered by dehydration or infection. She also notes occasional yellowing of the eyes.',
  },
  {
    order: 2,
    type: 'vital',
    value:
      'Temperature is 38.2°C, heart rate is 118/min, respiratory rate is 24/min, and blood pressure is 100/65 mmHg.',
  },
  {
    order: 3,
    type: 'exam',
    value:
      'The child appears pale and mildly jaundiced with diffuse tenderness over the long bones, but there is no joint swelling or redness.',
  },
  {
    order: 4,
    type: 'lab',
    value:
      'Full blood count reveals hemoglobin of 7.0 g/dL with reticulocytosis. Blood film demonstrates sickle-shaped red blood cells and target cells.',
  },
  {
    order: 5,
    type: 'investigation',
    value:
      'Hemoglobin electrophoresis shows predominantly HbS with absent HbA, confirming the underlying hemoglobin abnormality.',
  },
] as const;

const differentials = [
  'Acute osteomyelitis',
  'Septic arthritis',
  'Acute leukemia',
  'Juvenile idiopathic arthritis',
  'Hemolytic anemia',
];

// ─── Explanation ─────────────────────────────────────────────────────────────

const explanation = {
  diagnosis: 'Sickle Cell Disease presenting with vaso-occlusive pain crisis',

  summary:
    'This is sickle cell disease presenting with a vaso-occlusive pain crisis: recurrent severe bone pain triggered by dehydration or infection, chronic hemolysis with jaundice, anemia with reticulocytosis, sickled red cells on blood film, and hemoglobin electrophoresis showing predominantly HbS with absent HbA.',

  keyEvidence: [
    'Severe sudden pain in both legs and lower back',
    'Multiple similar episodes since early childhood',
    'Episodes triggered by dehydration or infection',
    'Occasional yellowing of the eyes',
    'Pallor and mild jaundice',
    'Diffuse long-bone tenderness without joint swelling',
    'Hemoglobin 7.0 g/dL with reticulocytosis',
    'Sickle-shaped red cells and target cells on blood film',
    'Predominantly HbS with absent HbA on hemoglobin electrophoresis',
  ],

  reasoning: [
    'Sudden severe pain in the limbs and lower back suggests vaso-occlusion in bone and marrow rather than isolated joint disease.',
    'Recurrent similar painful episodes since early childhood strongly suggest an inherited chronic disorder rather than a first episode of trauma or infection.',
    'Dehydration and infection are classic triggers for sickling and vaso-occlusive crises.',
    'Intermittent jaundice indicates chronic hemolysis, supporting sickle cell disease over isolated orthopedic causes of limb pain.',
    'Pallor and jaundice on examination support chronic hemolytic anemia.',
    'Diffuse long-bone tenderness without focal joint swelling makes septic arthritis less likely and supports vaso-occlusive bone pain.',
    'Anemia with reticulocytosis shows marrow response to ongoing hemolysis.',
    'Sickle-shaped red cells and target cells on blood film provide strong morphologic evidence of sickle hemoglobinopathy.',
    'Hemoglobin electrophoresis with predominantly HbS and absent HbA confirms sickle cell disease rather than sickle trait.',
  ],

  keyFindings: [
    'Recurrent painful crises',
    'Bone and back pain',
    'Triggering by infection or dehydration',
    'Pallor',
    'Jaundice',
    'Anemia',
    'Reticulocytosis',
    'Sickled red cells',
    'HbS predominance',
    'Absent HbA',
  ],

  differentials,

  whyNotOthers: [
    {
      diagnosis: 'Acute osteomyelitis',
      reason:
        'Osteomyelitis can cause fever and bone pain, but this child has recurrent similar episodes, chronic hemolysis, sickled cells, and confirmatory Hb electrophoresis.',
    },
    {
      diagnosis: 'Septic arthritis',
      reason:
        'Septic arthritis usually causes a hot swollen painful joint with restricted movement; this case has diffuse long-bone tenderness without joint swelling.',
    },
    {
      diagnosis: 'Acute leukemia',
      reason:
        'Leukemia can cause bone pain and anemia, but the blood film and electrophoresis confirm sickle hemoglobinopathy rather than marrow malignancy.',
    },
    {
      diagnosis: 'Juvenile idiopathic arthritis',
      reason:
        'Juvenile idiopathic arthritis causes chronic inflammatory joint disease, not recurrent hemolytic painful crises with HbS predominance.',
    },
    {
      diagnosis: 'Hemolytic anemia',
      reason:
        'Hemolysis is present, but the pain pattern and hemoglobin electrophoresis specify sickle cell disease as the underlying cause.',
    },
  ],

  managementPearl:
    'In vaso-occlusive crisis, treat pain promptly, assess for infection and acute chest syndrome, maintain hydration carefully, give oxygen only if hypoxic, and avoid delaying analgesia while awaiting confirmatory tests.',

  differentialAnalysis: [
    {
      diagnosis: 'Acute osteomyelitis',
      whyPlausibleEarly:
        'Fever and long-bone pain in a child can suggest osteomyelitis, especially because sickle cell disease also increases infection risk.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'multiple similar episodes since early childhood',
          reason:
            'Recurrent self-similar painful episodes are more typical of vaso-occlusive crises than repeated acute osteomyelitis.',
        },
        {
          clueOrder: 3,
          evidence: 'diffuse tenderness over the long bones without focal swelling',
          reason:
            'Osteomyelitis more often produces localized bone tenderness and inflammatory signs.',
        },
        {
          clueOrder: 5,
          evidence: 'predominantly HbS with absent HbA',
          reason:
            'Electrophoresis confirms sickle cell disease as the underlying disorder explaining recurrent crises.',
        },
      ],
      finalReasonLessLikely:
        'Osteomyelitis remains an important complication to screen for, but it does not best explain the recurrent triggered pain and hemolytic evidence.',
    },
    {
      diagnosis: 'Septic arthritis',
      whyPlausibleEarly:
        'Fever and limb pain can raise concern for joint infection.',
      ruledOutByClues: [
        {
          clueOrder: 3,
          evidence: 'no joint swelling or redness',
          reason:
            'Septic arthritis usually presents with a hot swollen joint and marked pain on movement.',
        },
        {
          clueOrder: 4,
          evidence: 'sickle-shaped red blood cells and target cells',
          reason:
            'The blood film points toward sickle cell disease rather than primary joint infection.',
        },
      ],
      finalReasonLessLikely:
        'The pain is diffuse and bony rather than localized to an inflamed joint.',
    },
    {
      diagnosis: 'Acute leukemia',
      whyPlausibleEarly:
        'Bone pain, pallor, and anemia in a child can occur in leukemia.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'recurrent similar episodes triggered by dehydration or infection',
          reason:
            'This pattern is classic for vaso-occlusive crisis rather than progressive marrow failure.',
        },
        {
          clueOrder: 4,
          evidence: 'reticulocytosis',
          reason:
            'Reticulocytosis suggests marrow compensation for hemolysis, not marrow replacement.',
        },
        {
          clueOrder: 5,
          evidence: 'hemoglobin electrophoresis shows predominantly HbS with absent HbA',
          reason:
            'Electrophoresis confirms sickle cell disease.',
        },
      ],
      finalReasonLessLikely:
        'There is no blast-based blood film pattern or marrow failure profile; the hemoglobinopathy explains the presentation.',
    },
    {
      diagnosis: 'Juvenile idiopathic arthritis',
      whyPlausibleEarly:
        'Limb pain in a child can be mistaken for inflammatory joint disease.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence: 'sudden severe pain overnight',
          reason:
            'Vaso-occlusive pain crisis is often acute and severe, while JIA is usually chronic inflammatory joint pain.',
        },
        {
          clueOrder: 3,
          evidence: 'no joint swelling or redness',
          reason:
            'JIA typically involves joint swelling, stiffness, or restricted movement.',
        },
      ],
      finalReasonLessLikely:
        'The absence of inflammatory joint signs and the presence of hemolytic sickle features make JIA unlikely.',
    },
    {
      diagnosis: 'Hemolytic anemia',
      whyPlausibleEarly:
        'Pallor, jaundice, anemia, and reticulocytosis indicate hemolysis.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence: 'severe pain in both legs and lower back',
          reason:
            'Pain crisis is not explained by generic hemolytic anemia alone.',
        },
        {
          clueOrder: 4,
          evidence: 'sickle-shaped red blood cells',
          reason:
            'The smear identifies a sickling disorder.',
        },
        {
          clueOrder: 5,
          evidence: 'predominantly HbS with absent HbA',
          reason:
            'This confirms sickle cell disease rather than an unspecified hemolytic anemia.',
        },
      ],
      finalReasonLessLikely:
        'Hemolysis is part of the disease, but sickle cell disease is the specific diagnosis.',
    },
  ],

  generationQuality: {
    contentTier: 'FLAGSHIP',
    humanReviewed: true,
    seedVersion,
  },
};

// ─── Education ────────────────────────────────────────────────────────────────

const educationForFrontend = {
  title: 'Sickle Cell Disease',

  summary: {
    definition:
      'Sickle cell disease is an inherited hemoglobinopathy caused by abnormal hemoglobin S, leading to red cell sickling, chronic hemolytic anemia, vaso-occlusion, and recurrent painful crises.',
    highYieldTakeaway:
      'Think sickle cell disease when a child has recurrent severe bone pain, anemia, jaundice, reticulocytosis, sickled red cells, and hemoglobin electrophoresis showing predominantly HbS with absent HbA.',
  },

  recognitionPattern: [
    {
      pattern: 'Recurrent painful vaso-occlusive crises',
      whyItMatters:
        'Vaso-occlusion causes severe pain in bones, back, chest, abdomen, or limbs and is the most common acute presentation.',
      progression:
        'Trigger such as dehydration or infection → red cell sickling → microvascular obstruction → ischemic pain → inflammatory amplification.',
      discriminator:
        'Recurrent severe bone pain with hemolysis strongly separates sickle cell crisis from isolated trauma or arthritis.',
      commonTrap:
        'Do not delay analgesia while waiting for confirmatory tests in a known or strongly suspected vaso-occlusive crisis.',
    },
    {
      pattern: 'Chronic hemolysis',
      whyItMatters:
        'Sickled red cells are fragile and hemolyze, causing chronic anemia, jaundice, gallstones, and reticulocytosis.',
      discriminator:
        'Anemia with reticulocytosis and jaundice points toward hemolysis rather than marrow failure.',
      commonTrap:
        'A low hemoglobin in sickle cell disease must be compared with baseline; a sudden drop suggests aplastic crisis, splenic sequestration, or acute hemolysis.',
    },
    {
      pattern: 'HbS predominance with absent HbA',
      whyItMatters:
        'Hemoglobin electrophoresis confirms the diagnosis and distinguishes sickle cell disease from sickle trait.',
      discriminator:
        'Sickle trait usually has substantial HbA, while sickle cell disease has absent or very low HbA depending on genotype.',
      commonTrap:
        'A sickling screen alone is not enough for complete characterization; electrophoresis or HPLC is needed.',
    },
  ],

  keySymptoms: [
    {
      symptom: 'Severe limb or back pain',
      significance:
        'Typical of vaso-occlusive crisis due to microvascular obstruction in bone and marrow.',
    },
    {
      symptom: 'Recurrent painful episodes',
      significance:
        'Suggests a chronic inherited sickling disorder rather than a single acute orthopedic or infectious event.',
    },
    {
      symptom: 'Yellow eyes',
      significance:
        'Suggests jaundice from chronic hemolysis.',
    },
    {
      symptom: 'Fever',
      significance:
        'May be a trigger for crisis or a sign of serious infection; children with sickle cell disease are functionally asplenic and high risk.',
    },
  ],

  keySigns: [
    {
      finding: 'Pallor',
      significance:
        'Reflects chronic anemia from hemolysis.',
      discriminator:
        'Anemia with reticulocytosis supports hemolysis rather than isolated inflammatory pain.',
    },
    {
      finding: 'Jaundice',
      significance:
        'Reflects bilirubin production from chronic red cell breakdown.',
      discriminator:
        'Jaundice plus bone pain suggests sickle cell disease over uncomplicated arthritis.',
    },
    {
      finding: 'Diffuse long-bone tenderness',
      significance:
        'Supports vaso-occlusive bone pain.',
      discriminator:
        'Absence of joint swelling or redness makes septic arthritis less likely.',
    },
  ],

  examPearls: [
    {
      type: 'physical',
      title: 'Pain without joint inflammation points to bone vaso-occlusion',
      content:
        'Severe limb pain with diffuse long-bone tenderness but no swollen red joint supports vaso-occlusive crisis rather than septic arthritis.',
      whyItMatters:
        'It helps localize the process to bone and marrow ischemia rather than primary joint infection.',
      discriminator:
        'Joint swelling, refusal to move a single joint, or marked focal warmth should trigger septic arthritis evaluation.',
      trapAvoided:
        'Do not dismiss fever in sickle cell disease; infection can coexist with vaso-occlusive crisis.',
    },
    {
      type: 'lab_reasoning',
      title: 'Reticulocytosis shows marrow response to hemolysis',
      content:
        'A low hemoglobin with reticulocytosis suggests the marrow is responding to red cell destruction.',
      whyItMatters:
        'This supports chronic hemolytic anemia and helps separate uncomplicated vaso-occlusive crisis from aplastic crisis.',
      discriminator:
        'A low reticulocyte count in sickle cell disease is dangerous and suggests aplastic crisis, often from parvovirus B19.',
      trapAvoided:
        'Do not treat all anemia in sickle cell disease the same; reticulocyte count changes the differential.',
    },
    {
      type: 'lab_reasoning',
      title: 'Electrophoresis separates disease from trait',
      content:
        'Predominantly HbS with absent HbA confirms sickle cell disease rather than sickle trait.',
      whyItMatters:
        'This determines lifelong risk, counseling, follow-up, and preventive care.',
      discriminator:
        'Sickle trait usually has both HbA and HbS, with HbA predominating.',
      trapAvoided:
        'Do not call someone sickle cell disease based only on a positive sickling screen.',
    },
    {
      type: 'MNEMONIC',
      title: 'VOC trigger checklist',
      content:
        'SICKLE — Stress or infection; Inadequate hydration; Cold exposure; Low oxygen; Exertion; missed prevention.',
      whyItMatters:
        'These triggers help identify why a vaso-occlusive crisis occurred and how to prevent recurrence.',
      discriminator:
        'Trigger recognition supports crisis physiology when paired with recurrent severe bone pain and hemolysis.',
      trapAvoided:
        'Mnemonic content belongs here only; scoringSystems is intentionally reserved for formal tools.',
    },
  ],

  scoringSystems: [],

  investigations: [
    {
      test: 'Full blood count',
      interpretation:
        'Typically shows chronic anemia; compare hemoglobin with the patient’s baseline.',
      whyItMatters:
        'A sudden fall may indicate aplastic crisis, splenic sequestration, acute hemolysis, or bleeding.',
    },
    {
      test: 'Reticulocyte count',
      interpretation:
        'Usually elevated in chronic hemolysis. Low reticulocytes suggest aplastic crisis.',
      whyItMatters:
        'Separates compensated hemolysis from marrow suppression.',
    },
    {
      test: 'Peripheral blood film',
      interpretation:
        'May show sickled red cells, target cells, polychromasia, and features of hemolysis.',
      whyItMatters:
        'Provides rapid morphologic support for sickle cell disease.',
    },
    {
      test: 'Hemoglobin electrophoresis or HPLC',
      interpretation:
        'Shows HbS pattern and distinguishes sickle cell disease from sickle trait and other hemoglobinopathies.',
      whyItMatters:
        'This is the diagnostic confirmation test.',
    },
    {
      test: 'Infection screen when febrile',
      interpretation:
        'Blood cultures, urine testing, chest assessment, malaria testing where relevant, and targeted imaging may be needed.',
      whyItMatters:
        'Children with sickle cell disease are at increased risk of serious bacterial infection.',
    },
    {
      test: 'Chest assessment',
      interpretation:
        'Assess for chest pain, cough, hypoxia, infiltrates, or respiratory distress.',
      whyItMatters:
        'Acute chest syndrome is a major life-threatening complication and may initially resemble pneumonia.',
    },
  ],

  pitfalls: [
    {
      pitfall: 'Delaying analgesia during vaso-occlusive crisis',
      consequence:
        'Uncontrolled pain worsens distress, sympathetic stress, and care experience; analgesia should be prompt and adequate.',
    },
    {
      pitfall: 'Ignoring fever',
      consequence:
        'Serious bacterial infection can progress rapidly because of functional asplenia.',
    },
    {
      pitfall: 'Missing acute chest syndrome',
      consequence:
        'Respiratory symptoms or hypoxia during crisis can deteriorate quickly and require urgent escalation.',
    },
    {
      pitfall: 'Assuming all anemia is baseline',
      consequence:
        'Aplastic crisis, splenic sequestration, or acute hemolysis may be missed.',
    },
    {
      pitfall: 'Overhydrating aggressively',
      consequence:
        'Excess fluids may worsen pulmonary complications; hydration should be careful and clinically guided.',
    },
  ],

  managementOverview: [
    {
      step: 'Assess severity and complications',
      rationale:
        'Check pain severity, oxygen saturation, fever, respiratory symptoms, hydration status, neurological symptoms, and baseline hemoglobin if known.',
    },
    {
      step: 'Give prompt analgesia',
      rationale:
        'Vaso-occlusive crisis is painful and should be treated early with appropriate stepwise analgesia, including opioids when indicated.',
    },
    {
      step: 'Maintain careful hydration',
      rationale:
        'Dehydration promotes sickling, but excessive fluids can worsen respiratory complications.',
    },
    {
      step: 'Treat infection risk',
      rationale:
        'Fever in sickle cell disease needs urgent assessment and empiric antibiotics depending on severity and local protocols.',
    },
    {
      step: 'Give oxygen only if hypoxic',
      rationale:
        'Hypoxia worsens sickling; oxygen is indicated when saturation is low or acute chest syndrome is suspected.',
    },
    {
      step: 'Consider transfusion for severe complications',
      rationale:
        'Simple or exchange transfusion may be needed for severe acute chest syndrome, stroke, severe anemia, or selected high-risk complications.',
    },
    {
      step: 'Long-term prevention',
      rationale:
        'Hydroxyurea, vaccination, penicillin prophylaxis in children, folate support where indicated, malaria prevention where relevant, and specialist follow-up reduce morbidity.',
    },
  ],

  differentialDistinguishers: [
    {
      diagnosis: 'Acute osteomyelitis',
      whyConfused:
        'Both can cause fever and bone pain, and osteomyelitis is more common in sickle cell disease.',
      distinguishingPoint:
        'Osteomyelitis is more focal and infective; vaso-occlusive crisis is often recurrent, multifocal, and triggered by dehydration or infection.',
      keySeparator:
        'Recurrent crises plus HbS-confirmed disease support vaso-occlusion.',
      classicTrap:
        'Do not assume it is only crisis if fever, focal tenderness, or persistent inflammatory markers suggest osteomyelitis.',
    },
    {
      diagnosis: 'Septic arthritis',
      whyConfused:
        'Fever and limb pain can mimic joint infection.',
      distinguishingPoint:
        'Septic arthritis usually causes a hot swollen joint with severe pain on movement.',
      keySeparator:
        'Diffuse bone tenderness without joint swelling supports vaso-occlusive pain.',
      classicTrap:
        'Missing septic arthritis can destroy a joint, so focal joint findings need urgent workup.',
    },
    {
      diagnosis: 'Acute leukemia',
      whyConfused:
        'Bone pain, pallor, and anemia occur in leukemia.',
      distinguishingPoint:
        'Leukemia often shows marrow failure, bruising, infections, lymphadenopathy, hepatosplenomegaly, or blasts.',
      keySeparator:
        'Reticulocytosis, sickled cells, and HbS predominance point to sickle cell disease.',
      classicTrap:
        'Do not ignore atypical blood film features or pancytopenia.',
    },
    {
      diagnosis: 'Juvenile idiopathic arthritis',
      whyConfused:
        'A child with limb pain may be mislabelled as inflammatory joint disease.',
      distinguishingPoint:
        'JIA causes chronic joint swelling, stiffness, and restricted movement.',
      keySeparator:
        'Acute severe bone pain with hemolysis and HbS pattern supports sickle cell crisis.',
    },
    {
      diagnosis: 'Generic hemolytic anemia',
      whyConfused:
        'Jaundice, anemia, and reticulocytosis indicate hemolysis.',
      distinguishingPoint:
        'Sickle cell disease adds vaso-occlusive pain and HbS predominance.',
      keySeparator:
        'Electrophoresis confirms the specific hemoglobinopathy.',
    },
  ],

  complications: [
    {
      complication: 'Acute chest syndrome',
      whyItMatters:
        'A major cause of morbidity and mortality; suspect with chest pain, cough, fever, hypoxia, or new infiltrate.',
    },
    {
      complication: 'Stroke',
      whyItMatters:
        'Children with sickle cell disease are at increased risk of ischemic stroke and need urgent evaluation of neurological symptoms.',
    },
    {
      complication: 'Splenic sequestration',
      whyItMatters:
        'Can cause sudden severe anemia and shock, especially in young children.',
    },
    {
      complication: 'Aplastic crisis',
      whyItMatters:
        'Often triggered by parvovirus B19 and presents with sudden anemia and low reticulocyte count.',
    },
    {
      complication: 'Severe infection',
      whyItMatters:
        'Functional asplenia increases risk of encapsulated bacterial infection.',
    },
    {
      complication: 'Chronic organ damage',
      whyItMatters:
        'Repeated vaso-occlusion can damage kidneys, lungs, brain, bones, and eyes over time.',
    },
  ],

  recallPrompts: [
    {
      prompt: 'What confirms sickle cell disease rather than sickle trait?',
      answer:
        'Hemoglobin electrophoresis or HPLC showing predominantly HbS with absent or very low HbA supports sickle cell disease rather than trait.',
    },
    {
      prompt: 'What causes pain in vaso-occlusive crisis?',
      answer:
        'Sickled red cells obstruct small blood vessels, causing tissue ischemia and inflammatory pain, especially in bone and marrow.',
    },
    {
      prompt: 'Why is reticulocytosis expected in sickle cell disease?',
      answer:
        'Chronic hemolysis stimulates the marrow to increase red cell production, raising the reticulocyte count.',
    },
    {
      prompt: 'What complications must be screened for during a painful crisis?',
      answer:
        'Acute chest syndrome, infection, severe anemia, splenic sequestration, stroke symptoms, and dehydration should be assessed.',
    },
    {
      prompt: 'Name common triggers for vaso-occlusive crisis.',
      answer:
        'Dehydration, infection, cold exposure, hypoxia, physical stress, and sometimes missed preventive care can trigger crises.',
    },
  ],

  references: [],
};

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const canonicalName = 'sickle cell disease';
  const displayLabel = 'Sickle Cell Disease';

  const normalizedTerms = [
    canonicalName,
    displayLabel,
    'sickle cell anaemia',
    'sickle cell anemia',
    'sickle cell disease vaso occlusive crisis',
    'vaso occlusive crisis',
    'sickle cell crisis',
    'hbss disease',
  ].map(normalizeClinicalText);

  let registry = await prisma.diagnosisRegistry.findFirst({
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
      canonicalNormalized: true,
      displayLabel: true,
      active: true,
    },
  });

  if (!registry) {
    registry = await prisma.diagnosisRegistry.create({
      data: {
        canonicalName,
        canonicalNormalized: normalizeClinicalText(canonicalName),
        displayLabel,
        active: true,
        status: 'ACTIVE',
        isDescriptive: false,
        isCompositional: false,
        searchPriority: 0,
        category: 'Hematology',
        specialty: 'Hematology',
        subspecialty: 'Hemoglobinopathy',
        bodySystem: 'Hematologic',
        organSystem: 'Blood',
        difficultyBand: 'BASIC',
        rarityBand: 'COMMON',
        clinicalSetting: 'EMERGENCY',
        ageGroup: 'PEDIATRIC',
        urgencyLevel: 'URGENT',
        isPlayable: true,
        isGeneratable: true,
        preferredClueTypes: ['history', 'vital', 'exam', 'lab', 'investigation'],
        onboardingStatus: 'READY_FOR_REVIEW',
        activationReviewedAt: now,
        notes:
          'Seeded from flagship Sickle Cell Disease vaso-occlusive crisis case. Registry was created because no existing active diagnosis was found.',
      },
      select: {
        id: true,
        canonicalName: true,
        canonicalNormalized: true,
        displayLabel: true,
        active: true,
      },
    });

    console.log('Created DiagnosisRegistry entry for Sickle Cell Disease', {
      registryId: registry.id,
    });
  }

  const education = await prisma.diagnosisEducation.upsert({
    where: { diagnosisRegistryId: registry.id },
    update: {
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
    create: {
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
      version: 1,
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

  const history =
    clues.find((clue) => clue.type === 'history')?.value ?? displayLabel;

  const symptoms = clues
    .filter((clue) => clue.type === 'symptom')
    .map((clue) => clue.value);

  const existingCases = await prisma.case.findMany({
    where: {
      diagnosisRegistryId: registry.id,
      proposedDiagnosisText: { in: [displayLabel, registry.displayLabel] },
    },
    orderBy: [{ approvedAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      currentRevisionId: true,
      publicNumber: true,
      title: true,
      dailyCases: { select: { id: true }, take: 1 },
    },
  });

  const reusableCase = existingCases.find(
    (caseRecord) => caseRecord.dailyCases.length === 0,
  );

  const scheduledDuplicate = existingCases.find(
    (caseRecord) => caseRecord.dailyCases.length > 0,
  );

  if (!reusableCase && scheduledDuplicate) {
    throw new Error(
      `Cannot seed ${displayLabel}: a scheduled case already exists for this registry (${scheduledDuplicate.id}, ${scheduledDuplicate.title}). Refusing to create a duplicate flagship inventory case.`,
    );
  }

  const publicNumber =
    reusableCase?.publicNumber ?? (await getNextCasePublicNumber());

  const assignedInventoryPlaceholderDate =
    await findAvailableInventoryPlaceholderDate({
      preferredDate: inventoryPlaceholderDate,
      reusableCaseId: reusableCase?.id,
      displayLabel,
    });

  const caseData = {
    title: displayLabel,
    publicNumber,
    date: assignedInventoryPlaceholderDate,
    difficulty: 'medium',
    history,
    symptoms,
    clues: clues as unknown as object,
    explanation: explanation as object,
    differentials,
    editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
    approvedAt: now,
    publishedAt: null,
    diagnosisRegistryId: registry.id,
    proposedDiagnosisText: displayLabel,
    diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
    diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
    diagnosisMappingConfidence: 1,
    diagnosisEditorialNote:
      'Seeded flagship Sickle Cell Disease vaso-occlusive crisis inventory case. Registry was looked up first and created only if missing.',
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

  const revisionData = {
    source: 'MANUAL' as const,
    publishTrack: 'DAILY' as const,
    title: displayLabel,
    publicNumber,
    date: assignedInventoryPlaceholderDate,
    difficulty: 'medium',
    history,
    symptoms,
    clues: clues as unknown as object,
    explanation: explanation as object,
    differentials,
    diagnosisRegistryId: registry.id,
    proposedDiagnosisText: displayLabel,
    diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
    diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
    diagnosisMappingConfidence: 1,
    diagnosisEditorialNote:
      'Frontend-aligned flagship Sickle Cell Disease inventory revision using registry lookup/create-if-missing and duplicate-safe case reuse.',
  };

  const revision = reusableCase?.currentRevisionId
    ? await prisma.caseRevision.update({
        where: { id: reusableCase.currentRevisionId },
        data: revisionData,
        select: { id: true },
      })
    : await (async () => {
        const latestRevision = await prisma.caseRevision.findFirst({
          where: { caseId: seededCase.id },
          orderBy: { revisionNumber: 'desc' },
          select: { revisionNumber: true },
        });

        return prisma.caseRevision.create({
          data: {
            caseId: seededCase.id,
            revisionNumber: (latestRevision?.revisionNumber ?? 0) + 1,
            ...revisionData,
          },
          select: { id: true },
        });
      })();

  await prisma.case.update({
    where: { id: seededCase.id },
    data: { currentRevisionId: revision.id },
  });

  await prisma.caseValidationRun.create({
    data: {
      caseId: seededCase.id,
      revisionId: revision.id,
      source: 'MANUAL',
      publishTrack: 'DAILY',
      outcome: 'PASSED',
      validatorVersion: 'flagship-human-review:sickle-cell-disease-v1',
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        note:
          'Manual frontend-aligned Sickle Cell Disease vaso-occlusive crisis inventory case seeded with registry lookup/create-if-missing, supported clue types, mnemonic in examPearls, and duplicate-safe case reuse.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded frontend-aligned Sickle Cell Disease:', {
    registryId: registry.id,
    registryDisplayLabel: registry.displayLabel,
    caseId: seededCase.id,
    publicNumber,
    educationId: education.id,
    inventoryPlaceholderDate: assignedInventoryPlaceholderDate.toISOString(),
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
