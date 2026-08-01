import type {
  DRIFT_STATUSES,
  INVENTORY_COMPLETENESS,
  LEGACY_PROVENANCE_STATUSES,
  OWNERSHIP_STATUSES,
  PROJECTION_DEFINITION_STATUSES,
  PROJECTION_SENSITIVITIES,
  REPAIR_MODES,
  SNAPSHOT_KINDS,
  STATE_STATUSES,
  SYNCHRONIZATION_STRATEGIES,
  WRITER_POLICIES,
} from './compatibility-projection.constants';

export type CompatibilityProjectionDefinitionStatus =
  (typeof PROJECTION_DEFINITION_STATUSES)[number];
export type ProjectionOwnershipStatus = (typeof OWNERSHIP_STATUSES)[number];
export type ProjectionSynchronizationStrategy =
  (typeof SYNCHRONIZATION_STRATEGIES)[number];
export type ProjectionWriterPolicy = (typeof WRITER_POLICIES)[number];
export type ProjectionSensitivity = (typeof PROJECTION_SENSITIVITIES)[number];
export type ProjectionInventoryCompleteness =
  (typeof INVENTORY_COMPLETENESS)[number];
export type ProjectionSnapshotKind = (typeof SNAPSHOT_KINDS)[number];
export type ProjectionStateStatus = (typeof STATE_STATUSES)[number];
export type ProjectionDriftStatus = (typeof DRIFT_STATUSES)[number];
export type ProjectionRepairMode = (typeof REPAIR_MODES)[number];
export type LegacyProjectionProvenanceStatus =
  (typeof LEGACY_PROVENANCE_STATUSES)[number];

export interface ProjectionCanonicalOwner {
  canonicalOwnerType: string;
  canonicalOwnerReference: string;
  canonicalOwnerDecisionType: string;
  canonicalOwnerSchemaVersion: string;
  supportingApprovalRecordId: string;
}

export interface ProjectionWriterPolicyDetails {
  rationale?: string;
  allowedWriterReferences?: string[];
  expiryCondition?: string;
  expiresAt?: string;
  migrationMilestone?: string;
  requiredAuditClassification?: string;
  transitionalApprovalEvidence?: string;
}

export interface ProjectionDriftPolicy {
  maximumDriftDuration?: string;
  maximumDriftDurationMs?: number;
  freshnessReferenceType?: string;
  freshnessReferenceValue?: string;
  replayPolicy?: string;
  consumerTolerance?: string;
  escalationPolicy?: string;
  asynchronousExceptionApprovalRecordId?: string;
  unauthorizedEffectsExcluded?: boolean;
}

export interface ProjectionRepairPolicy {
  repairMode: ProjectionRepairMode;
  deterministicDerivationRequired?: boolean;
  provenCanonicalStateRequired?: boolean;
  provenCanonicalEffectRequired?: boolean;
  authorityEligibilityRequired?: boolean;
  expectedStateEligibilityRequired?: boolean;
  manualReviewRequired?: boolean;
  permittedDriftStatuses?: ProjectionDriftStatus[];
  repairEvidenceRequirements?: string[];
  conditions?: string[];
}

export interface ProjectionLegacyStatePolicy {
  legacyValuesAreObservedOnly: boolean;
  unresolvedHistoryRemainsUnknown: boolean;
}

export interface ProjectionDisclosurePolicy {
  exposeSafeReferencesOnlyWhenAuthorized: boolean;
}

export interface ProjectionProvenanceRequirements {
  sourceCanonicalRecordId?: string;
  sourceCanonicalRecordType?: string;
  sourceCanonicalVersion?: string;
  sourceGovernanceDecisionId?: string;
  sourceCommandId?: string;
  sourceAppliedAt?: string;
  projectionUpdatedAt?: string;
  projectionSchemaVersion?: string;
}

export interface ProjectionDeprecationCriteria {
  consumerRemovalRequired: boolean;
  noCurrentGovernedConsumerMayDepend: boolean;
  removalReadinessEvidence?: string[];
}

export interface CompatibilityProjectionDefinition {
  projectionId: string;
  projectionSchemaVersion: string;
  artifactType: string;
  fieldPath: string;
  projectionMeaning: string;
  projectionSensitivity: ProjectionSensitivity;
  ownershipStatus: ProjectionOwnershipStatus;
  canonicalOwner?: ProjectionCanonicalOwner | null;
  synchronizationStrategy: ProjectionSynchronizationStrategy;
  writerPolicy: ProjectionWriterPolicy;
  writerPolicyDetails?: ProjectionWriterPolicyDetails;
  knownDirectWriteLocations: string[];
  knownReadConsumers: string[];
  inventoryCompleteness: ProjectionInventoryCompleteness;
  unknownWriterRisk: boolean;
  inventoryEvidenceReferences: string[];
  driftPolicy?: ProjectionDriftPolicy;
  repairPolicy?: ProjectionRepairPolicy;
  legacyStatePolicy: ProjectionLegacyStatePolicy;
  disclosurePolicy: ProjectionDisclosurePolicy;
  sourceProvenanceRequirements: ProjectionProvenanceRequirements;
  deprecationCriteria?: ProjectionDeprecationCriteria;
  rationale: string;
  conditions: string[];
  status: CompatibilityProjectionDefinitionStatus;
  approvedByRecordId?: string;
  createdAt: string;
  recordedAt: string;
}

export interface CompatibilityProjectionRegistry {
  registryId: string;
  registrySchemaVersion: string;
  status: 'STAGE_1_CONTRACT_ONLY';
  definitions: CompatibilityProjectionDefinition[];
  createdAt: string;
  recordedAt: string;
}

export interface ProjectionInventoryEntry {
  projectionId: string;
  artifactType: string;
  fieldPath: string;
  knownDirectWriteLocations: string[];
  knownReadConsumers: string[];
  inventoryCompleteness: ProjectionInventoryCompleteness;
  unknownWriterRisk: boolean;
  inventoryEvidenceReferences: string[];
  lastInventoriedAt?: string;
  inventoryMethod?: string;
  notes?: string;
}

export interface ProjectionInventory {
  inventoryId: string;
  inventorySchemaVersion: string;
  status: 'STAGE_1_CONTRACT_ONLY';
  entries: ProjectionInventoryEntry[];
  createdAt: string;
  recordedAt: string;
}

export interface ProjectionStateSnapshot {
  projectionId: string;
  snapshotKind: ProjectionSnapshotKind;
  stateStatus: ProjectionStateStatus;
  stateValue?: unknown;
  recordReference?: string;
  recordType?: string;
  recordVersion?: string;
  governanceDecisionId?: string;
  commandId?: string;
  canonicalEffectReference?: string;
  appliedAt?: string;
  observedAt?: string;
  projectionUpdatedAt?: string;
  projectionSchemaVersion?: string;
  provenanceReferences?: string[];
  disclosureAllowed?: boolean;
}

export interface ProjectionDriftResult {
  driftStatus: ProjectionDriftStatus;
  projectionId: string;
  canonicalSnapshotReference?: string;
  projectedSnapshotReference?: string;
  evaluatedAt: string;
  safeCanonicalReference?: string;
  safeProjectedReference?: string;
  reasons: string[];
  repairEvaluated: boolean;
  repairPerformed: false;
}

export interface ProjectionWriteEligibilityInput {
  definition: CompatibilityProjectionDefinition;
  writerReference?: string;
  authorityEligibility?: { eligible: boolean; reasons?: string[] };
  commandEligibility?: { status: string; reasons?: string[] };
  canonicalEffectAvailability?: { available: boolean; reference?: string };
  idempotencyDisposition?: string;
  requestedAt: string;
}

export type ProjectionWriteEligibilityStatus =
  | 'ELIGIBLE_FOR_FUTURE_ATOMIC_SYNCHRONIZATION'
  | 'ELIGIBLE_FOR_FUTURE_DERIVATION'
  | 'DENIED_OWNER_UNRESOLVED'
  | 'DENIED_UNAPPROVED_DEFINITION'
  | 'DENIED_WRITER_POLICY'
  | 'DENIED_WRITER_NOT_ALLOWED'
  | 'DENIED_AUTHORITY'
  | 'DENIED_STALE_COMMAND'
  | 'DENIED_INVALID_COMMAND'
  | 'DENIED_CANONICAL_EFFECT_MISSING'
  | 'DENIED_REPLAY_NO_SECOND_WRITE'
  | 'DENIED_OBSERVE_ONLY'
  | 'DENIED_NO_WRITES'
  | 'DENIED_ASYNC_POLICY'
  | 'INVALID';

export interface ProjectionWriteEligibilityResult {
  status: ProjectionWriteEligibilityStatus;
  eligibleForFutureApplication: boolean;
  projectionUpdated: false;
  reasons: string[];
}

export interface ProjectionRepairEligibilityInput {
  definition: CompatibilityProjectionDefinition;
  driftResult: ProjectionDriftResult;
  canonicalSnapshot?: ProjectionStateSnapshot;
  projectedSnapshot?: ProjectionStateSnapshot;
  requestedRepairMode: ProjectionRepairMode;
  authorityEligibility?: { eligible: boolean; reasons?: string[] };
  expectedStateEligibility?: {
    eligible: boolean;
    stale?: boolean;
    reasons?: string[];
  };
  historicalProvenanceCompleteness?:
    'COMPLETE' | 'INCOMPLETE' | 'CONFLICTING' | 'UNKNOWN';
  evaluatedAt: string;
}

export type ProjectionRepairEligibilityStatus =
  | 'ELIGIBLE_FOR_FUTURE_REBUILD'
  | 'ELIGIBLE_FOR_FUTURE_EFFECT_REPLAY'
  | 'MARK_UNKNOWN_ONLY'
  | 'MANUAL_REVIEW_REQUIRED'
  | 'DENIED_NO_REPAIR_POLICY'
  | 'DENIED_OWNER_UNRESOLVED'
  | 'DENIED_AUTHORITY'
  | 'DENIED_STALE_COMMAND'
  | 'DENIED_CANONICAL_STATE_UNKNOWN'
  | 'DENIED_CANONICAL_EFFECT_MISSING'
  | 'DENIED_NONDETERMINISTIC_DERIVATION'
  | 'DENIED_MODE_NOT_PERMITTED'
  | 'DENIED_NO_AUTOMATIC_REPAIR'
  | 'INVALID';

export interface ProjectionRepairEligibilityResult {
  status: ProjectionRepairEligibilityStatus;
  eligibleForFutureRepair: boolean;
  repairPerformed: false;
  createsGovernanceDecision: false;
  reasons: string[];
}

export type ProjectionDeprecationValidationStatus =
  | 'READY_FOR_FUTURE_DEPRECATION'
  | 'NOT_READY_ACTIVE_CONSUMERS'
  | 'NOT_READY_INCOMPLETE_INVENTORY'
  | 'NOT_READY_MISSING_CRITERIA'
  | 'NOT_READY_MISSING_EVIDENCE'
  | 'INVALID';

export interface ProjectionDeprecationValidationResult {
  status: ProjectionDeprecationValidationStatus;
  fieldRemoved: false;
  reasons: string[];
}

export interface LegacyProjectionObservation {
  observationId: string;
  projectionId: string;
  sourceArtifactType: string;
  sourceRecordId: string;
  sourceField: string;
  observedValue: unknown;
  observedAt: string;
  provenanceStatus: LegacyProjectionProvenanceStatus;
  observationEvidenceReferences: string[];
  recordedAt: string;
}

export interface ProjectionValidationError {
  code: string;
  path: string;
  message: string;
}

export interface ProjectionValidationResult {
  valid: boolean;
  errors: ProjectionValidationError[];
}

export interface ProjectionDefinitionConflict {
  projectionId: string;
  conflictType: string;
  reasons: string[];
}
