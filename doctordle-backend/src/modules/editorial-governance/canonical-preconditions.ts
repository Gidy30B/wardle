export const WEOS_PRECONDITIONS = {
  ARTIFACT_EXISTS: 'ARTIFACT_EXISTS',
  ARTIFACT_NOT_RETIRED: 'ARTIFACT_NOT_RETIRED',
  ARTIFACT_IDENTITY_RESOLVED: 'ARTIFACT_IDENTITY_RESOLVED',
  CURRENT_REVISION_IDENTIFIED: 'CURRENT_REVISION_IDENTIFIED',
  TARGET_REVISION_EXISTS: 'TARGET_REVISION_EXISTS',
  TARGET_REVISION_IS_CURRENT: 'TARGET_REVISION_IS_CURRENT',
  TARGET_REVISION_NOT_SUPERSEDED: 'TARGET_REVISION_NOT_SUPERSEDED',
  MATERIAL_CHANGE_DETERMINED: 'MATERIAL_CHANGE_DETERMINED',
  VALIDATION_COMPLETE: 'VALIDATION_COMPLETE',
  VALIDATION_CURRENT: 'VALIDATION_CURRENT',
  NO_BLOCKING_VALIDATION_FINDINGS: 'NO_BLOCKING_VALIDATION_FINDINGS',
  REQUIRED_ASSESSMENTS_COMPLETE: 'REQUIRED_ASSESSMENTS_COMPLETE',
  REQUIRED_ASSESSMENTS_CURRENT: 'REQUIRED_ASSESSMENTS_CURRENT',
  REVIEW_ASSIGNED: 'REVIEW_ASSIGNED',
  REVIEW_COMPLETE: 'REVIEW_COMPLETE',
  APPROVED_REVISION_EXISTS: 'APPROVED_REVISION_EXISTS',
  APPROVAL_CURRENT: 'APPROVAL_CURRENT',
  PUBLICATION_ASSESSMENT_COMPLETE: 'PUBLICATION_ASSESSMENT_COMPLETE',
  PUBLICATION_ASSESSMENT_CURRENT: 'PUBLICATION_ASSESSMENT_CURRENT',
  PUBLICATION_ASSESSMENT_POSITIVE: 'PUBLICATION_ASSESSMENT_POSITIVE',
  PUBLICATION_DECISION_EXISTS: 'PUBLICATION_DECISION_EXISTS',
  PUBLICATION_DECISION_CURRENT: 'PUBLICATION_DECISION_CURRENT',
  PUBLISHED_VERSION_EXISTS: 'PUBLISHED_VERSION_EXISTS',
  IMMUTABLE_EXPOSURE_TARGET_EXISTS: 'IMMUTABLE_EXPOSURE_TARGET_EXISTS',
  INTERIM_FROZEN_SNAPSHOT_EXISTS: 'INTERIM_FROZEN_SNAPSHOT_EXISTS',
  AI_DRAFT_ACCEPTED: 'AI_DRAFT_ACCEPTED',
  AI_DRAFT_NOT_SUPERSEDED: 'AI_DRAFT_NOT_SUPERSEDED',
  APPLICATION_BASE_REVISION_CURRENT: 'APPLICATION_BASE_REVISION_CURRENT',
  RESULTING_REVISION_IDENTIFIED: 'RESULTING_REVISION_IDENTIFIED',
  DIAGNOSIS_IDENTITY_ACTIVE: 'DIAGNOSIS_IDENTITY_ACTIVE',
  PLAYABILITY_READINESS_SATISFIED: 'PLAYABILITY_READINESS_SATISFIED',
  GENERATION_READINESS_SATISFIED: 'GENERATION_READINESS_SATISFIED',
  NO_ACTIVE_CONFLICT_OF_INTEREST: 'NO_ACTIVE_CONFLICT_OF_INTEREST',
  ACTOR_HAS_REQUIRED_AUTHORITY: 'ACTOR_HAS_REQUIRED_AUTHORITY',
  MAINTENANCE_OBLIGATIONS_SATISFIED: 'MAINTENANCE_OBLIGATIONS_SATISFIED',
  VALID_PUBLICATION_SCHEDULE_EXISTS: 'VALID_PUBLICATION_SCHEDULE_EXISTS',
  NO_ACTIVE_LEARNER_EXPOSURE: 'NO_ACTIVE_LEARNER_EXPOSURE',
  CANDIDATE_NOT_MERGED: 'CANDIDATE_NOT_MERGED',
} as const;

export type WeosPreconditionKey =
  (typeof WEOS_PRECONDITIONS)[keyof typeof WEOS_PRECONDITIONS];

export type CanonicalPreconditionCategory =
  | 'IDENTITY'
  | 'REVISION'
  | 'VALIDATION'
  | 'ASSESSMENT'
  | 'REVIEW'
  | 'APPROVAL'
  | 'AI_APPLICATION'
  | 'PUBLICATION'
  | 'OPERATIONAL'
  | 'AUTHORITY'
  | 'MAINTENANCE';

export type CanonicalPreconditionDefinition = {
  key: WeosPreconditionKey;
  label: string;
  meaning: string;
  category: CanonicalPreconditionCategory;
  conceptualOnly: true;
  requiredEvidence: readonly string[];
};

const P = WEOS_PRECONDITIONS;

function precondition(
  key: WeosPreconditionKey,
  category: CanonicalPreconditionCategory,
  meaning: string,
  requiredEvidence: readonly string[],
): CanonicalPreconditionDefinition {
  return {
    key,
    label: key
      .toLowerCase()
      .split('_')
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join(' '),
    meaning,
    category,
    conceptualOnly: true,
    requiredEvidence,
  };
}

export const WEOS_PRECONDITION_CATALOGUE: readonly CanonicalPreconditionDefinition[] =
  [
    precondition(
      P.ARTIFACT_EXISTS,
      'IDENTITY',
      'The target artifact identity exists.',
      ['artifact id lookup'],
    ),
    precondition(
      P.ARTIFACT_NOT_RETIRED,
      'IDENTITY',
      'The artifact identity is not retired for the requested operation.',
      ['artifact lifecycle standing'],
    ),
    precondition(
      P.ARTIFACT_IDENTITY_RESOLVED,
      'IDENTITY',
      'The target identity has been resolved unambiguously.',
      ['registry identity or canonical artifact id'],
    ),
    precondition(
      P.CURRENT_REVISION_IDENTIFIED,
      'REVISION',
      'The current revision for a revisioned artifact is known.',
      ['current revision reference'],
    ),
    precondition(
      P.TARGET_REVISION_EXISTS,
      'REVISION',
      'The exact target revision exists.',
      ['revision id lookup'],
    ),
    precondition(
      P.TARGET_REVISION_IS_CURRENT,
      'REVISION',
      'The target revision is still the current editable or governable revision.',
      ['current revision comparison'],
    ),
    precondition(
      P.TARGET_REVISION_NOT_SUPERSEDED,
      'REVISION',
      'The target revision has not been superseded.',
      ['revision lifecycle standing'],
    ),
    precondition(
      P.MATERIAL_CHANGE_DETERMINED,
      'REVISION',
      'Materiality of the proposed edit has been determined.',
      ['material change determination record'],
    ),
    precondition(
      P.VALIDATION_COMPLETE,
      'VALIDATION',
      'Required validation has completed for the target revision.',
      ['validation result reference'],
    ),
    precondition(
      P.VALIDATION_CURRENT,
      'VALIDATION',
      'Validation result is current for the target revision and validator version.',
      ['validation result revision and validator version'],
    ),
    precondition(
      P.NO_BLOCKING_VALIDATION_FINDINGS,
      'VALIDATION',
      'Validation findings do not block the requested operation.',
      ['validation finding blocking effects'],
    ),
    precondition(
      P.REQUIRED_ASSESSMENTS_COMPLETE,
      'ASSESSMENT',
      'Required assessments have been completed for the target revision.',
      ['assessment records by required dimension'],
    ),
    precondition(
      P.REQUIRED_ASSESSMENTS_CURRENT,
      'ASSESSMENT',
      'Required assessments are current for the target revision.',
      ['assessment revision references and staleness state'],
    ),
    precondition(
      P.REVIEW_ASSIGNED,
      'REVIEW',
      'A reviewer has been assigned for the review workflow.',
      ['review assignment record'],
    ),
    precondition(
      P.REVIEW_COMPLETE,
      'REVIEW',
      'The review workflow has completed.',
      ['review record completion timestamp or outcome'],
    ),
    precondition(
      P.APPROVED_REVISION_EXISTS,
      'APPROVAL',
      'An approval decision exists for the exact revision.',
      ['approval decision revision reference'],
    ),
    precondition(
      P.APPROVAL_CURRENT,
      'APPROVAL',
      'The approval still applies to the target revision and has not been superseded.',
      ['approval decision and revision standing'],
    ),
    precondition(
      P.PUBLICATION_ASSESSMENT_COMPLETE,
      'ASSESSMENT',
      'Publication assessment has completed for the approved revision.',
      ['publication assessment record'],
    ),
    precondition(
      P.PUBLICATION_ASSESSMENT_CURRENT,
      'ASSESSMENT',
      'Publication assessment remains current for the approved revision.',
      ['publication assessment revision and staleness state'],
    ),
    precondition(
      P.PUBLICATION_ASSESSMENT_POSITIVE,
      'ASSESSMENT',
      'Publication assessment supports publication.',
      ['publication assessment outcome'],
    ),
    precondition(
      P.PUBLICATION_DECISION_EXISTS,
      'PUBLICATION',
      'A publication decision exists.',
      ['publication decision record'],
    ),
    precondition(
      P.PUBLICATION_DECISION_CURRENT,
      'PUBLICATION',
      'Publication decision remains current for the exact approved revision.',
      ['publication decision revision and supersession state'],
    ),
    precondition(
      P.PUBLISHED_VERSION_EXISTS,
      'PUBLICATION',
      'An immutable published artifact version exists.',
      ['published version record'],
    ),
    precondition(
      P.IMMUTABLE_EXPOSURE_TARGET_EXISTS,
      'PUBLICATION',
      'Learner exposure can target immutable content.',
      ['published version or immutable snapshot reference'],
    ),
    precondition(
      P.INTERIM_FROZEN_SNAPSHOT_EXISTS,
      'PUBLICATION',
      'An interim frozen snapshot exists when immutable published version support is absent.',
      ['snapshot id and content hash'],
    ),
    precondition(
      P.AI_DRAFT_ACCEPTED,
      'AI_APPLICATION',
      'The AI draft or clue proposal has been accepted.',
      ['draft acceptance decision'],
    ),
    precondition(
      P.AI_DRAFT_NOT_SUPERSEDED,
      'AI_APPLICATION',
      'The accepted draft has not been superseded.',
      ['draft standing'],
    ),
    precondition(
      P.APPLICATION_BASE_REVISION_CURRENT,
      'AI_APPLICATION',
      'The application base revision is still current.',
      ['base revision comparison'],
    ),
    precondition(
      P.RESULTING_REVISION_IDENTIFIED,
      'AI_APPLICATION',
      'A resulting revision is identified for a successful application.',
      ['resulting revision reference'],
    ),
    precondition(
      P.DIAGNOSIS_IDENTITY_ACTIVE,
      'IDENTITY',
      'The diagnosis identity is active for this operation.',
      ['diagnosis registry lifecycle standing'],
    ),
    precondition(
      P.PLAYABILITY_READINESS_SATISFIED,
      'OPERATIONAL',
      'Playability readiness is satisfied independently from playability permission.',
      ['playability readiness result'],
    ),
    precondition(
      P.GENERATION_READINESS_SATISFIED,
      'OPERATIONAL',
      'Generation readiness is satisfied independently from generatability permission.',
      ['generation readiness result'],
    ),
    precondition(
      P.NO_ACTIVE_CONFLICT_OF_INTEREST,
      'AUTHORITY',
      'No active conflict of interest blocks the action.',
      ['conflict declaration search'],
    ),
    precondition(
      P.ACTOR_HAS_REQUIRED_AUTHORITY,
      'AUTHORITY',
      'The actor has the future scoped authority required for the action.',
      ['authority assignment and scope'],
    ),
    precondition(
      P.MAINTENANCE_OBLIGATIONS_SATISFIED,
      'MAINTENANCE',
      'Maintenance obligations are satisfied for the operation.',
      ['maintenance obligation records'],
    ),
    precondition(
      P.VALID_PUBLICATION_SCHEDULE_EXISTS,
      'PUBLICATION',
      'A valid publication schedule exists for release.',
      ['publication schedule record'],
    ),
    precondition(
      P.NO_ACTIVE_LEARNER_EXPOSURE,
      'OPERATIONAL',
      'No active learner exposure blocks the requested operation.',
      ['learner exposure records'],
    ),
    precondition(
      P.CANDIDATE_NOT_MERGED,
      'IDENTITY',
      'The candidate has not already been merged.',
      ['candidate standing'],
    ),
  ];

export const WEOS_PRECONDITION_BY_KEY = Object.fromEntries(
  WEOS_PRECONDITION_CATALOGUE.map((item) => [item.key, item]),
) as Record<WeosPreconditionKey, CanonicalPreconditionDefinition>;
