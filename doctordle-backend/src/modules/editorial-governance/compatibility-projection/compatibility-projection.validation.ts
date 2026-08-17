import {
  INVENTORY_COMPLETENESS,
  LEGACY_PROVENANCE_STATUSES,
  OWNERSHIP_STATUSES,
  PROJECTION_DEFINITION_STATUSES,
  PROJECTION_SENSITIVITIES,
  REPAIR_MODES,
  SYNCHRONIZATION_STRATEGIES,
  WRITER_POLICIES,
} from './compatibility-projection.constants';
import type {
  CompatibilityProjectionDefinition,
  CompatibilityProjectionRegistry,
  LegacyProjectionObservation,
  ProjectionInventory,
  ProjectionInventoryEntry,
  ProjectionValidationError,
  ProjectionValidationResult,
} from './compatibility-projection.types';

export const projectionError = (
  code: string,
  path: string,
  message: string,
): ProjectionValidationError => ({ code, path, message });

export const projectionResult = (
  errors: ProjectionValidationError[],
): ProjectionValidationResult => ({ valid: errors.length === 0, errors });

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export const stringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(nonEmpty);

export const iso = (value: unknown): value is string =>
  nonEmpty(value) &&
  /^\d{4}-\d{2}-\d{2}T/.test(value) &&
  !Number.isNaN(Date.parse(value));

export const hasEnum = <T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] => nonEmpty(value) && values.includes(value);

const ownerComplete = (owner: unknown): boolean =>
  isRecord(owner) &&
  [
    'canonicalOwnerType',
    'canonicalOwnerReference',
    'canonicalOwnerDecisionType',
    'canonicalOwnerSchemaVersion',
    'supportingApprovalRecordId',
  ].every((key) => nonEmpty(owner[key]));

const hasCompleteDriftPolicy = (
  definition: Partial<CompatibilityProjectionDefinition>,
): boolean => {
  const policy = definition.driftPolicy;
  return Boolean(
    policy &&
    (nonEmpty(policy.maximumDriftDuration) ||
      typeof policy.maximumDriftDurationMs === 'number') &&
    nonEmpty(policy.freshnessReferenceType) &&
    nonEmpty(policy.freshnessReferenceValue) &&
    nonEmpty(policy.replayPolicy) &&
    nonEmpty(policy.consumerTolerance) &&
    nonEmpty(policy.escalationPolicy) &&
    nonEmpty(policy.asynchronousExceptionApprovalRecordId),
  );
};

export const validateCompatibilityProjectionDefinition = (
  input: unknown,
): ProjectionValidationResult => {
  const errors: ProjectionValidationError[] = [];
  if (!isRecord(input))
    return projectionResult([
      projectionError(
        'INVALID_OBJECT',
        '',
        'Compatibility projection definition must be an object.',
      ),
    ]);
  const definition = input as Partial<CompatibilityProjectionDefinition>;
  for (const key of [
    'projectionId',
    'projectionSchemaVersion',
    'artifactType',
    'fieldPath',
    'projectionMeaning',
    'rationale',
    'createdAt',
    'recordedAt',
  ]) {
    if (!nonEmpty(definition[key as keyof CompatibilityProjectionDefinition]))
      errors.push(
        projectionError('REQUIRED_FIELD', key, `${key} is required.`),
      );
  }
  if (!hasEnum(PROJECTION_DEFINITION_STATUSES, definition.status))
    errors.push(projectionError('INVALID_STATUS', 'status', 'Invalid status.'));
  if (!hasEnum(PROJECTION_SENSITIVITIES, definition.projectionSensitivity))
    errors.push(
      projectionError(
        'INVALID_SENSITIVITY',
        'projectionSensitivity',
        'Invalid projection sensitivity.',
      ),
    );
  if (!hasEnum(OWNERSHIP_STATUSES, definition.ownershipStatus))
    errors.push(
      projectionError(
        'INVALID_OWNERSHIP_STATUS',
        'ownershipStatus',
        'Invalid ownership status.',
      ),
    );
  if (!hasEnum(SYNCHRONIZATION_STRATEGIES, definition.synchronizationStrategy))
    errors.push(
      projectionError(
        'INVALID_SYNCHRONIZATION_STRATEGY',
        'synchronizationStrategy',
        'Invalid synchronization strategy.',
      ),
    );
  if (!hasEnum(WRITER_POLICIES, definition.writerPolicy))
    errors.push(
      projectionError(
        'INVALID_WRITER_POLICY',
        'writerPolicy',
        'Invalid writer policy.',
      ),
    );
  if (!stringArray(definition.knownDirectWriteLocations))
    errors.push(
      projectionError(
        'INVALID_WRITER_INVENTORY',
        'knownDirectWriteLocations',
        'Known writer locations must be strings.',
      ),
    );
  if (!stringArray(definition.knownReadConsumers))
    errors.push(
      projectionError(
        'INVALID_CONSUMER_INVENTORY',
        'knownReadConsumers',
        'Known read consumers must be strings.',
      ),
    );
  if (!hasEnum(INVENTORY_COMPLETENESS, definition.inventoryCompleteness))
    errors.push(
      projectionError(
        'INVALID_INVENTORY_COMPLETENESS',
        'inventoryCompleteness',
        'Inventory completeness is required.',
      ),
    );
  if (!stringArray(definition.inventoryEvidenceReferences))
    errors.push(
      projectionError(
        'INVALID_INVENTORY_EVIDENCE',
        'inventoryEvidenceReferences',
        'Inventory evidence references must be strings.',
      ),
    );
  if (!Array.isArray(definition.conditions))
    errors.push(
      projectionError(
        'INVALID_CONDITIONS',
        'conditions',
        'Conditions array is required.',
      ),
    );
  if (!iso(definition.createdAt))
    errors.push(
      projectionError(
        'INVALID_TIMESTAMP',
        'createdAt',
        'createdAt must be ISO.',
      ),
    );
  if (!iso(definition.recordedAt))
    errors.push(
      projectionError(
        'INVALID_TIMESTAMP',
        'recordedAt',
        'recordedAt must be ISO.',
      ),
    );
  if (definition.ownershipStatus === 'APPROVED_CANONICAL_OWNER') {
    if (!ownerComplete(definition.canonicalOwner))
      errors.push(
        projectionError(
          'CANONICAL_OWNER_REQUIRED',
          'canonicalOwner',
          'Approved ownership requires exactly one complete canonical owner.',
        ),
      );
    if (!nonEmpty(definition.approvedByRecordId))
      errors.push(
        projectionError(
          'APPROVAL_RECORD_REQUIRED',
          'approvedByRecordId',
          'Approved definitions require approval evidence.',
        ),
      );
  }
  if (
    definition.ownershipStatus === 'UNRESOLVED_OWNER' &&
    definition.canonicalOwner
  )
    errors.push(
      projectionError(
        'UNRESOLVED_OWNER_CANNOT_DECLARE_OWNER',
        'canonicalOwner',
        'Unresolved ownership must not invent a canonical owner.',
      ),
    );
  if (
    definition.ownershipStatus === 'UNRESOLVED_OWNER' &&
    ['ATOMIC_SYNCHRONOUS', 'ASYNCHRONOUS_BOUNDED_DRIFT'].includes(
      definition.synchronizationStrategy ?? '',
    )
  )
    errors.push(
      projectionError(
        'UNRESOLVED_OWNER_CANNOT_AUTHORIZE_SYNC',
        'synchronizationStrategy',
        'Unresolved ownership cannot claim authoritative synchronization.',
      ),
    );
  if (
    definition.ownershipStatus === 'DEPRECATED_NO_OWNER_REQUIRED' &&
    !definition.deprecationCriteria
  )
    errors.push(
      projectionError(
        'DEPRECATION_CRITERIA_REQUIRED',
        'deprecationCriteria',
        'Deprecated projections require deprecation criteria.',
      ),
    );
  if (
    definition.ownershipStatus === 'DEPRECATED_NO_OWNER_REQUIRED' &&
    definition.deprecationCriteria?.noCurrentGovernedConsumerMayDepend !== true
  )
    errors.push(
      projectionError(
        'DEPRECATED_CONSUMER_DEPENDENCY',
        'deprecationCriteria.noCurrentGovernedConsumerMayDepend',
        'Deprecated projections cannot have current governed consumers.',
      ),
    );
  if (
    definition.synchronizationStrategy === 'DERIVED_ON_READ' &&
    definition.writerPolicy !== 'DERIVATION_ONLY'
  )
    errors.push(
      projectionError(
        'DERIVED_ON_READ_REQUIRES_DERIVATION_ONLY',
        'writerPolicy',
        'Derived projections prohibit independent writes.',
      ),
    );
  if (
    definition.writerPolicy === 'DERIVATION_ONLY' &&
    definition.synchronizationStrategy !== 'DERIVED_ON_READ'
  )
    errors.push(
      projectionError(
        'DERIVATION_ONLY_REQUIRES_DERIVED_STRATEGY',
        'synchronizationStrategy',
        'DERIVATION_ONLY must align with DERIVED_ON_READ.',
      ),
    );
  if (definition.synchronizationStrategy === 'ASYNCHRONOUS_BOUNDED_DRIFT') {
    if (!hasCompleteDriftPolicy(definition))
      errors.push(
        projectionError(
          'BOUNDED_DRIFT_POLICY_REQUIRED',
          'driftPolicy',
          'Asynchronous synchronization requires a complete bounded-drift policy.',
        ),
      );
    if (
      ['AUTHORITY_SENSITIVE', 'LEARNER_EXPOSURE_GATING'].includes(
        definition.projectionSensitivity ?? '',
      ) &&
      !definition.driftPolicy?.unauthorizedEffectsExcluded
    )
      errors.push(
        projectionError(
          'SENSITIVE_ASYNC_EXCEPTION_REQUIRED',
          'driftPolicy',
          'Sensitive asynchronous projection requires exception evidence.',
        ),
      );
  }
  if (definition.writerPolicy === 'TEMPORARY_COMPATIBILITY_WRITE') {
    const details = definition.writerPolicyDetails;
    for (const key of [
      'rationale',
      'expiryCondition',
      'migrationMilestone',
      'requiredAuditClassification',
      'transitionalApprovalEvidence',
    ]) {
      if (!nonEmpty(details?.[key as keyof typeof details]))
        errors.push(
          projectionError(
            'TEMPORARY_WRITE_DETAIL_REQUIRED',
            `writerPolicyDetails.${key}`,
            `${key} is required for temporary compatibility writes.`,
          ),
        );
    }
    if (!stringArray(details?.allowedWriterReferences))
      errors.push(
        projectionError(
          'TEMPORARY_WRITE_WRITERS_REQUIRED',
          'writerPolicyDetails.allowedWriterReferences',
          'Temporary writers must be explicit.',
        ),
      );
  }
  if (
    definition.inventoryCompleteness !== 'COMPLETE' &&
    definition.unknownWriterRisk !== true
  )
    errors.push(
      projectionError(
        'INCOMPLETE_INVENTORY_PRESERVES_RISK',
        'unknownWriterRisk',
        'Incomplete inventory must preserve unknown-writer risk.',
      ),
    );
  if (!isRecord(definition.legacyStatePolicy))
    errors.push(
      projectionError(
        'LEGACY_POLICY_REQUIRED',
        'legacyStatePolicy',
        'Legacy state policy is required.',
      ),
    );
  else if (definition.legacyStatePolicy.legacyValuesAreObservedOnly !== true)
    errors.push(
      projectionError(
        'LEGACY_VALUES_OBSERVED_ONLY',
        'legacyStatePolicy.legacyValuesAreObservedOnly',
        'Legacy values must remain observations without provenance.',
      ),
    );
  if (!isRecord(definition.disclosurePolicy))
    errors.push(
      projectionError(
        'DISCLOSURE_POLICY_REQUIRED',
        'disclosurePolicy',
        'Disclosure policy is required.',
      ),
    );
  return projectionResult(errors);
};

const ownerKey = (definition: CompatibilityProjectionDefinition): string =>
  definition.canonicalOwner
    ? JSON.stringify(definition.canonicalOwner)
    : 'NO_OWNER';

export const validateCompatibilityProjectionRegistry = (
  registry: CompatibilityProjectionRegistry,
): ProjectionValidationResult => {
  const errors: ProjectionValidationError[] = [];
  const seenVersions = new Set<string>();
  const active = new Map<string, CompatibilityProjectionDefinition>();
  registry.definitions.forEach((definition, index) => {
    errors.push(
      ...validateCompatibilityProjectionDefinition(definition).errors.map(
        (entry) => ({ ...entry, path: `definitions.${index}.${entry.path}` }),
      ),
    );
    const versionKey = `${definition.projectionId}:${definition.projectionSchemaVersion}`;
    if (seenVersions.has(versionKey))
      errors.push(
        projectionError(
          'DUPLICATE_PROJECTION_DEFINITION',
          `definitions.${index}`,
          'Duplicate projection ID/version.',
        ),
      );
    seenVersions.add(versionKey);
    if (definition.status === 'APPROVED') {
      const existing = active.get(definition.projectionId);
      if (existing) {
        errors.push(
          projectionError(
            'MULTIPLE_ACTIVE_APPROVED_DEFINITIONS',
            `definitions.${index}`,
            'Only one active approved definition may exist per projection.',
          ),
        );
        if (ownerKey(existing) !== ownerKey(definition))
          errors.push(
            projectionError(
              'CONFLICTING_CANONICAL_OWNERS',
              `definitions.${index}.canonicalOwner`,
              'Competing approved owners are not allowed.',
            ),
          );
        if (
          existing.synchronizationStrategy !==
          definition.synchronizationStrategy
        )
          errors.push(
            projectionError(
              'CONFLICTING_SYNCHRONIZATION_STRATEGIES',
              `definitions.${index}.synchronizationStrategy`,
              'Competing strategies are not allowed.',
            ),
          );
        if (existing.writerPolicy !== definition.writerPolicy)
          errors.push(
            projectionError(
              'CONFLICTING_WRITER_POLICIES',
              `definitions.${index}.writerPolicy`,
              'Competing writer policies are not allowed.',
            ),
          );
      }
      active.set(definition.projectionId, definition);
    }
  });
  return projectionResult(errors);
};

export const validateProjectionInventoryEntry = (
  entry: ProjectionInventoryEntry,
): ProjectionValidationResult => {
  const errors: ProjectionValidationError[] = [];
  for (const key of ['projectionId', 'artifactType', 'fieldPath']) {
    if (!nonEmpty(entry[key as keyof ProjectionInventoryEntry]))
      errors.push(
        projectionError('REQUIRED_FIELD', key, `${key} is required.`),
      );
  }
  if (!stringArray(entry.knownDirectWriteLocations))
    errors.push(
      projectionError(
        'INVALID_WRITERS',
        'knownDirectWriteLocations',
        'Writers must be strings.',
      ),
    );
  if (!stringArray(entry.knownReadConsumers))
    errors.push(
      projectionError(
        'INVALID_READERS',
        'knownReadConsumers',
        'Readers must be strings.',
      ),
    );
  if (!hasEnum(INVENTORY_COMPLETENESS, entry.inventoryCompleteness))
    errors.push(
      projectionError(
        'INVALID_INVENTORY_COMPLETENESS',
        'inventoryCompleteness',
        'Inventory completeness is required.',
      ),
    );
  if (entry.inventoryCompleteness !== 'COMPLETE' && !entry.unknownWriterRisk)
    errors.push(
      projectionError(
        'INCOMPLETE_INVENTORY_PRESERVES_RISK',
        'unknownWriterRisk',
        'Incomplete inventory must preserve unknown writer risk.',
      ),
    );
  return projectionResult(errors);
};

export const validateProjectionInventory = (
  inventory: ProjectionInventory,
): ProjectionValidationResult => {
  const errors: ProjectionValidationError[] = [];
  inventory.entries.forEach((entry, index) => {
    errors.push(
      ...validateProjectionInventoryEntry(entry).errors.map((error) => ({
        ...error,
        path: `entries.${index}.${error.path}`,
      })),
    );
  });
  return projectionResult(errors);
};

export const validateLegacyProjectionObservation = (
  input: LegacyProjectionObservation,
): ProjectionValidationResult => {
  const errors: ProjectionValidationError[] = [];
  for (const key of [
    'observationId',
    'projectionId',
    'sourceArtifactType',
    'sourceRecordId',
    'sourceField',
    'observedAt',
    'recordedAt',
  ]) {
    if (!nonEmpty(input[key as keyof LegacyProjectionObservation]))
      errors.push(
        projectionError('REQUIRED_FIELD', key, `${key} is required.`),
      );
  }
  if (!hasEnum(LEGACY_PROVENANCE_STATUSES, input.provenanceStatus))
    errors.push(
      projectionError(
        'INVALID_PROVENANCE_STATUS',
        'provenanceStatus',
        'Invalid provenance status.',
      ),
    );
  if (!stringArray(input.observationEvidenceReferences))
    errors.push(
      projectionError(
        'INVALID_EVIDENCE',
        'observationEvidenceReferences',
        'Observation evidence references must be strings.',
      ),
    );
  if (
    isRecord(input) &&
    [
      'approver',
      'decisionRationale',
      'decisionTimestamp',
      'publicationAuthorization',
      'reviewedRevision',
      'authorityAssignment',
    ].some((key) => key in input)
  )
    errors.push(
      projectionError(
        'FABRICATED_GOVERNANCE_EVIDENCE',
        '',
        'Legacy observations cannot fabricate governance evidence.',
      ),
    );
  return projectionResult(errors);
};

export const validRepairMode = (value: unknown): boolean =>
  hasEnum(REPAIR_MODES, value);
