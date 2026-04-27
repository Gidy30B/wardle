import {
  buildMatchedDiagnosisMappingFields,
  determineDiagnosisWriteMappingMethod,
} from './diagnosis-mapping-fields';

describe('diagnosis mapping field helpers', () => {
  it('falls back to the canonical diagnosis name when provenance text is blank', () => {
    expect(
      buildMatchedDiagnosisMappingFields({
        diagnosisName: 'Acute appendicitis',
        proposedDiagnosisText: '   ',
        method: 'LEGACY_BACKFILL',
      }),
    ).toEqual({
      proposedDiagnosisText: 'Acute appendicitis',
      diagnosisMappingStatus: 'MATCHED',
      diagnosisMappingMethod: 'LEGACY_BACKFILL',
      diagnosisMappingConfidence: 1,
    });
  });

  it('treats an explicit registry selection as editor-selected mapping', () => {
    expect(
      determineDiagnosisWriteMappingMethod({
        diagnosisRegistryId: 'registry-1',
      }),
    ).toBe('EDITOR_SELECTED');
  });

  it('treats legacy diagnosis-only writes as legacy backfill mapping', () => {
    expect(
      determineDiagnosisWriteMappingMethod({
        diagnosisRegistryId: undefined,
      }),
    ).toBe('LEGACY_BACKFILL');
  });
});
