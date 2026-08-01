import type {
  BATCH_POLICIES,
  COMMAND_CONTRACT_STATUSES,
  CURRENT_STATE_STATUSES,
  GOVERNED_COMMAND_RESOLUTION_STATUSES,
  IDEMPOTENCY_POLICIES,
  PRECONDITION_MODES,
  PRIOR_RESULT_STATUSES,
} from './governed-command.constants';
import type { ActorCommandContext } from '../authority-assignment';

export type GovernedCommandContractStatus =
  (typeof COMMAND_CONTRACT_STATUSES)[number];
export type GovernedCommandPreconditionMode =
  (typeof PRECONDITION_MODES)[number];
export type IdempotencyPolicy = (typeof IDEMPOTENCY_POLICIES)[number];
export type GovernedBatchPolicy = (typeof BATCH_POLICIES)[number];
export type CurrentDependencyStateStatus =
  (typeof CURRENT_STATE_STATUSES)[number];
export type IdempotencyRecordStatus = (typeof PRIOR_RESULT_STATUSES)[number];
export type GovernedCommandResolutionStatus =
  (typeof GOVERNED_COMMAND_RESOLUTION_STATUSES)[number];

export interface GovernedCommandValidationError {
  code: string;
  path: string;
  message: string;
}
export interface GovernedCommandValidationResult {
  valid: boolean;
  errors: GovernedCommandValidationError[];
}
export interface GovernedCommandTargetReference {
  artifactType: string;
  artifactId: string;
  artifactRevisionId?: string;
  targetScope: string;
}
export interface GovernedCommandConcurrencyPrecondition {
  target: GovernedCommandTargetReference;
  preconditionMode: GovernedCommandPreconditionMode;
  dependencyRole: string;
  expectedRevisionId?: string;
  expectedVersion?: number;
  expectedToken?: string;
  tokenPolicyType?: string;
  tokenPolicyVersion?: string;
}
export interface GovernedCommand {
  commandId: string;
  commandType: string;
  commandContractVersion: string;
  actorContext: ActorCommandContext | Record<string, unknown>;
  authorityResolutionReference: Record<string, unknown>;
  primaryTarget: GovernedCommandTargetReference;
  concurrencyPreconditions: GovernedCommandConcurrencyPrecondition[];
  requestedEffect: Record<string, unknown>;
  payloadHash: string;
  idempotencyKey?: string | null;
  submittedAt: string;
  correlationId: string;
  causationId: string;
}
export interface TargetPolicy {
  allowedArtifactTypes: string[];
  primaryTargetPreconditionRequired: boolean;
  primaryTargetMode: GovernedCommandPreconditionMode;
  revisionedArtifactTypes: string[];
}
export interface DependencyPolicy {
  declaredDependencyRoles: string[];
  requiredDependencyRoles: string[];
  permittedPreconditionModes: GovernedCommandPreconditionMode[];
  permittedTokenPolicies: string[];
  requiresCompleteDependencyCoverage: boolean;
}
export interface StaleResultPolicy {
  staleStatus: 'REJECTED_STALE_PRECONDITION';
  exposeSafeCurrentStateOnlyWhenAuthorized: boolean;
}
export interface GovernedCommandContractDefinition {
  commandType: string;
  commandContractVersion: string;
  status: GovernedCommandContractStatus;
  targetPolicy: TargetPolicy;
  dependencyPolicy: DependencyPolicy;
  idempotencyPolicy: IdempotencyPolicy;
  batchPolicy: GovernedBatchPolicy;
  staleResultPolicy: StaleResultPolicy;
}
export interface GovernedCommandContractRegistry {
  definitions: GovernedCommandContractDefinition[];
}
export interface ConcurrencyTokenPolicyDefinition {
  tokenPolicyType: string;
  tokenPolicyVersion: string;
  status: GovernedCommandContractStatus;
  coveredDependencyRoles: string[];
  coveredArtifactTypes: string[];
  tokenSemantics: string;
  requiresCompleteDependencyCoverage: boolean;
}
export interface ConcurrencyTokenPolicyRegistry {
  definitions: ConcurrencyTokenPolicyDefinition[];
}
export interface CurrentDependencyState {
  target: GovernedCommandTargetReference;
  dependencyRole: string;
  status: CurrentDependencyStateStatus;
  currentRevisionId?: string;
  currentVersion?: number;
  currentToken?: string;
  tokenPolicyType?: string;
  tokenPolicyVersion?: string;
  safeCurrentStateReference?: Record<string, unknown>;
}
export interface IdempotencyRecord {
  idempotencyKey: string;
  commandFingerprint: string;
  commandId: string;
  commandType: string;
  resultStatus: IdempotencyRecordStatus;
  resultReference: string;
  recordedAt: string;
}
export type IdempotencyDisposition =
  | 'CONTINUE'
  | 'REPLAY_OF_SUCCESSFUL_COMMAND'
  | 'REPLAY_OF_REJECTED_COMMAND'
  | 'REJECTED_IDEMPOTENCY_CONFLICT'
  | 'INVALID';
export interface IdempotencyResolution {
  disposition: IdempotencyDisposition;
  reasons: string[];
  mayCreateGovernanceDecision: false;
  mayCreateMutation: false;
  mayUpdateProjection: false;
}
export interface CommandFingerprintInput {
  commandType: string;
  commandContractVersion: string;
  authorityReference: unknown;
  primaryTarget: GovernedCommandTargetReference;
  concurrencyPreconditions: GovernedCommandConcurrencyPrecondition[];
  requestedEffect: Record<string, unknown>;
  payloadHash: string;
}
export interface AuthorityEligibilityInput {
  eligible: boolean;
  authorityResolutionReference?: Record<string, unknown>;
  reasons?: string[];
}
export interface DisclosureAuthorizationInput {
  canDiscloseCurrentState: boolean;
}
export interface GovernedCommandConflict {
  dependencyRole: string;
  reason: string;
  safeCurrentStateReference?: Record<string, unknown>;
}
export interface PreconditionEvaluationResult {
  validatedPreconditions: GovernedCommandConcurrencyPrecondition[];
  stalePreconditions: GovernedCommandConflict[];
  unknownPreconditions: GovernedCommandConflict[];
  safeCurrentStateReferences: Record<string, unknown>[];
  reasons: string[];
}
export interface GovernedCommandResolutionResult {
  status: GovernedCommandResolutionStatus;
  reasons: string[];
  mayCreateGovernanceDecision: boolean;
  mayCreateMutation: boolean;
  mayUpdateProjection: boolean;
  eligibleForFutureAtomicApplication: boolean;
  conflicts: GovernedCommandConflict[];
}
export interface GovernedBatchCommand {
  command: GovernedCommand;
  authorityEligibility: AuthorityEligibilityInput;
}
export interface GovernedBatchResolution {
  status: 'BATCH_ELIGIBLE' | 'BATCH_REJECTED' | 'BATCH_PROHIBITED';
  reasons: string[];
  itemResults: GovernedCommandResolutionResult[];
  noPartialApplication: boolean;
}
