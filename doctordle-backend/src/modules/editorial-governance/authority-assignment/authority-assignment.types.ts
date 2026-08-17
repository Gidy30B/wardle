import type {
  ACTOR_TYPES,
  ASSIGNMENT_STATUSES,
  AUTHORITY_TYPE_STATUSES,
  SCOPE_DIMENSIONS,
  SCOPE_MODES,
} from './authority-assignment.constants';

export type ActorType = (typeof ACTOR_TYPES)[number];
export type SubjectType = ActorType;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];
export type ScopeMode = (typeof SCOPE_MODES)[number];
export type AuthorityTypeStatus = (typeof AUTHORITY_TYPE_STATUSES)[number];
export type ScopeDimension = (typeof SCOPE_DIMENSIONS)[number];

export interface ValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface AuthorityScope {
  organizationIds?: string[];
  specialtyIds?: string[];
  artifactTypes?: string[];
  artifactIds?: string[];
  artifactRevisionIds?: string[];
  decisionTypes?: string[];
  environmentScopes?: string[];
}

export interface AuthorityAssignment {
  assignmentId: string;
  assignmentSchemaVersion: '1.0.0';
  subjectType: SubjectType;
  subjectId: string;
  authorityType: string;
  authorityTypeSchemaVersion: string;
  status: AssignmentStatus;
  scopeMode: ScopeMode;
  scope: AuthorityScope;
  allowedDecisionTypes: string[];
  authorityEvidenceReference: string;
  grantingAuthoritySnapshot: Record<string, unknown>;
  grantedByActorType: ActorType;
  grantedByActorId: string;
  grantingAuthorityAssignmentId: string;
  grantedAt: string;
  validFrom: string;
  validUntil?: string;
  reviewDueAt?: string;
  rationale: string;
  delegationAllowed: boolean;
  maximumDelegationDepth: number;
  parentAssignmentId?: string;
  humanAuthorityActorId?: string;
  suspendedAt?: string;
  revokedAt?: string;
  revokedByActorId?: string;
  supersededByAssignmentId?: string;
}

export interface AuthorityAssignmentCollection {
  schemaVersion: '1.0.0';
  collectionStatus: string;
  assignments: AuthorityAssignment[];
}

export interface AuthorityTypeDefinition {
  authorityType: string;
  authorityTypeSchemaVersion: string;
  status: AuthorityTypeStatus;
  allowedDecisionTypes: string[];
  requiredScopeDimensions: ScopeDimension[];
  permitsGlobalScope: boolean;
  requiresHumanAuthority: boolean;
  permittedSubjectTypes: SubjectType[];
  permitsDelegation: boolean;
  maximumDelegationDepth: number;
  grantableAuthorityTypes: string[];
  maximumGrantValidityDuration?: string;
  requiresEnhancedGrantEvidence: boolean;
  separationOfDutiesRules: string[];
  conditionsSchemaReference?: string;
}

export interface AuthorityTypeRegistry {
  definitions: AuthorityTypeDefinition[];
}

export interface ActorCommandContext {
  actorType: ActorType;
  actorId: string;
  runtimeRoles: string[];
  organizationContextIds: string[];
  specialtyContextIds: string[];
  authorityAssignmentReferences: string[];
  correlationId: string;
  causationId: string;
  requestedAt: string;
}

export interface GovernedAuthorityRequest {
  authorityType: string;
  decisionType: string;
  organizationId?: string;
  specialtyId?: string;
  artifactType?: string;
  artifactId?: string;
  artifactRevisionId?: string;
  environmentScope?: string;
}

export interface ScopeEvaluationResult {
  matches: boolean;
  reasons: string[];
}

export interface AuthorityEvidenceSnapshot {
  authorityAssignmentId: string;
  authorityEvidenceReference: string;
  authorityScopeSnapshot: AuthorityScope;
  authorityResolvedAt: string;
}

export interface AuthorityResolutionResult {
  status: 'AUTHORIZED' | 'DENIED';
  reasons: string[];
  assignment?: AuthorityAssignment;
  od018AuthorityEvidence?: AuthorityEvidenceSnapshot;
}

export interface ResolveGovernedAuthorityInput {
  actorContext: ActorCommandContext;
  assignments: AuthorityAssignment[];
  authorityTypeRegistry: AuthorityTypeRegistry;
  request: GovernedAuthorityRequest;
  evaluatedAt: string;
  hasRequiredTechnicalAccess: boolean;
}

export interface GrantValidationRequest {
  grantorAssignment: AuthorityAssignment;
  proposedAssignment: AuthorityAssignment;
  authorityTypeRegistry: AuthorityTypeRegistry;
  evaluatedAt: string;
}

export interface DelegationValidationRequest {
  parentAssignment: AuthorityAssignment;
  childAssignment: AuthorityAssignment;
  assignmentSet: AuthorityAssignment[];
  authorityTypeRegistry: AuthorityTypeRegistry;
  evaluatedAt: string;
}

export interface SeparationOfDutiesContext {
  rules: string[];
  authorActorId?: string;
  requesterActorId?: string;
  finalAuthorityActorId?: string;
  assignmentRequesterActorId?: string;
  grantApproverActorId?: string;
  protectedFieldRequesterActorId?: string;
  protectedFieldApproverActorId?: string;
}
