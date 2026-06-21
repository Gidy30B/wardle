import {
  ORTHOPAEDICS_SPECIALTY,
  normalizeSpecialtyDisplayName,
} from './diagnosis-registry-specialty';

describe('normalizeSpecialtyDisplayName', () => {
  it('maps orthopaedic spelling variants to the canonical specialty', () => {
    expect(normalizeSpecialtyDisplayName('Orthopaedics')).toBe(
      ORTHOPAEDICS_SPECIALTY,
    );
    expect(normalizeSpecialtyDisplayName('Orthopaedic')).toBe(
      ORTHOPAEDICS_SPECIALTY,
    );
    expect(normalizeSpecialtyDisplayName('Orthopedics')).toBe(
      ORTHOPAEDICS_SPECIALTY,
    );
    expect(normalizeSpecialtyDisplayName('Orthopedic')).toBe(
      ORTHOPAEDICS_SPECIALTY,
    );
  });

  it('preserves unrelated specialty labels after whitespace cleanup', () => {
    expect(normalizeSpecialtyDisplayName('  Emergency   Medicine  ')).toBe(
      'Emergency Medicine',
    );
    expect(normalizeSpecialtyDisplayName(null)).toBeNull();
    expect(normalizeSpecialtyDisplayName('   ')).toBeNull();
  });
});
