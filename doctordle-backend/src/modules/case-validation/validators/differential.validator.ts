import type {
  CaseRevisionSnapshot,
  ValidationIssue,
  ValidatorResult,
} from '../case-validation.types.js';
import { normalizeText } from '../validation-helpers.js';

export function runDifferentialValidator(
  snapshot: CaseRevisionSnapshot,
): ValidatorResult {
  const issues: ValidationIssue[] = [];

  if (!Array.isArray(snapshot.differentials)) {
    issues.push({
      validator: 'differential',
      severity: 'error' as const,
      code: 'DIFFERENTIALS_UNREADABLE',
      message: 'Differentials must be present as a string array',
      path: 'differentials',
    });
    return {
      validator: 'differential',
      passed: false,
      issues,
    };
  }

  if (snapshot.differentials.length === 0) {
    issues.push({
      validator: 'differential',
      severity: 'error' as const,
      code: 'DIFFERENTIALS_EMPTY',
      message:
        'Generated cases should include at least one differential diagnosis',
      path: 'differentials',
    });
  }

  const normalizedTitle = normalizeText(snapshot.title);
  const seenDifferentials = new Set<string>();

  for (const value of snapshot.differentials) {
    const normalized = normalizeText(value);
    if (!normalized) {
      issues.push({
        validator: 'differential',
        severity: 'error' as const,
        code: 'DIFFERENTIAL_EMPTY_VALUE',
        message: 'Differential entries must be non-empty strings',
        path: 'differentials',
      });
      continue;
    }

    if (seenDifferentials.has(normalized)) {
      issues.push({
        validator: 'differential',
        severity: 'error' as const,
        code: 'DIFFERENTIAL_DUPLICATE',
        message: `Duplicate differential detected: ${value}`,
        path: 'differentials',
      });
    }
    seenDifferentials.add(normalized);

    if (normalized === normalizedTitle) {
      issues.push({
        validator: 'differential',
        severity: 'warning' as const,
        code: 'DIFFERENTIAL_MATCHES_FINAL_ANSWER',
        message: 'Differentials should usually exclude the final answer itself',
        path: 'differentials',
      });
    }
  }

  return {
    validator: 'differential',
    passed: issues.every((issue) => issue.severity !== 'error'),
    issues,
  };
}
