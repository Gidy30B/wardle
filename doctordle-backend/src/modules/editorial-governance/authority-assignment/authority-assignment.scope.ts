import type {
  AuthorityAssignment,
  AuthorityScope,
  AuthorityTypeDefinition,
  GovernedAuthorityRequest,
  ScopeEvaluationResult,
} from './authority-assignment.types';

const contains = (
  values: string[] | undefined,
  requested: string | undefined,
): boolean =>
  values === undefined ||
  (requested !== undefined && values.includes(requested));

const containsAll = (
  parent: string[] | undefined,
  child: string[] | undefined,
): boolean => {
  if (child === undefined) return true;
  if (parent === undefined) return false;
  return child.every((value) => parent.includes(value));
};

const hasScopeValues = (scope: AuthorityScope): boolean =>
  Object.values(scope).some(
    (value) => Array.isArray(value) && value.length > 0,
  );

export const scopeContainsScope = (
  parent: AuthorityScope,
  child: AuthorityScope,
): boolean =>
  containsAll(parent.organizationIds, child.organizationIds) &&
  containsAll(parent.specialtyIds, child.specialtyIds) &&
  containsAll(parent.artifactTypes, child.artifactTypes) &&
  containsAll(parent.artifactIds, child.artifactIds) &&
  containsAll(parent.artifactRevisionIds, child.artifactRevisionIds) &&
  containsAll(parent.decisionTypes, child.decisionTypes) &&
  containsAll(parent.environmentScopes, child.environmentScopes);

export const evaluateAuthorityScope = (input: {
  assignment: AuthorityAssignment;
  authorityTypeDefinition: AuthorityTypeDefinition;
  request: GovernedAuthorityRequest;
}): ScopeEvaluationResult => {
  const { assignment, authorityTypeDefinition, request } = input;
  const reasons: string[] = [];
  if (assignment.authorityType !== request.authorityType)
    reasons.push('AUTHORITY_TYPE_MISMATCH');
  if (!assignment.allowedDecisionTypes.includes(request.decisionType))
    reasons.push('DECISION_TYPE_NOT_ALLOWED_BY_ASSIGNMENT');
  if (
    !authorityTypeDefinition.allowedDecisionTypes.includes(request.decisionType)
  )
    reasons.push('DECISION_TYPE_NOT_ALLOWED_BY_POLICY');

  if (assignment.scopeMode === 'GLOBAL') {
    if (!authorityTypeDefinition.permitsGlobalScope)
      reasons.push('GLOBAL_SCOPE_NOT_PERMITTED');
    return { matches: reasons.length === 0, reasons };
  }

  if (!hasScopeValues(assignment.scope))
    reasons.push('EMPTY_SCOPED_ASSIGNMENT_NOT_GLOBAL');
  if (!contains(assignment.scope.organizationIds, request.organizationId))
    reasons.push('ORGANIZATION_SCOPE_MISMATCH');
  if (!contains(assignment.scope.specialtyIds, request.specialtyId))
    reasons.push('SPECIALTY_SCOPE_MISMATCH');
  if (!contains(assignment.scope.artifactTypes, request.artifactType))
    reasons.push('ARTIFACT_TYPE_SCOPE_MISMATCH');
  if (!contains(assignment.scope.artifactIds, request.artifactId))
    reasons.push('ARTIFACT_ID_SCOPE_MISMATCH');
  if (
    !contains(assignment.scope.artifactRevisionIds, request.artifactRevisionId)
  )
    reasons.push('ARTIFACT_REVISION_SCOPE_MISMATCH');
  if (!contains(assignment.scope.decisionTypes, request.decisionType))
    reasons.push('DECISION_SCOPE_MISMATCH');
  if (!contains(assignment.scope.environmentScopes, request.environmentScope))
    reasons.push('ENVIRONMENT_SCOPE_MISMATCH');

  for (const dimension of authorityTypeDefinition.requiredScopeDimensions) {
    const assignmentValues = assignment.scope[dimension];
    if (dimension === 'decisionTypes') continue;
    const requestValue =
      dimension === 'organizationIds'
        ? request.organizationId
        : dimension === 'specialtyIds'
          ? request.specialtyId
          : dimension === 'artifactTypes'
            ? request.artifactType
            : dimension === 'artifactIds'
              ? request.artifactId
              : dimension === 'artifactRevisionIds'
                ? request.artifactRevisionId
                : request.environmentScope;
    if (
      !assignmentValues ||
      assignmentValues.length === 0 ||
      requestValue === undefined
    )
      reasons.push(`MISSING_REQUIRED_${dimension.toUpperCase()}`);
  }
  return { matches: reasons.length === 0, reasons };
};

export const assignmentDurationWithin = (
  childValidUntil: string | undefined,
  parentValidUntil: string | undefined,
): boolean => {
  if (!childValidUntil) return !parentValidUntil;
  if (!parentValidUntil) return true;
  return Date.parse(childValidUntil) <= Date.parse(parentValidUntil);
};
