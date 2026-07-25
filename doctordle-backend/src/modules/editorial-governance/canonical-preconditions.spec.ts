import {
  WEOS_PRECONDITION_BY_KEY,
  WEOS_PRECONDITION_CATALOGUE,
  WEOS_PRECONDITIONS,
} from './canonical-preconditions';

describe('WEOS canonical preconditions', () => {
  it('defines one explicit catalogue entry for each precondition key', () => {
    const keys = Object.values(WEOS_PRECONDITIONS);

    expect(WEOS_PRECONDITION_CATALOGUE).toHaveLength(keys.length);
    expect(Object.keys(WEOS_PRECONDITION_BY_KEY).sort()).toEqual(keys.sort());
  });

  it('uses corrected authority and publication keys', () => {
    expect(Object.values(WEOS_PRECONDITIONS)).toContain(
      'ACTOR_HAS_REQUIRED_AUTHORITY',
    );
    expect(Object.values(WEOS_PRECONDITIONS)).not.toContain(
      'REQUIRED_AUTHORITY_WILL_BE_REQUIRED',
    );
    expect(Object.values(WEOS_PRECONDITIONS)).not.toContain(
      'VALID_PUBLICATION_DECISION_EXISTS',
    );
  });

  it('requires concrete evidence on every conceptual precondition', () => {
    for (const definition of WEOS_PRECONDITION_CATALOGUE) {
      expect(definition.conceptualOnly).toBe(true);
      expect(definition.meaning.trim().length).toBeGreaterThan(0);
      expect(definition.requiredEvidence.length).toBeGreaterThan(0);
    }
  });
});
