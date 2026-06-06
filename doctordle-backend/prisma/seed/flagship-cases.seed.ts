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
const seedVersion = 'flagship-nutritional-vitamin-d-deficiency-rickets-v1';

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
        console.warn('Preferred inventory placeholder date was occupied; using next free date.', {
          displayLabel: params.displayLabel,
          preferredDate: params.preferredDate.toISOString(),
          assignedDate: candidateDate.toISOString(),
          offsetDays: offset,
        });
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
      'An 18-month-old child is brought to clinic because of delayed motor milestones and difficulty standing without support.',
  },
  {
    order: 1,
    type: 'risk',
    value:
      'The child spends little time outdoors and is still primarily breastfed without vitamin supplementation.',
  },
  {
    order: 2,
    type: 'exam',
    value:
      'Examination reveals frontal bossing and a persistently large anterior fontanelle.',
  },
  {
    order: 3,
    type: 'exam',
    value:
      'There is widening of the wrists and palpable beading along the costochondral junctions.',
  },
  {
    order: 4,
    type: 'investigation',
    value:
      'Laboratory studies demonstrate markedly elevated alkaline phosphatase with abnormalities in calcium-phosphate metabolism.',
  },
  {
    order: 5,
    type: 'imaging',
    value:
      'Radiographs of the wrists show metaphyseal cupping, fraying, and widening of the growth plates.',
  },
] as const;

const differentials = [
  'Hypophosphatemic rickets',
  'Osteogenesis imperfecta',
  'Osteomalacia',
  'Cerebral palsy',
];

const explanation = {
  diagnosis: 'Nutritional Vitamin D Deficiency Rickets',
  summary:
    'Delayed motor milestones, limited sunlight exposure, prolonged breastfeeding without supplementation, frontal bossing, large anterior fontanelle, rachitic rosary, wrist widening, elevated alkaline phosphatase, and metaphyseal cupping and fraying support nutritional vitamin D deficiency rickets.',
  reasoning: [
    'Delayed motor milestones and difficulty standing in a toddler suggest a disorder affecting musculoskeletal development or strength.',
    'Limited sunlight exposure and breastfeeding without vitamin D supplementation create a strong nutritional risk profile for vitamin D deficiency.',
    'Frontal bossing and a persistently large anterior fontanelle are classic skeletal manifestations of rickets.',
    'Wrist widening and costochondral beading reflect expansion of unmineralized osteoid at active growth plates.',
    'Markedly elevated alkaline phosphatase with calcium-phosphate abnormalities supports active defective bone mineralization.',
    'Metaphyseal cupping, fraying, and widened growth plates on wrist radiographs confirm rickets in a child with open physes.',
  ],
  keyFindings: [
    'Delayed motor milestones',
    'Difficulty standing without support',
    'Limited sunlight exposure',
    'Breastfeeding without vitamin supplementation',
    'Frontal bossing',
    'Persistently large anterior fontanelle',
    'Wrist widening',
    'Rachitic rosary',
    'Elevated alkaline phosphatase',
    'Metaphyseal cupping, fraying, and widened growth plates',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Hypophosphatemic rickets',
      whyPlausibleEarly:
        'Hypophosphatemic rickets can also cause bowed legs, growth concerns, and rachitic radiographic changes.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'limited sunlight exposure and breastfeeding without vitamin supplementation',
          reason:
            'The nutritional risk profile strongly favors vitamin D deficiency over a renal phosphate-wasting disorder.',
        },
      ],
      finalReasonLessLikely:
        'Persistent hypophosphatemia despite vitamin D replacement or family history would raise concern for hypophosphatemic rickets.',
    },
    {
      diagnosis: 'Osteogenesis imperfecta',
      whyPlausibleEarly:
        'Osteogenesis imperfecta is a pediatric bone disorder that may present with skeletal deformity or fragility.',
      ruledOutByClues: [
        {
          clueOrder: 3,
          evidence: 'wrist widening and rachitic rosary',
          reason:
            'These growth plate expansion findings are more typical of rickets than collagen fragility.',
        },
      ],
      finalReasonLessLikely:
        'Recurrent fractures, blue sclerae, dentinogenesis imperfecta, and connective tissue fragility are not present.',
    },
    {
      diagnosis: 'Osteomalacia',
      whyPlausibleEarly:
        'Osteomalacia is also caused by defective bone mineralization, often from vitamin D deficiency.',
      ruledOutByClues: [
        {
          clueOrder: 5,
          evidence: 'widening of the growth plates',
          reason:
            'Growth plate abnormalities occur in children with open physes and indicate rickets rather than adult osteomalacia.',
        },
      ],
      finalReasonLessLikely:
        'Osteomalacia affects adults after epiphyseal closure rather than toddlers with active growth plates.',
    },
    {
      diagnosis: 'Cerebral palsy',
      whyPlausibleEarly:
        'Delayed motor milestones and difficulty standing can suggest a neurologic motor disorder.',
      ruledOutByClues: [
        {
          clueOrder: 4,
          evidence: 'elevated alkaline phosphatase with calcium-phosphate abnormalities',
          reason:
            'Biochemical evidence of defective mineralization supports metabolic bone disease rather than isolated neurologic delay.',
        },
      ],
      finalReasonLessLikely:
        'The skeletal abnormalities and radiographic findings indicate a metabolic bone disorder.',
    },
  ],
  generationQuality: {
    contentTier: 'FLAGSHIP',
    humanReviewed: true,
    seedVersion,
  },
};

const educationForFrontend = {
  title: 'Nutritional Vitamin D Deficiency Rickets',

  summary: {
    definition:
      'Rickets is a pediatric metabolic bone disease characterized by defective mineralization of the growth plate, most commonly due to vitamin D deficiency.',
    highYieldTakeaway:
      'Think nutritional vitamin D deficiency rickets in toddlers with delayed walking, low sunlight exposure or unsupplemented breastfeeding, skeletal deformities, and metaphyseal cupping or fraying on radiographs.',
  },

  recognitionPattern: [
    {
      pattern: 'Typical presentation',
      whyItMatters:
        'Toddlers may present with delayed walking, skeletal deformities, bone pain, hypotonia, or growth impairment.',
    },
    {
      pattern: 'Nutritional risk factors',
      whyItMatters:
        'Exclusive breastfeeding without vitamin D supplementation and limited sunlight exposure are major preventable risk factors.',
    },
    {
      pattern: 'Growth plate disease',
      whyItMatters:
        'Clinical and radiographic abnormalities localize the disease to growing bones with open physes.',
    },
  ],

  keySymptoms: [
    {
      symptom: 'Delayed motor milestones',
      significance:
        'Delayed walking or difficulty standing may be the first clue to hypotonia or painful defective mineralization.',
    },
    {
      symptom: 'Bone pain or irritability',
      significance:
        'Children with active rickets may be uncomfortable, reluctant to walk, or less active.',
    },
  ],

  keySigns: [
    {
      finding: 'Rachitic rosary',
      significance:
        'Beading at the costochondral junctions occurs because of expansion of unmineralized osteoid.',
    },
    {
      finding: 'Wrist widening',
      significance:
        'Enlargement of the distal radius and ulna reflects growth plate expansion and active skeletal disease.',
    },
    {
      finding: 'Frontal bossing and large anterior fontanelle',
      significance:
        'Skull findings support a chronic mineralization disorder in a young child.',
    },
  ],

  examPearls: [
    {
      type: 'physical',
      title: 'Rachitic rosary',
      content:
        'Prominent beading at the costochondral junctions occurs due to expansion of unmineralized osteoid.',
      whyItMatters:
        'This is a classic examination clue for rickets in children.',
      discriminator:
        'Helps distinguish metabolic bone disease from isolated developmental delay.',
      trapAvoided:
        'Avoid attributing delayed milestones purely to neurologic causes.',
    },
    {
      type: 'physical',
      title: 'Wrist widening',
      content:
        'Enlargement of the distal radius and ulna reflects growth plate expansion.',
      whyItMatters:
        'Wrist changes are among the earliest and most reliable skeletal findings.',
      managementImplication:
        'Presence of active skeletal disease supports urgent nutritional correction.',
    },
  ],

  scoringSystems: [],

  investigations: [
    {
      test: 'Biochemical profile',
      interpretation:
        'Alkaline phosphatase is markedly elevated, while calcium and phosphate levels may be reduced.',
      whyItMatters:
        'The biochemical pattern supports active defective bone mineralization.',
    },
    {
      test: 'Radiographic findings',
      interpretation:
        'X-rays classically demonstrate metaphyseal cupping, fraying, and widening.',
      whyItMatters:
        'Characteristic radiographic changes help confirm the diagnosis.',
    },
  ],

  pitfalls: [
    {
      pitfall: 'Missing the diagnosis in delayed milestones',
      consequence:
        'Children with rickets may initially appear to have isolated developmental delay; careful musculoskeletal examination prevents delayed diagnosis.',
    },
  ],

  managementOverview: [
    {
      step: 'Vitamin D replacement',
      rationale:
        'Therapeutic vitamin D with concurrent calcium supplementation allows remineralization and recovery of bone growth.',
    },
    {
      step: 'Nutritional counseling',
      rationale:
        'Caregivers should receive counseling regarding supplementation, adequate calcium intake, and safe sunlight exposure.',
    },
    {
      step: 'Correct underlying risk factors',
      rationale:
        'Addressing diet, malabsorption risk, and adherence reduces recurrence and progression.',
    },
  ],

  differentialDistinguishers: [
    {
      diagnosis: 'Hypophosphatemic rickets',
      keySeparator:
        'Often presents with persistent hypophosphatemia despite adequate vitamin D replacement and may have a family history.',
    },
    {
      diagnosis: 'Osteogenesis imperfecta',
      keySeparator:
        'Associated with recurrent fractures, blue sclerae, dentinogenesis imperfecta, and connective tissue fragility.',
    },
    {
      diagnosis: 'Osteomalacia',
      keySeparator:
        'Affects defective mineralization in adults after epiphyseal closure rather than children with open growth plates.',
    },
    {
      diagnosis: 'Cerebral palsy',
      keySeparator:
        'Motor delay alone may suggest neurologic disease, but skeletal, biochemical, and radiographic findings indicate metabolic bone disease.',
    },
  ],

  complications: [
    {
      complication: 'Permanent skeletal deformity',
      whyItMatters:
        'Delayed recognition can lead to persistent bowed legs, growth impairment, and orthopedic complications.',
    },
  ],

  recallPrompts: [
    {
      prompt:
        'What radiographic findings are classically associated with rickets?',
      answer:
        'Metaphyseal cupping, fraying, and widening of the growth plates.',
    },
    {
      prompt:
        'Which examination finding describes beading along the costochondral junctions?',
      answer: 'Rachitic rosary.',
    },
  ],

  references: [
    'WHO guidance on nutritional rickets',
    'Nelson Textbook of Pediatrics',
    'Oxford Handbook of Paediatrics',
  ],
};

async function main() {
  const canonicalName = 'nutritional vitamin d deficiency rickets';
  const displayLabel = 'Nutritional Vitamin D Deficiency Rickets';
  const canonicalNormalized = normalizeClinicalText(canonicalName);

  const registry = await prisma.diagnosisRegistry.upsert({
    where: { canonicalNormalized },
    update: {
      canonicalName,
      displayLabel,
      status: DiagnosisRegistryStatus.ACTIVE,
      active: true,
      specialty: 'Paediatrics',
      subspecialty: 'Metabolic Bone Disease',
      category: 'Metabolic',
      bodySystem: 'Musculoskeletal',
      organSystem: 'Bone',
      difficultyBand: DiagnosisDifficultyBand.BASIC,
      rarityBand: DiagnosisRarityBand.COMMON,
      clinicalSetting: DiagnosisClinicalSetting.OUTPATIENT,
      ageGroup: DiagnosisAgeGroup.PEDIATRIC,
      urgencyLevel: DiagnosisUrgencyLevel.ROUTINE,
      onboardingStatus: 'READY_FOR_REVIEW',
      isPlayable: true,
      isGeneratable: true,
      preferredClueTypes: ['history', 'risk', 'exam', 'investigation', 'imaging'],
      excludedClueTypes: [],
      searchPriority: 12,
      notes:
        'Classic pediatric nutritional rickets caused by vitamin D deficiency with skeletal deformities and metaphyseal changes.',
    },
    create: {
      canonicalName,
      canonicalNormalized,
      displayLabel,
      status: DiagnosisRegistryStatus.ACTIVE,
      active: true,
      specialty: 'Paediatrics',
      subspecialty: 'Metabolic Bone Disease',
      category: 'Metabolic',
      bodySystem: 'Musculoskeletal',
      organSystem: 'Bone',
      difficultyBand: DiagnosisDifficultyBand.BASIC,
      rarityBand: DiagnosisRarityBand.COMMON,
      clinicalSetting: DiagnosisClinicalSetting.OUTPATIENT,
      ageGroup: DiagnosisAgeGroup.PEDIATRIC,
      urgencyLevel: DiagnosisUrgencyLevel.ROUTINE,
      onboardingStatus: 'READY_FOR_REVIEW',
      onboardingStartedAt: now,
      isPlayable: true,
      isGeneratable: true,
      preferredClueTypes: ['history', 'risk', 'exam', 'investigation', 'imaging'],
      excludedClueTypes: [],
      searchPriority: 12,
      notes:
        'Classic pediatric nutritional rickets caused by vitamin D deficiency with skeletal deformities and metaphyseal changes.',
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
      term: 'rickets',
      kind: DiagnosisAliasKind.ACCEPTED,
      acceptedForMatch: true,
      rank: 95,
    },
    {
      term: 'vitamin d deficiency rickets',
      kind: DiagnosisAliasKind.ACCEPTED,
      acceptedForMatch: true,
      rank: 90,
    },
    {
      term: 'nutritional rickets',
      kind: DiagnosisAliasKind.ACCEPTED,
      acceptedForMatch: true,
      rank: 85,
    },
    {
      term: 'childhood rickets',
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
  const symptoms = [
    'Delayed motor milestones',
    'Difficulty standing without support',
  ];

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
      'Seeded frontend-aligned flagship nutritional vitamin D deficiency rickets inventory case. DailyCase scheduler should assign the actual daily slot.',
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
      'Frontend-aligned flagship nutritional vitamin D deficiency rickets inventory revision for DailyCase scheduler assignment.',
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
      validatorVersion:
        'flagship-human-review:nutritional-vitamin-d-deficiency-rickets-v1',
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        note: 'Manual frontend-aligned nutritional vitamin D deficiency rickets inventory case seeded for DailyCase scheduler assignment.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded frontend-aligned Nutritional Vitamin D Deficiency Rickets:', {
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
