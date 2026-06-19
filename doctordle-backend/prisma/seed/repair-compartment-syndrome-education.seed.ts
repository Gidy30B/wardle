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

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run HELLP syndrome seed.');
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
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 0, 16, 12, 0, 0));
const seedVersion = 'flagship-hellp-syndrome-v1';

const canonicalName = 'hellp syndrome';
const displayLabel = 'HELLP Syndrome';
const caseTitle = 'HELLP Syndrome in Severe Pre-eclampsia';

const aliasTerms = [
  'HELLP Syndrome',
  'hellp syndrome',
  'hellp',
  'hemolysis elevated liver enzymes low platelets',
  'pre-eclampsia with hellp syndrome',
];

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 24-year-old woman, gravida 2 para 1, at 35 weeks of gestation presents with a three-day history of worsening epigastric pain, nausea, and vomiting.',
  },
  {
    order: 1,
    type: 'symptom',
    value:
      'She reports feeling generally unwell and mentions intermittent headaches over the past week, which she attributed to stress and poor sleep.',
  },
  {
    order: 2,
    type: 'vital',
    value:
      'Blood pressure is 162/108 mmHg, heart rate is 96/min, respiratory rate is 20/min, and temperature is 36.9°C.',
  },
  {
    order: 3,
    type: 'exam',
    value:
      'Examination reveals mild facial edema, right upper quadrant tenderness, and brisk deep tendon reflexes.',
  },
  {
    order: 4,
    type: 'lab',
    value:
      'Urinalysis shows 2+ proteinuria. Blood tests reveal elevated AST and ALT, platelet count of 88 × 10⁹/L, and evidence of hemolysis.',
  },
  {
    order: 5,
    type: 'imaging',
    value:
      'Obstetric ultrasound demonstrates a live fetus measuring below the 10th percentile for gestational age with reduced amniotic fluid volume.',
  },
] as const;

const differentials = [
  'Severe Pre-eclampsia',
  'Acute Fatty Liver of Pregnancy',
  'Thrombotic Thrombocytopenic Purpura',
  'Acute Viral Hepatitis',
  'Gallstone Disease',
];

const explanation = {
  diagnosis: displayLabel,
  summary:
    'Severe hypertension after 20 weeks of gestation, headache, epigastric and right upper quadrant pain, proteinuria, hemolysis, elevated liver enzymes, thrombocytopenia, and fetal growth restriction support HELLP syndrome.',
  reasoning: [
    'Epigastric and right upper quadrant pain in late pregnancy suggests hepatic involvement in severe pre-eclampsia or HELLP syndrome.',
    'Headache and brisk reflexes are warning features of severe pre-eclampsia.',
    'Blood pressure of 162/108 mmHg is severe-range hypertension in pregnancy.',
    'Proteinuria supports pre-eclampsia as the underlying disorder.',
    'Hemolysis, elevated liver enzymes, and platelets below 100 × 10⁹/L define HELLP syndrome.',
    'Fetal growth restriction and reduced amniotic fluid suggest placental insufficiency from hypertensive disease.',
  ],
  keyFindings: [
    '35 weeks gestation',
    'Severe-range hypertension',
    'Headache',
    'Epigastric pain',
    'Right upper quadrant tenderness',
    'Brisk reflexes',
    'Proteinuria',
    'Hemolysis',
    'Elevated AST and ALT',
    'Platelets 88 × 10⁹/L',
    'Fetal growth restriction',
    'Reduced amniotic fluid',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Severe Pre-eclampsia',
      whyPlausibleEarly:
        'Severe hypertension, headache, edema, hyperreflexia, and proteinuria strongly suggest severe pre-eclampsia.',
      ruledOutByClues: [
        {
          clueOrder: 4,
          evidence:
            'hemolysis, elevated liver enzymes, and platelet count of 88 × 10⁹/L',
          reason:
            'This triad identifies HELLP syndrome rather than uncomplicated severe pre-eclampsia.',
        },
      ],
      finalReasonLessLikely:
        'HELLP syndrome is the more specific diagnosis because the defining laboratory triad is present.',
    },
    {
      diagnosis: 'Acute Fatty Liver of Pregnancy',
      whyPlausibleEarly:
        'Late pregnancy with nausea, vomiting, abdominal pain, and liver dysfunction can mimic HELLP.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: 'severe hypertension with proteinuria',
          reason:
            'This pattern is more characteristic of pre-eclampsia spectrum disease.',
        },
      ],
      finalReasonLessLikely:
        'There is no dominant hypoglycemia, coagulopathy, or liver failure pattern given.',
    },
    {
      diagnosis: 'Thrombotic Thrombocytopenic Purpura',
      whyPlausibleEarly:
        'Hemolysis and thrombocytopenia in pregnancy can suggest thrombotic microangiopathy.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: 'severe hypertension and proteinuria',
          reason:
            'These support hypertensive disease of pregnancy with HELLP syndrome.',
        },
      ],
      finalReasonLessLikely:
        'TTP remains an important mimic, but the obstetric hypertensive pattern favors HELLP.',
    },
    {
      diagnosis: 'Acute Viral Hepatitis',
      whyPlausibleEarly:
        'Nausea, vomiting, malaise, right upper quadrant pain, and elevated transaminases may suggest hepatitis.',
      ruledOutByClues: [
        {
          clueOrder: 4,
          evidence: 'proteinuria, hemolysis, and thrombocytopenia',
          reason:
            'These findings are not explained by isolated viral hepatitis.',
        },
      ],
      finalReasonLessLikely:
        'Viral hepatitis does not explain severe hypertension, proteinuria, and fetal growth restriction.',
    },
    {
      diagnosis: 'Gallstone Disease',
      whyPlausibleEarly:
        'Right upper quadrant pain with nausea and vomiting may suggest biliary disease.',
      ruledOutByClues: [
        {
          clueOrder: 4,
          evidence:
            'hemolysis, elevated liver enzymes, thrombocytopenia, and proteinuria',
          reason:
            'Gallstone disease does not explain the HELLP laboratory triad.',
        },
      ],
      finalReasonLessLikely:
        'The systemic obstetric findings are more specific for HELLP syndrome.',
    },
  ],
  managementPearl:
    'HELLP syndrome is an obstetric emergency. Stabilize the mother, give magnesium sulfate for seizure prophylaxis, control severe hypertension, assess fetal wellbeing, and proceed to delivery once maternal stabilization is achieved.',
  generationQuality: {
    contentTier: 'FLAGSHIP',
    seedVersion,
    humanReviewed: true,
    discriminatorStrength: 'HIGH',
    expectedTeachingPoints: [
      'HELLP syndrome is a severe manifestation of pre-eclampsia',
      'Epigastric or right upper quadrant pain is a warning sign',
      'HELLP means hemolysis, elevated liver enzymes, and low platelets',
      'Fetal growth restriction reflects placental insufficiency',
      'Definitive treatment is delivery after maternal stabilization',
    ],
    competencyDomains: [
      'Obstetrics',
      'Maternal-Fetal Medicine',
      'Emergency Medicine',
      'Clinical Reasoning',
    ],
  },
};

const educationForFrontend = {
  title: displayLabel,
  summary: {
    definition:
      'HELLP syndrome is a severe manifestation of pre-eclampsia characterized by hemolysis, elevated liver enzymes, and low platelet count.',
    highYieldTakeaway:
      'Think HELLP syndrome in a pregnant patient after 20 weeks with severe hypertension, headache, epigastric or right upper quadrant pain, proteinuria, hemolysis, elevated liver enzymes, and thrombocytopenia.',
  },
  recognitionPattern: [
    {
      pattern: 'Severe pre-eclampsia with hepatic symptoms',
      whyItMatters:
        'Epigastric or right upper quadrant pain in hypertensive pregnancy may indicate hepatic involvement and HELLP syndrome.',
      progression:
        'Placental dysfunction -> maternal endothelial injury -> severe hypertension and proteinuria -> hemolysis, liver injury, thrombocytopenia, and fetal growth restriction.',
      discriminator:
        'The HELLP laboratory triad separates HELLP syndrome from uncomplicated severe pre-eclampsia.',
      commonTrap:
        'Do not dismiss epigastric pain in late pregnancy as gastritis or reflux when blood pressure is high.',
    },
    {
      pattern: 'HELLP laboratory triad',
      whyItMatters:
        'Hemolysis, elevated liver enzymes, and low platelets define the diagnosis.',
      discriminator:
        'Platelets below 100 × 10⁹/L with hemolysis and raised transaminases is more specific than hypertension alone.',
      commonTrap:
        'Proteinuria may be present, but the defining clue is the HELLP triad.',
    },
    {
      pattern: 'Placental insufficiency',
      whyItMatters:
        'Fetal growth restriction and reduced amniotic fluid show fetal impact from maternal hypertensive disease.',
      discriminator:
        'Fetal growth restriction supports pre-eclampsia spectrum disease over isolated liver or biliary disease.',
      commonTrap:
        'Do not treat HELLP as only a maternal liver problem; fetal assessment is essential.',
    },
  ],
  keySymptoms: [
    {
      symptom: 'Epigastric pain',
      significance:
        'A warning symptom of hepatic involvement in severe pre-eclampsia and HELLP syndrome.',
    },
    {
      symptom: 'Right upper quadrant pain',
      significance:
        'Reflects liver capsule irritation or hepatic involvement.',
    },
    {
      symptom: 'Headache',
      significance:
        'Suggests severe pre-eclampsia and risk of eclampsia.',
    },
    {
      symptom: 'Nausea and vomiting',
      significance:
        'May accompany hepatic involvement and can mimic gastrointestinal disease.',
    },
    {
      symptom: 'Malaise',
      significance:
        'A nonspecific but common symptom that can precede recognition of HELLP syndrome.',
    },
  ],
  keySigns: [
    {
      finding: 'Severe hypertension',
      significance:
        'Blood pressure ≥160 systolic or ≥110 diastolic indicates severe disease.',
      discriminator:
        'Severe hypertension in late pregnancy shifts abdominal pain toward pre-eclampsia spectrum disease.',
    },
    {
      finding: 'Brisk reflexes',
      significance:
        'Suggests neurological irritability and increased risk of eclampsia.',
    },
    {
      finding: 'Facial edema',
      significance:
        'Supports pre-eclampsia spectrum disease when paired with hypertension and proteinuria.',
    },
    {
      finding: 'Right upper quadrant tenderness',
      significance:
        'Supports hepatic involvement and should prompt liver enzymes and platelet testing.',
    },
  ],
  examPearls: [
    {
      type: 'DISCRIMINATOR',
      title: 'Epigastric pain in hypertensive pregnancy is a danger sign',
      content:
        'Epigastric or right upper quadrant pain after 20 weeks of pregnancy should trigger urgent assessment for severe pre-eclampsia and HELLP syndrome.',
      whyItMatters:
        'This symptom may reflect liver involvement and can precede major maternal complications.',
      discriminator:
        'Simple reflux or biliary pain does not explain severe hypertension, proteinuria, thrombocytopenia, and hemolysis.',
      trapAvoided:
        'Do not reassure a pregnant patient with epigastric pain before checking blood pressure, urine protein, platelets, and liver enzymes.',
    },
    {
      type: 'MNEMONIC',
      title: 'HELLP is the diagnostic anchor',
      content:
        'HELLP means Hemolysis, Elevated Liver enzymes, and Low Platelets.',
      whyItMatters:
        'The mnemonic names the defining laboratory triad.',
      discriminator:
        'Severe pre-eclampsia becomes HELLP syndrome when this triad is present.',
      trapAvoided:
        'Do not place HELLP under scoringSystems; it is a diagnostic mnemonic, not a formal score.',
    },
  ],
  scoringSystems: [],
  investigations: [
    {
      test: 'Urinalysis or urine protein testing',
      interpretation:
        'Proteinuria supports pre-eclampsia spectrum disease.',
      whyItMatters:
        'Helps connect hypertension with pre-eclampsia rather than isolated chronic hypertension.',
    },
    {
      test: 'Full blood count',
      interpretation:
        'Thrombocytopenia, especially platelets below 100 × 10⁹/L, supports HELLP syndrome.',
      whyItMatters:
        'Low platelets indicate severity and influence delivery and anesthesia planning.',
    },
    {
      test: 'Peripheral smear, LDH, bilirubin, or haptoglobin',
      interpretation:
        'Evidence of hemolysis supports the H component of HELLP.',
      whyItMatters:
        'Confirms microangiopathic hemolysis rather than isolated liver disease.',
    },
    {
      test: 'Liver enzymes',
      interpretation:
        'Elevated AST and ALT support hepatic involvement.',
      whyItMatters:
        'Explains epigastric or right upper quadrant pain and helps distinguish HELLP from uncomplicated pre-eclampsia.',
    },
    {
      test: 'Renal function and electrolytes',
      interpretation:
        'May show renal impairment in severe pre-eclampsia.',
      whyItMatters:
        'Guides fluid management, magnesium safety, and escalation decisions.',
    },
    {
      test: 'Coagulation profile',
      interpretation:
        'May show coagulopathy if DIC develops.',
      whyItMatters:
        'Important before delivery or operative intervention.',
    },
    {
      test: 'Obstetric ultrasound and fetal assessment',
      interpretation:
        'May show fetal growth restriction, oligohydramnios, or abnormal fetal wellbeing.',
      whyItMatters:
        'Assesses fetal consequences of placental insufficiency and guides delivery planning.',
    },
  ],
  managementOverview: [
    {
      step: 'Admit and stabilize the mother urgently',
      rationale:
        'HELLP syndrome can rapidly progress to eclampsia, DIC, hepatic complications, renal injury, and fetal compromise.',
    },
    {
      step: 'Give magnesium sulfate',
      rationale:
        'Prevents and treats eclamptic seizures in severe pre-eclampsia spectrum disease.',
    },
    {
      step: 'Control severe hypertension',
      rationale:
        'Reduces the risk of maternal stroke and other hypertensive complications.',
    },
    {
      step: 'Assess maternal severity',
      rationale:
        'Check platelets, liver enzymes, hemolysis markers, renal function, coagulation profile, urine output, and symptoms.',
    },
    {
      step: 'Assess fetal wellbeing',
      rationale:
        'Fetal growth restriction and oligohydramnios suggest placental insufficiency and may influence urgency of delivery.',
    },
    {
      step: 'Plan delivery after maternal stabilization',
      rationale:
        'Delivery is the definitive treatment for HELLP syndrome, especially at 35 weeks gestation.',
    },
    {
      step: 'Prepare for blood products if needed',
      rationale:
        'Severe thrombocytopenia, bleeding, DIC, or operative delivery may require platelet or blood product support.',
    },
  ],
  differentialDistinguishers: [
    {
      diagnosis: 'Severe Pre-eclampsia',
      whyConfused:
        'Both present with severe hypertension, headache, edema, hyperreflexia, and proteinuria.',
      distinguishingPoint:
        'HELLP syndrome has hemolysis, elevated liver enzymes, and low platelets.',
      keySeparator:
        'The HELLP laboratory triad is the defining separator.',
      classicTrap:
        'Calling it severe pre-eclampsia only and missing thrombocytopenia or hemolysis.',
    },
    {
      diagnosis: 'Acute Fatty Liver of Pregnancy',
      whyConfused:
        'Both occur in late pregnancy and can cause nausea, vomiting, abdominal pain, and liver dysfunction.',
      distinguishingPoint:
        'Acute fatty liver more often has hypoglycemia, coagulopathy, encephalopathy, and hepatic failure pattern.',
      keySeparator:
        'Severe hypertension, proteinuria, hemolysis, and thrombocytopenia favor HELLP.',
    },
    {
      diagnosis: 'Thrombotic Thrombocytopenic Purpura',
      whyConfused:
        'TTP can cause hemolysis, thrombocytopenia, neurological symptoms, and pregnancy-associated illness.',
      distinguishingPoint:
        'HELLP is usually linked to hypertension, proteinuria, liver enzyme elevation, and placental insufficiency.',
      keySeparator:
        'The obstetric hypertensive syndrome points toward HELLP.',
    },
    {
      diagnosis: 'Acute Viral Hepatitis',
      whyConfused:
        'Viral hepatitis can cause malaise, nausea, right upper quadrant pain, and elevated transaminases.',
      distinguishingPoint:
        'Viral hepatitis does not explain severe hypertension, proteinuria, thrombocytopenia, and fetal growth restriction.',
      keySeparator:
        'Hypertension plus proteinuria plus low platelets favors HELLP.',
    },
    {
      diagnosis: 'Gallstone Disease',
      whyConfused:
        'Biliary disease can cause right upper quadrant pain, nausea, and vomiting in pregnancy.',
      distinguishingPoint:
        'Gallstone disease does not cause severe hypertension, proteinuria, hemolysis, and thrombocytopenia.',
      keySeparator:
        'HELLP is systemic and obstetric; gallstone disease is localized hepatobiliary disease.',
    },
  ],
  complications: [
    {
      complication: 'Eclampsia',
      whyItMatters:
        'Severe pre-eclampsia spectrum disease can progress to seizures without prophylaxis.',
    },
    {
      complication: 'Disseminated intravascular coagulation',
      whyItMatters:
        'HELLP syndrome can cause severe coagulation disturbance and bleeding risk.',
    },
    {
      complication: 'Placental abruption',
      whyItMatters:
        'Hypertensive disease increases risk of maternal hemorrhage and fetal compromise.',
    },
    {
      complication: 'Hepatic hematoma or rupture',
      whyItMatters:
        'Severe hepatic involvement can become life-threatening.',
    },
    {
      complication: 'Acute kidney injury',
      whyItMatters:
        'Endothelial injury and severe disease can impair renal perfusion and function.',
    },
    {
      complication: 'Maternal or fetal death',
      whyItMatters:
        'Delayed recognition and treatment can be fatal.',
    },
  ],
  pitfalls: [
    {
      pitfall: 'Dismissing epigastric pain as reflux',
      consequence:
        'Delays recognition of hepatic involvement in severe pre-eclampsia or HELLP syndrome.',
    },
    {
      pitfall: 'Stopping at severe pre-eclampsia',
      consequence:
        'Misses HELLP syndrome if hemolysis, liver enzymes, and platelets are not checked.',
    },
    {
      pitfall: 'Waiting for fetal deterioration before delivery planning',
      consequence:
        'Maternal disease can worsen rapidly; delivery planning should begin after stabilization.',
    },
    {
      pitfall: 'Putting HELLP mnemonic under scoringSystems',
      consequence:
        'Pollutes scoringSystems with a mnemonic rather than reserving it for formal validated scores.',
    },
  ],
  recallPrompts: [
    {
      prompt: 'What does HELLP stand for?',
      answer: 'Hemolysis, Elevated Liver enzymes, and Low Platelets.',
    },
    {
      prompt:
        'What symptom in late pregnancy should raise concern for hepatic involvement in pre-eclampsia?',
      answer: 'Epigastric or right upper quadrant pain.',
    },
    {
      prompt:
        'What laboratory pattern distinguishes HELLP from uncomplicated severe pre-eclampsia?',
      answer:
        'Hemolysis, elevated AST/ALT, and thrombocytopenia, especially platelets below 100 × 10⁹/L.',
    },
    {
      prompt: 'What is the definitive treatment for HELLP syndrome?',
      answer: 'Delivery after maternal stabilization.',
    },
    {
      prompt: 'Why does fetal growth restriction occur in HELLP syndrome?',
      answer:
        'Placental insufficiency from hypertensive disease reduces fetal growth and amniotic fluid volume.',
    },
  ],
  references: [
    { citation: 'Williams Obstetrics.' },
    { citation: 'ACOG Practice Bulletin: Gestational Hypertension and Preeclampsia.' },
    { citation: 'RCOG guidance on hypertensive disorders of pregnancy.' },
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
          specialty: 'Obstetrics and Gynaecology',
          subspecialty: 'Maternal-Fetal Medicine',
          category: 'Hypertensive Disorder of Pregnancy',
          bodySystem: 'Reproductive',
          organSystem: 'Placenta',
          difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
          rarityBand: DiagnosisRarityBand.UNCOMMON,
          clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
          ageGroup: DiagnosisAgeGroup.ADULT,
          urgencyLevel: DiagnosisUrgencyLevel.EMERGENT,
          preferredClueTypes: [
            'history',
            'symptom',
            'vital',
            'exam',
            'lab',
            'imaging',
          ],
          notes:
            'Seeded flagship HELLP syndrome case with obstetric emergency teaching metadata.',
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
          specialty: 'Obstetrics and Gynaecology',
          subspecialty: 'Maternal-Fetal Medicine',
          category: 'Hypertensive Disorder of Pregnancy',
          bodySystem: 'Reproductive',
          organSystem: 'Placenta',
          difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
          rarityBand: DiagnosisRarityBand.UNCOMMON,
          clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
          ageGroup: DiagnosisAgeGroup.ADULT,
          urgencyLevel: DiagnosisUrgencyLevel.EMERGENT,
          preferredClueTypes: [
            'history',
            'symptom',
            'vital',
            'exam',
            'lab',
            'imaging',
          ],
          notes:
            'Seeded flagship HELLP syndrome case with obstetric emergency teaching metadata.',
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
    console.log('Skipped existing scheduled HELLP case:', scheduledCase);
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
      'Seeded complete frontend-aligned flagship HELLP syndrome case with education.',
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
        'Created complete HELLP syndrome revision with education-aligned explanation.',
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
      validatorVersion: 'flagship-human-review:hellp-syndrome-v1',
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        note:
          'Complete HELLP syndrome flagship seed with playable clue types and full education payload.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded HELLP Syndrome:', {
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