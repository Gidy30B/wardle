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
 * FLAGSHIP CASE SEED - Acute Cystitis
 *
 * Clinical focus:
 * - Acute lower urinary symptoms localising to the bladder.
 * - Dysuria, frequency, urgency, and suprapubic discomfort.
 * - Absence of vaginal symptoms reduces the likelihood of vaginitis.
 * - Absence of fever, rigors, flank pain, and costovertebral-angle tenderness
 *   argues against systemic UTI / acute pyelonephritis.
 * - Urinalysis showing pyuria, nitrites, leukocyte esterase, and bacteriuria.
 * - A single uropathogen on culture confirms the bacterial cause when culture
 *   is obtained, while recognising that culture is not mandatory in every
 *   clinically typical uncomplicated presentation.
 *
 * Education design:
 * - Case explanation is specific to the vignette.
 * - Diagnosis education is independent of the case and covers recognition,
 *   localisation, investigations, management principles, complications,
 *   differential diagnoses, and common pitfalls across patient groups.
 *
 * Safety:
 * - Reuses or creates the diagnosis registry and accepted aliases.
 * - Does not overwrite existing diagnosis education.
 * - Does not overwrite an existing case with the same title.
 * - Does not alter a scheduled DailyCase.
 *
 * Run:
 *   npx tsx prisma/seed/flagship-acute-cystitis.seed.ts
 *
 * Railway:
 *   railway run npx tsx prisma/seed/flagship-acute-cystitis.seed.ts
 */

const databaseUrl = resolvePgConnectionString(process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run the Acute Cystitis seed.');
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
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 6, 24, 12, 0, 0));
const seedVersion = 'flagship-acute-cystitis-v1';

const canonicalName = 'acute cystitis';
const displayLabel = 'Acute Cystitis';
const caseTitle = 'Painful Frequent Urination and Lower Abdominal Discomfort';

const aliasTerms = [
  'Acute Cystitis',
  'Cystitis',
  'Acute Bacterial Cystitis',
  'Bladder Infection',
];

const clues = [
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

const differentials = [
  'Acute Pyelonephritis',
  'Urethritis',
  'Vulvovaginitis',
  'Nephrolithiasis',
  'Pelvic Inflammatory Disease',
  'Bladder Pain Syndrome',
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

const explanation = {
  diagnosis: displayLabel,
  summary:
    'Abrupt urinary frequency, urgency, small-volume voiding, terminal dysuria, and suprapubic discomfort without vaginal or systemic symptoms localise the illness to the bladder. Pyuria, nitrites, bacteriuria, microscopic haematuria, and growth of a single uropathogenic Escherichia coli isolate establish Acute Cystitis.',
  reasoning: [
    'The short symptom duration supports an acute process rather than a chronic bladder pain disorder.',
    'Frequency, urgency, and repeated small-volume voiding reflect irritation of the bladder mucosa and reduced functional bladder capacity.',
    'Dysuria that is prominent near the end of micturition and suprapubic discomfort are typical lower urinary tract features.',
    'The absence of vaginal discharge, vulval irritation, genital lesions, dyspareunia, or abnormal bleeding reduces the likelihood of vulvovaginitis, cervicitis, and pelvic inflammatory disease.',
    'Normal temperature, stable observations, preserved general condition, and absence of rigors, vomiting, flank pain, or costovertebral-angle tenderness argue against systemic urinary infection and acute pyelonephritis.',
    'Leukocyte esterase and pyuria demonstrate urinary tract inflammation, while nitrites and bacteriuria support infection with a nitrate-reducing uropathogen.',
    'Only occasional squamous epithelial cells support an adequately collected specimen rather than heavy contamination.',
    'The absence of white-cell casts further favours a lower rather than renal parenchymal process.',
    'A single significant Escherichia coli isolate unifies the symptoms and urinalysis findings as an acute bacterial infection confined clinically to the bladder.',
    'The canonical diagnosis is Acute Cystitis; Escherichia coli is the causative organism rather than the answer label.',
  ],
  clueBreakdown: [
    {
      clueOrder: 0,
      clueType: 'history',
      clue: clues[0].value,
      explanation:
        'New urinary frequency, urgency, and repeated small-volume voiding indicate acute irritation of the lower urinary tract. The absence of structural, metabolic, immune, or catheter-related risk factors supports a straightforward community presentation while not yet identifying the exact cause.',
      diagnosticContribution:
        'Introduces an acute bladder-localising syndrome and establishes the clinical setting without naming the diagnosis.',
    },
    {
      clueOrder: 1,
      clueType: 'symptom',
      clue: clues[1].value,
      explanation:
        'Terminal dysuria and suprapubic discomfort strengthen localisation to the bladder. Mild haematuria can accompany inflamed bladder mucosa. The explicit absence of vaginal and vulval symptoms is diagnostically important because genital tract inflammation commonly causes external dysuria and can mimic a urinary infection.',
      diagnosticContribution:
        'Makes acute lower urinary inflammation highly likely and reduces the probability of vaginitis, cervicitis, and pelvic inflammatory disease.',
    },
    {
      clueOrder: 2,
      clueType: 'vital',
      clue: clues[2].value,
      explanation:
        'Normal temperature and stable observations show that the patient has no systemic physiological disturbance. The absence of fever, rigors, vomiting, and flank pain argues against extension beyond the bladder.',
      diagnosticContribution:
        'Separates a localised lower urinary presentation from systemic UTI or acute pyelonephritis.',
    },
    {
      clueOrder: 3,
      clueType: 'exam',
      clue: clues[3].value,
      explanation:
        'Mild suprapubic tenderness is compatible with bladder inflammation. The absence of costovertebral-angle tenderness reduces the likelihood of renal parenchymal involvement, while the normal genital inspection and lack of peritonism reduce important alternative pelvic and abdominal causes.',
      diagnosticContribution:
        'Provides physical localisation to the bladder while actively excluding upper-tract and genital sources.',
    },
    {
      clueOrder: 4,
      clueType: 'lab',
      clue: clues[4].value,
      explanation:
        'Leukocyte esterase and numerous urinary white cells indicate pyuria. Nitrites and visible bacteria support a nitrate-reducing bacterial uropathogen, and blood can reflect mucosal inflammation. Few squamous cells suggest limited contamination, while no white-cell casts supports a lower-tract process. The negative pregnancy test informs safe management and risk classification.',
      diagnosticContribution:
        'Provides objective evidence of bacterial urinary inflammation and substantially confirms the working diagnosis before culture.',
    },
    {
      clueOrder: 5,
      clueType: 'lab',
      clue: clues[5].value,
      explanation:
        'Growth of a single significant Escherichia coli isolate links the inflammatory urinalysis to a recognised uropathogen and provides susceptibility information. Culture is not required for every typical presentation, but when obtained it confirms the bacterial cause and guides therapy.',
      diagnosticContribution:
        'Establishes Acute Cystitis and identifies the causative organism without changing the canonical diagnosis.',
    },
  ],
  keyFindings: [
    'Age 27 years',
    'Acute 36-hour symptom duration',
    'Urinary frequency',
    'Urinary urgency',
    'Small-volume voiding',
    'Terminal dysuria',
    'Suprapubic discomfort',
    'Single episode of faint haematuria',
    'No vaginal discharge or vulval itching',
    'No genital ulceration or dyspareunia',
    'Afebrile and haemodynamically stable',
    'No rigors, vomiting, or flank pain',
    'Mild suprapubic tenderness',
    'No costovertebral-angle tenderness',
    'Positive leukocyte esterase',
    'Positive nitrites',
    'Positive urine blood',
    'Microscopic pyuria and bacteriuria',
    'Few squamous epithelial cells',
    'No white-cell casts',
    'Negative pregnancy test',
    'Single significant Escherichia coli isolate',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Acute Pyelonephritis',
      whyPlausibleEarly:
        'Dysuria, frequency, urgency, and pyuria can occur in both lower and upper urinary tract infection.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence:
            'normal temperature and absence of fever, rigors, vomiting, systemic illness, or flank pain',
          reason:
            'Acute pyelonephritis usually has systemic or upper-tract features, although early presentations require clinical judgment.',
        },
        {
          clueOrder: 3,
          evidence: 'no costovertebral-angle tenderness',
          reason:
            'Absence of renal-angle tenderness supports localisation below the upper urinary tract.',
        },
        {
          clueOrder: 4,
          evidence: 'no white-cell casts',
          reason:
            'White-cell casts would support renal parenchymal inflammation; their absence is compatible with a bladder-limited process.',
        },
      ],
      finalReasonLessLikely:
        'The presentation is localised to the bladder with no systemic or renal parenchymal features.',
    },
    {
      diagnosis: 'Urethritis',
      whyPlausibleEarly:
        'Urethritis can cause dysuria and urinary frequency, especially in sexually active patients.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence:
            'prominent urgency, small-volume voiding, terminal dysuria, and suprapubic discomfort without genital ulceration or discharge',
          reason:
            'The symptom cluster localises more strongly to the bladder than to isolated urethral inflammation.',
        },
        {
          clueOrder: 4,
          evidence: 'positive nitrites with bacteriuria on urine microscopy',
          reason:
            'This pattern supports a typical enteric uropathogen rather than isolated sexually transmitted urethritis.',
        },
        {
          clueOrder: 5,
          evidence: 'single significant Escherichia coli isolate',
          reason:
            'The culture identifies a conventional urinary pathogen that explains the bladder-localising syndrome.',
        },
      ],
      finalReasonLessLikely:
        'The bladder symptoms and bacterial urine findings are more consistent with Acute Cystitis; STI testing would still be considered when exposure history or persistent symptoms raise concern.',
    },
    {
      diagnosis: 'Vulvovaginitis',
      whyPlausibleEarly:
        'Vulval or vaginal inflammation may cause burning when urine contacts inflamed external tissue and can be misreported as dysuria.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence:
            'no vaginal discharge, vulval itching, genital ulceration, dyspareunia, or abnormal bleeding',
          reason:
            'The absence of characteristic genital symptoms makes vulvovaginitis substantially less likely.',
        },
        {
          clueOrder: 3,
          evidence: 'normal external genital inspection',
          reason:
            'No visible vulval inflammatory or ulcerative process is identified.',
        },
        {
          clueOrder: 4,
          evidence:
            'nitrites, pyuria, and bacteriuria in a minimally contaminated specimen',
          reason:
            'These findings support infection within the urinary tract rather than external irritation alone.',
        },
      ],
      finalReasonLessLikely:
        'There are no genital symptoms or signs, and the urine findings demonstrate a urinary bacterial process.',
    },
    {
      diagnosis: 'Nephrolithiasis',
      whyPlausibleEarly:
        'Urinary urgency, dysuria, and haematuria may occur when a stone approaches the distal ureter or bladder.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence:
            'constant mild suprapubic discomfort without severe colicky pain radiating to the groin',
          reason:
            'The pain pattern is inconsistent with typical ureteric colic.',
        },
        {
          clueOrder: 2,
          evidence: 'no flank pain or vomiting',
          reason:
            'The usual upper-tract pain and autonomic symptoms of acute ureteric obstruction are absent.',
        },
        {
          clueOrder: 4,
          evidence: 'nitrites, marked pyuria, and bacteriuria',
          reason:
            'The dominant laboratory pattern is bacterial inflammation rather than isolated stone-related haematuria.',
        },
      ],
      finalReasonLessLikely:
        'There is no renal colic syndrome, and bacteriuria with nitrites provides a more direct explanation.',
    },
    {
      diagnosis: 'Pelvic Inflammatory Disease',
      whyPlausibleEarly:
        'Lower abdominal discomfort and urinary symptoms can coexist with cervicitis or pelvic infection.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence:
            'no vaginal discharge, dyspareunia, or abnormal vaginal bleeding',
          reason:
            'Important symptoms of cervicitis and pelvic inflammatory disease are absent.',
        },
        {
          clueOrder: 2,
          evidence: 'afebrile and systemically well',
          reason:
            'Although pelvic inflammatory disease can be mild, there are no systemic inflammatory features.',
        },
        {
          clueOrder: 3,
          evidence:
            'suprapubic tenderness without peritonism and normal external genital inspection',
          reason:
            'The examination does not provide pelvic or genital inflammatory findings supporting this alternative.',
        },
      ],
      finalReasonLessLikely:
        'The syndrome is urinary rather than genital or pelvic, with objective bacterial urine findings.',
    },
    {
      diagnosis: 'Bladder Pain Syndrome',
      whyPlausibleEarly:
        'Frequency, urgency, and suprapubic discomfort can occur in bladder pain syndrome.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence: 'abrupt onset over 36 hours',
          reason:
            'Bladder pain syndrome is a chronic diagnosis requiring persistent symptoms rather than a brief acute illness.',
        },
        {
          clueOrder: 4,
          evidence: 'nitrites, pyuria, and bacteriuria',
          reason:
            'Objective evidence of bacterial urinary inflammation argues against a non-infectious chronic pain syndrome.',
        },
        {
          clueOrder: 5,
          evidence: 'significant growth of a single Escherichia coli isolate',
          reason:
            'The positive culture establishes an infectious explanation for the symptoms.',
        },
      ],
      finalReasonLessLikely:
        'The duration is acute and a bacterial pathogen is demonstrated; bladder pain syndrome requires a chronic non-infectious pattern.',
    },
  ] satisfies DifferentialAnalysisEntry[],
  managementPearl:
    'First establish that the illness is localised to the bladder and assess for pregnancy, systemic features, urinary obstruction, significant comorbidity, recent instrumentation, recurrent infection, and resistant-organism risk. Treat with an appropriate short-course oral antimicrobial selected according to local guidance, allergy history, renal function, prior cultures, and resistance patterns. Obtain urine culture when the diagnosis is uncertain, symptoms are atypical, treatment fails, infection recurs quickly, or risk factors make resistance or complications more likely. Provide safety-net advice for fever, rigors, flank pain, vomiting, clinical deterioration, or failure to improve.',
  generationQuality: {
    contentTier: 'FLAGSHIP',
    seedVersion,
    humanReviewed: true,
    discriminatorStrength: 'HIGH',
    clueProgressionVerified: true,
    breakdownClueReferencesValidated: true,
    educationIndependentOfCase: true,
    expectedTeachingPoints: [
      'Acute dysuria with frequency and urgency strongly supports cystitis when vaginal symptoms are absent',
      'Suprapubic discomfort and terminal dysuria localise symptoms to the bladder',
      'Fever, rigors, flank pain, vomiting, and costovertebral-angle tenderness suggest systemic or upper-tract infection',
      'Leukocyte esterase and pyuria indicate urinary inflammation',
      'Nitrites support infection with a nitrate-reducing organism but a negative nitrite result does not exclude cystitis',
      'Urine culture is not mandatory in every typical low-risk presentation but is important in selected patients',
      'Pregnancy and patient-specific risk factors alter investigation and treatment decisions',
      'Persistent haematuria or non-resolving symptoms require reassessment for alternative pathology',
    ],
    competencyDomains: [
      'General Medicine',
      'Urology',
      'Infectious Diseases',
      'Primary Care',
      'Urinalysis Interpretation',
      'Antimicrobial Stewardship',
      'Clinical Reasoning',
    ],
  },
};

const educationForFrontend = {
  title: displayLabel,
  summary: {
    definition:
      'Acute Cystitis is an acute inflammatory infection of the urinary bladder, usually caused by ascending bacteria from the periurethral region. It presents as a localised lower urinary tract syndrome unless systemic or upper-tract features are present.',
    highYieldTakeaway:
      'Acute-onset dysuria, frequency, and urgency without vaginal discharge strongly suggest Acute Cystitis. Always check for fever, rigors, flank pain, vomiting, pregnancy, obstruction, urinary instrumentation, major comorbidity, and other features that change risk classification or management.',
  },
  recognitionPattern: [
    {
      pattern: 'Acute dysuria with frequency and urgency',
      whyItMatters:
        'This symptom cluster localises inflammation to the lower urinary tract and is highly suggestive of cystitis when genital symptoms are absent.',
      progression:
        'Urothelial bacterial adherence and inflammation -> bladder irritation -> urgency, frequency, small-volume voiding, and dysuria.',
      discriminator:
        'Suprapubic discomfort and pain toward the end of micturition further support bladder localisation.',
      commonTrap:
        'Do not diagnose solely from “burning urine” without asking about vaginal discharge, vulval irritation, sexual exposure, flank pain, fever, and symptom duration.',
    },
    {
      pattern: 'Localised rather than systemic urinary infection',
      whyItMatters:
        'The distinction determines urgency, investigation, route of therapy, and the need to consider renal parenchymal involvement or sepsis.',
      progression:
        'Bladder-limited inflammation may remain localised or ascend through the ureters to involve the kidneys and produce systemic illness.',
      discriminator:
        'Fever, rigors, flank pain, vomiting, hypotension, tachycardia, or costovertebral-angle tenderness should trigger assessment for systemic UTI or pyelonephritis.',
      commonTrap:
        'Do not label a febrile or systemically unwell patient as having simple cystitis merely because dysuria is present.',
    },
    {
      pattern: 'Inflammatory urinalysis supporting bacterial infection',
      whyItMatters:
        'Urine dipstick and microscopy can support the clinical diagnosis, particularly when symptoms are incomplete, atypical, recurrent, or diagnostically uncertain.',
      progression:
        'Bacterial growth and urothelial inflammation -> pyuria, leukocyte esterase, bacteriuria, and sometimes nitrites or microscopic haematuria.',
      discriminator:
        'Nitrites are specific when positive for many nitrate-reducing organisms but are not sufficiently sensitive to exclude infection when negative.',
      commonTrap:
        'Do not treat an abnormal dipstick in an asymptomatic person as cystitis; symptoms and clinical context remain essential.',
    },
    {
      pattern: 'Risk assessment changes management',
      whyItMatters:
        'Pregnancy, male sex, childhood, urinary obstruction, renal impairment, immunosuppression, catheterisation, recent instrumentation, recurrent infection, and resistant-organism risk may require culture, broader assessment, or different treatment.',
      progression:
        'Patient and urinary tract risk factors -> higher probability of treatment failure, resistant organisms, ascending infection, or structural pathology.',
      discriminator:
        'A typical presentation in a low-risk, non-pregnant adult differs from infection in a patient with systemic features or significant complicating factors.',
      commonTrap:
        'Do not apply one investigation or antibiotic approach to every patient with lower urinary symptoms.',
    },
  ],
  keySymptoms: [
    {
      symptom: 'Dysuria',
      significance:
        'Burning or painful urination is a central symptom but is not specific; external genital inflammation and urethritis can also cause it.',
    },
    {
      symptom: 'Urinary frequency',
      significance:
        'Frequent small-volume voiding reflects bladder irritation and reduced functional storage capacity.',
    },
    {
      symptom: 'Urinary urgency',
      significance:
        'A sudden compelling need to void is common in acute bladder inflammation.',
    },
    {
      symptom: 'Suprapubic pain or pressure',
      significance:
        'Supports bladder localisation, particularly when paired with dysuria and frequency.',
    },
    {
      symptom: 'Visible or microscopic haematuria',
      significance:
        'Inflamed bladder mucosa may bleed, but persistent haematuria after infection resolves requires reassessment.',
    },
  ],
  keySigns: [
    {
      finding: 'Suprapubic tenderness',
      significance:
        'May accompany bladder inflammation but can be mild or absent.',
      discriminator:
        'It supports lower urinary localisation but is not sufficiently specific to establish the diagnosis alone.',
    },
    {
      finding: 'Absence of costovertebral-angle tenderness',
      significance:
        'Supports a bladder-limited illness when systemic features are also absent.',
      discriminator:
        'Renal-angle tenderness raises concern for upper urinary tract involvement but its absence does not absolutely exclude pyelonephritis.',
    },
    {
      finding: 'Normal temperature and haemodynamic observations',
      significance:
        'Are compatible with localised cystitis rather than systemic infection.',
      discriminator:
        'Fever, tachycardia, hypotension, or systemic toxicity requires assessment beyond simple lower urinary infection.',
    },
    {
      finding: 'Genital or pelvic inflammatory findings',
      significance:
        'Discharge, vulval erythema, ulcers, cervical motion tenderness, or adnexal tenderness suggest a genital tract alternative or coexisting diagnosis.',
      discriminator:
        'These findings redirect evaluation toward vaginitis, sexually transmitted infection, cervicitis, or pelvic inflammatory disease.',
    },
  ],
  examPearls: [
    {
      type: 'HISTORY',
      title: 'Localise the urinary syndrome',
      content:
        'Ask about dysuria, urgency, frequency, small-volume voiding, suprapubic discomfort, haematuria, fever, rigors, flank pain, vomiting, and duration.',
      whyItMatters:
        'The history usually provides the strongest distinction between bladder-limited and systemic urinary infection.',
      discriminator:
        'Lower urinary symptoms without fever or flank pain favour cystitis; systemic or upper-tract symptoms require a different assessment pathway.',
      trapAvoided:
        'Do not use the generic label “UTI” without localising the infection clinically.',
    },
    {
      type: 'DISCRIMINATOR',
      title: 'Ask about vaginal and urethral alternatives',
      content:
        'Ask about vaginal discharge, vulval itching, genital lesions, dyspareunia, abnormal bleeding, urethral discharge, and sexual exposure when relevant.',
      whyItMatters:
        'Vulvovaginitis, cervicitis, and urethritis frequently mimic dysuria from cystitis.',
      discriminator:
        'The combination of dysuria and frequency without vaginal discharge is more supportive of cystitis than dysuria accompanied by genital symptoms.',
      trapAvoided:
        'Do not treat every dysuria syndrome as bacterial cystitis without considering genital tract disease.',
    },
    {
      type: 'RISK',
      title: 'Identify factors that change management',
      content:
        'Assess pregnancy possibility, sex and age, recurrent infection, urinary obstruction, stones, renal disease, immunosuppression, diabetes, catheterisation, recent instrumentation, prior cultures, recent antibiotics, and drug allergy.',
      whyItMatters:
        'These factors influence the need for culture, imaging, antibiotic selection, duration, follow-up, and specialist assessment.',
      discriminator:
        'A clinically typical low-risk presentation can often be managed more simply than infection with systemic or complicating features.',
      trapAvoided:
        'Do not assume that treatment appropriate for a healthy non-pregnant adult applies to pregnancy, children, men, or high-risk patients.',
    },
    {
      type: 'SAFETY',
      title: 'Screen for systemic deterioration',
      content:
        'Check temperature, pulse, blood pressure, hydration, mental state, flank tenderness, vomiting, and ability to take oral fluids and medicines.',
      whyItMatters:
        'Systemic UTI, pyelonephritis, obstruction with infection, and sepsis need urgent escalation.',
      discriminator:
        'Fever, rigors, haemodynamic disturbance, renal-angle tenderness, persistent vomiting, or severe illness are not features of simple cystitis.',
      trapAvoided:
        'Do not delay escalation because the patient also reports frequency or dysuria.',
    },
  ],
  scoringSystems: [],
  investigations: [
    {
      test: 'Clinical assessment',
      interpretation:
        'In a typical low-risk presentation, the combination of acute dysuria, frequency, and urgency without vaginal symptoms may be sufficient to make a clinical diagnosis.',
      whyItMatters:
        'Not every presentation requires extensive testing, but risk factors and atypical features must be actively sought.',
    },
    {
      test: 'Urine dipstick',
      interpretation:
        'Leukocyte esterase supports pyuria; nitrites support nitrate-reducing bacteria; blood may reflect mucosal inflammation. Negative nitrites do not exclude infection, and dipstick findings must be interpreted with symptoms.',
      whyItMatters:
        'Dipstick testing can strengthen or weaken the working diagnosis when the history is not fully characteristic.',
    },
    {
      test: 'Urine microscopy',
      interpretation:
        'Pyuria and bacteriuria support urinary infection. Numerous squamous epithelial cells suggest contamination. White-cell casts raise concern for renal parenchymal involvement rather than isolated cystitis.',
      whyItMatters:
        'Microscopy helps assess inflammation, specimen quality, and possible upper-tract disease.',
    },
    {
      test: 'Urine culture and susceptibility testing',
      interpretation:
        'A single uropathogen in a symptomatic patient supports bacterial infection. Culture is particularly useful for pregnancy, recurrent or persistent symptoms, atypical presentations, treatment failure, resistant-organism risk, systemic infection, and selected higher-risk patients.',
      whyItMatters:
        'Culture confirms the organism and guides targeted antimicrobial treatment when empirical management may be unreliable.',
    },
    {
      test: 'Pregnancy testing',
      interpretation:
        'Perform when pregnancy is possible because pregnancy changes risk assessment, antibiotic choice, follow-up, and the importance of culture.',
      whyItMatters:
        'Unrecognised pregnancy may lead to inappropriate treatment and missed obstetric risk.',
    },
    {
      test: 'Sexually transmitted infection or vaginal testing',
      interpretation:
        'Consider nucleic-acid testing, swabs, or pelvic assessment when urethral discharge, genital symptoms, exposure history, sterile pyuria, or persistent dysuria suggests urethritis, cervicitis, or vaginitis.',
      whyItMatters:
        'A urinary dipstick cannot reliably distinguish every genital or urethral cause of dysuria.',
    },
    {
      test: 'Renal function, blood tests, or blood cultures',
      interpretation:
        'These are not routinely required for simple cystitis but may be indicated in systemic illness, renal impairment, obstruction, severe comorbidity, or suspected sepsis.',
      whyItMatters:
        'They assess organ dysfunction and the severity of infection beyond the bladder.',
    },
    {
      test: 'Imaging',
      interpretation:
        'Routine imaging is unnecessary in a typical resolving episode. Ultrasound or cross-sectional imaging may be needed for suspected obstruction, stones, abscess, anatomical abnormality, recurrent atypical infection, or failure to improve.',
      whyItMatters:
        'Imaging should answer a structural or complication-focused question rather than be ordered automatically.',
    },
  ],
  differentialDistinguishers: [
    {
      diagnosis: 'Acute Pyelonephritis',
      overlap:
        'Dysuria, urgency, frequency, pyuria, bacteriuria, and positive urine culture.',
      distinguishingFeatures:
        'More likely to cause fever, rigors, flank pain, vomiting, systemic illness, and costovertebral-angle tenderness.',
      decisiveClue:
        'Systemic or upper-tract features indicate infection beyond the bladder and require escalation.',
    },
    {
      diagnosis: 'Urethritis',
      overlap: 'Dysuria and urinary frequency.',
      distinguishingFeatures:
        'May be associated with urethral discharge, sexual exposure, genital symptoms, and pyuria without typical bacteriuria or nitrites.',
      decisiveClue:
        'Exposure history and appropriate sexually transmitted infection testing distinguish urethritis from bacterial cystitis.',
    },
    {
      diagnosis: 'Vulvovaginitis',
      overlap: 'Burning during urination and lower genital discomfort.',
      distinguishingFeatures:
        'Usually has vaginal discharge, vulval itching, odour, erythema, or external burning rather than urgency and small-volume voiding.',
      decisiveClue:
        'Genital symptoms and examination or swab findings support vulvovaginitis.',
    },
    {
      diagnosis: 'Nephrolithiasis',
      overlap: 'Haematuria, dysuria, urgency, and urinary discomfort.',
      distinguishingFeatures:
        'Classically causes severe colicky flank pain radiating toward the groin, restlessness, nausea, or obstruction; pyuria may occur but does not always indicate infection.',
      decisiveClue:
        'A renal colic syndrome or imaging evidence of a stone favours nephrolithiasis.',
    },
    {
      diagnosis: 'Pelvic Inflammatory Disease',
      overlap: 'Lower abdominal pain and urinary discomfort.',
      distinguishingFeatures:
        'May cause vaginal discharge, abnormal bleeding, dyspareunia, fever, cervical motion tenderness, or adnexal tenderness.',
      decisiveClue:
        'Pelvic examination and sexually transmitted infection assessment identify a genital tract source.',
    },
    {
      diagnosis: 'Bladder Pain Syndrome',
      overlap: 'Frequency, urgency, and suprapubic or bladder pain.',
      distinguishingFeatures:
        'Symptoms are chronic, often worsen with bladder filling, may improve after voiding, and occur without an active bacterial infection.',
      decisiveClue:
        'Persistent symptoms with repeatedly negative appropriate cultures support a non-infectious chronic bladder pain disorder.',
    },
  ],
  managementOverview: [
    {
      step: 'Confirm localisation and assess severity',
      rationale:
        'Identify fever, flank pain, vomiting, haemodynamic disturbance, sepsis, obstruction, or inability to take oral treatment before managing the illness as bladder-limited.',
    },
    {
      step: 'Assess patient-specific risk factors',
      rationale:
        'Pregnancy, age, sex, renal function, allergy, recurrent infection, urinary abnormalities, catheterisation, recent antibiotics, prior resistant organisms, and comorbidity influence investigations and treatment.',
    },
    {
      step: 'Use an appropriate oral antimicrobial regimen',
      rationale:
        'Select therapy according to current local or national guidance, antimicrobial resistance patterns, prior culture results, renal function, allergy history, pregnancy status, and medicine availability. Avoid unnecessary broad-spectrum treatment.',
    },
    {
      step: 'Obtain culture when clinically indicated',
      rationale:
        'Culture is important for atypical illness, pregnancy, recurrent or persistent infection, treatment failure, systemic features, resistant-organism risk, and selected complicated presentations.',
    },
    {
      step: 'Provide symptom support and practical advice',
      rationale:
        'Encourage adequate oral intake according to thirst and clinical status, provide appropriate analgesia, and explain the expected time course without suggesting that hydration alone eradicates bacterial infection.',
    },
    {
      step: 'Review response and narrow treatment when possible',
      rationale:
        'Reassess if culture shows resistance, symptoms worsen, or improvement does not occur as expected; use susceptibility results to target therapy.',
    },
    {
      step: 'Safety-net for ascending or complicated infection',
      rationale:
        'Urgent reassessment is required for fever, rigors, flank pain, vomiting, confusion, weakness, pregnancy-related concern, reduced urine output, severe pain, or clinical deterioration.',
    },
  ],
  complications: [
    'Ascending infection and acute pyelonephritis',
    'Recurrent urinary tract infection',
    'Treatment failure from antimicrobial resistance or an incorrect diagnosis',
    'Systemic urinary infection or sepsis in vulnerable patients',
    'Infected urinary obstruction',
    'Pregnancy-associated maternal and fetal complications when infection is inadequately assessed or treated',
    'Persistent haematuria requiring evaluation for stone, malignancy, or other urinary pathology',
    'Adverse effects and antimicrobial resistance from unnecessary or excessively broad antibiotic use',
  ],
  pitfalls: [
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Treating dysuria without checking for vaginal symptoms',
      content:
        'External genital inflammation, cervicitis, and urethritis can all cause painful urination.',
      whyItMatters:
        'Misclassification leads to ineffective antibiotic treatment and missed genital tract disease.',
      trapAvoided:
        'Ask specifically about discharge, itching, lesions, dyspareunia, abnormal bleeding, and sexual exposure where relevant.',
    },
    {
      type: 'SAFETY',
      title: 'Missing systemic or upper-tract infection',
      content:
        'Fever, rigors, flank pain, vomiting, costovertebral-angle tenderness, or physiological instability are not features of simple bladder-limited disease.',
      whyItMatters:
        'Pyelonephritis, obstruction with infection, and sepsis require broader and more urgent management.',
      trapAvoided:
        'Localise every urinary infection and record systemic observations.',
    },
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Diagnosing infection from dipstick alone',
      content:
        'Pyuria or bacteriuria can occur without symptomatic cystitis, and contamination can produce misleading results.',
      whyItMatters:
        'Treating asymptomatic or contaminated findings promotes adverse effects and antimicrobial resistance.',
      trapAvoided:
        'Interpret urine testing alongside symptoms, specimen quality, and patient risk.',
    },
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Using a negative nitrite result to exclude cystitis',
      content:
        'Some organisms do not produce nitrite, and frequent voiding may not allow sufficient bladder incubation time.',
      whyItMatters:
        'A negative nitrite result has limited sensitivity and can falsely reassure.',
      trapAvoided:
        'Use the full clinical pattern and other urinalysis findings rather than one dipstick parameter.',
    },
    {
      type: 'ANTIMICROBIAL_STEWARDSHIP',
      title: 'Ignoring prior cultures and local resistance',
      content:
        'Empirical therapy may fail when the organism is resistant or the patient has recent antimicrobial exposure.',
      whyItMatters:
        'Inappropriate treatment prolongs symptoms and increases risk of ascending infection and resistance.',
      trapAvoided:
        'Review previous microbiology, renal function, allergies, recent antibiotics, and current local guidance.',
    },
    {
      type: 'SAFETY',
      title: 'Failing to verify pregnancy possibility',
      content:
        'Pregnancy changes the significance of bacteriuria, antibiotic selection, follow-up, and complication risk.',
      whyItMatters:
        'Unrecognised pregnancy can lead to unsafe medicine selection or inadequate monitoring.',
      trapAvoided:
        'Assess pregnancy possibility and test when appropriate before finalising management.',
    },
    {
      type: 'FOLLOW_UP',
      title: 'Ignoring persistent haematuria or non-resolution',
      content:
        'Symptoms or blood that persist after appropriate treatment may reflect resistance, stone disease, structural pathology, malignancy, or a non-infectious diagnosis.',
      whyItMatters:
        'Repeated empirical treatment can delay identification of important alternative disease.',
      trapAvoided:
        'Reassess the diagnosis and investigate persistent or recurrent atypical features.',
    },
  ],
  recallPrompts: [
    {
      prompt:
        'Which symptom combination strongly supports Acute Cystitis when vaginal symptoms are absent?',
      answer: 'Acute dysuria with urinary frequency and urgency.',
    },
    {
      prompt:
        'Which features suggest acute pyelonephritis rather than bladder-limited cystitis?',
      answer:
        'Fever, rigors, flank pain, vomiting, systemic illness, or costovertebral-angle tenderness.',
    },
    {
      prompt: 'What does a positive urine nitrite result suggest?',
      answer:
        'It supports infection with a nitrate-reducing bacterium, although a negative result does not exclude cystitis.',
    },
    {
      prompt: 'What does leukocyte esterase indicate?',
      answer:
        'It supports the presence of urinary white blood cells and therefore urinary tract inflammation.',
    },
    {
      prompt: 'When is urine culture particularly important?',
      answer:
        'In pregnancy, atypical or recurrent illness, treatment failure, persistent symptoms, systemic infection, resistant-organism risk, and selected higher-risk presentations.',
    },
    {
      prompt:
        'Why should vaginal discharge and vulval itching be asked about in dysuria?',
      answer:
        'They suggest vaginitis or another genital tract cause rather than isolated bacterial cystitis.',
    },
    {
      prompt: 'Is routine imaging required for typical Acute Cystitis?',
      answer:
        'No. Imaging is reserved for suspected obstruction, stones, anatomical abnormality, complications, or failure to improve.',
    },
    {
      prompt: 'What should persistent haematuria after treatment prompt?',
      answer:
        'Reassessment for stone disease, structural urinary pathology, malignancy, or another diagnosis.',
    },
  ],
  references: [
    {
      citation:
        'European Association of Urology. EAU Guidelines on Urological Infections. 2026 edition.',
    },
    {
      citation:
        'National Institute for Health and Care Excellence. Urinary tract infection (lower): antimicrobial prescribing. NICE guideline NG109.',
    },
    {
      citation:
        'Gupta K, et al. International Clinical Practice Guidelines for the Treatment of Acute Uncomplicated Cystitis and Pyelonephritis in Women: A 2010 Update by IDSA and ESCMID. Clinical Infectious Diseases. 2011.',
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
    });
  });

  const educationText = normalizeClinicalText(
    JSON.stringify(educationForFrontend),
  );

  const caseSpecificEducationTerms = [
    '27 year old',
    '36 hour',
    '112 70',
    'temperature is 36 8',
    'this patient',
    'this case',
    'her urine',
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

  // Prefer the canonical registry before considering aliases, so an alias on a
  // related row cannot be updated into a canonicalNormalized unique collision.
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
          specialty: 'Infectious Disease',
          subspecialty: 'Urology',
          category: 'Lower Urinary Tract Infection',
          bodySystem: 'Genitourinary',
          organSystem: 'Urinary Bladder',
          difficultyBand: DiagnosisDifficultyBand.BASIC,
          rarityBand: DiagnosisRarityBand.COMMON,
          clinicalSetting: DiagnosisClinicalSetting.OUTPATIENT,
          ageGroup: DiagnosisAgeGroup.ADULT,
          urgencyLevel: DiagnosisUrgencyLevel.ROUTINE,
          preferredClueTypes: ['history', 'symptom', 'vital', 'exam', 'lab'],
          notes:
            'Seeded flagship Acute Cystitis case focused on bladder-localising symptoms, exclusion of vaginal and systemic features, inflammatory urinalysis, culture confirmation, and antimicrobial stewardship.',
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
          specialty: 'Infectious Disease',
          subspecialty: 'Urology',
          category: 'Lower Urinary Tract Infection',
          bodySystem: 'Genitourinary',
          organSystem: 'Urinary Bladder',
          difficultyBand: DiagnosisDifficultyBand.BASIC,
          rarityBand: DiagnosisRarityBand.COMMON,
          clinicalSetting: DiagnosisClinicalSetting.OUTPATIENT,
          ageGroup: DiagnosisAgeGroup.ADULT,
          urgencyLevel: DiagnosisUrgencyLevel.ROUTINE,
          preferredClueTypes: ['history', 'symptom', 'vital', 'exam', 'lab'],
          notes:
            'Seeded flagship Acute Cystitis case focused on bladder-localising symptoms, exclusion of vaginal and systemic features, inflammatory urinalysis, culture confirmation, and antimicrobial stewardship.',
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
      'Skipped diagnosis education because Acute Cystitis education already exists:',
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
        ? 'Skipped existing scheduled Acute Cystitis case.'
        : 'Skipped existing Acute Cystitis case to avoid overwriting authored content.',
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
    difficulty: 'basic',
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
      'Seeded complete frontend-aligned flagship Acute Cystitis case with six valid playable clues, bladder localisation, explicit exclusion of vaginal and systemic alternatives, clue-order-aligned differential analysis, and diagnosis-level education independent of the case.',
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
      difficulty: 'basic',
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
        'Created complete Acute Cystitis revision with six supported clue types, exact clue-breakdown alignment, lower-versus-upper tract reasoning, culture interpretation, and antimicrobial-stewardship teaching.',
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
      validatorVersion: 'flagship-human-review:acute-cystitis-v1',
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        clueProgressionVerified: true,
        breakdownClueReferencesValidated: true,
        educationIndependentOfCase: true,
        playableClueCount: clues.length,
        clueTypes: clues.map((clue) => clue.type),
        duplicateSafe: true,
        doesNotOverwriteExistingEducation: true,
        doesNotOverwriteExistingCase: true,
        metadataVerified: {
          specialty: 'Infectious Disease',
          subspecialty: 'Urology',
          category: 'Lower Urinary Tract Infection',
          bodySystem: 'Genitourinary',
          organSystem: 'Urinary Bladder',
          difficultyBand: 'BASIC',
          rarityBand: 'COMMON',
          clinicalSetting: 'OUTPATIENT',
          ageGroup: 'ADULT',
          urgencyLevel: 'ROUTINE',
        },
        note: 'Complete Acute Cystitis flagship seed with six supported clue types, no early diagnosis-label leakage, exact clue-to-breakdown alignment, active exclusion of pyelonephritis and genital tract mimics, and independent diagnosis education.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded Acute Cystitis:', {
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
