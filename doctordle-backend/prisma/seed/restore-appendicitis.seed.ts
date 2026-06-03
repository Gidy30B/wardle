import {
  PrismaClient,
  CaseEditorialStatus,
  CaseSource,
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
  PublishTrack,
  ValidationOutcome,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run the appendicitis restore.');
}

const corruptedCaseId =
  process.env.RESTORE_APPENDICITIS_CASE_ID ??
  '48135faf-6508-42ac-a261-6a57cb580b31';

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
    value: 'WBC is 15.6 x10^9/L with neutrophil predominance of 84%.',
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
          reason: 'Focal tenderness is unusual in uncomplicated gastroenteritis.',
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
  title: 'Appendicitis',
  summary: {
    definition:
      'Acute inflammation of the appendix, usually from luminal obstruction with bacterial overgrowth.',
    highYieldTakeaway:
      'Think appendicitis when abdominal pain progressively localizes to the right lower quadrant and becomes movement-sensitive.',
  },
  recognitionPattern: [
    {
      pattern: 'Progressive localization',
      whyItMatters:
        'Pain often begins vaguely or periumbilically, then localizes when parietal peritoneum becomes irritated.',
      progression:
        'Vague abdominal pain -> movement pain -> focal RLQ tenderness -> inflammatory labs -> inflamed appendix.',
      discriminator:
        'Progressive focal pain separates appendicitis from diffuse gastroenteritis.',
      commonTrap:
        'Early appendicitis can look nonspecific before focal tenderness appears.',
    },
    {
      pattern: 'Movement-related pain',
      whyItMatters:
        'Pain worsened by walking, coughing, or bumps is a bedside clue to peritoneal irritation.',
      discriminator:
        'Movement-sensitive focal pain is more surgical than simple viral gastroenteritis.',
      commonTrap: 'Do not wait for generalized peritonitis before escalating.',
    },
  ],
  examPearls: [
    {
      type: 'exam',
      title: 'Focal right lower quadrant tenderness',
      content:
        'Localized RLQ tenderness is the key exam anchor in suspected appendicitis.',
      whyItMatters:
        'It shows the inflammatory process has localized to the right lower quadrant.',
      discriminator: 'More concerning than diffuse tenderness in gastroenteritis.',
      managementImplication:
        'Supports surgical review when paired with compatible symptoms.',
    },
    {
      type: 'exam',
      title: 'Guarding or rebound',
      content:
        'Guarding or rebound suggests irritation of the parietal peritoneum.',
      whyItMatters:
        'Peritoneal signs increase concern for advanced inflammation or perforation.',
      escalationImplication:
        'Should accelerate imaging, antibiotics, and surgical assessment.',
    },
    {
      type: 'exam',
      title: 'Psoas and obturator signs',
      content:
        'Psoas may suggest a retrocecal appendix; obturator may suggest a pelvic appendix.',
      whyItMatters: 'Appendix position changes the symptom pattern.',
      trapAvoided: 'Absence of these signs does not exclude appendicitis.',
    },
  ],
  keySigns: [
    {
      finding: 'Focal RLQ tenderness',
      significance: 'Suggests localized peritoneal irritation near the appendix.',
      discriminator: 'More focal than gastroenteritis or early mesenteric adenitis.',
    },
    {
      finding: 'Movement-related pain',
      significance:
        'Suggests peritoneal irritation before generalized peritonism develops.',
      urgency: 'Should increase concern for a surgical abdomen.',
    },
  ],
  investigations: [
    {
      test: 'CBC',
      interpretation: 'Neutrophilic leukocytosis supports acute inflammation.',
      diagnosticImpact:
        'Helpful when history and exam already point toward appendicitis.',
      commonTrap: 'Normal early WBC does not exclude appendicitis.',
    },
    {
      test: 'CRP',
      interpretation:
        'CRP rises with inflammatory burden and symptom duration.',
      diagnosticImpact:
        'Supports the inflammatory picture but is not diagnostic alone.',
    },
    {
      test: 'CT abdomen',
      interpretation:
        'Appendix diameter >6 mm, wall thickening, appendicolith, fat stranding, abscess, or perforation supports appendicitis.',
      diagnosticImpact:
        'Confirms the diagnosis and identifies complicated disease.',
    },
    {
      test: 'Ultrasound',
      interpretation:
        'May show a non-compressible enlarged appendix, especially useful in children or pregnancy.',
      diagnosticImpact:
        'Useful when radiation avoidance is important, but operator-dependent.',
    },
  ],
  pitfalls: [
    {
      pitfall: 'Atypical appendix position',
      consequence:
        'Retrocecal or pelvic appendicitis may cause flank, back, urinary, suprapubic, or diarrheal symptoms.',
      saferHeuristic:
        'Keep appendicitis on the list when symptoms evolve and localize, even if the location is atypical.',
    },
    {
      pitfall: 'False reassurance from mild early findings',
      consequence:
        'Early appendicitis may have modest fever, mild tenderness, or normal labs.',
      saferHeuristic: 'Use serial examination when symptoms are evolving.',
    },
    {
      pitfall: 'Transient improvement after perforation',
      consequence:
        'Pain may briefly improve after perforation before generalized peritonitis develops.',
      saferHeuristic:
        'Do not equate temporary pain improvement with disease resolution.',
    },
  ],
  managementOverview: [
    {
      step: 'Initial care',
      rationale:
        'Keep nil by mouth, establish IV access, give fluids if dehydrated, provide analgesia and antiemetics, and monitor vital signs.',
    },
    {
      step: 'Antibiotics',
      rationale:
        'Use local protocols to cover enteric Gram-negative and anaerobic organisms, especially if perforation is possible.',
    },
    {
      step: 'Surgical review',
      rationale:
        'Urgent surgical assessment is needed when focal signs, peritonism, or supportive imaging are present.',
    },
    {
      step: 'Selected non-operative care',
      rationale:
        'Some uncomplicated cases may be treated with antibiotics, but only with careful selection, imaging certainty, follow-up, and safety-netting.',
    },
  ],
  differentialDistinguishers: [
    {
      diagnosis: 'Gastroenteritis',
      whyConfused:
        'Abdominal pain, nausea, anorexia, and mild fever can overlap early.',
      distinguishingPoint:
        'Gastroenteritis usually causes diffuse cramps, vomiting, or diarrhea rather than progressive focal RLQ tenderness.',
      keySeparator:
        'Progressive focal tenderness and movement pain favor appendicitis.',
      classicTrap:
        'Do not dismiss focal peritoneal signs as viral gastroenteritis.',
    },
    {
      diagnosis: 'Mesenteric adenitis',
      whyConfused:
        'Young patients can present with RLQ pain that mimics appendicitis.',
      distinguishingPoint:
        'Often follows viral illness and imaging shows lymphadenopathy without an inflamed appendix.',
      keySeparator: 'CT evidence of an inflamed appendix favors appendicitis.',
    },
    {
      diagnosis: 'Renal colic',
      whyConfused: 'Can cause acute unilateral abdominal pain.',
      distinguishingPoint:
        'Colicky flank-to-groin pain, urinary symptoms, or hematuria favor renal colic.',
      keySeparator: 'Movement-related peritoneal pain favors appendicitis.',
    },
    {
      diagnosis: 'Ectopic pregnancy',
      whyConfused:
        'Lower abdominal pain in reproductive-age female patients can represent ectopic pregnancy.',
      distinguishingPoint:
        'Positive pregnancy test, amenorrhea, vaginal bleeding, and adnexal findings shift toward ectopic pregnancy.',
      keySeparator:
        'Pregnancy testing is mandatory in reproductive-age females with lower abdominal pain.',
      classicTrap:
        'Do not anchor on appendicitis before excluding pregnancy-related emergencies in relevant patients.',
    },
  ],
};

async function main() {
  const canonicalName = 'appendicitis';
  const displayLabel = 'Appendicitis';
  const canonicalNormalized = normalizeClinicalText(canonicalName);

  const targetCase = await prisma.case.findUnique({
    where: { id: corruptedCaseId },
    select: { id: true },
  });

  if (!targetCase) {
    throw new Error(`Cannot restore appendicitis: case ${corruptedCaseId} was not found.`);
  }

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
      investigations: educationForFrontend.investigations,
      differentials: educationForFrontend.differentialDistinguishers,
      management: educationForFrontend.managementOverview,
      pitfalls: educationForFrontend.pitfalls,
      references: [],
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
      investigations: educationForFrontend.investigations,
      differentials: educationForFrontend.differentialDistinguishers,
      management: educationForFrontend.managementOverview,
      pitfalls: educationForFrontend.pitfalls,
      references: [],
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

  const caseData = {
    title: displayLabel,
    date: caseDate,
    difficulty: 'easy',
    history,
    symptoms,
    clues: clues as unknown as object,
    explanation: explanation as object,
    differentials,
    editorialStatus: CaseEditorialStatus.PUBLISHED,
    approvedAt: now,
    publishedAt: now,
    diagnosisRegistryId: registry.id,
    proposedDiagnosisText: displayLabel,
    diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
    diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
    diagnosisMappingConfidence: 1,
    diagnosisEditorialNote:
      'Restored frontend-aligned flagship appendicitis case after DKA seed date collision.',
  };

  await prisma.case.update({
    where: { id: corruptedCaseId },
    data: caseData,
    select: { id: true },
  });

  const latestRevision = await prisma.caseRevision.findFirst({
    where: { caseId: corruptedCaseId },
    orderBy: { revisionNumber: 'desc' },
    select: { revisionNumber: true },
  });

  const revision = await prisma.caseRevision.create({
    data: {
      caseId: corruptedCaseId,
      revisionNumber: (latestRevision?.revisionNumber ?? 0) + 1,
      source: CaseSource.MANUAL,
      publishTrack: PublishTrack.DAILY,
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
      diagnosisEditorialNote:
        'Restored frontend-aligned flagship appendicitis revision after DKA seed date collision.',
    },
    select: { id: true },
  });

  await prisma.case.update({
    where: { id: corruptedCaseId },
    data: { currentRevisionId: revision.id },
  });

  await prisma.caseValidationRun.create({
    data: {
      caseId: corruptedCaseId,
      revisionId: revision.id,
      source: CaseSource.MANUAL,
      publishTrack: PublishTrack.DAILY,
      outcome: ValidationOutcome.PASSED,
      validatorVersion: 'flagship-human-review:v4',
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        note: 'Restored published appendicitis case after DKA seed date collision.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Restored published Appendicitis:', {
    registryId: registry.id,
    caseId: corruptedCaseId,
    revisionId: revision.id,
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
