import 'dotenv/config';
import {
  PrismaClient,
  CaseEditorialStatus,
  CaseSource,
  DiagnosisMappingMethod,
  DiagnosisMappingStatus,
  PublishTrack,
  ValidationOutcome,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/**
 * REPAIR SEED — SLE Breakdown clue-order alignment.
 *
 * Repairs the existing Systemic Lupus Erythematosus case.
 * It does not create a diagnosis, alias, case, or DailyCase.
 *
 * Root cause:
 * - The original case stored explanation.reasoning as an array.
 * - Wardle's current explanation normalizer accepts reasoning as a string.
 * - Breakdown then paired clues with unordered keyFindings by index.
 *
 * Run:
 *   npx tsx prisma/seed/repair-systemic-lupus-erythematosus-breakdown.seed.ts
 *
 * Railway:
 *   railway run npx tsx prisma/seed/repair-systemic-lupus-erythematosus-breakdown.seed.ts
 */

const databaseUrl = resolvePgConnectionString(process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run the SLE repair seed.');
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const now = new Date();
const seedVersion =
  'repair-systemic-lupus-erythematosus-breakdown-alignment-v1';

const canonicalName = 'systemic lupus erythematosus';
const displayLabel = 'Systemic Lupus Erythematosus';
const caseTitle =
  'Photosensitive Rash, Polyarthritis and Proteinuric Kidney Injury';

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 24-year-old woman presents with eight weeks of worsening fatigue, intermittent fever, and pain with swelling in both wrists, metacarpophalangeal joints, and proximal interphalangeal joints. Morning stiffness lasts about ninety minutes, and symptoms have begun to interfere with writing and dressing.',
  },
  {
    order: 1,
    type: 'history',
    value:
      'She reports a recurrent red facial eruption after sun exposure, painless ulcers on the hard palate, increased hair shedding, and two episodes of sharp chest pain that were worse with deep inspiration. She has taken no hydralazine, procainamide, isoniazid, minocycline, or tumour-necrosis-factor inhibitor and has no recent sore throat, diarrhoeal illness, or known chronic infection.',
  },
  {
    order: 2,
    type: 'exam',
    value:
      'Temperature is 38.1°C and blood pressure is 148/92 mmHg. Examination shows non-scarring alopecia, a fixed erythematous eruption over both cheeks and the nasal bridge that spares the nasolabial folds, a shallow painless palatal ulcer, and symmetric tenderness with swelling of the wrists and several MCP and PIP joints. There is mild bilateral ankle oedema but no muscle weakness, sclerodactyly, digital ulceration, or parotid enlargement.',
  },
  {
    order: 3,
    type: 'lab',
    value:
      'Haemoglobin is 9.8 g/dL, white-cell count 2.6 × 10^9/L with lymphocytes 0.7 × 10^9/L, and platelets 112 × 10^9/L. ESR is 78 mm/hour while CRP is 9 mg/L. Creatinine is 132 µmol/L and albumin 27 g/L. Urinalysis shows 3+ protein and 2+ blood; microscopy demonstrates dysmorphic erythrocytes and red-cell casts, and the urine protein-to-creatinine ratio is 2.4 g/g.',
  },
  {
    order: 4,
    type: 'lab',
    value:
      'Antinuclear antibody is positive at 1:1280. Anti-double-stranded DNA antibodies are markedly elevated and anti-Smith antibodies are positive; C3 and C4 are both low. Direct antiglobulin testing is positive without biochemical haemolysis. ANCA, hepatitis B, hepatitis C, and HIV testing are negative, and repeated blood and urine cultures show no growth.',
  },
  {
    order: 5,
    type: 'lab',
    value:
      'Kidney biopsy demonstrates diffuse endocapillary and extracapillary proliferative glomerulonephritis involving more than half of sampled glomeruli, with wire-loop deposits and a full-house immunofluorescence pattern, consistent with active ISN/RPS class IV lupus nephritis. With ANA as the entry criterion, acute cutaneous disease, inflammatory joint involvement, thrombocytopenia, class IV nephritis, low C3 and C4, and SLE-specific antibodies produce a strongly supportive 2019 EULAR/ACR classification pattern after exclusion of infection and competing autoimmune disease.',
  },
] as const;

const differentials = [
  'Rheumatoid Arthritis',
  'Viral Arthritis',
  'Drug-induced Lupus',
  'Mixed Connective Tissue Disease',
  'ANCA-associated Vasculitis',
  'Primary Sjögren Syndrome',
];

const breakdownByClue = [
  {
    clueOrder: 0,
    evidence:
      'eight weeks of worsening fatigue, intermittent fever, and pain with swelling in both wrists, metacarpophalangeal joints, and proximal interphalangeal joints',
    finding:
      'Eight weeks of fever, fatigue, and symmetric inflammatory small-joint polyarthritis',
    meaning:
      'This is a systemic inflammatory presentation. Rheumatoid arthritis, viral arthritis, and connective-tissue disease remain plausible, but the prolonged symmetric synovitis makes a mechanical disorder unlikely.',
  },
  {
    clueOrder: 1,
    evidence:
      'a recurrent red facial eruption after sun exposure, painless ulcers on the hard palate, increased hair shedding, and two episodes of sharp chest pain that were worse with deep inspiration',
    finding:
      'Photosensitive facial eruption, painless palatal ulcers, alopecia, and pleuritic chest pain',
    meaning:
      'Mucocutaneous disease with possible serositis shifts probability toward a systemic autoimmune disorder. The absence of a culprit medication weakens classic drug-induced lupus.',
  },
  {
    clueOrder: 2,
    evidence:
      'a fixed erythematous eruption over both cheeks and the nasal bridge that spares the nasolabial folds, a shallow painless palatal ulcer, and symmetric tenderness with swelling',
    finding:
      'Malar-pattern eruption, painless palatal ulcer, objective synovitis, hypertension, and ankle oedema',
    meaning:
      'The examination confirms acute cutaneous and musculoskeletal involvement rather than symptoms alone. Hypertension and oedema introduce concern for renal involvement.',
  },
  {
    clueOrder: 3,
    evidence:
      'white-cell count 2.6 × 10^9/L with lymphocytes 0.7 × 10^9/L, and platelets 112 × 10^9/L',
    finding:
      'Leukopenia, lymphopenia, thrombocytopenia, proteinuria, and an active glomerular urine sediment',
    meaning:
      'Cytopenias plus proteinuria, dysmorphic erythrocytes, and red-cell casts establish multisystem disease with active glomerulonephritis. Isolated rheumatoid or viral arthritis no longer explains the case.',
  },
  {
    clueOrder: 4,
    evidence:
      'Antinuclear antibody is positive at 1:1280. Anti-double-stranded DNA antibodies are markedly elevated and anti-Smith antibodies are positive; C3 and C4 are both low',
    finding:
      'High-titre ANA, anti-double-stranded DNA and anti-Smith antibodies with low C3 and C4',
    meaning:
      'SLE-specific antibodies with complement consumption strongly support active systemic lupus. Negative ANCA, viral testing, and cultures reduce important vasculitic and infectious alternatives.',
  },
  {
    clueOrder: 5,
    evidence:
      'diffuse endocapillary and extracapillary proliferative glomerulonephritis involving more than half of sampled glomeruli, with wire-loop deposits and a full-house immunofluorescence pattern',
    finding:
      'Diffuse proliferative full-house glomerulonephritis consistent with class IV lupus nephritis',
    meaning:
      'The kidney biopsy provides the diagnostic lock-in: immune-complex class IV lupus nephritis unifies the inflammatory, mucocutaneous, haematological, serological, and renal findings.',
  },
] as const;

const correctedKeyFindings = breakdownByClue.map((entry) => entry.finding);
const correctedReasoning = breakdownByClue
  .map((entry) => entry.meaning)
  .join('\n');

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

function assertRepairShape() {
  const supportedClueTypes = new Set([
    'history',
    'symptom',
    'vital',
    'exam',
    'lab',
    'imaging',
  ]);

  if (clues.length !== 6 || breakdownByClue.length !== clues.length) {
    throw new Error(
      'The repair requires exactly six clues and six breakdown entries.',
    );
  }

  clues.forEach((clue, index) => {
    if (clue.order !== index) {
      throw new Error(
        `Clue order must be contiguous 0-5. Expected ${index}; received ${clue.order}.`,
      );
    }

    if (!supportedClueTypes.has(clue.type)) {
      throw new Error(`Unsupported clue type: ${clue.type}.`);
    }

    const breakdown = breakdownByClue[index];

    if (breakdown.clueOrder !== index) {
      throw new Error(
        `Breakdown order must be contiguous 0-5. Expected ${index}; received ${breakdown.clueOrder}.`,
      );
    }

    if (
      !normalizeClinicalText(clue.value).includes(
        normalizeClinicalText(breakdown.evidence),
      )
    ) {
      throw new Error(
        `Breakdown evidence does not occur in clue ${index}: ${breakdown.evidence}.`,
      );
    }
  });

  if (correctedReasoning.split('\n').length !== clues.length) {
    throw new Error('Reasoning must contain one line per clue.');
  }

  if (correctedKeyFindings.length !== clues.length) {
    throw new Error('keyFindings must contain one item per clue.');
  }
}

function validateDifferentialAnalysis(
  value: unknown,
): DifferentialAnalysisEntry[] {
  if (!Array.isArray(value)) {
    throw new Error(
      'The existing SLE explanation has no differentialAnalysis array.',
    );
  }

  const entries = value as DifferentialAnalysisEntry[];

  entries.forEach((entry) => {
    if (!differentials.includes(entry.diagnosis)) {
      throw new Error(
        `Unexpected differential analysis diagnosis: ${entry.diagnosis}.`,
      );
    }

    entry.ruledOutByClues.forEach((ruleOut) => {
      if (
        !Number.isInteger(ruleOut.clueOrder) ||
        ruleOut.clueOrder < 0 ||
        ruleOut.clueOrder >= clues.length
      ) {
        throw new Error(
          `Differential ${entry.diagnosis} has invalid clueOrder ${ruleOut.clueOrder}.`,
        );
      }

      if (
        !normalizeClinicalText(clues[ruleOut.clueOrder].value).includes(
          normalizeClinicalText(ruleOut.evidence),
        )
      ) {
        throw new Error(
          `Differential ${entry.diagnosis} evidence is not present in clue ${ruleOut.clueOrder}: ${ruleOut.evidence}.`,
        );
      }
    });
  });

  return entries;
}

async function findRegistry() {
  const canonicalNormalized = normalizeClinicalText(canonicalName);

  const registry = await prisma.diagnosisRegistry.findFirst({
    where: {
      OR: [
        { canonicalNormalized },
        { canonicalName },
        { displayLabel },
        {
          aliases: {
            some: {
              normalizedTerm: canonicalNormalized,
              active: true,
            },
          },
        },
      ],
    },
    select: { id: true, displayLabel: true },
  });

  if (!registry) {
    throw new Error(
      'Could not find the existing Systemic Lupus Erythematosus registry. This repair intentionally does not create one.',
    );
  }

  return registry;
}

async function repairCases(diagnosisRegistryId: string) {
  const targets = await prisma.case.findMany({
    where: {
      diagnosisRegistryId,
      OR: [{ title: caseTitle }, { proposedDiagnosisText: displayLabel }],
    },
    orderBy: [{ approvedAt: 'desc' }, { id: 'asc' }],
    select: {
      id: true,
      title: true,
      date: true,
      publicNumber: true,
      currentRevisionId: true,
      explanation: true,
      dailyCases: {
        select: { id: true, date: true },
        take: 10,
      },
    },
  });

  if (targets.length === 0) {
    throw new Error(
      'No existing SLE case was found to repair. Run the flagship SLE seed first.',
    );
  }

  for (const target of targets) {
    if (!isRecord(target.explanation)) {
      throw new Error(
        `Case ${target.id} has no structured explanation to repair.`,
      );
    }

    const differentialAnalysis = validateDifferentialAnalysis(
      target.explanation.differentialAnalysis,
    );

    const repairedExplanation = {
      ...target.explanation,
      diagnosis: displayLabel,
      reasoning: correctedReasoning,
      keyFindings: correctedKeyFindings,
      differentials,
      differentialAnalysis,
      breakdownAlignment: {
        version: seedVersion,
        indexing: 'zero-based clue order 0-5',
        displayedNumbering: 'clue order + 1',
        reasoningFormat: 'newline-delimited string',
        oneReasoningStepPerClue: true,
        oneKeyFindingPerClue: true,
        repairedAt: now.toISOString(),
      },
    };

    const history = clues[0].value;
    const symptoms = [clues[0].value, clues[1].value, clues[2].value];

    await prisma.case.update({
      where: { id: target.id },
      data: {
        title: caseTitle,
        difficulty: 'intermediate',
        history,
        symptoms,
        clues: clues as unknown as object,
        explanation: repairedExplanation as unknown as object,
        differentials,
        editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
        approvedAt: now,
        diagnosisRegistryId,
        proposedDiagnosisText: displayLabel,
        diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
        diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
        diagnosisMappingConfidence: 1,
        diagnosisEditorialNote:
          'Repaired SLE Breakdown mapping: reasoning is a newline-delimited string and keyFindings are stored one-per-clue in clue order.',
      },
    });

    const latestRevision = await prisma.caseRevision.findFirst({
      where: { caseId: target.id },
      orderBy: { revisionNumber: 'desc' },
      select: { revisionNumber: true },
    });

    const revision = await prisma.caseRevision.create({
      data: {
        caseId: target.id,
        revisionNumber: (latestRevision?.revisionNumber ?? 0) + 1,
        source: CaseSource.MANUAL,
        publishTrack: PublishTrack.DAILY,
        title: caseTitle,
        date: target.date,
        difficulty: 'intermediate',
        history,
        symptoms,
        clues: clues as unknown as object,
        explanation: repairedExplanation as unknown as object,
        differentials,
        diagnosisRegistryId,
        proposedDiagnosisText: displayLabel,
        diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
        diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
        diagnosisMappingConfidence: 1,
        diagnosisEditorialNote:
          'Repair revision: corrected SLE Breakdown clue-to-meaning alignment without changing the canonical diagnosis or DailyCase relationship.',
      },
      select: { id: true },
    });

    await prisma.case.update({
      where: { id: target.id },
      data: { currentRevisionId: revision.id },
    });

    await prisma.caseValidationRun.create({
      data: {
        caseId: target.id,
        revisionId: revision.id,
        source: CaseSource.MANUAL,
        publishTrack: PublishTrack.DAILY,
        outcome: ValidationOutcome.PASSED,
        validatorVersion: 'human-repair:sle-breakdown-alignment-v1',
        summary: {
          contentTier: 'FLAGSHIP',
          seedVersion,
          humanReviewed: true,
          clueProgressionVerified: true,
          breakdownClueReferencesValidated: true,
          reasoningStoredAsString: true,
          oneReasoningStepPerClue: true,
          oneKeyFindingPerClue: true,
          clueOrderMap: clues.map((clue) => ({
            order: clue.order,
            displayedClueNumber: clue.order + 1,
            type: clue.type,
            finding: breakdownByClue[clue.order].finding,
            meaning: breakdownByClue[clue.order].meaning,
          })),
          note:
            'Repair corrects the SLE Breakdown mismatch caused by array-form reasoning and unordered keyFindings. Differential references remain zero-based and map to the exact stored clue.',
        },
        findings: [],
        completedAt: now,
      },
    });

    console.log('Repaired SLE Breakdown alignment:', {
      registryId: diagnosisRegistryId,
      caseId: target.id,
      revisionId: revision.id,
      publicNumber: target.publicNumber,
      previousCurrentRevisionId: target.currentRevisionId,
      currentRevisionId: revision.id,
      dailyCasesPreserved: target.dailyCases,
      reasoningStepCount: correctedReasoning.split('\n').length,
      keyFindingCount: correctedKeyFindings.length,
      clueOrderMap: clues.map((clue) => ({
        order: clue.order,
        displayedClueNumber: clue.order + 1,
        type: clue.type,
      })),
    });
  }
}

async function main() {
  assertRepairShape();

  const registry = await findRegistry();
  await repairCases(registry.id);
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
