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
import { assertAliasValidWithClient } from '../../src/modules/diagnosis-registry/alias-validation.service';

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
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 0, 4, 12, 0, 0));
const seedVersion = 'flagship-peptic-ulcer-disease-v1';

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 38-year-old man presents with recurrent upper abdominal discomfort that has been worsening over several months.',
  },
  {
    order: 1,
    type: 'symptom',
    value:
      'The pain is localized to the epigastrium and is described as a burning sensation.',
  },
  {
    order: 2,
    type: 'history',
    value:
      'He notices that the pain often improves temporarily after eating but returns a few hours later, frequently waking him at night.',
  },
  {
    order: 3,
    type: 'history',
    value:
      'He has been taking over-the-counter pain medications regularly for chronic knee pain.',
  },
  {
    order: 4,
    type: 'exam',
    value:
      'Physical examination reveals mild epigastric tenderness without guarding, rebound tenderness, or abdominal distension.',
  },
  {
    order: 5,
    type: 'imaging',
    value:
      'Upper gastrointestinal endoscopy demonstrates a well-defined ulcer in the first part of the duodenum. Testing is positive for Helicobacter pylori.',
  },
] as const;

const differentials = [
  'Gastroesophageal Reflux Disease',
  'Gastritis',
  'Chronic Pancreatitis',
  'Functional Dyspepsia',
];

const explanation = {
  diagnosis: 'Peptic Ulcer Disease',
  summary:
    'Chronic burning epigastric pain, nocturnal recurrence, temporary relief with food, regular NSAID exposure, mild epigastric tenderness, endoscopic duodenal ulceration, and positive Helicobacter pylori testing support peptic ulcer disease.',
  reasoning: [
    'Recurrent upper abdominal discomfort over months suggests a chronic dyspeptic or ulcer-related process.',
    'Burning epigastric pain is a classic symptom pattern for acid-mediated ulcer disease.',
    'Temporary relief after meals with recurrence several hours later and nocturnal awakening is characteristic of duodenal ulcer pain.',
    'Regular over-the-counter pain medication use raises concern for NSAID-associated mucosal injury.',
    'Mild epigastric tenderness without peritonism supports uncomplicated disease rather than perforation or acute surgical abdomen.',
    'Endoscopic visualization of a duodenal ulcer with positive Helicobacter pylori testing confirms the diagnosis.',
  ],
  keyFindings: [
    'Recurrent upper abdominal discomfort',
    'Burning epigastric pain',
    'Pain improves after eating',
    'Pain returns several hours after meals',
    'Nocturnal pain',
    'Regular NSAID use',
    'Mild epigastric tenderness',
    'Duodenal ulcer on endoscopy',
    'Positive Helicobacter pylori testing',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Gastroesophageal Reflux Disease',
      whyPlausibleEarly:
        'GERD can cause upper abdominal or retrosternal burning discomfort.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: 'pain improves after eating and returns hours later',
          reason:
            'This timing is more typical of duodenal ulcer disease than reflux, which often worsens when lying down or after trigger meals.',
        },
      ],
      finalReasonLessLikely:
        'GERD does not explain a discrete duodenal ulcer on endoscopy with positive Helicobacter pylori testing.',
    },
    {
      diagnosis: 'Gastritis',
      whyPlausibleEarly:
        'Gastritis can produce epigastric burning, dyspepsia, and NSAID-associated symptoms.',
      ruledOutByClues: [
        {
          clueOrder: 5,
          evidence: 'well-defined ulcer in the first part of the duodenum',
          reason:
            'A discrete ulcer crater establishes peptic ulcer disease rather than diffuse mucosal inflammation alone.',
        },
      ],
      finalReasonLessLikely:
        'Gastritis does not account for the confirmed duodenal ulcer seen on endoscopy.',
    },
    {
      diagnosis: 'Chronic Pancreatitis',
      whyPlausibleEarly:
        'Chronic pancreatitis can cause chronic epigastric pain and dyspeptic symptoms.',
      ruledOutByClues: [
        {
          clueOrder: 5,
          evidence: 'duodenal ulcer and positive Helicobacter pylori testing',
          reason:
            'Endoscopic ulceration and H. pylori positivity directly identify ulcer disease rather than pancreatic pathology.',
        },
      ],
      finalReasonLessLikely:
        'Chronic pancreatitis more often radiates to the back and may include malabsorption or pancreatic insufficiency.',
    },
    {
      diagnosis: 'Functional Dyspepsia',
      whyPlausibleEarly:
        'Functional dyspepsia can mimic uncomplicated ulcer disease with chronic epigastric discomfort.',
      ruledOutByClues: [
        {
          clueOrder: 5,
          evidence: 'well-defined duodenal ulcer on endoscopy',
          reason:
            'Functional dyspepsia is diagnosed when no structural lesion explains the symptoms.',
        },
      ],
      finalReasonLessLikely:
        'A structural ulcer lesion excludes functional dyspepsia as the primary diagnosis.',
    },
  ],
  generationQuality: {
    contentTier: 'FLAGSHIP',
    humanReviewed: true,
    seedVersion,
  },
};

const educationForFrontend = {
  title: 'Peptic Ulcer Disease',

  summary: {
    definition:
      'Peptic ulcer disease is a mucosal defect extending through the muscularis mucosa of the stomach or proximal duodenum, most commonly caused by Helicobacter pylori infection or nonsteroidal anti-inflammatory drug use.',
    highYieldTakeaway:
      'Think peptic ulcer disease when burning epigastric pain follows a meal-related pattern, especially with H. pylori risk or NSAID exposure.',
  },

  recognitionPattern: [
    {
      pattern: 'Meal-related burning epigastric pain',
      whyItMatters:
        'Duodenal ulcer pain often improves with eating and returns several hours later, whereas gastric ulcer pain may worsen after meals.',
    },
    {
      pattern: 'Associated dyspeptic symptoms',
      whyItMatters:
        'Bloating, early satiety, nausea, dyspepsia, nocturnal pain, and occasional vomiting can accompany ulcer disease.',
    },
    {
      pattern: 'Complicated disease',
      whyItMatters:
        'Upper gastrointestinal bleeding, perforation, gastric outlet obstruction, or iron deficiency anemia may be the presenting clue.',
    },
  ],

  keySigns: [
    {
      finding: 'Mild epigastric tenderness',
      significance:
        'Many uncomplicated ulcers have only subtle localized tenderness or a normal examination.',
    },
    {
      finding: 'Peritonism',
      significance:
        'Guarding, rebound tenderness, or rigid abdomen suggests perforation and requires urgent assessment.',
    },
    {
      finding: 'Melena or hematemesis',
      significance:
        'Gastrointestinal bleeding is the most common serious complication of peptic ulcer disease.',
    },
  ],

  examPearls: [
    {
      type: 'exam',
      title: 'Pain timing matters',
      content:
        'Relief of epigastric pain after meals followed by recurrence several hours later strongly suggests a duodenal ulcer.',
    },
    {
      type: 'exam',
      title: 'Normal examination does not exclude disease',
      content:
        'Many patients have only mild epigastric tenderness or an entirely normal abdominal examination.',
    },
    {
      type: 'exam',
      title: 'Look for alarm features',
      content:
        'Weight loss, anemia, persistent vomiting, dysphagia, or gastrointestinal bleeding require prompt investigation.',
    },
  ],

  scoringSystems: [],

  investigations: [
    {
      test: 'Upper gastrointestinal endoscopy',
      interpretation:
        'Confirms the presence, location, and complications of an ulcer, and allows biopsy when indicated.',
    },
    {
      test: 'Helicobacter pylori testing',
      interpretation:
        'Urea breath test, stool antigen testing, rapid urease testing, or biopsy-based methods identify treatable infection.',
    },
    {
      test: 'Complete blood count',
      interpretation:
        'May show iron deficiency anemia or acute blood loss in bleeding ulcers.',
    },
    {
      test: 'Medication review',
      interpretation:
        'NSAID, aspirin, anticoagulant, and steroid exposure can increase ulcer risk or complication risk.',
    },
  ],

  pitfalls: [
    {
      pitfall: 'Assuming dyspepsia is benign',
      consequence:
        'Alarm symptoms such as weight loss, anemia, persistent vomiting, dysphagia, or gastrointestinal bleeding require prompt investigation.',
    },
    {
      pitfall: 'Treating without H. pylori testing',
      consequence:
        'Failure to identify and eradicate H. pylori increases recurrence risk.',
    },
    {
      pitfall: 'Missing perforation',
      consequence:
        'Sudden severe abdominal pain with peritonism should trigger urgent surgical evaluation.',
    },
  ],

  managementOverview: [
    {
      step: 'Proton pump inhibitor therapy',
      rationale:
        'Acid suppression promotes ulcer healing and symptom control.',
    },
    {
      step: 'Eradicate H. pylori',
      rationale:
        'Guideline-recommended eradication regimens reduce recurrence when infection is confirmed.',
    },
    {
      step: 'Stop NSAIDs',
      rationale:
        'Removing the mucosal injury driver reduces ongoing ulcer risk whenever possible.',
    },
    {
      step: 'Manage complications',
      rationale:
        'Bleeding, perforation, or obstruction may require urgent endoscopic, radiologic, or surgical intervention.',
    },
  ],

  differentialDistinguishers: [
    {
      diagnosis: 'Gastroesophageal Reflux Disease',
      keySeparator:
        'Heartburn and acid regurgitation predominate, often worsening when lying down.',
    },
    {
      diagnosis: 'Gastritis',
      keySeparator:
        'Diffuse mucosal inflammation occurs without a discrete ulcer crater.',
    },
    {
      diagnosis: 'Chronic Pancreatitis',
      keySeparator:
        'Pain often radiates to the back and may be associated with pancreatic insufficiency.',
    },
    {
      diagnosis: 'Functional Dyspepsia',
      keySeparator:
        'No structural lesion is identified on endoscopy.',
    },
  ],

  references: [
    'Oxford Handbook of Clinical Medicine',
    'BMJ Best Practice: Peptic ulcer disease',
    'NICE Clinical Knowledge Summary: Dyspepsia',
  ],
};

async function main() {
  const canonicalName = 'peptic ulcer disease';
  const displayLabel = 'Peptic Ulcer Disease';
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
      specialty: 'Gastroenterology',
      bodySystem: 'Gastrointestinal',
      category: 'Upper GI Disorders',
      difficultyBand: DiagnosisDifficultyBand.BASIC,
      clinicalSetting: DiagnosisClinicalSetting.OUTPATIENT,
      rarityBand: DiagnosisRarityBand.COMMON,
      urgencyLevel: DiagnosisUrgencyLevel.ROUTINE,
    },
    create: {
      canonicalName,
      canonicalNormalized,
      displayLabel,
      status: DiagnosisRegistryStatus.ACTIVE,
      active: true,
      isPlayable: true,
      isGeneratable: true,
      specialty: 'Gastroenterology',
      bodySystem: 'Gastrointestinal',
      category: 'Upper GI Disorders',
      difficultyBand: DiagnosisDifficultyBand.BASIC,
      clinicalSetting: DiagnosisClinicalSetting.OUTPATIENT,
      rarityBand: DiagnosisRarityBand.COMMON,
      urgencyLevel: DiagnosisUrgencyLevel.ROUTINE,
    },
  });

  const aliasTerms = [
    canonicalName,
    displayLabel,
    'PUD',
    'gastric ulcer',
    'duodenal ulcer',
  ];
  const seenAliasNormalizations = new Set<string>();
  let aliasRank = 0;

  for (const term of aliasTerms) {
    const normalizedTerm = normalizeClinicalText(term);
    if (seenAliasNormalizations.has(normalizedTerm)) {
      continue;
    }
    seenAliasNormalizations.add(normalizedTerm);

    const existingAlias = await prisma.diagnosisAlias.findUnique({
      where: {
        diagnosisRegistryId_normalizedTerm: {
          diagnosisRegistryId: registry.id,
          normalizedTerm,
        },
      },
      select: { id: true },
    });
    await assertAliasValidWithClient(prisma, {
      aliasText: term,
      targetDiagnosisRegistryId: registry.id,
      acceptedForMatch: true,
      ignoreAliasId: existingAlias?.id,
      allowTargetCanonicalAlias: normalizedTerm === canonicalNormalized,
    });
    await prisma.diagnosisAlias.upsert({
      where: {
        diagnosisRegistryId_normalizedTerm: {
          diagnosisRegistryId: registry.id,
          normalizedTerm,
        },
      },
      update: {
        term,
        active: true,
        acceptedForMatch: true,
        rank: aliasRank,
        kind:
          aliasRank === 0
            ? DiagnosisAliasKind.CANONICAL
            : DiagnosisAliasKind.ACCEPTED,
      },
      create: {
        diagnosisRegistryId: registry.id,
        term,
        normalizedTerm,
        active: true,
        acceptedForMatch: true,
        rank: aliasRank,
        kind:
          aliasRank === 0
            ? DiagnosisAliasKind.CANONICAL
            : DiagnosisAliasKind.ACCEPTED,
        source: seedVersion,
      },
    });
    aliasRank += 1;
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

  const history =
    clues.find((clue) => clue.type === 'history')?.value ?? displayLabel;
  const symptoms = clues
    .filter((clue) => clue.type === 'symptom')
    .map((clue) => clue.value);

  const caseData = {
    title: displayLabel,
    date: inventoryPlaceholderDate,
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
      'Seeded frontend-aligned flagship peptic ulcer disease inventory case. DailyCase scheduler should assign the actual daily slot.',
  };

  const existingSeedCase = await prisma.case.findFirst({
    where: {
      diagnosisRegistryId: registry.id,
      proposedDiagnosisText: displayLabel,
    },
    orderBy: [{ approvedAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      currentRevisionId: true,
      dailyCases: { select: { id: true }, take: 1 },
    },
  });

  const placeholderDateOwner = await prisma.case.findUnique({
    where: { date: inventoryPlaceholderDate },
    select: {
      id: true,
      title: true,
      diagnosisRegistryId: true,
      currentRevisionId: true,
      dailyCases: { select: { id: true }, take: 1 },
    },
  });

  if (
    placeholderDateOwner &&
    placeholderDateOwner.diagnosisRegistryId !== registry.id
  ) {
    throw new Error(
      `Cannot seed ${displayLabel}: inventory placeholder date ${inventoryPlaceholderDate.toISOString()} is already used by "${placeholderDateOwner.title}" (${placeholderDateOwner.id}).`,
    );
  }

  const reusableCase = placeholderDateOwner ?? existingSeedCase;

  if (reusableCase?.dailyCases.length) {
    throw new Error(
      `Cannot seed ${displayLabel}: existing case ${reusableCase.id} is already assigned to a DailyCase. Restore or manage it through the scheduler instead.`,
    );
  }

  const seededCase = reusableCase
    ? await prisma.case.update({
        where: { id: reusableCase.id },
        data: caseData,
        select: { id: true },
      })
    : await prisma.case.create({ data: caseData, select: { id: true } });

  const revisionData = {
    source: 'MANUAL' as const,
    publishTrack: 'DAILY' as const,
    title: displayLabel,
    date: inventoryPlaceholderDate,
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
      'Frontend-aligned flagship peptic ulcer disease inventory revision for DailyCase scheduler assignment.',
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
      validatorVersion: 'flagship-human-review:peptic-ulcer-disease-v1',
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        note: 'Manual frontend-aligned peptic ulcer disease inventory case seeded for DailyCase scheduler assignment.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded frontend-aligned Peptic Ulcer Disease:', {
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
