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
  throw new Error('DATABASE_URL is required to run the pancreatitis seed.');
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
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 0, 6, 12, 0, 0));
const seedVersion = 'flagship-acute-pancreatitis-v1';

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
      'A 46-year-old man presents to the emergency department with severe epigastric pain that began 6 hours ago after a heavy meal and has been worsening since.',
  },
  {
    order: 1,
    type: 'symptom',
    value:
      'The pain radiates to his back, is partially relieved by leaning forward, and is accompanied by nausea and two episodes of vomiting.',
  },
  {
    order: 2,
    type: 'history',
    value:
      'He drinks approximately 30 units of alcohol per week and has had a similar but milder episode 8 months ago that resolved without investigation.',
  },
  {
    order: 3,
    type: 'exam',
    value:
      'Examination reveals epigastric tenderness with guarding; there is no jaundice, no palpable mass, and bowel sounds are reduced.',
  },
  {
    order: 4,
    type: 'lab',
    value:
      'Serum lipase is 1 840 U/L (reference <60 U/L); amylase is 920 U/L. CRP is 148 mg/L; WBC 14.2 × 10⁹/L; bilirubin and LFTs are normal.',
  },
  {
    order: 5,
    type: 'imaging',
    value:
      'Contrast-enhanced CT abdomen shows diffuse pancreatic oedema with peripancreatic fat stranding and a small amount of peripancreatic fluid, consistent with interstitial oedematous pancreatitis.',
  },
] as const;

const differentials = [
  'Peptic ulcer disease',
  'Acute cholecystitis',
  'Mesenteric ischaemia',
  'Aortic dissection',
];

// ─── Explanation ─────────────────────────────────────────────────────────────

const explanation = {
  diagnosis: 'Acute Pancreatitis',
  summary:
    'Severe epigastric pain radiating to the back, markedly elevated lipase, peripancreatic inflammation on CT, and a background of significant alcohol use confirm acute pancreatitis.',
  keyEvidence: [
    'Epigastric pain radiating to the back',
    'Pain relieved by leaning forward',
    'Serum lipase >3× upper limit of normal',
    'Elevated CRP and leucocytosis',
    'Peripancreatic fat stranding on CT',
    'Significant alcohol history',
  ],
  reasoning: [
    'Severe epigastric pain radiating to the back with relief on leaning forward is the classic positional signature of retroperitoneal pancreatic inflammation.',
    'Serum lipase more than 30 times the upper limit of normal has high specificity for acute pancreatitis and satisfies one of the Atlanta criteria.',
    'Normal bilirubin and LFTs make biliary obstruction less likely, pointing toward alcohol as the aetiology in this case.',
    'Elevated CRP and leucocytosis reflect systemic inflammation; CRP >150 mg/L at 48 hours is associated with severe disease.',
    'CT findings of diffuse pancreatic oedema with peripancreatic fat stranding confirm interstitial oedematous pancreatitis and exclude necrosis at this stage.',
    'A prior similar episode and chronic heavy alcohol use strongly support an alcoholic aetiology.',
  ],
  keyFindings: [
    'Epigastric pain radiating to the back',
    'Positional relief on leaning forward',
    'Lipase 1 840 U/L (>30× ULN)',
    'CRP 148 mg/L; leucocytosis',
    'Normal bilirubin and LFTs',
    'Peripancreatic oedema and fat stranding on CT',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Peptic ulcer disease',
      whyPlausibleEarly:
        'Epigastric pain after eating can suggest peptic ulcer disease, and perforated ulcer may cause peritonism.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'back radiation and relief on leaning forward',
          reason:
            'Posterior radiation with postural relief is characteristic of retroperitoneal inflammation, not ulcer disease.',
        },
        {
          clueOrder: 4,
          evidence: 'lipase >30× ULN',
          reason:
            'Marked lipase elevation is specific to pancreatic pathology and is not seen in peptic ulcer disease.',
        },
      ],
      finalReasonLessLikely:
        'The combination of back-radiating positional pain and markedly elevated pancreatic enzymes is inconsistent with peptic ulcer disease.',
    },
    {
      diagnosis: 'Acute cholecystitis',
      whyPlausibleEarly:
        'Right upper quadrant pain after a fatty meal, nausea, and vomiting overlap with acute cholecystitis.',
      ruledOutByClues: [
        {
          clueOrder: 3,
          evidence: 'epigastric rather than right upper quadrant tenderness',
          reason:
            'Acute cholecystitis typically produces RUQ tenderness and a positive Murphy sign rather than central epigastric guarding.',
        },
        {
          clueOrder: 4,
          evidence: 'normal bilirubin and LFTs with markedly elevated lipase',
          reason:
            'Isolated lipase elevation without bilirubin or hepatic enzyme rise argues against a biliary cause.',
        },
      ],
      finalReasonLessLikely:
        'Normal liver enzymes and bilirubin with epigastric localisation and markedly elevated lipase point away from acute cholecystitis.',
    },
    {
      diagnosis: 'Mesenteric ischaemia',
      whyPlausibleEarly:
        'Severe abdominal pain out of proportion to early examination findings can represent mesenteric ischaemia.',
      ruledOutByClues: [
        {
          clueOrder: 4,
          evidence: 'markedly elevated lipase and amylase',
          reason:
            'Pancreatic enzyme elevation is not a feature of mesenteric ischaemia; pain-enzyme dissociation would be expected if ischaemia were the cause.',
        },
        {
          clueOrder: 5,
          evidence: 'CT showing pancreatic oedema and peripancreatic fat stranding',
          reason:
            'CT directly demonstrates the pancreas as the source of pathology.',
        },
      ],
      finalReasonLessLikely:
        'The enzyme profile and CT findings localise the pathology to the pancreas, making mesenteric ischaemia incompatible.',
    },
    {
      diagnosis: 'Aortic dissection',
      whyPlausibleEarly:
        'Severe tearing abdominal or back pain with rapid onset can mimic aortic dissection.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'positional relief on leaning forward',
          reason:
            'Aortic dissection pain is typically constant, tearing, and not postural.',
        },
        {
          clueOrder: 4,
          evidence: 'markedly elevated lipase',
          reason:
            'Pancreatic enzyme elevation does not occur in aortic dissection.',
        },
      ],
      finalReasonLessLikely:
        'The postural component and specific enzyme pattern are inconsistent with aortic dissection.',
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
  title: 'Acute Pancreatitis',

  summary: {
    definition:
      'Acute pancreatitis is an acute inflammatory process of the pancreas caused by premature activation of digestive enzymes within the gland, leading to autodigestion and a systemic inflammatory response.',
    highYieldTakeaway:
      'Think acute pancreatitis in any patient with severe epigastric pain radiating to the back — especially after alcohol or a fatty meal. Confirm with lipase >3× ULN and CT when the diagnosis is uncertain.',
  },

  recognitionPattern: [
    {
      pattern: 'Epigastric pain radiating to the back',
      whyItMatters:
        'The retroperitoneal position of the pancreas means inflammation radiates posteriorly and is partially relieved by leaning forward.',
      progression:
        'Sudden-onset epigastric pain → back radiation → postural relief → nausea and vomiting → enzyme rise → systemic inflammatory response.',
      discriminator:
        'Posterior radiation with postural relief is strongly associated with retroperitoneal inflammation and is not a feature of peptic ulcer disease or cholecystitis.',
      commonTrap:
        'The pain may be severe from the outset without clear localisation; early peritonism can mask the classic distribution.',
    },
    {
      pattern: 'Precipitant history — alcohol or gallstones',
      whyItMatters:
        'Gallstones (40–70%) and alcohol (25–35%) account for most cases. Identifying the cause guides secondary prevention.',
      discriminator:
        'Normal bilirubin and LFTs in a heavy drinker strongly favour alcohol as the aetiology; elevated bilirubin with dilated ducts favours gallstones.',
      commonTrap:
        'Up to 20% of cases are idiopathic; do not dismiss the diagnosis if no precipitant is immediately apparent.',
    },
    {
      pattern: 'Epigastric guarding and reduced bowel sounds',
      whyItMatters:
        'Peripancreatic inflammation irritates the parietal peritoneum and causes a localised ileus.',
      discriminator:
        'Generalised peritonism or absent bowel sounds should raise concern for complications such as perforation or necrosis.',
      commonTrap:
        'Physical findings can be deceptively mild early in the course; do not underestimate severity based on examination alone.',
    },
  ],

  keySymptoms: [
    {
      symptom: 'Severe epigastric pain',
      significance:
        'The hallmark symptom; typically sudden in onset, constant, and severe — often described as the worst pain the patient has experienced.',
    },
    {
      symptom: 'Back radiation',
      significance:
        'Retroperitoneal extension of inflammation causes pain to radiate to the mid-back; relief on leaning forward is a useful positional clue.',
    },
    {
      symptom: 'Nausea and vomiting',
      significance:
        'Present in most patients; vomiting does not relieve the pain, distinguishing it from some other causes of epigastric pain.',
    },
    {
      symptom: 'Anorexia',
      significance:
        'Universal in acute pancreatitis; enteral feeding decisions should be made early in severe disease.',
    },
  ],

  keySigns: [
    {
      finding: 'Epigastric tenderness and guarding',
      significance:
        'Localised peritonism reflecting peripancreatic inflammation; the degree of guarding may underestimate severity.',
      discriminator:
        'More central than right upper quadrant tenderness of cholecystitis.',
    },
    {
      finding: "Grey Turner's sign",
      significance:
        'Flank bruising from retroperitoneal haemorrhage tracking to the flanks; indicates haemorrhagic or necrotising pancreatitis.',
      urgency:
        "Rare but indicates severe disease; escalate immediately if Grey Turner's or Cullen's sign is present.",
    },
    {
      finding: "Cullen's sign",
      significance:
        'Periumbilical bruising from haemorrhage tracking along the falciform ligament; also suggests haemorrhagic pancreatitis.',
    },
    {
      finding: 'Reduced or absent bowel sounds',
      significance:
        'Paralytic ileus secondary to retroperitoneal inflammation; prolonged ileus may suggest developing complications.',
    },
  ],

  examPearls: [
    {
      type: 'physical',
      title: 'Leaning-forward sign',
      content:
        'Ask the patient to sit forward or adopt the foetal position; partial relief of pain in this position supports a retroperitoneal source.',
      whyItMatters:
        'A simple bedside manoeuvre that increases pre-test probability of pancreatic pathology.',
      discriminator:
        'Ulcer and cholecystitis pain is not typically postural.',
      trapAvoided:
        'Absence of postural relief does not exclude pancreatitis, especially in severe disease with peritonism.',
    },
    {
      type: 'physical',
      title: "Grey Turner's and Cullen's signs",
      content:
        "Inspect the flanks and periumbilical area for ecchymosis. Grey Turner's affects the flanks; Cullen's affects the periumbilical area.",
      whyItMatters:
        'Both indicate retroperitoneal haemorrhage and correlate with severe necrotising disease.',
      discriminator:
        'Their presence should immediately escalate the severity assessment and CT imaging.',
      managementImplication:
        'Requires ICU-level monitoring, early CT, and consideration of interventional radiology or surgery.',
    },
    {
      type: 'nutritional',
      title: 'Assess for signs of chronic alcohol use',
      content:
        'Look for palmar erythema, Dupuytren contracture, parotid enlargement, spider naevi, and hepatomegaly.',
      whyItMatters:
        'Chronic alcohol use is the second most common aetiology and guides secondary prevention counselling.',
      managementImplication:
        'Alcohol cessation support and thiamine supplementation should be initiated in alcohol-related pancreatitis.',
    },
  ],

  // ─── PANCREAS mnemonic ───────────────────────────────────────────────────────
  // toMnemonicCardsFromScoringSystems reads record.mnemonic via normalizeMnemonicValue,
  // which calls normalizeMnemonicExpansion on mnemonic.expansion.
  // Each entry must use { letter, meaning, note } — the exact fields MnemonicLearningCard renders.
  scoringSystems: [
    {
      name: 'PANCREAS',
      use: 'High-yield mnemonic for acute pancreatitis causes and severity assessment',
      mnemonic: {
        name: 'PANCREAS',
        useCase: 'Recalls the key causes, diagnostic criteria, and management priorities in acute pancreatitis.',
        expansion: [
          {
            letter: 'P',
            meaning: 'Precipitant — gallstones or alcohol',
            note: 'Gallstones (40–70%) and alcohol (25–35%) account for most cases; identify the cause to guide secondary prevention.',
          },
          {
            letter: 'A',
            meaning: 'Amylase / lipase — >3× ULN confirms diagnosis',
            note: 'Lipase preferred: higher specificity and remains elevated longer. >3× ULN satisfies one Atlanta criterion.',
          },
          {
            letter: 'N',
            meaning: 'Necrosis — contrast CT to detect it',
            note: 'Non-enhancing pancreatic tissue on CECT indicates necrosis; infected necrosis carries >20% mortality.',
          },
          {
            letter: 'C',
            meaning: 'CRP >150 mg/L at 48 h — severity marker',
            note: 'Independent predictor of severe disease; use with clinical assessment to guide escalation to HDU/ICU.',
          },
          {
            letter: 'R',
            meaning: 'Ranson / BISAP / APACHE-II — severity scoring',
            note: 'BISAP can be calculated at admission; Ranson criteria require 48-hour data.',
          },
          {
            letter: 'E',
            meaning: 'Early fluids and enteral feeding',
            note: 'Lactated Ringer preferred. Early enteral feeding within 24–48 h reduces infectious complications.',
          },
          {
            letter: 'A',
            meaning: 'Antibiotics — only for confirmed infected necrosis',
            note: 'Prophylactic antibiotics are not recommended; reserve for infected pancreatic necrosis.',
          },
          {
            letter: 'S',
            meaning: 'Systemic complications — SIRS, ARDS, AKI',
            note: 'Persistent organ failure >48 hours defines severe disease; monitor oxygen saturation, urine output, and renal function.',
          },
        ],
      },
    },
  ],

  investigations: [
    {
      test: 'Serum lipase (preferred) and amylase',
      interpretation:
        'Lipase >3× ULN satisfies one of the Atlanta diagnostic criteria and has higher specificity than amylase. Amylase may normalise within 24–48 hours; lipase remains elevated longer.',
      whyItMatters:
        'First-line biochemical test; levels >3× ULN in the context of compatible pain are sufficient to diagnose acute pancreatitis without imaging in most cases.',
    },
    {
      test: 'LFTs, bilirubin, and GGT',
      interpretation:
        'Elevated bilirubin and transaminases with a dilated common bile duct suggest gallstone pancreatitis and may indicate cholangitis requiring urgent ERCP.',
      whyItMatters:
        'Differentiates biliary from alcoholic aetiology and identifies patients needing early endoscopic intervention.',
    },
    {
      test: 'Contrast-enhanced CT abdomen (CECT)',
      interpretation:
        'Identifies pancreatic necrosis (non-enhancing tissue), peripancreatic fluid collections, and local complications. CT Severity Index guides prognostication.',
      whyItMatters:
        'Not required for diagnosis in straightforward cases but essential when diagnosis is uncertain, clinical deterioration occurs, or severe disease is suspected.',
    },
    {
      test: 'Abdominal ultrasound',
      interpretation:
        'Identifies gallstones, biliary dilation, and choledocholithiasis. The pancreas is often poorly visualised due to overlying bowel gas.',
      whyItMatters:
        'First-line imaging to identify a biliary aetiology; should be performed in all patients with acute pancreatitis.',
    },
    {
      test: 'CRP at 48 hours',
      interpretation:
        'CRP >150 mg/L at 48 hours predicts severe pancreatitis with reasonable sensitivity and specificity.',
      whyItMatters:
        'Guides escalation from ward to high-dependency or ICU-level care when combined with clinical assessment.',
    },
    {
      test: 'Calcium, triglycerides, IgG4',
      interpretation:
        'Hypercalcaemia, hypertriglyceridaemia (>11 mmol/L), and elevated IgG4 (autoimmune pancreatitis) are rarer but important and treatable causes.',
      whyItMatters:
        'Identifies uncommon aetiologies that require specific management beyond supportive care.',
    },
  ],

  pitfalls: [
    {
      pitfall: 'Diagnosing pancreatitis without measuring lipase',
      consequence:
        'Amylase alone lacks specificity; lipase should always be measured and interpreted against the local reference range.',
    },
    {
      pitfall: 'Underestimating severity based on enzyme levels alone',
      consequence:
        'Enzyme levels do not correlate with disease severity. A patient with a lipase of 500 U/L may develop severe necrotising pancreatitis while a lipase of 2 000 U/L may follow an uncomplicated course.',
    },
    {
      pitfall: 'Failing to perform early ultrasound',
      consequence:
        'Missing gallstone aetiology delays cholecystectomy planning and risks recurrent attacks or progression to ascending cholangitis.',
    },
    {
      pitfall: 'Prescribing prophylactic antibiotics',
      consequence:
        'No evidence supports prophylactic antibiotics in acute pancreatitis; indiscriminate use promotes resistance and fungal superinfection.',
    },
    {
      pitfall: 'Delaying enteral feeding in severe disease',
      consequence:
        'Prolonged fasting increases gut permeability, bacterial translocation, and infectious complications. Early enteral feeding (within 24–48 h) is preferred over TPN.',
    },
  ],

  managementOverview: [
    {
      step: 'IV fluid resuscitation',
      rationale:
        'Aggressive early fluid replacement (250–500 mL/h initially) with Lactated Ringer is preferred over normal saline and reduces pancreatic necrosis by maintaining microcirculation.',
    },
    {
      step: 'Analgesia and antiemetics',
      rationale:
        'Adequate analgesia with opioids is appropriate; withholding analgesia does not aid diagnosis and increases distress. Ondansetron or metoclopramide for nausea.',
    },
    {
      step: 'Nil by mouth then early enteral feeding',
      rationale:
        'Keep nil by mouth initially for comfort; restart enteral feeding as soon as tolerated (or within 24–48 h via NGT in severe disease) to protect the gut barrier.',
    },
    {
      step: 'Severity assessment and monitoring',
      rationale:
        'Calculate BISAP or Ranson score; measure CRP at 48 hours; monitor urine output, oxygen saturation, and renal function. Escalate to HDU/ICU if organ dysfunction develops.',
    },
    {
      step: 'Biliary workup and ERCP if indicated',
      rationale:
        'Perform ultrasound in all patients. Urgent ERCP within 24–48 hours is indicated if concurrent cholangitis or persistent biliary obstruction is present.',
    },
    {
      step: 'Cholecystectomy before discharge',
      rationale:
        'Patients with gallstone pancreatitis should undergo same-admission or early interval cholecystectomy to prevent recurrence (recurrence risk ~30% without surgery).',
    },
    {
      step: 'Manage complications',
      rationale:
        'Necrotising pancreatitis, infected necrosis, walled-off necrosis, and pseudocysts may require step-up intervention: antibiotics, endoscopic drainage, or surgical necrosectomy.',
    },
  ],

  differentialDistinguishers: [
    {
      diagnosis: 'Peptic ulcer disease',
      whyConfused:
        'Epigastric pain after meals and nausea overlap significantly with pancreatitis, especially before enzyme results are available.',
      distinguishingPoint:
        'PUD pain is often burning, relieved by antacids, and associated with Helicobacter pylori risk factors; it does not cause back radiation or enzyme elevation.',
      keySeparator:
        'Back radiation with postural relief and lipase >3× ULN are specific to pancreatic pathology.',
      classicTrap:
        'Do not treat empirically for PUD and discharge before checking lipase in a patient with epigastric pain and vomiting.',
    },
    {
      diagnosis: 'Acute cholecystitis',
      whyConfused:
        'Fatty meal precipitant, right upper quadrant or epigastric pain, nausea, and vomiting are shared features. Gallstone pancreatitis may coexist with cholecystitis.',
      distinguishingPoint:
        'Cholecystitis causes right upper quadrant tenderness, a positive Murphy sign, and fever with raised bilirubin; it does not cause lipase elevation unless concurrent pancreatitis is present.',
      keySeparator:
        'Markedly elevated lipase with epigastric rather than RUQ localisation and normal bilirubin distinguishes pancreatitis from isolated cholecystitis.',
      classicTrap:
        'Gallstone pancreatitis can cause transient bilirubin elevation; do not exclude pancreatitis if bilirubin is mildly raised.',
    },
    {
      diagnosis: 'Mesenteric ischaemia',
      whyConfused:
        'Sudden severe abdominal pain, particularly in older or vascular patients, raises mesenteric ischaemia as an early concern.',
      distinguishingPoint:
        'Mesenteric ischaemia characteristically causes pain out of proportion to examination findings and does not elevate pancreatic enzymes.',
      keySeparator:
        'Enzyme profile and CT findings localise pathology to the pancreas in acute pancreatitis; ischaemia requires CT angiography and shows bowel wall changes.',
    },
    {
      diagnosis: 'Aortic dissection',
      whyConfused:
        'Sudden severe back pain with epigastric involvement can mimic aortic dissection, particularly type B dissection.',
      distinguishingPoint:
        'Dissection pain is typically tearing, migrating, and associated with pulse or blood pressure differentials; it does not cause pancreatic enzyme elevation.',
      keySeparator:
        'Postural relief and isolated enzyme elevation are not features of aortic dissection.',
      classicTrap:
        'In the haemodynamically unstable patient with back pain, exclude aortic dissection before attributing symptoms to pancreatitis.',
    },
  ],

  complications: [
    {
      complication: 'Necrotising pancreatitis',
      whyItMatters:
        'Non-enhancing pancreatic tissue on CT indicates necrosis; infected necrosis carries mortality >20% and requires step-up management.',
    },
    {
      complication: 'Pancreatic pseudocyst',
      whyItMatters:
        'Fluid collections that fail to resolve may mature into pseudocysts over 4–6 weeks; symptomatic pseudocysts require endoscopic or surgical drainage.',
    },
    {
      complication: 'Acute respiratory distress syndrome (ARDS)',
      whyItMatters:
        'Cytokine-mediated pulmonary injury can develop within 24–48 hours; early supplemental oxygen and monitoring of oxygen saturation are essential.',
    },
    {
      complication: 'Acute kidney injury',
      whyItMatters:
        'Volume depletion and cytokine injury cause AKI; aggressive early fluid resuscitation and urine output monitoring are the key preventive measures.',
    },
    {
      complication: 'Splenic vein thrombosis',
      whyItMatters:
        'Peripancreatic inflammation can thrombose the splenic vein, causing segmental portal hypertension and gastric varices.',
    },
  ],

  recallPrompts: [
    {
      prompt: 'What enzyme is preferred over amylase for diagnosing acute pancreatitis, and why?',
      answer:
        'Serum lipase — it has higher specificity and remains elevated longer (3–5 days) than amylase (24–48 hours), making it more useful in delayed presentations.',
    },
    {
      prompt: 'What are the two most common causes of acute pancreatitis?',
      answer:
        'Gallstones (40–70%) and alcohol (25–35%). Together they account for most cases; always identify the aetiology to guide secondary prevention.',
    },
    {
      prompt: 'What CRP threshold at 48 hours predicts severe acute pancreatitis?',
      answer:
        'CRP >150 mg/L at 48 hours is an independent predictor of severe disease and guides escalation to HDU or ICU monitoring.',
    },
    {
      prompt: 'Are prophylactic antibiotics recommended in acute pancreatitis?',
      answer:
        'No. Prophylactic antibiotics have not been shown to reduce mortality or infectious complications. They are reserved for confirmed or strongly suspected infected pancreatic necrosis.',
    },
    {
      prompt: 'What is the preferred IV fluid in acute pancreatitis resuscitation?',
      answer:
        'Lactated Ringer (Hartmann\'s solution) is preferred over normal saline; it reduces the risk of SIRS and metabolic acidosis.',
    },
    {
      prompt: 'Name the PANCREAS mnemonic features for acute pancreatitis.',
      answer:
        'Precipitant (gallstones/alcohol), Amylase/lipase >3× ULN, Necrosis on CT, CRP >150 at 48 h, Ranson/BISAP scoring, Early fluids and enteral feeding, Antibiotics only for infected necrosis, Systemic complications (SIRS/ARDS/AKI).',
    },
  ],

  references: [],
};

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const canonicalName = 'acute pancreatitis';
  const displayLabel = 'Acute Pancreatitis';
  const canonicalNormalized = normalizeClinicalText(canonicalName);

  const registry = await prisma.diagnosisRegistry.upsert({
    where: { canonicalNormalized },
    update: {
      canonicalName,
      displayLabel,
      status: DiagnosisRegistryStatus.ACTIVE,
      active: true,
      specialty: 'Gastroenterology',
      subspecialty: 'Pancreas',
      category: 'Inflammatory',
      bodySystem: 'Gastrointestinal',
      organSystem: 'Pancreas',
      difficultyBand: DiagnosisDifficultyBand.BASIC,
      rarityBand: DiagnosisRarityBand.COMMON,
      clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
      ageGroup: DiagnosisAgeGroup.ADULT,
      urgencyLevel: DiagnosisUrgencyLevel.URGENT,
      onboardingStatus: 'READY_FOR_REVIEW',
      isPlayable: true,
      isGeneratable: true,
      preferredClueTypes: ['history', 'symptom', 'exam', 'lab', 'imaging'],
      excludedClueTypes: [],
      searchPriority: 20,
      notes:
        'Common acute surgical abdomen presenting with epigastric pain radiating to the back, elevated lipase, and peripancreatic inflammation. Two most common causes are gallstones and alcohol.',
    },
    create: {
      canonicalName,
      canonicalNormalized,
      displayLabel,
      status: DiagnosisRegistryStatus.ACTIVE,
      active: true,
      specialty: 'Gastroenterology',
      subspecialty: 'Pancreas',
      category: 'Inflammatory',
      bodySystem: 'Gastrointestinal',
      organSystem: 'Pancreas',
      difficultyBand: DiagnosisDifficultyBand.BASIC,
      rarityBand: DiagnosisRarityBand.COMMON,
      clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
      ageGroup: DiagnosisAgeGroup.ADULT,
      urgencyLevel: DiagnosisUrgencyLevel.URGENT,
      onboardingStatus: 'READY_FOR_REVIEW',
      onboardingStartedAt: now,
      isPlayable: true,
      isGeneratable: true,
      preferredClueTypes: ['history', 'symptom', 'exam', 'lab', 'imaging'],
      excludedClueTypes: [],
      searchPriority: 20,
      notes:
        'Common acute surgical abdomen presenting with epigastric pain radiating to the back, elevated lipase, and peripancreatic inflammation. Two most common causes are gallstones and alcohol.',
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
      term: 'acute pancreatitis',
      kind: DiagnosisAliasKind.ACCEPTED,
      acceptedForMatch: true,
      rank: 95,
    },
    {
      term: 'pancreatitis',
      kind: DiagnosisAliasKind.ACCEPTED,
      acceptedForMatch: true,
      rank: 85,
    },
    {
      term: 'alcoholic pancreatitis',
      kind: DiagnosisAliasKind.ACCEPTED,
      acceptedForMatch: true,
      rank: 75,
    },
    {
      term: 'gallstone pancreatitis',
      kind: DiagnosisAliasKind.ACCEPTED,
      acceptedForMatch: true,
      rank: 75,
    },
    {
      term: 'pancreatic inflammation',
      kind: DiagnosisAliasKind.SEARCH_ONLY,
      acceptedForMatch: false,
      rank: 30,
    },
  ];

  const seenAliasNormalizations = new Set<string>();

  for (const aliasSeed of aliasSeeds) {
    const term = aliasSeed.term;
    const normalizedTerm = normalizeClinicalText(term);
    if (seenAliasNormalizations.has(normalizedTerm)) continue;
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
      'Seeded frontend-aligned flagship Acute Pancreatitis inventory case. DailyCase scheduler should assign the actual daily slot.',
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
      'Frontend-aligned flagship Acute Pancreatitis inventory revision for DailyCase scheduler assignment.',
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
      validatorVersion: 'flagship-human-review:acute-pancreatitis-v1',
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        note: 'Manual frontend-aligned Acute Pancreatitis inventory case seeded for DailyCase scheduler assignment.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded frontend-aligned Acute Pancreatitis:', {
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