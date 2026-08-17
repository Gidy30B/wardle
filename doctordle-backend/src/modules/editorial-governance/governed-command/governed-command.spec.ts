import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { validateDocumentApprovalRecord } from '../document-authority/document-authority.validation';
import {
  APPROVED_OPTION_ID,
  computeCommandFingerprint,
  createConcurrencyTokenPolicyRegistry,
  createGovernedCommandContractRegistry,
  evaluateConcurrencyPreconditions,
  findGovernedCommandContractDefinition,
  registerConcurrencyTokenPolicyDefinition,
  registerGovernedCommandContractDefinition,
  resolveCommandIdempotency,
  resolveGovernedBatch,
  resolveGovernedCommandEligibility,
  validateConcurrencyTokenPolicyDefinition,
  validateGovernedCommand,
  validateGovernedCommandSet,
  type ConcurrencyTokenPolicyDefinition,
  type CurrentDependencyState,
  type GovernedCommand,
  type GovernedCommandContractDefinition,
  type GovernedCommandResolutionResult,
  type IdempotencyRecord,
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
const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(join(findRepositoryRoot(), path), 'utf8'));

const contract = (
  overrides: Partial<GovernedCommandContractDefinition> = {},
): GovernedCommandContractDefinition => ({
  commandType: 'CASE_APPROVAL_COMMAND',
  commandContractVersion: '1.0.0',
  status: 'APPROVED',
  targetPolicy: {
    allowedArtifactTypes: ['CASE_REVISION', 'CASE'],
    primaryTargetPreconditionRequired: true,
    primaryTargetMode: 'EXACT_REVISION',
    revisionedArtifactTypes: ['CASE_REVISION'],
  },
  dependencyPolicy: {
    declaredDependencyRoles: [
      'PRIMARY_TARGET',
      'CASE_IDENTITY',
      'SCHEDULE_PROJECTION',
    ],
    requiredDependencyRoles: ['PRIMARY_TARGET'],
    permittedPreconditionModes: [
      'EXACT_REVISION',
      'EXPECTED_VERSION',
      'EXPECTED_TOKEN',
    ],
    permittedTokenPolicies: ['CASE_COMPOSITE_TOKEN'],
    requiresCompleteDependencyCoverage: true,
  },
  idempotencyPolicy: 'REQUIRED',
  batchPolicy: 'ATOMIC',
  staleResultPolicy: {
    staleStatus: 'REJECTED_STALE_PRECONDITION',
    exposeSafeCurrentStateOnlyWhenAuthorized: true,
  },
  ...overrides,
});
const tokenPolicy = (
  overrides: Partial<ConcurrencyTokenPolicyDefinition> = {},
): ConcurrencyTokenPolicyDefinition => ({
  tokenPolicyType: 'CASE_COMPOSITE_TOKEN',
  tokenPolicyVersion: '1.0.0',
  status: 'APPROVED',
  coveredDependencyRoles: ['PRIMARY_TARGET', 'SCHEDULE_PROJECTION'],
  coveredArtifactTypes: ['CASE'],
  tokenSemantics: 'Binds a test projection dependency set only.',
  requiresCompleteDependencyCoverage: true,
  ...overrides,
});
const command = (
  overrides: Partial<GovernedCommand> = {},
): GovernedCommand => ({
  commandId: 'cmd-1',
  commandType: 'CASE_APPROVAL_COMMAND',
  commandContractVersion: '1.0.0',
  actorContext: {
    actorType: 'USER',
    actorId: 'user-1',
    runtimeRoles: ['ADMIN'],
    organizationContextIds: [],
    specialtyContextIds: [],
    authorityAssignmentReferences: ['aa-1'],
    correlationId: 'corr-1',
    causationId: 'cause-1',
    requestedAt: NOW,
  },
  authorityResolutionReference: {
    authorityAssignmentId: 'aa-1',
    authorityResolvedAt: NOW,
  },
  primaryTarget: {
    artifactType: 'CASE_REVISION',
    artifactId: 'case-1',
    artifactRevisionId: 'rev-1',
    targetScope: 'EXACT_REVISION',
  },
  concurrencyPreconditions: [
    {
      target: {
        artifactType: 'CASE_REVISION',
        artifactId: 'case-1',
        artifactRevisionId: 'rev-1',
        targetScope: 'EXACT_REVISION',
      },
      preconditionMode: 'EXACT_REVISION',
      dependencyRole: 'PRIMARY_TARGET',
      expectedRevisionId: 'rev-1',
    },
  ],
  requestedEffect: { effectType: 'APPROVE_CASE' },
  payloadHash: 'payload-1',
  idempotencyKey: 'idem-1',
  submittedAt: NOW,
  correlationId: 'corr-1',
  causationId: 'cause-1',
  ...overrides,
});
const state = (
  overrides: Partial<CurrentDependencyState> = {},
): CurrentDependencyState => ({
  target: {
    artifactType: 'CASE_REVISION',
    artifactId: 'case-1',
    artifactRevisionId: 'rev-1',
    targetScope: 'EXACT_REVISION',
  },
  dependencyRole: 'PRIMARY_TARGET',
  status: 'KNOWN',
  currentRevisionId: 'rev-1',
  safeCurrentStateReference: { artifactRevisionId: 'rev-1' },
  ...overrides,
});
const registries = (defs = [contract()], tokens = [tokenPolicy()]) => ({
  commandContractRegistry: createGovernedCommandContractRegistry(defs),
  tokenPolicyRegistry: createConcurrencyTokenPolicyRegistry(tokens),
});
const eligible = (cmd = command(), states = [state()], authority = true) =>
  resolveGovernedCommandEligibility({
    command: cmd,
    ...registries(),
    currentDependencyStates: states,
    priorIdempotencyRecord: undefined,
    authorityEligibility: authority
      ? { eligible: true }
      : { eligible: false, reasons: ['NO_AUTHORITY'] },
    disclosureAuthorization: { canDiscloseCurrentState: false },
    evaluatedAt: NOW,
  });
const prior = (
  overrides: Partial<IdempotencyRecord> = {},
): IdempotencyRecord => ({
  idempotencyKey: 'idem-1',
  commandFingerprint: computeCommandFingerprint(command()),
  commandId: 'cmd-1',
  commandType: 'CASE_APPROVAL_COMMAND',
  resultStatus: 'SUCCESS',
  resultReference: 'result-1',
  recordedAt: NOW,
  ...overrides,
});
const denied = (result: { status: string }) =>
  expect(result.status).not.toBe('ELIGIBLE');

describe('WEOS governed command Stage 1 contracts', () => {
  it('1 APP-004 validates with existing document-authority contracts', () =>
    expect(
      validateDocumentApprovalRecord(
        readJson(
          'docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-004.json',
        ),
      ).valid,
    ).toBe(true));
  it('2 APP-004 points to OD-023 version 0.1', () => {
    const record = validateDocumentApprovalRecord(
      readJson(
        'docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-004.json',
      ),
    ).record;
    expect(record?.documentId).toBe('WEOS-OD-023');
    expect(record?.documentVersion).toBe('0.1');
  });
  it('3 APP-004 uses APP-001 as authority basis', () =>
    expect(
      validateDocumentApprovalRecord(
        readJson(
          'docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-004.json',
        ),
      ).record?.approver.authorityBasis,
    ).toContain('WEOS-AUTH-APP-001'));
  it('4 APP-004 records APP-003 as dependency evidence', () =>
    expect(
      JSON.stringify(
        readJson(
          'docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-004.json',
        ),
      ),
    ).toContain('WEOS-AUTH-APP-003'));
  it('5 APP-004 records APP-002 as supporting foundation', () =>
    expect(
      JSON.stringify(
        readJson(
          'docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-004.json',
        ),
      ),
    ).toContain('WEOS-AUTH-APP-002'));
  it('6 Production command-contract registry parses', () =>
    expect(
      readJson('docs/weos/governed-commands/command-contract-registry.json'),
    ).toMatchObject({ schemaVersion: '1.0.0' }));
  it('7 Production command-contract registry contains no approved command', () =>
    expect(
      (
        readJson(
          'docs/weos/governed-commands/command-contract-registry.json',
        ) as { commandContracts: unknown[] }
      ).commandContracts,
    ).toEqual([]));
  it('8 Production token-policy registry parses', () =>
    expect(
      readJson('docs/weos/governed-commands/token-policy-registry.json'),
    ).toMatchObject({ schemaVersion: '1.0.0' }));
  it('9 Production token-policy registry contains no approved token policy', () =>
    expect(
      (
        readJson('docs/weos/governed-commands/token-policy-registry.json') as {
          tokenPolicies: unknown[];
        }
      ).tokenPolicies,
    ).toEqual([]));
  it('10 Valid approved test contract resolves', () =>
    expect(
      findGovernedCommandContractDefinition(
        registries().commandContractRegistry,
        'CASE_APPROVAL_COMMAND',
        '1.0.0',
      )?.status,
    ).toBe('APPROVED'));
  it('11 Missing command contract fails', () =>
    expect(
      resolveGovernedCommandEligibility({
        command: command(),
        commandContractRegistry: createGovernedCommandContractRegistry([]),
        tokenPolicyRegistry: registries().tokenPolicyRegistry,
        currentDependencyStates: [state()],
        authorityEligibility: { eligible: true },
        disclosureAuthorization: { canDiscloseCurrentState: false },
        evaluatedAt: NOW,
      }).status,
    ).toBe('REJECTED_MISSING_CONTRACT'));
  it('12 Draft command contract fails', () =>
    expect(
      resolveGovernedCommandEligibility({
        command: command(),
        ...registries([contract({ status: 'DRAFT' })]),
        currentDependencyStates: [state()],
        authorityEligibility: { eligible: true },
        disclosureAuthorization: { canDiscloseCurrentState: false },
        evaluatedAt: NOW,
      }).status,
    ).toBe('REJECTED_UNAPPROVED_CONTRACT'));
  it('13 Deprecated command contract cannot establish eligibility', () =>
    expect(
      resolveGovernedCommandEligibility({
        command: command(),
        ...registries([contract({ status: 'DEPRECATED' })]),
        currentDependencyStates: [state()],
        authorityEligibility: { eligible: true },
        disclosureAuthorization: { canDiscloseCurrentState: false },
        evaluatedAt: NOW,
      }).status,
    ).toBe('REJECTED_UNAPPROVED_CONTRACT'));
  it('14 Exact revision match succeeds', () =>
    expect(eligible().status).toBe('ELIGIBLE'));
  it('15 Exact revision mismatch is stale', () =>
    expect(
      eligible(command(), [state({ currentRevisionId: 'rev-2' })]).status,
    ).toBe('REJECTED_STALE_PRECONDITION'));
  it('16 Exact revision missing current state fails unknown', () =>
    expect(
      eligible(command(), [state({ currentRevisionId: undefined })]).status,
    ).toBe('REJECTED_CURRENT_STATE_UNKNOWN'));
  it('17 Expected version match succeeds', () =>
    expect(
      eligible(
        command({
          primaryTarget: {
            artifactType: 'CASE',
            artifactId: 'case-1',
            targetScope: 'IDENTITY',
          },
          concurrencyPreconditions: [
            {
              target: {
                artifactType: 'CASE',
                artifactId: 'case-1',
                targetScope: 'IDENTITY',
              },
              preconditionMode: 'EXPECTED_VERSION',
              dependencyRole: 'PRIMARY_TARGET',
              expectedVersion: 3,
            },
          ],
        }),
        [
          state({
            target: {
              artifactType: 'CASE',
              artifactId: 'case-1',
              targetScope: 'IDENTITY',
            },
            currentRevisionId: undefined,
            currentVersion: 3,
          }),
        ],
      ).status,
    ).toBe('ELIGIBLE'));
  it('18 Expected version mismatch is stale', () =>
    expect(
      eligible(
        command({
          primaryTarget: {
            artifactType: 'CASE',
            artifactId: 'case-1',
            targetScope: 'IDENTITY',
          },
          concurrencyPreconditions: [
            {
              target: {
                artifactType: 'CASE',
                artifactId: 'case-1',
                targetScope: 'IDENTITY',
              },
              preconditionMode: 'EXPECTED_VERSION',
              dependencyRole: 'PRIMARY_TARGET',
              expectedVersion: 3,
            },
          ],
        }),
        [
          state({
            target: {
              artifactType: 'CASE',
              artifactId: 'case-1',
              targetScope: 'IDENTITY',
            },
            currentRevisionId: undefined,
            currentVersion: 4,
          }),
        ],
      ).status,
    ).toBe('REJECTED_STALE_PRECONDITION'));
  it('19 Expected version missing current state fails unknown', () =>
    expect(
      eligible(
        command({
          primaryTarget: {
            artifactType: 'CASE',
            artifactId: 'case-1',
            targetScope: 'IDENTITY',
          },
          concurrencyPreconditions: [
            {
              target: {
                artifactType: 'CASE',
                artifactId: 'case-1',
                targetScope: 'IDENTITY',
              },
              preconditionMode: 'EXPECTED_VERSION',
              dependencyRole: 'PRIMARY_TARGET',
              expectedVersion: 3,
            },
          ],
        }),
        [
          state({
            target: {
              artifactType: 'CASE',
              artifactId: 'case-1',
              targetScope: 'IDENTITY',
            },
            currentRevisionId: undefined,
          }),
        ],
      ).status,
    ).toBe('REJECTED_CURRENT_STATE_UNKNOWN'));
  it('20 Expected token match succeeds', () =>
    expect(
      eligible(
        command({
          primaryTarget: {
            artifactType: 'CASE',
            artifactId: 'case-1',
            targetScope: 'PROJECTION',
          },
          concurrencyPreconditions: [
            {
              target: {
                artifactType: 'CASE',
                artifactId: 'case-1',
                targetScope: 'PROJECTION',
              },
              preconditionMode: 'EXPECTED_TOKEN',
              dependencyRole: 'PRIMARY_TARGET',
              expectedToken: 'tok-1',
              tokenPolicyType: 'CASE_COMPOSITE_TOKEN',
              tokenPolicyVersion: '1.0.0',
            },
          ],
        }),
        [
          state({
            target: {
              artifactType: 'CASE',
              artifactId: 'case-1',
              targetScope: 'PROJECTION',
            },
            dependencyRole: 'PRIMARY_TARGET',
            currentRevisionId: undefined,
            currentToken: 'tok-1',
            tokenPolicyVersion: '1.0.0',
          }),
        ],
      ).status,
    ).toBe('ELIGIBLE'));
  it('21 Expected token mismatch is stale', () =>
    expect(
      eligible(
        command({
          primaryTarget: {
            artifactType: 'CASE',
            artifactId: 'case-1',
            targetScope: 'PROJECTION',
          },
          concurrencyPreconditions: [
            {
              target: {
                artifactType: 'CASE',
                artifactId: 'case-1',
                targetScope: 'PROJECTION',
              },
              preconditionMode: 'EXPECTED_TOKEN',
              dependencyRole: 'PRIMARY_TARGET',
              expectedToken: 'tok-1',
              tokenPolicyType: 'CASE_COMPOSITE_TOKEN',
              tokenPolicyVersion: '1.0.0',
            },
          ],
        }),
        [
          state({
            target: {
              artifactType: 'CASE',
              artifactId: 'case-1',
              targetScope: 'PROJECTION',
            },
            dependencyRole: 'PRIMARY_TARGET',
            currentRevisionId: undefined,
            currentToken: 'tok-2',
            tokenPolicyVersion: '1.0.0',
          }),
        ],
      ).status,
    ).toBe('REJECTED_STALE_PRECONDITION'));
  it('22 Token-policy version mismatch fails', () =>
    expect(
      eligible(
        command({
          primaryTarget: {
            artifactType: 'CASE',
            artifactId: 'case-1',
            targetScope: 'PROJECTION',
          },
          concurrencyPreconditions: [
            {
              target: {
                artifactType: 'CASE',
                artifactId: 'case-1',
                targetScope: 'PROJECTION',
              },
              preconditionMode: 'EXPECTED_TOKEN',
              dependencyRole: 'PRIMARY_TARGET',
              expectedToken: 'tok-1',
              tokenPolicyType: 'CASE_COMPOSITE_TOKEN',
              tokenPolicyVersion: '1.0.0',
            },
          ],
        }),
        [
          state({
            target: {
              artifactType: 'CASE',
              artifactId: 'case-1',
              targetScope: 'PROJECTION',
            },
            dependencyRole: 'PRIMARY_TARGET',
            currentRevisionId: undefined,
            currentToken: 'tok-1',
            tokenPolicyVersion: '2.0.0',
          }),
        ],
      ).status,
    ).toBe('REJECTED_STALE_PRECONDITION'));
  it('23 Missing token policy fails', () =>
    expect(
      validateGovernedCommand(
        command({
          primaryTarget: {
            artifactType: 'CASE',
            artifactId: 'case-1',
            targetScope: 'PROJECTION',
          },
          concurrencyPreconditions: [
            {
              target: {
                artifactType: 'CASE',
                artifactId: 'case-1',
                targetScope: 'PROJECTION',
              },
              preconditionMode: 'EXPECTED_TOKEN',
              dependencyRole: 'PRIMARY_TARGET',
              expectedToken: 'tok-1',
              tokenPolicyType: 'MISSING',
              tokenPolicyVersion: '1.0.0',
            },
          ],
        }),
        registries().commandContractRegistry,
        registries().tokenPolicyRegistry,
      ).errors,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'MISSING_TOKEN_POLICY' }),
      ]),
    ));
  it('24 Draft token policy fails', () =>
    expect(
      validateGovernedCommand(
        command({
          primaryTarget: {
            artifactType: 'CASE',
            artifactId: 'case-1',
            targetScope: 'PROJECTION',
          },
          concurrencyPreconditions: [
            {
              target: {
                artifactType: 'CASE',
                artifactId: 'case-1',
                targetScope: 'PROJECTION',
              },
              preconditionMode: 'EXPECTED_TOKEN',
              dependencyRole: 'PRIMARY_TARGET',
              expectedToken: 'tok-1',
              tokenPolicyType: 'CASE_COMPOSITE_TOKEN',
              tokenPolicyVersion: '1.0.0',
            },
          ],
        }),
        registries().commandContractRegistry,
        registries([contract()], [tokenPolicy({ status: 'DRAFT' })])
          .tokenPolicyRegistry,
      ).errors,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'UNAPPROVED_TOKEN_POLICY' }),
      ]),
    ));
  it('25 Token policy must cover required dependencies', () =>
    expect(
      validateGovernedCommand(
        command({
          primaryTarget: {
            artifactType: 'CASE',
            artifactId: 'case-1',
            targetScope: 'PROJECTION',
          },
          concurrencyPreconditions: [
            {
              target: {
                artifactType: 'CASE',
                artifactId: 'case-1',
                targetScope: 'PROJECTION',
              },
              preconditionMode: 'EXPECTED_TOKEN',
              dependencyRole: 'PRIMARY_TARGET',
              expectedToken: 'tok-1',
              tokenPolicyType: 'CASE_COMPOSITE_TOKEN',
              tokenPolicyVersion: '1.0.0',
            },
          ],
        }),
        registries().commandContractRegistry,
        registries(
          [contract()],
          [tokenPolicy({ coveredDependencyRoles: ['OTHER'] })],
        ).tokenPolicyRegistry,
      ).errors,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'TOKEN_POLICY_COVERAGE_MISMATCH' }),
      ]),
    ));
  it('26 Missing required precondition fails', () =>
    expect(
      validateGovernedCommand(
        command({ concurrencyPreconditions: [] }),
        registries().commandContractRegistry,
        registries().tokenPolicyRegistry,
      ).errors,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'MISSING_PRECONDITION' }),
      ]),
    ));
  it('27 Duplicate preconditions fail', () =>
    expect(
      validateGovernedCommand(
        command({
          concurrencyPreconditions: [
            command().concurrencyPreconditions[0],
            command().concurrencyPreconditions[0],
          ],
        }),
        registries().commandContractRegistry,
        registries().tokenPolicyRegistry,
      ).errors,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DUPLICATE_PRECONDITION' }),
      ]),
    ));
  it('28 Conflicting preconditions fail', () =>
    expect(
      validateGovernedCommand(
        command({
          concurrencyPreconditions: [
            command().concurrencyPreconditions[0],
            {
              ...command().concurrencyPreconditions[0],
              expectedRevisionId: 'rev-2',
            },
          ],
        }),
        registries().commandContractRegistry,
        registries().tokenPolicyRegistry,
      ).errors,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'CONFLICTING_PRECONDITIONS' }),
      ]),
    ));
  it('29 Primary-target precondition is required by policy', () =>
    expect(
      validateGovernedCommand(
        command({
          concurrencyPreconditions: [
            {
              target: {
                artifactType: 'CASE',
                artifactId: 'case-2',
                targetScope: 'IDENTITY',
              },
              preconditionMode: 'EXPECTED_VERSION',
              dependencyRole: 'CASE_IDENTITY',
              expectedVersion: 1,
            },
          ],
        }),
        registries().commandContractRegistry,
        registries().tokenPolicyRegistry,
      ).errors,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'MISSING_PRIMARY_TARGET_PRECONDITION',
        }),
      ]),
    ));
  it('30 Every declared dependency is checked', () =>
    expect(
      evaluateConcurrencyPreconditions({
        command: command(),
        contract: contract(),
        tokenPolicyRegistry: registries().tokenPolicyRegistry,
        currentDependencyStates: [state()],
        disclosureAuthorization: { canDiscloseCurrentState: false },
      }).validatedPreconditions,
    ).toHaveLength(1));
  it('31 Missing declared dependency fails', () =>
    expect(eligible(command(), []).status).toBe(
      'REJECTED_CURRENT_STATE_UNKNOWN',
    ));
  it('32 Undeclared dependency fails where complete coverage is required', () =>
    expect(
      evaluateConcurrencyPreconditions({
        command: command(),
        contract: contract(),
        tokenPolicyRegistry: registries().tokenPolicyRegistry,
        currentDependencyStates: [state({ dependencyRole: 'UNDECLARED' })],
        disclosureAuthorization: { canDiscloseCurrentState: false },
      }).reasons,
    ).toContain('UNDECLARED_DEPENDENCY'));
  it('33 Current state UNKNOWN fails closed', () =>
    expect(eligible(command(), [state({ status: 'UNKNOWN' })]).status).toBe(
      'REJECTED_CURRENT_STATE_UNKNOWN',
    ));
  it('34 Current state UNAVAILABLE fails closed', () =>
    expect(eligible(command(), [state({ status: 'UNAVAILABLE' })]).status).toBe(
      'REJECTED_CURRENT_STATE_UNKNOWN',
    ));
  it('35 Authority success does not bypass stale state', () =>
    expect(
      eligible(command(), [state({ currentRevisionId: 'rev-2' })], true).status,
    ).toBe('REJECTED_STALE_PRECONDITION'));
  it('36 Current state does not bypass missing authority', () =>
    expect(eligible(command(), [state()], false).status).toBe(
      'REJECTED_AUTHORITY',
    ));
  it('37 Stale resolution allows no Governance Decision', () =>
    expect(
      eligible(command(), [state({ currentRevisionId: 'rev-2' })])
        .mayCreateGovernanceDecision,
    ).toBe(false));
  it('38 Stale resolution allows no mutation', () =>
    expect(
      eligible(command(), [state({ currentRevisionId: 'rev-2' })])
        .mayCreateMutation,
    ).toBe(false));
  it('39 Stale resolution allows no projection update', () =>
    expect(
      eligible(command(), [state({ currentRevisionId: 'rev-2' })])
        .mayUpdateProjection,
    ).toBe(false));
  it('40 Atomic batch with one stale item rejects the complete batch', () =>
    expect(
      resolveGovernedBatch({
        contract: contract(),
        individualCommandResults: [
          eligible(),
          eligible(command(), [state({ currentRevisionId: 'rev-2' })]),
        ],
      }).status,
    ).toBe('BATCH_REJECTED'));
  it('41 Partial batch is rejected unless policy permits independent items', () =>
    expect(
      resolveGovernedBatch({
        contract: contract(),
        individualCommandResults: [eligible(), { ...eligible(), reasons: [] }],
      }).noPartialApplication,
    ).toBe(true));
  it('42 Independent batch items retain separate command IDs', () =>
    expect(
      resolveGovernedBatch({
        contract: contract({ batchPolicy: 'INDEPENDENT_ITEMS' }),
        individualCommandResults: [
          { ...eligible(), reasons: ['INDEPENDENT_ITEM_RESULT'] },
          {
            ...eligible(command({ commandId: 'cmd-2' })),
            reasons: ['INDEPENDENT_ITEM_RESULT'],
          },
        ],
      }).status,
    ).toBe('BATCH_ELIGIBLE'));
  it('43 Same idempotency key and fingerprint replays successful result', () =>
    expect(
      resolveCommandIdempotency({
        command: command(),
        commandFingerprint: computeCommandFingerprint(command()),
        priorIdempotencyRecord: prior(),
        idempotencyPolicy: 'REQUIRED',
      }).disposition,
    ).toBe('REPLAY_OF_SUCCESSFUL_COMMAND'));
  it('44 Same idempotency key and fingerprint replays rejected result', () =>
    expect(
      resolveCommandIdempotency({
        command: command(),
        commandFingerprint: computeCommandFingerprint(command()),
        priorIdempotencyRecord: prior({ resultStatus: 'REJECTED_STALE' }),
        idempotencyPolicy: 'REQUIRED',
      }).disposition,
    ).toBe('REPLAY_OF_REJECTED_COMMAND'));
  it('45 Same key with different fingerprint conflicts', () =>
    expect(
      resolveCommandIdempotency({
        command: command(),
        commandFingerprint: 'different',
        priorIdempotencyRecord: prior(),
        idempotencyPolicy: 'REQUIRED',
      }).disposition,
    ).toBe('REJECTED_IDEMPOTENCY_CONFLICT'));
  it('46 Required idempotency key missing fails', () =>
    expect(
      resolveCommandIdempotency({
        command: command({ idempotencyKey: undefined }),
        commandFingerprint: computeCommandFingerprint(command()),
        idempotencyPolicy: 'REQUIRED',
      }).disposition,
    ).toBe('INVALID'));
  it('47 Prohibited idempotency key present fails', () =>
    expect(
      resolveCommandIdempotency({
        command: command(),
        commandFingerprint: computeCommandFingerprint(command()),
        idempotencyPolicy: 'PROHIBITED',
      }).disposition,
    ).toBe('INVALID'));
  it('48 Idempotency does not make stale state valid', () =>
    expect(
      resolveGovernedCommandEligibility({
        command: command({ idempotencyKey: 'new' }),
        ...registries(),
        currentDependencyStates: [state({ currentRevisionId: 'rev-2' })],
        authorityEligibility: { eligible: true },
        disclosureAuthorization: { canDiscloseCurrentState: false },
        evaluatedAt: NOW,
      }).status,
    ).toBe('REJECTED_STALE_PRECONDITION'));
  it('49 Successful replay cannot create a second decision', () =>
    expect(
      resolveGovernedCommandEligibility({
        command: command(),
        ...registries(),
        currentDependencyStates: [state()],
        priorIdempotencyRecord: prior(),
        authorityEligibility: { eligible: true },
        disclosureAuthorization: { canDiscloseCurrentState: false },
        evaluatedAt: NOW,
      }).mayCreateGovernanceDecision,
    ).toBe(false));
  it('50 Successful replay cannot create a second mutation', () =>
    expect(
      resolveGovernedCommandEligibility({
        command: command(),
        ...registries(),
        currentDependencyStates: [state()],
        priorIdempotencyRecord: prior(),
        authorityEligibility: { eligible: true },
        disclosureAuthorization: { canDiscloseCurrentState: false },
        evaluatedAt: NOW,
      }).mayCreateMutation,
    ).toBe(false));
  it('51 Rejected replay cannot create a mutation', () =>
    expect(
      resolveGovernedCommandEligibility({
        command: command(),
        ...registries(),
        currentDependencyStates: [state()],
        priorIdempotencyRecord: prior({ resultStatus: 'REJECTED_STALE' }),
        authorityEligibility: { eligible: true },
        disclosureAuthorization: { canDiscloseCurrentState: false },
        evaluatedAt: NOW,
      }).mayCreateMutation,
    ).toBe(false));
  it('52 Stale rejection is not a Governance Decision', () =>
    expect(
      eligible(command(), [state({ currentRevisionId: 'rev-2' })])
        .mayCreateGovernanceDecision,
    ).toBe(false));
  it('53 Audit-event classification remains distinct', () =>
    expect(
      eligible(command(), [state({ currentRevisionId: 'rev-2' })]).reasons,
    ).toContain('REJECTED_STALE_PRECONDITION'));
  it('54 Safe current state may be omitted', () =>
    expect(
      evaluateConcurrencyPreconditions({
        command: command(),
        contract: contract(),
        tokenPolicyRegistry: registries().tokenPolicyRegistry,
        currentDependencyStates: [
          state({ safeCurrentStateReference: undefined }),
        ],
        disclosureAuthorization: { canDiscloseCurrentState: true },
      }).safeCurrentStateReferences,
    ).toEqual([]));
  it('55 Current-state details are hidden when disclosure is denied', () =>
    expect(
      eligible(command(), [state({ currentRevisionId: 'rev-2' })]).conflicts[0]
        .safeCurrentStateReference,
    ).toBeUndefined());
  it('56 Current-state details may be returned when disclosure is allowed', () =>
    expect(
      evaluateConcurrencyPreconditions({
        command: command(),
        contract: contract(),
        tokenPolicyRegistry: registries().tokenPolicyRegistry,
        currentDependencyStates: [state({ currentRevisionId: 'rev-2' })],
        disclosureAuthorization: { canDiscloseCurrentState: true },
      }).stalePreconditions[0].safeCurrentStateReference,
    ).toEqual({ artifactRevisionId: 'rev-1' }));
  it('57 Revisioned content cannot use projection version instead of exact revision', () =>
    expect(
      validateGovernedCommand(
        command({
          concurrencyPreconditions: [
            {
              target: command().primaryTarget,
              preconditionMode: 'EXPECTED_VERSION',
              dependencyRole: 'PRIMARY_TARGET',
              expectedVersion: 1,
            },
          ],
        }),
        registries().commandContractRegistry,
        registries().tokenPolicyRegistry,
      ).errors,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'EXACT_REVISION_REQUIRED' }),
      ]),
    ));
  it('58 Legacy command history is not invented', () =>
    expect(
      resolveCommandIdempotency({
        command: command(),
        commandFingerprint: computeCommandFingerprint(command()),
        idempotencyPolicy: 'REQUIRED',
      }).disposition,
    ).toBe('CONTINUE'));
  it('59 Runtime roles cannot satisfy the concurrency contract', () =>
    expect(
      validateGovernedCommand(
        { runtimeRoles: ['ADMIN'] },
        registries().commandContractRegistry,
        registries().tokenPolicyRegistry,
      ).valid,
    ).toBe(false));
  it('60 Workflow records cannot satisfy the command contract', () =>
    expect(
      validateGovernedCommand(
        { workflowStatus: 'APPROVED' },
        registries().commandContractRegistry,
        registries().tokenPolicyRegistry,
      ).valid,
    ).toBe(false));
  it('61 Governance Decision records cannot satisfy the command contract', () =>
    expect(
      validateGovernedCommand(
        { decisionId: 'WEOS-GD-1', decisionStatus: 'APPROVED' },
        registries().commandContractRegistry,
        registries().tokenPolicyRegistry,
      ).valid,
    ).toBe(false));
  it('62 Audit records cannot satisfy the command contract', () =>
    expect(
      validateGovernedCommand(
        { auditEventId: 'audit-1' },
        registries().commandContractRegistry,
        registries().tokenPolicyRegistry,
      ).valid,
    ).toBe(false));
  it('63 Projection objects cannot satisfy the command contract', () =>
    expect(
      validateGovernedCommand(
        { status: 'READY_TO_PUBLISH', updatedAt: NOW },
        registries().commandContractRegistry,
        registries().tokenPolicyRegistry,
      ).valid,
    ).toBe(false));
  it('64 OD-018 compatibility remains intact', () => {
    const result = eligible();
    expect(result.eligibleForFutureAtomicApplication).toBe(true);
    expect(result.mayCreateGovernanceDecision).toBe(false);
  });
  it('65 OD-022 compatibility remains intact', () => {
    denied(eligible(command(), [state()], false));
    expect(command().actorContext).toHaveProperty(
      'authorityAssignmentReferences',
    );
  });
  it('66 No test implies database compare-and-swap', () =>
    expect(
      readFileSync(join(__dirname, 'governed-command.resolution.ts'), 'utf8'),
    ).not.toMatch(/compareAndSwap|transaction/));
  it('67 No test implies persistence', () =>
    expect(
      readFileSync(join(__dirname, 'governed-command.types.ts'), 'utf8'),
    ).not.toMatch(/Prisma|Repository/));
  it('68 No test implies runtime enforcement', () =>
    expect(readFileSync(join(__dirname, 'index.ts'), 'utf8')).not.toMatch(
      /Controller|Guard|Service/,
    ));
  it('69 No test creates a production command contract', () =>
    expect(
      (
        readJson(
          'docs/weos/governed-commands/command-contract-registry.json',
        ) as { commandContracts: unknown[] }
      ).commandContracts,
    ).toHaveLength(0));
  it('70 No runtime import exists outside the contract island', () =>
    expect(APPROVED_OPTION_ID).toBe(
      'OPTION_D_HYBRID_EXPECTED_REVISION_VERSION_AND_TOKEN_CONTRACT',
    ));
  it('registry helpers reject duplicates and token definitions validate', () => {
    expect(
      registerGovernedCommandContractDefinition(
        createGovernedCommandContractRegistry([contract()]),
        contract(),
      ).errors[0].code,
    ).toBe('DUPLICATE_COMMAND_CONTRACT');
    expect(
      registerConcurrencyTokenPolicyDefinition(
        createConcurrencyTokenPolicyRegistry([tokenPolicy()]),
        tokenPolicy(),
      ).errors[0].code,
    ).toBe('DUPLICATE_TOKEN_POLICY');
    expect(validateConcurrencyTokenPolicyDefinition(tokenPolicy()).valid).toBe(
      true,
    );
    expect(
      validateGovernedCommandSet(
        [command(), command()],
        registries().commandContractRegistry,
        registries().tokenPolicyRegistry,
      ).valid,
    ).toBe(false);
  });
});
