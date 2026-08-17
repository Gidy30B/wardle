import { AUTHORITY_ASSIGNMENT_GRANT } from './authority-assignment.constants';
import { findAuthorityTypeDefinition } from './authority-assignment.registry';
import {
  assignmentDurationWithin,
  scopeContainsScope,
} from './authority-assignment.scope';
import type {
  DelegationValidationRequest,
  GrantValidationRequest,
  SeparationOfDutiesContext,
  ValidationIssue,
  ValidationResult,
} from './authority-assignment.types';

const ok = (issues: ValidationIssue[]): ValidationResult => ({
  valid: issues.length === 0,
  issues,
});
const issue = (
  issues: ValidationIssue[],
  code: string,
  path: string,
  message: string,
): void => {
  issues.push({ code, path, message });
};

const standingAllows = (status: string): boolean => status === 'ACTIVE';

const delegationDepth = (
  assignmentId: string,
  assignments: { assignmentId: string; parentAssignmentId?: string }[],
): number => {
  let depth = 0;
  let current = assignments.find(
    (assignment) => assignment.assignmentId === assignmentId,
  )?.parentAssignmentId;
  const seen = new Set<string>([assignmentId]);
  while (current) {
    if (seen.has(current)) return Number.POSITIVE_INFINITY;
    seen.add(current);
    depth += 1;
    current = assignments.find(
      (assignment) => assignment.assignmentId === current,
    )?.parentAssignmentId;
  }
  return depth;
};

export const validateAuthorityGrant = (
  request: GrantValidationRequest,
): ValidationResult => {
  const { grantorAssignment, proposedAssignment, authorityTypeRegistry } =
    request;
  const issues: ValidationIssue[] = [];
  const grantorDefinition = findAuthorityTypeDefinition(
    authorityTypeRegistry,
    grantorAssignment.authorityType,
    grantorAssignment.authorityTypeSchemaVersion,
  );
  if (!standingAllows(grantorAssignment.status))
    issue(
      issues,
      'GRANTOR_NOT_ACTIVE',
      'grantorAssignment.status',
      'Grant authority must be active.',
    );
  if (grantorAssignment.authorityType !== AUTHORITY_ASSIGNMENT_GRANT)
    issue(
      issues,
      'GRANT_AUTHORITY_REQUIRED',
      'grantorAssignment.authorityType',
      'Granting requires AUTHORITY_ASSIGNMENT_GRANT, not action authority.',
    );
  if (
    !grantorDefinition?.grantableAuthorityTypes.includes(
      proposedAssignment.authorityType,
    )
  )
    issue(
      issues,
      'GRANT_AUTHORITY_TYPE_ESCALATION',
      'proposedAssignment.authorityType',
      'Grantor cannot grant this authority type.',
    );
  if (!scopeContainsScope(grantorAssignment.scope, proposedAssignment.scope))
    issue(
      issues,
      'GRANT_SCOPE_ESCALATION',
      'proposedAssignment.scope',
      'Grantor cannot grant broader scope.',
    );
  if (
    !assignmentDurationWithin(
      proposedAssignment.validUntil,
      grantorAssignment.validUntil,
    )
  )
    issue(
      issues,
      'GRANT_DURATION_ESCALATION',
      'proposedAssignment.validUntil',
      'Grantor cannot grant beyond its validity.',
    );
  if (
    proposedAssignment.delegationAllowed &&
    !grantorAssignment.delegationAllowed
  )
    issue(
      issues,
      'GRANT_DELEGATION_RIGHT_ESCALATION',
      'proposedAssignment.delegationAllowed',
      'Grantor cannot create delegation rights it does not hold.',
    );
  if (
    proposedAssignment.maximumDelegationDepth >
    grantorAssignment.maximumDelegationDepth
  )
    issue(
      issues,
      'GRANT_DELEGATION_DEPTH_ESCALATION',
      'proposedAssignment.maximumDelegationDepth',
      'Grantor cannot grant greater delegation depth.',
    );
  return ok(issues);
};

export const validateDelegation = (
  request: DelegationValidationRequest,
): ValidationResult => {
  const {
    parentAssignment,
    childAssignment,
    assignmentSet,
    authorityTypeRegistry,
  } = request;
  const issues: ValidationIssue[] = [];
  const parentDefinition = findAuthorityTypeDefinition(
    authorityTypeRegistry,
    parentAssignment.authorityType,
    parentAssignment.authorityTypeSchemaVersion,
  );
  if (
    !parentAssignment.delegationAllowed ||
    !parentDefinition?.permitsDelegation
  )
    issue(
      issues,
      'DELEGATION_DENIED_BY_DEFAULT',
      'parentAssignment.delegationAllowed',
      'Delegation is denied unless policy and parent assignment allow it.',
    );
  if (childAssignment.parentAssignmentId !== parentAssignment.assignmentId)
    issue(
      issues,
      'INVALID_PARENT_ASSIGNMENT',
      'childAssignment.parentAssignmentId',
      'Child must name the parent assignment.',
    );
  if (childAssignment.parentAssignmentId === childAssignment.assignmentId)
    issue(
      issues,
      'SELF_PARENTING_DELEGATION',
      'childAssignment.parentAssignmentId',
      'Assignment cannot parent itself.',
    );
  if (
    childAssignment.subjectType === parentAssignment.subjectType &&
    childAssignment.subjectId === parentAssignment.subjectId
  )
    issue(
      issues,
      'SELF_ORIGINATING_DELEGATION',
      'childAssignment.subjectId',
      'Delegation cannot grant authority back to the same subject.',
    );
  if (
    delegationDepth(childAssignment.assignmentId, assignmentSet) >
    parentAssignment.maximumDelegationDepth
  )
    issue(
      issues,
      'DELEGATION_DEPTH_EXCEEDED',
      'childAssignment.parentAssignmentId',
      'Delegation exceeds maximum depth.',
    );
  if (!scopeContainsScope(parentAssignment.scope, childAssignment.scope))
    issue(
      issues,
      'DELEGATED_SCOPE_ESCALATION',
      'childAssignment.scope',
      'Delegated scope cannot exceed parent scope.',
    );
  if (
    !assignmentDurationWithin(
      childAssignment.validUntil,
      parentAssignment.validUntil,
    )
  )
    issue(
      issues,
      'DELEGATED_DURATION_ESCALATION',
      'childAssignment.validUntil',
      'Delegated duration cannot exceed parent duration.',
    );
  const seen = new Set<string>([childAssignment.assignmentId]);
  let current = childAssignment.parentAssignmentId;
  while (current) {
    if (seen.has(current)) {
      issue(
        issues,
        'CIRCULAR_DELEGATION',
        'childAssignment.parentAssignmentId',
        'Delegation chain cannot be circular.',
      );
      break;
    }
    seen.add(current);
    current = assignmentSet.find(
      (assignment) => assignment.assignmentId === current,
    )?.parentAssignmentId;
  }
  return ok(issues);
};

export const evaluateSeparationOfDuties = (
  context: SeparationOfDutiesContext,
): ValidationResult => {
  const issues: ValidationIssue[] = [];
  for (const rule of context.rules) {
    if (
      rule === 'AUTHOR_CANNOT_BE_SOLE_FINAL_APPROVER' &&
      context.authorActorId &&
      context.authorActorId === context.finalAuthorityActorId
    )
      issue(
        issues,
        rule,
        'finalAuthorityActorId',
        'Author cannot be the sole final approver.',
      );
    if (
      rule === 'REQUESTER_CANNOT_BE_FINAL_AUTHORITY' &&
      context.requesterActorId &&
      context.requesterActorId === context.finalAuthorityActorId
    )
      issue(
        issues,
        rule,
        'finalAuthorityActorId',
        'Requester cannot be final authority.',
      );
    if (
      rule === 'ASSIGNMENT_REQUESTER_CANNOT_BE_SOLE_GRANT_APPROVER' &&
      context.assignmentRequesterActorId &&
      context.assignmentRequesterActorId === context.grantApproverActorId
    )
      issue(
        issues,
        rule,
        'grantApproverActorId',
        'Assignment requester cannot be sole grant approver.',
      );
    if (
      rule === 'PROTECTED_FIELD_REQUESTER_AND_APPROVER_MUST_DIFFER' &&
      context.protectedFieldRequesterActorId &&
      context.protectedFieldRequesterActorId ===
        context.protectedFieldApproverActorId
    )
      issue(
        issues,
        rule,
        'protectedFieldApproverActorId',
        'Protected-field requester and approver must differ.',
      );
  }
  return ok(issues);
};
