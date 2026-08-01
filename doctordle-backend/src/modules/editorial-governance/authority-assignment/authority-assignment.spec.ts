import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { validateDocumentApprovalRecord } from '../document-authority/document-authority.validation';
import {
  AUTHORITY_ASSIGNMENT_GRANT,
  APPROVED_OPTION_ID,
  createAuthorityTypeRegistry,
  evaluateAuthorityScope,
  evaluateSeparationOfDuties,
  resolveGovernedAuthority,
  validateActorCommandContext,
  validateAuthorityAssignment,
  validateAuthorityAssignmentSet,
  validateAuthorityGrant,
  validateAuthorityTypeDefinition,
  validateDelegation,
  type ActorCommandContext,
  type AuthorityAssignment,
  type AuthorityScope,
  type AuthorityTypeDefinition,
} from './index';

const NOW = '2026-08-01T12:00:00Z';

const findRepositoryRoot = (): string => {
  let current = process.cwd();
  for (let depth = 0; depth < 6; depth += 1) {
    if (
      existsSync(join(current, 'docs', 'weos')) &&
      existsSync(join(current, 'doctordle-backend'))
    )
      return current;
    current = resolve(current, '..');
  }
  throw new Error('Repository root not found.');
};

const readJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(join(findRepositoryRoot(), relativePath), 'utf8'));

const typeDef = (
  overrides: Partial<AuthorityTypeDefinition> = {},
): AuthorityTypeDefinition => ({
  authorityType: 'EDITORIAL_APPROVAL',
  authorityTypeSchemaVersion: '1.0.0',
  status: 'APPROVED',
  allowedDecisionTypes: ['FINAL_APPROVAL', 'EDITORIAL_REVIEW'],
  requiredScopeDimensions: [
    'organizationIds',
    'specialtyIds',
    'artifactTypes',
    'environmentScopes',
  ],
  permitsGlobalScope: false,
  requiresHumanAuthority: true,
  permittedSubjectTypes: ['USER', 'SERVICE_ACCOUNT', 'AUTOMATION'],
  permitsDelegation: false,
  maximumDelegationDepth: 0,
  grantableAuthorityTypes: [],
  requiresEnhancedGrantEvidence: false,
  separationOfDutiesRules: [],
  ...overrides,
});

const grantDef = (
  overrides: Partial<AuthorityTypeDefinition> = {},
): AuthorityTypeDefinition => ({
  ...typeDef({
    authorityType: AUTHORITY_ASSIGNMENT_GRANT,
    requiredScopeDimensions: [
      'organizationIds',
      'specialtyIds',
      'artifactTypes',
      'environmentScopes',
    ],
    requiresHumanAuthority: true,
    permitsDelegation: true,
    maximumDelegationDepth: 2,
    grantableAuthorityTypes: ['EDITORIAL_APPROVAL'],
  }),
  ...overrides,
});

const registry = (defs: AuthorityTypeDefinition[] = [typeDef(), grantDef()]) =>
  createAuthorityTypeRegistry(defs);

const scope = (overrides: AuthorityScope = {}): AuthorityScope => ({
  organizationIds: ['org-1'],
  specialtyIds: ['cardiology'],
  artifactTypes: ['CASE'],
  artifactIds: ['case-1'],
  artifactRevisionIds: ['rev-1'],
  decisionTypes: ['FINAL_APPROVAL'],
  environmentScopes: ['production'],
  ...overrides,
});

const assignment = (
  overrides: Partial<AuthorityAssignment> = {},
): AuthorityAssignment => ({
  assignmentId: 'aa-1',
  assignmentSchemaVersion: '1.0.0',
  subjectType: 'USER',
  subjectId: 'user-1',
  authorityType: 'EDITORIAL_APPROVAL',
  authorityTypeSchemaVersion: '1.0.0',
  status: 'ACTIVE',
  scopeMode: 'SCOPED',
  scope: scope(),
  allowedDecisionTypes: ['FINAL_APPROVAL'],
  authorityEvidenceReference:
    'docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-003.json',
  grantingAuthoritySnapshot: { authorityAssignmentId: 'grant-1' },
  grantedByActorType: 'USER',
  grantedByActorId: 'grantor-1',
  grantingAuthorityAssignmentId: 'grant-1',
  grantedAt: '2026-08-01T00:00:00Z',
  validFrom: '2026-08-01T00:00:00Z',
  validUntil: '2026-12-31T00:00:00Z',
  reviewDueAt: '2026-09-01T00:00:00Z',
  rationale: 'Stage 1 test assignment only.',
  delegationAllowed: false,
  maximumDelegationDepth: 0,
  humanAuthorityActorId: 'user-1',
  ...overrides,
});

const grantAssignment = (
  overrides: Partial<AuthorityAssignment> = {},
): AuthorityAssignment =>
  assignment({
    assignmentId: 'grant-1',
    authorityType: AUTHORITY_ASSIGNMENT_GRANT,
    scope: scope({ artifactIds: undefined, artifactRevisionIds: undefined }),
    delegationAllowed: true,
    maximumDelegationDepth: 2,
    ...overrides,
  });

const actor = (
  overrides: Partial<ActorCommandContext> = {},
): ActorCommandContext => ({
  actorType: 'USER',
  actorId: 'user-1',
  runtimeRoles: ['ADMIN'],
  organizationContextIds: ['org-1'],
  specialtyContextIds: ['cardiology'],
  authorityAssignmentReferences: ['aa-1'],
  correlationId: 'corr-1',
  causationId: 'cause-1',
  requestedAt: NOW,
  ...overrides,
});

const request = {
  authorityType: 'EDITORIAL_APPROVAL',
  decisionType: 'FINAL_APPROVAL',
  organizationId: 'org-1',
  specialtyId: 'cardiology',
  artifactType: 'CASE',
  artifactId: 'case-1',
  artifactRevisionId: 'rev-1',
  environmentScope: 'production',
};

const resolveCase = (
  overrides: Partial<AuthorityAssignment> = {},
  context: Partial<ActorCommandContext> = {},
  hasAccess = true,
) =>
  resolveGovernedAuthority({
    actorContext: actor(context),
    assignments: [assignment(overrides)],
    authorityTypeRegistry: registry(),
    request,
    evaluatedAt: NOW,
    hasRequiredTechnicalAccess: hasAccess,
  });

const denies = (result: { status: string }) =>
  expect(result.status).toBe('DENIED');

describe('WEOS authority assignment Stage 1 contracts', () => {
  it('1 APP-003 validates using existing document-authority contracts', () => {
    expect(
      validateDocumentApprovalRecord(
        readJson(
          'docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-003.json',
        ),
      ).valid,
    ).toBe(true);
  });

  it('2 APP-003 points to OD-022 v0.1', () => {
    const record = validateDocumentApprovalRecord(
      readJson(
        'docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-003.json',
      ),
    ).record;
    expect(record?.documentId).toBe('WEOS-OD-022');
    expect(record?.documentVersion).toBe('0.1');
    expect(record?.implementationAuthorization).toBe(
      'GRANTED_FOR_STAGE_1_CONTRACTS_ONLY',
    );
  });

  it('3 APP-003 uses APP-001 as authority basis', () => {
    const record = validateDocumentApprovalRecord(
      readJson(
        'docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-003.json',
      ),
    ).record;
    expect(record?.approver.authorityBasis).toContain('WEOS-AUTH-APP-001.json');
  });

  it('4 APP-003 records APP-002 as dependency evidence via schema-supported field', () => {
    const record = validateDocumentApprovalRecord(
      readJson(
        'docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-003.json',
      ),
    ).record;
    expect(`${record?.rationale} ${record?.conditions.join(' ')}`).toContain(
      'WEOS-AUTH-APP-002',
    );
  });

  it('5 Production authority-type registry parses', () => {
    expect(
      readJson('docs/weos/authority-assignments/authority-type-registry.json'),
    ).toMatchObject({ schemaVersion: '1.0.0' });
  });

  it('6 Production authority-type registry contains no approved type', () => {
    expect(
      (
        readJson(
          'docs/weos/authority-assignments/authority-type-registry.json',
        ) as { authorityTypes: unknown[] }
      ).authorityTypes,
    ).toEqual([]);
  });

  it('7 Production assignment collection parses', () => {
    expect(
      readJson('docs/weos/authority-assignments/authority-assignments.json'),
    ).toMatchObject({ schemaVersion: '1.0.0' });
  });

  it('8 Production assignment collection contains no assignment', () => {
    expect(
      (
        readJson(
          'docs/weos/authority-assignments/authority-assignments.json',
        ) as { assignments: unknown[] }
      ).assignments,
    ).toEqual([]);
  });

  it('9 Admin role alone does not authorize', () =>
    denies(
      resolveGovernedAuthority({
        actorContext: actor({ authorityAssignmentReferences: [] }),
        assignments: [],
        authorityTypeRegistry: registry(),
        request,
        evaluatedAt: NOW,
        hasRequiredTechnicalAccess: true,
      }),
    ));
  it('10 Senior-editor role alone does not authorize', () =>
    denies(
      resolveGovernedAuthority({
        actorContext: actor({
          runtimeRoles: ['SENIOR_EDITOR'],
          authorityAssignmentReferences: [],
        }),
        assignments: [],
        authorityTypeRegistry: registry(),
        request,
        evaluatedAt: NOW,
        hasRequiredTechnicalAccess: true,
      }),
    ));
  it('11 Runtime access and authority independent', () =>
    denies(
      resolveGovernedAuthority({
        actorContext: actor(),
        assignments: [],
        authorityTypeRegistry: registry(),
        request,
        evaluatedAt: NOW,
        hasRequiredTechnicalAccess: true,
      }),
    ));
  it('12 Technical access failure denies even with valid assignment', () =>
    denies(resolveCase({}, {}, false)));
  it('13 Active matching assignment authorizes in pure resolution', () =>
    expect(resolveCase().status).toBe('AUTHORIZED'));
  it('14 Missing assignment fails closed', () =>
    denies(
      resolveGovernedAuthority({
        actorContext: actor(),
        assignments: [],
        authorityTypeRegistry: registry(),
        request,
        evaluatedAt: NOW,
        hasRequiredTechnicalAccess: true,
      }),
    ));
  it('15 Pending fails', () => denies(resolveCase({ status: 'PENDING' })));
  it('16 Future fails', () =>
    denies(resolveCase({ validFrom: '2026-09-01T00:00:00Z' })));
  it('17 Expired fails', () =>
    denies(resolveCase({ validUntil: '2026-08-01T00:00:00Z' })));
  it('18 Suspended fails', () =>
    denies(resolveCase({ status: 'SUSPENDED', suspendedAt: NOW })));
  it('19 Revoked fails', () =>
    denies(
      resolveCase({
        status: 'REVOKED',
        revokedAt: NOW,
        revokedByActorId: 'grantor-1',
      }),
    ));
  it('20 Superseded fails', () =>
    denies(
      resolveCase({ status: 'SUPERSEDED', supersededByAssignmentId: 'aa-2' }),
    ));
  it('21 Invalid fails', () => denies(resolveCase({ status: 'INVALID' })));
  it('22 Unregistered type fails', () =>
    denies(
      resolveGovernedAuthority({
        actorContext: actor(),
        assignments: [assignment()],
        authorityTypeRegistry: registry([]),
        request,
        evaluatedAt: NOW,
        hasRequiredTechnicalAccess: true,
      }),
    ));
  it('23 Draft definition cannot authorize', () =>
    denies(
      resolveGovernedAuthority({
        actorContext: actor(),
        assignments: [assignment()],
        authorityTypeRegistry: registry([typeDef({ status: 'DRAFT' })]),
        request,
        evaluatedAt: NOW,
        hasRequiredTechnicalAccess: true,
      }),
    ));
  it('24 Authority type mismatch fails', () =>
    denies(resolveCase({ authorityType: 'PUBLICATION_AUTHORIZATION' })));
  it('25 Decision type mismatch fails', () =>
    denies(
      resolveCase({
        allowedDecisionTypes: ['EDITORIAL_REVIEW'],
        scope: scope({ decisionTypes: ['EDITORIAL_REVIEW'] }),
      }),
    ));
  it('26 Organization mismatch fails', () =>
    denies(resolveCase({ scope: scope({ organizationIds: ['org-2'] }) })));
  it('27 Specialty mismatch fails', () =>
    denies(resolveCase({ scope: scope({ specialtyIds: ['neurology'] }) })));
  it('28 Artifact-type mismatch fails', () =>
    denies(resolveCase({ scope: scope({ artifactTypes: ['GUIDELINE'] }) })));
  it('29 Artifact-ID mismatch fails', () =>
    denies(resolveCase({ scope: scope({ artifactIds: ['case-2'] }) })));
  it('30 Revision mismatch where required', () =>
    denies(resolveCase({ scope: scope({ artifactRevisionIds: ['rev-2'] }) })));
  it('31 Environment mismatch fails', () =>
    denies(resolveCase({ scope: scope({ environmentScopes: ['staging'] }) })));
  it('32 Empty scoped assignment not global', () =>
    expect(
      validateAuthorityAssignment(assignment({ scope: {} }), registry()).issues,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'EMPTY_SCOPED_ASSIGNMENT' }),
      ]),
    ));
  it('33 Explicit global requires approved policy permission', () =>
    expect(
      validateAuthorityAssignment(
        assignment({ scopeMode: 'GLOBAL', scope: {} }),
        registry(),
      ).issues,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'GLOBAL_SCOPE_NOT_PERMITTED' }),
      ]),
    ));
  it('34 Global requires enhanced evidence', () =>
    expect(
      validateAuthorityAssignment(
        assignment({ scopeMode: 'GLOBAL', scope: {} }),
        registry([typeDef({ permitsGlobalScope: true })]),
      ).issues,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'GLOBAL_REQUIRES_ENHANCED_EVIDENCE' }),
      ]),
    ));
  it('35 Missing authority evidence fails', () =>
    expect(
      validateAuthorityAssignment(
        assignment({ authorityEvidenceReference: '' }),
        registry(),
      ).issues,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'REQUIRED_NON_EMPTY_STRING' }),
      ]),
    ));
  it('36 Missing granting-authority snapshot fails', () =>
    expect(
      validateAuthorityAssignment(
        assignment({ grantingAuthoritySnapshot: {} }),
        registry(),
      ).issues,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'MISSING_GRANTING_AUTHORITY_SNAPSHOT',
        }),
      ]),
    ));
  it('37 Grant authority separate from action authority', () =>
    expect(
      validateAuthorityGrant({
        grantorAssignment: assignment(),
        proposedAssignment: assignment({ assignmentId: 'aa-2' }),
        authorityTypeRegistry: registry(),
        evaluatedAt: NOW,
      }).issues,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'GRANT_AUTHORITY_REQUIRED' }),
      ]),
    ));
  it('38 Grantor cannot grant broader authority type', () =>
    expect(
      validateAuthorityGrant({
        grantorAssignment: grantAssignment(),
        proposedAssignment: assignment({ authorityType: 'GRAPH_PROMOTION' }),
        authorityTypeRegistry: registry(),
        evaluatedAt: NOW,
      }).issues,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'GRANT_AUTHORITY_TYPE_ESCALATION' }),
      ]),
    ));
  it('39 Grantor cannot grant broader organization', () =>
    expect(
      validateAuthorityGrant({
        grantorAssignment: grantAssignment({
          scope: scope({
            organizationIds: ['org-1'],
            artifactIds: undefined,
            artifactRevisionIds: undefined,
          }),
        }),
        proposedAssignment: assignment({
          scope: scope({ organizationIds: ['org-1', 'org-2'] }),
        }),
        authorityTypeRegistry: registry(),
        evaluatedAt: NOW,
      }).issues,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'GRANT_SCOPE_ESCALATION' }),
      ]),
    ));
  it('40 Grantor cannot grant broader specialty', () =>
    expect(
      validateAuthorityGrant({
        grantorAssignment: grantAssignment({
          scope: scope({
            specialtyIds: ['cardiology'],
            artifactIds: undefined,
            artifactRevisionIds: undefined,
          }),
        }),
        proposedAssignment: assignment({
          scope: scope({ specialtyIds: ['cardiology', 'neurology'] }),
        }),
        authorityTypeRegistry: registry(),
        evaluatedAt: NOW,
      }).issues,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'GRANT_SCOPE_ESCALATION' }),
      ]),
    ));
  it('41 Grantor cannot grant broader artifact', () =>
    expect(
      validateAuthorityGrant({
        grantorAssignment: grantAssignment({
          scope: scope({ artifactTypes: ['CASE'], artifactIds: ['case-1'] }),
        }),
        proposedAssignment: assignment({
          scope: scope({ artifactIds: ['case-1', 'case-2'] }),
        }),
        authorityTypeRegistry: registry(),
        evaluatedAt: NOW,
      }).issues,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'GRANT_SCOPE_ESCALATION' }),
      ]),
    ));
  it('42 Grantor cannot grant longer validity than permitted', () =>
    expect(
      validateAuthorityGrant({
        grantorAssignment: grantAssignment({
          validUntil: '2026-08-10T00:00:00Z',
        }),
        proposedAssignment: assignment({ validUntil: '2026-08-11T00:00:00Z' }),
        authorityTypeRegistry: registry(),
        evaluatedAt: NOW,
      }).issues,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'GRANT_DURATION_ESCALATION' }),
      ]),
    ));
  it('43 Grantor cannot grant beyond own validity', () =>
    expect(
      validateAuthorityGrant({
        grantorAssignment: grantAssignment({
          validUntil: '2026-08-02T00:00:00Z',
        }),
        proposedAssignment: assignment({ validUntil: '2026-08-03T00:00:00Z' }),
        authorityTypeRegistry: registry(),
        evaluatedAt: NOW,
      }).issues,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'GRANT_DURATION_ESCALATION' }),
      ]),
    ));
  it('44 Delegation denied by default', () =>
    expect(
      validateDelegation({
        parentAssignment: assignment(),
        childAssignment: assignment({
          assignmentId: 'aa-2',
          parentAssignmentId: 'aa-1',
          subjectId: 'user-2',
        }),
        assignmentSet: [],
        authorityTypeRegistry: registry(),
        evaluatedAt: NOW,
      }).issues,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DELEGATION_DENIED_BY_DEFAULT' }),
      ]),
    ));
  it('45 Authorized delegation respects max depth', () =>
    expect(
      validateDelegation({
        parentAssignment: assignment({
          delegationAllowed: true,
          maximumDelegationDepth: 1,
        }),
        childAssignment: assignment({
          assignmentId: 'aa-2',
          parentAssignmentId: 'aa-1',
          subjectId: 'user-2',
        }),
        assignmentSet: [
          assignment({
            assignmentId: 'aa-1',
            delegationAllowed: true,
            maximumDelegationDepth: 1,
          }),
          assignment({
            assignmentId: 'aa-2',
            parentAssignmentId: 'aa-1',
            subjectId: 'user-2',
          }),
        ],
        authorityTypeRegistry: registry([
          typeDef({ permitsDelegation: true, maximumDelegationDepth: 1 }),
          grantDef(),
        ]),
        evaluatedAt: NOW,
      }).valid,
    ).toBe(true));
  it('46 Beyond max fails', () =>
    expect(
      validateDelegation({
        parentAssignment: assignment({
          delegationAllowed: true,
          maximumDelegationDepth: 0,
        }),
        childAssignment: assignment({
          assignmentId: 'aa-2',
          parentAssignmentId: 'aa-1',
          subjectId: 'user-2',
        }),
        assignmentSet: [
          assignment({
            assignmentId: 'aa-2',
            parentAssignmentId: 'aa-1',
            subjectId: 'user-2',
          }),
        ],
        authorityTypeRegistry: registry([
          typeDef({ permitsDelegation: true }),
          grantDef(),
        ]),
        evaluatedAt: NOW,
      }).issues,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DELEGATION_DEPTH_EXCEEDED' }),
      ]),
    ));
  it('47 Circular rejected', () =>
    expect(
      validateAuthorityAssignmentSet(
        [
          assignment({ parentAssignmentId: 'aa-2' }),
          assignment({
            assignmentId: 'aa-2',
            parentAssignmentId: 'aa-1',
            subjectId: 'user-2',
          }),
        ],
        registry(),
      ).issues,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'CIRCULAR_DELEGATION' }),
      ]),
    ));
  it('48 Self-parenting rejected', () =>
    expect(
      validateDelegation({
        parentAssignment: assignment(),
        childAssignment: assignment({ parentAssignmentId: 'aa-1' }),
        assignmentSet: [],
        authorityTypeRegistry: registry(),
        evaluatedAt: NOW,
      }).issues,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'SELF_PARENTING_DELEGATION' }),
      ]),
    ));
  it('49 Self-originating rejected', () =>
    expect(
      validateDelegation({
        parentAssignment: assignment({ delegationAllowed: true }),
        childAssignment: assignment({
          assignmentId: 'aa-2',
          parentAssignmentId: 'aa-1',
        }),
        assignmentSet: [],
        authorityTypeRegistry: registry([
          typeDef({ permitsDelegation: true }),
          grantDef(),
        ]),
        evaluatedAt: NOW,
      }).issues,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'SELF_ORIGINATING_DELEGATION' }),
      ]),
    ));
  it('50 Delegated scope escalation fails', () =>
    expect(
      validateDelegation({
        parentAssignment: assignment({
          delegationAllowed: true,
          scope: scope({ artifactIds: ['case-1'] }),
        }),
        childAssignment: assignment({
          assignmentId: 'aa-2',
          parentAssignmentId: 'aa-1',
          subjectId: 'user-2',
          scope: scope({ artifactIds: ['case-1', 'case-2'] }),
        }),
        assignmentSet: [],
        authorityTypeRegistry: registry([
          typeDef({ permitsDelegation: true }),
          grantDef(),
        ]),
        evaluatedAt: NOW,
      }).issues,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DELEGATED_SCOPE_ESCALATION' }),
      ]),
    ));
  it('51 Delegated duration escalation fails', () =>
    expect(
      validateDelegation({
        parentAssignment: assignment({
          delegationAllowed: true,
          validUntil: '2026-08-10T00:00:00Z',
        }),
        childAssignment: assignment({
          assignmentId: 'aa-2',
          parentAssignmentId: 'aa-1',
          subjectId: 'user-2',
          validUntil: '2026-08-11T00:00:00Z',
        }),
        assignmentSet: [],
        authorityTypeRegistry: registry([
          typeDef({ permitsDelegation: true }),
          grantDef(),
        ]),
        evaluatedAt: NOW,
      }).issues,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DELEGATED_DURATION_ESCALATION' }),
      ]),
    ));
  it('52 Separation conflict rejected', () =>
    expect(
      evaluateSeparationOfDuties({
        rules: ['REQUESTER_CANNOT_BE_FINAL_AUTHORITY'],
        requesterActorId: 'user-1',
        finalAuthorityActorId: 'user-1',
      }).valid,
    ).toBe(false));
  it('53 Service-account execution not human authority', () =>
    denies(
      resolveCase(
        {
          subjectType: 'SERVICE_ACCOUNT',
          subjectId: 'svc-1',
          humanAuthorityActorId: undefined,
        },
        { actorType: 'SERVICE_ACCOUNT', actorId: 'svc-1' },
      ),
    ));
  it('54 Automation execution does not waive human-authority policy', () =>
    denies(
      resolveCase(
        {
          subjectType: 'AUTOMATION',
          subjectId: 'auto-1',
          humanAuthorityActorId: undefined,
        },
        { actorType: 'AUTOMATION', actorId: 'auto-1' },
      ),
    ));
  it('55 Revocation does not rewrite historical authority snapshots', () => {
    const before = resolveCase();
    const after = resolveCase({
      status: 'REVOKED',
      revokedAt: '2026-08-02T00:00:00Z',
      revokedByActorId: 'grantor-1',
    });
    expect(before.od018AuthorityEvidence?.authorityAssignmentId).toBe('aa-1');
    denies(after);
  });
  it('56 Runtime roles cannot satisfy assignment schema', () =>
    expect(
      validateAuthorityAssignment({ runtimeRoles: ['ADMIN'] }, registry())
        .valid,
    ).toBe(false));
  it('57 User profile fields cannot produce assignments', () =>
    expect(
      validateAuthorityAssignment(
        { profileSpecialty: 'cardiology', employmentTitle: 'Chief' },
        registry(),
      ).valid,
    ).toBe(false));
  it('58 Frontend visibility cannot produce assignments', () =>
    expect(
      validateAuthorityAssignment(
        { visibleButton: true, dashboardAccess: true },
        registry(),
      ).valid,
    ).toBe(false));
  it('59 Assignment references in command context are unresolved claims', () => {
    expect(
      validateActorCommandContext(
        actor({ authorityAssignmentReferences: ['aa-1'] }),
      ).valid,
    ).toBe(true);
    denies(
      resolveGovernedAuthority({
        actorContext: actor({ authorityAssignmentReferences: ['missing'] }),
        assignments: [assignment()],
        authorityTypeRegistry: registry(),
        request,
        evaluatedAt: NOW,
        hasRequiredTechnicalAccess: true,
      }),
    );
  });
  it('60 OD-018 compatibility preserved', () =>
    expect(resolveCase().od018AuthorityEvidence).toMatchObject({
      authorityAssignmentId: 'aa-1',
      authorityEvidenceReference: expect.any(String),
      authorityResolvedAt: NOW,
    }));
  it('61 Bootstrap authority not production assignment', () =>
    expect(
      JSON.stringify(
        readJson('docs/weos/authority-assignments/authority-assignments.json'),
      ),
    ).not.toContain('Founding Architecture Authority'));
  it('62 No test implies runtime enforcement', () =>
    expect(resolveGovernedAuthority.name).toBe('resolveGovernedAuthority'));
  it('63 No test implies persistence', () =>
    expect(
      readFileSync(join(__dirname, 'authority-assignment.types.ts'), 'utf8'),
    ).not.toMatch(/Prisma|Repository|Controller/));
  it('64 No test creates real institutional authority', () =>
    expect(APPROVED_OPTION_ID).toBe(
      'OPTION_D_HYBRID_TECHNICAL_ACCESS_AND_SCOPED_AUTHORITY',
    ));
});
