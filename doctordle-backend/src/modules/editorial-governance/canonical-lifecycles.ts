import {
  WEOS_ARTIFACT_TYPES,
  type WeosArtifactType,
} from './canonical-artifact-catalogue';
import {
  WEOS_LIFECYCLE_STATE_CLASSES,
  type WeosLifecycleStateClass,
} from './canonical-concepts';

export type CanonicalLifecycleStateDefinition = {
  key: string;
  label: string;
  meaning: string;
  stateClass: WeosLifecycleStateClass;
  governed: boolean;
  terminal: boolean;
  candidateKnowledge: boolean;
  permitsContentMutation: boolean;
  mayHaveLearnerExposure: boolean;
  canonical: boolean;
  currentlyImplemented: boolean;
};

export type CanonicalLifecycleDefinition = {
  lifecycleFamily: string;
  artifactType: WeosArtifactType;
  meaning: string;
  states: readonly CanonicalLifecycleStateDefinition[];
  currentImplementationModels: readonly string[];
  notes?: readonly string[];
};

const T = WEOS_ARTIFACT_TYPES;
const K = WEOS_LIFECYCLE_STATE_CLASSES;

function state(
  key: string,
  stateClass: WeosLifecycleStateClass,
  options: Partial<CanonicalLifecycleStateDefinition> = {},
): CanonicalLifecycleStateDefinition {
  return {
    key,
    label: key
      .toLowerCase()
      .split('_')
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join(' '),
    meaning: `${key} standing for this artifact-specific lifecycle family.`,
    stateClass,
    governed: stateClass === K.GOVERNED || stateClass === K.TERMINAL,
    terminal: stateClass === K.TERMINAL,
    candidateKnowledge: stateClass === K.CANDIDATE,
    permitsContentMutation: false,
    mayHaveLearnerExposure: false,
    canonical: true,
    currentlyImplemented: false,
    ...options,
  };
}

function lifecycle(input: CanonicalLifecycleDefinition) {
  return input;
}

export const WEOS_CANONICAL_LIFECYCLES: readonly CanonicalLifecycleDefinition[] =
  [
    lifecycle({
      lifecycleFamily: 'diagnosis-registry-identity',
      artifactType: T.DIAGNOSIS_REGISTRY,
      meaning:
        'Diagnosis registry identity standing, distinct from playability, generatability, onboarding, and readiness.',
      currentImplementationModels: ['DiagnosisRegistry.status'],
      states: [
        state('DRAFT', K.AUTHORING, {
          currentlyImplemented: true,
          permitsContentMutation: true,
        }),
        state('ACTIVE', K.GOVERNED, { currentlyImplemented: true }),
        state('HIDDEN', K.OPERATIONAL, { currentlyImplemented: true }),
        state('DEPRECATED', K.TERMINAL, { currentlyImplemented: true }),
      ],
    }),
    lifecycle({
      lifecycleFamily: 'diagnosis-registry-candidate',
      artifactType: T.DIAGNOSIS_REGISTRY_CANDIDATE,
      meaning: 'Candidate diagnosis identity review and creation standing.',
      currentImplementationModels: ['DiagnosisRegistryCandidate.status'],
      notes: [
        'Current transitions are domain-specific and not all have generic decision provenance.',
      ],
      states: [
        state('CANDIDATE', K.CANDIDATE, { currentlyImplemented: true }),
        state('NEEDS_REVIEW', K.REVIEW, { currentlyImplemented: true }),
        state('REJECTED', K.TERMINAL, { currentlyImplemented: true }),
        state('MERGED', K.TERMINAL, { currentlyImplemented: true }),
        state('APPROVED_PENDING_CREATE', K.GOVERNED, {
          currentlyImplemented: true,
        }),
        state('CREATED', K.TERMINAL, { currentlyImplemented: true }),
      ],
    }),
    lifecycle({
      lifecycleFamily: 'diagnosis-onboarding-progress',
      artifactType: T.DIAGNOSIS_ONBOARDING_PROGRESS,
      meaning: 'Operational onboarding progress, not readiness.',
      currentImplementationModels: ['DiagnosisRegistry.onboardingStatus'],
      states: [
        'NEW',
        'RULES_STARTED',
        'BRIEF_STARTED',
        'EDUCATION_STARTED',
        'CASE_STARTED',
        'READY_FOR_REVIEW',
        'COMPLETE',
      ].map((key) =>
        state(key, K.OPERATIONAL, {
          currentlyImplemented: true,
          governed: false,
        }),
      ),
    }),
    lifecycle({
      lifecycleFamily: 'diagnosis-playability-permission',
      artifactType: T.DIAGNOSIS_OPERATIONAL_PERMISSION,
      meaning:
        'Independent operational permission dimension controlling learner-answer playability.',
      currentImplementationModels: ['DiagnosisRegistry.isPlayable'],
      states: ['GRANTED', 'REMOVED'].map((key) =>
        state(key, K.OPERATIONAL, {
          currentlyImplemented: true,
          governed: false,
        }),
      ),
    }),
    lifecycle({
      lifecycleFamily: 'diagnosis-generatability-permission',
      artifactType: T.DIAGNOSIS_OPERATIONAL_PERMISSION,
      meaning:
        'Independent operational permission dimension controlling automated generation participation.',
      currentImplementationModels: ['DiagnosisRegistry.isGeneratable'],
      states: ['GRANTED', 'REMOVED'].map((key) =>
        state(key, K.OPERATIONAL, {
          currentlyImplemented: true,
          governed: false,
        }),
      ),
    }),
    lifecycle({
      lifecycleFamily: 'editorial-brief',
      artifactType: T.EDITORIAL_BRIEF,
      meaning:
        'Editorial Brief standing; current string vocabulary is not proven exhaustive.',
      currentImplementationModels: ['DiagnosisEditorialBrief.status'],
      states: [
        state('ABSENT', K.AUTHORING),
        state('DRAFT', K.AUTHORING, {
          currentlyImplemented: true,
          permitsContentMutation: true,
        }),
        state('REVIEW_REQUIRED', K.REVIEW, { currentlyImplemented: true }),
        state('REVISION_REQUIRED', K.REVIEW, { permitsContentMutation: true }),
        state('APPROVED', K.GOVERNED, { currentlyImplemented: true }),
        state('REJECTED', K.TERMINAL, { currentlyImplemented: true }),
        state('SUPERSEDED', K.TERMINAL),
      ],
    }),
    lifecycle({
      lifecycleFamily: 'learning-goal-in-brief',
      artifactType: T.LEARNING_GOAL,
      meaning:
        'Learning Goal standing inside a governed Brief version; no independent persistence is claimed.',
      currentImplementationModels: ['DiagnosisEditorialBrief.learningGoals'],
      states: [
        state('DRAFT', K.AUTHORING, {
          currentlyImplemented: true,
          permitsContentMutation: true,
        }),
        state('ACTIVE_IN_BRIEF', K.GOVERNED, { currentlyImplemented: true }),
        state('REPLACED', K.TERMINAL),
        state('DEPRECATED', K.TERMINAL),
      ],
    }),
    lifecycle({
      lifecycleFamily: 'teaching-rule',
      artifactType: T.TEACHING_RULE,
      meaning:
        'Teaching Rule standing; ACTIVE is distinct from validation passed.',
      currentImplementationModels: ['DiagnosisTeachingRule.status'],
      states: [
        state('CANDIDATE', K.CANDIDATE, { currentlyImplemented: true }),
        state('REVIEW_REQUIRED', K.REVIEW, { currentlyImplemented: true }),
        state('REVISION_REQUIRED', K.REVIEW, { permitsContentMutation: true }),
        state('ACTIVE', K.GOVERNED, { currentlyImplemented: true }),
        state('REJECTED', K.TERMINAL, { currentlyImplemented: true }),
        state('DEPRECATED', K.TERMINAL, { currentlyImplemented: true }),
        state('SUPERSEDED', K.TERMINAL),
      ],
    }),
    lifecycle({
      lifecycleFamily: 'reasoning-path',
      artifactType: T.REASONING_PATH,
      meaning:
        'Reasoning Path lifecycle; readiness score remains outside lifecycle.',
      currentImplementationModels: ['ReasoningPath.status'],
      states: [
        state('CANDIDATE', K.CANDIDATE, { currentlyImplemented: true }),
        state('REVIEW_REQUIRED', K.REVIEW),
        state('ACTIVE', K.GOVERNED, { currentlyImplemented: true }),
        state('REJECTED', K.TERMINAL, { currentlyImplemented: true }),
        state('DEPRECATED', K.TERMINAL, { currentlyImplemented: true }),
      ],
    }),
    lifecycle({
      lifecycleFamily: 'clinical-case-identity',
      artifactType: T.CLINICAL_CASE,
      meaning:
        'Clinical Case identity standing; the mutable Case aggregate is not the authoritative approval lifecycle.',
      currentImplementationModels: ['Case'],
      notes: [
        'CaseEditorialStatus is a compatibility projection combining multiple canonical dimensions.',
      ],
      states: [
        state('ACTIVE_IDENTITY', K.GOVERNED, { currentlyImplemented: true }),
        state('ARCHIVED_IDENTITY', K.TERMINAL),
        state('RETIRED_IDENTITY', K.TERMINAL),
      ],
    }),
    lifecycle({
      lifecycleFamily: 'case-revision',
      artifactType: T.CASE_REVISION,
      meaning:
        'Governed Case Revision editorial lifecycle, excluding readiness, publication, scheduling, playability, and learner exposure.',
      currentImplementationModels: ['CaseEditorialStatus', 'CaseRevision'],
      states: [
        state('DRAFT', K.AUTHORING, {
          currentlyImplemented: true,
          permitsContentMutation: true,
        }),
        state('VALIDATION_PENDING', K.REVIEW, { currentlyImplemented: true }),
        state('VALIDATION_FAILED', K.REVIEW, { currentlyImplemented: true }),
        state('REVIEW_REQUIRED', K.REVIEW, { currentlyImplemented: true }),
        state('UNDER_REVIEW', K.REVIEW, { currentlyImplemented: true }),
        state('REVISION_REQUIRED', K.REVIEW, {
          currentlyImplemented: true,
          permitsContentMutation: true,
        }),
        state('APPROVED', K.GOVERNED, { currentlyImplemented: true }),
        state('REJECTED', K.TERMINAL, { currentlyImplemented: true }),
        state('SUPERSEDED', K.TERMINAL),
      ],
    }),
    lifecycle({
      lifecycleFamily: 'case-explanation-component',
      artifactType: T.CASE_EXPLANATION,
      meaning:
        'Case Explanation standing as a component of Case Revision unless independent behavior is proven.',
      currentImplementationModels: ['Case.explanation', 'ExplanationContent'],
      states: [
        state('DRAFT', K.AUTHORING, {
          currentlyImplemented: true,
          permitsContentMutation: true,
        }),
        state('REVIEW_REQUIRED', K.REVIEW),
        state('APPROVED_WITH_CASE_REVISION', K.GOVERNED),
        state('SUPERSEDED', K.TERMINAL),
      ],
    }),
    ...[
      [T.CLINICAL_CLUE, 'clinical-clue-component'],
      [T.CLUE_PROGRESSION_ANALYSIS, 'clue-progression-analysis'],
      [T.CLUE_DISCRIMINATOR_ANNOTATION, 'clue-discriminator-annotation'],
      [T.ESCALATION_ANNOTATION, 'escalation-annotation'],
    ].map(([artifactType, lifecycleFamily]) =>
      lifecycle({
        lifecycleFamily,
        artifactType: artifactType as WeosArtifactType,
        meaning: `${lifecycleFamily} standing within Case Revision unless stable independent identity is required.`,
        currentImplementationModels: ['CaseRevision', 'Case.clues'],
        states: [
          state('DRAFT', K.AUTHORING, {
            currentlyImplemented: true,
            permitsContentMutation: true,
          }),
          state('ACTIVE_IN_REVISION', K.GOVERNED, {
            currentlyImplemented: true,
          }),
          state('STALE', K.LEGACY),
          state('SUPERSEDED', K.TERMINAL),
        ],
      }),
    ),
    lifecycle({
      lifecycleFamily: 'clue-revision-draft',
      artifactType: T.CLUE_REVISION_DRAFT,
      meaning:
        'Clue Revision Draft standing. Acceptance is not application; application is not approval.',
      currentImplementationModels: ['CaseClueRevisionDraft.status'],
      states: [
        state('DRAFT', K.AUTHORING, { permitsContentMutation: true }),
        state('PENDING_REVIEW', K.REVIEW, { currentlyImplemented: true }),
        state('ACCEPTED', K.GOVERNED, { currentlyImplemented: true }),
        state('CHANGES_REQUESTED', K.REVIEW, { currentlyImplemented: true }),
        state('REJECTED', K.TERMINAL, { currentlyImplemented: true }),
        state('APPLIED', K.OPERATIONAL, { currentlyImplemented: true }),
        state('SUPERSEDED', K.TERMINAL, { currentlyImplemented: true }),
      ],
    }),
    lifecycle({
      lifecycleFamily: 'diagnosis-education-identity',
      artifactType: T.DIAGNOSIS_EDUCATION,
      meaning:
        'Diagnosis Education identity standing, separate from revision standing.',
      currentImplementationModels: ['DiagnosisEducation'],
      states: [
        state('ACTIVE_IDENTITY', K.GOVERNED, { currentlyImplemented: true }),
        state('ARCHIVED_IDENTITY', K.TERMINAL, { currentlyImplemented: true }),
        state('RETIRED_IDENTITY', K.TERMINAL),
      ],
    }),
    lifecycle({
      lifecycleFamily: 'diagnosis-education-revision',
      artifactType: T.DIAGNOSIS_EDUCATION_REVISION,
      meaning:
        'Diagnosis Education Revision editorial lifecycle excluding publication.',
      currentImplementationModels: [
        'DiagnosisEducationStatus',
        'DiagnosisEducationRevision',
      ],
      states: [
        state('DRAFT', K.AUTHORING, {
          currentlyImplemented: true,
          permitsContentMutation: true,
        }),
        state('GENERATED_CANDIDATE', K.CANDIDATE, {
          currentlyImplemented: true,
        }),
        state('REVIEW_REQUIRED', K.REVIEW, { currentlyImplemented: true }),
        state('UNDER_REVIEW', K.REVIEW),
        state('REVISION_REQUIRED', K.REVIEW, {
          currentlyImplemented: true,
          permitsContentMutation: true,
        }),
        state('APPROVED', K.GOVERNED, { currentlyImplemented: true }),
        state('REJECTED', K.TERMINAL, { currentlyImplemented: true }),
        state('SUPERSEDED', K.TERMINAL),
      ],
    }),
    lifecycle({
      lifecycleFamily: 'graph-candidate',
      artifactType: T.GRAPH_CANDIDATE,
      meaning: 'Graph Candidate review, merge, and promotion standing.',
      currentImplementationModels: ['DiagnosisGraphCandidate.status'],
      states: [
        state('CANDIDATE', K.CANDIDATE, { currentlyImplemented: true }),
        state('REVIEW_REQUIRED', K.REVIEW),
        state('APPROVED_FOR_PROMOTION', K.GOVERNED, {
          currentlyImplemented: true,
        }),
        state('REJECTED', K.TERMINAL, { currentlyImplemented: true }),
        state('MERGED', K.TERMINAL, { currentlyImplemented: true }),
        state('PROMOTED', K.OPERATIONAL, { currentlyImplemented: true }),
      ],
    }),
    lifecycle({
      lifecycleFamily: 'graph-fact',
      artifactType: T.GRAPH_FACT,
      meaning: 'Governed graph fact standing.',
      currentImplementationModels: ['DiagnosisGraphFact.status'],
      states: [
        state('ACTIVE', K.GOVERNED, { currentlyImplemented: true }),
        state('ARCHIVED', K.TERMINAL, { currentlyImplemented: true }),
        state('DEPRECATED', K.TERMINAL),
        state('SUPERSEDED', K.TERMINAL),
      ],
    }),
    lifecycle({
      lifecycleFamily: 'teaching-relationship',
      artifactType: T.TEACHING_RELATIONSHIP,
      meaning: 'Teaching Relationship standing distinct from graph proximity.',
      currentImplementationModels: ['DiagnosisTeachingRelationship.status'],
      states: [
        'CANDIDATE',
        'NEEDS_REVIEW',
        'ACTIVE',
        'REJECTED',
        'DEPRECATED',
      ].map((key) =>
        state(
          key,
          key === 'ACTIVE'
            ? K.GOVERNED
            : key === 'CANDIDATE'
              ? K.CANDIDATE
              : key === 'NEEDS_REVIEW'
                ? K.REVIEW
                : K.TERMINAL,
          {
            currentlyImplemented: true,
          },
        ),
      ),
    }),
    ...[
      [T.EVIDENCE_NODE, 'evidence-node'],
      [T.EVIDENCE_RELATIONSHIP, 'evidence-relationship'],
    ].map(([artifactType, lifecycleFamily]) =>
      lifecycle({
        lifecycleFamily,
        artifactType: artifactType as WeosArtifactType,
        meaning: `${lifecycleFamily} standing.`,
        currentImplementationModels: [
          lifecycleFamily === 'evidence-node'
            ? 'EvidenceNode.status'
            : 'DiagnosisEvidenceRelationship.status',
        ],
        states: ['CANDIDATE', 'ACTIVE', 'REJECTED', 'DEPRECATED'].map((key) =>
          state(
            key,
            key === 'ACTIVE'
              ? K.GOVERNED
              : key === 'CANDIDATE'
                ? K.CANDIDATE
                : K.TERMINAL,
            {
              currentlyImplemented: true,
            },
          ),
        ),
      }),
    ),
    lifecycle({
      lifecycleFamily: 'differential-mapping',
      artifactType: T.DIFFERENTIAL_MAPPING,
      meaning: 'Differential Mapping resolution standing.',
      currentImplementationModels: ['DifferentialResolutionStatus'],
      states: [
        state('UNRESOLVED', K.REVIEW, { currentlyImplemented: true }),
        state('AMBIGUOUS', K.REVIEW, { currentlyImplemented: true }),
        state('RESOLVED', K.GOVERNED, { currentlyImplemented: true }),
        state('REJECTED', K.TERMINAL, { currentlyImplemented: true }),
        state('STALE', K.LEGACY),
      ],
    }),
    lifecycle({
      lifecycleFamily: 'ai-draft',
      artifactType: T.AI_DRAFT,
      meaning:
        'AI Draft candidate lifecycle; APPLIED is intentionally excluded.',
      currentImplementationModels: ['AiDraftRevisionAudit.reviewStatus'],
      states: [
        'DRAFT',
        'VALIDATION_REQUIRED',
        'REVIEW_REQUIRED',
        'PENDING_REVIEW',
        'ACCEPTED',
        'CHANGES_REQUESTED',
        'REJECTED',
        'SUPERSEDED',
      ].map((key) =>
        state(
          key,
          ['ACCEPTED'].includes(key)
            ? K.GOVERNED
            : ['REJECTED', 'SUPERSEDED'].includes(key)
              ? K.TERMINAL
              : key === 'DRAFT'
                ? K.AUTHORING
                : K.REVIEW,
          {
            currentlyImplemented:
              key !== 'VALIDATION_REQUIRED' && key !== 'CHANGES_REQUESTED',
          },
        ),
      ),
    }),
    lifecycle({
      lifecycleFamily: 'controlled-application-record',
      artifactType: T.CONTROLLED_APPLICATION_RECORD,
      meaning:
        'Application standing for accepted candidate changes; successful application must identify a resulting revision.',
      currentImplementationModels: ['CaseClueRevisionDraft.appliedAt'],
      states: [
        'PROPOSED',
        'READY_TO_APPLY',
        'APPLIED',
        'FAILED',
        'RECONCILIATION_REQUIRED',
        'SUPERSEDED',
      ].map((key) =>
        state(
          key,
          key === 'APPLIED'
            ? K.OPERATIONAL
            : ['FAILED', 'SUPERSEDED'].includes(key)
              ? K.TERMINAL
              : K.REVIEW,
          {
            currentlyImplemented: [
              'READY_TO_APPLY',
              'APPLIED',
              'FAILED',
            ].includes(key),
          },
        ),
      ),
    }),
    lifecycle({
      lifecycleFamily: 'validation-result-standing',
      artifactType: T.VALIDATION_RESULT,
      meaning:
        'Validation Result standing; outcome remains separate from lifecycle.',
      currentImplementationModels: ['CaseValidationRun.outcome'],
      states: ['CURRENT', 'STALE', 'SUPERSEDED'].map((key) =>
        state(key, key === 'CURRENT' ? K.GOVERNED : K.LEGACY, {
          currentlyImplemented: key === 'CURRENT',
          permitsContentMutation: false,
        }),
      ),
    }),
    ...[
      [T.EDITORIAL_ASSESSMENT, 'editorial-assessment'],
      [T.CLINICAL_ASSESSMENT, 'clinical-assessment'],
      [T.EDUCATIONAL_ASSESSMENT, 'educational-assessment'],
      [T.REASONING_ASSESSMENT, 'reasoning-assessment'],
      [T.EVIDENCE_ASSESSMENT, 'evidence-assessment'],
      [T.SAFETY_ASSESSMENT, 'safety-assessment'],
      [T.PUBLICATION_READINESS_ASSESSMENT, 'publication-readiness-assessment'],
      [T.PUBLICATION_ASSESSMENT, 'publication-assessment'],
      [T.MAINTENANCE_ASSESSMENT, 'maintenance-assessment'],
      [T.RETIREMENT_ASSESSMENT, 'retirement-assessment'],
    ].map(([artifactType, lifecycleFamily]) =>
      lifecycle({
        lifecycleFamily,
        artifactType: artifactType as WeosArtifactType,
        meaning: `${lifecycleFamily} standing. Completed assessment is not approval.`,
        currentImplementationModels: [],
        states: ['DRAFT', 'COMPLETED', 'STALE', 'SUPERSEDED'].map((key) =>
          state(
            key,
            key === 'COMPLETED'
              ? K.GOVERNED
              : key === 'DRAFT'
                ? K.AUTHORING
                : K.LEGACY,
            {
              currentlyImplemented: false,
              permitsContentMutation: key === 'DRAFT',
            },
          ),
        ),
      }),
    ),
    lifecycle({
      lifecycleFamily: 'publication-decision',
      artifactType: T.PUBLICATION_DECISION,
      meaning:
        'Publication Decision lifecycle distinct from assessment and scheduling.',
      currentImplementationModels: ['Case.editorialStatus', 'Case.publishedAt'],
      states: ['PROPOSED', 'AUTHORISED', 'DECLINED'].map((key) =>
        state(
          key,
          key === 'AUTHORISED'
            ? K.GOVERNED
            : key === 'DECLINED'
              ? K.TERMINAL
              : K.REVIEW,
          {
            currentlyImplemented: key === 'AUTHORISED',
          },
        ),
      ),
    }),
    lifecycle({
      lifecycleFamily: 'published-artifact-version',
      artifactType: T.PUBLISHED_ARTIFACT_VERSION,
      meaning: 'Immutable published version lifecycle.',
      currentImplementationModels: [],
      states: ['PUBLISHED', 'WITHDRAWN', 'SUPERSEDED', 'ARCHIVED'].map((key) =>
        state(key, key === 'PUBLISHED' ? K.GOVERNED : K.TERMINAL, {
          mayHaveLearnerExposure: key === 'PUBLISHED',
        }),
      ),
    }),
    lifecycle({
      lifecycleFamily: 'publication-schedule',
      artifactType: T.PUBLICATION_SCHEDULE,
      meaning:
        'Operational schedule lifecycle distinct from publication decision.',
      currentImplementationModels: ['DailyCase'],
      states: ['PLANNED', 'SCHEDULED', 'CANCELLED', 'RELEASED', 'EXPIRED'].map(
        (key) =>
          state(
            key,
            ['SCHEDULED', 'RELEASED'].includes(key)
              ? K.OPERATIONAL
              : key === 'PLANNED'
                ? K.AUTHORING
                : K.TERMINAL,
            {
              currentlyImplemented: ['SCHEDULED', 'RELEASED'].includes(key),
            },
          ),
      ),
    }),
    lifecycle({
      lifecycleFamily: 'learner-exposure-reference',
      artifactType: T.LEARNER_EXPOSURE_REFERENCE,
      meaning: 'Learner exposure reference lifecycle.',
      currentImplementationModels: [
        'DailyCase.caseId',
        'GameSession.dailyCaseId',
      ],
      states: ['PENDING', 'ACTIVE', 'ENDED', 'REVOKED'].map((key) =>
        state(
          key,
          key === 'ACTIVE'
            ? K.OPERATIONAL
            : key === 'PENDING'
              ? K.AUTHORING
              : K.TERMINAL,
          {
            currentlyImplemented: ['ACTIVE'].includes(key),
            mayHaveLearnerExposure: key === 'ACTIVE',
          },
        ),
      ),
    }),
    ...[
      [T.REVALIDATION_OBLIGATION, 'revalidation-obligation'],
      [T.REVIEW_DUE_DATE, 'review-due-state'],
      [T.EVIDENCE_REFRESH_TRIGGER, 'evidence-refresh-trigger'],
      [T.GUIDELINE_CHANGE_TRIGGER, 'guideline-change-trigger'],
    ].map(([artifactType, lifecycleFamily]) =>
      lifecycle({
        lifecycleFamily,
        artifactType: artifactType as WeosArtifactType,
        meaning: `${lifecycleFamily} conceptual maintenance lifecycle.`,
        currentImplementationModels: [],
        states: ['OPEN', 'SATISFIED', 'CANCELLED', 'SUPERSEDED'].map((key) =>
          state(key, key === 'OPEN' ? K.OPERATIONAL : K.TERMINAL),
        ),
      }),
    ),
  ];

export const WEOS_CANONICAL_LIFECYCLE_BY_FAMILY = Object.fromEntries(
  WEOS_CANONICAL_LIFECYCLES.map((lifecycleDefinition) => [
    lifecycleDefinition.lifecycleFamily,
    lifecycleDefinition,
  ]),
) as Record<string, CanonicalLifecycleDefinition>;
