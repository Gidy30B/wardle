import {
  getCaseDiagnosisPublishReadiness,
  isCaseDiagnosisReadyForPublish,
  isDiagnosisMappingStatusPublishReady,
} from './diagnosis-publish-readiness.policy';

describe('diagnosis publish readiness policy', () => {
  it('rejects cases without a registry link', () => {
    expect(
      getCaseDiagnosisPublishReadiness({
        diagnosisRegistryId: null,
        diagnosisMappingStatus: 'MATCHED',
      }),
    ).toEqual({
      ready: false,
      reason: 'missing_registry_link',
    });
  });

  it('rejects unresolved diagnosis mapping state', () => {
    expect(
      getCaseDiagnosisPublishReadiness({
        diagnosisRegistryId: 'registry-1',
        diagnosisMappingStatus: 'UNRESOLVED',
      }),
    ).toEqual({
      ready: false,
      reason: 'mapping_not_publish_ready',
    });
  });

  it('rejects non-usable registry status when provided', () => {
    expect(
      getCaseDiagnosisPublishReadiness({
        diagnosisRegistryId: 'registry-1',
        diagnosisMappingStatus: 'MATCHED',
        diagnosisRegistryStatus: 'DEPRECATED',
      }),
    ).toEqual({
      ready: false,
      reason: 'registry_not_publishable',
    });
  });

  it('accepts matched linked diagnosis state', () => {
    expect(
      isCaseDiagnosisReadyForPublish({
        diagnosisRegistryId: 'registry-1',
        diagnosisMappingStatus: 'MATCHED',
        diagnosisRegistryStatus: 'ACTIVE',
      }),
    ).toBe(true);
  });

  it('treats only matched mapping status as publish-ready', () => {
    expect(isDiagnosisMappingStatusPublishReady('MATCHED')).toBe(true);
    expect(isDiagnosisMappingStatusPublishReady('REVIEW_REQUIRED')).toBe(false);
    expect(
      isDiagnosisMappingStatusPublishReady('NEW_REGISTRY_ENTRY_NEEDED'),
    ).toBe(false);
  });
});
