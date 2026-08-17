import {
  findAuthorityTypeDefinition,
  isApprovedAuthorityTypeDefinition,
} from './authority-assignment.registry';
import { evaluateAuthorityScope } from './authority-assignment.scope';
import type {
  AuthorityAssignment,
  AuthorityResolutionResult,
  ResolveGovernedAuthorityInput,
} from './authority-assignment.types';
import {
  validateActorCommandContext,
  validateAuthorityAssignment,
} from './authority-assignment.validation';

export const evaluateAuthorityStanding = (
  assignment: AuthorityAssignment,
  evaluatedAt: string,
): { usable: boolean; reasons: string[] } => {
  const reasons: string[] = [];
  const evaluated = Date.parse(evaluatedAt);
  if (assignment.status !== 'ACTIVE')
    reasons.push(`ASSIGNMENT_${assignment.status}`);
  if (Date.parse(assignment.validFrom) > evaluated)
    reasons.push('ASSIGNMENT_NOT_YET_VALID');
  if (assignment.validUntil && Date.parse(assignment.validUntil) <= evaluated)
    reasons.push('ASSIGNMENT_EXPIRED');
  return { usable: reasons.length === 0, reasons };
};

export const resolveGovernedAuthority = (
  input: ResolveGovernedAuthorityInput,
): AuthorityResolutionResult => {
  const reasons: string[] = [];
  if (!input.hasRequiredTechnicalAccess)
    return { status: 'DENIED', reasons: ['TECHNICAL_ACCESS_REQUIRED'] };
  const contextValidation = validateActorCommandContext(input.actorContext);
  if (!contextValidation.valid) reasons.push('INVALID_ACTOR_COMMAND_CONTEXT');
  if (input.assignments.length === 0)
    reasons.push('MISSING_AUTHORITY_ASSIGNMENT');

  const referencedAssignments = input.assignments.filter((assignment) =>
    input.actorContext.authorityAssignmentReferences.includes(
      assignment.assignmentId,
    ),
  );
  if (
    input.actorContext.authorityAssignmentReferences.length > 0 &&
    referencedAssignments.length === 0
  ) {
    return {
      status: 'DENIED',
      reasons: ['ASSIGNMENT_REFERENCES_ARE_UNRESOLVED_CLAIMS'],
    };
  }

  const candidates =
    referencedAssignments.length > 0
      ? referencedAssignments
      : input.assignments;
  for (const assignment of candidates) {
    const definition = findAuthorityTypeDefinition(
      input.authorityTypeRegistry,
      assignment.authorityType,
      assignment.authorityTypeSchemaVersion,
    );
    if (!definition) {
      reasons.push('UNREGISTERED_AUTHORITY_TYPE');
      continue;
    }
    if (!isApprovedAuthorityTypeDefinition(definition)) {
      reasons.push('AUTHORITY_TYPE_NOT_APPROVED');
      continue;
    }
    if (
      assignment.subjectType !== input.actorContext.actorType ||
      assignment.subjectId !== input.actorContext.actorId
    ) {
      reasons.push('ASSIGNMENT_SUBJECT_MISMATCH');
      continue;
    }
    const validation = validateAuthorityAssignment(
      assignment,
      input.authorityTypeRegistry,
    );
    if (!validation.valid) {
      reasons.push(...validation.issues.map((entry) => entry.code));
      continue;
    }
    const standing = evaluateAuthorityStanding(assignment, input.evaluatedAt);
    if (!standing.usable) {
      reasons.push(...standing.reasons);
      continue;
    }
    if (
      definition.requiresHumanAuthority &&
      input.actorContext.actorType !== 'USER' &&
      !assignment.humanAuthorityActorId
    ) {
      reasons.push('HUMAN_AUTHORITY_REQUIRED');
      continue;
    }
    const scope = evaluateAuthorityScope({
      assignment,
      authorityTypeDefinition: definition,
      request: input.request,
    });
    if (!scope.matches) {
      reasons.push(...scope.reasons);
      continue;
    }
    return {
      status: 'AUTHORIZED',
      reasons: [],
      assignment,
      od018AuthorityEvidence: {
        authorityAssignmentId: assignment.assignmentId,
        authorityEvidenceReference: assignment.authorityEvidenceReference,
        authorityScopeSnapshot: { ...assignment.scope },
        authorityResolvedAt: input.evaluatedAt,
      },
    };
  }
  return { status: 'DENIED', reasons: [...new Set(reasons)] };
};
