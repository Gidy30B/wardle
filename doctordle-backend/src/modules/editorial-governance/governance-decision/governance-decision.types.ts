export type GovernanceDecisionStatus = 'DRAFT' | 'FINALIZED';
export type ExtensionApprovalState =
  | 'DRAFT'
  | 'APPROVED_WITH_CONDITIONS'
  | 'APPROVED'
  | 'RETIRED';
export type ProductionAuthority = 'NOT_GRANTED' | 'GRANTED';
export type DecisionStanding =
  | 'ACTIVE'
  | 'SUPERSEDED'
  | 'PARTIALLY_SUPERSEDED'
  | 'CONFLICTING'
  | 'INVALID';

export type GovernanceTargetReference = Readonly<{
  artifactType: string;
  artifactId: string;
  artifactRevisionId?: string;
  targetScope: string;
}>;

export type GovernanceSupersessionReference = Readonly<{
  decisionId: string;
  supersessionScope: string;
  rationale?: string;
  evidenceReference?: string;
}>;

export type GovernanceDecisionActor = Readonly<{
  actorType: string;
  actorId: string;
}>;

export type GovernanceDecisionAuthority = Readonly<{
  humanAuthorityActorId?: string;
  authorityAssignmentId: string;
  authorityEvidenceReference: string;
  authorityScopeSnapshot: string;
  authorityResolvedAt: string;
}>;

export type GovernanceDecisionEnvelope = Readonly<{
  decisionId: string;
  envelopeSchemaVersion: string;
  extensionType: string;
  extensionSchemaVersion: string;
  decisionType: string;
  status: GovernanceDecisionStatus;
  primaryTarget: GovernanceTargetReference;
  targetReferences: readonly GovernanceTargetReference[];
  actor: GovernanceDecisionActor;
  authority: GovernanceDecisionAuthority;
  rationale: string;
  findings: readonly string[];
  outcome: string;
  effectiveAction: string;
  obligations?: readonly string[];
  supersessionReferences?: readonly GovernanceSupersessionReference[];
  extensionPayload: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
}>;

export type GovernanceDecisionExtensionPolicy = Readonly<{
  extensionType: string;
  extensionSchemaVersion: string;
  approvalState: ExtensionApprovalState;
  productionAuthority: ProductionAuthority;
  allowedDecisionTypes: readonly string[];
  allowedOutcomes: readonly string[];
  allowedEffectiveActions: readonly string[];
  requiresExactRevision: boolean;
  permitsNonHumanAuthority: boolean;
  allowedSupersessionScopes: readonly string[];
  validateExtensionPayload: (
    payload: Record<string, unknown>,
  ) => readonly string[];
}>;

export type GovernanceDecisionExtensionRegistry = Readonly<{
  policies: readonly GovernanceDecisionExtensionPolicy[];
}>;

export type GovernanceDecisionValidationError = Readonly<{
  code: string;
  path: string;
  message: string;
}>;

export type GovernanceDecisionValidationResult = Readonly<{
  valid: boolean;
  errors: readonly GovernanceDecisionValidationError[];
}>;
