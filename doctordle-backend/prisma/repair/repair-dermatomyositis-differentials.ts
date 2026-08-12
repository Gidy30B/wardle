import 'dotenv/config';
import {
  PrismaClient,
  CaseSource,
  DiagnosisEducationSource,
  DiagnosisEducationStatus,
  PublishTrack,
  ValidationOutcome,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/**
 * REPAIR - Dermatomyositis canonical differentials
 *
 * Why this repair is required:
 * - The already-seeded Dermatomyositis case contains descriptive/compositional
 *   differential labels such as "Systemic Lupus Erythematosus with Myositis",
 *   "Hypothyroid Myopathy", and "Drug-Induced Myopathy".
 * - Wardle differential lists should point to canonical diagnosis entities rather
 *   than vignette descriptions, manifestations, or combined phrases.
 *
 * Repairs:
 * 1. Finds the existing Dermatomyositis registry and exact seeded case.
 * 2. Does not create a new registry, case, or diagnosis-education record.
 * 3. Preserves all six clues, case date, public number, editorial status,
 *    diagnosis mapping, and DailyCase links.
 * 4. Replaces the case-level differential list with canonical diagnoses.
 * 5. Replaces explanation.differentials and explanation.differentialAnalysis.
 * 6. Repairs the published diagnosis-education differential list when present.
 * 7. Creates a new CaseRevision and DiagnosisEducationRevision for auditability.
 * 8. Records a PASSED CaseValidationRun.
 * 9. Is idempotent and safely skips when the repair is already complete.
 *
 * Run:
 *   npx tsx prisma/repair/repair-dermatomyositis-differentials.ts
 *
 * Railway:
 *   railway run npx tsx prisma/repair/repair-dermatomyositis-differentials.ts
 */

const databaseUrl = resolvePgConnectionString(process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required to run the Dermatomyositis differential repair.',
  );
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 20_000,
  allowExitOnIdle: true,
  ssl:
    databaseUrl.includes('railway') ||
    databaseUrl.includes('proxy.rlwy.net') ||
    databaseUrl.includes('postgres.railway.internal')
      ? { rejectUnauthorized: false }
      : undefined,
});

pool.on('error', (error) => {
  console.error('[pg-pool] idle client error:', error);
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function resolvePgConnectionString(
  value: string | undefined,
): string | undefined {
  if (!value) return undefined;
  if (!value.startsWith('prisma+postgres://')) return value;

  const parsed = new URL(value);
  const apiKey = parsed.searchParams.get('api_key');

  if (!apiKey) {
    throw new Error(
      'DATABASE_URL uses prisma+postgres:// but is missing api_key.',
    );
  }

  const payload = JSON.parse(
    Buffer.from(apiKey, 'base64url').toString('utf8'),
  ) as { databaseUrl?: unknown };

  if (typeof payload.databaseUrl !== 'string' || !payload.databaseUrl) {
    throw new Error(
      'DATABASE_URL uses prisma+postgres:// but api_key does not contain a databaseUrl.',
    );
  }

  return payload.databaseUrl;
}

function normalizeClinicalText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.map(asRecord);
}

function stringArrayEquals(value: unknown, expected: readonly string[]): boolean {
  if (!Array.isArray(value) || value.length !== expected.length) return false;
  return value.every((item, index) => item === expected[index]);
}

type StoredClue = {
  order: number;
  type: string;
  value: string;
};

type DifferentialAnalysisEntry = {
  diagnosis: string;
  whyPlausibleEarly: string;
  ruledOutByClues: Array<{
    clueOrder: number;
    evidence: string;
    reason: string;
  }>;
  finalReasonLessLikely: string;
};

type EducationDifferentialEntry = {
  diagnosis: string;
  distinguishingFeatures: string;
};

const now = new Date();
const repairVersion = 'repair-dermatomyositis-canonical-differentials-v1';
const canonicalNormalized = 'dermatomyositis';
const caseTitle = 'Progressive Proximal Weakness with a Photosensitive Rash';

const expectedClues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 44-year-old woman reports eight weeks of progressive difficulty rising from low chairs, climbing stairs, lifting shopping bags, and keeping her arms raised while arranging her hair. The weakness is symmetric and affects the shoulders and hips more than the hands and feet. She has no numbness, diplopia, fluctuating weakness, recent intense exercise, or family history of muscle disease.',
  },
  {
    order: 1,
    type: 'symptom',
    value:
      'During the same period she has developed a photosensitive violaceous discoloration around the eyelids, an itchy erythematous eruption over the upper chest and shoulders, and rough scaly papules over the knuckles. She also reports mild difficulty swallowing dry food but no oral ulcers, Raynaud phenomenon, new medicines, or prolonged glucocorticoid use.',
  },
  {
    order: 2,
    type: 'exam',
    value:
      'Examination shows a violaceous periorbital eruption with mild oedema, erythematous scaly papules over the metacarpophalangeal and interphalangeal joints, periungual capillary changes, and a shawl-distribution rash over the shoulders. Neck flexion and shoulder and hip-girdle power are 4-/5 bilaterally, while distal power, sensation, coordination, and deep-tendon reflexes are preserved.',
  },
  {
    order: 3,
    type: 'lab',
    value:
      'Creatine kinase is 4,260 U/L and aldolase is elevated. Aspartate and alanine aminotransferases are raised with normal bilirubin and alkaline phosphatase. Urinalysis has no haematuria, thyroid-stimulating hormone and electrolytes are normal, and inflammatory markers are moderately elevated.',
  },
  {
    order: 4,
    type: 'imaging',
    value:
      'MRI of the thighs shows symmetric patchy oedema within the proximal muscle groups without fatty replacement or focal collection. Electromyography demonstrates short-duration, low-amplitude motor-unit potentials with spontaneous fibrillation activity, supporting an active irritable myopathy.',
  },
  {
    order: 5,
    type: 'lab',
    value:
      'A muscle biopsy shows perifascicular fibre atrophy with perivascular and perimysial inflammatory change, while a skin biopsy shows interface dermatitis. Anti-Mi-2 antibodies are positive. The integrated pattern of characteristic cutaneous disease, symmetric proximal inflammatory myopathy, elevated muscle enzymes, supportive MRI and electromyography, and compatible histopathology establishes Dermatomyositis.',
  },
] as const;

/**
 * Canonical diagnosis entities only.
 *
 * Replacements:
 * - Systemic Lupus Erythematosus with Myositis -> Systemic Lupus Erythematosus
 * - Hypothyroid Myopathy -> Hypothyroidism
 * - Drug-Induced Myopathy -> Polymyositis
 * - Endocrine or Toxic Myopathy (education umbrella) -> separate canonical entries
 */
const correctedDifferentials = [
  'Immune-Mediated Necrotizing Myopathy',
  'Inclusion Body Myositis',
  'Antisynthetase Syndrome',
  'Systemic Lupus Erythematosus',
  'Hypothyroidism',
  'Polymyositis',
] as const;

const correctedDifferentialAnalysis: DifferentialAnalysisEntry[] = [
  {
    diagnosis: 'Immune-Mediated Necrotizing Myopathy',
    whyPlausibleEarly:
      'Immune-mediated necrotizing myopathy can cause severe symmetric proximal weakness and marked muscle-enzyme elevation.',
    ruledOutByClues: [
      {
        clueOrder: 2,
        evidence: 'violaceous periorbital eruption',
        reason:
          'A characteristic inflammatory skin eruption favours Dermatomyositis over a predominantly muscle-limited necrotizing myopathy.',
      },
      {
        clueOrder: 5,
        evidence: 'perifascicular fibre atrophy',
        reason:
          'Perifascicular atrophy with perivascular or perimysial inflammation differs from the necrosis-dominant biopsy pattern expected in immune-mediated necrotizing myopathy.',
      },
    ],
    finalReasonLessLikely:
      'The defining cutaneous phenotype and perifascicular pathology favour Dermatomyositis.',
  },
  {
    diagnosis: 'Inclusion Body Myositis',
    whyPlausibleEarly:
      'Inclusion body myositis is an inflammatory muscle disease that can cause progressive weakness and dysphagia.',
    ruledOutByClues: [
      {
        clueOrder: 0,
        evidence: 'eight weeks',
        reason:
          'Inclusion body myositis usually evolves over years rather than over a short subacute interval.',
      },
      {
        clueOrder: 0,
        evidence: 'affects the shoulders and hips more than the hands and feet',
        reason:
          'Inclusion body myositis commonly has disproportionate finger-flexor and knee-extensor involvement.',
      },
      {
        clueOrder: 2,
        evidence: 'shawl-distribution rash',
        reason:
          'A characteristic inflammatory skin eruption is not explained by inclusion body myositis.',
      },
    ],
    finalReasonLessLikely:
      'The subacute symmetric proximal pattern, characteristic rash, marked enzymes, and perifascicular pathology do not fit inclusion body myositis.',
  },
  {
    diagnosis: 'Antisynthetase Syndrome',
    whyPlausibleEarly:
      'Antisynthetase syndrome can present with inflammatory myopathy, dysphagia, arthritis, Raynaud phenomenon, mechanic hands, and interstitial lung disease.',
    ruledOutByClues: [
      {
        clueOrder: 1,
        evidence: 'no oral ulcers, Raynaud phenomenon',
        reason:
          'The vignette does not establish the broader connective-tissue pattern expected in many antisynthetase presentations, although absence of Raynaud phenomenon alone is not exclusionary.',
      },
      {
        clueOrder: 5,
        evidence: 'Anti-Mi-2 antibodies are positive',
        reason:
          'The anti-Mi-2 and classic cutaneous phenotype favour Dermatomyositis rather than an antisynthetase-antibody-defined syndrome.',
      },
    ],
    finalReasonLessLikely:
      'No interstitial-lung, arthritis, or mechanic-hand pattern is established, and the anti-Mi-2 phenotype with classic rash is more coherent.',
  },
  {
    diagnosis: 'Systemic Lupus Erythematosus',
    whyPlausibleEarly:
      'Systemic lupus erythematosus can cause photosensitivity, inflammatory skin disease, constitutional symptoms, and inflammatory muscle involvement.',
    ruledOutByClues: [
      {
        clueOrder: 1,
        evidence: 'no oral ulcers, Raynaud phenomenon',
        reason:
          'Common accompanying connective-tissue manifestations are not present in the history, although their absence does not independently exclude lupus.',
      },
      {
        clueOrder: 2,
        evidence:
          'erythematous scaly papules over the metacarpophalangeal and interphalangeal joints',
        reason:
          'Extensor-knuckle papules with the heliotrope-type and shawl-distribution eruptions are more characteristic of Dermatomyositis.',
      },
      {
        clueOrder: 5,
        evidence: 'perifascicular fibre atrophy',
        reason:
          'This muscle-biopsy pattern strongly supports Dermatomyositis rather than nonspecific lupus-associated muscle involvement.',
      },
    ],
    finalReasonLessLikely:
      'The rash morphology, myositis-specific serology, and perifascicular pathology provide a more specific unifying diagnosis.',
  },
  {
    diagnosis: 'Hypothyroidism',
    whyPlausibleEarly:
      'Hypothyroidism can produce proximal weakness, fatigue, myalgia, delayed recovery, and elevation of creatine kinase.',
    ruledOutByClues: [
      {
        clueOrder: 3,
        evidence: 'thyroid-stimulating hormone and electrolytes are normal',
        reason:
          'Normal thyroid testing makes hypothyroidism an unlikely explanation for the muscle syndrome.',
      },
      {
        clueOrder: 2,
        evidence: 'violaceous periorbital eruption',
        reason:
          'The characteristic inflammatory skin findings are not explained by hypothyroidism.',
      },
    ],
    finalReasonLessLikely:
      'Normal thyroid testing and the defining skin, imaging, antibody, and biopsy findings favour Dermatomyositis.',
  },
  {
    diagnosis: 'Polymyositis',
    whyPlausibleEarly:
      'Polymyositis can produce subacute symmetric proximal weakness, dysphagia, marked muscle-enzyme elevation, and an irritable myopathic electromyographic pattern.',
    ruledOutByClues: [
      {
        clueOrder: 2,
        evidence: 'violaceous periorbital eruption',
        reason:
          'The defining inflammatory skin phenotype is not part of polymyositis.',
      },
      {
        clueOrder: 5,
        evidence: 'perifascicular fibre atrophy',
        reason:
          'Perifascicular atrophy with perivascular or perimysial inflammation supports Dermatomyositis rather than the endomysial pattern historically associated with polymyositis.',
      },
      {
        clueOrder: 5,
        evidence: 'skin biopsy shows interface dermatitis',
        reason:
          'Compatible inflammatory skin pathology further establishes a cutaneous inflammatory myopathy rather than polymyositis.',
      },
    ],
    finalReasonLessLikely:
      'The characteristic rash, interface dermatitis, anti-Mi-2 antibodies, and perifascicular pathology establish Dermatomyositis rather than a muscle-only inflammatory phenotype.',
  },
];

const correctedEducationDifferentials: EducationDifferentialEntry[] = [
  {
    diagnosis: 'Immune-Mediated Necrotizing Myopathy',
    distinguishingFeatures:
      'Usually produces severe muscle-predominant weakness with extensive myofibre necrosis and without the characteristic Dermatomyositis skin phenotype.',
  },
  {
    diagnosis: 'Inclusion Body Myositis',
    distinguishingFeatures:
      'Typically progresses slowly, may be asymmetric, disproportionately affects finger flexors and knee extensors, and responds poorly to conventional immunotherapy.',
  },
  {
    diagnosis: 'Antisynthetase Syndrome',
    distinguishingFeatures:
      'Inflammatory myopathy occurs with an antisynthetase antibody and may include interstitial lung disease, arthritis, Raynaud phenomenon, fever, and mechanic hands.',
  },
  {
    diagnosis: 'Systemic Lupus Erythematosus',
    distinguishingFeatures:
      'Broader lupus manifestations and serology may accompany muscle involvement, whereas classic Dermatomyositis skin morphology and perifascicular pathology point elsewhere.',
  },
  {
    diagnosis: 'Hypothyroidism',
    distinguishingFeatures:
      'Thyroid dysfunction can cause proximal weakness and creatine-kinase elevation, but thyroid testing identifies the cause and characteristic inflammatory skin findings are absent.',
  },
  {
    diagnosis: 'Polymyositis',
    distinguishingFeatures:
      'Produces a proximal inflammatory myopathy without the characteristic Dermatomyositis skin phenotype; modern diagnosis requires careful exclusion of other defined inflammatory-myopathy subtypes.',
  },
];

function assertExpectedClues(value: unknown): StoredClue[] {
  if (!Array.isArray(value)) {
    throw new Error('Target Dermatomyositis case does not contain a clues array.');
  }

  const clues = value.map((item, index): StoredClue => {
    const record = asRecord(item);
    const order = record.order;
    const type = record.type;
    const clueValue = record.value;

    if (
      typeof order !== 'number' ||
      typeof type !== 'string' ||
      typeof clueValue !== 'string'
    ) {
      throw new Error(`Malformed clue at array index ${index}.`);
    }

    return { order, type, value: clueValue };
  });

  if (clues.length !== expectedClues.length) {
    throw new Error(
      `Expected ${expectedClues.length} clues; found ${clues.length}. Repair aborted.`,
    );
  }

  clues.forEach((clue, index) => {
    const expected = expectedClues[index];

    if (
      clue.order !== expected.order ||
      clue.type !== expected.type ||
      clue.value !== expected.value
    ) {
      throw new Error(
        `Clue ${index} no longer matches the validated Dermatomyositis seed. Repair aborted to avoid modifying the wrong case or a later authored revision.`,
      );
    }
  });

  return clues;
}

function assertCanonicalDifferentials(clues: StoredClue[]): void {
  if (correctedDifferentials.length !== correctedDifferentialAnalysis.length) {
    throw new Error(
      'Corrected differential list and differential-analysis lengths differ.',
    );
  }

  const names = new Set<string>();

  correctedDifferentials.forEach((diagnosis) => {
    const normalized = normalizeClinicalText(diagnosis);
    if (names.has(normalized)) {
      throw new Error(`Duplicate corrected differential: ${diagnosis}.`);
    }
    names.add(normalized);

    if (/\bwith\b|\band\/or\b|\bor\b/i.test(diagnosis)) {
      throw new Error(
        `Corrected differential remains descriptive/compositional: ${diagnosis}.`,
      );
    }
  });

  correctedDifferentialAnalysis.forEach((entry, index) => {
    if (entry.diagnosis !== correctedDifferentials[index]) {
      throw new Error(
        `Differential-analysis order mismatch at index ${index}: ${entry.diagnosis}.`,
      );
    }

    if (
      !entry.whyPlausibleEarly.trim() ||
      !entry.finalReasonLessLikely.trim() ||
      entry.ruledOutByClues.length === 0
    ) {
      throw new Error(`Differential analysis is incomplete for ${entry.diagnosis}.`);
    }

    entry.ruledOutByClues.forEach((pointer) => {
      const clue = clues.find((item) => item.order === pointer.clueOrder);
      if (!clue) {
        throw new Error(
          `${entry.diagnosis} references missing clue ${pointer.clueOrder}.`,
        );
      }

      if (
        !normalizeClinicalText(clue.value).includes(
          normalizeClinicalText(pointer.evidence),
        )
      ) {
        throw new Error(
          `${entry.diagnosis} evidence is not present in clue ${pointer.clueOrder}: "${pointer.evidence}".`,
        );
      }
    });
  });

  if (
    correctedEducationDifferentials.length !== correctedDifferentials.length
  ) {
    throw new Error(
      'Education differential list must contain the same canonical diagnosis set.',
    );
  }

  correctedEducationDifferentials.forEach((entry, index) => {
    if (entry.diagnosis !== correctedDifferentials[index]) {
      throw new Error(
        `Education differential order mismatch at index ${index}: ${entry.diagnosis}.`,
      );
    }

    if (!entry.distinguishingFeatures.trim()) {
      throw new Error(
        `Education differential is incomplete for ${entry.diagnosis}.`,
      );
    }
  });
}

async function findRegistry() {
  const exact = await prisma.diagnosisRegistry.findMany({
    where: { canonicalNormalized },
    select: {
      id: true,
      canonicalName: true,
      canonicalNormalized: true,
      displayLabel: true,
    },
  });

  if (exact.length > 1) {
    throw new Error(
      `Multiple exact Dermatomyositis registries were found: ${exact.map((item) => item.id).join(', ')}. Repair aborted.`,
    );
  }

  if (exact.length === 1) return exact[0];

  const aliases = await prisma.diagnosisRegistry.findMany({
    where: {
      aliases: {
        some: {
          normalizedTerm: canonicalNormalized,
          active: true,
          acceptedForMatch: true,
        },
      },
    },
    select: {
      id: true,
      canonicalName: true,
      canonicalNormalized: true,
      displayLabel: true,
    },
  });

  if (aliases.length !== 1) {
    throw new Error(
      `Expected one Dermatomyositis registry but found ${aliases.length}. Repair aborted.`,
    );
  }

  const candidate = aliases[0];
  const identity = normalizeClinicalText(
    `${candidate.canonicalName} ${candidate.displayLabel}`,
  );

  if (!identity.includes('dermatomyositis')) {
    throw new Error(
      `Unsafe alias match: registry ${candidate.id} is ${candidate.displayLabel}. Repair aborted.`,
    );
  }

  return candidate;
}

async function findTargetCase(diagnosisRegistryId: string) {
  const cases = await prisma.case.findMany({
    where: {
      diagnosisRegistryId,
      title: caseTitle,
    },
    orderBy: [{ approvedAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      title: true,
      publicNumber: true,
      date: true,
      difficulty: true,
      history: true,
      symptoms: true,
      clues: true,
      explanation: true,
      differentials: true,
      editorialStatus: true,
      approvedAt: true,
      publishedAt: true,
      currentRevisionId: true,
      diagnosisRegistryId: true,
      proposedDiagnosisText: true,
      diagnosisMappingStatus: true,
      diagnosisMappingMethod: true,
      diagnosisMappingConfidence: true,
      diagnosisEditorialNote: true,
      dailyCases: { select: { id: true }, take: 100 },
    },
  });

  if (cases.length !== 1) {
    throw new Error(
      `Expected exactly one case titled "${caseTitle}" for registry ${diagnosisRegistryId}; found ${cases.length}. Repair aborted.`,
    );
  }

  return cases[0];
}

async function findEducation(diagnosisRegistryId: string) {
  return prisma.diagnosisEducation.findUnique({
    where: { diagnosisRegistryId },
    select: {
      id: true,
      diagnosisRegistryId: true,
      title: true,
      summary: true,
      clinicalPattern: true,
      keySymptoms: true,
      keySigns: true,
      examPearls: true,
      scoringSystems: true,
      investigations: true,
      differentials: true,
      management: true,
      complications: true,
      pitfalls: true,
      recallPrompts: true,
      references: true,
      editorialStatus: true,
      source: true,
      reviewedAt: true,
      publishedAt: true,
      version: true,
    },
  });
}

function educationHasCorrectDifferentials(value: unknown): boolean {
  const entries = asRecordArray(value);
  if (entries.length !== correctedEducationDifferentials.length) return false;

  return entries.every((entry, index) => {
    const expected = correctedEducationDifferentials[index];
    return (
      entry.diagnosis === expected.diagnosis &&
      entry.distinguishingFeatures === expected.distinguishingFeatures
    );
  });
}

async function repairDermatomyositisDifferentials() {
  const registry = await findRegistry();
  const targetCase = await findTargetCase(registry.id);
  const education = await findEducation(registry.id);
  const clues = assertExpectedClues(targetCase.clues);
  assertCanonicalDifferentials(clues);

  const existingExplanation = asRecord(targetCase.explanation);
  const existingRepairMetadata = asRecord(existingExplanation.repairMetadata);

  const caseAlreadyCorrect =
    stringArrayEquals(targetCase.differentials, correctedDifferentials) &&
    stringArrayEquals(existingExplanation.differentials, correctedDifferentials) &&
    existingRepairMetadata.differentialCanonicalizationRepairVersion ===
      repairVersion;

  const educationAlreadyCorrect =
    !education || educationHasCorrectDifferentials(education.differentials);

  if (caseAlreadyCorrect && educationAlreadyCorrect) {
    console.log('Dermatomyositis differential repair already applied.', {
      registryId: registry.id,
      caseId: targetCase.id,
      publicNumber: targetCase.publicNumber,
      currentRevisionId: targetCase.currentRevisionId,
      educationId: education?.id ?? null,
      repairVersion,
    });
    return;
  }

  const repairedExplanation = {
    ...existingExplanation,
    differentials: [...correctedDifferentials],
    differentialAnalysis: correctedDifferentialAnalysis,
    repairMetadata: {
      ...existingRepairMetadata,
      differentialCanonicalizationRepairVersion: repairVersion,
      repairedAt: now.toISOString(),
      descriptiveDifferentialsRemoved: [
        'Systemic Lupus Erythematosus with Myositis',
        'Hypothyroid Myopathy',
        'Drug-Induced Myopathy',
        'Endocrine or Toxic Myopathy',
      ],
      canonicalDifferentialCount: correctedDifferentials.length,
      playableCluesChanged: false,
      diagnosisRegistryChanged: false,
      dailyCaseSchedulingChanged: false,
      diagnosisEducationDifferentialsChanged: Boolean(education),
    },
  };

  const result = await prisma.$transaction(async (tx) => {
    const latestRevision = await tx.caseRevision.findFirst({
      where: { caseId: targetCase.id },
      orderBy: { revisionNumber: 'desc' },
      select: {
        revisionNumber: true,
        publishTrack: true,
      },
    });

    const revisionNumber = (latestRevision?.revisionNumber ?? 0) + 1;
    const publishTrack = latestRevision?.publishTrack ?? PublishTrack.DAILY;

    const caseRevision = await tx.caseRevision.create({
      data: {
        caseId: targetCase.id,
        revisionNumber,
        source: CaseSource.MANUAL,
        publishTrack,
        title: targetCase.title,
        date: targetCase.date,
        difficulty: targetCase.difficulty,
        history: targetCase.history,
        symptoms: targetCase.symptoms,
        clues: targetCase.clues as unknown as object,
        explanation: repairedExplanation as object,
        differentials: [...correctedDifferentials],
        diagnosisRegistryId: targetCase.diagnosisRegistryId,
        proposedDiagnosisText: targetCase.proposedDiagnosisText,
        diagnosisMappingStatus: targetCase.diagnosisMappingStatus,
        diagnosisMappingMethod: targetCase.diagnosisMappingMethod,
        diagnosisMappingConfidence: targetCase.diagnosisMappingConfidence,
        diagnosisEditorialNote:
          'Canonicalized the Dermatomyositis differential list. Removed descriptive/compositional labels and replaced them with registry-ready diagnosis entities. Playable clues, diagnosis mapping, case scheduling, and case identity were preserved.',
      },
      select: { id: true },
    });

    await tx.case.update({
      where: { id: targetCase.id },
      data: {
        explanation: repairedExplanation as object,
        differentials: [...correctedDifferentials],
        currentRevisionId: caseRevision.id,
        diagnosisEditorialNote:
          'Dermatomyositis differentials repaired to canonical diagnosis entities. No playable clue, scheduling, registry, public-number, or mapping changes were made.',
      },
    });

    let educationRevisionId: string | null = null;
    let educationVersion: number | null = null;

    if (education && !educationAlreadyCorrect) {
      const updatedEducation = await tx.diagnosisEducation.update({
        where: { id: education.id },
        data: {
          differentials: correctedEducationDifferentials,
          reviewedAt: now,
          version: { increment: 1 },
        },
        select: {
          id: true,
          version: true,
          editorialStatus: true,
          source: true,
        },
      });

      const educationRevision = await tx.diagnosisEducationRevision.create({
        data: {
          educationId: updatedEducation.id,
          version: updatedEducation.version,
          snapshot: {
            title: education.title,
            summary: education.summary,
            recognitionPattern: education.clinicalPattern,
            keySymptoms: education.keySymptoms,
            keySigns: education.keySigns,
            examPearls: education.examPearls,
            scoringSystems: education.scoringSystems,
            investigations: education.investigations,
            differentialDistinguishers: correctedEducationDifferentials,
            managementOverview: education.management,
            complications: education.complications,
            pitfalls: education.pitfalls,
            recallPrompts: education.recallPrompts,
            references: education.references,
            repairMetadata: {
              differentialCanonicalizationRepairVersion: repairVersion,
              repairedAt: now.toISOString(),
            },
            storedColumnMap: {
              recognitionPattern: 'clinicalPattern',
              managementOverview: 'management',
              differentialDistinguishers: 'differentials',
            },
          } as object,
          editorialStatus:
            updatedEducation.editorialStatus ??
            DiagnosisEducationStatus.PUBLISHED,
          source:
            updatedEducation.source ?? DiagnosisEducationSource.MANUAL,
        },
        select: { id: true },
      });

      educationRevisionId = educationRevision.id;
      educationVersion = updatedEducation.version;
    }

    await tx.caseValidationRun.create({
      data: {
        caseId: targetCase.id,
        revisionId: caseRevision.id,
        source: CaseSource.MANUAL,
        publishTrack,
        outcome: ValidationOutcome.PASSED,
        validatorVersion:
          'flagship-human-repair:dermatomyositis-canonical-differentials-v1',
        summary: {
          contentTier: 'FLAGSHIP',
          repairVersion,
          humanReviewed: true,
          targetCaseFound: true,
          canonicalDiagnosis: registry.displayLabel,
          canonicalDifferentials: correctedDifferentials,
          descriptiveOrCompositionalDifferentialsRemoved: true,
          differentialAnalysisEvidenceAnchorsVerified: true,
          playableCluesPreserved: true,
          clueOrderPreserved: clues.map((clue) => clue.order),
          clueTypesPreserved: clues.map((clue) => clue.type),
          caseDatePreserved: targetCase.date.toISOString(),
          publicNumberPreserved: targetCase.publicNumber,
          editorialStatusPreserved: targetCase.editorialStatus,
          scheduledDailyCaseLinksPreserved: targetCase.dailyCases.length,
          diagnosisRegistryChanged: false,
          diagnosisMappingChanged: false,
          diagnosisEducationDifferentialsUpdated:
            Boolean(education) && !educationAlreadyCorrect,
          diagnosisEducationCreated: false,
          note:
            'Replaced descriptive Dermatomyositis differential labels with canonical diagnosis entities in the case, explanation, differential analysis, and existing diagnosis education. No playable content or scheduling data changed.',
        },
        findings: [],
        completedAt: now,
      },
    });

    return {
      caseRevisionId: caseRevision.id,
      caseRevisionNumber: revisionNumber,
      publishTrack,
      educationRevisionId,
      educationVersion,
    };
  });

  const verifiedCase = await prisma.case.findUnique({
    where: { id: targetCase.id },
    select: {
      id: true,
      publicNumber: true,
      date: true,
      clues: true,
      differentials: true,
      explanation: true,
      currentRevisionId: true,
      dailyCases: { select: { id: true }, take: 100 },
    },
  });

  if (!verifiedCase) {
    throw new Error('Post-repair verification failed: case no longer exists.');
  }

  assertExpectedClues(verifiedCase.clues);

  const verifiedExplanation = asRecord(verifiedCase.explanation);
  if (
    !stringArrayEquals(verifiedCase.differentials, correctedDifferentials) ||
    !stringArrayEquals(
      verifiedExplanation.differentials,
      correctedDifferentials,
    )
  ) {
    throw new Error(
      'Post-repair verification failed: canonical differential list was not persisted.',
    );
  }

  const verifiedAnalysis = asRecordArray(
    verifiedExplanation.differentialAnalysis,
  );
  if (
    verifiedAnalysis.length !== correctedDifferentialAnalysis.length ||
    !verifiedAnalysis.every(
      (entry, index) =>
        entry.diagnosis === correctedDifferentialAnalysis[index].diagnosis,
    )
  ) {
    throw new Error(
      'Post-repair verification failed: differential analysis was not persisted.',
    );
  }

  if (
    verifiedCase.publicNumber !== targetCase.publicNumber ||
    verifiedCase.date.getTime() !== targetCase.date.getTime() ||
    verifiedCase.dailyCases.length !== targetCase.dailyCases.length
  ) {
    throw new Error(
      'Post-repair verification failed: protected case identity or scheduling fields changed.',
    );
  }

  if (education) {
    const verifiedEducation = await prisma.diagnosisEducation.findUnique({
      where: { id: education.id },
      select: { differentials: true, version: true },
    });

    if (
      !verifiedEducation ||
      !educationHasCorrectDifferentials(verifiedEducation.differentials)
    ) {
      throw new Error(
        'Post-repair verification failed: diagnosis-education differentials were not persisted.',
      );
    }
  }

  console.log('Repaired Dermatomyositis differentials:', {
    registryId: registry.id,
    caseId: targetCase.id,
    publicNumber: targetCase.publicNumber,
    previousRevisionId: targetCase.currentRevisionId,
    newRevisionId: result.caseRevisionId,
    newRevisionNumber: result.caseRevisionNumber,
    publishTrack: result.publishTrack,
    canonicalDifferentials: correctedDifferentials,
    educationId: education?.id ?? null,
    educationVersion: result.educationVersion,
    educationRevisionId: result.educationRevisionId,
    playableCluesChanged: false,
    dailyCaseLinksPreserved: targetCase.dailyCases.length,
  });
}

repairDermatomyositisDifferentials()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
