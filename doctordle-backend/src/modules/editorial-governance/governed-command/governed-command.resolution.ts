import {
  computeCommandFingerprint,
  resolveCommandIdempotency,
} from './governed-command.idempotency';
import { evaluateConcurrencyPreconditions } from './governed-command.preconditions';
import {
  findGovernedCommandContractDefinition,
  isApprovedCommandContract,
} from './governed-command.registry';
import type {
  AuthorityEligibilityInput,
  ConcurrencyTokenPolicyRegistry,
  CurrentDependencyState,
  DisclosureAuthorizationInput,
  GovernedCommand,
  GovernedCommandContractRegistry,
  GovernedCommandResolutionResult,
  IdempotencyRecord,
} from './governed-command.types';
import { validateGovernedCommand } from './governed-command.validation';

const rejected = (
  status: GovernedCommandResolutionResult['status'],
  reasons: string[],
  conflicts = [],
): GovernedCommandResolutionResult => ({
  status,
  reasons: [...new Set(reasons)],
  mayCreateGovernanceDecision: false,
  mayCreateMutation: false,
  mayUpdateProjection: false,
  eligibleForFutureAtomicApplication: false,
  conflicts,
});

export const resolveGovernedCommandEligibility = (input: {
  command: GovernedCommand;
  commandContractRegistry: GovernedCommandContractRegistry;
  tokenPolicyRegistry: ConcurrencyTokenPolicyRegistry;
  currentDependencyStates: CurrentDependencyState[];
  priorIdempotencyRecord?: IdempotencyRecord;
  authorityEligibility?: AuthorityEligibilityInput;
  disclosureAuthorization: DisclosureAuthorizationInput;
  evaluatedAt: string;
}): GovernedCommandResolutionResult => {
  const contract = findGovernedCommandContractDefinition(
    input.commandContractRegistry,
    input.command.commandType,
    input.command.commandContractVersion,
  );
  if (!contract)
    return rejected('REJECTED_MISSING_CONTRACT', ['MISSING_COMMAND_CONTRACT']);
  if (!isApprovedCommandContract(contract))
    return rejected('REJECTED_UNAPPROVED_CONTRACT', [
      'UNAPPROVED_COMMAND_CONTRACT',
    ]);
  const validation = validateGovernedCommand(
    input.command,
    input.commandContractRegistry,
    input.tokenPolicyRegistry,
  );
  if (!validation.valid) {
    const codes = validation.errors.map((entry) => entry.code);
    if (
      codes.includes('MISSING_PRECONDITION') ||
      codes.includes('MISSING_DECLARED_DEPENDENCY') ||
      codes.includes('MISSING_PRIMARY_TARGET_PRECONDITION')
    )
      return rejected('REJECTED_MISSING_PRECONDITION', codes);
    if (
      codes.includes('CONFLICTING_PRECONDITIONS') ||
      codes.includes('DUPLICATE_PRECONDITION')
    )
      return rejected('REJECTED_CONFLICTING_PRECONDITIONS', codes);
    return rejected('INVALID', codes);
  }
  if (!input.authorityEligibility || !input.authorityEligibility.eligible)
    return rejected(
      'REJECTED_AUTHORITY',
      input.authorityEligibility?.reasons ?? ['MISSING_AUTHORITY_ELIGIBILITY'],
    );
  const fingerprint = computeCommandFingerprint(input.command);
  const idempotency = resolveCommandIdempotency({
    command: input.command,
    commandFingerprint: fingerprint,
    priorIdempotencyRecord: input.priorIdempotencyRecord,
    idempotencyPolicy: contract.idempotencyPolicy,
  });
  if (idempotency.disposition === 'REJECTED_IDEMPOTENCY_CONFLICT')
    return rejected('REJECTED_IDEMPOTENCY_CONFLICT', idempotency.reasons);
  if (idempotency.disposition === 'REPLAY_OF_SUCCESSFUL_COMMAND')
    return rejected('REPLAY_OF_SUCCESSFUL_COMMAND', idempotency.reasons);
  if (idempotency.disposition === 'REPLAY_OF_REJECTED_COMMAND')
    return rejected('REPLAY_OF_REJECTED_COMMAND', idempotency.reasons);
  if (idempotency.disposition === 'INVALID')
    return rejected('INVALID', idempotency.reasons);
  const preconditions = evaluateConcurrencyPreconditions({
    command: input.command,
    contract,
    tokenPolicyRegistry: input.tokenPolicyRegistry,
    currentDependencyStates: input.currentDependencyStates,
    disclosureAuthorization: input.disclosureAuthorization,
  });
  if (preconditions.reasons.includes('UNDECLARED_DEPENDENCY'))
    return rejected('REJECTED_MISSING_PRECONDITION', preconditions.reasons);
  if (preconditions.reasons.includes('CONFLICTING_CURRENT_STATE'))
    return rejected(
      'REJECTED_CONFLICTING_PRECONDITIONS',
      preconditions.reasons,
    );
  if (preconditions.stalePreconditions.length > 0)
    return rejected(
      'REJECTED_STALE_PRECONDITION',
      preconditions.reasons,
      preconditions.stalePreconditions,
    );
  if (preconditions.unknownPreconditions.length > 0)
    return rejected(
      'REJECTED_CURRENT_STATE_UNKNOWN',
      preconditions.reasons,
      preconditions.unknownPreconditions,
    );
  return {
    status: 'ELIGIBLE',
    reasons: [],
    mayCreateGovernanceDecision: false,
    mayCreateMutation: false,
    mayUpdateProjection: false,
    eligibleForFutureAtomicApplication: true,
    conflicts: [],
  };
};
