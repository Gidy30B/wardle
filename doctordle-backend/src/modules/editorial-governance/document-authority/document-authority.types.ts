import type {
  DOCUMENT_APPROVAL_OUTCOMES,
  DOCUMENT_AUTHORITY_ERROR_CODES,
  DOCUMENT_AUTHORITY_RECORD_TYPES,
  DOCUMENT_AUTHORITY_STATUSES,
  IMPLEMENTATION_AUTHORIZATIONS,
  PROTECTED_FIELD_EXCEPTION_STATUSES,
} from './document-authority.constants';

export type DocumentAuthorityRecordType =
  (typeof DOCUMENT_AUTHORITY_RECORD_TYPES)[keyof typeof DOCUMENT_AUTHORITY_RECORD_TYPES];

export type DocumentApprovalOutcome =
  (typeof DOCUMENT_APPROVAL_OUTCOMES)[keyof typeof DOCUMENT_APPROVAL_OUTCOMES];

export type ImplementationAuthorization =
  (typeof IMPLEMENTATION_AUTHORIZATIONS)[keyof typeof IMPLEMENTATION_AUTHORIZATIONS];

export type ProtectedFieldExceptionStatus =
  (typeof PROTECTED_FIELD_EXCEPTION_STATUSES)[keyof typeof PROTECTED_FIELD_EXCEPTION_STATUSES];

export type DocumentAuthorityStatus =
  (typeof DOCUMENT_AUTHORITY_STATUSES)[keyof typeof DOCUMENT_AUTHORITY_STATUSES];

export type DocumentAuthorityErrorCode =
  (typeof DOCUMENT_AUTHORITY_ERROR_CODES)[keyof typeof DOCUMENT_AUTHORITY_ERROR_CODES];

export type DocumentReference = Readonly<{
  documentId: string;
  documentVersion: string;
  documentPath: string;
}>;

export type AuthorityActor = Readonly<{
  name: string;
  role: string;
  authorityBasis: string;
}>;

export type ApprovalScope = Readonly<{
  scopeType: string;
  description: string;
}>;

export type BootstrapAuthority = Readonly<{
  isBootstrap: boolean;
  scope: string;
  expiryCondition: string;
}>;

export type DocumentApprovalRecord = Readonly<{
  recordId: string;
  recordType: 'DOCUMENT_APPROVAL';
  schemaVersion: string;
  documentId: string;
  documentVersion: string;
  documentPath: string;
  approvalScope: ApprovalScope;
  approvalOutcome: DocumentApprovalOutcome;
  approver: AuthorityActor;
  approverAuthority: string;
  approvalDate: string;
  effectiveDate: string;
  rationale: string;
  conditions: readonly string[];
  supportingDecision: string;
  implementationAuthorization: ImplementationAuthorization;
  bootstrapAuthority: BootstrapAuthority;
  createdAt: string;
}>;

export type DownstreamObligation = Readonly<{
  regenerate: boolean;
  revalidate: boolean;
  updateReferences: boolean;
  reviewDependentDecisions: boolean;
  notes: string;
}>;

export type DocumentSupersessionRecord = Readonly<{
  recordId: string;
  recordType: 'DOCUMENT_SUPERSESSION';
  schemaVersion: string;
  supersedingDocument: DocumentReference;
  supersededDocument: DocumentReference;
  supersessionScope: string;
  effectiveDate: string;
  rationale: string;
  approver: AuthorityActor;
  approverAuthority: string;
  supportingDecision: string;
  downstreamObligations: DownstreamObligation;
  createdAt: string;
}>;

export type ProtectedFieldExceptionRecord = Readonly<{
  recordId: string;
  recordType: 'PROTECTED_FIELD_EXCEPTION';
  schemaVersion: string;
  protectedArtifact: string;
  protectedField: string;
  currentValue: unknown;
  proposedValue: unknown;
  changeRationale: string;
  impactAssessment: string;
  requester: AuthorityActor;
  reviewer: AuthorityActor;
  approver: AuthorityActor;
  status: ProtectedFieldExceptionStatus;
  effectiveDate: string;
  requiredRegeneration: readonly string[];
  requiredRevalidation: readonly string[];
  rollbackConditions: string;
  supportingDecision: string;
  createdAt: string;
}>;

export type AuthorityRecord =
  | DocumentApprovalRecord
  | DocumentSupersessionRecord
  | ProtectedFieldExceptionRecord;

export type AuthorityConflict = Readonly<{
  code: string;
  message: string;
  recordIds: readonly string[];
}>;

export type AuthorityValidationError = Readonly<{
  code: DocumentAuthorityErrorCode;
  path: string;
  message: string;
}>;

export type AuthorityValidationResult<
  TRecord extends AuthorityRecord = AuthorityRecord,
> = Readonly<{
  valid: boolean;
  record?: TRecord;
  errors: readonly AuthorityValidationError[];
}>;

export type AuthorityRecordSetValidationResult = Readonly<{
  valid: boolean;
  errors: readonly AuthorityValidationError[];
}>;

export type ResolveDocumentAuthorityInput = Readonly<{
  document: DocumentReference;
  approvalRecords: readonly unknown[];
  supersessionRecords: readonly unknown[];
  requestedScope?: string;
}>;

export type DocumentAuthorityResolution = Readonly<{
  status: DocumentAuthorityStatus;
  document: DocumentReference;
  effectiveApproval?: DocumentApprovalRecord;
  applicableSupersession?: DocumentSupersessionRecord;
  conditions: readonly string[];
  conflicts: readonly AuthorityConflict[];
  reasons: readonly string[];
}>;
