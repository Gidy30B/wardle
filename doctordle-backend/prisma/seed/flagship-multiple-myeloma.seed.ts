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

function resolvePgConnectionString(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (!value.startsWith('prisma+postgres://')) return value;

  const parsed = new URL(value);
  const apiKey = parsed.searchParams.get('api_key');
  if (!apiKey) {
    throw new Error('DATABASE_URL uses prisma+postgres:// but is missing api_key.');
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

const databaseUrl = resolvePgConnectionString(process.env.DATABASE_URL);
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run the Multiple Myeloma seed.');
}

const pool = new Pool({ connectionString: databaseUrl, max: 1 });
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
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 11, 12, 12, 0, 0));
const seedVersion = 'flagship-multiple-myeloma-v1';

const canonicalName = 'multiple myeloma';
const displayLabel = 'Multiple Myeloma';
const caseTitle =
  'Progressive Back Pain with Anaemia, Renal Impairment and Hypercalcaemia';

const aliasTerms = [
  'Multiple Myeloma',
  'multiple myeloma',
  'plasma cell myeloma',
  'myeloma',
];

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 68-year-old man presents with four months of persistent lower-back and rib pain that has gradually worsened and now limits walking and sleep. There is no major trauma, known solid-organ malignancy, or long-term glucocorticoid use.',
  },
  {
    order: 1,
    type: 'symptom',
    value:
      'He reports progressive fatigue, reduced exercise tolerance, constipation, increased thirst, and two treated chest infections over the past six months. He has no overt bleeding, black stools, focal limb weakness, or urinary retention.',
  },
  {
    order: 2,
    type: 'exam',
    value:
      'He is pale and has focal tenderness over the lower thoracic and upper lumbar vertebrae and several posterior ribs. There is no lymphadenopathy or hepatosplenomegaly, and lower-limb power, sensation, reflexes, and sphincter function are intact.',
  },
  {
    order: 3,
    type: 'lab',
    value:
      'Haemoglobin is 8.6 g/dL with MCV 91 fL, corrected calcium is 3.02 mmol/L, creatinine is 226 micromol/L with eGFR 26 mL/min/1.73 m2, total protein is 105 g/L, and albumin is 29 g/L.',
  },
  {
    order: 4,
    type: 'lab',
    value:
      'Serum protein electrophoresis shows a 42 g/L monoclonal band. Immunofixation identifies an IgG kappa paraprotein; serum free kappa light chains are 780 mg/L and lambda 10 mg/L, giving an involved-to-uninvolved ratio of 78. Urine immunofixation detects monoclonal kappa light chains.',
  },
  {
    order: 5,
    type: 'lab',
    value:
      'Bone-marrow aspirate and trephine biopsy show 34% clonal plasma cells with CD138 expression and kappa light-chain restriction. There is no metastatic carcinoma in the trephine. In the context of anaemia, hypercalcaemia, and renal impairment attributable to the plasma-cell disorder, this establishes active disease.',
  },
] as const;

const differentials = [
  'Monoclonal Gammopathy of Undetermined Significance',
  'Smoldering Multiple Myeloma',
  'Waldenström Macroglobulinemia',
  'Metastatic Bone Disease',
  'Primary Hyperparathyroidism',
  'Chronic Kidney Disease',
];

const explanation = {
  diagnosis: displayLabel,
  summary:
    'Progressive axial bone pain, normocytic anaemia, hypercalcaemia, renal impairment, a large IgG kappa monoclonal protein, and 34% clonal marrow plasma cells establish active Multiple Myeloma with myeloma-related end-organ injury.',
  reasoning: [
    'Persistent atraumatic axial skeletal pain in an older adult raises concern for malignant, metabolic, or infiltrative bone disease rather than simple mechanical back pain.',
    'Fatigue, recurrent infections, constipation, and thirst suggest a systemic process involving marrow function, immune competence, and calcium balance.',
    'Pallor and focal vertebral and rib tenderness localize the illness toward marrow and skeletal pathology, while the absence of lymphadenopathy or hepatosplenomegaly makes some lymphoid malignancies less typical.',
    'Normocytic anaemia, marked hypercalcaemia, renal impairment, and a large protein gap create a classic multisystem plasma-cell-disorder pattern rather than isolated anaemia or chronic kidney disease.',
    'A substantial monoclonal IgG kappa protein with abnormal free-light-chain excess demonstrates monoclonal immunoglobulin production and strongly narrows the differential to a plasma-cell or related B-cell disorder.',
    'Marrow infiltration by 34% clonal kappa-restricted plasma cells provides the required clonal plasma-cell component; combined with attributable CRAB end-organ abnormalities, the findings meet criteria for active Multiple Myeloma.',
  ],
  keyFindings: [
    'Older adult with persistent atraumatic axial bone pain',
    'Progressive fatigue and recurrent infections',
    'Pallor and focal vertebral and rib tenderness',
    'Normocytic anaemia',
    'Hypercalcaemia',
    'Renal impairment',
    'High total protein with low albumin',
    'IgG kappa monoclonal paraprotein',
    'Markedly abnormal serum free-light-chain ratio',
    'Monoclonal urinary kappa light chains',
    '34% clonal marrow plasma cells',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Monoclonal Gammopathy of Undetermined Significance',
      whyPlausibleEarly:
        'MGUS can produce an incidental monoclonal protein in an older adult and may initially be discovered during investigation of unrelated symptoms.',
      ruledOutByClues: [
        {
          clueOrder: 3,
          evidence: 'corrected calcium is 3.02 mmol/L',
          reason:
            'Marked hypercalcaemia is a myeloma-defining end-organ abnormality when attributable to the plasma-cell disorder and is not compatible with uncomplicated MGUS.',
        },
        {
          clueOrder: 5,
          evidence: '34% clonal plasma cells',
          reason:
            'MGUS requires a substantially lower marrow clonal plasma-cell burden and no myeloma-defining end-organ damage.',
        },
      ],
      finalReasonLessLikely:
        'The combination of major clonal marrow involvement and attributable CRAB abnormalities excludes uncomplicated MGUS.',
    },
    {
      diagnosis: 'Smoldering Multiple Myeloma',
      whyPlausibleEarly:
        'Smoldering disease can have a substantial monoclonal protein and 10% or more clonal marrow plasma cells without symptoms.',
      ruledOutByClues: [
        {
          clueOrder: 3,
          evidence: 'Haemoglobin is 8.6 g/dL',
          reason:
            'Anaemia below the myeloma CRAB threshold, when attributable to the plasma-cell disorder, is a myeloma-defining event rather than smoldering disease.',
        },
        {
          clueOrder: 3,
          evidence: 'creatinine is 226 micromol/L',
          reason:
            'Significant renal impairment attributable to the plasma-cell process supports active myeloma rather than an asymptomatic precursor state.',
        },
      ],
      finalReasonLessLikely:
        'The patient has attributable end-organ damage, so the illness is active rather than smoldering.',
    },
    {
      diagnosis: 'Waldenström Macroglobulinemia',
      whyPlausibleEarly:
        'Waldenström macroglobulinemia can cause constitutional symptoms, anaemia, recurrent infections, renal problems, and a monoclonal protein.',
      ruledOutByClues: [
        {
          clueOrder: 4,
          evidence: 'Immunofixation identifies an IgG kappa paraprotein',
          reason:
            'Waldenström macroglobulinemia characteristically produces an IgM monoclonal protein rather than an IgG paraprotein.',
        },
        {
          clueOrder: 5,
          evidence: '34% clonal plasma cells',
          reason:
            'The marrow is dominated by a clonal plasma-cell process rather than the lymphoplasmacytic lymphoma pattern expected in Waldenström macroglobulinemia.',
        },
      ],
      finalReasonLessLikely:
        'The immunoglobulin isotype and plasma-cell marrow phenotype favor a plasma-cell myeloma over lymphoplasmacytic lymphoma.',
    },
    {
      diagnosis: 'Metastatic Bone Disease',
      whyPlausibleEarly:
        'Persistent axial bone pain, anaemia, hypercalcaemia, and focal bony tenderness can occur with metastatic solid-organ cancer.',
      ruledOutByClues: [
        {
          clueOrder: 4,
          evidence: '42 g/L monoclonal band',
          reason:
            'A large monoclonal immunoglobulin band indicates a clonal immunoglobulin-producing disorder rather than typical metastatic carcinoma.',
        },
        {
          clueOrder: 5,
          evidence: 'There is no metastatic carcinoma in the trephine',
          reason:
            'Marrow histology identifies clonal plasma cells and does not show metastatic epithelial malignancy.',
        },
      ],
      finalReasonLessLikely:
        'The monoclonal protein and marrow plasma-cell clone directly identify a haematologic plasma-cell malignancy.',
    },
    {
      diagnosis: 'Primary Hyperparathyroidism',
      whyPlausibleEarly:
        'Hypercalcaemia can cause constipation, thirst, fatigue, renal dysfunction, and musculoskeletal symptoms.',
      ruledOutByClues: [
        {
          clueOrder: 4,
          evidence: 'IgG kappa paraprotein',
          reason:
            'A large monoclonal immunoglobulin is not explained by primary hyperparathyroidism.',
        },
        {
          clueOrder: 5,
          evidence: '34% clonal plasma cells',
          reason:
            'Marked clonal plasma-cell marrow infiltration identifies a separate malignant process that explains the broader syndrome.',
        },
      ],
      finalReasonLessLikely:
        'Primary hyperparathyroidism cannot account for the monoclonal protein, clonal marrow plasma cells, and anaemia pattern.',
    },
    {
      diagnosis: 'Chronic Kidney Disease',
      whyPlausibleEarly:
        'Chronic kidney disease can cause normocytic anaemia, fatigue, and secondary disturbances in mineral metabolism.',
      ruledOutByClues: [
        {
          clueOrder: 3,
          evidence: 'total protein is 105 g/L',
          reason:
            'A marked protein gap should trigger evaluation for a monoclonal gammopathy rather than attributing all abnormalities to kidney disease.',
        },
        {
          clueOrder: 4,
          evidence: 'Urine immunofixation detects monoclonal kappa light chains',
          reason:
            'Monoclonal urinary light chains identify a clonal protein disorder and may directly contribute to renal injury.',
        },
      ],
      finalReasonLessLikely:
        'Renal dysfunction is part of the plasma-cell disorder rather than a complete explanation for the monoclonal protein and marrow findings.',
    },
  ],
  clueBreakdown: clues.map((clue) => {
    const breakdown = [
      {
        explanation:
          'Persistent atraumatic back and rib pain in an older adult raises the pre-test probability of malignant or infiltrative skeletal disease.',
        diagnosticContribution:
          'Introduces a chronic axial skeletal syndrome that should not be dismissed as simple mechanical pain.',
      },
      {
        explanation:
          'Fatigue and recurrent infections suggest marrow or immune dysfunction, while thirst and constipation are compatible with hypercalcaemia.',
        diagnosticContribution:
          'Broadens the problem from isolated bone pain to a multisystem disorder.',
      },
      {
        explanation:
          'Pallor supports anaemia, and focal axial bony tenderness supports a skeletal or marrow process rather than diffuse muscular pain.',
        diagnosticContribution:
          'Adds physical evidence of marrow failure and bone involvement while documenting the absence of cord-compression findings.',
      },
      {
        explanation:
          'Anaemia, hypercalcaemia, renal impairment, and a large protein gap form a highly informative CRAB-plus-paraprotein pattern.',
        diagnosticContribution:
          'Creates the decisive multisystem pattern that should trigger urgent evaluation for a plasma-cell disorder.',
      },
      {
        explanation:
          'SPEP, immunofixation, serum free light chains, and urine immunofixation establish monoclonal IgG kappa protein production.',
        diagnosticContribution:
          'Narrows the differential from many causes of CRAB abnormalities to a clonal plasma-cell or related B-cell disorder.',
      },
      {
        explanation:
          'Bone-marrow examination confirms a substantial clonal plasma-cell population; together with attributable CRAB abnormalities this meets active myeloma criteria.',
        diagnosticContribution:
          'Provides the clonal marrow criterion and completes the diagnostic framework.',
      },
    ][clue.order];

    return {
      clueOrder: clue.order,
      clueType: clue.type,
      clue: clue.value,
      explanation: breakdown.explanation,
      diagnosticContribution: breakdown.diagnosticContribution,
    };
  }),
  clinicalPearl:
    'Do not treat anaemia, renal impairment, hypercalcaemia, and bone pain as unrelated problems in an older adult; the combination with a protein gap should immediately prompt monoclonal-protein testing.',
  managementPearl:
    'Active myeloma with hypercalcaemia or renal impairment needs prompt haematology involvement, correction of reversible organ complications, avoidance of nephrotoxins, and specialist-directed disease therapy.',
  generationQuality: {
    contentTier: 'FLAGSHIP',
    seedVersion,
    humanReviewed: true,
    discriminatorStrength: 'HIGH',
    expectedTeachingPoints: [
      'Recognize the CRAB end-organ injury pattern',
      'Use the protein gap as a clue to monoclonal gammopathy',
      'Distinguish MGUS and smoldering myeloma from active disease',
      'Interpret SPEP, immunofixation, and serum free light chains together',
      'Require clonal plasma cells or plasmacytoma plus a myeloma-defining event for active myeloma',
      'Do not delay treatment of hypercalcaemia, renal injury, or spinal cord compression while completing staging',
    ],
    competencyDomains: [
      'Hematology',
      'Internal Medicine',
      'Oncology',
      'Nephrology',
      'Clinical Reasoning',
    ],
  },
};

const educationForFrontend = {
  title: displayLabel,
  summary: {
    definition:
      'Multiple Myeloma is a clonal plasma-cell malignancy characterized by monoclonal immunoglobulin production and marrow infiltration, with active disease defined by clonal marrow plasma cells or plasmacytoma plus at least one myeloma-defining event.',
    highYieldTakeaway:
      'Think active myeloma when an older adult has otherwise unexplained bone pain, anaemia, renal impairment, hypercalcaemia, or recurrent infection together with a monoclonal protein or other evidence of a plasma-cell clone.',
  },
  recognitionPattern: [
    {
      pattern: 'CRAB abnormalities occurring together',
      whyItMatters:
        'Hypercalcaemia, renal impairment, anaemia, and bone lesions are classic manifestations of end-organ injury from a plasma-cell disorder.',
      progression:
        'Clonal plasma-cell expansion -> monoclonal protein and marrow replacement -> anaemia, renal injury, hypercalcaemia, skeletal damage, and infection risk.',
      discriminator:
        'Several CRAB abnormalities in one patient are much more informative than any single abnormality in isolation.',
      commonTrap:
        'Do not attribute anaemia to age, renal impairment to dehydration, and bone pain to degeneration without first asking whether one unifying disorder explains all three.',
    },
    {
      pattern: 'Protein gap plus monoclonal protein',
      whyItMatters:
        'A high total protein with relatively low albumin suggests excess globulin and should prompt serum protein electrophoresis and immunofixation.',
      progression:
        'Protein gap -> monoclonal band -> immunoglobulin typing -> serum free-light-chain assessment -> marrow confirmation.',
      discriminator:
        'A monoclonal band separates plasma-cell and related B-cell disorders from most metabolic causes of hypercalcaemia or anaemia.',
      commonTrap:
        'A normal total protein does not exclude light-chain myeloma, so serum free-light-chain testing still matters when suspicion remains high.',
    },
    {
      pattern: 'Clonal plasma cells plus a myeloma-defining event',
      whyItMatters:
        'The diagnosis of active myeloma is not based on the M-protein alone; it requires a qualifying clonal plasma-cell process plus CRAB damage or a validated SLiM biomarker.',
      progression:
        'Identify clone -> determine marrow burden -> assess CRAB and SLiM biomarkers -> classify as MGUS, smoldering disease, or active myeloma.',
      discriminator:
        'End-organ injury or a myeloma-defining biomarker separates active myeloma from precursor monoclonal gammopathies.',
      commonTrap:
        'Do not call every monoclonal gammopathy “myeloma”; MGUS and smoldering disease have different thresholds and management.',
    },
  ],
  keySymptoms: [
    {
      symptom: 'Persistent axial bone pain',
      significance:
        'Vertebral, rib, pelvic, or skull pain may reflect osteolytic bone disease or vertebral compression.',
      whyItMatters:
        'Bone disease is a major source of morbidity and may be the presenting symptom.',
      discriminator:
        'Persistent atraumatic pain, especially with anaemia or hypercalcaemia, is more concerning than isolated mechanical back pain.',
    },
    {
      symptom: 'Fatigue and reduced exercise tolerance',
      significance:
        'Commonly reflects anaemia from marrow replacement, renal dysfunction, chronic inflammation, or a combination of these factors.',
      whyItMatters:
        'A nonspecific symptom becomes diagnostically useful when linked to objective anaemia and other CRAB features.',
      discriminator:
        'Fatigue with a protein gap and bone pain should prompt a unifying haematologic evaluation.',
    },
    {
      symptom: 'Recurrent infection',
      significance:
        'Suppression of normal immunoglobulin production and treatment-related immune dysfunction increase infection susceptibility.',
      whyItMatters:
        'Recurrent respiratory or other infections may be an early clue to impaired humoral immunity.',
      discriminator:
        'Repeated infection alongside monoclonal protein and marrow abnormalities supports clinically significant plasma-cell disease.',
    },
    {
      symptom: 'Constipation and thirst',
      significance:
        'These may reflect symptomatic hypercalcaemia with dehydration and renal stress.',
      whyItMatters:
        'Hypercalcaemia is both a diagnostic clue and an organ complication requiring prompt correction.',
      discriminator:
        'When hypercalcaemia occurs with anaemia, renal impairment, and monoclonal protein, a plasma-cell disorder is much more likely than isolated metabolic disease.',
    },
  ],
  keySigns: [
    {
      finding: 'Pallor',
      mechanism:
        'Marrow infiltration, reduced erythropoietin from renal dysfunction, and chronic disease reduce effective red-cell production.',
      significance:
        'Provides a visible bedside correlate of clinically important anaemia.',
      diagnosticImpact:
        'Supports marrow or systemic disease when paired with low haemoglobin and other CRAB abnormalities.',
      discriminator:
        'Pallor is nonspecific alone, but in a patient with bone pain and a monoclonal protein it reinforces the marrow-failure pattern.',
      trapAvoided:
        'Do not assume anaemia in an older adult is nutritional without examining the full blood count and systemic context.',
    },
    {
      finding: 'Focal vertebral or rib tenderness',
      mechanism:
        'Myeloma cells stimulate osteoclast activity and suppress normal osteoblast function, producing focal bone destruction and structural weakness.',
      significance:
        'Localizes symptoms to bone and raises concern for osteolytic lesions or pathological fracture.',
      diagnosticImpact:
        'Increases the probability of clinically significant skeletal involvement when combined with monoclonal gammopathy.',
      discriminator:
        'Focal bony tenderness is more concerning for structural bone disease than diffuse muscular tenderness.',
      trapAvoided:
        'Do not repeatedly label persistent focal skeletal pain as degenerative pain without appropriate bone imaging.',
    },
    {
      finding: 'No lymphadenopathy or hepatosplenomegaly',
      mechanism:
        'Classic myeloma is primarily a marrow and bone disease rather than a lymph-node-predominant malignancy.',
      significance:
        'The absence of bulky nodal or splenic disease makes some lymphomas and lymphoplasmacytic disorders less typical.',
      diagnosticImpact:
        'Modestly supports a plasma-cell-predominant process but does not establish the diagnosis.',
      discriminator:
        'Prominent lymphadenopathy or splenomegaly would increase consideration of lymphoma or Waldenström macroglobulinemia.',
      trapAvoided:
        'Do not exclude myeloma because there is no palpable mass or lymphadenopathy.',
    },
    {
      finding: 'Normal lower-limb neurology despite vertebral pain',
      mechanism:
        'Bone pain can precede vertebral collapse or epidural extension severe enough to compress neural structures.',
      significance:
        'Documents the current absence of cord-compression signs while establishing a baseline neurologic examination.',
      diagnosticImpact:
        'Does not reduce concern for myeloma itself but helps assess immediate spinal complications.',
      discriminator:
        'New weakness, sensory level, saddle symptoms, or sphincter dysfunction would shift the problem toward an oncologic spinal emergency.',
      trapAvoided:
        'Do not interpret a normal neurologic examination as evidence that persistent vertebral pain is benign.',
    },
  ],
  examPearls: [
    {
      type: 'DISCRIMINATOR',
      title: 'The protein gap is a reasoning clue',
      content:
        'Compare total protein with albumin. A large gap suggests increased globulins and should prompt evaluation for monoclonal immunoglobulin production.',
      whyItMatters:
        'It links otherwise separate findings such as anaemia, renal impairment, bone pain, and hypercalcaemia.',
      discriminator:
        'A major protein gap is not explained by primary hyperparathyroidism or uncomplicated mechanical back pain.',
      managementImplication:
        'Order serum protein electrophoresis, immunofixation, and serum free-light-chain testing when clinical suspicion is appropriate.',
      trapAvoided:
        'Do not rely on total protein alone because light-chain myeloma may occur without marked hyperproteinaemia.',
    },
    {
      type: 'MECHANISM',
      title: 'Why renal impairment occurs',
      content:
        'Filtered monoclonal free light chains can injure renal tubules and form obstructing casts; dehydration, hypercalcaemia, infection, and nephrotoxic medication can worsen the injury.',
      whyItMatters:
        'Renal dysfunction can progress rapidly but may improve when precipitating factors and the plasma-cell disorder are treated promptly.',
      discriminator:
        'Monoclonal light chains plus renal impairment strongly support a plasma-cell-related kidney process over uncomplicated age-related CKD.',
      escalationImplication:
        'Severe or worsening renal injury requires urgent haematology and renal assessment and avoidance of further nephrotoxins.',
      trapAvoided:
        'Do not delay myeloma-directed evaluation by assuming renal impairment is unrelated chronic kidney disease.',
    },
    {
      type: 'DISCRIMINATOR',
      title: 'Active myeloma versus precursor disease',
      content:
        'MGUS and smoldering myeloma can have monoclonal protein without myeloma-defining organ damage. Active myeloma requires qualifying clonal plasma cells or plasmacytoma plus at least one myeloma-defining event.',
      whyItMatters:
        'The distinction determines whether treatment is indicated rather than observation alone.',
      discriminator:
        'Attributable CRAB injury or a validated SLiM biomarker moves the patient into active disease.',
      managementImplication:
        'Do not start or withhold therapy based on M-protein size alone; classify the disease using the full diagnostic framework.',
      trapAvoided:
        'Do not call an incidental paraprotein active myeloma without proving a qualifying clone and a myeloma-defining event.',
    },
  ],
  scoringSystems: [
    {
      name: 'Revised International Staging System (R-ISS)',
      purpose:
        'Provides prognostic staging after diagnosis using serum beta-2 microglobulin, albumin, LDH, and high-risk cytogenetic features.',
      interpretation:
        'R-ISS stage contributes to prognosis and treatment planning but is separate from the criteria used to diagnose active myeloma.',
      limitation:
        'It is a staging system, not a diagnostic test; it should not be used to decide whether a monoclonal gammopathy meets active-myeloma criteria.',
    },
  ],
  investigations: [
    {
      test: 'Full blood count and blood film',
      expectedFinding:
        'Normocytic anaemia is common; rouleaux may be seen, while leukopenia or thrombocytopenia can occur with advanced marrow involvement.',
      interpretation:
        'Anaemia may represent myeloma-related marrow replacement or renal disease after other causes are considered.',
      whyItMatters:
        'Haemoglobin is part of the CRAB assessment and helps define disease burden and treatment urgency.',
      managementImplication:
        'Severe or symptomatic cytopenias require prompt supportive assessment while the underlying plasma-cell disorder is treated.',
      commonTrap:
        'Do not attribute normocytic anaemia to ageing or CKD without considering a monoclonal process when other clues are present.',
    },
    {
      test: 'Calcium, creatinine, eGFR, electrolytes, total protein and albumin',
      expectedFinding:
        'Hypercalcaemia, renal impairment, and a protein gap may be present.',
      interpretation:
        'Calcium and renal function assess CRAB end-organ injury, while the protein gap can suggest excess immunoglobulin.',
      whyItMatters:
        'These routine tests often provide the first unifying clue before specialized haematology testing.',
      managementImplication:
        'Marked hypercalcaemia, renal impairment, dehydration, or electrolyte disturbance requires prompt correction and specialist escalation.',
      commonTrap:
        'Correct calcium for albumin or use ionized calcium when appropriate; do not overlook a large globulin gap.',
    },
    {
      test: 'Serum protein electrophoresis and immunofixation',
      expectedFinding:
        'A monoclonal band may be present and immunofixation identifies the immunoglobulin heavy- and light-chain type.',
      interpretation:
        'A monoclonal protein supports a clonal plasma-cell or B-cell disorder but does not by itself distinguish MGUS, smoldering myeloma, and active myeloma.',
      whyItMatters:
        'Defines and quantifies the serum M-protein for diagnosis and subsequent response assessment.',
      managementImplication:
        'Pair with serum free light chains, urine testing when indicated, marrow assessment, and myeloma-defining-event evaluation.',
      commonTrap:
        'A negative SPEP does not exclude light-chain or nonsecretory disease.',
    },
    {
      test: 'Serum free-light-chain assay',
      expectedFinding:
        'The involved light chain is elevated with an abnormal involved-to-uninvolved ratio.',
      interpretation:
        'The assay identifies light-chain excess and can itself satisfy a SLiM biomarker threshold when the involved-to-uninvolved ratio is at least 100 and the involved light chain is sufficiently elevated under current criteria.',
      whyItMatters:
        'Especially useful in light-chain disease and in patients with renal injury or a small/absent M-spike.',
      managementImplication:
        'Interpret the ratio with renal function and the rest of the monoclonal-protein workup rather than in isolation.',
      commonTrap:
        'Kidney disease can alter free-light-chain concentrations; abnormal values must be interpreted in clinical context.',
    },
    {
      test: 'Bone-marrow aspirate and trephine biopsy with flow cytometry/immunophenotyping',
      expectedFinding:
        'Clonal plasma-cell infiltration with light-chain restriction; percentage marrow involvement is quantified.',
      interpretation:
        'At least 10% clonal marrow plasma cells, or a biopsy-proven plasmacytoma, is generally required as the clonal component of active myeloma diagnosis.',
      whyItMatters:
        'Confirms the plasma-cell clone and provides material for cytogenetic risk assessment.',
      managementImplication:
        'Obtain cytogenetic/FISH risk data and integrate the marrow result with CRAB/SLiM myeloma-defining events.',
      commonTrap:
        'Marrow plasma-cell percentage alone does not distinguish smoldering from active myeloma unless it reaches a myeloma-defining biomarker threshold or another defining event is present.',
    },
    {
      test: 'Whole-body low-dose CT, PET/CT, or MRI as clinically appropriate',
      expectedFinding:
        'One or more osteolytic lesions may be seen on CT/PET-CT; MRI can identify focal marrow lesions and spinal complications.',
      interpretation:
        'Bone imaging identifies myeloma-related skeletal disease and may itself provide a myeloma-defining event depending on the modality and findings.',
      whyItMatters:
        'Plain radiographs can miss clinically important disease; modern cross-sectional imaging improves detection and complication assessment.',
      managementImplication:
        'Urgently image symptomatic spine disease when fracture, instability, or cord compression is possible.',
      commonTrap:
        'Increased PET uptake without corresponding osteolytic destruction is not equivalent to a qualifying lytic lesion under IMWG criteria.',
    },
  ],
  managementOverview: [
    {
      action: 'Arrange prompt haematology assessment for active disease',
      indication:
        'Confirmed or strongly suspected active myeloma, particularly with anaemia, renal impairment, hypercalcaemia, or significant skeletal symptoms.',
      rationale:
        'Treatment selection depends on disease biology, transplant eligibility, frailty, comorbidities, renal function, and patient goals.',
      nextStep:
        'Complete baseline staging, cytogenetic risk assessment, organ-complication assessment, and specialist-directed treatment planning.',
      escalationImplication:
        'Severe hypercalcaemia, rapidly worsening renal function, sepsis, pathological fracture, or neurologic compromise requires urgent inpatient management.',
    },
    {
      action: 'Treat hypercalcaemia and volume depletion promptly',
      indication:
        'Symptomatic or marked hypercalcaemia, dehydration, or associated renal dysfunction.',
      rationale:
        'Hypercalcaemia worsens dehydration, confusion, constipation, renal injury, and cardiac risk.',
      nextStep:
        'Use monitored supportive management and bone-targeted therapy according to renal function and local specialist protocols.',
      escalationImplication:
        'Severe symptoms, arrhythmia, altered consciousness, or refractory calcium elevation warrant emergency escalation.',
    },
    {
      action: 'Protect renal function',
      indication:
        'Renal impairment, free-light-chain excess, dehydration, hypercalcaemia, or suspected cast nephropathy.',
      rationale:
        'Renal recovery is more likely when reversible contributors and the plasma-cell burden are addressed early.',
      nextStep:
        'Maintain appropriate hydration, stop avoidable nephrotoxins, review contrast exposure, and involve renal specialists when injury is severe or progressive.',
      escalationImplication:
        'Oliguria, refractory electrolyte disturbance, severe acidosis, or progressive kidney failure requires urgent nephrology input.',
    },
    {
      action: 'Start specialist-directed anti-myeloma therapy',
      indication:
        'Active myeloma meeting accepted diagnostic criteria.',
      rationale:
        'Systemic therapy suppresses the malignant plasma-cell clone, reduces monoclonal protein production, and prevents further organ injury.',
      nextStep:
        'Select regimen and transplant strategy through haematology based on fitness, renal function, cytogenetics, frailty, and local protocol.',
      escalationImplication:
        'Rapid organ deterioration may require expedited treatment before every elective staging component is complete.',
    },
    {
      action: 'Prevent and treat skeletal complications',
      indication:
        'Bone pain, lytic lesions, osteoporosis, vertebral compression, or fracture risk.',
      rationale:
        'Myeloma bone disease causes pain, fracture, immobility, and hypercalcaemia.',
      nextStep:
        'Use appropriate bone-targeted therapy, analgesia, dental review, and orthopaedic/radiotherapy input when indicated.',
      escalationImplication:
        'New weakness, sensory loss, saddle symptoms, or sphincter disturbance requires immediate assessment for spinal cord compression.',
    },
    {
      action: 'Address infection risk and supportive care',
      indication:
        'Recurrent infection, immunoparesis, cytopenias, or treatment-related immune suppression.',
      rationale:
        'Infection is an important cause of morbidity in myeloma because normal humoral immunity is impaired.',
      nextStep:
        'Use vaccination, antimicrobial prevention when indicated, prompt infection assessment, thrombosis prevention where relevant, and supportive transfusion strategies according to specialist protocols.',
      escalationImplication:
        'Suspected sepsis or severe infection requires immediate acute-care management.',
    },
  ],
  differentialDistinguishers: [
    {
      diagnosis: 'Monoclonal Gammopathy of Undetermined Significance',
      whyConfused:
        'MGUS produces a monoclonal protein and is common in older adults.',
      distinguishingPoint:
        'MGUS has a low clonal marrow plasma-cell burden and no myeloma-defining CRAB or SLiM event attributable to the clone.',
      keySeparator:
        'Attributable end-organ injury or qualifying myeloma-defining biomarkers move the diagnosis beyond MGUS.',
      classicTrap:
        'Calling every paraprotein myeloma or, conversely, dismissing a paraprotein as MGUS before checking marrow burden and organ damage.',
      managementConsequence:
        'MGUS usually requires risk-based observation rather than immediate anti-myeloma therapy.',
    },
    {
      diagnosis: 'Smoldering Multiple Myeloma',
      whyConfused:
        'Smoldering myeloma can have a substantial M-protein and at least 10% clonal marrow plasma cells.',
      distinguishingPoint:
        'Smoldering disease lacks attributable CRAB end-organ damage and lacks a qualifying SLiM myeloma-defining biomarker.',
      keySeparator:
        'Anaemia, renal impairment, hypercalcaemia, lytic lesions, or an accepted SLiM biomarker attributable to the clone establishes active disease.',
      classicTrap:
        'Using M-protein size alone to decide that a patient needs treatment.',
      managementConsequence:
        'The distinction determines observation versus active treatment and should be made using formal criteria.',
    },
    {
      diagnosis: 'Waldenström Macroglobulinemia',
      whyConfused:
        'Both may cause anaemia, renal dysfunction, infection susceptibility, and monoclonal immunoglobulin production.',
      distinguishingPoint:
        'Waldenström macroglobulinemia is an IgM-producing lymphoplasmacytic lymphoma and more often causes hyperviscosity, lymphadenopathy, or splenomegaly.',
      keySeparator:
        'IgM plus lymphoplasmacytic marrow disease favors Waldenström; a plasma-cell clone with IgG/IgA or light-chain disease and CRAB features favors myeloma.',
      classicTrap:
        'Assuming every monoclonal gammopathy in an older adult is a plasma-cell myeloma.',
      managementConsequence:
        'Treatment regimens and urgency may differ substantially, especially when IgM hyperviscosity is present.',
    },
    {
      diagnosis: 'Metastatic Bone Disease',
      whyConfused:
        'Metastatic solid-organ malignancy can cause focal bone pain, pathological fractures, anaemia, and hypercalcaemia.',
      distinguishingPoint:
        'Metastases are supported by a primary solid tumor, epithelial malignant cells, or a metastatic imaging pattern rather than a clonal immunoglobulin-producing plasma-cell process.',
      keySeparator:
        'A monoclonal protein plus clonal marrow plasma cells strongly favors a plasma-cell malignancy.',
      classicTrap:
        'Assuming all destructive bone disease in an older adult is metastatic carcinoma before checking for monoclonal gammopathy.',
      managementConsequence:
        'The oncologic workup, systemic treatment, and bone-directed therapy depend on identifying the correct malignant lineage.',
    },
    {
      diagnosis: 'Primary Hyperparathyroidism',
      whyConfused:
        'Primary hyperparathyroidism causes hypercalcaemia, constipation, thirst, kidney problems, and skeletal symptoms.',
      distinguishingPoint:
        'It is characterized by inappropriate parathyroid-hormone elevation and does not explain a monoclonal protein or clonal marrow plasma-cell population.',
      keySeparator:
        'PTH-mediated hypercalcaemia favors hyperparathyroidism; monoclonal gammopathy with marrow plasma cells and CRAB features favors myeloma.',
      classicTrap:
        'Stopping the workup after finding hypercalcaemia without asking whether anaemia, renal injury, and protein abnormalities need one unifying diagnosis.',
      managementConsequence:
        'The hypercalcaemia pathway and definitive treatment differ, so PTH should be interpreted alongside the broader clinical picture.',
    },
    {
      diagnosis: 'Chronic Kidney Disease',
      whyConfused:
        'CKD commonly causes normocytic anaemia, fatigue, and mineral abnormalities.',
      distinguishingPoint:
        'CKD alone does not explain a large monoclonal protein, urinary monoclonal light chains, or substantial clonal marrow plasma cells.',
      keySeparator:
        'Monoclonal protein studies and marrow findings distinguish a plasma-cell process from isolated CKD.',
      classicTrap:
        'Attributing all anaemia and renal impairment to pre-existing CKD without checking for a new monoclonal process.',
      managementConsequence:
        'Recognizing myeloma-related renal injury may change urgency and can make renal recovery dependent on rapid control of the plasma-cell disorder.',
    },
  ],
  complications: [
    {
      complication: 'Pathological fracture and vertebral collapse',
      whyItMatters:
        'Osteolytic disease weakens bone and can cause severe pain, immobility, and deformity.',
    },
    {
      complication: 'Spinal cord or cauda equina compression',
      whyItMatters:
        'Vertebral collapse or epidural disease can cause irreversible neurologic injury if not recognized urgently.',
    },
    {
      complication: 'Acute or progressive kidney injury',
      whyItMatters:
        'Light-chain cast nephropathy, hypercalcaemia, dehydration, infection, and nephrotoxins can all reduce renal function.',
    },
    {
      complication: 'Severe infection',
      whyItMatters:
        'Immunoparesis and treatment-related immune suppression increase susceptibility to serious infection.',
    },
    {
      complication: 'Hypercalcaemic crisis',
      whyItMatters:
        'Severe calcium elevation can cause dehydration, encephalopathy, arrhythmia, and worsening renal failure.',
    },
    {
      complication: 'Cytopenias',
      whyItMatters:
        'Increasing marrow replacement or treatment can produce anaemia, thrombocytopenia, and leukopenia.',
    },
  ],
  pitfalls: [
    {
      pitfall: 'Diagnosing from the M-spike alone',
      consequence:
        'MGUS and smoldering myeloma can also produce monoclonal proteins, so the patient may be overdiagnosed and treated unnecessarily.',
      saferHeuristic:
        'Require the clonal plasma-cell component plus an accepted myeloma-defining event before labeling active disease.',
    },
    {
      pitfall: 'Treating CRAB findings as unrelated chronic problems',
      consequence:
        'Anaemia, renal impairment, hypercalcaemia, and bone pain may be investigated separately and the unifying plasma-cell disorder missed.',
      saferHeuristic:
        'When two or more CRAB features coexist, actively look for a monoclonal protein and marrow disorder.',
    },
    {
      pitfall: 'Using a normal SPEP to exclude myeloma',
      consequence:
        'Light-chain or nonsecretory disease may have little or no conventional serum M-spike.',
      saferHeuristic:
        'Use serum free-light-chain testing and immunofixation when clinical suspicion remains high.',
    },
    {
      pitfall: 'Missing spinal cord compression',
      consequence:
        'Persistent vertebral pain can progress to neurologic compromise and permanent disability.',
      saferHeuristic:
        'Ask about weakness, sensory change, saddle symptoms, and bladder/bowel dysfunction at every assessment and urgently image new neurologic red flags.',
    },
    {
      pitfall: 'Ignoring renal context when interpreting free light chains',
      consequence:
        'Renal impairment can alter free-light-chain concentrations and ratios, creating diagnostic confusion.',
      saferHeuristic:
        'Interpret free light chains with renal function, immunofixation, marrow findings, and the complete diagnostic criteria.',
    },
  ],
  recallPrompts: [
    {
      type: 'PEARL_RECALL',
      prompt: 'What does CRAB represent in the diagnostic evaluation of plasma-cell myeloma?',
      answer: 'Hypercalcaemia, renal impairment, anaemia, and bone lesions.',
      explanation:
        'These are classic myeloma-related end-organ abnormalities and may qualify as myeloma-defining events when attributable to the plasma-cell disorder.',
      linkedConcept: 'CRAB end-organ injury',
      sourceSection: 'Clinical Pattern',
    },
    {
      type: 'DISTINGUISH',
      prompt: 'What separates smoldering myeloma from active myeloma?',
      answer:
        'Active myeloma has at least one qualifying myeloma-defining event, such as attributable CRAB injury or an accepted SLiM biomarker.',
      explanation:
        'Both conditions can have substantial marrow plasma cells and monoclonal protein, so organ damage and validated biomarkers determine activity.',
      linkedConcept: 'Smoldering versus active disease',
      sourceSection: 'Differentials',
    },
    {
      type: 'SHORT_ANSWER',
      prompt: 'What three tests should be combined to characterize a suspected monoclonal serum protein?',
      answer:
        'Serum protein electrophoresis, immunofixation, and serum free-light-chain testing.',
      explanation:
        'Together they identify and type monoclonal protein and improve detection of light-chain-predominant disease.',
      linkedConcept: 'Monoclonal protein workup',
      sourceSection: 'Investigations',
    },
    {
      type: 'WHY_IT_MATTERS',
      prompt: 'Why can multiple myeloma cause renal impairment?',
      answer:
        'Monoclonal free light chains can cause cast nephropathy, while hypercalcaemia, dehydration, infection, and nephrotoxins can worsen kidney injury.',
      explanation:
        'Recognizing reversible contributors and controlling the plasma-cell clone quickly can improve renal outcomes.',
      linkedConcept: 'Myeloma kidney injury',
      sourceSection: 'Exam Pearls',
    },
    {
      type: 'DISTINGUISH',
      prompt: 'Which immunoglobulin pattern makes Waldenström macroglobulinemia more likely than typical myeloma?',
      answer: 'An IgM monoclonal protein with lymphoplasmacytic marrow disease.',
      explanation:
        'Waldenström macroglobulinemia is an IgM-producing lymphoplasmacytic lymphoma, whereas myeloma is a clonal plasma-cell disorder.',
      linkedConcept: 'Plasma-cell versus lymphoplasmacytic disease',
      sourceSection: 'Differentials',
    },
    {
      type: 'PEARL_RECALL',
      prompt: 'What neurologic symptoms make vertebral myeloma an emergency?',
      answer:
        'New weakness, sensory loss, saddle symptoms, or bladder/bowel dysfunction suggesting spinal cord or cauda equina compression.',
      explanation:
        'Neurologic compromise from vertebral collapse or epidural disease requires urgent imaging and specialist management.',
      linkedConcept: 'Spinal cord compression',
      sourceSection: 'Complications',
    },
  ],
  references: [
    {
      citation:
        'International Myeloma Working Group diagnostic criteria for Multiple Myeloma and related plasma-cell disorders.',
    },
    {
      citation:
        'International Myeloma Foundation. Multiple Myeloma Diagnostic Criteria and SLiM-CRAB framework.',
    },
    {
      citation:
        'Rajkumar SV. Multiple Myeloma: 2024 update on diagnosis, risk-stratification and management.',
    },
  ],
};

function assertSeedShape(): void {
  const allowedClueTypes = new Set([
    'history',
    'symptom',
    'vital',
    'lab',
    'exam',
    'imaging',
  ]);

  if (clues.length !== 6) {
    throw new Error(`Expected exactly 6 clues; found ${clues.length}.`);
  }

  clues.forEach((clue, index) => {
    if (clue.order !== index) {
      throw new Error(`Clue order mismatch at index ${index}: found ${clue.order}.`);
    }

    if (!allowedClueTypes.has(clue.type)) {
      throw new Error(`Unsupported clue type at order ${clue.order}: ${clue.type}.`);
    }

    if (!clue.value.trim()) {
      throw new Error(`Empty clue value at order ${clue.order}.`);
    }
  });

  const earlyText = clues
    .filter((clue) => clue.order < 5)
    .map((clue) => normalizeClinicalText(clue.value))
    .join(' ');

  for (const phrase of [canonicalName, displayLabel]) {
    const normalized = normalizeClinicalText(phrase);
    if (earlyText.includes(normalized)) {
      throw new Error(`Diagnosis leakage before final clue: ${phrase}.`);
    }
  }

  if (explanation.clueBreakdown.length !== clues.length) {
    throw new Error('Clue breakdown length does not match clue count.');
  }

  explanation.clueBreakdown.forEach((entry, index) => {
    const clue = clues[index];

    if (
      entry.clueOrder !== clue.order ||
      entry.clueType !== clue.type ||
      entry.clue !== clue.value
    ) {
      throw new Error(`Clue breakdown mismatch at clue ${index}.`);
    }
  });

  explanation.differentialAnalysis.forEach((differential) => {
    if (!differentials.includes(differential.diagnosis)) {
      throw new Error(
        `Differential analysis is not canonical: ${differential.diagnosis}.`,
      );
    }

    differential.ruledOutByClues.forEach((evidence) => {
      const clue = clues.find((item) => item.order === evidence.clueOrder);

      if (!clue) {
        throw new Error(
          `Differential evidence references missing clue: ${differential.diagnosis} -> ${evidence.clueOrder}.`,
        );
      }

      if (!clue.value.toLowerCase().includes(evidence.evidence.toLowerCase())) {
        throw new Error(
          `Differential evidence not found: ${differential.diagnosis} -> ${evidence.evidence}`,
        );
      }
    });
  });

  if (educationForFrontend.keySigns.length < 3) {
    throw new Error('Education requires at least 3 structured key signs.');
  }

  educationForFrontend.keySigns.forEach((sign) => {
    if (
      !sign.finding ||
      !sign.mechanism ||
      !sign.diagnosticImpact ||
      !sign.discriminator
    ) {
      throw new Error(`Incomplete key sign education: ${sign.finding}.`);
    }
  });

  educationForFrontend.scoringSystems.forEach((score) => {
    if (!score.name || !score.purpose || !score.interpretation || !score.limitation) {
      throw new Error(`Incomplete scoring/staging system: ${score.name}.`);
    }
  });

  educationForFrontend.investigations.forEach((investigation) => {
    if (
      !investigation.test ||
      !investigation.expectedFinding ||
      !investigation.interpretation ||
      !investigation.managementImplication
    ) {
      throw new Error(`Incomplete investigation education: ${investigation.test}.`);
    }
  });

  educationForFrontend.differentialDistinguishers.forEach((differential) => {
    if (
      !differential.diagnosis ||
      !differential.whyConfused ||
      !differential.keySeparator ||
      !differential.classicTrap ||
      !differential.managementConsequence
    ) {
      throw new Error(`Incomplete differential education: ${differential.diagnosis}.`);
    }
  });

  educationForFrontend.managementOverview.forEach((item) => {
    if (!item.action || !item.indication || !item.rationale || !item.nextStep) {
      throw new Error(`Incomplete management education: ${item.action}.`);
    }
  });

  educationForFrontend.pitfalls.forEach((item) => {
    if (!item.pitfall || !item.consequence || !item.saferHeuristic) {
      throw new Error(`Incomplete pitfall education: ${item.pitfall}.`);
    }
  });

  const allowedRecallTypes = new Set([
    'CLOZE',
    'SHORT_ANSWER',
    'DISTINGUISH',
    'PEARL_RECALL',
    'WHY_IT_MATTERS',
  ]);

  educationForFrontend.recallPrompts.forEach((prompt) => {
    if (!allowedRecallTypes.has(prompt.type)) {
      throw new Error(`Unsupported recall prompt type: ${prompt.type}.`);
    }

    if (!prompt.prompt || !prompt.answer || !prompt.explanation) {
      throw new Error(`Incomplete recall prompt: ${prompt.prompt}.`);
    }
  });
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
          specialty: 'Hematology',
          subspecialty: 'Plasma Cell Disorders',
          category: 'Plasma Cell Neoplasm',
          bodySystem: 'Hematologic',
          organSystem: 'Bone Marrow and Plasma Cells',
          difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
          rarityBand: DiagnosisRarityBand.UNCOMMON,
          clinicalSetting: DiagnosisClinicalSetting.INPATIENT,
          ageGroup: DiagnosisAgeGroup.GERIATRIC,
          urgencyLevel: DiagnosisUrgencyLevel.URGENT,
          preferredClueTypes: ['history', 'symptom', 'exam', 'lab'],
          notes:
            'Seeded flagship Multiple Myeloma case emphasizing CRAB synthesis, monoclonal-protein interpretation, precursor-state discrimination, and marrow confirmation.',
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
          specialty: 'Hematology',
          subspecialty: 'Plasma Cell Disorders',
          category: 'Plasma Cell Neoplasm',
          bodySystem: 'Hematologic',
          organSystem: 'Bone Marrow and Plasma Cells',
          difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
          rarityBand: DiagnosisRarityBand.UNCOMMON,
          clinicalSetting: DiagnosisClinicalSetting.INPATIENT,
          ageGroup: DiagnosisAgeGroup.GERIATRIC,
          urgencyLevel: DiagnosisUrgencyLevel.URGENT,
          preferredClueTypes: ['history', 'symptom', 'exam', 'lab'],
          notes:
            'Seeded flagship Multiple Myeloma case emphasizing CRAB synthesis, monoclonal-protein interpretation, precursor-state discrimination, and marrow confirmation.',
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
    console.log('Skipped existing Multiple Myeloma education:', existing);
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

async function ensureValidationRun(params: {
  caseId: string;
  revisionId: string;
}): Promise<void> {
  const existing = await prisma.caseValidationRun.findFirst({
    where: {
      caseId: params.caseId,
      revisionId: params.revisionId,
      validatorVersion: `flagship-human-review:${seedVersion}`,
    },
    select: { id: true },
  });

  if (existing) return;

  await prisma.caseValidationRun.create({
    data: {
      caseId: params.caseId,
      revisionId: params.revisionId,
      source: CaseSource.MANUAL,
      publishTrack: PublishTrack.DAILY,
      outcome: ValidationOutcome.PASSED,
      validatorVersion: `flagship-human-review:${seedVersion}`,
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        note:
          'Complete Multiple Myeloma flagship seed with six playable clues, exact differential evidence checks, and frontend-aligned education.',
      },
      findings: [],
      completedAt: now,
    },
  });
}

async function ensureCase(params: {
  diagnosisRegistryId: string;
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

  const scheduledCase = existingCases.find((item) => item.dailyCases.length > 0);

  if (scheduledCase) {
    console.log('Skipped existing scheduled Multiple Myeloma case:', scheduledCase);
    return;
  }

  const completeCase = existingCases.find(
    (item) => item.dailyCases.length === 0 && item.currentRevisionId,
  );

  if (completeCase?.currentRevisionId) {
    await ensureValidationRun({
      caseId: completeCase.id,
      revisionId: completeCase.currentRevisionId,
    });

    console.log('Skipped existing complete Multiple Myeloma case:', completeCase);
    return;
  }

  const reusableCase = existingCases.find(
    (item) => item.dailyCases.length === 0 && !item.currentRevisionId,
  );

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
      'Seeded complete frontend-aligned flagship Multiple Myeloma case with CRAB, monoclonal-protein, and marrow-confirmation teaching.',
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
        'Created complete Multiple Myeloma revision with frontend-aligned explanation and education.',
    },
    select: { id: true },
  });

  await prisma.case.update({
    where: { id: seededCase.id },
    data: { currentRevisionId: revision.id },
  });

  await ensureValidationRun({
    caseId: seededCase.id,
    revisionId: revision.id,
  });

  console.log('Seeded Multiple Myeloma:', {
    registryId: params.diagnosisRegistryId,
    caseId: seededCase.id,
    revisionId: revision.id,
    publicNumber,
    educationId: params.educationId,
    clueTypes: clues.map((clue) => clue.type),
  });
}

async function main() {
  assertSeedShape();
  console.log('Multiple Myeloma seed validation passed.');

  const registry = await ensureRegistry();
  const education = await ensureEducation(registry.id);

  await ensureCase({
    diagnosisRegistryId: registry.id,
    educationId: education.id,
  });
}

main()
  .catch((error) => {
    console.error('Multiple Myeloma seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
