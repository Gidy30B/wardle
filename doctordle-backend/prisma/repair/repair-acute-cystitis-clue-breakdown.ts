import 'dotenv/config';
import {
  PrismaClient,
  CaseSource,
  PublishTrack,
  ValidationOutcome,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/**
 * REPAIR - Acute Cystitis clue breakdown
 *
 * Why this repair is required:
 * - The seeded explanation stored `reasoning` as string[].
 * - Wardle's current explanation normalizer accepts `reasoning` only as a string.
 * - The Learn breakdown therefore discarded the reasoning array and fell back to
 *   unrelated `keyFindings`, producing incorrect clue-to-meaning pairings.
 *
 * Repairs:
 * 1. Finds the already-seeded Acute Cystitis case; it does not create a new case.
 * 2. Leaves the six playable clues, case date, public number, diagnosis mapping,
 *    education, and DailyCase scheduling unchanged.
 * 3. Replaces explanation.reasoning with six newline-separated, clue-aligned steps.
 * 4. Replaces explanation.clueBreakdown with six exact clue-linked entries.
 * 5. Replaces keyFindings with concise diagnostic evidence rather than demographics.
 * 6. Removes incorrect reliance on absent white-cell casts for lower-tract localisation.
 * 7. Creates a new CaseRevision and points currentRevisionId to it.
 * 8. Records a PASSED validation run documenting the repair.
 *
 * Run:
 *   npx tsx prisma/repair/repair-acute-cystitis-clue-breakdown.ts
 *
 * Railway:
 *   railway run npx tsx prisma/repair/repair-acute-cystitis-clue-breakdown.ts
 */

const databaseUrl = resolvePgConnectionString(process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required to run the Acute Cystitis clue-breakdown repair.',
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

type StoredClue = {
  order: number;
  type: string;
  value: string;
};

type ClueBreakdownEntry = {
  clueOrder: number;
  clueType: string;
  clue: string;
  explanation: string;
  diagnosticContribution: string;
};

const now = new Date();
const repairVersion = 'repair-acute-cystitis-clue-breakdown-v1';
const canonicalTerms = [
  'acute cystitis',
  'cystitis',
  'acute bacterial cystitis',
  'bladder infection',
];
const caseTitle = 'Painful Frequent Urination and Lower Abdominal Discomfort';

const expectedClues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 27-year-old woman presents with a 36-hour history of passing urine much more frequently than usual, sudden urgency, and repeated passage of only small volumes. She had been well before the symptoms began and has no known urinary tract abnormality, diabetes, immunosuppression, or recent urinary catheterisation.',
  },
  {
    order: 1,
    type: 'symptom',
    value:
      'She describes a burning pain that is most intense near the end of urination, together with a constant dull discomfort just above the pubic bone. She noticed a faint pink colour in the urine once. She has no vaginal discharge, vulval itching, genital ulceration, dyspareunia, or abnormal vaginal bleeding.',
  },
  {
    order: 2,
    type: 'vital',
    value:
      'Temperature is 36.8°C, blood pressure 112/70 mmHg, pulse 82/min, respiratory rate 16/min, and oxygen saturation 99% on room air. She is alert, well perfused, and not systemically unwell. She reports no fever, rigors, vomiting, or flank pain.',
  },
  {
    order: 3,
    type: 'exam',
    value:
      'Abdominal examination shows mild midline suprapubic tenderness without guarding or rebound. There is no costovertebral-angle tenderness on either side. External genital inspection is normal, and there is no lower abdominal mass or focal peritonism.',
  },
  {
    order: 4,
    type: 'lab',
    value:
      'A clean-catch urine dipstick is positive for leukocyte esterase, nitrites, and blood. Urine microscopy shows numerous white blood cells and bacteria, with only occasional squamous epithelial cells and no white-cell casts. A urine pregnancy test is negative.',
  },
  {
    order: 5,
    type: 'lab',
    value:
      'Midstream urine culture grows a single isolate of Escherichia coli at a significant count with an antimicrobial susceptibility profile suitable for oral treatment. The acute bladder-localising symptoms, pyuria, bacteriuria, and absence of systemic or upper-tract findings establish a localised bacterial lower urinary infection.',
  },
] as const;

const reasoningSteps = [
  'Acute urinary frequency, urgency, and repeated small-volume voiding indicate irritation of the lower urinary tract. At this stage, the pattern suggests a bladder or urethral process but does not yet establish a bacterial cause.',
  'Burning during urination with suprapubic discomfort strengthens lower-tract localisation. The absence of vaginal discharge, vulval itching, genital lesions, dyspareunia, and abnormal bleeding makes vulvovaginitis and other genital-tract mimics less likely; terminal dysuria is supportive but is not diagnostic by itself.',
  'Normal temperature and stable observations, together with the absence of rigors, vomiting, flank pain, or systemic illness, make systemic urinary infection and acute pyelonephritis less likely while remaining compatible with bladder-limited infection.',
  'Mild suprapubic tenderness supports bladder inflammation. The absence of costovertebral-angle tenderness further reduces the likelihood of upper-tract involvement, although no single examination finding excludes pyelonephritis on its own.',
  'Leukocyte esterase and numerous urinary white cells demonstrate pyuria, while nitrites and bacteriuria support infection by a nitrate-reducing uropathogen. Urine blood can accompany inflamed bladder mucosa, few squamous cells support acceptable specimen quality, and the negative pregnancy test informs management. Absence of white-cell casts is not used to prove lower-tract localisation.',
  'Significant growth of a single Escherichia coli isolate links the acute lower urinary symptoms and inflammatory urinalysis to a recognised bacterial uropathogen. The organism identifies the cause and guides treatment; the canonical diagnosis remains Acute Cystitis.',
] as const;

const correctedKeyFindings = [
  'Abrupt dysuria with urinary frequency and urgency',
  'Repeated small-volume voiding and suprapubic discomfort',
  'No vaginal discharge, vulval itching, genital lesions, or dyspareunia',
  'Afebrile and haemodynamically stable without rigors, vomiting, or flank pain',
  'Suprapubic tenderness without costovertebral-angle tenderness',
  'Positive leukocyte esterase and nitrites with pyuria and bacteriuria',
  'Single significant Escherichia coli urine isolate',
];

function buildClueBreakdown(clues: StoredClue[]): ClueBreakdownEntry[] {
  return clues.map((clue, index) => ({
    clueOrder: clue.order,
    clueType: clue.type,
    clue: clue.value,
    explanation: reasoningSteps[index],
    diagnosticContribution: [
      'Introduces an acute lower urinary tract syndrome while keeping infectious, urethral, and non-infectious causes open.',
      'Strengthens bladder localisation and reduces common genital-tract mimics without claiming that one symptom is pathognomonic.',
      'Supports a localised rather than systemic or upper-tract urinary presentation.',
      'Adds examination support for bladder involvement and reduces the likelihood of renal parenchymal disease.',
      'Provides objective evidence of bacterial urinary inflammation and moves the diagnosis from symptom pattern to supported infection.',
      'Confirms the bacterial aetiology and completes the case as Acute Cystitis.',
    ][index],
  }));
}

function assertExpectedClues(value: unknown): StoredClue[] {
  if (!Array.isArray(value)) {
    throw new Error('Target case does not contain a clues array.');
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

    if (clue.order !== expected.order) {
      throw new Error(
        `Clue ${index} order changed: expected ${expected.order}, found ${clue.order}. Repair aborted.`,
      );
    }

    if (clue.type !== expected.type) {
      throw new Error(
        `Clue ${index} type changed: expected ${expected.type}, found ${clue.type}. Repair aborted.`,
      );
    }

    if (clue.value !== expected.value) {
      throw new Error(
        `Clue ${index} text no longer matches the validated Acute Cystitis seed. Repair aborted to avoid patching the wrong revision.`,
      );
    }
  });

  return clues;
}

function assertRepairShape(
  clues: StoredClue[],
  clueBreakdown: ClueBreakdownEntry[],
) {
  if (reasoningSteps.length !== clues.length) {
    throw new Error(
      `Reasoning must contain one step per clue: ${reasoningSteps.length} steps for ${clues.length} clues.`,
    );
  }

  if (clueBreakdown.length !== clues.length) {
    throw new Error(
      `Clue breakdown must contain one entry per clue: ${clueBreakdown.length} entries for ${clues.length} clues.`,
    );
  }

  clueBreakdown.forEach((entry, index) => {
    const clue = clues[index];

    if (
      entry.clueOrder !== clue.order ||
      entry.clueType !== clue.type ||
      entry.clue !== clue.value
    ) {
      throw new Error(`Clue-breakdown alignment failed at clue ${index}.`);
    }

    if (!entry.explanation.trim() || !entry.diagnosticContribution.trim()) {
      throw new Error(`Clue-breakdown entry ${index} is incomplete.`);
    }
  });

  const reasoningText = reasoningSteps.join('\n\n');
  if (!reasoningText.trim() || Array.isArray(reasoningText)) {
    throw new Error(
      'Repaired reasoning must be stored as one non-empty string.',
    );
  }

  if (
    normalizeClinicalText(reasoningText).includes(
      normalizeClinicalText('absence of white-cell casts further favours'),
    )
  ) {
    throw new Error('Repair still relies on absent white-cell casts.');
  }
}

async function findRegistry() {
  const normalizedTerms = canonicalTerms.map(normalizeClinicalText);
  const canonicalNormalized = normalizeClinicalText('acute cystitis');

  const exactRegistry = await prisma.diagnosisRegistry.findUnique({
    where: { canonicalNormalized },
    select: {
      id: true,
      canonicalName: true,
      displayLabel: true,
    },
  });

  const relatedRegistry = exactRegistry
    ? null
    : await prisma.diagnosisRegistry.findFirst({
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
        select: {
          id: true,
          canonicalName: true,
          displayLabel: true,
        },
      });

  const registry = exactRegistry ?? relatedRegistry;

  if (!registry) {
    throw new Error(
      'Cannot repair Acute Cystitis: no matching diagnosis registry was found.',
    );
  }

  return registry;
}

async function findTargetCase(diagnosisRegistryId: string) {
  const targetCase = await prisma.case.findFirst({
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
      currentRevisionId: true,
      diagnosisRegistryId: true,
      proposedDiagnosisText: true,
      diagnosisMappingStatus: true,
      diagnosisMappingMethod: true,
      diagnosisMappingConfidence: true,
      dailyCases: { select: { id: true }, take: 20 },
    },
  });

  if (!targetCase) {
    throw new Error(
      `Cannot repair Acute Cystitis: case "${caseTitle}" was not found for registry ${diagnosisRegistryId}.`,
    );
  }

  return targetCase;
}

async function repairClueBreakdown() {
  const registry = await findRegistry();
  const targetCase = await findTargetCase(registry.id);
  const clues = assertExpectedClues(targetCase.clues);
  const clueBreakdown = buildClueBreakdown(clues);
  assertRepairShape(clues, clueBreakdown);

  const existingExplanation = asRecord(targetCase.explanation);
  const existingRepairMetadata = asRecord(existingExplanation.repairMetadata);

  if (existingRepairMetadata.clueBreakdownRepairVersion === repairVersion) {
    console.log('Acute Cystitis clue-breakdown repair already applied.', {
      caseId: targetCase.id,
      publicNumber: targetCase.publicNumber,
      currentRevisionId: targetCase.currentRevisionId,
      repairVersion,
    });
    return;
  }

  const repairedExplanation = {
    ...existingExplanation,
    reasoning: reasoningSteps.join('\n\n'),
    clueBreakdown,
    keyFindings: correctedKeyFindings,
    repairMetadata: {
      ...existingRepairMetadata,
      clueBreakdownRepairVersion: repairVersion,
      repairedAt: now.toISOString(),
      reasoningStoredAsString: true,
      reasoningStepCount: reasoningSteps.length,
      clueBreakdownEntryCount: clueBreakdown.length,
      playableCluesChanged: false,
      diagnosisEducationChanged: false,
      dailyCaseSchedulingChanged: false,
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

    const revision = await tx.caseRevision.create({
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
        differentials: targetCase.differentials,
        diagnosisRegistryId: targetCase.diagnosisRegistryId,
        proposedDiagnosisText: targetCase.proposedDiagnosisText,
        diagnosisMappingStatus: targetCase.diagnosisMappingStatus,
        diagnosisMappingMethod: targetCase.diagnosisMappingMethod,
        diagnosisMappingConfidence: targetCase.diagnosisMappingConfidence,
        diagnosisEditorialNote:
          'Repaired the Acute Cystitis diagnostic breakdown without changing the playable case. Converted explanation.reasoning from an unsupported array to a newline-separated string consumed by the learner frontend, aligned one reasoning step to each clue, replaced demographic-heavy key findings with diagnostic evidence, and removed incorrect reliance on absent white-cell casts.',
      },
      select: { id: true },
    });

    await tx.case.update({
      where: { id: targetCase.id },
      data: {
        explanation: repairedExplanation as object,
        currentRevisionId: revision.id,
        diagnosisEditorialNote:
          'Acute Cystitis clue breakdown repaired. Playable clues, diagnosis education, case date, public number, and DailyCase scheduling were preserved.',
      },
    });

    await tx.caseValidationRun.create({
      data: {
        caseId: targetCase.id,
        revisionId: revision.id,
        source: CaseSource.MANUAL,
        publishTrack,
        outcome: ValidationOutcome.PASSED,
        validatorVersion:
          'flagship-human-repair:acute-cystitis-clue-breakdown-v1',
        summary: {
          contentTier: 'FLAGSHIP',
          repairVersion,
          humanReviewed: true,
          targetCaseFound: true,
          playableCluesPreserved: true,
          clueOrderPreserved: clues.map((clue) => clue.order),
          clueTypesPreserved: clues.map((clue) => clue.type),
          reasoningStoredAsString: true,
          reasoningStepCount: reasoningSteps.length,
          clueBreakdownEntryCount: clueBreakdown.length,
          clueBreakdownExactTextAlignmentVerified: true,
          clueProgressionVerified: true,
          keyFindingsRepaired: true,
          absentWhiteCellCastOverclaimRemoved: true,
          diagnosisEducationChanged: false,
          caseDatePreserved: targetCase.date.toISOString(),
          publicNumberPreserved: targetCase.publicNumber,
          scheduledDailyCaseLinksPreserved: targetCase.dailyCases.length,
          note: 'The original seed passed its own clueBreakdown equality checks but stored explanation.reasoning as an array. Wardle normalizes reasoning only when it is a string, so the learner breakdown fell back to unrelated keyFindings. This repair stores six clue-aligned reasoning paragraphs as a string and preserves a structured six-entry clueBreakdown for editorial use.',
        },
        findings: [],
        completedAt: now,
      },
    });

    return {
      revisionId: revision.id,
      revisionNumber,
      publishTrack,
    };
  });

  console.log('Repaired Acute Cystitis clue breakdown:', {
    registryId: registry.id,
    caseId: targetCase.id,
    publicNumber: targetCase.publicNumber,
    previousRevisionId: targetCase.currentRevisionId,
    newRevisionId: result.revisionId,
    newRevisionNumber: result.revisionNumber,
    publishTrack: result.publishTrack,
    reasoningStoredAs: 'string',
    reasoningStepCount: reasoningSteps.length,
    clueBreakdownEntryCount: clueBreakdown.length,
    dailyCaseLinksPreserved: targetCase.dailyCases.length,
  });
}

repairClueBreakdown()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
