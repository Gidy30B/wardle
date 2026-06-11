import {
  PrismaClient,
  CaseEditorialStatus,
  DiagnosisEducationSource,
  DiagnosisEducationStatus,
  DiagnosisMappingMethod,
  DiagnosisMappingStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run the COPD flagship seed.');
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
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 0, 8, 12, 0, 0));
const seedVersion = 'flagship-copd-v1';

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
    where: { publicNumber: { not: null } },
    orderBy: { publicNumber: 'desc' },
    select: { publicNumber: true },
  });

  return (latest?.publicNumber ?? 0) + 1;
}

// ─── Clues ────────────────────────────────────────────────────────────────────

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 68-year-old man presents with gradually worsening shortness of breath over several years, now occurring even with mild activity.',
  },
  {
    order: 1,
    type: 'symptom',
    value:
      'He reports a long history of chronic cough productive of sputum, especially in the mornings.',
  },
  {
    order: 2,
    type: 'hx',
    value:
      'He has a 40-pack-year smoking history and continues to smoke.',
  },
  {
    order: 3,
    type: 'exam',
    value:
      'On examination, he has a barrel-shaped chest and a prolonged expiratory phase with wheeze on auscultation.',
  },
  {
    order: 4,
    type: 'vital',
    value:
      'His oxygen saturation is 90% on room air, and he uses accessory muscles when breathing.',
  },
  {
    order: 5,
    type: 'lab',
    value:
      'Spirometry shows a post-bronchodilator FEV1/FVC ratio of 0.58 with minimal reversibility after bronchodilator administration.',
  },
  {
    order: 6,
    type: 'lab',
    value:
      'Arterial blood gas reveals chronic compensated respiratory acidosis with an elevated CO₂.',
  },
] as const;

const differentials = [
  'Asthma',
  'Congestive heart failure',
  'Bronchiectasis',
  'Lung cancer',
  'Interstitial lung disease',
];

// ─── Explanation ─────────────────────────────────────────────────────────────

const explanation = {
  diagnosis: 'COPD',
  summary:
    'This is chronic obstructive pulmonary disease: progressive, largely irreversible airflow limitation in a heavy smoker, confirmed by a post-bronchodilator FEV1/FVC of 0.58 with minimal reversibility, alongside chronic productive cough, hyperinflation, hypoxaemia, and chronic compensated hypercapnic (type 2) respiratory failure.',
  keyEvidence: [
    'Gradually progressive exertional dyspnoea over several years',
    'Chronic cough productive of sputum, worse in the mornings',
    '40-pack-year smoking history with ongoing smoking',
    'Barrel-shaped chest with prolonged expiratory phase and wheeze',
    'Accessory muscle use with oxygen saturation 90% on room air',
    'Post-bronchodilator FEV1/FVC 0.58 with minimal reversibility',
    'Chronic compensated respiratory acidosis with elevated CO₂',
  ],
  reasoning: [
    'Years of slowly progressive exertional dyspnoea with a chronic productive cough point to a chronic, progressive airway disease rather than an acute cardiorespiratory illness.',
    'A 40-pack-year ongoing smoking history is the dominant risk factor and frames the differential around smoking-related airway and parenchymal disease.',
    'A barrel chest, prolonged expiration, wheeze, and accessory muscle use are bedside signs of hyperinflation, air trapping, and increased work of breathing.',
    'Oxygen saturation of 90% on room air with accessory muscle use indicates clinically significant gas-exchange impairment, not just deconditioning.',
    'A post-bronchodilator FEV1/FVC of 0.58 confirms airflow obstruction (ratio below 0.70), and the minimal reversibility separates fixed COPD obstruction from reversible asthma.',
    'Arterial blood gas showing chronic compensated respiratory acidosis with a raised CO₂ indicates long-standing type 2 respiratory failure with renal (metabolic) compensation, consistent with established COPD.',
    'Together these features confirm COPD and argue against reversible/variable asthma, restrictive interstitial lung disease, and primarily cardiac dyspnoea.',
  ],
  keyFindings: [
    'Progressive exertional dyspnoea',
    'Chronic productive cough',
    '40-pack-year smoking history',
    'Hyperinflation (barrel chest, prolonged expiration)',
    'Wheeze and accessory muscle use',
    'Oxygen saturation 90% on room air',
    'Post-bronchodilator FEV1/FVC 0.58 with minimal reversibility',
    'Chronic compensated respiratory acidosis with raised CO₂',
  ],
  differentials,
  whyNotOthers: [
    {
      diagnosis: 'Asthma',
      reason:
        'Asthma typically shows variable, reversible airflow obstruction, often with earlier onset and atopy; here obstruction is fixed with minimal bronchodilator reversibility in a lifelong heavy smoker.',
    },
    {
      diagnosis: 'Congestive heart failure',
      reason:
        'Heart failure causes dyspnoea with orthopnoea, raised JVP, oedema, and basal crepitations; the obstructive spirometry and hyperinflation point to airway disease instead.',
    },
    {
      diagnosis: 'Bronchiectasis',
      reason:
        'Bronchiectasis also causes chronic productive cough, but usually with large-volume purulent sputum, recurrent infections, and haemoptysis; the unifying driver here is smoking-related fixed obstruction.',
    },
    {
      diagnosis: 'Lung cancer',
      reason:
        'A heavy smoker is at risk, but the picture is diffuse slowly progressive airflow limitation rather than a focal mass, haemoptysis, or weight loss; imaging is still warranted to exclude it.',
    },
    {
      diagnosis: 'Interstitial lung disease',
      reason:
        'ILD causes progressive dyspnoea but with a restrictive pattern (preserved or raised FEV1/FVC) and fine inspiratory crackles, not the obstructive ratio of 0.58 with wheeze seen here.',
    },
  ],
  managementPearl:
    'Smoking cessation is the single most effective intervention to slow FEV1 decline and improve survival. Build care around inhaled bronchodilators (LAMA/LABA, adding ICS for eosinophilic or frequently exacerbating phenotypes), pulmonary rehabilitation, vaccination, and assessment for long-term oxygen therapy when chronically hypoxaemic. In acute hypercapnic exacerbations, give controlled oxygen targeting 88–92% to avoid worsening CO₂ retention.',
  differentialAnalysis: [
    {
      diagnosis: 'Asthma',
      whyPlausibleEarly:
        'Wheeze, dyspnoea, and expiratory airflow obstruction occur in asthma, and asthma–COPD overlap is common in older smokers.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: '40-pack-year smoking history with ongoing smoking',
          reason:
            'Heavy cumulative smoking is the dominant COPD risk factor, whereas asthma is less tied to smoking dose.',
        },
        {
          clueOrder: 5,
          evidence: 'minimal reversibility after bronchodilator',
          reason:
            'Asthma characteristically shows significant bronchodilator reversibility and variability; fixed obstruction favours COPD.',
        },
        {
          clueOrder: 0,
          evidence: 'gradual worsening over several years in later life',
          reason:
            'Asthma usually has earlier onset with an episodic, variable course rather than steady multi-year progression.',
        },
      ],
      finalReasonLessLikely:
        'Fixed airflow obstruction with minimal reversibility in a lifelong heavy smoker fits COPD; asthma would show reversibility and symptom variability.',
    },
    {
      diagnosis: 'Congestive heart failure',
      whyPlausibleEarly:
        'Older patients develop progressive exertional dyspnoea from heart failure, and pulmonary congestion can cause a "cardiac asthma" wheeze.',
      ruledOutByClues: [
        {
          clueOrder: 3,
          evidence: 'barrel chest with prolonged expiration and wheeze',
          reason:
            'Hyperinflation and expiratory airflow obstruction indicate airway disease rather than the congestion and gallop of heart failure.',
        },
        {
          clueOrder: 5,
          evidence: 'obstructive spirometry (FEV1/FVC 0.58)',
          reason:
            'An obstructive ventilatory defect points to intrinsic airway disease rather than a primarily cardiac cause of dyspnoea.',
        },
      ],
      finalReasonLessLikely:
        'There is no orthopnoea, paroxysmal nocturnal dyspnoea, oedema, or raised JVP, and the spirometry is obstructive, making heart failure an unlikely primary cause.',
    },
    {
      diagnosis: 'Bronchiectasis',
      whyPlausibleEarly:
        'Chronic cough productive of sputum overlaps with the chronic bronchitis phenotype of COPD.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'morning sputum without copious purulent volumes',
          reason:
            'Bronchiectasis usually produces large-volume purulent sputum with recurrent infections and haemoptysis, which are not described here.',
        },
        {
          clueOrder: 2,
          evidence: '40-pack-year smoking history',
          reason:
            'Heavy smoking makes smoking-related COPD the most parsimonious unifying explanation for the obstruction.',
        },
      ],
      finalReasonLessLikely:
        'Smoking-driven fixed obstruction without large-volume purulent sputum, recurrent infection, or haemoptysis favours COPD; HRCT would confirm bronchiectasis if clinically suspected.',
    },
    {
      diagnosis: 'Lung cancer',
      whyPlausibleEarly:
        'A heavy smoker with chronic cough is at high risk of lung malignancy, which must always be considered.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence: 'gradual progression over several years',
          reason:
            'A diffuse, slowly progressive airflow problem is more typical of COPD than the recent change, weight loss, or haemoptysis that flag malignancy.',
        },
        {
          clueOrder: 5,
          evidence: 'generalised obstructive spirometry',
          reason:
            'Diffuse airflow obstruction explains the symptoms, whereas a tumour tends to cause focal signs or localised obstruction.',
        },
      ],
      finalReasonLessLikely:
        'The presentation is diffuse airflow obstruction rather than focal disease, but as a heavy smoker he still warrants chest imaging and ongoing vigilance for malignancy.',
    },
    {
      diagnosis: 'Interstitial lung disease',
      whyPlausibleEarly:
        'ILD also causes progressive exertional dyspnoea and reduced exercise tolerance.',
      ruledOutByClues: [
        {
          clueOrder: 3,
          evidence: 'wheeze and prolonged expiratory phase',
          reason:
            'ILD classically produces fine end-inspiratory ("velcro") crackles, not expiratory wheeze and prolonged expiration.',
        },
        {
          clueOrder: 5,
          evidence: 'FEV1/FVC 0.58 (obstructive)',
          reason:
            'ILD causes a restrictive pattern with preserved or raised FEV1/FVC, the opposite of the obstructive ratio seen here.',
        },
      ],
      finalReasonLessLikely:
        'Obstructive spirometry and hyperinflation are the opposite of the restrictive physiology of interstitial lung disease.',
    },
  ],
  generationQuality: {
    contentTier: 'FLAGSHIP',
    humanReviewed: true,
    seedVersion,
  },
};

// ─── Education ────────────────────────────────────────────────────────────────

const educationForFrontend = {
  title: 'COPD',

  summary: {
    definition:
      'Chronic obstructive pulmonary disease is a common, preventable, and treatable condition characterised by persistent respiratory symptoms and largely irreversible airflow limitation due to airway and/or alveolar abnormalities, usually caused by significant exposure to noxious particles or gases, most often tobacco smoke.',
    highYieldTakeaway:
      'Diagnose COPD with post-bronchodilator spirometry showing FEV1/FVC below 0.70 and limited reversibility in a patient with a compatible exposure history and symptoms, after considering asthma, heart failure, bronchiectasis, malignancy, and interstitial lung disease.',
  },

  recognitionPattern: [
    {
      pattern: 'Fixed airflow obstruction in a smoker',
      whyItMatters:
        'A post-bronchodilator FEV1/FVC below 0.70 with minimal reversibility defines COPD and is the key feature that separates it from asthma.',
      progression:
        'Smoking exposure → airway inflammation and parenchymal destruction → progressive fixed airflow limitation → exertional dyspnoea and chronic cough → hypoxaemia and eventual hypercapnia.',
      discriminator:
        'Minimal bronchodilator reversibility plus a heavy smoking history points to COPD; marked reversibility and symptom variability point to asthma.',
      commonTrap:
        'Do not anchor on wheeze alone. Wheeze occurs in both asthma and COPD, so spirometry is needed to confirm and characterise the obstruction.',
    },
    {
      pattern: 'Chronic productive cough with progressive dyspnoea',
      whyItMatters:
        'A cough productive of sputum on most days for at least 3 months over 2 consecutive years defines the chronic bronchitis phenotype.',
      discriminator:
        'Morning sputum in a smoker points to COPD; copious purulent sputum with recurrent infections and haemoptysis points to bronchiectasis.',
      commonTrap:
        'Dismissing a chronic "smoker\'s cough" as benign delays diagnosis and the chance to intervene early with cessation.',
    },
    {
      pattern: 'Signs of hyperinflation and increased work of breathing',
      whyItMatters:
        'Barrel chest, prolonged expiration, accessory muscle use, and pursed-lip breathing indicate air trapping and more advanced disease.',
      discriminator:
        'Hyperinflation and obstruction contrast with the basal crepitations, raised JVP, and oedema of heart failure.',
      commonTrap:
        'In a patient at risk of chronic CO₂ retention, hypoxaemia should be corrected with controlled oxygen, not reflexive high-flow oxygen.',
    },
  ],

  keySymptoms: [
    {
      symptom: 'Progressive exertional dyspnoea',
      significance:
        'The hallmark symptom of COPD; breathlessness that steadily worsens and limits activity reflects advancing airflow limitation and gas-exchange impairment.',
    },
    {
      symptom: 'Chronic productive cough',
      significance:
        'A persistent cough with sputum, often worse in the mornings, reflects mucus hypersecretion and chronic airway inflammation.',
    },
    {
      symptom: 'Wheeze and chest tightness',
      significance:
        'Expiratory wheeze indicates airflow obstruction; tightness can fluctuate and may worsen during exacerbations.',
    },
    {
      symptom: 'Reduced exercise tolerance and fatigue',
      significance:
        'Declining functional capacity is common and contributes to deconditioning, weight loss, and reduced quality of life.',
    },
    {
      symptom: 'Frequent winter chest infections or exacerbations',
      significance:
        'Recurrent acute deteriorations with increased dyspnoea, cough, or sputum purulence drive hospitalisation and accelerate decline.',
    },
  ],

  keySigns: [
    {
      finding: 'Barrel chest and hyperinflation',
      significance:
        'An increased anteroposterior chest diameter and hyper-resonance reflect air trapping and loss of elastic recoil.',
      discriminator:
        'Hyperinflation supports obstructive airway disease; basal crepitations with oedema suggest heart failure instead.',
    },
    {
      finding: 'Prolonged expiratory phase with wheeze',
      significance:
        'A lengthened expiratory phase and polyphonic wheeze indicate expiratory airflow limitation.',
    },
    {
      finding: 'Accessory muscle use and pursed-lip breathing',
      significance:
        'These signs reflect increased work of breathing and attempts to maintain airway patency during expiration.',
    },
    {
      finding: 'Hypoxaemia, with possible central cyanosis',
      significance:
        'A low oxygen saturation indicates impaired gas exchange; persistent hypoxaemia raises the question of long-term oxygen therapy.',
    },
    {
      finding: 'Signs of cor pulmonale in advanced disease',
      significance:
        'Raised JVP, peripheral oedema, and a parasternal heave can appear late from pulmonary hypertension and right heart strain.',
      discriminator:
        'These overlap with left heart failure, so interpret them alongside spirometry, imaging, and echocardiography.',
    },
  ],

  examPearls: [
    {
      type: 'physical',
      title: 'Hyperinflation tells you the chest is obstructed, not congested',
      content:
        'Look for an increased AP diameter, hyper-resonant percussion, reduced cricosternal distance, prolonged expiration, accessory muscle use, and pursed-lip breathing.',
      whyItMatters:
        'These bedside signs steer you toward obstructive airway disease and away from cardiac or restrictive causes of dyspnoea before any investigation returns.',
      discriminator:
        'Hyperinflation supports COPD; bibasal fine crackles with raised JVP and oedema support heart failure; fine velcro crackles support interstitial lung disease.',
      trapAvoided:
        'Do not assume every breathless older smoker is in heart failure; confirm the physiology with spirometry.',
    },
    {
      type: 'lab_reasoning',
      title: 'Post-bronchodilator spirometry is the diagnostic anchor',
      content:
        'COPD requires a post-bronchodilator FEV1/FVC below 0.70. FEV1 percent predicted then grades airflow limitation, and reversibility testing helps separate COPD from asthma.',
      whyItMatters:
        'A fixed ratio with minimal reversibility confirms COPD; significant reversibility or variability suggests asthma or asthma–COPD overlap.',
      managementImplication:
        'Severity grading and exacerbation history guide inhaler choice, pulmonary rehabilitation, and decisions about oxygen and escalation.',
    },
    {
      type: 'lab_reasoning',
      title: 'Read the blood gas for chronicity, not just numbers',
      content:
        'A raised CO₂ with a near-normal pH and a compensatory rise in bicarbonate indicates chronic, compensated type 2 respiratory failure rather than an acute decompensation.',
      whyItMatters:
        'Chronic CO₂ retention changes oxygen targets and raises the threshold for non-invasive ventilation in acute deterioration.',
      managementImplication:
        'Target oxygen saturations of 88–92% in patients at risk of CO₂ retention, and consider NIV for persistent hypercapnic acidosis during exacerbations.',
    },
    {
      type: 'MNEMONIC',
      title: 'COPD diagnostic checklist',
      content:
        'C — Chronic symptoms (cough, sputum, progressive dyspnoea); O — Obstruction confirmed on post-bronchodilator spirometry (FEV1/FVC < 0.70); P — Poorly reversible airflow limitation; D — Driver of damage identified (smoking, biomass, occupational exposure, or alpha-1 antitrypsin deficiency).',
      whyItMatters:
        'Keeps the diagnosis operational: COPD is confirmed by symptoms plus objective fixed obstruction plus a plausible exposure, not by clinical impression alone.',
      discriminator:
        'The checklist prompts you to test reversibility (asthma), consider alpha-1 antitrypsin in young or non-smoking patients, and exclude cardiac and restrictive causes.',
      trapAvoided:
        'Mnemonic content belongs here; scoringSystems is intentionally left empty to avoid duplicate frontend rendering.',
    },
  ],

  scoringSystems: [],

  investigations: [
    {
      test: 'Post-bronchodilator spirometry',
      interpretation:
        'FEV1/FVC below 0.70 after bronchodilator confirms airflow obstruction; FEV1 percent predicted grades severity from mild to very severe.',
      whyItMatters:
        'This is the diagnostic gate for COPD and is required before committing to the diagnosis.',
    },
    {
      test: 'Bronchodilator reversibility testing',
      interpretation:
        'Minimal reversibility supports fixed COPD obstruction; large reversibility or variability suggests asthma or an asthmatic component.',
      whyItMatters:
        'Distinguishing COPD from asthma changes treatment, particularly the role of inhaled corticosteroids.',
    },
    {
      test: 'Arterial blood gas',
      interpretation:
        'Identifies hypoxaemia and type 2 respiratory failure, and distinguishes chronic compensated from acute uncompensated CO₂ retention.',
      whyItMatters:
        'Guides oxygen targets, the need for non-invasive ventilation, and assessment for long-term oxygen therapy.',
    },
    {
      test: 'Chest radiograph',
      interpretation:
        'May show hyperinflation, flattened diaphragms, and bullae; importantly helps exclude malignancy, pneumonia, pneumothorax, and heart failure.',
      whyItMatters:
        'Excludes alternative or coexisting diagnoses, especially lung cancer in a heavy smoker.',
    },
    {
      test: 'Full blood count',
      interpretation:
        'May reveal secondary polycythaemia from chronic hypoxia or anaemia contributing to dyspnoea; eosinophil count can inform inhaled corticosteroid decisions.',
      whyItMatters:
        'Supports prognostication and personalises inhaler therapy.',
    },
    {
      test: 'BNP and echocardiography when heart failure is suspected',
      interpretation:
        'Helps separate or identify coexisting cardiac dysfunction and assess for pulmonary hypertension and cor pulmonale.',
      whyItMatters:
        'Breathlessness in older smokers is often multifactorial, and cardiac disease frequently coexists.',
    },
    {
      test: 'Alpha-1 antitrypsin level',
      interpretation:
        'A low level suggests alpha-1 antitrypsin deficiency, particularly with early-onset or basal-predominant emphysema.',
      whyItMatters:
        'Indicated in young patients, non- or light-smokers, or those with a family history, as it changes counselling and surveillance.',
    },
    {
      test: 'Sputum culture during exacerbations',
      interpretation:
        'Identifies bacterial pathogens in infective exacerbations and guides antibiotic choice in non-responders.',
      whyItMatters:
        'Targets therapy and flags resistant or unusual organisms.',
    },
  ],

  pitfalls: [
    {
      pitfall: 'Diagnosing COPD without spirometry',
      consequence:
        'Clinical impression alone overlaps with asthma, heart failure, and other conditions, leading to mislabelling and inappropriate therapy.',
    },
    {
      pitfall: 'Skipping reversibility testing and missing asthma or overlap',
      consequence:
        'Patients with a significant reversible component may be under-treated or denied appropriate inhaled corticosteroids.',
    },
    {
      pitfall: 'Giving uncontrolled high-flow oxygen in a CO₂ retainer',
      consequence:
        'In patients at risk of chronic hypercapnia, excessive oxygen can worsen CO₂ retention and precipitate respiratory acidosis and narcosis; target 88–92%.',
    },
    {
      pitfall: 'Attributing all symptoms to COPD and missing lung cancer',
      consequence:
        'New or changing symptoms, haemoptysis, or weight loss in a heavy smoker require imaging to exclude malignancy.',
    },
    {
      pitfall: 'Relying on antibiotics and steroids while ignoring smoking cessation',
      consequence:
        'Without cessation, disease progression continues; smoking cessation is the only intervention proven to slow FEV1 decline meaningfully.',
    },
    {
      pitfall: 'Not assessing for long-term oxygen therapy or cor pulmonale',
      consequence:
        'Chronically hypoxaemic patients who would benefit from LTOT may be missed, and right heart strain can go unrecognised.',
    },
  ],

  managementOverview: [
    {
      step: 'Smoking cessation and exposure reduction',
      rationale:
        'Stopping smoking is the single most effective intervention to slow disease progression and improve survival; offer behavioural support and pharmacotherapy.',
    },
    {
      step: 'Stepwise inhaled therapy',
      rationale:
        'Short-acting bronchodilators for relief, then long-acting bronchodilators (LAMA/LABA); add inhaled corticosteroids for eosinophilic or frequently exacerbating, asthmatic-feature phenotypes.',
    },
    {
      step: 'Pulmonary rehabilitation',
      rationale:
        'Structured exercise and education improve exercise capacity, dyspnoea, and quality of life, and reduce hospitalisations.',
    },
    {
      step: 'Vaccination and preventive care',
      rationale:
        'Influenza, pneumococcal, and COVID vaccinations reduce infective exacerbations and complications.',
    },
    {
      step: 'Manage exacerbations promptly',
      rationale:
        'Use controlled oxygen targeting 88–92%, nebulised bronchodilators, oral corticosteroids, antibiotics for infective exacerbations, and non-invasive ventilation for persistent hypercapnic acidosis.',
    },
    {
      step: 'Assess for long-term oxygen therapy',
      rationale:
        'In chronically hypoxaemic, stable, non-smoking patients meeting blood-gas criteria, LTOT improves survival; assess and treat cor pulmonale and comorbidities.',
    },
    {
      step: 'Escalate and consider advanced options in selected patients',
      rationale:
        'Severe, refractory, or rapidly declining disease warrants specialist input and consideration of lung volume reduction or transplantation in suitable candidates.',
    },
  ],

  differentialDistinguishers: [
    {
      diagnosis: 'Asthma',
      whyConfused:
        'Both cause expiratory wheeze and airflow obstruction, and asthma–COPD overlap is common in older smokers.',
      distinguishingPoint:
        'Asthma usually has earlier onset, atopy, symptom variability, and significant bronchodilator reversibility.',
      keySeparator:
        'Minimal post-bronchodilator reversibility with a heavy smoking history supports COPD over asthma.',
      classicTrap:
        'Treating fixed COPD obstruction as asthma can lead to inappropriate reliance on inhaled corticosteroids and missed cessation opportunities.',
    },
    {
      diagnosis: 'Congestive heart failure',
      whyConfused:
        'Heart failure causes progressive dyspnoea and can produce a "cardiac asthma" wheeze.',
      distinguishingPoint:
        'Heart failure features orthopnoea, paroxysmal nocturnal dyspnoea, raised JVP, oedema, and basal crepitations, with a restrictive or normal spirometry pattern.',
      keySeparator:
        'Obstructive spirometry and hyperinflation point to airway disease, even though the two frequently coexist.',
      classicTrap:
        'Do not interpret breathlessness and wheeze alone as heart failure; confirm with spirometry, imaging, and natriuretic peptides.',
    },
    {
      diagnosis: 'Bronchiectasis',
      whyConfused:
        'Both produce chronic productive cough and can show obstructive spirometry.',
      distinguishingPoint:
        'Bronchiectasis typically has copious purulent sputum, recurrent infections, haemoptysis, and coarse crackles, with characteristic HRCT changes.',
      keySeparator:
        'Smoking-driven fixed obstruction without large-volume purulent sputum or recurrent infection favours COPD.',
      classicTrap:
        'Missing coexisting bronchiectasis in a frequent exacerbator can lead to under-treatment of suppurative disease.',
    },
    {
      diagnosis: 'Lung cancer',
      whyConfused:
        'Heavy smokers with chronic cough are at high risk, and symptoms overlap.',
      distinguishingPoint:
        'Suspect malignancy with new or changing symptoms, haemoptysis, weight loss, or a focal abnormality on imaging.',
      keySeparator:
        'Diffuse airflow obstruction explains COPD symptoms, but malignancy must still be actively excluded with imaging.',
      classicTrap:
        'Attributing red-flag symptoms to COPD and delaying a chest X-ray or CT.',
    },
    {
      diagnosis: 'Interstitial lung disease',
      whyConfused:
        'ILD also causes progressive exertional dyspnoea and reduced exercise tolerance.',
      distinguishingPoint:
        'ILD shows a restrictive pattern with preserved or raised FEV1/FVC and fine end-inspiratory crackles.',
      keySeparator:
        'An obstructive ratio of 0.58 with wheeze and hyperinflation is the opposite of restrictive ILD physiology.',
      classicTrap:
        'Overlooking a mixed obstructive–restrictive picture in patients with combined emphysema and fibrosis.',
    },
  ],

  complications: [
    {
      complication: 'Acute exacerbations',
      whyItMatters:
        'Exacerbations, often infective, drive hospitalisation, accelerate lung function decline, and increase mortality.',
    },
    {
      complication: 'Type 2 respiratory failure and CO₂ narcosis',
      whyItMatters:
        'Worsening hypercapnia can cause confusion, drowsiness, and acidosis requiring non-invasive ventilation; uncontrolled oxygen can precipitate it.',
    },
    {
      complication: 'Cor pulmonale and pulmonary hypertension',
      whyItMatters:
        'Chronic hypoxia and lung destruction raise pulmonary pressures, leading to right heart strain, oedema, and reduced survival.',
    },
    {
      complication: 'Secondary polycythaemia',
      whyItMatters:
        'Chronic hypoxaemia drives erythropoiesis, increasing blood viscosity and thrombotic risk.',
    },
    {
      complication: 'Pneumothorax from bullae rupture',
      whyItMatters:
        'Rupture of emphysematous bullae can cause sudden deterioration and requires prompt recognition and drainage.',
    },
    {
      complication: 'Increased risk of lung cancer and systemic effects',
      whyItMatters:
        'Shared smoking exposure raises malignancy risk, and systemic effects include weight loss, cachexia, osteoporosis, and depression.',
    },
  ],

  recallPrompts: [
    {
      prompt: 'What spirometry result defines COPD?',
      answer:
        'A post-bronchodilator FEV1/FVC ratio below 0.70 with limited reversibility, confirming fixed airflow obstruction.',
    },
    {
      prompt: 'What is the single most effective intervention to slow disease progression?',
      answer:
        'Smoking cessation, which is the only measure shown to meaningfully slow the rate of FEV1 decline and improve survival.',
    },
    {
      prompt: 'Why target oxygen saturations of 88–92% in patients at risk of CO₂ retention?',
      answer:
        'Excessive oxygen can worsen CO₂ retention and precipitate respiratory acidosis and narcosis, so controlled oxygen is used.',
    },
    {
      prompt: 'When should alpha-1 antitrypsin deficiency be considered?',
      answer:
        'In young or non- or light-smoking patients, those with basal-predominant emphysema, or a positive family history.',
    },
    {
      prompt: 'What blood-gas picture suggests chronic rather than acute type 2 respiratory failure?',
      answer:
        'A raised CO₂ with a near-normal pH and a compensatory rise in bicarbonate, indicating chronic compensated hypercapnia.',
    },
  ],

  references: [],
};

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const canonicalName = 'copd';
  const displayLabel = 'COPD';
  const normalizedTerms = [
    canonicalName,
    displayLabel,
    'chronic obstructive pulmonary disease',
    'chronic obstructive airways disease',
    'chronic obstructive lung disease',
  ].map(normalizeClinicalText);

  const registry = await prisma.diagnosisRegistry.findFirst({
    where: {
      active: true,
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
    select: {
      id: true,
      canonicalName: true,
      canonicalNormalized: true,
      displayLabel: true,
    },
  });

  if (!registry) {
    throw new Error(
      `Cannot seed ${displayLabel}: active DiagnosisRegistry entry not found for any of ${normalizedTerms.join(', ')}. Create/review the registry separately before running this seed.`,
    );
  }

  const education = await prisma.diagnosisEducation.upsert({
    where: { diagnosisRegistryId: registry.id },
    update: {
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
    create: {
      diagnosisRegistryId: registry.id,
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

  const existingCases = await prisma.case.findMany({
    where: {
      diagnosisRegistryId: registry.id,
      proposedDiagnosisText: { in: [displayLabel, registry.displayLabel] },
    },
    orderBy: [{ approvedAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      currentRevisionId: true,
      publicNumber: true,
      title: true,
      dailyCases: { select: { id: true }, take: 1 },
    },
  });

  const reusableCase = existingCases.find((caseRecord) => caseRecord.dailyCases.length === 0);
  const scheduledDuplicate = existingCases.find((caseRecord) => caseRecord.dailyCases.length > 0);

  if (!reusableCase && scheduledDuplicate) {
    throw new Error(
      `Cannot seed ${displayLabel}: a scheduled case already exists for this registry (${scheduledDuplicate.id}, ${scheduledDuplicate.title}). Refusing to create a duplicate flagship inventory case.`,
    );
  }

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
      'Seeded frontend-aligned flagship COPD inventory case using existing registry lookup only. DailyCase scheduler should assign the actual daily slot.',
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
      'Frontend-aligned flagship COPD inventory revision using registry lookup and duplicate-safe case reuse.',
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
      validatorVersion: 'flagship-human-review:copd-v1',
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        note: 'Manual frontend-aligned COPD inventory case seeded with registry lookup only, supported clue types (history, symptom, hx, exam, vital, lab), mnemonic in examPearls, and duplicate-safe case reuse.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded frontend-aligned COPD:', {
    registryId: registry.id,
    registryDisplayLabel: registry.displayLabel,
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