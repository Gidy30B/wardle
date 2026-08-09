import {
  createAuthorityTypeRegistry,
  type AuthorityTypeRegistry,
} from '../editorial-governance/authority-assignment/index.js';

export const APP006_AUTHORITY_TYPE_REGISTRY = Symbol(
  'APP006_AUTHORITY_TYPE_REGISTRY',
);

export const createApp006AuthorityTypeRegistry = (): AuthorityTypeRegistry =>
  createAuthorityTypeRegistry([
    {
      authorityType: 'CASE_REVISION_APPROVAL',
      authorityTypeSchemaVersion: '1.0.0',
      status: 'APPROVED',
      allowedDecisionTypes: ['APPROVE_CASE_REVISION'],
      requiredScopeDimensions: ['artifactTypes', 'artifactRevisionIds'],
      permitsGlobalScope: false,
      requiresHumanAuthority: true,
      permittedSubjectTypes: ['USER'],
      permitsDelegation: false,
      maximumDelegationDepth: 0,
      grantableAuthorityTypes: [],
      requiresEnhancedGrantEvidence: false,
      separationOfDutiesRules: ['AUTHOR_CANNOT_BE_SOLE_FINAL_APPROVER'],
    },
  ]);

export const app006AuthorityTypeRegistryProvider = {
  provide: APP006_AUTHORITY_TYPE_REGISTRY,
  useFactory: createApp006AuthorityTypeRegistry,
};
