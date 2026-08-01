import {
  BATCH_POLICIES,
  COMMAND_CONTRACT_STATUSES,
  CURRENT_STATE_STATUSES,
  IDEMPOTENCY_POLICIES,
  PRECONDITION_MODES,
  PRIOR_RESULT_STATUSES,
} from './governed-command.constants';
import {
  findConcurrencyTokenPolicyDefinition,
  findGovernedCommandContractDefinition,
  isApprovedCommandContract,
  isApprovedTokenPolicy,
} from './governed-command.registry';
import type {
  ConcurrencyTokenPolicyDefinition,
  ConcurrencyTokenPolicyRegistry,
  CurrentDependencyState,
  GovernedCommand,
  GovernedCommandConcurrencyPrecondition,
  GovernedCommandContractDefinition,
  GovernedCommandContractRegistry,
  GovernedCommandTargetReference,
  GovernedCommandValidationError,
  GovernedCommandValidationResult,
  IdempotencyRecord,
} from './governed-command.types';

const error = (
  code: string,
  path: string,
  message: string,
): GovernedCommandValidationError => ({ code, path, message });
const ok = (
  errors: GovernedCommandValidationError[],
): GovernedCommandValidationResult => ({ valid: errors.length === 0, errors });
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const stringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(nonEmpty);
const iso = (value: unknown): value is string =>
  nonEmpty(value) &&
  /^\d{4}-\d{2}-\d{2}T/.test(value) &&
  !Number.isNaN(Date.parse(value));
const hasEnum = <T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] => nonEmpty(value) && values.includes(value);

const targetKey = (target: GovernedCommandTargetReference): string =>
  `${target.artifactType}|${target.artifactId}|${target.artifactRevisionId ?? ''}|${target.targetScope}`;
const preconditionKey = (
  precondition: GovernedCommandConcurrencyPrecondition,
): string => `${precondition.dependencyRole}|${targetKey(precondition.target)}`;

const validateTarget = (
  target: unknown,
  path: string,
  errors: GovernedCommandValidationError[],
): target is GovernedCommandTargetReference => {
  if (!isRecord(target)) {
    errors.push(error('INVALID_TARGET', path, 'Target reference is required.'));
    return false;
  }
  for (const key of ['artifactType', 'artifactId', 'targetScope']) {
    if (!nonEmpty(target[key]))
      errors.push(
        error('REQUIRED_FIELD', `${path}.${key}`, `${key} is required.`),
      );
  }
  return true;
};

const countExpectedValues = (
  precondition: GovernedCommandConcurrencyPrecondition,
): number =>
  [
    precondition.expectedRevisionId,
    precondition.expectedVersion,
    precondition.expectedToken,
  ].filter((value) => value !== undefined && value !== null && value !== '')
    .length;

export const validateGovernedCommandContractDefinition = (
  input: unknown,
): GovernedCommandValidationResult => {
  const errors: GovernedCommandValidationError[] = [];
  if (!isRecord(input))
    return ok([
      error(
        'INVALID_OBJECT',
        '',
        'Command contract definition must be an object.',
      ),
    ]);
  const definition = input as Partial<GovernedCommandContractDefinition>;
  if (!nonEmpty(definition.commandType))
    errors.push(
      error('REQUIRED_FIELD', 'commandType', 'commandType is required.'),
    );
  if (!nonEmpty(definition.commandContractVersion))
    errors.push(
      error(
        'REQUIRED_FIELD',
        'commandContractVersion',
        'commandContractVersion is required.',
      ),
    );
  if (!hasEnum(COMMAND_CONTRACT_STATUSES, definition.status))
    errors.push(error('INVALID_STATUS', 'status', 'Unknown contract status.'));
  if (!isRecord(definition.targetPolicy))
    errors.push(
      error(
        'INVALID_TARGET_POLICY',
        'targetPolicy',
        'targetPolicy is required.',
      ),
    );
  else {
    if (
      !stringArray(definition.targetPolicy.allowedArtifactTypes) ||
      definition.targetPolicy.allowedArtifactTypes.length === 0
    )
      errors.push(
        error(
          'INVALID_ALLOWED_ARTIFACT_TYPES',
          'targetPolicy.allowedArtifactTypes',
          'Allowed artifact types are required.',
        ),
      );
    if (!hasEnum(PRECONDITION_MODES, definition.targetPolicy.primaryTargetMode))
      errors.push(
        error(
          'INVALID_PRIMARY_TARGET_MODE',
          'targetPolicy.primaryTargetMode',
          'Primary target mode is invalid.',
        ),
      );
    if (!stringArray(definition.targetPolicy.revisionedArtifactTypes))
      errors.push(
        error(
          'INVALID_REVISIONED_ARTIFACT_TYPES',
          'targetPolicy.revisionedArtifactTypes',
          'Revisioned artifact types must be strings.',
        ),
      );
  }
  if (!isRecord(definition.dependencyPolicy))
    errors.push(
      error(
        'INVALID_DEPENDENCY_POLICY',
        'dependencyPolicy',
        'dependencyPolicy is required.',
      ),
    );
  else {
    for (const key of [
      'declaredDependencyRoles',
      'requiredDependencyRoles',
      'permittedTokenPolicies',
    ]) {
      if (
        !stringArray(
          definition.dependencyPolicy[
            key as keyof typeof definition.dependencyPolicy
          ],
        )
      )
        errors.push(
          error(
            'INVALID_STRING_ARRAY',
            `dependencyPolicy.${key}`,
            `${key} must be strings.`,
          ),
        );
    }
    if (
      !Array.isArray(definition.dependencyPolicy.permittedPreconditionModes) ||
      !definition.dependencyPolicy.permittedPreconditionModes.every((mode) =>
        PRECONDITION_MODES.includes(mode),
      )
    )
      errors.push(
        error(
          'INVALID_PRECONDITION_MODES',
          'dependencyPolicy.permittedPreconditionModes',
          'Permitted modes are invalid.',
        ),
      );
    if (
      typeof definition.dependencyPolicy.requiresCompleteDependencyCoverage !==
      'boolean'
    )
      errors.push(
        error(
          'INVALID_COMPLETE_COVERAGE',
          'dependencyPolicy.requiresCompleteDependencyCoverage',
          'Complete coverage flag is required.',
        ),
      );
  }
  if (!hasEnum(IDEMPOTENCY_POLICIES, definition.idempotencyPolicy))
    errors.push(
      error(
        'INVALID_IDEMPOTENCY_POLICY',
        'idempotencyPolicy',
        'Invalid idempotency policy.',
      ),
    );
  if (!hasEnum(BATCH_POLICIES, definition.batchPolicy))
    errors.push(
      error('INVALID_BATCH_POLICY', 'batchPolicy', 'Invalid batch policy.'),
    );
  if (!isRecord(definition.staleResultPolicy))
    errors.push(
      error(
        'INVALID_STALE_RESULT_POLICY',
        'staleResultPolicy',
        'staleResultPolicy is required.',
      ),
    );
  return ok(errors);
};

export const validateConcurrencyTokenPolicyDefinition = (
  input: unknown,
): GovernedCommandValidationResult => {
  const errors: GovernedCommandValidationError[] = [];
  if (!isRecord(input))
    return ok([
      error('INVALID_OBJECT', '', 'Token policy definition must be an object.'),
    ]);
  const definition = input as Partial<ConcurrencyTokenPolicyDefinition>;
  if (!nonEmpty(definition.tokenPolicyType))
    errors.push(
      error(
        'REQUIRED_FIELD',
        'tokenPolicyType',
        'tokenPolicyType is required.',
      ),
    );
  if (!nonEmpty(definition.tokenPolicyVersion))
    errors.push(
      error(
        'REQUIRED_FIELD',
        'tokenPolicyVersion',
        'tokenPolicyVersion is required.',
      ),
    );
  if (!hasEnum(COMMAND_CONTRACT_STATUSES, definition.status))
    errors.push(
      error('INVALID_STATUS', 'status', 'Unknown token policy status.'),
    );
  if (
    !stringArray(definition.coveredDependencyRoles) ||
    definition.coveredDependencyRoles.length === 0
  )
    errors.push(
      error(
        'INVALID_COVERED_ROLES',
        'coveredDependencyRoles',
        'Covered roles are required.',
      ),
    );
  if (
    !stringArray(definition.coveredArtifactTypes) ||
    definition.coveredArtifactTypes.length === 0
  )
    errors.push(
      error(
        'INVALID_COVERED_ARTIFACTS',
        'coveredArtifactTypes',
        'Covered artifact types are required.',
      ),
    );
  if (!nonEmpty(definition.tokenSemantics))
    errors.push(
      error('REQUIRED_FIELD', 'tokenSemantics', 'tokenSemantics is required.'),
    );
  if (typeof definition.requiresCompleteDependencyCoverage !== 'boolean')
    errors.push(
      error(
        'INVALID_COMPLETE_COVERAGE',
        'requiresCompleteDependencyCoverage',
        'Complete coverage flag is required.',
      ),
    );
  return ok(errors);
};

export const validateGovernedCommandContractRegistry = (
  registry: GovernedCommandContractRegistry,
): GovernedCommandValidationResult => {
  const errors: GovernedCommandValidationError[] = [];
  const seen = new Set<string>();
  registry.definitions.forEach((definition, index) => {
    errors.push(
      ...validateGovernedCommandContractDefinition(definition).errors.map(
        (entry) => ({ ...entry, path: `definitions.${index}.${entry.path}` }),
      ),
    );
    const key = `${definition.commandType}:${definition.commandContractVersion}`;
    if (seen.has(key))
      errors.push(
        error(
          'DUPLICATE_COMMAND_CONTRACT',
          `definitions.${index}`,
          'Duplicate command contract.',
        ),
      );
    seen.add(key);
  });
  return ok(errors);
};

export const validateConcurrencyTokenPolicyRegistry = (
  registry: ConcurrencyTokenPolicyRegistry,
): GovernedCommandValidationResult => {
  const errors: GovernedCommandValidationError[] = [];
  const seen = new Set<string>();
  registry.definitions.forEach((definition, index) => {
    errors.push(
      ...validateConcurrencyTokenPolicyDefinition(definition).errors.map(
        (entry) => ({ ...entry, path: `definitions.${index}.${entry.path}` }),
      ),
    );
    const key = `${definition.tokenPolicyType}:${definition.tokenPolicyVersion}`;
    if (seen.has(key))
      errors.push(
        error(
          'DUPLICATE_TOKEN_POLICY',
          `definitions.${index}`,
          'Duplicate token policy.',
        ),
      );
    seen.add(key);
  });
  return ok(errors);
};

export const validateCurrentDependencyState = (
  input: unknown,
): GovernedCommandValidationResult => {
  const errors: GovernedCommandValidationError[] = [];
  if (!isRecord(input))
    return ok([
      error(
        'INVALID_OBJECT',
        '',
        'Current dependency state must be an object.',
      ),
    ]);
  const state = input as Partial<CurrentDependencyState>;
  validateTarget(state.target, 'target', errors);
  if (!nonEmpty(state.dependencyRole))
    errors.push(
      error('REQUIRED_FIELD', 'dependencyRole', 'dependencyRole is required.'),
    );
  if (!hasEnum(CURRENT_STATE_STATUSES, state.status))
    errors.push(
      error('INVALID_CURRENT_STATE_STATUS', 'status', 'Invalid state status.'),
    );
  return ok(errors);
};

export const validateIdempotencyRecord = (
  input: unknown,
): GovernedCommandValidationResult => {
  const errors: GovernedCommandValidationError[] = [];
  if (!isRecord(input))
    return ok([
      error('INVALID_OBJECT', '', 'Idempotency record must be an object.'),
    ]);
  const record = input as Partial<IdempotencyRecord>;
  for (const key of [
    'idempotencyKey',
    'commandFingerprint',
    'commandId',
    'commandType',
    'resultReference',
  ]) {
    if (!nonEmpty(record[key as keyof IdempotencyRecord]))
      errors.push(error('REQUIRED_FIELD', key, `${key} is required.`));
  }
  if (!hasEnum(PRIOR_RESULT_STATUSES, record.resultStatus))
    errors.push(
      error('INVALID_RESULT_STATUS', 'resultStatus', 'Invalid result status.'),
    );
  if (!iso(record.recordedAt))
    errors.push(
      error(
        'INVALID_TIMESTAMP',
        'recordedAt',
        'recordedAt must be ISO date-time.',
      ),
    );
  return ok(errors);
};

export const validateGovernedCommand = (
  input: unknown,
  contractRegistry: GovernedCommandContractRegistry,
  tokenPolicyRegistry: ConcurrencyTokenPolicyRegistry,
): GovernedCommandValidationResult => {
  const errors: GovernedCommandValidationError[] = [];
  if (!isRecord(input))
    return ok([
      error('INVALID_OBJECT', '', 'Governed command must be an object.'),
    ]);
  const command = input as Partial<GovernedCommand>;
  for (const key of [
    'commandId',
    'commandType',
    'commandContractVersion',
    'payloadHash',
    'submittedAt',
    'correlationId',
    'causationId',
  ]) {
    if (!nonEmpty(command[key as keyof GovernedCommand]))
      errors.push(error('REQUIRED_FIELD', key, `${key} is required.`));
  }
  if (!iso(command.submittedAt))
    errors.push(
      error(
        'INVALID_TIMESTAMP',
        'submittedAt',
        'submittedAt must be ISO date-time.',
      ),
    );
  if (!isRecord(command.actorContext))
    errors.push(
      error(
        'MISSING_ACTOR_CONTEXT',
        'actorContext',
        'Actor context is structurally required.',
      ),
    );
  if (!isRecord(command.authorityResolutionReference))
    errors.push(
      error(
        'MISSING_AUTHORITY_REFERENCE',
        'authorityResolutionReference',
        'Authority reference is structurally required but is not proof of authority.',
      ),
    );
  validateTarget(command.primaryTarget, 'primaryTarget', errors);
  if (
    !Array.isArray(command.concurrencyPreconditions) ||
    command.concurrencyPreconditions.length === 0
  )
    errors.push(
      error(
        'MISSING_PRECONDITION',
        'concurrencyPreconditions',
        'At least one concurrency precondition is required.',
      ),
    );
  if (!isRecord(command.requestedEffect))
    errors.push(
      error(
        'MISSING_REQUESTED_EFFECT',
        'requestedEffect',
        'Requested effect is required.',
      ),
    );
  const contract = findGovernedCommandContractDefinition(
    contractRegistry,
    command.commandType ?? '',
    command.commandContractVersion ?? '',
  );
  if (!contract)
    errors.push(
      error(
        'MISSING_COMMAND_CONTRACT',
        'commandType',
        'Command contract is not registered.',
      ),
    );
  else if (!isApprovedCommandContract(contract))
    errors.push(
      error(
        'UNAPPROVED_COMMAND_CONTRACT',
        'commandType',
        'Only approved command contracts can establish eligibility.',
      ),
    );
  else if (command.primaryTarget) {
    if (
      !contract.targetPolicy.allowedArtifactTypes.includes(
        command.primaryTarget.artifactType,
      )
    )
      errors.push(
        error(
          'ARTIFACT_TYPE_NOT_ALLOWED',
          'primaryTarget.artifactType',
          'Primary target artifact type is not allowed.',
        ),
      );
    if (
      contract.idempotencyPolicy === 'REQUIRED' &&
      !nonEmpty(command.idempotencyKey)
    )
      errors.push(
        error(
          'IDEMPOTENCY_KEY_REQUIRED',
          'idempotencyKey',
          'Idempotency key is required.',
        ),
      );
    if (
      contract.idempotencyPolicy === 'PROHIBITED' &&
      nonEmpty(command.idempotencyKey)
    )
      errors.push(
        error(
          'IDEMPOTENCY_KEY_PROHIBITED',
          'idempotencyKey',
          'Idempotency key is prohibited.',
        ),
      );
  }
  const seen = new Map<string, GovernedCommandConcurrencyPrecondition>();
  for (const [index, precondition] of (
    command.concurrencyPreconditions ?? []
  ).entries()) {
    validateTarget(
      precondition.target,
      `concurrencyPreconditions.${index}.target`,
      errors,
    );
    if (!hasEnum(PRECONDITION_MODES, precondition.preconditionMode))
      errors.push(
        error(
          'INVALID_PRECONDITION_MODE',
          `concurrencyPreconditions.${index}.preconditionMode`,
          'Invalid precondition mode.',
        ),
      );
    if (!nonEmpty(precondition.dependencyRole))
      errors.push(
        error(
          'REQUIRED_FIELD',
          `concurrencyPreconditions.${index}.dependencyRole`,
          'dependencyRole is required.',
        ),
      );
    if (countExpectedValues(precondition) !== 1)
      errors.push(
        error(
          'EXPECTED_VALUE_CARDINALITY',
          `concurrencyPreconditions.${index}`,
          'Exactly one expected value is required.',
        ),
      );
    const key = preconditionKey(precondition);
    const prior = seen.get(key);
    if (prior) {
      if (JSON.stringify(prior) === JSON.stringify(precondition))
        errors.push(
          error(
            'DUPLICATE_PRECONDITION',
            `concurrencyPreconditions.${index}`,
            'Duplicate precondition.',
          ),
        );
      else
        errors.push(
          error(
            'CONFLICTING_PRECONDITIONS',
            `concurrencyPreconditions.${index}`,
            'Conflicting precondition.',
          ),
        );
    }
    seen.set(key, precondition);
    if (contract) {
      if (
        !contract.dependencyPolicy.permittedPreconditionModes.includes(
          precondition.preconditionMode,
        )
      )
        errors.push(
          error(
            'PRECONDITION_MODE_NOT_PERMITTED',
            `concurrencyPreconditions.${index}.preconditionMode`,
            'Mode not permitted by contract.',
          ),
        );
      if (
        !contract.dependencyPolicy.declaredDependencyRoles.includes(
          precondition.dependencyRole,
        )
      )
        errors.push(
          error(
            'UNDECLARED_DEPENDENCY',
            `concurrencyPreconditions.${index}.dependencyRole`,
            'Dependency role is not declared by contract.',
          ),
        );
      if (
        contract.targetPolicy.revisionedArtifactTypes.includes(
          precondition.target.artifactType,
        ) &&
        precondition.preconditionMode !== 'EXACT_REVISION'
      )
        errors.push(
          error(
            'EXACT_REVISION_REQUIRED',
            `concurrencyPreconditions.${index}.preconditionMode`,
            'Revisioned content requires exact revision.',
          ),
        );
      if (precondition.preconditionMode === 'EXPECTED_TOKEN') {
        if (
          !nonEmpty(precondition.tokenPolicyType) ||
          !nonEmpty(precondition.tokenPolicyVersion)
        )
          errors.push(
            error(
              'TOKEN_POLICY_REQUIRED',
              `concurrencyPreconditions.${index}`,
              'Token preconditions require token policy type and version.',
            ),
          );
        const tokenPolicy = findConcurrencyTokenPolicyDefinition(
          tokenPolicyRegistry,
          precondition.tokenPolicyType ?? '',
          precondition.tokenPolicyVersion ?? '',
        );
        if (!tokenPolicy)
          errors.push(
            error(
              'MISSING_TOKEN_POLICY',
              `concurrencyPreconditions.${index}.tokenPolicyType`,
              'Token policy is not registered.',
            ),
          );
        else if (!isApprovedTokenPolicy(tokenPolicy))
          errors.push(
            error(
              'UNAPPROVED_TOKEN_POLICY',
              `concurrencyPreconditions.${index}.tokenPolicyType`,
              'Token policy is not approved.',
            ),
          );
        else {
          if (
            !contract.dependencyPolicy.permittedTokenPolicies.includes(
              tokenPolicy.tokenPolicyType,
            )
          )
            errors.push(
              error(
                'TOKEN_POLICY_NOT_PERMITTED',
                `concurrencyPreconditions.${index}.tokenPolicyType`,
                'Token policy not permitted by command contract.',
              ),
            );
          if (
            !tokenPolicy.coveredDependencyRoles.includes(
              precondition.dependencyRole,
            ) ||
            !tokenPolicy.coveredArtifactTypes.includes(
              precondition.target.artifactType,
            )
          )
            errors.push(
              error(
                'TOKEN_POLICY_COVERAGE_MISMATCH',
                `concurrencyPreconditions.${index}`,
                'Token policy does not cover this dependency.',
              ),
            );
        }
      }
    }
  }
  if (contract) {
    for (const role of contract.dependencyPolicy.requiredDependencyRoles) {
      if (![...seen.keys()].some((key) => key.startsWith(`${role}|`)))
        errors.push(
          error(
            'MISSING_DECLARED_DEPENDENCY',
            'concurrencyPreconditions',
            `Missing required dependency ${role}.`,
          ),
        );
    }
    if (
      contract.targetPolicy.primaryTargetPreconditionRequired &&
      command.primaryTarget
    ) {
      const hasPrimary = (command.concurrencyPreconditions ?? []).some(
        (precondition) =>
          targetKey(precondition.target) ===
          targetKey(command.primaryTarget as GovernedCommandTargetReference),
      );
      if (!hasPrimary)
        errors.push(
          error(
            'MISSING_PRIMARY_TARGET_PRECONDITION',
            'concurrencyPreconditions',
            'Primary target precondition is required.',
          ),
        );
    }
  }
  return ok(errors);
};

export const validateGovernedCommandSet = (
  commands: GovernedCommand[],
  contractRegistry: GovernedCommandContractRegistry,
  tokenPolicyRegistry: ConcurrencyTokenPolicyRegistry,
): GovernedCommandValidationResult => {
  const errors: GovernedCommandValidationError[] = [];
  const seen = new Set<string>();
  commands.forEach((command, index) => {
    errors.push(
      ...validateGovernedCommand(
        command,
        contractRegistry,
        tokenPolicyRegistry,
      ).errors.map((entry) => ({ ...entry, path: `${index}.${entry.path}` })),
    );
    if (seen.has(command.commandId))
      errors.push(
        error(
          'DUPLICATE_COMMAND_ID',
          `${index}.commandId`,
          'Command IDs must be unique.',
        ),
      );
    seen.add(command.commandId);
  });
  return ok(errors);
};
