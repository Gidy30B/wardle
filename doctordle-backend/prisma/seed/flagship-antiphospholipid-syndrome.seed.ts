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
 * FLAGSHIP CASE SEED - Antiphospholipid Syndrome
 *
 * Clinical focus:
 * - New unprovoked proximal venous thrombosis with pulmonary embolism.
 * - Livedo reticularis and mild thrombocytopenia as supportive features.
 * - Previous unprovoked thrombosis and characteristic pregnancy morbidity.
 * - Persistent lupus anticoagulant, anticardiolipin IgG, and
 *   anti-beta-2-glycoprotein I IgG positivity.
 * - APS remains the canonical diagnosis; DVT, PE, pregnancy loss, and
 *   triple-positive antibodies are manifestations or evidence.
 *
 * Education design:
 * - Case explanation is specific to the vignette.
 * - Diagnosis education is independent of the case and covers thrombotic,
 *   obstetric, microvascular, hematologic, cardiac, and catastrophic APS.
 * - Classification criteria are explicitly distinguished from bedside diagnosis.
 *
 * Safety:
 * - Reuses or creates the exact diagnosis registry and accepted aliases.
 * - Does not overwrite existing diagnosis education.
 * - Does not overwrite an existing case with the same title.
 * - Does not alter a scheduled DailyCase.
 *
 * Run:
 *   npx tsx prisma/seed/flagship-antiphospholipid-syndrome.seed.ts
 *
 * Railway:
 *   railway run npx tsx prisma/seed/flagship-antiphospholipid-syndrome.seed.ts
 */

const databaseUrl = resolvePgConnectionString(process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required to run the Antiphospholipid Syndrome seed.',
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
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 6, 25, 12, 0, 0));
const seedVersion = 'flagship-antiphospholipid-syndrome-v1';

const canonicalName = 'antiphospholipid syndrome';
const displayLabel = 'Antiphospholipid Syndrome';
const caseTitle = 'Painful Leg Swelling and Sudden Pleuritic Chest Pain';

const taxonomy = {
  specialty: 'Rheumatology',
  subspecialty: 'Systemic Autoimmune Disease',
  category: 'Autoimmune Thrombophilia',
  bodySystem: 'Hematologic',
  organSystem: 'Coagulation System',
} as const;

const aliasTerms = [
  'Antiphospholipid Syndrome',
  'Antiphospholipid Antibody Syndrome',
  'APS',
  'Hughes Syndrome',
];

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 34-year-old woman presents with two days of progressive pain and swelling of the left calf. There has been no recent operation, prolonged travel, immobilisation, major injury, pregnancy, oestrogen use, or known cancer. She does not smoke and had been fully active before the symptoms began.',
  },
  {
    order: 1,
    type: 'symptom',
    value:
      'Since this morning she has also developed sudden shortness of breath and sharp right-sided chest pain that worsens with deep inspiration. She has no productive cough, fever, haemoptysis, syncope, or previous chronic respiratory symptoms.',
  },
  {
    order: 2,
    type: 'exam',
    value:
      'Pulse is 108/min, blood pressure 118/72 mmHg, respiratory rate 24/min, temperature 36.7°C, and oxygen saturation 93% on room air. The left calf is 4 cm larger than the right, warm, and tender along the deep venous system. A violaceous net-like pattern is visible over both thighs. There is no active bleeding, joint swelling, or cardiac murmur.',
  },
  {
    order: 3,
    type: 'imaging',
    value:
      'Compression ultrasonography demonstrates a non-compressible thrombus extending from the left popliteal vein into the femoral vein. CT pulmonary angiography shows acute segmental filling defects in the right lower-lobe pulmonary arteries without right-ventricular strain.',
  },
  {
    order: 4,
    type: 'history',
    value:
      'Further review reveals a previous unprovoked proximal deep-vein thrombosis four years ago. One pregnancy ended with an otherwise unexplained fetal death at 18 weeks, and another required delivery at 31 weeks because of severe placental insufficiency. She has no established systemic autoimmune diagnosis and no family history of venous thrombosis.',
  },
  {
    order: 5,
    type: 'lab',
    value:
      'Platelet count is 108 × 10^9/L and the activated partial thromboplastin time is prolonged without correction on mixing. Lupus anticoagulant is detected, with high-titre IgG anticardiolipin and IgG anti-beta-2-glycoprotein I antibodies. The same antibody profile remains positive on repeat testing 12 weeks later. ANA, anti-double-stranded DNA antibodies, complement levels, and testing for common inherited thrombophilias are unremarkable.',
  },
] as const;

const differentials = [
  'Factor V Leiden Thrombophilia',
  'Protein S Deficiency',
  'Systemic Lupus Erythematosus',
  'Paroxysmal Nocturnal Hemoglobinuria',
  'Thrombotic Thrombocytopenic Purpura',
  'Disseminated Intravascular Coagulation',
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
  'An acute unilateral swollen, painful calf without a provoking factor strongly suggests an unprovoked proximal venous thrombosis and raises concern for an underlying persistent prothrombotic disorder.',
  'New pleuritic chest pain and dyspnoea developing during the leg syndrome suggest embolisation to the pulmonary circulation rather than an isolated local limb problem.',
  'Objective asymmetrical calf swelling supports deep-vein thrombosis, while tachycardia, tachypnoea, mild hypoxaemia, and livedo reticularis add evidence of clinically important thrombosis with a possible systemic vascular disorder.',
  'Ultrasound and CT angiography confirm simultaneous proximal deep-vein thrombosis and pulmonary embolism; the later history of recurrent unprovoked thrombosis and placental morbidity, together with persistent triple-positive antiphospholipid antibodies, identifies the unifying autoimmune thrombophilia.',
];

const explanation = {
  diagnosis: displayLabel,
  summary:
    'Recurrent unprovoked venous thromboembolism, characteristic pregnancy morbidity, livedo reticularis, mild thrombocytopenia, a lupus-anticoagulant pattern, and persistent triple-positive antiphospholipid antibodies establish Antiphospholipid Syndrome.',
  reasoning: reasoningSteps.join('\n'),
  clinicalPearl:
    'Antiphospholipid antibodies must be interpreted with an appropriate clinical event and persistence over time. A prolonged activated partial thromboplastin time does not protect against thrombosis; lupus anticoagulant prolongs phospholipid-dependent laboratory assays while being associated clinically with clotting.',
  clueBreakdown: [
    {
      clueOrder: 0,
      clueType: 'history',
      clue: clues[0].value,
      explanation:
        'Acute unilateral calf pain and swelling suggest deep-vein thrombosis. The absence of surgery, immobility, trauma, pregnancy, oestrogen exposure, and known malignancy makes the event unprovoked and increases the importance of searching for a persistent acquired or inherited thrombophilia.',
      diagnosticContribution:
        'Introduces an unprovoked venous thrombotic syndrome without yet identifying its cause.',
    },
    {
      clueOrder: 1,
      clueType: 'symptom',
      clue: clues[1].value,
      explanation:
        'Sudden dyspnoea and pleuritic chest pain during a suspected leg thrombosis raise concern for pulmonary embolism. The absence of fever and productive cough makes infection less compelling, although imaging is still required.',
      diagnosticContribution:
        'Extends the presentation from a local venous event to probable venous thromboembolism involving the lungs.',
    },
    {
      clueOrder: 2,
      clueType: 'exam',
      clue: clues[2].value,
      explanation:
        'Asymmetrical calf enlargement, warmth, and deep venous tenderness support proximal DVT. Tachycardia, tachypnoea, and mild hypoxaemia support clinically relevant pulmonary vascular involvement. Livedo reticularis is a supportive vascular manifestation associated with antiphospholipid antibodies but is not diagnostic by itself.',
      diagnosticContribution:
        'Provides objective thrombotic localisation and introduces a systemic vascular clue while showing that the patient remains haemodynamically stable.',
    },
    {
      clueOrder: 3,
      clueType: 'imaging',
      clue: clues[3].value,
      explanation:
        'Compression ultrasonography confirms a proximal DVT, and CT pulmonary angiography confirms acute pulmonary emboli. These are objective macrovascular venous thromboses and satisfy the required clinical event component for considering APS when antiphospholipid antibodies are present.',
      diagnosticContribution:
        'Confirms venous thromboembolism but does not yet distinguish APS from other acquired or inherited causes.',
    },
    {
      clueOrder: 4,
      clueType: 'history',
      clue: clues[4].value,
      explanation:
        'A previous unprovoked proximal DVT shows recurrence, while otherwise unexplained fetal death after 10 weeks and severe placental insufficiency requiring premature delivery are characteristic obstetric manifestations. The absence of a family thrombosis pattern makes a common inherited thrombophilia less dominant, though it does not exclude one.',
      diagnosticContribution:
        'Links recurrent thrombosis with placental disease, making an acquired autoimmune thrombophilia substantially more likely.',
    },
    {
      clueOrder: 5,
      clueType: 'lab',
      clue: clues[5].value,
      explanation:
        'Failure of the prolonged aPTT to correct on mixing suggests an inhibitor, and lupus anticoagulant testing identifies a phospholipid-dependent inhibitor. High-titre anticardiolipin and anti-beta-2-glycoprotein I IgG antibodies create a high-risk triple-positive profile. Persistence at least 12 weeks later distinguishes sustained autoantibody positivity from a transient result. Mild thrombocytopenia and negative lupus testing support primary APS in this vignette.',
      diagnosticContribution:
        'Provides persistent laboratory evidence that, together with the documented clinical events, establishes Antiphospholipid Syndrome.',
    },
  ] satisfies ClueBreakdownEntry[],
  keyFindings: [
    'Unprovoked proximal deep-vein thrombosis',
    'Acute pulmonary embolism',
    'Previous unprovoked proximal DVT',
    'Unexplained fetal death after 10 weeks',
    'Severe placental insufficiency requiring premature delivery',
    'Livedo reticularis',
    'Mild thrombocytopenia',
    'Prolonged aPTT that does not correct on mixing',
    'Persistent lupus anticoagulant',
    'Persistent high-titre IgG anticardiolipin antibodies',
    'Persistent IgG anti-beta-2-glycoprotein I antibodies',
    'No evidence of systemic lupus erythematosus',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Factor V Leiden Thrombophilia',
      whyPlausibleEarly:
        'A young adult with recurrent unprovoked venous thromboembolism may have an inherited activated-protein-C-resistance disorder.',
      ruledOutByClues: [
        {
          clueOrder: 4,
          evidence:
            'fetal death at 18 weeks',
          reason:
            'This obstetric pattern is more characteristic of APS than Factor V Leiden and provides a second autoimmune-thrombosis domain.',
        },
        {
          clueOrder: 5,
          evidence:
            'Lupus anticoagulant is detected, with high-titre IgG anticardiolipin and IgG anti-beta-2-glycoprotein I antibodies',
          reason:
            'Persistent triple-positive antiphospholipid antibodies directly support APS, while testing for common inherited thrombophilias is unremarkable.',
        },
      ],
      finalReasonLessLikely:
        'An inherited thrombophilia could coexist, but the persistent triple-positive antibody profile and characteristic pregnancy morbidity establish APS as the unifying diagnosis.',
    },
    {
      diagnosis: 'Protein S Deficiency',
      whyPlausibleEarly:
        'Protein S deficiency can cause recurrent venous thrombosis at a young age and may be considered after an unprovoked event.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: 'violaceous net-like pattern is visible over both thighs',
          reason:
            'Livedo reticularis is a recognised supportive manifestation of APS and is not typical of isolated protein S deficiency.',
        },
        {
          clueOrder: 5,
          evidence:
            'The same antibody profile remains positive on repeat testing 12 weeks later',
          reason:
            'The sustained acquired autoantibody profile provides a direct alternative mechanism for thrombosis.',
        },
      ],
      finalReasonLessLikely:
        'The clinical and laboratory pattern is an acquired autoimmune thrombophilia rather than isolated protein S deficiency.',
    },
    {
      diagnosis: 'Systemic Lupus Erythematosus',
      whyPlausibleEarly:
        'APS may occur secondary to SLE, and thrombocytopenia, vascular skin changes, thrombosis, and pregnancy morbidity can occur in lupus.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: 'joint swelling',
          reason:
            'There is no examination evidence of inflammatory arthritis or another active systemic lupus manifestation, although absence alone is not exclusionary.',
        },
        {
          clueOrder: 5,
          evidence:
            'ANA, anti-double-stranded DNA antibodies, complement levels, and testing for common inherited thrombophilias are unremarkable',
          reason:
            'There is no serologic support for SLE in this presentation, favouring primary APS.',
        },
      ],
      finalReasonLessLikely:
        'The patient has APS without sufficient clinical or serologic evidence of coexisting SLE.',
    },
    {
      diagnosis: 'Paroxysmal Nocturnal Hemoglobinuria',
      whyPlausibleEarly:
        'PNH can cause unusual or recurrent venous thrombosis in young adults and may be accompanied by cytopenias.',
      ruledOutByClues: [
        {
          clueOrder: 4,
          evidence:
            'fetal death at 18 weeks',
          reason:
            'The obstetric pattern aligns more closely with APS than with PNH.',
        },
        {
          clueOrder: 5,
          evidence:
            'Lupus anticoagulant is detected, with high-titre IgG anticardiolipin and IgG anti-beta-2-glycoprotein I antibodies',
          reason:
            'The specific persistent autoantibody profile explains the thrombotic syndrome without evidence of haemolysis or marrow failure.',
        },
      ],
      finalReasonLessLikely:
        'There is no haemolytic or marrow-failure syndrome, and persistent antiphospholipid antibodies provide the direct mechanism.',
    },
    {
      diagnosis: 'Thrombotic Thrombocytopenic Purpura',
      whyPlausibleEarly:
        'Thrombocytopenia with vascular occlusion may raise concern for a thrombotic microangiopathy.',
      ruledOutByClues: [
        {
          clueOrder: 3,
          evidence:
            'non-compressible thrombus extending from the left popliteal vein into the femoral vein',
          reason:
            'The dominant events are macrovascular venous thromboses rather than the microangiopathic organ injury typical of TTP.',
        },
        {
          clueOrder: 5,
          evidence: 'Platelet count is 108 × 10^9/L',
          reason:
            'The thrombocytopenia is mild, with no described microangiopathic haemolytic anaemia, renal injury, fever, or neurologic syndrome.',
        },
      ],
      finalReasonLessLikely:
        'The pattern is recurrent macrovascular thrombosis with persistent antiphospholipid antibodies, not an acute thrombotic microangiopathy.',
    },
    {
      diagnosis: 'Disseminated Intravascular Coagulation',
      whyPlausibleEarly:
        'Thrombosis and thrombocytopenia can coexist in disseminated intravascular coagulation.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: 'There is no active bleeding',
          reason:
            'There is no acute shock, bleeding phenotype, or systemic trigger suggesting consumptive coagulopathy.',
        },
        {
          clueOrder: 5,
          evidence:
            'activated partial thromboplastin time is prolonged without correction on mixing',
          reason:
            'An inhibitor pattern with sustained specific autoantibodies supports APS rather than consumption of clotting factors.',
        },
      ],
      finalReasonLessLikely:
        'The chronic recurrent course and persistent antibody profile are incompatible with an acute consumptive coagulopathy as the unifying disorder.',
    },
  ] satisfies DifferentialAnalysisEntry[],
  managementPearl:
    'Treat the acute thrombotic event promptly, then plan secondary prevention according to venous versus arterial thrombosis, antibody-risk profile, bleeding risk, pregnancy intentions, and current specialist guidance. Persistent triple positivity is a high-risk profile and should not be managed as an incidental laboratory finding.',
  generationQuality: {
    contentTier: 'FLAGSHIP',
    seedVersion,
    humanReviewed: true,
    discriminatorStrength: 'VERY_HIGH',
    clueProgressionVerified: true,
    breakdownClueReferencesValidated: true,
    frontendReasoningIsString: true,
    frontendReasoningStepCount: reasoningSteps.length,
    educationIndependentOfCase: true,
    expectedTeachingPoints: [
      'APS requires an appropriate clinical manifestation together with persistent antiphospholipid antibodies',
      'Lupus anticoagulant may prolong the aPTT while being associated clinically with thrombosis',
      'Repeat antibody testing after at least 12 weeks confirms persistence',
      'Lupus anticoagulant, anticardiolipin, and anti-beta-2-glycoprotein I are the core laboratory tests',
      'Triple positivity is a high-risk antiphospholipid antibody profile',
      'APS may cause venous, arterial, microvascular, obstetric, cardiac-valve, and hematologic manifestations',
      'Classification criteria support research consistency but do not replace clinical diagnosis',
      'Catastrophic APS is a rare multiorgan thrombotic emergency',
    ],
    competencyDomains: [
      'Rheumatology',
      'Hematology',
      'Thrombosis',
      'Obstetric Medicine',
      'Autoimmune Disease',
      'Coagulation Testing',
      'Clinical Reasoning',
    ],
  },
};

const educationForFrontend = {
  title: displayLabel,
  summary: {
    definition:
      'Antiphospholipid Syndrome is a systemic autoimmune thrombo-inflammatory disorder characterised by venous, arterial, or microvascular thrombosis and/or defined pregnancy morbidity in association with persistent antiphospholipid antibodies.',
    highYieldTakeaway:
      'Suspect APS when thrombosis is recurrent, unprovoked, occurs at a young age or an unusual site, or is associated with characteristic pregnancy morbidity, livedo, thrombocytopenia, cardiac-valve disease, or a prolonged phospholipid-dependent clotting test. Confirm the clinical event and demonstrate persistent lupus anticoagulant, anticardiolipin, or anti-beta-2-glycoprotein I antibodies.',
  },
  recognitionPattern: [
    {
      pattern: 'Thrombosis with persistent antiphospholipid antibodies',
      whyItMatters:
        'APS can involve veins, arteries, or the microvasculature and may recur in different vascular beds.',
      progression:
        'Persistent prothrombotic autoantibodies plus vascular and inflammatory triggers -> thrombus formation -> organ-specific venous, arterial, or microvascular manifestations.',
      discriminator:
        'The diagnosis requires a compatible clinical event; antibody positivity alone is not APS.',
      commonTrap:
        'Do not label an asymptomatic person with one transient positive antibody test as having APS.',
    },
    {
      pattern: 'Characteristic pregnancy morbidity',
      whyItMatters:
        'Placental thrombosis and dysfunction can cause fetal death, recurrent pregnancy loss, fetal growth restriction, or premature delivery for severe placental disease.',
      progression:
        'Placental vascular injury -> impaired perfusion -> pregnancy loss, placental insufficiency, pre-eclampsia, or fetal growth restriction.',
      discriminator:
        'Gestational timing, recurrence, placental pathology, and exclusion of more likely obstetric causes determine how strongly the history supports APS.',
      commonTrap:
        'Do not assume every isolated early miscarriage is caused by APS.',
    },
    {
      pattern: 'High-risk antiphospholipid-antibody profile',
      whyItMatters:
        'Lupus anticoagulant, double or triple antibody positivity, persistent positivity, and high titres are associated with greater thrombotic risk.',
      progression:
        'Initial positive assay -> repeat testing after at least 12 weeks -> persistent profile interpreted alongside clinical events and treatment context.',
      discriminator:
        'Triple positivity means lupus anticoagulant, anticardiolipin, and anti-beta-2-glycoprotein I positivity, not three repetitions of the same assay.',
      commonTrap:
        'Anticoagulants, acute illness, infection, and laboratory-method limitations can interfere with testing and must be considered.',
    },
    {
      pattern: 'Multisystem supportive manifestations',
      whyItMatters:
        'Livedo, thrombocytopenia, cardiac-valve thickening or vegetations, neurologic events, renal microangiopathy, and skin ischaemia may strengthen suspicion.',
      progression:
        'Systemic vascular injury -> organ-specific supportive findings -> targeted assessment for thrombosis and alternative diagnoses.',
      discriminator:
        'These features support the syndrome but do not replace a qualifying clinical event and appropriate antibody evidence.',
      commonTrap:
        'Do not use a single nonspecific supportive feature as proof of APS.',
    },
    {
      pattern: 'Catastrophic antiphospholipid syndrome',
      whyItMatters:
        'Catastrophic APS causes rapidly developing small- and large-vessel thromboses with multiorgan dysfunction and high mortality.',
      progression:
        'Trigger such as infection, surgery, anticoagulation interruption, or pregnancy complication -> widespread thrombosis -> rapid multiorgan failure.',
      discriminator:
        'Rapid involvement of multiple organs over days distinguishes catastrophic APS from an isolated recurrent thrombotic event.',
      commonTrap:
        'Do not delay anticoagulation and multidisciplinary emergency treatment while waiting for every confirmatory test when catastrophic APS is strongly suspected.',
    },
  ],
  keySymptoms: [
    {
      symptom: 'Venous thromboembolism symptoms',
      significance:
        'Unilateral limb swelling or pain, pleuritic chest pain, dyspnoea, or haemoptysis may indicate DVT or pulmonary embolism.',
    },
    {
      symptom: 'Arterial ischaemic symptoms',
      significance:
        'Sudden focal neurologic deficit, visual loss, limb ischaemia, or acute coronary symptoms may reflect arterial thrombosis.',
    },
    {
      symptom: 'Pregnancy morbidity',
      significance:
        'Recurrent pregnancy loss, fetal death, fetal growth restriction, or premature delivery for severe placental disease may indicate obstetric APS.',
    },
    {
      symptom: 'Neurologic manifestations',
      significance:
        'Stroke and transient ischaemic attack are qualifying thrombotic events; migraine, seizures, or cognitive symptoms are less specific and require alternative causes to be assessed.',
    },
    {
      symptom: 'Microvascular or organ-specific symptoms',
      significance:
        'Digital pain, skin ulceration, renal dysfunction, abdominal pain, or respiratory deterioration may indicate small-vessel or multiorgan involvement.',
    },
  ],
  keySigns: [
    {
      finding: 'Livedo reticularis or livedo racemosa',
      significance:
        'A violaceous net-like skin pattern is a recognised supportive vascular manifestation.',
      discriminator:
        'It raises suspicion when combined with thrombosis or pregnancy morbidity but is not specific enough to diagnose APS alone.',
    },
    {
      finding: 'Objective venous or arterial ischaemia',
      significance:
        'Limb swelling, pulse deficit, focal neurologic deficit, or organ ischaemia directs urgent confirmation of thrombosis.',
      discriminator:
        'APS is defined by objectively established vascular or obstetric manifestations, not symptoms alone.',
    },
    {
      finding: 'Thrombocytopenia',
      significance:
        'Mild or moderate thrombocytopenia is a common supportive hematologic manifestation.',
      discriminator:
        'Severe thrombocytopenia, haemolysis, schistocytes, or organ failure should prompt assessment for thrombotic microangiopathy, DIC, or catastrophic APS.',
    },
    {
      finding: 'Cardiac-valve abnormality',
      significance:
        'Valve thickening or sterile vegetations may occur and can contribute to embolic events.',
      discriminator:
        'Blood cultures, infection assessment, and echocardiographic context help distinguish nonbacterial thrombotic lesions from infective endocarditis.',
    },
    {
      finding: 'Digital ischaemia, ulcers, or skin necrosis',
      significance:
        'These may indicate arterial or microvascular thrombosis and require urgent vascular assessment.',
      discriminator:
        'Rapidly progressive lesions with other organ dysfunction raise concern for catastrophic APS.',
    },
  ],
  examPearls: [
    {
      type: 'HISTORY',
      title: 'Map every thrombotic event',
      content:
        'Document the vascular bed, objective confirmation, provoking factors, recurrence, treatment, adherence, pregnancy association, and whether events occurred during adequate anticoagulation.',
      whyItMatters:
        'The pattern distinguishes a persistent thrombophilia from a single situational clot and guides secondary prevention.',
      discriminator:
        'Young age, recurrence, unusual sites, arterial events, and absence of strong provoking factors increase suspicion.',
      trapAvoided:
        'Do not call an event unprovoked until surgery, immobility, pregnancy, hormones, cancer, infection, and other transient risks have been reviewed.',
    },
    {
      type: 'OBSTETRIC',
      title: 'Define pregnancy outcomes precisely',
      content:
        'Record gestational age, fetal viability, placental disease, pre-eclampsia, fetal growth, timing of delivery, pathology, and alternative anatomical, endocrine, genetic, and infectious causes.',
      whyItMatters:
        'Specific pregnancy patterns carry different diagnostic weight and determine pregnancy-management planning.',
      discriminator:
        'Later fetal death and premature delivery for severe placental insufficiency are more specific than an isolated early loss.',
      trapAvoided:
        'Do not use the vague phrase “recurrent miscarriage” without gestational details.',
    },
    {
      type: 'LABORATORY',
      title: 'Interpret lupus anticoagulant correctly',
      content:
        'Lupus anticoagulant is detected through phospholipid-dependent clotting assays with screening, mixing, and confirmation steps. Anticoagulant medicines and acute illness can distort results.',
      whyItMatters:
        'A prolonged aPTT may represent an inhibitor even though the clinical phenotype is thrombosis rather than bleeding.',
      discriminator:
        'Failure to correct on mixing suggests an inhibitor; phospholipid dependence supports lupus anticoagulant.',
      trapAvoided:
        'Do not infer bleeding risk from the name “anticoagulant” or from a prolonged aPTT alone.',
    },
    {
      type: 'DISCRIMINATOR',
      title: 'Separate primary APS from associated autoimmune disease',
      content:
        'Assess for inflammatory arthritis, photosensitive or other lupus rashes, oral ulcers, serositis, nephritis, cytopenias, ANA, disease-specific antibodies, and complement abnormalities when clinically indicated.',
      whyItMatters:
        'APS may occur alone or with SLE and other autoimmune diseases, which changes monitoring and broader treatment.',
      discriminator:
        'Antiphospholipid antibodies do not by themselves establish SLE.',
      trapAvoided:
        'Do not automatically relabel APS as lupus-associated without sufficient independent evidence of SLE.',
    },
    {
      type: 'SAFETY',
      title: 'Recognise catastrophic APS',
      content:
        'Look for rapidly evolving thrombosis and dysfunction in the kidneys, lungs, brain, heart, skin, adrenals, or gastrointestinal tract, especially after infection or anticoagulation interruption.',
      whyItMatters:
        'Catastrophic APS is a time-critical multiorgan emergency requiring intensive multidisciplinary treatment.',
      discriminator:
        'Simultaneous or near-simultaneous involvement of several organs over a short period is the central warning pattern.',
      trapAvoided:
        'Do not manage rapidly progressive multiorgan thrombosis as a series of unrelated single-organ events.',
    },
  ],
  scoringSystems: [
    {
      name: '2023 ACR/EULAR APS Classification Criteria',
      purpose:
        'High-specificity classification for research cohorts; they support structured assessment but are not intended to replace clinical diagnosis.',
      components: [
        'Entry criterion: at least one positive antiphospholipid-antibody test within three years of an associated clinical criterion',
        'Clinical domains: macrovascular venous thrombosis, macrovascular arterial thrombosis, microvascular disease, obstetric morbidity, cardiac-valve disease, and hematologic manifestations',
        'Laboratory domains: lupus anticoagulant and solid-phase anticardiolipin or anti-beta-2-glycoprotein I antibody assays',
        'Classification threshold: at least 3 clinical-domain points and at least 3 laboratory-domain points after applying domain rules',
      ],
      interpretation:
        'Meeting the weighted threshold classifies a patient for research with high specificity. A clinician may diagnose or reject APS using the complete context even when classification criteria are not perfectly met.',
      caution:
        'Do not use classification criteria as an automatic bedside diagnostic algorithm, and do not count transient or technically unreliable antibody results.',
    },
  ],
  investigations: [
    {
      test: 'Objective confirmation of the clinical event',
      interpretation:
        'Use appropriate imaging, pathology, or specialist obstetric documentation to confirm venous, arterial, microvascular, cardiac-valve, or pregnancy manifestations.',
      whyItMatters:
        'Symptoms alone are insufficient; the clinical APS domain must be established and alternative causes assessed.',
    },
    {
      test: 'Lupus anticoagulant testing',
      interpretation:
        'A structured phospholipid-dependent assay sequence evaluates screen prolongation, mixing behaviour, and phospholipid correction. Results require interpretation around anticoagulant exposure and acute illness.',
      whyItMatters:
        'Lupus anticoagulant is a major laboratory criterion and an important marker of thrombotic risk.',
    },
    {
      test: 'IgG and IgM anticardiolipin antibodies',
      interpretation:
        'Clinically meaningful results depend on isotype, titre, assay method, persistence, and the accompanying clinical phenotype.',
      whyItMatters:
        'Anticardiolipin is one of the core solid-phase antiphospholipid-antibody tests.',
    },
    {
      test: 'IgG and IgM anti-beta-2-glycoprotein I antibodies',
      interpretation:
        'Persistent moderate or high antibody levels add laboratory evidence and help define double- or triple-positive profiles.',
      whyItMatters:
        'These antibodies provide greater specificity than nonspecific phospholipid reactivity in the correct context.',
    },
    {
      test: 'Repeat antiphospholipid-antibody testing',
      interpretation:
        'Repeat the relevant positive test after at least 12 weeks to establish persistence, using an appropriate clinical and anticoagulant context.',
      whyItMatters:
        'Transient antibodies may occur during infection or other acute states and should not establish APS.',
    },
    {
      test: 'Full blood count, blood film, haemolysis profile, renal function, and urinalysis',
      interpretation:
        'Assess thrombocytopenia, microangiopathic haemolysis, renal involvement, and competing thrombotic microangiopathies.',
      whyItMatters:
        'These tests identify supportive manifestations, complications, and dangerous alternatives such as TTP or catastrophic APS.',
    },
    {
      test: 'Assessment for associated autoimmune disease',
      interpretation:
        'Use ANA, disease-specific antibodies, complement, urine protein assessment, and targeted clinical evaluation when SLE or another systemic autoimmune disease is suspected.',
      whyItMatters:
        'APS may be primary or associated with another autoimmune disease, influencing monitoring and treatment.',
    },
    {
      test: 'Evaluation for alternative or additional thrombosis causes',
      interpretation:
        'Assess age-appropriate malignancy risk, transient provoking factors, selected inherited thrombophilias, PNH, myeloproliferative disease, and anatomical causes according to the vascular site and history.',
      whyItMatters:
        'A positive antiphospholipid-antibody test does not exclude another concurrent cause of thrombosis.',
    },
  ],
  differentialDistinguishers: [
    {
      diagnosis: 'Inherited Thrombophilia',
      overlap:
        'Young-onset or recurrent venous thromboembolism and family clustering.',
      distinguishingFeatures:
        'Usually lacks persistent antiphospholipid antibodies, livedo, valve disease, thrombocytopenia, and characteristic placental morbidity.',
      decisiveClue:
        'A persistent lupus-anticoagulant or moderate/high-titre anticardiolipin or anti-beta-2-glycoprotein I profile with a compatible clinical event supports APS.',
    },
    {
      diagnosis: 'Systemic Lupus Erythematosus',
      overlap:
        'Thrombosis, cytopenias, pregnancy morbidity, neurologic events, and antiphospholipid antibodies.',
      distinguishingFeatures:
        'SLE requires independent clinical and immunologic evidence such as inflammatory arthritis, characteristic mucocutaneous disease, nephritis, disease-specific antibodies, or complement consumption.',
      decisiveClue:
        'APS can be diagnosed as primary when the thrombotic-obstetric and antibody pattern is present without sufficient evidence of SLE.',
    },
    {
      diagnosis: 'Thrombotic Thrombocytopenic Purpura',
      overlap:
        'Thrombocytopenia, neurologic or renal involvement, and microvascular thrombosis.',
      distinguishingFeatures:
        'TTP typically has microangiopathic haemolytic anaemia, schistocytes, severe ADAMTS13 deficiency, and an acute thrombotic microangiopathy pattern.',
      decisiveClue:
        'Macrovascular thrombosis plus persistent antiphospholipid antibodies supports APS; haemolysis with severe ADAMTS13 deficiency supports TTP.',
    },
    {
      diagnosis: 'Disseminated Intravascular Coagulation',
      overlap:
        'Thrombocytopenia, prolonged clotting tests, bleeding, and thrombosis.',
      distinguishingFeatures:
        'DIC occurs with a major acute trigger and consumption of platelets and coagulation factors, often with raised fibrin-degradation markers and low fibrinogen.',
      decisiveClue:
        'A persistent inhibitor-pattern antibody profile and chronic recurrent thrombosis favour APS over acute consumptive coagulopathy.',
    },
    {
      diagnosis: 'Paroxysmal Nocturnal Hemoglobinuria',
      overlap:
        'Young-onset thrombosis, unusual venous sites, cytopenias, and abdominal or neurologic vascular events.',
      distinguishingFeatures:
        'PNH is associated with intravascular haemolysis and loss of GPI-anchored proteins on flow cytometry rather than antiphospholipid antibodies.',
      decisiveClue:
        'Flow cytometry confirms PNH; persistent APS antibodies with qualifying clinical events support APS.',
    },
    {
      diagnosis: 'Nonbacterial Thrombotic Endocarditis',
      overlap:
        'Sterile valve vegetations and systemic arterial emboli may occur in APS, SLE, or malignancy.',
      distinguishingFeatures:
        'The term describes a cardiac manifestation or embolic source rather than the complete systemic cause; malignancy and autoimmune disease require evaluation.',
      decisiveClue:
        'Persistent antiphospholipid antibodies with other APS manifestations identify APS as the underlying syndrome when infection is excluded.',
    },
  ],
  managementOverview: [
    {
      step: 'Treat acute thrombosis promptly',
      rationale:
        'Manage confirmed venous or arterial thrombosis using appropriate acute anticoagulation and organ-specific emergency care while assessing bleeding risk and contraindications.',
    },
    {
      step: 'Plan long-term secondary thrombosis prevention',
      rationale:
        'For thrombotic APS, vitamin K antagonist therapy is commonly used for long-term prevention; the target and intensity depend on venous versus arterial events, recurrence, bleeding risk, and specialist guidance.',
    },
    {
      step: 'Use antibody-risk profile in treatment decisions',
      rationale:
        'Lupus anticoagulant and double or triple positivity identify higher-risk profiles. Direct oral anticoagulants, particularly rivaroxaban, should not be used routinely in triple-positive APS or prior arterial thrombosis.',
    },
    {
      step: 'Manage obstetric APS with specialist pregnancy care',
      rationale:
        'Preconception planning and coordinated obstetric-rheumatology or hematology care guide low-dose aspirin and heparin strategies according to prior obstetric and thrombotic history.',
    },
    {
      step: 'Reduce modifiable thrombosis risks',
      rationale:
        'Address smoking, hypertension, dyslipidaemia, obesity, immobility, dehydration, and oestrogen exposure, and plan perioperative or postpartum thromboprophylaxis when indicated.',
    },
    {
      step: 'Treat associated autoimmune disease',
      rationale:
        'Control SLE or another systemic autoimmune disorder independently while continuing APS-specific thrombosis prevention.',
    },
    {
      step: 'Escalate catastrophic APS immediately',
      rationale:
        'Catastrophic APS requires intensive multidisciplinary care, treatment of triggers, therapeutic anticoagulation when feasible, glucocorticoids, and commonly plasma exchange and/or intravenous immunoglobulin.',
    },
    {
      step: 'Provide anticoagulation and pregnancy safety education',
      rationale:
        'Patients need adherence support, INR monitoring when applicable, interaction counselling, peri-procedural plans, bleeding precautions, and early advice before pregnancy or contraception changes.',
    },
  ],
  complications: [
    'Recurrent deep-vein thrombosis and pulmonary embolism',
    'Ischaemic stroke or transient ischaemic attack',
    'Myocardial, mesenteric, limb, or retinal arterial thrombosis',
    'Recurrent pregnancy loss and fetal death',
    'Pre-eclampsia, placental insufficiency, fetal growth restriction, and premature delivery',
    'Chronic thromboembolic pulmonary hypertension',
    'Cardiac-valve thickening, sterile vegetations, or embolisation',
    'APS nephropathy and chronic kidney disease',
    'Digital ischaemia, ulcers, or skin necrosis',
    'Thrombocytopenia and autoimmune haemolytic anaemia',
    'Catastrophic antiphospholipid syndrome with multiorgan failure',
    'Major bleeding related to antithrombotic treatment',
  ],
  pitfalls: [
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Diagnosing APS from antibodies alone',
      content:
        'Antiphospholipid antibodies may be found without thrombosis or defined pregnancy morbidity and may be transient during infection or acute illness.',
      whyItMatters:
        'Overdiagnosis exposes patients to unnecessary long-term antithrombotic treatment and anxiety.',
      trapAvoided:
        'Require a compatible clinical manifestation and interpret persistence, titre, isotype, and assay reliability.',
    },
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Failing to repeat antibody testing',
      content:
        'One positive result does not establish persistent antiphospholipid autoimmunity.',
      whyItMatters:
        'Transient positivity can follow infection, inflammation, pregnancy, or other temporary states.',
      trapAvoided:
        'Repeat the relevant test at least 12 weeks later in an appropriate testing context.',
    },
    {
      type: 'LABORATORY',
      title: 'Misreading the prolonged aPTT',
      content:
        'Lupus anticoagulant can prolong phospholipid-dependent assays even though the patient is prone to thrombosis rather than spontaneous bleeding.',
      whyItMatters:
        'Incorrect interpretation may delay anticoagulation or trigger inappropriate factor replacement.',
      trapAvoided:
        'Use mixing and confirmatory testing and review anticoagulant exposure before interpretation.',
    },
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Calling every pregnancy loss obstetric APS',
      content:
        'Pregnancy loss has many genetic, anatomical, endocrine, infectious, and placental causes.',
      whyItMatters:
        'Imprecise classification can lead to unnecessary treatment and missed alternative pathology.',
      trapAvoided:
        'Document gestational age and placental features and evaluate competing explanations.',
    },
    {
      type: 'SAFETY',
      title: 'Using DOACs indiscriminately',
      content:
        'Evidence of recurrent events is concerning in high-risk APS, particularly triple-positive disease and arterial thrombosis.',
      whyItMatters:
        'The anticoagulant choice materially affects recurrence risk.',
      trapAvoided:
        'Use specialist guidance and avoid routine rivaroxaban use in triple-positive APS or prior arterial events.',
    },
    {
      type: 'SAFETY',
      title: 'Missing catastrophic APS',
      content:
        'Rapid thrombosis in several organs may be mistaken for sepsis, DIC, TTP, vasculitis, or unrelated organ failures.',
      whyItMatters:
        'Delay in combined therapy worsens the risk of irreversible organ damage and death.',
      trapAvoided:
        'Recognise the multiorgan time course, investigate competing emergencies in parallel, and escalate early.',
    },
    {
      type: 'FOLLOW_UP',
      title: 'Ignoring anticoagulation quality and interactions',
      content:
        'Recurrence may reflect poor adherence, unstable INR control, interacting medicines, or interruption around procedures.',
      whyItMatters:
        'Escalating therapy without identifying correctable causes increases bleeding risk.',
      trapAvoided:
        'Audit adherence, INR history, interactions, and peri-procedural management before changing intensity.',
    },
  ],
  recallPrompts: [
    {
      prompt: 'What two broad elements are required to diagnose APS?',
      answer:
        'A compatible clinical manifestation such as thrombosis or defined pregnancy morbidity and persistent antiphospholipid antibodies.',
    },
    {
      prompt: 'Which three core laboratory antibody groups are assessed?',
      answer:
        'Lupus anticoagulant, anticardiolipin antibodies, and anti-beta-2-glycoprotein I antibodies.',
    },
    {
      prompt: 'How is persistence of antiphospholipid antibodies demonstrated?',
      answer:
        'The relevant positive antibody test remains positive on repeat testing at least 12 weeks later.',
    },
    {
      prompt: 'What does triple-positive APS mean?',
      answer:
        'Positivity for lupus anticoagulant, anticardiolipin antibodies, and anti-beta-2-glycoprotein I antibodies.',
    },
    {
      prompt: 'Why can lupus anticoagulant prolong aPTT yet cause thrombosis?',
      answer:
        'It interferes with phospholipid-dependent clotting assays in vitro while being associated with prothrombotic cellular and vascular effects in vivo.',
    },
    {
      prompt: 'Which skin finding commonly supports APS?',
      answer: 'Livedo reticularis or livedo racemosa.',
    },
    {
      prompt: 'What pattern suggests catastrophic APS?',
      answer:
        'Rapidly developing thromboses with dysfunction of multiple organs over a short period.',
    },
    {
      prompt: 'Are the 2023 ACR/EULAR criteria bedside diagnostic rules?',
      answer:
        'No. They are high-specificity classification criteria for research and should support, not replace, clinical judgment.',
    },
  ],
  references: [
    {
      citation:
        'Barbhaiya M, et al. 2023 ACR/EULAR Antiphospholipid Syndrome Classification Criteria. Arthritis & Rheumatology. 2023;75:1687-1702.',
    },
    {
      citation:
        'Tektonidou MG, et al. EULAR recommendations for the management of antiphospholipid syndrome in adults. Annals of the Rheumatic Diseases. 2019;78:1296-1304.',
    },
    {
      citation:
        'Miyakis S, et al. International consensus statement on an update of the classification criteria for definite antiphospholipid syndrome. Journal of Thrombosis and Haemostasis. 2006;4:295-306.',
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
    throw new Error('Frontend-compatible explanation.reasoning must be a string.');
  }

  const frontendReasoningSteps = explanation.reasoning
    .split(/\n{2,}|\n/)
    .map((step) => step.trim())
    .filter(Boolean);

  if (frontendReasoningSteps.length !== reasoningSteps.length) {
    throw new Error(
      `Expected ${reasoningSteps.length} frontend reasoning steps; received ${frontendReasoningSteps.length}.`,
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

      const clueText = normalizeClinicalText(clues[breakdown.clueOrder].value);
      const evidenceText = normalizeClinicalText(breakdown.evidence);

      if (!clueText.includes(evidenceText)) {
        throw new Error(
          `Differential evidence for ${entry.diagnosis} is not contained in clue ${breakdown.clueOrder}: ${breakdown.evidence}`,
        );
      }
    });
  });

  const educationText = normalizeClinicalText(
    JSON.stringify(educationForFrontend),
  );

  const caseSpecificEducationTerms = [
    '34 year old',
    'left calf is 4 cm',
    'fetal death at 18 weeks',
    'delivery at 31 weeks',
    'platelet count is 108',
    'this patient',
    'this case',
    'her thrombosis',
  ];

  for (const term of caseSpecificEducationTerms) {
    if (educationText.includes(normalizeClinicalText(term))) {
      throw new Error(
        `Diagnosis education contains case-specific wording: ${term}.`,
      );
    }
  }

  if (
    taxonomy.specialty !== 'Rheumatology' ||
    taxonomy.subspecialty !== 'Systemic Autoimmune Disease' ||
    taxonomy.category !== 'Autoimmune Thrombophilia' ||
    taxonomy.bodySystem !== 'Hematologic' ||
    taxonomy.organSystem !== 'Coagulation System'
  ) {
    throw new Error('APS taxonomy constants were changed unexpectedly.');
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
          difficultyBand: DiagnosisDifficultyBand.ADVANCED,
          rarityBand: DiagnosisRarityBand.UNCOMMON,
          clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
          ageGroup: DiagnosisAgeGroup.ADULT,
          urgencyLevel: DiagnosisUrgencyLevel.URGENT,
          preferredClueTypes: [
            'history',
            'symptom',
            'exam',
            'imaging',
            'lab',
          ],
          notes:
            'Seeded flagship Antiphospholipid Syndrome case focused on recurrent unprovoked venous thromboembolism, pregnancy morbidity, livedo, thrombocytopenia, inhibitor-pattern coagulation testing, and persistent triple-positive antiphospholipid antibodies.',
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
          difficultyBand: DiagnosisDifficultyBand.ADVANCED,
          rarityBand: DiagnosisRarityBand.UNCOMMON,
          clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
          ageGroup: DiagnosisAgeGroup.ADULT,
          urgencyLevel: DiagnosisUrgencyLevel.URGENT,
          preferredClueTypes: [
            'history',
            'symptom',
            'exam',
            'imaging',
            'lab',
          ],
          notes:
            'Seeded flagship Antiphospholipid Syndrome case focused on recurrent unprovoked venous thromboembolism, pregnancy morbidity, livedo, thrombocytopenia, inhibitor-pattern coagulation testing, and persistent triple-positive antiphospholipid antibodies.',
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
      'Skipped diagnosis education because Antiphospholipid Syndrome education already exists:',
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
        ? 'Skipped existing scheduled Antiphospholipid Syndrome case.'
        : 'Skipped existing Antiphospholipid Syndrome case to avoid overwriting authored content.',
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
  const symptoms = [clues[0].value, clues[1].value, clues[4].value];

  const caseData = {
    title: caseTitle,
    publicNumber,
    date: assignedDate,
    difficulty: 'advanced',
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
      'Seeded complete frontend-aligned flagship Antiphospholipid Syndrome case with six valid playable clues, objective recurrent thrombosis, characteristic pregnancy morbidity, persistent triple-positive antiphospholipid antibodies, exact clue-breakdown alignment, frontend-compatible string reasoning, and diagnosis-level education independent of the vignette.',
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
      difficulty: 'advanced',
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
        'Created complete Antiphospholipid Syndrome revision with six supported clue types, progressive thrombotic-obstetric-autoantibody reasoning, persistent antibody confirmation, exact breakdown references, and frontend-compatible explanation.reasoning.',
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
      validatorVersion:
        'flagship-human-review:antiphospholipid-syndrome-v1',
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        clueProgressionVerified: true,
        breakdownClueReferencesValidated: true,
        differentialEvidenceContainedInReferencedClues: true,
        frontendReasoningIsString: true,
        frontendReasoningStepCount: reasoningSteps.length,
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
          difficultyBand: 'ADVANCED',
          rarityBand: 'UNCOMMON',
          clinicalSetting: 'EMERGENCY',
          ageGroup: 'ADULT',
          urgencyLevel: 'URGENT',
        },
        note: 'Complete Antiphospholipid Syndrome flagship seed with six valid clue types, no early diagnosis-label leakage, objective thrombotic events, later obstetric discriminator, persistent triple-positive laboratory confirmation, exact clue-to-breakdown alignment, and independent diagnosis education.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded Antiphospholipid Syndrome:', {
    registryId: params.diagnosisRegistryId,
    caseId: seededCase.id,
    revisionId: revision.id,
    publicNumber,
    educationId: params.educationId,
    specialty: taxonomy.specialty,
    subspecialty: taxonomy.subspecialty,
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
