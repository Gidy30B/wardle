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
    expect(application.producesArtifactTypes).toEqual([
      'CONTROLLED_APPLICATION_RECORD',
      'CASE_REVISION',
    ]);
    expect(application.changesStandingOfArtifactTypes).toEqual([
      'AI_DRAFT',
      'CLUE_REVISION_DRAFT',
      'CONTROLLED_APPLICATION_RECORD',
    ]);
    expect(application.producesArtifactTypes).not.toContain(
      'EDITORIAL_DECISION',
    );
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
      (action) => action.requiresDecision,
    );

    expect(decisionActions.length).toBeGreaterThan(0);
    for (const action of decisionActions) {
      expect(action.requiresDecision).toBe(true);
      expect(
        action.decisionOutcome !== null ||
          action.abstract ||
          action.composite ||
          action.governanceRecordType !== undefined ||
          action.producesRecordKinds.length > 0,
      ).toBe(true);
    }
  });

  it('separates action subjects from produced records and artifacts', () => {
    const approveRevision = WEOS_CANONICAL_ACTION_BY_KEY.APPROVE_REVISION;
    const validateAiDraft = WEOS_CANONICAL_ACTION_BY_KEY.VALIDATE_AI_DRAFT;
    const acceptClueDraft =
      WEOS_CANONICAL_ACTION_BY_KEY.ACCEPT_CLUE_REVISION_DRAFT;

    expect(approveRevision.subjectArtifactTypes).toContain('CASE_REVISION');
    expect(approveRevision.subjectArtifactTypes).not.toContain(
      'EDITORIAL_DECISION',
    );
    expect(approveRevision.producesArtifactTypes).toContain(
      'EDITORIAL_DECISION',
    );
    expect(validateAiDraft.producesRecordKinds).toContain('VALIDATION_RECORD');
    expect(acceptClueDraft.subjectArtifactTypes).toEqual([
      'CLUE_REVISION_DRAFT',
    ]);
  });

  it('separates revision decision outputs from revision standing changes', () => {
    for (const key of [
      'APPROVE_REVISION',
      'REJECT_REVISION',
      'REQUIRE_REVISION',
    ] as const) {
      const action = WEOS_CANONICAL_ACTION_BY_KEY[key];

      expect(action.subjectArtifactTypes).toEqual([
        'CASE_REVISION',
        'DIAGNOSIS_EDUCATION_REVISION',
      ]);
      expect(action.targetRevisionTypes).toEqual([
        'CASE_REVISION',
        'DIAGNOSIS_EDUCATION_REVISION',
      ]);
      expect(action.producesArtifactTypes).toEqual(['EDITORIAL_DECISION']);
      expect(action.producesRecordKinds).toEqual(['DECISION_RECORD']);
      expect(action.changesStandingOfArtifactTypes).toEqual([
        'CASE_REVISION',
        'DIAGNOSIS_EDUCATION_REVISION',
      ]);
    }
  });

  it('separates graph and relationship decisions from changed-standing artifacts', () => {
    expect(
      WEOS_CANONICAL_ACTION_BY_KEY.APPROVE_GRAPH_PROMOTION
        .producesArtifactTypes,
    ).toEqual(['EDITORIAL_DECISION']);
    expect(
      WEOS_CANONICAL_ACTION_BY_KEY.APPROVE_GRAPH_PROMOTION
        .changesStandingOfArtifactTypes,
    ).toEqual(['GRAPH_CANDIDATE']);
    expect(
      WEOS_CANONICAL_ACTION_BY_KEY.REJECT_GRAPH_CANDIDATE.producesArtifactTypes,
    ).toEqual(['EDITORIAL_DECISION']);
    expect(
      WEOS_CANONICAL_ACTION_BY_KEY.REJECT_GRAPH_CANDIDATE
        .changesStandingOfArtifactTypes,
    ).toEqual(['GRAPH_CANDIDATE']);
    expect(
      WEOS_CANONICAL_ACTION_BY_KEY.ACTIVATE_RELATIONSHIP.producesArtifactTypes,
    ).toEqual(['EDITORIAL_DECISION']);
    expect(
      WEOS_CANONICAL_ACTION_BY_KEY.ACTIVATE_RELATIONSHIP
        .changesStandingOfArtifactTypes,
    ).toEqual(['TEACHING_RELATIONSHIP']);
    expect(
      WEOS_CANONICAL_ACTION_BY_KEY.DEPRECATE_RELATIONSHIP.producesArtifactTypes,
    ).toEqual(['EDITORIAL_DECISION']);
  });

  it('models registry and operational permission actions as standing changes', () => {
    for (const key of [
      'ACTIVATE_REGISTRY_ENTRY',
      'HIDE_REGISTRY_ENTRY',
      'DEPRECATE_REGISTRY_ENTRY',
      'MERGE_REGISTRY_ENTRY',
    ] as const) {
      expect(
        WEOS_CANONICAL_ACTION_BY_KEY[key].changesStandingOfArtifactTypes,
      ).toEqual(['DIAGNOSIS_REGISTRY']);
      expect(
        WEOS_CANONICAL_ACTION_BY_KEY[key].producesArtifactTypes,
      ).not.toContain('DIAGNOSIS_REGISTRY');
    }

    expect(
      WEOS_CANONICAL_ACTION_BY_KEY.REMAP_DIAGNOSIS_REFERENCE
        .changesStandingOfArtifactTypes,
    ).toEqual([]);
    expect(
      WEOS_CANONICAL_ACTION_BY_KEY.REMAP_DIAGNOSIS_REFERENCE
        .producesArtifactTypes,
    ).not.toContain('DIAGNOSIS_REGISTRY');

    for (const key of [
      'GRANT_PLAYABILITY',
      'REMOVE_PLAYABILITY',
      'GRANT_GENERATABILITY',
      'REMOVE_GENERATABILITY',
    ] as const) {
      expect(WEOS_CANONICAL_ACTION_BY_KEY[key].subjectArtifactTypes).toEqual([
        'DIAGNOSIS_OPERATIONAL_PERMISSION',
      ]);
      expect(WEOS_CANONICAL_ACTION_BY_KEY[key].producesArtifactTypes).toEqual([
        'EDITORIAL_DECISION',
      ]);
      expect(
        WEOS_CANONICAL_ACTION_BY_KEY[key].changesStandingOfArtifactTypes,
      ).toEqual(['DIAGNOSIS_OPERATIONAL_PERMISSION']);
    }
  });

  it('models publication decisions without treating published versions as authorisation subjects', () => {
    const authorise = WEOS_CANONICAL_ACTION_BY_KEY.AUTHORISE_PUBLICATION;
    const decline = WEOS_CANONICAL_ACTION_BY_KEY.DECLINE_PUBLICATION;
    const withdraw = WEOS_CANONICAL_ACTION_BY_KEY.WITHDRAW_PUBLICATION;
    const supersede = WEOS_CANONICAL_ACTION_BY_KEY.SUPERSEDE_PUBLICATION;

    for (const action of [authorise, decline]) {
      expect(action.subjectArtifactTypes).toEqual([
        'CASE_REVISION',
        'DIAGNOSIS_EDUCATION_REVISION',
      ]);
      expect(action.targetRevisionTypes).toEqual([
        'CASE_REVISION',
        'DIAGNOSIS_EDUCATION_REVISION',
      ]);
      expect(action.producesArtifactTypes).toEqual(['PUBLICATION_DECISION']);
      expect(action.producesRecordKinds).toEqual(['DECISION_RECORD']);
      expect(action.governanceRecordType).toBe('PUBLICATION_DECISION');
      expect(action.subjectArtifactTypes).not.toContain(
        'PUBLISHED_ARTIFACT_VERSION',
      );
    }

    expect(withdraw.subjectArtifactTypes).toEqual([
      'PUBLISHED_ARTIFACT_VERSION',
    ]);
    expect(withdraw.producesArtifactTypes).toEqual([
      'WITHDRAWAL_RECORD',
      'PUBLICATION_HISTORY',
    ]);
    expect(withdraw.producesRecordKinds).toEqual([
      'DECISION_RECORD',
      'PROJECTION',
    ]);
    expect(withdraw.changesStandingOfArtifactTypes).toEqual([
      'PUBLISHED_ARTIFACT_VERSION',
      'PUBLICATION_SCHEDULE',
      'LEARNER_EXPOSURE_REFERENCE',
    ]);

    expect(supersede.subjectArtifactTypes).toEqual([
      'PUBLISHED_ARTIFACT_VERSION',
    ]);
    expect(supersede.producesArtifactTypes).toEqual([
      'SUPERSESSION_RECORD',
      'PUBLICATION_HISTORY',
    ]);
    expect(supersede.producesArtifactTypes).not.toContain(
      'PUBLISHED_ARTIFACT_VERSION',
    );
    expect(supersede.producesRecordKinds).toEqual([
      'DECISION_RECORD',
      'PROJECTION',
    ]);
    expect(supersede.changesStandingOfArtifactTypes).toEqual([
      'PUBLISHED_ARTIFACT_VERSION',
    ]);
  });

  it('does not give every AI and clue action the same subject set', () => {
    const createAiDraft = WEOS_CANONICAL_ACTION_BY_KEY.CREATE_AI_DRAFT;
    const createClueDraft =
      WEOS_CANONICAL_ACTION_BY_KEY.CREATE_CLUE_REVISION_DRAFT;
    const applyAcceptedDraft =
      WEOS_CANONICAL_ACTION_BY_KEY.APPLY_ACCEPTED_DRAFT;

    expect(createAiDraft.subjectArtifactTypes).not.toEqual(
      createClueDraft.subjectArtifactTypes,
    );
    expect(applyAcceptedDraft.subjectArtifactTypes).toEqual([
      'CONTROLLED_APPLICATION_RECORD',
    ]);
  });

  it('uses neutral output metadata for validation, assessment, and governance outputs', () => {
    const validation = WEOS_CANONICAL_ACTION_BY_KEY.RECORD_VALIDATION_RESULT;
    const assessment = WEOS_CANONICAL_ACTION_BY_KEY.RECORD_CLINICAL_ASSESSMENT;
    const reviewDue = WEOS_CANONICAL_ACTION_BY_KEY.MARK_REVIEW_DUE;
    const obligation =
      WEOS_CANONICAL_ACTION_BY_KEY.CREATE_REVALIDATION_OBLIGATION;
    const conflict = WEOS_CANONICAL_ACTION_BY_KEY.RECORD_CONFLICT_OF_INTEREST;
    const exception = WEOS_CANONICAL_ACTION_BY_KEY.GRANT_GOVERNANCE_EXCEPTION;
    const disagreement = WEOS_CANONICAL_ACTION_BY_KEY.RECORD_DISAGREEMENT;
    const adjudication = WEOS_CANONICAL_ACTION_BY_KEY.ADJUDICATE_DISAGREEMENT;
    const emergency =
      WEOS_CANONICAL_ACTION_BY_KEY.INITIATE_EMERGENCY_CORRECTION;

    expect(validation.producesRecordKinds).toContain('VALIDATION_RECORD');
    expect(validation.governanceRecordType).toBeUndefined();
    expect(assessment.producesRecordKinds).toContain('ASSESSMENT_RECORD');
    expect(assessment.governanceRecordType).toBeUndefined();
    expect(reviewDue.producesArtifactTypes).toContain('REVIEW_DUE_DATE');
    expect(reviewDue.producesArtifactTypes).not.toContain(
      'EMERGENCY_CORRECTION',
    );
    expect(obligation.producesArtifactTypes).toContain(
      'REVALIDATION_OBLIGATION',
    );
    expect(conflict.producesArtifactTypes).toContain(
      'CONFLICT_OF_INTEREST_DECLARATION',
    );
    expect(exception.producesArtifactTypes).toContain('GOVERNANCE_EXCEPTION');
    expect(exception.requiresDecision).toBe(true);
    expect(disagreement.producesArtifactTypes).toContain('DISAGREEMENT_RECORD');
    expect(disagreement.requiresDecision).toBe(false);
    expect(adjudication.producesArtifactTypes).toContain('ADJUDICATION_RECORD');
    expect(adjudication.requiresDecision).toBe(true);
    expect(emergency.producesArtifactTypes).toContain('EMERGENCY_CORRECTION');
    expect(emergency.producesArtifactTypes).toContain(
      'REVALIDATION_OBLIGATION',
    );
  });

  it('imports implementation support from canonical concepts', () => {
    const supportValues = Object.values(WEOS_IMPLEMENTATION_SUPPORT);

    for (const action of WEOS_CANONICAL_ACTIONS) {
      expect(supportValues).toContain(action.currentImplementationSupport);
    }
  });
});
