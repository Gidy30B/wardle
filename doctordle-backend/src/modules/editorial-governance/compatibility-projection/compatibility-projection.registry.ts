import type {
  CompatibilityProjectionDefinition,
  CompatibilityProjectionRegistry,
  ProjectionValidationResult,
} from './compatibility-projection.types';
import {
  projectionError,
  projectionResult,
  validateCompatibilityProjectionRegistry,
} from './compatibility-projection.validation';

export const createCompatibilityProjectionRegistry = (
  definitions: CompatibilityProjectionDefinition[] = [],
): CompatibilityProjectionRegistry => ({
  registryId: 'WEOS-COMPATIBILITY-PROJECTION-REGISTRY',
  registrySchemaVersion: '1.0.0',
  status: 'STAGE_1_CONTRACT_ONLY',
  definitions: [...definitions],
  createdAt: '2026-08-02T00:00:00Z',
  recordedAt: '2026-08-02T00:00:00Z',
});

export const findCompatibilityProjectionDefinition = (
  registry: CompatibilityProjectionRegistry,
  projectionId: string,
  projectionSchemaVersion: string,
): CompatibilityProjectionDefinition | undefined =>
  registry.definitions.find(
    (definition) =>
      definition.projectionId === projectionId &&
      definition.projectionSchemaVersion === projectionSchemaVersion,
  );

export const requireApprovedProjectionDefinition = (
  registry: CompatibilityProjectionRegistry,
  projectionId: string,
  projectionSchemaVersion: string,
): { definition?: CompatibilityProjectionDefinition; errors: string[] } => {
  const definition = findCompatibilityProjectionDefinition(
    registry,
    projectionId,
    projectionSchemaVersion,
  );
  if (!definition) return { errors: ['MISSING_PROJECTION_DEFINITION'] };
  if (definition.status !== 'APPROVED')
    return { definition, errors: ['UNAPPROVED_PROJECTION_DEFINITION'] };
  return { definition, errors: [] };
};

export const registerCompatibilityProjectionDefinition = (
  registry: CompatibilityProjectionRegistry,
  definition: CompatibilityProjectionDefinition,
): {
  registry: CompatibilityProjectionRegistry;
  result: ProjectionValidationResult;
} => {
  const next = {
    ...registry,
    definitions: [...registry.definitions, definition],
  };
  const result = validateCompatibilityProjectionRegistry(next);
  if (!result.valid) return { registry, result };
  return { registry: next, result: projectionResult([]) };
};

export const rejectRegistryMembershipAsApproval =
  (): ProjectionValidationResult =>
    projectionResult([
      projectionError(
        'REGISTRY_MEMBERSHIP_IS_NOT_APPROVAL',
        'definitions',
        'Registry membership alone does not approve projection ownership.',
      ),
    ]);
