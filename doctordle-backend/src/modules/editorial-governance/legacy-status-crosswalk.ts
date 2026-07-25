import {
  AiDraftReviewStatus,
  CaseEditorialStatus,
  DiagnosisEducationStatus,
  DiagnosisEditorialOnboardingStatus,
  DiagnosisEvidenceRelationshipStatus,
  DiagnosisGraphCandidateStatus,
  DiagnosisGraphFactStatus,
  DiagnosisRegistryCandidateStatus,
  DiagnosisRegistryStatus,
  DiagnosisTeachingRelationshipStatus,
  DifferentialResolutionStatus,
  EvidenceNodeStatus,
  ReasoningDraftValidationStatus,
  ReasoningPathStatus,
  ReviewDecision,
  ValidationOutcome,
} from '@prisma/client';

import {
  WEOS_ARTIFACT_TYPES,
  type WeosArtifactType,
} from './canonical-artifact-catalogue';
import {
  WEOS_VALIDATION_OUTCOMES,
  WEOS_VERIFICATION_CONFIDENCE,
  type WeosValidationOutcome,
  type WeosVerificationConfidence,
} from './canonical-concepts';
import { WEOS_CANONICAL_LIFECYCLE_BY_FAMILY } from './canonical-lifecycles';

export type LegacyStatusCanonicalInterpretation = Readonly<{
  canonicalConcept:
    | 'LIFECYCLE_STATE'
    | 'VALIDATION_PROJECTION'
    | 'REVIEW_PROJECTION'
    | 'DECISION_PROJECTION'
    | 'READINESS_PROJECTION'
    | 'PUBLICATION_PROJECTION'
    | 'OPERATIONAL_PROJECTION'
    | 'MAINTENANCE_PROJECTION';
  targetArtifactType?: WeosArtifactType;
  lifecycleFamily?: string;
  lifecycleState?: string;
  validationOutcome?: WeosValidationOutcome;
  validationStanding?: 'CURRENT' | 'STALE' | 'SUPERSEDED' | 'ERROR';
  meaning: string;
}>;

export type LegacyStatusCrosswalkEntry = Readonly<{
  sourcePath: string;
  sourceEnumOrField: string;
  sourceValue: string;
  sourceArtifactType: WeosArtifactType;
  legacyDimension:
    | 'IDENTITY_LIFECYCLE'
    | 'ARTIFACT_LIFECYCLE'
    | 'AUTHORING'
    | 'VALIDATION'
    | 'REVIEW'
    | 'DECISION'
    | 'READINESS'
    | 'PUBLICATION'
    | 'OPERATIONAL'
    | 'MAINTENANCE'
    | 'MIXED'
    | 'UNKNOWN';
  canonicalInterpretations: readonly LegacyStatusCanonicalInterpretation[];
  semanticMappingSafe: boolean;
  recordMigrationSafe: boolean;
  verificationConfidence: WeosVerificationConfidence;
  exhaustiveSourceVocabulary: boolean;
  ambiguity?: string;
  compatibilityProjectionTreatment: string;
  recommendedMigrationTreatment: string;
  requiredLiveDataQueries: readonly string[];
  requiredConformanceTests: readonly string[];
}>;

type EntryInput = Omit<
  LegacyStatusCrosswalkEntry,
  | 'sourcePath'
  | 'sourceEnumOrField'
  | 'verificationConfidence'
  | 'exhaustiveSourceVocabulary'
  | 'recordMigrationSafe'
  | 'compatibilityProjectionTreatment'
  | 'recommendedMigrationTreatment'
  | 'requiredLiveDataQueries'
  | 'requiredConformanceTests'
> &
  Partial<
    Pick<
      LegacyStatusCrosswalkEntry,
      | 'verificationConfidence'
      | 'recordMigrationSafe'
      | 'compatibilityProjectionTreatment'
      | 'recommendedMigrationTreatment'
      | 'requiredLiveDataQueries'
      | 'requiredConformanceTests'
    >
  >;

const T = WEOS_ARTIFACT_TYPES;
const C = WEOS_VERIFICATION_CONFIDENCE;
const O = WEOS_VALIDATION_OUTCOMES;

const SCHEMA = 'doctordle-backend/prisma/schema.prisma';
const BRIEF_SERVICE =
  'doctordle-backend/src/modules/education/diagnosis-editorial-brief.service.ts';
const TEACHING_RULE_SERVICE =
  'doctordle-backend/src/modules/admin/teaching-rules-admin.service.ts';
const WORKSPACE_SERVICE =
  'doctordle-backend/src/modules/admin/diagnosis-editorial-workspace.service.ts';

const defaultQueries = [
  'Verify source artifact identity, exact revision linkage where relevant, actor, authority, rationale, timestamps, dependencies, publication history, and learner-exposure references before canonical record migration.',
];

const defaultTests = [
  'legacy-status-crosswalk.spec.ts confirms semantic interpretation does not create complete canonical records without evidence.',
];

function interpretation(
  input: LegacyStatusCanonicalInterpretation,
): LegacyStatusCanonicalInterpretation {
  return input;
}

function lifecycle(
  targetArtifactType: WeosArtifactType,
  lifecycleFamily: string,
  lifecycleState: string,
  meaning: string,
): LegacyStatusCanonicalInterpretation {
  return interpretation({
    canonicalConcept: 'LIFECYCLE_STATE',
    targetArtifactType,
    lifecycleFamily,
    lifecycleState,
    meaning,
  });
}

function projection(
  canonicalConcept: Exclude<
    LegacyStatusCanonicalInterpretation['canonicalConcept'],
    'LIFECYCLE_STATE'
  >,
  meaning: string,
  targetArtifactType?: WeosArtifactType,
  extra: Partial<LegacyStatusCanonicalInterpretation> = {},
): LegacyStatusCanonicalInterpretation {
  return interpretation({
    canonicalConcept,
    targetArtifactType,
    meaning,
    ...extra,
  });
}

function entry(
  sourcePath: string,
  sourceEnumOrField: string,
  exhaustiveSourceVocabulary: boolean,
  input: EntryInput,
): LegacyStatusCrosswalkEntry {
  return {
    sourcePath,
    sourceEnumOrField,
    exhaustiveSourceVocabulary,
    verificationConfidence: input.verificationConfidence ?? C.CONFIRMED,
    recordMigrationSafe: input.recordMigrationSafe ?? false,
    compatibilityProjectionTreatment:
      input.compatibilityProjectionTreatment ??
      'Treat as a legacy compatibility projection; do not create complete canonical records without evidence.',
    recommendedMigrationTreatment:
      input.recommendedMigrationTreatment ??
      (input.recordMigrationSafe
        ? 'Record migration may proceed only for proven rows satisfying all evidence constraints.'
        : 'Classify record migration as LEGACY or UNKNOWN until live evidence proves canonical record completeness.'),
    requiredLiveDataQueries: input.requiredLiveDataQueries ?? defaultQueries,
    requiredConformanceTests: input.requiredConformanceTests ?? defaultTests,
    ...input,
  };
}

const enumEntry = (sourceEnumOrField: string, input: EntryInput) =>
  entry(SCHEMA, sourceEnumOrField, true, input);

const stringEntry = (
  sourcePath: string,
  sourceEnumOrField: string,
  input: EntryInput,
) => entry(sourcePath, sourceEnumOrField, false, input);

function validation(
  outcome: WeosValidationOutcome,
  meaning: string,
  standing: 'CURRENT' | 'STALE' | 'SUPERSEDED' | 'ERROR' = 'CURRENT',
): LegacyStatusCanonicalInterpretation {
  return projection('VALIDATION_PROJECTION', meaning, T.VALIDATION_RESULT, {
    validationOutcome: outcome,
    validationStanding: standing,
  });
}

const caseStatus: readonly LegacyStatusCrosswalkEntry[] = [
  enumEntry('CaseEditorialStatus', {
    sourceValue: CaseEditorialStatus.DRAFT,
    sourceArtifactType: T.CLINICAL_CASE,
    legacyDimension: 'AUTHORING',
    semanticMappingSafe: true,
    canonicalInterpretations: [
      lifecycle(
        T.CASE_REVISION,
        'case-revision',
        'DRAFT',
        'Authoring projection.',
      ),
    ],
    ambiguity:
      'Does not prove a current Case Revision exists, validation is absent, or prior publication is absent.',
  }),
  enumEntry('CaseEditorialStatus', {
    sourceValue: CaseEditorialStatus.VALIDATING,
    sourceArtifactType: T.CLINICAL_CASE,
    legacyDimension: 'VALIDATION',
    semanticMappingSafe: true,
    canonicalInterpretations: [
      lifecycle(
        T.CASE_REVISION,
        'case-revision',
        'VALIDATION_PENDING',
        'Validation process projection.',
      ),
      projection(
        'VALIDATION_PROJECTION',
        'Validation is underway; no approval or review is implied.',
        T.VALIDATION_RESULT,
      ),
    ],
    ambiguity: 'Exact validation run and target revision must be proven.',
  }),
  enumEntry('CaseEditorialStatus', {
    sourceValue: CaseEditorialStatus.VALIDATED,
    sourceArtifactType: T.CLINICAL_CASE,
    legacyDimension: 'VALIDATION',
    semanticMappingSafe: true,
    canonicalInterpretations: [
      validation(
        O.PASSED,
        'Validation completed/passed projection; not approval, review completion, readiness, or publication permission.',
      ),
    ],
    ambiguity:
      'Exact validation run, validator version, and target revision must be proven.',
  }),
  enumEntry('CaseEditorialStatus', {
    sourceValue: CaseEditorialStatus.REVIEW,
    sourceArtifactType: T.CLINICAL_CASE,
    legacyDimension: 'REVIEW',
    semanticMappingSafe: true,
    canonicalInterpretations: [
      lifecycle(
        T.CASE_REVISION,
        'case-revision',
        'UNDER_REVIEW',
        'Review workflow projection.',
      ),
      projection(
        'REVIEW_PROJECTION',
        'Review workflow exists or is expected.',
        T.EDITORIAL_REVIEW,
      ),
    ],
    ambiguity:
      'Does not prove structured assessments or final decision record.',
  }),
  enumEntry('CaseEditorialStatus', {
    sourceValue: CaseEditorialStatus.NEEDS_EDIT,
    sourceArtifactType: T.CLINICAL_CASE,
    legacyDimension: 'REVIEW',
    semanticMappingSafe: true,
    canonicalInterpretations: [
      lifecycle(
        T.CASE_REVISION,
        'case-revision',
        'REVISION_REQUIRED',
        'Revision-required standing projection.',
      ),
      projection(
        'REVIEW_PROJECTION',
        'May reflect review communication or a governed require-revision decision; provenance decides which.',
        T.EDITORIAL_REVIEW,
      ),
    ],
    ambiguity:
      'Does not prove canonical decision record, rationale, authority, or exact reviewed revision.',
  }),
  enumEntry('CaseEditorialStatus', {
    sourceValue: CaseEditorialStatus.APPROVED,
    sourceArtifactType: T.CLINICAL_CASE,
    legacyDimension: 'DECISION',
    semanticMappingSafe: false,
    canonicalInterpretations: [
      projection(
        'DECISION_PROJECTION',
        'Legacy approval projection; exact approved revision and decision provenance are not proven by status alone.',
        T.EDITORIAL_DECISION,
      ),
    ],
    ambiguity:
      'Unsafe unless exact approved Case Revision, authority, rationale, and decision provenance can be proven.',
  }),
  enumEntry('CaseEditorialStatus', {
    sourceValue: CaseEditorialStatus.READY_TO_PUBLISH,
    sourceArtifactType: T.CLINICAL_CASE,
    legacyDimension: 'READINESS',
    semanticMappingSafe: false,
    canonicalInterpretations: [
      projection(
        'READINESS_PROJECTION',
        'Legacy readiness projection only; not approval, Publication Decision, Publication Assessment, or immutable published version.',
        T.READINESS_ASSESSMENT,
      ),
    ],
    ambiguity:
      'Publication readiness source, exact revision, assessment evidence, and authority are not proven by status.',
  }),
  enumEntry('CaseEditorialStatus', {
    sourceValue: CaseEditorialStatus.PUBLISHED,
    sourceArtifactType: T.CLINICAL_CASE,
    legacyDimension: 'PUBLICATION',
    semanticMappingSafe: false,
    canonicalInterpretations: [
      projection(
        'PUBLICATION_PROJECTION',
        'The current implementation treated the mutable artifact as published; no authorised Publication Decision or immutable exposure is inferred.',
        T.PUBLICATION_HISTORY,
      ),
    ],
    ambiguity:
      'Publication provenance, exact revision, prior valid approval, actor, authority, timestamp, schedule, release, and learner exposure target require live evidence.',
  }),
  enumEntry('CaseEditorialStatus', {
    sourceValue: CaseEditorialStatus.REJECTED,
    sourceArtifactType: T.CLINICAL_CASE,
    legacyDimension: 'DECISION',
    semanticMappingSafe: false,
    canonicalInterpretations: [
      projection(
        'DECISION_PROJECTION',
        'Legacy rejection projection.',
        T.EDITORIAL_DECISION,
      ),
    ],
    ambiguity:
      'Does not prove exact revision, rationale, authority, or decision provenance.',
  }),
];

const educationStatus: readonly LegacyStatusCrosswalkEntry[] = [
  enumEntry('DiagnosisEducationStatus', {
    sourceValue: DiagnosisEducationStatus.DRAFT,
    sourceArtifactType: T.DIAGNOSIS_EDUCATION,
    legacyDimension: 'AUTHORING',
    semanticMappingSafe: true,
    canonicalInterpretations: [
      lifecycle(
        T.DIAGNOSIS_EDUCATION_REVISION,
        'diagnosis-education-revision',
        'DRAFT',
        'Draft education revision projection.',
      ),
    ],
    ambiguity: 'Mutable record status does not prove exact revision history.',
  }),
  enumEntry('DiagnosisEducationStatus', {
    sourceValue: DiagnosisEducationStatus.GENERATED,
    sourceArtifactType: T.DIAGNOSIS_EDUCATION,
    legacyDimension: 'AUTHORING',
    semanticMappingSafe: true,
    canonicalInterpretations: [
      lifecycle(
        T.DIAGNOSIS_EDUCATION_REVISION,
        'diagnosis-education-revision',
        'GENERATED_CANDIDATE',
        'Generated candidate content; not approval.',
      ),
    ],
    ambiguity: 'Generated candidate content is not approval.',
  }),
  enumEntry('DiagnosisEducationStatus', {
    sourceValue: DiagnosisEducationStatus.NEEDS_REVIEW,
    sourceArtifactType: T.DIAGNOSIS_EDUCATION,
    legacyDimension: 'REVIEW',
    semanticMappingSafe: true,
    canonicalInterpretations: [
      lifecycle(
        T.DIAGNOSIS_EDUCATION_REVISION,
        'diagnosis-education-revision',
        'REVIEW_REQUIRED',
        'Education review required projection.',
      ),
    ],
    ambiguity: 'Review need does not prove assessment or decision provenance.',
  }),
  enumEntry('DiagnosisEducationStatus', {
    sourceValue: DiagnosisEducationStatus.NEEDS_EDIT,
    sourceArtifactType: T.DIAGNOSIS_EDUCATION,
    legacyDimension: 'REVIEW',
    semanticMappingSafe: true,
    canonicalInterpretations: [
      lifecycle(
        T.DIAGNOSIS_EDUCATION_REVISION,
        'diagnosis-education-revision',
        'REVISION_REQUIRED',
        'Revision required projection.',
      ),
    ],
    ambiguity: 'Needs-edit projection does not prove a canonical decision.',
  }),
  enumEntry('DiagnosisEducationStatus', {
    sourceValue: DiagnosisEducationStatus.APPROVED,
    sourceArtifactType: T.DIAGNOSIS_EDUCATION,
    legacyDimension: 'DECISION',
    semanticMappingSafe: false,
    canonicalInterpretations: [
      projection(
        'DECISION_PROJECTION',
        'Approval projection; not publication.',
        T.EDITORIAL_DECISION,
      ),
    ],
    ambiguity:
      'Approval must be tied to an exact education revision and authority.',
  }),
  enumEntry('DiagnosisEducationStatus', {
    sourceValue: DiagnosisEducationStatus.PUBLISHED,
    sourceArtifactType: T.DIAGNOSIS_EDUCATION,
    legacyDimension: 'PUBLICATION',
    semanticMappingSafe: false,
    canonicalInterpretations: [
      projection(
        'PUBLICATION_PROJECTION',
        'Mutable education was treated as published; no revision-specific publication decision is inferred.',
        T.PUBLICATION_HISTORY,
      ),
    ],
    ambiguity:
      'Exact published education revision and publication decision provenance must be proven.',
  }),
  enumEntry('DiagnosisEducationStatus', {
    sourceValue: DiagnosisEducationStatus.REJECTED,
    sourceArtifactType: T.DIAGNOSIS_EDUCATION,
    legacyDimension: 'DECISION',
    semanticMappingSafe: false,
    canonicalInterpretations: [
      projection(
        'DECISION_PROJECTION',
        'Rejected education projection; not permanent identity retirement.',
        T.EDITORIAL_DECISION,
      ),
    ],
    ambiguity:
      'Rejected education content does not imply permanent identity retirement.',
  }),
  enumEntry('DiagnosisEducationStatus', {
    sourceValue: DiagnosisEducationStatus.ARCHIVED,
    sourceArtifactType: T.DIAGNOSIS_EDUCATION,
    legacyDimension: 'OPERATIONAL',
    semanticMappingSafe: true,
    canonicalInterpretations: [
      lifecycle(
        T.DIAGNOSIS_EDUCATION,
        'diagnosis-education-identity',
        'ARCHIVED_IDENTITY',
        'Archived identity projection; not publication withdrawal.',
      ),
    ],
    ambiguity: 'Archived is not automatically publication withdrawal.',
  }),
];

const registryStatus = [
  [
    DiagnosisRegistryStatus.DRAFT,
    'DRAFT',
    true,
    'Registry draft identity projection.',
  ],
  [
    DiagnosisRegistryStatus.ACTIVE,
    'ACTIVE',
    true,
    'Registry active identity/lifecycle projection; not editorial completeness, playability, generatability, or publication.',
  ],
  [
    DiagnosisRegistryStatus.HIDDEN,
    'HIDDEN',
    true,
    'Registry hidden operational projection.',
  ],
  [
    DiagnosisRegistryStatus.DEPRECATED,
    'DEPRECATED',
    true,
    'Registry deprecated projection; not deletion and may require replacement-link investigation.',
  ],
] as const;

const registryEntries = registryStatus.map(
  ([sourceValue, state, safe, meaning]) =>
    enumEntry('DiagnosisRegistryStatus', {
      sourceValue,
      sourceArtifactType: T.DIAGNOSIS_REGISTRY,
      legacyDimension: 'IDENTITY_LIFECYCLE',
      semanticMappingSafe: safe,
      canonicalInterpretations: [
        lifecycle(
          T.DIAGNOSIS_REGISTRY,
          'diagnosis-registry-identity',
          state,
          meaning,
        ),
      ],
      ambiguity: meaning,
    }),
);

const onboardingStatus = Object.values(DiagnosisEditorialOnboardingStatus).map(
  (sourceValue) =>
    enumEntry('DiagnosisEditorialOnboardingStatus', {
      sourceValue,
      sourceArtifactType: T.DIAGNOSIS_ONBOARDING_PROGRESS,
      legacyDimension: 'OPERATIONAL',
      semanticMappingSafe: true,
      canonicalInterpretations: [
        lifecycle(
          T.DIAGNOSIS_ONBOARDING_PROGRESS,
          'diagnosis-onboarding-progress',
          sourceValue,
          'Onboarding workflow progress only; not approval, publication readiness, playability, or generatability.',
        ),
      ],
      ambiguity:
        sourceValue === DiagnosisEditorialOnboardingStatus.READY_FOR_REVIEW
          ? 'READY_FOR_REVIEW is local workflow progress, not universal readiness.'
          : sourceValue === DiagnosisEditorialOnboardingStatus.COMPLETE
            ? 'COMPLETE is not publication readiness or approval.'
            : 'Onboarding progress is not operation-specific readiness.',
    }),
);

function simpleLifecycleFamily(
  sourceEnumOrField: string,
  values: readonly string[],
  sourceArtifactType: WeosArtifactType,
  targetArtifactType: WeosArtifactType,
  lifecycleFamily: string,
  legacyDimension: LegacyStatusCrosswalkEntry['legacyDimension'],
  mapState: (value: string) => string | undefined,
  ambiguityFor: (value: string) => string,
) {
  return values.map((sourceValue) =>
    enumEntry(sourceEnumOrField, {
      sourceValue,
      sourceArtifactType,
      legacyDimension,
      semanticMappingSafe: true,
      canonicalInterpretations:
        mapState(sourceValue) === undefined
          ? [
              projection(
                `${legacyDimension === 'OPERATIONAL' ? 'OPERATIONAL' : 'DECISION'}_PROJECTION` as Exclude<
                  LegacyStatusCanonicalInterpretation['canonicalConcept'],
                  'LIFECYCLE_STATE'
                >,
                ambiguityFor(sourceValue),
                targetArtifactType,
              ),
            ]
          : [
              lifecycle(
                targetArtifactType,
                lifecycleFamily,
                mapState(sourceValue) as string,
                ambiguityFor(sourceValue),
              ),
            ],
      ambiguity: ambiguityFor(sourceValue),
    }),
  );
}

const remainingEnums: readonly LegacyStatusCrosswalkEntry[] = [
  ...simpleLifecycleFamily(
    'DiagnosisRegistryCandidateStatus',
    Object.values(DiagnosisRegistryCandidateStatus),
    T.DIAGNOSIS_REGISTRY_CANDIDATE,
    T.DIAGNOSIS_REGISTRY_CANDIDATE,
    'diagnosis-registry-candidate',
    'MIXED',
    (value) => value,
    (value) =>
      `${value} candidate workflow standing requires provenance before record migration.`,
  ),
  ...simpleLifecycleFamily(
    'DiagnosisGraphCandidateStatus',
    Object.values(DiagnosisGraphCandidateStatus),
    T.GRAPH_CANDIDATE,
    T.GRAPH_CANDIDATE,
    'graph-candidate',
    'MIXED',
    (value) => (value === 'APPROVED' ? 'APPROVED_FOR_PROMOTION' : value),
    (value) =>
      value === 'APPROVED'
        ? 'Graph candidate approval is not promotion or merge.'
        : `${value} requires candidate review/provenance checks.`,
  ),
  ...simpleLifecycleFamily(
    'DiagnosisGraphFactStatus',
    Object.values(DiagnosisGraphFactStatus),
    T.GRAPH_FACT,
    T.GRAPH_FACT,
    'graph-fact',
    'OPERATIONAL',
    (value) => value,
    (value) =>
      value === 'ARCHIVED'
        ? 'Archived graph fact is not publication withdrawal.'
        : 'Active graph fact needs provenance before governed migration.',
  ),
  ...simpleLifecycleFamily(
    'DiagnosisTeachingRelationshipStatus',
    Object.values(DiagnosisTeachingRelationshipStatus),
    T.TEACHING_RELATIONSHIP,
    T.TEACHING_RELATIONSHIP,
    'teaching-relationship',
    'MIXED',
    (value) => value,
    (value) =>
      `${value} teaching relationship standing requires relationship decision provenance.`,
  ),
  ...simpleLifecycleFamily(
    'EvidenceNodeStatus',
    Object.values(EvidenceNodeStatus),
    T.EVIDENCE_NODE,
    T.EVIDENCE_NODE,
    'evidence-node',
    'MIXED',
    (value) => value,
    (value) => `${value} evidence-node standing is not evidence assessment.`,
  ),
  ...simpleLifecycleFamily(
    'DiagnosisEvidenceRelationshipStatus',
    Object.values(DiagnosisEvidenceRelationshipStatus),
    T.EVIDENCE_RELATIONSHIP,
    T.EVIDENCE_RELATIONSHIP,
    'evidence-relationship',
    'MIXED',
    (value) => value,
    (value) =>
      `${value} evidence relationship standing requires relationship provenance.`,
  ),
  ...simpleLifecycleFamily(
    'ReasoningPathStatus',
    Object.values(ReasoningPathStatus),
    T.REASONING_PATH,
    T.REASONING_PATH,
    'reasoning-path',
    'MIXED',
    (value) => value,
    (value) =>
      `${value} reasoning path standing is not readiness score or approval.`,
  ),
  ...Object.values(ReasoningDraftValidationStatus).map((sourceValue) =>
    enumEntry('ReasoningDraftValidationStatus', {
      sourceValue,
      sourceArtifactType: T.REASONING_VALIDATION_RESULT,
      legacyDimension: 'VALIDATION',
      semanticMappingSafe: true,
      canonicalInterpretations: [
        validation(
          sourceValue === ReasoningDraftValidationStatus.PASSED
            ? O.PASSED
            : sourceValue === ReasoningDraftValidationStatus.FAILED
              ? O.FAILED
              : O.WARNING,
          `${sourceValue} is validation outcome projection, not editorial approval.`,
        ),
      ],
      ambiguity:
        'Reasoning draft validation must be tied to validator version and target artifact before record migration.',
    }),
  ),
  ...simpleLifecycleFamily(
    'AiDraftReviewStatus',
    Object.values(AiDraftReviewStatus),
    T.AI_DRAFT,
    T.AI_DRAFT,
    'ai-draft',
    'MIXED',
    (value) => (value === 'NEEDS_CHANGES' ? 'CHANGES_REQUESTED' : value),
    (value) =>
      value === 'ACCEPTED'
        ? 'Accepted AI draft is not Controlled Application and does not mutate governed content.'
        : `${value} AI draft status is candidate/review standing only.`,
  ),
  ...simpleLifecycleFamily(
    'DifferentialResolutionStatus',
    Object.values(DifferentialResolutionStatus),
    T.DIFFERENTIAL_MAPPING,
    T.DIFFERENTIAL_MAPPING,
    'differential-mapping',
    'MIXED',
    (value) => value,
    (value) =>
      `${value} differential mapping status does not prove editorial decision authority.`,
  ),
  ...Object.values(ReviewDecision).map((sourceValue) =>
    enumEntry('ReviewDecision', {
      sourceValue,
      sourceArtifactType: T.EDITORIAL_REVIEW,
      legacyDimension: 'DECISION',
      semanticMappingSafe: false,
      canonicalInterpretations: [
        projection(
          'DECISION_PROJECTION',
          `${sourceValue} review decision projection; exact governance record not proven.`,
          T.EDITORIAL_DECISION,
        ),
      ],
      ambiguity:
        sourceValue === ReviewDecision.APPROVED
          ? 'Review approval projection must not be migrated without exact revision, authority, rationale, and decision record evidence.'
          : sourceValue === ReviewDecision.REJECTED
            ? 'Review rejection projection is not permanent identity retirement.'
            : 'Needs-edit review decision projection requires exact reviewed revision and provenance.',
    }),
  ),
  ...Object.values(ValidationOutcome).map((sourceValue) =>
    enumEntry('ValidationOutcome', {
      sourceValue,
      sourceArtifactType: T.VALIDATION_RESULT,
      legacyDimension: 'VALIDATION',
      semanticMappingSafe: true,
      canonicalInterpretations: [
        validation(
          sourceValue === ValidationOutcome.PASSED
            ? O.PASSED
            : sourceValue === ValidationOutcome.FAILED
              ? O.FAILED
              : O.ERROR,
          `${sourceValue} is validation outcome; a newly recorded failed result can still be current.`,
          sourceValue === ValidationOutcome.ERROR ? 'ERROR' : 'CURRENT',
        ),
      ],
      ambiguity:
        sourceValue === ValidationOutcome.FAILED
          ? 'Failed validation is not canonical rejection and is not stale solely because it failed.'
          : 'Validation outcome needs exact revision/run evidence before record migration.',
    }),
  ),
];

const stringStatuses: readonly LegacyStatusCrosswalkEntry[] = [
  ...['DRAFT', 'NEEDS_REVIEW', 'APPROVED', 'ACTIVE', 'REJECTED'].map(
    (sourceValue) =>
      stringEntry(BRIEF_SERVICE, 'DiagnosisEditorialBrief.status', {
        sourceValue,
        sourceArtifactType: T.EDITORIAL_BRIEF,
        legacyDimension: sourceValue === 'DRAFT' ? 'AUTHORING' : 'MIXED',
        semanticMappingSafe: sourceValue !== 'ACTIVE',
        canonicalInterpretations:
          sourceValue === 'ACTIVE'
            ? [
                projection(
                  'OPERATIONAL_PROJECTION',
                  'ACTIVE brief string indicates active/current projection; it is not automatically APPROVED.',
                  T.EDITORIAL_BRIEF,
                ),
              ]
            : [
                lifecycle(
                  T.EDITORIAL_BRIEF,
                  'editorial-brief',
                  sourceValue === 'NEEDS_REVIEW'
                    ? 'REVIEW_REQUIRED'
                    : sourceValue,
                  'Editorial Brief string status projection.',
                ),
              ],
        ambiguity:
          'Brief status is a String field; local service validation does not prove database-wide exhaustive vocabulary.',
      }),
  ),
  ...[
    'CANDIDATE',
    'NEEDS_REVIEW',
    'APPROVED',
    'ACTIVE',
    'REJECTED',
    'DEPRECATED',
  ].map((sourceValue) =>
    stringEntry(TEACHING_RULE_SERVICE, 'DiagnosisTeachingRule.status', {
      sourceValue,
      sourceArtifactType: T.TEACHING_RULE,
      legacyDimension: 'MIXED',
      semanticMappingSafe: sourceValue !== 'APPROVED',
      canonicalInterpretations:
        sourceValue === 'APPROVED'
          ? [
              projection(
                'DECISION_PROJECTION',
                'APPROVED teaching-rule string is approval projection; activation is separate unless repository semantics prove equivalence.',
                T.TEACHING_RULE,
              ),
            ]
          : [
              lifecycle(
                T.TEACHING_RULE,
                'teaching-rule',
                sourceValue === 'NEEDS_REVIEW'
                  ? 'REVIEW_REQUIRED'
                  : sourceValue,
                'Teaching Rule string status projection.',
              ),
            ],
      ambiguity:
        'Teaching Rule status is a String field; unobserved production values must be reported, not normalized.',
    }),
  ),
  ...[
    'PENDING_REVIEW',
    'APPROVED',
    'REJECTED',
    'NEEDS_CHANGES',
    'SUPERSEDED',
    'APPLIED',
    'BLOCKED_CASE_NOT_EDITABLE',
  ].map((sourceValue) =>
    stringEntry(WORKSPACE_SERVICE, 'CaseClueRevisionDraft.status', {
      sourceValue,
      sourceArtifactType: T.CLUE_REVISION_DRAFT,
      legacyDimension:
        sourceValue === 'APPLIED'
          ? 'OPERATIONAL'
          : sourceValue === 'APPROVED' || sourceValue === 'REJECTED'
            ? 'DECISION'
            : 'REVIEW',
      semanticMappingSafe: sourceValue !== 'BLOCKED_CASE_NOT_EDITABLE',
      canonicalInterpretations:
        sourceValue === 'BLOCKED_CASE_NOT_EDITABLE'
          ? [
              projection(
                'OPERATIONAL_PROJECTION',
                'Legacy workflow blocker/application failure condition; no canonical lifecycle state is asserted.',
                T.CONTROLLED_APPLICATION_RECORD,
              ),
            ]
          : [
              lifecycle(
                sourceValue === 'APPLIED'
                  ? T.CONTROLLED_APPLICATION_RECORD
                  : T.CLUE_REVISION_DRAFT,
                sourceValue === 'APPLIED'
                  ? 'controlled-application-record'
                  : 'clue-revision-draft',
                sourceValue === 'APPROVED'
                  ? 'ACCEPTED'
                  : sourceValue === 'NEEDS_CHANGES'
                    ? 'CHANGES_REQUESTED'
                    : sourceValue,
                'Clue draft string status projection.',
              ),
            ],
      ambiguity:
        'Clue draft status is a String field; acceptance, application, and resulting Case Revision must remain separate.',
    }),
  ),
];

export const WEOS_LEGACY_STATUS_CROSSWALK: readonly LegacyStatusCrosswalkEntry[] =
  [
    ...caseStatus,
    ...educationStatus,
    ...registryEntries,
    ...onboardingStatus,
    ...remainingEnums,
    ...stringStatuses,
  ];

export const WEOS_LEGACY_STATUS_CROSSWALK_BY_SOURCE =
  WEOS_LEGACY_STATUS_CROSSWALK.reduce<
    Record<string, LegacyStatusCrosswalkEntry[]>
  >((accumulator, item) => {
    const key = `${item.sourceEnumOrField}.${item.sourceValue}`;
    accumulator[key] = [...(accumulator[key] ?? []), item];
    return accumulator;
  }, {});

export function legacyCrosswalkLifecycleStateExists(
  entryToCheck: LegacyStatusCrosswalkEntry,
) {
  return entryToCheck.canonicalInterpretations.every(
    (item) =>
      item.lifecycleFamily === undefined ||
      item.lifecycleState === undefined ||
      WEOS_CANONICAL_LIFECYCLE_BY_FAMILY[item.lifecycleFamily]?.states.some(
        (state) => state.key === item.lifecycleState,
      ) === true,
  );
}
