import {
  PrismaClient,
  CaseEditorialStatus,
  DiagnosisAliasKind,
  DiagnosisAgeGroup,
  DiagnosisClinicalSetting,
  DiagnosisDifficultyBand,
  DiagnosisEducationSource,
  DiagnosisEducationStatus,
  DiagnosisMappingMethod,
  DiagnosisMappingStatus,
  DiagnosisRegistryStatus,
  DiagnosisRarityBand,
  DiagnosisUrgencyLevel,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { assertAliasValidWithClient } from '../../src/modules/diagnosis-registry/alias-validation.service';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run the celiac disease seed.');
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
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 0, 5, 12, 0, 0));
const seedVersion = 'flagship-celiac-disease-v1';

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

async function getNextCasePublicNumber(): Promise<number> {
  const latest = await prisma.case.findFirst({
    where: {
      publicNumber: {
        not: null,
      },
    },
    orderBy: {
      publicNumber: 'desc',
    },
    select: {
      publicNumber: true,
    },
  });

  return (latest?.publicNumber ?? 0) + 1;
}

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 28-year-old woman presents with a 9-month history of intermittent bloating, loose stools, and fatigue that has worsened despite dietary changes.',
  },
  {
    order: 1,
    type: 'symptom',
    value:
      'She reports that her stools are pale, bulky, and difficult to flush, and she has lost 6 kg unintentionally over the past year.',
  },
  {
    order: 2,
    type: 'history',
    value:
      'She has a family history of thyroid disease in her mother and was recently treated for iron-deficiency anaemia that did not respond to oral iron supplementation.',
  },
  {
    order: 3,
    type: 'exam',
    value:
      'Examination reveals mild pallor and angular cheilitis; the abdomen is soft with mild central bloating but no organomegaly.',
  },
  {
    order: 4,
    type: 'lab',
    value:
      'Bloods show haemoglobin 98 g/L (MCV 74 fL), ferritin 6 µg/L, folate 2.1 nmol/L, and mildly elevated ALT at 52 U/L.',
  },
  {
    order: 5,
    type: 'investigation',
    value:
      'Tissue transglutaminase IgA (tTG-IgA) is markedly elevated at 142 U/mL (reference <7 U/mL); total IgA is normal. Duodenal biopsy shows villous atrophy with crypt hyperplasia (Marsh grade 3b).',
  },
] as const;

const differentials = [
  'Irritable bowel syndrome',
  'Inflammatory bowel disease',
  'Small intestinal bacterial overgrowth',
  'Microscopic colitis',
];

const explanation = {
  diagnosis: 'Celiac Disease',
  summary:
    'Chronic malabsorptive symptoms, refractory iron-deficiency anaemia, folate deficiency, elevated transaminases, markedly positive tTG-IgA, and villous atrophy on biopsy confirm celiac disease in a young woman with a family history of autoimmune disease.',
  keyEvidence: [
    'Chronic steatorrhoea and bloating',
    'Refractory iron-deficiency anaemia',
    'Folate deficiency',
    'Elevated ALT',
    'Markedly elevated tTG-IgA',
    'Villous atrophy on duodenal biopsy (Marsh 3b)',
  ],
  reasoning: [
    'Pale, bulky, difficult-to-flush stools point to steatorrhoea from fat malabsorption in the small bowel.',
    'Iron-deficiency anaemia unresponsive to oral supplementation is a classic presentation of proximal small bowel malabsorption.',
    'Folate deficiency adds to the malabsorption picture; both iron and folate are absorbed in the duodenum and proximal jejunum.',
    'Mildly elevated ALT is a recognised extra-intestinal manifestation of celiac disease.',
    'A tTG-IgA level more than ten times the upper limit of normal has high specificity for celiac disease.',
    'Marsh 3b villous atrophy on biopsy is the histological gold standard confirming the diagnosis.',
  ],
  keyFindings: [
    'Chronic steatorrhoea and bloating',
    'Refractory iron-deficiency anaemia',
    'Folate deficiency',
    'Elevated ALT',
    'Markedly elevated tTG-IgA (>10× ULN)',
    'Villous atrophy on duodenal biopsy (Marsh 3b)',
  ],
  differentials,
  whyNotOthers: [
    {
      diagnosis: 'Irritable bowel syndrome',
      reason:
        'IBS does not cause malabsorption, villous atrophy, positive serology, or nutritional deficiencies.',
    },
    {
      diagnosis: 'Inflammatory bowel disease',
      reason:
        'IBD can cause malabsorption and elevated inflammatory markers but does not produce positive tTG-IgA serology or villous atrophy.',
    },
    {
      diagnosis: 'Small intestinal bacterial overgrowth',
      reason:
        'SIBO can mimic bloating and diarrhoea but does not cause villous atrophy or positive celiac serology.',
    },
    {
      diagnosis: 'Microscopic colitis',
      reason:
        'Microscopic colitis causes watery diarrhoea in older patients and does not produce steatorrhoea, villous atrophy, or celiac serology.',
    },
  ],
  managementPearl:
    'Strict lifelong gluten-free diet is the cornerstone of treatment. Correct nutritional deficiencies, monitor adherence with repeat tTG-IgA, and screen for associated autoimmune conditions and bone disease.',
  differentialAnalysis: [
    {
      diagnosis: 'Irritable bowel syndrome',
      whyPlausibleEarly:
        'Bloating and altered bowel habit are shared features with IBS, which is common in young women.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'pale bulky stools and weight loss',
          reason:
            'Steatorrhoea and unintentional weight loss are inconsistent with functional IBS.',
        },
        {
          clueOrder: 5,
          evidence: 'positive tTG-IgA and villous atrophy',
          reason:
            'Positive serology and histological damage exclude a purely functional diagnosis.',
        },
      ],
      finalReasonLessLikely:
        'IBS does not cause malabsorption, nutritional deficiencies, or histological changes.',
    },
    {
      diagnosis: 'Inflammatory bowel disease',
      whyPlausibleEarly:
        'Chronic diarrhoea, weight loss, and anaemia overlap with Crohn disease, which can affect the small bowel.',
      ruledOutByClues: [
        {
          clueOrder: 5,
          evidence: 'markedly elevated tTG-IgA and Marsh 3b villous atrophy',
          reason:
            'Specific celiac serology and characteristic villous atrophy distinguish celiac disease from IBD.',
        },
      ],
      finalReasonLessLikely:
        'IBD does not produce positive tTG-IgA serology or the pattern of villous atrophy with crypt hyperplasia.',
    },
    {
      diagnosis: 'Small intestinal bacterial overgrowth',
      whyPlausibleEarly:
        'Bloating, loose stools, and fat malabsorption can occur in SIBO and may coexist with celiac disease.',
      ruledOutByClues: [
        {
          clueOrder: 5,
          evidence: 'positive tTG-IgA serology and villous atrophy',
          reason:
            'SIBO does not cause villous atrophy or positive celiac-specific serology.',
        },
      ],
      finalReasonLessLikely:
        'SIBO may complicate celiac disease but cannot explain the serological and histological findings.',
    },
    {
      diagnosis: 'Microscopic colitis',
      whyPlausibleEarly:
        'Can cause chronic watery diarrhoea, particularly in women.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'pale bulky stools suggesting steatorrhoea',
          reason:
            'Microscopic colitis causes watery rather than steatorrhoeic stools and does not cause small bowel malabsorption.',
        },
      ],
      finalReasonLessLikely:
        'Microscopic colitis does not produce steatorrhoea, celiac serology, or villous atrophy.',
    },
  ],
  generationQuality: {
    contentTier: 'FLAGSHIP',
    humanReviewed: true,
    seedVersion,
  },
};

const educationForFrontend = {
  title: 'Celiac Disease',

  summary: {
    definition:
      'Celiac disease is a chronic immune-mediated enteropathy triggered by gluten ingestion in genetically susceptible individuals, causing villous atrophy and malabsorption.',
    highYieldTakeaway:
      'Think celiac disease in any patient with chronic GI symptoms, unexplained iron or folate deficiency, refractory anaemia, elevated transaminases, or a personal or family history of autoimmune disease.',
  },

  mnemonic: {
    title: 'COELIAC',
    letters: [
      {
        letter: 'C',
        stands_for: 'Chronic diarrhoea / steatorrhoea',
        explanation:
          'Pale, bulky, floating stools from fat malabsorption are a hallmark of small bowel villous damage.',
      },
      {
        letter: 'O',
        stands_for: 'Oral and skin signs',
        explanation:
          'Angular cheilitis, aphthous ulcers, and dermatitis herpetiformis are classic extra-intestinal manifestations.',
      },
      {
        letter: 'E',
        stands_for: 'Extra-intestinal features',
        explanation:
          'Anaemia, osteoporosis, elevated transaminases, infertility, and neurological symptoms reflect systemic malabsorption.',
      },
      {
        letter: 'L',
        stands_for: 'Low iron, folate, B12',
        explanation:
          'Proximal small bowel damage impairs absorption of iron and folate; B12 may fall if disease is extensive.',
      },
      {
        letter: 'I',
        stands_for: 'IgA tTG — the key serological test',
        explanation:
          'Tissue transglutaminase IgA is the first-line serological test; check total IgA to exclude selective IgA deficiency.',
      },
      {
        letter: 'A',
        stands_for: 'Autoimmune associations',
        explanation:
          'Type 1 diabetes, autoimmune thyroid disease, and primary biliary cholangitis are more common in celiac disease.',
      },
      {
        letter: 'C',
        stands_for: 'Celiac crisis and complications',
        explanation:
          'Refractory celiac disease, enteropathy-associated T-cell lymphoma (EATL), and small bowel adenocarcinoma are rare but serious complications.',
      },
    ],
  },

  recognitionPattern: [
    {
      pattern: 'Chronic GI symptoms with malabsorption features',
      whyItMatters:
        'Steatorrhoea, bloating, and weight loss lasting months point toward a small bowel absorptive defect rather than a functional disorder.',
    },
    {
      pattern: 'Refractory or unexplained iron-deficiency anaemia',
      whyItMatters:
        'Failure to respond to oral iron in a young woman without obvious blood loss should always prompt celiac testing.',
    },
    {
      pattern: 'Autoimmune background or family history',
      whyItMatters:
        'Celiac disease shares genetic risk (HLA-DQ2/DQ8) with other autoimmune conditions; a positive family history raises pre-test probability.',
    },
  ],

  keySymptoms: [
    {
      symptom: 'Steatorrhoea',
      significance:
        'Pale, bulky, difficult-to-flush stools indicate fat malabsorption from villous atrophy of the proximal small bowel.',
    },
    {
      symptom: 'Bloating and flatulence',
      significance:
        'Carbohydrate malabsorption leads to fermentation and gas production in the colon.',
    },
    {
      symptom: 'Unintentional weight loss',
      significance:
        'Reflects global caloric malabsorption and should prompt investigation for an organic cause.',
    },
    {
      symptom: 'Fatigue',
      significance:
        'Driven by iron and folate deficiency, poor nutritional status, and the burden of chronic inflammation.',
    },
  ],

  keySigns: [
    {
      finding: 'Pallor',
      significance:
        'Reflects iron-deficiency or mixed deficiency anaemia from malabsorption.',
    },
    {
      finding: 'Angular cheilitis',
      significance:
        'A classic sign of iron and B-vitamin deficiency associated with celiac disease.',
    },
    {
      finding: 'Dermatitis herpetiformis',
      significance:
        'Intensely pruritic vesicular rash on extensor surfaces; pathognomonic for celiac disease.',
    },
    {
      finding: 'Peripheral oedema or muscle wasting',
      significance:
        'Reflects severe protein malabsorption in longstanding or refractory disease.',
    },
  ],

  examPearls: [
    {
      type: 'physical',
      title: 'Angular cheilitis and mouth ulcers',
      content:
        'Inspect the oral cavity for angular cheilitis and aphthous ulcers, both linked to iron, folate, and B12 deficiency.',
      whyItMatters:
        'Oral signs can precede GI symptoms and offer an accessible clinical clue.',
      discriminator:
        'Recurrent aphthous ulcers in the context of GI symptoms should always prompt celiac testing.',
      trapAvoided:
        'Do not attribute recurrent oral ulcers solely to stress or local trauma in a symptomatic patient.',
    },
    {
      type: 'physical',
      title: 'Dermatitis herpetiformis',
      content:
        'Look for a symmetrical pruritic blistering rash on elbows, knees, buttocks, and scalp.',
      whyItMatters:
        'Dermatitis herpetiformis is a cutaneous manifestation of celiac disease and may occur without GI symptoms.',
      discriminator:
        'IgA deposits in dermal papillae on skin biopsy are diagnostic.',
      managementImplication:
        'Patients with dermatitis herpetiformis require gluten-free diet and may need dapsone for rash control.',
    },
    {
      type: 'nutritional',
      title: 'Signs of nutritional deficiency',
      content:
        'Assess for pallor (iron), glossitis (B12/folate), peripheral neuropathy (B12), and bone pain or low trauma fractures (vitamin D/calcium).',
      whyItMatters:
        'Multi-micronutrient deficiency is the rule in longstanding celiac disease and guides supplementation.',
      managementImplication:
        'Correct deficiencies before and after starting a gluten-free diet and monitor at follow-up.',
    },
  ],

  scoringSystems: [],

  investigations: [
    {
      test: 'Tissue transglutaminase IgA (tTG-IgA) with total IgA',
      interpretation:
        'tTG-IgA >10× upper limit of normal has high specificity for celiac disease. Total IgA must be checked to exclude IgA deficiency; if deficient, use IgG-based tests (tTG-IgG or DGP-IgG).',
      whyItMatters:
        'First-line serological test; markedly elevated levels can support diagnosis without biopsy in select patients per current guidelines.',
    },
    {
      test: 'Duodenal biopsy (at least 4 biopsies from D2, 1–2 from duodenal bulb)',
      interpretation:
        'Villous atrophy (Marsh 3) with crypt hyperplasia is the histological gold standard. Patient must be on a gluten-containing diet at the time of biopsy.',
      whyItMatters:
        'Confirms the diagnosis and grades severity. Essential before lifelong dietary commitment in most adults.',
    },
    {
      test: 'Full blood count and iron studies',
      interpretation:
        'Microcytic anaemia with low ferritin and low/normal MCV is typical. Mixed deficiency anaemia (iron + folate) may cause a normal MCV.',
      whyItMatters:
        'Quantifies deficiency burden and guides supplementation. Refractory iron deficiency in the absence of blood loss should always trigger celiac testing.',
    },
    {
      test: 'Folate, B12, vitamin D, calcium, bone profile',
      interpretation:
        'Low folate and vitamin D are common. B12 is usually preserved unless disease is extensive. Elevated ALP may suggest bone disease.',
      whyItMatters:
        'Identifies nutritional deficiencies needing correction and screens for metabolic bone disease.',
    },
    {
      test: 'Liver function tests',
      interpretation:
        'Mild isolated transaminase elevation (cryptogenic hypertransaminasaemia) may be the only presenting feature of celiac disease.',
      whyItMatters:
        'Normalisation of transaminases on a gluten-free diet is both diagnostic and therapeutic.',
    },
    {
      test: 'HLA-DQ2 / HLA-DQ8 typing',
      interpretation:
        'Negative result essentially excludes celiac disease. A positive result is necessary but not sufficient for diagnosis.',
      whyItMatters:
        'Useful to exclude celiac disease in equivocal cases or when serology and biopsy are discordant.',
    },
  ],

  pitfalls: [
    {
      pitfall: 'Diagnosing IBS without excluding celiac disease',
      consequence:
        'Celiac disease is frequently misdiagnosed as IBS for years, delaying treatment and allowing nutritional damage to accumulate.',
    },
    {
      pitfall: 'Testing serology on a gluten-free diet',
      consequence:
        'tTG-IgA can normalise rapidly after gluten exclusion, producing false-negative results. Patients must consume gluten for at least 6 weeks before testing.',
    },
    {
      pitfall: 'Missing IgA deficiency',
      consequence:
        'Selective IgA deficiency occurs in ~1:500 people and will give a false-negative tTG-IgA. Always measure total IgA.',
    },
    {
      pitfall: 'Attributing elevated transaminases to other causes without testing for celiac disease',
      consequence:
        'Celiac disease is a reversible cause of cryptogenic hypertransaminasaemia; missing it delays a simple dietary intervention.',
    },
    {
      pitfall: 'Failing to screen for associated conditions',
      consequence:
        'Untreated celiac disease is associated with osteoporosis, lymphoma, and other autoimmune conditions; screening and monitoring are essential.',
    },
  ],

  managementOverview: [
    {
      step: 'Strict lifelong gluten-free diet',
      rationale:
        'Complete elimination of wheat, barley, and rye leads to mucosal healing, resolution of symptoms, and correction of nutritional deficiencies in most patients.',
    },
    {
      step: 'Correct nutritional deficiencies',
      rationale:
        'Supplement iron, folate, vitamin D, and calcium as indicated; reassess once mucosal healing has occurred.',
    },
    {
      step: 'Dietitian referral',
      rationale:
        'A specialist dietitian provides education on hidden gluten sources, label reading, and cross-contamination avoidance.',
    },
    {
      step: 'Serological follow-up',
      rationale:
        'Repeat tTG-IgA at 6–12 months; falling titres confirm dietary adherence and mucosal recovery.',
    },
    {
      step: 'Bone density assessment',
      rationale:
        'DEXA scan at diagnosis in adults to assess baseline bone mineral density given the risk of metabolic bone disease.',
    },
    {
      step: 'Screen for associated autoimmune conditions',
      rationale:
        'Check thyroid function (TSH), consider type 1 diabetes screening, and assess for other autoimmune conditions at diagnosis and follow-up.',
    },
  ],

  differentialDistinguishers: [
    {
      diagnosis: 'Irritable bowel syndrome',
      keySeparator:
        'IBS does not cause steatorrhoea, nutritional deficiencies, elevated tTG-IgA, or villous atrophy.',
    },
    {
      diagnosis: 'Inflammatory bowel disease',
      keySeparator:
        'IBD can cause malabsorption and anaemia but does not produce positive celiac serology or the characteristic pattern of villous atrophy with crypt hyperplasia.',
    },
    {
      diagnosis: 'Small intestinal bacterial overgrowth',
      keySeparator:
        'SIBO causes bloating and diarrhoea but does not produce villous atrophy or positive tTG-IgA; breath testing is used for diagnosis.',
    },
    {
      diagnosis: 'Microscopic colitis',
      keySeparator:
        'Microscopic colitis causes watery diarrhoea without steatorrhoea, villous atrophy, or celiac-specific serology.',
    },
  ],

  complications: [
    {
      complication: 'Refractory celiac disease',
      whyItMatters:
        'Persistent villous atrophy despite strict gluten-free diet; type II is pre-malignant and carries significant mortality risk.',
    },
    {
      complication: 'Enteropathy-associated T-cell lymphoma (EATL)',
      whyItMatters:
        'A rare but serious complication; risk is reduced by adherence to a gluten-free diet.',
    },
    {
      complication: 'Osteoporosis and fragility fractures',
      whyItMatters:
        'Calcium and vitamin D malabsorption leads to reduced bone mineral density; DEXA screening and supplementation are important.',
    },
    {
      complication: 'Reproductive complications',
      whyItMatters:
        'Untreated celiac disease is associated with infertility, recurrent miscarriage, and adverse pregnancy outcomes.',
    },
    {
      complication: 'Small bowel adenocarcinoma',
      whyItMatters:
        'Rare but elevated risk compared to the general population; gluten-free diet may be protective.',
    },
  ],

  recallPrompts: [
    {
      prompt: 'What is the first-line serological test for celiac disease?',
      answer:
        'Tissue transglutaminase IgA (tTG-IgA), always paired with total IgA to exclude selective IgA deficiency.',
    },
    {
      prompt: 'Why must patients be eating gluten before celiac testing?',
      answer:
        'Gluten-free diet causes tTG-IgA to normalise, producing false-negative serology and potentially normal biopsies.',
    },
    {
      prompt: 'What is the histological gold standard for diagnosing celiac disease?',
      answer:
        'Villous atrophy with crypt hyperplasia (Marsh grade 3) on duodenal biopsy taken during active gluten ingestion.',
    },
    {
      prompt: 'Name two classic extra-intestinal presentations of celiac disease.',
      answer:
        'Refractory iron-deficiency anaemia and dermatitis herpetiformis (also: elevated transaminases, osteoporosis, infertility, peripheral neuropathy).',
    },
    {
      prompt: 'What mnemonic helps recall the key features of celiac disease?',
      answer:
        'COELIAC — Chronic diarrhoea, Oral/skin signs, Extra-intestinal features, Low iron/folate/B12, IgA tTG, Autoimmune associations, Complications.',
    },
  ],

  references: [],
};

async function main() {
  const canonicalName = 'celiac disease';
  const displayLabel = 'Celiac Disease';
  const canonicalNormalized = normalizeClinicalText(canonicalName);

  const registry = await prisma.diagnosisRegistry.upsert({
    where: { canonicalNormalized },
    update: {
      canonicalName,
      displayLabel,
      status: DiagnosisRegistryStatus.ACTIVE,
      active: true,
      specialty: 'Gastroenterology',
      subspecialty: 'Small Bowel',
      category: 'Autoimmune / Malabsorption',
      bodySystem: 'Gastrointestinal',
      organSystem: 'Small Intestine',
      difficultyBand: DiagnosisDifficultyBand.BASIC,
      rarityBand: DiagnosisRarityBand.COMMON,
      clinicalSetting: DiagnosisClinicalSetting.OUTPATIENT,
      ageGroup: DiagnosisAgeGroup.ADULT,
      urgencyLevel: DiagnosisUrgencyLevel.ROUTINE,
      onboardingStatus: 'READY_FOR_REVIEW',
      isPlayable: true,
      isGeneratable: true,
      preferredClueTypes: ['history', 'symptom', 'exam', 'lab', 'investigation'],
      excludedClueTypes: [],
      searchPriority: 20,
      notes:
        'Common autoimmune enteropathy presenting with malabsorption, nutritional deficiencies, and extra-intestinal manifestations. Frequently misdiagnosed as IBS.',
    },
    create: {
      canonicalName,
      canonicalNormalized,
      displayLabel,
      status: DiagnosisRegistryStatus.ACTIVE,
      active: true,
      specialty: 'Gastroenterology',
      subspecialty: 'Small Bowel',
      category: 'Autoimmune / Malabsorption',
      bodySystem: 'Gastrointestinal',
      organSystem: 'Small Intestine',
      difficultyBand: DiagnosisDifficultyBand.BASIC,
      rarityBand: DiagnosisRarityBand.COMMON,
      clinicalSetting: DiagnosisClinicalSetting.OUTPATIENT,
      ageGroup: DiagnosisAgeGroup.ADULT,
      urgencyLevel: DiagnosisUrgencyLevel.ROUTINE,
      onboardingStatus: 'READY_FOR_REVIEW',
      onboardingStartedAt: now,
      isPlayable: true,
      isGeneratable: true,
      preferredClueTypes: ['history', 'symptom', 'exam', 'lab', 'investigation'],
      excludedClueTypes: [],
      searchPriority: 20,
      notes:
        'Common autoimmune enteropathy presenting with malabsorption, nutritional deficiencies, and extra-intestinal manifestations. Frequently misdiagnosed as IBS.',
    },
  });

  const aliasSeeds = [
    {
      term: canonicalName,
      kind: DiagnosisAliasKind.CANONICAL,
      acceptedForMatch: true,
      rank: 100,
    },
    {
      term: 'celiac disease',
      kind: DiagnosisAliasKind.ACCEPTED,
      acceptedForMatch: true,
      rank: 95,
    },
    {
      term: 'celiac sprue',
      kind: DiagnosisAliasKind.ACCEPTED,
      acceptedForMatch: true,
      rank: 85,
    },
    {
      term: 'gluten-sensitive enteropathy',
      kind: DiagnosisAliasKind.ACCEPTED,
      acceptedForMatch: true,
      rank: 80,
    },
    {
      term: 'gluten intolerance',
      kind: DiagnosisAliasKind.SEARCH_ONLY,
      acceptedForMatch: false,
      rank: 40,
    },
    {
      term: 'villous atrophy',
      kind: DiagnosisAliasKind.SEARCH_ONLY,
      acceptedForMatch: false,
      rank: 30,
    },
  ];
  const seenAliasNormalizations = new Set<string>();

  for (const aliasSeed of aliasSeeds) {
    const term = aliasSeed.term;
    const normalizedTerm = normalizeClinicalText(term);
    if (seenAliasNormalizations.has(normalizedTerm)) {
      continue;
    }
    seenAliasNormalizations.add(normalizedTerm);

    const existingAlias = await prisma.diagnosisAlias.findUnique({
      where: {
        diagnosisRegistryId_normalizedTerm: {
          diagnosisRegistryId: registry.id,
          normalizedTerm,
        },
      },
      select: { id: true },
    });
    await assertAliasValidWithClient(prisma, {
      aliasText: term,
      targetDiagnosisRegistryId: registry.id,
      acceptedForMatch: aliasSeed.acceptedForMatch,
      ignoreAliasId: existingAlias?.id,
      allowTargetCanonicalAlias: normalizedTerm === canonicalNormalized,
    });
    await prisma.diagnosisAlias.upsert({
      where: {
        diagnosisRegistryId_normalizedTerm: {
          diagnosisRegistryId: registry.id,
          normalizedTerm,
        },
      },
      update: {
        term,
        active: true,
        acceptedForMatch: aliasSeed.acceptedForMatch,
        rank: aliasSeed.rank,
        kind: aliasSeed.kind,
        source: seedVersion,
      },
      create: {
        diagnosisRegistryId: registry.id,
        term,
        normalizedTerm,
        active: true,
        acceptedForMatch: aliasSeed.acceptedForMatch,
        rank: aliasSeed.rank,
        kind: aliasSeed.kind,
        source: seedVersion,
      },
    });
  }

  const education = await prisma.diagnosisEducation.upsert({
    where: { diagnosisRegistryId: registry.id },
    update: {
      title: educationForFrontend.title,
      summary: educationForFrontend.summary,
      mnemonic: educationForFrontend.mnemonic,
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
      mnemonic: educationForFrontend.mnemonic,
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
    clues.find((clue) => clue.type === 'history')?.value ?? displayLabel;
  const symptoms = clues
    .filter((clue) => clue.type === 'symptom')
    .map((clue) => clue.value);

  const reusableCase = await prisma.case.findFirst({
    where: {
      diagnosisRegistryId: registry.id,
      proposedDiagnosisText: displayLabel,
      dailyCases: { none: {} },
    },
    orderBy: [{ approvedAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      currentRevisionId: true,
      publicNumber: true,
    },
  });

  const publicNumber =
    reusableCase?.publicNumber ?? (await getNextCasePublicNumber());

  console.log('Assigned public case number', {
    displayLabel,
    publicNumber,
    reusedExistingCase: Boolean(reusableCase),
  });

  const assignedInventoryPlaceholderDate =
    await findAvailableInventoryPlaceholderDate({
      preferredDate: inventoryPlaceholderDate,
      reusableCaseId: reusableCase?.id,
      displayLabel,
    });

  const caseData = {
    title: displayLabel,
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
      'Seeded frontend-aligned flagship Celiac Disease inventory case. DailyCase scheduler should assign the actual daily slot.',
  };

  const seededCase = reusableCase
    ? await prisma.case.update({
        where: { id: reusableCase.id },
        data: caseData,
        select: { id: true },
      })
    : await prisma.case.create({ data: caseData, select: { id: true } });

  const revisionData = {
    source: 'MANUAL' as const,
    publishTrack: 'DAILY' as const,
    title: displayLabel,
    publicNumber,
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
      'Frontend-aligned flagship Celiac Disease inventory revision for DailyCase scheduler assignment.',
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
      validatorVersion: 'flagship-human-review:celiac-disease-v1',
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        note: 'Manual frontend-aligned Celiac Disease inventory case seeded for DailyCase scheduler assignment.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded frontend-aligned Celiac Disease:', {
    registryId: registry.id,
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