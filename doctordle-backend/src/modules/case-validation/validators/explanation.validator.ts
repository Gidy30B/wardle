import type {
  CaseRevisionSnapshot,
  ValidationIssue,
  ValidatorResult,
} from '../case-validation.types.js';
import { normalizeText, parseExplanation } from '../validation-helpers.js';

export function runExplanationValidator(
  snapshot: CaseRevisionSnapshot,
): ValidatorResult {
  const issues: ValidationIssue[] = [];
  const explanation = parseExplanation(snapshot.explanation);

  if (!explanation) {
    issues.push({
      validator: 'explanation',
      severity: 'error' as const,
      code: 'EXPLANATION_UNREADABLE',
      message: 'Explanation could not be parsed for validation',
      path: 'explanation',
    });
    return {
      validator: 'explanation',
      passed: false,
      issues,
    };
  }

  if (explanation.reasoning.length === 0) {
    issues.push({
      validator: 'explanation',
      severity: 'error' as const,
      code: 'EXPLANATION_REASONING_EMPTY',
      message: 'Explanation reasoning must include at least one item',
      path: 'explanation.reasoning',
    });
  }

  if (explanation.keyFindings.length === 0) {
    issues.push({
      validator: 'explanation',
      severity: 'error' as const,
      code: 'EXPLANATION_FINDINGS_EMPTY',
      message: 'Explanation key findings must include at least one item',
      path: 'explanation.keyFindings',
    });
  }

  if (normalizeText(explanation.diagnosis) !== normalizeText(snapshot.title)) {
    issues.push({
      validator: 'explanation',
      severity: 'warning' as const,
      code: 'EXPLANATION_DIAGNOSIS_MISMATCH',
      message:
        'Explanation diagnosis does not exactly match the persisted case title',
      path: 'explanation.diagnosis',
    });
  }

  return {
    validator: 'explanation',
    passed: issues.every((issue) => issue.severity !== 'error'),
    issues,
  };
}
