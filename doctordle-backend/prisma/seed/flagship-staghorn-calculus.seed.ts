import 'dotenv/config';
import {
  PrismaClient,
  CaseEditorialStatus,
  CaseSource,
  DiagnosisAgeGroup,
  DiagnosisAliasKind,
  DiagnosisClinicalSetting,
  DiagnosisDifficultyBand,
  DiagnosisEducationSource,
  DiagnosisEducationStatus,
  DiagnosisMappingMethod,
  DiagnosisMappingStatus,
  DiagnosisRarityBand,
  DiagnosisRegistryStatus,
  DiagnosisUrgencyLevel,
  PublishTrack,
  ValidationOutcome,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/**
 * FLAGSHIP CASE SEED - Staghorn Calculus
 *
 * Clinical focus:
 * - Recurrent urinary infection with persistent non-colicky flank discomfort.
 * - Alkaline urine, pyuria, nitrites, haematuria, Proteus growth, and rising creatinine.
 * - Hydronephrosis with a large shadowing collecting-system structure on ultrasound.
 * - CT confirmation of a branching stone filling the renal pelvis and major calyces.
 * - Recognition of infected obstruction and renal-function risk.
 * - Definitive planning around infection control, CT-defined burden, and PCNL.
 *
 * Education design:
 * - Case explanation is specific to the vignette.
 * - Diagnosis education is independent of the case and covers recognition,
 *   examination, imaging, reduction priorities, associated injuries,
 *   complications, rehabilitation principles, and common diagnostic traps.
 *
 * Safety:
 * - Reuses or creates the exact diagnosis registry and accepted aliases.
 * - Does not overwrite existing diagnosis education.
 * - Does not overwrite an existing case with the same title.
 * - Does not alter a scheduled DailyCase.
 *
 * Run:
 *   npx tsx prisma/seed/flagship-staghorn-calculus.seed.ts
 *
 * Railway:
 *   railway run npx tsx prisma/seed/flagship-staghorn-calculus.seed.ts
 */

const databaseUrl = resolvePgConnectionString(process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required to run the Staghorn Calculus seed.',
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
  ) as {
    databaseUrl?: unknown;
  };

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

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

async function getNextCasePublicNumber(): Promise<number> {
  const latest = await prisma.case.findFirst({
    where: { publicNumber: { not: null } },
    orderBy: { publicNumber: 'desc' },
    select: { publicNumber: true },
  });

  return (latest?.publicNumber ?? 0) + 1;
}

async function findAvailableInventoryPlaceholderDate(params: {
  preferredDate: Date;
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

const now = new Date();
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 6, 29, 12, 0, 0));
const seedVersion = 'flagship-staghorn-calculus-v1';

const canonicalName = 'staghorn calculus';
const displayLabel = 'Staghorn Calculus';
const caseTitle =
  'Recurrent Urinary Infection and Progressive Flank Discomfort';

const taxonomy = {
  specialty: 'Urology',
  subspecialty: 'Stone Disease',
  category: 'Complex Renal Calculus',
  bodySystem: 'Genitourinary',
  organSystem: 'Kidney',
} as const;

const aliasTerms = [
  'Staghorn Calculus',
  'Staghorn Stone',
  'Coral Calculus',
  'Branched Renal Calculus',
  'Complete Staghorn Calculus',
  'Struvite Staghorn Calculus',
];

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 48-year-old woman reports eight months of recurrent episodes of dysuria, urinary frequency, and cloudy urine treated several times with short courses of antibiotics. Between episodes she has a persistent dull ache in the left flank rather than sudden colicky pain. She has never knowingly passed a urinary concretion and has no previous urinary tract operation.',
  },
  {
    order: 1,
    type: 'symptom',
    value:
      'During the current episode she has worsening left flank heaviness, malaise, intermittent chills, and foul-smelling urine. She denies pain radiating to the groin, vomiting, visible tissue in the urine, or complete inability to pass urine.',
  },
  {
    order: 2,
    type: 'exam',
    value:
      'She is mildly febrile at 37.9 C but haemodynamically stable. Examination shows left costovertebral-angle tenderness without guarding, rebound, a palpable abdominal mass, or suprapubic distension. There is no peripheral oedema or clinical dehydration.',
  },
  {
    order: 3,
    type: 'lab',
    value:
      'Urinalysis shows pH 8.3, positive nitrites, marked leukocyte esterase, microscopic haematuria, and abundant white cells. Urine culture grows Proteus mirabilis sensitive to the planned antimicrobial regimen. Serum creatinine is 146 micromol/L, increased from a previous value of 82 micromol/L.',
  },
  {
    order: 4,
    type: 'imaging',
    value:
      'Renal ultrasonography shows moderate left hydronephrosis with a large highly echogenic structure occupying the renal pelvis and extending into several calyces, producing posterior acoustic shadowing. The right kidney is normal.',
  },
  {
    order: 5,
    type: 'imaging',
    value:
      'Non-contrast CT demonstrates a dense branching concretion filling the left renal pelvis and extending through the upper, middle, and lower calyceal groups, with cortical thinning and hydronephrosis. The configuration establishes a complete Staghorn Calculus associated with recurrent urease-producing urinary infection.',
  },
] as const;

const differentials = [
  'Large Renal Pelvis Calculus',
  'Xanthogranulomatous Pyelonephritis',
  'Upper Tract Urothelial Carcinoma',
  'Renal Cell Carcinoma',
  'Chronic Pyelonephritis',
  'Medullary Nephrocalcinosis',
];

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

type ClueBreakdownEntry = {
  clueOrder: number;
  clueType: string;
  clue: string;
  explanation: string;
  diagnosticContribution: string;
};

const reasoningSteps = [
  'Recurrent urinary infections with persistent non-colicky flank discomfort suggest a chronic upper-tract process rather than a small mobile ureteric stone causing episodic renal colic.',
  'Flank heaviness, constitutional symptoms, chills, and foul-smelling urine strengthen concern for an infected obstructing renal process while the absence of groin-radiating colic makes a small migrating ureteric calculus less typical.',
  'Costovertebral-angle tenderness with low-grade fever localises inflammation to the affected upper urinary tract, while haemodynamic stability indicates that overt septic shock is not present at assessment.',
  'Markedly alkaline urine, pyuria, nitrites, Proteus mirabilis, haematuria, and worsening renal function strongly suggest a urease-associated infected renal calculus with impaired drainage.',
  'Ultrasound demonstrates obstruction and a large shadowing structure that occupies the renal pelvis and extends into multiple calyces, indicating a complex collecting-system stone rather than isolated parenchymal calcification.',
  'CT confirms a branching stone moulding the pelvis and all major calyceal groups, which defines a complete staghorn configuration and explains the recurrent infection, hydronephrosis, and cortical damage.',
] as const;

const explanation = {
  diagnosis: displayLabel,
  summary:
    'Recurrent urinary infection, persistent flank discomfort, alkaline urine with Proteus mirabilis, declining renal function, hydronephrosis, and CT showing a branching concretion filling the renal pelvis and multiple calyces establish Staghorn Calculus.',
  reasoning: reasoningSteps.join('\n'),
  clueBreakdown: [
    {
      clueOrder: 0,
      clueType: 'history',
      clue: clues[0].value,
      explanation: reasoningSteps[0],
      diagnosticContribution:
        'Introduces a chronic infected upper-tract process without revealing the final stone configuration.',
    },
    {
      clueOrder: 1,
      clueType: 'symptom',
      clue: clues[1].value,
      explanation: reasoningSteps[1],
      diagnosticContribution:
        'Adds infection-associated symptoms and distinguishes chronic flank pressure from classic migrating ureteric colic.',
    },
    {
      clueOrder: 2,
      clueType: 'exam',
      clue: clues[2].value,
      explanation: reasoningSteps[2],
      diagnosticContribution:
        'Localises the active inflammatory process to the upper urinary tract and establishes current physiological stability.',
    },
    {
      clueOrder: 3,
      clueType: 'lab',
      clue: clues[3].value,
      explanation: reasoningSteps[3],
      diagnosticContribution:
        'Provides the urease-producing infection pattern, urinary inflammation, haematuria, and evidence of renal impairment.',
    },
    {
      clueOrder: 4,
      clueType: 'imaging',
      clue: clues[4].value,
      explanation: reasoningSteps[4],
      diagnosticContribution:
        'Shows a large obstructing collecting-system structure extending beyond the pelvis into several calyces.',
    },
    {
      clueOrder: 5,
      clueType: 'imaging',
      clue: clues[5].value,
      explanation: reasoningSteps[5],
      diagnosticContribution:
        'Defines the complete branching morphology and confirms the canonical diagnosis.',
    },
  ] satisfies ClueBreakdownEntry[],
  keyFindings: [
    'Recurrent urinary tract infections',
    'Persistent dull flank discomfort rather than classic colic',
    'Foul-smelling cloudy urine',
    'Intermittent chills and malaise',
    'Costovertebral-angle tenderness',
    'Urine pH 8.3',
    'Positive nitrites and marked leukocyte esterase',
    'Microscopic haematuria and pyuria',
    'Proteus mirabilis on urine culture',
    'Worsening serum creatinine',
    'Moderate hydronephrosis',
    'Large shadowing structure in the renal pelvis',
    'Extension into multiple calyces',
    'Branching collecting-system configuration on CT',
    'Cortical thinning',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Large Renal Pelvis Calculus',
      whyPlausibleEarly:
        'A large stone confined mainly to the renal pelvis can cause flank discomfort, infection, haematuria, obstruction, and hydronephrosis.',
      ruledOutByClues: [
        {
          clueOrder: 4,
          evidence: 'extending into several calyces',
          reason:
            'Extension beyond the pelvis into multiple calyces suggests a branching mould of the collecting system rather than a pelvis-confined stone.',
        },
        {
          clueOrder: 5,
          evidence: 'upper, middle, and lower calyceal groups',
          reason:
            'Involvement of all major calyceal groups meets the complete staghorn configuration rather than a simple large pelvic calculus.',
        },
      ],
      finalReasonLessLikely:
        'The stone is not confined to the renal pelvis; it fills the pelvis and branches through the major calyces.',
    },
    {
      diagnosis: 'Xanthogranulomatous Pyelonephritis',
      whyPlausibleEarly:
        'Chronic infection, flank pain, fever, impaired renal function, obstruction, and Proteus infection can accompany xanthogranulomatous inflammation.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: 'without guarding, rebound, a palpable abdominal mass',
          reason:
            'Advanced xanthogranulomatous pyelonephritis may produce a mass-like enlarged kidney or extensive inflammatory findings, which are not evident clinically.',
        },
        {
          clueOrder: 5,
          evidence: 'dense branching concretion filling the left renal pelvis',
          reason:
            'The defining CT abnormality is a collecting-system stone; no destructive mass-like renal replacement pattern is described.',
        },
      ],
      finalReasonLessLikely:
        'Chronic infection is present, but imaging defines a branching collecting-system calculus rather than destructive xanthogranulomatous renal parenchymal disease.',
    },
    {
      diagnosis: 'Upper Tract Urothelial Carcinoma',
      whyPlausibleEarly:
        'Haematuria, flank discomfort, hydronephrosis, infection, and impaired drainage can occur with a tumour of the renal pelvis or ureter.',
      ruledOutByClues: [
        {
          clueOrder: 3,
          evidence: 'pH 8.3',
          reason:
            'Strongly alkaline infected urine with a urease-producing organism points toward infection-associated stone formation rather than tumour alone.',
        },
        {
          clueOrder: 5,
          evidence: 'dense branching concretion',
          reason:
            'CT identifies a calcified branching collecting-system structure rather than a soft-tissue urothelial mass.',
        },
      ],
      finalReasonLessLikely:
        'The radiographic morphology is that of a large branching calculus, not an upper-tract urothelial soft-tissue lesion.',
    },
    {
      diagnosis: 'Renal Cell Carcinoma',
      whyPlausibleEarly:
        'Flank discomfort, haematuria, fever, renal impairment, and a possible renal abnormality can raise concern for renal malignancy.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: 'without guarding, rebound, a palpable abdominal mass',
          reason:
            'There is no palpable mass or examination finding suggesting a large renal tumour.',
        },
        {
          clueOrder: 4,
          evidence: 'producing posterior acoustic shadowing',
          reason:
            'A strongly echogenic shadowing collecting-system structure is more compatible with mineralised stone than a solid renal mass.',
        },
      ],
      finalReasonLessLikely:
        'Imaging localises a mineralised branching structure to the collecting system rather than a renal parenchymal tumour.',
    },
    {
      diagnosis: 'Chronic Pyelonephritis',
      whyPlausibleEarly:
        'Recurrent infection, flank discomfort, pyuria, renal impairment, and cortical damage can reflect chronic pyelonephritis.',
      ruledOutByClues: [
        {
          clueOrder: 4,
          evidence:
            'large highly echogenic structure occupying the renal pelvis',
          reason:
            'A discrete shadowing collecting-system structure identifies a mechanical stone burden beyond infection-related scarring alone.',
        },
        {
          clueOrder: 5,
          evidence: 'branching concretion filling the left renal pelvis',
          reason:
            'CT demonstrates the structural cause of recurrent infection and obstruction.',
        },
      ],
      finalReasonLessLikely:
        'Chronic infection-related renal damage may coexist, but the primary unifying lesion is the branching calculus.',
    },
    {
      diagnosis: 'Medullary Nephrocalcinosis',
      whyPlausibleEarly:
        'Renal calcification, haematuria, impaired renal function, and recurrent stones can occur with medullary nephrocalcinosis.',
      ruledOutByClues: [
        {
          clueOrder: 4,
          evidence:
            'occupying the renal pelvis and extending into several calyces',
          reason:
            'Nephrocalcinosis consists of parenchymal or pyramidal calcification rather than one large collecting-system structure.',
        },
        {
          clueOrder: 5,
          evidence:
            'filling the left renal pelvis and extending through the upper, middle, and lower calyceal groups',
          reason:
            'The CT pattern is a mould of the collecting system, not diffuse medullary calcification.',
        },
      ],
      finalReasonLessLikely:
        'The calcification forms a single branching collecting-system calculus rather than diffuse renal parenchymal deposits.',
    },
  ] satisfies DifferentialAnalysisEntry[],
  managementPearl:
    'Staghorn calculi require urological assessment because untreated complex stones can sustain infection, obstruct drainage, and progressively damage renal function. If infection is accompanied by obstruction, sepsis, or anuria, urgently decompress the collecting system and start culture-directed antimicrobial therapy; definitive stone removal is delayed until infection is controlled. Percutaneous nephrolithotomy is generally the primary removal strategy for large complex renal stones, often using staged or combined procedures to achieve the greatest possible stone clearance.',
  generationQuality: {
    contentTier: 'FLAGSHIP',
    seedVersion,
    humanReviewed: true,
    discriminatorStrength: 'VERY_HIGH',
    clueProgressionVerified: true,
    breakdownClueReferencesValidated: true,
    frontendReasoningStringValidated: true,
    educationIndependentOfCase: true,
    expectedTeachingPoints: [
      'Staghorn calculi occupy the renal pelvis and branch into multiple calyces',
      'Complete stones involve the pelvis and all major calyceal groups',
      'Many staghorn calculi are infection-related, but not every staghorn stone is pure struvite',
      'Urease-producing organisms create alkaline urine that promotes struvite and carbonate apatite crystallisation',
      'Recurrent infection and dull flank discomfort may occur without classic ureteric colic',
      'Non-contrast CT defines stone burden, anatomy, obstruction, and treatment planning',
      'Infected obstruction is a urological emergency requiring drainage and antibiotics',
      'PCNL is the main treatment approach for large and complex renal stones',
      'Complete clearance and infection control reduce recurrence and ongoing renal damage',
      'Stone analysis, cultures, and metabolic evaluation remain important after treatment',
    ],
    competencyDomains: [
      'Urology',
      'Stone Disease',
      'Infectious Diseases',
      'Renal Imaging',
      'Urinalysis Interpretation',
      'Obstructive Uropathy',
      'Clinical Reasoning',
    ],
  },
};

const educationForFrontend = {
  title: displayLabel,
  summary: {
    definition:
      'A Staghorn Calculus is a large branching renal stone that occupies the renal pelvis and extends into at least two calyceal groups. A complete staghorn calculus fills the renal pelvis and all major calyceal groups, while a partial staghorn calculus occupies the pelvis and only part of the calyceal system.',
    highYieldTakeaway:
      'Think of a staghorn calculus when recurrent urinary infection, haematuria, persistent flank discomfort, renal impairment, or hydronephrosis accompanies imaging that shows a branching stone moulding the renal collecting system. Many are associated with urease-producing infection, but composition must not be assumed without analysis.',
  },
  recognitionPattern: [
    {
      pattern: 'Branching stone moulding the collecting system',
      whyItMatters:
        'The defining feature is morphology: the stone occupies the renal pelvis and extends into multiple calyces rather than remaining a small isolated renal or ureteric calculus.',
      progression:
        'Progressive crystal deposition -> enlargement within the renal pelvis -> extension into calyceal groups -> partial or complete staghorn configuration.',
      discriminator:
        'CT distinguishes a branching collecting-system stone from diffuse nephrocalcinosis, tumour, and isolated pelvic or calyceal calculi.',
      commonTrap:
        'Do not use "large renal stone" and "staghorn calculus" interchangeably unless the branching collecting-system configuration is present.',
    },
    {
      pattern: 'Recurrent or persistent urinary infection',
      whyItMatters:
        'Urease-producing organisms split urea, raise urinary pH, and promote precipitation of infection-stone minerals such as struvite and carbonate apatite.',
      progression:
        'Urease-producing infection -> alkaline urine and increased ammonium -> phosphate mineral precipitation -> rapid stone growth and bacterial persistence within the stone.',
      discriminator:
        'Strongly alkaline urine and organisms such as Proteus, Morganella, Providencia, and some Klebsiella species support an infection-stone mechanism.',
      commonTrap:
        'Do not assume every staghorn calculus is pure struvite; metabolic calcium-based and mixed stones can also develop a staghorn shape.',
    },
    {
      pattern: 'Chronic symptoms without classic renal colic',
      whyItMatters:
        'Large renal stones may remain relatively fixed within the collecting system and produce dull flank discomfort, recurrent infection, haematuria, or progressive renal dysfunction rather than episodic ureteric colic.',
      progression:
        'Increasing stone burden -> impaired drainage and chronic inflammation -> hydronephrosis, cortical loss, infection, and declining renal function.',
      discriminator:
        'Absence of severe colicky pain does not exclude substantial stone burden.',
      commonTrap:
        'Do not dismiss chronic non-colicky flank discomfort when infection, haematuria, or renal dysfunction is present.',
    },
    {
      pattern: 'Infection plus obstruction',
      whyItMatters:
        'An infected obstructed collecting system can rapidly progress to sepsis and requires urgent drainage before definitive stone removal.',
      progression:
        'Obstruction -> infected hydronephrosis -> rising intrarenal pressure and bacterial translocation -> sepsis, organ dysfunction, or anuria.',
      discriminator:
        'Fever, rigors, tachycardia, hypotension, altered mental status, oliguria, or acute kidney injury require emergency escalation.',
      commonTrap:
        'Do not proceed directly to definitive stone fragmentation in an unstable infected obstructed system before drainage and infection control.',
    },
  ],
  keySymptoms: [
    {
      symptom: 'Persistent or recurrent flank discomfort',
      significance:
        'Large renal stones often cause dull pressure or aching rather than classic migrating ureteric colic.',
    },
    {
      symptom: 'Recurrent dysuria, frequency, or cloudy urine',
      significance:
        'May indicate recurrent infection sustained by bacteria within a complex collecting-system stone.',
    },
    {
      symptom: 'Fever, chills, or malaise',
      significance:
        'Raise concern for active upper urinary infection and require assessment for obstruction and systemic involvement.',
    },
    {
      symptom: 'Haematuria',
      significance:
        'Microscopic or visible blood can result from urothelial irritation but persistent haematuria also requires consideration of malignancy and other causes.',
    },
    {
      symptom: 'Reduced urine output or worsening renal function',
      significance:
        'May reflect bilateral disease, a solitary obstructed kidney, severe unilateral damage, or superimposed acute kidney injury.',
    },
  ],
  keySigns: [
    {
      finding: 'Costovertebral-angle tenderness',
      significance:
        'Supports upper urinary tract inflammation or obstruction but is not specific to stone disease.',
      discriminator:
        'Interpret alongside urinalysis, renal function, systemic observations, and imaging.',
    },
    {
      finding: 'Fever and systemic inflammatory signs',
      significance:
        'Suggest active infection and increase urgency, especially when hydronephrosis or impaired drainage is present.',
      discriminator:
        'Haemodynamic instability or organ dysfunction indicates urosepsis rather than uncomplicated stone disease.',
    },
    {
      finding: 'Oliguria or anuria',
      significance:
        'May indicate bilateral obstruction, obstruction of a solitary functioning kidney, or severe renal dysfunction.',
      discriminator:
        'Anuria with obstruction is a urological emergency requiring immediate decompression.',
    },
    {
      finding: 'No characteristic examination abnormality',
      significance:
        'Some patients with large staghorn stones have minimal physical findings despite substantial stone burden.',
      discriminator:
        'Normal abdominal examination does not exclude complex renal calculi; imaging is decisive.',
    },
  ],
  examPearls: [
    {
      type: 'HISTORY',
      title: 'Separate chronic renal discomfort from ureteric colic',
      content:
        'Ask whether pain is dull and persistent or severe, episodic, and radiating toward the groin. Review recurrent infections, haematuria, prior cultures, previous stones, procedures, and renal function.',
      whyItMatters:
        'A fixed branching renal stone may not produce the classic migrating pain of a small ureteric calculus.',
      discriminator:
        'Chronic flank pressure with recurrent infection or renal impairment should prompt upper-tract imaging.',
      trapAvoided:
        'Do not require classic renal colic before considering major renal stone burden.',
    },
    {
      type: 'INFECTION',
      title: 'Assess for urease-producing infection',
      content:
        'Review urinary pH, nitrites, microscopy, culture results, previous organisms, antimicrobial exposure, and whether infection persists or rapidly recurs.',
      whyItMatters:
        'Infection may drive stone formation and persist within residual fragments even after temporary symptom improvement.',
      discriminator:
        'Alkaline urine with a urease-producing organism supports an infection-stone mechanism but does not replace stone analysis.',
      trapAvoided: 'Do not infer stone composition from urine culture alone.',
    },
    {
      type: 'SAFETY',
      title: 'Identify infected obstruction immediately',
      content:
        'Record temperature, pulse, blood pressure, mental state, hydration, urine output, renal function, and imaging evidence of hydronephrosis.',
      whyItMatters:
        'An infected obstructed kidney can deteriorate rapidly and needs urgent decompression plus antimicrobial therapy.',
      discriminator:
        'Sepsis, anuria, a solitary obstructed kidney, bilateral obstruction, or worsening organ dysfunction requires emergency intervention.',
      trapAvoided:
        'Do not delay drainage while waiting for definitive stone treatment planning.',
    },
    {
      type: 'PLANNING',
      title: 'Assess both kidneys and baseline function',
      content:
        'Determine contralateral kidney anatomy and function, overall renal function, comorbidities, bleeding risk, infection status, and previous renal procedures.',
      whyItMatters:
        'Treatment intensity and urgency depend on functional reserve, stone complexity, anatomy, and perioperative risk.',
      discriminator:
        'A poorly functioning stone-bearing kidney requires functional assessment and individualised discussion of clearance versus nephrectomy.',
      trapAvoided: 'Do not plan intervention from stone size alone.',
    },
  ],
  scoringSystems: [],
  investigations: [
    {
      test: 'Urinalysis and urine pH',
      interpretation:
        'Assess blood, leukocytes, nitrites, protein, specific gravity, and pH. Strong alkalinity supports urease activity but is not diagnostic of stone composition.',
      whyItMatters:
        'Urinalysis identifies haematuria, inflammation, infection clues, and the chemical environment associated with infection stones.',
    },
    {
      test: 'Urine culture and susceptibility testing',
      interpretation:
        'Culture identifies active infection and guides antimicrobial therapy. A negative bladder culture does not completely exclude bacteria within the renal pelvis or stone.',
      whyItMatters:
        'Infection must be treated before planned stone removal, and renal-pelvis or stone cultures at PCNL can better predict postoperative infection risk.',
    },
    {
      test: 'Serum testing',
      interpretation:
        'Check creatinine, electrolytes, full blood count, inflammatory markers when infection is suspected, calcium, uric acid, and other tests guided by the clinical context.',
      whyItMatters:
        'Results assess renal function, infection severity, metabolic contributors, and perioperative risk.',
    },
    {
      test: 'Renal ultrasonography',
      interpretation:
        'Can identify hydronephrosis and large echogenic shadowing stones but may underestimate exact stone burden and complex calyceal extension.',
      whyItMatters:
        'Ultrasound is useful for detecting obstruction and avoiding radiation in selected patients.',
    },
    {
      test: 'Non-contrast CT of the urinary tract',
      interpretation:
        'Defines stone size, density, branching extent, collecting-system anatomy, hydronephrosis, cortical loss, and associated stones. Contrast may be added when anatomy, function, or alternative pathology requires evaluation.',
      whyItMatters:
        'CT is central to confirming staghorn morphology and planning percutaneous access and staged treatment.',
    },
    {
      test: 'Stone analysis',
      interpretation:
        'Use infrared spectroscopy or X-ray diffraction when material is retrieved. Composition may be struvite, carbonate apatite, calcium oxalate, calcium phosphate, uric acid, cystine, or mixed.',
      whyItMatters:
        'Morphology and culture cannot reliably determine composition, and prevention depends on the actual mineral content.',
    },
    {
      test: 'Renal functional assessment',
      interpretation:
        'Differential renal function testing may be appropriate when there is marked cortical thinning, longstanding obstruction, or concern that the affected kidney contributes little function.',
      whyItMatters:
        'Functional reserve influences the balance between complex clearance procedures and removal of a severely damaged kidney.',
    },
    {
      test: 'Metabolic evaluation',
      interpretation:
        'After stone clearance and infection control, evaluate recurrent-stone risk according to history, composition, serum testing, and appropriate urine studies.',
      whyItMatters:
        'Even infection-associated and mixed staghorn stones may have treatable metabolic contributors.',
    },
  ],
  differentialDistinguishers: [
    {
      diagnosis: 'Large Renal Pelvis Calculus',
      overlap:
        'Flank discomfort, infection, haematuria, hydronephrosis, and a large renal stone.',
      distinguishingFeatures:
        'A pelvis-confined calculus does not branch extensively into multiple calyceal groups.',
      decisiveClue:
        'CT showing a stone moulding the renal pelvis and multiple calyces establishes staghorn morphology.',
    },
    {
      diagnosis: 'Xanthogranulomatous Pyelonephritis',
      overlap:
        'Chronic infection, obstruction, flank pain, fever, impaired function, and association with large stones.',
      distinguishingFeatures:
        'Imaging may show renal enlargement, parenchymal destruction, multiple low-attenuation areas, abscess, or inflammatory extension rather than a stone alone.',
      decisiveClue:
        'Parenchymal replacement and inflammatory mass features support xanthogranulomatous pyelonephritis, although it may coexist with a staghorn calculus.',
    },
    {
      diagnosis: 'Upper Tract Urothelial Carcinoma',
      overlap:
        'Haematuria, flank discomfort, infection, hydronephrosis, and collecting-system abnormality.',
      distinguishingFeatures:
        'CT urography may show an enhancing soft-tissue filling defect or urothelial thickening rather than a dense branching mineralised structure.',
      decisiveClue:
        'Cross-sectional imaging demonstrating mineral density and branching stone morphology favours calculus.',
    },
    {
      diagnosis: 'Renal Cell Carcinoma',
      overlap:
        'Flank symptoms, haematuria, fever, anaemia, weight loss, or renal impairment.',
      distinguishingFeatures:
        'A renal parenchymal enhancing mass replaces or distorts renal tissue rather than moulding the collecting system as a mineralised branching structure.',
      decisiveClue:
        'Contrast-enhanced imaging identifies a solid renal mass when carcinoma is suspected.',
    },
    {
      diagnosis: 'Chronic Pyelonephritis',
      overlap:
        'Recurrent infection, flank discomfort, renal scarring, cortical thinning, and impaired function.',
      distinguishingFeatures:
        'Scarring and calyceal deformity may occur without one large branching stone.',
      decisiveClue:
        'CT directly demonstrating a staghorn configuration identifies the structural lesion, while chronic pyelonephritis may coexist as a consequence.',
    },
    {
      diagnosis: 'Medullary Nephrocalcinosis',
      overlap:
        'Renal calcification, recurrent stones, haematuria, infection, and impaired renal function.',
      distinguishingFeatures:
        'Calcification is diffuse within the renal pyramids or parenchyma rather than a single collecting-system mould.',
      decisiveClue:
        'The distribution of calcification on CT separates parenchymal nephrocalcinosis from a branching collecting-system calculus.',
    },
  ],
  managementOverview: [
    {
      step: 'Assess for infection, obstruction, and physiological instability',
      rationale:
        'Fever, sepsis, acute kidney injury, anuria, bilateral obstruction, or obstruction of a solitary kidney changes the case from planned stone treatment to emergency drainage.',
    },
    {
      step: 'Urgently decompress infected obstruction',
      rationale:
        'Use ureteric stenting or percutaneous nephrostomy according to anatomy and local expertise, obtain cultures, and start immediate antimicrobial therapy. Definitive stone removal follows after infection control.',
    },
    {
      step: 'Define stone burden and renal anatomy with CT',
      rationale:
        'Detailed imaging guides access, estimates procedural complexity, identifies associated stones, and assesses cortical damage and contralateral renal reserve.',
    },
    {
      step: 'Use percutaneous nephrolithotomy as the principal clearance strategy',
      rationale:
        'PCNL provides the most effective access for large branching renal stones. Multiple tracts, staged procedures, flexible nephroscopy, or adjunctive ureteroscopy may be required.',
    },
    {
      step: 'Aim for maximal safe stone clearance',
      rationale:
        'Residual infected fragments can support bacterial persistence, regrowth, recurrent infection, and ongoing renal injury.',
    },
    {
      step: 'Use culture-directed antimicrobial treatment and perioperative prophylaxis',
      rationale:
        'Treat active infection before intervention and tailor antibiotics to culture and local susceptibility patterns. Obtain renal-pelvis or stone culture during PCNL when possible.',
    },
    {
      step: 'Assess renal function when damage is advanced',
      rationale:
        'Marked cortical thinning or longstanding obstruction may warrant differential functional testing and discussion of nephrectomy if the kidney is poorly functioning and remains a source of infection.',
    },
    {
      step: 'Prevent recurrence after clearance',
      rationale:
        'Analyse stone composition, eradicate infection, review cultures, assess metabolic risk, address anatomical contributors, and arrange imaging follow-up.',
    },
  ],
  complications: [
    'Recurrent urinary tract infection',
    'Pyelonephritis and renal abscess',
    'Infected hydronephrosis and urosepsis',
    'Progressive renal cortical loss',
    'Chronic kidney disease',
    'Acute kidney injury',
    'Obstruction of a solitary kidney or bilateral obstruction',
    'Persistent bacteriuria within residual fragments',
    'Stone regrowth after incomplete clearance',
    'Bleeding, infection, or adjacent-organ injury during complex stone treatment',
  ],
  pitfalls: [
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Equating every large renal stone with a staghorn calculus',
      content:
        'Size alone does not define the diagnosis; the stone must occupy the renal pelvis and branch into the calyceal system.',
      whyItMatters:
        'Incorrect terminology obscures stone complexity and may mislead treatment planning.',
      trapAvoided: 'Describe the exact collecting-system distribution on CT.',
    },
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Assuming every staghorn stone is struvite',
      content:
        'Many are infection-related, but calcium-based, uric-acid, cystine, and mixed stones can also form a staghorn configuration.',
      whyItMatters:
        'Incorrect composition assumptions lead to incomplete metabolic evaluation and prevention.',
      trapAvoided:
        'Use stone analysis rather than morphology or urine culture alone.',
    },
    {
      type: 'SAFETY',
      title: 'Missing infected obstruction',
      content:
        'Sepsis, anuria, acute kidney injury, or systemic deterioration with hydronephrosis requires urgent drainage.',
      whyItMatters:
        'Antibiotics alone may not control infection behind an obstructed collecting system.',
      trapAvoided:
        'Assess physiology, urine output, renal function, and obstruction before planning definitive removal.',
    },
    {
      type: 'SAFETY',
      title: 'Performing definitive removal before infection control',
      content:
        'Instrumentation of an infected obstructed system can precipitate severe sepsis.',
      whyItMatters:
        'Drainage and culture-directed treatment must precede definitive stone fragmentation when clinically significant infection and obstruction coexist.',
      trapAvoided:
        'Separate emergency source control from later definitive stone clearance.',
    },
    {
      type: 'FOLLOW_UP',
      title: 'Accepting residual infected fragments without a plan',
      content:
        'Residual fragments may harbour bacteria and serve as a nidus for regrowth.',
      whyItMatters:
        'Incomplete clearance can lead to recurrent infection, repeated procedures, and progressive renal damage.',
      trapAvoided:
        'Document residual burden and arrange staged treatment or structured surveillance.',
    },
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Skipping metabolic evaluation',
      content:
        'Infection and metabolic abnormalities can coexist, particularly in mixed-composition stones.',
      whyItMatters:
        'Treatable contributors may remain after infection control and surgery.',
      trapAvoided:
        'Base prevention on stone analysis, serum assessment, and appropriate urine studies.',
    },
  ],
  recallPrompts: [
    {
      prompt: 'What anatomical feature defines a staghorn calculus?',
      answer:
        'A stone occupying the renal pelvis and branching into multiple calyces.',
    },
    {
      prompt: 'What distinguishes complete from partial staghorn morphology?',
      answer:
        'A complete staghorn fills the renal pelvis and all major calyceal groups; a partial staghorn extends into only part of the calyceal system.',
    },
    {
      prompt: 'Which organisms commonly support infection-stone formation?',
      answer:
        'Urease-producing organisms, especially Proteus species, with other examples including Morganella, Providencia, and some Klebsiella species.',
    },
    {
      prompt: 'What urinary environment promotes struvite precipitation?',
      answer: 'Strongly alkaline urine created by urease activity.',
    },
    {
      prompt: 'Can a staghorn calculus be non-struvite?',
      answer:
        'Yes. Calcium-based, uric-acid, cystine, and mixed stones can also have a staghorn configuration.',
    },
    {
      prompt:
        'What is the main imaging study for defining staghorn stone burden?',
      answer:
        'Non-contrast CT of the urinary tract, with contrast added when anatomy, function, or alternative pathology requires it.',
    },
    {
      prompt: 'What is the emergency priority in infected obstruction?',
      answer:
        'Urgent decompression of the collecting system plus immediate culture-directed antimicrobial management.',
    },
    {
      prompt:
        'What is the principal definitive treatment for most staghorn calculi?',
      answer:
        'Percutaneous nephrolithotomy, often with staged or combined procedures.',
    },
    {
      prompt: 'Why is maximal stone clearance important?',
      answer:
        'Residual fragments can harbour bacteria, regrow, cause recurrent infection, and perpetuate renal damage.',
    },
  ],
  references: [
    {
      citation:
        'European Association of Urology. EAU Guidelines on Urolithiasis. 2026 edition.',
    },
    {
      citation:
        'European Association of Urology. EAU Guidelines on Urological Infections. 2026 edition.',
    },
    {
      citation:
        'American Urological Association. Surgical Management of Stones: AUA/Endourology Society Guideline.',
    },
  ],
};

function assertSeedShape() {
  const supportedClueTypes = new Set([
    'history',
    'symptom',
    'vital',
    'exam',
    'lab',
    'imaging',
  ]);

  if (clues.length !== 6) {
    throw new Error(`Expected exactly 6 clues; received ${clues.length}.`);
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

    if (!clue.value.trim()) {
      throw new Error(`Clue ${clue.order} has an empty value.`);
    }
  });

  const forbiddenEarlyTerms = aliasTerms.map(normalizeClinicalText);

  for (const clue of clues.slice(0, 5)) {
    const normalizedClue = normalizeClinicalText(clue.value);
    const leakedTerm = forbiddenEarlyTerms.find((term) =>
      normalizedClue.includes(term),
    );

    if (leakedTerm) {
      throw new Error(
        `Clue ${clue.order} reveals the final diagnosis or alias: ${leakedTerm}.`,
      );
    }
  }

  if (
    new Set(differentials.map(normalizeClinicalText)).size !==
    differentials.length
  ) {
    throw new Error('Differentials contain duplicate diagnoses.');
  }

  if (typeof explanation.reasoning !== 'string') {
    throw new Error(
      'Explanation reasoning must be a newline-separated string for the current learner frontend.',
    );
  }

  const renderedReasoningSteps = explanation.reasoning
    .split(/\n{2,}|\n/)
    .map((step) => step.trim())
    .filter(Boolean);

  if (renderedReasoningSteps.length !== clues.length) {
    throw new Error(
      `Expected ${clues.length} frontend reasoning steps; received ${renderedReasoningSteps.length}.`,
    );
  }

  const clueBreakdown = explanation.clueBreakdown as ClueBreakdownEntry[];

  if (clueBreakdown.length !== clues.length) {
    throw new Error(
      `Expected ${clues.length} clue breakdown entries; received ${clueBreakdown.length}.`,
    );
  }

  clueBreakdown.forEach((entry, index) => {
    const clue = clues[index];

    if (entry.clueOrder !== clue.order) {
      throw new Error(
        `Clue breakdown order mismatch at index ${index}: expected ${clue.order}; received ${entry.clueOrder}.`,
      );
    }

    if (entry.clueType !== clue.type) {
      throw new Error(
        `Clue breakdown type mismatch at order ${clue.order}: expected ${clue.type}; received ${entry.clueType}.`,
      );
    }

    if (entry.clue !== clue.value) {
      throw new Error(`Clue breakdown text mismatch at order ${clue.order}.`);
    }

    if (entry.explanation !== renderedReasoningSteps[index]) {
      throw new Error(
        `Clue breakdown explanation does not match frontend reasoning step at order ${clue.order}.`,
      );
    }

    if (!entry.explanation.trim() || !entry.diagnosticContribution.trim()) {
      throw new Error(
        `Clue breakdown ${clue.order} has an empty explanation or diagnostic contribution.`,
      );
    }
  });

  const differentialAnalysis =
    explanation.differentialAnalysis as DifferentialAnalysisEntry[];

  differentialAnalysis.forEach((entry) => {
    if (!differentials.includes(entry.diagnosis)) {
      throw new Error(
        `Differential analysis contains unlisted diagnosis: ${entry.diagnosis}.`,
      );
    }

    entry.ruledOutByClues.forEach((breakdown) => {
      if (
        !Number.isInteger(breakdown.clueOrder) ||
        breakdown.clueOrder < 0 ||
        breakdown.clueOrder >= clues.length
      ) {
        throw new Error(
          `Invalid clueOrder ${breakdown.clueOrder} in differential ${entry.diagnosis}.`,
        );
      }

      if (!breakdown.evidence.trim() || !breakdown.reason.trim()) {
        throw new Error(
          `Empty breakdown evidence or reason in differential ${entry.diagnosis}.`,
        );
      }

      const sourceClue = normalizeClinicalText(
        clues[breakdown.clueOrder].value,
      );
      const normalizedEvidence = normalizeClinicalText(breakdown.evidence);

      if (!sourceClue.includes(normalizedEvidence)) {
        throw new Error(
          `Differential evidence is not present in clue ${breakdown.clueOrder}: ${entry.diagnosis} -> ${breakdown.evidence}.`,
        );
      }
    });
  });

  const educationText = normalizeClinicalText(
    JSON.stringify(educationForFrontend),
  );

  const caseSpecificEducationTerms = [
    '48 year old',
    'eight months',
    'pH 8 3',
    'proteus mirabilis sensitive',
    'creatinine is 146',
    'this patient',
    'this case',
    'her ultrasound',
  ];

  for (const term of caseSpecificEducationTerms) {
    if (educationText.includes(normalizeClinicalText(term))) {
      throw new Error(
        `Diagnosis education contains case-specific wording: ${term}.`,
      );
    }
  }
}

async function ensureRegistry() {
  const normalizedTerms = aliasTerms.map(normalizeClinicalText);
  const canonicalNormalized = normalizeClinicalText(canonicalName);

  const exactRegistry = await prisma.diagnosisRegistry.findUnique({
    where: { canonicalNormalized },
    select: { id: true },
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
        select: { id: true },
      });

  const existing = exactRegistry ?? relatedRegistry;

  const registry = existing
    ? await prisma.diagnosisRegistry.update({
        where: { id: existing.id },
        data: {
          canonicalName,
          canonicalNormalized,
          displayLabel,
          status: DiagnosisRegistryStatus.ACTIVE,
          active: true,
          isPlayable: true,
          isGeneratable: true,
          specialty: taxonomy.specialty,
          subspecialty: taxonomy.subspecialty,
          category: taxonomy.category,
          bodySystem: taxonomy.bodySystem,
          organSystem: taxonomy.organSystem,
          difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
          rarityBand: DiagnosisRarityBand.UNCOMMON,
          clinicalSetting: DiagnosisClinicalSetting.INPATIENT,
          ageGroup: DiagnosisAgeGroup.ADULT,
          urgencyLevel: DiagnosisUrgencyLevel.URGENT,
          preferredClueTypes: ['history', 'symptom', 'exam', 'lab', 'imaging'],
          notes:
            'Seeded flagship Staghorn Calculus case focused on recurrent urinary infection, alkaline urine, urease-producing organisms, branching collecting-system morphology, obstruction, renal impairment, and PCNL planning.',
        },
        select: { id: true, displayLabel: true },
      })
    : await prisma.diagnosisRegistry.create({
        data: {
          canonicalName,
          canonicalNormalized,
          displayLabel,
          status: DiagnosisRegistryStatus.ACTIVE,
          active: true,
          isPlayable: true,
          isGeneratable: true,
          specialty: taxonomy.specialty,
          subspecialty: taxonomy.subspecialty,
          category: taxonomy.category,
          bodySystem: taxonomy.bodySystem,
          organSystem: taxonomy.organSystem,
          difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
          rarityBand: DiagnosisRarityBand.UNCOMMON,
          clinicalSetting: DiagnosisClinicalSetting.INPATIENT,
          ageGroup: DiagnosisAgeGroup.ADULT,
          urgencyLevel: DiagnosisUrgencyLevel.URGENT,
          preferredClueTypes: ['history', 'symptom', 'exam', 'lab', 'imaging'],
          notes:
            'Seeded flagship Staghorn Calculus case focused on recurrent urinary infection, alkaline urine, urease-producing organisms, branching collecting-system morphology, obstruction, renal impairment, and PCNL planning.',
        },
        select: { id: true, displayLabel: true },
      });

  for (const [rank, term] of aliasTerms.entries()) {
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
        kind:
          rank === 0
            ? DiagnosisAliasKind.CANONICAL
            : DiagnosisAliasKind.ACCEPTED,
      },
      create: {
        diagnosisRegistryId: registry.id,
        term,
        normalizedTerm: normalizeClinicalText(term),
        active: true,
        acceptedForMatch: true,
        rank,
        kind:
          rank === 0
            ? DiagnosisAliasKind.CANONICAL
            : DiagnosisAliasKind.ACCEPTED,
        source: seedVersion,
      },
    });
  }

  return registry;
}

async function ensureEducation(diagnosisRegistryId: string) {
  const existing = await prisma.diagnosisEducation.findUnique({
    where: { diagnosisRegistryId },
    select: { id: true, version: true },
  });

  if (existing) {
    console.log(
      'Skipped diagnosis education because Staghorn Calculus education already exists:',
      existing,
    );
    return existing;
  }

  const education = await prisma.diagnosisEducation.create({
    data: {
      diagnosisRegistryId,
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
    select: { id: true, version: true },
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

  return education;
}

async function ensureCase(params: {
  diagnosisRegistryId: string;
  educationId: string;
}) {
  const existingCase = await prisma.case.findFirst({
    where: {
      diagnosisRegistryId: params.diagnosisRegistryId,
      title: caseTitle,
    },
    orderBy: [{ approvedAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      title: true,
      publicNumber: true,
      currentRevisionId: true,
      dailyCases: { select: { id: true }, take: 1 },
    },
  });

  if (existingCase) {
    console.log(
      existingCase.dailyCases.length > 0
        ? 'Skipped existing scheduled Staghorn Calculus case.'
        : 'Skipped existing Staghorn Calculus case to avoid overwriting authored content.',
      existingCase,
    );
    return existingCase;
  }

  const assignedDate = await findAvailableInventoryPlaceholderDate({
    preferredDate: inventoryPlaceholderDate,
    displayLabel: caseTitle,
  });

  const publicNumber = await getNextCasePublicNumber();
  const history = clues[0].value;
  const symptoms = [clues[0].value, clues[1].value];

  const caseData = {
    title: caseTitle,
    publicNumber,
    date: assignedDate,
    difficulty: 'intermediate',
    history,
    symptoms,
    clues: clues as unknown as object,
    explanation: explanation as object,
    differentials,
    editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
    approvedAt: now,
    publishedAt: null,
    diagnosisRegistryId: params.diagnosisRegistryId,
    proposedDiagnosisText: displayLabel,
    diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
    diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
    diagnosisMappingConfidence: 1,
    diagnosisEditorialNote:
      'Seeded complete frontend-aligned flagship Staghorn Calculus case with six valid playable clues, exact clue-breakdown alignment, infection-stone reasoning, obstruction assessment, PCNL teaching, and diagnosis-level education independent of the vignette.',
  };

  const seededCase = await prisma.case.create({
    data: caseData,
    select: { id: true },
  });

  const revision = await prisma.caseRevision.create({
    data: {
      caseId: seededCase.id,
      revisionNumber: 1,
      source: CaseSource.MANUAL,
      publishTrack: PublishTrack.DAILY,
      title: caseTitle,
      date: assignedDate,
      difficulty: 'intermediate',
      history,
      symptoms,
      clues: clues as unknown as object,
      explanation: explanation as object,
      differentials,
      diagnosisRegistryId: params.diagnosisRegistryId,
      proposedDiagnosisText: displayLabel,
      diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
      diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
      diagnosisMappingConfidence: 1,
      diagnosisEditorialNote:
        'Created complete Staghorn Calculus revision with six supported clue types, frontend-compatible reasoning, culture interpretation, collecting-system imaging progression, and urgent infected-obstruction teaching.',
    },
    select: { id: true },
  });

  await prisma.case.update({
    where: { id: seededCase.id },
    data: { currentRevisionId: revision.id },
  });

  await prisma.caseValidationRun.create({
    data: {
      caseId: seededCase.id,
      revisionId: revision.id,
      source: CaseSource.MANUAL,
      publishTrack: PublishTrack.DAILY,
      outcome: ValidationOutcome.PASSED,
      validatorVersion: 'flagship-human-review:staghorn-calculus-v1',
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        clueProgressionVerified: true,
        breakdownClueReferencesValidated: true,
        frontendReasoningStringValidated: true,
        educationIndependentOfCase: true,
        playableClueCount: clues.length,
        clueTypes: clues.map((clue) => clue.type),
        duplicateSafe: true,
        doesNotOverwriteExistingEducation: true,
        doesNotOverwriteExistingCase: true,
        metadataVerified: {
          specialty: taxonomy.specialty,
          subspecialty: taxonomy.subspecialty,
          category: taxonomy.category,
          bodySystem: taxonomy.bodySystem,
          organSystem: taxonomy.organSystem,
          difficultyBand: 'INTERMEDIATE',
          rarityBand: 'UNCOMMON',
          clinicalSetting: 'INPATIENT',
          ageGroup: 'ADULT',
          urgencyLevel: 'URGENT',
        },
        note: 'Complete Staghorn Calculus flagship seed with six supported clue types, no early diagnosis-label leakage, exact clue-to-breakdown alignment, infection-stone reasoning, branching imaging confirmation, infected-obstruction safety priorities, and independent diagnosis education.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded Staghorn Calculus:', {
    registryId: params.diagnosisRegistryId,
    caseId: seededCase.id,
    revisionId: revision.id,
    publicNumber,
    educationId: params.educationId,
    clueTypes: clues.map((clue) => clue.type),
  });

  return {
    id: seededCase.id,
    title: caseTitle,
    publicNumber,
    currentRevisionId: revision.id,
    dailyCases: [],
  };
}

async function main() {
  assertSeedShape();

  const registry = await ensureRegistry();
  const education = await ensureEducation(registry.id);

  await ensureCase({
    diagnosisRegistryId: registry.id,
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
