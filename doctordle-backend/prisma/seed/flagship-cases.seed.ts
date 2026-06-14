import {
  PrismaClient,
  CaseEditorialStatus,
  DiagnosisEducationSource,
  DiagnosisEducationStatus,
  DiagnosisMappingMethod,
  DiagnosisMappingStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required to run the Elderly UTI flagship seed.',
  );
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
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 0, 13, 12, 0, 0));
const seedVersion = 'flagship-elderly-uti-v1';

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
        dailyCases: { select: { id: true }, take: 1 },
      },
    });

    if (!owner) {
      return candidateDate;
    }

    if (params.reusableCaseId && owner.id === params.reusableCaseId) {
      return candidateDate;
    }
  }

  throw new Error(
    `Cannot seed ${params.displayLabel}: no free inventory placeholder date found.`,
  );
}

async function getNextCasePublicNumber(): Promise<number> {
  const latest = await prisma.case.findFirst({
    where: { publicNumber: { not: null } },
    orderBy: { publicNumber: 'desc' },
    select: { publicNumber: true },
  });

  return (latest?.publicNumber ?? 0) + 1;
}

// ─── Clues ────────────────────────────────────────────────────────────────────

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'An 82-year-old woman is brought to the emergency department because of worsening confusion and reduced oral intake over two days.',
  },
  {
    order: 1,
    type: 'history',
    value:
      'Her daughter reports new urinary frequency and foul-smelling urine, although the patient has not complained of dysuria.',
  },
  {
    order: 2,
    type: 'vital',
    value:
      'Temperature is 38.2°C, heart rate is 110/min, respiratory rate is 22/min, and blood pressure is 100/64 mmHg.',
  },
  {
    order: 3,
    type: 'exam',
    value:
      'Examination reveals suprapubic tenderness and mild dehydration, with no meningism or focal neurological deficit.',
  },
  {
    order: 4,
    type: 'lab',
    value:
      'Urinalysis demonstrates positive nitrites, positive leukocyte esterase, pyuria, and bacteriuria.',
  },
  {
    order: 5,
    type: 'investigation',
    value:
      'Urine culture grows Escherichia coli sensitive to ceftriaxone.',
  },
] as const;

const differentials = [
  'Delirium secondary to dehydration',
  'Community-acquired pneumonia',
  'Acute pyelonephritis',
  'Stroke',
  'Asymptomatic bacteriuria',
];

// ─── Explanation ─────────────────────────────────────────────────────────────

const explanation = {
  diagnosis: 'Urinary Tract Infection presenting with delirium in an elderly patient',

  summary:
    'This is urinary tract infection in an elderly patient: acute delirium, reduced oral intake, urinary frequency, fever, suprapubic tenderness, pyuria, bacteriuria, and urine culture growing Escherichia coli. The case highlights that older adults may present atypically without prominent dysuria.',

  keyEvidence: [
    'Acute confusion over two days',
    'Reduced oral intake',
    'New urinary frequency',
    'Foul-smelling urine',
    'Fever and tachycardia',
    'Suprapubic tenderness',
    'Positive nitrites and leukocyte esterase',
    'Pyuria and bacteriuria',
    'Urine culture growing Escherichia coli',
  ],

  reasoning: [
    'Acute confusion in an elderly patient suggests delirium and should prompt a search for infection, dehydration, medication effects, metabolic disturbance, and neurological causes.',
    'New urinary frequency and foul-smelling urine provide a urinary source, even though dysuria may be absent in older adults.',
    'Fever, tachycardia, and mild hypotension support systemic inflammatory response rather than simple asymptomatic bacteriuria.',
    'Suprapubic tenderness supports lower urinary tract involvement.',
    'Positive nitrites, leukocyte esterase, pyuria, and bacteriuria support urinary infection when paired with compatible symptoms.',
    'Urine culture growing Escherichia coli confirms the causative organism and guides antibiotic choice.',
    'The absence of focal neurological deficits makes stroke less likely as the primary cause of confusion.',
    'The absence of respiratory symptoms or chest findings makes pneumonia less likely.',
  ],

  keyFindings: [
    'Elderly patient',
    'Delirium',
    'Reduced oral intake',
    'Urinary frequency',
    'Foul-smelling urine',
    'Fever',
    'Suprapubic tenderness',
    'Positive nitrites',
    'Pyuria',
    'E. coli urine culture',
  ],

  differentials,

  whyNotOthers: [
    {
      diagnosis: 'Delirium secondary to dehydration',
      reason:
        'Dehydration contributes to delirium, but fever, urinary symptoms, pyuria, bacteriuria, and positive urine culture identify UTI as the precipitating cause.',
    },
    {
      diagnosis: 'Community-acquired pneumonia',
      reason:
        'Pneumonia can cause delirium in older adults, but this case lacks respiratory symptoms or focal chest findings and has strong urinary evidence.',
    },
    {
      diagnosis: 'Acute pyelonephritis',
      reason:
        'Systemic symptoms can occur in pyelonephritis, but there is no flank pain or costovertebral angle tenderness; this presentation is more consistent with lower UTI causing delirium.',
    },
    {
      diagnosis: 'Stroke',
      reason:
        'Stroke can cause acute confusion, but the absence of focal neurological signs and the presence of infection evidence make UTI-associated delirium more likely.',
    },
    {
      diagnosis: 'Asymptomatic bacteriuria',
      reason:
        'Asymptomatic bacteriuria is common in older adults, but this patient has fever, delirium, urinary frequency, and suprapubic tenderness, making true infection more likely.',
    },
  ],

  managementPearl:
    'In older adults, diagnose UTI only when urinary or systemic symptoms support infection; avoid treating asymptomatic bacteriuria. When infection is likely, assess delirium severity, hydration, sepsis risk, renal function, and local antibiotic guidance while awaiting culture sensitivities.',

  differentialAnalysis: [
    {
      diagnosis: 'Delirium secondary to dehydration',
      whyPlausibleEarly:
        'Reduced oral intake and confusion commonly occur with dehydration in elderly patients.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'new urinary frequency and foul-smelling urine',
          reason:
            'These symptoms suggest a urinary trigger rather than isolated dehydration.',
        },
        {
          clueOrder: 2,
          evidence: 'temperature 38.2°C and heart rate 110/min',
          reason:
            'Fever and tachycardia support infection or systemic inflammation.',
        },
        {
          clueOrder: 4,
          evidence: 'positive nitrites, leukocyte esterase, pyuria, and bacteriuria',
          reason:
            'Urinalysis supports urinary infection when paired with compatible symptoms.',
        },
      ],
      finalReasonLessLikely:
        'Dehydration may contribute, but UTI is the better unifying diagnosis.',
    },
    {
      diagnosis: 'Community-acquired pneumonia',
      whyPlausibleEarly:
        'Pneumonia may present atypically with delirium and fever in older adults.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'urinary frequency and foul-smelling urine',
          reason:
            'The symptom cluster points toward the urinary tract rather than respiratory tract.',
        },
        {
          clueOrder: 3,
          evidence: 'no focal neurological deficit and suprapubic tenderness',
          reason:
            'Suprapubic tenderness supports a urinary source; no respiratory signs are given.',
        },
        {
          clueOrder: 5,
          evidence: 'urine culture grows Escherichia coli',
          reason:
            'Culture confirms a urinary pathogen compatible with UTI.',
        },
      ],
      finalReasonLessLikely:
        'There are no respiratory symptoms or chest findings to support pneumonia.',
    },
    {
      diagnosis: 'Acute pyelonephritis',
      whyPlausibleEarly:
        'Fever with UTI findings can represent upper urinary tract infection.',
      ruledOutByClues: [
        {
          clueOrder: 3,
          evidence: 'suprapubic tenderness without flank pain or focal renal angle tenderness',
          reason:
            'Lower abdominal suprapubic tenderness favors cystitis/lower UTI over pyelonephritis.',
        },
      ],
      finalReasonLessLikely:
        'Upper tract involvement is not strongly supported by the available examination findings.',
    },
    {
      diagnosis: 'Stroke',
      whyPlausibleEarly:
        'Acute confusion in an elderly patient can be caused by cerebrovascular disease.',
      ruledOutByClues: [
        {
          clueOrder: 3,
          evidence: 'no focal neurological deficit',
          reason:
            'Stroke is less likely without focal neurological signs.',
        },
        {
          clueOrder: 4,
          evidence: 'urinalysis demonstrates pyuria and bacteriuria',
          reason:
            'The investigation supports an infective delirium trigger.',
        },
      ],
      finalReasonLessLikely:
        'The presentation is better explained by infection-associated delirium.',
    },
    {
      diagnosis: 'Asymptomatic bacteriuria',
      whyPlausibleEarly:
        'Bacteriuria is common in older adults and can be detected incidentally.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence: 'worsening confusion and reduced oral intake',
          reason:
            'The patient has an acute systemic clinical change rather than an incidental urine result.',
        },
        {
          clueOrder: 1,
          evidence: 'new urinary frequency',
          reason:
            'New urinary symptoms support symptomatic infection.',
        },
        {
          clueOrder: 2,
          evidence: 'fever and tachycardia',
          reason:
            'Systemic signs make asymptomatic bacteriuria less likely.',
        },
      ],
      finalReasonLessLikely:
        'This is symptomatic infection, not incidental bacteriuria alone.',
    },
  ],

  generationQuality: {
    contentTier: 'FLAGSHIP',
    humanReviewed: true,
    seedVersion,
  },
};

// ─── Education ────────────────────────────────────────────────────────────────

const educationForFrontend = {
  title: 'Urinary Tract Infection',

  summary: {
    definition:
      'Urinary tract infection is infection of the urinary tract, most commonly caused by ascending bacteria such as Escherichia coli. In older adults it may present with atypical features such as delirium, falls, or functional decline.',
    highYieldTakeaway:
      'Think UTI in an older adult with acute delirium plus urinary symptoms, fever, suprapubic tenderness, pyuria, and bacteriuria — but avoid treating asymptomatic bacteriuria without compatible symptoms.',
  },

  recognitionPattern: [
    {
      pattern: 'Atypical UTI presentation in older adults',
      whyItMatters:
        'Older adults may not report classic dysuria and can present with delirium, reduced intake, weakness, or falls.',
      progression:
        'Urinary infection → systemic inflammatory response → delirium, dehydration, functional decline, and possible sepsis.',
      discriminator:
        'Delirium plus urinary symptoms and inflammatory signs supports infection rather than incidental bacteriuria.',
      commonTrap:
        'Do not diagnose UTI from a positive urine dipstick alone in an older adult.',
    },
    {
      pattern: 'Lower urinary tract infection',
      whyItMatters:
        'Frequency, suprapubic tenderness, pyuria, nitrites, and bacteriuria support cystitis/lower UTI.',
      discriminator:
        'Absence of flank pain or costovertebral angle tenderness makes pyelonephritis less likely.',
      commonTrap:
        'Foul-smelling urine alone is not enough to diagnose UTI.',
    },
    {
      pattern: 'Culture-confirmed bacterial UTI',
      whyItMatters:
        'Urine culture identifies the organism and antibiotic sensitivities, especially important in older adults with comorbidity or recent antibiotic exposure.',
      discriminator:
        'E. coli is the most common pathogen in uncomplicated and many complicated UTIs.',
      commonTrap:
        'Do not ignore local resistance patterns or renal function when choosing antibiotics.',
    },
  ],

  keySymptoms: [
    {
      symptom: 'Acute confusion',
      significance:
        'May represent delirium triggered by infection, dehydration, medication effects, or metabolic disturbance in older adults.',
    },
    {
      symptom: 'Reduced oral intake',
      significance:
        'May worsen dehydration and delirium and can accompany systemic infection.',
    },
    {
      symptom: 'Urinary frequency',
      significance:
        'Supports lower urinary tract involvement when new or clearly worse than baseline.',
    },
    {
      symptom: 'Absent dysuria',
      significance:
        'Does not exclude UTI in older adults, who may present atypically.',
    },
  ],

  keySigns: [
    {
      finding: 'Fever and tachycardia',
      significance:
        'Support systemic infection rather than incidental bacteriuria.',
      discriminator:
        'Systemic signs increase concern for clinically significant infection.',
    },
    {
      finding: 'Suprapubic tenderness',
      significance:
        'Supports lower urinary tract inflammation.',
      discriminator:
        'Flank tenderness would increase suspicion for pyelonephritis.',
    },
    {
      finding: 'No focal neurological deficit',
      significance:
        'Makes stroke less likely as the primary cause of acute confusion.',
    },
    {
      finding: 'Mild dehydration',
      significance:
        'Common in elderly infection and may worsen delirium.',
    },
  ],

  examPearls: [
    {
      type: 'physical',
      title: 'Delirium needs a trigger search',
      content:
        'Acute confusion in an elderly patient should prompt evaluation for infection, dehydration, medication toxicity, metabolic disturbance, and neurological disease.',
      whyItMatters:
        'UTI is common, but it should not be assumed without compatible urinary or systemic evidence.',
      discriminator:
        'Urinary symptoms, suprapubic tenderness, fever, pyuria, and bacteriuria make UTI more likely.',
      trapAvoided:
        'Avoid anchoring on a positive urine dipstick alone.',
    },
    {
      type: 'lab_reasoning',
      title: 'Pyuria is supportive, not diagnostic alone',
      content:
        'Pyuria and bacteriuria support UTI only when symptoms or systemic signs indicate infection.',
      whyItMatters:
        'Asymptomatic bacteriuria is common in older adults and does not always require antibiotics.',
      discriminator:
        'Fever, new urinary symptoms, and delirium strengthen the diagnosis of true infection.',
      trapAvoided:
        'Do not overtreat colonization or asymptomatic bacteriuria.',
    },
    {
      type: 'lab_reasoning',
      title: 'Culture turns suspicion into targeted therapy',
      content:
        'Urine culture identifies the organism and sensitivities, allowing antibiotics to be narrowed.',
      whyItMatters:
        'Older adults are more likely to have resistant organisms, comorbidity, or renal impairment affecting antibiotic choice.',
      managementImplication:
        'Review culture results and de-escalate antibiotics when possible.',
    },
    {
      type: 'MNEMONIC',
      title: 'ELDER UTI checklist',
      content:
        'ELDER — Elderly delirium; Lower urinary symptoms; Dipstick supports; Evaluate sepsis; Review culture.',
      whyItMatters:
        'Keeps diagnosis anchored on clinical infection plus urine evidence.',
      discriminator:
        'The key separator is symptomatic infection rather than incidental bacteriuria.',
      trapAvoided:
        'Mnemonic content belongs here only; scoringSystems is intentionally reserved for formal tools.',
    },
  ],

  scoringSystems: [],

  investigations: [
    {
      test: 'Urinalysis',
      interpretation:
        'Nitrites, leukocyte esterase, pyuria, and bacteriuria support UTI when symptoms or systemic signs are present.',
      whyItMatters:
        'Rapidly supports diagnosis but must be interpreted clinically.',
    },
    {
      test: 'Urine culture',
      interpretation:
        'Identifies the causative organism and antibiotic sensitivities.',
      whyItMatters:
        'Guides targeted therapy, especially in older adults or suspected complicated infection.',
    },
    {
      test: 'Full blood count and inflammatory markers',
      interpretation:
        'May show leukocytosis or raised inflammatory markers but can be nonspecific.',
      whyItMatters:
        'Helps assess systemic illness and alternative sources of infection.',
    },
    {
      test: 'Renal function and electrolytes',
      interpretation:
        'Assesses dehydration, kidney injury, and safe antibiotic dosing.',
      whyItMatters:
        'Older adults are vulnerable to AKI and medication toxicity.',
    },
    {
      test: 'Blood cultures',
      interpretation:
        'Consider if febrile, septic, hypotensive, or clinically unstable.',
      whyItMatters:
        'Detects bacteremia and supports escalation decisions.',
    },
    {
      test: 'Imaging',
      interpretation:
        'Renal tract imaging is considered for obstruction, recurrent infection, poor response, stones, or suspected pyelonephritis complications.',
      whyItMatters:
        'Identifies complicated UTI or obstruction requiring source control.',
    },
  ],

  pitfalls: [
    {
      pitfall: 'Treating asymptomatic bacteriuria',
      consequence:
        'Unnecessary antibiotics increase resistance, adverse effects, and C. difficile risk.',
    },
    {
      pitfall: 'Assuming absence of dysuria excludes UTI',
      consequence:
        'Older adults may present atypically with delirium or functional decline.',
    },
    {
      pitfall: 'Ignoring sepsis risk',
      consequence:
        'Elderly patients can deteriorate quickly and may need early escalation.',
    },
    {
      pitfall: 'Forgetting medication and metabolic causes of delirium',
      consequence:
        'Delirium may be multifactorial; missing other triggers delays recovery.',
    },
    {
      pitfall: 'Not reviewing culture sensitivities',
      consequence:
        'Broad or ineffective antibiotics may be continued unnecessarily.',
    },
  ],

  managementOverview: [
    {
      step: 'Confirm symptomatic infection',
      rationale:
        'Use urinary symptoms, systemic signs, examination, urinalysis, and culture rather than urine dipstick alone.',
    },
    {
      step: 'Assess delirium and sepsis severity',
      rationale:
        'Check mental state, hydration, vital signs, oxygenation, lactate if indicated, and organ dysfunction.',
    },
    {
      step: 'Start empiric antibiotics when UTI is clinically likely',
      rationale:
        'Choose treatment based on severity, local guidelines, renal function, allergy history, and resistance risk.',
    },
    {
      step: 'Hydrate carefully',
      rationale:
        'Correct dehydration while monitoring for fluid overload in frail or cardiac patients.',
    },
    {
      step: 'Review culture and narrow therapy',
      rationale:
        'Targeted therapy reduces resistance and adverse effects.',
    },
    {
      step: 'Address delirium care',
      rationale:
        'Reorientation, mobilization, hydration, sleep support, sensory aids, and medication review improve recovery.',
    },
    {
      step: 'Look for complications or alternative sources',
      rationale:
        'Persistent fever, flank pain, obstruction, recurrent infection, or poor response should prompt broader assessment.',
    },
  ],

  differentialDistinguishers: [
    {
      diagnosis: 'Delirium secondary to dehydration',
      whyConfused:
        'Reduced intake and confusion are common in elderly dehydration.',
      distinguishingPoint:
        'UTI is supported by urinary symptoms, fever, suprapubic tenderness, pyuria, bacteriuria, and positive culture.',
      keySeparator:
        'Infection evidence identifies the precipitating cause.',
      classicTrap:
        'Treating dehydration alone while missing infection.',
    },
    {
      diagnosis: 'Community-acquired pneumonia',
      whyConfused:
        'Pneumonia may present with delirium and fever in older adults.',
      distinguishingPoint:
        'Respiratory symptoms, hypoxia, crackles, or chest imaging would support pneumonia.',
      keySeparator:
        'This case has a urinary symptom cluster and culture-confirmed E. coli UTI.',
    },
    {
      diagnosis: 'Acute pyelonephritis',
      whyConfused:
        'Fever and UTI findings may indicate upper tract infection.',
      distinguishingPoint:
        'Flank pain, costovertebral angle tenderness, vomiting, or marked systemic illness favors pyelonephritis.',
      keySeparator:
        'Suprapubic tenderness without flank signs favors lower UTI.',
    },
    {
      diagnosis: 'Stroke',
      whyConfused:
        'Acute confusion in an elderly patient may be neurological.',
      distinguishingPoint:
        'Focal neurological deficits, acute speech disturbance, unilateral weakness, or visual symptoms support stroke.',
      keySeparator:
        'No focal deficit and strong infection evidence favor delirium from UTI.',
    },
    {
      diagnosis: 'Asymptomatic bacteriuria',
      whyConfused:
        'Bacteriuria is common in elderly patients.',
      distinguishingPoint:
        'Asymptomatic bacteriuria lacks urinary symptoms or systemic signs attributable to infection.',
      keySeparator:
        'This patient has delirium, fever, urinary frequency, suprapubic tenderness, and culture evidence.',
      classicTrap:
        'Overtreating bacteriuria when no symptoms are present.',
    },
  ],

  complications: [
    {
      complication: 'Delirium and functional decline',
      whyItMatters:
        'UTI can precipitate acute cognitive and functional deterioration in older adults.',
    },
    {
      complication: 'Sepsis',
      whyItMatters:
        'Older adults can progress rapidly to hypotension, organ dysfunction, or bacteremia.',
    },
    {
      complication: 'Acute kidney injury',
      whyItMatters:
        'Dehydration, infection, and nephrotoxic medications increase AKI risk.',
    },
    {
      complication: 'Pyelonephritis',
      whyItMatters:
        'Ascending infection can involve the kidneys and require escalation.',
    },
    {
      complication: 'Recurrent UTI',
      whyItMatters:
        'Recurrent infection should prompt assessment for urinary retention, stones, atrophic vaginitis, catheter use, or structural abnormality.',
    },
  ],

  recallPrompts: [
    {
      prompt: 'Why can UTI present atypically in elderly patients?',
      answer:
        'Older adults may have blunted local symptoms and present with delirium, reduced intake, falls, weakness, or functional decline.',
    },
    {
      prompt: 'Why should asymptomatic bacteriuria not be treated routinely?',
      answer:
        'Because bacteriuria is common in older adults and unnecessary antibiotics cause resistance, adverse effects, and C. difficile risk without benefit.',
    },
    {
      prompt: 'What urine findings support UTI?',
      answer:
        'Positive nitrites, leukocyte esterase, pyuria, bacteriuria, and a compatible urine culture support UTI when symptoms or systemic signs are present.',
    },
    {
      prompt: 'What features would suggest pyelonephritis rather than lower UTI?',
      answer:
        'Flank pain, costovertebral angle tenderness, vomiting, higher fever, or more severe systemic illness suggest pyelonephritis.',
    },
    {
      prompt: 'What should be assessed in an elderly patient with UTI-associated delirium?',
      answer:
        'Assess sepsis severity, hydration, renal function, medications, alternative infection sources, and delirium safety risks.',
    },
  ],

  references: [],
};

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const canonicalName = 'urinary tract infection';
  const displayLabel = 'Urinary Tract Infection';
  const caseTitle = 'Urinary Tract Infection in an Elderly Patient';

  const normalizedTerms = [
    canonicalName,
    displayLabel,
    'uti',
    'urinary infection',
    'lower urinary tract infection',
    'cystitis',
  ].map(normalizeClinicalText);

  const registry = await prisma.diagnosisRegistry.findFirst({
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
      canonicalNormalized: true,
      displayLabel: true,
      active: true,
      status: true,
      isPlayable: true,
      isGeneratable: true,
    },
  });

  if (!registry) {
    throw new Error(
      'Cannot seed elderly UTI case: existing Urinary Tract Infection registry entry was not found. Do not create a duplicate elderly-specific registry.',
    );
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
    clues.find((clue) => clue.type === 'history')?.value ?? caseTitle;

  const symptoms = clues
    .filter((clue) => clue.type === 'symptom')
    .map((clue) => clue.value);

  const existingCases = await prisma.case.findMany({
    where: {
      diagnosisRegistryId: registry.id,
      title: caseTitle,
    },
    orderBy: [{ approvedAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      currentRevisionId: true,
      publicNumber: true,
      title: true,
      dailyCases: { select: { id: true }, take: 1 },
    },
  });

  const reusableCase = existingCases.find(
    (caseRecord) => caseRecord.dailyCases.length === 0,
  );

  const scheduledDuplicate = existingCases.find(
    (caseRecord) => caseRecord.dailyCases.length > 0,
  );

  if (!reusableCase && scheduledDuplicate) {
    throw new Error(
      `Cannot seed ${caseTitle}: a scheduled case already exists for this case variant (${scheduledDuplicate.id}, ${scheduledDuplicate.title}). Refusing to create a duplicate flagship inventory case.`,
    );
  }

  const publicNumber =
    reusableCase?.publicNumber ?? (await getNextCasePublicNumber());

  const assignedInventoryPlaceholderDate =
    await findAvailableInventoryPlaceholderDate({
      preferredDate: inventoryPlaceholderDate,
      reusableCaseId: reusableCase?.id,
      displayLabel: caseTitle,
    });

  const caseData = {
    title: caseTitle,
    publicNumber,
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
      'Seeded elderly-presentation UTI flagship inventory case linked to existing Urinary Tract Infection registry. No duplicate elderly-specific registry was created.',
  };

  const seededCase = reusableCase
    ? await prisma.case.update({
        where: { id: reusableCase.id },
        data: caseData,
        select: { id: true },
      })
    : await prisma.case.create({
        data: caseData,
        select: { id: true },
      });

  const revisionData = {
    source: 'MANUAL' as const,
    publishTrack: 'DAILY' as const,
    title: caseTitle,
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
      'Frontend-aligned flagship elderly UTI inventory revision using existing registry lookup and duplicate-safe case reuse.',
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
      validatorVersion: 'flagship-human-review:elderly-uti-v1',
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        note:
          'Manual frontend-aligned elderly UTI case seeded against existing Urinary Tract Infection registry with supported clue types and duplicate-safe case reuse.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded frontend-aligned elderly UTI case:', {
    registryId: registry.id,
    registryDisplayLabel: registry.displayLabel,
    caseId: seededCase.id,
    publicNumber,
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
