import type {
  CompatibilityProjectionDefinition,
  ProjectionDeprecationValidationResult,
  ProjectionInventory,
} from './compatibility-projection.types';

export const validateProjectionDeprecation = (input: {
  definition: CompatibilityProjectionDefinition;
  inventory: ProjectionInventory;
  consumerRemovalEvidence?: string[];
}): ProjectionDeprecationValidationResult => {
  if (
    input.definition.synchronizationStrategy !== 'DEPRECATED' ||
    !input.definition.deprecationCriteria
  )
    return {
      status: 'NOT_READY_MISSING_CRITERIA',
      fieldRemoved: false,
      reasons: ['DEPRECATION_CRITERIA_REQUIRED'],
    };
  const entry = input.inventory.entries.find(
    (candidate) => candidate.projectionId === input.definition.projectionId,
  );
  if (!entry || entry.inventoryCompleteness !== 'COMPLETE')
    return {
      status: 'NOT_READY_INCOMPLETE_INVENTORY',
      fieldRemoved: false,
      reasons: ['INCOMPLETE_INVENTORY'],
    };
  if (entry.knownReadConsumers.length > 0)
    return {
      status: 'NOT_READY_ACTIVE_CONSUMERS',
      fieldRemoved: false,
      reasons: ['ACTIVE_CONSUMERS'],
    };
  if (!input.consumerRemovalEvidence?.length)
    return {
      status: 'NOT_READY_MISSING_EVIDENCE',
      fieldRemoved: false,
      reasons: ['MISSING_CONSUMER_REMOVAL_EVIDENCE'],
    };
  return {
    status: 'READY_FOR_FUTURE_DEPRECATION',
    fieldRemoved: false,
    reasons: [],
  };
};
