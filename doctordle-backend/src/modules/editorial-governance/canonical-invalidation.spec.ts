import {
  WEOS_INVALIDATION_RULES,
  WEOS_STANDING_EFFECTS,
} from './canonical-invalidation';

describe('WEOS canonical invalidation', () => {
  it('preserves historical records for every invalidation rule', () => {
    for (const rule of Object.values(WEOS_INVALIDATION_RULES)) {
      expect(rule.preservesHistoricalRecords).toBe(true);
      expect(rule.impacts.length).toBeGreaterThan(0);
    }
  });

  it('uses standing impacts rather than retroactive record invalidation', () => {
    const allImpacts = Object.values(WEOS_INVALIDATION_RULES).flatMap(
      (rule) => rule.impacts,
    );

    expect(allImpacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          effect: WEOS_STANDING_EFFECTS.MARK_STALE,
        }),
      ]),
    );
    expect(allImpacts).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          effect: 'INVALIDATE_HISTORICAL_RECORD',
        }),
      ]),
    );
  });

  it('keeps withdrawal, diagnosis remapping, validation rerun, and stale AI application distinct', () => {
    expect(
      WEOS_INVALIDATION_RULES.EVIDENCE_SOURCE_WITHDRAWAL.causedByActions,
    ).toContain('WITHDRAW_EVIDENCE_SOURCE');
    expect(
      WEOS_INVALIDATION_RULES.DIAGNOSIS_REMAPPING.causedByActions,
    ).toContain('REMAP_DIAGNOSIS_REFERENCE');
    expect(WEOS_INVALIDATION_RULES.VALIDATION_RERUN.causedByActions).toContain(
      'RERUN_VALIDATION',
    );
    expect(
      WEOS_INVALIDATION_RULES.AI_DRAFT_APPLICATION_AGAINST_STALE_REVISION
        .causedByActions,
    ).toContain('RECONCILE_STALE_APPLICATION');
    expect(
      WEOS_INVALIDATION_RULES.PUBLICATION_WITHDRAWAL.causedByActions,
    ).toContain('WITHDRAW_PUBLICATION');
  });
});
