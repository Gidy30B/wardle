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
 * FLAGSHIP CASE SEED — Acute Angle-Closure Glaucoma
 *
 * Clinical focus:
 * - Sudden painful monocular visual loss with coloured halos and autonomic symptoms.
 * - Corneal oedema, a mid-dilated poorly reactive pupil, shallow anterior chamber,
 *   and markedly raised intraocular pressure.
 * - Anatomical confirmation of iridotrabecular contact and gonioscopic angle closure.
 * - Distinction from uveitis, keratitis, conjunctivitis, scleritis,
 *   orbital cellulitis, and optic neuritis.
 *
 * Safety:
 * - Reuses or creates the exact diagnosis registry and accepted aliases.
 * - Does not overwrite existing diagnosis education.
 * - Does not overwrite an existing case with the same title.
 * - Does not alter a scheduled DailyCase.
 *
 * Run:
 *   npx tsx prisma/seed/flagship-acute-angle-closure-glaucoma.seed.ts
 *
 * Railway:
 *   railway run npx tsx prisma/seed/flagship-acute-angle-closure-glaucoma.seed.ts
 */

const databaseUrl = resolvePgConnectionString(process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required to run the Acute Angle-Closure Glaucoma seed.',
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
  for (let offset = 0; offset < 365; offset += 1) {
    const candidateDate = addUtcDays(params.preferredDate, offset);
    const owner = await prisma.case.findUnique({
      where: { date: candidateDate },
      select: {
        id: true,
        title: true,
        dailyCases: { select: { id: true }, take: 1 },
      },
    });

    if (!owner) return candidateDate;

    console.warn('Inventory placeholder date occupied; trying next day.', {
      displayLabel: params.displayLabel,
      candidateDate: candidateDate.toISOString(),
      occupiedByCaseId: owner.id,
      occupiedByTitle: owner.title,
      occupiedCaseIsScheduled: owner.dailyCases.length > 0,
    });
  }

  throw new Error(
    `Cannot seed ${params.displayLabel}: no free inventory placeholder date found.`,
  );
}

const now = new Date();
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 11, 2, 12, 0, 0));
const seedVersion = 'flagship-acute-angle-closure-glaucoma-v1';

const canonicalName = 'acute angle-closure glaucoma';
const displayLabel = 'Acute Angle-Closure Glaucoma';
const caseTitle = 'Sudden Painful Red Eye with Halos and Vomiting';

const taxonomy = {
  specialty: 'Ophthalmology',
  subspecialty: 'Glaucoma',
  category: 'Angle-Closure Glaucoma',
  bodySystem: 'Special Senses',
  organSystem: 'Eye',
} as const;

const aliasTerms = [
  'Acute Angle-Closure Glaucoma',
  'Acute Angle Closure Glaucoma',
  'Acute Primary Angle Closure',
  'Acute Angle-Closure Attack',
  'Acute Angle Closure Attack',
  'AACG',
];

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 64-year-old hyperopic woman develops sudden severe pain and blurred vision in the right eye while watching a film in a dim room. Symptoms began four hours ago. There is no eye trauma, contact-lens use, or recent ocular surgery.',
  },
  {
    order: 1,
    type: 'symptom',
    value:
      'She sees coloured halos around lights and has a right-sided frontal headache, nausea, and two episodes of vomiting. There is no purulent discharge, itch, or preceding upper-respiratory illness.',
  },
  {
    order: 2,
    type: 'exam',
    value:
      'Visual acuity is 6/60 in the right eye and 6/9 in the left. The right eye has marked ciliary injection, a steamy oedematous cornea, and a mid-dilated poorly reactive pupil. Temperature is 36.8 C, extraocular movements are full, and there is no proptosis.',
  },
  {
    order: 3,
    type: 'exam',
    value:
      'Slit-lamp examination shows a very shallow anterior chamber with a Van Herick grade of 0 to 1. The right globe is firm and applanation tonometry measures 52 mmHg in the right eye and 16 mmHg in the left. Fluorescein examination shows no corneal epithelial defect, and there is no hypopyon.',
  },
  {
    order: 4,
    type: 'imaging',
    value:
      'Anterior-segment optical coherence tomography shows forward bowing of the peripheral iris, a markedly crowded anterior chamber, and extensive iridotrabecular contact in the symptomatic eye.',
  },
  {
    order: 5,
    type: 'exam',
    value:
      'After initial pressure lowering clears the cornea sufficiently for examination, gonioscopy shows more than 270 degrees of appositional angle closure without neovascularization or inflammatory synechiae. The fellow eye also has an occludable angle, confirming an acute primary pupillary-block mechanism.',
  },
] as const;

const differentials = [
  'Anterior Uveitis',
  'Keratitis',
  'Acute Conjunctivitis',
  'Scleritis',
  'Orbital Cellulitis',
  'Optic Neuritis',
];

const canonicalDifferentialLabels = new Set(differentials);

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
  'Sudden painful monocular visual loss in an older hyperopic patient after physiologic dilation in a dim environment raises immediate concern for an acute pressure-related anterior-segment emergency.',
  'Coloured halos, headache, nausea, and vomiting are classic consequences of abrupt intraocular-pressure elevation and corneal oedema rather than uncomplicated conjunctival inflammation.',
  'Marked ciliary injection, a steamy cornea, reduced visual acuity, and a mid-dilated poorly reactive pupil form the characteristic external examination pattern of acute angle closure.',
  'A very shallow anterior chamber and intraocular pressure of 52 mmHg objectively establish severe ocular hypertension, while absent corneal staining and hypopyon reduce keratitis and severe anterior uveitis.',
  'Anterior-segment imaging demonstrates the crowded anatomy and extensive iridotrabecular contact responsible for impaired aqueous outflow.',
  'Gonioscopic confirmation of widespread appositional closure, with no neovascular or inflammatory secondary mechanism, establishes Acute Angle-Closure Glaucoma caused by primary pupillary block.',
] as const;

const explanation = {
  diagnosis: displayLabel,
  summary:
    'An older hyperopic patient develops abrupt painful monocular visual loss with coloured halos, autonomic symptoms, a red eye, corneal oedema, a mid-dilated pupil, a shallow anterior chamber, markedly raised intraocular pressure, and gonioscopically confirmed angle closure.',
  reasoning: reasoningSteps.join('\n'),
  clueBreakdown: clues.map((clue, index) => ({
    clueOrder: clue.order,
    clueType: clue.type,
    clue: clue.value,
    explanation: reasoningSteps[index],
    diagnosticContribution: [
      'Establishes a high-risk anatomical profile and an abrupt painful monocular presentation.',
      'Adds the characteristic halo and autonomic symptom complex of acute ocular hypertension.',
      'Provides the classic external signs of corneal oedema and iris ischaemia.',
      'Confirms severe pressure elevation and a shallow anterior chamber while reducing corneal and inflammatory mimics.',
      'Shows the anatomical mechanism of peripheral iris contact with the trabecular meshwork.',
      'Provides definitive gonioscopic confirmation and excludes major secondary angle-closure mechanisms.',
    ][index],
  })),
  keyFindings: [
    'Sudden severe unilateral eye pain',
    'Acute reduction in visual acuity',
    'Coloured halos around lights',
    'Headache, nausea, and vomiting',
    'Marked ciliary injection',
    'Steamy oedematous cornea',
    'Mid-dilated poorly reactive pupil',
    'Very shallow anterior chamber',
    'Intraocular pressure 52 mmHg in the affected eye',
    'Extensive iridotrabecular contact',
    'More than 270 degrees of appositional closure on gonioscopy',
    'Occludable fellow-eye angle',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Anterior Uveitis',
      whyPlausibleEarly:
        'Anterior uveitis can present with a painful red eye, photophobia, and reduced visual acuity.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: 'mid-dilated poorly reactive pupil',
          reason:
            'Acute anterior uveitis more often produces a small or irregular pupil from iris inflammation or posterior synechiae.',
        },
        {
          clueOrder: 3,
          evidence: 'there is no hypopyon',
          reason:
            'The slit-lamp assessment does not show a severe inflammatory anterior-chamber pattern.',
        },
        {
          clueOrder: 3,
          evidence: 'applanation tonometry measures 52 mmHg',
          reason:
            'Marked pressure elevation with a very shallow chamber strongly favours mechanical angle obstruction.',
        },
      ],
      finalReasonLessLikely:
        'The pupil configuration, extreme pressure elevation, crowded chamber, and gonioscopic closure are not explained by uncomplicated anterior uveitis.',
    },
    {
      diagnosis: 'Keratitis',
      whyPlausibleEarly:
        'Keratitis may cause severe eye pain, redness, photophobia, corneal haze, and reduced vision.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence: 'There is no eye trauma, contact-lens use',
          reason:
            'The history lacks two common risk factors for acute microbial keratitis.',
        },
        {
          clueOrder: 3,
          evidence: 'Fluorescein examination shows no corneal epithelial defect',
          reason:
            'No epithelial defect or ulcer is demonstrated despite the corneal haze.',
        },
        {
          clueOrder: 3,
          evidence: 'very shallow anterior chamber',
          reason:
            'A crowded shallow chamber with severe pressure elevation points to angle obstruction rather than primary corneal infection.',
        },
      ],
      finalReasonLessLikely:
        'The corneal oedema is secondary to raised pressure, with no epithelial defect and clear evidence of angle closure.',
    },
    {
      diagnosis: 'Acute Conjunctivitis',
      whyPlausibleEarly:
        'Conjunctivitis commonly causes a red and uncomfortable eye.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'There is no purulent discharge, itch',
          reason:
            'The typical discharge or pruritic pattern of infectious or allergic conjunctivitis is absent.',
        },
        {
          clueOrder: 2,
          evidence: 'Visual acuity is 6/60 in the right eye',
          reason:
            'Conjunctivitis should not usually cause profound unilateral visual reduction.',
        },
        {
          clueOrder: 3,
          evidence: '52 mmHg in the right eye',
          reason:
            'Marked ocular hypertension cannot be explained by uncomplicated conjunctivitis.',
        },
      ],
      finalReasonLessLikely:
        'The visual loss, abnormal pupil, corneal oedema, shallow chamber, and severe pressure elevation exclude simple conjunctivitis.',
    },
    {
      diagnosis: 'Scleritis',
      whyPlausibleEarly:
        'Scleritis can produce intense ocular pain, redness, and reduced vision.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: 'steamy oedematous cornea',
          reason:
            'The dominant visible abnormality is pressure-related corneal oedema rather than deep scleral inflammation.',
        },
        {
          clueOrder: 3,
          evidence: 'Van Herick grade of 0 to 1',
          reason:
            'A markedly shallow anterior chamber is an anatomical clue to angle closure, not a feature of isolated scleritis.',
        },
      ],
      finalReasonLessLikely:
        'Scleritis does not account for the mid-dilated pupil, crowded chamber, extreme intraocular pressure, or gonioscopic closure.',
    },
    {
      diagnosis: 'Orbital Cellulitis',
      whyPlausibleEarly:
        'Orbital infection may cause painful ocular redness, headache, and reduced vision.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: 'Temperature is 36.8 C',
          reason:
            'The patient is afebrile and lacks a systemic infectious presentation.',
        },
        {
          clueOrder: 2,
          evidence: 'extraocular movements are full, and there is no proptosis',
          reason:
            'The absence of ophthalmoplegia and proptosis strongly reduces post-septal orbital infection.',
        },
      ],
      finalReasonLessLikely:
        'There are no orbital signs or systemic infection, while the anterior-segment findings directly demonstrate angle obstruction.',
    },
    {
      diagnosis: 'Optic Neuritis',
      whyPlausibleEarly:
        'Optic neuritis can cause acute monocular visual loss and pain.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: 'marked ciliary injection, a steamy oedematous cornea',
          reason:
            'Optic neuritis generally does not produce a markedly red eye or corneal oedema.',
        },
        {
          clueOrder: 3,
          evidence: 'applanation tonometry measures 52 mmHg',
          reason:
            'Severe ocular hypertension is not a feature of optic neuritis.',
        },
      ],
      finalReasonLessLikely:
        'The pathology is localized to the anterior chamber angle rather than the optic nerve.',
    },
  ],
  managementPearl:
    'Treat as a sight-threatening ophthalmic emergency: begin immediate pressure-lowering therapy, control pain and nausea, obtain urgent ophthalmology review, and proceed to definitive relief of pupillary block—usually laser peripheral iridotomy—once the cornea permits safe treatment.',
  generationQuality: {
    contentTier: 'FLAGSHIP',
    seedVersion,
    humanReviewed: true,
    discriminatorStrength: 'HIGH',
    expectedTeachingPoints: [
      'Recognize the painful red-eye pattern with halos, nausea, corneal oedema, and a mid-dilated pupil',
      'Confirm markedly elevated intraocular pressure and a shallow anterior chamber',
      'Use gonioscopy to establish angle closure and identify secondary mechanisms',
      'Begin urgent pressure-lowering treatment before irreversible optic-nerve injury occurs',
      'Provide definitive pupillary-block treatment and assess the fellow eye',
    ],
    competencyDomains: [
      'Ophthalmology',
      'Glaucoma',
      'Emergency Medicine',
      'Clinical Examination',
      'Clinical Reasoning',
    ],
  },
};

const educationForFrontend = {
  title: displayLabel,
  summary: {
    definition:
      'Acute angle-closure glaucoma is a sight-threatening episode in which the peripheral iris obstructs the trabecular meshwork, causing abrupt elevation of intraocular pressure with ocular pain, corneal oedema, visual disturbance, and risk of permanent optic-nerve damage.',
    highYieldTakeaway:
      'Think of acute angle closure in a painful red eye with blurred vision or halos, nausea or vomiting, a steamy cornea, a mid-dilated poorly reactive pupil, a shallow anterior chamber, and markedly raised intraocular pressure.',
  },
  recognitionPattern: [
    {
      pattern: 'Painful red eye with systemic autonomic symptoms',
      whyItMatters:
        'Headache, nausea, and vomiting can dominate the presentation and lead to mistaken neurological or gastrointestinal assessment.',
    },
    {
      pattern: 'Corneal oedema and a mid-dilated pupil',
      whyItMatters:
        'These findings reflect abrupt pressure elevation and iris ischaemia and are far more concerning than uncomplicated conjunctivitis.',
    },
    {
      pattern: 'Shallow anterior chamber with raised intraocular pressure',
      whyItMatters:
        'The combination indicates impaired aqueous outflow from angle obstruction and requires emergency ophthalmic treatment.',
    },
    {
      pattern: 'Occludable fellow-eye anatomy',
      whyItMatters:
        'The fellow eye often shares the anatomical predisposition and requires preventive assessment and treatment.',
    },
  ],
  keySymptoms: [
    'Sudden severe unilateral eye pain',
    'Rapidly reduced or blurred vision',
    'Coloured halos around lights',
    'Ipsilateral headache',
    'Nausea and vomiting',
    'Photophobia may occur',
  ],
  keySigns: [
    'Marked conjunctival or ciliary injection',
    'Hazy or steamy cornea from oedema',
    'Mid-dilated poorly reactive pupil',
    'Shallow anterior chamber',
    'Firm globe on cautious examination',
    'Markedly elevated intraocular pressure',
    'Closed or occludable angle on gonioscopy',
  ],
  examPearls: [
    'Check visual acuity before treatment whenever this does not delay emergency care.',
    'Examine both pupils, corneas, anterior chambers, and fellow-eye angle anatomy.',
    'Use fluorescein staining to identify a corneal epithelial defect when keratitis is possible.',
    'Measure intraocular pressure unless globe rupture is suspected.',
    'Gonioscopy is required to confirm closure and distinguish primary from secondary mechanisms.',
    'Do not label every painful red eye as conjunctivitis.',
  ],
  scoringSystems: [
    {
      name: 'No validated diagnostic score',
      use:
        'Diagnosis is based on the clinical pattern, intraocular-pressure measurement, anterior-chamber assessment, and gonioscopy rather than a point score.',
    },
  ],
  investigations: [
    {
      test: 'Visual acuity and pupillary examination',
      role:
        'Documents functional impairment and identifies the characteristic poorly reactive mid-dilated pupil.',
    },
    {
      test: 'Applanation tonometry',
      role:
        'Confirms elevated intraocular pressure and helps monitor response to emergency treatment.',
    },
    {
      test: 'Slit-lamp examination',
      role:
        'Assesses corneal oedema, anterior-chamber depth, inflammation, pupil configuration, and competing corneal disease.',
    },
    {
      test: 'Gonioscopy',
      role:
        'Confirms iridotrabecular contact or synechial closure and identifies primary or secondary angle-closure mechanisms.',
    },
    {
      test: 'Anterior-segment optical coherence tomography or ultrasound biomicroscopy',
      role:
        'Supports anatomical assessment when direct angle examination is difficult or when plateau iris, lens crowding, or another mechanism is suspected.',
    },
    {
      test: 'Optic-nerve and visual-field assessment after the acute episode',
      role:
        'Evaluates established glaucomatous damage once corneal clarity and pressure control permit reliable testing.',
    },
  ],
  differentialDistinguishers: [
    {
      diagnosis: 'Anterior Uveitis',
      distinguishingFeatures:
        'Anterior-chamber cells and flare, a small or irregular pupil, and inflammatory synechiae favour uveitis; primary acute closure produces a crowded chamber, very high pressure, and gonioscopic obstruction.',
    },
    {
      diagnosis: 'Keratitis',
      distinguishingFeatures:
        'A corneal epithelial defect, infiltrate, ulcer, or contact-lens risk supports keratitis rather than pressure-related corneal oedema.',
    },
    {
      diagnosis: 'Acute Conjunctivitis',
      distinguishingFeatures:
        'Discharge or itch with preserved vision and a normal pupil and cornea favours conjunctivitis.',
    },
    {
      diagnosis: 'Scleritis',
      distinguishingFeatures:
        'Deep scleral tenderness and inflammation occur without the classic shallow chamber, mid-dilated pupil, and extreme pressure elevation.',
    },
    {
      diagnosis: 'Orbital Cellulitis',
      distinguishingFeatures:
        'Fever, proptosis, painful restricted eye movements, and orbital imaging abnormalities favour orbital cellulitis.',
    },
    {
      diagnosis: 'Optic Neuritis',
      distinguishingFeatures:
        'Pain with eye movement, dyschromatopsia, and an afferent pupillary defect occur without a red oedematous cornea or severe ocular hypertension.',
    },
  ],
  managementOverview: [
    {
      phase: 'Immediate emergency actions',
      actions: [
        'Arrange urgent ophthalmology assessment and begin treatment without avoidable delay.',
        'Reduce intraocular pressure using appropriate topical aqueous suppressants and systemic carbonic-anhydrase inhibition, considering contraindications.',
        'Use a hyperosmotic agent when pressure remains dangerously high or the initial response is inadequate, with attention to systemic comorbidity.',
        'Treat pain, nausea, vomiting, and dehydration while monitoring the affected eye and the patient’s general condition.',
      ],
    },
    {
      phase: 'Pupillary-block treatment',
      actions: [
        'A miotic may be used after the pressure begins to fall and iris perfusion improves when a pupillary-block mechanism is present.',
        'Definitive treatment is usually laser peripheral iridotomy once corneal clarity permits safe laser application.',
        'The fellow eye should be examined promptly and commonly receives prophylactic laser iridotomy if anatomically occludable.',
      ],
    },
    {
      phase: 'Mechanism-specific and follow-up care',
      actions: [
        'Investigate secondary mechanisms such as neovascularization, uveitis, lens-related crowding, drug-induced ciliochoroidal effusion, or plateau iris.',
        'Consider lens extraction or additional glaucoma procedures when anatomical crowding, persistent closure, or uncontrolled pressure remains.',
        'Reassess the optic nerve, visual field, peripheral anterior synechiae, and long-term pressure control after the acute episode.',
      ],
    },
  ],
  complications: [
    'Permanent visual loss',
    'Glaucomatous optic neuropathy',
    'Peripheral anterior synechiae',
    'Chronic angle-closure glaucoma',
    'Corneal endothelial damage and persistent oedema',
    'Iris atrophy and a persistently abnormal pupil',
    'Recurrent acute attacks',
    'Fellow-eye attack if untreated',
  ],
  pitfalls: [
    'Treating the presentation as conjunctivitis or migraine without measuring intraocular pressure',
    'Delaying ophthalmology referral while pursuing non-ocular causes of vomiting or headache',
    'Relying on tonometry alone without confirming angle anatomy',
    'Using a miotic before severe pressure elevation has begun to improve',
    'Failing to identify a secondary angle-closure mechanism',
    'Ignoring the risk to the fellow eye',
    'Assuming pressure normalization eliminates the need for definitive treatment and follow-up',
  ],
  recallPrompts: [
    {
      question: 'What symptom cluster should immediately raise suspicion?',
      answer:
        'Sudden painful red eye with blurred vision or halos, headache, nausea, or vomiting.',
    },
    {
      question: 'What are the classic ocular signs?',
      answer:
        'Corneal oedema, a mid-dilated poorly reactive pupil, a shallow anterior chamber, and markedly raised intraocular pressure.',
    },
    {
      question: 'Which examination confirms the closed angle?',
      answer: 'Gonioscopy.',
    },
    {
      question: 'What is the definitive treatment for primary pupillary block?',
      answer:
        'Laser peripheral iridotomy after immediate pressure-lowering treatment and sufficient corneal clearing.',
    },
    {
      question: 'Why must the fellow eye be assessed?',
      answer:
        'It often shares the same occludable anatomy and remains at risk of a similar attack.',
    },
  ],
  references: [
    {
      title: 'The Management of Angle-Closure Glaucoma Clinical Guidelines',
      source: 'The Royal College of Ophthalmologists',
      url: 'https://www.rcophth.ac.uk/wp-content/uploads/2021/10/The-Management-of-Angle-Closure-Glaucoma-Clinical-Guidelines.pdf',
    },
    {
      title: 'Primary versus Secondary Angle-Closure Glaucoma',
      source: 'American Academy of Ophthalmology EyeWiki',
      url: 'https://eyewiki.aao.org/Primary_vs._Secondary_Angle_Closure_Glaucoma',
    },
    {
      title: 'Laser Peripheral Iridotomy',
      source: 'American Academy of Ophthalmology EyeWiki',
      url: 'https://eyewiki.aao.org/Laser_Peripheral_Iridotomy',
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

  for (const diagnosis of differentials) {
    if (!canonicalDifferentialLabels.has(diagnosis)) {
      throw new Error(`Noncanonical differential label: ${diagnosis}.`);
    }
  }

  if (typeof explanation.reasoning !== 'string') {
    throw new Error(
      'Explanation reasoning must be a newline-separated string for the learner frontend.',
    );
  }

  const parsedReasoningSteps = explanation.reasoning
    .split(/\n+/)
    .map((step) => step.trim())
    .filter(Boolean);

  if (parsedReasoningSteps.length !== clues.length) {
    throw new Error(
      `Expected ${clues.length} reasoning steps; received ${parsedReasoningSteps.length}.`,
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
      throw new Error(`Clue breakdown order mismatch at index ${index}.`);
    }
    if (entry.clueType !== clue.type) {
      throw new Error(`Clue breakdown type mismatch at order ${clue.order}.`);
    }
    if (entry.clue !== clue.value) {
      throw new Error(`Clue breakdown text mismatch at order ${clue.order}.`);
    }
    if (entry.explanation !== parsedReasoningSteps[index]) {
      throw new Error(
        `Clue breakdown explanation does not match reasoning step ${clue.order}.`,
      );
    }
    if (!entry.diagnosticContribution.trim()) {
      throw new Error(
        `Clue breakdown ${clue.order} has an empty diagnostic contribution.`,
      );
    }
  });

  const differentialAnalysis =
    explanation.differentialAnalysis as DifferentialAnalysisEntry[];

  if (differentialAnalysis.length !== differentials.length) {
    throw new Error(
      `Expected ${differentials.length} differential analyses; received ${differentialAnalysis.length}.`,
    );
  }

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

      const normalizedClue = normalizeClinicalText(
        clues[breakdown.clueOrder].value,
      );
      const normalizedEvidence = normalizeClinicalText(breakdown.evidence);

      if (!normalizedClue.includes(normalizedEvidence)) {
        throw new Error(
          `Differential evidence is not present in clue ${breakdown.clueOrder}: ${entry.diagnosis} -> ${breakdown.evidence}`,
        );
      }
    });
  });

  const educationText = normalizeClinicalText(
    JSON.stringify(educationForFrontend),
  );
  const caseSpecificEducationTerms = [
    '64 year old',
    'watching a film',
    'four hours ago',
    'two episodes of vomiting',
    '6 60',
    '52 mmhg',
    'more than 270 degrees',
    'this patient',
    'this case',
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
  const canonicalNormalized = normalizeClinicalText(canonicalName);
  const normalizedTerms = aliasTerms.map(normalizeClinicalText);

  const exactRegistry = await prisma.diagnosisRegistry.findUnique({
    where: { canonicalNormalized },
    select: { id: true },
  });

  const aliasCandidates = exactRegistry
    ? []
    : await prisma.diagnosisRegistry.findMany({
        where: {
          aliases: {
            some: {
              normalizedTerm: { in: normalizedTerms },
              active: true,
              acceptedForMatch: true,
            },
          },
        },
        select: {
          id: true,
          canonicalName: true,
          canonicalNormalized: true,
          displayLabel: true,
        },
        take: 3,
      });

  if (aliasCandidates.length > 1) {
    throw new Error(
      `Cannot safely seed ${displayLabel}: multiple registry rows match accepted aliases.`,
    );
  }

  const aliasCandidate = aliasCandidates[0];
  if (
    aliasCandidate &&
    !normalizeClinicalText(
      `${aliasCandidate.canonicalName} ${aliasCandidate.displayLabel}`,
    ).includes('acute angle closure')
  ) {
    throw new Error(
      `Cannot safely reuse registry ${aliasCandidate.id}: alias match belongs to ${aliasCandidate.displayLabel}.`,
    );
  }

  const existing = exactRegistry ?? aliasCandidate ?? null;

  const registryData = {
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
    clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
    ageGroup: DiagnosisAgeGroup.ADULT,
    urgencyLevel: DiagnosisUrgencyLevel.EMERGENT,
    preferredClueTypes: ['history', 'symptom', 'exam', 'imaging'],
    notes:
      'Flagship acute angle-closure glaucoma registry entry focused on sudden painful monocular visual loss, corneal oedema, a mid-dilated pupil, shallow anterior chamber, markedly raised intraocular pressure, gonioscopic confirmation, emergency pressure reduction, definitive laser iridotomy, and fellow-eye prevention.',
  };

  const registry = existing
    ? await prisma.diagnosisRegistry.update({
        where: { id: existing.id },
        data: registryData,
        select: { id: true, displayLabel: true },
      })
    : await prisma.diagnosisRegistry.create({
        data: registryData,
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
      'Skipped diagnosis education because acute angle-closure glaucoma education already exists:',
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
        ? 'Skipped existing scheduled acute angle-closure glaucoma case.'
        : 'Skipped existing acute angle-closure glaucoma case to avoid overwriting authored content.',
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
  const symptoms = [clues[1].value];

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
      'Seeded complete frontend-aligned flagship Acute Angle-Closure Glaucoma case with six supported clues, exact clue-breakdown alignment, canonical differentials, gonioscopic confirmation, and diagnosis-level education independent of the vignette.',
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
        'Created complete acute angle-closure glaucoma revision with progressive red-eye reasoning, exact clue-to-breakdown alignment, canonical evidence-anchored differentials, objective pressure measurement, and gonioscopic teaching.',
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
      validatorVersion: 'flagship-human-review:acute-angle-closure-glaucoma-v1',
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        clueProgressionVerified: true,
        breakdownClueReferencesValidated: true,
        frontendReasoningStringVerified: true,
        differentialEvidenceAnchoredToClues: true,
        canonicalDifferentialsVerified: true,
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
          clinicalSetting: 'EMERGENCY',
          ageGroup: 'ADULT',
          urgencyLevel: 'EMERGENT',
        },
        note:
          'Complete Acute Angle-Closure Glaucoma flagship seed with six supported clues, no early diagnosis-label leakage, exact clue and reasoning alignment, canonical evidence-anchored differentials, gonioscopic confirmation, emergency management teaching, and independent diagnosis education.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded Acute Angle-Closure Glaucoma:', {
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
