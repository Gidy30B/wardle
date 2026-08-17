import type {
  CompatibilityProjectionDefinition,
  ProjectionDriftResult,
  ProjectionDriftStatus,
  ProjectionStateSnapshot,
} from './compatibility-projection.types';

const stable = (value: unknown): string => JSON.stringify(value);

const result = (
  status: ProjectionDriftStatus,
  definition: CompatibilityProjectionDefinition,
  canonicalSnapshot: ProjectionStateSnapshot | undefined,
  projectedSnapshot: ProjectionStateSnapshot | undefined,
  evaluatedAt: string,
  disclosureAuthorization?: { canDiscloseProjectionReferences?: boolean },
  reasons: string[] = [status],
): ProjectionDriftResult => ({
  driftStatus: status,
  projectionId: definition.projectionId,
  canonicalSnapshotReference: canonicalSnapshot?.recordReference,
  projectedSnapshotReference: projectedSnapshot?.recordReference,
  evaluatedAt,
  safeCanonicalReference:
    disclosureAuthorization?.canDiscloseProjectionReferences
      ? canonicalSnapshot?.recordReference
      : undefined,
  safeProjectedReference:
    disclosureAuthorization?.canDiscloseProjectionReferences
      ? projectedSnapshot?.recordReference
      : undefined,
  reasons,
  repairEvaluated: false,
  repairPerformed: false,
});

export const evaluateProjectionDrift = (input: {
  definition: CompatibilityProjectionDefinition;
  canonicalSnapshot?: ProjectionStateSnapshot;
  projectedSnapshot?: ProjectionStateSnapshot;
  evaluatedAt: string;
  disclosureAuthorization?: { canDiscloseProjectionReferences?: boolean };
}): ProjectionDriftResult => {
  const { definition, canonicalSnapshot, projectedSnapshot, evaluatedAt } =
    input;
  if (definition.ownershipStatus === 'UNRESOLVED_OWNER')
    return result(
      'OWNER_UNRESOLVED',
      definition,
      canonicalSnapshot,
      projectedSnapshot,
      evaluatedAt,
      input.disclosureAuthorization,
    );
  if (!canonicalSnapshot || canonicalSnapshot.stateStatus === 'UNKNOWN')
    return result(
      'CANONICAL_STATE_UNKNOWN',
      definition,
      canonicalSnapshot,
      projectedSnapshot,
      evaluatedAt,
      input.disclosureAuthorization,
    );
  if (canonicalSnapshot.stateStatus === 'MISSING')
    return result(
      'CANONICAL_EFFECT_MISSING',
      definition,
      canonicalSnapshot,
      projectedSnapshot,
      evaluatedAt,
      input.disclosureAuthorization,
    );
  if (!projectedSnapshot || projectedSnapshot.stateStatus === 'UNKNOWN')
    return result(
      'PROJECTION_STATE_UNKNOWN',
      definition,
      canonicalSnapshot,
      projectedSnapshot,
      evaluatedAt,
      input.disclosureAuthorization,
    );
  if (projectedSnapshot.stateStatus === 'MISSING')
    return result(
      'PROJECTION_MISSING',
      definition,
      canonicalSnapshot,
      projectedSnapshot,
      evaluatedAt,
      input.disclosureAuthorization,
    );
  if (
    canonicalSnapshot.stateStatus !== 'KNOWN' ||
    projectedSnapshot.stateStatus !== 'KNOWN'
  )
    return result(
      'NOT_EVALUABLE',
      definition,
      canonicalSnapshot,
      projectedSnapshot,
      evaluatedAt,
      input.disclosureAuthorization,
    );
  if (
    definition.synchronizationStrategy === 'ASYNCHRONOUS_BOUNDED_DRIFT' &&
    typeof definition.driftPolicy?.maximumDriftDurationMs === 'number' &&
    projectedSnapshot.projectionUpdatedAt &&
    Date.parse(evaluatedAt) -
      Date.parse(projectedSnapshot.projectionUpdatedAt) >
      definition.driftPolicy.maximumDriftDurationMs
  )
    return result(
      'DRIFTED',
      definition,
      canonicalSnapshot,
      projectedSnapshot,
      evaluatedAt,
      input.disclosureAuthorization,
      ['DRIFT_WINDOW_EXCEEDED'],
    );
  return result(
    stable(canonicalSnapshot.stateValue) ===
      stable(projectedSnapshot.stateValue)
      ? 'IN_SYNC'
      : 'DRIFTED',
    definition,
    canonicalSnapshot,
    projectedSnapshot,
    evaluatedAt,
    input.disclosureAuthorization,
  );
};
