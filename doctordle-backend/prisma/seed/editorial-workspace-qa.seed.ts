import {
  AiDraftReviewStatus,
  CaseEditorialStatus,
  DiagnosisAgeGroup,
  DiagnosisAliasKind,
  DiagnosisClinicalSetting,
  DiagnosisDifficultyBand,
  DiagnosisEducationSource,
  DiagnosisEducationStatus,
  DiagnosisEvidenceRelationshipStatus,
  DiagnosisEvidenceRelationshipType,
  DiagnosisGraphCandidateStatus,
  DiagnosisGraphCandidateType,
  DiagnosisGraphFactStatus,
  DiagnosisGraphSourceType,
  DiagnosisMappingMethod,
  DiagnosisMappingStatus,
  DiagnosisRegistryStatus,
  DiagnosisRarityBand,
  DiagnosisTeachingRelationshipPurpose,
  DiagnosisTeachingRelationshipStatus,
  DiagnosisTeachingRelationshipType,
  DiagnosisUrgencyLevel,
  EvidenceNodeStatus,
  EvidenceType,
  ClinicalCategory,
  GenerationPurpose,
  ReasoningDraftArtifactType,
  ReasoningDraftTrustTier,
  ReasoningDraftValidationStatus,
  ReasoningGoal,
  ReasoningPathStatus,
  type Prisma,
  PrismaClient,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const QA_MARKER = 'QA_ONLY_EDITORIAL_WORKSPACE_SEED';
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run the editorial workspace QA seed.');
}

if (
  process.env.NODE_ENV === 'production' ||
  process.env.EDITORIAL_WORKSPACE_QA_SEED !== '1'
) {
  throw new Error(
    'Refusing to run QA seed. Set EDITORIAL_WORKSPACE_QA_SEED=1 in a non-production environment.',
  );
}

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

type QaState = 'near-ready' | 'blocked' | 'sparse' | 'draft-heavy' | 'review';

type QaDiagnosis = {
  label: string;
  aliases: string[];
  specialty: string;
  category: string;
  bodySystem: string;
  difficultyBand: DiagnosisDifficultyBand;
  clinicalSetting: DiagnosisClinicalSetting;
  urgencyLevel: DiagnosisUrgencyLevel;
  ageGroup: DiagnosisAgeGroup;
  searchPriority: number;
  state: QaState;
  educationStatus: DiagnosisEducationStatus;
  caseStatus: CaseEditorialStatus;
  ruleStatuses: string[];
  briefStatus: string | null;
  weakSection: 'differentials' | 'investigations' | 'examPearls' | 'management';
  mimic: string;
  discriminator: string;
  escalationType?: string;
  unsupportedClaim?: string;
  auditStatuses: AiDraftReviewStatus[];
};

const diagnoses: QaDiagnosis[] = [
  {
    label: 'Appendicitis',
    aliases: ['Acute appendicitis'],
    specialty: 'General Surgery',
    category: 'Acute abdomen',
    bodySystem: 'Gastrointestinal',
    difficultyBand: DiagnosisDifficultyBand.BASIC,
    clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
    urgencyLevel: DiagnosisUrgencyLevel.URGENT,
    ageGroup: DiagnosisAgeGroup.ANY,
    searchPriority: 95,
    state: 'near-ready',
    educationStatus: DiagnosisEducationStatus.APPROVED,
    caseStatus: CaseEditorialStatus.READY_TO_PUBLISH,
    ruleStatuses: ['ACTIVE', 'ACTIVE', 'APPROVED'],
    briefStatus: 'APPROVED',
    weakSection: 'management',
    mimic: 'Ruptured Ectopic Pregnancy',
    discriminator: 'migration of pain to right lower quadrant',
    escalationType: 'peritonitis',
    unsupportedClaim: 'Appendicitis always requires immediate surgery.',
    auditStatuses: [
      AiDraftReviewStatus.PENDING_REVIEW,
      AiDraftReviewStatus.ACCEPTED,
    ],
  },
  {
    label: 'Acute Pancreatitis',
    aliases: ['Pancreatitis'],
    specialty: 'Gastroenterology',
    category: 'Upper abdominal pain',
    bodySystem: 'Gastrointestinal',
    difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
    clinicalSetting: DiagnosisClinicalSetting.INPATIENT,
    urgencyLevel: DiagnosisUrgencyLevel.URGENT,
    ageGroup: DiagnosisAgeGroup.ADULT,
    searchPriority: 88,
    state: 'draft-heavy',
    educationStatus: DiagnosisEducationStatus.NEEDS_REVIEW,
    caseStatus: CaseEditorialStatus.REVIEW,
    ruleStatuses: ['CANDIDATE', 'NEEDS_REVIEW', 'APPROVED'],
    briefStatus: 'DRAFT',
    weakSection: 'investigations',
    mimic: 'Peptic Ulcer Disease',
    discriminator: 'lipase elevation with epigastric pain radiating to back',
    escalationType: 'necrotizing pancreatitis',
    unsupportedClaim: 'A normal lipase rules out acute pancreatitis.',
    auditStatuses: [
      AiDraftReviewStatus.PENDING_REVIEW,
      AiDraftReviewStatus.NEEDS_CHANGES,
    ],
  },
  {
    label: 'Diabetic Ketoacidosis',
    aliases: ['DKA'],
    specialty: 'Endocrinology',
    category: 'Diabetes',
    bodySystem: 'Endocrine',
    difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
    clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
    urgencyLevel: DiagnosisUrgencyLevel.EMERGENT,
    ageGroup: DiagnosisAgeGroup.ANY,
    searchPriority: 92,
    state: 'blocked',
    educationStatus: DiagnosisEducationStatus.NEEDS_EDIT,
    caseStatus: CaseEditorialStatus.NEEDS_EDIT,
    ruleStatuses: ['NEEDS_REVIEW', 'CANDIDATE', 'CANDIDATE'],
    briefStatus: 'NEEDS_REVIEW',
    weakSection: 'management',
    mimic: 'SIADH',
    discriminator: 'anion-gap acidosis with ketones',
    escalationType: 'cerebral edema',
    unsupportedClaim: 'Insulin should never be delayed in DKA.',
    auditStatuses: [
      AiDraftReviewStatus.PENDING_REVIEW,
      AiDraftReviewStatus.REJECTED,
    ],
  },
  {
    label: 'Ruptured Ectopic Pregnancy',
    aliases: ['Ectopic pregnancy rupture', 'Ectopic Pregnancy'],
    specialty: 'Obstetrics and Gynecology',
    category: 'Early pregnancy emergency',
    bodySystem: 'Reproductive',
    difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
    clinicalSetting: DiagnosisClinicalSetting.EMERGENCY,
    urgencyLevel: DiagnosisUrgencyLevel.EMERGENT,
    ageGroup: DiagnosisAgeGroup.ADULT,
    searchPriority: 89,
    state: 'blocked',
    educationStatus: DiagnosisEducationStatus.NEEDS_REVIEW,
    caseStatus: CaseEditorialStatus.REVIEW,
    ruleStatuses: ['ACTIVE', 'NEEDS_REVIEW', 'CANDIDATE'],
    briefStatus: 'APPROVED',
    weakSection: 'examPearls',
    mimic: 'Appendicitis',
    discriminator: 'positive pregnancy test with shock and pelvic pain',
    escalationType: 'hemorrhagic shock',
    unsupportedClaim: 'Ultrasound always confirms ruptured ectopic pregnancy.',
    auditStatuses: [
      AiDraftReviewStatus.PENDING_REVIEW,
      AiDraftReviewStatus.SUPERSEDED,
    ],
  },
  {
    label: 'Peptic Ulcer Disease',
    aliases: ['PUD', 'Gastric ulcer', 'Duodenal ulcer'],
    specialty: 'Gastroenterology',
    category: 'Upper GI disorders',
    bodySystem: 'Gastrointestinal',
    difficultyBand: DiagnosisDifficultyBand.INTERMEDIATE,
    clinicalSetting: DiagnosisClinicalSetting.OUTPATIENT,
    urgencyLevel: DiagnosisUrgencyLevel.ROUTINE,
    ageGroup: DiagnosisAgeGroup.ADULT,
    searchPriority: 82,
    state: 'near-ready',
    educationStatus: DiagnosisEducationStatus.APPROVED,
    caseStatus: CaseEditorialStatus.PUBLISHED,
    ruleStatuses: ['ACTIVE', 'APPROVED', 'APPROVED'],
    briefStatus: 'APPROVED',
    weakSection: 'differentials',
    mimic: 'Acute Pancreatitis',
    discriminator: 'epigastric pain related to meals or NSAID exposure',
    escalationType: 'upper gastrointestinal bleeding',
    unsupportedClaim: 'Endoscopy is never needed for dyspepsia.',
    auditStatuses: [AiDraftReviewStatus.PENDING_REVIEW],
  },
  {
    label: 'Nutritional Vitamin D Deficiency Rickets',
    aliases: ['Vitamin D deficiency rickets', 'Rickets'],
    specialty: 'Paediatrics',
    category: 'Metabolic bone disease',
    bodySystem: 'Musculoskeletal',
    difficultyBand: DiagnosisDifficultyBand.BASIC,
    clinicalSetting: DiagnosisClinicalSetting.OUTPATIENT,
    urgencyLevel: DiagnosisUrgencyLevel.ROUTINE,
    ageGroup: DiagnosisAgeGroup.PEDIATRIC,
    searchPriority: 74,
    state: 'sparse',
    educationStatus: DiagnosisEducationStatus.NEEDS_REVIEW,
    caseStatus: CaseEditorialStatus.READY_TO_PUBLISH,
    ruleStatuses: ['CANDIDATE', 'CANDIDATE', 'NEEDS_REVIEW'],
    briefStatus: null,
    weakSection: 'investigations',
    mimic: 'Peptic Ulcer Disease',
    discriminator: 'bowed legs with low vitamin D and raised alkaline phosphatase',
    unsupportedClaim: 'Rickets is always caused by poor diet.',
    auditStatuses: [AiDraftReviewStatus.PENDING_REVIEW],
  },
  {
    label: 'SIADH',
    aliases: ['Syndrome of Inappropriate Antidiuretic Hormone'],
    specialty: 'Endocrinology',
    category: 'Electrolyte disorders',
    bodySystem: 'Endocrine',
    difficultyBand: DiagnosisDifficultyBand.ADVANCED,
    clinicalSetting: DiagnosisClinicalSetting.INPATIENT,
    urgencyLevel: DiagnosisUrgencyLevel.URGENT,
    ageGroup: DiagnosisAgeGroup.ADULT,
    searchPriority: 78,
    state: 'draft-heavy',
    educationStatus: DiagnosisEducationStatus.NEEDS_REVIEW,
    caseStatus: CaseEditorialStatus.REVIEW,
    ruleStatuses: ['ACTIVE', 'CANDIDATE', 'NEEDS_REVIEW'],
    briefStatus: 'NEEDS_REVIEW',
    weakSection: 'differentials',
    mimic: 'Diabetic Ketoacidosis',
    discriminator: 'euvolemic hypotonic hyponatremia with concentrated urine',
    escalationType: 'severe symptomatic hyponatremia',
    unsupportedClaim: 'Normal saline always corrects SIADH.',
    auditStatuses: [AiDraftReviewStatus.PENDING_REVIEW],
  },
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function stableKey(value: string) {
  return normalize(value).replace(/\s+/g, '-');
}

function qaKey(diagnosis: string, suffix: string) {
  return `qa-${stableKey(diagnosis)}-${suffix}`;
}

function educationSnapshot(config: QaDiagnosis): Record<string, Prisma.InputJsonValue> {
  const weak = `QA weak section: ${config.weakSection} needs editor repair for ${config.label}.`;
  return {
    summary: {
      content: `${config.label} QA overview: concise clinical pattern for local editorial workspace testing.`,
    },
    clinicalPattern: [
      `${config.label} presents with a recognizable pattern that should be distinguished from ${config.mimic}.`,
      config.discriminator,
    ],
    keySymptoms: [`Typical symptom cluster for ${config.label}`, 'QA seed symptom'],
    keySigns: [`Key examination cue for ${config.label}`, 'QA seed sign'],
    examPearls:
      config.weakSection === 'examPearls'
        ? [weak]
        : [`Look for ${config.discriminator}.`],
    scoringSystems: [],
    investigations:
      config.weakSection === 'investigations'
        ? [weak]
        : [`Use targeted tests to confirm ${config.label} and exclude ${config.mimic}.`],
    differentials:
      config.weakSection === 'differentials'
        ? [weak]
        : [`Differentiate from ${config.mimic} using ${config.discriminator}.`],
    management:
      config.weakSection === 'management'
        ? [weak]
        : [`Treat ${config.label} while watching for escalation signals.`],
    complications: config.escalationType ? [config.escalationType] : [],
    pitfalls: [
      config.unsupportedClaim ?? `QA pitfall for ${config.label} needs evidence support.`,
    ],
    recallPrompts: [`What finding best separates ${config.label} from ${config.mimic}?`],
    references: [`${QA_MARKER}: local QA seed reference.`],
  };
}

function caseExplanation(config: QaDiagnosis) {
  return {
    diagnosis: config.label,
    summary: `${QA_MARKER}: ${config.discriminator} supports ${config.label}.`,
    reasoning: [
      `The presentation is designed to test ${config.label} editorial coverage.`,
      `The main mimic is ${config.mimic}.`,
    ],
    teachingAlignment: [
      `Covers learning goal for ${config.discriminator}.`,
    ],
    keyFindings: [config.discriminator],
    differentials: [config.mimic],
  };
}

function dateFor(index: number) {
  return new Date(Date.UTC(2035, 0, index + 1, 12, 0, 0));
}

async function upsertRegistry(config: QaDiagnosis) {
  const canonicalNormalized = normalize(config.label);
  const registry = await prisma.diagnosisRegistry.upsert({
    where: { canonicalNormalized },
    update: {
      displayLabel: config.label,
      status: DiagnosisRegistryStatus.ACTIVE,
      active: true,
      isPlayable: true,
      isGeneratable: true,
      onboardingStatus:
        config.state === 'near-ready'
          ? 'READY_FOR_REVIEW'
          : config.state === 'sparse'
            ? 'BRIEF_STARTED'
            : 'EDUCATION_STARTED',
      searchPriority: config.searchPriority,
      category: config.category,
      specialty: config.specialty,
      bodySystem: config.bodySystem,
      difficultyBand: config.difficultyBand,
      rarityBand: DiagnosisRarityBand.COMMON,
      clinicalSetting: config.clinicalSetting,
      ageGroup: config.ageGroup,
      urgencyLevel: config.urgencyLevel,
      notes: `${QA_MARKER}: ${config.state} workspace scenario.`,
    },
    create: {
      canonicalName: config.label,
      canonicalNormalized,
      displayLabel: config.label,
      status: DiagnosisRegistryStatus.ACTIVE,
      active: true,
      isPlayable: true,
      isGeneratable: true,
      onboardingStatus:
        config.state === 'near-ready'
          ? 'READY_FOR_REVIEW'
          : config.state === 'sparse'
            ? 'BRIEF_STARTED'
            : 'EDUCATION_STARTED',
      searchPriority: config.searchPriority,
      category: config.category,
      specialty: config.specialty,
      bodySystem: config.bodySystem,
      difficultyBand: config.difficultyBand,
      rarityBand: DiagnosisRarityBand.COMMON,
      clinicalSetting: config.clinicalSetting,
      ageGroup: config.ageGroup,
      urgencyLevel: config.urgencyLevel,
      notes: `${QA_MARKER}: ${config.state} workspace scenario.`,
    },
  });

  for (const [index, alias] of config.aliases.entries()) {
    await prisma.diagnosisAlias.upsert({
      where: {
        diagnosisRegistryId_normalizedTerm: {
          diagnosisRegistryId: registry.id,
          normalizedTerm: normalize(alias),
        },
      },
      update: {
        term: alias,
        kind: index === 0 ? DiagnosisAliasKind.ACCEPTED : DiagnosisAliasKind.SEARCH_ONLY,
        acceptedForMatch: index === 0,
        source: QA_MARKER,
        active: true,
      },
      create: {
        diagnosisRegistryId: registry.id,
        term: alias,
        normalizedTerm: normalize(alias),
        kind: index === 0 ? DiagnosisAliasKind.ACCEPTED : DiagnosisAliasKind.SEARCH_ONLY,
        acceptedForMatch: index === 0,
        rank: index + 1,
        source: QA_MARKER,
        active: true,
      },
    });
  }

  return registry;
}

async function upsertBrief(config: QaDiagnosis, diagnosisRegistryId: string) {
  if (!config.briefStatus) {
    await prisma.diagnosisEditorialBrief.deleteMany({
      where: {
        diagnosisRegistryId,
        summary: { contains: QA_MARKER },
      },
    });
    return null;
  }

  const learningGoals = [
    `Recognize ${config.label} using ${config.discriminator}`,
    `Distinguish ${config.label} from ${config.mimic}`,
    config.escalationType
      ? `Escalate when ${config.escalationType} is suspected`
      : `Select appropriate next investigation for ${config.label}`,
  ];

  return prisma.diagnosisEditorialBrief.upsert({
    where: { diagnosisRegistryId },
    update: {
      summary: `${QA_MARKER}: Objectives for ${config.label}.`,
      learningGoals,
      requiredTeachingRuleIds: config.ruleStatuses.map((_, index) =>
        qaKey(config.label, `rule-${index + 1}`),
      ),
      requiredMimicIds: [config.mimic],
      requiredPitfalls: [config.unsupportedClaim ?? `Pitfall for ${config.label}`],
      keyInvestigations: [`Confirm ${config.discriminator}`],
      managementAnchors: [`Manage ${config.label} and monitor escalation.`],
      difficultyGuidance: [`${config.difficultyBand} QA scenario.`],
      caseGenerationGuidance: [`Generate a case that tests ${config.discriminator}.`],
      educationGuidance: [`Keep ${config.weakSection} intentionally weak for QA.`],
      graphGuidance: [`Map ${config.label} against ${config.mimic}.`],
      status: config.briefStatus,
      version: 2,
    },
    create: {
      diagnosisRegistryId,
      summary: `${QA_MARKER}: Objectives for ${config.label}.`,
      learningGoals,
      requiredTeachingRuleIds: config.ruleStatuses.map((_, index) =>
        qaKey(config.label, `rule-${index + 1}`),
      ),
      requiredMimicIds: [config.mimic],
      requiredPitfalls: [config.unsupportedClaim ?? `Pitfall for ${config.label}`],
      keyInvestigations: [`Confirm ${config.discriminator}`],
      managementAnchors: [`Manage ${config.label} and monitor escalation.`],
      difficultyGuidance: [`${config.difficultyBand} QA scenario.`],
      caseGenerationGuidance: [`Generate a case that tests ${config.discriminator}.`],
      educationGuidance: [`Keep ${config.weakSection} intentionally weak for QA.`],
      graphGuidance: [`Map ${config.label} against ${config.mimic}.`],
      status: config.briefStatus,
      version: 2,
    },
  });
}

async function upsertEducation(config: QaDiagnosis, diagnosisRegistryId: string) {
  const snapshot = educationSnapshot(config);
  const education = await prisma.diagnosisEducation.upsert({
    where: { diagnosisRegistryId },
    update: {
      title: `${config.label} editorial QA education`,
      summary: snapshot.summary,
      clinicalPattern: snapshot.clinicalPattern,
      keySymptoms: snapshot.keySymptoms,
      keySigns: snapshot.keySigns,
      examPearls: snapshot.examPearls,
      scoringSystems: snapshot.scoringSystems,
      investigations: snapshot.investigations,
      differentials: snapshot.differentials,
      management: snapshot.management,
      complications: snapshot.complications,
      pitfalls: snapshot.pitfalls,
      recallPrompts: snapshot.recallPrompts,
      references: snapshot.references,
      editorialStatus: config.educationStatus,
      source: DiagnosisEducationSource.HYBRID,
      version: 3,
      generatedAt: new Date(),
    },
    create: {
      diagnosisRegistryId,
      title: `${config.label} editorial QA education`,
      summary: snapshot.summary,
      clinicalPattern: snapshot.clinicalPattern,
      keySymptoms: snapshot.keySymptoms,
      keySigns: snapshot.keySigns,
      examPearls: snapshot.examPearls,
      scoringSystems: snapshot.scoringSystems,
      investigations: snapshot.investigations,
      differentials: snapshot.differentials,
      management: snapshot.management,
      complications: snapshot.complications,
      pitfalls: snapshot.pitfalls,
      recallPrompts: snapshot.recallPrompts,
      references: snapshot.references,
      editorialStatus: config.educationStatus,
      source: DiagnosisEducationSource.HYBRID,
      version: 3,
      generatedAt: new Date(),
    },
  });

  await prisma.diagnosisEducationRevision.upsert({
    where: {
      educationId_version: {
        educationId: education.id,
        version: 3,
      },
    },
    update: {
      snapshot,
      editorialStatus: config.educationStatus,
      source: DiagnosisEducationSource.HYBRID,
    },
    create: {
      educationId: education.id,
      version: 3,
      snapshot,
      editorialStatus: config.educationStatus,
      source: DiagnosisEducationSource.HYBRID,
    },
  });

  return education;
}

async function upsertTeachingRules(config: QaDiagnosis, diagnosisRegistryId: string) {
  const rules = [
    {
      stableKey: qaKey(config.label, 'rule-1'),
      title: `${config.label}: core discriminator`,
      category: 'discriminator',
      importance: 'critical',
      rationale: `QA rule: ${config.discriminator}.`,
      appliesToGraph: true,
    },
    {
      stableKey: qaKey(config.label, 'rule-2'),
      title: `${config.label}: mimic distinction`,
      category: 'differential',
      importance: 'high',
      rationale: `QA rule: separate from ${config.mimic}.`,
      appliesToGraph: true,
    },
    {
      stableKey: qaKey(config.label, 'rule-3'),
      title: `${config.label}: escalation pathway`,
      category: 'escalation',
      importance: config.escalationType ? 'critical' : 'medium',
      rationale: `QA rule: ${config.escalationType ?? 'no escalation target'}.`,
      appliesToGraph: Boolean(config.escalationType),
    },
  ];

  const result = [];
  for (const [index, rule] of rules.entries()) {
    result.push(
      await prisma.diagnosisTeachingRule.upsert({
        where: {
          diagnosisRegistryId_stableKey: {
            diagnosisRegistryId,
            stableKey: rule.stableKey,
          },
        },
        update: {
          title: rule.title,
          category: rule.category,
          importance: rule.importance,
          rationale: rule.rationale,
          acceptableManifestations: [config.discriminator],
          requiredDifferentials: [config.mimic],
          expectedEvidence: [config.discriminator],
          difficultyHints: [`${config.difficultyBand} QA rule`],
          appliesToEducation: true,
          appliesToCaseGeneration: true,
          appliesToGraph: rule.appliesToGraph,
          status: config.ruleStatuses[index] ?? 'CANDIDATE',
          source: QA_MARKER,
          version: 1,
        },
        create: {
          diagnosisRegistryId,
          stableKey: rule.stableKey,
          title: rule.title,
          category: rule.category,
          importance: rule.importance,
          rationale: rule.rationale,
          acceptableManifestations: [config.discriminator],
          requiredDifferentials: [config.mimic],
          expectedEvidence: [config.discriminator],
          difficultyHints: [`${config.difficultyBand} QA rule`],
          appliesToEducation: true,
          appliesToCaseGeneration: true,
          appliesToGraph: rule.appliesToGraph,
          status: config.ruleStatuses[index] ?? 'CANDIDATE',
          source: QA_MARKER,
          version: 1,
        },
      }),
    );
  }
  return result;
}

async function upsertCase(
  config: QaDiagnosis,
  diagnosisRegistryId: string,
  index: number,
) {
  const existing = await prisma.case.findFirst({
    where: {
      diagnosisRegistryId,
      diagnosisEditorialNote: { contains: QA_MARKER },
    },
    orderBy: { date: 'asc' },
  });
  const data = {
    title: `${config.label} QA case`,
    date: dateFor(index),
    difficulty: config.difficultyBand === DiagnosisDifficultyBand.BASIC ? 'easy' : 'medium',
    history: `${QA_MARKER}: Patient scenario for ${config.label} with ${config.discriminator}.`,
    symptoms: [`Symptom pattern for ${config.label}`, config.discriminator],
    labs: {
      qa: true,
      discriminator: config.discriminator,
    },
    clues: [
      { order: 0, type: 'history', value: `QA history cue for ${config.label}.` },
      { order: 1, type: 'lab', value: config.discriminator },
    ],
    explanation: caseExplanation(config),
    differentials: [config.mimic],
    editorialStatus: config.caseStatus,
    proposedDiagnosisText: config.label,
    diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
    diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
    diagnosisMappingConfidence: 1,
    diagnosisEditorialNote: `${QA_MARKER}: case inventory scenario for ${config.state}.`,
    diagnosisRegistryId,
    approvedAt:
      config.caseStatus === CaseEditorialStatus.APPROVED ||
      config.caseStatus === CaseEditorialStatus.READY_TO_PUBLISH ||
      config.caseStatus === CaseEditorialStatus.PUBLISHED
        ? new Date()
        : null,
    publishedAt:
      config.caseStatus === CaseEditorialStatus.PUBLISHED ? new Date() : null,
  };

  return existing
    ? prisma.case.update({ where: { id: existing.id }, data })
    : prisma.case.create({ data });
}

async function upsertGraph(
  config: QaDiagnosis,
  diagnosisRegistryId: string,
  targetDiagnosisRegistryId: string,
  educationId: string,
  ruleId: string,
  caseId: string,
) {
  const normalizedLabel = normalize(config.discriminator);
  const fact = await prisma.diagnosisGraphFact.upsert({
    where: {
      diagnosisRegistryId_type_normalizedLabel_targetDiagnosisRegistryId: {
        diagnosisRegistryId,
        type: DiagnosisGraphCandidateType.MIMIC,
        normalizedLabel,
        targetDiagnosisRegistryId,
      },
    },
    update: {
      label: config.discriminator,
      payload: { qa: true, marker: QA_MARKER, mimic: config.mimic },
      status: DiagnosisGraphFactStatus.ACTIVE,
      provenance: { source: QA_MARKER },
    },
    create: {
      diagnosisRegistryId,
      type: DiagnosisGraphCandidateType.MIMIC,
      label: config.discriminator,
      normalizedLabel,
      dedupeKey: qaKey(config.label, 'graph-fact-mimic'),
      payload: { qa: true, marker: QA_MARKER, mimic: config.mimic },
      targetDiagnosisRegistryId,
      status: DiagnosisGraphFactStatus.ACTIVE,
      provenance: { source: QA_MARKER },
    },
  });

  const candidateDedupeKey = qaKey(config.label, 'graph-candidate-mimic');
  await prisma.diagnosisGraphCandidate.upsert({
    where: { dedupeKey: candidateDedupeKey },
    update: {
      status:
        config.state === 'sparse'
          ? DiagnosisGraphCandidateStatus.CANDIDATE
          : DiagnosisGraphCandidateStatus.APPROVED,
      rawText: config.discriminator,
      normalizedText: normalizedLabel,
      payload: { qa: true, marker: QA_MARKER },
      targetDiagnosisRegistryId,
      promotedFactId: fact.id,
    },
    create: {
      diagnosisRegistryId,
      type: DiagnosisGraphCandidateType.MIMIC,
      status:
        config.state === 'sparse'
          ? DiagnosisGraphCandidateStatus.CANDIDATE
          : DiagnosisGraphCandidateStatus.APPROVED,
      sourceType: DiagnosisGraphSourceType.DIAGNOSIS_EDUCATION,
      sourceId: educationId,
      sourceVersion: 3,
      sourcePath: `qa.${config.weakSection}`,
      rawText: config.discriminator,
      normalizedText: normalizedLabel,
      dedupeKey: candidateDedupeKey,
      payload: { qa: true, marker: QA_MARKER },
      targetDiagnosisRegistryId,
      confidence: 0.82,
      promotedFactId: fact.id,
    },
  });

  await prisma.diagnosisTeachingRelationship.upsert({
    where: {
      sourceDiagnosisRegistryId_targetDiagnosisRegistryId_relationshipType_teachingPurpose: {
        sourceDiagnosisRegistryId: diagnosisRegistryId,
        targetDiagnosisRegistryId,
        relationshipType: DiagnosisTeachingRelationshipType.MIMIC_CONFUSION,
        teachingPurpose: DiagnosisTeachingRelationshipPurpose.TEACH_DISCRIMINATOR,
      },
    },
    update: {
      discriminatorSummary: config.discriminator,
      commonConfusionReason: `${config.label} and ${config.mimic} can overlap early.`,
      learnerPitfall: config.unsupportedClaim ?? `Confusing ${config.label} with ${config.mimic}.`,
      suggestedTeachingRuleStableKey: qaKey(config.label, 'rule-2'),
      supportingGraphFactId: fact.id,
      supportingTeachingRuleId: ruleId,
      strength: config.state === 'near-ready' ? 4 : 2,
      status:
        config.state === 'sparse'
          ? DiagnosisTeachingRelationshipStatus.CANDIDATE
          : DiagnosisTeachingRelationshipStatus.ACTIVE,
    },
    create: {
      sourceDiagnosisRegistryId: diagnosisRegistryId,
      targetDiagnosisRegistryId,
      relationshipType: DiagnosisTeachingRelationshipType.MIMIC_CONFUSION,
      teachingPurpose: DiagnosisTeachingRelationshipPurpose.TEACH_DISCRIMINATOR,
      discriminatorSummary: config.discriminator,
      commonConfusionReason: `${config.label} and ${config.mimic} can overlap early.`,
      learnerPitfall: config.unsupportedClaim ?? `Confusing ${config.label} with ${config.mimic}.`,
      suggestedTeachingRuleStableKey: qaKey(config.label, 'rule-2'),
      supportingGraphFactId: fact.id,
      supportingTeachingRuleId: ruleId,
      strength: config.state === 'near-ready' ? 4 : 2,
      status:
        config.state === 'sparse'
          ? DiagnosisTeachingRelationshipStatus.CANDIDATE
          : DiagnosisTeachingRelationshipStatus.ACTIVE,
    },
  });

  if (config.escalationType) {
    await prisma.diagnosisTeachingRelationship.upsert({
      where: {
        sourceDiagnosisRegistryId_targetDiagnosisRegistryId_relationshipType_teachingPurpose: {
          sourceDiagnosisRegistryId: diagnosisRegistryId,
          targetDiagnosisRegistryId,
          relationshipType: DiagnosisTeachingRelationshipType.ESCALATION_CONTRAST,
          teachingPurpose: DiagnosisTeachingRelationshipPurpose.SUPPORT_CASE_GENERATION,
        },
      },
      update: {
        discriminatorSummary: config.escalationType,
        commonConfusionReason: config.escalationType,
        learnerPitfall: config.escalationType,
        suggestedTeachingRuleStableKey: qaKey(config.label, 'rule-3'),
        supportingGraphFactId: fact.id,
        supportingTeachingRuleId: ruleId,
        strength: 3,
        status:
          config.state === 'blocked'
            ? DiagnosisTeachingRelationshipStatus.NEEDS_REVIEW
            : DiagnosisTeachingRelationshipStatus.ACTIVE,
      },
      create: {
        sourceDiagnosisRegistryId: diagnosisRegistryId,
        targetDiagnosisRegistryId,
        relationshipType: DiagnosisTeachingRelationshipType.ESCALATION_CONTRAST,
        teachingPurpose: DiagnosisTeachingRelationshipPurpose.SUPPORT_CASE_GENERATION,
        discriminatorSummary: config.escalationType,
        commonConfusionReason: config.escalationType,
        learnerPitfall: config.escalationType,
        suggestedTeachingRuleStableKey: qaKey(config.label, 'rule-3'),
        supportingGraphFactId: fact.id,
        supportingTeachingRuleId: ruleId,
        strength: 3,
        status:
          config.state === 'blocked'
            ? DiagnosisTeachingRelationshipStatus.NEEDS_REVIEW
            : DiagnosisTeachingRelationshipStatus.ACTIVE,
      },
    });
  }

  const evidenceNode = await prisma.evidenceNode.upsert({
    where: { normalizedKey: qaKey(config.label, 'evidence-node') },
    update: {
      displayLabel: config.discriminator,
      evidenceType: EvidenceType.EXAM,
      clinicalCategory: ClinicalCategory.OTHER,
      synonyms: [config.discriminator],
      status: EvidenceNodeStatus.ACTIVE,
    },
    create: {
      normalizedKey: qaKey(config.label, 'evidence-node'),
      displayLabel: config.discriminator,
      evidenceType: EvidenceType.EXAM,
      clinicalCategory: ClinicalCategory.OTHER,
      synonyms: [config.discriminator],
      status: EvidenceNodeStatus.ACTIVE,
    },
  });

  await prisma.diagnosisEvidenceRelationship.upsert({
    where: {
      diagnosisRegistryId_evidenceNodeId_relationshipType: {
        diagnosisRegistryId,
        evidenceNodeId: evidenceNode.id,
        relationshipType: DiagnosisEvidenceRelationshipType.DISCRIMINATES,
      },
    },
    update: {
      strength: 4,
      discriminatorWeight: 80,
      reasoningSummary: `${QA_MARKER}: evidence relationship for ${config.label}.`,
      contradictoryDiagnosisIds: [targetDiagnosisRegistryId],
      supportingTeachingRuleId: ruleId,
      supportingCaseId: caseId,
      status:
        config.state === 'blocked'
          ? DiagnosisEvidenceRelationshipStatus.CANDIDATE
          : DiagnosisEvidenceRelationshipStatus.ACTIVE,
    },
    create: {
      diagnosisRegistryId,
      evidenceNodeId: evidenceNode.id,
      relationshipType: DiagnosisEvidenceRelationshipType.DISCRIMINATES,
      strength: 4,
      discriminatorWeight: 80,
      reasoningSummary: `${QA_MARKER}: evidence relationship for ${config.label}.`,
      contradictoryDiagnosisIds: [targetDiagnosisRegistryId],
      supportingTeachingRuleId: ruleId,
      supportingCaseId: caseId,
      status:
        config.state === 'blocked'
          ? DiagnosisEvidenceRelationshipStatus.CANDIDATE
          : DiagnosisEvidenceRelationshipStatus.ACTIVE,
    },
  });
}

async function upsertReasoningPath(
  config: QaDiagnosis,
  diagnosisRegistryId: string,
) {
  const normalizedKey = qaKey(config.label, 'reasoning-path');
  return prisma.reasoningPath.upsert({
    where: { normalizedKey },
    update: {
      title: `${config.label} QA reasoning path`,
      reasoningGoal: config.escalationType
        ? ReasoningGoal.ESCALATION_RECOGNITION
        : ReasoningGoal.DIFFERENTIAL_DISCRIMINATION,
      primaryDifferentialIds: [config.mimic],
      discriminatorEvidenceNodeIds: [config.discriminator],
      escalationEvidenceNodeIds: config.escalationType ? [config.escalationType] : [],
      requiredTeachingPoints: [config.discriminator],
      forbiddenEvidencePatterns: [config.unsupportedClaim ?? 'unsupported absolute claim'],
      recommendedClueDistribution: { history: 1, exam: 1, labs: 1 },
      generationPurpose: GenerationPurpose.CASE_GENERATION,
      readinessScore: config.state === 'near-ready' ? 85 : config.state === 'sparse' ? 25 : 55,
      status:
        config.state === 'sparse'
          ? ReasoningPathStatus.CANDIDATE
          : ReasoningPathStatus.ACTIVE,
    },
    create: {
      diagnosisRegistryId,
      normalizedKey,
      title: `${config.label} QA reasoning path`,
      reasoningGoal: config.escalationType
        ? ReasoningGoal.ESCALATION_RECOGNITION
        : ReasoningGoal.DIFFERENTIAL_DISCRIMINATION,
      primaryDifferentialIds: [config.mimic],
      discriminatorEvidenceNodeIds: [config.discriminator],
      escalationEvidenceNodeIds: config.escalationType ? [config.escalationType] : [],
      requiredTeachingPoints: [config.discriminator],
      forbiddenEvidencePatterns: [config.unsupportedClaim ?? 'unsupported absolute claim'],
      recommendedClueDistribution: { history: 1, exam: 1, labs: 1 },
      generationPurpose: GenerationPurpose.CASE_GENERATION,
      readinessScore: config.state === 'near-ready' ? 85 : config.state === 'sparse' ? 25 : 55,
      status:
        config.state === 'sparse'
          ? ReasoningPathStatus.CANDIDATE
          : ReasoningPathStatus.ACTIVE,
    },
  });
}

async function upsertCoverageAnnotations(
  config: QaDiagnosis,
  diagnosisRegistryId: string,
  caseId: string,
  reasoningPathId: string,
) {
  const learningGoalId = qaKey(config.label, 'learning-goal-1');
  await prisma.caseLearningGoalCoverage.upsert({
    where: {
      caseId_learningGoalId: {
        caseId,
        learningGoalId,
      },
    },
    update: {
      learningGoal: `Recognize ${config.label} using ${config.discriminator}`,
      coverageStrength: config.state === 'near-ready' ? 90 : config.state === 'sparse' ? 35 : 60,
      coveredDiscriminators:
        config.state === 'sparse' ? [] : [config.discriminator],
      missingDiscriminators:
        config.state === 'sparse' ? [config.discriminator] : [],
      coveredMimics:
        config.state === 'near-ready' ? [config.mimic] : [],
      missingMimics:
        config.state === 'near-ready' ? [] : [config.mimic],
      evidenceSource: QA_MARKER,
    },
    create: {
      diagnosisRegistryId,
      caseId,
      learningGoalId,
      learningGoal: `Recognize ${config.label} using ${config.discriminator}`,
      coverageStrength: config.state === 'near-ready' ? 90 : config.state === 'sparse' ? 35 : 60,
      coveredDiscriminators:
        config.state === 'sparse' ? [] : [config.discriminator],
      missingDiscriminators:
        config.state === 'sparse' ? [config.discriminator] : [],
      coveredMimics:
        config.state === 'near-ready' ? [config.mimic] : [],
      missingMimics:
        config.state === 'near-ready' ? [] : [config.mimic],
      evidenceSource: QA_MARKER,
    },
  });

  if (config.escalationType) {
    await prisma.caseEscalationAnnotation.upsert({
      where: {
        caseId_escalationType: {
          caseId,
          escalationType: config.escalationType,
        },
      },
      update: {
        covered: config.state !== 'blocked',
        evidenceStrength: config.state === 'near-ready' ? 90 : 55,
        reasoningPathId,
        notes: `${QA_MARKER}: explicit escalation annotation for ${config.label}.`,
      },
      create: {
        diagnosisRegistryId,
        caseId,
        escalationType: config.escalationType,
        covered: config.state !== 'blocked',
        evidenceStrength: config.state === 'near-ready' ? 90 : 55,
        reasoningPathId,
        notes: `${QA_MARKER}: explicit escalation annotation for ${config.label}.`,
      },
    });
  }
}

async function upsertUnsupportedClaimRun(
  config: QaDiagnosis,
  diagnosisRegistryId: string,
  educationId: string,
) {
  if (!config.unsupportedClaim) {
    return;
  }
  const existing = await prisma.reasoningDraftValidationRun.findFirst({
    where: {
      diagnosisRegistryId,
      artifactType: ReasoningDraftArtifactType.EDUCATION_SECTION,
      artifactId: educationId,
      validatorVersion: QA_MARKER,
    },
  });
  const data = {
    artifactType: ReasoningDraftArtifactType.EDUCATION_SECTION,
    artifactId: educationId,
    diagnosisRegistryId,
    reasoningPathId: null,
    trustScore: config.state === 'blocked' ? 20 : 58,
    trustTier:
      config.state === 'blocked'
        ? ReasoningDraftTrustTier.BLOCKED
        : ReasoningDraftTrustTier.REVIEW_REQUIRED,
    validationStatus:
      config.state === 'blocked'
        ? ReasoningDraftValidationStatus.FAILED
        : ReasoningDraftValidationStatus.NEEDS_REVIEW,
    blockers: config.state === 'blocked' ? [config.unsupportedClaim] : [],
    warnings: config.state === 'blocked' ? [] : [config.unsupportedClaim],
    strengths: [`${QA_MARKER}: has realistic clinical frame.`],
    hallucinationRiskSignals: [],
    reasoningCoverage: { qa: true },
    evidenceCoverage: { qa: true },
    discriminatorCoverage: { qa: true },
    unsupportedClaimSignals: [
      {
        sectionId: config.weakSection,
        sectionType: 'education',
        claimId: qaKey(config.label, 'claim-1'),
        claimText: config.unsupportedClaim,
        evidenceIds: [qaKey(config.label, 'evidence-node')],
        repairTarget: `EDUCATION_SECTION:${educationId}`,
      },
    ],
    recommendations: [`Repair ${config.weakSection} claim before publication.`],
    validatorVersion: QA_MARKER,
  };

  if (existing) {
    await prisma.reasoningDraftValidationRun.update({
      where: { id: existing.id },
      data,
    });
  } else {
    await prisma.reasoningDraftValidationRun.create({ data });
  }
}

async function upsertAudits(
  config: QaDiagnosis,
  diagnosisRegistryId: string,
  educationId: string,
  caseId: string,
) {
  for (const [index, status] of config.auditStatuses.entries()) {
    const actionType =
      index === 0 ? 'REPAIR_UNSUPPORTED_CLAIM' : `QA_${status}`;
    const affectedArtifactType = index % 2 === 0 ? 'EDUCATION_SECTION' : 'CASE';
    const affectedArtifactId = affectedArtifactType === 'CASE' ? caseId : educationId;
    const existing = await prisma.aiDraftRevisionAudit.findFirst({
      where: {
        diagnosisRegistryId,
        actionType,
        affectedArtifactType,
        affectedArtifactId,
        sourceIssue: {
          path: ['qaSeedKey'],
          equals: qaKey(config.label, `audit-${index + 1}`),
        },
      },
    });
    const decisionAt =
      status === AiDraftReviewStatus.PENDING_REVIEW ||
      status === AiDraftReviewStatus.REVIEW_REQUIRED
        ? null
        : new Date();
    const data = {
      diagnosisRegistryId,
      caseId: affectedArtifactType === 'CASE' ? caseId : null,
      actionType,
      sourceIssue: {
        qaSeedKey: qaKey(config.label, `audit-${index + 1}`),
        sectionId: config.weakSection,
        claimId: qaKey(config.label, 'claim-1'),
        issue: config.unsupportedClaim ?? `QA draft issue for ${config.label}`,
      },
      inputContext: {
        marker: QA_MARKER,
        diagnosis: config.label,
        state: config.state,
      },
      generatedOutput: {
        originalClaim: config.unsupportedClaim ?? `Original QA claim for ${config.label}`,
        proposedClaim: `QA draft repair for ${config.label}: avoid absolute wording and link evidence.`,
        evidenceIds: [qaKey(config.label, 'evidence-node')],
      },
      editorDecision:
        status === AiDraftReviewStatus.ACCEPTED
          ? 'accept'
          : status === AiDraftReviewStatus.REJECTED
            ? 'reject'
            : status === AiDraftReviewStatus.NEEDS_CHANGES
              ? 'request_changes'
              : status === AiDraftReviewStatus.SUPERSEDED
                ? 'supersede'
                : null,
      reviewerUserId: null,
      decisionAt,
      reviewNote: decisionAt
        ? `${QA_MARKER}: ${status} example for audit trail QA.`
        : null,
      affectedArtifactType,
      affectedArtifactId,
      reviewStatus: status,
      createdByUserId: null,
    };

    if (existing) {
      await prisma.aiDraftRevisionAudit.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.aiDraftRevisionAudit.create({ data });
    }
  }
}

async function seed() {
  const registries = new Map<string, { id: string }>();
  for (const config of diagnoses) {
    const registry = await upsertRegistry(config);
    registries.set(config.label, registry);
  }

  for (const [index, config] of diagnoses.entries()) {
    const registry = registries.get(config.label);
    const target = registries.get(config.mimic) ?? registries.get('Appendicitis');
    if (!registry || !target) {
      throw new Error(`Unable to resolve QA registry pair for ${config.label}`);
    }

    await upsertBrief(config, registry.id);
    const education = await upsertEducation(config, registry.id);
    const rules = await upsertTeachingRules(config, registry.id);
    const qaCase = await upsertCase(config, registry.id, index);
    await upsertGraph(
      config,
      registry.id,
      target.id,
      education.id,
      rules[1]?.id ?? rules[0].id,
      qaCase.id,
    );
    const reasoningPath = await upsertReasoningPath(config, registry.id);
    await upsertCoverageAnnotations(
      config,
      registry.id,
      qaCase.id,
      reasoningPath.id,
    );
    await upsertUnsupportedClaimRun(config, registry.id, education.id);
    await upsertAudits(config, registry.id, education.id, qaCase.id);

    console.log(
      `Seeded ${config.label}: ${config.state} (${registry.id})`,
    );
  }
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
