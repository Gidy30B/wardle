import type {
  ConcurrencyTokenPolicyDefinition,
  ConcurrencyTokenPolicyRegistry,
  GovernedCommandContractDefinition,
  GovernedCommandContractRegistry,
  GovernedCommandValidationError,
} from './governed-command.types';

export const createGovernedCommandContractRegistry = (
  definitions: GovernedCommandContractDefinition[] = [],
): GovernedCommandContractRegistry => ({ definitions: [...definitions] });

export const createConcurrencyTokenPolicyRegistry = (
  definitions: ConcurrencyTokenPolicyDefinition[] = [],
): ConcurrencyTokenPolicyRegistry => ({ definitions: [...definitions] });

export const findGovernedCommandContractDefinition = (
  registry: GovernedCommandContractRegistry,
  commandType: string,
  commandContractVersion: string,
): GovernedCommandContractDefinition | undefined =>
  registry.definitions.find(
    (definition) =>
      definition.commandType === commandType &&
      definition.commandContractVersion === commandContractVersion,
  );

export const findConcurrencyTokenPolicyDefinition = (
  registry: ConcurrencyTokenPolicyRegistry,
  tokenPolicyType: string,
  tokenPolicyVersion: string,
): ConcurrencyTokenPolicyDefinition | undefined =>
  registry.definitions.find(
    (definition) =>
      definition.tokenPolicyType === tokenPolicyType &&
      definition.tokenPolicyVersion === tokenPolicyVersion,
  );

export const registerGovernedCommandContractDefinition = (
  registry: GovernedCommandContractRegistry,
  definition: GovernedCommandContractDefinition,
): {
  registry: GovernedCommandContractRegistry;
  errors: GovernedCommandValidationError[];
} => {
  if (
    findGovernedCommandContractDefinition(
      registry,
      definition.commandType,
      definition.commandContractVersion,
    )
  ) {
    return {
      registry,
      errors: [
        {
          code: 'DUPLICATE_COMMAND_CONTRACT',
          path: 'commandType',
          message:
            'Command contract definitions are unique by type and version.',
        },
      ],
    };
  }
  return {
    registry: { definitions: [...registry.definitions, definition] },
    errors: [],
  };
};

export const registerConcurrencyTokenPolicyDefinition = (
  registry: ConcurrencyTokenPolicyRegistry,
  definition: ConcurrencyTokenPolicyDefinition,
): {
  registry: ConcurrencyTokenPolicyRegistry;
  errors: GovernedCommandValidationError[];
} => {
  if (
    findConcurrencyTokenPolicyDefinition(
      registry,
      definition.tokenPolicyType,
      definition.tokenPolicyVersion,
    )
  ) {
    return {
      registry,
      errors: [
        {
          code: 'DUPLICATE_TOKEN_POLICY',
          path: 'tokenPolicyType',
          message: 'Token policy definitions are unique by type and version.',
        },
      ],
    };
  }
  return {
    registry: { definitions: [...registry.definitions, definition] },
    errors: [],
  };
};

export const isApprovedCommandContract = (
  definition: GovernedCommandContractDefinition | undefined,
): definition is GovernedCommandContractDefinition =>
  definition?.status === 'APPROVED';

export const isApprovedTokenPolicy = (
  definition: ConcurrencyTokenPolicyDefinition | undefined,
): definition is ConcurrencyTokenPolicyDefinition =>
  definition?.status === 'APPROVED';
