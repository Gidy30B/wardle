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
  throw new Error('DATABASE_URL is required to run Aortic stenosis seed.');
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
const seedVersion = 'flagship-aortic-stenosis-v1';

const canonicalName = 'aortic stenosis';
const displayLabel = 'Aortic Stenosis';
const caseTitle = 'Severe Calcific Aortic Stenosis';

const aliasTerms = [
  'Aortic Stenosis',
  'aortic stenosis',
  'severe aortic stenosis',
  'calcific aortic stenosis',
  'valvular aortic stenosis',
  'aortic valve stenosis',
  'AS',
];

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 72-year-old man presents with progressive exertional breathlessness and reduced exercise tolerance over the past year.',
  },
  {
    order: 1,
    type: 'history',
    value:
      'He reports several episodes of dizziness while walking uphill and one brief episode of exertional syncope two months ago.',
  },
  {
    order: 2,
    type: 'symptom',
    value:
      'Over the last six months he has developed central chest discomfort during exertion that improves with rest.',
  },
  {
    order: 3,
    type: 'exam',
    value:
      'Cardiovascular examination reveals a slow-rising low-volume carotid pulse, narrow pulse pressure, and a sustained apical impulse.',
  },
  {
    order: 4,
    type: 'exam',
    value:
      'A harsh crescendo-decrescendo systolic murmur is heard best at the right second intercostal space and radiates to both carotid arteries.',
  },
  {
    order: 5,
    type: 'investigation',
    value:
      'Transthoracic echocardiography demonstrates a heavily calcified aortic valve with valve area 0.7 cm², mean gradient 48 mmHg, peak velocity 4.3 m/s, and preserved left ventricular ejection fraction.',
  },
] as const;

const differentials = [
  'Hypertrophic Cardiomyopathy',
  'Coronary Artery Disease',
  'Mitral Regurgitation',
  'Heart Failure with Preserved Ejection Fraction',
  'Aortic Sclerosis',
];

const explanation = {
  diagnosis: displayLabel,
  summary:
    'Progressive exertional dyspnea, angina, exertional syncope, slow-rising low-volume pulse, harsh ejection systolic murmur radiating to the carotids, and echocardiographic severe valve obstruction support severe calcific aortic stenosis.',
  reasoning: [
    'Progressive exertional dyspnea in an older adult suggests a cardiac limitation to forward flow or filling.',
    'Exertional syncope is a danger symptom in fixed left ventricular outflow obstruction because cardiac output cannot increase adequately during activity.',
    'Exertional angina can occur in severe aortic stenosis even without primary coronary disease because left ventricular hypertrophy increases oxygen demand.',
    'A slow-rising low-volume carotid pulse is classic for severe fixed left ventricular outflow obstruction.',
    'A harsh crescendo-decrescendo systolic murmur at the right upper sternal border radiating to the carotids localizes the lesion to the aortic valve.',
    'Valve area 0.7 cm², mean gradient 48 mmHg, and peak velocity 4.3 m/s confirm severe aortic stenosis.',
  ],
  keyFindings: [
    'Older adult',
    'Progressive exertional dyspnea',
    'Reduced exercise tolerance',
    'Exertional dizziness',
    'Exertional syncope',
    'Exertional angina',
    'Slow-rising low-volume carotid pulse',
    'Narrow pulse pressure',
    'Sustained apical impulse',
    'Harsh crescendo-decrescendo systolic murmur',
    'Murmur maximal at right second intercostal space',
    'Carotid radiation',
    'Calcified aortic valve',
    'Valve area 0.7 cm²',
    'Mean gradient 48 mmHg',
    'Peak velocity 4.3 m/s',
    'Preserved left ventricular ejection fraction',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Hypertrophic Cardiomyopathy',
      whyPlausibleEarly:
        'Exertional syncope, angina, dyspnea, and a systolic murmur can resemble obstructive hypertrophic cardiomyopathy.',
      ruledOutByClues: [
        {
          clueOrder: 4,
          evidence:
            'harsh crescendo-decrescendo systolic murmur radiating to both carotid arteries',
          reason:
            'Carotid radiation and right upper sternal border maximal intensity favor valvular aortic stenosis over dynamic left ventricular outflow obstruction.',
        },
        {
          clueOrder: 5,
          evidence:
            'heavily calcified aortic valve with valve area 0.7 cm² and mean gradient 48 mmHg',
          reason:
            'Echocardiography confirms fixed valvular obstruction rather than dynamic septal obstruction.',
        },
      ],
      finalReasonLessLikely:
        'The obstruction is clearly valvular and calcific, not dynamic hypertrophic cardiomyopathy.',
    },
    {
      diagnosis: 'Coronary Artery Disease',
      whyPlausibleEarly:
        'Exertional central chest discomfort that improves with rest commonly suggests stable angina from coronary artery disease.',
      ruledOutByClues: [
        {
          clueOrder: 3,
          evidence: 'slow-rising low-volume carotid pulse',
          reason:
            'This pulse character indicates fixed left ventricular outflow obstruction rather than isolated coronary ischemia.',
        },
        {
          clueOrder: 4,
          evidence:
            'ejection systolic murmur radiating to both carotid arteries',
          reason:
            'Coronary artery disease alone does not explain a classic aortic stenosis murmur.',
        },
      ],
      finalReasonLessLikely:
        'Coronary disease may coexist, but it does not explain the pulse, murmur, and severe valve gradient.',
    },
    {
      diagnosis: 'Mitral Regurgitation',
      whyPlausibleEarly:
        'Dyspnea and a systolic murmur can suggest mitral regurgitation.',
      ruledOutByClues: [
        {
          clueOrder: 4,
          evidence:
            'murmur best heard at the right second intercostal space with carotid radiation',
          reason:
            'Mitral regurgitation is usually a pansystolic murmur maximal at the apex and radiating to the axilla.',
        },
      ],
      finalReasonLessLikely:
        'The auscultation pattern and echocardiography localize the disease to the aortic valve.',
    },
    {
      diagnosis: 'Heart Failure with Preserved Ejection Fraction',
      whyPlausibleEarly:
        'An older adult with exertional dyspnea and preserved ejection fraction may initially suggest HFpEF.',
      ruledOutByClues: [
        {
          clueOrder: 4,
          evidence:
            'classic carotid-radiating ejection systolic murmur',
          reason:
            'This identifies a structural valve cause for exertional symptoms.',
        },
        {
          clueOrder: 5,
          evidence:
            'severe aortic valve narrowing with high gradient and preserved ejection fraction',
          reason:
            'The primary pathology is severe aortic stenosis, which can cause secondary heart failure symptoms.',
        },
      ],
      finalReasonLessLikely:
        'HFpEF may be a physiologic consequence, but severe aortic stenosis is the unifying diagnosis.',
    },
    {
      diagnosis: 'Aortic Sclerosis',
      whyPlausibleEarly:
        'Older adults can have a systolic ejection murmur from a calcified aortic valve without severe obstruction.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'exertional syncope',
          reason:
            'Syncope suggests hemodynamically significant obstruction rather than benign sclerosis.',
        },
        {
          clueOrder: 5,
          evidence:
            'valve area 0.7 cm², mean gradient 48 mmHg, and peak velocity 4.3 m/s',
          reason:
            'These echocardiographic values confirm severe stenosis, not sclerosis.',
        },
      ],
      finalReasonLessLikely:
        'Aortic sclerosis does not produce severe obstruction, high gradients, or the classic symptom triad.',
    },
  ],
  managementPearl:
    'Symptomatic severe aortic stenosis has a poor prognosis without valve intervention. Confirm severity, assess procedural risk, avoid excessive preload reduction, and refer urgently for aortic valve replacement or transcatheter aortic valve implantation.',
  generationQuality: {
    contentTier: 'FLAGSHIP',
    seedVersion,
    humanReviewed: true,
    discriminatorStrength: 'HIGH',
    expectedTeachingPoints: [
      'Severe aortic stenosis classically presents with syncope, angina, and dyspnea',
      'A slow-rising low-volume pulse supports fixed left ventricular outflow obstruction',
      'A harsh ejection systolic murmur radiating to the carotids localizes disease to the aortic valve',
      'Echocardiography confirms severity using valve area, gradient, and peak velocity',
      'Symptomatic severe aortic stenosis requires valve intervention evaluation',
    ],
    competencyDomains: [
      'Cardiology',
      'Valvular Heart Disease',
      'Internal Medicine',
      'Clinical Reasoning',
    ],
  },
};

const educationForFrontend = {
  title: displayLabel,
  summary: {
    definition:
      'Aortic stenosis is narrowing of the aortic valve causing fixed left ventricular outflow obstruction, most commonly from degenerative calcification in older adults.',
    highYieldTakeaway:
      'Think severe aortic stenosis in an older adult with exertional dyspnea, angina, syncope, slow-rising pulse, and a harsh ejection systolic murmur radiating to the carotids.',
  },
  recognitionPattern: [
    {
      pattern: 'Symptomatic severe aortic stenosis',
      whyItMatters:
        'The onset of exertional dyspnea, angina, or syncope marks clinically important disease and should trigger urgent valve assessment.',
      progression:
        'Aortic valve calcification -> fixed outflow obstruction -> left ventricular pressure overload -> concentric hypertrophy -> impaired cardiac output reserve -> exertional dyspnea, angina, syncope, heart failure, and sudden death risk.',
      discriminator:
        'The combination of exertional symptoms, slow-rising pulse, and carotid-radiating ejection systolic murmur is highly characteristic.',
      commonTrap:
        'Do not attribute exertional symptoms in an older adult only to age, coronary disease, or deconditioning when the pulse and murmur suggest valve obstruction.',
    },
    {
      pattern: 'The SAD symptom triad',
      whyItMatters:
        'Syncope, angina, and dyspnea are the classic symptom cluster of severe aortic stenosis.',
      discriminator:
        'SAD symptoms become especially specific when paired with a right upper sternal border murmur radiating to the carotids.',
      commonTrap:
        'Angina in aortic stenosis may occur even without obstructive coronary artery disease.',
    },
    {
      pattern: 'Fixed left ventricular outflow obstruction',
      whyItMatters:
        'A severely narrowed aortic valve prevents the heart from increasing output during exertion.',
      discriminator:
        'Slow-rising low-volume carotid pulse separates severe aortic stenosis from many other systolic murmurs.',
      commonTrap:
        'A loud murmur alone does not grade severity; symptoms and echocardiographic values determine severity.',
    },
  ],
  keySymptoms: [
    {
      symptom: 'Exertional dyspnea',
      significance:
        'Often reflects elevated left ventricular filling pressures and reduced cardiac reserve.',
    },
    {
      symptom: 'Exertional angina',
      significance:
        'May occur because hypertrophied myocardium has high oxygen demand and reduced subendocardial perfusion.',
    },
    {
      symptom: 'Exertional syncope',
      significance:
        'Suggests severe fixed obstruction and inability to increase cardiac output during activity.',
    },
    {
      symptom: 'Reduced exercise tolerance',
      significance:
        'May be the earliest practical clue that valve obstruction has become symptomatic.',
    },
    {
      symptom: 'Dizziness or presyncope',
      significance:
        'A warning symptom when triggered by exertion in suspected aortic stenosis.',
    },
  ],
  keySigns: [
    {
      finding: 'Slow-rising low-volume carotid pulse',
      significance:
        'Classic peripheral sign of severe fixed left ventricular outflow obstruction.',
      discriminator:
        'Helps distinguish severe aortic stenosis from benign flow murmurs and many regurgitant lesions.',
    },
    {
      finding: 'Harsh ejection systolic murmur',
      significance:
        'Typical murmur of turbulent flow across a narrowed aortic valve.',
      discriminator:
        'Maximal intensity at the right upper sternal border favors aortic valve disease.',
    },
    {
      finding: 'Carotid radiation',
      significance:
        'Radiation to the carotids is a key auscultatory clue for aortic stenosis.',
      discriminator:
        'Mitral regurgitation typically radiates to the axilla rather than the carotids.',
    },
    {
      finding: 'Sustained apical impulse',
      significance:
        'Reflects left ventricular pressure overload and hypertrophy.',
    },
    {
      finding: 'Narrow pulse pressure',
      significance:
        'May occur in severe obstruction because stroke volume cannot rise normally.',
    },
  ],
  examPearls: [
    {
      type: 'DISCRIMINATOR',
      title: 'Carotid radiation localizes the murmur',
      content:
        'A harsh crescendo-decrescendo systolic murmur at the right upper sternal border that radiates to the carotids is the classic auscultatory pattern of aortic stenosis.',
      whyItMatters:
        'This finding moves the diagnosis away from nonspecific dyspnea or isolated coronary disease toward structural valve obstruction.',
      discriminator:
        'Mitral regurgitation is usually apical and radiates to the axilla; hypertrophic cardiomyopathy is dynamic and often changes with preload.',
      trapAvoided:
        'Do not label all systolic murmurs as mitral regurgitation or innocent flow murmurs.',
    },
    {
      type: 'DISCRIMINATOR',
      title: 'Pulse character reflects severity',
      content:
        'A slow-rising low-volume carotid pulse, also called pulsus parvus et tardus, supports severe fixed outflow obstruction.',
      whyItMatters:
        'The carotid pulse can reveal hemodynamic severity before echocardiography is available.',
      discriminator:
        'Aortic sclerosis may produce a murmur but should not cause a clearly slow-rising low-volume pulse.',
      trapAvoided:
        'Do not rely on murmur loudness alone to estimate severity.',
    },
    {
      type: 'MNEMONIC',
      title: 'SAD predicts symptomatic severe disease',
      content:
        'SAD means Syncope, Angina, and Dyspnea.',
      whyItMatters:
        'These are the classic symptoms of severe aortic stenosis and signal a major change in prognosis.',
      discriminator:
        'The mnemonic is most useful when the symptoms are exertional and accompanied by a carotid-radiating ejection systolic murmur.',
      trapAvoided:
        'Do not place SAD under scoringSystems; it is a diagnostic mnemonic, not a formal validated score.',
    },
  ],
  scoringSystems: [],
  investigations: [
    {
      test: 'Transthoracic echocardiography',
      interpretation:
        'Severe aortic stenosis is supported by valve area less than 1.0 cm², mean gradient at least 40 mmHg, or peak velocity at least 4.0 m/s.',
      whyItMatters:
        'Confirms diagnosis, grades severity, assesses left ventricular function, and guides intervention planning.',
    },
    {
      test: 'Electrocardiogram',
      interpretation:
        'May show left ventricular hypertrophy, strain pattern, conduction disease, or arrhythmia.',
      whyItMatters:
        'Supports chronic pressure overload and identifies rhythm problems that may worsen symptoms.',
    },
    {
      test: 'Chest X-ray',
      interpretation:
        'May show valve calcification, post-stenotic aortic dilatation, pulmonary congestion, or cardiac enlargement.',
      whyItMatters:
        'Provides supportive evidence and screens for heart failure or alternative pulmonary causes of dyspnea.',
    },
    {
      test: 'Coronary assessment when intervention is planned',
      interpretation:
        'Coronary angiography or CT coronary assessment may identify coexisting coronary artery disease.',
      whyItMatters:
        'Older patients with valve disease may also require coronary planning before valve replacement.',
    },
    {
      test: 'CT aortic valve and vascular planning',
      interpretation:
        'Defines valve calcification, annulus size, aortic root anatomy, and vascular access for transcatheter procedures.',
      whyItMatters:
        'Essential when transcatheter aortic valve implantation is being considered.',
    },
    {
      test: 'Exercise testing in selected apparently asymptomatic patients',
      interpretation:
        'May reveal symptoms, blood pressure drop, or limited exercise capacity.',
      whyItMatters:
        'Helps uncover concealed symptoms, but should be used cautiously and only in appropriate supervised settings.',
    },
  ],
  managementOverview: [
    {
      step: 'Confirm severity with echocardiography',
      rationale:
        'Valve area, mean gradient, peak velocity, and ventricular function determine whether disease is severe and guide urgency.',
    },
    {
      step: 'Assess symptom status carefully',
      rationale:
        'Exertional dyspnea, angina, syncope, or heart failure symptoms indicate symptomatic severe disease.',
    },
    {
      step: 'Refer urgently to cardiology or a heart valve team',
      rationale:
        'Symptomatic severe aortic stenosis requires evaluation for definitive valve intervention.',
    },
    {
      step: 'Choose valve intervention strategy',
      rationale:
        'Surgical aortic valve replacement or transcatheter aortic valve implantation is selected based on age, anatomy, surgical risk, comorbidities, and patient goals.',
    },
    {
      step: 'Treat congestion cautiously while awaiting intervention',
      rationale:
        'Diuretics may relieve pulmonary congestion, but excessive preload reduction can worsen cardiac output in severe fixed obstruction.',
    },
    {
      step: 'Avoid uncontrolled vasodilation and hypotension',
      rationale:
        'Patients with severe aortic stenosis depend on adequate preload and perfusion pressure.',
    },
    {
      step: 'Evaluate for coexisting coronary disease',
      rationale:
        'Coronary disease can coexist with calcific valve disease and may affect procedural planning.',
    },
  ],
  differentialDistinguishers: [
    {
      diagnosis: 'Hypertrophic Cardiomyopathy',
      whyConfused:
        'Both can cause exertional syncope, angina, dyspnea, and a systolic murmur.',
      distinguishingPoint:
        'Aortic stenosis has a fixed calcified valve obstruction with carotid radiation; hypertrophic cardiomyopathy has dynamic obstruction and septal hypertrophy.',
      keySeparator:
        'Echocardiography shows severe aortic valve narrowing rather than dynamic left ventricular outflow tract obstruction.',
      classicTrap:
        'Assuming any exertional syncope with a systolic murmur is hypertrophic cardiomyopathy without localizing the murmur.',
    },
    {
      diagnosis: 'Coronary Artery Disease',
      whyConfused:
        'Exertional angina relieved by rest can look like stable ischemic heart disease.',
      distinguishingPoint:
        'Aortic stenosis adds syncope, slow-rising pulse, and a carotid-radiating ejection systolic murmur.',
      keySeparator:
        'Valve gradient and valve area on echocardiography confirm the primary diagnosis.',
      classicTrap:
        'Treating angina alone and missing the valve lesion that changes prognosis and management.',
    },
    {
      diagnosis: 'Mitral Regurgitation',
      whyConfused:
        'Both can cause dyspnea and a systolic murmur.',
      distinguishingPoint:
        'Mitral regurgitation is typically pansystolic, maximal at the apex, and radiates to the axilla.',
      keySeparator:
        'Right upper sternal border ejection murmur with carotid radiation favors aortic stenosis.',
      classicTrap:
        'Calling any systolic murmur mitral regurgitation without checking radiation and timing.',
    },
    {
      diagnosis: 'Heart Failure with Preserved Ejection Fraction',
      whyConfused:
        'Older patients may present with exertional dyspnea and preserved ejection fraction.',
      distinguishingPoint:
        'Aortic stenosis produces a characteristic murmur, pulse abnormality, and high transvalvular gradient.',
      keySeparator:
        'Severe valve obstruction explains the heart failure physiology.',
      classicTrap:
        'Labeling exertional dyspnea as HFpEF without auscultation and echocardiography.',
    },
    {
      diagnosis: 'Aortic Sclerosis',
      whyConfused:
        'Both may occur in older adults with a calcified aortic valve and systolic ejection murmur.',
      distinguishingPoint:
        'Aortic sclerosis does not cause severe obstruction, high gradients, syncope, or a markedly slow-rising pulse.',
      keySeparator:
        'Valve area 0.7 cm², mean gradient 48 mmHg, and peak velocity 4.3 m/s prove severe stenosis.',
      classicTrap:
        'Reassuring the patient because the murmur is presumed to be benign age-related sclerosis.',
    },
  ],
  complications: [
    {
      complication: 'Heart failure',
      whyItMatters:
        'Pressure overload eventually causes elevated filling pressures, pulmonary congestion, and reduced functional reserve.',
    },
    {
      complication: 'Syncope and injury',
      whyItMatters:
        'Fixed cardiac output can cause exertional collapse and trauma.',
    },
    {
      complication: 'Sudden cardiac death',
      whyItMatters:
        'Risk increases after symptoms develop, especially in severe untreated disease.',
    },
    {
      complication: 'Arrhythmias',
      whyItMatters:
        'Left ventricular hypertrophy and atrial pressure overload can predispose to atrial fibrillation and other rhythm problems.',
    },
    {
      complication: 'Pulmonary edema',
      whyItMatters:
        'Decompensation can occur when the hypertrophied ventricle can no longer maintain filling and output.',
    },
    {
      complication: 'Cardiogenic shock',
      whyItMatters:
        'Severe obstruction can become life-threatening during acute decompensation, sepsis, bleeding, or hypotension.',
    },
  ],
  pitfalls: [
    {
      pitfall: 'Attributing exertional symptoms to aging',
      consequence:
        'Delays recognition of symptomatic severe valve disease.',
    },
    {
      pitfall: 'Treating angina as isolated coronary disease',
      consequence:
        'Misses severe aortic stenosis, where valve intervention may be the key life-prolonging treatment.',
    },
    {
      pitfall: 'Using murmur loudness alone to judge severity',
      consequence:
        'Severe disease can have a softer murmur when cardiac output falls; echocardiography is needed.',
    },
    {
      pitfall: 'Over-diuresis or excessive vasodilation',
      consequence:
        'Can precipitate hypotension because severe aortic stenosis is preload and perfusion-pressure dependent.',
    },
    {
      pitfall: 'Putting the SAD mnemonic under scoringSystems',
      consequence:
        'Pollutes scoringSystems with a mnemonic rather than reserving it for formal validated scores.',
    },
  ],
  recallPrompts: [
    {
      prompt: 'What are the classic symptoms of severe aortic stenosis?',
      answer: 'Syncope, Angina, and Dyspnea.',
    },
    {
      prompt: 'What pulse finding supports severe aortic stenosis?',
      answer: 'A slow-rising low-volume carotid pulse, also called pulsus parvus et tardus.',
    },
    {
      prompt: 'What murmur is characteristic of aortic stenosis?',
      answer:
        'A harsh crescendo-decrescendo systolic murmur best heard at the right upper sternal border and radiating to the carotids.',
    },
    {
      prompt: 'What echocardiographic values support severe aortic stenosis?',
      answer:
        'Valve area less than 1.0 cm², mean gradient at least 40 mmHg, or peak velocity at least 4.0 m/s.',
    },
    {
      prompt: 'What is the definitive treatment for symptomatic severe aortic stenosis?',
      answer:
        'Aortic valve replacement or transcatheter aortic valve implantation after valve-team assessment.',
    },
  ],
  references: [
    { citation: 'ESC/EACTS Guidelines for the management of valvular heart disease.' },
    { citation: 'ACC/AHA Guideline for the Management of Patients With Valvular Heart Disease.' },
    { citation: 'Braunwald Heart Disease: A Textbook of Cardiovascular Medicine.' },
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
          specialty: 'Cardiology',
          subspecialty: 'Valvular Heart Disease',
          category: 'Valvular Disease',
          bodySystem: 'Cardiovascular',
          organSystem: 'Heart',
          difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
          rarityBand: DiagnosisRarityBand.COMMON,
          clinicalSetting: DiagnosisClinicalSetting.OUTPATIENT,
          ageGroup: DiagnosisAgeGroup.ADULT,
          urgencyLevel: DiagnosisUrgencyLevel.URGENT,
          preferredClueTypes: [
            'history',
            'symptom',
            'exam',
            'investigation',
          ],
          notes:
            'Seeded flagship aortic stenosis case with valvular heart disease teaching metadata.',
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
          specialty: 'Cardiology',
          subspecialty: 'Valvular Heart Disease',
          category: 'Valvular Disease',
          bodySystem: 'Cardiovascular',
          organSystem: 'Heart',
          difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
          rarityBand: DiagnosisRarityBand.COMMON,
          clinicalSetting: DiagnosisClinicalSetting.OUTPATIENT,
          ageGroup: DiagnosisAgeGroup.ADULT,
          urgencyLevel: DiagnosisUrgencyLevel.URGENT,
          preferredClueTypes: [
            'history',
            'symptom',
            'exam',
            'investigation',
          ],
          notes:
            'Seeded flagship aortic stenosis case with valvular heart disease teaching metadata.',
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
    console.log('Skipped existing scheduled Aortic stenosis case:', scheduledCase);
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
      'Seeded complete frontend-aligned flagship Aortic stenosis case with education.',
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
        'Created complete Aortic stenosis revision with education-aligned explanation.',
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
      validatorVersion: 'flagship-human-review:aortic-stenosis-v1',
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        note:
          'Complete Aortic stenosis flagship seed with playable clue types and full education payload.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded Aortic Stenosis:', {
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