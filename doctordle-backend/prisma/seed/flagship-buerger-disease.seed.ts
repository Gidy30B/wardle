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
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { CaseEligibilityPolicyService } from '../../src/modules/cases/case-eligibility-policy.service';
import { CaseValidationService } from '../../src/modules/case-validation/case-validation.service';

/**
 * FLAGSHIP CASE SEED — Buerger Disease (Thromboangiitis Obliterans)
 *
 * Purpose:
 * - Reuse an existing Buerger disease / thromboangiitis obliterans registry entry when present.
 * - Create the canonical diagnosis and accepted aliases when it is absent.
 * - Seed a six-clue playable case with aligned differentialAnalysis clue references.
 * - Publish complete diagnosis education using Wardle's current frontend-aligned model.
 * - Keep tobacco cessation as the defining management principle without revealing the
 *   diagnosis before the discriminating clinical and angiographic clues.
 *
 * Run:
 *   npx tsx prisma/seed/flagship-buerger-disease.seed.ts
 *
 * Railway:
 *   railway run npx tsx prisma/seed/flagship-buerger-disease.seed.ts
 */

const databaseUrl = resolvePgConnectionString(process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run Buerger disease seed.');
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
const caseEligibilityPolicy = new CaseEligibilityPolicyService();
const caseValidationService = new CaseValidationService();

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

const now = new Date();
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 1, 2, 12, 0, 0));
const seedVersion = 'flagship-buerger-disease-v1';

const canonicalName = 'buerger disease';
const displayLabel = 'Buerger Disease';
const caseTitle = 'Progressive Digital Ischaemia in a Young Smoker';

const aliasTerms = [
  'Buerger Disease',
  "Buerger's Disease",
  'thromboangiitis obliterans',
  'thromboangiitis',
  'TAO',
];

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 36-year-old man presents with six months of burning pain in both feet when walking, initially affecting the arches and forefeet and relieved by rest.',
  },
  {
    order: 1,
    type: 'symptom',
    value:
      'The pain has progressed to nocturnal rest pain with cold, intermittently blue toes and a painful non-healing ulcer on the tip of the left great toe. He has smoked cigarettes daily since adolescence but has no history of diabetes, hypertension, or dyslipidaemia.',
  },
  {
    order: 2,
    type: 'history',
    value:
      'During the preceding year he has experienced several episodes of tender red cord-like swellings along superficial veins of the calves and forearms that resolved and later appeared at different sites.',
  },
  {
    order: 3,
    type: 'exam',
    value:
      'The toes are cool with delayed capillary refill and a small distal ulcer. Dorsalis pedis and posterior tibial pulses are reduced bilaterally, while popliteal and femoral pulses remain palpable. Similar mild digital coolness is present in both hands.',
  },
  {
    order: 4,
    type: 'lab',
    value:
      'Full blood count, renal function, fasting glucose, HbA1c, and lipid profile are unremarkable. ESR and CRP are not significantly elevated; ANA, ANCA, antiphospholipid antibodies, cryoglobulins, and thrombophilia testing are negative. Echocardiography shows no cardiac embolic source.',
  },
  {
    order: 5,
    type: 'imaging',
    value:
      'Catheter angiography shows multiple segmental occlusions of the distal tibial, pedal, radial, and digital arteries with prominent corkscrew collateral vessels and no significant proximal atherosclerotic plaque.',
  },
] as const;

const differentials = [
  'Premature Atherosclerotic Peripheral Arterial Disease',
  'Arterial Thromboembolism',
  'Systemic Vasculitis',
  'Antiphospholipid Syndrome',
  'Raynaud Phenomenon',
];

const explanation = {
  diagnosis: displayLabel,
  summary:
    'A young long-term smoker with distal limb claudication progressing to rest pain and digital ulceration, migratory superficial thrombophlebitis, preserved proximal pulses, exclusion of metabolic, autoimmune, thrombophilic, and embolic causes, and distal segmental arterial occlusions with corkscrew collaterals supports Buerger disease.',
  reasoning: [
    'Distal foot claudication in a young adult is unusual for conventional atherosclerotic peripheral arterial disease and should prompt consideration of non-atherosclerotic vascular disease.',
    'Progression to rest pain, cold discoloured toes, and a non-healing digital ulcer demonstrates clinically significant distal limb ischaemia.',
    'Long-term tobacco exposure is the central disease association, while absence of diabetes, hypertension, and dyslipidaemia weakens premature atherosclerosis.',
    'Recurrent tender superficial venous cords appearing at different sites represent migratory superficial thrombophlebitis, a characteristic associated feature.',
    'Reduced distal pulses with preserved femoral and popliteal pulses localize the disease to small and medium distal vessels rather than proximal inflow obstruction.',
    'Negative autoimmune, thrombophilia, metabolic, and embolic investigations support an exclusion-based diagnosis.',
    'Angiography showing distal segmental occlusions, relative sparing of proximal arteries, and corkscrew collateral vessels provides the characteristic vascular pattern.',
  ],
  keyFindings: [
    'Age 36 years',
    'Daily cigarette exposure since adolescence',
    'Bilateral arch and forefoot claudication',
    'Progression to nocturnal rest pain',
    'Cold intermittently cyanotic toes',
    'Painful non-healing great-toe ulcer',
    'No diabetes, hypertension, or dyslipidaemia',
    'Migratory superficial thrombophlebitis',
    'Cool toes with delayed capillary refill',
    'Reduced dorsalis pedis and posterior tibial pulses',
    'Preserved popliteal and femoral pulses',
    'Mild upper-limb digital involvement',
    'Normal metabolic risk evaluation',
    'Negative autoimmune and thrombophilia testing',
    'No cardiac embolic source',
    'Segmental distal arterial occlusions',
    'Corkscrew collateral vessels',
    'No significant proximal atherosclerotic plaque',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Premature Atherosclerotic Peripheral Arterial Disease',
      whyPlausibleEarly:
        'Exertional foot pain, reduced distal pulses, rest pain, and an ischaemic ulcer can occur in severe peripheral arterial disease.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'no history of diabetes, hypertension, or dyslipidaemia',
          reason:
            'The age and absence of major metabolic risk factors make advanced atherosclerotic disease less likely.',
        },
        {
          clueOrder: 3,
          evidence:
            'dorsalis pedis and posterior tibial pulses are reduced bilaterally, while popliteal and femoral pulses remain palpable',
          reason:
            'The distribution suggests distal small- and medium-vessel disease rather than typical proximal or multilevel atherosclerotic plaque.',
        },
        {
          clueOrder: 5,
          evidence:
            'multiple segmental occlusions of the distal tibial, pedal, radial, and digital arteries with prominent corkscrew collateral vessels and no significant proximal atherosclerotic plaque',
          reason:
            'This angiographic pattern favors thromboangiitis obliterans over conventional atherosclerosis.',
        },
      ],
      finalReasonLessLikely:
        'Atherosclerosis does not explain the combination of young age, migratory thrombophlebitis, distal multilimbed disease, preserved proximal vessels, and characteristic angiography as well as Buerger disease.',
    },
    {
      diagnosis: 'Arterial Thromboembolism',
      whyPlausibleEarly:
        'Digital ischaemia, rest pain, reduced pulses, and ulceration may result from embolic arterial occlusion.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence:
            'six months of burning pain in both feet when walking, initially affecting the arches and forefeet and relieved by rest',
          reason:
            'A chronic bilateral progressive course is less typical of a sudden embolic event.',
        },
        {
          clueOrder: 4,
          evidence: 'echocardiography shows no cardiac embolic source',
          reason:
            'The assessment does not identify a proximal cardiac source for recurrent arterial emboli.',
        },
        {
          clueOrder: 5,
          evidence:
            'multiple segmental occlusions of the distal tibial, pedal, radial, and digital arteries with prominent corkscrew collateral vessels',
          reason:
            'The diffuse distal pattern and collateral formation indicate chronic segmental disease rather than isolated embolic cut-off.',
        },
      ],
      finalReasonLessLikely:
        'The disease is chronic, bilateral, distal, and multisegmental without an embolic source, favoring Buerger disease.',
    },
    {
      diagnosis: 'Systemic Vasculitis',
      whyPlausibleEarly:
        'Inflammatory vasculitis can cause digital ischaemia, ulceration, neuropathic pain, and multivessel involvement.',
      ruledOutByClues: [
        {
          clueOrder: 4,
          evidence:
            'ESR and CRP are not significantly elevated; ANA, ANCA, antiphospholipid antibodies, cryoglobulins, and thrombophilia testing are negative',
          reason:
            'The investigation does not support common autoimmune or cryoglobulinaemic vasculitic syndromes.',
        },
        {
          clueOrder: 5,
          evidence:
            'multiple segmental occlusions of the distal tibial, pedal, radial, and digital arteries with prominent corkscrew collateral vessels and no significant proximal atherosclerotic plaque',
          reason:
            'The vascular distribution is more characteristic of thromboangiitis obliterans than a systemic necrotizing vasculitis.',
        },
      ],
      finalReasonLessLikely:
        'There are no systemic inflammatory manifestations or supportive serology, and the tobacco-linked distal angiographic pattern is more specific for Buerger disease.',
    },
    {
      diagnosis: 'Antiphospholipid Syndrome',
      whyPlausibleEarly:
        'A thrombophilic disorder can produce recurrent arterial or venous thrombosis and digital ischaemia in a young adult.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence:
            'tender red cord-like swellings along superficial veins of the calves and forearms that resolved and later appeared at different sites',
          reason:
            'This is a recognized associated feature of Buerger disease and is not sufficient by itself to establish systemic thrombophilia.',
        },
        {
          clueOrder: 4,
          evidence:
            'negative antiphospholipid antibodies and thrombophilia testing',
          reason:
            'The laboratory evaluation does not support antiphospholipid syndrome or a common inherited thrombophilia.',
        },
        {
          clueOrder: 5,
          evidence:
            'multiple segmental occlusions of the distal tibial, pedal, radial, and digital arteries with prominent corkscrew collateral vessels',
          reason:
            'This morphology favors chronic thromboangiitis obliterans over nonspecific thrombotic occlusion.',
        },
      ],
      finalReasonLessLikely:
        'The thrombophilia work-up is negative and the clinical-angiographic pattern is characteristic of Buerger disease.',
    },
    {
      diagnosis: 'Raynaud Phenomenon',
      whyPlausibleEarly:
        'Cold, intermittently blue digits and distal pain can occur with primary or secondary Raynaud phenomenon.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence:
            'nocturnal rest pain with cold, intermittently blue toes and a painful non-healing ulcer',
          reason:
            'Persistent tissue ischaemia and ulceration indicate occlusive vascular disease rather than uncomplicated vasospasm.',
        },
        {
          clueOrder: 3,
          evidence:
            'dorsalis pedis and posterior tibial pulses are reduced bilaterally',
          reason:
            'Primary Raynaud phenomenon generally preserves arterial pulses between episodes.',
        },
        {
          clueOrder: 5,
          evidence:
            'multiple segmental occlusions of the distal tibial, pedal, radial, and digital arteries',
          reason:
            'Fixed occlusive disease is not explained by primary Raynaud phenomenon.',
        },
      ],
      finalReasonLessLikely:
        'Raynaud-type colour change may coexist, but it does not account for fixed occlusions, reduced pulses, thrombophlebitis, and the distal angiographic pattern.',
    },
  ],
  managementPearl:
    'Complete cessation of tobacco and nicotine exposure is the essential disease-modifying intervention. Provide structured cessation support, urgent vascular assessment for rest pain or tissue loss, meticulous wound and limb care, analgesia, treatment of infection when present, and specialist consideration of vasodilator or prostanoid therapy. Revascularization may be difficult because disease is distal, although selected patients with a suitable target may be considered.',
  generationQuality: {
    contentTier: 'FLAGSHIP',
    seedVersion,
    humanReviewed: true,
    discriminatorStrength: 'VERY_HIGH',
    clueProgressionVerified: true,
    expectedTeachingPoints: [
      'Buerger disease is strongly associated with tobacco exposure in younger patients',
      'The disease causes distal small- and medium-vessel ischaemia with relative proximal sparing',
      'Migratory superficial thrombophlebitis is an important associated clue',
      'Diagnosis requires exclusion of atherosclerotic, embolic, autoimmune, and thrombophilic causes',
      'Angiography may show segmental distal occlusions and corkscrew collateral vessels',
      'Complete tobacco cessation is the essential disease-modifying treatment',
    ],
    competencyDomains: [
      'Vascular Surgery',
      'Peripheral Vascular Disease',
      'Internal Medicine',
      'Clinical Reasoning',
      'Smoking Cessation',
    ],
  },
};

const educationForFrontend = {
  title: displayLabel,
  summary: {
    definition:
      'Buerger disease, or thromboangiitis obliterans, is a non-atherosclerotic, segmental inflammatory and thrombotic disorder affecting small- and medium-sized arteries and veins, predominantly in the distal limbs and strongly associated with tobacco exposure.',
    highYieldTakeaway:
      'Think Buerger disease in a young tobacco user with distal limb claudication or rest pain, digital ulceration, migratory superficial thrombophlebitis, preserved proximal pulses, and segmental distal arterial occlusions with corkscrew collaterals after competing causes are excluded.',
  },
  recognitionPattern: [
    {
      pattern: 'Young tobacco user with distal limb ischaemia',
      whyItMatters:
        'Severe distal arterial disease at a young age is atypical for conventional atherosclerosis and should trigger an alternative vascular differential.',
      progression:
        'Tobacco-associated distal vascular inflammation and thrombosis -> segmental occlusion -> claudication -> rest pain -> digital ulceration or gangrene.',
      discriminator:
        'Young age, distal distribution, relative proximal sparing, and few conventional atherosclerotic risk factors favor Buerger disease.',
      commonTrap:
        'Do not diagnose premature atherosclerotic peripheral arterial disease solely because the patient smokes.',
    },
    {
      pattern: 'Arterial and superficial venous involvement',
      whyItMatters:
        'Buerger disease affects arteries and veins, so migratory superficial thrombophlebitis can provide a major diagnostic clue.',
      progression:
        'Recurrent segmental superficial venous inflammation may precede or accompany progressive distal arterial ischaemia.',
      discriminator:
        'Migratory tender superficial venous cords plus distal arterial insufficiency are more characteristic than isolated claudication alone.',
      commonTrap:
        'Do not dismiss recurrent superficial thrombophlebitis as unrelated when it occurs in a young smoker with digital ischaemia.',
    },
    {
      pattern:
        'Characteristic distal angiographic disease after exclusion of mimics',
      whyItMatters:
        'No single laboratory test confirms Buerger disease; diagnosis depends on a coherent clinical pattern and exclusion of alternative causes.',
      progression:
        'Confirm objective ischaemia -> define distal arterial distribution -> exclude atherosclerotic, embolic, autoimmune, diabetic, and thrombophilic causes -> integrate tobacco exposure and angiographic findings.',
      discriminator:
        'Segmental distal occlusions with relative proximal sparing and corkscrew collateral vessels support the diagnosis, although corkscrew vessels are not pathognomonic.',
      commonTrap:
        'Do not diagnose Buerger disease from corkscrew collaterals alone without the correct clinical setting and exclusion work-up.',
    },
  ],
  keySymptoms: [
    {
      symptom: 'Foot, arch, hand, or forearm claudication',
      significance:
        'Distal claudication is an early manifestation and may be mistaken for musculoskeletal pain.',
    },
    {
      symptom: 'Digital rest pain',
      significance:
        'Rest pain indicates advanced ischaemia and reduced perfusion insufficient for tissue needs.',
    },
    {
      symptom: 'Cold or discoloured fingers and toes',
      significance:
        'Digital pallor, cyanosis, or Raynaud-type colour change reflects poor distal perfusion or vasospasm.',
    },
    {
      symptom: 'Painful non-healing digital ulcer',
      significance:
        'Tissue loss indicates severe limb ischaemia and requires urgent vascular and wound assessment.',
    },
    {
      symptom: 'Recurrent tender superficial venous cords',
      significance:
        'Migratory superficial thrombophlebitis is a useful associated feature of Buerger disease.',
    },
  ],
  keySigns: [
    {
      finding: 'Reduced distal pulses with preserved proximal pulses',
      significance:
        'Supports disease concentrated in small- and medium-sized distal vessels.',
      discriminator:
        'Relative proximal sparing helps distinguish the pattern from many forms of aortoiliac or femoropopliteal atherosclerotic disease.',
    },
    {
      finding: 'Cool digits with delayed capillary refill',
      significance: 'Demonstrates impaired distal arterial perfusion.',
    },
    {
      finding: 'Digital ulceration or gangrene',
      significance:
        'Indicates severe ischaemia and risk of infection, tissue loss, and amputation.',
      discriminator:
        'Fixed tissue loss separates occlusive disease from uncomplicated primary Raynaud phenomenon.',
    },
    {
      finding: 'Migratory superficial thrombophlebitis',
      significance:
        'Reflects venous involvement in a disease affecting both arteries and veins.',
      discriminator:
        'Its presence in a young tobacco user with distal ischaemia substantially strengthens suspicion for Buerger disease.',
    },
    {
      finding: 'Abnormal Allen test',
      significance:
        'May demonstrate distal upper-limb arterial occlusion when hand circulation is involved.',
    },
  ],
  examPearls: [
    {
      type: 'DISCRIMINATOR',
      title: 'Distal disease with proximal pulse preservation',
      content:
        'Palpable femoral, popliteal, or brachial pulses do not exclude severe ischaemia when the disease is concentrated in distal arteries.',
      whyItMatters:
        'The pulse pattern localizes the vascular lesion and prevents false reassurance from preserved proximal pulses.',
      discriminator:
        'Reduced pedal or digital flow with preserved proximal pulses supports a distal small- and medium-vessel process.',
      trapAvoided:
        'Do not stop the vascular examination after confirming that femoral or brachial pulses are present.',
    },
    {
      type: 'DISCRIMINATOR',
      title: 'Migratory thrombophlebitis links venous and arterial disease',
      content:
        'Recurrent tender superficial venous cords that appear at different sites can precede or accompany distal arterial ischaemia.',
      whyItMatters:
        'This finding raises the diagnostic specificity of an otherwise broad digital-ischaemia presentation.',
      discriminator:
        'Combined distal arterial insufficiency and migratory superficial thrombophlebitis are strongly suggestive in the correct tobacco-exposure context.',
      trapAvoided:
        'Do not treat each superficial thrombophlebitis episode as an isolated event without reviewing the limb-ischaemia history.',
    },
    {
      type: 'DISCRIMINATOR',
      title: 'Corkscrew collaterals are supportive, not diagnostic alone',
      content:
        'Angiography may show tortuous corkscrew collateral vessels around segmental distal arterial occlusions.',
      whyItMatters:
        'The pattern supports Buerger disease when combined with young age, tobacco exposure, distal distribution, and exclusion of competing diagnoses.',
      discriminator:
        'Relative absence of proximal atherosclerosis is as important as the collateral morphology.',
      trapAvoided:
        'Do not label any corkscrew collateral pattern as Buerger disease without excluding connective-tissue disease, embolism, atherosclerosis, and other occlusive disorders.',
    },
  ],
  scoringSystems: [],
  investigations: [
    {
      test: 'Ankle-brachial index, toe-brachial index, and segmental pressures',
      interpretation:
        'Objective evidence of distal limb ischaemia may be present; toe pressures can be useful when disease is concentrated below the ankle.',
      whyItMatters:
        'Confirms haemodynamic impairment and helps quantify severity, but a single normal proximal index does not exclude very distal disease.',
    },
    {
      test: 'Duplex arterial ultrasound',
      interpretation:
        'May identify distal arterial occlusion and preserved proximal arterial segments.',
      whyItMatters:
        'Provides a non-invasive first assessment and helps exclude proximal atherosclerotic stenosis.',
    },
    {
      test: 'CT, MR, or catheter angiography',
      interpretation:
        'May show segmental occlusion of distal tibial, pedal, radial, ulnar, palmar, or digital arteries with tortuous corkscrew collateral vessels and relative proximal sparing.',
      whyItMatters:
        'Defines the vascular distribution, supports diagnosis, and determines whether any revascularization target exists.',
    },
    {
      test: 'Metabolic and atherosclerotic risk evaluation',
      interpretation:
        'Assess glucose or HbA1c, lipid profile, blood pressure, renal function, and other conventional risk factors.',
      whyItMatters:
        'Advanced atherosclerotic disease must be considered and appropriately excluded, especially when the presentation is atypical.',
    },
    {
      test: 'Autoimmune and thrombophilia evaluation',
      interpretation:
        'Testing may include ANA, ANCA, antiphospholipid antibodies, cryoglobulins, and targeted thrombophilia studies according to clinical context.',
      whyItMatters:
        'There is no confirmatory blood test for Buerger disease; laboratory studies primarily exclude important mimics.',
    },
    {
      test: 'Electrocardiography and echocardiography when embolism is possible',
      interpretation:
        'Evaluate for arrhythmia, intracardiac thrombus, valvular disease, or another proximal embolic source.',
      whyItMatters:
        'An embolic source changes both the diagnosis and urgent management.',
    },
    {
      test: 'Tissue biopsy in selected atypical cases',
      interpretation:
        'Histology may show a highly cellular inflammatory thrombus with relative preservation of the internal elastic lamina, depending on disease phase.',
      whyItMatters:
        'Biopsy is not routinely required but may help when presentation is atypical or diagnostic uncertainty remains.',
    },
  ],
  managementOverview: [
    {
      step: 'Achieve complete cessation of tobacco exposure',
      rationale:
        'Continued tobacco exposure drives disease activity and greatly increases the risk of progressive tissue loss and amputation.',
    },
    {
      step: 'Provide structured cessation support',
      rationale:
        'Behavioral support and appropriate non-nicotine pharmacotherapy can improve the chance of sustained abstinence; nicotine-containing products should be reviewed with the treating team because ongoing nicotine exposure may perpetuate disease activity.',
    },
    {
      step: 'Urgently assess rest pain, ulceration, infection, or gangrene',
      rationale:
        'These findings indicate severe limb ischaemia and potential threatened tissue requiring vascular and wound-care review.',
    },
    {
      step: 'Protect the limbs and provide wound care',
      rationale:
        'Avoid cold exposure and trauma, use appropriate footwear, inspect digits regularly, and manage ulcers to reduce secondary infection and tissue loss.',
    },
    {
      step: 'Treat pain and associated vasospasm',
      rationale:
        'Analgesia and selected vasodilator therapy may reduce symptoms; calcium-channel blockers may help when Raynaud-type vasospasm coexists.',
    },
    {
      step: 'Consider intravenous prostanoid therapy in severe ischaemia',
      rationale:
        'Specialist-directed intravenous iloprost may improve rest pain and ulcer healing in selected patients with critical distal ischaemia.',
    },
    {
      step: 'Assess revascularization feasibility',
      rationale:
        'Bypass or endovascular treatment is often limited by diffuse distal disease, but selected patients with a suitable target vessel may be considered.',
    },
    {
      step: 'Reserve amputation for non-salvageable tissue or uncontrolled complications',
      rationale:
        'Amputation may be required for irreversible gangrene, uncontrolled infection, or persistent severe pain when tissue cannot be preserved.',
    },
  ],
  differentialDistinguishers: [
    {
      diagnosis: 'Premature Atherosclerotic Peripheral Arterial Disease',
      whyConfused:
        'Both conditions cause claudication, reduced pulses, rest pain, and ischaemic ulcers.',
      distinguishingPoint:
        'Atherosclerosis is more strongly associated with diabetes, hypertension, dyslipidaemia, renal disease, and proximal or plaque-based lesions.',
      keySeparator:
        'Young age, distal multilimbed disease, migratory thrombophlebitis, preserved proximal vessels, and absence of significant plaque favor Buerger disease.',
      classicTrap:
        'Assuming smoking automatically makes all peripheral arterial disease atherosclerotic.',
    },
    {
      diagnosis: 'Arterial Thromboembolism',
      whyConfused:
        'Emboli can cause painful cold digits, tissue loss, and absent distal pulses.',
      distinguishingPoint:
        'Embolic occlusion is usually acute or episodic and may show a discrete cut-off with a proximal cardiac or arterial source.',
      keySeparator:
        'A chronic bilateral distal segmental pattern with developed collaterals and no embolic source favors Buerger disease.',
      classicTrap:
        'Failing to evaluate for atrial fibrillation, cardiac thrombus, aneurysm, or proximal arterial plaque before diagnosing Buerger disease.',
    },
    {
      diagnosis: 'Systemic Vasculitis',
      whyConfused:
        'Vasculitis can cause digital ischaemia, ulceration, neuropathy, and multiorgan vascular injury.',
      distinguishingPoint:
        'Systemic vasculitis more often has inflammatory symptoms, organ involvement, raised inflammatory markers, or disease-specific serology.',
      keySeparator:
        'Tobacco-linked distal occlusion with minimal systemic inflammation and characteristic angiography favors Buerger disease.',
      classicTrap:
        'Using negative ANCA alone to exclude all vasculitic disorders.',
    },
    {
      diagnosis: 'Antiphospholipid Syndrome',
      whyConfused:
        'Arterial and venous thromboses can occur in young patients with antiphospholipid syndrome.',
      distinguishingPoint:
        'Antiphospholipid syndrome requires compatible clinical thrombosis or pregnancy morbidity plus persistent laboratory criteria.',
      keySeparator:
        'Negative antiphospholipid testing and a distal corkscrew-collateral pattern favor Buerger disease.',
      classicTrap:
        'Calling migratory superficial thrombophlebitis a thrombophilia without evaluating the complete vascular pattern.',
    },
    {
      diagnosis: 'Raynaud Phenomenon',
      whyConfused:
        'Both can produce painful cold digits and episodic colour change.',
      distinguishingPoint:
        'Primary Raynaud phenomenon is vasospastic, usually symmetric, and does not cause fixed arterial occlusion or persistently reduced pulses.',
      keySeparator:
        'Rest pain, ulceration, fixed distal occlusion, and abnormal pulses indicate structural vascular disease.',
      classicTrap:
        'Labeling digital ulceration in a smoker as uncomplicated Raynaud phenomenon.',
    },
  ],
  complications: [
    {
      complication: 'Digital ulceration',
      whyItMatters:
        'Indicates severe tissue hypoperfusion and creates a portal for infection.',
    },
    {
      complication: 'Gangrene',
      whyItMatters: 'Irreversible tissue necrosis may require amputation.',
    },
    {
      complication: 'Secondary wound infection',
      whyItMatters:
        'Infection can accelerate tissue destruction and require urgent antimicrobial and surgical management.',
    },
    {
      complication: 'Chronic ischaemic pain',
      whyItMatters:
        'Persistent rest pain causes major functional impairment and may signal threatened tissue.',
    },
    {
      complication: 'Digit or limb amputation',
      whyItMatters:
        'The risk rises substantially when tobacco exposure continues.',
    },
    {
      complication: 'Functional impairment',
      whyItMatters:
        'Upper- and lower-limb involvement can limit walking, hand function, employment, and daily activities.',
    },
  ],
  pitfalls: [
    {
      pitfall: 'Diagnosing Buerger disease without a careful exclusion work-up',
      consequence:
        'May miss embolic disease, diabetes, atherosclerosis, autoimmune vasculitis, or thrombophilia requiring different treatment.',
    },
    {
      pitfall: 'Over-relying on corkscrew collaterals',
      consequence:
        'These vessels are supportive but not specific and must be interpreted in clinical context.',
    },
    {
      pitfall: 'Accepting reduced tobacco use instead of complete cessation',
      consequence:
        'Even low ongoing exposure may sustain disease activity and progression.',
    },
    {
      pitfall:
        'Using nicotine-containing cessation products without specialist review',
      consequence:
        'Ongoing nicotine exposure may perpetuate vascular disease activity in Buerger disease.',
    },
    {
      pitfall: 'Missing threatened-limb features',
      consequence:
        'Rest pain, ulceration, infection, or gangrene require urgent vascular assessment rather than routine follow-up.',
    },
    {
      pitfall: 'Assuming revascularization is always impossible',
      consequence:
        'Although distal disease often limits intervention, selected patients may have a suitable target and should be assessed individually.',
    },
  ],
  recallPrompts: [
    {
      prompt: 'What is the alternative name for Buerger disease?',
      answer: 'Thromboangiitis obliterans.',
    },
    {
      prompt: 'What exposure is most strongly associated with Buerger disease?',
      answer:
        'Tobacco exposure, with disease progression strongly linked to continued use.',
    },
    {
      prompt: 'Which vessels are predominantly affected?',
      answer:
        'Small- and medium-sized arteries and veins of the distal upper and lower limbs.',
    },
    {
      prompt: 'What venous finding supports the diagnosis?',
      answer: 'Migratory superficial thrombophlebitis.',
    },
    {
      prompt: 'What angiographic pattern is characteristic?',
      answer:
        'Segmental distal arterial occlusions with relative proximal sparing and tortuous corkscrew collateral vessels.',
    },
    {
      prompt: 'Are corkscrew collaterals specific for Buerger disease?',
      answer:
        'No. They are supportive but must be interpreted with the clinical pattern and exclusion of alternative diagnoses.',
    },
    {
      prompt: 'What is the essential disease-modifying treatment?',
      answer: 'Complete cessation of tobacco and nicotine exposure.',
    },
    {
      prompt: 'Why is revascularization often difficult?',
      answer:
        'The occlusions are diffuse and distal, so a suitable bypass or endovascular target may be absent.',
    },
  ],
  references: [
    {
      citation:
        'Fazeli B, et al. Diagnostic criteria for Buerger disease: International Consensus of VAS. 2023.',
    },
    {
      citation:
        'Nordanstig J, et al. European Society for Vascular Surgery 2024 Clinical Practice Guidelines on the Management of Asymptomatic Lower Limb Peripheral Arterial Disease and Intermittent Claudication.',
    },
    {
      citation:
        'Olin JW. Thromboangiitis Obliterans: 110 Years Old and Little Progress Made. Journal of the American Heart Association. 2018;7:e011214.',
    },
    {
      citation:
        'Qaja E, Muco E, Hashmi MF. Buerger Disease. StatPearls. Updated February 19, 2023.',
    },
  ],
};

function validateStaticSeedContent() {
  const history = clues[0].value;
  const symptoms = [clues[1].value];

  const clueValidation = caseEligibilityPolicy.validatePlayableClues(clues, {
    minimumPlayableClues: 6,
  });

  if (!clueValidation.valid) {
    throw new Error(
      `${displayLabel} clues are not playable: ${clueValidation.reasons.join(', ') || 'unknown reason'}.`,
    );
  }

  const validation = caseValidationService.validateSnapshot({
    caseId: 'seed-static-validation',
    title: caseTitle,
    date: inventoryPlaceholderDate,
    difficulty: 'medium',
    history,
    symptoms,
    labs: null,
    clues: clues as unknown as object[],
    explanation: explanation as unknown as object,
    differentials,
    diagnosisId: null,
    diagnosisRegistryId: 'seed-static-registry',
    proposedDiagnosisText: displayLabel,
    diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
    diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
    diagnosisMappingConfidence: 1,
    diagnosisEditorialNote:
      'Static validation for flagship Buerger disease seed.',
  });

  if (validation.outcome !== 'PASSED') {
    throw new Error(
      `${displayLabel} static validation failed: ${validation.issues.map((issue) => `${issue.code}: ${issue.message}`).join('; ')}`,
    );
  }

  validateDifferentialAnalysisGrounding();

  if (educationForFrontend.scoringSystems.length !== 0) {
    throw new Error(
      `${displayLabel} should not seed scoring systems; no compatible disease score is used for this case.`,
    );
  }

  console.log('Static Buerger disease seed validation passed:', {
    playableClueCount: clueValidation.playableClueCount,
    clueOrders: clueValidation.clues.map((clue) => clue.order),
    clueTypes: clueValidation.clues.map((clue) => clue.type),
    scoringSystems: educationForFrontend.scoringSystems.length,
  });
}

function validateDifferentialAnalysisGrounding() {
  const analysis = explanation.differentialAnalysis;
  const expectedDifferentials = new Set(
    differentials.map(normalizeClinicalText),
  );
  const seen = new Set<string>();
  const clueByOrder = new Map(clues.map((clue) => [clue.order, clue.value]));

  if (analysis.length !== differentials.length) {
    throw new Error(
      `${displayLabel} differentialAnalysis must include exactly one item per differential.`,
    );
  }

  for (const item of analysis) {
    const normalizedDiagnosis = normalizeClinicalText(item.diagnosis);

    if (!expectedDifferentials.has(normalizedDiagnosis)) {
      throw new Error(
        `${displayLabel} differentialAnalysis contains an unlisted differential: ${item.diagnosis}.`,
      );
    }

    if (seen.has(normalizedDiagnosis)) {
      throw new Error(
        `${displayLabel} differentialAnalysis contains a duplicate differential: ${item.diagnosis}.`,
      );
    }
    seen.add(normalizedDiagnosis);

    if (!item.whyPlausibleEarly.trim() || !item.finalReasonLessLikely.trim()) {
      throw new Error(
        `${displayLabel} differentialAnalysis for ${item.diagnosis} is missing required explanatory text.`,
      );
    }

    if (item.ruledOutByClues.length === 0) {
      throw new Error(
        `${displayLabel} differentialAnalysis for ${item.diagnosis} must cite at least one clue.`,
      );
    }

    let previousOrder = -1;
    for (const ruleOut of item.ruledOutByClues) {
      const clueText = clueByOrder.get(ruleOut.clueOrder);
      if (!clueText) {
        throw new Error(
          `${displayLabel} differentialAnalysis for ${item.diagnosis} references invalid clueOrder ${ruleOut.clueOrder}.`,
        );
      }

      if (ruleOut.clueOrder < previousOrder) {
        throw new Error(
          `${displayLabel} differentialAnalysis for ${item.diagnosis} cites clues out of order.`,
        );
      }
      previousOrder = ruleOut.clueOrder;

      if (!ruleOut.evidence.trim() || !ruleOut.reason.trim()) {
        throw new Error(
          `${displayLabel} differentialAnalysis for ${item.diagnosis} has an incomplete clue explanation.`,
        );
      }

      if (!isEvidenceGroundedInClue(ruleOut.evidence, clueText)) {
        throw new Error(
          `${displayLabel} differentialAnalysis for ${item.diagnosis} has evidence that is not grounded in clue ${ruleOut.clueOrder}: ${ruleOut.evidence}`,
        );
      }
    }
  }

  if (seen.size !== expectedDifferentials.size) {
    throw new Error(
      `${displayLabel} differentialAnalysis is missing one or more listed differentials.`,
    );
  }
}

function isEvidenceGroundedInClue(evidence: string, clueText: string): boolean {
  const normalizedEvidence = normalizeClinicalText(evidence);
  const normalizedClue = normalizeClinicalText(clueText);

  if (!normalizedEvidence || !normalizedClue) {
    return false;
  }

  if (
    normalizedClue.includes(normalizedEvidence) ||
    normalizedEvidence.includes(normalizedClue)
  ) {
    return true;
  }

  const evidenceTokens = extractMeaningfulTokens(normalizedEvidence);
  if (evidenceTokens.length === 0) {
    return false;
  }

  const clueTokens = new Set(extractMeaningfulTokens(normalizedClue));
  const overlap = evidenceTokens.filter((token) =>
    clueTokens.has(token),
  ).length;

  return overlap / evidenceTokens.length >= 0.6;
}

function extractMeaningfulTokens(value: string): string[] {
  return value
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

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
          specialty: 'Vascular Surgery',
          subspecialty: 'Peripheral Vascular Disease',
          category: 'Non-atherosclerotic Occlusive Vascular Disease',
          bodySystem: 'Cardiovascular',
          organSystem: 'Peripheral Arteries and Veins',
          difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
          rarityBand: DiagnosisRarityBand.UNCOMMON,
          clinicalSetting: DiagnosisClinicalSetting.OUTPATIENT,
          ageGroup: DiagnosisAgeGroup.ADULT,
          urgencyLevel: DiagnosisUrgencyLevel.URGENT,
          preferredClueTypes: ['history', 'symptom', 'exam', 'lab', 'imaging'],
          notes:
            'Flagship Buerger disease registry entry with tobacco-linked distal arterial and venous disease teaching metadata.',
        },
        select: {
          id: true,
          displayLabel: true,
        },
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
          specialty: 'Vascular Surgery',
          subspecialty: 'Peripheral Vascular Disease',
          category: 'Non-atherosclerotic Occlusive Vascular Disease',
          bodySystem: 'Cardiovascular',
          organSystem: 'Peripheral Arteries and Veins',
          difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
          rarityBand: DiagnosisRarityBand.UNCOMMON,
          clinicalSetting: DiagnosisClinicalSetting.OUTPATIENT,
          ageGroup: DiagnosisAgeGroup.ADULT,
          urgencyLevel: DiagnosisUrgencyLevel.URGENT,
          preferredClueTypes: ['history', 'symptom', 'exam', 'lab', 'imaging'],
          notes:
            'Flagship Buerger disease registry entry with tobacco-linked distal arterial and venous disease teaching metadata.',
        },
        select: {
          id: true,
          displayLabel: true,
        },
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

async function upsertEducation(diagnosisRegistryId: string) {
  const existing = await prisma.diagnosisEducation.findUnique({
    where: { diagnosisRegistryId },
    select: { id: true, version: true },
  });

  const education = existing
    ? await prisma.diagnosisEducation.update({
        where: { id: existing.id },
        data: {
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
        select: { id: true, version: true },
      })
    : await prisma.diagnosisEducation.create({
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

async function upsertCase(params: {
  diagnosisRegistryId: string;
  registryDisplayLabel: string;
  educationId: string;
}) {
  const history = clues[0].value;
  const symptoms = [clues[1].value];

  const clueValidation = caseEligibilityPolicy.validatePlayableClues(clues, {
    minimumPlayableClues: 6,
  });

  if (!clueValidation.valid) {
    throw new Error(
      `${displayLabel} clues are not playable: ${clueValidation.reasons.join(', ') || 'unknown reason'}.`,
    );
  }

  const preflightValidation = caseValidationService.validateSnapshot({
    caseId: 'seed-preflight',
    title: caseTitle,
    date: inventoryPlaceholderDate,
    difficulty: 'medium',
    history,
    symptoms,
    labs: null,
    clues: clues as unknown as object[],
    explanation: explanation as unknown as object,
    differentials,
    diagnosisId: null,
    diagnosisRegistryId: params.diagnosisRegistryId,
    proposedDiagnosisText: displayLabel,
    diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
    diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
    diagnosisMappingConfidence: 1,
    diagnosisEditorialNote:
      'Preflight validation for flagship Buerger disease seed.',
  });

  if (preflightValidation.outcome !== 'PASSED') {
    throw new Error(
      `${displayLabel} case failed Wardle validation: ${preflightValidation.issues.map((issue) => `${issue.code}: ${issue.message}`).join('; ')}`,
    );
  }

  const existingCases = await prisma.case.findMany({
    where: {
      diagnosisRegistryId: params.diagnosisRegistryId,
      title: caseTitle,
    },
    orderBy: [{ approvedAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      currentRevisionId: true,
      publicNumber: true,
      title: true,
      date: true,
      dailyCases: { select: { id: true }, take: 1 },
    },
  });

  const reusableCase = existingCases.find(
    (caseRecord) => caseRecord.dailyCases.length === 0,
  );
  const scheduledCase = existingCases.find(
    (caseRecord) => caseRecord.dailyCases.length > 0,
  );
  const targetCase = scheduledCase ?? reusableCase;

  if (scheduledCase) {
    console.log(
      `One-off production update enabled for scheduled ${displayLabel} case:`,
      scheduledCase,
    );
  }

  const assignedDate =
    targetCase?.date ??
    (await findAvailableInventoryPlaceholderDate({
      preferredDate: inventoryPlaceholderDate,
      reusableCaseId: reusableCase?.id,
      displayLabel: caseTitle,
    }));

  const publicNumber =
    targetCase?.publicNumber ?? (await getNextCasePublicNumber());

  const caseData = {
    title: caseTitle,
    publicNumber,
    date: assignedDate,
    difficulty: 'medium',
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
      'Seeded complete frontend-aligned flagship Buerger disease case with distal ischaemia, migratory thrombophlebitis, exclusion work-up, angiography, and diagnosis education.',
  };

  const seededCase = targetCase
    ? await prisma.case.update({
        where: { id: targetCase.id },
        data: caseData,
        select: { id: true },
      })
    : await prisma.case.create({
        data: caseData,
        select: { id: true },
      });

  const latestRevision = await prisma.caseRevision.findFirst({
    where: { caseId: seededCase.id },
    orderBy: { revisionNumber: 'desc' },
    select: { revisionNumber: true },
  });

  const revision = await prisma.caseRevision.create({
    data: {
      caseId: seededCase.id,
      revisionNumber: (latestRevision?.revisionNumber ?? 0) + 1,
      source: CaseSource.MANUAL,
      publishTrack: PublishTrack.DAILY,
      title: caseTitle,
      date: assignedDate,
      difficulty: 'medium',
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
        'Created complete Buerger disease revision with clue-order-aligned differential analysis and full diagnosis education.',
    },
    select: { id: true },
  });

  await prisma.case.update({
    where: { id: seededCase.id },
    data: { currentRevisionId: revision.id },
  });

  const validationReport = caseValidationService.validateSnapshot({
    caseId: seededCase.id,
    title: caseTitle,
    date: assignedDate,
    difficulty: 'medium',
    history,
    symptoms,
    labs: null,
    clues: clues as unknown as object[],
    explanation: explanation as unknown as object,
    differentials,
    diagnosisId: null,
    diagnosisRegistryId: params.diagnosisRegistryId,
    proposedDiagnosisText: displayLabel,
    diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
    diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
    diagnosisMappingConfidence: 1,
    diagnosisEditorialNote:
      'Stored validation for flagship Buerger disease seed.',
  });
  const validationPayload =
    caseValidationService.buildPersistencePayload(validationReport);
  const validationSummary =
    validationPayload.summary &&
    typeof validationPayload.summary === 'object' &&
    !Array.isArray(validationPayload.summary)
      ? validationPayload.summary
      : {};

  await prisma.caseValidationRun.create({
    data: {
      caseId: seededCase.id,
      revisionId: revision.id,
      source: CaseSource.MANUAL,
      publishTrack: PublishTrack.DAILY,
      outcome: validationReport.outcome,
      validatorVersion: validationReport.validatorVersion,
      summary: {
        ...validationSummary,
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        clueProgressionVerified: true,
        wardleClueValidation: {
          playableClueCount: clueValidation.playableClueCount,
          clueTypes: clueValidation.clues.map((clue) => clue.type),
          clueOrders: clueValidation.clues.map((clue) => clue.order),
        },
        metadataVerified: {
          specialty: 'Vascular Surgery',
          subspecialty: 'Peripheral Vascular Disease',
          category: 'Non-atherosclerotic Occlusive Vascular Disease',
          bodySystem: 'Cardiovascular',
          organSystem: 'Peripheral Arteries and Veins',
          difficultyBand: 'INTERMEDIATE',
          rarityBand: 'UNCOMMON',
          clinicalSetting: 'OUTPATIENT',
          ageGroup: 'ADULT',
          urgencyLevel: 'URGENT',
        },
        note: 'Complete Buerger disease flagship seed with six supported playable clue types, correctly aligned clueOrder references, canonical registry aliases, and full education payload.',
      },
      findings: validationPayload.findings,
      completedAt: now,
    },
  });

  const persisted = await prisma.case.findUniqueOrThrow({
    where: { id: seededCase.id },
    select: {
      id: true,
      clues: true,
      currentRevisionId: true,
      currentRevision: {
        select: {
          id: true,
          clues: true,
        },
      },
    },
  });

  const persistedCaseClues = caseEligibilityPolicy.validatePlayableClues(
    persisted.clues,
    { caseId: persisted.id, minimumPlayableClues: 6 },
  );
  const persistedRevisionClues = caseEligibilityPolicy.validatePlayableClues(
    persisted.currentRevision?.clues,
    { caseId: persisted.id, minimumPlayableClues: 6 },
  );

  if (!persistedCaseClues.valid || !persistedRevisionClues.valid) {
    throw new Error(
      `Persisted ${displayLabel} clues are not playable. Case reasons: ${persistedCaseClues.reasons.join(', ') || 'none'}; revision reasons: ${persistedRevisionClues.reasons.join(', ') || 'none'}.`,
    );
  }

  if (
    persisted.currentRevisionId !== revision.id ||
    persisted.currentRevision?.id !== revision.id
  ) {
    throw new Error(
      `Case ${seededCase.id} currentRevisionId does not point to revision ${revision.id}.`,
    );
  }

  console.log('Seeded Buerger Disease:', {
    registryId: params.diagnosisRegistryId,
    registryDisplayLabel: params.registryDisplayLabel,
    caseId: seededCase.id,
    revisionId: revision.id,
    publicNumber,
    educationId: params.educationId,
    validationOutcome: validationReport.outcome,
    validatorVersion: validationReport.validatorVersion,
    clueTypes: persistedCaseClues.clues.map((clue) => clue.type),
    clueOrders: persistedCaseClues.clues.map((clue) => clue.order),
  });
}

async function main() {
  validateStaticSeedContent();

  const registry = await ensureRegistry();
  const education = await upsertEducation(registry.id);

  await upsertCase({
    diagnosisRegistryId: registry.id,
    registryDisplayLabel: registry.displayLabel,
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
