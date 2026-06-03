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
const seedVersion = 'flagship-ruptured-ectopic-pregnancy-v1';

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 28-year-old woman presents with lower abdominal pain radiating to the shoulder. Her last normal menstrual period was 7 weeks ago.',
  },
  {
    order: 1,
    type: 'symptom',
    value:
      'She reports light vaginal spotting for the past two days and occasional dizziness.',
  },
  {
    order: 2,
    type: 'vital',
    value: 'Pulse rate is 112 beats/min and blood pressure is 92/60 mmHg.',
  },
  {
    order: 3,
    type: 'exam',
    value:
      'Pelvic examination demonstrates unilateral adnexal tenderness and cervical motion tenderness.',
  },
  {
    order: 4,
    type: 'lab',
    value:
      'A urine pregnancy test is positive. Serum beta-hCG is elevated but lower than expected for the estimated gestational age.',
  },
  {
    order: 5,
    type: 'imaging',
    value:
      'Transvaginal ultrasound reveals no intrauterine gestational sac despite a beta-hCG level above the discriminatory zone. A complex adnexal mass is visualized.',
  },
] as const;

const differentials = [
  'Threatened Miscarriage',
  'Pelvic Inflammatory Disease',
  'Ruptured Ovarian Cyst',
  'Ovarian Torsion',
];

const explanation = {
  diagnosis: 'Ruptured Ectopic Pregnancy',
  summary:
    'Amenorrhoea, abdominal pain, shoulder-tip pain, vaginal bleeding, haemodynamic instability, positive pregnancy testing, and absent intrauterine pregnancy on transvaginal ultrasound support ruptured ectopic pregnancy.',
  reasoning: [
    'A missed menstrual period with lower abdominal pain suggests an early pregnancy complication until proven otherwise.',
    'Vaginal spotting forms part of the classic ectopic pregnancy triad.',
    'Tachycardia and hypotension suggest haemodynamic compromise from intra-abdominal haemorrhage.',
    'Shoulder-tip pain indicates diaphragmatic irritation from haemoperitoneum.',
    'Positive pregnancy testing confirms pregnancy and narrows the diagnostic field.',
    'No intrauterine gestational sac above the discriminatory beta-hCG zone with a complex adnexal mass strongly supports ectopic implantation.',
  ],
  keyFindings: [
    'Amenorrhoea',
    'Lower abdominal pain',
    'Shoulder-tip pain',
    'Vaginal spotting',
    'Dizziness',
    'Hypotension',
    'Tachycardia',
    'Positive pregnancy test',
    'Absent intrauterine gestation',
    'Complex adnexal mass',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Threatened Miscarriage',
      whyPlausibleEarly:
        'Amenorrhoea and vaginal bleeding are common presentations of early pregnancy loss.',
      ruledOutByClues: [
        {
          clueOrder: 5,
          evidence:
            'no intrauterine gestational sac with a complex adnexal mass',
          reason:
            'The ultrasound localizes concern outside the uterine cavity rather than showing an intrauterine pregnancy at risk of miscarriage.',
        },
      ],
      finalReasonLessLikely:
        'Threatened miscarriage does not explain absent intrauterine pregnancy above the discriminatory zone with an adnexal mass.',
    },
    {
      diagnosis: 'Pelvic Inflammatory Disease',
      whyPlausibleEarly:
        'Pelvic pain and cervical motion tenderness may occur in PID.',
      ruledOutByClues: [
        {
          clueOrder: 4,
          evidence: 'positive pregnancy test with abnormal beta-hCG pattern',
          reason:
            'Pregnancy-related findings make ectopic pregnancy the priority diagnosis.',
        },
      ],
      finalReasonLessLikely:
        'PID does not explain amenorrhoea, positive pregnancy testing, or the absent intrauterine gestation with adnexal mass.',
    },
    {
      diagnosis: 'Ruptured Ovarian Cyst',
      whyPlausibleEarly:
        'A ruptured cyst can cause acute pelvic pain and haemoperitoneum.',
      ruledOutByClues: [
        {
          clueOrder: 4,
          evidence: 'positive pregnancy test',
          reason:
            'Pregnancy shifts the dangerous diagnosis toward ectopic pregnancy.',
        },
      ],
      finalReasonLessLikely:
        'A ruptured ovarian cyst does not explain amenorrhoea, abnormal beta-hCG, or absent intrauterine pregnancy.',
    },
    {
      diagnosis: 'Ovarian Torsion',
      whyPlausibleEarly:
        'Ovarian torsion may present with sudden unilateral pelvic pain.',
      ruledOutByClues: [
        {
          clueOrder: 5,
          evidence: 'absent intrauterine gestation with complex adnexal mass',
          reason:
            'The pregnancy localization problem is more consistent with ectopic pregnancy.',
        },
      ],
      finalReasonLessLikely:
        'Torsion does not explain the missed period, positive pregnancy test, or beta-hCG and ultrasound pattern.',
    },
  ],
  generationQuality: {
    contentTier: 'FLAGSHIP',
    humanReviewed: true,
    seedVersion,
  },
};

const educationForFrontend = {
  title: 'Ruptured Ectopic Pregnancy',

  summary: {
    definition:
      'A ruptured ectopic pregnancy occurs when an extrauterine gestation, most commonly within the fallopian tube, ruptures and causes intra-abdominal haemorrhage.',
    highYieldTakeaway:
      'Any woman of reproductive age with abdominal pain, vaginal bleeding, and a recent missed period should be assumed to have ectopic pregnancy until proven otherwise.',
  },

  recognitionPattern: [
    {
      pattern: 'Classic triad',
      whyItMatters:
        'Amenorrhoea, abdominal pain, and vaginal bleeding are hallmark features of ectopic pregnancy.',
    },
    {
      pattern: 'Features of rupture',
      whyItMatters:
        'Shoulder-tip pain, dizziness, syncope, tachycardia, hypotension, and sudden worsening pain suggest tubal rupture with haemoperitoneum.',
    },
  ],

  keySigns: [
    {
      finding: 'Shoulder-tip pain',
      significance:
        'Blood in the peritoneal cavity can irritate the diaphragm and produce referred pain.',
    },
    {
      finding: 'Adnexal tenderness',
      significance:
        'Localized tenderness adjacent to the uterus supports a tubal source of symptoms.',
    },
    {
      finding: 'Shock',
      significance:
        'Hypotension and tachycardia may appear before definitive imaging confirms the diagnosis.',
    },
  ],

  examPearls: [
    {
      type: 'exam',
      title: 'Shoulder-tip pain',
      content:
        'Blood within the peritoneal cavity irritates the diaphragm, producing referred pain via the phrenic nerve.',
    },
    {
      type: 'exam',
      title: 'Adnexal tenderness',
      content:
        'Unilateral adnexal tenderness supports a tubal rather than intrauterine source of symptoms.',
    },
    {
      type: 'exam',
      title: 'Treat instability first',
      content:
        'Haemodynamic instability should prompt immediate resuscitation and gynaecology involvement rather than waiting passively for imaging.',
    },
  ],

  scoringSystems: [],

  investigations: [
    {
      test: 'Urine pregnancy test',
      interpretation:
        'Positive testing confirms pregnancy and triggers localization of the gestation.',
    },
    {
      test: 'Serum beta-hCG',
      interpretation:
        'An abnormal rise or lower-than-expected level suggests an abnormal pregnancy.',
    },
    {
      test: 'Transvaginal ultrasound',
      interpretation:
        'No intrauterine gestation with an adnexal mass is the key imaging pattern supporting ectopic pregnancy.',
    },
    {
      test: 'Full blood count and cross-match',
      interpretation:
        'Assesses haemorrhage severity and prepares for urgent transfusion if needed.',
    },
  ],

  pitfalls: [
    {
      pitfall: 'Assuming miscarriage',
      consequence:
        'Vaginal bleeding in early pregnancy should not be attributed to miscarriage until ectopic pregnancy is excluded.',
    },
    {
      pitfall: 'Waiting for ultrasound in an unstable patient',
      consequence:
        'Delaying resuscitation and specialist involvement can be fatal in haemorrhagic shock.',
    },
    {
      pitfall: 'Ignoring shoulder-tip pain',
      consequence:
        'This symptom may be an early clue to significant haemoperitoneum.',
    },
  ],

  managementOverview: [
    {
      step: 'Immediate ABC assessment and resuscitation',
      rationale:
        'Haemorrhagic shock is the immediate life-threatening complication.',
    },
    {
      step: 'Large-bore IV access and blood cross-match',
      rationale: 'Allows rapid fluid and blood product administration.',
    },
    {
      step: 'Urgent gynaecology consultation',
      rationale:
        'Definitive treatment is usually surgical when rupture is suspected.',
    },
    {
      step: 'Emergency laparoscopy or laparotomy',
      rationale: 'Controls bleeding and removes the ectopic pregnancy.',
    },
  ],

  differentialDistinguishers: [
    {
      diagnosis: 'Threatened Miscarriage',
      keySeparator:
        'Absence of an intrauterine pregnancy and presence of an adnexal mass favour ectopic pregnancy.',
    },
    {
      diagnosis: 'Pelvic Inflammatory Disease',
      keySeparator:
        'Pregnancy-related findings and abnormal ultrasound findings favour ectopic pregnancy.',
    },
    {
      diagnosis: 'Ruptured Ovarian Cyst',
      keySeparator:
        'Does not explain amenorrhoea, positive pregnancy testing, or abnormal beta-hCG levels.',
    },
    {
      diagnosis: 'Ovarian Torsion',
      keySeparator:
        'Ultrasound findings and pregnancy-related features support ectopic pregnancy.',
    },
  ],

  references: [
    'Oxford Handbook of Clinical Medicine',
    'NICE guideline: Ectopic pregnancy and miscarriage',
    'BMJ Best Practice: Ectopic pregnancy',
  ],
};

async function main() {
  const canonicalName = 'ectopic pregnancy';
  const displayLabel = 'Ruptured Ectopic Pregnancy';
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
      specialty: 'Obstetrics and Gynaecology',
      bodySystem: 'Reproductive',
      category: 'Pregnancy emergency',
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
      specialty: 'Obstetrics and Gynaecology',
      bodySystem: 'Reproductive',
      category: 'Pregnancy emergency',
      difficultyBand: DiagnosisDifficultyBand.BASIC,
      clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
      rarityBand: DiagnosisRarityBand.COMMON,
      urgencyLevel: DiagnosisUrgencyLevel.EMERGENT,
    },
  });

  const aliasTerms = [
    canonicalName,
    displayLabel,
    'ruptured ectopic pregnancy',
    'tubal ectopic pregnancy',
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
      'Seeded frontend-aligned flagship ruptured ectopic pregnancy inventory case. DailyCase scheduler should assign the actual daily slot.',
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
      'Frontend-aligned flagship ruptured ectopic pregnancy inventory revision for DailyCase scheduler assignment.',
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
      validatorVersion: 'flagship-human-review:ruptured-ectopic-pregnancy-v1',
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        note: 'Manual frontend-aligned ruptured ectopic pregnancy inventory case seeded for DailyCase scheduler assignment.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded frontend-aligned Ruptured Ectopic Pregnancy:', {
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
