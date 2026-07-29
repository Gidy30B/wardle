import {
  WEOS_CANONICAL_TRANSITION_BY_KEY,
  WEOS_CANONICAL_TRANSITIONS,
} from './canonical-transitions';
import { WEOS_CANONICAL_ACTION_BY_KEY } from './canonical-actions';

describe('WEOS canonical transitions', () => {
  it('preserves historical records for every transition', () => {
    for (const transition of WEOS_CANONICAL_TRANSITIONS) {
      expect(transition.preservesHistoricalRecords).toBe(true);
      expect(transition.requiredPreconditions.length).toBeGreaterThan(0);
    }
  });

  it('keeps approval, publication, scheduling, and exposure separate', () => {
    expect(
      WEOS_CANONICAL_TRANSITION_BY_KEY.CASE_REVISION_APPROVE.decisionType,
    ).toBe('APPROVE_REVISION');
    expect(
      WEOS_CANONICAL_TRANSITION_BY_KEY.PUBLICATION_AUTHORISE_VERSION
        .decisionType,
    ).toBe('AUTHORISE_PUBLICATION');
    expect(
      WEOS_CANONICAL_TRANSITION_BY_KEY.PUBLICATION_AUTHORISE_VERSION.toState,
    ).not.toBe('SCHEDULED');
  });

  it('keeps AI draft acceptance separate from controlled application', () => {
    expect(WEOS_CANONICAL_TRANSITION_BY_KEY.AI_DRAFT_ACCEPT.toState).toBe(
      'ACCEPTED',
    );
    expect(
      WEOS_CANONICAL_TRANSITION_BY_KEY.ACCEPTED_DRAFT_APPLICATION.action,
    ).toBe('APPLY_ACCEPTED_DRAFT');
    expect(
      WEOS_CANONICAL_TRANSITION_BY_KEY.ACCEPTED_DRAFT_APPLICATION.decisionType,
    ).toBeNull();
  });

  it('uses standing impacts for blocking correction paths', () => {
    for (const key of [
      'STALE_ACCEPTED_DRAFT_RECONCILIATION',
      'PUBLICATION_WITHDRAW_VERSION',
    ] as const) {
      expect(WEOS_CANONICAL_TRANSITION_BY_KEY[key].blockingEffect).toBe(
        'BLOCKING',
      );
      expect(
        WEOS_CANONICAL_TRANSITION_BY_KEY[key].standingImpacts.length,
      ).toBeGreaterThan(0);
    }
  });

  it('keeps require-revision separate from material content-change impacts', () => {
    const transition =
      WEOS_CANONICAL_TRANSITION_BY_KEY.CASE_REVISION_REQUIRE_CHANGES;

    expect(transition.blockingEffect).toBe('BLOCKING');
    expect(transition.standingImpacts).toHaveLength(0);
    expect(transition.notes.join(' ')).toContain(
      'material content impacts occur when content changes',
    );
  });

  it('withdraws Published Artifact Version while preserving the original Publication Decision', () => {
    const transition =
      WEOS_CANONICAL_TRANSITION_BY_KEY.PUBLICATION_WITHDRAW_VERSION;

    expect(transition.artifactType).toBe('PUBLISHED_ARTIFACT_VERSION');
    expect(transition.fromState).toBe('PUBLISHED');
    expect(transition.toState).toBe('WITHDRAWN');
    expect(transition.notes.join(' ')).toContain(
      'original Publication Decision remains historically authorised',
    );
    expect(transition.notes.join(' ')).toContain('Withdrawal Record');
    expect(transition.notes.join(' ')).toContain('learner exposures');
  });

  it('does not represent diagnosis remapping as an ordinary lifecycle transition', () => {
    expect(
      WEOS_CANONICAL_TRANSITION_BY_KEY.DIAGNOSIS_REFERENCE_REMAP,
    ).toBeUndefined();
    expect(
      WEOS_CANONICAL_ACTION_BY_KEY.REMAP_DIAGNOSIS_REFERENCE
        .createsGovernanceRecord,
    ).toBe(true);
    expect(
      WEOS_CANONICAL_ACTION_BY_KEY.REMAP_DIAGNOSIS_REFERENCE.notes.join(' '),
    ).toContain('affected-reference inventory');
  });

  it('does not use abstract or composite actions in executable transitions', () => {
    for (const transition of WEOS_CANONICAL_TRANSITIONS) {
      const action = WEOS_CANONICAL_ACTION_BY_KEY[transition.action];

      expect(action.abstract).toBe(false);
      expect(action.composite).toBe(false);
    }
  });
});
