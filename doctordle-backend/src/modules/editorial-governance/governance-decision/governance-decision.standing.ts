import type {
  DecisionStanding,
  GovernanceDecisionEnvelope,
} from './governance-decision.types';

export const resolveGovernanceDecisionStanding = (
  decision: GovernanceDecisionEnvelope,
  decisions: readonly GovernanceDecisionEnvelope[],
): DecisionStanding => {
  const superseding = decisions.filter((candidate) =>
    (candidate.supersessionReferences ?? []).some(
      (reference) => reference.decisionId === decision.decisionId,
    ),
  );

  if (superseding.length === 0) {
    return 'ACTIVE';
  }

  const scopes = superseding.flatMap((candidate) =>
    (candidate.supersessionReferences ?? [])
      .filter((reference) => reference.decisionId === decision.decisionId)
      .map((reference) => reference.supersessionScope),
  );

  if (scopes.includes('GLOBAL')) {
    return scopes.some((scope) => scope !== 'GLOBAL')
      ? 'CONFLICTING'
      : 'SUPERSEDED';
  }

  const originalScopes = new Set(
    decision.targetReferences.map((target) => target.targetScope),
  );
  const unknownScope = scopes.some((scope) => !originalScopes.has(scope));
  if (unknownScope) {
    return 'CONFLICTING';
  }

  return 'PARTIALLY_SUPERSEDED';
};
