import {
  DOCUMENT_APPROVAL_OUTCOMES,
  DOCUMENT_AUTHORITY_STATUSES,
} from './document-authority.constants';
import type {
  AuthorityConflict,
  DocumentApprovalRecord,
  DocumentAuthorityResolution,
  DocumentReference,
  DocumentSupersessionRecord,
  ResolveDocumentAuthorityInput,
} from './document-authority.types';
import {
  validateDocumentApprovalRecord,
  validateDocumentSupersessionRecord,
} from './document-authority.validation';

const sameDocument = (
  left: DocumentReference,
  record: Pick<
    DocumentApprovalRecord,
    'documentId' | 'documentVersion' | 'documentPath'
  >,
): boolean =>
  left.documentId === record.documentId &&
  left.documentVersion === record.documentVersion &&
  left.documentPath === record.documentPath;

const sameReference = (
  left: DocumentReference,
  right: DocumentReference,
): boolean =>
  left.documentId === right.documentId &&
  left.documentVersion === right.documentVersion &&
  left.documentPath === right.documentPath;

const appliesToScope = (
  recordScope: string,
  requestedScope?: string,
): boolean =>
  recordScope === 'GLOBAL' ||
  requestedScope === undefined ||
  recordScope === requestedScope;

const approvalScopeText = (record: DocumentApprovalRecord): string =>
  `${record.approvalScope.scopeType}:${record.approvalScope.description}`;

export const resolveDocumentAuthority = ({
  document,
  approvalRecords,
  supersessionRecords,
  requestedScope,
}: ResolveDocumentAuthorityInput): DocumentAuthorityResolution => {
  const reasons: string[] = [];
  const conflicts: AuthorityConflict[] = [];
  const validApprovals: DocumentApprovalRecord[] = [];
  const validSupersessions: DocumentSupersessionRecord[] = [];
  let invalidRecordCount = 0;

  for (const candidate of approvalRecords) {
    const result = validateDocumentApprovalRecord(candidate);
    if (result.record) {
      validApprovals.push(result.record);
    } else {
      invalidRecordCount += 1;
    }
  }

  for (const candidate of supersessionRecords) {
    const result = validateDocumentSupersessionRecord(candidate);
    if (result.record) {
      validSupersessions.push(result.record);
    } else {
      invalidRecordCount += 1;
    }
  }

  const applicableSupersession = validSupersessions.find(
    (record) =>
      sameReference(document, record.supersededDocument) &&
      appliesToScope(record.supersessionScope, requestedScope),
  );

  if (applicableSupersession) {
    return {
      status: DOCUMENT_AUTHORITY_STATUSES.SUPERSEDED,
      document,
      applicableSupersession,
      conditions: [],
      conflicts,
      reasons: [
        `Document/version is superseded within scope ${applicableSupersession.supersessionScope}.`,
      ],
    };
  }

  const applicableApprovals = validApprovals.filter((record) =>
    sameDocument(document, record),
  );

  const activeApprovals = applicableApprovals.filter(
    (record) =>
      record.approvalOutcome === DOCUMENT_APPROVAL_OUTCOMES.APPROVED ||
      record.approvalOutcome ===
        DOCUMENT_APPROVAL_OUTCOMES.APPROVED_WITH_CONDITIONS,
  );

  const groupedByScope = new Map<string, DocumentApprovalRecord[]>();
  for (const approval of activeApprovals) {
    const key = approvalScopeText(approval);
    groupedByScope.set(key, [...(groupedByScope.get(key) ?? []), approval]);
  }

  for (const [scope, approvals] of groupedByScope) {
    const outcomes = new Set(approvals.map((record) => record.approvalOutcome));
    if (approvals.length > 1 && outcomes.size > 1) {
      conflicts.push({
        code: 'CONFLICTING_ACTIVE_APPROVAL',
        message: `Multiple incompatible active approvals exist for ${scope}.`,
        recordIds: approvals.map((record) => record.recordId),
      });
    }
  }

  if (conflicts.length > 0) {
    return {
      status: DOCUMENT_AUTHORITY_STATUSES.CONFLICTING,
      document,
      conditions: [],
      conflicts,
      reasons: ['Multiple incompatible active approval records were found.'],
    };
  }

  if (invalidRecordCount > 0 && applicableApprovals.length === 0) {
    reasons.push(
      'Invalid records were ignored and cannot establish authority.',
    );
  }

  const effectiveApproval = activeApprovals[0];
  if (!effectiveApproval) {
    return {
      status:
        applicableApprovals.length > 0
          ? DOCUMENT_AUTHORITY_STATUSES.UNAPPROVED
          : DOCUMENT_AUTHORITY_STATUSES.UNRESOLVED,
      document,
      conditions: [],
      conflicts,
      reasons:
        applicableApprovals.length > 0
          ? ['Only rejected or withdrawn approval records apply.']
          : ['No valid approval or supersession record applies.'],
    };
  }

  if (
    effectiveApproval.approvalOutcome ===
    DOCUMENT_APPROVAL_OUTCOMES.APPROVED_WITH_CONDITIONS
  ) {
    return {
      status: DOCUMENT_AUTHORITY_STATUSES.APPROVED_WITH_CONDITIONS,
      document,
      effectiveApproval,
      conditions: effectiveApproval.conditions,
      conflicts,
      reasons: ['A valid approval record applies with explicit conditions.'],
    };
  }

  return {
    status: DOCUMENT_AUTHORITY_STATUSES.AUTHORITATIVE,
    document,
    effectiveApproval,
    conditions: [],
    conflicts,
    reasons: ['A valid approval record applies.'],
  };
};
