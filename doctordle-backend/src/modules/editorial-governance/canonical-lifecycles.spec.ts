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
});
