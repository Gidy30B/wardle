import {
  WEOS_ACTION_CATEGORIES,
  WEOS_EDITORIAL_ACTIONS,
  type WeosEditorialAction,
} from './canonical-actions';
import {
  WEOS_ARTIFACT_TYPES,
  type WeosArtifactType,
} from './canonical-artifact-catalogue';
import {
  WEOS_BLOCKING_EFFECTS,
  WEOS_DECISION_TYPES,
  type WeosBlockingEffect,
  type WeosDecisionType,
} from './canonical-concepts';
import {
  type CanonicalStandingImpact,
  WEOS_INVALIDATION_RULES,
} from './canonical-invalidation';
import {
  WEOS_PRECONDITIONS,
  type WeosPreconditionKey,
} from './canonical-preconditions';

export const WEOS_TRANSITION_DISPOSITIONS = {
  ALLOWED: 'ALLOWED',
  BLOCKED: 'BLOCKED',
  REQUIRES_REVIEW: 'REQUIRES_REVIEW',
  REQUIRES_ADJUDICATION: 'REQUIRES_ADJUDICATION',
} as const;

export type WeosTransitionDisposition =
  (typeof WEOS_TRANSITION_DISPOSITIONS)[keyof typeof WEOS_TRANSITION_DISPOSITIONS];

export type CanonicalTransitionDefinition = Readonly<{
  key: string;
  artifactType: WeosArtifactType;
  fromState: string;
  toState: string;
  action: WeosEditorialAction;
  actionCategory: (typeof WEOS_ACTION_CATEGORIES)[keyof typeof WEOS_ACTION_CATEGORIES];
  decisionType: WeosDecisionType | null;
  requiredPreconditions: readonly WeosPreconditionKey[];
  blockingEffect: WeosBlockingEffect;
  standingImpacts: readonly CanonicalStandingImpact[];
  createsHistoricalRecord: boolean;
  preservesHistoricalRecords: true;
  notes: readonly string[];
}>;

const A = WEOS_EDITORIAL_ACTIONS;
const C = WEOS_ACTION_CATEGORIES;
const D = WEOS_DECISION_TYPES;
const P = WEOS_PRECONDITIONS;
const T = WEOS_ARTIFACT_TYPES;
const B = WEOS_BLOCKING_EFFECTS;

function transition(input: CanonicalTransitionDefinition) {
  return input;
}

const materialRevisionImpact =
  WEOS_INVALIDATION_RULES.MATERIAL_CASE_REVISION_CHANGE.impacts;
const staleApplicationImpact =
  WEOS_INVALIDATION_RULES.AI_DRAFT_APPLICATION_AGAINST_STALE_REVISION.impacts;
const withdrawalImpact = WEOS_INVALIDATION_RULES.PUBLICATION_WITHDRAWAL.impacts;

export const WEOS_CANONICAL_TRANSITIONS: readonly CanonicalTransitionDefinition[] =
  [
    transition({
      key: 'CASE_REVISION_SUBMIT_FOR_VALIDATION',
      artifactType: T.CASE_REVISION,
      fromState: 'DRAFT',
      toState: 'VALIDATION_PENDING',
      action: A.REQUEST_VALIDATION,
      actionCategory: C.VALIDATION,
      decisionType: null,
      requiredPreconditions: [
        P.ARTIFACT_EXISTS,
        P.TARGET_REVISION_EXISTS,
        P.TARGET_REVISION_NOT_SUPERSEDED,
      ],
      blockingEffect: B.NON_BLOCKING,
      standingImpacts: [],
      createsHistoricalRecord: false,
      preservesHistoricalRecords: true,
      notes: ['Validation request is not approval.'],
    }),
    transition({
      key: 'CASE_REVISION_VALIDATION_PASSED_TO_REVIEW',
      artifactType: T.CASE_REVISION,
      fromState: 'VALIDATION_PENDING',
      toState: 'REVIEW_REQUIRED',
      action: A.RECORD_VALIDATION_RESULT,
      actionCategory: C.VALIDATION,
      decisionType: null,
      requiredPreconditions: [
        P.VALIDATION_COMPLETE,
        P.VALIDATION_CURRENT,
        P.NO_BLOCKING_VALIDATION_FINDINGS,
      ],
      blockingEffect: B.NON_BLOCKING,
      standingImpacts: [],
      createsHistoricalRecord: true,
      preservesHistoricalRecords: true,
      notes: [
        'A validation result enables review; it is not an assessment or decision.',
      ],
    }),
    transition({
      key: 'CASE_REVISION_APPROVE',
      artifactType: T.CASE_REVISION,
      fromState: 'UNDER_REVIEW',
      toState: 'APPROVED',
      action: A.APPROVE_REVISION,
      actionCategory: C.DECISION,
      decisionType: D.APPROVE_REVISION,
      requiredPreconditions: [
        P.REVIEW_COMPLETE,
        P.REQUIRED_ASSESSMENTS_COMPLETE,
        P.REQUIRED_ASSESSMENTS_CURRENT,
        P.ACTOR_HAS_REQUIRED_AUTHORITY,
        P.NO_ACTIVE_CONFLICT_OF_INTEREST,
      ],
      blockingEffect: B.NON_BLOCKING,
      standingImpacts: [],
      createsHistoricalRecord: true,
      preservesHistoricalRecords: true,
      notes: ['Revision approval is distinct from publication authorisation.'],
    }),
    transition({
      key: 'CASE_REVISION_REQUIRE_CHANGES',
      artifactType: T.CASE_REVISION,
      fromState: 'UNDER_REVIEW',
      toState: 'REVISION_REQUIRED',
      action: A.REQUIRE_REVISION,
      actionCategory: C.DECISION,
      decisionType: D.REQUIRE_REVISION,
      requiredPreconditions: [
        P.REVIEW_COMPLETE,
        P.ACTOR_HAS_REQUIRED_AUTHORITY,
      ],
      blockingEffect: B.BLOCKING,
      standingImpacts: [],
      createsHistoricalRecord: true,
      preservesHistoricalRecords: true,
      notes: [
        'This decision changes review/revision standing and creates obligations; material content impacts occur when content changes or a new revision is created.',
      ],
    }),
    transition({
      key: 'AI_DRAFT_ACCEPT',
      artifactType: T.AI_DRAFT,
      fromState: 'PENDING_REVIEW',
      toState: 'ACCEPTED',
      action: A.ACCEPT_AI_DRAFT,
      actionCategory: C.DECISION,
      decisionType: D.ACCEPT_AI_DRAFT,
      requiredPreconditions: [
        P.TARGET_REVISION_EXISTS,
        P.REVIEW_COMPLETE,
        P.ACTOR_HAS_REQUIRED_AUTHORITY,
      ],
      blockingEffect: B.NON_BLOCKING,
      standingImpacts: [],
      createsHistoricalRecord: true,
      preservesHistoricalRecords: true,
      notes: ['Acceptance does not apply the draft.'],
    }),
    transition({
      key: 'ACCEPTED_DRAFT_APPLICATION',
      artifactType: T.CONTROLLED_APPLICATION_RECORD,
      fromState: 'READY_TO_APPLY',
      toState: 'APPLIED',
      action: A.APPLY_ACCEPTED_DRAFT,
      actionCategory: C.APPLICATION,
      decisionType: null,
      requiredPreconditions: [
        P.AI_DRAFT_ACCEPTED,
        P.APPLICATION_BASE_REVISION_CURRENT,
        P.RESULTING_REVISION_IDENTIFIED,
      ],
      blockingEffect: B.NON_BLOCKING,
      standingImpacts: materialRevisionImpact,
      createsHistoricalRecord: true,
      preservesHistoricalRecords: true,
      notes: [
        'Application creates or identifies a resulting revision; it is not approval.',
      ],
    }),
    transition({
      key: 'STALE_ACCEPTED_DRAFT_RECONCILIATION',
      artifactType: T.CONTROLLED_APPLICATION_RECORD,
      fromState: 'READY_TO_APPLY',
      toState: 'RECONCILIATION_REQUIRED',
      action: A.RECONCILE_STALE_APPLICATION,
      actionCategory: C.APPLICATION,
      decisionType: null,
      requiredPreconditions: [P.AI_DRAFT_ACCEPTED],
      blockingEffect: B.BLOCKING,
      standingImpacts: staleApplicationImpact,
      createsHistoricalRecord: true,
      preservesHistoricalRecords: true,
      notes: [
        'A stale application path reconciles rather than rewrites history.',
      ],
    }),
    transition({
      key: 'PUBLICATION_AUTHORISE_VERSION',
      artifactType: T.PUBLICATION_DECISION,
      fromState: 'PROPOSED',
      toState: 'AUTHORISED',
      action: A.AUTHORISE_PUBLICATION,
      actionCategory: C.PUBLICATION,
      decisionType: D.AUTHORISE_PUBLICATION,
      requiredPreconditions: [
        P.APPROVED_REVISION_EXISTS,
        P.APPROVAL_CURRENT,
        P.PUBLICATION_ASSESSMENT_COMPLETE,
        P.PUBLICATION_ASSESSMENT_CURRENT,
        P.PUBLICATION_ASSESSMENT_POSITIVE,
        P.ACTOR_HAS_REQUIRED_AUTHORITY,
      ],
      blockingEffect: B.NON_BLOCKING,
      standingImpacts: [],
      createsHistoricalRecord: true,
      preservesHistoricalRecords: true,
      notes: [
        'Publication authorisation is separate from schedule and learner exposure.',
      ],
    }),
    transition({
      key: 'PUBLICATION_WITHDRAW_VERSION',
      artifactType: T.PUBLISHED_ARTIFACT_VERSION,
      fromState: 'PUBLISHED',
      toState: 'WITHDRAWN',
      action: A.WITHDRAW_PUBLICATION,
      actionCategory: C.PUBLICATION,
      decisionType: D.WITHDRAW_PUBLICATION,
      requiredPreconditions: [
        P.PUBLISHED_VERSION_EXISTS,
        P.ACTOR_HAS_REQUIRED_AUTHORITY,
      ],
      blockingEffect: B.BLOCKING,
      standingImpacts: withdrawalImpact,
      createsHistoricalRecord: true,
      preservesHistoricalRecords: true,
      notes: [
        'Withdrawal targets the Published Artifact Version; the original Publication Decision remains historically authorised.',
        'Withdrawal requires a Withdrawal Record, rationale, schedule inventory, and learner-exposure inventory.',
        'Future schedules are cancelled where applicable and active learner exposures are ended or revoked.',
      ],
    }),
  ];

export const WEOS_CANONICAL_TRANSITION_BY_KEY = Object.fromEntries(
  WEOS_CANONICAL_TRANSITIONS.map((item) => [item.key, item]),
) as Record<string, CanonicalTransitionDefinition>;
