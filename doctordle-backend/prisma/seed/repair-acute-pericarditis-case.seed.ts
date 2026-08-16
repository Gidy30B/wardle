import 'dotenv/config';
import {
  PrismaClient,
  CaseEditorialStatus,
  CaseSource,
  DiagnosisClinicalSetting,
  DiagnosisEducationSource,
  DiagnosisEducationStatus,
  DiagnosisMappingMethod,
  DiagnosisMappingStatus,
  DiagnosisUrgencyLevel,
  PublishTrack,
  ValidationOutcome,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { CaseEligibilityPolicyService } from '../../src/modules/cases/case-eligibility-policy.service.js';

/**
 * REPAIR SEED — Acute Pericarditis case normalization
 *
 * Purpose:
 * - Repair the prior "Acute Pericarditis with Cardiac Tamponade" seed.
 * - Do NOT create a new descriptive diagnosis registry row.
 * - Attach the case to the existing pericarditis registry entry.
 * - Keep tamponade as a complication / late severity discriminator inside clues and explanation,
 *   not as the playable canonical diagnosis.
 * - Remove product/demo/engagement language from explanation and education.
 *
 * Run:
 *   npx tsx prisma/seed/repair-acute-pericarditis-case.seed.ts
 */

const databaseUrl = resolvePgConnectionString(process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required to run Acute Pericarditis repair seed.',
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
const caseEligibilityPolicy = new CaseEligibilityPolicyService();

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

const now = new Date();

const canonicalName = 'pericarditis';
const canonicalNormalized = normalizeClinicalText(canonicalName);
const displayLabel = 'Pericarditis';
const acceptedRegistryTerms = [canonicalName, 'acute pericarditis'].map(
  normalizeClinicalText,
);

const previousDescriptiveDiagnosis =
  'Acute Pericarditis with Cardiac Tamponade';
const previousDescriptiveCanonical = normalizeClinicalText(
  'acute pericarditis with cardiac tamponade',
);

const previousCaseTitles = [
  'Positional Chest Pain Progressing to Obstructive Shock from Cardiac Tamponade',
];

const repairedCaseTitle =
  'Positional Pleuritic Chest Pain with Pericardial Effusion and Tamponade Physiology';

const clues = [
  {
    order: 0,
    type: 'history',
    value:
      'A 29-year-old man presents with sharp central chest pain that worsens when he lies flat and improves when he sits forward. The pain is pleuritic and has been worsening over 24 hours.',
  },
  {
    order: 1,
    type: 'history',
    value:
      'He had a viral upper respiratory illness one week earlier and now reports low-grade fever, malaise, shortness of breath, and chest pressure on exertion.',
  },
  {
    order: 2,
    type: 'imaging',
    value:
      'ECG shows diffuse concave ST-segment elevation with PR-segment depression, without reciprocal ST depression outside aVR and V1.',
  },
  {
    order: 3,
    type: 'exam',
    value:
      'He is sitting upright and appears breathless. A pericardial friction rub is heard initially. Heart sounds later become quiet and the jugular venous pressure is raised.',
  },
  {
    order: 4,
    type: 'vital',
    value:
      'Blood pressure is 86/54 mmHg, heart rate 126/min, respiratory rate 26/min, oxygen saturation 96% on room air, and temperature 37.8°C. Pulsus paradoxus is present.',
  },
  {
    order: 5,
    type: 'imaging',
    value:
      'Bedside echocardiography shows a large circumferential pericardial effusion with right atrial systolic collapse, right ventricular diastolic collapse, and a plethoric inferior vena cava.',
  },
] as const;

const differentials = [
  'ST-Elevation Myocardial Infarction',
  'Pulmonary Embolism',
  'Myocarditis',
  'Aortic Dissection',
];

const repairedExplanation = {
  diagnosis: displayLabel,
  summary:
    'This presentation is most consistent with acute pericarditis. The diagnosis is supported by positional pleuritic chest pain, a recent viral prodrome, diffuse concave ST elevation, PR-segment depression, and a pericardial friction rub. Hypotension, raised JVP, pulsus paradoxus, muffled heart sounds, and echocardiographic chamber collapse indicate a large effusion with tamponade physiology as a severe complication.',
  reasoning: [
    'Sharp pleuritic chest pain relieved by sitting forward is characteristic of acute pericarditis.',
    'A recent viral illness supports viral or idiopathic pericarditis as the likely trigger.',
    'Diffuse concave ST-segment elevation with PR-segment depression favors pericarditis over regional STEMI.',
    'A pericardial friction rub is a classic examination finding in acute pericardial inflammation.',
    'Raised JVP, muffled heart sounds, hypotension, tachycardia, and pulsus paradoxus show impaired cardiac filling from increased pericardial pressure.',
    'Echocardiographic right atrial and right ventricular collapse confirms hemodynamically significant pericardial effusion.',
    'Pulmonary embolism may cause pleuritic pain and tachycardia, but it does not explain diffuse PR depression or pericardial chamber collapse.',
    'The late clues identify tamponade physiology as a complication requiring urgent drainage.',
  ],
  keyFindings: [
    'Sharp central chest pain',
    'Pleuritic pain',
    'Pain worse when lying flat',
    'Pain improved by sitting forward',
    'Recent viral illness',
    'Low-grade fever and malaise',
    'Diffuse concave ST elevation',
    'PR-segment depression',
    'Pericardial friction rub',
    'Muffled heart sounds',
    'Raised jugular venous pressure',
    'Hypotension',
    'Tachycardia',
    'Pulsus paradoxus',
    'Large pericardial effusion',
    'Right atrial collapse',
    'Right ventricular diastolic collapse',
    'Plethoric inferior vena cava',
  ],
  differentials,
  differentialAnalysis: [
    {
      diagnosis: 'ST-Elevation Myocardial Infarction',
      whyPlausibleEarly:
        'STEMI is a critical mimic because the patient has acute chest pain with ST-segment elevation.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence: 'pain worsens lying flat and improves sitting forward',
          reason:
            'Marked positional pleuritic pain is more typical of pericarditis than myocardial infarction.',
        },
        {
          clueOrder: 2,
          evidence:
            'diffuse concave ST elevation with PR-segment depression and no convincing reciprocal pattern',
          reason:
            'Pericarditis usually produces widespread inflammatory ECG changes, whereas STEMI usually localizes to a coronary territory.',
        },
      ],
      finalReasonLessLikely:
        'STEMI remains a must-not-miss mimic, but the positional pain, PR depression, diffuse ECG distribution, and pericardial effusion favor acute pericarditis.',
    },
    {
      diagnosis: 'Pulmonary Embolism',
      whyPlausibleEarly:
        'Pulmonary embolism can present with pleuritic chest pain, dyspnea, tachycardia, anxiety, and hypotension.',
      ruledOutByClues: [
        {
          clueOrder: 2,
          evidence: 'diffuse concave ST elevation and PR depression',
          reason:
            'This ECG pattern indicates pericardial inflammation rather than acute pulmonary vascular obstruction.',
        },
        {
          clueOrder: 5,
          evidence:
            'large pericardial effusion with right-sided chamber collapse',
          reason:
            'The echo shows pericardial compression rather than isolated right heart strain.',
        },
      ],
      finalReasonLessLikely:
        'Pulmonary embolism does not account for the pericarditis ECG pattern and echo-confirmed pericardial pressure effect.',
    },
    {
      diagnosis: 'Myocarditis',
      whyPlausibleEarly:
        'Myocarditis can follow a viral illness and cause chest pain, dyspnea, ECG abnormalities, and systemic symptoms.',
      ruledOutByClues: [
        {
          clueOrder: 3,
          evidence: 'pericardial friction rub and raised JVP',
          reason:
            'A rub supports pericardial inflammation, while raised JVP suggests impaired filling from pericardial pressure.',
        },
        {
          clueOrder: 5,
          evidence: 'right atrial and right ventricular diastolic collapse',
          reason:
            'Chamber collapse from pericardial pressure identifies tamponade physiology rather than isolated myocarditis.',
        },
      ],
      finalReasonLessLikely:
        'Myopericarditis can coexist, but the defining pattern in this case is acute pericarditis with a large hemodynamically significant effusion.',
    },
    {
      diagnosis: 'Aortic Dissection',
      whyPlausibleEarly:
        'Aortic dissection is a critical chest pain diagnosis and can cause shock or hemopericardium.',
      ruledOutByClues: [
        {
          clueOrder: 0,
          evidence: 'pleuritic positional pain improved by sitting forward',
          reason:
            'This pain pattern favors pericarditis over abrupt tearing pain radiating to the back.',
        },
        {
          clueOrder: 2,
          evidence: 'diffuse concave ST elevation with PR depression',
          reason:
            'The ECG supports pericardial inflammation rather than a primary aortic catastrophe.',
        },
      ],
      finalReasonLessLikely:
        'Dissection must remain in the differential for unstable chest pain, but the viral prodrome, positional pain, and pericarditis ECG make acute pericarditis more likely.',
    },
  ],
  managementPearl:
    'Acute pericarditis with hypotension and echocardiographic tamponade physiology is an emergency. Provide oxygen, monitoring, IV access, and cautious temporizing fluids while arranging urgent pericardial drainage. Anti-inflammatory treatment for pericarditis should not delay drainage when obstructive shock is present.',
  generationQuality: {
    contentTier: 'FLAGSHIP',
    seedVersion: 'repair-acute-pericarditis-v2',
    humanReviewed: true,
    discriminatorStrength: 'VERY_HIGH',
    expectedTeachingPoints: [
      'Positional pleuritic chest pain suggests acute pericarditis',
      'Diffuse concave ST elevation with PR depression separates pericarditis from STEMI',
      'Hypotension, raised JVP, muffled heart sounds, and pulsus paradoxus suggest tamponade physiology',
      'Echo chamber collapse confirms hemodynamically significant pericardial effusion',
      'Tamponade physiology is an emergency complication requiring urgent drainage',
      'The playable diagnosis should remain Pericarditis; tamponade physiology is documented as a complication',
    ],
    competencyDomains: [
      'Cardiology',
      'Emergency Medicine',
      'ECG Interpretation',
      'Point-of-Care Ultrasound',
      'Clinical Reasoning',
    ],
  },
};

const repairedEducation = {
  title: displayLabel,
  summary: {
    definition:
      'Acute pericarditis is inflammation of the pericardium, usually presenting with pleuritic positional chest pain and characteristic ECG changes.',
    highYieldTakeaway:
      'Recognize acute pericarditis by positional pleuritic chest pain, diffuse concave ST elevation, PR depression, and a pericardial friction rub. Always assess for high-risk features such as large effusion, hypotension, raised JVP, pulsus paradoxus, and tamponade physiology.',
  },
  clinicalPattern: [
    {
      pattern: 'Positional pleuritic chest pain',
      whyItMatters:
        'Pain that worsens lying flat and improves sitting forward is a classic discriminator for acute pericarditis.',
      progression:
        'Symptoms may follow a viral illness and can worsen if pericardial inflammation is complicated by effusion.',
      discriminator:
        'Typical ischemic chest pain is usually pressure-like and not strongly relieved by sitting forward.',
      commonTrap:
        'Treating all ST elevation as STEMI without assessing pain character, ECG distribution, and PR-segment changes.',
    },
    {
      pattern: 'Diffuse pericarditis ECG pattern',
      whyItMatters:
        'Diffuse concave ST elevation with PR depression supports acute pericarditis over coronary-territory infarction.',
      discriminator:
        'Pericarditis is usually widespread rather than confined to a single coronary territory.',
      commonTrap: 'Missing pericarditis because the ECG contains ST elevation.',
    },
    {
      pattern: 'High-risk effusion or tamponade physiology',
      whyItMatters:
        'Hypotension, tachycardia, raised JVP, muffled heart sounds, pulsus paradoxus, and echo chamber collapse indicate hemodynamic compromise.',
      discriminator:
        'Right atrial or right ventricular collapse on echo supports tamponade physiology.',
      commonTrap:
        'Calling the presentation uncomplicated pericarditis after shock physiology appears.',
    },
  ],
  keySymptoms: [
    {
      symptom: 'Sharp pleuritic central chest pain',
      significance:
        'A common symptom of acute pericardial inflammation, especially when positional.',
    },
    {
      symptom: 'Pain relieved by sitting forward',
      significance:
        'A high-yield feature favoring acute pericarditis over many cardiac and pulmonary mimics.',
    },
    {
      symptom: 'Recent viral illness',
      significance:
        'Supports viral or idiopathic acute pericarditis in a young adult.',
    },
    {
      symptom: 'Progressive dyspnea or chest pressure',
      significance:
        'May suggest enlarging effusion or impaired cardiac filling rather than isolated chest wall pain.',
    },
  ],
  keySigns: [
    {
      finding: 'Pericardial friction rub',
      significance:
        'A classic sign of acute pericarditis, although it may be transient.',
      discriminator:
        'A rub supports pericardial inflammation rather than isolated myocardial ischemia.',
    },
    {
      finding: 'Raised jugular venous pressure',
      significance:
        'Suggests impaired right-sided filling when pericardial pressure is elevated.',
      discriminator:
        'Raised JVP with hypotension should prompt assessment for obstructive shock.',
    },
    {
      finding: 'Pulsus paradoxus',
      significance:
        'An exaggerated inspiratory fall in systolic blood pressure, classically associated with tamponade physiology.',
      discriminator:
        'Supports hemodynamically significant effusion when paired with shock and echo findings.',
    },
    {
      finding: 'Muffled heart sounds',
      significance: 'May occur when pericardial fluid dampens cardiac sounds.',
      discriminator:
        'Part of the classic bedside pattern of tamponade when combined with hypotension and raised JVP.',
    },
  ],
  examPearls: [
    {
      type: 'DISCRIMINATOR',
      title: 'Pericarditis pain is often positional',
      content:
        'Pain that worsens lying flat and improves sitting forward should raise suspicion for acute pericarditis.',
      whyItMatters:
        'This separates inflammatory pericardial pain from typical ischemic pressure pain.',
      discriminator:
        'Ask specifically about posture and pleuritic worsening in acute chest pain.',
      trapAvoided:
        'Anchoring on acute coronary syndrome from chest pain alone.',
    },
    {
      type: 'DISCRIMINATOR',
      title: 'ECG distribution matters',
      content:
        'Acute pericarditis typically causes widespread concave ST elevation with PR depression rather than regional ST elevation with reciprocal changes.',
      whyItMatters:
        'The ECG pattern helps separate pericarditis from STEMI while keeping ACS in the differential.',
      discriminator:
        'Look for PR depression and widespread distribution across limb and precordial leads.',
      trapAvoided:
        'Calling diffuse inflammatory ST elevation an infarct pattern without checking the full ECG.',
    },
    {
      type: 'DISCRIMINATOR',
      title: 'Assess for tamponade physiology',
      content:
        'Hypotension, raised JVP, pulsus paradoxus, muffled heart sounds, and echo chamber collapse indicate impaired cardiac filling from pericardial pressure.',
      whyItMatters:
        'Management urgency depends on hemodynamic compromise, not only on the presence of pericardial inflammation.',
      discriminator:
        'Right atrial or right ventricular collapse on echo confirms pressure effects from the effusion.',
      trapAvoided:
        'Treating unstable tamponade physiology as inflammation without hemodynamic compromise.',
    },
  ],
  scoringSystems: [],
  investigations: [
    {
      test: '12-lead ECG',
      interpretation:
        'Diffuse concave ST elevation with PR depression supports acute pericarditis; regional ST elevation with reciprocal changes suggests STEMI.',
      whyItMatters: 'ECG is a key early discriminator in acute chest pain.',
    },
    {
      test: 'Bedside echocardiography',
      interpretation:
        'Large effusion, right atrial collapse, right ventricular diastolic collapse, and plethoric IVC support tamponade physiology.',
      whyItMatters:
        'Echo confirms hemodynamic significance and guides urgent drainage.',
    },
    {
      test: 'Troponin',
      interpretation:
        'May be normal in isolated pericarditis or elevated if myopericarditis or myocardial infarction is present.',
      whyItMatters:
        'Helps identify myocardial involvement and keeps ACS in the differential.',
    },
    {
      test: 'Inflammatory markers',
      interpretation:
        'CRP or ESR may be raised in acute pericardial inflammation.',
      whyItMatters:
        'Supports inflammatory activity and can help monitor response after stabilization.',
    },
  ],
  differentials: [
    {
      diagnosis: 'ST-Elevation Myocardial Infarction',
      whyConfused: 'Both can present with acute chest pain and ST elevation.',
      distinguishingPoint:
        'Pericarditis has positional pleuritic pain, diffuse concave ST elevation, and PR depression rather than regional coronary-territory changes.',
      keySeparator:
        'Diffuse ECG pattern plus PR depression and positional pain.',
      classicTrap:
        'Failing to keep both pericarditis and ACS in mind until the ECG pattern and clinical course are clear.',
    },
    {
      diagnosis: 'Pulmonary Embolism',
      whyConfused:
        'Pleuritic pain, dyspnea, tachycardia, and shock can occur in pulmonary embolism.',
      distinguishingPoint:
        'Pericarditis has inflammatory ECG changes; tamponade physiology has pericardial effusion with chamber collapse.',
      keySeparator:
        'Echo shows pericardial compression rather than isolated right heart strain.',
      classicTrap:
        'Attributing all pleuritic chest pain with tachycardia to pulmonary embolism.',
    },
    {
      diagnosis: 'Myocarditis',
      whyConfused:
        'Viral illness, chest pain, dyspnea, and ECG changes overlap with pericarditis.',
      distinguishingPoint:
        'Tamponade physiology is defined by pericardial fluid pressure causing chamber collapse and obstructive shock.',
      keySeparator: 'Large effusion with right-sided chamber collapse.',
      classicTrap:
        'Missing the mechanical complication because viral myocarditis is plausible.',
    },
    {
      diagnosis: 'Aortic Dissection',
      whyConfused:
        'Dissection is a life-threatening chest pain diagnosis and can cause hemopericardium or tamponade.',
      distinguishingPoint:
        'The case has viral prodrome, pericarditic pain, and pericarditis ECG rather than abrupt tearing pain and pulse or neurological deficits.',
      keySeparator: 'Clinical context plus diffuse PR-depression ECG pattern.',
      classicTrap: 'Forgetting dissection in unstable chest pain.',
    },
  ],
  management: [
    {
      step: 'Diagnose acute pericarditis clinically and electrocardiographically',
      rationale:
        'Typical chest pain, pericardial rub, diffuse ST elevation, and PR depression support the diagnosis.',
    },
    {
      step: 'Assess for high-risk features and tamponade physiology',
      rationale:
        'Hypotension, raised JVP, pulsus paradoxus, large effusion, or chamber collapse require urgent escalation.',
    },
    {
      step: 'Stabilize unstable patients while arranging drainage',
      rationale:
        'Oxygen, monitoring, IV access, and cautious temporizing fluids may support perfusion while definitive drainage is prepared.',
    },
    {
      step: 'Perform urgent pericardial drainage when unstable tamponade physiology is present',
      rationale:
        'Removing pericardial fluid restores cardiac filling in obstructive shock.',
    },
    {
      step: 'Treat inflammatory pericarditis after stabilization',
      rationale:
        'Anti-inflammatory therapy is appropriate for inflammatory pericarditis when safe, but it must not delay drainage in unstable tamponade physiology.',
    },
  ],
  complications: [
    {
      complication: 'Cardiac tamponade physiology',
      whyItMatters:
        'Pericardial pressure can impair ventricular filling and cause obstructive shock.',
    },
    {
      complication: 'Recurrent pericardial effusion',
      whyItMatters:
        'Persistent inflammation, malignancy, tuberculosis, autoimmune disease, renal failure, or trauma may cause recurrence.',
    },
    {
      complication: 'Constrictive pericarditis',
      whyItMatters:
        'Chronic pericardial inflammation can rarely cause impaired diastolic filling from a stiff pericardium.',
    },
    {
      complication: 'Myopericarditis',
      whyItMatters:
        'Myocardial involvement may cause troponin elevation, arrhythmias, and reduced ventricular function.',
    },
  ],
  pitfalls: [
    {
      pitfall:
        'Treating ST elevation as STEMI or pericarditis without comparing the full ECG pattern',
      consequence:
        'The learner may miss the diagnostic value of diffuse changes, PR depression, and reciprocal changes.',
    },
    {
      pitfall: 'Failing to reassess hemodynamics after diagnosing pericarditis',
      consequence:
        'Tamponade physiology can be missed if the case is prematurely labelled uncomplicated pericarditis.',
    },
    {
      pitfall:
        'Waiting for extensive investigations in unstable tamponade physiology',
      consequence:
        'Definitive drainage may be delayed in life-threatening obstructive shock.',
    },
  ],
  recallPrompts: [
    {
      prompt: 'What chest pain feature strongly suggests acute pericarditis?',
      answer:
        'Sharp pleuritic chest pain that worsens lying flat and improves sitting forward.',
    },
    {
      prompt: 'What ECG pattern favors acute pericarditis over STEMI?',
      answer:
        'Diffuse concave ST elevation with PR depression and no localized coronary-territory pattern.',
    },
    {
      prompt: 'What bedside features suggest tamponade physiology?',
      answer:
        'Hypotension, tachycardia, raised JVP, muffled heart sounds, and pulsus paradoxus.',
    },
    {
      prompt: 'What echo findings support tamponade physiology?',
      answer:
        'Large pericardial effusion with right atrial collapse, right ventricular diastolic collapse, and plethoric IVC.',
    },
  ],
  references: [
    {
      citation:
        'European Society of Cardiology guidelines on pericardial diseases.',
    },
    {
      citation: 'Oxford Handbook of Cardiology.',
    },
    {
      citation:
        'Braunwald’s Heart Disease: A Textbook of Cardiovascular Medicine.',
    },
  ],
};

async function findPericarditisRegistry() {
  const registry =
    (await prisma.diagnosisRegistry.findUnique({
      where: { canonicalNormalized },
      select: {
        id: true,
        displayLabel: true,
        canonicalName: true,
        specialty: true,
        clinicalSetting: true,
        urgencyLevel: true,
      },
    })) ??
    (await prisma.diagnosisRegistry.findFirst({
      where: {
        OR: [
          { canonicalNormalized: { in: acceptedRegistryTerms } },
          {
            aliases: {
              some: {
                normalizedTerm: { in: acceptedRegistryTerms },
                active: true,
                acceptedForMatch: true,
              },
            },
          },
        ],
      },
      select: {
        id: true,
        displayLabel: true,
        canonicalName: true,
        specialty: true,
        clinicalSetting: true,
        urgencyLevel: true,
      },
    }));

  if (!registry) {
    throw new Error(
      `Existing registry diagnosis not found for "${displayLabel}". This repair intentionally does not create registry diagnoses.`,
    );
  }

  return registry;
}

async function alignPericarditisRegistryMetadata(registryId: string) {
  return prisma.diagnosisRegistry.update({
    where: { id: registryId },
    data: {
      specialty: 'Cardiology',
      clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
      urgencyLevel: DiagnosisUrgencyLevel.EMERGENT,
    },
    select: {
      id: true,
      displayLabel: true,
      canonicalName: true,
      specialty: true,
      clinicalSetting: true,
      urgencyLevel: true,
    },
  });
}

async function retireDescriptiveRegistry(pericarditisRegistryId: string) {
  const descriptiveRegistry = await prisma.diagnosisRegistry.findUnique({
    where: { canonicalNormalized: previousDescriptiveCanonical },
    select: { id: true, displayLabel: true },
  });

  if (
    !descriptiveRegistry ||
    descriptiveRegistry.id === pericarditisRegistryId
  ) {
    return null;
  }

  await prisma.diagnosisAlias.updateMany({
    where: { diagnosisRegistryId: descriptiveRegistry.id },
    data: {
      acceptedForMatch: false,
      active: false,
    },
  });

  await prisma.diagnosisRegistry.update({
    where: { id: descriptiveRegistry.id },
    data: {
      active: false,
      isPlayable: false,
      isGeneratable: false,
      notes:
        'Retired by acute pericarditis repair seed. Cardiac tamponade should remain a complication/severity discriminator, not a standalone Wardle diagnosis for this case.',
    },
  });

  return descriptiveRegistry;
}

async function repairEducation(diagnosisRegistryId: string) {
  const existing = await prisma.diagnosisEducation.findUnique({
    where: { diagnosisRegistryId },
    select: { id: true, version: true },
  });

  const educationData = {
    title: repairedEducation.title,
    summary: repairedEducation.summary,
    clinicalPattern: repairedEducation.clinicalPattern,
    keySymptoms: repairedEducation.keySymptoms,
    keySigns: repairedEducation.keySigns,
    examPearls: repairedEducation.examPearls,
    scoringSystems: repairedEducation.scoringSystems,
    investigations: repairedEducation.investigations,
    differentials: repairedEducation.differentials,
    management: repairedEducation.management,
    complications: repairedEducation.complications,
    pitfalls: repairedEducation.pitfalls,
    recallPrompts: repairedEducation.recallPrompts,
    references: repairedEducation.references,
    editorialStatus: DiagnosisEducationStatus.PUBLISHED,
    source: DiagnosisEducationSource.MANUAL,
    reviewedAt: now,
    publishedAt: now,
  };

  const education = existing
    ? await prisma.diagnosisEducation.update({
        where: { id: existing.id },
        data: { ...educationData, version: { increment: 1 } },
        select: { id: true, version: true },
      })
    : await prisma.diagnosisEducation.create({
        data: { diagnosisRegistryId, ...educationData, version: 1 },
        select: { id: true, version: true },
      });

  await prisma.diagnosisEducationRevision.create({
    data: {
      educationId: education.id,
      version: education.version,
      snapshot: repairedEducation,
      editorialStatus: DiagnosisEducationStatus.PUBLISHED,
      source: DiagnosisEducationSource.MANUAL,
    },
  });

  return education;
}

async function findCasesToRepair(params: {
  pericarditisRegistryId: string;
  retiredRegistryId?: string;
}) {
  return prisma.case.findMany({
    where: {
      OR: [
        { title: { in: previousCaseTitles } },
        { title: repairedCaseTitle },
        { proposedDiagnosisText: previousDescriptiveDiagnosis },
        {
          proposedDiagnosisText: {
            equals: previousDescriptiveDiagnosis,
            mode: 'insensitive',
          },
        },
        ...(params.retiredRegistryId
          ? [{ diagnosisRegistryId: params.retiredRegistryId }]
          : []),
      ],
    },
    orderBy: [{ approvedAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      title: true,
      date: true,
      publicNumber: true,
      currentRevisionId: true,
      diagnosisRegistryId: true,
    },
  });
}

async function repairCase(
  caseId: string,
  registry: Awaited<ReturnType<typeof alignPericarditisRegistryMetadata>>,
) {
  const history = clues[0].value;
  const symptoms = [clues[0].value];

  const updated = await prisma.case.update({
    where: { id: caseId },
    data: {
      title: repairedCaseTitle,
      difficulty: 'intermediate',
      history,
      symptoms,
      clues: clues as unknown as object,
      explanation: repairedExplanation as object,
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
        'Repaired from descriptive "acute pericarditis with cardiac tamponade" diagnosis to canonical Pericarditis. Tamponade retained as severe complication and late discriminator.',
    },
    select: { id: true, date: true, publicNumber: true },
  });

  const latestRevision = await prisma.caseRevision.findFirst({
    where: { caseId },
    orderBy: { revisionNumber: 'desc' },
    select: { revisionNumber: true },
  });

  const revision = await prisma.caseRevision.create({
    data: {
      caseId,
      revisionNumber: (latestRevision?.revisionNumber ?? 0) + 1,
      source: CaseSource.MANUAL,
      publishTrack: PublishTrack.DAILY,
      title: repairedCaseTitle,
      date: updated.date,
      difficulty: 'intermediate',
      history,
      symptoms,
      clues: clues as unknown as object,
      explanation: repairedExplanation as object,
      differentials,
      diagnosisRegistryId: registry.id,
      proposedDiagnosisText: displayLabel,
      diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
      diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
      diagnosisMappingConfidence: 1,
      diagnosisEditorialNote:
        'Repair revision: canonical diagnosis Pericarditis; tamponade physiology retained as emergency complication, not answer label.',
    },
    select: { id: true },
  });

  await prisma.case.update({
    where: { id: caseId },
    data: { currentRevisionId: revision.id },
  });

  await prisma.caseValidationRun.create({
    data: {
      caseId,
      revisionId: revision.id,
      source: CaseSource.MANUAL,
      publishTrack: PublishTrack.DAILY,
      outcome: ValidationOutcome.PASSED,
      validatorVersion: 'human-review:repair-acute-pericarditis-v2',
      summary: {
        contentTier: 'FLAGSHIP',
        repairSeed: 'repair-acute-pericarditis-v2',
        humanReviewed: true,
        diagnosisNormalized: {
          from: previousDescriptiveDiagnosis,
          to: displayLabel,
          rationale:
            'Wardle playable diagnosis should be canonical registry diagnosis; tamponade is represented as complication/severity discriminator.',
        },
        metadataVerified: {
          specialty: registry.specialty,
          subspecialty: 'Pericardial Disease / Acute Cardiac Care',
          category: 'Pericardial Disease',
          bodySystem: 'Cardiovascular',
          organSystem: 'Heart / Pericardium',
          difficultyBand: 'INTERMEDIATE',
          clinicalSetting: registry.clinicalSetting,
          urgencyLevel: registry.urgencyLevel,
        },
      },
      findings: [],
      completedAt: now,
    },
  });

  const repaired = await prisma.case.findUniqueOrThrow({
    where: { id: caseId },
    select: {
      id: true,
      clues: true,
      currentRevisionId: true,
      currentRevision: {
        select: {
          id: true,
          clues: true,
        },
      },
    },
  });

  const caseClueValidation = caseEligibilityPolicy.validatePlayableClues(
    repaired.clues,
    { caseId: repaired.id, minimumPlayableClues: 6 },
  );
  const revisionClueValidation = caseEligibilityPolicy.validatePlayableClues(
    repaired.currentRevision?.clues,
    { caseId: repaired.id, minimumPlayableClues: 6 },
  );
  const firstClue = Array.isArray(repaired.clues) ? repaired.clues[0] : null;

  console.log('Acute pericarditis case repair verification:', {
    caseId: repaired.id,
    revisionId: repaired.currentRevision?.id ?? null,
    caseCluesIsArray: Array.isArray(repaired.clues),
    revisionCluesIsArray: Array.isArray(repaired.currentRevision?.clues),
    clueCount: caseClueValidation.playableClueCount,
    revisionClueCount: revisionClueValidation.playableClueCount,
    firstClueKeys:
      firstClue && typeof firstClue === 'object' ? Object.keys(firstClue) : [],
    clueTypes: caseClueValidation.clues.map((clue) => clue.type),
    currentRevisionId: repaired.currentRevisionId,
    casePlayable: caseClueValidation.valid,
    revisionPlayable: revisionClueValidation.valid,
    caseValidationReasons: caseClueValidation.reasons,
    revisionValidationReasons: revisionClueValidation.reasons,
  });

  if (
    repaired.currentRevisionId !== revision.id ||
    repaired.currentRevision?.id !== revision.id
  ) {
    throw new Error(
      `Case ${caseId} currentRevisionId does not point to repaired revision ${revision.id}.`,
    );
  }

  if (!caseClueValidation.valid || !revisionClueValidation.valid) {
    throw new Error(
      `Case ${caseId} repair did not produce six playable clues. Case reasons: ${caseClueValidation.reasons.join(', ') || 'none'}; revision reasons: ${revisionClueValidation.reasons.join(', ') || 'none'}.`,
    );
  }

  return {
    caseId,
    revisionId: revision.id,
    publicNumber: updated.publicNumber,
    playableClueCount: caseClueValidation.playableClueCount,
  };
}

async function main() {
  const existingRegistry = await findPericarditisRegistry();
  const registry = await alignPericarditisRegistryMetadata(existingRegistry.id);
  const retiredRegistry = await retireDescriptiveRegistry(registry.id);
  const education = await repairEducation(registry.id);

  const cases = await findCasesToRepair({
    pericarditisRegistryId: registry.id,
    retiredRegistryId: retiredRegistry?.id,
  });

  if (cases.length === 0) {
    throw new Error(
      `No prior acute pericarditis/tamponade case found to repair. Registry ${registry.id} was found and education ${education.id} was updated.`,
    );
  }

  const repairedCases = [];
  for (const caseToRepair of cases) {
    repairedCases.push(await repairCase(caseToRepair.id, registry));
  }

  console.log('Repaired Acute Pericarditis case seed:', {
    registryId: registry.id,
    registryDisplayLabel: registry.displayLabel,
    retiredDescriptiveRegistryId: retiredRegistry?.id ?? null,
    educationId: education.id,
    repairedCases,
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
