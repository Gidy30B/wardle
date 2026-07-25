import type { WeosEditorialAction } from './canonical-actions';

export const WEOS_STANDING_KEYS = {
  VALIDATION: 'VALIDATION',
  CLINICAL_ASSESSMENT: 'CLINICAL_ASSESSMENT',
  EDUCATIONAL_ASSESSMENT: 'EDUCATIONAL_ASSESSMENT',
  REASONING_ASSESSMENT: 'REASONING_ASSESSMENT',
  EVIDENCE_ASSESSMENT: 'EVIDENCE_ASSESSMENT',
  SAFETY_ASSESSMENT: 'SAFETY_ASSESSMENT',
  REVIEW: 'REVIEW',
  APPROVAL: 'APPROVAL',
  PUBLICATION_ASSESSMENT: 'PUBLICATION_ASSESSMENT',
  PUBLICATION_DECISION: 'PUBLICATION_DECISION',
  PUBLICATION_SCHEDULE: 'PUBLICATION_SCHEDULE',
  LEARNER_EXPOSURE: 'LEARNER_EXPOSURE',
  GRAPH_DERIVATIONS: 'GRAPH_DERIVATIONS',
  TEACHING_RELATIONSHIPS: 'TEACHING_RELATIONSHIPS',
  LEARNING_GOAL_COVERAGE: 'LEARNING_GOAL_COVERAGE',
  CLUE_ANALYSES: 'CLUE_ANALYSES',
  DIFFERENTIAL_MAPPINGS: 'DIFFERENTIAL_MAPPINGS',
  READINESS_ASSESSMENT: 'READINESS_ASSESSMENT',
} as const;

export type WeosStandingKey =
  (typeof WEOS_STANDING_KEYS)[keyof typeof WEOS_STANDING_KEYS];

export const WEOS_STANDING_EFFECTS = {
  MARK_STALE: 'MARK_STALE',
  REQUIRE_REASSESSMENT: 'REQUIRE_REASSESSMENT',
  PREVENT_INHERITANCE: 'PREVENT_INHERITANCE',
  SUPERSEDE: 'SUPERSEDE',
  CANCEL: 'CANCEL',
  REVOKE: 'REVOKE',
  END: 'END',
  FLAG_FOR_REVIEW: 'FLAG_FOR_REVIEW',
} as const;

export type WeosStandingEffect =
  (typeof WEOS_STANDING_EFFECTS)[keyof typeof WEOS_STANDING_EFFECTS];

export type WeosStandingEffectScope =
  | 'SOURCE_REVISION'
  | 'RESULTING_REVISION'
  | 'PUBLISHED_VERSION'
  | 'DEPENDENT_ARTIFACTS'
  | 'OPERATIONAL_PROJECTION';

export type WeosInvalidationTriggerKind =
  | 'EDITORIAL_ACTION'
  | 'DEPENDENCY_CHANGE'
  | 'EXTERNAL_EVENT'
  | 'POLICY_CHANGE'
  | 'SYSTEM_CHANGE';

export type InvalidationTrigger =
  | 'MATERIAL_CASE_REVISION_CHANGE'
  | 'MATERIAL_DIAGNOSIS_EDUCATION_REVISION_CHANGE'
  | 'EDITORIAL_BRIEF_LEARNING_GOAL_CHANGE'
  | 'DIAGNOSIS_REMAPPING'
  | 'CLUE_REORDER'
  | 'CLUE_REMOVAL'
  | 'EVIDENCE_SOURCE_WITHDRAWAL'
  | 'TEACHING_RULE_CHANGE'
  | 'REASONING_PATH_CHANGE'
  | 'VALIDATOR_VERSION_CHANGE'
  | 'VALIDATION_RERUN'
  | 'GUIDELINE_CHANGE_TRIGGER'
  | 'AI_DRAFT_APPLICATION_AGAINST_STALE_REVISION'
  | 'PUBLICATION_WITHDRAWAL'
  | 'DIAGNOSIS_DEPRECATION';

export type CanonicalStandingImpact = {
  standing: WeosStandingKey;
  effect: WeosStandingEffect;
  appliesTo: WeosStandingEffectScope;
  reason: string;
};

export type CanonicalInvalidationRule = {
  trigger: InvalidationTrigger;
  label: string;
  triggerKind: WeosInvalidationTriggerKind;
  causedByActions?: readonly WeosEditorialAction[];
  impacts: readonly CanonicalStandingImpact[];
  preservesHistoricalRecords: true;
  currentImplementationSupport:
    | 'IMPLEMENTED'
    | 'PARTIALLY_IMPLEMENTED'
    | 'NOT_IMPLEMENTED'
    | 'UNKNOWN';
  notes?: readonly string[];
};

const S = WEOS_STANDING_KEYS;
const E = WEOS_STANDING_EFFECTS;

function impact(
  standing: WeosStandingKey,
  effect: WeosStandingEffect,
  appliesTo: WeosStandingEffectScope,
  reason: string,
): CanonicalStandingImpact {
  return { standing, effect, appliesTo, reason };
}

export const WEOS_INVALIDATION_RULE_ENTRIES: readonly CanonicalInvalidationRule[] =
  [
    {
      trigger: 'MATERIAL_CASE_REVISION_CHANGE',
      label: 'Material Case Revision Change',
      triggerKind: 'EDITORIAL_ACTION',
      causedByActions: [
        'EDIT_DRAFT',
        'REPLACE_COMPONENT',
        'APPLY_ACCEPTED_DRAFT',
      ],
      preservesHistoricalRecords: true,
      currentImplementationSupport: 'PARTIALLY_IMPLEMENTED',
      notes: [
        'Older revision validation, assessment, approval, publication, and exposure history remain immutable.',
      ],
      impacts: [
        impact(
          S.VALIDATION,
          E.PREVENT_INHERITANCE,
          'RESULTING_REVISION',
          'New case revision must not inherit validation from the old revision.',
        ),
        impact(
          S.CLINICAL_ASSESSMENT,
          E.PREVENT_INHERITANCE,
          'RESULTING_REVISION',
          'New case revision requires fresh clinical assessment when required.',
        ),
        impact(
          S.SAFETY_ASSESSMENT,
          E.PREVENT_INHERITANCE,
          'RESULTING_REVISION',
          'Safety standing is revision-specific.',
        ),
        impact(
          S.REVIEW,
          E.PREVENT_INHERITANCE,
          'RESULTING_REVISION',
          'Review completion is tied to the reviewed revision.',
        ),
        impact(
          S.APPROVAL,
          E.PREVENT_INHERITANCE,
          'RESULTING_REVISION',
          'Approval of the old revision does not approve the new revision.',
        ),
        impact(
          S.PUBLICATION_ASSESSMENT,
          E.REQUIRE_REASSESSMENT,
          'RESULTING_REVISION',
          'Publication suitability must be reassessed for the new revision.',
        ),
        impact(
          S.CLUE_ANALYSES,
          E.MARK_STALE,
          'DEPENDENT_ARTIFACTS',
          'Changed clues can stale clue analyses tied to old clue order/content.',
        ),
        impact(
          S.DIFFERENTIAL_MAPPINGS,
          E.MARK_STALE,
          'DEPENDENT_ARTIFACTS',
          'Changed case content can stale differential mappings.',
        ),
      ],
    },
    {
      trigger: 'MATERIAL_DIAGNOSIS_EDUCATION_REVISION_CHANGE',
      label: 'Material Diagnosis Education Revision Change',
      triggerKind: 'EDITORIAL_ACTION',
      causedByActions: ['EDIT_DRAFT', 'CREATE_REVISION'],
      preservesHistoricalRecords: true,
      currentImplementationSupport: 'PARTIALLY_IMPLEMENTED',
      impacts: [
        impact(
          S.EDUCATIONAL_ASSESSMENT,
          E.PREVENT_INHERITANCE,
          'RESULTING_REVISION',
          'Education assessment is revision-specific.',
        ),
        impact(
          S.EVIDENCE_ASSESSMENT,
          E.REQUIRE_REASSESSMENT,
          'RESULTING_REVISION',
          'Changed education claims may require evidence reassessment.',
        ),
        impact(
          S.REVIEW,
          E.PREVENT_INHERITANCE,
          'RESULTING_REVISION',
          'Review completion belongs to the source revision.',
        ),
        impact(
          S.APPROVAL,
          E.PREVENT_INHERITANCE,
          'RESULTING_REVISION',
          'Approval of prior education revision does not approve the new revision.',
        ),
        impact(
          S.PUBLICATION_ASSESSMENT,
          E.REQUIRE_REASSESSMENT,
          'RESULTING_REVISION',
          'Publication assessment must target the new revision.',
        ),
      ],
    },
    {
      trigger: 'EDITORIAL_BRIEF_LEARNING_GOAL_CHANGE',
      label: 'Editorial Brief Learning Goal Change',
      triggerKind: 'EDITORIAL_ACTION',
      causedByActions: ['EDIT_DRAFT', 'REPLACE_COMPONENT'],
      preservesHistoricalRecords: true,
      currentImplementationSupport: 'NOT_IMPLEMENTED',
      impacts: [
        impact(
          S.LEARNING_GOAL_COVERAGE,
          E.MARK_STALE,
          'DEPENDENT_ARTIFACTS',
          'Coverage assessments tied to changed goals may become stale.',
        ),
        impact(
          S.EDUCATIONAL_ASSESSMENT,
          E.REQUIRE_REASSESSMENT,
          'RESULTING_REVISION',
          'Educational alignment must be reassessed against changed goals.',
        ),
      ],
    },
    {
      trigger: 'DIAGNOSIS_REMAPPING',
      label: 'Diagnosis Remapping',
      triggerKind: 'DEPENDENCY_CHANGE',
      causedByActions: ['REMAP_DIAGNOSIS_REFERENCE', 'MERGE_REGISTRY_ENTRY'],
      preservesHistoricalRecords: true,
      currentImplementationSupport: 'PARTIALLY_IMPLEMENTED',
      impacts: [
        impact(
          S.DIFFERENTIAL_MAPPINGS,
          E.MARK_STALE,
          'DEPENDENT_ARTIFACTS',
          'Mappings that reference the remapped diagnosis need review.',
        ),
        impact(
          S.GRAPH_DERIVATIONS,
          E.FLAG_FOR_REVIEW,
          'DEPENDENT_ARTIFACTS',
          'Graph derivations involving remapped identity need policy review.',
        ),
        impact(
          S.TEACHING_RELATIONSHIPS,
          E.FLAG_FOR_REVIEW,
          'DEPENDENT_ARTIFACTS',
          'Teaching relationships involving remapped identity may need replacement.',
        ),
      ],
    },
    {
      trigger: 'CLUE_REORDER',
      label: 'Clue Reorder',
      triggerKind: 'EDITORIAL_ACTION',
      causedByActions: ['REPLACE_COMPONENT', 'APPLY_ACCEPTED_DRAFT'],
      preservesHistoricalRecords: true,
      currentImplementationSupport: 'PARTIALLY_IMPLEMENTED',
      impacts: [
        impact(
          S.CLUE_ANALYSES,
          E.MARK_STALE,
          'DEPENDENT_ARTIFACTS',
          'Order-dependent analyses and annotations can become stale.',
        ),
        impact(
          S.CLINICAL_ASSESSMENT,
          E.REQUIRE_REASSESSMENT,
          'RESULTING_REVISION',
          'Reordered clue sequence requires reassessment of diagnostic pacing.',
        ),
        impact(
          S.APPROVAL,
          E.PREVENT_INHERITANCE,
          'RESULTING_REVISION',
          'Prior approval cannot be inherited by reordered clue content.',
        ),
      ],
    },
    {
      trigger: 'CLUE_REMOVAL',
      label: 'Clue Removal',
      triggerKind: 'EDITORIAL_ACTION',
      causedByActions: ['REPLACE_COMPONENT', 'APPLY_ACCEPTED_DRAFT'],
      preservesHistoricalRecords: true,
      currentImplementationSupport: 'PARTIALLY_IMPLEMENTED',
      impacts: [
        impact(
          S.CLUE_ANALYSES,
          E.MARK_STALE,
          'DEPENDENT_ARTIFACTS',
          'Removed clue invalidates current clue-order analyses for dependent artifacts.',
        ),
        impact(
          S.VALIDATION,
          E.PREVENT_INHERITANCE,
          'RESULTING_REVISION',
          'Validation cannot be inherited after material clue removal.',
        ),
        impact(
          S.SAFETY_ASSESSMENT,
          E.REQUIRE_REASSESSMENT,
          'RESULTING_REVISION',
          'Safety and escalation coverage may change after clue removal.',
        ),
      ],
    },
    {
      trigger: 'EVIDENCE_SOURCE_WITHDRAWAL',
      label: 'Evidence Source Withdrawal',
      triggerKind: 'EXTERNAL_EVENT',
      causedByActions: ['WITHDRAW_EVIDENCE_SOURCE'],
      preservesHistoricalRecords: true,
      currentImplementationSupport: 'NOT_IMPLEMENTED',
      impacts: [
        impact(
          S.EVIDENCE_ASSESSMENT,
          E.MARK_STALE,
          'DEPENDENT_ARTIFACTS',
          'Assessments relying on withdrawn source become stale.',
        ),
        impact(
          S.PUBLICATION_ASSESSMENT,
          E.REQUIRE_REASSESSMENT,
          'DEPENDENT_ARTIFACTS',
          'Publication readiness may require reassessment.',
        ),
        impact(
          S.PUBLICATION_DECISION,
          E.FLAG_FOR_REVIEW,
          'DEPENDENT_ARTIFACTS',
          'Publication withdrawal requires separate decision.',
        ),
      ],
    },
    {
      trigger: 'TEACHING_RULE_CHANGE',
      label: 'Teaching Rule Change',
      triggerKind: 'EDITORIAL_ACTION',
      causedByActions: ['EDIT_DRAFT', 'DEPRECATE_ARTIFACT'],
      preservesHistoricalRecords: true,
      currentImplementationSupport: 'PARTIALLY_IMPLEMENTED',
      impacts: [
        impact(
          S.REASONING_ASSESSMENT,
          E.MARK_STALE,
          'DEPENDENT_ARTIFACTS',
          'Reasoning and generation guidance may change.',
        ),
        impact(
          S.TEACHING_RELATIONSHIPS,
          E.FLAG_FOR_REVIEW,
          'DEPENDENT_ARTIFACTS',
          'Relationships depending on the rule may need review.',
        ),
      ],
    },
    {
      trigger: 'REASONING_PATH_CHANGE',
      label: 'Reasoning Path Change',
      triggerKind: 'EDITORIAL_ACTION',
      causedByActions: ['EDIT_DRAFT', 'DEPRECATE_ARTIFACT'],
      preservesHistoricalRecords: true,
      currentImplementationSupport: 'PARTIALLY_IMPLEMENTED',
      impacts: [
        impact(
          S.REASONING_ASSESSMENT,
          E.REQUIRE_REASSESSMENT,
          'RESULTING_REVISION',
          'Changed reasoning path needs fresh assessment.',
        ),
        impact(
          S.GRAPH_DERIVATIONS,
          E.FLAG_FOR_REVIEW,
          'DEPENDENT_ARTIFACTS',
          'Derived graph facts may need review.',
        ),
      ],
    },
    {
      trigger: 'VALIDATOR_VERSION_CHANGE',
      label: 'Validator Version Change',
      triggerKind: 'SYSTEM_CHANGE',
      preservesHistoricalRecords: true,
      currentImplementationSupport: 'PARTIALLY_IMPLEMENTED',
      impacts: [
        impact(
          S.VALIDATION,
          E.MARK_STALE,
          'DEPENDENT_ARTIFACTS',
          'Earlier validation results may no longer be current under new validator version.',
        ),
      ],
    },
    {
      trigger: 'VALIDATION_RERUN',
      label: 'Validation Rerun',
      triggerKind: 'EDITORIAL_ACTION',
      causedByActions: ['RERUN_VALIDATION'],
      preservesHistoricalRecords: true,
      currentImplementationSupport: 'IMPLEMENTED',
      impacts: [
        impact(
          S.VALIDATION,
          E.SUPERSEDE,
          'SOURCE_REVISION',
          'A new current validation result supersedes the previous current result without deleting history.',
        ),
      ],
    },
    {
      trigger: 'GUIDELINE_CHANGE_TRIGGER',
      label: 'Guideline Change Trigger',
      triggerKind: 'EXTERNAL_EVENT',
      causedByActions: ['TRIGGER_GUIDELINE_REVIEW'],
      preservesHistoricalRecords: true,
      currentImplementationSupport: 'NOT_IMPLEMENTED',
      impacts: [
        impact(
          S.CLINICAL_ASSESSMENT,
          E.FLAG_FOR_REVIEW,
          'DEPENDENT_ARTIFACTS',
          'Clinical judgement may need guideline review.',
        ),
        impact(
          S.PUBLICATION_ASSESSMENT,
          E.REQUIRE_REASSESSMENT,
          'DEPENDENT_ARTIFACTS',
          'Publication suitability may need reassessment.',
        ),
      ],
    },
    {
      trigger: 'AI_DRAFT_APPLICATION_AGAINST_STALE_REVISION',
      label: 'AI Draft Application Against Stale Revision',
      triggerKind: 'EDITORIAL_ACTION',
      causedByActions: ['RECONCILE_STALE_APPLICATION'],
      preservesHistoricalRecords: true,
      currentImplementationSupport: 'PARTIALLY_IMPLEMENTED',
      impacts: [
        impact(
          S.READINESS_ASSESSMENT,
          E.FLAG_FOR_REVIEW,
          'OPERATIONAL_PROJECTION',
          'Stale base should transition application workflow to reconciliation required, not apply successfully.',
        ),
      ],
    },
    {
      trigger: 'PUBLICATION_WITHDRAWAL',
      label: 'Publication Withdrawal',
      triggerKind: 'EDITORIAL_ACTION',
      causedByActions: ['WITHDRAW_PUBLICATION'],
      preservesHistoricalRecords: true,
      currentImplementationSupport: 'NOT_IMPLEMENTED',
      impacts: [
        impact(
          S.PUBLICATION_SCHEDULE,
          E.CANCEL,
          'OPERATIONAL_PROJECTION',
          'Future schedules for withdrawn version should be cancelled.',
        ),
        impact(
          S.LEARNER_EXPOSURE,
          E.END,
          'OPERATIONAL_PROJECTION',
          'Current learner exposure should end or be revoked by withdrawal action.',
        ),
      ],
    },
    {
      trigger: 'DIAGNOSIS_DEPRECATION',
      label: 'Diagnosis Deprecation',
      triggerKind: 'EDITORIAL_ACTION',
      causedByActions: ['DEPRECATE_REGISTRY_ENTRY'],
      preservesHistoricalRecords: true,
      currentImplementationSupport: 'PARTIALLY_IMPLEMENTED',
      impacts: [
        impact(
          S.GRAPH_DERIVATIONS,
          E.FLAG_FOR_REVIEW,
          'DEPENDENT_ARTIFACTS',
          'Dependent graph facts may require replacement review.',
        ),
        impact(
          S.TEACHING_RELATIONSHIPS,
          E.FLAG_FOR_REVIEW,
          'DEPENDENT_ARTIFACTS',
          'Teaching relationships may need replacement or retirement.',
        ),
        impact(
          S.PUBLICATION_ASSESSMENT,
          E.FLAG_FOR_REVIEW,
          'DEPENDENT_ARTIFACTS',
          'Published artifacts involving deprecated diagnosis may need review.',
        ),
      ],
    },
  ];

export const WEOS_INVALIDATION_RULES = Object.fromEntries(
  WEOS_INVALIDATION_RULE_ENTRIES.map((rule) => [rule.trigger, rule]),
) as Record<InvalidationTrigger, CanonicalInvalidationRule>;
