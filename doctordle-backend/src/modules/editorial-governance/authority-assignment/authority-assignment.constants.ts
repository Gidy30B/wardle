export const ACTOR_TYPES = [
  'USER',
  'SERVICE_ACCOUNT',
  'AUTOMATION',
  'SYSTEM',
] as const;
export const ASSIGNMENT_STATUSES = [
  'PENDING',
  'ACTIVE',
  'SUSPENDED',
  'EXPIRED',
  'REVOKED',
  'SUPERSEDED',
  'INVALID',
] as const;
export const AUTHORITY_TYPE_STATUSES = [
  'DRAFT',
  'APPROVED',
  'DEPRECATED',
  'WITHDRAWN',
] as const;
export const SCOPE_MODES = ['SCOPED', 'GLOBAL'] as const;
export const SCOPE_DIMENSIONS = [
  'organizationIds',
  'specialtyIds',
  'artifactTypes',
  'artifactIds',
  'artifactRevisionIds',
  'decisionTypes',
  'environmentScopes',
] as const;
export const RUNTIME_ROLE_NAMES = [
  'USER',
  'EDITOR',
  'SENIOR_EDITOR',
  'ADMIN',
] as const;
export const AUTHORITY_ASSIGNMENT_GRANT = 'AUTHORITY_ASSIGNMENT_GRANT';
export const APPROVED_OPTION_ID =
  'OPTION_D_HYBRID_TECHNICAL_ACCESS_AND_SCOPED_AUTHORITY';

export const SEPARATION_OF_DUTIES_RULES = [
  'AUTHOR_CANNOT_BE_SOLE_FINAL_APPROVER',
  'REQUESTER_CANNOT_BE_FINAL_AUTHORITY',
  'ASSIGNMENT_REQUESTER_CANNOT_BE_SOLE_GRANT_APPROVER',
  'PROTECTED_FIELD_REQUESTER_AND_APPROVER_MUST_DIFFER',
] as const;
