import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { validateDocumentApprovalRecord } from '../document-authority/document-authority.validation';
import {
  APPROVED_OPTION_ID,
  createCompatibilityProjectionRegistry,
  createProjectionInventory,
  evaluateProjectionDrift,
  evaluateProjectionRepairEligibility,
  findCompatibilityProjectionDefinition,
  registerCompatibilityProjectionDefinition,
  rejectRegistryMembershipAsApproval,
  requireApprovedProjectionDefinition,
  resolveProjectionWriteEligibility,
  validateCompatibilityProjectionDefinition,
  validateCompatibilityProjectionRegistry,
  validateLegacyProjectionObservation,
  validateProjectionDeprecation,
  validateProjectionInventory,
  validateProjectionInventoryEntry,
  type CompatibilityProjectionDefinition,
  type LegacyProjectionObservation,
  type ProjectionDriftResult,
  type ProjectionInventoryEntry,
  type ProjectionStateSnapshot,
} from './index';

const NOW = '2026-08-02T12:00:00Z';

const findRepositoryRoot = (): string => {
  let current = process.cwd();
  for (let depth = 0; depth < 6; depth += 1) {
    if (
      existsSync(join(current, 'docs', 'weos')) &&
      existsSync(join(current, 'doctordle-backend'))
    )
      return current;
    current = resolve(current, '..');
  }
  throw new Error('Repository root not found.');
};

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(join(findRepositoryRoot(), path), 'utf8'));

const owner = () => ({
  canonicalOwnerType: 'GOVERNANCE_DECISION',
  canonicalOwnerReference: 'WEOS-GD-TEST',
  canonicalOwnerDecisionType: 'APPROVAL_DECISION',
  canonicalOwnerSchemaVersion: '1.0.0',
  supportingApprovalRecordId: 'WEOS-AUTH-APP-005',
});

const definition = (
  overrides: Partial<CompatibilityProjectionDefinition> = {},
): CompatibilityProjectionDefinition => ({
  projectionId: 'CASE_EDITORIAL_STATUS',
  projectionSchemaVersion: '1.0.0',
  artifactType: 'CASE',
  fieldPath: 'Case.editorialStatus',
  projectionMeaning: 'Test-only status projection.',
  projectionSensitivity: 'AUTHORITY_SENSITIVE',
  ownershipStatus: 'APPROVED_CANONICAL_OWNER',
  canonicalOwner: owner(),
  synchronizationStrategy: 'ATOMIC_SYNCHRONOUS',
  writerPolicy: 'GOVERNED_HANDLER_ONLY',
  writerPolicyDetails: {
    rationale: 'Test-only policy.',
    allowedWriterReferences: ['handler:test'],
    expiryCondition: 'Ends at pilot approval.',
    migrationMilestone: 'pilot',
    requiredAuditClassification: 'GOVERNED_PROJECTION_WRITE',
    transitionalApprovalEvidence: 'WEOS-AUTH-APP-005',
  },
  knownDirectWriteLocations: [
    'doctordle-backend/src/modules/admin/case-review.service.ts',
  ],
  knownReadConsumers: [
    'doctordle-backend/src/modules/admin/case-review.service.ts',
  ],
  inventoryCompleteness: 'PARTIAL',
  unknownWriterRisk: true,
  inventoryEvidenceReferences: [
    'docs/weos/phase-3-governance-foundations/WEOS-OD-019-compatibility-projection-ownership.md',
  ],
  driftPolicy: undefined,
  repairPolicy: {
    repairMode: 'REBUILD_FROM_CANONICAL',
    deterministicDerivationRequired: true,
    provenCanonicalStateRequired: true,
    authorityEligibilityRequired: true,
    expectedStateEligibilityRequired: true,
    permittedDriftStatuses: ['DRIFTED', 'PROJECTION_MISSING'],
    repairEvidenceRequirements: ['canonical snapshot'],
    conditions: ['future repair only'],
  },
  legacyStatePolicy: {
    legacyValuesAreObservedOnly: true,
    unresolvedHistoryRemainsUnknown: true,
  },
  disclosurePolicy: {
    exposeSafeReferencesOnlyWhenAuthorized: true,
  },
  sourceProvenanceRequirements: {
    sourceCanonicalRecordId: 'required',
    sourceCanonicalRecordType: 'required',
    sourceGovernanceDecisionId: 'required',
    sourceCommandId: 'required',
    projectionSchemaVersion: '1.0.0',
  },
  deprecationCriteria: undefined,
  rationale: 'Test fixture only.',
  conditions: ['No production owner is implied.'],
  status: 'APPROVED',
  approvedByRecordId: 'WEOS-AUTH-APP-005',
  createdAt: NOW,
  recordedAt: NOW,
  ...overrides,
});

const inventoryEntry = (
  overrides: Partial<ProjectionInventoryEntry> = {},
): ProjectionInventoryEntry => ({
  projectionId: 'CASE_EDITORIAL_STATUS',
  artifactType: 'CASE',
  fieldPath: 'Case.editorialStatus',
  knownDirectWriteLocations: ['service:test'],
  knownReadConsumers: ['consumer:test'],
  inventoryCompleteness: 'PARTIAL',
  unknownWriterRisk: true,
  inventoryEvidenceReferences: ['evidence:test'],
  lastInventoriedAt: NOW,
  inventoryMethod: 'repository search',
  notes: 'test only',
  ...overrides,
});

const snapshot = (
  overrides: Partial<ProjectionStateSnapshot> = {},
): ProjectionStateSnapshot => ({
  projectionId: 'CASE_EDITORIAL_STATUS',
  snapshotKind: 'CANONICAL',
  stateStatus: 'KNOWN',
  stateValue: 'APPROVED',
  recordReference: 'canonical:test',
  recordType: 'GOVERNANCE_DECISION',
  recordVersion: '1',
  governanceDecisionId: 'WEOS-GD-TEST',
  commandId: 'cmd-1',
  canonicalEffectReference: 'effect-1',
  appliedAt: NOW,
  observedAt: NOW,
  projectionUpdatedAt: NOW,
  projectionSchemaVersion: '1.0.0',
  provenanceReferences: ['prov-1'],
  disclosureAllowed: true,
  ...overrides,
});

const drift = (
  overrides: Partial<ProjectionDriftResult> = {},
): ProjectionDriftResult => ({
  driftStatus: 'DRIFTED',
  projectionId: 'CASE_EDITORIAL_STATUS',
  evaluatedAt: NOW,
  reasons: ['DRIFTED'],
  repairEvaluated: false,
  repairPerformed: false,
  ...overrides,
});

const observation = (
  overrides: Partial<LegacyProjectionObservation> = {},
): LegacyProjectionObservation => ({
  observationId: 'obs-1',
  projectionId: 'CASE_EDITORIAL_STATUS',
  sourceArtifactType: 'CASE',
  sourceRecordId: 'case-1',
  sourceField: 'editorialStatus',
  observedValue: 'APPROVED',
  observedAt: NOW,
  provenanceStatus: 'OBSERVED_ONLY',
  observationEvidenceReferences: ['runtime:evidence'],
  recordedAt: NOW,
  ...overrides,
});

const writeStatus = (
  overrides: Partial<CompatibilityProjectionDefinition> = {},
) =>
  resolveProjectionWriteEligibility({
    definition: definition(overrides),
    writerReference: 'handler:test',
    authorityEligibility: { eligible: true },
    commandEligibility: { status: 'ELIGIBLE' },
    canonicalEffectAvailability: { available: true, reference: 'effect-1' },
    requestedAt: NOW,
  }).status;

describe('WEOS compatibility projection Stage 1 contracts', () => {
  const cases: Array<[string, () => void]> = [
    [
      '1 APP-005 validates under existing document-authority contracts',
      () =>
        expect(
          validateDocumentApprovalRecord(
            readJson(
              'docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-005.json',
            ),
          ).valid,
        ).toBe(true),
    ],
    [
      '2 APP-005 points to OD-019 version 0.1',
      () => {
        const record = validateDocumentApprovalRecord(
          readJson(
            'docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-005.json',
          ),
        ).record;
        expect(record?.documentId).toBe('WEOS-OD-019');
        expect(record?.documentVersion).toBe('0.1');
      },
    ],
    [
      '3 APP-005 uses APP-001 as authority basis',
      () =>
        expect(
          JSON.stringify(
            readJson(
              'docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-005.json',
            ),
          ),
        ).toContain('WEOS-AUTH-APP-001'),
    ],
    [
      '4 APP-005 records APP-004 as dependency evidence',
      () =>
        expect(
          JSON.stringify(
            readJson(
              'docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-005.json',
            ),
          ),
        ).toContain('WEOS-AUTH-APP-004'),
    ],
    [
      '5 APP-005 records APP-002 and APP-003 as supporting foundations',
      () => {
        const text = JSON.stringify(
          readJson(
            'docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-005.json',
          ),
        );
        expect(text).toContain('WEOS-AUTH-APP-002');
        expect(text).toContain('WEOS-AUTH-APP-003');
      },
    ],
    [
      '6 Production projection registry parses',
      () =>
        expect(
          readJson(
            'docs/weos/compatibility-projections/projection-registry.json',
          ),
        ).toMatchObject({ registrySchemaVersion: '1.0.0' }),
    ],
    [
      '7 Production projection registry contains no production owner',
      () =>
        expect(
          (
            readJson(
              'docs/weos/compatibility-projections/projection-registry.json',
            ) as { definitions: unknown[] }
          ).definitions,
        ).toEqual([]),
    ],
    [
      '8 Production inventory parses',
      () =>
        expect(
          readJson(
            'docs/weos/compatibility-projections/projection-inventory.json',
          ),
        ).toMatchObject({ inventorySchemaVersion: '1.0.0' }),
    ],
    [
      '9 Production inventory is empty',
      () =>
        expect(
          (
            readJson(
              'docs/weos/compatibility-projections/projection-inventory.json',
            ) as { entries: unknown[] }
          ).entries,
        ).toEqual([]),
    ],
    [
      '10 Projection cannot be independent canonical authority',
      () =>
        expect(rejectRegistryMembershipAsApproval().errors[0].code).toBe(
          'REGISTRY_MEMBERSHIP_IS_NOT_APPROVAL',
        ),
    ],
    [
      '11 Approved operational definition requires one owner',
      () =>
        expect(
          validateCompatibilityProjectionDefinition(definition()).valid,
        ).toBe(true),
    ],
    [
      '12 Missing owner fails',
      () =>
        expect(
          validateCompatibilityProjectionDefinition(
            definition({ canonicalOwner: null }),
          ).errors,
        ).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ code: 'CANONICAL_OWNER_REQUIRED' }),
          ]),
        ),
    ],
    [
      '13 Unresolved owner remains unresolved',
      () =>
        expect(
          validateCompatibilityProjectionDefinition(
            definition({
              ownershipStatus: 'UNRESOLVED_OWNER',
              canonicalOwner: null,
              synchronizationStrategy: 'LEGACY_OBSERVED_ONLY',
              writerPolicy: 'OBSERVE_ONLY',
              approvedByRecordId: undefined,
            }),
          ).valid,
        ).toBe(true),
    ],
    [
      '14 Unresolved owner cannot authorize synchronization',
      () =>
        expect(
          validateCompatibilityProjectionDefinition(
            definition({
              ownershipStatus: 'UNRESOLVED_OWNER',
              canonicalOwner: null,
              synchronizationStrategy: 'ATOMIC_SYNCHRONOUS',
            }),
          ).valid,
        ).toBe(false),
    ],
    [
      '15 Multiple approved owners conflict',
      () =>
        expect(
          validateCompatibilityProjectionRegistry(
            createCompatibilityProjectionRegistry([
              definition(),
              definition({
                projectionSchemaVersion: '2.0.0',
                canonicalOwner: {
                  ...owner(),
                  canonicalOwnerReference: 'OTHER',
                },
              }),
            ]),
          ).errors,
        ).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ code: 'CONFLICTING_CANONICAL_OWNERS' }),
          ]),
        ),
    ],
    [
      '16 Multiple active approved definitions conflict',
      () =>
        expect(
          validateCompatibilityProjectionRegistry(
            createCompatibilityProjectionRegistry([
              definition(),
              definition({ projectionSchemaVersion: '2.0.0' }),
            ]),
          ).errors,
        ).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              code: 'MULTIPLE_ACTIVE_APPROVED_DEFINITIONS',
            }),
          ]),
        ),
    ],
    [
      '17 Service writer location does not prove ownership',
      () =>
        expect(
          validateCompatibilityProjectionDefinition(
            definition({
              ownershipStatus: 'APPROVED_CANONICAL_OWNER',
              canonicalOwner: null,
              knownDirectWriteLocations: ['service'],
            }),
          ).valid,
        ).toBe(false),
    ],
    [
      '18 Database field location does not prove ownership',
      () =>
        expect(
          validateCompatibilityProjectionDefinition(
            definition({
              canonicalOwner: null,
              fieldPath: 'Case.editorialStatus',
            }),
          ).valid,
        ).toBe(false),
    ],
    [
      '19 Frontend read consumer does not prove ownership',
      () =>
        expect(
          validateCompatibilityProjectionDefinition(
            definition({
              canonicalOwner: null,
              knownReadConsumers: ['frontend'],
            }),
          ).valid,
        ).toBe(false),
    ],
    [
      '20 Admin role does not prove ownership',
      () =>
        expect(
          validateCompatibilityProjectionDefinition({ runtimeRoles: ['ADMIN'] })
            .valid,
        ).toBe(false),
    ],
    [
      '21 DERIVED_ON_READ prohibits independent writes',
      () =>
        expect(
          validateCompatibilityProjectionDefinition(
            definition({
              synchronizationStrategy: 'DERIVED_ON_READ',
              writerPolicy: 'GOVERNED_HANDLER_ONLY',
            }),
          ).valid,
        ).toBe(false),
    ],
    [
      '22 DERIVATION_ONLY aligns with derived-on-read',
      () =>
        expect(
          validateCompatibilityProjectionDefinition(
            definition({
              synchronizationStrategy: 'DERIVED_ON_READ',
              writerPolicy: 'DERIVATION_ONLY',
            }),
          ).valid,
        ).toBe(true),
    ],
    [
      '23 ATOMIC_SYNCHRONOUS requires a canonical effect',
      () =>
        expect(writeStatus()).toBe(
          'ELIGIBLE_FOR_FUTURE_ATOMIC_SYNCHRONIZATION',
        ),
    ],
    [
      '24 Async strategy requires bounded-drift policy',
      () =>
        expect(
          validateCompatibilityProjectionDefinition(
            definition({
              synchronizationStrategy: 'ASYNCHRONOUS_BOUNDED_DRIFT',
            }),
          ).valid,
        ).toBe(false),
    ],
    [
      '25 Async strategy without maximum duration fails',
      () =>
        expect(
          validateCompatibilityProjectionDefinition(
            definition({
              synchronizationStrategy: 'ASYNCHRONOUS_BOUNDED_DRIFT',
              driftPolicy: {
                freshnessReferenceType: 'TIME',
                freshnessReferenceValue: 'projectionUpdatedAt',
                replayPolicy: 'REPLAY',
                consumerTolerance: 'NONE',
                escalationPolicy: 'ESCALATE',
                asynchronousExceptionApprovalRecordId: 'APP',
              },
            }),
          ).valid,
        ).toBe(false),
    ],
    [
      '26 Async strategy requires replay policy',
      () =>
        expect(
          validateCompatibilityProjectionDefinition(
            definition({
              synchronizationStrategy: 'ASYNCHRONOUS_BOUNDED_DRIFT',
              driftPolicy: {
                maximumDriftDurationMs: 1,
                freshnessReferenceType: 'TIME',
                freshnessReferenceValue: 'projectionUpdatedAt',
                consumerTolerance: 'NONE',
                escalationPolicy: 'ESCALATE',
                asynchronousExceptionApprovalRecordId: 'APP',
              },
            }),
          ).valid,
        ).toBe(false),
    ],
    [
      '27 Async strategy requires consumer-tolerance policy',
      () =>
        expect(
          validateCompatibilityProjectionDefinition(
            definition({
              synchronizationStrategy: 'ASYNCHRONOUS_BOUNDED_DRIFT',
              driftPolicy: {
                maximumDriftDurationMs: 1,
                freshnessReferenceType: 'TIME',
                freshnessReferenceValue: 'projectionUpdatedAt',
                replayPolicy: 'REPLAY',
                escalationPolicy: 'ESCALATE',
                asynchronousExceptionApprovalRecordId: 'APP',
              },
            }),
          ).valid,
        ).toBe(false),
    ],
    [
      '28 Async strategy requires escalation policy',
      () =>
        expect(
          validateCompatibilityProjectionDefinition(
            definition({
              synchronizationStrategy: 'ASYNCHRONOUS_BOUNDED_DRIFT',
              driftPolicy: {
                maximumDriftDurationMs: 1,
                freshnessReferenceType: 'TIME',
                freshnessReferenceValue: 'projectionUpdatedAt',
                replayPolicy: 'REPLAY',
                consumerTolerance: 'NONE',
                asynchronousExceptionApprovalRecordId: 'APP',
              },
            }),
          ).valid,
        ).toBe(false),
    ],
    [
      '29 Sensitive projection does not default to async',
      () =>
        expect(
          validateCompatibilityProjectionDefinition(
            definition({
              synchronizationStrategy: 'ASYNCHRONOUS_BOUNDED_DRIFT',
              driftPolicy: {
                maximumDriftDurationMs: 1,
                freshnessReferenceType: 'TIME',
                freshnessReferenceValue: 'projectionUpdatedAt',
                replayPolicy: 'REPLAY',
                consumerTolerance: 'NONE',
                escalationPolicy: 'ESCALATE',
                asynchronousExceptionApprovalRecordId: 'APP',
              },
            }),
          ).valid,
        ).toBe(false),
    ],
    [
      '30 Sensitive async projection requires explicit exception evidence',
      () =>
        expect(
          validateCompatibilityProjectionDefinition(
            definition({
              synchronizationStrategy: 'ASYNCHRONOUS_BOUNDED_DRIFT',
              driftPolicy: {
                maximumDriftDurationMs: 1,
                freshnessReferenceType: 'TIME',
                freshnessReferenceValue: 'projectionUpdatedAt',
                replayPolicy: 'REPLAY',
                consumerTolerance: 'NONE',
                escalationPolicy: 'ESCALATE',
                asynchronousExceptionApprovalRecordId: 'APP',
                unauthorizedEffectsExcluded: true,
              },
            }),
          ).valid,
        ).toBe(true),
    ],
    [
      '31 LEGACY_OBSERVED_ONLY does not establish authority',
      () =>
        expect(
          resolveProjectionWriteEligibility({
            definition: definition({
              ownershipStatus: 'UNRESOLVED_OWNER',
              canonicalOwner: null,
              synchronizationStrategy: 'LEGACY_OBSERVED_ONLY',
              writerPolicy: 'OBSERVE_ONLY',
              approvedByRecordId: undefined,
            }),
            requestedAt: NOW,
          }).status,
        ).toBe('DENIED_OWNER_UNRESOLVED'),
    ],
    [
      '32 DEPRECATED requires deprecation criteria',
      () =>
        expect(
          validateCompatibilityProjectionDefinition(
            definition({
              ownershipStatus: 'DEPRECATED_NO_OWNER_REQUIRED',
              canonicalOwner: null,
              synchronizationStrategy: 'DEPRECATED',
              writerPolicy: 'NO_WRITES',
              approvedByRecordId: undefined,
              deprecationCriteria: undefined,
            }),
          ).valid,
        ).toBe(false),
    ],
    [
      '33 Temporary compatibility write requires rationale',
      () =>
        expect(
          validateCompatibilityProjectionDefinition(
            definition({
              writerPolicy: 'TEMPORARY_COMPATIBILITY_WRITE',
              writerPolicyDetails: {
                allowedWriterReferences: ['handler:test'],
                expiryCondition: 'x',
                migrationMilestone: 'x',
                requiredAuditClassification: 'x',
                transitionalApprovalEvidence: 'APP',
              },
            }),
          ).valid,
        ).toBe(false),
    ],
    [
      '34 Temporary compatibility write requires allowed writer references',
      () =>
        expect(
          validateCompatibilityProjectionDefinition(
            definition({
              writerPolicy: 'TEMPORARY_COMPATIBILITY_WRITE',
              writerPolicyDetails: {
                rationale: 'x',
                expiryCondition: 'x',
                migrationMilestone: 'x',
                requiredAuditClassification: 'x',
                transitionalApprovalEvidence: 'APP',
              },
            }),
          ).valid,
        ).toBe(false),
    ],
    [
      '35 Temporary compatibility write requires expiry condition',
      () =>
        expect(
          validateCompatibilityProjectionDefinition(
            definition({
              writerPolicy: 'TEMPORARY_COMPATIBILITY_WRITE',
              writerPolicyDetails: {
                rationale: 'x',
                allowedWriterReferences: ['handler:test'],
                migrationMilestone: 'x',
                requiredAuditClassification: 'x',
                transitionalApprovalEvidence: 'APP',
              },
            }),
          ).valid,
        ).toBe(false),
    ],
    [
      '36 Temporary compatibility write requires migration milestone',
      () =>
        expect(
          validateCompatibilityProjectionDefinition(
            definition({
              writerPolicy: 'TEMPORARY_COMPATIBILITY_WRITE',
              writerPolicyDetails: {
                rationale: 'x',
                allowedWriterReferences: ['handler:test'],
                expiryCondition: 'x',
                requiredAuditClassification: 'x',
                transitionalApprovalEvidence: 'APP',
              },
            }),
          ).valid,
        ).toBe(false),
    ],
    [
      '37 Temporary compatibility write requires audit classification',
      () =>
        expect(
          validateCompatibilityProjectionDefinition(
            definition({
              writerPolicy: 'TEMPORARY_COMPATIBILITY_WRITE',
              writerPolicyDetails: {
                rationale: 'x',
                allowedWriterReferences: ['handler:test'],
                expiryCondition: 'x',
                migrationMilestone: 'x',
                transitionalApprovalEvidence: 'APP',
              },
            }),
          ).valid,
        ).toBe(false),
    ],
    [
      '38 Unlisted writer is rejected',
      () =>
        expect(
          resolveProjectionWriteEligibility({
            definition: definition({
              writerPolicy: 'TEMPORARY_COMPATIBILITY_WRITE',
            }),
            writerReference: 'other',
            authorityEligibility: { eligible: true },
            commandEligibility: { status: 'ELIGIBLE' },
            canonicalEffectAvailability: { available: true },
            requestedAt: NOW,
          }).status,
        ).toBe('DENIED_WRITER_NOT_ALLOWED'),
    ],
    [
      '39 Admin role alone cannot authorize projection write',
      () =>
        expect(
          resolveProjectionWriteEligibility({
            definition: definition(),
            writerReference: 'admin',
            authorityEligibility: {
              eligible: false,
              reasons: ['ADMIN_ROLE_ONLY'],
            },
            requestedAt: NOW,
          }).status,
        ).toBe('DENIED_AUTHORITY'),
    ],
    [
      '40 Script identity alone cannot authorize projection write',
      () =>
        expect(
          resolveProjectionWriteEligibility({
            definition: definition({
              writerPolicy: 'TEMPORARY_COMPATIBILITY_WRITE',
            }),
            writerReference: 'script:seed',
            authorityEligibility: { eligible: true },
            requestedAt: NOW,
          }).status,
        ).toBe('DENIED_WRITER_NOT_ALLOWED'),
    ],
    [
      '41 Rejected authority permits no projection write',
      () =>
        expect(
          resolveProjectionWriteEligibility({
            definition: definition(),
            authorityEligibility: { eligible: false },
            requestedAt: NOW,
          }).projectionUpdated,
        ).toBe(false),
    ],
    [
      '42 Stale command permits no projection write',
      () =>
        expect(
          resolveProjectionWriteEligibility({
            definition: definition(),
            authorityEligibility: { eligible: true },
            commandEligibility: { status: 'REJECTED_STALE_PRECONDITION' },
            requestedAt: NOW,
          }).status,
        ).toBe('DENIED_STALE_COMMAND'),
    ],
    [
      '43 Invalid command permits no projection write',
      () =>
        expect(
          resolveProjectionWriteEligibility({
            definition: definition(),
            commandEligibility: { status: 'REJECTED_INVALID_COMMAND' },
            requestedAt: NOW,
          }).status,
        ).toBe('DENIED_INVALID_COMMAND'),
    ],
    [
      '44 Successful idempotent replay permits no second write',
      () =>
        expect(
          resolveProjectionWriteEligibility({
            definition: definition(),
            idempotencyDisposition: 'REPLAY_OF_SUCCESSFUL_COMMAND',
            requestedAt: NOW,
          }).status,
        ).toBe('DENIED_REPLAY_NO_SECOND_WRITE'),
    ],
    [
      '45 Canonical effect missing blocks atomic synchronization',
      () =>
        expect(
          resolveProjectionWriteEligibility({
            definition: definition(),
            authorityEligibility: { eligible: true },
            commandEligibility: { status: 'ELIGIBLE' },
            canonicalEffectAvailability: { available: false },
            requestedAt: NOW,
          }).status,
        ).toBe('DENIED_CANONICAL_EFFECT_MISSING'),
    ],
    [
      '46 Projection-first authority inference is rejected',
      () =>
        expect(
          validateCompatibilityProjectionDefinition({
            projectionValue: 'APPROVED',
          }).valid,
        ).toBe(false),
    ],
    [
      '47 Canonical-first ordering is represented',
      () =>
        expect(
          definition().sourceProvenanceRequirements.sourceGovernanceDecisionId,
        ).toBe('required'),
    ],
    [
      '48 Matching snapshots resolve IN_SYNC',
      () =>
        expect(
          evaluateProjectionDrift({
            definition: definition(),
            canonicalSnapshot: snapshot(),
            projectedSnapshot: snapshot({
              snapshotKind: 'PROJECTED',
              recordReference: 'projection:test',
            }),
            evaluatedAt: NOW,
          }).driftStatus,
        ).toBe('IN_SYNC'),
    ],
    [
      '49 Mismatched snapshots resolve DRIFTED',
      () =>
        expect(
          evaluateProjectionDrift({
            definition: definition(),
            canonicalSnapshot: snapshot(),
            projectedSnapshot: snapshot({
              snapshotKind: 'PROJECTED',
              stateValue: 'DRAFT',
            }),
            evaluatedAt: NOW,
          }).driftStatus,
        ).toBe('DRIFTED'),
    ],
    [
      '50 Unknown canonical state resolves CANONICAL_STATE_UNKNOWN',
      () =>
        expect(
          evaluateProjectionDrift({
            definition: definition(),
            canonicalSnapshot: snapshot({ stateStatus: 'UNKNOWN' }),
            projectedSnapshot: snapshot({ snapshotKind: 'PROJECTED' }),
            evaluatedAt: NOW,
          }).driftStatus,
        ).toBe('CANONICAL_STATE_UNKNOWN'),
    ],
    [
      '51 Missing canonical effect resolves CANONICAL_EFFECT_MISSING',
      () =>
        expect(
          evaluateProjectionDrift({
            definition: definition(),
            canonicalSnapshot: snapshot({ stateStatus: 'MISSING' }),
            projectedSnapshot: snapshot({ snapshotKind: 'PROJECTED' }),
            evaluatedAt: NOW,
          }).driftStatus,
        ).toBe('CANONICAL_EFFECT_MISSING'),
    ],
    [
      '52 Unknown projection state resolves PROJECTION_STATE_UNKNOWN',
      () =>
        expect(
          evaluateProjectionDrift({
            definition: definition(),
            canonicalSnapshot: snapshot(),
            projectedSnapshot: snapshot({
              snapshotKind: 'PROJECTED',
              stateStatus: 'UNKNOWN',
            }),
            evaluatedAt: NOW,
          }).driftStatus,
        ).toBe('PROJECTION_STATE_UNKNOWN'),
    ],
    [
      '53 Missing projection resolves PROJECTION_MISSING',
      () =>
        expect(
          evaluateProjectionDrift({
            definition: definition(),
            canonicalSnapshot: snapshot(),
            projectedSnapshot: snapshot({
              snapshotKind: 'PROJECTED',
              stateStatus: 'MISSING',
            }),
            evaluatedAt: NOW,
          }).driftStatus,
        ).toBe('PROJECTION_MISSING'),
    ],
    [
      '54 Unresolved owner resolves OWNER_UNRESOLVED',
      () =>
        expect(
          evaluateProjectionDrift({
            definition: definition({
              ownershipStatus: 'UNRESOLVED_OWNER',
              canonicalOwner: null,
              synchronizationStrategy: 'LEGACY_OBSERVED_ONLY',
              writerPolicy: 'OBSERVE_ONLY',
              approvedByRecordId: undefined,
            }),
            canonicalSnapshot: snapshot(),
            projectedSnapshot: snapshot({ snapshotKind: 'PROJECTED' }),
            evaluatedAt: NOW,
          }).driftStatus,
        ).toBe('OWNER_UNRESOLVED'),
    ],
    [
      '55 Non-evaluable snapshots resolve NOT_EVALUABLE',
      () =>
        expect(
          evaluateProjectionDrift({
            definition: definition(),
            canonicalSnapshot: snapshot({ stateStatus: 'UNAVAILABLE' }),
            projectedSnapshot: snapshot({ snapshotKind: 'PROJECTED' }),
            evaluatedAt: NOW,
          }).driftStatus,
        ).toBe('NOT_EVALUABLE'),
    ],
    [
      '56 Async drift beyond approved duration resolves DRIFTED',
      () =>
        expect(
          evaluateProjectionDrift({
            definition: definition({
              synchronizationStrategy: 'ASYNCHRONOUS_BOUNDED_DRIFT',
              driftPolicy: {
                maximumDriftDurationMs: 1,
                freshnessReferenceType: 'TIME',
                freshnessReferenceValue: 'projectionUpdatedAt',
                replayPolicy: 'REPLAY',
                consumerTolerance: 'NONE',
                escalationPolicy: 'ESCALATE',
                asynchronousExceptionApprovalRecordId: 'APP',
                unauthorizedEffectsExcluded: true,
              },
            }),
            canonicalSnapshot: snapshot(),
            projectedSnapshot: snapshot({
              snapshotKind: 'PROJECTED',
              projectionUpdatedAt: '2026-08-02T11:59:00Z',
            }),
            evaluatedAt: NOW,
          }).driftStatus,
        ).toBe('DRIFTED'),
    ],
    [
      '57 No default drift duration is invented',
      () => expect(definition().driftPolicy).toBeUndefined(),
    ],
    [
      '58 Safe canonical reference is hidden when disclosure is denied',
      () =>
        expect(
          evaluateProjectionDrift({
            definition: definition(),
            canonicalSnapshot: snapshot(),
            projectedSnapshot: snapshot({ snapshotKind: 'PROJECTED' }),
            evaluatedAt: NOW,
            disclosureAuthorization: { canDiscloseProjectionReferences: false },
          }).safeCanonicalReference,
        ).toBeUndefined(),
    ],
    [
      '59 Safe projected reference is hidden when disclosure is denied',
      () =>
        expect(
          evaluateProjectionDrift({
            definition: definition(),
            canonicalSnapshot: snapshot(),
            projectedSnapshot: snapshot({ snapshotKind: 'PROJECTED' }),
            evaluatedAt: NOW,
            disclosureAuthorization: { canDiscloseProjectionReferences: false },
          }).safeProjectedReference,
        ).toBeUndefined(),
    ],
    [
      '60 Safe references may be returned when disclosure is allowed',
      () =>
        expect(
          evaluateProjectionDrift({
            definition: definition(),
            canonicalSnapshot: snapshot(),
            projectedSnapshot: snapshot({ snapshotKind: 'PROJECTED' }),
            evaluatedAt: NOW,
            disclosureAuthorization: { canDiscloseProjectionReferences: true },
          }).safeCanonicalReference,
        ).toBe('canonical:test'),
    ],
    [
      '61 Drift evaluation performs no repair',
      () =>
        expect(
          evaluateProjectionDrift({
            definition: definition(),
            canonicalSnapshot: snapshot(),
            projectedSnapshot: snapshot({
              snapshotKind: 'PROJECTED',
              stateValue: 'DRAFT',
            }),
            evaluatedAt: NOW,
          }).repairPerformed,
        ).toBe(false),
    ],
    [
      '62 Deterministic rebuild can become repair-eligible',
      () =>
        expect(
          evaluateProjectionRepairEligibility({
            definition: definition(),
            driftResult: drift(),
            canonicalSnapshot: snapshot(),
            projectedSnapshot: snapshot({ snapshotKind: 'PROJECTED' }),
            requestedRepairMode: 'REBUILD_FROM_CANONICAL',
            authorityEligibility: { eligible: true },
            expectedStateEligibility: { eligible: true },
            historicalProvenanceCompleteness: 'COMPLETE',
            evaluatedAt: NOW,
          }).status,
        ).toBe('ELIGIBLE_FOR_FUTURE_REBUILD'),
    ],
    [
      '63 Nondeterministic derivation blocks automatic rebuild',
      () =>
        expect(
          evaluateProjectionRepairEligibility({
            definition: definition({
              repairPolicy: {
                ...definition().repairPolicy!,
                deterministicDerivationRequired: false,
              },
            }),
            driftResult: drift(),
            canonicalSnapshot: snapshot(),
            requestedRepairMode: 'REBUILD_FROM_CANONICAL',
            authorityEligibility: { eligible: true },
            expectedStateEligibility: { eligible: true },
            historicalProvenanceCompleteness: 'COMPLETE',
            evaluatedAt: NOW,
          }).status,
        ).toBe('DENIED_NONDETERMINISTIC_DERIVATION'),
    ],
    [
      '64 Missing canonical state blocks repair',
      () =>
        expect(
          evaluateProjectionRepairEligibility({
            definition: definition(),
            driftResult: drift(),
            canonicalSnapshot: snapshot({ stateStatus: 'UNKNOWN' }),
            requestedRepairMode: 'REBUILD_FROM_CANONICAL',
            authorityEligibility: { eligible: true },
            expectedStateEligibility: { eligible: true },
            historicalProvenanceCompleteness: 'COMPLETE',
            evaluatedAt: NOW,
          }).status,
        ).toBe('DENIED_CANONICAL_STATE_UNKNOWN'),
    ],
    [
      '65 Missing proven canonical effect blocks replay repair',
      () =>
        expect(
          evaluateProjectionRepairEligibility({
            definition: definition({
              repairPolicy: {
                ...definition().repairPolicy!,
                repairMode: 'REPLAY_PROVEN_CANONICAL_EFFECT',
                provenCanonicalEffectRequired: true,
                permittedDriftStatuses: ['DRIFTED'],
              },
            }),
            driftResult: drift(),
            canonicalSnapshot: snapshot({
              canonicalEffectReference: undefined,
            }),
            requestedRepairMode: 'REPLAY_PROVEN_CANONICAL_EFFECT',
            authorityEligibility: { eligible: true },
            expectedStateEligibility: { eligible: true },
            historicalProvenanceCompleteness: 'COMPLETE',
            evaluatedAt: NOW,
          }).status,
        ).toBe('DENIED_CANONICAL_EFFECT_MISSING'),
    ],
    [
      '66 Stale command blocks repair',
      () =>
        expect(
          evaluateProjectionRepairEligibility({
            definition: definition(),
            driftResult: drift(),
            canonicalSnapshot: snapshot(),
            requestedRepairMode: 'REBUILD_FROM_CANONICAL',
            authorityEligibility: { eligible: true },
            expectedStateEligibility: { eligible: false, stale: true },
            historicalProvenanceCompleteness: 'COMPLETE',
            evaluatedAt: NOW,
          }).status,
        ).toBe('DENIED_STALE_COMMAND'),
    ],
    [
      '67 Missing authority blocks repair',
      () =>
        expect(
          evaluateProjectionRepairEligibility({
            definition: definition(),
            driftResult: drift(),
            canonicalSnapshot: snapshot(),
            requestedRepairMode: 'REBUILD_FROM_CANONICAL',
            authorityEligibility: { eligible: false },
            expectedStateEligibility: { eligible: true },
            historicalProvenanceCompleteness: 'COMPLETE',
            evaluatedAt: NOW,
          }).status,
        ).toBe('DENIED_AUTHORITY'),
    ],
    [
      '68 Unresolved owner blocks repair',
      () =>
        expect(
          evaluateProjectionRepairEligibility({
            definition: definition({
              ownershipStatus: 'UNRESOLVED_OWNER',
              canonicalOwner: null,
              synchronizationStrategy: 'LEGACY_OBSERVED_ONLY',
              writerPolicy: 'OBSERVE_ONLY',
              approvedByRecordId: undefined,
            }),
            driftResult: drift(),
            canonicalSnapshot: snapshot(),
            requestedRepairMode: 'REBUILD_FROM_CANONICAL',
            authorityEligibility: { eligible: true },
            expectedStateEligibility: { eligible: true },
            historicalProvenanceCompleteness: 'COMPLETE',
            evaluatedAt: NOW,
          }).status,
        ).toBe('DENIED_OWNER_UNRESOLVED'),
    ],
    [
      '69 Incomplete history requires manual review or mark-unknown',
      () =>
        expect(
          evaluateProjectionRepairEligibility({
            definition: definition(),
            driftResult: drift(),
            canonicalSnapshot: snapshot(),
            requestedRepairMode: 'REBUILD_FROM_CANONICAL',
            authorityEligibility: { eligible: true },
            expectedStateEligibility: { eligible: true },
            historicalProvenanceCompleteness: 'INCOMPLETE',
            evaluatedAt: NOW,
          }).status,
        ).toBe('MANUAL_REVIEW_REQUIRED'),
    ],
    [
      '70 NO_AUTOMATIC_REPAIR prevents automatic repair',
      () =>
        expect(
          evaluateProjectionRepairEligibility({
            definition: definition({
              repairPolicy: {
                repairMode: 'NO_AUTOMATIC_REPAIR',
                permittedDriftStatuses: ['DRIFTED'],
              },
            }),
            driftResult: drift(),
            canonicalSnapshot: snapshot(),
            requestedRepairMode: 'REBUILD_FROM_CANONICAL',
            authorityEligibility: { eligible: true },
            expectedStateEligibility: { eligible: true },
            historicalProvenanceCompleteness: 'COMPLETE',
            evaluatedAt: NOW,
          }).status,
        ).toBe('DENIED_NO_AUTOMATIC_REPAIR'),
    ],
    [
      '71 Repair does not create a Governance Decision',
      () =>
        expect(
          evaluateProjectionRepairEligibility({
            definition: definition(),
            driftResult: drift(),
            canonicalSnapshot: snapshot(),
            requestedRepairMode: 'REBUILD_FROM_CANONICAL',
            authorityEligibility: { eligible: true },
            expectedStateEligibility: { eligible: true },
            historicalProvenanceCompleteness: 'COMPLETE',
            evaluatedAt: NOW,
          }).createsGovernanceDecision,
        ).toBe(false),
    ],
    [
      '72 Repair does not fabricate an approver',
      () =>
        expect(
          evaluateProjectionRepairEligibility({
            definition: definition(),
            driftResult: drift(),
            canonicalSnapshot: snapshot(),
            requestedRepairMode: 'REBUILD_FROM_CANONICAL',
            authorityEligibility: { eligible: true },
            expectedStateEligibility: { eligible: true },
            historicalProvenanceCompleteness: 'COMPLETE',
            evaluatedAt: NOW,
          }),
        ).not.toHaveProperty('inventedApprover'),
    ],
    [
      '73 Repair does not fabricate rationale',
      () =>
        expect(
          evaluateProjectionRepairEligibility({
            definition: definition(),
            driftResult: drift(),
            canonicalSnapshot: snapshot(),
            requestedRepairMode: 'REBUILD_FROM_CANONICAL',
            authorityEligibility: { eligible: true },
            expectedStateEligibility: { eligible: true },
            historicalProvenanceCompleteness: 'COMPLETE',
            evaluatedAt: NOW,
          }),
        ).not.toHaveProperty('inventedRationale'),
    ],
    [
      '74 Repair does not fabricate historical timestamps',
      () =>
        expect(
          evaluateProjectionRepairEligibility({
            definition: definition(),
            driftResult: drift(),
            canonicalSnapshot: snapshot(),
            requestedRepairMode: 'REBUILD_FROM_CANONICAL',
            authorityEligibility: { eligible: true },
            expectedStateEligibility: { eligible: true },
            historicalProvenanceCompleteness: 'COMPLETE',
            evaluatedAt: NOW,
          }),
        ).not.toHaveProperty('inventedHistoricalTimestamp'),
    ],
    [
      '75 Legacy observation records observed value only',
      () =>
        expect(validateLegacyProjectionObservation(observation()).valid).toBe(
          true,
        ),
    ],
    [
      '76 Legacy observation cannot satisfy Governance Decision contract',
      () =>
        expect(
          validateLegacyProjectionObservation({
            ...observation(),
            decisionRationale: 'invented',
          } as LegacyProjectionObservation).valid,
        ).toBe(false),
    ],
    [
      '77 Legacy observation cannot fabricate authority assignment',
      () =>
        expect(
          validateLegacyProjectionObservation({
            ...observation(),
            authorityAssignment: 'aa-1',
          } as LegacyProjectionObservation).valid,
        ).toBe(false),
    ],
    [
      '78 Partial inventory preserves unknown-writer risk',
      () =>
        expect(validateProjectionInventoryEntry(inventoryEntry()).valid).toBe(
          true,
        ),
    ],
    [
      '79 Unknown inventory preserves unknown-writer risk',
      () =>
        expect(
          validateProjectionInventoryEntry(
            inventoryEntry({
              inventoryCompleteness: 'UNKNOWN',
              unknownWriterRisk: true,
            }),
          ).valid,
        ).toBe(true),
    ],
    [
      '80 Empty incomplete inventory is not proof of no writers',
      () =>
        expect(
          validateProjectionInventoryEntry(
            inventoryEntry({
              knownDirectWriteLocations: [],
              inventoryCompleteness: 'PARTIAL',
              unknownWriterRisk: false,
            }),
          ).valid,
        ).toBe(false),
    ],
    [
      '81 Missing consumers are not proof that projection is unused',
      () =>
        expect(
          validateProjectionDeprecation({
            definition: definition({
              synchronizationStrategy: 'DEPRECATED',
              ownershipStatus: 'DEPRECATED_NO_OWNER_REQUIRED',
              canonicalOwner: null,
              writerPolicy: 'NO_WRITES',
              deprecationCriteria: {
                consumerRemovalRequired: true,
                noCurrentGovernedConsumerMayDepend: true,
              },
            }),
            inventory: createProjectionInventory([
              inventoryEntry({
                knownReadConsumers: [],
                inventoryCompleteness: 'PARTIAL',
              }),
            ]),
            consumerRemovalEvidence: ['removed'],
          }).status,
        ).toBe('NOT_READY_INCOMPLETE_INVENTORY'),
    ],
    [
      '82 Complete inventory requires evidence',
      () =>
        expect(
          validateProjectionInventoryEntry(
            inventoryEntry({
              inventoryCompleteness: 'COMPLETE',
              unknownWriterRisk: false,
            }),
          ).valid,
        ).toBe(true),
    ],
    [
      '83 Deprecated projection with active consumers is not ready',
      () =>
        expect(
          validateProjectionDeprecation({
            definition: definition({
              synchronizationStrategy: 'DEPRECATED',
              ownershipStatus: 'DEPRECATED_NO_OWNER_REQUIRED',
              canonicalOwner: null,
              writerPolicy: 'NO_WRITES',
              deprecationCriteria: {
                consumerRemovalRequired: true,
                noCurrentGovernedConsumerMayDepend: true,
              },
            }),
            inventory: createProjectionInventory([
              inventoryEntry({
                inventoryCompleteness: 'COMPLETE',
                unknownWriterRisk: false,
                knownReadConsumers: ['consumer'],
              }),
            ]),
            consumerRemovalEvidence: ['removed'],
          }).status,
        ).toBe('NOT_READY_ACTIVE_CONSUMERS'),
    ],
    [
      '84 Deprecated projection with incomplete inventory is not ready',
      () =>
        expect(
          validateProjectionDeprecation({
            definition: definition({
              synchronizationStrategy: 'DEPRECATED',
              ownershipStatus: 'DEPRECATED_NO_OWNER_REQUIRED',
              canonicalOwner: null,
              writerPolicy: 'NO_WRITES',
              deprecationCriteria: {
                consumerRemovalRequired: true,
                noCurrentGovernedConsumerMayDepend: true,
              },
            }),
            inventory: createProjectionInventory([
              inventoryEntry({
                knownReadConsumers: [],
                inventoryCompleteness: 'UNKNOWN',
              }),
            ]),
            consumerRemovalEvidence: ['removed'],
          }).status,
        ).toBe('NOT_READY_INCOMPLETE_INVENTORY'),
    ],
    [
      '85 Deprecation criteria and consumer-removal evidence can establish future readiness',
      () =>
        expect(
          validateProjectionDeprecation({
            definition: definition({
              synchronizationStrategy: 'DEPRECATED',
              ownershipStatus: 'DEPRECATED_NO_OWNER_REQUIRED',
              canonicalOwner: null,
              writerPolicy: 'NO_WRITES',
              deprecationCriteria: {
                consumerRemovalRequired: true,
                noCurrentGovernedConsumerMayDepend: true,
              },
            }),
            inventory: createProjectionInventory([
              inventoryEntry({
                knownReadConsumers: [],
                inventoryCompleteness: 'COMPLETE',
                unknownWriterRisk: false,
              }),
            ]),
            consumerRemovalEvidence: ['removed'],
          }).status,
        ).toBe('READY_FOR_FUTURE_DEPRECATION'),
    ],
    [
      '86 OD-018 decision compatibility remains intact',
      () =>
        expect(definition().canonicalOwner?.canonicalOwnerDecisionType).toBe(
          'APPROVAL_DECISION',
        ),
    ],
    [
      '87 OD-022 external-authority compatibility remains intact',
      () =>
        expect(
          resolveProjectionWriteEligibility({
            definition: definition(),
            authorityEligibility: {
              eligible: false,
              reasons: ['EXTERNAL_AUTHORITY_DENIED'],
            },
            requestedAt: NOW,
          }).status,
        ).toBe('DENIED_AUTHORITY'),
    ],
    [
      '88 OD-023 stale-command compatibility remains intact',
      () =>
        expect(
          resolveProjectionWriteEligibility({
            definition: definition(),
            commandEligibility: { status: 'REJECTED_STALE_PRECONDITION' },
            requestedAt: NOW,
          }).projectionUpdated,
        ).toBe(false),
    ],
    [
      '89 No test implies projection persistence',
      () =>
        expect(
          readFileSync(
            join(__dirname, 'compatibility-projection.types.ts'),
            'utf8',
          ),
        ).not.toMatch(/Prisma|Repository/),
    ],
    [
      '90 No test implies synchronization',
      () => {
        const source = readFileSync(
          join(__dirname, 'compatibility-projection.writer-policy.ts'),
          'utf8',
        );
        expect(source.includes('update(')).toBe(false);
        expect(source.includes('save(')).toBe(false);
      },
    ],
    [
      '91 No test implies repair execution',
      () =>
        expect(
          evaluateProjectionRepairEligibility({
            definition: definition(),
            driftResult: drift(),
            canonicalSnapshot: snapshot(),
            requestedRepairMode: 'REBUILD_FROM_CANONICAL',
            authorityEligibility: { eligible: true },
            expectedStateEligibility: { eligible: true },
            historicalProvenanceCompleteness: 'COMPLETE',
            evaluatedAt: NOW,
          }).repairPerformed,
        ).toBe(false),
    ],
    [
      '92 No test implies direct-write enforcement',
      () =>
        expect(readFileSync(join(__dirname, 'index.ts'), 'utf8')).not.toMatch(
          /Guard|Controller|Service/,
        ),
    ],
    [
      '93 No test creates an invented production canonical owner',
      () =>
        expect(
          (
            readJson(
              'docs/weos/compatibility-projections/projection-registry.json',
            ) as { definitions: unknown[] }
          ).definitions,
        ).toHaveLength(0),
    ],
    [
      '94 No runtime import exists outside the contract island',
      () =>
        expect(APPROVED_OPTION_ID).toBe(
          'OPTION_D_TRANSITIONAL_HYBRID_CANONICAL_OWNER_AND_CONTROLLED_PROJECTIONS',
        ),
    ],
  ];

  it.each(cases)('%s', (_name, run) => run());

  it('registry helpers resolve approved definitions without filesystem access', () => {
    const registry = createCompatibilityProjectionRegistry([definition()]);
    expect(
      findCompatibilityProjectionDefinition(
        registry,
        'CASE_EDITORIAL_STATUS',
        '1.0.0',
      )?.status,
    ).toBe('APPROVED');
    expect(
      requireApprovedProjectionDefinition(
        registry,
        'CASE_EDITORIAL_STATUS',
        '1.0.0',
      ).errors,
    ).toEqual([]);
    expect(
      registerCompatibilityProjectionDefinition(registry, definition()).result
        .valid,
    ).toBe(false);
    expect(validateProjectionInventory(createProjectionInventory()).valid).toBe(
      true,
    );
  });
});
