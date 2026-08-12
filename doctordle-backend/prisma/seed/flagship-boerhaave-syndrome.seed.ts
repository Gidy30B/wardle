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

const databaseUrl = resolvePgConnectionString(process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run the Boerhaave syndrome seed.');
}

const pool = new Pool({ connectionString: databaseUrl, max: 1 });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

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
const inventoryPlaceholderDate = new Date(Date.UTC(2099, 0, 19, 12, 0, 0));
const seedVersion = 'flagship-boerhaave-syndrome-v1';

const canonicalName = 'boerhaave syndrome';
const displayLabel = 'Boerhaave Syndrome';
const caseTitle =
  'Spontaneous Esophageal Perforation Following Forceful Vomiting';

const aliasTerms = [
  'Boerhaave Syndrome',
  "Boerhaave's Syndrome",
  'boerhaave syndrome',
  'spontaneous esophageal perforation',
  'spontaneous oesophageal perforation',
  'spontaneous esophageal rupture',
  'spontaneous oesophageal rupture',
  'esophageal perforation',
  'oesophageal perforation',
  'esophageal rupture',
  'oesophageal rupture',
  'effort rupture of the esophagus',
  'effort rupture of the oesophagus',
];

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 49-year-old man develops sudden severe lower retrosternal and epigastric pain immediately after repeated forceful vomiting following a large meal.',
  },
  {
    order: 1,
    type: 'symptom',
    value:
      'The pain radiates to the back and left shoulder and is accompanied by dyspnea and painful swallowing. He has no hematemesis.',
  },
  {
    order: 2,
    type: 'vitals',
    value:
      'Temperature is 38.3 C, heart rate 128/min, blood pressure 88/54 mmHg, respiratory rate 30/min, and oxygen saturation 90% on room air.',
  },
  {
    order: 3,
    type: 'exam',
    value:
      'He appears acutely ill and diaphoretic. Breath sounds are reduced at the left base, and palpable crepitus extends across the lower neck and upper chest.',
  },
  {
    order: 4,
    type: 'imaging',
    value:
      'Chest radiography shows a left hydropneumothorax, left pleural effusion, and streaks of mediastinal air.',
  },
  {
    order: 5,
    type: 'imaging',
    value:
      'Contrast-enhanced CT of the chest with water-soluble oral contrast demonstrates a distal thoracic esophageal wall defect, extraluminal contrast, pneumomediastinum, mediastinal fluid, and contamination of the left pleural cavity.',
  },
] as const;

const differentials = [
  'Acute Coronary Syndrome',
  'Acute Aortic Syndrome',
  'Perforated Peptic Ulcer',
  'Spontaneous Pneumothorax',
  'Mallory-Weiss Tear',
];

const explanation = {
  diagnosis: displayLabel,
  summary:
    'Forceful vomiting followed immediately by severe chest and epigastric pain, rapid septic deterioration, subcutaneous emphysema, a left hydropneumothorax, pneumomediastinum, and direct CT evidence of contrast extravasation from the distal esophagus establishes spontaneous full-thickness esophageal perforation.',
  reasoning: [
    'The abrupt onset of severe chest and upper abdominal pain immediately after repeated forceful vomiting is the defining historical pattern of effort-related esophageal rupture.',
    'Pain radiating to the back with dyspnea and odynophagia localizes the process to the thoracic esophagus and mediastinum rather than an isolated mucosal tear.',
    'Fever, tachycardia, hypotension, tachypnea, and hypoxemia indicate evolving mediastinal and pleural contamination with sepsis.',
    'Subcutaneous crepitus demonstrates air tracking from the mediastinum into the cervical and chest-wall soft tissues.',
    'A left hydropneumothorax with pneumomediastinum is a high-risk radiographic pattern for distal thoracic esophageal perforation.',
    'Extraluminal oral contrast through a visible distal esophageal defect directly confirms the diagnosis and defines an uncontained thoracic leak requiring urgent source control.',
  ],
  keyFindings: [
    'Repeated forceful vomiting',
    'Sudden severe retrosternal and epigastric pain',
    'Pain radiating to the back and left shoulder',
    'Dyspnea',
    'Odynophagia',
    'No hematemesis',
    'Fever',
    'Tachycardia',
    'Hypotension',
    'Tachypnea',
    'Hypoxemia',
    'Subcutaneous emphysema',
    'Reduced left basal breath sounds',
    'Left hydropneumothorax',
    'Pneumomediastinum',
    'Mediastinal fluid',
    'Extraluminal oral contrast',
    'Distal thoracic esophageal wall defect',
    'Left pleural contamination',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'Acute Coronary Syndrome',
      whyPlausibleEarly:
        'Acute coronary syndrome can cause severe retrosternal pain, diaphoresis, dyspnea, and hypotension.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence: 'pain began immediately after repeated forceful vomiting',
          reason:
            'The direct temporal relationship to forceful vomiting strongly suggests pressure-related esophageal injury rather than myocardial ischemia.',
        },
        {
          clueOrder: 4,
          evidence: 'left hydropneumothorax with mediastinal air',
          reason:
            'Pleural air-fluid contamination and pneumomediastinum are not explained by acute coronary syndrome.',
        },
        {
          clueOrder: 5,
          evidence: 'contrast extravasates through a distal esophageal wall defect',
          reason:
            'Direct visualization of an esophageal leak establishes a non-cardiac structural cause.',
        },
      ],
      finalReasonLessLikely:
        'Acute coronary syndrome does not explain subcutaneous emphysema, pneumomediastinum, hydropneumothorax, or direct esophageal contrast leakage.',
    },
    {
      diagnosis: 'Acute Aortic Syndrome',
      whyPlausibleEarly:
        'Aortic dissection or rupture can produce sudden severe chest pain radiating to the back with shock.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence: 'onset immediately after repeated forceful vomiting',
          reason:
            'The precipitating event is characteristic of effort rupture of the esophagus.',
        },
        {
          clueOrder: 3,
          evidence: 'palpable cervical and upper-chest crepitus',
          reason:
            'Subcutaneous emphysema points toward an aerodigestive tract leak rather than primary aortic disease.',
        },
        {
          clueOrder: 5,
          evidence: 'distal esophageal wall defect with extraluminal oral contrast',
          reason:
            'The CT directly identifies the source as the esophagus.',
        },
      ],
      finalReasonLessLikely:
        'Acute aortic syndrome remains an early life-threatening mimic, but CT demonstrates an esophageal perforation rather than aortic pathology.',
    },
    {
      diagnosis: 'Perforated Peptic Ulcer',
      whyPlausibleEarly:
        'Perforated peptic ulcer can cause sudden epigastric pain, shock, and sepsis.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'retrosternal pain, dyspnea, and painful swallowing',
          reason:
            'Thoracic and swallowing symptoms are more consistent with esophageal and mediastinal injury.',
        },
        {
          clueOrder: 3,
          evidence: 'subcutaneous emphysema over the neck and upper chest',
          reason:
            'Cervical subcutaneous air is not a typical feature of isolated gastroduodenal perforation.',
        },
        {
          clueOrder: 5,
          evidence: 'oral contrast leaks from the distal thoracic esophagus',
          reason:
            'The site of perforation is directly demonstrated above the gastroesophageal junction.',
        },
      ],
      finalReasonLessLikely:
        'Perforated peptic ulcer would more typically produce pneumoperitoneum and generalized peritonism rather than an esophageal wall defect with mediastinal and left pleural contamination.',
    },
    {
      diagnosis: 'Spontaneous Pneumothorax',
      whyPlausibleEarly:
        'Pneumothorax can cause abrupt chest pain, dyspnea, hypoxemia, and reduced unilateral breath sounds.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence: 'severe pain began after repeated forceful vomiting',
          reason:
            'The vomiting trigger suggests an esophageal pressure injury rather than primary pleural rupture.',
        },
        {
          clueOrder: 4,
          evidence: 'hydropneumothorax, pleural effusion, and pneumomediastinum',
          reason:
            'The combined air-fluid and mediastinal pattern suggests contamination from a hollow viscus.',
        },
        {
          clueOrder: 5,
          evidence:
            'extraluminal contrast and mediastinal fluid around an esophageal defect',
          reason:
            'These findings cannot be explained by an isolated spontaneous pneumothorax.',
        },
      ],
      finalReasonLessLikely:
        'The pleural air is secondary to esophageal rupture rather than a primary spontaneous pneumothorax.',
    },
    {
      diagnosis: 'Mallory-Weiss Tear',
      whyPlausibleEarly:
        'Mallory-Weiss tear also follows repeated retching or vomiting.',
      ruledOutByClues: [
        {
          clueOrder: 1,
          evidence: 'severe chest pain and odynophagia without hematemesis',
          reason:
            'Mallory-Weiss tear is a mucosal laceration that usually presents with upper gastrointestinal bleeding rather than severe thoracic sepsis.',
        },
        {
          clueOrder: 3,
          evidence: 'subcutaneous emphysema',
          reason:
            'Air escape into the mediastinum requires a transmural perforation, not a superficial mucosal tear.',
        },
        {
          clueOrder: 5,
          evidence:
            'full-thickness distal esophageal defect with contrast extravasation',
          reason:
            'This directly distinguishes Boerhaave syndrome from a mucosal Mallory-Weiss lesion.',
        },
      ],
      finalReasonLessLikely:
        'Mallory-Weiss tear does not cause full-thickness leakage, pneumomediastinum, pleural contamination, or septic shock.',
    },
  ],
  managementPearl:
    'Treat suspected spontaneous esophageal perforation as a time-critical surgical emergency: keep the patient nil by mouth, resuscitate, start broad-spectrum intravenous antimicrobial therapy, obtain urgent upper gastrointestinal or thoracic surgical input, and achieve prompt pleural and mediastinal source control. This unstable patient has an uncontained thoracic leak and is not a candidate for observation alone.',
  generationQuality: {
    contentTier: 'FLAGSHIP',
    seedVersion,
    humanReviewed: true,
    discriminatorStrength: 'HIGH',
    expectedTeachingPoints: [
      'Forceful vomiting followed by sudden severe chest pain is the central recognition pattern for Boerhaave syndrome',
      'Mackler triad is classic but absence of one component does not exclude perforation',
      'Subcutaneous emphysema and pneumomediastinum indicate extraluminal air',
      'A left hydropneumothorax is an important clue to distal thoracic esophageal rupture',
      'CT with intravenous and water-soluble oral contrast defines the leak and contamination',
      'Uncontained thoracic perforation with shock requires urgent multidisciplinary source control',
    ],
    competencyDomains: [
      'General Surgery',
      'Upper Gastrointestinal Surgery',
      'Thoracic Surgery',
      'Emergency Medicine',
      'Critical Care',
      'Clinical Reasoning',
    ],
  },
};

const educationForFrontend = {
  title: displayLabel,
  summary: {
    definition:
      'Boerhaave syndrome is a spontaneous full-thickness esophageal rupture caused by a sudden rise in intraesophageal pressure, most often during forceful vomiting or retching.',
    highYieldTakeaway:
      'Suspect Boerhaave syndrome when forceful vomiting is followed by abrupt severe chest or epigastric pain, especially when the patient develops dyspnea, subcutaneous emphysema, pneumomediastinum, a left pleural air-fluid collection, or sepsis.',
  },
  recognitionPattern: [
    {
      pattern:
        'Forceful vomiting followed immediately by severe chest or epigastric pain',
      whyItMatters:
        'The close temporal sequence is the most important early diagnostic clue.',
      progression:
        'Sudden rise in intraesophageal pressure -> full-thickness distal esophageal tear -> mediastinal contamination -> pleural contamination -> sepsis and shock.',
      discriminator:
        'Boerhaave syndrome produces severe pain and systemic deterioration, unlike an uncomplicated mucosal Mallory-Weiss tear.',
      commonTrap:
        'Do not dismiss the pain as muscular strain, reflux, gastritis, or pancreatitis after vomiting.',
    },
    {
      pattern:
        'Pneumomediastinum with subcutaneous emphysema or a left hydropneumothorax',
      whyItMatters:
        'Air and fluid escaping from the esophagus can spread through the mediastinum, pleural cavity, neck, and chest wall.',
      discriminator:
        'The combination of mediastinal air and pleural fluid after vomiting is more concerning for esophageal rupture than isolated pneumothorax.',
      commonTrap:
        'Do not assume that a pleural effusion after vomiting is aspiration pneumonia without considering esophageal perforation.',
    },
    {
      pattern: 'Rapid progression to fever, respiratory distress, and shock',
      whyItMatters:
        'Mediastinal and pleural contamination can cause fulminant sepsis within hours.',
      discriminator:
        'Rapid systemic toxicity separates perforation from most benign post-vomiting chest pain syndromes.',
      commonTrap:
        'Do not wait for the full classic triad before obtaining definitive imaging and surgical review.',
    },
    {
      pattern:
        'CT demonstration of esophageal wall defect and extraluminal contrast',
      whyItMatters:
        'CT identifies the site of rupture, degree of contamination, pleural involvement, and complications.',
      discriminator:
        'Direct contrast extravasation confirms a transmural leak rather than a superficial tear.',
      commonTrap:
        'A normal or nonspecific early chest radiograph does not safely exclude perforation when clinical suspicion remains high.',
    },
  ],
  keySymptoms: [
    {
      symptom: 'Sudden severe retrosternal or epigastric pain',
      significance:
        'Pain typically begins immediately after forceful vomiting and may radiate to the back or shoulder.',
    },
    {
      symptom: 'Dyspnea',
      significance:
        'May result from pleural contamination, pneumothorax, effusion, pain, or evolving sepsis.',
    },
    {
      symptom: 'Odynophagia or dysphagia',
      significance:
        'Painful or difficult swallowing supports esophageal and mediastinal injury.',
    },
    {
      symptom: 'Repeated vomiting or retching',
      significance:
        'A sudden increase in intraesophageal pressure is the usual precipitating mechanism in spontaneous rupture.',
    },
  ],
  keySigns: [
    {
      finding: 'Subcutaneous emphysema',
      significance:
        'Air may track from the mediastinum into the neck and chest wall.',
      discriminator:
        'This finding strongly supports an aerodigestive tract leak but may be absent early.',
    },
    {
      finding: 'Fever and tachycardia',
      significance:
        'Suggest early mediastinal inflammation, contamination, and sepsis.',
    },
    {
      finding: 'Hypotension',
      significance:
        'Indicates shock and substantially increases the urgency of source control.',
      discriminator:
        'An unstable patient with an uncontained thoracic leak is not suitable for conservative observation.',
    },
    {
      finding: 'Reduced unilateral breath sounds',
      significance:
        'May reflect pleural effusion, hydropneumothorax, or empyema, often on the left.',
    },
  ],
  examPearls: [
    {
      type: 'DISCRIMINATOR',
      title: 'Vomiting before pain changes the differential',
      content:
        'The sequence of forceful vomiting followed by sudden severe chest pain should immediately raise concern for spontaneous esophageal rupture.',
      whyItMatters:
        'The chronology may be more discriminating than any single physical sign.',
      discriminator:
        'A direct vomiting-to-pain sequence favors Boerhaave syndrome over primary acute coronary or aortic disease.',
      trapAvoided:
        'Do not record vomiting and chest pain as unrelated symptoms.',
    },
    {
      type: 'DISCRIMINATOR',
      title: 'Left pleural air and fluid is a major clue',
      content:
        'Distal thoracic perforations commonly contaminate the left pleural cavity and may produce a left hydropneumothorax.',
      whyItMatters:
        'This finding may be the first objective sign that chest pain after vomiting is caused by esophageal rupture.',
      discriminator:
        'Pleural fluid plus pneumomediastinum is more concerning than an isolated pneumothorax.',
      trapAvoided:
        'Do not insert a chest drain and stop the diagnostic workup without considering the source of pleural contamination.',
    },
    {
      type: 'MNEMONIC',
      title: 'Mackler triad',
      content:
        'Mackler triad: vomiting, severe chest pain, and subcutaneous emphysema.',
      whyItMatters:
        'The triad summarizes the classic clinical pattern.',
      discriminator:
        'Its presence is highly suggestive, but many patients do not present with all three findings.',
      trapAvoided:
        'Do not use absence of the complete triad to exclude esophageal perforation.',
    },
  ],
  scoringSystems: [],
  investigations: [
    {
      test: 'Chest radiograph',
      interpretation:
        'May show pleural effusion, hydropneumothorax, pneumomediastinum, widened mediastinum, or subcutaneous emphysema.',
      whyItMatters:
        'It is rapidly available but cannot reliably exclude an early or contained perforation.',
    },
    {
      test:
        'Contrast-enhanced CT chest and upper abdomen with water-soluble oral contrast',
      interpretation:
        'May demonstrate esophageal wall discontinuity, extraluminal air or contrast, mediastinal fluid, pleural collections, and the extent of contamination.',
      whyItMatters:
        'CT is the key investigation for confirming the diagnosis and planning source control.',
    },
    {
      test: 'Water-soluble contrast esophagram',
      interpretation:
        'Can localize active extravasation; a negative study does not completely exclude a small leak when suspicion remains high.',
      whyItMatters:
        'It may complement CT in stable patients when the site or containment of the leak remains uncertain.',
    },
    {
      test:
        'Full blood count, renal and liver profile, coagulation studies, arterial or venous blood gas, and lactate',
      interpretation:
        'Leukocytosis, acidosis, organ dysfunction, and elevated lactate indicate systemic contamination and shock.',
      whyItMatters:
        'Laboratory tests assess severity and guide resuscitation but do not exclude perforation when initially normal.',
    },
    {
      test: 'ECG and cardiac biomarkers',
      interpretation:
        'Used to assess an important competing diagnosis when the patient presents with acute chest pain.',
      whyItMatters:
        'Cardiac evaluation should occur in parallel without delaying definitive imaging for suspected perforation.',
    },
  ],
  managementOverview: [
    {
      step: 'Keep the patient nil by mouth and begin immediate resuscitation',
      rationale:
        'Prevent further contamination while correcting hypoxemia, shock, and electrolyte abnormalities.',
    },
    {
      step:
        'Start broad-spectrum intravenous antimicrobial therapy and acid suppression',
      rationale:
        'Early treatment must cover oral and upper gastrointestinal aerobic and anaerobic organisms while reducing ongoing chemical injury.',
    },
    {
      step:
        'Obtain urgent upper gastrointestinal and thoracic surgical review',
      rationale:
        'Management depends on site, timing, containment, tissue viability, physiological stability, and available expertise.',
    },
    {
      step: 'Drain contaminated pleural and mediastinal collections',
      rationale:
        'Adequate source control is essential to treat sepsis and prevent empyema or persistent mediastinitis.',
    },
    {
      step:
        'Repair, exclude, or internally control the leak using the appropriate operative or endoscopic strategy',
      rationale:
        'An unstable patient with an uncontained thoracic perforation generally requires urgent definitive source control; selected defects may be treated with stenting, clipping, endoscopic vacuum therapy, or surgery according to local expertise.',
    },
    {
      step: 'Provide enteral or parenteral nutritional support',
      rationale:
        'Oral intake is withheld while the perforation heals, and early nutrition supports recovery.',
    },
    {
      step: 'Reserve non-operative management for carefully selected stable patients',
      rationale:
        'Observation is appropriate only when the leak is contained, contamination is limited, there is no uncontrolled sepsis, and close specialist monitoring and drainage are available.',
    },
  ],
  differentialDistinguishers: [
    {
      diagnosis: 'Acute Coronary Syndrome',
      whyConfused:
        'Both can cause acute retrosternal pain, diaphoresis, dyspnea, and shock.',
      distinguishingPoint:
        'Boerhaave syndrome is linked to forceful vomiting and produces extraluminal air, pleural contamination, or esophageal contrast leakage.',
      keySeparator:
        'Pneumomediastinum or an esophageal wall defect is not explained by myocardial ischemia.',
      classicTrap:
        'Completing only a cardiac workup despite a high-risk post-vomiting history.',
    },
    {
      diagnosis: 'Acute Aortic Syndrome',
      whyConfused:
        'Both may produce sudden pain radiating to the back with hemodynamic instability.',
      distinguishingPoint:
        'CT demonstrates aortic pathology in acute aortic syndrome and an esophageal leak in Boerhaave syndrome.',
      keySeparator:
        'Extraluminal oral contrast from the esophagus confirms the perforation.',
      classicTrap:
        'Anchoring on the character of pain without integrating the vomiting trigger and mediastinal air.',
    },
    {
      diagnosis: 'Perforated Peptic Ulcer',
      whyConfused:
        'Both can cause sudden epigastric pain, sepsis, and shock.',
      distinguishingPoint:
        'Peptic ulcer perforation usually produces pneumoperitoneum and peritonism, while Boerhaave syndrome causes thoracic mediastinal and pleural contamination.',
      keySeparator:
        'The demonstrated site of contrast leakage identifies the perforated organ.',
      classicTrap:
        'Assuming every post-vomiting epigastric emergency is gastroduodenal.',
    },
    {
      diagnosis: 'Spontaneous Pneumothorax',
      whyConfused:
        'Both can cause acute chest pain, dyspnea, hypoxemia, and reduced unilateral breath sounds.',
      distinguishingPoint:
        'Boerhaave syndrome often has pleural fluid, pneumomediastinum, fever, and a vomiting trigger in addition to pleural air.',
      keySeparator:
        'A hydropneumothorax with esophageal contrast extravasation is secondary to perforation.',
      classicTrap:
        'Treating the pneumothorax without identifying the underlying esophageal leak.',
    },
    {
      diagnosis: 'Mallory-Weiss Tear',
      whyConfused:
        'Both follow vomiting or retching.',
      distinguishingPoint:
        'Mallory-Weiss is a mucosal tear that usually causes hematemesis; Boerhaave syndrome is a full-thickness rupture causing severe pain, air leakage, and sepsis.',
      keySeparator:
        'Mediastinal or pleural contrast leakage confirms transmural perforation.',
      classicTrap:
        'Calling all post-vomiting esophageal injuries Mallory-Weiss syndrome.',
    },
  ],
  complications: [
    {
      complication: 'Acute mediastinitis',
      whyItMatters:
        'Contamination of mediastinal tissues can progress rapidly and requires urgent source control.',
    },
    {
      complication: 'Pleural empyema or persistent hydropneumothorax',
      whyItMatters:
        'Pleural contamination commonly accompanies distal thoracic rupture and may require drainage or surgery.',
    },
    {
      complication: 'Septic shock and multiorgan dysfunction',
      whyItMatters:
        'Delayed recognition or inadequate source control can lead to rapid physiological collapse.',
    },
    {
      complication: 'Acute respiratory distress syndrome',
      whyItMatters:
        'Severe sepsis and pleural contamination can produce respiratory failure requiring critical care.',
    },
    {
      complication: 'Persistent esophageal leak or fistula',
      whyItMatters:
        'Failure of closure may require repeat drainage, endoscopic therapy, or further surgery.',
    },
    {
      complication: 'Esophageal stricture',
      whyItMatters:
        'Healing and subsequent fibrosis may cause later dysphagia.',
    },
  ],
  pitfalls: [
    {
      pitfall:
        'Waiting for vomiting, chest pain, and subcutaneous emphysema to all be present',
      consequence:
        'The complete classic triad is not required, and waiting delays definitive imaging and source control.',
    },
    {
      pitfall:
        'Attributing chest pain after vomiting to reflux, muscle strain, pancreatitis, or acute coronary syndrome alone',
      consequence:
        'Misses a rapidly lethal structural emergency.',
    },
    {
      pitfall:
        'Using a normal early chest radiograph to exclude perforation',
      consequence:
        'Small or early leaks may not produce obvious initial radiographic abnormalities.',
    },
    {
      pitfall:
        'Treating a hydropneumothorax without investigating its source',
      consequence:
        'Pleural drainage alone does not control an ongoing esophageal leak.',
    },
    {
      pitfall:
        'Performing routine diagnostic endoscopy before defining the perforation on imaging',
      consequence:
        'Insufflation and instrumentation may worsen an existing defect; endoscopy should be reserved for selected cases under specialist direction.',
    },
    {
      pitfall:
        'Choosing conservative management for an unstable patient with an uncontained thoracic leak',
      consequence:
        'Uncontrolled contamination progresses to mediastinitis, empyema, shock, and multiorgan failure.',
    },
    {
      pitfall: 'Placing Mackler triad under scoringSystems',
      consequence:
        'The triad is a recognition mnemonic, not a validated severity score.',
    },
  ],
  recallPrompts: [
    {
      prompt:
        'What historical sequence should immediately suggest Boerhaave syndrome?',
      answer:
        'Forceful vomiting or retching followed immediately by sudden severe chest or epigastric pain.',
    },
    {
      prompt: 'What is the pathological lesion in Boerhaave syndrome?',
      answer: 'A spontaneous full-thickness esophageal rupture.',
    },
    {
      prompt: 'What three findings make up Mackler triad?',
      answer:
        'Vomiting, severe chest pain, and subcutaneous emphysema.',
    },
    {
      prompt:
        'Which pleural imaging pattern is classically associated with distal thoracic esophageal rupture?',
      answer:
        'A left pleural effusion or left hydropneumothorax with pneumomediastinum.',
    },
    {
      prompt:
        'What CT finding directly confirms an active esophageal leak?',
      answer:
        'Extraluminal water-soluble oral contrast through an esophageal wall defect.',
    },
    {
      prompt:
        'Which patient may be considered for non-operative management?',
      answer:
        'A carefully selected stable patient with a contained leak, limited contamination, no uncontrolled sepsis, and access to close specialist monitoring and drainage.',
    },
  ],
  references: [
    {
      citation:
        'Chirica M, Kelly MD, Siboni S, et al. Esophageal emergencies: WSES guidelines. World Journal of Emergency Surgery. 2019.',
    },
    {
      citation:
        'American Association for Thoracic Surgery. TSRA Primer: Esophageal Perforation.',
    },
    {
      citation:
        'Sabiston Textbook of Surgery. Esophageal perforation and mediastinal contamination.',
    },
    {
      citation:
        "Bailey & Love's Short Practice of Surgery. Esophageal perforation.",
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
          specialty: 'General Surgery',
          subspecialty: 'Upper Gastrointestinal Surgery',
          category: 'Esophageal Emergency',
          bodySystem: 'Gastrointestinal',
          organSystem: 'Esophagus',
          difficultyBand: DiagnosisDifficultyBand.ADVANCED,
          rarityBand: DiagnosisRarityBand.UNCOMMON,
          clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
          ageGroup: DiagnosisAgeGroup.ADULT,
          urgencyLevel: DiagnosisUrgencyLevel.EMERGENT,
          preferredClueTypes: [
            'history',
            'symptom',
            'vitals',
            'exam',
            'imaging',
          ],
          notes:
            'Seeded flagship Boerhaave syndrome case with uncontained distal thoracic esophageal perforation, pleural contamination, and shock.',
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
          specialty: 'General Surgery',
          subspecialty: 'Upper Gastrointestinal Surgery',
          category: 'Esophageal Emergency',
          bodySystem: 'Gastrointestinal',
          organSystem: 'Esophagus',
          difficultyBand: DiagnosisDifficultyBand.ADVANCED,
          rarityBand: DiagnosisRarityBand.UNCOMMON,
          clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
          ageGroup: DiagnosisAgeGroup.ADULT,
          urgencyLevel: DiagnosisUrgencyLevel.EMERGENT,
          preferredClueTypes: [
            'history',
            'symptom',
            'vitals',
            'exam',
            'imaging',
          ],
          notes:
            'Seeded flagship Boerhaave syndrome case with uncontained distal thoracic esophageal perforation, pleural contamination, and shock.',
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

  const reusableCase = existingCases.find(
    (candidate) => candidate.dailyCases.length === 0,
  );
  const scheduledCase = existingCases.find(
    (candidate) => candidate.dailyCases.length > 0,
  );

  if (scheduledCase) {
    console.log(
      'Skipped existing scheduled Boerhaave syndrome case:',
      scheduledCase,
    );
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
    difficulty: 'advanced',
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
      'Seeded complete frontend-aligned flagship Boerhaave syndrome case with education.',
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
      difficulty: 'advanced',
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
        'Created complete Boerhaave syndrome revision with education-aligned clue progression and differential analysis.',
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
      validatorVersion: 'flagship-human-review:boerhaave-syndrome-v1',
      summary: {
        contentTier: 'FLAGSHIP',
        seedVersion,
        humanReviewed: true,
        note:
          'Complete Boerhaave syndrome flagship seed with six playable clues, clue-aligned differential reasoning, registry metadata, and full education payload.',
      },
      findings: [],
      completedAt: now,
    },
  });

  console.log('Seeded Boerhaave Syndrome:', {
    registryId: params.diagnosisRegistryId,
    registryDisplayLabel: params.registryDisplayLabel,
    caseId: seededCase.id,
    revisionId: revision.id,
    publicNumber,
    educationId: params.educationId,
    clueTypes: clues.map((clue) => clue.type),
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
