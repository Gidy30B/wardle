import {
  WEOS_ACTION_CATEGORIES,
  WEOS_CANONICAL_ACTIONS,
  WEOS_CANONICAL_ACTION_BY_KEY,
  WEOS_EDITORIAL_ACTIONS,
} from './canonical-actions';
import { WEOS_IMPLEMENTATION_SUPPORT } from './canonical-concepts';

describe('WEOS canonical actions', () => {
  it('has one action definition for every canonical action key', () => {
    const actionKeys = Object.values(WEOS_EDITORIAL_ACTIONS);

    expect(WEOS_CANONICAL_ACTIONS).toHaveLength(actionKeys.length);
    expect(Object.keys(WEOS_CANONICAL_ACTION_BY_KEY).sort()).toEqual(
      actionKeys.sort(),
    );
  });

  it('models controlled application as action metadata, not a decision outcome', () => {
    const application = WEOS_CANONICAL_ACTION_BY_KEY.APPLY_ACCEPTED_DRAFT;

    expect(application.requiresDecision).toBe(false);
    expect(application.createsOperationalEffect).toBe(true);
    expect(application.createsRevision).toBe(true);
  });

  it('includes evidence withdrawal and diagnosis remapping actions', () => {
    expect(WEOS_CANONICAL_ACTION_BY_KEY.WITHDRAW_EVIDENCE_SOURCE).toBeDefined();
    expect(
      'MARK_EVIDENCE_SOURCE_WITHDRAWN' in WEOS_CANONICAL_ACTION_BY_KEY,
    ).toBe(false);
    expect(
      WEOS_CANONICAL_ACTION_BY_KEY.REMAP_DIAGNOSIS_REFERENCE,
    ).toBeDefined();
    expect(WEOS_CANONICAL_ACTION_BY_KEY.MERGE_REGISTRY_ENTRY).toBeDefined();
  });

  it('keeps review requests distinct from governed revision decisions', () => {
    const requestChanges = WEOS_CANONICAL_ACTION_BY_KEY.REQUEST_CHANGES;
    const requireRevision = WEOS_CANONICAL_ACTION_BY_KEY.REQUIRE_REVISION;

    expect(requestChanges.category).toBe(WEOS_ACTION_CATEGORIES.REVIEW);
    expect(requestChanges.createsGovernanceRecord).toBe(false);
    expect(requireRevision.category).toBe(WEOS_ACTION_CATEGORIES.DECISION);
    expect(requireRevision.createsGovernanceRecord).toBe(true);
    expect(requireRevision.decisionOutcome).toBe('REQUIRE_REVISION');
  });

  it('correctly categorizes materiality, supersession, archive, and retirement', () => {
    expect('MARK_MATERIAL_CHANGE' in WEOS_CANONICAL_ACTION_BY_KEY).toBe(false);
    expect(
      WEOS_CANONICAL_ACTION_BY_KEY.DETERMINE_MATERIAL_CHANGE.category,
    ).toBe(WEOS_ACTION_CATEGORIES.ASSESSMENT);
    expect(
      WEOS_CANONICAL_ACTION_BY_KEY.RECORD_MATERIAL_CHANGE_DETERMINATION
        .category,
    ).toBe(WEOS_ACTION_CATEGORIES.GOVERNANCE);
    expect(WEOS_CANONICAL_ACTION_BY_KEY.SUPERSEDE_REVISION.category).not.toBe(
      WEOS_ACTION_CATEGORIES.AUTHORING,
    );
    expect(WEOS_CANONICAL_ACTION_BY_KEY.ARCHIVE_ARTIFACT.category).not.toBe(
      WEOS_ACTION_CATEGORIES.AUTHORING,
    );
    expect(WEOS_CANONICAL_ACTION_BY_KEY.RETIRE_ARTIFACT.category).not.toBe(
      WEOS_ACTION_CATEGORIES.AUTHORING,
    );
  });

  it('keeps publication assessment distinct from publication readiness assessment', () => {
    expect(
      WEOS_CANONICAL_ACTION_BY_KEY.ASSESS_PUBLICATION_READINESS
        .createsAssessment,
    ).toBe(false);
    expect(
      WEOS_CANONICAL_ACTION_BY_KEY.RECORD_PUBLICATION_READINESS_ASSESSMENT
        .applicableArtifactTypes,
    ).toContain('PUBLICATION_READINESS_ASSESSMENT');
    expect(
      WEOS_CANONICAL_ACTION_BY_KEY.RECORD_PUBLICATION_ASSESSMENT
        .applicableArtifactTypes,
    ).toContain('PUBLICATION_ASSESSMENT');
  });

  it('marks generic actions abstract and republish as composite', () => {
    expect(WEOS_CANONICAL_ACTION_BY_KEY.ACTIVATE_ARTIFACT.abstract).toBe(true);
    expect(WEOS_CANONICAL_ACTION_BY_KEY.DEPRECATE_ARTIFACT.abstract).toBe(true);
    expect(WEOS_CANONICAL_ACTION_BY_KEY.REPUBLISH_REVISION.composite).toBe(
      true,
    );
  });

  it('documents every decision action with decision metadata', () => {
    const decisionActions = WEOS_CANONICAL_ACTIONS.filter(
      (action) => action.category === WEOS_ACTION_CATEGORIES.DECISION,
    );

    expect(decisionActions.length).toBeGreaterThan(0);
    for (const action of decisionActions) {
      expect(action.requiresDecision).toBe(true);
      expect(action.createsGovernanceRecord).toBe(true);
      expect(action.expectedGovernanceRecordType).not.toBe('NONE');
      expect(action.decisionOutcome).not.toBeNull();
    }
  });

  it('imports implementation support from canonical concepts', () => {
    const supportValues = Object.values(WEOS_IMPLEMENTATION_SUPPORT);

    for (const action of WEOS_CANONICAL_ACTIONS) {
      expect(supportValues).toContain(action.currentImplementationSupport);
    }
  });
});
