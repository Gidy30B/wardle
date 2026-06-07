import {
  PrismaClient,
  CaseEditorialStatus,
  DiagnosisAliasKind,
  DiagnosisAgeGroup,
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
const seedVersion = 'flagship-testicular-torsion-v1';

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
        diagnosisRegistryId: true,
        currentRevisionId: true,
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

    if (params.reusableCaseId && owner.id === params.reusableCaseId) {
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

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 16-year-old boy presents with sudden severe pain in the left testicle that began 2 hours ago while resting.',
  },
  {
    order: 1,
    type: 'symptom',
    value: 'He feels nauseated and has vomited once since the pain started.',
  },
  {
    order: 2,
    type: 'history',
    value: 'He denies dysuria, urethral discharge, or recent sexual exposure.',
  },
  {
    order: 3,
    type: 'exam',
    value:
      'Examination shows a tender, high-riding left testis with a horizontal lie.',
  },
  {
    order: 4,
    type: 'exam',
    value: 'The cremasteric reflex is absent on the affected side.',
  },
  {
    order: 5,
    type: 'investigation',
    value:
      'Urgent Doppler ultrasound shows reduced blood flow to the left testis, but surgical exploration is not delayed.',
  },
] as const;

const differentials = [
  'Epididymo-orchitis',
  'Torsion of appendix testis',
  'Incarcerated inguinal hernia',
];

const explanation = {
  diagnosis: 'Testicular Torsion',
  summary:
    'This is testicular torsion: acute scrotal pain from twisting of the spermatic cord, causing reduced blood supply to the testis.',
  keyEvidence: [
    'Sudden severe unilateral testicular pain',
    'Nausea and vomiting',
    'High-riding testis with horizontal lie',
    'Absent cremasteric reflex',
    'Reduced Doppler flow',
  ],
  reasoning: [
    'Sudden severe unilateral testicular pain is the hallmark presentation.',
    'Nausea and vomiting commonly accompany acute torsion.',
    'A high-riding testis with horizontal lie and absent cremasteric reflex are classic bedside findings.',
    'Doppler ultrasound may show reduced flow but should not delay surgery if clinical suspicion is high.',
  ],
  keyFindings: [
    'Sudden severe unilateral testicular pain',
    'Nausea and vomiting',
    'High-riding testis with horizontal lie',
    'Absent cremasteric reflex',
    'Reduced Doppler flow',
  ],
  differentials,
  whyNotOthers: [
    {
      diagnosis: 'Epididymo-orchitis',
      reason:
        'Usually has gradual pain, urinary symptoms, fever, or STI risk features.',
    },
    {
      diagnosis: 'Torsion of appendix testis',
      reason:
        'Often less severe and may show a localized upper-pole tenderness or blue-dot sign.',
    },
    {
      diagnosis: 'Incarcerated inguinal hernia',
      reason:
        'Would usually have groin swelling or bowel obstruction features.',
    },
  ],
  managementPearl:
    'Treat as a surgical emergency. Urgent urology review and scrotal exploration are needed; do not delay surgery for imaging if clinical suspicion is high.',
  differentialAnalysis: [
    {
      diagnosis: 'Epididymo-orchitis',
      whyPlausibleEarly:
        'Infection causes scrotal pain and swelling and may be associated with urinary symptoms or fever.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: 'no dysuria or STI risk',
          reason:
            'Absence of urinary features reduces likelihood of epididymo-orchitis.',
        },
        {
          clueOrder: 3,
          evidence: 'high-riding testis',
          reason:
            'Anatomical high-riding testis is more consistent with torsion.',
        },
      ],
      finalReasonLessLikely:
        'Epididymo-orchitis tends to have more gradual onset and infectious features.',
    },
    {
      diagnosis: 'Torsion of appendix testis',
      whyPlausibleEarly:
        'Can cause focal scrotal pain in adolescents and may produce a tender upper-pole focus.',
      ruledOutByClues: [
        {
          clueOrder: 3,
          evidence: 'high-riding testis with horizontal lie',
          reason:
            'Global testicular abnormalities point to cord torsion rather than isolated appendage torsion.',
        },
      ],
      finalReasonLessLikely:
        'Appendage torsion is usually less severe and often self-limited.',
    },
    {
      diagnosis: 'Incarcerated inguinal hernia',
      whyPlausibleEarly:
        'May present with acute groin or scrotal pain and signs of bowel obstruction.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence: 'no history of groin swelling',
          reason:
            'Absence of groin swelling or obstruction signs reduces likelihood.',
        },
      ],
      finalReasonLessLikely:
        'Inguinal hernia typically presents with a palpable groin mass or obstructive symptoms.',
    },
  ],
  generationQuality: {
    contentTier: 'FLAGSHIP',
    humanReviewed: true,
    seedVersion,
  },
};

const educationForFrontend = {
  title: 'Testicular Torsion',

  summary: {
    definition:
      'Testicular torsion is twisting of the spermatic cord, obstructing testicular blood flow and causing acute ischemic scrotal pain.',
    highYieldTakeaway:
      'Think testicular torsion in an adolescent or young adult male with sudden severe unilateral testicular pain, nausea or vomiting, a high-riding testis, and absent cremasteric reflex.',
  },

  recognitionPattern: [
    {
      pattern: 'Sudden severe unilateral testicular pain',
      whyItMatters:
        'Abrupt onset over minutes to hours is the classic presentation and separates torsion from many infectious causes of scrotal pain.',
    },
    {
      pattern: 'Adolescent or young adult male',
      whyItMatters:
        'Torsion is most common around puberty and in young adults, although it can occur at any age.',
    },
    {
      pattern: 'No urinary or STI features',
      whyItMatters:
        'Absence of dysuria, urethral discharge, fever, or sexual exposure makes epididymo-orchitis less likely.',
    },
  ],

  keySymptoms: [
    {
      symptom: 'Sudden severe testicular pain',
      significance:
        'Acute unilateral pain is the hallmark symptom and should trigger emergency evaluation.',
    },
    {
      symptom: 'Nausea and vomiting',
      significance:
        'Visceral autonomic symptoms commonly accompany torsion and support the diagnosis in acute scrotum.',
    },
  ],

  keySigns: [
    {
      finding: 'High-riding testis with horizontal lie',
      significance:
        'Abnormal testicular position reflects spermatic cord twisting and is a classic bedside clue.',
    },
    {
      finding: 'Absent cremasteric reflex',
      significance:
        'Loss of the ipsilateral cremasteric reflex strongly supports torsion in the right clinical setting.',
    },
    {
      finding: 'Tender affected testis',
      significance:
        'Marked testicular tenderness is expected with acute ischemia.',
    },
  ],

  examPearls: [
    {
      type: 'physical',
      title: 'Cremasteric reflex',
      content:
        'Stroke the inner thigh and look for elevation of the ipsilateral testis; absence on the painful side supports torsion.',
      whyItMatters:
        'This is a fast bedside discriminator when acute torsion is suspected.',
      discriminator:
        'A preserved reflex does not fully exclude torsion, but an absent reflex is highly concerning.',
      trapAvoided:
        'Do not falsely reassure yourself with a nonspecific scrotal pain exam when the reflex is absent.',
    },
    {
      type: 'physical',
      title: 'Testicular lie',
      content:
        'Look for a high-riding testis or horizontal lie on the painful side.',
      whyItMatters: 'Abnormal lie is a classic sign of spermatic cord torsion.',
      managementImplication:
        'Urgent urology review and operative exploration are needed when clinical suspicion is high.',
    },
  ],

  scoringSystems: [],

  investigations: [
    {
      test: 'Doppler scrotal ultrasound',
      interpretation:
        'Reduced or absent blood flow to the affected testis supports torsion.',
      whyItMatters:
        'Ultrasound can support the diagnosis when immediately available, but should not delay surgical exploration if suspicion is high.',
    },
    {
      test: 'Urinalysis',
      interpretation:
        'May be normal in torsion; pyuria or bacteriuria would support infectious epididymo-orchitis.',
      whyItMatters:
        'A normal urinalysis helps move infection lower on the differential, but management remains driven by torsion risk.',
    },
  ],

  pitfalls: [
    {
      pitfall: 'Waiting for imaging despite classic torsion features',
      consequence: 'Delay can reduce the chance of testicular salvage.',
    },
    {
      pitfall: 'Mislabeling acute torsion as epididymo-orchitis',
      consequence:
        'Antibiotic treatment without surgical assessment risks missed ischemia.',
    },
    {
      pitfall: 'Being reassured by lack of sexual exposure',
      consequence:
        'The absence of STI risk makes infection less likely and should increase concern for torsion in acute scrotum.',
    },
  ],

  managementOverview: [
    {
      step: 'Urgent urology review',
      rationale:
        'Testicular torsion is a surgical emergency requiring immediate specialist involvement.',
    },
    {
      step: 'Immediate scrotal exploration when suspicion is high',
      rationale:
        'Definitive treatment is detorsion and orchiopexy; imaging must not delay operative management.',
    },
    {
      step: 'Bilateral orchiopexy',
      rationale:
        'The contralateral testis is typically fixed as well because the anatomic predisposition is often bilateral.',
    },
  ],

  differentialDistinguishers: [
    {
      diagnosis: 'Epididymo-orchitis',
      keySeparator:
        'Usually has gradual pain, urinary symptoms, fever, or STI risk features rather than abrupt severe pain with abnormal lie.',
    },
    {
      diagnosis: 'Torsion of appendix testis',
      keySeparator:
        'Often less severe and may show localized upper-pole tenderness or a blue-dot sign.',
    },
    {
      diagnosis: 'Incarcerated inguinal hernia',
      keySeparator:
        'Usually has groin swelling, a palpable mass, or bowel obstruction features.',
    },
  ],

  complications: [
    {
      complication: 'Testicular infarction',
      whyItMatters:
        'Prolonged ischemia can cause irreversible testicular damage.',
    },
    {
      complication: 'Orchiectomy',
      whyItMatters:
        'Delayed diagnosis may require removal of a nonviable testis.',
    },
    {
      complication: 'Subfertility',
      whyItMatters:
        'Loss of testicular tissue or ischemic injury can affect future fertility.',
    },
  ],

  recallPrompts: [
    {
      prompt:
        'What bedside reflex is classically absent in testicular torsion?',
      answer: 'The ipsilateral cremasteric reflex.',
    },
    {
      prompt: 'What is the classic testicular position in torsion?',
      answer: 'A high-riding testis with a horizontal lie.',
    },
    {
      prompt:
        'Should surgery be delayed for ultrasound when clinical suspicion for torsion is high?',
      answer:
        'No. Urgent urology review and surgical exploration should not be delayed for imaging.',
    },
  ],

  references: [],
};

async function main() {
  const canonicalName = 'testicular torsion';
  const displayLabel = 'Testicular Torsion';
  const canonicalNormalized = normalizeClinicalText(canonicalName);

  const registry = await prisma.diagnosisRegistry.upsert({
    where: { canonicalNormalized },
    update: {
      canonicalName,
      displayLabel,
      status: DiagnosisRegistryStatus.ACTIVE,
      active: true,
      specialty: 'Urology',
      subspecialty: 'Andrology',
      category: 'Surgical Emergency',
      bodySystem: 'Genitourinary',
      organSystem: 'Male Reproductive System',
      difficultyBand: DiagnosisDifficultyBand.BASIC,
      rarityBand: DiagnosisRarityBand.UNCOMMON,
      clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
      ageGroup: DiagnosisAgeGroup.PEDIATRIC,
      urgencyLevel: DiagnosisUrgencyLevel.EMERGENT,
      onboardingStatus: 'READY_FOR_REVIEW',
      isPlayable: true,
      isGeneratable: true,
      preferredClueTypes: ['history', 'symptom', 'exam', 'investigation'],
      excludedClueTypes: [],
      searchPriority: 15,
      notes:
        'Urologic emergency in adolescent and young adult males causing sudden severe unilateral testicular pain from spermatic cord torsion.',
    },
    create: {
      canonicalName,
      canonicalNormalized,
      displayLabel,
      status: DiagnosisRegistryStatus.ACTIVE,
      active: true,
      specialty: 'Urology',
      subspecialty: 'Andrology',
      category: 'Surgical Emergency',
      bodySystem: 'Genitourinary',
      organSystem: 'Male Reproductive System',
      difficultyBand: DiagnosisDifficultyBand.BASIC,
      rarityBand: DiagnosisRarityBand.UNCOMMON,
      clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
      ageGroup: DiagnosisAgeGroup.PEDIATRIC,
      urgencyLevel: DiagnosisUrgencyLevel.EMERGENT,
      onboardingStatus: 'READY_FOR_REVIEW',
      onboardingStartedAt: now,
      isPlayable: true,
      isGeneratable: true,
      preferredClueTypes: ['history', 'symptom', 'exam', 'investigation'],
      excludedClueTypes: [],
      searchPriority: 15,
      notes:
        'Urologic emergency in adolescent and young adult males causing sudden severe unilateral testicular pain from spermatic cord torsion.',
    },
  });

  const aliasSeeds = [
    {
      term: canonicalName,
      kind: DiagnosisAliasKind.CANONICAL,
      acceptedForMatch: true,
      rank: 100,
    },
    {
      term: 'torsion of testis',
      kind: DiagnosisAliasKind.ACCEPTED,
      acceptedForMatch: true,
      rank: 90,
    },
    {
      term: 'spermatic cord torsion',
      kind: DiagnosisAliasKind.ACCEPTED,
      acceptedForMatch: true,
      rank: 85,
    },
    {
      term: 'acute scrotum',
      kind: DiagnosisAliasKind.SEARCH_ONLY,
      acceptedForMatch: false,
      rank: 40,
    },
  ];
  const seenAliasNormalizations = new Set<string>();

  for (const aliasSeed of aliasSeeds) {
    const term = aliasSeed.term;
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
      acceptedForMatch: aliasSeed.acceptedForMatch,
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
        acceptedForMatch: aliasSeed.acceptedForMatch,
        rank: aliasSeed.rank,
        kind: aliasSeed.kind,
        source: seedVersion,
      },
      create: {
        diagnosisRegistryId: registry.id,
        term,
        normalizedTerm,
        active: true,
        acceptedForMatch: aliasSeed.acceptedForMatch,
        rank: aliasSeed.rank,
        kind: aliasSeed.kind,
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

  const reusableCase = await prisma.case.findFirst({
    where: {
      diagnosisRegistryId: registry.id,
      proposedDiagnosisText: displayLabel,
      dailyCases: { none: {} },
    },
    orderBy: [{ approvedAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      currentRevisionId: true,
    },
  });

  const assignedInventoryPlaceholderDate =
    await findAvailableInventoryPlaceholderDate({
      preferredDate: inventoryPlaceholderDate,
      reusableCaseId: reusableCase?.id,
      displayLabel,
    });

  const caseData = {
    title: displayLabel,
    date: assignedInventoryPlaceholderDate,
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
      'Seeded frontend-aligned flagship Testicular Torsion inventory case. DailyCase scheduler should assign the actual daily slot.',
  };

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
    date: assignedInventoryPlaceholderDate,
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
      'Frontend-aligned flagship Testicular Torsion inventory revision for DailyCase scheduler assignment.',
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
      validatorVersion: 'flagship-human-review:testicular-torsion-v1',
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        note: 'Manual frontend-aligned Testicular Torsion inventory case seeded for DailyCase scheduler assignment.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded frontend-aligned Testicular Torsion:', {
    registryId: registry.id,
    caseId: seededCase.id,
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
