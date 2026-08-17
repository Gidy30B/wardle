import {
  ACTOR_TYPES,
  ASSIGNMENT_STATUSES,
  AUTHORITY_TYPE_STATUSES,
  RUNTIME_ROLE_NAMES,
  SCOPE_DIMENSIONS,
  SCOPE_MODES,
} from './authority-assignment.constants';
import {
  findAuthorityTypeDefinition,
  isApprovedAuthorityTypeDefinition,
} from './authority-assignment.registry';
import type {
  ActorCommandContext,
  AuthorityAssignment,
  AuthorityTypeDefinition,
  AuthorityTypeRegistry,
  ValidationIssue,
  ValidationResult,
} from './authority-assignment.types';

type IssueBag = ValidationIssue[];

const ok = (issues: IssueBag): ValidationResult => ({
  valid: issues.length === 0,
  issues,
});
const issue = (
  issues: IssueBag,
  code: string,
  path: string,
  message: string,
): void => {
  issues.push({ code, path, message });
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const nonEmpty = (value: unknown): value is string =>
  isString(value) && value.trim().length > 0;
const isIsoDate = (value: string): boolean =>
  !Number.isNaN(Date.parse(value)) && /^\d{4}-\d{2}-\d{2}T/.test(value);
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(nonEmpty);
const hasItems = (value: unknown): value is string[] =>
  isStringArray(value) && value.length > 0;
const includes = <T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] => isString(value) && values.includes(value);

const requireString = (
  issues: IssueBag,
  value: unknown,
  path: string,
): void => {
  if (!nonEmpty(value))
    issue(
      issues,
      'REQUIRED_NON_EMPTY_STRING',
      path,
      'A non-empty string is required.',
    );
};

const validateTimestamp = (
  issues: IssueBag,
  value: unknown,
  path: string,
): void => {
  if (!nonEmpty(value) || !isIsoDate(value))
    issue(
      issues,
      'INVALID_TIMESTAMP',
      path,
      'An ISO date-time string is required.',
    );
};

const hasMeaningfulScope = (assignment: AuthorityAssignment): boolean =>
  SCOPE_DIMENSIONS.some((dimension) => hasItems(assignment.scope[dimension]));

export const validateAuthorityTypeDefinition = (
  input: unknown,
): ValidationResult => {
  const issues: IssueBag = [];
  if (!isRecord(input))
    return ok([
      {
        code: 'INVALID_OBJECT',
        path: '',
        message: 'Authority type definition must be an object.',
      },
    ]);
  const definition = input as Partial<AuthorityTypeDefinition>;
  requireString(issues, definition.authorityType, 'authorityType');
  if (RUNTIME_ROLE_NAMES.includes(definition.authorityType as never)) {
    issue(
      issues,
      'RUNTIME_ROLE_NOT_AUTHORITY_TYPE',
      'authorityType',
      'Runtime role labels are not authority types.',
    );
  }
  requireString(
    issues,
    definition.authorityTypeSchemaVersion,
    'authorityTypeSchemaVersion',
  );
  if (!includes(AUTHORITY_TYPE_STATUSES, definition.status))
    issue(
      issues,
      'INVALID_AUTHORITY_TYPE_STATUS',
      'status',
      'Unknown authority type status.',
    );
  if (!hasItems(definition.allowedDecisionTypes))
    issue(
      issues,
      'MISSING_ALLOWED_DECISION_TYPES',
      'allowedDecisionTypes',
      'At least one allowed decision type is required.',
    );
  if (!Array.isArray(definition.requiredScopeDimensions))
    issue(
      issues,
      'INVALID_REQUIRED_SCOPE_DIMENSIONS',
      'requiredScopeDimensions',
      'Required scope dimensions must be an array.',
    );
  else {
    for (const [
      index,
      dimension,
    ] of definition.requiredScopeDimensions.entries()) {
      if (!SCOPE_DIMENSIONS.includes(dimension))
        issue(
          issues,
          'INVALID_SCOPE_DIMENSION',
          `requiredScopeDimensions.${index}`,
          'Unknown scope dimension.',
        );
    }
  }
  if (typeof definition.permitsGlobalScope !== 'boolean')
    issue(
      issues,
      'INVALID_BOOLEAN',
      'permitsGlobalScope',
      'A boolean is required.',
    );
  if (typeof definition.requiresHumanAuthority !== 'boolean')
    issue(
      issues,
      'INVALID_BOOLEAN',
      'requiresHumanAuthority',
      'A boolean is required.',
    );
  if (
    !Array.isArray(definition.permittedSubjectTypes) ||
    definition.permittedSubjectTypes.length === 0
  )
    issue(
      issues,
      'INVALID_SUBJECT_TYPES',
      'permittedSubjectTypes',
      'At least one permitted subject type is required.',
    );
  else {
    for (const [
      index,
      subjectType,
    ] of definition.permittedSubjectTypes.entries()) {
      if (!ACTOR_TYPES.includes(subjectType))
        issue(
          issues,
          'INVALID_SUBJECT_TYPE',
          `permittedSubjectTypes.${index}`,
          'Unknown subject type.',
        );
    }
  }
  if (typeof definition.permitsDelegation !== 'boolean')
    issue(
      issues,
      'INVALID_BOOLEAN',
      'permitsDelegation',
      'A boolean is required.',
    );
  if (
    !Number.isInteger(definition.maximumDelegationDepth) ||
    Number(definition.maximumDelegationDepth) < 0
  )
    issue(
      issues,
      'INVALID_DELEGATION_DEPTH',
      'maximumDelegationDepth',
      'A non-negative integer is required.',
    );
  if (!Array.isArray(definition.grantableAuthorityTypes))
    issue(
      issues,
      'INVALID_GRANTABLE_TYPES',
      'grantableAuthorityTypes',
      'Grantable authority types must be an array.',
    );
  if (typeof definition.requiresEnhancedGrantEvidence !== 'boolean')
    issue(
      issues,
      'INVALID_BOOLEAN',
      'requiresEnhancedGrantEvidence',
      'requiresEnhancedGrantEvidence must be boolean.',
    );
  if (!Array.isArray(definition.separationOfDutiesRules))
    issue(
      issues,
      'INVALID_SEPARATION_RULES',
      'separationOfDutiesRules',
      'Separation rules must be an array.',
    );
  return ok(issues);
};

export const validateAuthorityTypeRegistry = (
  registry: AuthorityTypeRegistry,
): ValidationResult => {
  const issues: IssueBag = [];
  const seen = new Set<string>();
  registry.definitions.forEach((definition, index) => {
    issues.push(
      ...validateAuthorityTypeDefinition(definition).issues.map((entry) => ({
        ...entry,
        path: `definitions.${index}.${entry.path}`,
      })),
    );
    const key = `${definition.authorityType}:${definition.authorityTypeSchemaVersion}`;
    if (seen.has(key))
      issue(
        issues,
        'DUPLICATE_AUTHORITY_TYPE_DEFINITION',
        `definitions.${index}`,
        'Authority type definitions must be unique.',
      );
    seen.add(key);
  });
  return ok(issues);
};

export const validateActorCommandContext = (
  input: unknown,
): ValidationResult => {
  const issues: IssueBag = [];
  if (!isRecord(input))
    return ok([
      {
        code: 'INVALID_OBJECT',
        path: '',
        message: 'Actor command context must be an object.',
      },
    ]);
  const context = input as Partial<ActorCommandContext>;
  if (!includes(ACTOR_TYPES, context.actorType))
    issue(issues, 'INVALID_ACTOR_TYPE', 'actorType', 'Unknown actor type.');
  requireString(issues, context.actorId, 'actorId');
  if (!isStringArray(context.runtimeRoles))
    issue(
      issues,
      'INVALID_RUNTIME_ROLES',
      'runtimeRoles',
      'Runtime roles must be strings.',
    );
  if (!isStringArray(context.organizationContextIds))
    issue(
      issues,
      'INVALID_ORGANIZATION_CONTEXT',
      'organizationContextIds',
      'Organization context IDs must be strings.',
    );
  if (!isStringArray(context.specialtyContextIds))
    issue(
      issues,
      'INVALID_SPECIALTY_CONTEXT',
      'specialtyContextIds',
      'Specialty context IDs must be strings.',
    );
  if (!isStringArray(context.authorityAssignmentReferences))
    issue(
      issues,
      'INVALID_ASSIGNMENT_REFERENCES',
      'authorityAssignmentReferences',
      'Authority assignment references are string claims.',
    );
  requireString(issues, context.correlationId, 'correlationId');
  requireString(issues, context.causationId, 'causationId');
  validateTimestamp(issues, context.requestedAt, 'requestedAt');
  return ok(issues);
};

export const validateAuthorityAssignment = (
  input: unknown,
  registry: AuthorityTypeRegistry,
): ValidationResult => {
  const issues: IssueBag = [];
  if (!isRecord(input))
    return ok([
      {
        code: 'INVALID_OBJECT',
        path: '',
        message: 'Authority assignment must be an object.',
      },
    ]);
  const assignment = input as Partial<AuthorityAssignment>;
  requireString(issues, assignment.assignmentId, 'assignmentId');
  if (assignment.assignmentSchemaVersion !== '1.0.0')
    issue(
      issues,
      'INVALID_SCHEMA_VERSION',
      'assignmentSchemaVersion',
      'Assignment schema version must be 1.0.0.',
    );
  if (!includes(ACTOR_TYPES, assignment.subjectType))
    issue(
      issues,
      'INVALID_SUBJECT_TYPE',
      'subjectType',
      'Unknown subject type.',
    );
  requireString(issues, assignment.subjectId, 'subjectId');
  requireString(issues, assignment.authorityType, 'authorityType');
  requireString(
    issues,
    assignment.authorityTypeSchemaVersion,
    'authorityTypeSchemaVersion',
  );
  if (!includes(ASSIGNMENT_STATUSES, assignment.status))
    issue(
      issues,
      'INVALID_ASSIGNMENT_STATUS',
      'status',
      'Unknown assignment status.',
    );
  if (!includes(SCOPE_MODES, assignment.scopeMode))
    issue(issues, 'INVALID_SCOPE_MODE', 'scopeMode', 'Unknown scope mode.');
  if (!isRecord(assignment.scope))
    issue(issues, 'INVALID_SCOPE', 'scope', 'Scope object is required.');
  if (!hasItems(assignment.allowedDecisionTypes))
    issue(
      issues,
      'MISSING_ALLOWED_DECISION_TYPES',
      'allowedDecisionTypes',
      'At least one allowed decision type is required.',
    );
  requireString(
    issues,
    assignment.authorityEvidenceReference,
    'authorityEvidenceReference',
  );
  if (
    !isRecord(assignment.grantingAuthoritySnapshot) ||
    Object.keys(assignment.grantingAuthoritySnapshot).length === 0
  )
    issue(
      issues,
      'MISSING_GRANTING_AUTHORITY_SNAPSHOT',
      'grantingAuthoritySnapshot',
      'Granting authority snapshot is required.',
    );
  if (!includes(ACTOR_TYPES, assignment.grantedByActorType))
    issue(
      issues,
      'INVALID_GRANTOR_ACTOR_TYPE',
      'grantedByActorType',
      'Unknown grantor actor type.',
    );
  requireString(issues, assignment.grantedByActorId, 'grantedByActorId');
  requireString(
    issues,
    assignment.grantingAuthorityAssignmentId,
    'grantingAuthorityAssignmentId',
  );
  validateTimestamp(issues, assignment.grantedAt, 'grantedAt');
  validateTimestamp(issues, assignment.validFrom, 'validFrom');
  if (assignment.validUntil !== undefined)
    validateTimestamp(issues, assignment.validUntil, 'validUntil');
  if (assignment.reviewDueAt !== undefined)
    validateTimestamp(issues, assignment.reviewDueAt, 'reviewDueAt');
  requireString(issues, assignment.rationale, 'rationale');
  if (typeof assignment.delegationAllowed !== 'boolean')
    issue(
      issues,
      'INVALID_DELEGATION_ALLOWED',
      'delegationAllowed',
      'Delegation flag is required.',
    );
  if (
    !Number.isInteger(assignment.maximumDelegationDepth) ||
    Number(assignment.maximumDelegationDepth) < 0
  )
    issue(
      issues,
      'INVALID_DELEGATION_DEPTH',
      'maximumDelegationDepth',
      'A non-negative integer is required.',
    );

  if (isRecord(assignment.scope)) {
    for (const dimension of SCOPE_DIMENSIONS) {
      const values = assignment.scope[dimension];
      if (values !== undefined && !hasItems(values))
        issue(
          issues,
          'EMPTY_SCOPE_DIMENSION',
          `scope.${dimension}`,
          'Scope arrays must be non-empty when present.',
        );
    }
  }

  if (
    assignment.assignmentId &&
    assignment.supersededByAssignmentId === assignment.assignmentId
  )
    issue(
      issues,
      'SELF_SUPERSESSION',
      'supersededByAssignmentId',
      'Assignment cannot supersede itself.',
    );
  if (assignment.status === 'SUSPENDED' && !assignment.suspendedAt)
    issue(
      issues,
      'MISSING_SUSPENSION_TIMESTAMP',
      'suspendedAt',
      'Suspended assignments require suspendedAt.',
    );
  if (
    assignment.status === 'REVOKED' &&
    (!assignment.revokedAt || !assignment.revokedByActorId)
  )
    issue(
      issues,
      'MISSING_REVOCATION_EVIDENCE',
      'revokedAt',
      'Revoked assignments require revocation evidence.',
    );
  if (
    assignment.status === 'SUPERSEDED' &&
    !assignment.supersededByAssignmentId
  )
    issue(
      issues,
      'MISSING_SUPERSESSION_TARGET',
      'supersededByAssignmentId',
      'Superseded assignments require a target.',
    );

  const definition = findAuthorityTypeDefinition(
    registry,
    assignment.authorityType ?? '',
    assignment.authorityTypeSchemaVersion,
  );
  if (!definition)
    issue(
      issues,
      'UNREGISTERED_AUTHORITY_TYPE',
      'authorityType',
      'Authority type must be registered before use.',
    );
  else if (!isApprovedAuthorityTypeDefinition(definition))
    issue(
      issues,
      'AUTHORITY_TYPE_NOT_APPROVED',
      'authorityType',
      'Only approved authority type definitions can authorize operational assignments.',
    );
  else {
    if (
      assignment.subjectType &&
      !definition.permittedSubjectTypes.includes(assignment.subjectType)
    )
      issue(
        issues,
        'SUBJECT_TYPE_NOT_PERMITTED',
        'subjectType',
        'Subject type is not permitted for this authority type.',
      );
    for (const decisionType of assignment.allowedDecisionTypes ?? []) {
      if (!definition.allowedDecisionTypes.includes(decisionType))
        issue(
          issues,
          'DECISION_TYPE_NOT_PERMITTED',
          'allowedDecisionTypes',
          'Assignment decision type is not permitted by policy.',
        );
    }
    if (
      assignment.scopeMode === 'SCOPED' &&
      !hasMeaningfulScope(assignment as AuthorityAssignment)
    )
      issue(
        issues,
        'EMPTY_SCOPED_ASSIGNMENT',
        'scope',
        'SCOPED assignments require at least one explicit scope dimension.',
      );
    if (assignment.scopeMode === 'GLOBAL') {
      if (!definition.permitsGlobalScope)
        issue(
          issues,
          'GLOBAL_SCOPE_NOT_PERMITTED',
          'scopeMode',
          'Global authority requires approved policy permission.',
        );
      if (!definition.requiresEnhancedGrantEvidence)
        issue(
          issues,
          'GLOBAL_REQUIRES_ENHANCED_EVIDENCE',
          'authorityEvidenceReference',
          'Global authority requires enhanced evidence policy.',
        );
      if (!assignment.reviewDueAt && !assignment.validUntil)
        issue(
          issues,
          'GLOBAL_REQUIRES_REVIEW_OR_EXPIRY',
          'reviewDueAt',
          'Global authority requires expiry or review.',
        );
    }
    for (const dimension of definition.requiredScopeDimensions) {
      if (
        dimension !== 'decisionTypes' &&
        assignment.scopeMode === 'SCOPED' &&
        !hasItems(
          (assignment.scope as AuthorityAssignment['scope'] | undefined)?.[
            dimension
          ],
        )
      ) {
        issue(
          issues,
          'MISSING_REQUIRED_SCOPE_DIMENSION',
          `scope.${dimension}`,
          'Required scope dimension is missing.',
        );
      }
    }
  }
  return ok(issues);
};

export const validateAuthorityAssignmentSet = (
  assignments: AuthorityAssignment[],
  registry: AuthorityTypeRegistry,
): ValidationResult => {
  const issues: IssueBag = [];
  const ids = new Set<string>();
  for (const [index, assignment] of assignments.entries()) {
    issues.push(
      ...validateAuthorityAssignment(assignment, registry).issues.map(
        (entry) => ({ ...entry, path: `${index}.${entry.path}` }),
      ),
    );
    if (ids.has(assignment.assignmentId))
      issue(
        issues,
        'DUPLICATE_ASSIGNMENT_ID',
        `${index}.assignmentId`,
        'Assignment IDs must be unique.',
      );
    ids.add(assignment.assignmentId);
  }
  for (const [index, assignment] of assignments.entries()) {
    if (
      assignment.parentAssignmentId &&
      !ids.has(assignment.parentAssignmentId)
    )
      issue(
        issues,
        'MISSING_PARENT_ASSIGNMENT',
        `${index}.parentAssignmentId`,
        'Parent assignment must exist in the set.',
      );
    let current = assignment.parentAssignmentId;
    const chain = new Set<string>([assignment.assignmentId]);
    while (current) {
      if (chain.has(current)) {
        issue(
          issues,
          'CIRCULAR_DELEGATION',
          `${index}.parentAssignmentId`,
          'Delegation chain cannot be circular.',
        );
        break;
      }
      chain.add(current);
      current = assignments.find(
        (candidate) => candidate.assignmentId === current,
      )?.parentAssignmentId;
    }
  }
  return ok(issues);
};
