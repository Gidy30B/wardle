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
 * FLAGSHIP CASE SEED - Acute Rheumatic Fever
 *
 * Clinical focus:
 * - A school-age patient with migratory large-joint inflammatory arthritis.
 * - Untreated group A streptococcal pharyngitis approximately three weeks earlier.
 * - Rheumatic carditis presenting with new mitral regurgitation.
 * - Objective inflammation, prolonged PR interval, and elevated streptococcal antibodies.
 * - Doppler echocardiography confirming pathological mitral regurgitation without vegetation.
 * - Application of the revised Jones criteria without confusing acute rheumatic fever
 *   with chronic rheumatic heart disease.
 *
 * Safety:
 * - Reuses or creates the diagnosis registry and accepted aliases.
 * - Does not overwrite existing diagnosis education.
 * - Does not overwrite an existing case with the same title.
 * - Does not alter a scheduled DailyCase.
 *
 * Run:
 *   npx tsx prisma/seed/flagship-acute-rheumatic-fever.seed.ts
 *
 * Railway:
 *   railway run npx tsx prisma/seed/flagship-acute-rheumatic-fever.seed.ts
 */

const databaseUrl = resolvePgConnectionString(process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required to run the Acute Rheumatic Fever seed.',
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
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 6, 21, 12, 0, 0));
const seedVersion = 'flagship-acute-rheumatic-fever-v1';

const canonicalName = 'acute rheumatic fever';
const displayLabel = 'Acute Rheumatic Fever';
const caseTitle = 'Migratory Joint Pain with a New Cardiac Murmur';

const aliasTerms = [
  'Acute Rheumatic Fever',
  'Rheumatic Fever',
  'ARF',
  'Post-streptococcal Rheumatic Fever',
  'First-Episode Acute Rheumatic Fever',
];

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 13-year-old boy presents with four days of fever and severe pain affecting several large joints. The pain began in the right ankle, improved after one day, then appeared in the left knee and later the right wrist, making it difficult for him to walk or use his hand.',
  },
  {
    order: 1,
    type: 'history',
    value:
      'Approximately three weeks earlier, he had fever and a painful sore throat that resolved without antibiotics. He has no recent diarrhoeal illness, urethral symptoms, known autoimmune disease, previous cardiac disease, or similar earlier episodes.',
  },
  {
    order: 2,
    type: 'exam',
    value:
      'Temperature is 38.6°C and heart rate is 124/min. The left knee and right wrist are warm, swollen, and markedly tender with restricted movement, while the previously painful right ankle is now almost normal. There is no persistent small-joint synovitis or purulent skin focus.',
  },
  {
    order: 3,
    type: 'exam',
    value:
      'Cardiovascular examination reveals a new grade 3/6 pansystolic murmur loudest at the apex and radiating toward the left axilla, with a soft third heart sound. There are no splinter haemorrhages, painless palmar lesions, or focal neurological deficits.',
  },
  {
    order: 4,
    type: 'lab',
    value:
      'C-reactive protein is 86 mg/L and erythrocyte sedimentation rate is 72 mm/hour. Antistreptolysin O and anti-DNase B titres are elevated. Three blood culture sets remain negative. Electrocardiography shows sinus tachycardia with a PR interval of 220 ms.',
  },
  {
    order: 5,
    type: 'imaging',
    value:
      'Doppler echocardiography demonstrates pathological mitral regurgitation with mild left ventricular dilatation and preserved systolic function. There is no valve vegetation, congenital valve abnormality, or pericardial effusion. The combination of migratory polyarthritis, carditis, systemic inflammation, and evidence of recent group A streptococcal infection fulfils the revised Jones criteria.',
  },
] as const;

const differentials = [
  'Septic Arthritis',
  'Post-streptococcal Reactive Arthritis',
  'Juvenile Idiopathic Arthritis',
  'Infective Endocarditis',
  'Systemic Lupus Erythematosus',
  'Viral Arthritis',
];

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
}

const explanation = {
  diagnosis: displayLabel,
  summary:
    'Migratory inflammatory polyarthritis, a new mitral regurgitation murmur with Doppler-confirmed carditis, elevated inflammatory markers, PR prolongation, and serological evidence of recent group A streptococcal infection establish Acute Rheumatic Fever using the revised Jones criteria.',
  reasoning: [
    'The large-joint pain moves from one joint to another, with improvement in the previously affected joint as a new joint becomes inflamed; this migratory pattern is characteristic of rheumatic polyarthritis.',
    'The untreated sore throat approximately three weeks earlier provides the expected latent interval after group A streptococcal pharyngitis and is supported by elevated antistreptolysin O and anti-DNase B titres.',
    'Fever, tachycardia, raised C-reactive protein, and elevated erythrocyte sedimentation rate demonstrate an active systemic inflammatory process.',
    'A new apical pansystolic murmur radiating to the axilla indicates mitral regurgitation and raises concern for carditis rather than an isolated arthritis syndrome.',
    'Negative blood cultures and absence of vegetations or peripheral vascular stigmata make infective endocarditis substantially less likely.',
    'PR prolongation is a minor Jones manifestation when carditis is not being counted as the same criterion and supports conduction-system involvement in the broader inflammatory syndrome.',
    'Doppler echocardiography confirms pathological mitral regurgitation, allowing clinical or subclinical carditis to be recognized even when structural valve destruction or vegetation is absent.',
    'This first episode has two major manifestations—migratory polyarthritis and carditis—plus evidence of preceding group A streptococcal infection, satisfying the revised Jones criteria.',
  ],
  keyFindings: [
    'Age 13 years',
    'Four days of fever',
    'Severe migratory large-joint pain',
    'Right ankle involvement followed by left knee and right wrist involvement',
    'Resolution of inflammation in the previously affected joint',
    'Untreated sore throat approximately three weeks earlier',
    'Temperature 38.6°C',
    'Heart rate 124/min',
    'Warm swollen large joints with restricted movement',
    'New apical pansystolic murmur radiating to the axilla',
    'Soft third heart sound',
    'C-reactive protein 86 mg/L',
    'Erythrocyte sedimentation rate 72 mm/hour',
    'Elevated antistreptolysin O titre',
    'Elevated anti-DNase B titre',
    'Negative blood cultures',
    'PR interval 220 ms',
    'Pathological mitral regurgitation on Doppler echocardiography',
    'Mild left ventricular dilatation',
    'No valve vegetation',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Septic Arthritis',
      whyPlausibleEarly:
        'Fever with an acutely hot, swollen, painful joint must initially raise concern for bacterial joint infection.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence:
            'joint inflammation migrates from the ankle to the knee and wrist as earlier joints improve',
          reason:
            'Septic arthritis usually remains focused in one joint rather than rapidly migrating between large joints.',
        },
        {
          clueOrder: 3,
          evidence: 'new mitral regurgitation murmur',
          reason:
            'Cardiac involvement suggests a multisystem post-infectious inflammatory syndrome rather than isolated bacterial arthritis.',
        },
        {
          clueOrder: 4,
          evidence:
            'negative blood cultures with elevated streptococcal antibody titres',
          reason:
            'The laboratory pattern supports a recent antecedent streptococcal infection rather than current invasive bacteraemia.',
        },
      ],
      finalReasonLessLikely:
        'Septic arthritis remains an emergency in a persistently inflamed single joint, but the migratory pattern, carditis, negative cultures, and post-streptococcal evidence support Acute Rheumatic Fever.',
    },
    {
      diagnosis: 'Post-streptococcal Reactive Arthritis',
      whyPlausibleEarly:
        'Both disorders can follow group A streptococcal infection and produce inflammatory joint symptoms.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence: 'rapidly migratory large-joint arthritis',
          reason:
            'Classic rheumatic arthritis is fleeting and migratory, whereas post-streptococcal reactive arthritis is often more persistent, additive, or less responsive.',
        },
        {
          clueOrder: 3,
          evidence: 'new apical pansystolic murmur with a third heart sound',
          reason:
            'Definite carditis strongly favors Acute Rheumatic Fever over uncomplicated post-streptococcal reactive arthritis.',
        },
        {
          clueOrder: 5,
          evidence:
            'pathological mitral regurgitation on Doppler echocardiography',
          reason:
            'Objective valvulitis fulfills a major Jones manifestation and moves the diagnosis beyond an isolated reactive arthritis.',
        },
      ],
      finalReasonLessLikely:
        'The migratory arthritis plus Doppler-confirmed carditis satisfies a Jones-criteria pattern rather than isolated post-streptococcal reactive arthritis.',
    },
    {
      diagnosis: 'Juvenile Idiopathic Arthritis',
      whyPlausibleEarly:
        'Fever and inflammatory arthritis in a child may suggest juvenile idiopathic arthritis.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence: 'only four days of rapidly migrating arthritis',
          reason:
            'Juvenile idiopathic arthritis requires persistent arthritis and does not typically resolve in one joint as another becomes inflamed over hours to days.',
        },
        {
          clueOrder: 1,
          evidence: 'untreated sore throat three weeks earlier',
          reason:
            'A clear post-streptococcal interval supports a triggered immune syndrome rather than idiopathic chronic arthritis.',
        },
        {
          clueOrder: 5,
          evidence: 'mitral valvulitis with streptococcal serological evidence',
          reason:
            'This combination is characteristic of rheumatic fever and is not explained by juvenile idiopathic arthritis.',
        },
      ],
      finalReasonLessLikely:
        'The brief migratory course, antecedent streptococcal infection, and rheumatic carditis are inconsistent with chronic idiopathic arthritis.',
    },
    {
      diagnosis: 'Infective Endocarditis',
      whyPlausibleEarly:
        'Fever and a new regurgitant murmur can indicate infective endocarditis, which may also produce musculoskeletal symptoms.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence: 'classic migratory inflammatory polyarthritis',
          reason:
            'The joint pattern is more typical of rheumatic fever than the arthralgia or immune-complex manifestations of endocarditis.',
        },
        {
          clueOrder: 3,
          evidence:
            'no splinter haemorrhages, painless palmar lesions, or focal neurological deficits',
          reason:
            'The examination lacks supportive vascular or embolic manifestations, although their absence alone would not exclude endocarditis.',
        },
        {
          clueOrder: 4,
          evidence: 'three blood culture sets remain negative',
          reason:
            'Repeated negative cultures reduce the likelihood of typical bacterial endocarditis in this untreated patient.',
        },
        {
          clueOrder: 5,
          evidence:
            'pathological mitral regurgitation without vegetation or destructive valve lesion',
          reason:
            'The echo pattern supports inflammatory valvulitis rather than an infected vegetation.',
        },
      ],
      finalReasonLessLikely:
        'The post-streptococcal migratory arthritis, negative cultures, absence of vegetation, and Jones-criteria pattern favor rheumatic carditis rather than infective endocarditis.',
    },
    {
      diagnosis: 'Systemic Lupus Erythematosus',
      whyPlausibleEarly:
        'Systemic lupus erythematosus can produce fever, inflammatory arthritis, carditis, and valvular abnormalities.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence: 'fleeting migratory large-joint inflammation',
          reason:
            'Lupus arthritis is usually symmetric, non-erosive, and more persistent rather than classically migratory.',
        },
        {
          clueOrder: 1,
          evidence:
            'recent untreated sore throat with an appropriate latent interval',
          reason:
            'The temporal relationship supports a post-streptococcal syndrome.',
        },
        {
          clueOrder: 4,
          evidence: 'elevated antistreptolysin O and anti-DNase B titres',
          reason:
            'Evidence of recent group A streptococcal infection provides the required trigger for rheumatic fever.',
        },
      ],
      finalReasonLessLikely:
        'The classic migratory arthritis, recent streptococcal infection, and mitral valvulitis are better unified by Acute Rheumatic Fever.',
    },
    {
      diagnosis: 'Viral Arthritis',
      whyPlausibleEarly:
        'Viral infections can produce fever and acute polyarthritis in children and adolescents.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence:
            'severe migratory inflammation affecting large joints sequentially',
          reason:
            'Many viral arthritides are symmetric or diffuse rather than fleeting and migratory between large joints.',
        },
        {
          clueOrder: 3,
          evidence: 'new mitral regurgitation murmur',
          reason:
            'A new valvular murmur is not explained by uncomplicated viral arthritis.',
        },
        {
          clueOrder: 5,
          evidence:
            'Doppler-confirmed pathological mitral regurgitation with recent streptococcal evidence',
          reason:
            'The combined cardiac and post-streptococcal findings satisfy a specific rheumatic fever pattern.',
        },
      ],
      finalReasonLessLikely:
        'Viral arthritis does not adequately explain rheumatic carditis and the Jones-criteria combination.',
    },
  ],
  managementPearl:
    'Management has four linked goals: eradicate any remaining group A streptococci with guideline-directed penicillin therapy, control arthritis and systemic inflammation, identify and treat carditis or heart failure, and begin long-term secondary antibiotic prophylaxis to prevent recurrence. The prophylaxis schedule and duration should follow local rheumatic-heart-disease guidance and reflect whether carditis or residual valve disease is present.',
  generationQuality: {
    contentTier: 'FLAGSHIP',
    seedVersion,
    humanReviewed: true,
    discriminatorStrength: 'VERY_HIGH',
    clueProgressionVerified: true,
    expectedTeachingPoints: [
      'Acute Rheumatic Fever follows group A streptococcal infection after a latent interval rather than during active pharyngitis',
      'Migratory large-joint polyarthritis is a major Jones manifestation',
      'Clinical or subclinical carditis detected by Doppler echocardiography is a major Jones manifestation',
      'Evidence of preceding group A streptococcal infection is generally required for diagnosis',
      'The Jones criteria depend on whether the patient comes from a low-risk or moderate-to-high-risk population',
      'PR prolongation is a minor manifestation but should not be double-counted when carditis explains the conduction finding',
      'Negative blood cultures and absent vegetation help distinguish rheumatic carditis from infective endocarditis',
      'Secondary benzathine penicillin prophylaxis prevents recurrent attacks and progressive rheumatic heart disease',
    ],
    competencyDomains: [
      'Paediatrics',
      'Paediatric Cardiology',
      'Post-infectious Disease',
      'Valvular Heart Disease',
      'Clinical Reasoning',
      'Diagnostic Criteria',
      'Prevention',
    ],
  },
};

const educationForFrontend = {
  title: displayLabel,
  summary: {
    definition:
      'Acute Rheumatic Fever is a delayed, immune-mediated inflammatory complication of group A streptococcal infection that can affect the heart, joints, central nervous system, skin, and subcutaneous tissues.',
    highYieldTakeaway:
      'Think of Acute Rheumatic Fever when a child or adolescent develops migratory large-joint arthritis, carditis, chorea, erythema marginatum, or subcutaneous nodules after recent streptococcal infection; confirm the pattern using the risk-adjusted revised Jones criteria.',
  },
  recognitionPattern: [
    {
      pattern: 'Delayed illness after group A streptococcal infection',
      whyItMatters:
        'The manifestations usually begin after the throat or skin illness has improved, so the original infection may no longer be clinically apparent.',
      progression:
        'Streptococcal infection -> latent interval -> immune-mediated inflammation affecting joints, heart, brain, or skin.',
      discriminator:
        'Elevated or rising streptococcal antibody titres can establish preceding infection when throat testing is already negative.',
      commonTrap:
        'Do not require an active sore throat at the time of rheumatic fever presentation.',
    },
    {
      pattern: 'Fleeting migratory large-joint arthritis',
      whyItMatters:
        'Joint inflammation often improves in one large joint as another becomes painful and swollen.',
      progression:
        'Ankle or knee involvement -> rapid improvement -> sequential involvement of another large joint.',
      discriminator:
        'The migratory pattern differs from persistent septic monoarthritis, chronic juvenile idiopathic arthritis, and many symmetric viral arthritides.',
      commonTrap:
        'Do not label all post-streptococcal joint disease as rheumatic fever without assessing the complete Jones-criteria pattern.',
    },
    {
      pattern: 'Clinical or subclinical carditis',
      whyItMatters:
        'Carditis is the manifestation most strongly linked to long-term rheumatic heart disease and may be audible, silent, or severe.',
      progression:
        'Valvulitis -> pathological regurgitation -> chamber dilatation or heart failure in more severe disease.',
      discriminator:
        'Doppler echocardiography can identify pathological mitral or aortic regurgitation even when auscultation is unrevealing.',
      commonTrap:
        'Do not exclude carditis because the murmur is soft or absent.',
    },
    {
      pattern: 'Risk-adjusted Jones criteria',
      whyItMatters:
        'The threshold definitions for joint manifestations, fever, and inflammatory markers differ between low-risk and moderate-to-high-risk populations.',
      progression:
        'Identify population risk -> document major and minor manifestations -> establish preceding streptococcal infection -> exclude stronger alternatives.',
      discriminator:
        'For a first episode, the usual framework is two major manifestations or one major plus two minor manifestations, together with evidence of preceding group A streptococcal infection.',
      commonTrap:
        'Do not apply low-risk thresholds automatically in settings with a high burden of rheumatic fever or rheumatic heart disease.',
    },
  ],
  keySymptoms: [
    {
      symptom: 'Migratory joint pain',
      significance:
        'Pain and swelling move between large joints and may respond dramatically to anti-inflammatory treatment.',
    },
    {
      symptom: 'Fever',
      significance:
        'Fever supports active inflammation and may contribute a minor criterion depending on the population-risk threshold.',
    },
    {
      symptom: 'Breathlessness, orthopnoea, or reduced exercise tolerance',
      significance:
        'These symptoms may indicate clinically important carditis, valve regurgitation, or heart failure.',
    },
    {
      symptom: 'Involuntary movements or emotional lability',
      significance:
        'These may indicate Sydenham chorea, which can appear months after the triggering infection and may occur when other inflammatory findings have resolved.',
    },
  ],
  keySigns: [
    {
      finding: 'Migratory large-joint inflammatory arthritis',
      significance: 'A major Jones manifestation in the classic pattern.',
      discriminator:
        'The previously affected joint improves as another large joint becomes inflamed.',
    },
    {
      finding: 'New mitral or aortic regurgitation murmur',
      significance: 'Suggests rheumatic valvulitis and clinical carditis.',
      discriminator:
        'Mitral regurgitation is common in acute carditis; mitral stenosis is a chronic rheumatic heart disease lesion rather than the typical acute finding.',
    },
    {
      finding: 'Tachycardia out of proportion to fever',
      significance:
        'May raise concern for carditis, although it is not specific and must be interpreted with the broader examination.',
      discriminator:
        'Persistent tachycardia with a new murmur or heart-failure signs warrants echocardiographic assessment.',
    },
    {
      finding: 'Sydenham chorea',
      significance:
        'Purposeful movement is interrupted by involuntary, irregular movements with hypotonia and behavioral change.',
      discriminator:
        'Chorea may be a late isolated manifestation and can support the diagnosis even when streptococcal titres or other criteria are no longer prominent.',
    },
    {
      finding: 'Erythema marginatum or subcutaneous nodules',
      significance:
        'These uncommon but characteristic skin manifestations count as major Jones manifestations.',
      discriminator:
        'Erythema marginatum is typically non-pruritic and serpiginous, while nodules are firm and painless over extensor surfaces or bony prominences.',
    },
  ],
  examPearls: [
    {
      type: 'DISCRIMINATOR',
      title: 'Map the movement of the arthritis',
      content:
        'Ask which joint was affected first, whether it improved, and which joint became inflamed next.',
      whyItMatters:
        'The sequence distinguishes migratory rheumatic polyarthritis from additive, persistent, or monoarticular disease.',
      discriminator:
        'Rapid resolution in one large joint as another becomes inflamed strongly supports the rheumatic pattern.',
      trapAvoided:
        'Do not record only “polyarthritis” without describing its chronology.',
    },
    {
      type: 'CARDIAC',
      title: 'Use echocardiography even when auscultation is subtle',
      content:
        'Assess for pathological mitral or aortic regurgitation and evidence of chamber or ventricular involvement.',
      whyItMatters:
        'Subclinical carditis is a major manifestation under the revised Jones criteria.',
      discriminator:
        'Pathological Doppler regurgitation must meet accepted duration, velocity, jet-length, and multi-view features rather than representing physiological regurgitation.',
      trapAvoided:
        'Do not count trivial physiological regurgitation as carditis.',
    },
    {
      type: 'DIAGNOSTIC_CRITERIA',
      title: 'Establish population risk before scoring',
      content:
        'Determine whether the relevant population is low risk or moderate-to-high risk before applying joint, fever, ESR, and CRP thresholds.',
      whyItMatters:
        'Risk-adjusted criteria improve sensitivity in communities where rheumatic fever remains common.',
      discriminator:
        'Monoarthritis or polyarthralgia may count as major manifestations in moderate-to-high-risk populations but not in low-risk populations.',
      trapAvoided:
        'Do not use one universal threshold regardless of epidemiology.',
    },
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Do not double-count manifestations',
      content:
        'A finding should not be used simultaneously as both a major and minor manifestation, and PR prolongation should be interpreted cautiously when carditis is already present.',
      whyItMatters:
        'Double-counting can create a false Jones-criteria diagnosis.',
      discriminator:
        'Count independent manifestations and preserve the distinction between diagnostic support and duplicate evidence.',
      trapAvoided:
        'Do not count polyarthritis as both major arthritis and minor arthralgia.',
    },
  ],
  scoringSystems: [
    {
      id: 'revised-jones-criteria-2015',
      name: 'Revised Jones Criteria for Acute Rheumatic Fever',
      use: 'Supports diagnosis of an initial or recurrent episode using population-risk definitions, major and minor manifestations, and evidence of preceding group A streptococcal infection.',
      components: [
        'Major manifestations: carditis, arthritis pattern according to population risk, Sydenham chorea, erythema marginatum, and subcutaneous nodules',
        'Minor manifestations: arthralgia pattern, fever, elevated ESR or CRP, and prolonged PR interval according to population-risk thresholds',
        'Evidence of preceding group A streptococcal infection: positive culture or rapid test, recent scarlet fever, or elevated/rising streptococcal antibody titre',
        'Typical first-episode threshold: two major manifestations or one major plus two minor manifestations, with preceding streptococcal evidence',
        'Exceptions and recurrent-episode rules require clinical judgment and guideline-specific application',
      ],
      caution:
        'The Jones criteria support but do not replace clinical judgment. Alternative diagnoses must be excluded, manifestations must not be double-counted, and population risk must be established before applying thresholds.',
    },
  ],
  investigations: [
    {
      test: 'Evidence of preceding group A streptococcal infection',
      interpretation:
        'Use throat culture or rapid antigen testing when infection is still active and antistreptolysin O or anti-DNase B titres when the pharyngitis has resolved. A rising titre is stronger evidence than a single isolated value.',
      whyItMatters:
        'Most first episodes require evidence of a recent streptococcal trigger.',
    },
    {
      test: 'C-reactive protein and erythrocyte sedimentation rate',
      interpretation:
        'Elevated values support systemic inflammation and may fulfil a minor criterion using risk-adjusted thresholds.',
      whyItMatters:
        'Inflammatory markers help document disease activity but are not specific for rheumatic fever.',
    },
    {
      test: 'Electrocardiography',
      interpretation:
        'PR prolongation may count as a minor manifestation, while rhythm and conduction assessment also helps identify cardiac involvement.',
      whyItMatters:
        'The ECG adds objective evidence but does not establish carditis by itself.',
    },
    {
      test: 'Doppler echocardiography',
      interpretation:
        'Assess for pathological mitral or aortic regurgitation, ventricular function, chamber enlargement, and pericardial involvement; exclude congenital lesions and vegetation.',
      whyItMatters:
        'Echo identifies subclinical carditis and establishes the baseline needed for follow-up and prophylaxis planning.',
    },
    {
      test: 'Blood cultures when fever and a new murmur are present',
      interpretation:
        'Repeated positive cultures support infective endocarditis, while negative cultures and absent vegetation favor non-infective valvulitis in the appropriate clinical setting.',
      whyItMatters:
        'Infective endocarditis is a dangerous mimic that requires a different treatment pathway.',
    },
    {
      test: 'Joint aspiration when septic arthritis cannot be excluded',
      interpretation:
        'A persistently inflamed single joint, marked toxicity, or atypical joint pattern warrants synovial-fluid cell count, Gram stain, and culture.',
      whyItMatters:
        'The diagnosis of rheumatic fever must not delay drainage and antibiotics for true septic arthritis.',
    },
  ],
  differentialDistinguishers: [
    {
      diagnosis: 'Septic Arthritis',
      overlap: 'Fever with a hot, swollen, painful joint.',
      distinguishingFeatures:
        'Usually persistent monoarthritis or oligoarthritis with a focal joint source; synovial culture may be positive and cardiac valvulitis is not explained.',
      decisiveClue:
        'Rapid migration between large joints plus post-streptococcal carditis favors rheumatic fever.',
    },
    {
      diagnosis: 'Post-streptococcal Reactive Arthritis',
      overlap: 'Inflammatory arthritis after streptococcal infection.',
      distinguishingFeatures:
        'Often more persistent, additive, or less classically migratory, and does not independently satisfy the complete Jones-criteria pattern.',
      decisiveClue:
        'Doppler-confirmed carditis with classic migratory arthritis supports Acute Rheumatic Fever.',
    },
    {
      diagnosis: 'Juvenile Idiopathic Arthritis',
      overlap: 'Childhood fever and inflammatory arthritis.',
      distinguishingFeatures:
        'Arthritis persists for weeks, may involve characteristic chronic patterns, and lacks a required post-streptococcal trigger.',
      decisiveClue:
        'Fleeting migratory arthritis with rheumatic valvulitis is inconsistent with chronic idiopathic arthritis.',
    },
    {
      diagnosis: 'Infective Endocarditis',
      overlap: 'Fever, new murmur, inflammation, and musculoskeletal symptoms.',
      distinguishingFeatures:
        'Positive blood cultures, vegetation, embolic phenomena, or destructive valve infection support endocarditis.',
      decisiveClue:
        'Negative cultures, no vegetation, and a Jones-criteria post-streptococcal syndrome favor rheumatic carditis.',
    },
    {
      diagnosis: 'Systemic Lupus Erythematosus',
      overlap: 'Fever, arthritis, carditis, and possible valve disease.',
      distinguishingFeatures:
        'Usually has broader autoimmune features, persistent symmetric arthritis, cytopenias, nephritis, or disease-specific serology.',
      decisiveClue:
        'The migratory large-joint pattern and documented recent streptococcal infection support rheumatic fever.',
    },
    {
      diagnosis: 'Viral Arthritis',
      overlap: 'Acute fever and polyarthritis.',
      distinguishingFeatures:
        'Often symmetric or diffuse and lacks pathological rheumatic valvulitis or a Jones-criteria pattern.',
      decisiveClue:
        'New mitral regurgitation with streptococcal evidence is not explained by uncomplicated viral arthritis.',
    },
  ],
  managementOverview: [
    {
      step: 'Assess severity and admit patients with carditis or diagnostic uncertainty',
      rationale:
        'Hospital assessment allows rhythm monitoring, echocardiography, heart-failure evaluation, and exclusion of septic arthritis or infective endocarditis.',
    },
    {
      step: 'Eradicate group A streptococci',
      rationale:
        'Guideline-directed penicillin therapy is recommended even when pharyngitis has resolved, unless a complete eradication course has already been given; alternatives depend on allergy and local guidance.',
    },
    {
      step: 'Treat arthritis and systemic inflammation',
      rationale:
        'Aspirin or another non-steroidal anti-inflammatory drug can provide rapid relief of rheumatic arthritis after septic arthritis has been reasonably excluded.',
    },
    {
      step: 'Treat carditis and heart failure according to severity',
      rationale:
        'Provide activity restriction during active inflammation and use specialist-directed heart-failure therapy when significant regurgitation, ventricular dysfunction, or congestion is present. Corticosteroids may be considered in selected severe carditis but are not a universal requirement.',
    },
    {
      step: 'Start long-term secondary antibiotic prophylaxis',
      rationale:
        'Regular benzathine penicillin G is the preferred strategy in many guidelines because recurrent streptococcal infections can trigger additional attacks and progressive valve damage.',
    },
    {
      step: 'Arrange longitudinal cardiac and prevention follow-up',
      rationale:
        'Repeat clinical and echocardiographic assessment, document residual valve disease, support prophylaxis adherence, provide dental and infection-prevention education, and tailor prophylaxis duration to carditis and valve status.',
    },
  ],
  complications: [
    'Persistent mitral or aortic regurgitation',
    'Chronic rheumatic heart disease',
    'Heart failure during severe carditis',
    'Recurrent Acute Rheumatic Fever',
    'Progressive valve stenosis or regurgitation over time',
    'Atrial arrhythmias in established rheumatic valve disease',
    'Infective endocarditis risk in patients with residual valve disease',
    'Stroke or systemic embolism in advanced rheumatic valve disease with atrial fibrillation',
    'Functional impairment during Sydenham chorea',
    'Reduced adherence to prolonged secondary prophylaxis',
  ],
  pitfalls: [
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Calling every post-streptococcal arthritis rheumatic fever',
      content:
        'A recent sore throat plus joint pain is not sufficient; apply the risk-adjusted Jones criteria and assess for carditis and stronger alternatives.',
      whyItMatters:
        'Incorrect diagnosis can commit a patient to years of prophylaxis, while underdiagnosis risks recurrent valve damage.',
      trapAvoided:
        'Do not diagnose from an elevated antistreptolysin O titre alone.',
    },
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Missing subclinical carditis',
      content:
        'Pathological regurgitation may be present on Doppler echocardiography even without an obvious murmur.',
      whyItMatters:
        'Carditis changes prognosis, follow-up, and secondary-prophylaxis planning.',
      trapAvoided: 'Do not rely on auscultation alone.',
    },
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Confusing acute carditis with chronic rheumatic valve disease',
      content:
        'Acute rheumatic carditis commonly causes mitral or aortic regurgitation; established stenotic lesions generally reflect chronic scarring.',
      whyItMatters:
        'The distinction preserves correct disease staging and prevents misleading case clues.',
      trapAvoided:
        'Do not make mitral stenosis the defining acute clue in a first episode.',
    },
    {
      type: 'ESCALATION',
      title: 'Failing to exclude septic arthritis or endocarditis',
      content:
        'A toxic patient, persistent monoarthritis, positive cultures, vegetation, or embolic signs require urgent investigation for bacterial infection.',
      whyItMatters:
        'Anti-inflammatory treatment alone would be unsafe in an unrecognized invasive infection.',
      trapAvoided:
        'Do not let a plausible Jones-criteria pattern override red flags for bacterial disease.',
    },
    {
      type: 'PREVENTION',
      title: 'Stopping secondary prophylaxis too early',
      content:
        'The duration depends on age, time since the last attack, presence of carditis, and residual valve disease.',
      whyItMatters: 'Recurrent attacks increase cumulative valve damage.',
      trapAvoided:
        'Do not use one fixed prophylaxis duration for every patient.',
    },
  ],
  recallPrompts: [
    {
      prompt: 'What is the classic joint pattern in Acute Rheumatic Fever?',
      answer:
        'A fleeting migratory inflammatory arthritis that predominantly affects large joints.',
    },
    {
      prompt: 'Which acute cardiac lesion is common in rheumatic carditis?',
      answer:
        'Mitral regurgitation, sometimes with aortic regurgitation; mitral stenosis is usually a chronic sequela.',
    },
    {
      prompt:
        'Why is Doppler echocardiography essential in suspected Acute Rheumatic Fever?',
      answer:
        'It can detect subclinical pathological valvular regurgitation and assess ventricular function and complications.',
    },
    {
      prompt:
        'What evidence can establish preceding group A streptococcal infection after the sore throat has resolved?',
      answer:
        'Elevated or rising streptococcal antibody titres such as antistreptolysin O or anti-DNase B.',
    },
    {
      prompt: 'What is the usual Jones-criteria pattern for a first episode?',
      answer:
        'Two major manifestations or one major plus two minor manifestations, together with evidence of preceding group A streptococcal infection, while excluding stronger alternatives.',
    },
    {
      prompt:
        'What intervention prevents recurrent attacks and progressive valve damage?',
      answer:
        'Long-term secondary antibiotic prophylaxis, commonly with regular intramuscular benzathine penicillin G according to local guidance.',
    },
  ],
  references: [
    {
      citation:
        'Gewitz MH, et al. Revision of the Jones Criteria for the Diagnosis of Acute Rheumatic Fever in the Era of Doppler Echocardiography. Circulation. 2015.',
    },
    {
      citation:
        'World Health Organization. WHO guideline on the prevention and diagnosis of rheumatic fever and rheumatic heart disease. 2024.',
    },
    {
      citation:
        'Centers for Disease Control and Prevention. Clinical Guidance for Acute Rheumatic Fever and Diagnosing Acute Rheumatic Fever. Updated 2025.',
    },
  ],
};

async function ensureRegistry() {
  const normalizedTerms = aliasTerms.map(normalizeClinicalText);
  const canonicalNormalized = normalizeClinicalText(canonicalName);

  const existing = await prisma.diagnosisRegistry.findFirst({
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
          specialty: 'Paediatrics',
          subspecialty: 'Paediatric Cardiology',
          category: 'Post-streptococcal Inflammatory Disease',
          bodySystem: 'Cardiovascular / Musculoskeletal',
          organSystem: 'Heart / Joints',
          difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
          rarityBand: DiagnosisRarityBand.UNCOMMON,
          clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
          ageGroup: DiagnosisAgeGroup.PEDIATRIC,
          urgencyLevel: DiagnosisUrgencyLevel.URGENT,
          preferredClueTypes: ['history', 'exam', 'lab', 'imaging'],
          notes:
            'Seeded flagship Acute Rheumatic Fever case focused on migratory polyarthritis, rheumatic carditis, recent group A streptococcal infection, and risk-adjusted revised Jones criteria.',
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
          specialty: 'Paediatrics',
          subspecialty: 'Paediatric Cardiology',
          category: 'Post-streptococcal Inflammatory Disease',
          bodySystem: 'Cardiovascular / Musculoskeletal',
          organSystem: 'Heart / Joints',
          difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
          rarityBand: DiagnosisRarityBand.UNCOMMON,
          clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
          ageGroup: DiagnosisAgeGroup.PEDIATRIC,
          urgencyLevel: DiagnosisUrgencyLevel.URGENT,
          preferredClueTypes: ['history', 'exam', 'lab', 'imaging'],
          notes:
            'Seeded flagship Acute Rheumatic Fever case focused on migratory polyarthritis, rheumatic carditis, recent group A streptococcal infection, and risk-adjusted revised Jones criteria.',
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
      'Skipped diagnosis education because Acute Rheumatic Fever education already exists:',
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
        ? 'Skipped existing scheduled Acute Rheumatic Fever case.'
        : 'Skipped existing Acute Rheumatic Fever case to avoid overwriting authored content.',
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
  const symptoms = [clues[0].value, clues[1].value, clues[2].value];

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
      'Seeded complete frontend-aligned flagship Acute Rheumatic Fever case with migratory polyarthritis, Doppler-confirmed carditis, evidence of preceding group A streptococcal infection, Jones-criteria reasoning, and full diagnosis education.',
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
        'Created complete Acute Rheumatic Fever revision with clue-order-aligned differential analysis, risk-adjusted Jones-criteria teaching, and full diagnosis education.',
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
      validatorVersion: 'flagship-human-review:acute-rheumatic-fever-v1',
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        clueProgressionVerified: true,
        playableClueCount: clues.length,
        duplicateSafe: true,
        doesNotOverwriteExistingEducation: true,
        doesNotOverwriteExistingCase: true,
        metadataVerified: {
          specialty: 'Paediatrics',
          subspecialty: 'Paediatric Cardiology',
          category: 'Post-streptococcal Inflammatory Disease',
          bodySystem: 'Cardiovascular / Musculoskeletal',
          organSystem: 'Heart / Joints',
          difficultyBand: 'INTERMEDIATE',
          rarityBand: 'UNCOMMON',
          clinicalSetting: 'EMERGENCY',
          ageGroup: 'PEDIATRIC',
          urgencyLevel: 'URGENT',
        },
        note: 'Complete Acute Rheumatic Fever flagship seed with six playable clues, no early diagnosis leakage, correct clue-to-reasoning alignment, explicit Jones-criteria interpretation, and full education payload.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded Acute Rheumatic Fever:', {
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
