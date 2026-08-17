import {
  findConcurrencyTokenPolicyDefinition,
  isApprovedTokenPolicy,
} from './governed-command.registry';
import type {
  ConcurrencyTokenPolicyRegistry,
  CurrentDependencyState,
  DisclosureAuthorizationInput,
  GovernedCommand,
  GovernedCommandConcurrencyPrecondition,
  GovernedCommandContractDefinition,
  GovernedCommandTargetReference,
  PreconditionEvaluationResult,
} from './governed-command.types';

const targetKey = (target: GovernedCommandTargetReference): string =>
  `${target.artifactType}|${target.artifactId}|${target.artifactRevisionId ?? ''}|${target.targetScope}`;
const stateKey = (state: CurrentDependencyState): string =>
  `${state.dependencyRole}|${targetKey(state.target)}`;
const preconditionKey = (
  precondition: GovernedCommandConcurrencyPrecondition,
): string => `${precondition.dependencyRole}|${targetKey(precondition.target)}`;

const conflict = (
  precondition: GovernedCommandConcurrencyPrecondition,
  reason: string,
  state: CurrentDependencyState | undefined,
  disclosure: DisclosureAuthorizationInput,
) => ({
  dependencyRole: precondition.dependencyRole,
  reason,
  safeCurrentStateReference: disclosure.canDiscloseCurrentState
    ? state?.safeCurrentStateReference
    : undefined,
});

export const evaluateConcurrencyPreconditions = (input: {
  command: GovernedCommand;
  contract: GovernedCommandContractDefinition;
  tokenPolicyRegistry: ConcurrencyTokenPolicyRegistry;
  currentDependencyStates: CurrentDependencyState[];
  disclosureAuthorization: DisclosureAuthorizationInput;
}): PreconditionEvaluationResult => {
  const validatedPreconditions: GovernedCommandConcurrencyPrecondition[] = [];
  const stalePreconditions: ReturnType<typeof conflict>[] = [];
  const unknownPreconditions: ReturnType<typeof conflict>[] = [];
  const safeCurrentStateReferences: Record<string, unknown>[] = [];
  const reasons: string[] = [];
  const states = new Map<string, CurrentDependencyState>();
  for (const state of input.currentDependencyStates) {
    const key = stateKey(state);
    if (states.has(key)) reasons.push('CONFLICTING_CURRENT_STATE');
    states.set(key, state);
  }
  for (const precondition of input.command.concurrencyPreconditions) {
    const state = states.get(preconditionKey(precondition));
    if (!state) {
      unknownPreconditions.push(
        conflict(
          precondition,
          'CURRENT_STATE_UNKNOWN',
          undefined,
          input.disclosureAuthorization,
        ),
      );
      reasons.push('CURRENT_STATE_UNKNOWN');
      continue;
    }
    if (state.status !== 'KNOWN') {
      unknownPreconditions.push(
        conflict(
          precondition,
          state.status === 'UNAVAILABLE'
            ? 'CURRENT_STATE_UNAVAILABLE'
            : 'CURRENT_STATE_UNKNOWN',
          state,
          input.disclosureAuthorization,
        ),
      );
      reasons.push(
        state.status === 'UNAVAILABLE'
          ? 'CURRENT_STATE_UNAVAILABLE'
          : 'CURRENT_STATE_UNKNOWN',
      );
      continue;
    }
    if (
      input.disclosureAuthorization.canDiscloseCurrentState &&
      state.safeCurrentStateReference
    )
      safeCurrentStateReferences.push(state.safeCurrentStateReference);
    if (precondition.preconditionMode === 'EXACT_REVISION') {
      if (!state.currentRevisionId)
        unknownPreconditions.push(
          conflict(
            precondition,
            'CURRENT_STATE_UNKNOWN',
            state,
            input.disclosureAuthorization,
          ),
        );
      else if (state.currentRevisionId !== precondition.expectedRevisionId)
        stalePreconditions.push(
          conflict(
            precondition,
            'EXPECTED_REVISION_MISMATCH',
            state,
            input.disclosureAuthorization,
          ),
        );
      else validatedPreconditions.push(precondition);
    }
    if (precondition.preconditionMode === 'EXPECTED_VERSION') {
      if (state.currentVersion === undefined)
        unknownPreconditions.push(
          conflict(
            precondition,
            'CURRENT_STATE_UNKNOWN',
            state,
            input.disclosureAuthorization,
          ),
        );
      else if (state.currentVersion !== precondition.expectedVersion)
        stalePreconditions.push(
          conflict(
            precondition,
            'EXPECTED_VERSION_MISMATCH',
            state,
            input.disclosureAuthorization,
          ),
        );
      else validatedPreconditions.push(precondition);
    }
    if (precondition.preconditionMode === 'EXPECTED_TOKEN') {
      const policy = findConcurrencyTokenPolicyDefinition(
        input.tokenPolicyRegistry,
        precondition.tokenPolicyType ?? '',
        precondition.tokenPolicyVersion ?? '',
      );
      if (!isApprovedTokenPolicy(policy)) {
        unknownPreconditions.push(
          conflict(
            precondition,
            'MISSING_OR_UNAPPROVED_TOKEN_POLICY',
            state,
            input.disclosureAuthorization,
          ),
        );
      } else if (
        state.tokenPolicyVersion &&
        state.tokenPolicyVersion !== precondition.tokenPolicyVersion
      ) {
        stalePreconditions.push(
          conflict(
            precondition,
            'TOKEN_POLICY_VERSION_MISMATCH',
            state,
            input.disclosureAuthorization,
          ),
        );
      } else if (!state.currentToken) {
        unknownPreconditions.push(
          conflict(
            precondition,
            'CURRENT_STATE_UNKNOWN',
            state,
            input.disclosureAuthorization,
          ),
        );
      } else if (state.currentToken !== precondition.expectedToken) {
        stalePreconditions.push(
          conflict(
            precondition,
            'EXPECTED_TOKEN_MISMATCH',
            state,
            input.disclosureAuthorization,
          ),
        );
      } else {
        validatedPreconditions.push(precondition);
      }
    }
  }
  for (const role of input.contract.dependencyPolicy.requiredDependencyRoles) {
    if (
      !input.command.concurrencyPreconditions.some(
        (precondition) => precondition.dependencyRole === role,
      )
    )
      reasons.push('MISSING_PRECONDITION');
  }
  if (input.contract.dependencyPolicy.requiresCompleteDependencyCoverage) {
    for (const state of input.currentDependencyStates) {
      if (
        !input.contract.dependencyPolicy.declaredDependencyRoles.includes(
          state.dependencyRole,
        )
      )
        reasons.push('UNDECLARED_DEPENDENCY');
    }
  }
  if (stalePreconditions.length > 0)
    reasons.push('REJECTED_STALE_PRECONDITION');
  if (unknownPreconditions.length > 0)
    reasons.push('REJECTED_CURRENT_STATE_UNKNOWN');
  return {
    validatedPreconditions,
    stalePreconditions,
    unknownPreconditions,
    safeCurrentStateReferences,
    reasons: [...new Set(reasons)],
  };
};
