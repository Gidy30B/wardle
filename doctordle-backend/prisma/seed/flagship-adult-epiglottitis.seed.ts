


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
 * FLAGSHIP CASE SEED — Adult Epiglottitis
 *
 * Focus: disproportionate odynophagia, secretion intolerance, muffled voice,
 * upper-airway obstruction, monitored imaging, and controlled endoscopic confirmation.
 *
 * Safety: duplicate-safe, education-safe, and DailyCase-safe.
 *
 * Run:
 *   npx tsx prisma/seed/flagship-adult-epiglottitis.seed.ts
 */

function resolvePgConnectionString(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (!value.startsWith('prisma+postgres://')) return value;
  const parsed = new URL(value);
  const apiKey = parsed.searchParams.get('api_key');
  if (!apiKey) throw new Error('DATABASE_URL uses prisma+postgres:// but is missing api_key.');
  const payload = JSON.parse(Buffer.from(apiKey, 'base64url').toString('utf8')) as { databaseUrl?: unknown };
  if (typeof payload.databaseUrl !== 'string' || !payload.databaseUrl) {
    throw new Error('DATABASE_URL api_key does not contain a databaseUrl.');
  }
  return payload.databaseUrl;
}

const databaseUrl = resolvePgConnectionString(process.env.DATABASE_URL);
if (!databaseUrl) throw new Error('DATABASE_URL is required to run the Adult Epiglottitis seed.');

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
pool.on('error', (error) => console.error('[pg-pool] idle client error:', error));
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function normalizeClinicalText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
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
async function findAvailableInventoryPlaceholderDate(preferredDate: Date): Promise<Date> {
  for (let offset = 0; offset < 365; offset += 1) {
    const candidateDate = addUtcDays(preferredDate, offset);
    const owner = await prisma.case.findUnique({
      where: { date: candidateDate },
      select: { id: true, title: true, dailyCases: { select: { id: true }, take: 1 } },
    });
    if (!owner) return candidateDate;
    console.warn('Inventory placeholder occupied; trying next date.', { candidateDate, owner });
  }
  throw new Error('No free inventory placeholder date found for Adult Epiglottitis.');
}

const now = new Date();
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 11, 4, 12, 0, 0));
const seedVersion = 'flagship-adult-epiglottitis-v1';
const canonicalName = 'adult epiglottitis';
const displayLabel = 'Adult Epiglottitis';
const caseTitle = 'Severe Sore Throat with Drooling and Stridor';
const taxonomy = {
  specialty: 'Otolaryngology',
  subspecialty: 'Laryngology and Airway',
  category: 'Acute Supraglottic Infection',
  bodySystem: 'Respiratory',
  organSystem: 'Upper Airway',
} as const;
const aliasTerms = [
  'Adult Epiglottitis',
  'Epiglottitis',
  'Acute Epiglottitis',
  'Adult Supraglottitis',
  'Acute Supraglottitis',
];

const clues = [
  {
    "order": 0,
    "type": "history",
    "value": "A 38-year-old man presents with 20 hours of rapidly worsening severe sore throat and painful swallowing. The intensity of the pain is much greater than the mild oral-pharyngeal redness seen at triage. He has no recent choking episode, neck trauma, dental procedure, or caustic exposure."
  },
  {
    "order": 1,
    "type": "symptom",
    "value": "He can no longer swallow his saliva, is drooling, and speaks with a muffled low-volume voice. He prefers to remain sitting upright and reports increasing difficulty breathing. Cough is minimal, and there is no urticaria, lip swelling, facial swelling, or generalized itching."
  },
  {
    "order": 2,
    "type": "vital",
    "value": "Temperature is 39.0 C, pulse 122/min, blood pressure 132/78 mmHg, respiratory rate 26/min, and oxygen saturation 95% on room air. He is anxious but alert and maintains his airway while sitting upright."
  },
  {
    "order": 3,
    "type": "exam",
    "value": "He has inspiratory stridor, suprasternal recession, and a forward-leaning posture. Gentle inspection shows no trismus, unilateral tonsillar bulge, uvular deviation, pseudomembrane, wheeze, or marked external neck swelling. No attempt is made to depress the tongue or provoke the pharynx."
  },
  {
    "order": 4,
    "type": "imaging",
    "value": "A portable erect lateral soft-tissue neck radiograph obtained in the resuscitation area with continuous monitoring and the airway team present shows marked enlargement of the epiglottic shadow with thickened aryepiglottic folds, producing a thumb-like contour. There is no prevertebral soft-tissue widening or radiopaque foreign body."
  },
  {
    "order": 5,
    "type": "exam",
    "value": "Controlled flexible nasolaryngoscopy performed by otolaryngology with anaesthesia and emergency airway equipment immediately available shows an intensely erythematous, oedematous epiglottis and swollen aryepiglottic folds narrowing the supraglottic inlet. The vocal cords remain mobile, with no peritonsillar collection, retropharyngeal bulge, or foreign body, confirming Adult Epiglottitis."
  }
] as const;
const differentials = [
  "Peritonsillar Abscess",
  "Retropharyngeal Abscess",
  "Bacterial Tracheitis",
  "Croup",
  "Anaphylaxis",
  "Laryngeal Foreign Body"
];
const canonicalDifferentialLabels = new Set(differentials);

type DifferentialAnalysisEntry = {
  diagnosis: string;
  whyPlausibleEarly: string;
  ruledOutByClues: Array<{ clueOrder: number; evidence: string; reason: string }>;
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
  "Rapidly progressive severe throat pain that is disproportionate to the visible oropharyngeal findings localizes concern below the oral cavity and raises suspicion for a supraglottic process.",
  "Drooling, inability to swallow secretions, a muffled voice, upright positioning, and increasing breathlessness indicate impaired supraglottic patency rather than uncomplicated pharyngitis.",
  "Fever and marked tachycardia support an acute inflammatory or infectious process, while preserved alertness and oxygenation show that the airway is threatened but not yet completely obstructed.",
  "Inspiratory stridor, suprasternal recession, and tripod-like positioning confirm upper-airway obstruction; absence of trismus, tonsillar asymmetry, uvular deviation, wheeze, or allergic skin findings weakens key mimics.",
  "The enlarged epiglottic shadow and thickened aryepiglottic folds provide supportive anatomical evidence of supraglottic inflammation while the lack of prevertebral widening or a foreign body argues against alternative obstruction.",
  "Direct visualization of an oedematous erythematous epiglottis and swollen aryepiglottic folds establishes Adult Epiglottitis and simultaneously assesses the degree of airway narrowing."
] as const;
const diagnosticContributions = [
  "Introduces the high-risk mismatch between severe symptoms and relatively mild visible pharyngeal findings.",
  "Adds the classic secretion, voice, posture, and breathing pattern of supraglottic obstruction.",
  "Establishes acute systemic inflammation and the current physiological severity of airway compromise.",
  "Provides the bedside upper-airway pattern and actively separates several major mimics.",
  "Adds supportive radiographic localization in a monitored, clinically stable adult.",
  "Provides controlled endoscopic confirmation and direct assessment of the threatened airway."
] as const;
const differentialAnalysis: DifferentialAnalysisEntry[] = [
  {
    "diagnosis": "Peritonsillar Abscess",
    "whyPlausibleEarly": "Both can cause severe sore throat, odynophagia, drooling, fever, and a muffled voice.",
    "ruledOutByClues": [
      {
        "clueOrder": 3,
        "evidence": "no trismus, unilateral tonsillar bulge, uvular deviation",
        "reason": "A peritonsillar abscess usually produces unilateral peritonsillar swelling, trismus, and deviation of the uvula away from the affected side."
      },
      {
        "clueOrder": 5,
        "evidence": "no peritonsillar collection",
        "reason": "Controlled endoscopy does not show the focal collection expected in a peritonsillar abscess."
      }
    ],
    "finalReasonLessLikely": "The obstruction is supraglottic and diffuse rather than a focal peritonsillar collection."
  },
  {
    "diagnosis": "Retropharyngeal Abscess",
    "whyPlausibleEarly": "Both may cause fever, severe odynophagia, drooling, muffled voice, and respiratory distress.",
    "ruledOutByClues": [
      {
        "clueOrder": 4,
        "evidence": "There is no prevertebral soft-tissue widening",
        "reason": "Retropharyngeal infection commonly widens the prevertebral soft tissues on lateral imaging."
      },
      {
        "clueOrder": 5,
        "evidence": "no retropharyngeal bulge",
        "reason": "Direct assessment shows no posterior pharyngeal mass effect or collection."
      }
    ],
    "finalReasonLessLikely": "The radiographic and endoscopic abnormalities center on the epiglottis and aryepiglottic folds rather than the retropharyngeal space."
  },
  {
    "diagnosis": "Bacterial Tracheitis",
    "whyPlausibleEarly": "Both are febrile bacterial upper-airway emergencies that can produce stridor and rapid deterioration.",
    "ruledOutByClues": [
      {
        "clueOrder": 1,
        "evidence": "Cough is minimal",
        "reason": "Bacterial tracheitis more often follows a prominent cough or croup-like illness with thick tracheal secretions."
      },
      {
        "clueOrder": 5,
        "evidence": "oedematous epiglottis and swollen aryepiglottic folds",
        "reason": "The visualized disease is centered in the supraglottis rather than the trachea."
      }
    ],
    "finalReasonLessLikely": "Minimal cough and direct supraglottic inflammation favor epiglottitis over a purulent tracheal process."
  },
  {
    "diagnosis": "Croup",
    "whyPlausibleEarly": "Croup and epiglottitis can both cause inspiratory stridor and upper-airway obstruction.",
    "ruledOutByClues": [
      {
        "clueOrder": 0,
        "evidence": "38-year-old man",
        "reason": "Croup overwhelmingly affects young children and is exceptionally unusual as a primary diagnosis in an adult."
      },
      {
        "clueOrder": 1,
        "evidence": "Cough is minimal",
        "reason": "Croup classically causes a prominent barking cough, which is absent here."
      }
    ],
    "finalReasonLessLikely": "Adult age, drooling, severe odynophagia, and minimal cough strongly oppose croup."
  },
  {
    "diagnosis": "Anaphylaxis",
    "whyPlausibleEarly": "Anaphylaxis can cause abrupt upper-airway swelling, stridor, anxiety, and respiratory compromise.",
    "ruledOutByClues": [
      {
        "clueOrder": 1,
        "evidence": "no urticaria, lip swelling, facial swelling, or generalized itching",
        "reason": "The absence of cutaneous and facial allergic findings makes anaphylaxis less likely, although skin findings are not mandatory."
      },
      {
        "clueOrder": 2,
        "evidence": "Temperature is 39.0 C",
        "reason": "High fever supports infection rather than an acute allergic reaction."
      }
    ],
    "finalReasonLessLikely": "The febrile, progressive odynophagia-dominant illness and endoscopic supraglottic inflammation favor infection over anaphylaxis."
  },
  {
    "diagnosis": "Laryngeal Foreign Body",
    "whyPlausibleEarly": "A laryngeal foreign body can produce sudden stridor, voice change, drooling, and respiratory distress.",
    "ruledOutByClues": [
      {
        "clueOrder": 0,
        "evidence": "no recent choking episode",
        "reason": "There is no abrupt aspiration event to support a foreign body."
      },
      {
        "clueOrder": 5,
        "evidence": "no peritonsillar collection, retropharyngeal bulge, or foreign body",
        "reason": "Controlled direct visualization excludes a retained laryngeal foreign body."
      }
    ],
    "finalReasonLessLikely": "The febrile progressive course and direct visualization of diffuse supraglottic inflammation exclude a mechanical foreign body."
  }
];

const explanation = {
  diagnosis: displayLabel,
  summary: 'Rapidly progressive disproportionate odynophagia, secretion intolerance, muffled voice, stridor, supportive epiglottic enlargement, and controlled visualization of an oedematous epiglottis establish Adult Epiglottitis.',
  reasoning: reasoningSteps.join('\n'),
  keyFindings: [
    'Severe sore throat disproportionate to oral findings',
    'Drooling and inability to swallow secretions',
    'Muffled low-volume voice',
    'Minimal cough',
    'Upright forward-leaning posture',
    'Inspiratory stridor and suprasternal recession',
    'Thumb-like enlarged epiglottic shadow',
    'Endoscopic supraglottic oedema',
  ],
  differentials,
  differentialAnalysis,
  clueBreakdown: clues.map((clue, index) => ({
    clueOrder: clue.order,
    clueType: clue.type,
    clue: clue.value,
    explanation: reasoningSteps[index],
    diagnosticContribution: diagnosticContributions[index],
  })),
  clinicalPearl: 'In a patient with severe odynophagia, drooling, muffled voice, or stridor, protect the airway pathway before pursuing a perfect throat examination; the dangerous anatomy may be hidden below the visible pharynx.',
  managementPearl: 'Keep the patient calm and upright, involve otolaryngology and anaesthesia early, start intravenous antibiotics promptly, and observe in a setting where a controlled difficult airway and emergency surgical airway can be performed without delay.',
  generationQuality: {
    contentTier: 'FLAGSHIP',
    seedVersion,
    humanReviewed: true,
    discriminatorStrength: 'HIGH',
    expectedTeachingPoints: [
      'Recognize severe odynophagia out of proportion to visible pharyngeal findings',
      'Treat drooling, muffled voice, upright posture, and stridor as airway warning signs',
      'Avoid provocative examination and unsafe imaging transfers',
      'Use controlled flexible laryngoscopy as the key confirmatory assessment',
      'Differentiate focal peritonsillar, deep-neck, allergic, tracheal, croup, and foreign-body causes',
      'Pair antibiotics with continuous airway surveillance and an escalation plan',
    ],
    competencyDomains: ['Otolaryngology', 'Emergency Medicine', 'Anaesthesia', 'Critical Care', 'Clinical Reasoning'],
  },
};

const educationForFrontend = {
  "title": "Adult Epiglottitis",
  "summary": {
    "definition": "Adult epiglottitis is acute inflammation and oedema of the epiglottis and adjacent supraglottic structures that can unpredictably narrow the upper airway. It is a clinical airway emergency even when initial oxygen saturation is preserved.",
    "highYieldTakeaway": "Think of adult epiglottitis when severe rapidly progressive sore throat and odynophagia are out of proportion to the visible pharyngeal examination, especially with drooling, muffled voice, upright positioning, or stridor. Keep the patient calm and upright, involve airway specialists early, and confirm by controlled visualization when safe."
  },
  "recognitionPattern": [
    {
      "id": "pain-exam-mismatch",
      "type": "PATTERN_RECOGNITION",
      "title": "Severe symptoms with a deceptively quiet mouth",
      "content": "The supraglottis lies below routine oral inspection, so intense throat pain and odynophagia can coexist with only mild visible oropharyngeal inflammation.",
      "whyItMatters": "This mismatch prevents the clinician from falsely reassuring themselves after a limited mouth examination and missing a hidden airway emergency.",
      "discriminator": "Marked odynophagia and secretion difficulty rather than exudative tonsillitis proportionate to visible pharyngeal disease.",
      "trapAvoided": "Do not label severe throat pain as uncomplicated pharyngitis because the tonsils look relatively normal."
    },
    {
      "id": "secretion-voice-posture-pattern",
      "type": "PATTERN_RECOGNITION",
      "title": "Drooling, muffled voice, and upright posture",
      "content": "Supraglottic swelling makes swallowing painful and narrows airflow, producing pooled secretions, low-volume muffled speech, and a preference for sitting forward to maximize airway calibre.",
      "whyItMatters": "The cluster indicates threatened airway patency and should trigger urgent specialist assessment before routine testing.",
      "discriminator": "Drooling and minimal cough rather than the barking cough of croup or the focal trismus of a peritonsillar abscess.",
      "trapAvoided": "Do not force the patient supine for convenience."
    },
    {
      "id": "dynamic-airway-risk",
      "type": "ESCALATION_RED_FLAG",
      "title": "A stable-looking adult can deteriorate rapidly",
      "content": "Airway resistance rises steeply as oedema reduces the supraglottic lumen, so modest additional swelling can convert partial obstruction into critical obstruction.",
      "whyItMatters": "Normal mentation or near-normal oxygen saturation does not remove the need for continuous observation and a rescue-airway plan.",
      "discriminator": "Progressive stridor, work of breathing, secretion intolerance, and fatigue rather than a static uncomplicated sore throat.",
      "escalationImplication": "Escalate immediately when stridor worsens, the patient tires, oxygenation falls, or speech and secretion handling deteriorate.",
      "trapAvoided": "Do not use a single reassuring saturation value to downgrade airway risk."
    }
  ],
  "keySymptoms": [
    {
      "finding": "Severe odynophagia",
      "description": "Painful swallowing is often intense and rapidly progressive.",
      "whyItMatters": "Disproportionate odynophagia suggests disease below the readily visible oropharynx.",
      "discriminator": "More severe than expected from routine pharyngeal inspection."
    },
    {
      "finding": "Drooling or inability to swallow secretions",
      "description": "Saliva pools because swallowing is painful and mechanically impaired.",
      "whyItMatters": "Secretion intolerance is an airway warning sign rather than a minor throat symptom.",
      "discriminator": "More concerning than ordinary painful swallowing with preserved fluid intake."
    },
    {
      "finding": "Muffled or low-volume voice",
      "description": "Supraglottic oedema alters resonance and limits comfortable phonation.",
      "whyItMatters": "Voice change localizes disease toward the upper airway and indicates functional narrowing.",
      "discriminator": "Occurs without the focal hot-potato pattern and trismus of a peritonsillar abscess."
    },
    {
      "finding": "Minimal cough",
      "description": "Cough may be absent or minor despite severe upper-airway symptoms.",
      "whyItMatters": "Minimal cough helps separate epiglottitis from croup and tracheal disease.",
      "discriminator": "Drooling and odynophagia dominate rather than a barking or productive cough."
    }
  ],
  "keySigns": [
    {
      "finding": "Inspiratory stridor",
      "description": "A high-pitched inspiratory sound caused by turbulent airflow through a narrowed extrathoracic airway.",
      "whyItMatters": "Stridor indicates clinically important upper-airway obstruction and increases the urgency of airway planning.",
      "discriminator": "Upper-airway sound rather than the expiratory wheeze of lower-airway bronchospasm."
    },
    {
      "finding": "Tripod or forward-leaning posture",
      "description": "The patient sits upright and leans forward because this position can optimize pharyngeal and laryngeal airway geometry.",
      "whyItMatters": "A self-selected airway position signals respiratory distress and should not be forcibly changed.",
      "discriminator": "Respiratory positioning rather than neck stiffness alone."
    },
    {
      "finding": "Suprasternal recession",
      "description": "Negative inspiratory pressure retracts soft tissue above the sternum because air must pass through a narrowed upper airway.",
      "whyItMatters": "Retraction shows increased work of breathing and impending fatigue risk.",
      "discriminator": "Mechanical upper-airway obstruction rather than isolated throat pain."
    },
    {
      "finding": "Relatively mild visible pharyngeal findings",
      "description": "Routine mouth inspection may be unimpressive because the principal inflammation is in the supraglottis.",
      "whyItMatters": "The sign-exam mismatch should increase rather than reduce suspicion when symptoms are severe.",
      "discriminator": "Unlike tonsillitis or peritonsillar abscess, visible tonsillar disease may not explain symptom severity."
    }
  ],
  "examPearls": [
    {
      "id": "stridor-mechanism",
      "type": "EXAM",
      "title": "Stridor localizes obstruction",
      "content": "Inspiratory stridor is produced because turbulent airflow crosses a narrowed extrathoracic airway during inspiration.",
      "whyItMatters": "It shifts the problem away from uncomplicated pharyngitis and toward an airway emergency requiring continuous observation and specialist support.",
      "discriminator": "Inspiratory stridor rather than diffuse expiratory wheeze.",
      "managementImplication": "Assess work of breathing, speech, secretion handling, and fatigue without provoking the airway.",
      "trapAvoided": "Do not treat stridor as ordinary wheeze."
    },
    {
      "id": "tripod-mechanism",
      "type": "EXAM",
      "title": "Respect the patient's airway position",
      "content": "Forward leaning occurs because the patient instinctively selects a posture that can improve upper-airway calibre and reduce respiratory effort.",
      "whyItMatters": "Forcing a distressed patient supine can worsen obstruction and agitation.",
      "discriminator": "A posture driven by breathing difficulty rather than musculoskeletal comfort.",
      "managementImplication": "Keep the patient upright and minimize unnecessary movement.",
      "trapAvoided": "Do not lie the patient flat for routine examination or transport unless the airway is controlled."
    },
    {
      "id": "avoid-provocation",
      "type": "EXAM",
      "title": "Do not provoke an unstable supraglottis",
      "content": "Forceful tongue depression, repeated throat examination, or distressing procedures can worsen dynamic obstruction because agitation increases airflow demand across an already narrowed inlet.",
      "whyItMatters": "An apparently partial obstruction can deteriorate during a poorly planned examination.",
      "discriminator": "Controlled visualization with airway expertise rather than routine bedside pharyngeal manipulation.",
      "managementImplication": "Defer invasive inspection until personnel and equipment for immediate airway rescue are present.",
      "trapAvoided": "Do not chase a better view of the throat at the expense of airway safety."
    }
  ],
  "scoringSystems": [],
  "investigations": [
    {
      "id": "flexible-laryngoscopy",
      "type": "INVESTIGATION",
      "title": "Controlled flexible nasolaryngoscopy",
      "content": "Flexible nasolaryngoscopy shows oedema and erythema of the epiglottis and adjacent supraglottic structures and directly assesses the remaining airway lumen.",
      "whyItMatters": "Direct visualization confirms the anatomical diagnosis and helps determine whether close observation or airway intervention is required.",
      "managementImplication": "Perform only in an appropriately monitored setting with otolaryngology, anaesthesia, and rescue-airway capability when obstruction is significant.",
      "trapAvoided": "Do not perform casual unprepared laryngoscopy in a deteriorating patient."
    },
    {
      "id": "lateral-neck-radiograph",
      "type": "INVESTIGATION",
      "title": "Erect lateral soft-tissue neck radiograph",
      "content": "A stable cooperative adult may show a markedly enlarged epiglottic shadow, the thumb sign, with thickened aryepiglottic folds.",
      "whyItMatters": "The finding supports supraglottic inflammation, but a normal film does not safely exclude disease.",
      "managementImplication": "Use imaging only when it will not delay airway assessment and when monitoring and airway support remain immediately available.",
      "trapAvoided": "Do not send a high-risk patient away from the resuscitation area merely to obtain the classic image."
    },
    {
      "id": "ct-neck",
      "type": "INVESTIGATION",
      "title": "Contrast-enhanced CT neck",
      "content": "CT may show supraglottic oedema and can identify an epiglottic abscess or alternative deep-neck infection in a stable patient.",
      "whyItMatters": "It is most useful when the diagnosis is uncertain or complications are suspected, not as a prerequisite for treatment.",
      "managementImplication": "Avoid CT when positioning, transfer, or delay could compromise a threatened airway.",
      "trapAvoided": "Do not prioritize anatomical detail over timely airway control."
    },
    {
      "id": "microbiology",
      "type": "INVESTIGATION",
      "title": "Blood and supraglottic cultures",
      "content": "Blood cultures and, once safe, supraglottic cultures may identify organisms such as streptococci, Staphylococcus aureus, Haemophilus influenzae, or other bacteria.",
      "whyItMatters": "Microbiology allows targeted therapy and public-health action when a specific pathogen is identified.",
      "managementImplication": "Obtain cultures only if they do not agitate the patient or delay airway stabilization and antibiotics.",
      "trapAvoided": "Do not perform a risky throat swab before the airway is secure."
    }
  ],
  "differentialDistinguishers": [
    {
      "id": "pta-differential",
      "type": "HIGH_YIELD_DISCRIMINATOR",
      "title": "Peritonsillar Abscess",
      "content": "Both can cause fever, odynophagia, drooling, and a muffled voice, but peritonsillar abscess usually produces focal unilateral peritonsillar swelling with trismus and uvular deviation.",
      "whyItMatters": "The anatomical distinction changes the immediate procedure from airway-centered supraglottic management to drainage of a focal collection when safe.",
      "discriminator": "Unilateral tonsillar bulge, trismus, and uvular deviation rather than diffuse epiglottic and aryepiglottic swelling.",
      "managementImplication": "Request ENT assessment and drain a confirmed focal collection while still evaluating airway risk.",
      "trapAvoided": "Do not call every muffled voice a peritonsillar abscess."
    },
    {
      "id": "rpa-differential",
      "type": "HIGH_YIELD_DISCRIMINATOR",
      "title": "Retropharyngeal Abscess",
      "content": "Both can cause fever, drooling, neck discomfort, voice change, and airway compromise, whereas retropharyngeal abscess centers in the posterior pharyngeal space.",
      "whyItMatters": "Deep-neck infection may require contrast imaging and surgical drainage in addition to airway protection and antibiotics.",
      "discriminator": "Prevertebral widening or a posterior pharyngeal collection rather than an isolated swollen epiglottis.",
      "managementImplication": "Use controlled cross-sectional imaging when the airway is stable and deep-neck extension is suspected.",
      "trapAvoided": "Do not assume all severe odynophagia with neck symptoms is epiglottitis."
    },
    {
      "id": "tracheitis-differential",
      "type": "HIGH_YIELD_DISCRIMINATOR",
      "title": "Bacterial Tracheitis",
      "content": "Both can cause fever, toxicity, and stridor, but bacterial tracheitis commonly follows a cough-dominant croup-like illness with thick purulent tracheal secretions.",
      "whyItMatters": "Tracheal disease may require airway toileting and bronchoscopy in addition to antimicrobial therapy.",
      "discriminator": "Prominent cough and purulent tracheal secretions rather than drooling and severe odynophagia with supraglottic oedema.",
      "managementImplication": "Assess the tracheobronchial tree when secretions and cough dominate the presentation.",
      "trapAvoided": "Do not treat all febrile stridor as the same anatomical disease."
    },
    {
      "id": "croup-differential",
      "type": "HIGH_YIELD_DISCRIMINATOR",
      "title": "Croup",
      "content": "Both cause inspiratory stridor, but croup is primarily a childhood viral illness with a barking cough and subglottic narrowing.",
      "whyItMatters": "Confusing the conditions may delay airway-specialist involvement in a drooling patient with supraglottic obstruction.",
      "discriminator": "Barking cough and child age rather than severe odynophagia, drooling, and adult supraglottic swelling.",
      "managementImplication": "Reconsider croup when the age, secretion intolerance, and pain pattern are atypical.",
      "trapAvoided": "Do not let stridor alone define the diagnosis."
    },
    {
      "id": "anaphylaxis-differential",
      "type": "HIGH_YIELD_DISCRIMINATOR",
      "title": "Anaphylaxis",
      "content": "Both can cause upper-airway narrowing and stridor, but anaphylaxis is usually abrupt and may include urticaria, angioedema, wheeze, hypotension, or a clear exposure.",
      "whyItMatters": "Anaphylaxis requires immediate intramuscular adrenaline and must not be delayed while infection is considered.",
      "discriminator": "Acute multisystem allergic features rather than a febrile progressive odynophagia-dominant illness.",
      "managementImplication": "Treat immediately as anaphylaxis when diagnostic criteria are met, even while other causes remain possible.",
      "trapAvoided": "Do not use absence of rash alone to exclude anaphylaxis."
    },
    {
      "id": "foreign-body-differential",
      "type": "HIGH_YIELD_DISCRIMINATOR",
      "title": "Laryngeal Foreign Body",
      "content": "Both can produce stridor, voice change, drooling, and distress, but a foreign body usually begins abruptly during choking and lacks a progressive febrile prodrome.",
      "whyItMatters": "A retained object requires urgent controlled removal rather than antibiotic treatment alone.",
      "discriminator": "Sudden choking onset and visualized object rather than diffuse inflammatory supraglottic swelling.",
      "managementImplication": "Arrange controlled airway endoscopy when aspiration is plausible.",
      "trapAvoided": "Do not dismiss a witnessed choking event because fever is later present."
    }
  ],
  "managementOverview": [
    {
      "id": "calm-upright-monitor",
      "type": "MANAGEMENT",
      "title": "Keep the patient calm, upright, and continuously monitored",
      "content": "When epiglottitis is suspected, allow the patient to remain in the position of comfort, provide oxygen as tolerated, minimize agitation, and monitor in a resuscitation-capable area.",
      "whyItMatters": "Agitation, forced positioning, and delays can worsen airflow demand across a narrowed supraglottic inlet.",
      "managementImplication": "Assign continuous observation and prepare suction, oxygen, difficult-airway equipment, and surgical-airway backup.",
      "escalationImplication": "Worsening stridor, fatigue, hypoxaemia, secretion failure, altered mental status, or rapidly increasing work of breathing requires immediate airway action.",
      "trapAvoided": "Do not leave the patient unattended or supine for routine workflow."
    },
    {
      "id": "multidisciplinary-airway-plan",
      "type": "MANAGEMENT",
      "title": "Activate an experienced airway team early",
      "content": "Involve otolaryngology, anaesthesia, emergency or critical care clinicians early when there is stridor, respiratory distress, secretion intolerance, or concerning endoscopic narrowing.",
      "whyItMatters": "Intubation can be difficult and failed attempts can precipitate complete obstruction, so the first plan must include a rescue surgical airway.",
      "managementImplication": "Choose observation versus controlled airway intervention according to clinical trajectory and local expertise rather than a single isolated sign.",
      "escalationImplication": "Move to a controlled airway when deterioration or severe obstruction makes continued observation unsafe.",
      "trapAvoided": "Do not attempt repeated unplanned laryngoscopy or intubation without backup."
    },
    {
      "id": "empiric-antibiotics",
      "type": "MANAGEMENT",
      "title": "Start prompt intravenous antimicrobial therapy",
      "content": "Give empiric intravenous therapy covering common respiratory bacteria, typically with a third-generation cephalosporin and additional coverage guided by local resistance patterns, severity, and MRSA risk.",
      "whyItMatters": "Antibiotics treat the underlying infection but do not immediately reverse mechanical airway narrowing.",
      "managementImplication": "Obtain cultures when safe, then narrow therapy according to microbiology and clinical response.",
      "escalationImplication": "Persistent fever, worsening swelling, or failure to improve should prompt review for abscess, resistant organisms, or an alternative diagnosis.",
      "trapAvoided": "Do not delay antibiotics for cultures or assume antibiotics remove the need for airway surveillance."
    },
    {
      "id": "critical-care-observation",
      "type": "MANAGEMENT",
      "title": "Observe where rapid airway intervention is possible",
      "content": "Admit a non-intubated adult with confirmed disease to a high-acuity setting when there is any meaningful airway concern, with immediate access to skilled intubation and surgical airway equipment.",
      "whyItMatters": "Adult disease often resolves without intubation, but deterioration can be abrupt and airway intervention is high risk.",
      "managementImplication": "Repeat structured assessment of stridor, respiratory effort, voice, secretion handling, oxygenation, fatigue, and endoscopic findings when appropriate.",
      "escalationImplication": "Any worsening trend should override a previously conservative plan.",
      "trapAvoided": "Do not place a patient with active stridor on an unmonitored ward."
    },
    {
      "id": "adjuncts-not-definitive",
      "type": "MANAGEMENT",
      "title": "Use adjuncts without mistaking them for airway control",
      "content": "Corticosteroids or nebulized adrenaline may be considered according to local practice, but neither should delay definitive airway decisions or antimicrobial treatment.",
      "whyItMatters": "Evidence for adjunctive benefit is less certain than the need for airway vigilance and antibiotics.",
      "managementImplication": "Document the intended role of adjuncts and continue close reassessment for deterioration.",
      "escalationImplication": "Failure to improve after an adjunct is not a reason to postpone airway intervention.",
      "trapAvoided": "Do not use transient symptomatic improvement as proof that the airway is safe."
    }
  ],
  "complications": [
    "Acute complete upper-airway obstruction",
    "Hypoxic respiratory arrest",
    "Difficult or failed tracheal intubation",
    "Epiglottic or deep-neck abscess",
    "Pneumonia",
    "Sepsis",
    "Aspiration of secretions",
    "Airway injury related to emergency intervention"
  ],
  "pitfalls": [
    {
      "id": "normal-mouth-exam",
      "type": "PITFALL",
      "title": "Reassurance from a mild mouth examination",
      "content": "The oral pharynx may look only mildly inflamed because the dangerous swelling lies in the supraglottis.",
      "whyItMatters": "False reassurance delays airway-team involvement while obstruction progresses.",
      "trapAvoided": "Let symptom severity, drooling, voice, posture, and stridor outweigh an unimpressive tonsillar view."
    },
    {
      "id": "provoking-airway",
      "type": "PITFALL",
      "title": "Provoking the airway during examination",
      "content": "Forceful tongue depression, repeated instrumentation, or distressing transfers can increase agitation and precipitate worsening obstruction.",
      "whyItMatters": "A partially patent airway can become critically narrowed during an avoidable procedure.",
      "trapAvoided": "Use controlled examination with immediate rescue capability when significant obstruction is suspected."
    },
    {
      "id": "imaging-before-airway",
      "type": "PITFALL",
      "title": "Sending a high-risk patient for imaging before airway planning",
      "content": "Radiography or CT can separate the patient from resuscitation resources and require positioning that is poorly tolerated.",
      "whyItMatters": "Diagnostic delay is dangerous when the airway can deteriorate unpredictably.",
      "trapAvoided": "Image only a stable cooperative patient when monitoring and airway support remain immediately available."
    },
    {
      "id": "saturation-reassurance",
      "type": "PITFALL",
      "title": "Using preserved oxygen saturation as proof of safety",
      "content": "Oxygen saturation may remain near normal until airflow becomes critically restricted or the patient tires.",
      "whyItMatters": "Waiting for desaturation can miss the window for a controlled airway.",
      "trapAvoided": "Track work of breathing, stridor, voice, secretion handling, fatigue, and trajectory rather than saturation alone."
    },
    {
      "id": "antibiotics-equal-airway",
      "type": "PITFALL",
      "title": "Assuming antibiotics solve the immediate airway problem",
      "content": "Antibiotics treat infection but do not rapidly reverse established oedema and mechanical narrowing.",
      "whyItMatters": "A patient can deteriorate after antimicrobial therapy has started.",
      "trapAvoided": "Maintain airway surveillance and a rescue plan until swelling and symptoms clearly improve."
    },
    {
      "id": "automatic-intubation-or-no-intubation",
      "type": "PITFALL",
      "title": "Applying a rigid airway rule to every adult",
      "content": "Most adults do not require intubation, yet a minority deteriorate rapidly and airway intervention itself carries substantial failure risk.",
      "whyItMatters": "Both unnecessary intervention and delayed intervention can cause harm.",
      "trapAvoided": "Use repeated specialist assessment, clinical trajectory, and local rescue capability to individualize the airway plan."
    }
  ],
  "recallPrompts": [
    {
      "id": "pain-exam-mismatch-recall",
      "type": "WHY_IT_MATTERS",
      "prompt": "Why does severe odynophagia with only mild visible pharyngeal inflammation increase suspicion for epiglottitis?",
      "answer": "The epiglottis and supraglottic structures are not well seen on routine mouth examination, so dangerous inflammation can be hidden below an apparently mild pharynx.",
      "explanation": "The reasoning target is anatomical localization rather than memorizing a symptom list.",
      "linkedConcept": "hidden supraglottic disease",
      "sourceSection": "clinicalPattern",
      "difficulty": "INTERMEDIATE"
    },
    {
      "id": "stridor-vs-wheeze-recall",
      "type": "DISTINGUISH",
      "prompt": "How does inspiratory stridor change the localization compared with expiratory wheeze?",
      "answer": "Inspiratory stridor indicates narrowing of the extrathoracic upper airway, whereas expiratory wheeze usually reflects intrathoracic lower-airway obstruction.",
      "explanation": "Sound timing directs attention to the anatomical level of obstruction and the urgency of airway planning.",
      "linkedConcept": "airway sound localization",
      "sourceSection": "examPearls",
      "difficulty": "INTERMEDIATE"
    },
    {
      "id": "why-upright-recall",
      "type": "WHY_IT_MATTERS",
      "prompt": "Why should a distressed patient with suspected epiglottitis be allowed to remain upright?",
      "answer": "The position may optimize upper-airway calibre and reduce work of breathing; forcing the patient supine can worsen obstruction and agitation.",
      "explanation": "The patient's chosen posture is a functional airway adaptation, not a behavioural inconvenience.",
      "linkedConcept": "position of comfort",
      "sourceSection": "management",
      "difficulty": "INTERMEDIATE"
    },
    {
      "id": "radiograph-limit-recall",
      "type": "WHY_IT_MATTERS",
      "prompt": "Why can a lateral neck radiograph support but not safely exclude epiglottitis?",
      "answer": "The thumb sign is supportive when present, but radiographs can be falsely negative and obtaining them may delay or destabilize airway care.",
      "explanation": "Test interpretation includes both diagnostic performance and the operational risk of acquiring the test.",
      "linkedConcept": "imaging limitation",
      "sourceSection": "investigations",
      "difficulty": "ADVANCED"
    },
    {
      "id": "pta-separator-recall",
      "type": "DISTINGUISH",
      "prompt": "Which bedside findings shift severe sore throat from epiglottitis toward peritonsillar abscess?",
      "answer": "Trismus, unilateral peritonsillar swelling, and uvular deviation favor a focal peritonsillar abscess.",
      "explanation": "The separator is focal oral asymmetry rather than diffuse hidden supraglottic inflammation.",
      "linkedConcept": "peritonsillar localization",
      "sourceSection": "differentials",
      "difficulty": "INTERMEDIATE"
    },
    {
      "id": "airway-escalation-recall",
      "type": "WHY_IT_MATTERS",
      "prompt": "Why is a near-normal oxygen saturation insufficient to continue routine observation in adult epiglottitis?",
      "answer": "Saturation may remain preserved until obstruction becomes critical or fatigue develops, so worsening stridor, work of breathing, secretion handling, and mental status are earlier danger signals.",
      "explanation": "Airway decisions depend on trajectory and mechanics, not one late physiological marker.",
      "linkedConcept": "dynamic airway risk",
      "sourceSection": "pitfalls",
      "difficulty": "ADVANCED"
    }
  ],
  "references": [
    "Merck Manual Professional Edition. Epiglottitis. Updated professional clinical overview.",
    "Booth AWG, et al. Airway management of adult epiglottitis: a systematic review and meta-analysis. British Journal of Anaesthesia. 2024.",
    "Medical Management of Epiglottitis. Anesthesia Progress. 2020.",
    "BMJ Best Practice. Epiglottitis: diagnosis and investigations."
  ]
};

function assertWardleEducationQuality(): void {
  const requireString = (value: unknown, label: string): asserts value is string => {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`Education quality failure: ${label} is missing.`);
  };
  const requireObjectArray = (value: unknown, label: string): Array<Record<string, unknown>> => {
    if (!Array.isArray(value) || value.length === 0) throw new Error(`Education quality failure: ${label} must be a non-empty array.`);
    return value.map((item, index) => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) throw new Error(`Education quality failure: ${label}[${index}] must be a structured object.`);
      return item as Record<string, unknown>;
    });
  };

  requireObjectArray(educationForFrontend.keySigns, 'keySigns').forEach((sign, index) => {
    requireString(sign.finding, `keySigns[${index}].finding`);
    requireString(sign.description, `keySigns[${index}].description`);
    requireString(sign.whyItMatters, `keySigns[${index}].whyItMatters`);
    requireString(sign.discriminator, `keySigns[${index}].discriminator`);
  });

  const typedSections = [
    ['examPearls', educationForFrontend.examPearls],
    ['investigations', educationForFrontend.investigations],
    ['differentialDistinguishers', educationForFrontend.differentialDistinguishers],
    ['managementOverview', educationForFrontend.managementOverview],
    ['pitfalls', educationForFrontend.pitfalls],
  ] as const;
  typedSections.forEach(([sectionName, value]) => {
    requireObjectArray(value, sectionName).forEach((item, index) => {
      requireString(item.id, `${sectionName}[${index}].id`);
      requireString(item.type, `${sectionName}[${index}].type`);
      requireString(item.title, `${sectionName}[${index}].title`);
      requireString(item.content, `${sectionName}[${index}].content`);
      requireString(item.whyItMatters, `${sectionName}[${index}].whyItMatters`);
    });
  });
  requireObjectArray(educationForFrontend.examPearls, 'examPearls').forEach((item, index) => {
    requireString(item.discriminator, `examPearls[${index}].discriminator`);
    if (!/\b(?:because|due to|reflects|indicates|produces|mechanism|occurs)\b/i.test(String(item.content))) {
      throw new Error(`Education quality failure: examPearls[${index}] does not explain a mechanism.`);
    }
  });
  requireObjectArray(educationForFrontend.investigations, 'investigations').forEach((item, index) => requireString(item.managementImplication, `investigations[${index}].managementImplication`));
  requireObjectArray(educationForFrontend.differentialDistinguishers, 'differentialDistinguishers').forEach((item, index) => {
    requireString(item.discriminator, `differentialDistinguishers[${index}].discriminator`);
    requireString(item.trapAvoided, `differentialDistinguishers[${index}].trapAvoided`);
  });
  requireObjectArray(educationForFrontend.managementOverview, 'managementOverview').forEach((item, index) => {
    requireString(item.managementImplication, `managementOverview[${index}].managementImplication`);
    requireString(item.escalationImplication, `managementOverview[${index}].escalationImplication`);
  });
  requireObjectArray(educationForFrontend.pitfalls, 'pitfalls').forEach((item, index) => requireString(item.trapAvoided, `pitfalls[${index}].trapAvoided`));

  const allowedRecallTypes = new Set(['CLOZE', 'SHORT_ANSWER', 'DISTINGUISH', 'PEARL_RECALL', 'WHY_IT_MATTERS']);
  requireObjectArray(educationForFrontend.recallPrompts, 'recallPrompts').forEach((prompt, index) => {
    for (const field of ['id', 'type', 'prompt', 'answer', 'explanation', 'linkedConcept', 'sourceSection', 'difficulty']) requireString(prompt[field], `recallPrompts[${index}].${field}`);
    if (!allowedRecallTypes.has(String(prompt.type))) throw new Error(`Education quality failure: unsupported recall type at index ${index}.`);
  });
}

function assertSeedShape(): void {
  const supportedClueTypes = new Set(['history', 'symptom', 'vital', 'exam', 'lab', 'imaging']);
  if (clues.length !== 6) throw new Error(`Expected exactly 6 clues; received ${clues.length}.`);
  clues.forEach((clue, index) => {
    if (clue.order !== index) throw new Error(`Clue order mismatch at ${index}.`);
    if (!supportedClueTypes.has(clue.type)) throw new Error(`Unsupported clue type: ${clue.type}.`);
    if (!clue.value.trim()) throw new Error(`Clue ${clue.order} is empty.`);
  });
  const forbiddenEarlyTerms = aliasTerms.map(normalizeClinicalText);
  for (const clue of clues.slice(0, 5)) {
    const normalizedClue = normalizeClinicalText(clue.value);
    const leaked = forbiddenEarlyTerms.find((term) => normalizedClue.includes(term));
    if (leaked) throw new Error(`Clue ${clue.order} reveals diagnosis or alias: ${leaked}.`);
  }
  if (new Set(differentials.map(normalizeClinicalText)).size !== differentials.length) throw new Error('Differentials contain duplicates.');
  for (const diagnosis of differentials) if (!canonicalDifferentialLabels.has(diagnosis)) throw new Error(`Noncanonical differential: ${diagnosis}.`);
  if (typeof explanation.reasoning !== 'string') throw new Error('Explanation reasoning must be a string.');
  const parsedReasoning = explanation.reasoning.split(/\n+/).map((step) => step.trim()).filter(Boolean);
  if (parsedReasoning.length !== clues.length) throw new Error(`Expected ${clues.length} reasoning steps; received ${parsedReasoning.length}.`);
  const breakdown = explanation.clueBreakdown as ClueBreakdownEntry[];
  if (breakdown.length !== clues.length) throw new Error('Clue breakdown length mismatch.');
  breakdown.forEach((entry, index) => {
    const clue = clues[index];
    if (entry.clueOrder !== clue.order || entry.clueType !== clue.type || entry.clue !== clue.value || entry.explanation !== parsedReasoning[index] || !entry.diagnosticContribution.trim()) throw new Error(`Clue breakdown mismatch at ${index}.`);
  });
  const analyses = explanation.differentialAnalysis as DifferentialAnalysisEntry[];
  if (analyses.length !== differentials.length) throw new Error('Differential analysis length mismatch.');
  analyses.forEach((entry) => {
    if (!differentials.includes(entry.diagnosis)) throw new Error(`Unlisted differential analysis: ${entry.diagnosis}.`);
    entry.ruledOutByClues.forEach((item) => {
      if (!Number.isInteger(item.clueOrder) || item.clueOrder < 0 || item.clueOrder >= clues.length) throw new Error(`Invalid clue order in ${entry.diagnosis}.`);
      if (!normalizeClinicalText(clues[item.clueOrder].value).includes(normalizeClinicalText(item.evidence))) throw new Error(`Differential evidence not found: ${entry.diagnosis} -> ${item.evidence}`);
    });
  });
  const educationText = normalizeClinicalText(JSON.stringify(educationForFrontend));
  for (const term of ['38 year old', '20 hours', 'pulse 122', 'blood pressure 132 78', 'oxygen saturation 95', 'this patient', 'this case']) {
    if (educationText.includes(normalizeClinicalText(term))) throw new Error(`Diagnosis education contains case-specific wording: ${term}.`);
  }
  assertWardleEducationQuality();
}

async function ensureRegistry() {
  const canonicalNormalized = normalizeClinicalText(canonicalName);
  const normalizedTerms = aliasTerms.map(normalizeClinicalText);
  const exactRegistry = await prisma.diagnosisRegistry.findUnique({ where: { canonicalNormalized }, select: { id: true } });
  const aliasCandidates = exactRegistry ? [] : await prisma.diagnosisRegistry.findMany({
    where: { aliases: { some: { normalizedTerm: { in: normalizedTerms }, active: true, acceptedForMatch: true } } },
    select: { id: true, canonicalName: true, canonicalNormalized: true, displayLabel: true },
    take: 3,
  });
  if (aliasCandidates.length > 1) throw new Error(`Cannot safely seed ${displayLabel}: multiple registry rows match aliases.`);
  const aliasCandidate = aliasCandidates[0];
  if (aliasCandidate && !normalizeClinicalText(`${aliasCandidate.canonicalName} ${aliasCandidate.displayLabel}`).includes('epiglottitis')) {
    throw new Error(`Cannot safely reuse registry ${aliasCandidate.id}: alias belongs to ${aliasCandidate.displayLabel}.`);
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
    preferredClueTypes: ['history', 'symptom', 'vital', 'exam', 'imaging'],
    notes: 'Flagship adult epiglottitis entry focused on disproportionate odynophagia, secretion intolerance, stridor, safe airway assessment, monitored imaging, controlled nasolaryngoscopy, structured differentials, antibiotics, and selective airway intervention.',
  };
  const registry = existing
    ? await prisma.diagnosisRegistry.update({ where: { id: existing.id }, data: registryData, select: { id: true, displayLabel: true } })
    : await prisma.diagnosisRegistry.create({ data: registryData, select: { id: true, displayLabel: true } });
  for (const [rank, term] of aliasTerms.entries()) {
    await prisma.diagnosisAlias.upsert({
      where: { diagnosisRegistryId_normalizedTerm: { diagnosisRegistryId: registry.id, normalizedTerm: normalizeClinicalText(term) } },
      update: { term, active: true, acceptedForMatch: true, rank, kind: rank === 0 ? DiagnosisAliasKind.CANONICAL : DiagnosisAliasKind.ACCEPTED },
      create: { diagnosisRegistryId: registry.id, term, normalizedTerm: normalizeClinicalText(term), active: true, acceptedForMatch: true, rank, kind: rank === 0 ? DiagnosisAliasKind.CANONICAL : DiagnosisAliasKind.ACCEPTED, source: seedVersion },
    });
  }
  return registry;
}

async function ensureEducation(diagnosisRegistryId: string) {
  const existing = await prisma.diagnosisEducation.findUnique({ where: { diagnosisRegistryId }, select: { id: true, version: true } });
  if (existing) {
    console.log('Skipped diagnosis education because Adult Epiglottitis education already exists:', existing);
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
      snapshot: { ...educationForFrontend, storedColumnMap: { recognitionPattern: 'clinicalPattern', managementOverview: 'management', differentialDistinguishers: 'differentials' } },
      editorialStatus: DiagnosisEducationStatus.PUBLISHED,
      source: DiagnosisEducationSource.MANUAL,
    },
  });
  return education;
}

async function ensureCase(params: { diagnosisRegistryId: string; educationId: string }) {
  const existingCase = await prisma.case.findFirst({
    where: { diagnosisRegistryId: params.diagnosisRegistryId, title: caseTitle },
    orderBy: [{ approvedAt: 'asc' }, { id: 'asc' }],
    select: { id: true, title: true, publicNumber: true, currentRevisionId: true, dailyCases: { select: { id: true }, take: 1 } },
  });
  if (existingCase) {
    console.log(existingCase.dailyCases.length ? 'Skipped existing scheduled Adult Epiglottitis case.' : 'Skipped existing Adult Epiglottitis case to avoid overwriting authored content.', existingCase);
    return existingCase;
  }
  const assignedDate = await findAvailableInventoryPlaceholderDate(inventoryPlaceholderDate);
  const publicNumber = await getNextCasePublicNumber();
  const history = clues[0].value;
  const symptoms = [clues[1].value];
  const seededCase = await prisma.case.create({
    data: {
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
      diagnosisEditorialNote: 'Seeded frontend-aligned flagship Adult Epiglottitis case with six supported clues, exact breakdown alignment, canonical differentials, controlled-airway reasoning, and diagnosis-level structured education.',
    },
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
      editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
      approvedAt: now,
    },
    select: { id: true },
  });
  await prisma.case.update({ where: { id: seededCase.id }, data: { currentRevisionId: revision.id } });
  await prisma.caseValidationRun.create({
    data: {
      caseId: seededCase.id,
      revisionId: revision.id,
      source: CaseSource.MANUAL,
      publishTrack: PublishTrack.DAILY,
      outcome: ValidationOutcome.PASSED,
      validatorVersion: seedVersion,
      summary: { status: 'passed', clueCount: clues.length, differentialCount: differentials.length, educationId: params.educationId },
      findings: { supportedClueTypes: true, exactBreakdownAlignment: true, noEarlyDiagnosisLeakage: true, canonicalDifferentials: true, structuredEducation: true },
      completedAt: now,
    },
  });
  return { id: seededCase.id, publicNumber, title: caseTitle, currentRevisionId: revision.id, dailyCases: [] };
}

async function main() {
  assertSeedShape();
  console.log('Adult Epiglottitis seed validation passed.');
  const registry = await ensureRegistry();
  const education = await ensureEducation(registry.id);
  const caseRow = await ensureCase({ diagnosisRegistryId: registry.id, educationId: education.id });
  console.log('Adult Epiglottitis seed complete.', { registry, education, case: caseRow });
}

main()
  .catch((error) => { console.error('Adult Epiglottitis seed failed:', error); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });