import type {
  ProjectionRepairEligibilityInput,
  ProjectionRepairEligibilityResult,
  ProjectionRepairEligibilityStatus,
} from './compatibility-projection.types';

const repair = (
  status: ProjectionRepairEligibilityStatus,
  eligibleForFutureRepair: boolean,
  reasons: string[],
): ProjectionRepairEligibilityResult => ({
  status,
  eligibleForFutureRepair,
  repairPerformed: false,
  createsGovernanceDecision: false,
  reasons,
});

export const evaluateProjectionRepairEligibility = (
  input: ProjectionRepairEligibilityInput,
): ProjectionRepairEligibilityResult => {
  const policy = input.definition.repairPolicy;
  if (!policy)
    return repair('DENIED_NO_REPAIR_POLICY', false, ['NO_REPAIR_POLICY']);
  if (input.definition.ownershipStatus === 'UNRESOLVED_OWNER')
    return repair('DENIED_OWNER_UNRESOLVED', false, ['OWNER_UNRESOLVED']);
  if (input.authorityEligibility && !input.authorityEligibility.eligible)
    return repair(
      'DENIED_AUTHORITY',
      false,
      input.authorityEligibility.reasons ?? ['DENIED_AUTHORITY'],
    );
  if (input.expectedStateEligibility?.stale)
    return repair('DENIED_STALE_COMMAND', false, ['STALE_COMMAND']);
  if (
    input.expectedStateEligibility &&
    !input.expectedStateEligibility.eligible
  )
    return repair(
      'DENIED_STALE_COMMAND',
      false,
      input.expectedStateEligibility.reasons ?? ['EXPECTED_STATE_DENIED'],
    );
  if (policy.repairMode === 'NO_AUTOMATIC_REPAIR')
    return repair('DENIED_NO_AUTOMATIC_REPAIR', false, ['NO_AUTOMATIC_REPAIR']);
  if (!policy.permittedDriftStatuses?.includes(input.driftResult.driftStatus))
    return repair('DENIED_MODE_NOT_PERMITTED', false, [
      'DRIFT_STATUS_NOT_PERMITTED',
    ]);
  if (
    ['INCOMPLETE', 'CONFLICTING', 'UNKNOWN'].includes(
      input.historicalProvenanceCompleteness ?? 'UNKNOWN',
    )
  )
    return repair('MANUAL_REVIEW_REQUIRED', false, ['HISTORY_INCOMPLETE']);
  if (input.requestedRepairMode === 'MARK_UNKNOWN')
    return repair('MARK_UNKNOWN_ONLY', true, ['MARK_UNKNOWN_ONLY']);
  if (input.requestedRepairMode === 'REBUILD_FROM_CANONICAL') {
    if (policy.deterministicDerivationRequired !== true)
      return repair('DENIED_NONDETERMINISTIC_DERIVATION', false, [
        'NONDETERMINISTIC_DERIVATION',
      ]);
    if (
      policy.provenCanonicalStateRequired &&
      input.canonicalSnapshot?.stateStatus !== 'KNOWN'
    )
      return repair('DENIED_CANONICAL_STATE_UNKNOWN', false, [
        'CANONICAL_STATE_UNKNOWN',
      ]);
    return repair('ELIGIBLE_FOR_FUTURE_REBUILD', true, []);
  }
  if (input.requestedRepairMode === 'REPLAY_PROVEN_CANONICAL_EFFECT') {
    if (!input.canonicalSnapshot?.canonicalEffectReference)
      return repair('DENIED_CANONICAL_EFFECT_MISSING', false, [
        'CANONICAL_EFFECT_MISSING',
      ]);
    return repair('ELIGIBLE_FOR_FUTURE_EFFECT_REPLAY', true, []);
  }
  return repair('INVALID', false, ['INVALID_REPAIR_REQUEST']);
};
