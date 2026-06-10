/**
 * Targeted patch: updates the explanation on the existing Acute Pancreatitis case
 * and upserts the education record — without touching registry, aliases, or revisions.
 *
 * Usage:
 *   railway run npx tsx prisma/seed/patch-pancreatitis-explanation.ts
 */

import {
  PrismaClient,
  DiagnosisEducationSource,
  DiagnosisEducationStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required.');

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const now = new Date();

// The existing Pancreatitis registry id
const REGISTRY_ID = '7fc95349-32a5-44a5-897c-d2524689f9ce';

// ─── Fixed reasoning — each step matches its paired clue by index ─────────────
const updatedExplanation = {
  diagnosis: 'Acute Pancreatitis',
  summary:
    'Severe epigastric pain radiating to the back, markedly elevated lipase, peripancreatic inflammation on CT, and a background of significant alcohol use confirm acute pancreatitis.',
  keyEvidence: [
    'Epigastric pain radiating to the back',
    'Positional relief on leaning forward',
    'Serum lipase >3× upper limit of normal',
    'Elevated CRP and leucocytosis',
    'Peripancreatic fat stranding on CT',
    'Significant alcohol history',
  ],
  reasoning: [
    'Acute severe epigastric pain after a heavy meal with no relief from eating points away from peptic pathology and raises immediate concern for a pancreatic or biliary cause.',
    'Posterior radiation to the back with partial relief on leaning forward is the classic positional signature of retroperitoneal pancreatic inflammation — the pancreas lies behind the stomach and irritates structures posteriorly.',
    'A background of heavy alcohol use and a prior similar episode strongly support an alcoholic aetiology; recurrent attacks are common in chronic heavy drinkers before overt chronic pancreatitis develops.',
    'Epigastric guarding with reduced bowel sounds indicates localised peritoneal irritation and a paralytic ileus from peripancreatic inflammation — consistent with, and proportionate to, acute pancreatitis at this stage.',
    'Lipase more than 30 times the upper limit of normal satisfies one of the Atlanta diagnostic criteria; normal bilirubin and LFTs argue against a biliary cause and support alcohol as the precipitant.',
    'CT confirms interstitial oedematous pancreatitis with peripancreatic fat stranding and a small fluid collection, excluding necrosis at this stage and correlating with the clinical and biochemical picture.',
  ],
  keyFindings: [
    'Epigastric pain radiating to the back',
    'Positional relief on leaning forward',
    'Lipase 1 840 U/L (>30× ULN)',
    'CRP 148 mg/L; leucocytosis',
    'Normal bilirubin and LFTs',
    'Peripancreatic oedema and fat stranding on CT',
  ],
  differentials: [
    'Peptic ulcer disease',
    'Acute cholecystitis',
    'Mesenteric ischaemia',
    'Aortic dissection',
  ],
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
    seedVersion: 'flagship-acute-pancreatitis-v1',
  },
};

// ─── Updated education (no scoringSystems) ────────────────────────────────────
const updatedEducation = {
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
      discriminator: 'Ulcer and cholecystitis pain is not typically postural.',
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
        "Lactated Ringer (Hartmann's solution) is preferred over normal saline; it reduces the risk of SIRS and metabolic acidosis.",
    },
  ],
  references: [] as string[],
};

async function main() {
  // 1. Find the existing case for this registry
  const existingCase = await prisma.case.findFirst({
    where: { diagnosisRegistryId: REGISTRY_ID, proposedDiagnosisText: 'Acute Pancreatitis' },
    orderBy: { approvedAt: 'asc' },
    select: { id: true, currentRevisionId: true },
  });

  if (!existingCase) {
    throw new Error('Acute Pancreatitis case not found — run the full seed first.');
  }

  // 2. Update explanation on the case
  await prisma.case.update({
    where: { id: existingCase.id },
    data: { explanation: updatedExplanation as object },
  });
  console.log('Updated case explanation:', existingCase.id);

  // 3. Update explanation on the current revision
  if (existingCase.currentRevisionId) {
    await prisma.caseRevision.update({
      where: { id: existingCase.currentRevisionId },
      data: { explanation: updatedExplanation as object },
    });
    console.log('Updated revision explanation:', existingCase.currentRevisionId);
  }

  // 4. Upsert education (no scoringSystems)
  const education = await prisma.diagnosisEducation.upsert({
    where: { diagnosisRegistryId: REGISTRY_ID },
    update: {
      title: 'Acute Pancreatitis',
      summary: updatedEducation.summary,
      clinicalPattern: updatedEducation.recognitionPattern,
      keySymptoms: updatedEducation.keySymptoms,
      keySigns: updatedEducation.keySigns,
      examPearls: updatedEducation.examPearls,
      scoringSystems: null,
      investigations: updatedEducation.investigations,
      differentials: updatedEducation.differentialDistinguishers,
      management: updatedEducation.managementOverview,
      complications: updatedEducation.complications,
      pitfalls: updatedEducation.pitfalls,
      recallPrompts: updatedEducation.recallPrompts,
      references: updatedEducation.references,
      editorialStatus: DiagnosisEducationStatus.PUBLISHED,
      source: DiagnosisEducationSource.MANUAL,
      reviewedAt: now,
      publishedAt: now,
      version: { increment: 1 },
    },
    create: {
      diagnosisRegistryId: REGISTRY_ID,
      title: 'Acute Pancreatitis',
      summary: updatedEducation.summary,
      clinicalPattern: updatedEducation.recognitionPattern,
      keySymptoms: updatedEducation.keySymptoms,
      keySigns: updatedEducation.keySigns,
      examPearls: updatedEducation.examPearls,
      investigations: updatedEducation.investigations,
      differentials: updatedEducation.differentialDistinguishers,
      management: updatedEducation.managementOverview,
      complications: updatedEducation.complications,
      pitfalls: updatedEducation.pitfalls,
      recallPrompts: updatedEducation.recallPrompts,
      references: updatedEducation.references,
      editorialStatus: DiagnosisEducationStatus.PUBLISHED,
      source: DiagnosisEducationSource.MANUAL,
      reviewedAt: now,
      publishedAt: now,
      version: 1,
    },
  });
  console.log('Upserted education:', education.id);

  await prisma.diagnosisEducationRevision.create({
    data: {
      educationId: education.id,
      version: education.version,
      snapshot: {
        ...updatedEducation,
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
  console.log('Created education revision v', education.version);
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