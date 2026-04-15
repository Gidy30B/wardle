import type { Prisma } from '@prisma/client';
import type {
  ValidationClinicalClue,
  ValidationExplanation,
} from './case-validation.types.js';

const allowedClueTypes = new Set<ValidationClinicalClue['type']>([
  'history',
  'symptom',
  'vital',
  'lab',
  'exam',
  'imaging',
]);

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export function parseClues(
  value: Prisma.JsonValue | null,
): ValidationClinicalClue[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const clues: ValidationClinicalClue[] = [];

  for (const item of value) {
    const candidate = asRecord(item);
    if (!candidate) {
      return null;
    }

    if (
      !allowedClueTypes.has(candidate.type as ValidationClinicalClue['type']) ||
      !isNonEmptyString(candidate.value) ||
      typeof candidate.order !== 'number' ||
      !Number.isInteger(candidate.order)
    ) {
      return null;
    }

    clues.push({
      type: candidate.type as ValidationClinicalClue['type'],
      value: candidate.value.trim(),
      order: candidate.order,
    });
  }

  return clues;
}

export function parseExplanation(
  value: Prisma.JsonValue | null,
): ValidationExplanation | null {
  const candidate = asRecord(value);
  if (!candidate) {
    return null;
  }

  const diagnosis = isNonEmptyString(candidate.diagnosis)
    ? candidate.diagnosis.trim()
    : null;
  const summary = isNonEmptyString(candidate.summary)
    ? candidate.summary.trim()
    : null;
  const reasoning = parseStringArray(candidate.reasoning);
  const keyFindings = parseStringArray(candidate.keyFindings);

  if (!diagnosis || !summary || !reasoning || !keyFindings) {
    return null;
  }

  return {
    diagnosis,
    summary,
    reasoning,
    keyFindings,
  };
}

export function parseStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalized: string[] = [];
  for (const item of value) {
    if (!isNonEmptyString(item)) {
      return null;
    }

    normalized.push(item.trim());
  }

  return normalized;
}
