import type {
  GovernanceDecisionEnvelope,
  GovernanceDecisionValidationError,
  GovernanceDecisionValidationResult,
} from './governance-decision.types';

const immutableKeys: readonly (keyof GovernanceDecisionEnvelope)[] = [
  'decisionId',
  'envelopeSchemaVersion',
  'extensionType',
  'extensionSchemaVersion',
  'decisionType',
  'primaryTarget',
  'targetReferences',
  'actor',
  'authority',
  'rationale',
  'findings',
  'outcome',
  'effectiveAction',
  'obligations',
  'supersessionReferences',
  'extensionPayload',
  'occurredAt',
  'createdAt',
];

const stableStringify = (value: unknown): string =>
  JSON.stringify(value, Object.keys(value as object).sort());

const error = (path: string): GovernanceDecisionValidationError => ({
  code: 'FINALIZED_DECISION_IMMUTABLE',
  path,
  message: 'Finalized decisions cannot be edited in place.',
});

export const validateFinalizedDecisionImmutability = (
  before: GovernanceDecisionEnvelope,
  after: GovernanceDecisionEnvelope,
): GovernanceDecisionValidationResult => {
  if (before.status !== 'FINALIZED') {
    return { valid: true, errors: [] };
  }

  const errors = immutableKeys
    .filter(
      (key) => stableStringify(before[key]) !== stableStringify(after[key]),
    )
    .map((key) => error(`$.${String(key)}`));

  return { valid: errors.length === 0, errors };
};
