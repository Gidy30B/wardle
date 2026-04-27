import {
  buildDiagnosisRegistryStatusPatch,
  getDiagnosisRegistryCompatibilityActive,
  getDiagnosisRegistryLifecycle,
  getDictionaryVisibleDiagnosisRegistryWhere,
  getUsableDiagnosisRegistryWhere,
  isDiagnosisRegistryUsableStatus,
  isDiagnosisRegistryVisibleForDictionaryStatus,
} from './diagnosis-registry-status';

describe('diagnosis registry status helpers', () => {
  it('derives compatibility active from status deterministically', () => {
    expect(getDiagnosisRegistryCompatibilityActive('ACTIVE')).toBe(true);
    expect(getDiagnosisRegistryCompatibilityActive('HIDDEN')).toBe(false);
    expect(getDiagnosisRegistryCompatibilityActive('DEPRECATED')).toBe(false);
    expect(getDiagnosisRegistryCompatibilityActive('DRAFT')).toBe(false);
  });

  it('builds a synchronized status patch for persistence', () => {
    expect(buildDiagnosisRegistryStatusPatch('DEPRECATED')).toEqual({
      status: 'DEPRECATED',
      active: false,
    });
  });

  it('distinguishes lifecycle semantics for future callers', () => {
    expect(getDiagnosisRegistryLifecycle('ACTIVE')).toEqual({
      status: 'ACTIVE',
      usable: true,
      visibleForDictionary: true,
      hidden: false,
      deprecated: false,
      draft: false,
    });

    expect(getDiagnosisRegistryLifecycle('HIDDEN')).toEqual({
      status: 'HIDDEN',
      usable: false,
      visibleForDictionary: false,
      hidden: true,
      deprecated: false,
      draft: false,
    });
  });

  it('exposes explicit usable and dictionary-visible predicates', () => {
    expect(isDiagnosisRegistryUsableStatus('ACTIVE')).toBe(true);
    expect(isDiagnosisRegistryUsableStatus('DRAFT')).toBe(false);
    expect(isDiagnosisRegistryVisibleForDictionaryStatus('ACTIVE')).toBe(true);
    expect(isDiagnosisRegistryVisibleForDictionaryStatus('DEPRECATED')).toBe(
      false,
    );
  });

  it('returns explicit where clauses for status-driven queries', () => {
    expect(getUsableDiagnosisRegistryWhere()).toEqual({
      status: 'ACTIVE',
    });
    expect(getDictionaryVisibleDiagnosisRegistryWhere()).toEqual({
      status: 'ACTIVE',
    });
  });
});
