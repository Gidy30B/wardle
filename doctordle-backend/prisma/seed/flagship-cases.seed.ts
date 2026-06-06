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
const seedVersion = 'flagship-guillain-barre-syndrome-v1';

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
      'A 29-year-old man presents with progressive difficulty walking over the past 3 days.',
  },
  {
    order: 1,
    type: 'history',
    value:
      'He reports tingling in both feet that began one week after recovering from a severe diarrheal illness.',
  },
  {
    order: 2,
    type: 'symptom',
    value:
      'Weakness started in the legs and is now involving the thighs and hands bilaterally.',
  },
  {
    order: 3,
    type: 'exam',
    value:
      'Neurological examination demonstrates symmetric flaccid weakness with markedly reduced deep tendon reflexes in both lower limbs.',
  },
  {
    order: 4,
    type: 'exam',
    value:
      'There is mild bilateral facial weakness and difficulty coughing effectively, though sensation is largely preserved.',
  },
  {
    order: 5,
    type: 'investigation',
    value:
      'Lumbar puncture reveals elevated CSF protein with a normal white blood cell count. Nerve conduction studies show demyelinating polyneuropathy.',
  },
] as const;

const differentials = [
  'Transverse Myelitis',
  'Myasthenia Gravis',
  'Botulism',
  'Acute Hypokalemic Paralysis',
];

const explanation = {
  diagnosis: 'Guillain-Barré Syndrome',
  summary:
    'Progressive ascending weakness and areflexia in a young adult one week after a diarrheal illness, with symmetric flaccid paralysis, bilateral facial weakness, albuminocytologic dissociation on CSF, and demyelinating polyneuropathy on nerve conduction studies confirm Guillain-Barré syndrome.',
  reasoning: [
    'Progressive difficulty walking over 3 days in a young adult raises concern for an acute neurological process affecting motor function.',
    'Tingling in both feet beginning one week after a diarrheal illness suggests a post-infectious peripheral nerve disorder.',
    'Ascending symmetric leg-to-hand weakness localizes the disease to the peripheral nervous system and follows the classic GBS distribution.',
    'Symmetric flaccid weakness with markedly reduced deep tendon reflexes confirms lower motor neuron disease at multiple levels.',
    'Bilateral facial weakness and impaired cough indicate proximal spread to cranial nerves and raise immediate concern for respiratory failure.',
    'Elevated CSF protein with normal cell count and demyelinating nerve conduction studies establish the diagnosis of Guillain-Barré syndrome.',
  ],
  keyFindings: [
    'Progressive difficulty walking over 3 days',
    'Post-diarrheal onset with distal tingling',
    'Ascending symmetric weakness involving legs and hands',
    'Symmetric flaccid weakness',
    'Markedly reduced deep tendon reflexes',
    'Bilateral facial weakness',
    'Difficulty coughing effectively',
    'Largely preserved sensation',
    'Albuminocytologic dissociation on CSF',
    'Demyelinating polyneuropathy on nerve conduction studies',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Transverse Myelitis',
      whyPlausibleEarly:
        'Transverse myelitis can also cause acute leg weakness and may follow a respiratory or gastrointestinal infection.',
      ruledOutByClues: [
        {
          clueOrder: 3,
          evidence: 'symmetric flaccid weakness with markedly reduced deep tendon reflexes',
          reason:
            'Transverse myelitis produces upper motor neuron signs with hyperreflexia over time, not flaccid areflexic paralysis.',
        },
        {
          clueOrder: 5,
          evidence: 'demyelinating polyneuropathy on nerve conduction studies',
          reason:
            'Demyelinating polyneuropathy on NCS indicates peripheral nerve disease rather than a spinal cord lesion.',
        },
      ],
      finalReasonLessLikely:
        'Transverse myelitis would present with a sensory level, early bladder dysfunction, and eventual upper motor neuron signs — none of which are present here.',
    },
    {
      diagnosis: 'Myasthenia Gravis',
      whyPlausibleEarly:
        'Myasthenia gravis can cause generalized weakness and may involve facial muscles in young adults.',
      ruledOutByClues: [
        {
          clueOrder: 3,
          evidence: 'markedly reduced deep tendon reflexes',
          reason:
            'Myasthenia gravis is a neuromuscular junction disorder that does not cause areflexia.',
        },
        {
          clueOrder: 5,
          evidence: 'elevated CSF protein with albuminocytologic dissociation',
          reason:
            'CSF and nerve conduction findings are inconsistent with a neuromuscular junction disorder.',
        },
      ],
      finalReasonLessLikely:
        'Myasthenia gravis produces fatigable weakness, preserved reflexes, no ascending pattern, and normal CSF findings.',
    },
    {
      diagnosis: 'Botulism',
      whyPlausibleEarly:
        'Botulism causes acute flaccid paralysis and may follow a gastrointestinal illness with toxin ingestion.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: 'weakness ascending from legs to hands bilaterally',
          reason:
            'Botulism produces descending paralysis beginning with cranial nerve involvement, not ascending peripheral weakness.',
        },
        {
          clueOrder: 5,
          evidence: 'albuminocytologic dissociation and demyelinating polyneuropathy on NCS',
          reason:
            'These findings indicate an immune-mediated peripheral neuropathy rather than a presynaptic toxin-mediated disorder.',
        },
      ],
      finalReasonLessLikely:
        'Botulism presents with descending paralysis, prominent early pupillary abnormalities, and autonomic features without CSF protein elevation.',
    },
    {
      diagnosis: 'Acute Hypokalemic Paralysis',
      whyPlausibleEarly:
        'Acute hypokalemic paralysis can cause rapid-onset symmetric flaccid weakness, sometimes following a gastrointestinal illness with fluid and electrolyte loss.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'tingling in both feet following the diarrheal illness',
          reason:
            'Sensory symptoms are not a feature of hypokalemic paralysis, which is a pure motor disorder.',
        },
        {
          clueOrder: 5,
          evidence: 'elevated CSF protein and demyelinating polyneuropathy on nerve conduction studies',
          reason:
            'CSF protein elevation and NCS abnormalities indicate peripheral nerve disease rather than an electrolyte disorder.',
        },
      ],
      finalReasonLessLikely:
        'Hypokalemic paralysis does not produce sensory symptoms, CSF protein elevation, or NCS changes, and weakness rapidly resolves with potassium replacement.',
    },
  ],
  generationQuality: {
    contentTier: 'FLAGSHIP',
    humanReviewed: true,
    seedVersion,
  },
};

const educationForFrontend = {
  title: 'Guillain-Barré Syndrome',

  summary: {
    definition:
      'Guillain-Barré syndrome (GBS) is an acute immune-mediated polyneuropathy characterized by rapidly progressive ascending flaccid weakness and areflexia, typically triggered by a preceding respiratory or gastrointestinal infection.',
    highYieldTakeaway:
      'Think GBS in any patient with rapidly ascending symmetric weakness and areflexia following a recent infection — albuminocytologic dissociation on CSF and demyelinating findings on nerve conduction studies confirm the diagnosis.',
  },

  recognitionPattern: [
    {
      pattern: 'Ascending paralysis pattern',
      whyItMatters:
        'Weakness begins distally in the legs and ascends proximally over days to weeks, reflecting a length-dependent peripheral neuropathy.',
    },
    {
      pattern: 'Post-infectious trigger',
      whyItMatters:
        'GBS typically follows a respiratory or gastrointestinal infection by 1–3 weeks; Campylobacter jejuni is the most common preceding pathogen.',
    },
    {
      pattern: 'Peripheral nerve localization',
      whyItMatters:
        'Flaccid weakness with absent or markedly reduced reflexes in an alert patient strongly localizes disease to the peripheral nervous system.',
    },
  ],

  keySymptoms: [
    {
      symptom: 'Progressive ascending weakness',
      significance:
        'Ascending symmetric weakness starting in the distal legs is the hallmark presentation and may progress to involve the arms and respiratory muscles.',
    },
    {
      symptom: 'Distal tingling and paresthesias',
      significance:
        'Sensory symptoms in the feet often precede or accompany motor weakness and direct attention to peripheral nerve involvement.',
    },
  ],

  keySigns: [
    {
      finding: 'Areflexia or hyporeflexia',
      significance:
        'Absent or markedly reduced deep tendon reflexes in an awake patient strongly suggest GBS and distinguish it from upper motor neuron lesions.',
    },
    {
      finding: 'Symmetric flaccid weakness',
      significance:
        'Diffuse flaccidity without increased tone distinguishes a peripheral nerve disorder from a central or neuromuscular junction lesion.',
    },
    {
      finding: 'Bilateral facial weakness',
      significance:
        'Cranial nerve involvement indicates spread beyond limb muscles and signals increasing risk of respiratory compromise.',
    },
  ],

  examPearls: [
    {
      type: 'physical',
      title: 'Areflexia with ascending weakness',
      content:
        'Absent or markedly reduced deep tendon reflexes in a patient with progressive ascending weakness is the cardinal clinical finding for GBS.',
      whyItMatters:
        'This combination localizes disease to the peripheral nervous system rather than the spinal cord or neuromuscular junction.',
      discriminator:
        'Hyperreflexia or preserved reflexes argue against GBS and suggest a central or neuromuscular junction disorder.',
      trapAvoided:
        'Avoid attributing progressive leg weakness to stroke or spinal cord disease without examining reflexes.',
    },
    {
      type: 'physical',
      title: 'Respiratory assessment',
      content:
        'Forced vital capacity should be measured serially; a value below 20 mL/kg, rapidly declining trajectory, or inability to count to 20 in a single breath are thresholds for considering intubation.',
      whyItMatters:
        'Respiratory failure develops in up to 30% of patients and can occur rapidly even when limb weakness appears mild.',
      managementImplication:
        'Early recognition of impending respiratory compromise prevents unplanned emergency intubation.',
    },
  ],

  scoringSystems: [],

  investigations: [
    {
      test: 'Lumbar puncture and CSF analysis',
      interpretation:
        'Albuminocytologic dissociation — elevated protein with normal or near-normal cell count — is the classic finding, though it may be absent in the first week of illness.',
      whyItMatters:
        'CSF findings support the diagnosis and help exclude infectious or inflammatory causes of polyneuropathy.',
    },
    {
      test: 'Nerve conduction studies and electromyography',
      interpretation:
        'Demyelinating features (slowed conduction velocity, prolonged distal latencies, conduction block) characterize AIDP; axonal variants show reduced compound action potential amplitudes.',
      whyItMatters:
        'NCS confirms peripheral nerve disease, establishes the subtype, and can inform prognosis.',
    },
    {
      test: 'Serial forced vital capacity',
      interpretation:
        'Values below 20 mL/kg, rapid decline, or inability to count to 20 in one breath indicate high risk for respiratory failure.',
      whyItMatters:
        'Respiratory monitoring guides the timing of ICU admission and intubation.',
    },
    {
      test: 'ECG and continuous cardiac monitoring',
      interpretation:
        'Dysautonomia may manifest as arrhythmias, tachycardia, or blood pressure fluctuations.',
      whyItMatters:
        'Cardiac dysautonomia is a major cause of mortality and requires continuous monitoring throughout the acute phase.',
    },
  ],

  pitfalls: [
    {
      pitfall: 'Normal CSF protein in early disease',
      consequence:
        'Protein elevation often develops only after the first week; a normal result early does not exclude GBS and should not delay treatment when clinical suspicion is high.',
    },
    {
      pitfall: 'Delayed respiratory monitoring',
      consequence:
        'Failure to measure vital capacity may delay recognition of impending respiratory failure and result in emergent rather than planned intubation.',
    },
    {
      pitfall: 'Treating with steroids alone',
      consequence:
        'Corticosteroids are not effective for classic GBS and may worsen outcomes; first-line treatment is IVIg or plasmapheresis.',
    },
  ],

  managementOverview: [
    {
      step: 'Admit for monitoring',
      rationale:
        'All patients require admission for close neurological assessment and serial vital capacity measurements given the risk of rapid deterioration.',
    },
    {
      step: 'IV immunoglobulin or plasmapheresis',
      rationale:
        'Both are equally effective first-line immunotherapies; choice depends on availability, patient factors, and contraindications.',
    },
    {
      step: 'Respiratory support',
      rationale:
        'Mechanical ventilation is required if vital capacity falls below 20 mL/kg or respiratory failure develops; early elective intubation is safer than emergent.',
    },
    {
      step: 'DVT prophylaxis and physiotherapy',
      rationale:
        'Immobile patients are at high risk for deep vein thrombosis; early physiotherapy supports rehabilitation and prevents complications of immobility.',
    },
    {
      step: 'Dysautonomia management',
      rationale:
        'Cardiac monitoring and cautious management of blood pressure instability and arrhythmias are essential throughout the acute phase.',
    },
  ],

  differentialDistinguishers: [
    {
      diagnosis: 'Transverse Myelitis',
      keySeparator:
        'Often presents with a sensory level, early bladder dysfunction, and eventual upper motor neuron signs with hyperreflexia; spinal cord lesion visible on MRI.',
    },
    {
      diagnosis: 'Myasthenia Gravis',
      keySeparator:
        'Produces fatigable rather than fixed weakness with preserved deep tendon reflexes, no ascending pattern, and normal CSF findings.',
    },
    {
      diagnosis: 'Botulism',
      keySeparator:
        'Causes descending paralysis with prominent early pupillary abnormalities and autonomic features; no CSF protein elevation or demyelinating NCS pattern.',
    },
    {
      diagnosis: 'Acute Hypokalemic Paralysis',
      keySeparator:
        'No sensory symptoms; reflexes recover rapidly with potassium correction; associated electrolyte abnormalities without CSF or NCS changes.',
    },
  ],

  complications: [
    {
      complication: 'Respiratory failure',
      whyItMatters:
        'Up to 30% of patients require mechanical ventilation; rapid deterioration can occur even when limb weakness appears mild.',
    },
    {
      complication: 'Dysautonomia',
      whyItMatters:
        'Cardiac arrhythmias and hemodynamic instability require continuous monitoring and are a significant cause of mortality.',
    },
    {
      complication: 'Persistent weakness and disability',
      whyItMatters:
        'Some patients have incomplete recovery with residual neurological deficits; early physiotherapy and rehabilitation improve long-term outcomes.',
    },
  ],

  recallPrompts: [
    {
      prompt:
        'What CSF finding is classically associated with Guillain-Barré syndrome?',
      answer:
        'Albuminocytologic dissociation: elevated protein with a normal or near-normal white blood cell count.',
    },
    {
      prompt:
        'Which organism most commonly precedes Guillain-Barré syndrome?',
      answer:
        'Campylobacter jejuni, following a diarrheal illness.',
    },
    {
      prompt:
        'What respiratory threshold should prompt consideration of mechanical ventilation in GBS?',
      answer:
        'Forced vital capacity below 20 mL/kg or a rapidly declining trajectory.',
    },
  ],

  references: [
    'Willison HJ, Jacobs BC, van Doorn PA. Guillain-Barré syndrome. Lancet. 2016;388(10045):717-727.',
    'Wijdicks EFM, Klein CJ. Guillain-Barré Syndrome. Mayo Clin Proc. 2017;92(3):467-479.',
    'van den Berg B et al. Guillain-Barré syndrome: pathogenesis, diagnosis, treatment and prognosis. Nat Rev Neurol. 2014;10(8):469-482.',
  ],
};

async function main() {
  const canonicalName = 'guillain barre syndrome';
  const displayLabel = 'Guillain-Barré Syndrome';
  const canonicalNormalized = normalizeClinicalText(canonicalName);

  const registry = await prisma.diagnosisRegistry.upsert({
    where: { canonicalNormalized },
    update: {
      canonicalName,
      displayLabel,
      status: DiagnosisRegistryStatus.ACTIVE,
      active: true,
      specialty: 'Neurology',
      subspecialty: 'Neuromuscular Disease',
      category: 'Neurological',
      bodySystem: 'Nervous System',
      organSystem: 'Peripheral Nervous System',
      difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
      rarityBand: DiagnosisRarityBand.UNCOMMON,
      clinicalSetting: DiagnosisClinicalSetting.INPATIENT,
      ageGroup: DiagnosisAgeGroup.ADULT,
      urgencyLevel: DiagnosisUrgencyLevel.URGENT,
      onboardingStatus: 'READY_FOR_REVIEW',
      isPlayable: true,
      isGeneratable: true,
      preferredClueTypes: ['history', 'symptom', 'exam', 'investigation'],
      excludedClueTypes: [],
      searchPriority: 15,
      notes:
        'Acute immune-mediated polyneuropathy presenting with ascending flaccid weakness and areflexia, classically following a gastrointestinal or respiratory infection.',
    },
    create: {
      canonicalName,
      canonicalNormalized,
      displayLabel,
      status: DiagnosisRegistryStatus.ACTIVE,
      active: true,
      specialty: 'Neurology',
      subspecialty: 'Neuromuscular Disease',
      category: 'Neurological',
      bodySystem: 'Nervous System',
      organSystem: 'Peripheral Nervous System',
      difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
      rarityBand: DiagnosisRarityBand.UNCOMMON,
      clinicalSetting: DiagnosisClinicalSetting.INPATIENT,
      ageGroup: DiagnosisAgeGroup.ADULT,
      urgencyLevel: DiagnosisUrgencyLevel.URGENT,
      onboardingStatus: 'READY_FOR_REVIEW',
      onboardingStartedAt: now,
      isPlayable: true,
      isGeneratable: true,
      preferredClueTypes: ['history', 'symptom', 'exam', 'investigation'],
      excludedClueTypes: [],
      searchPriority: 15,
      notes:
        'Acute immune-mediated polyneuropathy presenting with ascending flaccid weakness and areflexia, classically following a gastrointestinal or respiratory infection.',
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
      term: 'gbs',
      kind: DiagnosisAliasKind.ACCEPTED,
      acceptedForMatch: true,
      rank: 95,
    },
    {
      term: 'acute inflammatory demyelinating polyradiculoneuropathy',
      kind: DiagnosisAliasKind.ACCEPTED,
      acceptedForMatch: true,
      rank: 80,
    },
    {
      term: 'aidp',
      kind: DiagnosisAliasKind.ACCEPTED,
      acceptedForMatch: true,
      rank: 75,
    },
    {
      term: 'guillain barre',
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
    'Progressive ascending weakness',
    'Distal tingling and paresthesias',
    'Areflexia',
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
      'Seeded frontend-aligned flagship Guillain-Barré Syndrome inventory case. DailyCase scheduler should assign the actual daily slot.',
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
      'Frontend-aligned flagship Guillain-Barré Syndrome inventory revision for DailyCase scheduler assignment.',
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
      validatorVersion: 'flagship-human-review:guillain-barre-syndrome-v1',
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        note: 'Manual frontend-aligned Guillain-Barré Syndrome inventory case seeded for DailyCase scheduler assignment.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded frontend-aligned Guillain-Barré Syndrome:', {
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
