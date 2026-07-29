import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  DOCUMENT_APPROVAL_OUTCOMES,
  DOCUMENT_AUTHORITY_RECORD_TYPES,
  DOCUMENT_AUTHORITY_STATUSES,
  IMPLEMENTATION_AUTHORIZATIONS,
} from './document-authority.constants';
import type {
  DocumentApprovalRecord,
  DocumentReference,
  DocumentSupersessionRecord,
} from './document-authority.types';
import { resolveDocumentAuthority } from './document-authority.resolution';
import {
  validateAuthorityRecordSet,
  validateDocumentApprovalRecord,
  validateDocumentSupersessionRecord,
} from './document-authority.validation';

const findRepositoryRoot = (): string => {
  let current = process.cwd();
  for (let depth = 0; depth < 6; depth += 1) {
    if (
      existsSync(join(current, 'docs', 'weos')) &&
      existsSync(join(current, 'doctordle-backend'))
    ) {
      return current;
    }
    current = resolve(current, '..');
  }
  throw new Error('Repository root not found.');
};

const readRepositoryJson = (relativePath: string): unknown => {
  const fullPath = join(findRepositoryRoot(), relativePath);
  return JSON.parse(readFileSync(fullPath, 'utf8')) as unknown;
};

const document: DocumentReference = {
  documentId: 'WEOS-OD-021',
  documentVersion: '0.1',
  documentPath:
    'docs/weos/phase-3-governance-foundations/WEOS-OD-021-document-authority-and-supersession.md',
};

const validApproval = (): DocumentApprovalRecord => ({
  recordId: 'TEST-APPROVAL-001',
  recordType: DOCUMENT_AUTHORITY_RECORD_TYPES.DOCUMENT_APPROVAL,
  schemaVersion: '1.0.0',
  documentId: document.documentId,
  documentVersion: document.documentVersion,
  documentPath: document.documentPath,
  approvalScope: {
    scopeType: 'DOCUMENT_VERSION',
    description: 'Unit test scope',
  },
  approvalOutcome: DOCUMENT_APPROVAL_OUTCOMES.APPROVED,
  approver: {
    name: 'Approver',
    role: 'Architecture Authority',
    authorityBasis: 'Test authority basis',
  },
  approverAuthority: 'Test authority',
  approvalDate: '2026-07-29',
  effectiveDate: '2026-07-29',
  rationale: 'A non-empty rationale is required.',
  conditions: [],
  supportingDecision: 'WEOS-OD-021',
  implementationAuthorization: IMPLEMENTATION_AUTHORIZATIONS.NOT_GRANTED,
  bootstrapAuthority: {
    isBootstrap: false,
    scope: 'Unit test scope',
    expiryCondition: 'Unit test expiry',
  },
  createdAt: '2026-07-29T00:00:00Z',
});

const validSupersession = (scope = 'GLOBAL'): DocumentSupersessionRecord => ({
  recordId: 'TEST-SUPERSESSION-001',
  recordType: DOCUMENT_AUTHORITY_RECORD_TYPES.DOCUMENT_SUPERSESSION,
  schemaVersion: '1.0.0',
  supersedingDocument: {
    documentId: 'WEOS-OD-021-R2',
    documentVersion: '0.2',
    documentPath: 'docs/weos/phase-3-governance-foundations/replacement.md',
  },
  supersededDocument: document,
  supersessionScope: scope,
  effectiveDate: '2026-07-30',
  rationale: 'A non-empty supersession rationale is required.',
  approver: {
    name: 'Approver',
    role: 'Architecture Authority',
    authorityBasis: 'Test authority basis',
  },
  approverAuthority: 'Test authority',
  supportingDecision: 'WEOS-OD-021',
  downstreamObligations: {
    regenerate: true,
    revalidate: true,
    updateReferences: true,
    reviewDependentDecisions: true,
    notes: 'Unit test obligations.',
  },
  createdAt: '2026-07-30T00:00:00Z',
});

describe('WEOS document authority contracts', () => {
  it('parses and validates WEOS-AUTH-APP-001.json', () => {
    const record = readRepositoryJson(
      'docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-001.json',
    );

    const result = validateDocumentApprovalRecord(record);

    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.record?.recordId).toBe('WEOS-AUTH-APP-001');
  });

  it('points WEOS-AUTH-APP-001 at the existing WEOS-OD-021 document', () => {
    const record = validateDocumentApprovalRecord(
      readRepositoryJson(
        'docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-001.json',
      ),
    ).record;

    expect(record).toBeDefined();
    expect(record?.documentId).toBe('WEOS-OD-021');
    expect(
      existsSync(join(findRepositoryRoot(), record?.documentPath ?? '')),
    ).toBe(true);
  });

  it('requires conditions for approved-with-conditions records', () => {
    const record = {
      ...validApproval(),
      approvalOutcome: DOCUMENT_APPROVAL_OUTCOMES.APPROVED_WITH_CONDITIONS,
      conditions: [],
    };

    expect(validateDocumentApprovalRecord(record).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'MISSING_CONDITIONS' }),
      ]),
    );
  });

  it('does not treat generated, reviewed, runtime, modification time or file type evidence as authority', () => {
    for (const reason of [
      'generated status alone',
      'reviewed status alone',
      'runtime implementation alone',
      'file modification time',
      'file type',
    ]) {
      const resolution = resolveDocumentAuthority({
        document: { ...document, documentPath: `${reason}.md` },
        approvalRecords: [],
        supersessionRecords: [],
      });
      expect(resolution.status).toBe(DOCUMENT_AUTHORITY_STATUSES.UNRESOLVED);
    }
  });

  it('lets a valid approval establish authority for the stated document version and scope', () => {
    const resolution = resolveDocumentAuthority({
      document,
      approvalRecords: [validApproval()],
      supersessionRecords: [],
    });

    expect(resolution.status).toBe(DOCUMENT_AUTHORITY_STATUSES.AUTHORITATIVE);
    expect(resolution.effectiveApproval?.documentId).toBe('WEOS-OD-021');
  });

  it('keeps valid conditional approval distinguishable', () => {
    const resolution = resolveDocumentAuthority({
      document,
      approvalRecords: [
        {
          ...validApproval(),
          approvalOutcome: DOCUMENT_APPROVAL_OUTCOMES.APPROVED_WITH_CONDITIONS,
          conditions: ['Condition remains visible.'],
        },
      ],
      supersessionRecords: [],
    });

    expect(resolution.status).toBe(
      DOCUMENT_AUTHORITY_STATUSES.APPROVED_WITH_CONDITIONS,
    );
    expect(resolution.conditions).toEqual(['Condition remains visible.']);
  });

  it('returns unresolved authority when no approval exists', () => {
    expect(
      resolveDocumentAuthority({
        document,
        approvalRecords: [],
        supersessionRecords: [],
      }).status,
    ).toBe(DOCUMENT_AUTHORITY_STATUSES.UNRESOLVED);
  });

  it('marks only the stated supersession scope as superseded', () => {
    const scoped = validSupersession('SECTION:approval-record');

    expect(
      resolveDocumentAuthority({
        document,
        approvalRecords: [validApproval()],
        supersessionRecords: [scoped],
        requestedScope: 'SECTION:approval-record',
      }).status,
    ).toBe(DOCUMENT_AUTHORITY_STATUSES.SUPERSEDED);

    expect(
      resolveDocumentAuthority({
        document,
        approvalRecords: [validApproval()],
        supersessionRecords: [scoped],
        requestedScope: 'SECTION:other',
      }).status,
    ).toBe(DOCUMENT_AUTHORITY_STATUSES.AUTHORITATIVE);
  });

  it('rejects self-supersession', () => {
    const record = {
      ...validSupersession(),
      supersedingDocument: document,
    };

    expect(validateDocumentSupersessionRecord(record).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'SELF_SUPERSESSION' }),
      ]),
    );
  });

  it('reports conflicting active approvals', () => {
    const conditional = {
      ...validApproval(),
      recordId: 'TEST-APPROVAL-002',
      approvalOutcome: DOCUMENT_APPROVAL_OUTCOMES.APPROVED_WITH_CONDITIONS,
      conditions: ['Condition.'],
    };

    const resolution = resolveDocumentAuthority({
      document,
      approvalRecords: [validApproval(), conditional],
      supersessionRecords: [],
    });

    expect(resolution.status).toBe(DOCUMENT_AUTHORITY_STATUSES.CONFLICTING);
    expect(resolution.conflicts).toHaveLength(1);
  });

  it('rejects duplicate record IDs in a record set', () => {
    const duplicate = { ...validApproval() };

    expect(
      validateAuthorityRecordSet([validApproval(), duplicate]).errors,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DUPLICATE_RECORD_ID' }),
      ]),
    );
  });
});
