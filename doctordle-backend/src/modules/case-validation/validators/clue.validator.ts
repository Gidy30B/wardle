import type {
  CaseRevisionSnapshot,
  ValidationIssue,
  ValidatorResult,
} from '../case-validation.types.js';
import { parseClues } from '../validation-helpers.js';

export function runClueValidator(snapshot: CaseRevisionSnapshot): ValidatorResult {
  const issues: ValidationIssue[] = [];
  const clues = parseClues(snapshot.clues);

  if (!clues) {
    issues.push({
      validator: 'clue',
      severity: 'error' as const,
      code: 'CLUES_UNREADABLE',
      message: 'Clues could not be parsed for validation',
      path: 'clues',
    });
    return {
      validator: 'clue',
      passed: false,
      issues,
    };
  }

  if (clues.length < 3) {
    issues.push({
      validator: 'clue',
      severity: 'error' as const,
      code: 'CLUES_TOO_SHORT',
      message: 'Generated cases must include at least three clues',
      path: 'clues',
    });
  }

  const seenOrders = new Set<number>();
  const seenValues = new Set<string>();

  for (const clue of clues) {
    if (seenOrders.has(clue.order)) {
      issues.push({
        validator: 'clue',
        severity: 'error' as const,
        code: 'CLUE_ORDER_DUPLICATE',
        message: `Duplicate clue order detected: ${clue.order}`,
        path: 'clues.order',
      });
    }
    seenOrders.add(clue.order);

    const normalizedValue = clue.value.trim().toLowerCase();
    if (seenValues.has(normalizedValue)) {
      issues.push({
        validator: 'clue',
        severity: 'error' as const,
        code: 'CLUE_VALUE_DUPLICATE',
        message: `Duplicate clue value detected: ${clue.value}`,
        path: 'clues.value',
      });
    }
    seenValues.add(normalizedValue);
  }

  const sortedOrders = [...seenOrders].sort((left, right) => left - right);
  const hasGaps = sortedOrders.some((order, index) => order !== index);
  if (hasGaps) {
    issues.push({
      validator: 'clue',
      severity: 'warning' as const,
      code: 'CLUE_ORDER_NON_SEQUENTIAL',
      message: 'Clue ordering is valid but not sequential from zero',
      path: 'clues.order',
    });
  }

  return {
    validator: 'clue',
    passed: issues.every((issue) => issue.severity !== 'error'),
    issues,
  };
}
