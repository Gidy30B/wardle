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

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run Kawasaki disease seed.');
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
  for (let offset = 0; offset < 365; offset += 1) {
    const candidateDate = addUtcDays(params.preferredDate, offset);

    const owner = await prisma.case.findUnique({
      where: { date: candidateDate },
      select: {
        id: true,
        dailyCases: { select: { id: true }, take: 1 },
      },
    });

    if (!owner) return candidateDate;
    if (params.reusableCaseId && owner.id === params.reusableCaseId) {
      return candidateDate;
    }
  }

  throw new Error(`No free inventory placeholder date for ${params.displayLabel}.`);
}

const now = new Date();
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 0, 17, 12, 0, 0));
const seedVersion = 'flagship-kawasaki-disease-v1';

const canonicalName = 'kawasaki disease';
const displayLabel = 'Kawasaki Disease';
const caseTitle = 'Kawasaki Disease with Coronary Artery Dilatation';

const aliasTerms = [
  'Kawasaki Disease',
  'kawasaki disease',
  'kawasaki syndrome',
  'mucocutaneous lymph node syndrome',
  'acute febrile mucocutaneous lymph node syndrome',
  'incomplete kawasaki disease',
];

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 3-year-old child is brought to the emergency department with persistent high fever for six days despite regular antipyretics.',
  },
  {
    order: 1,
    type: 'symptom',
    value:
      'The parents report marked irritability, poor feeding, and reduced playfulness, with no prominent cough, diarrhea, dysuria, or focal source of infection.',
  },
  {
    order: 2,
    type: 'exam',
    value:
      'Examination reveals bilateral non-purulent conjunctival injection and cracked erythematous lips with a red strawberry tongue.',
  },
  {
    order: 3,
    type: 'exam',
    value:
      'A diffuse polymorphous rash is present over the trunk, and a tender 2 cm unilateral cervical lymph node is palpable on the left side of the neck.',
  },
  {
    order: 4,
    type: 'exam',
    value:
      'The hands and feet are swollen with erythema of the palms and soles, and the child remains febrile and unusually irritable during the assessment.',
  },
  {
    order: 5,
    type: 'investigation',
    value:
      'Inflammatory markers are markedly elevated with thrombocytosis on repeat blood count, and echocardiography demonstrates mild dilation of the coronary arteries.',
  },
] as const;

const differentials = [
  'Scarlet Fever',
  'Measles',
  'Adenovirus Infection',
  'Toxic Shock Syndrome',
  'Systemic Juvenile Idiopathic Arthritis',
];

const explanation = {
  diagnosis: displayLabel,
  summary:
    'Fever for more than five days with bilateral non-purulent conjunctivitis, oral mucosal changes, polymorphous rash, cervical lymphadenopathy, extremity swelling and erythema, raised inflammatory markers, thrombocytosis, and coronary artery dilation supports Kawasaki disease.',
  reasoning: [
    'Persistent fever beyond five days in a young child should raise concern for inflammatory disease when no focal infection is found.',
    'Marked irritability is common in Kawasaki disease and helps separate it from many simple viral illnesses.',
    'Bilateral non-purulent conjunctival injection with cracked lips and strawberry tongue provides the mucocutaneous pattern.',
    'Polymorphous rash plus unilateral cervical lymphadenopathy adds two further classic diagnostic features.',
    'Swollen erythematous hands and feet complete the extremity-change component of Kawasaki disease.',
    'Elevated inflammatory markers with thrombocytosis and coronary artery dilation strongly support Kawasaki disease and highlight the major complication.',
  ],
  keyFindings: [
    'Age 3 years',
    'Fever for six days',
    'No clear focal infection',
    'Marked irritability',
    'Bilateral non-purulent conjunctival injection',
    'Cracked erythematous lips',
    'Strawberry tongue',
    'Polymorphous truncal rash',
    'Tender unilateral cervical lymphadenopathy',
    'Swollen hands and feet',
    'Palmar and plantar erythema',
    'Markedly elevated inflammatory markers',
    'Thrombocytosis on repeat blood count',
    'Mild coronary artery dilation',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Scarlet Fever',
      whyPlausibleEarly:
        'Fever, rash, strawberry tongue, and cervical lymphadenopathy can suggest scarlet fever from group A streptococcal infection.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence:
            'bilateral non-purulent conjunctival injection with cracked erythematous lips',
          reason:
            'Non-purulent conjunctivitis and broad mucocutaneous involvement are more characteristic of Kawasaki disease than uncomplicated scarlet fever.',
        },
        {
          clueOrder: 5,
          evidence: 'coronary artery dilation on echocardiography',
          reason:
            'Coronary artery involvement is a hallmark complication of Kawasaki disease and is not explained by scarlet fever.',
        },
      ],
      finalReasonLessLikely:
        'Scarlet fever does not explain the full CRASH pattern with extremity changes and coronary artery dilation.',
    },
    {
      diagnosis: 'Measles',
      whyPlausibleEarly:
        'Fever, conjunctivitis, and rash can resemble measles early in the illness.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'no prominent cough or diarrhea',
          reason:
            'Measles usually has a prominent viral prodrome with cough, coryza, conjunctivitis, and systemic respiratory symptoms.',
        },
        {
          clueOrder: 4,
          evidence: 'swollen erythematous hands and feet',
          reason:
            'Extremity swelling and palm or sole erythema favor Kawasaki disease over measles.',
        },
      ],
      finalReasonLessLikely:
        'There are no Koplik spots or classic cephalocaudal measles progression, and coronary involvement points away from measles.',
    },
    {
      diagnosis: 'Adenovirus Infection',
      whyPlausibleEarly:
        'Adenovirus can cause fever, conjunctivitis, pharyngitis, and a viral-appearing rash in children.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: 'non-purulent conjunctivitis with cracked lips and strawberry tongue',
          reason:
            'The mucosal pattern is broader than typical adenoviral conjunctivitis or pharyngitis.',
        },
        {
          clueOrder: 5,
          evidence:
            'thrombocytosis and mild dilation of the coronary arteries',
          reason:
            'Coronary artery changes and subacute thrombocytosis support Kawasaki disease rather than uncomplicated adenovirus.',
        },
      ],
      finalReasonLessLikely:
        'Adenovirus does not explain the complete mucocutaneous pattern with coronary artery involvement.',
    },
    {
      diagnosis: 'Toxic Shock Syndrome',
      whyPlausibleEarly:
        'Fever, rash, mucosal involvement, and systemic illness can suggest toxic shock syndrome.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'no diarrhea or focal source of infection',
          reason:
            'Toxic shock often has prominent systemic toxicity, gastrointestinal symptoms, hypotension, or an identifiable staphylococcal or streptococcal source.',
        },
        {
          clueOrder: 5,
          evidence: 'coronary artery dilation on echocardiography',
          reason:
            'Coronary artery inflammation is a Kawasaki disease complication rather than a feature of toxic shock syndrome.',
        },
      ],
      finalReasonLessLikely:
        'The child has a classic Kawasaki mucocutaneous pattern without shock or multiorgan failure features.',
    },
    {
      diagnosis: 'Systemic Juvenile Idiopathic Arthritis',
      whyPlausibleEarly:
        'Persistent fever, rash, and high inflammatory markers can suggest systemic juvenile idiopathic arthritis.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: 'cracked lips, strawberry tongue, and non-purulent conjunctivitis',
          reason:
            'Prominent mucocutaneous findings are more typical of Kawasaki disease.',
        },
        {
          clueOrder: 5,
          evidence: 'coronary artery dilation',
          reason:
            'Coronary arteritis or dilation strongly favors Kawasaki disease.',
        },
      ],
      finalReasonLessLikely:
        'Systemic JIA usually has quotidian fever, evanescent rash, arthritis, serositis, or hepatosplenomegaly rather than the classic CRASH pattern.',
    },
  ],
  managementPearl:
    'Kawasaki disease is a pediatric inflammatory vasculitis with risk of coronary artery aneurysms. Treat promptly with intravenous immunoglobulin and aspirin, obtain echocardiography, and involve pediatric cardiology when coronary changes or high-risk features are present.',
  generationQuality: {
    contentTier: 'FLAGSHIP',
    seedVersion,
    humanReviewed: true,
    discriminatorStrength: 'HIGH',
    expectedTeachingPoints: [
      'Kawasaki disease should be considered in fever lasting more than five days with mucocutaneous findings',
      'The CRASH and burn pattern helps identify the major diagnostic features',
      'Coronary artery aneurysm or dilation is the feared complication',
      'Echocardiography is essential at diagnosis and follow-up',
      'Early intravenous immunoglobulin reduces coronary complications',
    ],
    competencyDomains: [
      'Paediatrics',
      'Paediatric Cardiology',
      'Rheumatology',
      'Emergency Medicine',
      'Clinical Reasoning',
    ],
  },
};

const educationForFrontend = {
  title: displayLabel,
  summary: {
    definition:
      'Kawasaki disease is an acute self-limited medium-vessel vasculitis of childhood, classically affecting the coronary arteries and presenting with prolonged fever plus mucocutaneous inflammation.',
    highYieldTakeaway:
      'Think Kawasaki disease in a young child with fever for at least five days plus non-purulent conjunctivitis, oral changes, rash, cervical lymphadenopathy, extremity changes, and elevated inflammatory markers.',
  },
  recognitionPattern: [
    {
      pattern: 'Prolonged fever with mucocutaneous inflammation',
      whyItMatters:
        'Fever lasting more than five days with multiple mucocutaneous signs should trigger Kawasaki disease assessment because treatment is time-sensitive.',
      progression:
        'Systemic vascular inflammation -> persistent fever and irritability -> conjunctival, oral, skin, lymph node, and extremity findings -> coronary arteritis and possible aneurysm formation.',
      discriminator:
        'The combination of non-purulent conjunctivitis, oral changes, polymorphous rash, extremity changes, and cervical lymphadenopathy is more specific than fever and rash alone.',
      commonTrap:
        'Do not dismiss persistent fever and rash as a viral illness when the child has red eyes, cracked lips, swollen hands or feet, and marked irritability.',
    },
    {
      pattern: 'Coronary-risk vasculitis',
      whyItMatters:
        'Kawasaki disease is important because untreated coronary artery inflammation can lead to aneurysm, thrombosis, myocardial ischemia, or sudden death later.',
      discriminator:
        'Coronary artery dilation on echocardiography separates Kawasaki disease from most routine infectious rashes.',
      commonTrap:
        'Do not wait for coronary abnormalities before treating if the clinical syndrome is convincing.',
    },
    {
      pattern: 'Incomplete Kawasaki disease',
      whyItMatters:
        'Some children do not meet all classic criteria but still have coronary risk, especially infants and young children with persistent unexplained fever and inflammation.',
      discriminator:
        'High inflammatory markers, thrombocytosis, sterile pyuria, transaminitis, hypoalbuminaemia, or coronary changes can support the diagnosis when criteria are incomplete.',
      commonTrap:
        'Do not exclude Kawasaki disease solely because all five classic clinical features are not present at the first assessment.',
    },
  ],
  keySymptoms: [
    {
      symptom: 'Fever for at least five days',
      significance:
        'Persistent fever is the anchor feature and should prompt evaluation for Kawasaki disease when mucocutaneous signs are present.',
    },
    {
      symptom: 'Marked irritability',
      significance:
        'Children with Kawasaki disease are often strikingly irritable, sometimes more than expected for a simple viral illness.',
    },
    {
      symptom: 'Poor feeding or reduced playfulness',
      significance:
        'Nonspecific systemic symptoms reflect inflammatory illness and help distinguish the child from a well-appearing viral exanthem.',
    },
  ],
  keySigns: [
    {
      finding: 'Bilateral non-purulent conjunctival injection',
      significance:
        'A major clinical criterion and a key separator from bacterial conjunctivitis.',
      discriminator:
        'Non-purulent red eyes with fever and mucosal changes favor Kawasaki disease over isolated conjunctivitis.',
    },
    {
      finding: 'Cracked red lips or strawberry tongue',
      significance:
        'Oral mucosal inflammation is a classic Kawasaki disease feature.',
      discriminator:
        'Oral changes combined with conjunctivitis and extremity swelling are more suggestive than any single finding alone.',
    },
    {
      finding: 'Polymorphous rash',
      significance:
        'A variable rash is common and may mimic viral exanthem, scarlet fever, or drug eruption.',
    },
    {
      finding: 'Unilateral cervical lymphadenopathy',
      significance:
        'A cervical node at least 1.5 cm is one of the diagnostic clinical features.',
    },
    {
      finding: 'Extremity erythema and swelling',
      significance:
        'Swelling or erythema of palms and soles is a strong clue and may later progress to periungual desquamation.',
      discriminator:
        'Extremity changes are less typical of measles, adenovirus, or uncomplicated scarlet fever.',
    },
  ],
  examPearls: [
    {
      type: 'DISCRIMINATOR',
      title: 'Non-purulent conjunctivitis plus oral changes is a major clue',
      content:
        'Bilateral red eyes without discharge, cracked lips, and strawberry tongue in a persistently febrile child should immediately raise Kawasaki disease.',
      whyItMatters:
        'These findings shift the diagnosis from nonspecific infection toward systemic vasculitis.',
      discriminator:
        'Bacterial conjunctivitis is usually purulent; measles usually has cough, coryza, Koplik spots, and a characteristic rash pattern.',
      trapAvoided:
        'Do not treat each mucocutaneous feature as a separate minor infection.',
    },
    {
      type: 'DISCRIMINATOR',
      title: 'Extremity changes are high-yield',
      content:
        'Swollen erythematous hands and feet during the acute illness strongly support Kawasaki disease and may be followed by peeling around the nails.',
      whyItMatters:
        'Extremity findings are often the clue that separates Kawasaki disease from common viral exanthems.',
      discriminator:
        'Simple viral infections rarely produce the full combination of persistent fever, red eyes, oral changes, rash, lymphadenopathy, and extremity swelling.',
      trapAvoided:
        'Do not wait for desquamation; peeling may occur later after the acute phase.',
    },
    {
      type: 'MNEMONIC',
      title: 'CRASH and burn',
      content:
        'CRASH means Conjunctivitis, Rash, Adenopathy, Strawberry tongue or oral changes, and Hand or foot changes; burn is the persistent fever.',
      whyItMatters:
        'The mnemonic organizes the classic diagnostic features around the fever anchor.',
      discriminator:
        'It helps distinguish Kawasaki disease from isolated fever-rash illnesses by requiring a constellation of mucocutaneous findings.',
      trapAvoided:
        'Do not place CRASH under scoringSystems; it is a memory aid, not a formal severity score.',
    },
  ],
  scoringSystems: [],
  investigations: [
    {
      test: 'Inflammatory markers',
      interpretation:
        'Elevated CRP and ESR support systemic inflammation and are useful when Kawasaki disease is suspected.',
      whyItMatters:
        'High inflammatory markers help distinguish Kawasaki disease from mild viral illness and support incomplete Kawasaki disease evaluation.',
    },
    {
      test: 'Full blood count',
      interpretation:
        'Leukocytosis may occur early; thrombocytosis is common after the first week.',
      whyItMatters:
        'Thrombocytosis in the subacute phase supports the diagnosis and reflects ongoing inflammation.',
    },
    {
      test: 'Echocardiography',
      interpretation:
        'Assesses coronary artery dilation or aneurysm, ventricular function, myocarditis, pericardial effusion, and valvular involvement.',
      whyItMatters:
        'Coronary assessment is central because prevention of coronary complications is the main reason for urgent treatment.',
    },
    {
      test: 'Liver function tests and albumin',
      interpretation:
        'May show transaminitis or hypoalbuminaemia in more inflammatory disease.',
      whyItMatters:
        'Supportive laboratory abnormalities can strengthen the diagnosis in incomplete presentations.',
    },
    {
      test: 'Urinalysis',
      interpretation:
        'Sterile pyuria may be present.',
      whyItMatters:
        'Sterile pyuria can support Kawasaki disease and prevents mislabeling the illness as a simple urinary tract infection without culture evidence.',
    },
    {
      test: 'Targeted infectious testing when indicated',
      interpretation:
        'Testing for streptococcal infection, measles, adenovirus, or sepsis may be needed depending on exposure and local epidemiology.',
      whyItMatters:
        'Kawasaki disease is a clinical diagnosis, but important mimics should be considered and treated appropriately.',
    },
  ],
  managementOverview: [
    {
      step: 'Admit or urgently assess suspected Kawasaki disease',
      rationale:
        'Children require timely evaluation, inflammatory markers, echocardiography planning, and treatment to reduce coronary risk.',
    },
    {
      step: 'Give intravenous immunoglobulin',
      rationale:
        'IVIG given early, ideally within the first 10 days of illness, reduces the risk of coronary artery aneurysms.',
    },
    {
      step: 'Use aspirin according to local protocol',
      rationale:
        'Aspirin is used for anti-inflammatory and antiplatelet effects, with dosing adjusted as fever and inflammation resolve.',
    },
    {
      step: 'Perform echocardiography and arrange follow-up imaging',
      rationale:
        'Initial and follow-up echocardiography detect coronary artery dilation, aneurysm, or evolving cardiac involvement.',
    },
    {
      step: 'Consult paediatrics and cardiology when high-risk features exist',
      rationale:
        'Coronary changes, very young age, shock, IVIG resistance, or severe inflammation require specialist input.',
    },
    {
      step: 'Escalate treatment for IVIG-resistant disease',
      rationale:
        'Persistent or recrudescent fever after IVIG may require additional therapy such as repeat IVIG, corticosteroids, or biologic agents depending on protocol.',
    },
    {
      step: 'Give vaccine counselling after IVIG',
      rationale:
        'Live vaccines may need to be delayed after IVIG because passive antibodies can reduce vaccine response.',
    },
  ],
  differentialDistinguishers: [
    {
      diagnosis: 'Scarlet Fever',
      whyConfused:
        'Both can cause fever, rash, strawberry tongue, and cervical lymphadenopathy.',
      distinguishingPoint:
        'Kawasaki disease has non-purulent conjunctivitis, extremity changes, persistent inflammation, and possible coronary involvement.',
      keySeparator:
        'Coronary artery dilation and the full CRASH pattern favor Kawasaki disease.',
      classicTrap:
        'Treating as scarlet fever alone and missing echocardiography or IVIG when Kawasaki features are present.',
    },
    {
      diagnosis: 'Measles',
      whyConfused:
        'Measles can present with fever, conjunctivitis, and rash.',
      distinguishingPoint:
        'Measles usually has cough, coryza, Koplik spots, and a cephalocaudal rash spread rather than extremity swelling and coronary changes.',
      keySeparator:
        'Extremity changes and coronary dilation point toward Kawasaki disease.',
      classicTrap:
        'Assuming every febrile conjunctivitis-rash illness is measles without checking oral, extremity, and coronary clues.',
    },
    {
      diagnosis: 'Adenovirus Infection',
      whyConfused:
        'Adenovirus may cause prolonged fever, conjunctivitis, pharyngitis, and rash.',
      distinguishingPoint:
        'Kawasaki disease produces a broader mucocutaneous syndrome with extremity changes and coronary risk.',
      keySeparator:
        'Coronary artery dilation and thrombocytosis after the first week strongly support Kawasaki disease.',
      classicTrap:
        'Stopping at a viral diagnosis when persistent fever and extremity findings suggest vasculitis.',
    },
    {
      diagnosis: 'Toxic Shock Syndrome',
      whyConfused:
        'Both can cause fever, rash, mucosal changes, and systemic illness.',
      distinguishingPoint:
        'Toxic shock usually has shock, multiorgan involvement, prominent toxicity, and an infectious toxin source.',
      keySeparator:
        'Kawasaki disease is favored by the classic CRASH pattern and coronary artery involvement without shock.',
      classicTrap:
        'Missing Kawasaki disease because the child appears very irritable and systemically unwell.',
    },
    {
      diagnosis: 'Systemic Juvenile Idiopathic Arthritis',
      whyConfused:
        'Both can cause prolonged fever, rash, and raised inflammatory markers.',
      distinguishingPoint:
        'Systemic JIA more often has quotidian fever, evanescent rash, arthritis, hepatosplenomegaly, or serositis.',
      keySeparator:
        'Non-purulent conjunctivitis, oral changes, extremity swelling, and coronary dilation favor Kawasaki disease.',
      classicTrap:
        'Labeling persistent fever as rheumatologic without recognizing time-sensitive coronary-risk vasculitis.',
    },
  ],
  complications: [
    {
      complication: 'Coronary artery aneurysm',
      whyItMatters:
        'The most feared complication and the major reason for urgent IVIG treatment and echocardiographic surveillance.',
    },
    {
      complication: 'Coronary thrombosis or myocardial infarction',
      whyItMatters:
        'Large aneurysms can thrombose and cause ischemia even in young children.',
    },
    {
      complication: 'Myocarditis',
      whyItMatters:
        'Can contribute to tachycardia, reduced ventricular function, or shock-like presentations.',
    },
    {
      complication: 'Pericardial effusion',
      whyItMatters:
        'Reflects cardiac inflammation and may be detected on echocardiography.',
    },
    {
      complication: 'Valvular regurgitation',
      whyItMatters:
        'Inflammation can affect cardiac valves and contribute to follow-up needs.',
    },
    {
      complication: 'Kawasaki disease shock syndrome',
      whyItMatters:
        'A severe form with hypotension or poor perfusion requiring urgent escalation.',
    },
  ],
  pitfalls: [
    {
      pitfall: 'Calling it a viral exanthem too early',
      consequence:
        'Delays IVIG and increases the risk of coronary artery complications.',
    },
    {
      pitfall: 'Waiting for all classic criteria to appear',
      consequence:
        'Incomplete Kawasaki disease can still cause coronary artery aneurysms.',
    },
    {
      pitfall: 'Ignoring extremity swelling or erythema',
      consequence:
        'Misses one of the strongest discriminators from routine viral illness.',
    },
    {
      pitfall: 'Forgetting echocardiography',
      consequence:
        'Misses coronary artery dilation, myocarditis, or evolving aneurysm formation.',
    },
    {
      pitfall: 'Putting CRASH mnemonic under scoringSystems',
      consequence:
        'Pollutes scoringSystems with a mnemonic rather than reserving it for formal validated scores.',
    },
  ],
  recallPrompts: [
    {
      prompt: 'What fever duration should raise concern for Kawasaki disease?',
      answer:
        'Fever lasting at least five days, especially with mucocutaneous features.',
    },
    {
      prompt: 'What are the CRASH features of Kawasaki disease?',
      answer:
        'Conjunctivitis, Rash, Adenopathy, Strawberry tongue or oral changes, and Hand or foot changes.',
    },
    {
      prompt: 'What is the most feared cardiovascular complication of Kawasaki disease?',
      answer: 'Coronary artery aneurysm or dilation.',
    },
    {
      prompt: 'What treatment reduces the risk of coronary artery aneurysms?',
      answer: 'Early intravenous immunoglobulin, usually with aspirin according to local protocol.',
    },
    {
      prompt: 'Why is echocardiography performed in suspected Kawasaki disease?',
      answer:
        'To assess coronary artery dilation or aneurysm and other cardiac involvement such as myocarditis or effusion.',
    },
  ],
  references: [
    { citation: 'American Heart Association scientific statement on diagnosis, treatment, and long-term management of Kawasaki disease.' },
    { citation: 'Nelson Textbook of Pediatrics.' },
    { citation: 'RCPCH and paediatric cardiology guidance on Kawasaki disease and paediatric inflammatory vasculitis.' },
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
          category: 'Vasculitis',
          bodySystem: 'Multisystem',
          organSystem: 'Coronary Arteries',
          difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
          rarityBand: DiagnosisRarityBand.UNCOMMON,
          clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
          ageGroup: DiagnosisAgeGroup.PEDIATRIC,
          urgencyLevel: DiagnosisUrgencyLevel.URGENT,
          preferredClueTypes: [
            'history',
            'symptom',
            'exam',
            'investigation',
          ],
          notes:
            'Seeded flagship Kawasaki disease case with paediatric vasculitis teaching metadata.',
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
          specialty: 'Paediatrics',
          subspecialty: 'Paediatric Cardiology',
          category: 'Vasculitis',
          bodySystem: 'Multisystem',
          organSystem: 'Coronary Arteries',
          difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
          rarityBand: DiagnosisRarityBand.UNCOMMON,
          clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
          ageGroup: DiagnosisAgeGroup.PEDIATRIC,
          urgencyLevel: DiagnosisUrgencyLevel.URGENT,
          preferredClueTypes: [
            'history',
            'symptom',
            'exam',
            'investigation',
          ],
          notes:
            'Seeded flagship Kawasaki disease case with paediatric vasculitis teaching metadata.',
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

  const reusableCase = existingCases.find((c) => c.dailyCases.length === 0);
  const scheduledCase = existingCases.find((c) => c.dailyCases.length > 0);

  if (scheduledCase) {
    console.log('Skipped existing scheduled Kawasaki disease case:', scheduledCase);
    return;
  }

  const assignedDate = await findAvailableInventoryPlaceholderDate({
    preferredDate: inventoryPlaceholderDate,
    reusableCaseId: reusableCase?.id,
    displayLabel: caseTitle,
  });

  const publicNumber =
    reusableCase?.publicNumber ?? (await getNextCasePublicNumber());

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
      'Seeded complete frontend-aligned flagship Kawasaki disease case with education.',
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
        'Created complete Kawasaki disease revision with education-aligned explanation.',
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
      validatorVersion: 'flagship-human-review:kawasaki-disease-v1',
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        note:
          'Complete Kawasaki disease flagship seed with playable clue types and full education payload.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded Kawasaki Disease:', {
    registryId: params.diagnosisRegistryId,
    caseId: seededCase.id,
    revisionId: revision.id,
    publicNumber,
    educationId: params.educationId,
    clueTypes: clues.map((c) => c.type),
  });
}

async function main() {
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