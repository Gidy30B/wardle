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
 * FLAGSHIP CASE SEED - Sheehan Syndrome
 *
 * Clinical focus:
 * - Delayed postpartum hypopituitarism after severe postpartum haemorrhage.
 * - Early postpartum agalactia followed by persistent amenorrhoea.
 * - Secondary adrenal insufficiency and central hypothyroidism.
 * - Multiple anterior pituitary hormone deficiencies.
 * - Pituitary atrophy / partially empty sella on MRI.
 * - Correct treatment sequence: glucocorticoid replacement before levothyroxine.
 *
 * Safety:
 * - Reuses or creates the diagnosis registry and accepted aliases.
 * - Does not overwrite existing diagnosis education.
 * - Does not overwrite an existing case with the same title.
 * - Does not alter a scheduled DailyCase.
 *
 * Run:
 *   npx tsx prisma/seed/flagship-sheehan-syndrome.seed.ts
 *
 * Railway:
 *   railway run npx tsx prisma/seed/flagship-sheehan-syndrome.seed.ts
 */

const databaseUrl = resolvePgConnectionString(process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run the Sheehan Syndrome seed.');
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
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 6, 22, 12, 0, 0));
const seedVersion = 'flagship-sheehan-syndrome-v1';

const canonicalName = 'Sheehan syndrome';
const displayLabel = 'Sheehan Syndrome';
const caseTitle = 'Postpartum Fatigue, Amenorrhoea and Recurrent Collapse';

const aliasTerms = [
  'Sheehan Syndrome',
  "Sheehan's Syndrome",
  'Postpartum Hypopituitarism',
  'Postpartum Pituitary Necrosis',
  'Postpartum Panhypopituitarism',
];

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 36-year-old woman presents with worsening fatigue, dizziness on standing, nausea, poor appetite, and two brief episodes of collapse during a three-day diarrhoeal illness. For several years she has struggled with reduced energy, cold intolerance, constipation, and difficulty completing normal daily activities.',
  },
  {
    order: 1,
    type: 'history',
    value:
      'Her symptoms began after the delivery of her last child three years ago. The birth was complicated by severe postpartum haemorrhage, prolonged hypotension, emergency uterine exploration, and transfusion of four units of blood. She did not require hysterectomy and has had no subsequent major bleeding.',
  },
  {
    order: 2,
    type: 'symptom',
    value:
      'She was unable to produce breast milk after that delivery despite repeated attempts to breastfeed. Her menstrual periods never returned, libido declined, and she has noticed gradual loss of axillary and pubic hair. She is not using hormonal contraception and repeated pregnancy tests have been negative.',
  },
  {
    order: 3,
    type: 'exam',
    value:
      'She appears tired and pale, with dry cool skin and sparse axillary hair. Supine blood pressure is 92/58 mmHg and falls to 76/46 mmHg on standing; pulse is 62/min. There is no skin or mucosal hyperpigmentation, visual-field defect, galactorrhoea, goitre, peripheral oedema, or focal neurological deficit.',
  },
  {
    order: 4,
    type: 'lab',
    value:
      'Serum sodium is 124 mmol/L and glucose is 3.1 mmol/L. At 08:00, cortisol is very low with an inappropriately low ACTH. Free thyroxine is low with a low-normal TSH. Prolactin, estradiol, FSH, LH, and IGF-1 are also low. Potassium is normal, renal function is preserved, and a full blood count shows only mild normocytic anaemia.',
  },
  {
    order: 5,
    type: 'imaging',
    value:
      'Pituitary MRI shows a small, flattened anterior pituitary with a partially empty sella and no sellar mass or optic-chiasm compression. Severe obstetric haemorrhagic shock followed by agalactia, persistent amenorrhoea, and combined ACTH, TSH, prolactin, gonadotropin, and growth-hormone axis failure establishes postpartum ischaemic hypopituitarism.',
  },
] as const;

const differentials = [
  'Primary Adrenal Insufficiency',
  'Lymphocytic Hypophysitis',
  'Non-functioning Pituitary Macroadenoma',
  'Primary Hypothyroidism',
  'Postpartum Depression',
  'Iron-deficiency Anaemia',
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
}

const explanation = {
  diagnosis: displayLabel,
  summary:
    'Severe postpartum haemorrhagic shock followed by failure of lactation, persistent amenorrhoea, loss of secondary sexual hair, central adrenal insufficiency, central hypothyroidism, and a partially empty sella establishes Sheehan Syndrome.',
  reasoning: [
    'The current diarrhoeal illness has unmasked limited cortisol reserve, explaining orthostatic hypotension, nausea, hypoglycaemia, and hyponatraemia.',
    'The key causal event is severe postpartum haemorrhage with prolonged hypotension, which can cause ischaemic necrosis of the physiologically enlarged pituitary gland.',
    'Failure to lactate immediately after delivery is an early marker of prolactin deficiency and is often the first missed clue.',
    'Persistent amenorrhoea, reduced libido, and loss of axillary or pubic hair indicate gonadotropin deficiency rather than a single-organ thyroid or adrenal disorder.',
    'Low free thyroxine with a low or inappropriately normal TSH demonstrates central hypothyroidism; TSH alone would be misleading.',
    'Very low morning cortisol with low ACTH supports secondary adrenal insufficiency. Normal potassium and absent hyperpigmentation further argue against primary adrenal failure.',
    'Low prolactin, estradiol, FSH, LH, and IGF-1 demonstrate failure across several anterior pituitary axes.',
    'MRI showing pituitary atrophy and a partially empty sella, without a mass, supports remote postpartum pituitary infarction.',
    'The diagnosis is therefore postpartum ischaemic hypopituitarism rather than isolated hypothyroidism, depression, anaemia, pituitary tumour, or primary adrenal disease.',
  ],
  keyFindings: [
    'Age 36 years',
    'Three-day diarrhoeal illness precipitating collapse',
    'Chronic fatigue, cold intolerance, and constipation',
    'Severe postpartum haemorrhage three years earlier',
    'Prolonged hypotension during delivery',
    'Four-unit blood transfusion',
    'Failure of lactation after delivery',
    'Persistent postpartum amenorrhoea',
    'Reduced libido',
    'Loss of axillary and pubic hair',
    'Orthostatic hypotension',
    'Relative bradycardia',
    'Dry cool skin',
    'No hyperpigmentation',
    'No visual-field defect',
    'Hyponatraemia',
    'Hypoglycaemia',
    'Low morning cortisol with low ACTH',
    'Low free thyroxine with low-normal TSH',
    'Low prolactin',
    'Low estradiol with low FSH and LH',
    'Low IGF-1',
    'Normal potassium',
    'Partially empty sella on pituitary MRI',
    'No sellar mass or optic-chiasm compression',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Primary Adrenal Insufficiency',
      whyPlausibleEarly:
        'Orthostatic hypotension, nausea, fatigue, hyponatraemia, and hypoglycaemia can reflect adrenal insufficiency.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence:
            'agalactia, persistent amenorrhoea, reduced libido, and loss of axillary hair',
          reason:
            'These findings indicate failure of multiple pituitary axes rather than isolated primary adrenal disease.',
        },
        {
          clueOrder: 3,
          evidence: 'no skin or mucosal hyperpigmentation',
          reason:
            'Primary adrenal insufficiency commonly raises ACTH and may produce hyperpigmentation; its absence supports a central cause.',
        },
        {
          clueOrder: 4,
          evidence: 'very low cortisol with inappropriately low ACTH and normal potassium',
          reason:
            'Low ACTH and preserved mineralocorticoid function support secondary rather than primary adrenal insufficiency.',
        },
      ],
      finalReasonLessLikely:
        'The biochemical pattern is central adrenal insufficiency embedded within panhypopituitarism, not primary adrenal gland failure.',
    },
    {
      diagnosis: 'Lymphocytic Hypophysitis',
      whyPlausibleEarly:
        'Autoimmune pituitary inflammation can arise during late pregnancy or postpartum and cause multiple pituitary hormone deficiencies.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence:
            'severe postpartum haemorrhage with prolonged hypotension and transfusion',
          reason:
            'This is a strong direct ischaemic trigger for postpartum pituitary injury.',
        },
        {
          clueOrder: 3,
          evidence:
            'no headache, visual-field defect, galactorrhoea, or focal neurological finding',
          reason:
            'An enlarging inflammatory pituitary lesion more often causes headache, visual symptoms, stalk effects, or mass-related findings.',
        },
        {
          clueOrder: 5,
          evidence:
            'small flattened pituitary and partially empty sella without sellar enlargement',
          reason:
            'Remote infarction produces pituitary atrophy, whereas active hypophysitis more often causes gland or stalk enlargement.',
        },
      ],
      finalReasonLessLikely:
        'The haemorrhagic-shock history and atrophic empty-sella appearance favour remote ischaemic necrosis over active autoimmune hypophysitis.',
    },
    {
      diagnosis: 'Non-functioning Pituitary Macroadenoma',
      whyPlausibleEarly:
        'A pituitary mass can cause multiple anterior pituitary hormone deficiencies and secondary adrenal or thyroid failure.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence:
            'symptoms began directly after severe postpartum haemorrhagic shock',
          reason:
            'The temporal relationship points to an obstetric vascular insult rather than gradual tumour expansion.',
        },
        {
          clueOrder: 3,
          evidence: 'no visual-field defect or focal neurological deficit',
          reason:
            'A large macroadenoma often causes chiasmal or local mass effects, although their absence does not completely exclude a tumour.',
        },
        {
          clueOrder: 5,
          evidence:
            'small flattened pituitary with no sellar mass or optic-chiasm compression',
          reason:
            'MRI directly excludes a macroadenoma and instead demonstrates pituitary atrophy.',
        },
      ],
      finalReasonLessLikely:
        'There is no sellar mass; the MRI and obstetric timeline support postpartum pituitary infarction.',
    },
    {
      diagnosis: 'Primary Hypothyroidism',
      whyPlausibleEarly:
        'Fatigue, cold intolerance, constipation, dry skin, relative bradycardia, and menstrual disturbance can result from primary thyroid failure.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence:
            'failure of lactation immediately after delivery and persistent loss of gonadal function',
          reason:
            'These cannot be explained adequately by isolated thyroid disease and suggest broader pituitary failure.',
        },
        {
          clueOrder: 4,
          evidence: 'low free thyroxine with low-normal rather than elevated TSH',
          reason:
            'Primary hypothyroidism should produce an appropriately raised TSH; this pattern is central hypothyroidism.',
        },
        {
          clueOrder: 4,
          evidence:
            'simultaneously low ACTH-cortisol, prolactin, gonadotropin, and IGF-1 axes',
          reason:
            'Multiple pituitary deficits establish a central multisystem process.',
        },
      ],
      finalReasonLessLikely:
        'The thyroid abnormality is secondary to pituitary failure and occurs alongside several other anterior pituitary deficiencies.',
    },
    {
      diagnosis: 'Postpartum Depression',
      whyPlausibleEarly:
        'Low energy, reduced motivation, impaired daily function, and sexual symptoms after childbirth may be attributed to depression.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence:
            'severe obstetric haemorrhage with hypotension immediately before symptom onset',
          reason:
            'This is a biological risk event for pituitary infarction that requires endocrine assessment.',
        },
        {
          clueOrder: 2,
          evidence:
            'agalactia, persistent amenorrhoea, and loss of axillary and pubic hair',
          reason:
            'These objective endocrine features are not explained by a primary mood disorder.',
        },
        {
          clueOrder: 4,
          evidence:
            'hyponatraemia, hypoglycaemia, and multiple low pituitary target hormones',
          reason:
            'The laboratory abnormalities confirm organic hypopituitarism.',
        },
      ],
      finalReasonLessLikely:
        'Depression may coexist, but it cannot explain the postpartum endocrine deficits, biochemical abnormalities, or MRI findings.',
    },
    {
      diagnosis: 'Iron-deficiency Anaemia',
      whyPlausibleEarly:
        'A history of major blood loss with fatigue, dizziness, reduced exercise tolerance, and pallor may suggest persistent anaemia.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence:
            'agalactia, amenorrhoea, reduced libido, and loss of body hair',
          reason:
            'These findings indicate endocrine failure rather than reduced oxygen-carrying capacity alone.',
        },
        {
          clueOrder: 4,
          evidence:
            'only mild normocytic anaemia with severe hormonal abnormalities',
          reason:
            'The degree and type of anaemia do not account for the full syndrome.',
        },
        {
          clueOrder: 5,
          evidence: 'partially empty sella with pituitary atrophy',
          reason:
            'Structural pituitary loss provides a unifying cause absent in simple iron deficiency.',
        },
      ],
      finalReasonLessLikely:
        'Mild anaemia may contribute to fatigue, but it does not explain the multi-axis pituitary dysfunction.',
    },
  ] satisfies DifferentialAnalysisEntry[],
  managementPearl:
    'When ACTH deficiency and central hypothyroidism coexist, replace glucocorticoids first—or provide urgent stress-dose parenteral glucocorticoid treatment if the patient is unstable—before starting levothyroxine. Thyroid hormone given before cortisol coverage can precipitate adrenal crisis. Long-term replacement is then tailored to the deficient pituitary axes.',
  generationQuality: {
    contentTier: 'FLAGSHIP',
    seedVersion,
    humanReviewed: true,
    discriminatorStrength: 'VERY_HIGH',
    clueProgressionVerified: true,
    breakdownClueReferencesValidated: true,
    expectedTeachingPoints: [
      'Severe postpartum haemorrhage and hypotension can cause ischaemic necrosis of the enlarged pregnancy pituitary',
      'Failure of lactation may be the earliest clue to prolactin deficiency',
      'Persistent postpartum amenorrhoea suggests gonadotropin deficiency',
      'Low free thyroxine with low or inappropriately normal TSH indicates central hypothyroidism',
      'Low cortisol with low ACTH indicates secondary adrenal insufficiency',
      'Normal potassium and absent hyperpigmentation help distinguish secondary from primary adrenal insufficiency',
      'MRI commonly shows pituitary atrophy or a partially or completely empty sella in chronic disease',
      'Glucocorticoid replacement must precede levothyroxine when cortisol deficiency is possible',
    ],
    competencyDomains: [
      'Obstetrics and Gynaecology',
      'Endocrinology',
      'Postpartum Medicine',
      'Pituitary Disease',
      'Adrenal Insufficiency',
      'Clinical Reasoning',
      'Hormone Replacement Safety',
    ],
  },
};

const educationForFrontend = {
  title: displayLabel,
  summary: {
    definition:
      'Sheehan Syndrome is postpartum hypopituitarism caused by ischaemic necrosis of the pituitary gland after severe obstetric haemorrhage, hypotension, or shock.',
    highYieldTakeaway:
      'Think of Sheehan Syndrome when a woman develops failure to lactate, persistent amenorrhoea, fatigue, hypotension, hyponatraemia, or central hypothyroidism after a delivery complicated by major haemorrhage.',
  },
  recognitionPattern: [
    {
      pattern: 'Severe obstetric haemorrhage followed by endocrine failure',
      whyItMatters:
        'The enlarged pituitary of pregnancy is vulnerable to reduced perfusion during haemorrhagic shock.',
      progression:
        'Major postpartum blood loss and hypotension -> pituitary ischaemia -> evolving anterior pituitary hormone deficiencies.',
      discriminator:
        'The causal obstetric event may have occurred months or years before the diagnosis.',
      commonTrap:
        'Do not dismiss a remote postpartum haemorrhage because the current symptoms are chronic or nonspecific.',
    },
    {
      pattern: 'Agalactia and persistent amenorrhoea',
      whyItMatters:
        'Failure of lactation reflects prolactin deficiency, while absent return of menses reflects gonadotropin deficiency.',
      progression:
        'No milk production after delivery -> menstrual periods fail to return -> reduced libido, infertility, or loss of sexual hair.',
      discriminator:
        'This paired postpartum pattern strongly points toward anterior pituitary failure.',
      commonTrap:
        'Do not attribute absent lactation solely to breastfeeding technique without reviewing the delivery history and other endocrine symptoms.',
    },
    {
      pattern: 'Central adrenal and thyroid failure',
      whyItMatters:
        'ACTH deficiency may be life-threatening, while central hypothyroidism produces fatigue, cold intolerance, constipation, and bradycardia.',
      progression:
        'Reduced ACTH and TSH secretion -> low cortisol and free thyroxine -> hypotension, hyponatraemia, hypoglycaemia, and reduced metabolic function.',
      discriminator:
        'Target-gland hormones are low while pituitary hormones are low or inappropriately normal.',
      commonTrap:
        'Do not use a normal-range TSH to exclude central hypothyroidism.',
    },
    {
      pattern: 'Pituitary atrophy or empty sella',
      whyItMatters:
        'Chronic postpartum pituitary necrosis may evolve from early gland changes to later atrophy.',
      progression:
        'Acute ischaemic injury -> tissue loss -> small pituitary or partially/completely empty sella.',
      discriminator:
        'MRI excludes a compressive mass and supports the remote vascular mechanism.',
      commonTrap:
        'Imaging supports the diagnosis but does not replace the obstetric history and hormone evaluation.',
    },
  ],
  keySymptoms: [
    {
      symptom: 'Failure to lactate',
      significance:
        'An early clue to prolactin deficiency after the affected delivery.',
    },
    {
      symptom: 'Persistent postpartum amenorrhoea',
      significance:
        'Suggests loss of LH and FSH secretion, especially when pregnancy and contraception are excluded.',
    },
    {
      symptom: 'Fatigue, weakness, nausea, or recurrent collapse',
      significance:
        'May reflect cortisol deficiency, central hypothyroidism, hypoglycaemia, or hyponatraemia.',
    },
    {
      symptom: 'Cold intolerance and constipation',
      significance:
        'Support central hypothyroidism when free thyroxine is low.',
    },
    {
      symptom: 'Reduced libido or infertility',
      significance:
        'Reflect hypogonadotropic hypogonadism and may be a delayed presenting feature.',
    },
  ],
  keySigns: [
    {
      finding: 'Orthostatic or persistent hypotension',
      significance:
        'Raises concern for ACTH-cortisol deficiency, especially during infection or fasting.',
      discriminator:
        'Normal potassium may be retained because aldosterone is primarily regulated by the renin-angiotensin system.',
    },
    {
      finding: 'Sparse axillary or pubic hair',
      significance:
        'Supports chronic gonadotropin and adrenal androgen deficiency.',
      discriminator:
        'It is an objective clue to multisystem pituitary failure.',
    },
    {
      finding: 'Dry cool skin with relative bradycardia',
      significance: 'Supports central hypothyroidism.',
      discriminator:
        'Interpret alongside free thyroxine rather than relying on TSH alone.',
    },
    {
      finding: 'Absent hyperpigmentation',
      significance:
        'Supports central rather than primary adrenal insufficiency.',
      discriminator:
        'ACTH is low rather than elevated, so melanocortin stimulation is absent.',
    },
  ],
  examPearls: [
    {
      type: 'HISTORY',
      title: 'Reconstruct the affected delivery',
      content:
        'Ask about estimated blood loss, transfusion, hypotension, loss of consciousness, operative intervention, intensive-care admission, and failure of lactation.',
      whyItMatters:
        'The diagnosis is often missed unless the present illness is explicitly linked to a remote obstetric emergency.',
      discriminator:
        'Postpartum haemorrhagic shock immediately preceding agalactia and amenorrhoea is highly informative.',
      trapAvoided:
        'Do not record only “previous postpartum haemorrhage” without defining severity and sequelae.',
    },
    {
      type: 'ENDOCRINE',
      title: 'Assess every anterior pituitary axis',
      content:
        'Evaluate morning cortisol and ACTH, free thyroxine and TSH, prolactin, gonadotropins and estradiol, and the growth-hormone axis as clinically appropriate.',
      whyItMatters:
        'Hormone loss may be partial, progressive, and unequal across axes.',
      discriminator:
        'Multiple low target hormones with low or inappropriately normal pituitary hormones establish central failure.',
      trapAvoided:
        'Do not stop after finding one abnormal hormone.',
    },
    {
      type: 'DISCRIMINATOR',
      title: 'Distinguish central from primary adrenal failure',
      content:
        'Look for ACTH level, potassium, pigmentation, and evidence of other pituitary deficits.',
      whyItMatters:
        'The cause determines the wider hormone assessment and long-term treatment plan.',
      discriminator:
        'Low ACTH, normal potassium, absent hyperpigmentation, and other pituitary deficiencies support a central cause.',
      trapAvoided:
        'Do not label all hypotension and hyponatraemia as primary Addison disease.',
    },
    {
      type: 'SAFETY',
      title: 'Cover cortisol before thyroid replacement',
      content:
        'Treat suspected or confirmed cortisol deficiency before initiating levothyroxine.',
      whyItMatters:
        'Thyroid hormone increases metabolic cortisol requirements and clearance and may precipitate adrenal crisis when reserve is inadequate.',
      discriminator:
        'The sequence of replacement is a safety decision, not merely a prescribing preference.',
      trapAvoided:
        'Do not start levothyroxine first in untreated combined ACTH and TSH deficiency.',
    },
  ],
  scoringSystems: [],
  investigations: [
    {
      test: '08:00 serum cortisol and ACTH',
      interpretation:
        'A clearly low morning cortisol with low or inappropriately normal ACTH supports central adrenal insufficiency. Indeterminate results may require dynamic testing when the patient is stable.',
      whyItMatters:
        'ACTH deficiency is the most immediately life-threatening pituitary deficit.',
    },
    {
      test: 'Free thyroxine and TSH',
      interpretation:
        'Low free thyroxine with low, normal, or only mildly elevated TSH indicates central hypothyroidism.',
      whyItMatters:
        'TSH can appear normal and must not be interpreted without free thyroxine.',
    },
    {
      test: 'Prolactin, LH, FSH, and estradiol',
      interpretation:
        'Low prolactin supports failure of lactation; low estradiol with low or inappropriately normal gonadotropins supports hypogonadotropic hypogonadism.',
      whyItMatters:
        'These tests connect the postpartum symptoms to anterior pituitary dysfunction.',
    },
    {
      test: 'Serum sodium and glucose',
      interpretation:
        'Hyponatraemia and hypoglycaemia may accompany cortisol deficiency and can worsen during infection, fasting, or gastrointestinal illness.',
      whyItMatters:
        'They identify acute physiological risk and support urgent treatment when the patient is unstable.',
    },
    {
      test: 'Pituitary MRI',
      interpretation:
        'Chronic disease may show a small pituitary or partially/completely empty sella. MRI also excludes a macroadenoma, haemorrhage, or compressive lesion.',
      whyItMatters:
        'Imaging supports the mechanism and evaluates important alternatives.',
    },
    {
      test: 'Additional pituitary-axis and complication assessment',
      interpretation:
        'Consider IGF-1, osmolality testing when diabetes insipidus is suspected, bone-health assessment, lipid profile, and fertility evaluation according to the clinical context.',
      whyItMatters:
        'Long-standing hypopituitarism affects metabolic, reproductive, cardiovascular, and skeletal health.',
    },
  ],
  differentialDistinguishers: [
    {
      diagnosis: 'Primary Adrenal Insufficiency',
      overlap:
        'Hypotension, fatigue, nausea, hyponatraemia, and hypoglycaemia.',
      distinguishingFeatures:
        'Usually has elevated ACTH, may cause hyperpigmentation and hyperkalaemia, and does not explain agalactia with low gonadotropins and central hypothyroidism.',
      decisiveClue:
        'Low ACTH plus multiple other pituitary-axis deficiencies supports secondary adrenal insufficiency.',
    },
    {
      diagnosis: 'Lymphocytic Hypophysitis',
      overlap:
        'Pregnancy-associated or postpartum hypopituitarism.',
      distinguishingFeatures:
        'Often presents with headache, visual symptoms, stalk involvement, or pituitary enlargement during the inflammatory phase.',
      decisiveClue:
        'Severe postpartum haemorrhage followed by an atrophic empty sella favours ischaemic pituitary necrosis.',
    },
    {
      diagnosis: 'Non-functioning Pituitary Macroadenoma',
      overlap: 'Multiple pituitary hormone deficiencies.',
      distinguishingFeatures:
        'May cause headache, bitemporal visual loss, sellar enlargement, or a visible mass.',
      decisiveClue:
        'MRI shows no mass and instead demonstrates a small flattened gland.',
    },
    {
      diagnosis: 'Primary Hypothyroidism',
      overlap:
        'Fatigue, cold intolerance, constipation, dry skin, bradycardia, and menstrual disturbance.',
      distinguishingFeatures:
        'Primary thyroid failure produces an appropriately high TSH and does not explain low ACTH-cortisol, prolactin, and gonadotropins.',
      decisiveClue:
        'Low free thyroxine with low-normal TSH and other pituitary deficits indicates central disease.',
    },
    {
      diagnosis: 'Postpartum Depression',
      overlap:
        'Low energy, impaired function, sleep or appetite changes, and reduced libido.',
      distinguishingFeatures:
        'Does not cause objective hormone deficiencies, hyponatraemia, hypoglycaemia, agalactia from low prolactin, or pituitary atrophy.',
      decisiveClue:
        'The endocrine panel and MRI establish an organic pituitary disorder.',
    },
    {
      diagnosis: 'Iron-deficiency Anaemia',
      overlap:
        'Fatigue, dizziness, pallor, and prior obstetric blood loss.',
      distinguishingFeatures:
        'CBC and iron studies define the anaemia, which cannot explain multiple pituitary hormone deficits.',
      decisiveClue:
        'Only mild anaemia is present while the dominant abnormalities are central endocrine deficiencies.',
    },
  ],
  managementOverview: [
    {
      step: 'Stabilise suspected adrenal crisis immediately',
      rationale:
        'In an unstable patient, obtain urgent samples when this does not delay care, then give parenteral stress-dose glucocorticoid therapy, isotonic fluid, glucose when required, and treatment of the precipitating illness.',
    },
    {
      step: 'Replace glucocorticoids before levothyroxine',
      rationale:
        'Cortisol coverage prevents thyroid replacement from precipitating adrenal decompensation.',
    },
    {
      step: 'Replace thyroid hormone using free thyroxine targets',
      rationale:
        'TSH is unreliable in central hypothyroidism; treatment is monitored clinically and with free thyroxine.',
    },
    {
      step: 'Address gonadal hormone deficiency and fertility goals',
      rationale:
        'Oestrogen-progestogen replacement may protect symptoms and bone health when appropriate, while fertility usually requires specialist ovulation induction.',
    },
    {
      step: 'Assess remaining pituitary axes and long-term complications',
      rationale:
        'Evaluate growth-hormone status when appropriate, bone health, metabolic risk, quality of life, and any symptoms suggesting posterior pituitary involvement.',
    },
    {
      step: 'Provide lifelong adrenal-safety education',
      rationale:
        'Patients with ACTH deficiency need sick-day rules, emergency planning, medical identification, and clear instructions for vomiting, infection, surgery, or inability to take oral medication.',
    },
  ],
  complications: [
    'Adrenal crisis',
    'Severe hyponatraemia',
    'Recurrent hypoglycaemia',
    'Infertility',
    'Osteopenia or osteoporosis',
    'Premature cardiovascular and metabolic morbidity',
    'Reduced quality of life',
    'Persistent central hypothyroidism',
    'Unrecognised growth-hormone deficiency',
    'Treatment-related adrenal decompensation if levothyroxine is started before glucocorticoids',
  ],
  pitfalls: [
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Missing the remote obstetric link',
      content:
        'Symptoms may emerge gradually and the causative delivery may have occurred years earlier.',
      whyItMatters:
        'Without a detailed obstetric history, patients are often treated separately for fatigue, anaemia, depression, infertility, or hypothyroidism.',
      trapAvoided:
        'Always ask about postpartum haemorrhage, hypotension, transfusion, lactation, and menstrual recovery.',
    },
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Using TSH alone',
      content:
        'TSH may be low, normal, or mildly elevated despite clinically important central hypothyroidism.',
      whyItMatters:
        'A falsely reassuring TSH delays diagnosis and treatment.',
      trapAvoided:
        'Interpret TSH together with free thyroxine and the other pituitary axes.',
    },
    {
      type: 'SAFETY',
      title: 'Starting levothyroxine before cortisol coverage',
      content:
        'Untreated ACTH deficiency can deteriorate when thyroid hormone is introduced.',
      whyItMatters:
        'The error can precipitate life-threatening adrenal crisis.',
      trapAvoided:
        'Replace glucocorticoids first whenever cortisol deficiency is present or not yet safely excluded.',
    },
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Calling the adrenal failure primary',
      content:
        'Secondary adrenal insufficiency usually preserves aldosterone and therefore may have normal potassium and no hyperpigmentation.',
      whyItMatters:
        'Recognising the central pattern prompts assessment of all pituitary hormones.',
      trapAvoided:
        'Use ACTH, pigmentation, potassium, and coexisting pituitary deficits to localise the problem.',
    },
    {
      type: 'DIAGNOSTIC_TRAP',
      title: 'Excluding disease because MRI is not completely empty',
      content:
        'Imaging appearances vary with timing and may show a small gland, partial empty sella, or complete empty sella.',
      whyItMatters:
        'Diagnosis rests on the combined obstetric, clinical, hormonal, and imaging pattern.',
      trapAvoided:
        'Do not require one specific MRI appearance.',
    },
  ],
  recallPrompts: [
    {
      prompt: 'What obstetric event classically precedes Sheehan Syndrome?',
      answer:
        'Severe postpartum haemorrhage with hypotension or shock causing ischaemic pituitary injury.',
    },
    {
      prompt: 'What is an important early postpartum clue?',
      answer:
        'Failure to lactate because of prolactin deficiency.',
    },
    {
      prompt: 'What reproductive clue often persists?',
      answer:
        'Failure of menstrual periods to return because of gonadotropin deficiency.',
    },
    {
      prompt: 'What laboratory pattern indicates central hypothyroidism?',
      answer:
        'Low free thyroxine with a low or inappropriately normal TSH.',
    },
    {
      prompt:
        'What features distinguish secondary from primary adrenal insufficiency?',
      answer:
        'Low ACTH, absent hyperpigmentation, usually normal potassium, and evidence of other pituitary hormone deficiencies.',
    },
    {
      prompt:
        'Which hormone replacement must generally be started first when both ACTH and TSH deficiencies are present?',
      answer:
        'Glucocorticoid replacement before levothyroxine.',
    },
    {
      prompt: 'What chronic MRI appearance commonly supports the diagnosis?',
      answer:
        'Pituitary atrophy with a partially or completely empty sella.',
    },
  ],
  references: [
    {
      citation:
        'Nana M, et al. Pituitary and Adrenal Disorders of Pregnancy. Endotext. Updated 2025.',
    },
    {
      citation:
        'Karaca Z, et al. Sheehan syndrome: a current approach to a dormant disease. Pituitary. 2025.',
    },
    {
      citation:
        'Fleseriu M, et al. Hormonal Replacement in Hypopituitarism in Adults: An Endocrine Society Clinical Practice Guideline. Journal of Clinical Endocrinology & Metabolism. 2016.',
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
          specialty: 'Obstetrics & Gynaecology',
          subspecialty: 'Maternal Medicine / Endocrinology',
          category: 'Postpartum Pituitary Disorder',
          bodySystem: 'Endocrine / Reproductive',
          organSystem: 'Pituitary Gland',
          difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
          rarityBand: DiagnosisRarityBand.UNCOMMON,
          clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
          ageGroup: DiagnosisAgeGroup.ADULT,
          urgencyLevel: DiagnosisUrgencyLevel.URGENT,
          preferredClueTypes: [
            'history',
            'symptom',
            'exam',
            'lab',
            'imaging',
          ],
          notes:
            'Seeded flagship Sheehan Syndrome case focused on severe postpartum haemorrhage, agalactia, persistent amenorrhoea, central adrenal and thyroid failure, multi-axis hypopituitarism, and pituitary atrophy.',
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
          specialty: 'Obstetrics & Gynaecology',
          subspecialty: 'Maternal Medicine / Endocrinology',
          category: 'Postpartum Pituitary Disorder',
          bodySystem: 'Endocrine / Reproductive',
          organSystem: 'Pituitary Gland',
          difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
          rarityBand: DiagnosisRarityBand.UNCOMMON,
          clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
          ageGroup: DiagnosisAgeGroup.ADULT,
          urgencyLevel: DiagnosisUrgencyLevel.URGENT,
          preferredClueTypes: [
            'history',
            'symptom',
            'exam',
            'lab',
            'imaging',
          ],
          notes:
            'Seeded flagship Sheehan Syndrome case focused on severe postpartum haemorrhage, agalactia, persistent amenorrhoea, central adrenal and thyroid failure, multi-axis hypopituitarism, and pituitary atrophy.',
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
      'Skipped diagnosis education because Sheehan Syndrome education already exists:',
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
        ? 'Skipped existing scheduled Sheehan Syndrome case.'
        : 'Skipped existing Sheehan Syndrome case to avoid overwriting authored content.',
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
      'Seeded complete frontend-aligned flagship Sheehan Syndrome case with postpartum haemorrhagic shock, agalactia, persistent amenorrhoea, central adrenal and thyroid failure, multi-axis hypopituitarism, clue-order-aligned differential analysis, and full diagnosis education.',
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
        'Created complete Sheehan Syndrome revision with six valid playable clues, validated breakdown clue references, pituitary-axis reasoning, and safe hormone-replacement sequencing.',
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
      validatorVersion: 'flagship-human-review:sheehan-syndrome-v1',
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        clueProgressionVerified: true,
        breakdownClueReferencesValidated: true,
        playableClueCount: clues.length,
        clueTypes: clues.map((clue) => clue.type),
        duplicateSafe: true,
        doesNotOverwriteExistingEducation: true,
        doesNotOverwriteExistingCase: true,
        metadataVerified: {
          specialty: 'Obstetrics & Gynaecology',
          subspecialty: 'Maternal Medicine / Endocrinology',
          category: 'Postpartum Pituitary Disorder',
          bodySystem: 'Endocrine / Reproductive',
          organSystem: 'Pituitary Gland',
          difficultyBand: 'INTERMEDIATE',
          rarityBand: 'UNCOMMON',
          clinicalSetting: 'EMERGENCY',
          ageGroup: 'ADULT',
          urgencyLevel: 'URGENT',
        },
        note: 'Complete Sheehan Syndrome flagship seed with six supported clue types, no early diagnosis leakage, accurate clue-to-breakdown alignment, multi-axis pituitary localisation, and full education payload.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded Sheehan Syndrome:', {
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