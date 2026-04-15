import type {
  CaseRevisionSnapshot,
  ValidationIssue,
  ValidatorResult,
} from '../case-validation.types.js';
import {
  isNonEmptyString,
  parseClues,
  parseExplanation,
} from '../validation-helpers.js';

export function runStructureValidator(
  snapshot: CaseRevisionSnapshot,
): ValidatorResult {
  const issues: ValidationIssue[] = [];

  if (!isNonEmptyString(snapshot.caseId)) {
    issues.push({
      validator: 'structure',
      severity: 'error' as const,
      code: 'CASE_ID_MISSING',
      message: 'Revision snapshot is missing caseId',
      path: 'caseId',
    });
  }

  if (!isNonEmptyString(snapshot.title)) {
    issues.push({
      validator: 'structure',
      severity: 'error' as const,
      code: 'TITLE_MISSING',
      message: 'Case title is required',
      path: 'title',
    });
  }

  if (!isNonEmptyString(snapshot.history)) {
    issues.push({
      validator: 'structure',
      severity: 'error' as const,
      code: 'HISTORY_MISSING',
      message: 'Case history is required',
      path: 'history',
    });
  }

  if (!Array.isArray(snapshot.symptoms)) {
    issues.push({
      validator: 'structure',
      severity: 'error' as const,
      code: 'SYMPTOMS_NOT_ARRAY',
      message: 'Symptoms must be a string array',
      path: 'symptoms',
    });
  }

  if (parseClues(snapshot.clues) === null) {
    issues.push({
      validator: 'structure',
      severity: 'error' as const,
      code: 'CLUES_INVALID_SHAPE',
      message: 'Clues must be a valid clinical clue array',
      path: 'clues',
    });
  }

  if (parseExplanation(snapshot.explanation) === null) {
    issues.push({
      validator: 'structure',
      severity: 'error' as const,
      code: 'EXPLANATION_INVALID_SHAPE',
      message:
        'Explanation must include diagnosis, summary, reasoning, and keyFindings',
      path: 'explanation',
    });
  }

  if (!Array.isArray(snapshot.differentials)) {
    issues.push({
      validator: 'structure',
      severity: 'error' as const,
      code: 'DIFFERENTIALS_NOT_ARRAY',
      message: 'Differentials must be a string array',
      path: 'differentials',
    });
  }

  if (!isNonEmptyString(snapshot.diagnosisId)) {
    issues.push({
      validator: 'structure',
      severity: 'error' as const,
      code: 'DIAGNOSIS_ID_MISSING',
      message: 'Diagnosis id is required for revision snapshots',
      path: 'diagnosisId',
    });
  }

  return {
    validator: 'structure',
    passed: issues.every((issue) => issue.severity !== 'error'),
    issues,
  };
}
