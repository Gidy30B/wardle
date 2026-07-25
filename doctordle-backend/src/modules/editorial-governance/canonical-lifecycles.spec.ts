import {
  WEOS_CANONICAL_LIFECYCLE_BY_FAMILY,
  WEOS_CANONICAL_LIFECYCLES,
} from './canonical-lifecycles';
import { WEOS_LIFECYCLE_STATE_CLASSES } from './canonical-concepts';

describe('WEOS canonical lifecycles', () => {
  it('uses artifact-specific lifecycle families', () => {
    expect(WEOS_CANONICAL_LIFECYCLES.length).toBeGreaterThan(0);
    expect(
      WEOS_CANONICAL_LIFECYCLES.every(
        (definition) => definition.lifecycleFamily.trim().length > 0,
      ),
    ).toBe(true);
  });

  it('keeps Case Revision lifecycle free of publication and readiness states', () => {
    const caseRevision = WEOS_CANONICAL_LIFECYCLE_BY_FAMILY[
      'case-revision'
    ].states.map((state) => state.key);

    expect(caseRevision).not.toContain('PUBLISHED');
    expect(caseRevision).not.toContain('READY_TO_PUBLISH');
    expect(caseRevision).not.toContain('APPLIED');
  });

  it('keeps AI Draft lifecycle free of application standing', () => {
    const aiDraft = WEOS_CANONICAL_LIFECYCLE_BY_FAMILY['ai-draft'].states.map(
      (state) => state.key,
    );

    expect(aiDraft).toContain('ACCEPTED');
    expect(aiDraft).not.toContain('APPLIED');
  });

  it('represents readiness outside lifecycle state classes', () => {
    const classes = Object.values(WEOS_LIFECYCLE_STATE_CLASSES);

    expect(classes).not.toContain('READY');
    expect(classes).not.toContain('READINESS');
  });

  it('keeps playability and generatability as independent permission dimensions', () => {
    const playability =
      WEOS_CANONICAL_LIFECYCLE_BY_FAMILY['diagnosis-playability-permission'];
    const generatability =
      WEOS_CANONICAL_LIFECYCLE_BY_FAMILY['diagnosis-generatability-permission'];

    expect(playability).toBeDefined();
    expect(generatability).toBeDefined();
    expect(playability.states.map((state) => state.key)).toEqual([
      'GRANTED',
      'REMOVED',
    ]);
    expect(generatability.states.map((state) => state.key)).toEqual([
      'GRANTED',
      'REMOVED',
    ]);
    expect(
      WEOS_CANONICAL_LIFECYCLE_BY_FAMILY['diagnosis-operational-permission'],
    ).toBeUndefined();
  });

  it('does not include implementation blockers as canonical lifecycle states', () => {
    const allStates = WEOS_CANONICAL_LIFECYCLES.flatMap((family) =>
      family.states.map((state) => state.key),
    );

    expect(allStates).not.toContain('BLOCKED_CASE_NOT_EDITABLE');
  });

  it('preserves publication decisions and withdraws published versions', () => {
    const publicationDecision = WEOS_CANONICAL_LIFECYCLE_BY_FAMILY[
      'publication-decision'
    ].states.map((state) => state.key);
    const publishedVersion = WEOS_CANONICAL_LIFECYCLE_BY_FAMILY[
      'published-artifact-version'
    ].states.map((state) => state.key);

    expect(publicationDecision).toContain('AUTHORISED');
    expect(publicationDecision).not.toContain('WITHDRAWN');
    expect(publicationDecision).not.toContain('SUPERSEDED');
    expect(publishedVersion).toContain('WITHDRAWN');
  });

  it('separates validation outcome from validation standing', () => {
    const validationStanding = WEOS_CANONICAL_LIFECYCLE_BY_FAMILY[
      'validation-result-standing'
    ].states.map((state) => state.key);

    expect(validationStanding).toEqual(['CURRENT', 'STALE', 'SUPERSEDED']);
    expect(validationStanding).not.toContain('ERROR');
  });

  it('makes content mutation opt-in rather than review-state derived', () => {
    const caseRevision =
      WEOS_CANONICAL_LIFECYCLE_BY_FAMILY['case-revision'].states;
    const byKey = Object.fromEntries(
      caseRevision.map((state) => [state.key, state]),
    );

    expect(byKey.DRAFT.permitsContentMutation).toBe(true);
    expect(byKey.REVISION_REQUIRED.permitsContentMutation).toBe(true);
    expect(byKey.UNDER_REVIEW.permitsContentMutation).toBe(false);
    expect(byKey.APPROVED.permitsContentMutation).toBe(false);
  });
});
