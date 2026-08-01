import { findGovernanceDecisionExtensionPolicy } from './governance-decision.registry';
import type {
  GovernanceDecisionEnvelope,
  GovernanceDecisionExtensionPolicy,
  GovernanceDecisionExtensionRegistry,
  GovernanceDecisionValidationError,
  GovernanceDecisionValidationResult,
  GovernanceTargetReference,
} from './governance-decision.types';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const nonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const error = (
  code: string,
  path: string,
  message: string,
): GovernanceDecisionValidationError => ({ code, path, message });

const targetKey = (target: GovernanceTargetReference): string =>
  [
    target.artifactType,
    target.artifactId,
    target.artifactRevisionId ?? '',
    target.targetScope,
  ].join('|');

const hasSameTarget = (
  left: GovernanceTargetReference,
  right: GovernanceTargetReference,
): boolean => targetKey(left) === targetKey(right);

const validateTarget = (
  target: GovernanceTargetReference,
  index: number,
  policy: GovernanceDecisionExtensionPolicy,
): readonly GovernanceDecisionValidationError[] => {
  const errors: GovernanceDecisionValidationError[] = [];
  const path = `$.targetReferences[${index}]`;
  for (const key of ['artifactType', 'artifactId', 'targetScope'] as const) {
    if (!nonEmptyString(target[key])) {
      errors.push(
        error(
          'REQUIRED_FIELD_MISSING',
          `${path}.${key}`,
          `${key} is required.`,
        ),
      );
    }
  }
  if (
    policy.requiresExactRevision &&
    !nonEmptyString(target.artifactRevisionId)
  ) {
    errors.push(
      error(
        'EXACT_REVISION_REQUIRED',
        `${path}.artifactRevisionId`,
        'The registered extension policy requires exact revision targets.',
      ),
    );
  }
  return errors;
};

export const validateGovernanceDecisionEnvelope = (
  decision: GovernanceDecisionEnvelope,
  registry: GovernanceDecisionExtensionRegistry,
): GovernanceDecisionValidationResult => {
  const errors: GovernanceDecisionValidationError[] = [];
  const policy = findGovernanceDecisionExtensionPolicy(
    registry,
    decision.extensionType,
    decision.extensionSchemaVersion,
  );

  if (!policy) {
    return {
      valid: false,
      errors: [
        error(
          'UNREGISTERED_EXTENSION',
          '$.extensionType',
          'Extension policy is not registered.',
        ),
      ],
    };
  }

  if (policy.approvalState !== 'APPROVED') {
    errors.push(
      error(
        'EXTENSION_NOT_APPROVED',
        '$.extensionType',
        'Extension policy is not approved.',
      ),
    );
  }
  if (!nonEmptyString(decision.decisionId)) {
    errors.push(
      error(
        'REQUIRED_FIELD_MISSING',
        '$.decisionId',
        'decisionId is required.',
      ),
    );
  }
  if (!nonEmptyString(decision.envelopeSchemaVersion)) {
    errors.push(
      error(
        'REQUIRED_FIELD_MISSING',
        '$.envelopeSchemaVersion',
        'envelopeSchemaVersion is required.',
      ),
    );
  }
  if (!policy.allowedDecisionTypes.includes(decision.decisionType)) {
    errors.push(
      error(
        'INVALID_DECISION_TYPE',
        '$.decisionType',
        'Decision type is not allowed by the extension policy.',
      ),
    );
  }
  if (!policy.allowedOutcomes.includes(decision.outcome)) {
    errors.push(
      error(
        'INVALID_OUTCOME',
        '$.outcome',
        'Outcome is not allowed by the extension policy.',
      ),
    );
  }
  if (!policy.allowedEffectiveActions.includes(decision.effectiveAction)) {
    errors.push(
      error(
        'INVALID_EFFECTIVE_ACTION',
        '$.effectiveAction',
        'Effective action is not allowed by the extension policy.',
      ),
    );
  }
  if (
    !Array.isArray(decision.targetReferences) ||
    decision.targetReferences.length === 0
  ) {
    errors.push(
      error(
        'REQUIRED_FIELD_MISSING',
        '$.targetReferences',
        'At least one target is required.',
      ),
    );
  } else {
    const seen = new Set<string>();
    decision.targetReferences.forEach((target, index) => {
      errors.push(...validateTarget(target, index, policy));
      const key = targetKey(target);
      if (seen.has(key)) {
        errors.push(
          error(
            'DUPLICATE_TARGET',
            `$.targetReferences[${index}]`,
            'Duplicate target reference.',
          ),
        );
      }
      seen.add(key);
    });
    if (
      !decision.targetReferences.some((target) =>
        hasSameTarget(target, decision.primaryTarget),
      )
    ) {
      errors.push(
        error(
          'PRIMARY_TARGET_NOT_LISTED',
          '$.primaryTarget',
          'Primary target must appear in targetReferences.',
        ),
      );
    }
  }
  if (
    !nonEmptyString(decision.authority.authorityAssignmentId) ||
    !nonEmptyString(decision.authority.authorityEvidenceReference) ||
    !nonEmptyString(decision.authority.authorityScopeSnapshot) ||
    !nonEmptyString(decision.authority.authorityResolvedAt)
  ) {
    errors.push(
      error(
        'AUTHORITY_EVIDENCE_REQUIRED',
        '$.authority',
        'Authority evidence and resolution timestamp are required.',
      ),
    );
  }
  if (
    !nonEmptyString(decision.authority.humanAuthorityActorId) &&
    !policy.permitsNonHumanAuthority
  ) {
    errors.push(
      error(
        'HUMAN_AUTHORITY_REQUIRED',
        '$.authority.humanAuthorityActorId',
        'Automation or system execution does not waive human authority.',
      ),
    );
  }
  if (
    !isObject(decision.extensionPayload) ||
    Object.keys(decision.extensionPayload).length === 0
  ) {
    errors.push(
      error(
        'UNVALIDATED_GENERIC_PAYLOAD',
        '$.extensionPayload',
        'A validated extension payload is required.',
      ),
    );
  } else {
    for (const payloadError of policy.validateExtensionPayload(
      decision.extensionPayload,
    )) {
      errors.push(
        error('INVALID_EXTENSION_PAYLOAD', '$.extensionPayload', payloadError),
      );
    }
  }
  for (const supersession of decision.supersessionReferences ?? []) {
    if (supersession.decisionId === decision.decisionId) {
      errors.push(
        error(
          'SELF_SUPERSESSION',
          '$.supersessionReferences',
          'A decision cannot supersede itself.',
        ),
      );
    }
    if (
      !policy.allowedSupersessionScopes.includes(supersession.supersessionScope)
    ) {
      errors.push(
        error(
          'INVALID_SUPERSESSION_SCOPE',
          '$.supersessionReferences',
          'Supersession scope is not allowed by the extension policy.',
        ),
      );
    }
  }

  return { valid: errors.length === 0, errors };
};

export const validateGovernanceDecisionSet = (
  decisions: readonly GovernanceDecisionEnvelope[],
  registry: GovernanceDecisionExtensionRegistry,
): GovernanceDecisionValidationResult => {
  const errors: GovernanceDecisionValidationError[] = [];
  const seen = new Set<string>();

  decisions.forEach((decision, index) => {
    const result = validateGovernanceDecisionEnvelope(decision, registry);
    errors.push(
      ...result.errors.map((entry) => ({
        ...entry,
        path: `$[${index}]${entry.path.slice(1)}`,
      })),
    );
    if (seen.has(decision.decisionId)) {
      errors.push(
        error(
          'DUPLICATE_DECISION_ID',
          `$[${index}].decisionId`,
          'Duplicate decisionId.',
        ),
      );
    }
    seen.add(decision.decisionId);
  });

  const ids = new Set(decisions.map((decision) => decision.decisionId));
  decisions.forEach((decision, index) => {
    for (const supersession of decision.supersessionReferences ?? []) {
      if (!ids.has(supersession.decisionId)) {
        errors.push(
          error(
            'MISSING_SUPERSEDED_DECISION',
            `$[${index}].supersessionReferences`,
            `Superseded decision ${supersession.decisionId} is missing from the set.`,
          ),
        );
      }
    }
  });

  return { valid: errors.length === 0, errors };
};
