import type {
  GovernedCommand,
  IdempotencyPolicy,
  IdempotencyRecord,
  IdempotencyResolution,
} from './governed-command.types';

export const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

export const computeCommandFingerprint = (command: GovernedCommand): string =>
  stableStringify({
    commandType: command.commandType,
    commandContractVersion: command.commandContractVersion,
    authorityReference: command.authorityResolutionReference,
    primaryTarget: command.primaryTarget,
    concurrencyPreconditions: command.concurrencyPreconditions,
    requestedEffect: command.requestedEffect,
    payloadHash: command.payloadHash,
  });

const terminal = (
  disposition: IdempotencyResolution['disposition'],
  reasons: string[],
): IdempotencyResolution => ({
  disposition,
  reasons,
  mayCreateGovernanceDecision: false,
  mayCreateMutation: false,
  mayUpdateProjection: false,
});

export const resolveCommandIdempotency = (input: {
  command: GovernedCommand;
  commandFingerprint: string;
  priorIdempotencyRecord?: IdempotencyRecord;
  idempotencyPolicy?: IdempotencyPolicy;
}): IdempotencyResolution => {
  if (input.idempotencyPolicy === 'REQUIRED' && !input.command.idempotencyKey)
    return terminal('INVALID', ['IDEMPOTENCY_KEY_REQUIRED']);
  if (input.idempotencyPolicy === 'PROHIBITED' && input.command.idempotencyKey)
    return terminal('INVALID', ['IDEMPOTENCY_KEY_PROHIBITED']);
  if (!input.priorIdempotencyRecord) return terminal('CONTINUE', []);
  if (
    input.command.idempotencyKey !== input.priorIdempotencyRecord.idempotencyKey
  )
    return terminal('CONTINUE', []);
  if (
    input.commandFingerprint !== input.priorIdempotencyRecord.commandFingerprint
  )
    return terminal('REJECTED_IDEMPOTENCY_CONFLICT', [
      'IDEMPOTENCY_FINGERPRINT_MISMATCH',
    ]);
  if (input.priorIdempotencyRecord.resultStatus === 'SUCCESS')
    return terminal('REPLAY_OF_SUCCESSFUL_COMMAND', [
      'REPLAY_WITHOUT_DUPLICATE_EFFECT',
    ]);
  return terminal('REPLAY_OF_REJECTED_COMMAND', [
    'REPLAY_OF_REJECTED_NO_EFFECT',
  ]);
};
