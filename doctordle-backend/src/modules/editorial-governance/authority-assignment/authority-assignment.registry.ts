import { AUTHORITY_TYPE_STATUSES } from './authority-assignment.constants';
import type {
  AuthorityTypeDefinition,
  AuthorityTypeRegistry,
  ValidationIssue,
} from './authority-assignment.types';
import { validateAuthorityTypeDefinition } from './authority-assignment.validation';

export const createAuthorityTypeRegistry = (
  definitions: AuthorityTypeDefinition[] = [],
): AuthorityTypeRegistry => ({
  definitions: [...definitions],
});

export const findAuthorityTypeDefinition = (
  registry: AuthorityTypeRegistry,
  authorityType: string,
  authorityTypeSchemaVersion?: string,
): AuthorityTypeDefinition | undefined =>
  registry.definitions.find(
    (definition) =>
      definition.authorityType === authorityType &&
      (authorityTypeSchemaVersion === undefined ||
        definition.authorityTypeSchemaVersion === authorityTypeSchemaVersion),
  );

export const registerAuthorityTypeDefinition = (
  registry: AuthorityTypeRegistry,
  definition: AuthorityTypeDefinition,
): { registry: AuthorityTypeRegistry; issues: ValidationIssue[] } => {
  const validation = validateAuthorityTypeDefinition(definition);
  const duplicate = findAuthorityTypeDefinition(
    registry,
    definition.authorityType,
    definition.authorityTypeSchemaVersion,
  );
  const issues = [...validation.issues];
  if (duplicate) {
    issues.push({
      code: 'DUPLICATE_AUTHORITY_TYPE_DEFINITION',
      path: 'authorityType',
      message:
        'Authority type definitions are unique by type and schema version.',
    });
  }
  if (issues.length > 0) {
    return { registry, issues };
  }
  return {
    registry: { definitions: [...registry.definitions, definition] },
    issues: [],
  };
};

export const isApprovedAuthorityTypeDefinition = (
  definition: AuthorityTypeDefinition | undefined,
): definition is AuthorityTypeDefinition => definition?.status === 'APPROVED';

export const registryContainsOnlyKnownStatuses = (
  registry: AuthorityTypeRegistry,
): boolean =>
  registry.definitions.every((definition) =>
    AUTHORITY_TYPE_STATUSES.includes(definition.status),
  );
