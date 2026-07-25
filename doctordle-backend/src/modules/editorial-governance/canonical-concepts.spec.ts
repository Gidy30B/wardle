import * as concepts from './canonical-concepts';
import {
  WEOS_ASSESSMENT_TYPES,
  WEOS_AUTHORITY_ARCHETYPES,
  WEOS_BLOCKING_EFFECTS,
  WEOS_DECISION_TYPES,
  WEOS_FINDING_SEVERITIES,
  WEOS_GOVERNANCE_RECORD_TYPES,
  WEOS_GOVERNANCE_SOURCE_CONTEXT_TYPES,
  WEOS_READINESS_TYPES,
  WEOS_TECHNICAL_ACTOR_TYPES,
  WEOS_VALIDATION_OUTCOMES,
} from './canonical-concepts';

describe('WEOS canonical concepts', () => {
  it('does not export universal lifecycle or operational state vocabularies', () => {
    expect('WEOS_EDITORIAL_LIFECYCLE_STATES' in concepts).toBe(false);
    expect('WEOS_OPERATIONAL_STATES' in concepts).toBe(false);
  });

  it('keeps onboarding out of readiness semantics', () => {
    expect(Object.values(WEOS_READINESS_TYPES)).not.toContain(
      'ONBOARDING_READINESS',
    );
  });

  it('keeps validation outcomes separate from structured assessment types', () => {
    for (const outcome of Object.values(WEOS_VALIDATION_OUTCOMES)) {
      expect(Object.values(WEOS_ASSESSMENT_TYPES)).not.toContain(outcome);
    }
  });

  it('keeps decision types from operational mark/apply/publish actions', () => {
    const decisions = Object.values(WEOS_DECISION_TYPES);

    expect(decisions).not.toContain('MARK_READY');
    expect(decisions).not.toContain('APPLY_ACCEPTED_DRAFT');
    expect(decisions).not.toContain('PUBLISH');
    expect(decisions).toContain('AUTHORISE_PUBLICATION');
  });

  it('splits governance records, source context records, and actors', () => {
    expect(Object.values(WEOS_GOVERNANCE_RECORD_TYPES)).toContain(
      'EDITORIAL_DECISION',
    );
    expect(Object.values(WEOS_GOVERNANCE_SOURCE_CONTEXT_TYPES)).toContain(
      'REVIEW_PACKET_SNAPSHOT',
    );
    expect(Object.values(WEOS_AUTHORITY_ARCHETYPES)).toContain(
      'CLINICAL_REVIEWER',
    );
    expect(Object.values(WEOS_TECHNICAL_ACTOR_TYPES)).toContain(
      'SYSTEM_SERVICE',
    );
  });

  it('splits finding severity from blocking effect', () => {
    expect(Object.values(WEOS_FINDING_SEVERITIES)).toContain('CRITICAL');
    expect(Object.values(WEOS_BLOCKING_EFFECTS)).toEqual([
      'NON_BLOCKING',
      'BLOCKING',
    ]);
  });
});
