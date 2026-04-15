import type {
  CaseRevisionSnapshot,
  ValidationIssue,
  ValidatorResult,
} from '../case-validation.types.js';
import { parseClues } from '../validation-helpers.js';

export function runDifficultyValidator(
  snapshot: CaseRevisionSnapshot,
): ValidatorResult {
  const issues: ValidationIssue[] = [];
  const difficulty = snapshot.difficulty.trim().toLowerCase();
  const clues = parseClues(snapshot.clues) ?? [];

  if (
    difficulty !== 'easy' &&
    difficulty !== 'medium' &&
    difficulty !== 'hard'
  ) {
    issues.push({
      validator: 'difficulty',
      severity: 'error' as const,
      code: 'DIFFICULTY_UNSUPPORTED',
      message: `Difficulty must be easy, medium, or hard. Received: ${snapshot.difficulty}`,
      path: 'difficulty',
    });
    return {
      validator: 'difficulty',
      passed: false,
      issues,
    };
  }

  if (difficulty === 'hard' && clues.length > 0 && clues.length < 4) {
    issues.push({
      validator: 'difficulty',
      severity: 'warning' as const,
      code: 'DIFFICULTY_HARD_TOO_FEW_CLUES',
      message:
        'Hard cases usually need at least four clues to feel progressive',
      path: 'difficulty',
    });
  }

  if (difficulty === 'easy' && clues.length > 7) {
    issues.push({
      validator: 'difficulty',
      severity: 'warning' as const,
      code: 'DIFFICULTY_EASY_TOO_MANY_CLUES',
      message: 'Easy cases may be carrying more clues than expected',
      path: 'difficulty',
    });
  }

  return {
    validator: 'difficulty',
    passed: issues.every((issue) => issue.severity !== 'error'),
    issues,
  };
}
