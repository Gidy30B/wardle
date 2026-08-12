import {
  DOCUMENT_APPROVAL_OUTCOMES,
  DOCUMENT_AUTHORITY_ERROR_CODES,
  DOCUMENT_AUTHORITY_RECORD_TYPES,
  IMPLEMENTATION_AUTHORIZATIONS,
  PROTECTED_FIELD_EXCEPTION_STATUSES,
} from './document-authority.constants';
import type {
  AuthorityActor,
  AuthorityRecord,
  AuthorityRecordSetValidationResult,
  AuthorityValidationError,
  AuthorityValidationResult,
  DocumentApprovalRecord,
  DocumentSupersessionRecord,
  ProtectedFieldExceptionRecord,
} from './document-authority.types';

const approvalOutcomes = new Set<string>(
  Object.values(DOCUMENT_APPROVAL_OUTCOMES),
);
const implementationAuthorizations = new Set<string>(
  Object.values(IMPLEMENTATION_AUTHORIZATIONS),
);
const protectedFieldStatuses = new Set<string>(
  Object.values(PROTECTED_FIELD_EXCEPTION_STATUSES),
);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isBoolean = (value: unknown): value is boolean =>
  typeof value === 'boolean';

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every(isNonEmptyString);

const isIsoDate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

const isIsoDateTime = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value);

const error = (
  code: AuthorityValidationError['code'],
  path: string,
  message: string,
): AuthorityValidationError => ({ code, path, message });

const validateRequiredString = (
  source: Record<string, unknown>,
  key: string,
  path: string,
  errors: AuthorityValidationError[],
): void => {
  if (!isNonEmptyString(source[key])) {
    errors.push(
      error(
        DOCUMENT_AUTHORITY_ERROR_CODES.REQUIRED_FIELD_MISSING,
        `${path}.${key}`,
        `${key} must be a non-empty string.`,
      ),
    );
  }
};

const validateAuthorityActor = (
  value: unknown,
  path: string,
  errors: AuthorityValidationError[],
): value is AuthorityActor => {
  if (!isObject(value)) {
    errors.push(
      error(
        DOCUMENT_AUTHORITY_ERROR_CODES.INVALID_SHAPE,
        path,
        'Authority actor must be an object.',
      ),
    );
    return false;
  }

  validateRequiredString(value, 'name', path, errors);
  validateRequiredString(value, 'role', path, errors);
  validateRequiredString(value, 'authorityBasis', path, errors);
  return errors.every((entry) => !entry.path.startsWith(path));
};

const validateDocumentReference = (
  value: unknown,
  path: string,
  errors: AuthorityValidationError[],
): boolean => {
  if (!isObject(value)) {
    errors.push(
      error(
        DOCUMENT_AUTHORITY_ERROR_CODES.INVALID_SHAPE,
        path,
        'Document reference must be an object.',
      ),
    );
    return false;
  }

  validateRequiredString(value, 'documentId', path, errors);
  validateRequiredString(value, 'documentVersion', path, errors);
  validateRequiredString(value, 'documentPath', path, errors);
  return errors.every((entry) => !entry.path.startsWith(path));
};

const sameDocumentReference = (
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): boolean =>
  left.documentId === right.documentId &&
  left.documentVersion === right.documentVersion &&
  left.documentPath === right.documentPath;

export const validateDocumentApprovalRecord = (
  input: unknown,
): AuthorityValidationResult<DocumentApprovalRecord> => {
  const errors: AuthorityValidationError[] = [];
  if (!isObject(input)) {
    return {
      valid: false,
      errors: [
        error(
          DOCUMENT_AUTHORITY_ERROR_CODES.INVALID_SHAPE,
          '$',
          'Document approval record must be an object.',
        ),
      ],
    };
  }

  for (const key of [
    'recordId',
    'schemaVersion',
    'documentId',
    'documentVersion',
    'documentPath',
    'approverAuthority',
    'rationale',
    'supportingDecision',
    'createdAt',
  ]) {
    validateRequiredString(input, key, '$', errors);
  }

  if (input.recordType !== DOCUMENT_AUTHORITY_RECORD_TYPES.DOCUMENT_APPROVAL) {
    errors.push(
      error(
        DOCUMENT_AUTHORITY_ERROR_CODES.INVALID_RECORD_TYPE,
        '$.recordType',
        'recordType must be DOCUMENT_APPROVAL.',
      ),
    );
  }

  if (!isObject(input.approvalScope)) {
    errors.push(
      error(
        DOCUMENT_AUTHORITY_ERROR_CODES.INVALID_SHAPE,
        '$.approvalScope',
        'approvalScope must be an object.',
      ),
    );
  } else {
    validateRequiredString(
      input.approvalScope,
      'scopeType',
      '$.approvalScope',
      errors,
    );
    validateRequiredString(
      input.approvalScope,
      'description',
      '$.approvalScope',
      errors,
    );
  }

  if (!approvalOutcomes.has(String(input.approvalOutcome))) {
    errors.push(
      error(
        DOCUMENT_AUTHORITY_ERROR_CODES.INVALID_CONTROLLED_VALUE,
        '$.approvalOutcome',
        'approvalOutcome is not controlled.',
      ),
    );
  }

  if (
    !implementationAuthorizations.has(String(input.implementationAuthorization))
  ) {
    errors.push(
      error(
        DOCUMENT_AUTHORITY_ERROR_CODES.INVALID_CONTROLLED_VALUE,
        '$.implementationAuthorization',
        'implementationAuthorization is not controlled.',
      ),
    );
  }

  validateAuthorityActor(input.approver, '$.approver', errors);

  if (!isIsoDate(input.approvalDate)) {
    errors.push(
      error(
        DOCUMENT_AUTHORITY_ERROR_CODES.INVALID_DATE,
        '$.approvalDate',
        'approvalDate must be ISO date.',
      ),
    );
  }
  if (!isIsoDate(input.effectiveDate)) {
    errors.push(
      error(
        DOCUMENT_AUTHORITY_ERROR_CODES.INVALID_DATE,
        '$.effectiveDate',
        'effectiveDate must be ISO date.',
      ),
    );
  }
  if (!isIsoDateTime(input.createdAt)) {
    errors.push(
      error(
        DOCUMENT_AUTHORITY_ERROR_CODES.INVALID_DATE,
        '$.createdAt',
        'createdAt must be ISO date-time.',
      ),
    );
  }

  if (!isStringArray(input.conditions)) {
    errors.push(
      error(
        DOCUMENT_AUTHORITY_ERROR_CODES.REQUIRED_FIELD_MISSING,
        '$.conditions',
        'conditions must be an array of non-empty strings.',
      ),
    );
  }
  if (
    input.approvalOutcome ===
      DOCUMENT_APPROVAL_OUTCOMES.APPROVED_WITH_CONDITIONS &&
    (!Array.isArray(input.conditions) || input.conditions.length === 0)
  ) {
    errors.push(
      error(
        DOCUMENT_AUTHORITY_ERROR_CODES.MISSING_CONDITIONS,
        '$.conditions',
        'APPROVED_WITH_CONDITIONS requires explicit conditions.',
      ),
    );
  }

  if (!isObject(input.bootstrapAuthority)) {
    errors.push(
      error(
        DOCUMENT_AUTHORITY_ERROR_CODES.INVALID_BOOTSTRAP_AUTHORITY,
        '$.bootstrapAuthority',
        'bootstrapAuthority must be an object.',
      ),
    );
  } else {
    if (!isBoolean(input.bootstrapAuthority.isBootstrap)) {
      errors.push(
        error(
          DOCUMENT_AUTHORITY_ERROR_CODES.INVALID_BOOTSTRAP_AUTHORITY,
          '$.bootstrapAuthority.isBootstrap',
          'isBootstrap must be boolean.',
        ),
      );
    }
    validateRequiredString(
      input.bootstrapAuthority,
      'scope',
      '$.bootstrapAuthority',
      errors,
    );
    validateRequiredString(
      input.bootstrapAuthority,
      'expiryCondition',
      '$.bootstrapAuthority',
      errors,
    );
  }

  return {
    valid: errors.length === 0,
    record: errors.length === 0 ? (input as DocumentApprovalRecord) : undefined,
    errors,
  };
};

export const validateDocumentSupersessionRecord = (
  input: unknown,
): AuthorityValidationResult<DocumentSupersessionRecord> => {
  const errors: AuthorityValidationError[] = [];
  if (!isObject(input)) {
    return {
      valid: false,
      errors: [
        error(
          DOCUMENT_AUTHORITY_ERROR_CODES.INVALID_SHAPE,
          '$',
          'Supersession record must be an object.',
        ),
      ],
    };
  }

  for (const key of [
    'recordId',
    'schemaVersion',
    'supersessionScope',
    'rationale',
    'approverAuthority',
    'supportingDecision',
    'createdAt',
  ]) {
    validateRequiredString(input, key, '$', errors);
  }

  if (
    input.recordType !== DOCUMENT_AUTHORITY_RECORD_TYPES.DOCUMENT_SUPERSESSION
  ) {
    errors.push(
      error(
        DOCUMENT_AUTHORITY_ERROR_CODES.INVALID_RECORD_TYPE,
        '$.recordType',
        'recordType must be DOCUMENT_SUPERSESSION.',
      ),
    );
  }
  validateDocumentReference(
    input.supersedingDocument,
    '$.supersedingDocument',
    errors,
  );
  validateDocumentReference(
    input.supersededDocument,
    '$.supersededDocument',
    errors,
  );
  validateAuthorityActor(input.approver, '$.approver', errors);

  if (
    isObject(input.supersedingDocument) &&
    isObject(input.supersededDocument) &&
    sameDocumentReference(input.supersedingDocument, input.supersededDocument)
  ) {
    errors.push(
      error(
        DOCUMENT_AUTHORITY_ERROR_CODES.SELF_SUPERSESSION,
        '$',
        'A document version cannot supersede itself.',
      ),
    );
  }
  if (!isIsoDate(input.effectiveDate)) {
    errors.push(
      error(
        DOCUMENT_AUTHORITY_ERROR_CODES.INVALID_DATE,
        '$.effectiveDate',
        'effectiveDate must be ISO date.',
      ),
    );
  }
  if (!isIsoDateTime(input.createdAt)) {
    errors.push(
      error(
        DOCUMENT_AUTHORITY_ERROR_CODES.INVALID_DATE,
        '$.createdAt',
        'createdAt must be ISO date-time.',
      ),
    );
  }
  if (!isObject(input.downstreamObligations)) {
    errors.push(
      error(
        DOCUMENT_AUTHORITY_ERROR_CODES.INVALID_SHAPE,
        '$.downstreamObligations',
        'downstreamObligations must be an object.',
      ),
    );
  }

  return {
    valid: errors.length === 0,
    record:
      errors.length === 0 ? (input as DocumentSupersessionRecord) : undefined,
    errors,
  };
};

export const validateProtectedFieldExceptionRecord = (
  input: unknown,
): AuthorityValidationResult<ProtectedFieldExceptionRecord> => {
  const errors: AuthorityValidationError[] = [];
  if (!isObject(input)) {
    return {
      valid: false,
      errors: [
        error(
          DOCUMENT_AUTHORITY_ERROR_CODES.INVALID_SHAPE,
          '$',
          'Protected-field exception record must be an object.',
        ),
      ],
    };
  }

  for (const key of [
    'recordId',
    'schemaVersion',
    'protectedArtifact',
    'protectedField',
    'changeRationale',
    'impactAssessment',
    'rollbackConditions',
    'supportingDecision',
    'createdAt',
  ]) {
    validateRequiredString(input, key, '$', errors);
  }
  if (
    input.recordType !==
    DOCUMENT_AUTHORITY_RECORD_TYPES.PROTECTED_FIELD_EXCEPTION
  ) {
    errors.push(
      error(
        DOCUMENT_AUTHORITY_ERROR_CODES.INVALID_RECORD_TYPE,
        '$.recordType',
        'recordType must be PROTECTED_FIELD_EXCEPTION.',
      ),
    );
  }
  if (!('currentValue' in input)) {
    errors.push(
      error(
        DOCUMENT_AUTHORITY_ERROR_CODES.REQUIRED_FIELD_MISSING,
        '$.currentValue',
        'currentValue is required.',
      ),
    );
  }
  if (!('proposedValue' in input)) {
    errors.push(
      error(
        DOCUMENT_AUTHORITY_ERROR_CODES.REQUIRED_FIELD_MISSING,
        '$.proposedValue',
        'proposedValue is required.',
      ),
    );
  }
  validateAuthorityActor(input.requester, '$.requester', errors);
  validateAuthorityActor(input.reviewer, '$.reviewer', errors);
  validateAuthorityActor(input.approver, '$.approver', errors);
  if (!protectedFieldStatuses.has(String(input.status))) {
    errors.push(
      error(
        DOCUMENT_AUTHORITY_ERROR_CODES.INVALID_CONTROLLED_VALUE,
        '$.status',
        'status is not controlled.',
      ),
    );
  }
  if (!isIsoDate(input.effectiveDate)) {
    errors.push(
      error(
        DOCUMENT_AUTHORITY_ERROR_CODES.INVALID_DATE,
        '$.effectiveDate',
        'effectiveDate must be ISO date.',
      ),
    );
  }
  if (!isIsoDateTime(input.createdAt)) {
    errors.push(
      error(
        DOCUMENT_AUTHORITY_ERROR_CODES.INVALID_DATE,
        '$.createdAt',
        'createdAt must be ISO date-time.',
      ),
    );
  }
  if (!isStringArray(input.requiredRegeneration)) {
    errors.push(
      error(
        DOCUMENT_AUTHORITY_ERROR_CODES.REQUIRED_FIELD_MISSING,
        '$.requiredRegeneration',
        'requiredRegeneration must be non-empty string array.',
      ),
    );
  }
  if (!isStringArray(input.requiredRevalidation)) {
    errors.push(
      error(
        DOCUMENT_AUTHORITY_ERROR_CODES.REQUIRED_FIELD_MISSING,
        '$.requiredRevalidation',
        'requiredRevalidation must be non-empty string array.',
      ),
    );
  }
  if (
    input.status === PROTECTED_FIELD_EXCEPTION_STATUSES.APPROVED &&
    isObject(input.requester) &&
    isObject(input.reviewer) &&
    isObject(input.approver) &&
    (input.requester.name === input.reviewer.name ||
      input.requester.name === input.approver.name ||
      input.reviewer.name === input.approver.name)
  ) {
    errors.push(
      error(
        DOCUMENT_AUTHORITY_ERROR_CODES.REVIEWER_NOT_INDEPENDENT,
        '$',
        'Approved exceptions require distinct requester, reviewer and approver identities.',
      ),
    );
  }

  return {
    valid: errors.length === 0,
    record:
      errors.length === 0
        ? (input as ProtectedFieldExceptionRecord)
        : undefined,
    errors,
  };
};

export const validateAuthorityRecord = (
  input: unknown,
): AuthorityValidationResult => {
  if (!isObject(input) || typeof input.recordType !== 'string') {
    return {
      valid: false,
      errors: [
        error(
          DOCUMENT_AUTHORITY_ERROR_CODES.INVALID_RECORD_TYPE,
          '$.recordType',
          'recordType is required.',
        ),
      ],
    };
  }

  if (input.recordType === DOCUMENT_AUTHORITY_RECORD_TYPES.DOCUMENT_APPROVAL) {
    return validateDocumentApprovalRecord(input);
  }
  if (
    input.recordType === DOCUMENT_AUTHORITY_RECORD_TYPES.DOCUMENT_SUPERSESSION
  ) {
    return validateDocumentSupersessionRecord(input);
  }
  if (
    input.recordType ===
    DOCUMENT_AUTHORITY_RECORD_TYPES.PROTECTED_FIELD_EXCEPTION
  ) {
    return validateProtectedFieldExceptionRecord(input);
  }

  return {
    valid: false,
    errors: [
      error(
        DOCUMENT_AUTHORITY_ERROR_CODES.INVALID_RECORD_TYPE,
        '$.recordType',
        'recordType is not supported.',
      ),
    ],
  };
};

const approvalConflictKey = (record: DocumentApprovalRecord): string =>
  `${record.documentId}|${record.documentVersion}|${record.approvalScope.scopeType}|${record.approvalScope.description}`;

export const validateAuthorityRecordSet = (
  records: readonly unknown[],
): AuthorityRecordSetValidationResult => {
  const errors: AuthorityValidationError[] = [];
  const seenRecordIds = new Set<string>();
  const activeApprovals = new Map<string, DocumentApprovalRecord>();

  for (const [index, candidate] of records.entries()) {
    const result = validateAuthorityRecord(candidate);
    errors.push(
      ...result.errors.map((entry) => ({
        ...entry,
        path: `$[${index}]${entry.path.slice(1)}`,
      })),
    );
    if (!result.record) {
      continue;
    }

    if (seenRecordIds.has(result.record.recordId)) {
      errors.push(
        error(
          DOCUMENT_AUTHORITY_ERROR_CODES.DUPLICATE_RECORD_ID,
          `$[${index}].recordId`,
          `Duplicate recordId ${result.record.recordId}.`,
        ),
      );
    }
    seenRecordIds.add(result.record.recordId);

    if (
      result.record.recordType ===
      DOCUMENT_AUTHORITY_RECORD_TYPES.DOCUMENT_APPROVAL
    ) {
      const existing = activeApprovals.get(approvalConflictKey(result.record));
      if (
        existing &&
        existing.approvalOutcome !== result.record.approvalOutcome
      ) {
        errors.push(
          error(
            DOCUMENT_AUTHORITY_ERROR_CODES.CONFLICTING_ACTIVE_APPROVAL,
            `$[${index}]`,
            `Conflicting active approvals for ${result.record.documentId} ${result.record.documentVersion}.`,
          ),
        );
      }
      activeApprovals.set(approvalConflictKey(result.record), result.record);
    }
  }

  return { valid: errors.length === 0, errors };
};
