/*
  Flagship beta seed for Wardle.

  Purpose:
  - Seeds 7 high-quality, human-authored beta cases.
  - Creates/updates DiagnosisRegistry + aliases.
  - Creates/updates DiagnosisEducation as PUBLISHED manual content.
  - Creates/updates Case as READY_TO_PUBLISH so the existing scheduler can schedule them naturally.
  - Creates a CaseRevision snapshot for editorial history.

  Suggested location:
    doctordle-backend/prisma/seed/flagship-cases.seed.ts

  Run pattern:
    npx tsx prisma/seed/flagship-cases.seed.ts
*/

import { PrismaClient, CaseEditorialStatus, DiagnosisAliasKind, DiagnosisClinicalSetting, DiagnosisDifficultyBand, DiagnosisEducationSource, DiagnosisEducationStatus, DiagnosisMappingMethod, DiagnosisMappingStatus, DiagnosisRegistryStatus, DiagnosisRarityBand, DiagnosisUrgencyLevel } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run the flagship seed.');
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

function dateAtNoonUtc(offsetDays: number): Date {
  const base = new Date(Date.UTC(2026, 5, 1, 12, 0, 0));
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return base;
}

type FlagshipCase = {
  canonicalName: string;
  displayLabel: string;
  aliases: string[];
  specialty: string;
  bodySystem: string;
  category: string;
  difficultyBand: DiagnosisDifficultyBand;
  clinicalSetting: DiagnosisClinicalSetting;
  rarityBand: DiagnosisRarityBand;
  urgencyLevel: DiagnosisUrgencyLevel;
  caseDifficulty: 'easy' | 'medium' | 'hard';
  clues: Array<{ type: 'history' | 'symptom' | 'vital' | 'lab' | 'exam' | 'imaging'; value: string; order: number }>;
  differentials: string[];
  explanation: any;
  education: any;
};

const flagshipCases: FlagshipCase[] = [
  {
    canonicalName: 'appendicitis',
    displayLabel: 'Appendicitis',
    aliases: ['acute appendicitis'],
    specialty: 'General Surgery',
    bodySystem: 'Gastrointestinal',
    category: 'Inflammatory',
    difficultyBand: DiagnosisDifficultyBand.BASIC,
    clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
    rarityBand: DiagnosisRarityBand.COMMON,
    urgencyLevel: DiagnosisUrgencyLevel.URGENT,
    caseDifficulty: 'easy',
    clues: [
      { order: 0, type: 'history', value: '23-year-old man presents with 18 hours of abdominal pain that began around the umbilicus.' },
      { order: 1, type: 'symptom', value: 'Pain has migrated to the right lower quadrant and is associated with anorexia and nausea.' },
      { order: 2, type: 'exam', value: "Localized tenderness at McBurney's point with guarding." },
      { order: 3, type: 'vital', value: 'Temperature is 38.2°C, heart rate is 104/min, blood pressure is 118/74 mmHg.' },
      { order: 4, type: 'lab', value: 'WBC is 15.8 ×10^9/L with neutrophil predominance of 86%.' },
      { order: 5, type: 'imaging', value: 'CT abdomen shows an 11 mm dilated appendix with periappendiceal fat stranding.' },
    ],
    differentials: ['Gastroenteritis', 'Mesenteric adenitis', 'Renal colic', 'Crohn disease'],
    explanation: {
      diagnosis: 'Appendicitis',
      summary: 'Migratory periumbilical pain to the right lower quadrant with anorexia, fever, neutrophilic leukocytosis, localized peritonism, and CT evidence of an inflamed appendix is classic for appendicitis.',
      reasoning: [
        'The pain begins periumbilically from visceral irritation and later localizes to the right lower quadrant as parietal peritoneum becomes inflamed.',
        'McBurney point tenderness with guarding indicates localized peritoneal irritation rather than uncomplicated gastroenteritis.',
        'Neutrophilic leukocytosis and CT fat stranding support acute appendiceal inflammation.',
      ],
      keyFindings: ['Migratory abdominal pain', 'Right lower quadrant tenderness with guarding', 'Neutrophilic leukocytosis', 'Dilated appendix with periappendiceal fat stranding'],
      differentialAnalysis: [
        { diagnosis: 'Gastroenteritis', whyPlausibleEarly: 'Early abdominal pain, nausea, and anorexia can resemble gastroenteritis.', ruledOutByClues: [{ clueOrder: 2, evidence: "Localized tenderness at McBurney's point with guarding", reason: 'Focal peritonism is not typical of uncomplicated gastroenteritis.' }], finalReasonLessLikely: 'The focal right lower quadrant findings and CT-confirmed inflamed appendix favor appendicitis.' },
        { diagnosis: 'Mesenteric adenitis', whyPlausibleEarly: 'Young patients with right lower quadrant pain may have mesenteric adenitis.', ruledOutByClues: [{ clueOrder: 5, evidence: '11 mm dilated appendix with periappendiceal fat stranding', reason: 'Imaging directly identifies appendiceal inflammation.' }], finalReasonLessLikely: 'Mesenteric adenitis would not show a dilated inflamed appendix.' },
        { diagnosis: 'Renal colic', whyPlausibleEarly: 'Acute unilateral abdominal pain can mimic ureteric stone pain.', ruledOutByClues: [{ clueOrder: 1, evidence: 'migrated to the right lower quadrant and is associated with anorexia and nausea', reason: 'Migratory pain with anorexia is more typical of appendicitis than renal colic.' }], finalReasonLessLikely: 'There is no colicky flank-to-groin pain or urinary clue, and CT supports appendicitis.' },
        { diagnosis: 'Crohn disease', whyPlausibleEarly: 'Terminal ileitis can cause right lower quadrant pain.', ruledOutByClues: [{ clueOrder: 5, evidence: '11 mm dilated appendix with periappendiceal fat stranding', reason: 'The imaging localizes inflammation to the appendix rather than terminal ileum.' }], finalReasonLessLikely: 'No chronic diarrhea, weight loss, or ileal thickening is described.' },
      ],
      generationQuality: { contentTier: 'FLAGSHIP', seedVersion: 'flagship-beta-v1', humanReviewed: true },
    },
    education: {
      title: 'Appendicitis',
      summary: { definition: 'Acute inflammation of the appendix, usually from luminal obstruction, presenting with migratory abdominal pain and localized right lower quadrant peritonism.', whyItMatters: 'Delay increases the risk of perforation, abscess, sepsis, and more complex surgery.' },
      clinicalPattern: [
        { title: 'Classic pattern', content: 'Periumbilical pain migrates to the right lower quadrant with anorexia, nausea, low-grade fever, and leukocytosis.', whyItMatters: 'The migration pattern reflects visceral pain becoming parietal peritoneal irritation.' },
      ],
      examPearls: [
        { title: 'McBurney point tenderness', content: 'Maximal tenderness one-third of the way from the anterior superior iliac spine to the umbilicus.', whyItMatters: 'Localizes inflammation to the appendix region.', discriminator: 'Separates appendicitis from diffuse gastroenteritis.' },
        { title: 'Guarding or rebound', content: 'Suggests peritoneal irritation.', whyItMatters: 'Raises concern for advanced inflammation or perforation.' },
      ],
      investigations: [
        { title: 'CBC', content: 'Neutrophilic leukocytosis supports inflammation but is not diagnostic alone.' },
        { title: 'CT abdomen', content: 'Dilated appendix, wall thickening, appendicolith, or periappendiceal fat stranding supports diagnosis.' },
      ],
      differentials: [
        { diagnosis: 'Gastroenteritis', discriminator: 'Diffuse crampy pain and diarrhea without focal peritonism.' },
        { diagnosis: 'Renal colic', discriminator: 'Colicky flank-to-groin pain with hematuria.' },
        { diagnosis: 'Mesenteric adenitis', discriminator: 'Often follows viral illness and lacks inflamed appendix on imaging.' },
      ],
      management: [
        { title: 'Initial care', content: 'Nil by mouth, IV fluids, analgesia, antiemetics, and surgical review.' },
        { title: 'Definitive care', content: 'Appendicectomy or selected antibiotic-first pathways depending on local protocols and complication status.' },
      ],
      pitfalls: [
        { title: 'Normal early labs', content: 'Early appendicitis can have modest or normal inflammatory markers.' },
        { title: 'Atypical appendix position', content: 'Retrocecal or pelvic appendix may produce atypical symptoms.' },
      ],
      recallPrompts: ['Why does appendicitis pain migrate?', 'Which imaging finding most strongly supports appendicitis?', 'What signs suggest peritoneal irritation?'],
      references: [],
    },
  },
  {
    canonicalName: 'diabetic ketoacidosis',
    displayLabel: 'Diabetic Ketoacidosis',
    aliases: ['DKA'],
    specialty: 'Emergency Medicine',
    bodySystem: 'Endocrine',
    category: 'Metabolic',
    difficultyBand: DiagnosisDifficultyBand.BASIC,
    clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
    rarityBand: DiagnosisRarityBand.COMMON,
    urgencyLevel: DiagnosisUrgencyLevel.EMERGENT,
    caseDifficulty: 'easy',
    clues: [
      { order: 0, type: 'history', value: '19-year-old woman with type 1 diabetes presents with vomiting and progressive fatigue.' },
      { order: 1, type: 'symptom', value: 'She has two days of polyuria, polydipsia, and diffuse abdominal pain after missing insulin doses.' },
      { order: 2, type: 'exam', value: 'Dry mucous membranes and deep rapid breathing are noted.' },
      { order: 3, type: 'vital', value: 'Blood pressure is 92/58 mmHg, heart rate is 122/min, respiratory rate is 30/min, temperature is 37.6°C.' },
      { order: 4, type: 'lab', value: 'Serum glucose is 548 mg/dL, bicarbonate is 9 mmol/L, and anion gap is 26 mmol/L.' },
      { order: 5, type: 'lab', value: 'Serum ketones are strongly positive and venous pH is 7.08.' },
    ],
    differentials: ['Starvation ketosis', 'Alcoholic ketoacidosis', 'Hyperosmolar hyperglycemic state', 'Sepsis'],
    explanation: {
      diagnosis: 'Diabetic Ketoacidosis',
      summary: 'Vomiting, dehydration, Kussmaul-type breathing, marked hyperglycemia, high anion gap metabolic acidosis, and positive ketones establish diabetic ketoacidosis.',
      reasoning: [
        'Missed insulin creates a strong precipitant for ketogenesis and hyperglycemia.',
        'Deep rapid breathing reflects respiratory compensation for metabolic acidosis.',
        'The combination of glucose 548 mg/dL, bicarbonate 9 mmol/L, anion gap 26 mmol/L, positive ketones, and pH 7.08 confirms DKA.'
      ],
      keyFindings: ['Type 1 diabetes with missed insulin', 'Polyuria and polydipsia', 'Dehydration and deep rapid breathing', 'Glucose 548 mg/dL', 'Bicarbonate 9 mmol/L and pH 7.08', 'Strongly positive ketones'],
      differentialAnalysis: [
        { diagnosis: 'Starvation ketosis', whyPlausibleEarly: 'Vomiting, poor intake, ketones, and acidosis can suggest starvation ketosis.', ruledOutByClues: [{ clueOrder: 4, evidence: 'Serum glucose is 548 mg/dL', reason: 'Starvation ketosis usually has normal or only mildly elevated glucose, not marked hyperglycemia.' }], finalReasonLessLikely: 'Marked hyperglycemia with severe acidosis is much more consistent with DKA.' },
        { diagnosis: 'Alcoholic ketoacidosis', whyPlausibleEarly: 'Vomiting with high-anion-gap acidosis and ketones can resemble alcoholic ketoacidosis.', ruledOutByClues: [{ clueOrder: 1, evidence: 'after missing insulin doses', reason: 'Insulin omission in type 1 diabetes is a direct precipitant for DKA.' }], finalReasonLessLikely: 'The case lacks an alcohol binge/withdrawal history and has marked hyperglycemia.' },
        { diagnosis: 'Hyperosmolar hyperglycemic state', whyPlausibleEarly: 'Severe hyperglycemia and dehydration overlap with HHS.', ruledOutByClues: [{ clueOrder: 5, evidence: 'Serum ketones are strongly positive and venous pH is 7.08', reason: 'HHS has minimal ketosis and less prominent acidosis compared with DKA.' }], finalReasonLessLikely: 'Strong ketosis and severe acidosis favor DKA over HHS.' },
        { diagnosis: 'Sepsis', whyPlausibleEarly: 'Hypotension, tachycardia, and fatigue can occur in sepsis.', ruledOutByClues: [{ clueOrder: 4, evidence: 'bicarbonate is 9 mmol/L, and anion gap is 26 mmol/L', reason: 'The metabolic pattern is a high-anion-gap ketoacidosis rather than isolated septic shock.' }], finalReasonLessLikely: 'No infectious focus or fever is given, while the biochemical triad confirms DKA.' },
      ],
      generationQuality: { contentTier: 'FLAGSHIP', seedVersion: 'flagship-beta-v1', humanReviewed: true },
    },
    education: {
      title: 'Diabetic Ketoacidosis',
      summary: { definition: 'Acute metabolic emergency due to insulin deficiency causing hyperglycemia, ketosis, and high-anion-gap metabolic acidosis.', whyItMatters: 'Delayed treatment can lead to shock, cerebral edema, arrhythmia, and death.' },
      clinicalPattern: [{ title: 'Classic triad', content: 'Hyperglycemia, ketones, and metabolic acidosis.', whyItMatters: 'Glucose alone does not define DKA; acidosis and ketogenesis are essential.' }],
      examPearls: [{ title: 'Kussmaul respirations', content: 'Deep rapid breathing from compensation for metabolic acidosis.', whyItMatters: 'A bedside clue to severe acidosis.', discriminator: 'Separates DKA from uncomplicated hyperglycemia.' }],
      investigations: [{ title: 'Blood gas and bicarbonate', content: 'Confirms severity of metabolic acidosis.' }, { title: 'Serum ketones', content: 'Confirms ketogenesis.' }, { title: 'Electrolytes', content: 'Potassium must be known before insulin.' }],
      differentials: [{ diagnosis: 'HHS', discriminator: 'Higher osmolality, minimal ketosis, less acidosis.' }, { diagnosis: 'Starvation ketosis', discriminator: 'Normal or mildly raised glucose.' }, { diagnosis: 'Alcoholic ketoacidosis', discriminator: 'Alcohol history and usually lower glucose.' }],
      management: [{ title: 'Fluids first', content: 'Start isotonic fluids to restore perfusion.' }, { title: 'Potassium before insulin', content: 'Check and correct potassium because insulin shifts potassium intracellularly.' }, { title: 'Insulin infusion', content: 'Use IV insulin after potassium safety is confirmed.' }],
      pitfalls: [{ title: 'Insulin before potassium', content: 'Can precipitate dangerous hypokalemia.' }, { title: 'Stopping treatment when glucose normalizes', content: 'Continue until anion gap closes.' }],
      recallPrompts: ['What are the three diagnostic pillars of DKA?', 'Why check potassium before insulin?', 'What separates DKA from HHS?'],
      references: [],
    },
  },
  {
    canonicalName: 'community acquired pneumonia',
    displayLabel: 'Community Acquired Pneumonia',
    aliases: ['pneumonia', 'CAP'],
    specialty: 'Respiratory Medicine',
    bodySystem: 'Respiratory',
    category: 'Infectious',
    difficultyBand: DiagnosisDifficultyBand.BASIC,
    clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
    rarityBand: DiagnosisRarityBand.COMMON,
    urgencyLevel: DiagnosisUrgencyLevel.URGENT,
    caseDifficulty: 'medium',
    clues: [
      { order: 0, type: 'history', value: '67-year-old man presents with three days of fever and productive cough.' },
      { order: 1, type: 'symptom', value: 'He reports pleuritic right-sided chest pain and increasing shortness of breath.' },
      { order: 2, type: 'exam', value: 'Bronchial breath sounds and crackles are heard over the right lower lung field.' },
      { order: 3, type: 'vital', value: 'Temperature is 39.1°C, heart rate is 112/min, respiratory rate is 26/min, and SpO2 is 90% on room air.' },
      { order: 4, type: 'lab', value: 'WBC is 18.2 ×10^9/L with neutrophil predominance of 88%.' },
      { order: 5, type: 'imaging', value: 'Chest X-ray shows dense right lower lobe consolidation with air bronchograms.' },
    ],
    differentials: ['Pulmonary embolism', 'Acute bronchitis', 'Heart failure', 'COPD exacerbation'],
    explanation: {
      diagnosis: 'Community Acquired Pneumonia',
      summary: 'Fever, productive cough, pleuritic pain, focal bronchial breath sounds, neutrophilic leukocytosis, hypoxia, and lobar consolidation support community acquired pneumonia.',
      reasoning: ['The early syndrome is respiratory infection with systemic features.', 'Focal chest signs and lobar consolidation localize disease to alveolar infection.', 'Neutrophilic leukocytosis supports bacterial infection.'],
      keyFindings: ['Fever and productive cough', 'Right-sided pleuritic pain', 'Focal bronchial breath sounds', 'WBC 18.2 ×10^9/L', 'Right lower lobe consolidation'],
      differentialAnalysis: [
        { diagnosis: 'Pulmonary embolism', whyPlausibleEarly: 'Sudden dyspnea, pleuritic pain, tachycardia, and hypoxia can suggest PE.', ruledOutByClues: [{ clueOrder: 5, evidence: 'dense right lower lobe consolidation with air bronchograms', reason: 'Lobar consolidation with air bronchograms supports alveolar infection rather than PE.' }], finalReasonLessLikely: 'Fever, productive cough, neutrophilia, and consolidation favor pneumonia.' },
        { diagnosis: 'Acute bronchitis', whyPlausibleEarly: 'Cough and fever can occur in acute bronchitis.', ruledOutByClues: [{ clueOrder: 2, evidence: 'Bronchial breath sounds and crackles are heard over the right lower lung field', reason: 'Focal signs suggest parenchymal involvement rather than uncomplicated bronchitis.' }], finalReasonLessLikely: 'Hypoxia and lobar consolidation make bronchitis less likely.' },
        { diagnosis: 'Heart failure', whyPlausibleEarly: 'Dyspnea and hypoxia in an older patient can suggest heart failure.', ruledOutByClues: [{ clueOrder: 0, evidence: 'fever and productive cough', reason: 'Fever and productive cough point toward infection rather than fluid overload.' }], finalReasonLessLikely: 'No orthopnea, edema, diffuse crackles, or pulmonary edema pattern is described.' },
        { diagnosis: 'COPD exacerbation', whyPlausibleEarly: 'Cough, dyspnea, and hypoxia can occur in COPD exacerbation.', ruledOutByClues: [{ clueOrder: 5, evidence: 'dense right lower lobe consolidation with air bronchograms', reason: 'Focal lobar consolidation is not the typical primary finding in COPD exacerbation.' }], finalReasonLessLikely: 'The case lacks known COPD/wheeze and has infectious consolidation.' },
      ],
      generationQuality: { contentTier: 'FLAGSHIP', seedVersion: 'flagship-beta-v1', humanReviewed: true },
    },
    education: {
      title: 'Community Acquired Pneumonia',
      summary: { definition: 'Infection of lung parenchyma acquired outside hospital or within the early period of admission.', whyItMatters: 'Can progress to respiratory failure, sepsis, empyema, or death, especially in older or comorbid patients.' },
      clinicalPattern: [{ title: 'Typical bacterial pattern', content: 'Fever, productive cough, pleuritic pain, focal chest signs, leukocytosis, and consolidation.', whyItMatters: 'The diagnosis is a synthesis of clinical syndrome plus imaging evidence.' }],
      examPearls: [{ title: 'Bronchial breath sounds', content: 'Suggest air-filled bronchi surrounded by consolidated lung.', whyItMatters: 'Supports alveolar consolidation rather than simple bronchitis.' }],
      investigations: [{ title: 'Chest X-ray', content: 'Looks for focal consolidation, multilobar disease, effusion, or complications.' }, { title: 'Oxygen saturation', content: 'Hypoxia determines severity and need for admission/oxygen.' }, { title: 'CBC/CRP', content: 'Inflammatory markers support infection but do not replace clinical judgment.' }],
      differentials: [{ diagnosis: 'PE', discriminator: 'Pleuritic pain with risk factors, often without productive cough or lobar consolidation.' }, { diagnosis: 'Heart failure', discriminator: 'Pulmonary edema, orthopnea, raised JVP, peripheral edema.' }, { diagnosis: 'COPD exacerbation', discriminator: 'Known COPD, wheeze, hyperinflation rather than focal consolidation.' }],
      management: [{ title: 'Assess severity', content: 'Use clinical severity, oxygenation, comorbidity, and local tools such as CURB-65 where appropriate.' }, { title: 'Antibiotics', content: 'Start empiric antibiotics according to local guidelines and severity.' }, { title: 'Supportive care', content: 'Oxygen, fluids if needed, antipyretics, and reassessment.' }],
      pitfalls: [{ title: 'Normal early CXR', content: 'Early or dehydrated patients may have subtle imaging findings.' }, { title: 'Missing sepsis', content: 'Tachycardia, hypotension, confusion, or hypoxia should escalate care.' }],
      recallPrompts: ['What finding separates pneumonia from acute bronchitis?', 'Why does bronchial breathing suggest consolidation?', 'What features make pneumonia severe?'],
      references: [],
    },
  },
  {
    canonicalName: 'pulmonary embolism',
    displayLabel: 'Pulmonary Embolism',
    aliases: ['PE'],
    specialty: 'Emergency Medicine',
    bodySystem: 'Respiratory',
    category: 'Vascular',
    difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
    clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
    rarityBand: DiagnosisRarityBand.COMMON,
    urgencyLevel: DiagnosisUrgencyLevel.EMERGENT,
    caseDifficulty: 'medium',
    clues: [
      { order: 0, type: 'history', value: '34-year-old woman develops sudden shortness of breath five days after knee surgery.' },
      { order: 1, type: 'symptom', value: 'She has sharp pleuritic chest pain and one episode of mild hemoptysis.' },
      { order: 2, type: 'vital', value: 'Heart rate is 126/min, respiratory rate is 28/min, blood pressure is 108/70 mmHg, and SpO2 is 89% on room air.' },
      { order: 3, type: 'exam', value: 'The left calf is swollen and tender compared with the right.' },
      { order: 4, type: 'lab', value: 'D-dimer is 2.4 µg/mL FEU.' },
      { order: 5, type: 'imaging', value: 'CT pulmonary angiography shows filling defects in segmental pulmonary arteries.' },
    ],
    differentials: ['Pneumonia', 'Pneumothorax', 'Acute coronary syndrome', 'Heart failure'],
    explanation: {
      diagnosis: 'Pulmonary Embolism',
      summary: 'Sudden dyspnea, pleuritic pain, hypoxia, tachycardia, recent surgery, unilateral calf swelling, elevated D-dimer, and CTPA filling defects indicate pulmonary embolism.',
      reasoning: ['Recent surgery creates venous thromboembolism risk.', 'Pleuritic pain, hemoptysis, tachycardia, and hypoxia fit PE.', 'CT pulmonary angiography confirms intravascular filling defects.'],
      keyFindings: ['Recent knee surgery', 'Sudden dyspnea', 'Pleuritic chest pain and hemoptysis', 'Unilateral calf swelling', 'Elevated D-dimer', 'CTPA filling defects'],
      differentialAnalysis: [
        { diagnosis: 'Pneumonia', whyPlausibleEarly: 'Dyspnea, pleuritic pain, and hypoxia can occur in pneumonia.', ruledOutByClues: [{ clueOrder: 0, evidence: 'sudden shortness of breath five days after knee surgery', reason: 'Abrupt onset after surgery strongly suggests thromboembolism.' }], finalReasonLessLikely: 'No fever, productive cough, leukocytosis, or consolidation is described.' },
        { diagnosis: 'Pneumothorax', whyPlausibleEarly: 'Sudden pleuritic pain and dyspnea can suggest pneumothorax.', ruledOutByClues: [{ clueOrder: 5, evidence: 'filling defects in segmental pulmonary arteries', reason: 'CTPA identifies emboli rather than pleural air.' }], finalReasonLessLikely: 'There is no unilateral absent breath sounds or collapsed lung imaging.' },
        { diagnosis: 'Acute coronary syndrome', whyPlausibleEarly: 'Chest pain with dyspnea and tachycardia can mimic ACS.', ruledOutByClues: [{ clueOrder: 1, evidence: 'sharp pleuritic chest pain and one episode of mild hemoptysis', reason: 'Pleuritic pain with hemoptysis is more typical of PE than ACS.' }], finalReasonLessLikely: 'Postoperative VTE risk and CTPA findings favor PE.' },
        { diagnosis: 'Heart failure', whyPlausibleEarly: 'Dyspnea and hypoxia can suggest heart failure.', ruledOutByClues: [{ clueOrder: 3, evidence: 'left calf is swollen and tender compared with the right', reason: 'Unilateral calf swelling points toward DVT source for PE.' }], finalReasonLessLikely: 'No orthopnea, edema pattern, raised JVP, or pulmonary edema is described.' },
      ],
      generationQuality: { contentTier: 'FLAGSHIP', seedVersion: 'flagship-beta-v1', humanReviewed: true },
    },
    education: {
      title: 'Pulmonary Embolism',
      summary: { definition: 'Obstruction of pulmonary arteries by thrombus, usually from deep venous thrombosis.', whyItMatters: 'Can cause sudden hypoxia, right heart strain, shock, and death.' },
      clinicalPattern: [{ title: 'Classic pattern', content: 'Sudden dyspnea, pleuritic chest pain, tachycardia, hypoxia, hemoptysis, and VTE risk factors.', whyItMatters: 'PE is easy to miss because exam and chest X-ray can be nonspecific.' }],
      examPearls: [{ title: 'Unilateral calf swelling', content: 'Suggests DVT as embolic source.', whyItMatters: 'Raises pretest probability for PE.' }],
      investigations: [{ title: 'D-dimer', content: 'Useful mainly in low/intermediate risk patients; nonspecific.' }, { title: 'CTPA', content: 'Confirms filling defects in pulmonary arteries.' }, { title: 'ECG/troponin', content: 'May help risk-stratify right heart strain but are not diagnostic alone.' }],
      differentials: [{ diagnosis: 'Pneumonia', discriminator: 'Fever, productive cough, consolidation.' }, { diagnosis: 'Pneumothorax', discriminator: 'Unilateral pleuritic pain with pleural air/collapsed lung.' }, { diagnosis: 'ACS', discriminator: 'Pressure-like pain, ischemic ECG/troponin pattern.' }],
      management: [{ title: 'Stabilize', content: 'Oxygen, IV access, hemodynamic assessment.' }, { title: 'Anticoagulation', content: 'Start when PE likely and bleeding risk acceptable.' }, { title: 'Thrombolysis/embolectomy', content: 'Consider for massive PE with shock according to local protocol.' }],
      pitfalls: [{ title: 'False reassurance from normal CXR', content: 'CXR may be normal in PE.' }, { title: 'Overusing D-dimer', content: 'D-dimer is nonspecific and less helpful in high-risk patients.' }],
      recallPrompts: ['What history raises PE probability?', 'When is D-dimer useful?', 'What confirms PE on CTPA?'],
      references: [],
    },
  },
  {
    canonicalName: 'acute cholecystitis',
    displayLabel: 'Acute Cholecystitis',
    aliases: ['cholecystitis'],
    specialty: 'General Surgery',
    bodySystem: 'Gastrointestinal',
    category: 'Inflammatory',
    difficultyBand: DiagnosisDifficultyBand.BASIC,
    clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
    rarityBand: DiagnosisRarityBand.COMMON,
    urgencyLevel: DiagnosisUrgencyLevel.URGENT,
    caseDifficulty: 'medium',
    clues: [
      { order: 0, type: 'history', value: '48-year-old woman presents with right upper quadrant pain that began after a fatty meal.' },
      { order: 1, type: 'symptom', value: 'The pain has persisted for 10 hours and is associated with nausea and vomiting.' },
      { order: 2, type: 'exam', value: 'There is right upper quadrant tenderness with a positive Murphy sign.' },
      { order: 3, type: 'vital', value: 'Temperature is 38.0°C, heart rate is 102/min, blood pressure is 124/78 mmHg.' },
      { order: 4, type: 'lab', value: 'WBC is 14.3 ×10^9/L; total bilirubin is 1.1 mg/dL.' },
      { order: 5, type: 'imaging', value: 'Ultrasound shows gallstones, gallbladder wall thickness of 5 mm, and pericholecystic fluid.' },
    ],
    differentials: ['Biliary colic', 'Acute pancreatitis', 'Peptic ulcer disease', 'Acute hepatitis'],
    explanation: {
      diagnosis: 'Acute Cholecystitis',
      summary: 'Persistent right upper quadrant pain, fever, leukocytosis, positive Murphy sign, gallstones, gallbladder wall thickening, and pericholecystic fluid support acute cholecystitis.',
      reasoning: ['Pain after fatty food suggests gallbladder pathology.', 'Persistence beyond several hours with fever and leukocytosis suggests inflammation rather than simple colic.', 'Ultrasound signs confirm inflamed gallbladder.'],
      keyFindings: ['Persistent RUQ pain', 'Positive Murphy sign', 'Fever', 'Leukocytosis', 'Gallstones with wall thickening and pericholecystic fluid'],
      differentialAnalysis: [
        { diagnosis: 'Biliary colic', whyPlausibleEarly: 'Fatty-meal RUQ pain with gallstones can be biliary colic.', ruledOutByClues: [{ clueOrder: 1, evidence: 'pain has persisted for 10 hours', reason: 'Biliary colic usually resolves within a few hours; persistent pain suggests inflammation.' }], finalReasonLessLikely: 'Fever, leukocytosis, wall thickening, and pericholecystic fluid favor cholecystitis.' },
        { diagnosis: 'Acute pancreatitis', whyPlausibleEarly: 'Epigastric/RUQ pain with vomiting can be pancreatitis.', ruledOutByClues: [{ clueOrder: 2, evidence: 'positive Murphy sign', reason: 'Murphy sign localizes inflammation to the gallbladder.' }], finalReasonLessLikely: 'No lipase elevation or pancreatic imaging findings are described.' },
        { diagnosis: 'Peptic ulcer disease', whyPlausibleEarly: 'Upper abdominal pain and nausea may mimic peptic disease.', ruledOutByClues: [{ clueOrder: 5, evidence: 'gallstones, gallbladder wall thickness of 5 mm, and pericholecystic fluid', reason: 'Ultrasound findings directly support gallbladder inflammation.' }], finalReasonLessLikely: 'Fever, Murphy sign, and inflammatory gallbladder imaging are not explained by uncomplicated PUD.' },
        { diagnosis: 'Acute hepatitis', whyPlausibleEarly: 'RUQ pain and systemic symptoms can occur in hepatitis.', ruledOutByClues: [{ clueOrder: 4, evidence: 'total bilirubin is 1.1 mg/dL', reason: 'Normal bilirubin makes clinically significant hepatitis or obstruction less likely in this case.' }], finalReasonLessLikely: 'The focal Murphy sign and gallbladder ultrasound findings favor cholecystitis.' },
      ],
      generationQuality: { contentTier: 'FLAGSHIP', seedVersion: 'flagship-beta-v1', humanReviewed: true },
    },
    education: {
      title: 'Acute Cholecystitis',
      summary: { definition: 'Inflammation of the gallbladder, usually from cystic duct obstruction by gallstones.', whyItMatters: 'Can progress to empyema, gangrene, perforation, or sepsis.' },
      clinicalPattern: [{ title: 'Classic pattern', content: 'Persistent RUQ pain, fever, nausea/vomiting, positive Murphy sign, leukocytosis, and ultrasound signs of gallbladder inflammation.', whyItMatters: 'Persistence and inflammatory signs separate it from biliary colic.' }],
      examPearls: [{ title: 'Murphy sign', content: 'Inspiratory arrest during RUQ palpation.', whyItMatters: 'Localizes pain to an inflamed gallbladder.' }],
      investigations: [{ title: 'Ultrasound', content: 'First-line imaging: stones, wall thickening, pericholecystic fluid, sonographic Murphy sign.' }, { title: 'LFTs', content: 'Assess obstruction or alternative hepatobiliary disease.' }],
      differentials: [{ diagnosis: 'Biliary colic', discriminator: 'Intermittent pain without fever/leukocytosis/wall thickening.' }, { diagnosis: 'Pancreatitis', discriminator: 'Elevated lipase and epigastric pain radiating to back.' }, { diagnosis: 'Hepatitis', discriminator: 'Marked transaminase elevation and jaundice pattern.' }],
      management: [{ title: 'Initial care', content: 'Nil by mouth, IV fluids, analgesia, antiemetics.' }, { title: 'Antibiotics', content: 'Cover enteric Gram-negative and anaerobic organisms according to local policy.' }, { title: 'Surgery', content: 'Early laparoscopic cholecystectomy when appropriate.' }],
      pitfalls: [{ title: 'Calling it biliary colic', content: 'Persistent pain with fever/leukocytosis should be treated as inflammatory disease.' }],
      recallPrompts: ['What separates cholecystitis from biliary colic?', 'What does Murphy sign mean?', 'What ultrasound findings support cholecystitis?'],
      references: [],
    },
  },
  {
    canonicalName: 'acute ischemic stroke',
    displayLabel: 'Acute Ischemic Stroke',
    aliases: ['ischemic stroke', 'cerebral infarction'],
    specialty: 'Neurology',
    bodySystem: 'Nervous System',
    category: 'Vascular',
    difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
    clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
    rarityBand: DiagnosisRarityBand.COMMON,
    urgencyLevel: DiagnosisUrgencyLevel.EMERGENT,
    caseDifficulty: 'hard',
    clues: [
      { order: 0, type: 'history', value: '72-year-old man with hypertension develops sudden difficulty speaking while eating breakfast.' },
      { order: 1, type: 'exam', value: 'He has right facial droop and slurred speech.' },
      { order: 2, type: 'exam', value: 'Right arm weakness is greater than right leg weakness.' },
      { order: 3, type: 'vital', value: 'Blood pressure is 188/102 mmHg, heart rate is 86/min, glucose is 106 mg/dL.' },
      { order: 4, type: 'imaging', value: 'Non-contrast CT head shows no intracranial hemorrhage.' },
      { order: 5, type: 'imaging', value: 'MRI diffusion-weighted imaging shows an acute left MCA territory infarct.' },
    ],
    differentials: ['Intracerebral hemorrhage', 'Hypoglycemia', 'Todd paralysis', 'Brain tumor'],
    explanation: {
      diagnosis: 'Acute Ischemic Stroke',
      summary: 'Sudden focal cortical deficits, normal glucose, no hemorrhage on CT, and DWI-confirmed left MCA infarction establish acute ischemic stroke.',
      reasoning: ['Abrupt onset of focal neurologic deficit is vascular until proven otherwise.', 'Right face/arm-predominant weakness and language disturbance localize to the left MCA territory.', 'MRI diffusion restriction confirms acute infarction.'],
      keyFindings: ['Sudden aphasia/dysarthria', 'Right facial droop', 'Right arm greater than leg weakness', 'Glucose 106 mg/dL', 'No hemorrhage on CT', 'Left MCA territory infarct'],
      differentialAnalysis: [
        { diagnosis: 'Intracerebral hemorrhage', whyPlausibleEarly: 'Sudden focal deficit with severe hypertension can be hemorrhage.', ruledOutByClues: [{ clueOrder: 4, evidence: 'Non-contrast CT head shows no intracranial hemorrhage', reason: 'CT excludes visible acute intracranial bleeding.' }], finalReasonLessLikely: 'MRI confirms ischemic infarction rather than hemorrhage.' },
        { diagnosis: 'Hypoglycemia', whyPlausibleEarly: 'Hypoglycemia can mimic stroke with altered speech or weakness.', ruledOutByClues: [{ clueOrder: 3, evidence: 'glucose is 106 mg/dL', reason: 'Normal glucose rules out hypoglycemia as the cause.' }], finalReasonLessLikely: 'Persistent focal deficit and DWI lesion support ischemic stroke.' },
        { diagnosis: 'Todd paralysis', whyPlausibleEarly: 'Postictal weakness can mimic stroke.', ruledOutByClues: [{ clueOrder: 0, evidence: 'develops sudden difficulty speaking while eating breakfast', reason: 'There is no witnessed seizure or postictal history.' }], finalReasonLessLikely: 'DWI infarct in the left MCA territory supports stroke.' },
        { diagnosis: 'Brain tumor', whyPlausibleEarly: 'Brain lesions can cause focal neurologic deficits.', ruledOutByClues: [{ clueOrder: 0, evidence: 'sudden difficulty speaking', reason: 'Abrupt onset favors vascular occlusion rather than slowly progressive mass effect.' }], finalReasonLessLikely: 'Imaging shows acute infarction rather than mass lesion.' },
      ],
      generationQuality: { contentTier: 'FLAGSHIP', seedVersion: 'flagship-beta-v1', humanReviewed: true },
    },
    education: {
      title: 'Acute Ischemic Stroke',
      summary: { definition: 'Acute focal brain injury from arterial occlusion causing cerebral ischemia and infarction.', whyItMatters: 'Time-critical diagnosis enables reperfusion therapy and prevents disability.' },
      clinicalPattern: [{ title: 'Vascular onset', content: 'Sudden focal neurologic deficit localizing to a vascular territory.', whyItMatters: 'Abrupt onset is the key discriminator from many mimics.' }],
      examPearls: [{ title: 'Face-arm greater than leg weakness', content: 'Suggests MCA territory involvement.', whyItMatters: 'Helps localize the lesion.' }, { title: 'Check glucose', content: 'Hypoglycemia is a reversible stroke mimic.', whyItMatters: 'Must be excluded immediately.' }],
      investigations: [{ title: 'Non-contrast CT', content: 'First step to exclude hemorrhage.' }, { title: 'MRI DWI', content: 'Sensitive for acute infarction.' }, { title: 'Vascular imaging', content: 'Assesses large vessel occlusion where available.' }],
      differentials: [{ diagnosis: 'ICH', discriminator: 'Blood on CT.' }, { diagnosis: 'Hypoglycemia', discriminator: 'Low capillary glucose and improvement with correction.' }, { diagnosis: 'Todd paralysis', discriminator: 'Seizure history and postictal course.' }],
      management: [{ title: 'Stroke pathway', content: 'Activate urgent stroke assessment and determine last-known-well time.' }, { title: 'Reperfusion eligibility', content: 'Assess thrombolysis/thrombectomy eligibility according to local protocol.' }, { title: 'Secondary prevention', content: 'Antiplatelet/statin/risk factor control after hemorrhage is excluded and according to pathway.' }],
      pitfalls: [{ title: 'Skipping glucose', content: 'Hypoglycemia can closely mimic stroke.' }, { title: 'Waiting for MRI before action', content: 'CT-based pathways often guide urgent treatment decisions.' }],
      recallPrompts: ['Why is non-contrast CT done first?', 'What is a stroke mimic that must be checked immediately?', 'What territory causes aphasia with right-sided weakness?'],
      references: [],
    },
  },
  {
    canonicalName: 'ectopic pregnancy',
    displayLabel: 'Ectopic Pregnancy',
    aliases: ['tubal ectopic pregnancy'],
    specialty: 'Obstetrics and Gynaecology',
    bodySystem: 'Reproductive',
    category: 'Obstetric Emergency',
    difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
    clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
    rarityBand: DiagnosisRarityBand.COMMON,
    urgencyLevel: DiagnosisUrgencyLevel.EMERGENT,
    caseDifficulty: 'hard',
    clues: [
      { order: 0, type: 'history', value: '29-year-old woman presents with lower abdominal pain and six weeks of amenorrhea.' },
      { order: 1, type: 'symptom', value: 'She reports intermittent vaginal spotting and dizziness.' },
      { order: 2, type: 'exam', value: 'Right adnexal tenderness is present on pelvic examination.' },
      { order: 3, type: 'vital', value: 'Blood pressure is 96/62 mmHg and heart rate is 118/min.' },
      { order: 4, type: 'lab', value: 'Serum beta-hCG is 2,800 IU/L.' },
      { order: 5, type: 'imaging', value: 'Transvaginal ultrasound shows no intrauterine pregnancy and a right adnexal gestational sac.' },
    ],
    differentials: ['Miscarriage', 'Pelvic inflammatory disease', 'Ovarian torsion', 'Ruptured ovarian cyst'],
    explanation: {
      diagnosis: 'Ectopic Pregnancy',
      summary: 'Amenorrhea, pelvic pain, spotting, adnexal tenderness, tachycardia, positive beta-hCG, absent intrauterine pregnancy, and adnexal gestational sac indicate ectopic pregnancy.',
      reasoning: ['Pregnancy with pain and bleeding is ectopic pregnancy until proven otherwise.', 'Hemodynamic changes raise concern for bleeding or rupture.', 'Ultrasound showing an adnexal gestational sac confirms extrauterine implantation.'],
      keyFindings: ['Six weeks amenorrhea', 'Vaginal spotting', 'Adnexal tenderness', 'Tachycardia and borderline hypotension', 'Beta-hCG 2,800 IU/L', 'No intrauterine pregnancy with adnexal gestational sac'],
      differentialAnalysis: [
        { diagnosis: 'Miscarriage', whyPlausibleEarly: 'Amenorrhea with vaginal spotting and pain can suggest miscarriage.', ruledOutByClues: [{ clueOrder: 5, evidence: 'right adnexal gestational sac', reason: 'An adnexal gestational sac indicates extrauterine pregnancy.' }], finalReasonLessLikely: 'No intrauterine pregnancy loss is shown, and adnexal pregnancy is visualized.' },
        { diagnosis: 'Pelvic inflammatory disease', whyPlausibleEarly: 'Lower abdominal pain and adnexal tenderness can occur in PID.', ruledOutByClues: [{ clueOrder: 4, evidence: 'Serum beta-hCG is 2,800 IU/L', reason: 'Positive pregnancy test shifts concern toward pregnancy-related emergencies.' }], finalReasonLessLikely: 'Amenorrhea and adnexal gestational sac confirm ectopic pregnancy.' },
        { diagnosis: 'Ovarian torsion', whyPlausibleEarly: 'Acute unilateral adnexal pain can suggest torsion.', ruledOutByClues: [{ clueOrder: 0, evidence: 'six weeks of amenorrhea', reason: 'Amenorrhea makes pregnancy-related pathology central.' }], finalReasonLessLikely: 'Ultrasound shows a gestational sac rather than torsed ovary findings.' },
        { diagnosis: 'Ruptured ovarian cyst', whyPlausibleEarly: 'Sudden pelvic pain with dizziness can occur after cyst rupture.', ruledOutByClues: [{ clueOrder: 5, evidence: 'no intrauterine pregnancy and a right adnexal gestational sac', reason: 'These ultrasound findings identify ectopic pregnancy.' }], finalReasonLessLikely: 'Positive beta-hCG and adnexal gestational sac are not explained by simple cyst rupture.' },
      ],
      generationQuality: { contentTier: 'FLAGSHIP', seedVersion: 'flagship-beta-v1', humanReviewed: true },
    },
    education: {
      title: 'Ectopic Pregnancy',
      summary: { definition: 'Implantation of pregnancy outside the uterine cavity, most commonly in the fallopian tube.', whyItMatters: 'Rupture can cause life-threatening intra-abdominal bleeding.' },
      clinicalPattern: [{ title: 'Classic triad', content: 'Amenorrhea, abdominal/pelvic pain, and vaginal bleeding.', whyItMatters: 'Any reproductive-age patient with pain and bleeding needs pregnancy testing.' }],
      examPearls: [{ title: 'Adnexal tenderness', content: 'Supports tubal/adnexal pathology.', whyItMatters: 'With positive hCG, it raises concern for ectopic pregnancy.' }, { title: 'Shock signs', content: 'Tachycardia or hypotension suggests rupture/bleeding.', whyItMatters: 'Requires emergency escalation.' }],
      investigations: [{ title: 'Pregnancy test / beta-hCG', content: 'Confirms pregnancy and guides ultrasound interpretation.' }, { title: 'Transvaginal ultrasound', content: 'Looks for intrauterine pregnancy, adnexal mass/sac, and free fluid.' }],
      differentials: [{ diagnosis: 'Miscarriage', discriminator: 'Intrauterine pregnancy loss rather than adnexal gestation.' }, { diagnosis: 'PID', discriminator: 'Fever, discharge, cervical motion tenderness; pregnancy test changes priorities.' }, { diagnosis: 'Ovarian torsion', discriminator: 'Ovarian enlargement/reduced flow rather than gestational sac.' }],
      management: [{ title: 'Unstable patient', content: 'Resuscitate and urgent gynecology/surgical management.' }, { title: 'Stable selected patient', content: 'Medical or expectant pathways may be considered based on hCG, size, symptoms, and local protocol.' }],
      pitfalls: [{ title: 'Not testing pregnancy', content: 'Ectopic pregnancy can be missed if pregnancy test is delayed.' }, { title: 'False reassurance from spotting', content: 'Light bleeding does not exclude ectopic pregnancy.' }],
      recallPrompts: ['What is the classic triad?', 'What makes ectopic pregnancy unstable?', 'What ultrasound finding confirms ectopic pregnancy?'],
      references: [],
    },
  },
];

async function upsertFlagshipCase(item: FlagshipCase, index: number) {
  const canonicalNormalized = normalizeClinicalText(item.canonicalName);

  const registry = await prisma.diagnosisRegistry.upsert({
    where: { canonicalNormalized },
    update: {
      displayLabel: item.displayLabel,
      status: DiagnosisRegistryStatus.ACTIVE,
      active: true,
      isPlayable: true,
      isGeneratable: true,
      specialty: item.specialty,
      bodySystem: item.bodySystem,
      category: item.category,
      difficultyBand: item.difficultyBand,
      clinicalSetting: item.clinicalSetting,
      rarityBand: item.rarityBand,
      urgencyLevel: item.urgencyLevel,
    },
    create: {
      canonicalName: item.canonicalName,
      canonicalNormalized,
      displayLabel: item.displayLabel,
      status: DiagnosisRegistryStatus.ACTIVE,
      active: true,
      isPlayable: true,
      isGeneratable: true,
      specialty: item.specialty,
      bodySystem: item.bodySystem,
      category: item.category,
      difficultyBand: item.difficultyBand,
      clinicalSetting: item.clinicalSetting,
      rarityBand: item.rarityBand,
      urgencyLevel: item.urgencyLevel,
    },
  });

  const aliasTerms = Array.from(new Set([item.displayLabel, item.canonicalName, ...item.aliases]));
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
        kind: rank === 0 ? DiagnosisAliasKind.CANONICAL : DiagnosisAliasKind.ACCEPTED,
      },
      create: {
        diagnosisRegistryId: registry.id,
        term,
        normalizedTerm: normalizeClinicalText(term),
        active: true,
        acceptedForMatch: true,
        rank,
        kind: rank === 0 ? DiagnosisAliasKind.CANONICAL : DiagnosisAliasKind.ACCEPTED,
        source: 'flagship-beta-v1',
      },
    });
  }

  const education = await prisma.diagnosisEducation.upsert({
    where: { diagnosisRegistryId: registry.id },
    update: {
      title: item.education.title,
      summary: item.education.summary,
      clinicalPattern: item.education.clinicalPattern,
      examPearls: item.education.examPearls,
      investigations: item.education.investigations,
      differentials: item.education.differentials,
      management: item.education.management,
      pitfalls: item.education.pitfalls,
      recallPrompts: item.education.recallPrompts,
      references: item.education.references,
      editorialStatus: DiagnosisEducationStatus.PUBLISHED,
      source: DiagnosisEducationSource.MANUAL,
      generatedAt: null,
      reviewedAt: new Date(),
      publishedAt: new Date(),
      version: { increment: 1 },
    },
    create: {
      diagnosisRegistryId: registry.id,
      title: item.education.title,
      summary: item.education.summary,
      clinicalPattern: item.education.clinicalPattern,
      examPearls: item.education.examPearls,
      investigations: item.education.investigations,
      differentials: item.education.differentials,
      management: item.education.management,
      pitfalls: item.education.pitfalls,
      recallPrompts: item.education.recallPrompts,
      references: item.education.references,
      editorialStatus: DiagnosisEducationStatus.PUBLISHED,
      source: DiagnosisEducationSource.MANUAL,
      reviewedAt: new Date(),
      publishedAt: new Date(),
      version: 1,
    },
  });

  await prisma.diagnosisEducationRevision.upsert({
    where: {
      educationId_version: {
        educationId: education.id,
        version: education.version,
      },
    },
    update: {
      snapshot: item.education,
      editorialStatus: DiagnosisEducationStatus.PUBLISHED,
      source: DiagnosisEducationSource.MANUAL,
    },
    create: {
      educationId: education.id,
      version: education.version,
      snapshot: item.education,
      editorialStatus: DiagnosisEducationStatus.PUBLISHED,
      source: DiagnosisEducationSource.MANUAL,
    },
  });

  const date = dateAtNoonUtc(index);
  const existingCase = await prisma.case.findFirst({
    where: {
      diagnosisRegistryId: registry.id,
      explanation: {
        path: ['generationQuality', 'seedVersion'],
        equals: 'flagship-beta-v1',
      },
    },
    select: { id: true, currentRevisionId: true },
  });

  const history = item.clues.find((clue) => clue.type === 'history')?.value ?? item.clues[0].value;
  const symptoms = item.clues.filter((clue) => clue.type === 'symptom').map((clue) => clue.value);

  const caseData = {
    title: item.displayLabel,
    date,
    difficulty: item.caseDifficulty,
    history,
    symptoms,
    clues: item.clues,
    explanation: item.explanation,
    differentials: item.differentials,
    editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
    approvedAt: new Date(),
    publishedAt: null,
    diagnosisRegistryId: registry.id,
    proposedDiagnosisText: item.displayLabel,
    diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
    diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
    diagnosisMappingConfidence: 1,
    diagnosisEditorialNote: 'Seeded flagship beta case. Scheduler should publish/schedule naturally.',
  };

  const seededCase = existingCase
    ? await prisma.case.update({ where: { id: existingCase.id }, data: caseData, select: { id: true } })
    : await prisma.case.create({ data: caseData, select: { id: true } });

  const latestRevision = await prisma.caseRevision.findFirst({
    where: { caseId: seededCase.id },
    orderBy: { revisionNumber: 'desc' },
    select: { revisionNumber: true },
  });

  const revisionNumber = (latestRevision?.revisionNumber ?? 0) + 1;
  const revision = await prisma.caseRevision.create({
    data: {
      caseId: seededCase.id,
      revisionNumber,
      source: 'MANUAL',
      publishTrack: 'DAILY',
      title: item.displayLabel,
      date,
      difficulty: item.caseDifficulty,
      history,
      symptoms,
      clues: item.clues,
      explanation: item.explanation,
      differentials: item.differentials,
      diagnosisRegistryId: registry.id,
      proposedDiagnosisText: item.displayLabel,
      diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
      diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
      diagnosisMappingConfidence: 1,
      diagnosisEditorialNote: 'Seeded flagship beta case revision.',
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
      source: 'MANUAL',
      publishTrack: 'DAILY',
      outcome: 'PASSED',
      validatorVersion: 'flagship-human-review:v1',
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion: 'flagship-beta-v1',
        humanReviewed: true,
        note: 'Manual gold-standard case seeded for beta inventory.',
      },
      findings: [],
      completedAt: new Date(),
    },
  });

  return { registryId: registry.id, caseId: seededCase.id, educationId: education.id };
}

async function main() {
  console.log(`Seeding ${flagshipCases.length} flagship beta cases...`);

  for (const [index, item] of flagshipCases.entries()) {
    const result = await upsertFlagshipCase(item, index);
    console.log(`Seeded ${item.displayLabel}:`, result);
  }

  console.log('Done. Cases are READY_TO_PUBLISH. Run the existing daily-case scheduler ensure-window endpoint to create DailyCase rows.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
