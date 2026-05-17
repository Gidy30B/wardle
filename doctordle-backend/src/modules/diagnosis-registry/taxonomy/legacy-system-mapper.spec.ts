import {
  getLegacySystemMappingKeys,
  mapLegacySystemToRegistryTaxonomy,
} from './legacy-system-mapper';

describe('mapLegacySystemToRegistryTaxonomy', () => {
  it('maps common legacy systems to registry taxonomy', () => {
    expect(mapLegacySystemToRegistryTaxonomy('Neurology')).toEqual({
      mapped: true,
      legacySystem: 'Neurology',
      normalizedSystem: 'neurology',
      taxonomy: {
        specialty: 'Neurology',
        bodySystem: 'Nervous System',
      },
    });

    expect(mapLegacySystemToRegistryTaxonomy('Endocrine')).toEqual({
      mapped: true,
      legacySystem: 'Endocrine',
      normalizedSystem: 'endocrine',
      taxonomy: {
        specialty: 'Endocrinology',
        bodySystem: 'Endocrine',
        category: 'Metabolic',
      },
    });
  });

  it('returns unmapped systems separately', () => {
    expect(mapLegacySystemToRegistryTaxonomy('Space Medicine')).toEqual({
      mapped: false,
      legacySystem: 'Space Medicine',
      normalizedSystem: 'space medicine',
    });
  });

  it('tracks the mapping keys for script coverage reporting', () => {
    expect(getLegacySystemMappingKeys()).toEqual(
      expect.arrayContaining(['cardiology', 'endocrine', 'neurology']),
    );
  });
});
