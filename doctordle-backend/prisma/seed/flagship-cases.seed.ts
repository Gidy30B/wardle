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
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 0, 1, 12, 0, 0));
const seedVersion = 'flagship-beta-v4';

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      '21-year-old woman presents with worsening fatigue, nausea, and repeated vomiting that began yesterday evening.',
  },
  {
    order: 1,
    type: 'symptom',
    value:
      'She reports diffuse abdominal pain and has been unable to tolerate oral intake throughout the day.',
  },
  {
    order: 2,
    type: 'exam',
    value:
      'Examination reveals dry mucous membranes and marked dehydration without focal abdominal tenderness.',
  },
  {
    order: 3,
    type: 'vital',
    value:
      'Heart rate is 124/min, blood pressure is 94/58 mmHg, respiratory rate is 30/min, and temperature is 37.4°C.',
  },
  {
    order: 4,
    type: 'lab',
    value:
      'Capillary blood glucose is 29 mmol/L and serum ketones are markedly elevated.',
  },
  {
    order: 5,
    type: 'lab',
    value:
      'Venous blood gas demonstrates pH 7.12, bicarbonate 8 mmol/L, and a raised anion gap metabolic acidosis.',
  },
] as const;

const differentials = [
  'Hyperosmolar Hyperglycaemic State',
  'Acute Gastroenteritis',
  'Acute Pancreatitis',
  'Sepsis',
];

const explanation = {
  diagnosis: 'Diabetic Ketoacidosis',
  summary:
    'Recurrent vomiting, abdominal pain, marked dehydration, tachypnoea, hyperglycaemia, ketonaemia, and high-anion-gap metabolic acidosis support diabetic ketoacidosis.',
  reasoning: [
    'Vomiting and abdominal pain are common manifestations of ketosis and metabolic acidosis, and can initially mimic gastrointestinal disease.',
    'Marked dehydration with hypotension and tachycardia indicates substantial intravascular volume depletion.',
    'Tachypnoea is consistent with respiratory compensation for metabolic acidosis.',
    'Marked hyperglycaemia together with elevated ketones establishes uncontrolled insulin deficiency.',
    'Low pH and low bicarbonate confirm high-anion-gap metabolic acidosis consistent with diabetic ketoacidosis.',
  ],
  keyFindings: [
    'Vomiting',
    'Abdominal pain',
    'Severe dehydration',
    'Tachycardia',
    'Hypotension',
    'Tachypnoea',
    'Hyperglycaemia',
    'Ketonaemia',
    'High-anion-gap metabolic acidosis',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Hyperosmolar Hyperglycaemic State',
      whyPlausibleEarly:
        'Profound dehydration and hyperglycaemia may initially resemble HHS.',
      ruledOutByClues: [
        {
          clueOrder: 4,
          evidence: 'markedly elevated serum ketones',
          reason: 'Significant ketone production favors DKA over HHS.',
        },
      ],
      finalReasonLessLikely:
        'HHS typically has minimal ketosis and less severe metabolic acidosis.',
    },
    {
      diagnosis: 'Acute Gastroenteritis',
      whyPlausibleEarly:
        'Vomiting and abdominal pain are common presentations of gastroenteritis.',
      ruledOutByClues: [
        {
          clueOrder: 5,
          evidence: 'high-anion-gap metabolic acidosis with ketonaemia',
          reason:
            'Ketoacidosis explains the vomiting and abdominal pain better than isolated gastrointestinal disease.',
        },
      ],
      finalReasonLessLikely:
        'Gastroenteritis does not explain severe hyperglycaemia, ketosis, and high-anion-gap acidosis.',
    },
    {
      diagnosis: 'Acute Pancreatitis',
      whyPlausibleEarly:
        'Abdominal pain, vomiting, and systemic illness may resemble pancreatitis.',
      ruledOutByClues: [
        {
          clueOrder: 4,
          evidence: 'severe hyperglycaemia with ketonaemia',
          reason:
            'The metabolic pattern is more characteristic of insulin deficiency than pancreatic inflammation.',
        },
      ],
      finalReasonLessLikely:
        'The dominant pathology is ketoacidosis rather than pancreatic injury.',
    },
    {
      diagnosis: 'Sepsis',
      whyPlausibleEarly:
        'Tachycardia, hypotension, and metabolic derangement can occur in severe infection.',
      ruledOutByClues: [
        {
          clueOrder: 5,
          evidence: 'high-anion-gap ketoacidosis',
          reason:
            'The acid-base disturbance is specifically explained by ketone accumulation.',
        },
      ],
      finalReasonLessLikely:
        'Sepsis may precipitate DKA but does not independently explain the full metabolic profile.',
    },
  ],
  generationQuality: {
    contentTier: 'FLAGSHIP',
    humanReviewed: true,
    seedVersion,
  },
};

const educationForFrontend = {
  title: 'Diabetic Ketoacidosis',

  summary: {
    definition:
      'Diabetic ketoacidosis is an acute metabolic emergency caused by absolute or severe relative insulin deficiency, leading to hyperglycaemia, ketone production, and high-anion-gap metabolic acidosis.',

    highYieldTakeaway:
      'Think DKA whenever polyuria, polydipsia, dehydration, and unexplained deep breathing occur together with hyperglycaemia.',
  },

  recognitionPattern: [
    {
      pattern: 'Polyuria and polydipsia',
      whyItMatters:
        'Osmotic diuresis from severe hyperglycaemia causes large fluid losses and intense thirst.',
    },
    {
      pattern: 'Vomiting with abdominal pain',
      whyItMatters:
        'Ketosis and acidosis frequently cause abdominal symptoms that may mimic a surgical abdomen.',
    },
    {
      pattern: 'Deep laboured breathing',
      whyItMatters:
        'Kussmaul respirations are a compensatory response to metabolic acidosis.',
    },
    {
      pattern: 'Progressive dehydration',
      whyItMatters:
        'Volume depletion drives shock, acute kidney injury, and electrolyte abnormalities.',
    },
  ],

  keySigns: [
    {
      finding: 'Kussmaul respirations',
      significance:
        'Deep, rapid breathing is a classic sign of severe metabolic acidosis.',
    },
    {
      finding: 'Signs of dehydration',
      significance:
        'Dry mucous membranes, poor skin turgor, and tachycardia reflect major fluid losses.',
    },
    {
      finding: 'Altered mental status',
      significance:
        'May indicate severe acidosis, cerebral dysfunction, or profound dehydration.',
    },
  ],

  examPearls: [
    {
      type: 'exam',
      title: 'Abdominal pain is a trap',
      content:
        'DKA frequently causes significant abdominal pain that may mimic an acute abdomen or peritonitis. Reassess after metabolic correction before pursuing surgical workup.',
    },
    {
      type: 'exam',
      title: 'Look at the breathing pattern',
      content:
        'Recognizing Kussmaul respirations at the bedside can identify severe acidosis before laboratory results return.',
    },
  ],

  scoringSystems: [],

  investigations: [
    {
      test: 'Capillary glucose',
      interpretation:
        'Usually elevated, often above 14 mmol/L.',
      commonTrap:
        'Euglycaemic DKA can occur, particularly with SGLT2 inhibitor use.',
    },
    {
      test: 'Serum ketones',
      interpretation:
        'Elevated ketones confirm active ketogenesis.',
    },
    {
      test: 'Venous blood gas',
      interpretation:
        'Demonstrates metabolic acidosis with low pH and bicarbonate.',
    },
    {
      test: 'Electrolytes',
      interpretation:
        'Assess potassium, sodium, renal function, and anion gap.',
    },
  ],

  pitfalls: [
    {
      pitfall: 'Normal potassium level',
      consequence:
        'Total body potassium is depleted even when serum potassium appears normal.',
    },
    {
      pitfall: 'Insulin before potassium review',
      consequence:
        'Insulin can precipitate dangerous hypokalaemia.',
    },
    {
      pitfall: 'Assuming abdominal pain means surgery',
      consequence:
        'Unnecessary surgical investigations may occur if DKA is missed.',
    },
    {
      pitfall: 'Stopping insulin too early',
      consequence:
        'Ketoacidosis may recur despite improving glucose levels.',
    },
  ],

  managementOverview: [
    {
      step: 'Aggressive IV fluids',
      rationale:
        'Volume resuscitation reverses shock and improves perfusion.',
    },
    {
      step: 'Potassium assessment',
      rationale:
        'Potassium abnormalities determine safe insulin initiation.',
    },
    {
      step: 'Fixed-rate insulin infusion',
      rationale:
        'Suppresses ketogenesis and corrects metabolic derangement.',
    },
    {
      step: 'Treat precipitating cause',
      rationale:
        'Infection, missed insulin, myocardial infarction, and other triggers must be identified.',
    },
  ],

  differentialDistinguishers: [
    {
      diagnosis: 'Hyperosmolar Hyperglycaemic State',
      keySeparator:
        'Marked hyperglycaemia with minimal ketosis and less severe acidosis.',
    },
    {
      diagnosis: 'Acute Gastroenteritis',
      keySeparator:
        'Vomiting occurs but significant hyperglycaemia and ketonaemia are absent.',
    },
    {
      diagnosis: 'Acute Pancreatitis',
      keySeparator:
        'Elevated lipase and characteristic epigastric pain predominate.',
    },
    {
      diagnosis: 'Sepsis',
      keySeparator:
        'Systemic infection may trigger DKA but does not independently produce marked ketoacidosis.',
    },
  ],

  references: [
    'Oxford Handbook of Clinical Medicine',
    'JBDS Guidelines for Diabetic Ketoacidosis',
    'ADA Standards of Care',
    'BMJ Best Practice: Diabetic Ketoacidosis',
  ],
};

async function main() {
  const canonicalName = 'diabetic ketoacidosis';
  const displayLabel = 'Diabetic Ketoacidosis';
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
      specialty: 'Endocrinology',
      bodySystem: 'Endocrine',
      category: 'Metabolic',
      difficultyBand: DiagnosisDifficultyBand.BASIC,
      clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
      rarityBand: DiagnosisRarityBand.COMMON,
      urgencyLevel: DiagnosisUrgencyLevel.EMERGENT,
    },
    create: {
      canonicalName,
      canonicalNormalized,
      displayLabel,
      status: DiagnosisRegistryStatus.ACTIVE,
      active: true,
      isPlayable: true,
      isGeneratable: true,
      specialty: 'Endocrinology',
      bodySystem: 'Endocrine',
      category: 'Metabolic',
      difficultyBand: DiagnosisDifficultyBand.BASIC,
      clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
      rarityBand: DiagnosisRarityBand.COMMON,
      urgencyLevel: DiagnosisUrgencyLevel.EMERGENT,
    },
  });

  const aliasTerms = [displayLabel, canonicalName, 'dka'];
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
        kind: aliasRank === 0 ? DiagnosisAliasKind.CANONICAL : DiagnosisAliasKind.ACCEPTED,
      },
      create: {
        diagnosisRegistryId: registry.id,
        term,
        normalizedTerm: normalizeClinicalText(term),
        active: true,
        acceptedForMatch: true,
        rank: aliasRank,
        kind: aliasRank === 0 ? DiagnosisAliasKind.CANONICAL : DiagnosisAliasKind.ACCEPTED,
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

  const history = clues.find((clue) => clue.type === 'history')?.value ?? displayLabel;
  const symptoms = clues.filter((clue) => clue.type === 'symptom').map((clue) => clue.value);

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
      'Seeded frontend-aligned flagship diabetic ketoacidosis inventory case. DailyCase scheduler should assign the actual daily slot.',
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
      'Frontend-aligned flagship diabetic ketoacidosis inventory revision for DailyCase scheduler assignment.',
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
      validatorVersion: 'flagship-human-review:v4',
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        note: 'Manual frontend-aligned diabetic ketoacidosis inventory case seeded for DailyCase scheduler assignment.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded frontend-aligned Diabetic Ketoacidosis:', {
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
