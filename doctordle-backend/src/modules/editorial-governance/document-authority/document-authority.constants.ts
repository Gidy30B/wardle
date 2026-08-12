export const DOCUMENT_AUTHORITY_RECORD_TYPES = {
  DOCUMENT_APPROVAL: 'DOCUMENT_APPROVAL',
  DOCUMENT_SUPERSESSION: 'DOCUMENT_SUPERSESSION',
  PROTECTED_FIELD_EXCEPTION: 'PROTECTED_FIELD_EXCEPTION',
} as const;

export const DOCUMENT_APPROVAL_OUTCOMES = {
  APPROVED: 'APPROVED',
  APPROVED_WITH_CONDITIONS: 'APPROVED_WITH_CONDITIONS',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN',
} as const;

export const IMPLEMENTATION_AUTHORIZATIONS = {
  NOT_GRANTED: 'NOT_GRANTED',
  GRANTED_FOR_STAGE_1_CONTRACTS_ONLY: 'GRANTED_FOR_STAGE_1_CONTRACTS_ONLY',
  GRANTED_FOR_NAMED_STAGE: 'GRANTED_FOR_NAMED_STAGE',
  GRANTED: 'GRANTED',
} as const;

export const PROTECTED_FIELD_EXCEPTION_STATUSES = {
  REQUESTED: 'REQUESTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN',
  IMPLEMENTED: 'IMPLEMENTED',
  ROLLED_BACK: 'ROLLED_BACK',
} as const;

export const DOCUMENT_AUTHORITY_STATUSES = {
  AUTHORITATIVE: 'AUTHORITATIVE',
  APPROVED_WITH_CONDITIONS: 'APPROVED_WITH_CONDITIONS',
  SUPERSEDED: 'SUPERSEDED',
  UNAPPROVED: 'UNAPPROVED',
  UNRESOLVED: 'UNRESOLVED',
  CONFLICTING: 'CONFLICTING',
  INVALID_RECORD: 'INVALID_RECORD',
} as const;

export const DOCUMENT_AUTHORITY_ERROR_CODES = {
  REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',
  INVALID_RECORD_TYPE: 'INVALID_RECORD_TYPE',
  INVALID_CONTROLLED_VALUE: 'INVALID_CONTROLLED_VALUE',
  INVALID_DATE: 'INVALID_DATE',
  EMPTY_RATIONALE: 'EMPTY_RATIONALE',
  MISSING_CONDITIONS: 'MISSING_CONDITIONS',
  INVALID_BOOTSTRAP_AUTHORITY: 'INVALID_BOOTSTRAP_AUTHORITY',
  SELF_SUPERSESSION: 'SELF_SUPERSESSION',
  MISSING_APPROVER_AUTHORITY: 'MISSING_APPROVER_AUTHORITY',
  REVIEWER_NOT_INDEPENDENT: 'REVIEWER_NOT_INDEPENDENT',
  DUPLICATE_RECORD_ID: 'DUPLICATE_RECORD_ID',
  CONFLICTING_ACTIVE_APPROVAL: 'CONFLICTING_ACTIVE_APPROVAL',
  NONEXISTENT_RECORD_REFERENCE: 'NONEXISTENT_RECORD_REFERENCE',
  INVALID_SHAPE: 'INVALID_SHAPE',
} as const;

export const AUTHORITY_PRINCIPLES = [
  'An explicit valid approval record establishes authority only for the stated document, version and scope.',
  'An explicit valid supersession record replaces authority only within its stated scope.',
  'Generated documentation has no independent authority.',
  'Runtime code proves current behavior but does not supersede architecture.',
  'Review status does not equal approval.',
  'Modification date does not establish precedence.',
  'File format does not establish precedence.',
  'Repository ownership, GitHub role and runtime role do not establish governance authority.',
  'Where no valid approval or supersession record exists, authority remains unresolved.',
  'An unresolved conflict blocks irreversible, destructive, publication-sensitive or governance-sensitive work.',
  'Audit events cannot substitute for approval or supersession records.',
  'Historical approval, rationale or authority must never be invented during backfill.',
] as const;
