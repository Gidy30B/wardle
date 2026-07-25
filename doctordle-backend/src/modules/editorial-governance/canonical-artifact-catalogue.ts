import {
  WEOS_ALIGNMENT_CLASSIFICATIONS,
  WEOS_GOVERNANCE_SEVERITIES,
  WEOS_IMPLEMENTATION_SUPPORT,
  WEOS_VERIFICATION_CONFIDENCE,
  type WeosAlignmentClassification,
  type WeosGovernanceSeverity,
  type WeosImplementationSupport,
  type WeosVerificationConfidence,
} from './canonical-concepts';

export const WEOS_ARTIFACT_TYPES = {
  DIAGNOSIS_REGISTRY: 'DIAGNOSIS_REGISTRY',
  DIAGNOSIS_ALIAS: 'DIAGNOSIS_ALIAS',
  DIAGNOSIS_REGISTRY_CANDIDATE: 'DIAGNOSIS_REGISTRY_CANDIDATE',
  REGISTRY_ACTIVATION_STATE: 'REGISTRY_ACTIVATION_STATE',
  DIAGNOSIS_OPERATIONAL_PERMISSION: 'DIAGNOSIS_OPERATIONAL_PERMISSION',
  DIAGNOSIS_ONBOARDING_PROGRESS: 'DIAGNOSIS_ONBOARDING_PROGRESS',
  DIAGNOSIS_OPERATION_READINESS: 'DIAGNOSIS_OPERATION_READINESS',
  EDITORIAL_BRIEF: 'EDITORIAL_BRIEF',
  LEARNING_GOAL: 'LEARNING_GOAL',
  TEACHING_RULE: 'TEACHING_RULE',
  REASONING_PATH: 'REASONING_PATH',
  REASONING_VALIDATION_RESULT: 'REASONING_VALIDATION_RESULT',
  CLINICAL_CASE: 'CLINICAL_CASE',
  CASE_REVISION: 'CASE_REVISION',
  CASE_EXPLANATION: 'CASE_EXPLANATION',
  CLINICAL_CLUE: 'CLINICAL_CLUE',
  CLUE_PROGRESSION_ANALYSIS: 'CLUE_PROGRESSION_ANALYSIS',
  CLUE_DISCRIMINATOR_ANNOTATION: 'CLUE_DISCRIMINATOR_ANNOTATION',
  ESCALATION_ANNOTATION: 'ESCALATION_ANNOTATION',
  DIAGNOSIS_EDUCATION: 'DIAGNOSIS_EDUCATION',
  DIAGNOSIS_EDUCATION_REVISION: 'DIAGNOSIS_EDUCATION_REVISION',
  GRAPH_CANDIDATE: 'GRAPH_CANDIDATE',
  GRAPH_FACT: 'GRAPH_FACT',
  TEACHING_RELATIONSHIP: 'TEACHING_RELATIONSHIP',
  EVIDENCE_NODE: 'EVIDENCE_NODE',
  EVIDENCE_RELATIONSHIP: 'EVIDENCE_RELATIONSHIP',
  EVIDENCE_SOURCE: 'EVIDENCE_SOURCE',
  CLAIM_SUPPORT_LINK: 'CLAIM_SUPPORT_LINK',
  REFERENCE_LIST: 'REFERENCE_LIST',
  EVIDENCE_ASSESSMENT: 'EVIDENCE_ASSESSMENT',
  DIFFERENTIAL_MAPPING: 'DIFFERENTIAL_MAPPING',
  DIFFERENTIAL_LINK: 'DIFFERENTIAL_LINK',
  AI_DRAFT: 'AI_DRAFT',
  AI_DRAFT_ACCEPTANCE: 'AI_DRAFT_ACCEPTANCE',
  CLUE_REVISION_DRAFT: 'CLUE_REVISION_DRAFT',
  VALIDATION_RESULT: 'VALIDATION_RESULT',
  EDITORIAL_ASSESSMENT: 'EDITORIAL_ASSESSMENT',
  CLINICAL_ASSESSMENT: 'CLINICAL_ASSESSMENT',
  EDUCATIONAL_ASSESSMENT: 'EDUCATIONAL_ASSESSMENT',
  REASONING_ASSESSMENT: 'REASONING_ASSESSMENT',
  SAFETY_ASSESSMENT: 'SAFETY_ASSESSMENT',
  LEARNING_GOAL_COVERAGE_ASSESSMENT: 'LEARNING_GOAL_COVERAGE_ASSESSMENT',
  EDITORIAL_REVIEW: 'EDITORIAL_REVIEW',
  REVIEW_PACKET_SNAPSHOT: 'REVIEW_PACKET_SNAPSHOT',
  EDITORIAL_DECISION: 'EDITORIAL_DECISION',
  READINESS_ASSESSMENT: 'READINESS_ASSESSMENT',
  PUBLICATION_READINESS_ASSESSMENT: 'PUBLICATION_READINESS_ASSESSMENT',
  PUBLICATION_ASSESSMENT: 'PUBLICATION_ASSESSMENT',
  PUBLICATION_DECISION: 'PUBLICATION_DECISION',
  PUBLISHED_ARTIFACT_VERSION: 'PUBLISHED_ARTIFACT_VERSION',
  PUBLICATION_SCHEDULE: 'PUBLICATION_SCHEDULE',
  RELEASE_EVENT: 'RELEASE_EVENT',
  LEARNER_EXPOSURE_REFERENCE: 'LEARNER_EXPOSURE_REFERENCE',
  WITHDRAWAL_RECORD: 'WITHDRAWAL_RECORD',
  SUPERSESSION_RECORD: 'SUPERSESSION_RECORD',
  PUBLICATION_HISTORY: 'PUBLICATION_HISTORY',
  CONTROLLED_APPLICATION_RECORD: 'CONTROLLED_APPLICATION_RECORD',
  MATERIAL_CHANGE_DETERMINATION: 'MATERIAL_CHANGE_DETERMINATION',
  GOVERNANCE_RECORD: 'GOVERNANCE_RECORD',
  AUDIT_EVENT: 'AUDIT_EVENT',
  AUTHORITY_ASSIGNMENT: 'AUTHORITY_ASSIGNMENT',
  AUTHORITY_SCOPE: 'AUTHORITY_SCOPE',
  REVIEWER_ASSIGNMENT: 'REVIEWER_ASSIGNMENT',
  CONFLICT_OF_INTEREST_DECLARATION: 'CONFLICT_OF_INTEREST_DECLARATION',
  DISAGREEMENT_RECORD: 'DISAGREEMENT_RECORD',
  ADJUDICATION_RECORD: 'ADJUDICATION_RECORD',
  GOVERNANCE_EXCEPTION: 'GOVERNANCE_EXCEPTION',
  EMERGENCY_CORRECTION: 'EMERGENCY_CORRECTION',
  PUBLICATION_AUTHORITY: 'PUBLICATION_AUTHORITY',
  ARTIFACT_OWNERSHIP: 'ARTIFACT_OWNERSHIP',
  MAINTENANCE_OWNERSHIP: 'MAINTENANCE_OWNERSHIP',
  MAINTENANCE_ASSESSMENT: 'MAINTENANCE_ASSESSMENT',
  EVIDENCE_REFRESH_TRIGGER: 'EVIDENCE_REFRESH_TRIGGER',
  GUIDELINE_CHANGE_TRIGGER: 'GUIDELINE_CHANGE_TRIGGER',
  REVIEW_DUE_DATE: 'REVIEW_DUE_DATE',
  REVALIDATION_OBLIGATION: 'REVALIDATION_OBLIGATION',
  CORRECTION_WORKFLOW: 'CORRECTION_WORKFLOW',
  RETIREMENT_ASSESSMENT: 'RETIREMENT_ASSESSMENT',
  WITHDRAWAL_READINESS: 'WITHDRAWAL_READINESS',
  SUPERSESSION_REVIEW: 'SUPERSESSION_REVIEW',
} as const;

export type WeosArtifactType =
  (typeof WEOS_ARTIFACT_TYPES)[keyof typeof WEOS_ARTIFACT_TYPES];

export const WEOS_VERSIONING_MODES = {
  IDENTITY_ONLY: 'IDENTITY_ONLY',
  REVISIONED_ARTIFACT: 'REVISIONED_ARTIFACT',
  VERSION_TARGETED_RECORD: 'VERSION_TARGETED_RECORD',
  NON_VERSIONED_RECORD: 'NON_VERSIONED_RECORD',
  PROJECTION: 'PROJECTION',
} as const;

export type WeosVersioningMode =
  (typeof WEOS_VERSIONING_MODES)[keyof typeof WEOS_VERSIONING_MODES];

export const WEOS_KNOWLEDGE_STANDINGS = {
  CANDIDATE: 'CANDIDATE',
  GOVERNED: 'GOVERNED',
  MIXED: 'MIXED',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
} as const;

export type WeosKnowledgeStanding =
  (typeof WEOS_KNOWLEDGE_STANDINGS)[keyof typeof WEOS_KNOWLEDGE_STANDINGS];

export const WEOS_RECORD_KINDS = {
  KNOWLEDGE_ARTIFACT: 'KNOWLEDGE_ARTIFACT',
  VALIDATION_RECORD: 'VALIDATION_RECORD',
  ASSESSMENT_RECORD: 'ASSESSMENT_RECORD',
  REVIEW_RECORD: 'REVIEW_RECORD',
  SOURCE_CONTEXT_RECORD: 'SOURCE_CONTEXT_RECORD',
  DECISION_RECORD: 'DECISION_RECORD',
  GOVERNANCE_RECORD: 'GOVERNANCE_RECORD',
  OPERATIONAL_RECORD: 'OPERATIONAL_RECORD',
  AUDIT_EVENT: 'AUDIT_EVENT',
  PROJECTION: 'PROJECTION',
  TRIGGER: 'TRIGGER',
  OBLIGATION: 'OBLIGATION',
  WORKFLOW: 'WORKFLOW',
} as const;

export type WeosRecordKind =
  (typeof WEOS_RECORD_KINDS)[keyof typeof WEOS_RECORD_KINDS];

export type RequirementLevel =
  | 'REQUIRED'
  | 'NOT_REQUIRED'
  | 'OPTIONAL'
  | 'CONTEXTUAL'
  | 'NOT_APPLICABLE'
  | 'UNKNOWN';

export type PublicationApplicability =
  | 'APPLICABLE'
  | 'NOT_APPLICABLE'
  | 'INDIRECT'
  | 'UNKNOWN';

export type WeosArtifactCatalogueEntry = Readonly<{
  canonicalType: WeosArtifactType;
  canonicalPurpose: string;
  abstractFamily: boolean;
  diagnosisScoped: boolean;
  versioningMode: WeosVersioningMode;
  currentRevisionModels: readonly string[];
  currentRevisionCarriers: readonly string[];
  knowledgeStanding: WeosKnowledgeStanding;
  recordKind: WeosRecordKind;
  reviewRequirement: RequirementLevel;
  approvalRequirement: RequirementLevel;
  decisionRequirement: RequirementLevel;
  publicationApplicability: PublicationApplicability;
  currentPrismaModels: readonly string[];
  currentImplementationSymbols: readonly string[];
  currentImplementationPaths: readonly string[];
  currentImplementationModel: string | null;
  currentImplementationSupport: WeosImplementationSupport;
  currentAlignmentClassification: WeosAlignmentClassification;
  severity: WeosGovernanceSeverity;
  verificationConfidence: WeosVerificationConfidence;
  canonicalDocuments: readonly string[];
  knownDivergences: readonly string[];
}>;

const A = WEOS_ALIGNMENT_CLASSIFICATIONS;
const I = WEOS_IMPLEMENTATION_SUPPORT;
const S = WEOS_GOVERNANCE_SEVERITIES;
const C = WEOS_VERIFICATION_CONFIDENCE;
const V = WEOS_VERSIONING_MODES;
const K = WEOS_KNOWLEDGE_STANDINGS;
const R = WEOS_RECORD_KINDS;
const T = WEOS_ARTIFACT_TYPES;

function entry(
  canonicalType: WeosArtifactType,
  overrides: Partial<WeosArtifactCatalogueEntry> = {},
): WeosArtifactCatalogueEntry {
  return {
    canonicalType,
    canonicalPurpose: `${canonicalType} canonical artifact or record.`,
    abstractFamily: false,
    diagnosisScoped: false,
    versioningMode: V.NON_VERSIONED_RECORD,
    currentRevisionModels: [],
    currentRevisionCarriers: [],
    knowledgeStanding: K.NOT_APPLICABLE,
    recordKind: R.GOVERNANCE_RECORD,
    reviewRequirement: 'CONTEXTUAL',
    approvalRequirement: 'CONTEXTUAL',
    decisionRequirement: 'CONTEXTUAL',
    publicationApplicability: 'INDIRECT',
    currentPrismaModels: [],
    currentImplementationSymbols: [],
    currentImplementationPaths: [],
    currentImplementationModel: null,
    currentImplementationSupport: I.NOT_IMPLEMENTED,
    currentAlignmentClassification: A.MISSING,
    severity: S.HIGH,
    verificationConfidence: C.CONFIRMED,
    canonicalDocuments: ['WEOS-CANON-007'],
    knownDivergences: [
      'No first-class model identified in the inspected repository paths at commit 944d04d.',
    ],
    ...overrides,
  };
}

const knowledge = (type: WeosArtifactType, model: string) =>
  entry(type, {
    recordKind: R.KNOWLEDGE_ARTIFACT,
    knowledgeStanding: K.GOVERNED,
    versioningMode: V.IDENTITY_ONLY,
    currentPrismaModels: [model],
    currentImplementationModel: model,
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.PARTIALLY_ALIGNED,
    knownDivergences: [
      'Implementation carrier exists but canonical governance provenance is incomplete.',
    ],
  });

const missingAssessment = (type: WeosArtifactType, abstractFamily = false) =>
  entry(type, {
    abstractFamily,
    recordKind: R.ASSESSMENT_RECORD,
    versioningMode: V.VERSION_TARGETED_RECORD,
    approvalRequirement: 'NOT_REQUIRED',
    decisionRequirement: 'NOT_APPLICABLE',
    currentImplementationSupport: I.NOT_IMPLEMENTED,
    currentAlignmentClassification: A.MISSING,
    knownDivergences: [
      'No first-class model identified in the inspected repository paths at commit 944d04d for this structured assessment.',
    ],
  });

const entries: readonly WeosArtifactCatalogueEntry[] = [
  knowledge(T.DIAGNOSIS_REGISTRY, 'DiagnosisRegistry'),
  knowledge(T.DIAGNOSIS_ALIAS, 'DiagnosisAlias'),
  entry(T.DIAGNOSIS_REGISTRY_CANDIDATE, {
    recordKind: R.KNOWLEDGE_ARTIFACT,
    knowledgeStanding: K.CANDIDATE,
    currentPrismaModels: ['DiagnosisRegistryCandidate'],
    currentImplementationModel: 'DiagnosisRegistryCandidate',
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.PARTIALLY_ALIGNED,
    severity: S.MODERATE,
  }),
  entry(T.REGISTRY_ACTIVATION_STATE, {
    recordKind: R.OPERATIONAL_RECORD,
    currentPrismaModels: ['DiagnosisRegistry'],
    currentImplementationSymbols: [
      'DiagnosisRegistry.status',
      'DiagnosisRegistry.active',
    ],
    currentImplementationModel: 'DiagnosisRegistry',
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.PARTIALLY_ALIGNED,
    severity: S.MODERATE,
  }),
  entry(T.DIAGNOSIS_OPERATIONAL_PERMISSION, {
    recordKind: R.OPERATIONAL_RECORD,
    currentPrismaModels: ['DiagnosisRegistry'],
    currentImplementationSymbols: [
      'DiagnosisRegistry.isPlayable',
      'DiagnosisRegistry.isGeneratable',
    ],
    currentImplementationModel: 'DiagnosisRegistry',
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.PARTIALLY_ALIGNED,
  }),
  entry(T.DIAGNOSIS_ONBOARDING_PROGRESS, {
    recordKind: R.OPERATIONAL_RECORD,
    currentPrismaModels: ['DiagnosisRegistry'],
    currentImplementationSymbols: ['DiagnosisRegistry.onboardingStatus'],
    currentImplementationModel: 'DiagnosisRegistry',
    currentImplementationSupport: I.IMPLEMENTED,
    currentAlignmentClassification: A.PARTIALLY_ALIGNED,
    severity: S.MODERATE,
  }),
  entry(T.DIAGNOSIS_OPERATION_READINESS, {
    recordKind: R.ASSESSMENT_RECORD,
    currentImplementationSymbols: [
      'DiagnosisEditorialOnboardingService',
      'CaseEligibilityPolicyService',
    ],
    currentImplementationPaths: [
      'doctordle-backend/src/modules/admin/diagnosis-editorial-onboarding.service.ts',
    ],
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.PARTIALLY_ALIGNED,
  }),
  entry(T.EDITORIAL_BRIEF, {
    recordKind: R.KNOWLEDGE_ARTIFACT,
    knowledgeStanding: K.MIXED,
    versioningMode: V.REVISIONED_ARTIFACT,
    currentPrismaModels: ['DiagnosisEditorialBrief'],
    currentRevisionCarriers: ['DiagnosisEditorialBrief.version'],
    currentImplementationModel: 'DiagnosisEditorialBrief',
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.PARTIALLY_ALIGNED,
    severity: S.MODERATE,
  }),
  entry(T.LEARNING_GOAL, {
    abstractFamily: false,
    recordKind: R.KNOWLEDGE_ARTIFACT,
    knowledgeStanding: K.GOVERNED,
    versioningMode: V.VERSION_TARGETED_RECORD,
    currentPrismaModels: ['DiagnosisEditorialBrief'],
    currentImplementationSymbols: ['DiagnosisEditorialBrief.learningGoals'],
    currentRevisionCarriers: ['DiagnosisEditorialBrief.version'],
    currentImplementationModel: 'DiagnosisEditorialBrief',
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.PARTIALLY_ALIGNED,
    severity: S.MODERATE,
  }),
  entry(T.TEACHING_RULE, {
    recordKind: R.KNOWLEDGE_ARTIFACT,
    knowledgeStanding: K.MIXED,
    versioningMode: V.REVISIONED_ARTIFACT,
    currentPrismaModels: ['DiagnosisTeachingRule'],
    currentRevisionCarriers: ['DiagnosisTeachingRule.version'],
    currentImplementationModel: 'DiagnosisTeachingRule',
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.PARTIALLY_ALIGNED,
    severity: S.MODERATE,
  }),
  knowledge(T.REASONING_PATH, 'ReasoningPath'),
  entry(T.REASONING_VALIDATION_RESULT, {
    recordKind: R.VALIDATION_RECORD,
    versioningMode: V.VERSION_TARGETED_RECORD,
    currentPrismaModels: ['ReasoningDraftValidationRun'],
    currentImplementationModel: 'ReasoningDraftValidationRun',
    currentImplementationSupport: I.IMPLEMENTED,
    currentAlignmentClassification: A.PARTIALLY_ALIGNED,
    severity: S.LOW,
  }),
  entry(T.CLINICAL_CASE, {
    recordKind: R.KNOWLEDGE_ARTIFACT,
    knowledgeStanding: K.MIXED,
    versioningMode: V.REVISIONED_ARTIFACT,
    currentPrismaModels: ['Case'],
    currentRevisionModels: ['CaseRevision'],
    currentImplementationModel: 'Case',
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.DIVERGENT,
    severity: S.CRITICAL,
    knownDivergences: [
      'The Case aggregate remains an independently mutable source used by governance, publication, scheduling, or learner-facing paths instead of functioning only as a controlled projection of an exact current revision.',
    ],
  }),
  entry(T.CASE_REVISION, {
    recordKind: R.KNOWLEDGE_ARTIFACT,
    knowledgeStanding: K.GOVERNED,
    versioningMode: V.REVISIONED_ARTIFACT,
    currentPrismaModels: ['CaseRevision'],
    currentRevisionModels: ['CaseRevision'],
    currentImplementationModel: 'CaseRevision',
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.PARTIALLY_ALIGNED,
  }),
  entry(T.CASE_EXPLANATION, {
    recordKind: R.KNOWLEDGE_ARTIFACT,
    knowledgeStanding: K.MIXED,
    versioningMode: V.VERSION_TARGETED_RECORD,
    currentPrismaModels: ['Case', 'ExplanationContent'],
    currentImplementationSymbols: [
      'Case.explanation',
      'ExplanationContent.version',
    ],
    currentRevisionModels: ['CaseRevision'],
    currentImplementationModel: 'Case',
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.PARTIALLY_ALIGNED,
  }),
  entry(T.CLINICAL_CLUE, {
    recordKind: R.KNOWLEDGE_ARTIFACT,
    knowledgeStanding: K.MIXED,
    versioningMode: V.VERSION_TARGETED_RECORD,
    currentPrismaModels: ['Case', 'CaseRevision'],
    currentImplementationSymbols: ['Case.clues', 'CaseRevision.clues'],
    currentRevisionModels: ['CaseRevision'],
    currentImplementationModel: 'Case',
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.DIVERGENT,
    severity: S.CRITICAL,
    knownDivergences: [
      'JSON storage is not itself the issue; clue identity depends on array position/order without revision-aware clue keys.',
    ],
  }),
  entry(T.CLUE_PROGRESSION_ANALYSIS, {
    recordKind: R.ASSESSMENT_RECORD,
    versioningMode: V.VERSION_TARGETED_RECORD,
    currentPrismaModels: ['CaseClueProgressionAnalysis'],
    currentImplementationModel: 'CaseClueProgressionAnalysis',
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.PARTIALLY_ALIGNED,
    severity: S.MODERATE,
  }),
  entry(T.CLUE_DISCRIMINATOR_ANNOTATION, {
    recordKind: R.ASSESSMENT_RECORD,
    versioningMode: V.VERSION_TARGETED_RECORD,
    currentPrismaModels: ['CaseClueDiscriminatorAnnotation'],
    currentImplementationModel: 'CaseClueDiscriminatorAnnotation',
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.PARTIALLY_ALIGNED,
    severity: S.MODERATE,
  }),
  entry(T.ESCALATION_ANNOTATION, {
    recordKind: R.ASSESSMENT_RECORD,
    versioningMode: V.VERSION_TARGETED_RECORD,
    currentPrismaModels: ['CaseEscalationAnnotation'],
    currentImplementationModel: 'CaseEscalationAnnotation',
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.PARTIALLY_ALIGNED,
    severity: S.LOW,
  }),
  entry(T.DIAGNOSIS_EDUCATION, {
    recordKind: R.KNOWLEDGE_ARTIFACT,
    knowledgeStanding: K.MIXED,
    versioningMode: V.REVISIONED_ARTIFACT,
    currentPrismaModels: ['DiagnosisEducation'],
    currentRevisionModels: ['DiagnosisEducationRevision'],
    currentImplementationModel: 'DiagnosisEducation',
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.DIVERGENT,
  }),
  entry(T.DIAGNOSIS_EDUCATION_REVISION, {
    recordKind: R.KNOWLEDGE_ARTIFACT,
    knowledgeStanding: K.GOVERNED,
    versioningMode: V.REVISIONED_ARTIFACT,
    currentPrismaModels: ['DiagnosisEducationRevision'],
    currentRevisionModels: ['DiagnosisEducationRevision'],
    currentImplementationModel: 'DiagnosisEducationRevision',
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.PARTIALLY_ALIGNED,
    severity: S.MODERATE,
  }),
  entry(T.GRAPH_CANDIDATE, {
    recordKind: R.KNOWLEDGE_ARTIFACT,
    knowledgeStanding: K.CANDIDATE,
    currentPrismaModels: ['DiagnosisGraphCandidate'],
    currentImplementationModel: 'DiagnosisGraphCandidate',
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.PARTIALLY_ALIGNED,
    severity: S.MODERATE,
  }),
  knowledge(T.GRAPH_FACT, 'DiagnosisGraphFact'),
  knowledge(T.TEACHING_RELATIONSHIP, 'DiagnosisTeachingRelationship'),
  knowledge(T.EVIDENCE_NODE, 'EvidenceNode'),
  knowledge(T.EVIDENCE_RELATIONSHIP, 'DiagnosisEvidenceRelationship'),
  missingAssessment(T.EVIDENCE_ASSESSMENT),
  entry(T.EVIDENCE_SOURCE, {
    recordKind: R.KNOWLEDGE_ARTIFACT,
    knowledgeStanding: K.GOVERNED,
  }),
  entry(T.CLAIM_SUPPORT_LINK, {
    recordKind: R.KNOWLEDGE_ARTIFACT,
    versioningMode: V.VERSION_TARGETED_RECORD,
  }),
  entry(T.REFERENCE_LIST, {
    recordKind: R.KNOWLEDGE_ARTIFACT,
    knowledgeStanding: K.MIXED,
    versioningMode: V.VERSION_TARGETED_RECORD,
    currentPrismaModels: ['DiagnosisEducation'],
    currentImplementationSymbols: ['DiagnosisEducation.references'],
    currentRevisionModels: ['DiagnosisEducationRevision'],
    currentImplementationModel: 'DiagnosisEducation',
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.PARTIALLY_ALIGNED,
    severity: S.MODERATE,
  }),
  entry(T.DIFFERENTIAL_MAPPING, {
    recordKind: R.ASSESSMENT_RECORD,
    versioningMode: V.VERSION_TARGETED_RECORD,
    currentPrismaModels: [
      'CaseDifferentialMapping',
      'EducationDifferentialMapping',
    ],
    currentRevisionModels: ['CaseRevision', 'DiagnosisEducationRevision'],
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.PARTIALLY_ALIGNED,
    severity: S.MODERATE,
  }),
  entry(T.DIFFERENTIAL_LINK, {
    recordKind: R.KNOWLEDGE_ARTIFACT,
    versioningMode: V.VERSION_TARGETED_RECORD,
    currentPrismaModels: ['CaseDifferentialLink', 'EducationDifferentialLink'],
    currentRevisionModels: ['CaseRevision', 'DiagnosisEducationRevision'],
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.PARTIALLY_ALIGNED,
    severity: S.MODERATE,
  }),
  entry(T.AI_DRAFT, {
    recordKind: R.KNOWLEDGE_ARTIFACT,
    knowledgeStanding: K.CANDIDATE,
    currentPrismaModels: ['AiDraftRevisionAudit'],
    currentImplementationModel: 'AiDraftRevisionAudit',
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.PARTIALLY_ALIGNED,
  }),
  entry(T.AI_DRAFT_ACCEPTANCE, {
    recordKind: R.DECISION_RECORD,
    currentPrismaModels: ['AiDraftRevisionAudit'],
    currentImplementationSymbols: ['AiDraftRevisionAudit.reviewStatus'],
    currentImplementationModel: 'AiDraftRevisionAudit',
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.PARTIALLY_ALIGNED,
  }),
  entry(T.CLUE_REVISION_DRAFT, {
    recordKind: R.KNOWLEDGE_ARTIFACT,
    knowledgeStanding: K.CANDIDATE,
    currentPrismaModels: ['CaseClueRevisionDraft'],
    currentImplementationModel: 'CaseClueRevisionDraft',
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.PARTIALLY_ALIGNED,
  }),
  entry(T.VALIDATION_RESULT, {
    recordKind: R.VALIDATION_RECORD,
    versioningMode: V.VERSION_TARGETED_RECORD,
    currentPrismaModels: ['CaseValidationRun'],
    currentRevisionModels: ['CaseRevision'],
    currentImplementationModel: 'CaseValidationRun',
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.PARTIALLY_ALIGNED,
  }),
  missingAssessment(T.EDITORIAL_ASSESSMENT, true),
  missingAssessment(T.CLINICAL_ASSESSMENT),
  missingAssessment(T.EDUCATIONAL_ASSESSMENT),
  missingAssessment(T.REASONING_ASSESSMENT),
  missingAssessment(T.SAFETY_ASSESSMENT),
  entry(T.LEARNING_GOAL_COVERAGE_ASSESSMENT, {
    recordKind: R.ASSESSMENT_RECORD,
    versioningMode: V.VERSION_TARGETED_RECORD,
    currentPrismaModels: ['CaseLearningGoalCoverage'],
    currentImplementationModel: 'CaseLearningGoalCoverage',
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.PARTIALLY_ALIGNED,
    severity: S.MODERATE,
  }),
  entry(T.EDITORIAL_REVIEW, {
    recordKind: R.REVIEW_RECORD,
    versioningMode: V.VERSION_TARGETED_RECORD,
    currentPrismaModels: ['CaseReview'],
    currentRevisionModels: ['CaseRevision'],
    currentImplementationModel: 'CaseReview',
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.PARTIALLY_ALIGNED,
  }),
  entry(T.REVIEW_PACKET_SNAPSHOT, {
    recordKind: R.SOURCE_CONTEXT_RECORD,
    versioningMode: V.VERSION_TARGETED_RECORD,
    currentPrismaModels: ['CaseReviewContextSnapshot'],
    currentRevisionModels: ['CaseRevision'],
    currentImplementationModel: 'CaseReviewContextSnapshot',
    currentImplementationSupport: I.IMPLEMENTED,
    currentAlignmentClassification: A.PARTIALLY_ALIGNED,
    severity: S.LOW,
  }),
  entry(T.EDITORIAL_DECISION, {
    recordKind: R.DECISION_RECORD,
    versioningMode: V.VERSION_TARGETED_RECORD,
    currentPrismaModels: ['CaseEditorialDecision', 'CaseReview'],
    currentRevisionModels: ['CaseRevision'],
    currentImplementationModel: 'CaseEditorialDecision',
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.PARTIALLY_ALIGNED,
  }),
  missingAssessment(T.READINESS_ASSESSMENT, true),
  missingAssessment(T.PUBLICATION_READINESS_ASSESSMENT),
  missingAssessment(T.PUBLICATION_ASSESSMENT),
  entry(T.PUBLICATION_DECISION, {
    recordKind: R.DECISION_RECORD,
    versioningMode: V.VERSION_TARGETED_RECORD,
    currentPrismaModels: ['Case', 'DiagnosisEducation'],
    currentImplementationSymbols: [
      'Case.publishedAt',
      'DiagnosisEducation.publishedAt',
    ],
    currentImplementationModel: 'Case',
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.DIVERGENT,
    severity: S.CRITICAL,
  }),
  entry(T.PUBLISHED_ARTIFACT_VERSION, {
    recordKind: R.KNOWLEDGE_ARTIFACT,
    versioningMode: V.VERSION_TARGETED_RECORD,
    currentAlignmentClassification: A.MISSING,
    severity: S.CRITICAL,
  }),
  entry(T.PUBLICATION_SCHEDULE, {
    recordKind: R.OPERATIONAL_RECORD,
    versioningMode: V.NON_VERSIONED_RECORD,
    currentPrismaModels: ['DailyCase'],
    currentImplementationModel: 'DailyCase',
    currentImplementationSupport: I.IMPLEMENTED,
    currentAlignmentClassification: A.PARTIALLY_ALIGNED,
  }),
  entry(T.RELEASE_EVENT, {
    recordKind: R.AUDIT_EVENT,
    versioningMode: V.NON_VERSIONED_RECORD,
    severity: S.MODERATE,
  }),
  entry(T.LEARNER_EXPOSURE_REFERENCE, {
    recordKind: R.OPERATIONAL_RECORD,
    versioningMode: V.VERSION_TARGETED_RECORD,
    currentPrismaModels: ['DailyCase', 'GameSession'],
    currentImplementationSymbols: [
      'DailyCase.caseId',
      'GameSession.dailyCaseId',
    ],
    currentImplementationModel: 'DailyCase',
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.DIVERGENT,
    severity: S.CRITICAL,
  }),
  entry(T.WITHDRAWAL_RECORD, {
    recordKind: R.DECISION_RECORD,
    versioningMode: V.VERSION_TARGETED_RECORD,
  }),
  entry(T.SUPERSESSION_RECORD, {
    recordKind: R.DECISION_RECORD,
    versioningMode: V.VERSION_TARGETED_RECORD,
  }),
  entry(T.PUBLICATION_HISTORY, {
    recordKind: R.PROJECTION,
    versioningMode: V.PROJECTION,
    currentPrismaModels: ['CaseReviewEvent', 'DailyCase'],
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.PARTIALLY_ALIGNED,
    verificationConfidence: C.INFERRED,
    severity: S.MODERATE,
  }),
  entry(T.CONTROLLED_APPLICATION_RECORD, {
    recordKind: R.GOVERNANCE_RECORD,
    versioningMode: V.VERSION_TARGETED_RECORD,
    currentPrismaModels: ['CaseClueRevisionDraft'],
    currentImplementationSymbols: ['CaseClueRevisionDraft.appliedAt'],
    currentImplementationModel: 'CaseClueRevisionDraft',
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.PARTIALLY_ALIGNED,
  }),
  entry(T.MATERIAL_CHANGE_DETERMINATION, {
    recordKind: R.GOVERNANCE_RECORD,
    currentImplementationSymbols: [
      'CaseReviewContextSnapshot.invalidationReason',
    ],
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.PARTIALLY_ALIGNED,
  }),
  entry(T.GOVERNANCE_RECORD, {
    recordKind: R.GOVERNANCE_RECORD,
    abstractFamily: true,
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.PARTIALLY_ALIGNED,
  }),
  entry(T.AUDIT_EVENT, {
    recordKind: R.AUDIT_EVENT,
    abstractFamily: true,
    currentPrismaModels: ['CaseReviewEvent', 'DiagnosisRegistryMergeLog'],
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.PARTIALLY_ALIGNED,
    severity: S.MODERATE,
  }),
  entry(T.AUTHORITY_ASSIGNMENT, {
    recordKind: R.GOVERNANCE_RECORD,
    currentPrismaModels: ['User'],
    currentImplementationSymbols: ['User.role'],
    currentImplementationModel: 'User',
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.DIVERGENT,
  }),
  entry(T.AUTHORITY_SCOPE, { recordKind: R.GOVERNANCE_RECORD }),
  entry(T.REVIEWER_ASSIGNMENT, {
    recordKind: R.OPERATIONAL_RECORD,
    currentPrismaModels: ['CaseReview'],
    currentImplementationSymbols: ['CaseReview.reviewerUserId'],
    currentImplementationModel: 'CaseReview',
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.PARTIALLY_ALIGNED,
    severity: S.LOW,
  }),
  entry(T.CONFLICT_OF_INTEREST_DECLARATION, {
    recordKind: R.GOVERNANCE_RECORD,
    severity: S.MODERATE,
  }),
  entry(T.DISAGREEMENT_RECORD, {
    recordKind: R.GOVERNANCE_RECORD,
    severity: S.MODERATE,
  }),
  entry(T.ADJUDICATION_RECORD, {
    recordKind: R.GOVERNANCE_RECORD,
    severity: S.MODERATE,
  }),
  entry(T.GOVERNANCE_EXCEPTION, { recordKind: R.GOVERNANCE_RECORD }),
  entry(T.EMERGENCY_CORRECTION, {
    recordKind: R.WORKFLOW,
    severity: S.CRITICAL,
  }),
  entry(T.PUBLICATION_AUTHORITY, {
    recordKind: R.GOVERNANCE_RECORD,
    currentPrismaModels: ['User'],
    currentImplementationSymbols: ['User.role'],
    currentImplementationModel: 'User',
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentAlignmentClassification: A.DIVERGENT,
  }),
  entry(T.ARTIFACT_OWNERSHIP, {
    recordKind: R.GOVERNANCE_RECORD,
    severity: S.MODERATE,
  }),
  entry(T.MAINTENANCE_OWNERSHIP, { recordKind: R.GOVERNANCE_RECORD }),
  missingAssessment(T.MAINTENANCE_ASSESSMENT),
  entry(T.EVIDENCE_REFRESH_TRIGGER, { recordKind: R.TRIGGER }),
  entry(T.GUIDELINE_CHANGE_TRIGGER, { recordKind: R.TRIGGER }),
  entry(T.REVIEW_DUE_DATE, { recordKind: R.OBLIGATION }),
  entry(T.REVALIDATION_OBLIGATION, { recordKind: R.OBLIGATION }),
  entry(T.CORRECTION_WORKFLOW, { recordKind: R.WORKFLOW }),
  missingAssessment(T.RETIREMENT_ASSESSMENT),
  missingAssessment(T.WITHDRAWAL_READINESS),
  missingAssessment(T.SUPERSESSION_REVIEW),
];

export const WEOS_CANONICAL_ARTIFACT_CATALOGUE = Object.fromEntries(
  entries.map((item) => [item.canonicalType, item]),
) as Record<WeosArtifactType, WeosArtifactCatalogueEntry>;

export const WEOS_CANONICAL_ARTIFACT_CATALOGUE_ENTRIES = Object.values(
  WEOS_CANONICAL_ARTIFACT_CATALOGUE,
);
