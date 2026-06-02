import {
  PrismaClient,
  CaseEditorialStatus,
  DiagnosisAliasKind,
  DiagnosisClinicalSetting,
  DiagnosisDifficultyBand,
  DiagnosisEducationSource,
  DiagnosisEducationStatus,
  DiagnosisMappingMethod,
  DiagnosisMappingStatus,
  DiagnosisRegistryStatus,
  DiagnosisRarityBand,
  DiagnosisUrgencyLevel,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run the flagship seed.');
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
const caseDate = new Date(Date.UTC(2026, 5, 1, 12, 0, 0));
const seedVersion = 'flagship-beta-v4';

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      '23-year-old man presents with worsening abdominal pain that began yesterday evening and has caused him to stop eating.',
  },
  {
    order: 1,
    type: 'symptom',
    value:
      'The pain is now more noticeable on the right side of the abdomen and is worse when walking or riding over bumps.',
  },
  {
    order: 2,
    type: 'exam',
    value:
      'Examination demonstrates localized tenderness in the right lower quadrant without generalized peritonism.',
  },
  {
    order: 3,
    type: 'vital',
    value:
      'Temperature is 38.1°C, heart rate is 102/min, blood pressure is 118/72 mmHg, and respiratory rate is 18/min.',
  },
  {
    order: 4,
    type: 'lab',
    value:
      'WBC is 15.6 ×10^9/L with neutrophil predominance of 84%.',
  },
  {
    order: 5,
    type: 'imaging',
    value:
      'CT abdomen demonstrates an 11 mm dilated appendix with periappendiceal fat stranding.',
  },
] as const;

const differentials = [
  'Gastroenteritis',
  'Mesenteric adenitis',
  'Renal colic',
  'Ectopic pregnancy',
];

const explanation = {
  diagnosis: 'Appendicitis',
  summary:
    'Progressive right lower quadrant pain worsened by movement, fever, neutrophilic leukocytosis, and CT evidence of appendiceal inflammation support appendicitis.',
  reasoning: [
    'The illness begins as poorly localized abdominal pain before localizing as inflammation progresses.',
    'Pain aggravated by movement suggests irritation of the parietal peritoneum.',
    'Localized right lower quadrant tenderness narrows the differential toward appendiceal pathology.',
    'Neutrophilic leukocytosis supports acute intra-abdominal inflammation.',
    'CT confirms appendiceal enlargement and surrounding inflammatory change.',
  ],
  keyFindings: [
    'Progressive abdominal pain',
    'Movement-related pain',
    'Localized right lower quadrant tenderness',
    'Low-grade fever',
    'Neutrophilic leukocytosis',
    'Inflamed appendix on CT',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Gastroenteritis',
      whyPlausibleEarly:
        'Early abdominal pain and anorexia may resemble viral gastroenteritis.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: 'localized tenderness in the right lower quadrant',
          reason:
            'Focal tenderness is unusual in uncomplicated gastroenteritis.',
        },
      ],
      finalReasonLessLikely:
        'The progression toward focal right lower quadrant inflammation is inconsistent with typical gastroenteritis.',
    },
    {
      diagnosis: 'Mesenteric adenitis',
      whyPlausibleEarly:
        'Mesenteric adenitis commonly mimics appendicitis in young adults.',
      ruledOutByClues: [
        {
          clueOrder: 5,
          evidence: '11 mm dilated appendix with periappendiceal fat stranding',
          reason: 'Imaging directly demonstrates appendiceal inflammation.',
        },
      ],
      finalReasonLessLikely:
        'The CT findings identify appendicitis rather than isolated mesenteric lymphadenopathy.',
    },
    {
      diagnosis: 'Renal colic',
      whyPlausibleEarly:
        'Right-sided abdominal pain may be mistaken for ureteric stone disease.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'worse when walking or riding over bumps',
          reason:
            'Movement-related peritoneal irritation is more typical of appendicitis.',
        },
      ],
      finalReasonLessLikely:
        'There is no flank-to-groin radiation or urinary symptom complex.',
    },
    {
      diagnosis: 'Ectopic pregnancy',
      whyPlausibleEarly:
        'Lower abdominal pain can represent ectopic pregnancy in reproductive-age patients.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence: '23-year-old man',
          reason: 'Patient demographics exclude ectopic pregnancy.',
        },
      ],
      finalReasonLessLikely:
        'The diagnosis is biologically incompatible with this patient.',
    },
  ],
  generationQuality: {
    contentTier: 'FLAGSHIP',
    seedVersion,
    humanReviewed: true,
  },
};

const educationForFrontend = {
  title: "Appendicitis",

  summary: {
    definition:
      "Acute inflammation of the appendix, usually caused by luminal obstruction leading to bacterial overgrowth and progressive inflammation.",

    highYieldTakeaway:
      "Migratory abdominal pain that localizes to the right lower quadrant and becomes movement-sensitive should strongly raise suspicion for appendicitis.",
  },

  recognitionPattern: [
    {
      pattern: "Migratory abdominal pain",
      whyItMatters:
        "Pain classically begins periumbilically before localizing to the right lower quadrant as inflammation reaches the parietal peritoneum.",
    },
    {
      pattern: "Movement-sensitive pain",
      whyItMatters:
        "Pain worsened by walking, coughing, or bumps suggests peritoneal irritation.",
    },
    {
      pattern: "Anorexia before vomiting",
      whyItMatters:
        "Loss of appetite commonly precedes nausea or vomiting in appendicitis.",
    },
  ],

  keySigns: [
    {
      finding: "McBurney point tenderness",
      significance:
        "Localized tenderness near McBurney point is the classic bedside sign of appendicitis.",
    },
    {
      finding: "Rovsing sign",
      significance:
        "Palpation of the left lower quadrant causing right lower quadrant pain suggests peritoneal irritation.",
    },
    {
      finding: "Psoas sign",
      significance:
        "Pain on hip extension may indicate a retrocecal appendix.",
    },
    {
      finding: "Obturator sign",
      significance:
        "Pain on internal rotation of the flexed hip may indicate a pelvic appendix.",
    },
  ],

  examPearls: [
    {
      type: "exam",
      title: "Guarding or rebound",
      content:
        "Peritoneal signs increase concern for advanced inflammation or perforation.",
    },
    {
      type: "exam",
      title: "Negative positional signs",
      content:
        "Absence of psoas or obturator signs does not exclude appendicitis.",
    },
  ],

  scoringSystems: [
    {
      id: "appendicitis-alvarado-score",
      name: "Alvarado Score",
      use:
        "Clinical score used to estimate probability of acute appendicitis.",
      mnemonic: {
        id: "appendicitis-mantrels",
        name: "MANTRELS",
        useCase: "Mnemonic for the Alvarado Score components.",
        expansion: [
          { letter: "M", meaning: "Migration of pain" },
          { letter: "A", meaning: "Anorexia" },
          { letter: "N", meaning: "Nausea or vomiting" },
          { letter: "T", meaning: "Tenderness in RLQ" },
          { letter: "R", meaning: "Rebound pain" },
          { letter: "E", meaning: "Elevated temperature" },
          { letter: "L", meaning: "Leukocytosis" },
          { letter: "S", meaning: "Shift to the left" },
        ],
      },
      components: [
        "Migration of pain",
        "Anorexia",
        "Nausea or vomiting",
        "Tenderness in RLQ",
        "Rebound pain",
        "Elevated temperature",
        "Leukocytosis",
        "Shift to the left",
      ],
      caution:
        "Use as a decision aid, not a replacement for clinical judgment.",
    },
  ],

  investigations: [
    {
      test: "CBC",
      interpretation:
        "Neutrophilic leukocytosis supports acute inflammation.",
      commonTrap:
        "Normal early WBC does not exclude appendicitis.",
    },
    {
      test: "CRP",
      interpretation:
        "Supports inflammatory burden and symptom duration.",
    },
    {
      test: "Ultrasound",
      interpretation:
        "Useful first-line imaging in children and pregnancy.",
    },
    {
      test: "CT abdomen",
      interpretation:
        "Most accurate imaging modality in adults.",
    },
  ],

  pitfalls: [
    {
      pitfall: "Normal early inflammatory markers",
      consequence:
        "Early appendicitis may have normal laboratory results.",
    },
    {
      pitfall: "Retrocecal appendix",
      consequence:
        "May present with flank or back pain rather than classic RLQ pain.",
    },
    {
      pitfall: "Transient improvement after perforation",
      consequence:
        "Pain may briefly improve before generalized peritonitis develops.",
    },
  ],

  managementOverview: [
    {
      step: "NPO",
      rationale:
        "Keep nil by mouth while diagnosis and operative planning proceed.",
    },
    {
      step: "IV fluids",
      rationale:
        "Correct dehydration and support circulation.",
    },
    {
      step: "Analgesia",
      rationale:
        "Adequate pain control should not be withheld.",
    },
    {
      step: "Surgical review",
      rationale:
        "Urgent assessment is required when appendicitis is suspected.",
    },
  ],

  differentialDistinguishers: [
    {
      diagnosis: "Gastroenteritis",
      keySeparator:
        "Diffuse diarrheal illness rather than progressive focal RLQ pain.",
    },
    {
      diagnosis: "Mesenteric adenitis",
      keySeparator:
        "Often follows viral illness and lacks progressive focal peritonism.",
    },
    {
      diagnosis: "Renal colic",
      keySeparator:
        "Colicky flank-to-groin pain with urinary features or hematuria.",
    },
    {
      diagnosis: "Ectopic pregnancy",
      keySeparator:
        "Positive pregnancy test or vaginal bleeding changes management immediately.",
    },
  ],

  references: [
    "Oxford Handbook of Clinical Surgery",
    "WSES Jerusalem Guidelines",
    "BMJ Best Practice: Acute Appendicitis",
  ],
};

async function main() {
  const canonicalName = 'appendicitis';
  const displayLabel = 'Appendicitis';
  const canonicalNormalized = normalizeClinicalText(canonicalName);

  const registry = await prisma.diagnosisRegistry.upsert({
    where: { canonicalNormalized },
    update: {
      canonicalName,
      displayLabel,
      status: DiagnosisRegistryStatus.ACTIVE,
      active: true,
      isPlayable: true,
      isGeneratable: true,
      specialty: 'General Surgery',
      bodySystem: 'Gastrointestinal',
      category: 'Inflammatory',
      difficultyBand: DiagnosisDifficultyBand.BASIC,
      clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
      rarityBand: DiagnosisRarityBand.COMMON,
      urgencyLevel: DiagnosisUrgencyLevel.URGENT,
    },
    create: {
      canonicalName,
      canonicalNormalized,
      displayLabel,
      status: DiagnosisRegistryStatus.ACTIVE,
      active: true,
      isPlayable: true,
      isGeneratable: true,
      specialty: 'General Surgery',
      bodySystem: 'Gastrointestinal',
      category: 'Inflammatory',
      difficultyBand: DiagnosisDifficultyBand.BASIC,
      clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
      rarityBand: DiagnosisRarityBand.COMMON,
      urgencyLevel: DiagnosisUrgencyLevel.URGENT,
    },
  });

  for (const [rank, term] of [displayLabel, canonicalName, 'acute appendicitis'].entries()) {
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
        kind: rank === 0 ? DiagnosisAliasKind.CANONICAL : DiagnosisAliasKind.ACCEPTED,
      },
      create: {
        diagnosisRegistryId: registry.id,
        term,
        normalizedTerm: normalizeClinicalText(term),
        active: true,
        acceptedForMatch: true,
        rank,
        kind: rank === 0 ? DiagnosisAliasKind.CANONICAL : DiagnosisAliasKind.ACCEPTED,
        source: seedVersion,
      },
    });
  }

  const education = await prisma.diagnosisEducation.upsert({
    where: { diagnosisRegistryId: registry.id },
    update: {
      title: educationForFrontend.title,
      summary: educationForFrontend.summary,
      clinicalPattern: educationForFrontend.recognitionPattern,
      keySigns: educationForFrontend.keySigns,
      examPearls: educationForFrontend.examPearls,
      scoringSystems: educationForFrontend.scoringSystems,
      investigations: educationForFrontend.investigations,
      differentials: educationForFrontend.differentialDistinguishers,
      management: educationForFrontend.managementOverview,
      pitfalls: educationForFrontend.pitfalls,
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
      keySigns: educationForFrontend.keySigns,
      examPearls: educationForFrontend.examPearls,
      scoringSystems: educationForFrontend.scoringSystems,
      investigations: educationForFrontend.investigations,
      differentials: educationForFrontend.differentialDistinguishers,
      management: educationForFrontend.managementOverview,
      pitfalls: educationForFrontend.pitfalls,
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

  const history = clues.find((clue) => clue.type === 'history')?.value ?? displayLabel;
  const symptoms = clues.filter((clue) => clue.type === 'symptom').map((clue) => clue.value);

  const existingCase = await prisma.case.findFirst({
    where: {
      diagnosisRegistryId: registry.id,
      explanation: {
        path: ['generationQuality', 'seedVersion'],
        equals: seedVersion,
      },
    },
    select: { id: true },
  });

  const caseData = {
    title: displayLabel,
    date: caseDate,
    difficulty: 'easy',
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
      'Seeded frontend-aligned flagship appendicitis case. Scheduler should publish/schedule naturally.',
  };

  const seededCase = existingCase
    ? await prisma.case.update({ where: { id: existingCase.id }, data: caseData, select: { id: true } })
    : await prisma.case.create({ data: caseData, select: { id: true } });

  const latestRevision = await prisma.caseRevision.findFirst({
    where: { caseId: seededCase.id },
    orderBy: { revisionNumber: 'desc' },
    select: { revisionNumber: true },
  });

  const revision = await prisma.caseRevision.create({
    data: {
      caseId: seededCase.id,
      revisionNumber: (latestRevision?.revisionNumber ?? 0) + 1,
      source: 'MANUAL',
      publishTrack: 'DAILY',
      title: displayLabel,
      date: caseDate,
      difficulty: 'easy',
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
      diagnosisEditorialNote: 'Frontend-aligned flagship appendicitis revision.',
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
      source: 'MANUAL',
      publishTrack: 'DAILY',
      outcome: 'PASSED',
      validatorVersion: 'flagship-human-review:v4',
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        note: 'Manual frontend-aligned appendicitis case seeded for beta inventory.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded frontend-aligned Appendicitis:', {
    registryId: registry.id,
    caseId: seededCase.id,
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
