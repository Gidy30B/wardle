import type {
  ProjectionWriteEligibilityInput,
  ProjectionWriteEligibilityResult,
  ProjectionWriteEligibilityStatus,
} from './compatibility-projection.types';

const denied = (
  status: ProjectionWriteEligibilityStatus,
  reasons: string[],
): ProjectionWriteEligibilityResult => ({
  status,
  eligibleForFutureApplication: false,
  projectionUpdated: false,
  reasons,
});

const eligible = (
  status: ProjectionWriteEligibilityStatus,
): ProjectionWriteEligibilityResult => ({
  status,
  eligibleForFutureApplication: true,
  projectionUpdated: false,
  reasons: [],
});

export const resolveProjectionWriteEligibility = (
  input: ProjectionWriteEligibilityInput,
): ProjectionWriteEligibilityResult => {
  const { definition } = input;
  if (definition.status !== 'APPROVED')
    return denied('DENIED_UNAPPROVED_DEFINITION', ['UNAPPROVED_DEFINITION']);
  if (definition.ownershipStatus === 'UNRESOLVED_OWNER')
    return denied('DENIED_OWNER_UNRESOLVED', ['OWNER_UNRESOLVED']);
  if (input.authorityEligibility && !input.authorityEligibility.eligible)
    return denied(
      'DENIED_AUTHORITY',
      input.authorityEligibility.reasons ?? ['DENIED_AUTHORITY'],
    );
  if (input.commandEligibility?.status === 'REJECTED_STALE_PRECONDITION')
    return denied('DENIED_STALE_COMMAND', ['STALE_COMMAND']);
  if (input.commandEligibility?.status?.startsWith('REJECTED_INVALID'))
    return denied('DENIED_INVALID_COMMAND', ['INVALID_COMMAND']);
  if (input.idempotencyDisposition === 'REPLAY_OF_SUCCESSFUL_COMMAND')
    return denied('DENIED_REPLAY_NO_SECOND_WRITE', ['REPLAY_NO_SECOND_WRITE']);
  if (definition.writerPolicy === 'OBSERVE_ONLY')
    return denied('DENIED_OBSERVE_ONLY', ['OBSERVE_ONLY']);
  if (definition.writerPolicy === 'NO_WRITES')
    return denied('DENIED_NO_WRITES', ['NO_WRITES']);
  if (definition.writerPolicy === 'DERIVATION_ONLY')
    return eligible('ELIGIBLE_FOR_FUTURE_DERIVATION');
  if (definition.writerPolicy === 'TEMPORARY_COMPATIBILITY_WRITE') {
    const details = definition.writerPolicyDetails;
    if (
      !input.writerReference ||
      !details?.allowedWriterReferences?.includes(input.writerReference)
    )
      return denied('DENIED_WRITER_NOT_ALLOWED', ['WRITER_NOT_ALLOWED']);
    if (
      details.expiresAt &&
      Date.parse(input.requestedAt) > Date.parse(details.expiresAt)
    )
      return denied('DENIED_WRITER_POLICY', ['TEMPORARY_POLICY_EXPIRED']);
  }
  if (definition.synchronizationStrategy === 'ASYNCHRONOUS_BOUNDED_DRIFT') {
    if (!definition.driftPolicy?.asynchronousExceptionApprovalRecordId)
      return denied('DENIED_ASYNC_POLICY', ['ASYNC_POLICY_INCOMPLETE']);
  }
  if (
    definition.synchronizationStrategy === 'ATOMIC_SYNCHRONOUS' &&
    input.canonicalEffectAvailability?.available !== true
  )
    return denied('DENIED_CANONICAL_EFFECT_MISSING', [
      'CANONICAL_EFFECT_MISSING',
    ]);
  return eligible('ELIGIBLE_FOR_FUTURE_ATOMIC_SYNCHRONIZATION');
};
