import {
  generateDiagnosisTeachingRuleCandidates,
  reviewDiagnosisTeachingRule,
  seedLegacyDiagnosisTeachingRules,
} from '../../../../api/admin.ts';
import type {
  TeachingRuleActionPayload,
  WorkspaceActionExecutor,
} from './workspaceActionTypes.ts';

export const runTeachingRuleAction: WorkspaceActionExecutor = (
  actionId,
  payload,
  context,
) => {
  const actionPayload = payload as TeachingRuleActionPayload;

  switch (actionId) {
    case 'teachingRule.approve':
      return reviewDiagnosisTeachingRule(
        context.client,
        requireRuleId(actionPayload),
        'approve',
      );
    case 'teachingRule.reject':
      return reviewDiagnosisTeachingRule(
        context.client,
        requireRuleId(actionPayload),
        'reject',
      );
    case 'teachingRule.requestChanges':
      return reviewDiagnosisTeachingRule(
        context.client,
        requireRuleId(actionPayload),
        'needs_review',
      );
    case 'teachingRule.generateCandidates':
      return generateDiagnosisTeachingRuleCandidates(
        context.client,
        context.diagnosisRegistryId,
      );
    case 'teachingRule.seedLegacy':
      return seedLegacyDiagnosisTeachingRules(
        context.client,
        context.diagnosisRegistryId,
      );
    default:
      throw new Error(`Unsupported teaching rule action: ${actionId}`);
  }
};

function requireRuleId(payload: TeachingRuleActionPayload): string {
  if (!payload.ruleId) {
    throw new Error('Teaching rule action requires ruleId.');
  }
  return payload.ruleId;
}
