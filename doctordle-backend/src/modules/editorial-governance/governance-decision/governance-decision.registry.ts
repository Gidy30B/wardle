import type {
  GovernanceDecisionExtensionPolicy,
  GovernanceDecisionExtensionRegistry,
} from './governance-decision.types';

export const createGovernanceDecisionExtensionRegistry = (
  policies: readonly GovernanceDecisionExtensionPolicy[],
): GovernanceDecisionExtensionRegistry => ({ policies: [...policies] });

export const findGovernanceDecisionExtensionPolicy = (
  registry: GovernanceDecisionExtensionRegistry,
  extensionType: string,
  extensionSchemaVersion: string,
): GovernanceDecisionExtensionPolicy | undefined =>
  registry.policies.find(
    (policy) =>
      policy.extensionType === extensionType &&
      policy.extensionSchemaVersion === extensionSchemaVersion,
  );

export const hasApprovedProductionExtension = (
  registryDocument: unknown,
): boolean => {
  if (
    typeof registryDocument !== 'object' ||
    registryDocument === null ||
    !('entries' in registryDocument) ||
    !Array.isArray(registryDocument.entries)
  ) {
    return false;
  }

  return registryDocument.entries.some(
    (entry: unknown) =>
      typeof entry === 'object' &&
      entry !== null &&
      'approvalState' in entry &&
      'productionAuthority' in entry &&
      (entry as { approvalState: unknown }).approvalState === 'APPROVED' &&
      (entry as { productionAuthority: unknown }).productionAuthority ===
        'GRANTED',
  );
};
