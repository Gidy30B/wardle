import {
  createAuthorityTypeRegistry,
  type AuthorityTypeRegistry,
} from '../editorial-governance/authority-assignment/index.js';

export const APP008A_AUTHORITY_TYPE_REGISTRY = Symbol(
  'APP008A_AUTHORITY_TYPE_REGISTRY',
);

export const APP008A_ACTION = 'AUTHORIZE_CASE_REVISION_PUBLICATION';
export const APP008A_AUTHORITY_RECORD_ID = 'WEOS-AUTH-APP-008';
export const APP008A_AUTHORITY_TYPE = 'CASE_REVISION_PUBLICATION';

export const createApp008aAuthorityTypeRegistry = (): AuthorityTypeRegistry =>
  createAuthorityTypeRegistry([
    {
      authorityType: APP008A_AUTHORITY_TYPE,
      authorityTypeSchemaVersion: '1.0.0',
      status: 'APPROVED',
      allowedDecisionTypes: [APP008A_ACTION],
      requiredScopeDimensions: ['artifactTypes', 'artifactRevisionIds'],
      permitsGlobalScope: false,
      requiresHumanAuthority: true,
      permittedSubjectTypes: ['USER'],
      permitsDelegation: false,
      maximumDelegationDepth: 0,
      grantableAuthorityTypes: [],
      requiresEnhancedGrantEvidence: false,
      separationOfDutiesRules: [],
    },
  ]);

export const app008aAuthorityTypeRegistryProvider = {
  provide: APP008A_AUTHORITY_TYPE_REGISTRY,
  useFactory: createApp008aAuthorityTypeRegistry,
};
