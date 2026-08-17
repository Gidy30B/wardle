import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { validateDocumentApprovalRecord } from '../document-authority/document-authority.validation';
import {
  createGovernanceDecisionExtensionRegistry,
  hasApprovedProductionExtension,
} from './governance-decision.registry';
import { resolveGovernanceDecisionStanding } from './governance-decision.standing';
import type {
  GovernanceDecisionEnvelope,
  GovernanceDecisionExtensionPolicy,
} from './governance-decision.types';
import {
  validateGovernanceDecisionEnvelope,
  validateGovernanceDecisionSet,
} from './governance-decision.validation';
import { validateFinalizedDecisionImmutability } from './governance-decision.immutability';

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

const readRepositoryJson = (relativePath: string): unknown =>
  JSON.parse(
    readFileSync(join(findRepositoryRoot(), relativePath), 'utf8'),
  ) as unknown;

const approvedPolicy = (
  overrides: Partial<GovernanceDecisionExtensionPolicy> = {},
): GovernanceDecisionExtensionPolicy => ({
  extensionType: 'TEST_CASE_PUBLICATION_DECISION',
  extensionSchemaVersion: '1.0.0',
  approvalState: 'APPROVED',
  productionAuthority: 'NOT_GRANTED',
  allowedDecisionTypes: ['CASE_PUBLICATION_APPROVAL'],
  allowedOutcomes: ['APPROVED_WITH_CONDITIONS', 'REJECTED'],
  allowedEffectiveActions: ['ALLOW_PUBLICATION', 'BLOCK_PUBLICATION'],
  requiresExactRevision: true,
  permitsNonHumanAuthority: false,
  allowedSupersessionScopes: ['GLOBAL', 'PUBLICATION', 'SECTION:findings'],
  validateExtensionPayload: (payload) =>
    typeof payload.policyBasis === 'string' ? [] : ['policyBasis is required.'],
  ...overrides,
});

const registry = (policy = approvedPolicy()) =>
  createGovernanceDecisionExtensionRegistry([policy]);

const target = (
  scope = 'PUBLICATION',
  revision: string | null = 'case-revision-1',
) => ({
  artifactType: 'CASE_REVISION',
  artifactId: 'case-1',
  ...(revision === null ? {} : { artifactRevisionId: revision }),
  targetScope: scope,
});

const decision = (
  overrides: Partial<GovernanceDecisionEnvelope> = {},
): GovernanceDecisionEnvelope => ({
  decisionId: 'GD-001',
  envelopeSchemaVersion: '1.0.0',
  extensionType: 'TEST_CASE_PUBLICATION_DECISION',
  extensionSchemaVersion: '1.0.0',
  decisionType: 'CASE_PUBLICATION_APPROVAL',
  status: 'FINALIZED',
  primaryTarget: target(),
  targetReferences: [target()],
  actor: { actorType: 'AUTOMATION', actorId: 'automation-1' },
  authority: {
    humanAuthorityActorId: 'human-1',
    authorityAssignmentId: 'authority-assignment-1',
    authorityEvidenceReference: 'WEOS-AUTH-TEST-001',
    authorityScopeSnapshot: 'Case publication approval for case-revision-1',
    authorityResolvedAt: '2026-07-29T00:00:00Z',
  },
  rationale: 'A rationale is required.',
  findings: ['Findings are required.'],
  outcome: 'APPROVED_WITH_CONDITIONS',
  effectiveAction: 'ALLOW_PUBLICATION',
  obligations: ['Keep conditions visible.'],
  supersessionReferences: [],
  extensionPayload: { policyBasis: 'Unit-test extension policy.' },
  occurredAt: '2026-07-29T00:00:00Z',
  createdAt: '2026-07-29T00:00:00Z',
  ...overrides,
});

const expectError = (
  result: { errors: readonly { code: string }[] },
  code: string,
) =>
  expect(result.errors).toEqual(
    expect.arrayContaining([expect.objectContaining({ code })]),
  );

describe('WEOS governance decision envelope Stage 1 contracts', () => {
  it('validates APP-002 using existing authority-record contracts', () => {
    const result = validateDocumentApprovalRecord(
      readRepositoryJson(
        'docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-002.json',
      ),
    );

    expect(result.errors).toEqual([]);
    expect(result.record?.approvalOutcome).toBe('APPROVED_WITH_CONDITIONS');
  });

  it('points APP-002 to the existing OD-018 document', () => {
    const result = validateDocumentApprovalRecord(
      readRepositoryJson(
        'docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-002.json',
      ),
    );

    expect(result.record?.documentId).toBe('WEOS-OD-018');
    expect(
      existsSync(join(findRepositoryRoot(), result.record?.documentPath ?? '')),
    ).toBe(true);
  });

  it('parses the repository extension registry', () => {
    expect(() =>
      readRepositoryJson(
        'docs/weos/governance-decisions/extension-registry.json',
      ),
    ).not.toThrow();
  });

  it('keeps the repository registry free of invented approved production extensions', () => {
    expect(
      hasApprovedProductionExtension(
        readRepositoryJson(
          'docs/weos/governance-decisions/extension-registry.json',
        ),
      ),
    ).toBe(false);
  });

  it('validates a matching in-memory approved test extension decision', () => {
    expect(
      validateGovernanceDecisionEnvelope(decision(), registry()).errors,
    ).toEqual([]);
  });

  it('rejects unregistered extensions', () => {
    expectError(
      validateGovernanceDecisionEnvelope(
        decision(),
        createGovernanceDecisionExtensionRegistry([]),
      ),
      'UNREGISTERED_EXTENSION',
    );
  });

  it('rejects draft extensions as decision authority', () => {
    expectError(
      validateGovernanceDecisionEnvelope(
        decision(),
        registry(approvedPolicy({ approvalState: 'DRAFT' })),
      ),
      'EXTENSION_NOT_APPROVED',
    );
  });

  it('keeps envelope and extension schema versions independently versioned', () => {
    const versioned = decision({
      envelopeSchemaVersion: '2.0.0',
      extensionSchemaVersion: '1.0.0',
    });

    expect(
      validateGovernanceDecisionEnvelope(versioned, registry()).valid,
    ).toBe(true);
  });

  it('requires exact revisions when extension policy requires them', () => {
    expectError(
      validateGovernanceDecisionEnvelope(
        decision({
          primaryTarget: target('PUBLICATION', null),
          targetReferences: [target('PUBLICATION', null)],
        }),
        registry(),
      ),
      'EXACT_REVISION_REQUIRED',
    );
  });

  it('allows omitted revision only when extension policy allows it', () => {
    const noRevision = decision({
      primaryTarget: target('PUBLICATION', null),
      targetReferences: [target('PUBLICATION', null)],
    });

    expect(
      validateGovernanceDecisionEnvelope(
        noRevision,
        registry(approvedPolicy({ requiresExactRevision: false })),
      ).valid,
    ).toBe(true);
  });

  it('supports multiple targets', () => {
    const multi = decision({
      targetReferences: [
        target('PUBLICATION'),
        target('READINESS', 'case-revision-1'),
      ],
    });

    expect(validateGovernanceDecisionEnvelope(multi, registry()).valid).toBe(
      true,
    );
  });

  it('requires the primary target to appear in targetReferences', () => {
    expectError(
      validateGovernanceDecisionEnvelope(
        decision({
          targetReferences: [target('READINESS', 'case-revision-1')],
        }),
        registry(),
      ),
      'PRIMARY_TARGET_NOT_LISTED',
    );
  });

  it('rejects duplicate targets', () => {
    expectError(
      validateGovernanceDecisionEnvelope(
        decision({ targetReferences: [target(), target()] }),
        registry(),
      ),
      'DUPLICATE_TARGET',
    );
  });

  it('does not let automation waive human authority', () => {
    expectError(
      validateGovernanceDecisionEnvelope(
        decision({
          authority: {
            ...decision().authority,
            humanAuthorityActorId: undefined,
          },
        }),
        registry(),
      ),
      'HUMAN_AUTHORITY_REQUIRED',
    );
  });

  it('permits absent human authority only when approved policy allows it', () => {
    const automated = decision({
      authority: { ...decision().authority, humanAuthorityActorId: undefined },
    });

    expect(
      validateGovernanceDecisionEnvelope(
        automated,
        registry(approvedPolicy({ permitsNonHumanAuthority: true })),
      ).valid,
    ).toBe(true);
  });

  it('requires authority evidence and resolution timestamp', () => {
    expectError(
      validateGovernanceDecisionEnvelope(
        decision({
          authority: {
            ...decision().authority,
            authorityEvidenceReference: '',
            authorityResolvedAt: '',
          },
        }),
        registry(),
      ),
      'AUTHORITY_EVIDENCE_REQUIRED',
    );
  });

  it('validates outcome by extension policy', () => {
    expectError(
      validateGovernanceDecisionEnvelope(
        decision({ outcome: 'APPROVED' }),
        registry(),
      ),
      'INVALID_OUTCOME',
    );
  });

  it('validates effective action by extension policy', () => {
    expectError(
      validateGovernanceDecisionEnvelope(
        decision({ effectiveAction: 'PUBLISH_NOW' }),
        registry(),
      ),
      'INVALID_EFFECTIVE_ACTION',
    );
  });

  it('rejects unvalidated generic payloads', () => {
    expectError(
      validateGovernanceDecisionEnvelope(
        decision({ extensionPayload: {} }),
        registry(),
      ),
      'UNVALIDATED_GENERIC_PAYLOAD',
    );
  });

  it('rejects self-supersession', () => {
    expectError(
      validateGovernanceDecisionEnvelope(
        decision({
          supersessionReferences: [
            { decisionId: 'GD-001', supersessionScope: 'GLOBAL' },
          ],
        }),
        registry(),
      ),
      'SELF_SUPERSESSION',
    );
  });

  it('resolves full supersession as SUPERSEDED', () => {
    const original = decision();
    const replacement = decision({
      decisionId: 'GD-002',
      supersessionReferences: [
        { decisionId: 'GD-001', supersessionScope: 'GLOBAL' },
      ],
    });

    expect(
      resolveGovernanceDecisionStanding(original, [original, replacement]),
    ).toBe('SUPERSEDED');
  });

  it('resolves scoped supersession as PARTIALLY_SUPERSEDED', () => {
    const original = decision();
    const replacement = decision({
      decisionId: 'GD-002',
      supersessionReferences: [
        { decisionId: 'GD-001', supersessionScope: 'PUBLICATION' },
      ],
    });

    expect(
      resolveGovernanceDecisionStanding(original, [original, replacement]),
    ).toBe('PARTIALLY_SUPERSEDED');
  });

  it('resolves incompatible supersession as CONFLICTING', () => {
    const original = decision();
    const replacement = decision({
      decisionId: 'GD-002',
      supersessionReferences: [
        { decisionId: 'GD-001', supersessionScope: 'UNKNOWN_SCOPE' },
      ],
    });

    expect(
      resolveGovernanceDecisionStanding(original, [original, replacement]),
    ).toBe('CONFLICTING');
  });

  it('prevents finalized decisions from being edited in place', () => {
    expectError(
      validateFinalizedDecisionImmutability(
        decision(),
        decision({ rationale: 'Changed.' }),
      ),
      'FINALIZED_DECISION_IMMUTABLE',
    );
  });

  it('allows a new replacement decision with scoped supersession to validate', () => {
    const replacement = decision({
      decisionId: 'GD-002',
      supersessionReferences: [
        { decisionId: 'GD-001', supersessionScope: 'PUBLICATION' },
      ],
    });

    expect(
      validateGovernanceDecisionEnvelope(replacement, registry()).valid,
    ).toBe(true);
  });

  it('rejects duplicate decision IDs in a set', () => {
    expectError(
      validateGovernanceDecisionSet([decision(), decision()], registry()),
      'DUPLICATE_DECISION_ID',
    );
  });

  it('fails set validation when a superseded decision reference is missing', () => {
    expectError(
      validateGovernanceDecisionSet(
        [
          decision({
            decisionId: 'GD-002',
            supersessionReferences: [
              { decisionId: 'GD-001', supersessionScope: 'GLOBAL' },
            ],
          }),
        ],
        registry(),
      ),
      'MISSING_SUPERSEDED_DECISION',
    );
  });

  it('does not treat workflow records as decisions', () => {
    expectError(
      validateGovernanceDecisionEnvelope(
        { status: 'APPROVED' } as unknown as GovernanceDecisionEnvelope,
        registry(),
      ),
      'UNREGISTERED_EXTENSION',
    );
  });

  it('does not treat validation results as decisions', () => {
    expectError(
      validateGovernanceDecisionEnvelope(
        { valid: true, errors: [] } as unknown as GovernanceDecisionEnvelope,
        registry(),
      ),
      'UNREGISTERED_EXTENSION',
    );
  });

  it('does not treat audit events as decisions', () => {
    expectError(
      validateGovernanceDecisionEnvelope(
        { eventType: 'CASE_APPROVED' } as unknown as GovernanceDecisionEnvelope,
        registry(),
      ),
      'UNREGISTERED_EXTENSION',
    );
  });

  it('does not fabricate decisions from projection state', () => {
    expectError(
      validateGovernanceDecisionEnvelope(
        {
          publicationStatus: 'PUBLISHED',
        } as unknown as GovernanceDecisionEnvelope,
        registry(),
      ),
      'UNREGISTERED_EXTENSION',
    );
  });

  it('keeps OD-021 authority records separate from Governance Decisions', () => {
    const app001 = readRepositoryJson(
      'docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-001.json',
    );

    expect(validateDocumentApprovalRecord(app001).valid).toBe(true);
    expectError(
      validateGovernanceDecisionEnvelope(
        app001 as unknown as GovernanceDecisionEnvelope,
        registry(),
      ),
      'UNREGISTERED_EXTENSION',
    );
  });

  it('does not imply Prisma, persistence or runtime enforcement', () => {
    const files = [
      'doctordle-backend/src/modules/editorial-governance/governance-decision/governance-decision.types.ts',
      'doctordle-backend/src/modules/editorial-governance/governance-decision/governance-decision.validation.ts',
      'doctordle-backend/src/modules/editorial-governance/governance-decision/governance-decision.registry.ts',
      'doctordle-backend/src/modules/editorial-governance/governance-decision/governance-decision.standing.ts',
      'doctordle-backend/src/modules/editorial-governance/governance-decision/governance-decision.immutability.ts',
    ].map((path) => readFileSync(join(findRepositoryRoot(), path), 'utf8'));

    expect(files.join('\n')).not.toMatch(
      /PrismaClient|@nestjs|Controller|Injectable|Repository|database|persistence/i,
    );
  });
});
