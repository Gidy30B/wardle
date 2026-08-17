import type { CaseEditorialStatus } from '@prisma/client';
import {
  createGovernanceDecisionExtensionRegistry,
  validateGovernanceDecisionEnvelope,
  type GovernanceDecisionEnvelope,
  type GovernanceDecisionExtensionPolicy,
  type GovernanceTargetReference,
} from '../editorial-governance/governance-decision/index.js';
import { stableStringify } from '../editorial-governance/governed-command/index.js';
import type {
  AuthorityAssignment,
  AuthorityEvidenceSnapshot,
} from '../editorial-governance/authority-assignment/index.js';

export const APP006_ACTION = 'APPROVE_CASE_REVISION';
export const APP006_EXTENSION_TYPE = 'CASE_REVISION_APPROVAL';
export const APP006_ENVELOPE_SCHEMA_VERSION = '1.0.0';
export const APP006_EXTENSION_SCHEMA_VERSION = '1.0.0';

export type App006CompatibilityProjectionEffect = Readonly<{
  owner: typeof APP006_ACTION;
  caseId: string;
  fields: readonly [
    'Case.editorialStatus',
    'Case.approvedAt',
    'Case.approvedByUserId',
  ];
  editorialStatus: CaseEditorialStatus;
  approvedAt: string;
  approvedByUserId: string;
}>;

export type App006ExtensionPayload = Readonly<{
  caseId: string;
  caseRevisionId: string;
  reviewId: string;
  validationRunId: string;
  reviewContextIdentity: string;
  materialContextHash: string;
  commandFingerprint: string;
  authorityAssignmentId: string;
  compatibilityProjectionEffect: App006CompatibilityProjectionEffect;
}>;

export type App006EnvelopeFacts = Readonly<{
  decisionId: string;
  caseId: string;
  caseRevisionId: string;
  reviewId: string;
  validationRunId: string;
  reviewContextIdentity: string;
  materialContextHash: string;
  actorUserId: string;
  authority: AuthorityEvidenceSnapshot;
  authorityAssignment: AuthorityAssignment;
  commandFingerprint: string;
  rationale: string;
  findings: readonly string[];
  obligations: readonly string[];
  compatibilityProjectionEffect: App006CompatibilityProjectionEffect;
  occurredAt: string;
  createdAt: string;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const nonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(nonEmptyString);

const APP006_TARGET_REFERENCE_TYPES = [
  'CASE_REVISION',
  'CASE_REVIEW',
  'CASE_VALIDATION_RUN',
  'CASE_REVIEW_CONTEXT',
] as const;

const isIsoDateTime = (value: unknown): value is string =>
  nonEmptyString(value) &&
  !Number.isNaN(Date.parse(value)) &&
  /^\d{4}-\d{2}-\d{2}T/.test(value);

const app006Target = (
  artifactType: string,
  artifactId: string,
  artifactRevisionId: string,
): GovernanceTargetReference => ({
  artifactType,
  artifactId,
  artifactRevisionId,
  targetScope: 'EXACT_REVISION',
});

export const app006ExtensionPolicy: GovernanceDecisionExtensionPolicy = {
  extensionType: APP006_EXTENSION_TYPE,
  extensionSchemaVersion: APP006_EXTENSION_SCHEMA_VERSION,
  approvalState: 'APPROVED',
  productionAuthority: 'GRANTED',
  allowedDecisionTypes: [APP006_ACTION],
  allowedOutcomes: ['APPROVED'],
  allowedEffectiveActions: [APP006_ACTION],
  requiresExactRevision: true,
  permitsNonHumanAuthority: false,
  allowedSupersessionScopes: [],
  validateExtensionPayload: (payload) => {
    const errors: string[] = [];
    for (const key of [
      'caseId',
      'caseRevisionId',
      'reviewId',
      'validationRunId',
      'reviewContextIdentity',
      'materialContextHash',
      'commandFingerprint',
      'authorityAssignmentId',
    ]) {
      if (!nonEmptyString(payload[key])) errors.push(`${key} is required.`);
    }
    const effect = payload.compatibilityProjectionEffect;
    if (!isRecord(effect)) {
      errors.push('compatibilityProjectionEffect is required.');
    } else {
      if (effect.owner !== APP006_ACTION)
        errors.push('compatibilityProjectionEffect owner is invalid.');
      if (!nonEmptyString(effect.caseId))
        errors.push('compatibilityProjectionEffect caseId is required.');
      if (
        !Array.isArray(effect.fields) ||
        stableStringify(effect.fields) !==
          stableStringify([
            'Case.editorialStatus',
            'Case.approvedAt',
            'Case.approvedByUserId',
          ])
      ) {
        errors.push('compatibilityProjectionEffect fields are invalid.');
      }
      if (effect.editorialStatus !== 'APPROVED')
        errors.push('compatibilityProjectionEffect status is invalid.');
      if (!nonEmptyString(effect.approvedAt))
        errors.push('compatibilityProjectionEffect approvedAt is required.');
      if (!nonEmptyString(effect.approvedByUserId))
        errors.push('compatibilityProjectionEffect approvedByUserId is required.');
    }
    return errors;
  },
};

export const app006GovernanceDecisionRegistry =
  createGovernanceDecisionExtensionRegistry([app006ExtensionPolicy]);

export const buildApp006GovernanceDecisionEnvelope = (
  facts: App006EnvelopeFacts,
): GovernanceDecisionEnvelope => {
  const extensionPayload: App006ExtensionPayload = {
    caseId: facts.caseId,
    caseRevisionId: facts.caseRevisionId,
    reviewId: facts.reviewId,
    validationRunId: facts.validationRunId,
    reviewContextIdentity: facts.reviewContextIdentity,
    materialContextHash: facts.materialContextHash,
    commandFingerprint: facts.commandFingerprint,
    authorityAssignmentId: facts.authority.authorityAssignmentId,
    compatibilityProjectionEffect: facts.compatibilityProjectionEffect,
  };

  return {
    decisionId: facts.decisionId,
    envelopeSchemaVersion: APP006_ENVELOPE_SCHEMA_VERSION,
    extensionType: APP006_EXTENSION_TYPE,
    extensionSchemaVersion: APP006_EXTENSION_SCHEMA_VERSION,
    decisionType: APP006_ACTION,
    status: 'FINALIZED',
    primaryTarget: app006Target(
      'CASE_REVISION',
      facts.caseId,
      facts.caseRevisionId,
    ),
    targetReferences: [
      app006Target('CASE_REVISION', facts.caseId, facts.caseRevisionId),
      app006Target('CASE_REVIEW', facts.reviewId, facts.caseRevisionId),
      app006Target(
        'CASE_VALIDATION_RUN',
        facts.validationRunId,
        facts.caseRevisionId,
      ),
      app006Target(
        'CASE_REVIEW_CONTEXT',
        facts.reviewContextIdentity,
        facts.caseRevisionId,
      ),
    ],
    actor: {
      actorType: 'USER',
      actorId: facts.actorUserId,
    },
    authority: {
      humanAuthorityActorId:
        facts.authorityAssignment.humanAuthorityActorId ?? facts.actorUserId,
      authorityAssignmentId: facts.authority.authorityAssignmentId,
      authorityEvidenceReference: facts.authority.authorityEvidenceReference,
      authorityScopeSnapshot: stableStringify(
        facts.authority.authorityScopeSnapshot,
      ),
      authorityResolvedAt: facts.authority.authorityResolvedAt,
    },
    rationale: facts.rationale,
    findings: facts.findings,
    outcome: 'APPROVED',
    effectiveAction: APP006_ACTION,
    obligations: facts.obligations,
    supersessionReferences: [],
    extensionPayload,
    occurredAt: facts.occurredAt,
    createdAt: facts.createdAt,
  };
};

export const validateApp006GovernanceDecisionEnvelope = (
  envelope: GovernanceDecisionEnvelope,
  facts: App006EnvelopeFacts,
): string[] => {
  const errors = [
    ...validateGovernanceDecisionEnvelope(
      envelope,
      app006GovernanceDecisionRegistry,
    ).errors.map((entry) => `${entry.path}: ${entry.message}`),
  ];
  const payload = envelope.extensionPayload;

  const requiredTargets: GovernanceTargetReference[] = [
    app006Target('CASE_REVISION', facts.caseId, facts.caseRevisionId),
    app006Target('CASE_REVIEW', facts.reviewId, facts.caseRevisionId),
    app006Target(
      'CASE_VALIDATION_RUN',
      facts.validationRunId,
      facts.caseRevisionId,
    ),
    app006Target(
      'CASE_REVIEW_CONTEXT',
      facts.reviewContextIdentity,
      facts.caseRevisionId,
    ),
  ];
  const targetKey = (target: GovernanceTargetReference) =>
    stableStringify({
      artifactType: target.artifactType,
      artifactId: target.artifactId,
      artifactRevisionId: target.artifactRevisionId,
      targetScope: target.targetScope,
    });
  const requiredTargetKeys = new Set(requiredTargets.map(targetKey));
  const seenTargetKeys = new Set<string>();

  if (envelope.envelopeSchemaVersion !== APP006_ENVELOPE_SCHEMA_VERSION) {
    errors.push('envelopeSchemaVersion is not supported for APP-006.');
  }
  if (envelope.status !== 'FINALIZED') {
    errors.push('APP-006 approval decision status must be FINALIZED.');
  }
  if (envelope.actor.actorType !== 'USER') {
    errors.push('APP-006 approval actor type must be USER.');
  }
  if (!nonEmptyString(envelope.rationale)) {
    errors.push('APP-006 approval rationale is required.');
  }
  if (envelope.rationale !== facts.rationale) {
    errors.push('APP-006 approval rationale does not match runtime facts.');
  }
  for (const [label, value] of [
    ['occurredAt', envelope.occurredAt],
    ['createdAt', envelope.createdAt],
    ['authorityResolvedAt', envelope.authority.authorityResolvedAt],
  ] as const) {
    if (!isIsoDateTime(value)) {
      errors.push(`${label} must be an ISO date-time.`);
    }
  }
  if (envelope.occurredAt !== facts.occurredAt) {
    errors.push('occurredAt does not match approval effect timestamp.');
  }
  if (envelope.createdAt !== facts.createdAt) {
    errors.push('createdAt does not match governance decision timestamp.');
  }
  if (envelope.occurredAt !== envelope.createdAt) {
    errors.push('APP-006 approval occurredAt and createdAt must match.');
  }
  if (
    isIsoDateTime(envelope.authority.authorityResolvedAt) &&
    isIsoDateTime(envelope.occurredAt) &&
    Date.parse(envelope.authority.authorityResolvedAt) >
      Date.parse(envelope.occurredAt)
  ) {
    errors.push('authorityResolvedAt cannot be after approval decision time.');
  }

  if (envelope.targetReferences.length !== requiredTargets.length) {
    errors.push('APP-006 targetReferences must contain exactly the approved references.');
  }
  for (const target of envelope.targetReferences) {
    if (
      !APP006_TARGET_REFERENCE_TYPES.includes(
        target.artifactType as (typeof APP006_TARGET_REFERENCE_TYPES)[number],
      )
    ) {
      errors.push(`Unsupported APP-006 target reference type: ${target.artifactType}.`);
    }
    const key = targetKey(target);
    if (seenTargetKeys.has(key)) {
      errors.push('APP-006 targetReferences must not contain duplicates.');
    }
    seenTargetKeys.add(key);
    if (!requiredTargetKeys.has(key)) {
      errors.push(`${target.artifactType} target reference is unsupported or stale.`);
    }
  }

  if (
    envelope.primaryTarget.artifactType !== 'CASE_REVISION' ||
    envelope.primaryTarget.artifactId !== facts.caseId ||
    envelope.primaryTarget.artifactRevisionId !== facts.caseRevisionId
  ) {
    errors.push('primaryTarget does not match approved CaseRevision.');
  }
  for (const target of requiredTargets) {
    if (!seenTargetKeys.has(targetKey(target))) {
      errors.push(`${target.artifactType} target reference is missing or stale.`);
    }
  }
  if (envelope.actor.actorId !== facts.actorUserId) {
    errors.push('actor does not match authenticated command actor.');
  }
  if (facts.authorityAssignment.subjectId !== facts.actorUserId) {
    errors.push('authority assignment subject does not match actor.');
  }
  if (
    envelope.authority.authorityAssignmentId !==
      facts.authority.authorityAssignmentId ||
    payload.authorityAssignmentId !== facts.authority.authorityAssignmentId
  ) {
    errors.push('authority evidence does not match resolved assignment.');
  }
  if (
    envelope.authority.authorityScopeSnapshot !==
    stableStringify(facts.authority.authorityScopeSnapshot)
  ) {
    errors.push('authority scope snapshot does not match resolver evidence.');
  }
  if (
    envelope.authority.authorityResolvedAt !== facts.authority.authorityResolvedAt
  ) {
    errors.push('authorityResolvedAt does not match resolution event.');
  }
  if (payload.caseId !== facts.caseId) errors.push('payload caseId mismatch.');
  if (payload.caseRevisionId !== facts.caseRevisionId)
    errors.push('payload caseRevisionId mismatch.');
  if (payload.reviewId !== facts.reviewId) errors.push('payload reviewId mismatch.');
  if (payload.validationRunId !== facts.validationRunId)
    errors.push('payload validationRunId mismatch.');
  if (payload.reviewContextIdentity !== facts.reviewContextIdentity)
    errors.push('payload reviewContextIdentity mismatch.');
  if (payload.materialContextHash !== facts.materialContextHash)
    errors.push('payload materialContextHash mismatch.');
  if (payload.commandFingerprint !== facts.commandFingerprint)
    errors.push('payload commandFingerprint mismatch.');
  if (!Array.isArray(envelope.obligations) || envelope.obligations.length !== 0) {
    errors.push('APP-006 approval requires empty remaining obligations.');
  }
  if (!isStringArray(envelope.findings)) {
    errors.push('APP-006 envelope findings must be canonical string entries.');
  }
  if (
    !isRecord(payload.compatibilityProjectionEffect) ||
    stableStringify(payload.compatibilityProjectionEffect) !==
      stableStringify(facts.compatibilityProjectionEffect)
  ) {
    errors.push('compatibility projection metadata does not match effect.');
  } else if (
    payload.compatibilityProjectionEffect.approvedAt !== facts.occurredAt
  ) {
    errors.push('compatibility projection approvedAt does not match decision time.');
  }

  return errors;
};
