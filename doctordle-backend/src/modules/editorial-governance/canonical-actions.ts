import {
  WEOS_ARTIFACT_TYPES,
  WEOS_RECORD_KINDS,
  type WeosArtifactType,
  type WeosRecordKind,
} from './canonical-artifact-catalogue';
import {
  WEOS_DECISION_TYPES,
  WEOS_AUDIT_RECORD_TYPES,
  WEOS_GOVERNANCE_RECORD_TYPES,
  WEOS_IMPLEMENTATION_SUPPORT,
  type WeosDecisionType,
  type WeosImplementationSupport,
} from './canonical-concepts';

export const WEOS_ACTION_CATEGORIES = {
  AUTHORING: 'AUTHORING',
  VALIDATION: 'VALIDATION',
  REVIEW: 'REVIEW',
  ASSESSMENT: 'ASSESSMENT',
  DECISION: 'DECISION',
  APPLICATION: 'APPLICATION',
  IDENTITY: 'IDENTITY',
  OPERATIONAL_PERMISSION: 'OPERATIONAL_PERMISSION',
  PUBLICATION: 'PUBLICATION',
  SCHEDULING: 'SCHEDULING',
  RELEASE: 'RELEASE',
  MAINTENANCE: 'MAINTENANCE',
  GOVERNANCE: 'GOVERNANCE',
} as const;

export type WeosActionCategory =
  (typeof WEOS_ACTION_CATEGORIES)[keyof typeof WEOS_ACTION_CATEGORIES];

export const WEOS_EDITORIAL_ACTIONS = {
  CREATE_ARTIFACT: 'CREATE_ARTIFACT',
  CREATE_REVISION: 'CREATE_REVISION',
  EDIT_DRAFT: 'EDIT_DRAFT',
  REPLACE_COMPONENT: 'REPLACE_COMPONENT',
  DETERMINE_MATERIAL_CHANGE: 'DETERMINE_MATERIAL_CHANGE',
  RECORD_MATERIAL_CHANGE_DETERMINATION: 'RECORD_MATERIAL_CHANGE_DETERMINATION',
  SUPERSEDE_REVISION: 'SUPERSEDE_REVISION',
  ARCHIVE_ARTIFACT: 'ARCHIVE_ARTIFACT',
  RETIRE_ARTIFACT: 'RETIRE_ARTIFACT',
  REQUEST_VALIDATION: 'REQUEST_VALIDATION',
  RUN_VALIDATION: 'RUN_VALIDATION',
  RECORD_VALIDATION_RESULT: 'RECORD_VALIDATION_RESULT',
  MARK_VALIDATION_STALE: 'MARK_VALIDATION_STALE',
  RERUN_VALIDATION: 'RERUN_VALIDATION',
  REQUEST_REVIEW: 'REQUEST_REVIEW',
  ASSIGN_REVIEWER: 'ASSIGN_REVIEWER',
  BEGIN_REVIEW: 'BEGIN_REVIEW',
  REQUEST_CHANGES: 'REQUEST_CHANGES',
  REQUEST_EVIDENCE: 'REQUEST_EVIDENCE',
  DEFER_REVIEW: 'DEFER_REVIEW',
  ESCALATE_REVIEW: 'ESCALATE_REVIEW',
  COMPLETE_REVIEW: 'COMPLETE_REVIEW',
  RECORD_CLINICAL_ASSESSMENT: 'RECORD_CLINICAL_ASSESSMENT',
  RECORD_EDUCATIONAL_ASSESSMENT: 'RECORD_EDUCATIONAL_ASSESSMENT',
  RECORD_REASONING_ASSESSMENT: 'RECORD_REASONING_ASSESSMENT',
  RECORD_EVIDENCE_ASSESSMENT: 'RECORD_EVIDENCE_ASSESSMENT',
  RECORD_SAFETY_ASSESSMENT: 'RECORD_SAFETY_ASSESSMENT',
  ASSESS_PUBLICATION_READINESS: 'ASSESS_PUBLICATION_READINESS',
  RECORD_PUBLICATION_READINESS_ASSESSMENT:
    'RECORD_PUBLICATION_READINESS_ASSESSMENT',
  RECORD_PUBLICATION_ASSESSMENT: 'RECORD_PUBLICATION_ASSESSMENT',
  APPROVE_REVISION: 'APPROVE_REVISION',
  REJECT_REVISION: 'REJECT_REVISION',
  REQUIRE_REVISION: 'REQUIRE_REVISION',
  ACTIVATE_ARTIFACT: 'ACTIVATE_ARTIFACT',
  DEPRECATE_ARTIFACT: 'DEPRECATE_ARTIFACT',
  MERGE_CANDIDATE: 'MERGE_CANDIDATE',
  APPROVE_CANDIDATE_CREATION: 'APPROVE_CANDIDATE_CREATION',
  APPROVE_GRAPH_PROMOTION: 'APPROVE_GRAPH_PROMOTION',
  REJECT_GRAPH_CANDIDATE: 'REJECT_GRAPH_CANDIDATE',
  ACTIVATE_RELATIONSHIP: 'ACTIVATE_RELATIONSHIP',
  DEPRECATE_RELATIONSHIP: 'DEPRECATE_RELATIONSHIP',
  CREATE_AI_DRAFT: 'CREATE_AI_DRAFT',
  VALIDATE_AI_DRAFT: 'VALIDATE_AI_DRAFT',
  ACCEPT_AI_DRAFT: 'ACCEPT_AI_DRAFT',
  REJECT_AI_DRAFT: 'REJECT_AI_DRAFT',
  REQUEST_AI_DRAFT_CHANGES: 'REQUEST_AI_DRAFT_CHANGES',
  CREATE_CLUE_REVISION_DRAFT: 'CREATE_CLUE_REVISION_DRAFT',
  ACCEPT_CLUE_REVISION_DRAFT: 'ACCEPT_CLUE_REVISION_DRAFT',
  REJECT_CLUE_REVISION_DRAFT: 'REJECT_CLUE_REVISION_DRAFT',
  APPLY_ACCEPTED_DRAFT: 'APPLY_ACCEPTED_DRAFT',
  RECONCILE_STALE_APPLICATION: 'RECONCILE_STALE_APPLICATION',
  ACTIVATE_REGISTRY_ENTRY: 'ACTIVATE_REGISTRY_ENTRY',
  HIDE_REGISTRY_ENTRY: 'HIDE_REGISTRY_ENTRY',
  DEPRECATE_REGISTRY_ENTRY: 'DEPRECATE_REGISTRY_ENTRY',
  GRANT_PLAYABILITY: 'GRANT_PLAYABILITY',
  REMOVE_PLAYABILITY: 'REMOVE_PLAYABILITY',
  GRANT_GENERATABILITY: 'GRANT_GENERATABILITY',
  REMOVE_GENERATABILITY: 'REMOVE_GENERATABILITY',
  WITHDRAW_EVIDENCE_SOURCE: 'WITHDRAW_EVIDENCE_SOURCE',
  REMAP_DIAGNOSIS_REFERENCE: 'REMAP_DIAGNOSIS_REFERENCE',
  MERGE_REGISTRY_ENTRY: 'MERGE_REGISTRY_ENTRY',
  AUTHORISE_PUBLICATION: 'AUTHORISE_PUBLICATION',
  DECLINE_PUBLICATION: 'DECLINE_PUBLICATION',
  SCHEDULE_PUBLICATION: 'SCHEDULE_PUBLICATION',
  CANCEL_PUBLICATION_SCHEDULE: 'CANCEL_PUBLICATION_SCHEDULE',
  RELEASE_PUBLICATION: 'RELEASE_PUBLICATION',
  CREATE_LEARNER_EXPOSURE: 'CREATE_LEARNER_EXPOSURE',
  END_LEARNER_EXPOSURE: 'END_LEARNER_EXPOSURE',
  WITHDRAW_PUBLICATION: 'WITHDRAW_PUBLICATION',
  SUPERSEDE_PUBLICATION: 'SUPERSEDE_PUBLICATION',
  REPUBLISH_REVISION: 'REPUBLISH_REVISION',
  CREATE_REVALIDATION_OBLIGATION: 'CREATE_REVALIDATION_OBLIGATION',
  MARK_REVIEW_DUE: 'MARK_REVIEW_DUE',
  TRIGGER_EVIDENCE_REFRESH: 'TRIGGER_EVIDENCE_REFRESH',
  TRIGGER_GUIDELINE_REVIEW: 'TRIGGER_GUIDELINE_REVIEW',
  RECORD_CONFLICT_OF_INTEREST: 'RECORD_CONFLICT_OF_INTEREST',
  GRANT_GOVERNANCE_EXCEPTION: 'GRANT_GOVERNANCE_EXCEPTION',
  RECORD_DISAGREEMENT: 'RECORD_DISAGREEMENT',
  ADJUDICATE_DISAGREEMENT: 'ADJUDICATE_DISAGREEMENT',
  INITIATE_EMERGENCY_CORRECTION: 'INITIATE_EMERGENCY_CORRECTION',
} as const;

export type WeosEditorialAction =
  (typeof WEOS_EDITORIAL_ACTIONS)[keyof typeof WEOS_EDITORIAL_ACTIONS];

export type WeosGovernanceRecordType =
  (typeof WEOS_GOVERNANCE_RECORD_TYPES)[keyof typeof WEOS_GOVERNANCE_RECORD_TYPES];

export type WeosAuditRecordType =
  (typeof WEOS_AUDIT_RECORD_TYPES)[keyof typeof WEOS_AUDIT_RECORD_TYPES];

export type CanonicalActionDefinition = Readonly<{
  key: WeosEditorialAction;
  label: string;
  abstract: boolean;
  composite: boolean;
  category: WeosActionCategory;
  meaning: string;
  applicableArtifactTypes: readonly WeosArtifactType[];
  subjectArtifactTypes: readonly WeosArtifactType[];
  targetRevisionTypes: readonly WeosArtifactType[];
  producesArtifactTypes: readonly WeosArtifactType[];
  producesRecordKinds: readonly WeosRecordKind[];
  createsContent: boolean;
  changesContent: boolean;
  createsRevision: boolean;
  requiresVersionTarget: boolean;
  createsValidationResult: boolean;
  createsAssessment: boolean;
  requiresDecision: boolean;
  decisionOutcome: WeosDecisionType | null;
  createsGovernanceRecord: boolean;
  governanceRecordType?: WeosGovernanceRecordType;
  auditRecordType?: WeosAuditRecordType;
  createsOperationalEffect: boolean;
  mayAffectLearnerExposure: boolean;
  mayInvalidatePriorStanding: boolean;
  currentImplementationSupport: WeosImplementationSupport;
  currentImplementationSymbols: readonly string[];
  notes: readonly string[];
}>;

const T = WEOS_ARTIFACT_TYPES;
const C = WEOS_ACTION_CATEGORIES;
const I = WEOS_IMPLEMENTATION_SUPPORT;
const D = WEOS_DECISION_TYPES;
const G = WEOS_GOVERNANCE_RECORD_TYPES;
const AR = WEOS_AUDIT_RECORD_TYPES;
const R = WEOS_RECORD_KINDS;

const revisionTargets = [T.CASE_REVISION, T.DIAGNOSIS_EDUCATION_REVISION];

function title(key: string) {
  return key
    .toLowerCase()
    .split('_')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function action(
  input: Omit<
    CanonicalActionDefinition,
    | 'label'
    | 'subjectArtifactTypes'
    | 'targetRevisionTypes'
    | 'producesArtifactTypes'
    | 'producesRecordKinds'
  > &
    Partial<
      Pick<
        CanonicalActionDefinition,
        | 'subjectArtifactTypes'
        | 'targetRevisionTypes'
        | 'producesArtifactTypes'
        | 'producesRecordKinds'
      >
    > & { label?: string },
): CanonicalActionDefinition {
  return {
    label: title(input.key),
    subjectArtifactTypes:
      input.subjectArtifactTypes ?? input.applicableArtifactTypes,
    targetRevisionTypes: input.targetRevisionTypes ?? [],
    producesArtifactTypes: input.producesArtifactTypes ?? [],
    producesRecordKinds: input.producesRecordKinds ?? [],
    ...input,
  };
}

const base = {
  abstract: false,
  composite: false,
  createsContent: false,
  changesContent: false,
  createsRevision: false,
  requiresVersionTarget: false,
  createsValidationResult: false,
  createsAssessment: false,
  requiresDecision: false,
  decisionOutcome: null,
  createsGovernanceRecord: false,
  producesArtifactTypes: [],
  producesRecordKinds: [],
  createsOperationalEffect: false,
  mayAffectLearnerExposure: false,
  mayInvalidatePriorStanding: false,
  currentImplementationSupport: I.NOT_IMPLEMENTED,
  currentImplementationSymbols: [],
  notes: [],
} satisfies Omit<
  CanonicalActionDefinition,
  | 'key'
  | 'label'
  | 'category'
  | 'meaning'
  | 'applicableArtifactTypes'
  | 'subjectArtifactTypes'
  | 'targetRevisionTypes'
>;

export const WEOS_CANONICAL_ACTIONS: readonly CanonicalActionDefinition[] = [
  action({
    ...base,
    key: 'CREATE_ARTIFACT',
    category: C.AUTHORING,
    meaning: 'Create a new artifact identity or candidate artifact.',
    applicableArtifactTypes: [T.CLINICAL_CASE, T.DIAGNOSIS_EDUCATION],
    createsContent: true,
    currentImplementationSupport: I.IMPLEMENTED,
    currentImplementationSymbols: ['Case', 'DiagnosisEducation'],
  }),
  action({
    ...base,
    key: 'CREATE_REVISION',
    category: C.AUTHORING,
    meaning: 'Create a new revision; standing impacts depend on materiality.',
    applicableArtifactTypes: revisionTargets,
    createsContent: true,
    createsRevision: true,
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentImplementationSymbols: [
      'CaseRevision',
      'DiagnosisEducationRevision',
    ],
  }),
  action({
    ...base,
    key: 'EDIT_DRAFT',
    category: C.AUTHORING,
    meaning: 'Edit draft content; materiality is determined separately.',
    applicableArtifactTypes: revisionTargets,
    changesContent: true,
    requiresVersionTarget: true,
    mayInvalidatePriorStanding: true,
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentImplementationSymbols: [
      'CaseRevision',
      'DiagnosisEducationRevision',
    ],
  }),
  action({
    ...base,
    key: 'REPLACE_COMPONENT',
    category: C.AUTHORING,
    meaning:
      'Replace a component such as clues, explanation, or education section.',
    applicableArtifactTypes: [
      T.CLINICAL_CLUE,
      T.CASE_EXPLANATION,
      T.DIAGNOSIS_EDUCATION_REVISION,
    ],
    changesContent: true,
    requiresVersionTarget: true,
    mayAffectLearnerExposure: true,
    mayInvalidatePriorStanding: true,
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentImplementationSymbols: ['CaseRevision.clues', 'Case.explanation'],
  }),
  action({
    ...base,
    key: 'DETERMINE_MATERIAL_CHANGE',
    category: C.ASSESSMENT,
    meaning: 'Evaluate whether a change is material; it does not edit content.',
    applicableArtifactTypes: revisionTargets,
    subjectArtifactTypes: revisionTargets,
    targetRevisionTypes: revisionTargets,
    producesArtifactTypes: [T.MATERIAL_CHANGE_DETERMINATION],
    requiresVersionTarget: true,
    createsAssessment: true,
    producesRecordKinds: [R.ASSESSMENT_RECORD],
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentImplementationSymbols: [
      'CaseReviewContextSnapshot.invalidationReason',
    ],
  }),
  action({
    ...base,
    key: 'RECORD_MATERIAL_CHANGE_DETERMINATION',
    category: C.GOVERNANCE,
    meaning: 'Record material-change determination and affected standing.',
    applicableArtifactTypes: [T.MATERIAL_CHANGE_DETERMINATION],
    producesArtifactTypes: [T.MATERIAL_CHANGE_DETERMINATION],
    requiresVersionTarget: true,
    createsGovernanceRecord: true,
    producesRecordKinds: [R.GOVERNANCE_RECORD],
    governanceRecordType: G.MATERIAL_CHANGE_DETERMINATION,
    mayInvalidatePriorStanding: true,
    currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
    currentImplementationSymbols: [
      'CaseReviewContextSnapshot.invalidationReason',
    ],
  }),
  action({
    ...base,
    key: 'SUPERSEDE_REVISION',
    category: C.DECISION,
    meaning:
      'Declare an older revision superseded after replacement is established.',
    applicableArtifactTypes: revisionTargets,
    requiresVersionTarget: true,
    requiresDecision: true,
    decisionOutcome: D.SUPERSEDE_REVISION,
    createsGovernanceRecord: true,
    producesRecordKinds: [R.DECISION_RECORD],
    governanceRecordType: G.SUPERSESSION_RECORD,
    mayInvalidatePriorStanding: true,
    currentImplementationSupport: I.NOT_IMPLEMENTED,
    notes: ['Creating the replacement revision is CREATE_REVISION.'],
  }),
  action({
    ...base,
    key: 'ARCHIVE_ARTIFACT',
    category: C.MAINTENANCE,
    meaning:
      'Archive an artifact identity or projection without implying publication withdrawal.',
    applicableArtifactTypes: [T.CLINICAL_CASE, T.DIAGNOSIS_EDUCATION],
    createsOperationalEffect: true,
    requiresDecision: true,
    createsGovernanceRecord: true,
    producesRecordKinds: [R.DECISION_RECORD],
    governanceRecordType: G.EDITORIAL_DECISION,
    currentImplementationSupport: I.NOT_IMPLEMENTED,
  }),
  action({
    ...base,
    key: 'RETIRE_ARTIFACT',
    category: C.DECISION,
    meaning:
      'Retire an artifact after retirement assessment and governed decision.',
    applicableArtifactTypes: [T.CLINICAL_CASE, T.DIAGNOSIS_REGISTRY],
    createsAssessment: false,
    requiresDecision: true,
    decisionOutcome: D.RETIRE_ARTIFACT,
    createsGovernanceRecord: true,
    producesRecordKinds: [R.DECISION_RECORD],
    governanceRecordType: G.EDITORIAL_DECISION,
    mayInvalidatePriorStanding: true,
    currentImplementationSupport: I.NOT_IMPLEMENTED,
    notes: ['Normally requires RETIREMENT_ASSESSMENT before execution.'],
  }),
  ...[
    'REQUEST_VALIDATION',
    'RUN_VALIDATION',
    'RECORD_VALIDATION_RESULT',
    'MARK_VALIDATION_STALE',
    'RERUN_VALIDATION',
  ].map((key) =>
    action({
      ...base,
      key: key as WeosEditorialAction,
      category: C.VALIDATION,
      meaning: `${key} manages Validation Result output or standing; it does not approve content.`,
      applicableArtifactTypes: [
        T.VALIDATION_RESULT,
        T.REASONING_VALIDATION_RESULT,
      ],
      requiresVersionTarget: key !== 'REQUEST_VALIDATION',
      createsValidationResult: [
        'RUN_VALIDATION',
        'RECORD_VALIDATION_RESULT',
        'RERUN_VALIDATION',
      ].includes(key),
      producesRecordKinds: [
        'RUN_VALIDATION',
        'RECORD_VALIDATION_RESULT',
        'RERUN_VALIDATION',
      ].includes(key)
        ? [R.VALIDATION_RECORD]
        : [],
      mayInvalidatePriorStanding: key === 'MARK_VALIDATION_STALE',
      currentImplementationSupport:
        key === 'MARK_VALIDATION_STALE'
          ? I.PARTIALLY_IMPLEMENTED
          : I.IMPLEMENTED,
      currentImplementationSymbols: [
        'CaseValidationRun',
        'ReasoningDraftValidationRun',
      ],
    }),
  ),
  ...[
    'REQUEST_REVIEW',
    'ASSIGN_REVIEWER',
    'BEGIN_REVIEW',
    'REQUEST_CHANGES',
    'REQUEST_EVIDENCE',
    'DEFER_REVIEW',
    'ESCALATE_REVIEW',
    'COMPLETE_REVIEW',
  ].map((key) =>
    action({
      ...base,
      key: key as WeosEditorialAction,
      category: C.REVIEW,
      meaning:
        key === 'REQUEST_CHANGES'
          ? 'Communicate requested changes during review; it may create a Review Event or Audit Event but does not necessarily alter governed standing.'
          : `${key} operates on review workflow and is not itself approval.`,
      applicableArtifactTypes: [T.EDITORIAL_REVIEW],
      requiresVersionTarget: true,
      createsGovernanceRecord: false,
      producesRecordKinds: key === 'REQUEST_CHANGES' ? [R.AUDIT_EVENT] : [],
      auditRecordType: key === 'REQUEST_CHANGES' ? AR.REVIEW_EVENT : undefined,
      mayInvalidatePriorStanding: key === 'ESCALATE_REVIEW',
      currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
      currentImplementationSymbols: ['CaseReview'],
    }),
  ),
  ...[
    ['RECORD_CLINICAL_ASSESSMENT', T.CLINICAL_ASSESSMENT],
    ['RECORD_EDUCATIONAL_ASSESSMENT', T.EDUCATIONAL_ASSESSMENT],
    ['RECORD_REASONING_ASSESSMENT', T.REASONING_ASSESSMENT],
    ['RECORD_EVIDENCE_ASSESSMENT', T.EVIDENCE_ASSESSMENT],
    ['RECORD_SAFETY_ASSESSMENT', T.SAFETY_ASSESSMENT],
    [
      'RECORD_PUBLICATION_READINESS_ASSESSMENT',
      T.PUBLICATION_READINESS_ASSESSMENT,
    ],
    ['RECORD_PUBLICATION_ASSESSMENT', T.PUBLICATION_ASSESSMENT],
  ].map(([key, artifactType]) =>
    action({
      ...base,
      key: key as WeosEditorialAction,
      category: C.ASSESSMENT,
      meaning: `${key} records a structured assessment result and does not create approval.`,
      applicableArtifactTypes: [artifactType as WeosArtifactType],
      requiresVersionTarget: true,
      createsAssessment: true,
      producesRecordKinds: [R.ASSESSMENT_RECORD],
      currentImplementationSupport: I.NOT_IMPLEMENTED,
    }),
  ),
  action({
    ...base,
    key: 'ASSESS_PUBLICATION_READINESS',
    category: C.ASSESSMENT,
    meaning:
      'Perform publication-readiness evaluation; RECORD_PUBLICATION_READINESS_ASSESSMENT records the result.',
    applicableArtifactTypes: [T.PUBLICATION_READINESS_ASSESSMENT],
    requiresVersionTarget: true,
    createsAssessment: false,
    producesRecordKinds: [],
    currentImplementationSupport: I.NOT_IMPLEMENTED,
  }),
  ...[
    ['APPROVE_REVISION', D.APPROVE_REVISION, T.EDITORIAL_DECISION],
    ['REJECT_REVISION', D.REJECT_REVISION, T.EDITORIAL_DECISION],
    ['REQUIRE_REVISION', D.REQUIRE_REVISION, T.EDITORIAL_DECISION],
    [
      'APPROVE_CANDIDATE_CREATION',
      D.APPROVE_CANDIDATE_CREATION,
      T.DIAGNOSIS_REGISTRY_CANDIDATE,
    ],
    ['MERGE_CANDIDATE', D.MERGE_CANDIDATE, T.DIAGNOSIS_REGISTRY_CANDIDATE],
    ['APPROVE_GRAPH_PROMOTION', D.APPROVE_GRAPH_PROMOTION, T.GRAPH_CANDIDATE],
    ['REJECT_GRAPH_CANDIDATE', D.REJECT_GRAPH_CANDIDATE, T.GRAPH_CANDIDATE],
    ['ACTIVATE_RELATIONSHIP', D.ACTIVATE_RELATIONSHIP, T.TEACHING_RELATIONSHIP],
    [
      'DEPRECATE_RELATIONSHIP',
      D.DEPRECATE_RELATIONSHIP,
      T.TEACHING_RELATIONSHIP,
    ],
  ].map(([key, outcome, artifactType]) =>
    action({
      ...base,
      key: key as WeosEditorialAction,
      category: C.DECISION,
      meaning:
        key === 'REQUIRE_REVISION'
          ? 'Governed decision requiring revision; unlike REQUEST_CHANGES, it changes standing and records rationale, authority, and obligations.'
          : `${key} is a governed decision action.`,
      applicableArtifactTypes: [
        artifactType as WeosArtifactType,
        ...(key === 'APPROVE_REVISION' ||
        key === 'REJECT_REVISION' ||
        key === 'REQUIRE_REVISION'
          ? revisionTargets
          : []),
      ],
      subjectArtifactTypes:
        key === 'APPROVE_REVISION' ||
        key === 'REJECT_REVISION' ||
        key === 'REQUIRE_REVISION'
          ? revisionTargets
          : [artifactType as WeosArtifactType],
      targetRevisionTypes:
        key === 'APPROVE_REVISION' ||
        key === 'REJECT_REVISION' ||
        key === 'REQUIRE_REVISION'
          ? revisionTargets
          : [],
      producesArtifactTypes:
        key === 'APPROVE_REVISION' ||
        key === 'REJECT_REVISION' ||
        key === 'REQUIRE_REVISION'
          ? [T.EDITORIAL_DECISION]
          : [artifactType as WeosArtifactType],
      requiresVersionTarget: [
        'APPROVE_REVISION',
        'REJECT_REVISION',
        'REQUIRE_REVISION',
      ].includes(key),
      requiresDecision: true,
      decisionOutcome: outcome as WeosDecisionType,
      createsGovernanceRecord: true,
      producesRecordKinds: [R.DECISION_RECORD],
      governanceRecordType: G.EDITORIAL_DECISION,
      createsOperationalEffect: [
        'ACTIVATE_RELATIONSHIP',
        'DEPRECATE_RELATIONSHIP',
      ].includes(key),
      mayInvalidatePriorStanding: [
        'REJECT_REVISION',
        'DEPRECATE_RELATIONSHIP',
      ].includes(key),
      currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
      currentImplementationSymbols: ['CaseReview', 'DiagnosisGraphCandidate'],
    }),
  ),
  action({
    ...base,
    key: 'ACTIVATE_ARTIFACT',
    abstract: true,
    category: C.DECISION,
    meaning:
      'Abstract family for governed activation actions; use a concrete action in executable transitions.',
    applicableArtifactTypes: [T.DIAGNOSIS_REGISTRY, T.TEACHING_RELATIONSHIP],
    requiresDecision: true,
    decisionOutcome: D.ACTIVATE_ARTIFACT,
    createsGovernanceRecord: true,
    producesRecordKinds: [R.DECISION_RECORD],
    governanceRecordType: G.EDITORIAL_DECISION,
    createsOperationalEffect: true,
    currentImplementationSupport: I.NOT_IMPLEMENTED,
  }),
  action({
    ...base,
    key: 'DEPRECATE_ARTIFACT',
    abstract: true,
    category: C.DECISION,
    meaning:
      'Abstract family for governed deprecation actions; use a concrete action in executable transitions.',
    applicableArtifactTypes: [T.DIAGNOSIS_REGISTRY, T.TEACHING_RELATIONSHIP],
    requiresDecision: true,
    decisionOutcome: D.DEPRECATE_ARTIFACT,
    createsGovernanceRecord: true,
    producesRecordKinds: [R.DECISION_RECORD],
    governanceRecordType: G.EDITORIAL_DECISION,
    mayInvalidatePriorStanding: true,
    currentImplementationSupport: I.NOT_IMPLEMENTED,
  }),
  ...[
    'CREATE_AI_DRAFT',
    'VALIDATE_AI_DRAFT',
    'ACCEPT_AI_DRAFT',
    'REJECT_AI_DRAFT',
    'REQUEST_AI_DRAFT_CHANGES',
    'CREATE_CLUE_REVISION_DRAFT',
    'ACCEPT_CLUE_REVISION_DRAFT',
    'REJECT_CLUE_REVISION_DRAFT',
    'APPLY_ACCEPTED_DRAFT',
    'RECONCILE_STALE_APPLICATION',
  ].map((key) =>
    action({
      ...base,
      key: key as WeosEditorialAction,
      category:
        key === 'APPLY_ACCEPTED_DRAFT' || key === 'RECONCILE_STALE_APPLICATION'
          ? C.APPLICATION
          : key.includes('VALIDATE')
            ? C.VALIDATION
            : key.includes('ACCEPT') ||
                key.includes('REJECT') ||
                key === 'REQUEST_AI_DRAFT_CHANGES'
              ? C.DECISION
              : C.AUTHORING,
      meaning: `${key} keeps creation, validation, acceptance, and application separate.`,
      applicableArtifactTypes: [
        T.AI_DRAFT,
        T.AI_DRAFT_ACCEPTANCE,
        T.CLUE_REVISION_DRAFT,
        T.CONTROLLED_APPLICATION_RECORD,
      ],
      subjectArtifactTypes:
        key === 'CREATE_AI_DRAFT'
          ? revisionTargets
          : key === 'CREATE_CLUE_REVISION_DRAFT'
            ? [T.CASE_REVISION]
            : key.includes('CLUE')
              ? [T.CLUE_REVISION_DRAFT]
              : key.includes('AI_DRAFT')
                ? [T.AI_DRAFT]
                : [T.CONTROLLED_APPLICATION_RECORD],
      targetRevisionTypes: [
        'CREATE_AI_DRAFT',
        'CREATE_CLUE_REVISION_DRAFT',
        'APPLY_ACCEPTED_DRAFT',
        'RECONCILE_STALE_APPLICATION',
      ].includes(key)
        ? revisionTargets
        : [],
      producesArtifactTypes:
        key === 'CREATE_AI_DRAFT'
          ? [T.AI_DRAFT]
          : key === 'CREATE_CLUE_REVISION_DRAFT'
            ? [T.CLUE_REVISION_DRAFT]
            : key === 'VALIDATE_AI_DRAFT'
              ? [T.VALIDATION_RESULT]
              : [
                    'ACCEPT_AI_DRAFT',
                    'REJECT_AI_DRAFT',
                    'REQUEST_AI_DRAFT_CHANGES',
                    'ACCEPT_CLUE_REVISION_DRAFT',
                    'REJECT_CLUE_REVISION_DRAFT',
                  ].includes(key)
                ? [T.EDITORIAL_DECISION]
                : key === 'APPLY_ACCEPTED_DRAFT'
                  ? [T.CONTROLLED_APPLICATION_RECORD, T.CASE_REVISION]
                  : [],
      createsContent: key === 'CREATE_CLUE_REVISION_DRAFT',
      changesContent: key === 'APPLY_ACCEPTED_DRAFT',
      createsRevision: key === 'APPLY_ACCEPTED_DRAFT',
      requiresVersionTarget: [
        'APPLY_ACCEPTED_DRAFT',
        'RECONCILE_STALE_APPLICATION',
      ].includes(key),
      createsValidationResult: key === 'VALIDATE_AI_DRAFT',
      producesRecordKinds:
        key === 'VALIDATE_AI_DRAFT'
          ? [R.VALIDATION_RECORD]
          : [
                'ACCEPT_AI_DRAFT',
                'REJECT_AI_DRAFT',
                'REQUEST_AI_DRAFT_CHANGES',
                'ACCEPT_CLUE_REVISION_DRAFT',
                'REJECT_CLUE_REVISION_DRAFT',
              ].includes(key)
            ? [R.DECISION_RECORD]
            : key === 'APPLY_ACCEPTED_DRAFT'
              ? [R.GOVERNANCE_RECORD]
              : [],
      requiresDecision: [
        'ACCEPT_AI_DRAFT',
        'REJECT_AI_DRAFT',
        'REQUEST_AI_DRAFT_CHANGES',
        'ACCEPT_CLUE_REVISION_DRAFT',
        'REJECT_CLUE_REVISION_DRAFT',
      ].includes(key),
      decisionOutcome:
        key === 'ACCEPT_AI_DRAFT'
          ? D.ACCEPT_AI_DRAFT
          : key === 'REJECT_AI_DRAFT'
            ? D.REJECT_AI_DRAFT
            : key === 'REQUEST_AI_DRAFT_CHANGES'
              ? D.REQUEST_AI_DRAFT_CHANGES
              : key === 'ACCEPT_CLUE_REVISION_DRAFT'
                ? D.ACCEPT_CLUE_REVISION_DRAFT
                : key === 'REJECT_CLUE_REVISION_DRAFT'
                  ? D.REJECT_CLUE_REVISION_DRAFT
                  : null,
      createsGovernanceRecord: [
        'ACCEPT_AI_DRAFT',
        'REJECT_AI_DRAFT',
        'REQUEST_AI_DRAFT_CHANGES',
        'ACCEPT_CLUE_REVISION_DRAFT',
        'REJECT_CLUE_REVISION_DRAFT',
        'APPLY_ACCEPTED_DRAFT',
      ].includes(key),
      governanceRecordType: [
        'ACCEPT_AI_DRAFT',
        'REJECT_AI_DRAFT',
        'REQUEST_AI_DRAFT_CHANGES',
        'ACCEPT_CLUE_REVISION_DRAFT',
        'REJECT_CLUE_REVISION_DRAFT',
      ].includes(key)
        ? G.EDITORIAL_DECISION
        : key === 'APPLY_ACCEPTED_DRAFT'
          ? G.CONTROLLED_APPLICATION_RECORD
          : undefined,
      createsOperationalEffect: key === 'APPLY_ACCEPTED_DRAFT',
      mayAffectLearnerExposure: key === 'APPLY_ACCEPTED_DRAFT',
      mayInvalidatePriorStanding: [
        'APPLY_ACCEPTED_DRAFT',
        'RECONCILE_STALE_APPLICATION',
      ].includes(key),
      currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
      currentImplementationSymbols: [
        'AiDraftRevisionAudit',
        'CaseClueRevisionDraft',
      ],
      notes:
        key === 'APPLY_ACCEPTED_DRAFT'
          ? ['Application does not approve the resulting revision.']
          : [],
    }),
  ),
  ...[
    'ACTIVATE_REGISTRY_ENTRY',
    'HIDE_REGISTRY_ENTRY',
    'DEPRECATE_REGISTRY_ENTRY',
    'REMAP_DIAGNOSIS_REFERENCE',
    'MERGE_REGISTRY_ENTRY',
  ].map((key) =>
    action({
      ...base,
      key: key as WeosEditorialAction,
      category: C.IDENTITY,
      meaning:
        key === 'MERGE_REGISTRY_ENTRY'
          ? 'Consolidate established diagnosis identities and govern dependency impacts.'
          : key === 'REMAP_DIAGNOSIS_REFERENCE'
            ? 'Govern remapping of references between diagnosis identities without changing lifecycle standing by itself.'
            : `${key} changes diagnosis identity standing or projection.`,
      applicableArtifactTypes: [T.DIAGNOSIS_REGISTRY],
      subjectArtifactTypes: [T.DIAGNOSIS_REGISTRY],
      producesArtifactTypes: [T.GOVERNANCE_RECORD],
      requiresDecision: true,
      createsGovernanceRecord: true,
      producesRecordKinds: [R.GOVERNANCE_RECORD],
      createsOperationalEffect: key !== 'REMAP_DIAGNOSIS_REFERENCE',
      mayAffectLearnerExposure: key === 'DEPRECATE_REGISTRY_ENTRY',
      mayInvalidatePriorStanding: [
        'DEPRECATE_REGISTRY_ENTRY',
        'REMAP_DIAGNOSIS_REFERENCE',
        'MERGE_REGISTRY_ENTRY',
      ].includes(key),
      currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
      currentImplementationSymbols: [
        'DiagnosisRegistry',
        'DiagnosisRegistryMergeLog',
      ],
      notes:
        key === 'REMAP_DIAGNOSIS_REFERENCE'
          ? [
              'Requires source/target identities, affected-reference inventory, authority, rationale, collision checks, dependency-impact assessment, idempotency, transaction, and optimistic concurrency.',
            ]
          : [],
    }),
  ),
  ...[
    'GRANT_PLAYABILITY',
    'REMOVE_PLAYABILITY',
    'GRANT_GENERATABILITY',
    'REMOVE_GENERATABILITY',
  ].map((key) =>
    action({
      ...base,
      key: key as WeosEditorialAction,
      category: C.OPERATIONAL_PERMISSION,
      meaning: `${key} changes operational permission and never changes editorial standing.`,
      applicableArtifactTypes: [T.DIAGNOSIS_OPERATIONAL_PERMISSION],
      subjectArtifactTypes: [T.DIAGNOSIS_OPERATIONAL_PERMISSION],
      producesArtifactTypes: [T.EDITORIAL_DECISION],
      requiresDecision: true,
      createsGovernanceRecord: true,
      producesRecordKinds: [R.DECISION_RECORD],
      governanceRecordType: G.EDITORIAL_DECISION,
      createsOperationalEffect: true,
      mayAffectLearnerExposure: key.includes('PLAYABILITY'),
      currentImplementationSupport: I.PARTIALLY_IMPLEMENTED,
      currentImplementationSymbols: [
        'DiagnosisRegistry.isPlayable',
        'DiagnosisRegistry.isGeneratable',
      ],
    }),
  ),
  action({
    ...base,
    key: 'WITHDRAW_EVIDENCE_SOURCE',
    category: C.MAINTENANCE,
    meaning:
      'Govern evidence source withdrawal; compatibility projection writes are implementation effects, not peer canonical actions.',
    applicableArtifactTypes: [T.EVIDENCE_SOURCE],
    subjectArtifactTypes: [T.EVIDENCE_SOURCE],
    producesArtifactTypes: [T.WITHDRAWAL_RECORD],
    requiresDecision: true,
    createsGovernanceRecord: true,
    producesRecordKinds: [R.DECISION_RECORD],
    governanceRecordType: G.WITHDRAWAL_RECORD,
    createsOperationalEffect: true,
    mayInvalidatePriorStanding: true,
    currentImplementationSupport: I.NOT_IMPLEMENTED,
  }),
  ...['TRIGGER_EVIDENCE_REFRESH', 'TRIGGER_GUIDELINE_REVIEW'].map((key) =>
    action({
      ...base,
      key: key as WeosEditorialAction,
      category: C.MAINTENANCE,
      meaning: `${key} opens maintenance/revalidation work and does not itself withdraw publication.`,
      applicableArtifactTypes: [
        T.EVIDENCE_REFRESH_TRIGGER,
        T.GUIDELINE_CHANGE_TRIGGER,
      ],
      createsOperationalEffect: true,
      mayInvalidatePriorStanding: true,
      currentImplementationSupport: I.NOT_IMPLEMENTED,
    }),
  ),
  ...[
    ['AUTHORISE_PUBLICATION', D.AUTHORISE_PUBLICATION],
    ['DECLINE_PUBLICATION', D.DECLINE_PUBLICATION],
    ['WITHDRAW_PUBLICATION', D.WITHDRAW_PUBLICATION],
    ['SUPERSEDE_PUBLICATION', D.SUPERSEDE_PUBLICATION],
  ].map(([key, outcome]) =>
    action({
      ...base,
      key: key as WeosEditorialAction,
      category: C.PUBLICATION,
      meaning: `${key} is a publication decision action distinct from schedule, release, and exposure.`,
      applicableArtifactTypes: [
        T.PUBLICATION_DECISION,
        T.PUBLISHED_ARTIFACT_VERSION,
      ],
      subjectArtifactTypes: [T.PUBLISHED_ARTIFACT_VERSION],
      targetRevisionTypes: [T.CASE_REVISION, T.DIAGNOSIS_EDUCATION_REVISION],
      producesArtifactTypes:
        key === 'WITHDRAW_PUBLICATION'
          ? [T.WITHDRAWAL_RECORD, T.PUBLICATION_HISTORY]
          : key === 'SUPERSEDE_PUBLICATION'
            ? [T.SUPERSESSION_RECORD, T.PUBLICATION_HISTORY]
            : [T.PUBLICATION_DECISION],
      requiresVersionTarget: true,
      requiresDecision: true,
      decisionOutcome: outcome as WeosDecisionType,
      createsGovernanceRecord: true,
      producesRecordKinds: [R.DECISION_RECORD],
      governanceRecordType:
        key === 'WITHDRAW_PUBLICATION'
          ? G.WITHDRAWAL_RECORD
          : key === 'SUPERSEDE_PUBLICATION'
            ? G.SUPERSESSION_RECORD
            : G.PUBLICATION_DECISION,
      createsOperationalEffect:
        key === 'WITHDRAW_PUBLICATION' || key === 'SUPERSEDE_PUBLICATION',
      mayAffectLearnerExposure:
        key === 'WITHDRAW_PUBLICATION' || key === 'SUPERSEDE_PUBLICATION',
      mayInvalidatePriorStanding:
        key === 'WITHDRAW_PUBLICATION' || key === 'SUPERSEDE_PUBLICATION',
      currentImplementationSupport: I.NOT_IMPLEMENTED,
      currentImplementationSymbols: ['Case.publishedAt'],
    }),
  ),
  ...[
    'SCHEDULE_PUBLICATION',
    'CANCEL_PUBLICATION_SCHEDULE',
    'RELEASE_PUBLICATION',
    'CREATE_LEARNER_EXPOSURE',
    'END_LEARNER_EXPOSURE',
  ].map((key) =>
    action({
      ...base,
      key: key as WeosEditorialAction,
      category:
        key.includes('SCHEDULE') || key.includes('CANCEL')
          ? C.SCHEDULING
          : C.RELEASE,
      meaning: `${key} is operational scheduling, release, or exposure work and not a publication decision.`,
      applicableArtifactTypes: [
        T.PUBLICATION_SCHEDULE,
        T.RELEASE_EVENT,
        T.LEARNER_EXPOSURE_REFERENCE,
      ],
      requiresVersionTarget: key !== 'CANCEL_PUBLICATION_SCHEDULE',
      createsOperationalEffect: true,
      mayAffectLearnerExposure:
        key.includes('EXPOSURE') || key.includes('RELEASE'),
      currentImplementationSupport:
        key.includes('SCHEDULE') || key.includes('RELEASE')
          ? I.PARTIALLY_IMPLEMENTED
          : I.NOT_IMPLEMENTED,
      currentImplementationSymbols: ['DailyCase'],
    }),
  ),
  action({
    ...base,
    key: 'REPUBLISH_REVISION',
    composite: true,
    category: C.PUBLICATION,
    meaning:
      'Composite workflow covering reassessment, authorisation, scheduling, release, and exposure; not an atomic executable canonical action.',
    applicableArtifactTypes: [T.CORRECTION_WORKFLOW],
    requiresVersionTarget: true,
    requiresDecision: true,
    createsGovernanceRecord: true,
    producesRecordKinds: [R.DECISION_RECORD],
    governanceRecordType: G.PUBLICATION_DECISION,
    createsOperationalEffect: true,
    mayAffectLearnerExposure: true,
    mayInvalidatePriorStanding: true,
    currentImplementationSupport: I.NOT_IMPLEMENTED,
    notes: [
      'Use underlying assessment, authorisation, schedule, release, and exposure actions for executable workflows.',
    ],
  }),
  ...[
    'CREATE_REVALIDATION_OBLIGATION',
    'MARK_REVIEW_DUE',
    'RECORD_CONFLICT_OF_INTEREST',
    'GRANT_GOVERNANCE_EXCEPTION',
    'RECORD_DISAGREEMENT',
    'ADJUDICATE_DISAGREEMENT',
    'INITIATE_EMERGENCY_CORRECTION',
  ].map((key) =>
    action({
      ...base,
      key: key as WeosEditorialAction,
      category: C.GOVERNANCE,
      meaning: `${key} is a future governance or maintenance action; no role assignment is encoded in Phase 2.`,
      applicableArtifactTypes: [
        T.REVALIDATION_OBLIGATION,
        T.REVIEW_DUE_DATE,
        T.CONFLICT_OF_INTEREST_DECLARATION,
        T.GOVERNANCE_EXCEPTION,
        T.DISAGREEMENT_RECORD,
        T.ADJUDICATION_RECORD,
        T.EMERGENCY_CORRECTION,
      ],
      subjectArtifactTypes:
        key === 'CREATE_REVALIDATION_OBLIGATION'
          ? revisionTargets
          : key === 'MARK_REVIEW_DUE'
            ? revisionTargets
            : key === 'RECORD_CONFLICT_OF_INTEREST'
              ? [T.EDITORIAL_REVIEW]
              : key === 'GRANT_GOVERNANCE_EXCEPTION'
                ? [T.GOVERNANCE_EXCEPTION]
                : key === 'RECORD_DISAGREEMENT' ||
                    key === 'ADJUDICATE_DISAGREEMENT'
                  ? [T.DISAGREEMENT_RECORD]
                  : [T.EMERGENCY_CORRECTION],
      producesArtifactTypes:
        key === 'CREATE_REVALIDATION_OBLIGATION'
          ? [T.REVALIDATION_OBLIGATION]
          : key === 'MARK_REVIEW_DUE'
            ? [T.REVIEW_DUE_DATE]
            : key === 'RECORD_CONFLICT_OF_INTEREST'
              ? [T.CONFLICT_OF_INTEREST_DECLARATION]
              : key === 'GRANT_GOVERNANCE_EXCEPTION'
                ? [T.GOVERNANCE_EXCEPTION]
                : key === 'RECORD_DISAGREEMENT'
                  ? [T.DISAGREEMENT_RECORD]
                  : key === 'ADJUDICATE_DISAGREEMENT'
                    ? [T.ADJUDICATION_RECORD]
                    : [T.EMERGENCY_CORRECTION, T.REVALIDATION_OBLIGATION],
      requiresVersionTarget: true,
      requiresDecision: ![
        'CREATE_REVALIDATION_OBLIGATION',
        'MARK_REVIEW_DUE',
        'RECORD_DISAGREEMENT',
        'INITIATE_EMERGENCY_CORRECTION',
      ].includes(key),
      createsGovernanceRecord: [
        'RECORD_CONFLICT_OF_INTEREST',
        'GRANT_GOVERNANCE_EXCEPTION',
        'RECORD_DISAGREEMENT',
        'ADJUDICATE_DISAGREEMENT',
      ].includes(key),
      producesRecordKinds:
        key === 'CREATE_REVALIDATION_OBLIGATION'
          ? [R.OBLIGATION]
          : key === 'MARK_REVIEW_DUE'
            ? [R.OBLIGATION]
            : key === 'INITIATE_EMERGENCY_CORRECTION'
              ? [R.WORKFLOW, R.OBLIGATION]
              : [R.GOVERNANCE_RECORD],
      governanceRecordType:
        key === 'GRANT_GOVERNANCE_EXCEPTION'
          ? G.GOVERNANCE_EXCEPTION
          : key === 'RECORD_CONFLICT_OF_INTEREST'
            ? G.CONFLICT_OF_INTEREST_DECLARATION
            : key === 'RECORD_DISAGREEMENT'
              ? G.DISAGREEMENT_RECORD
              : key === 'ADJUDICATE_DISAGREEMENT'
                ? G.ADJUDICATION_RECORD
                : undefined,
      mayAffectLearnerExposure: key === 'INITIATE_EMERGENCY_CORRECTION',
      mayInvalidatePriorStanding: true,
      currentImplementationSupport: I.NOT_IMPLEMENTED,
    }),
  ),
];

export const WEOS_CANONICAL_ACTION_BY_KEY = Object.fromEntries(
  WEOS_CANONICAL_ACTIONS.map((item) => [item.key, item]),
) as Record<WeosEditorialAction, CanonicalActionDefinition>;
