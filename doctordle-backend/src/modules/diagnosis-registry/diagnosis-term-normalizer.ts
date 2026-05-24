const COMBINING_MARKS_PATTERN = /[\u0300-\u036f]/g;
const CONNECTOR_PATTERN = /[-_/]+/g;
const PERIOD_PATTERN = /[.]+/g;
const PUNCTUATION_PATTERN = /[^\p{L}\p{N}\s]/gu;
const WHITESPACE_PATTERN = /\s+/g;

export function normalizeDiagnosisTerm(value: string): string {
  return value
    .normalize('NFKD')
    .replace(COMBINING_MARKS_PATTERN, '')
    .toLowerCase()
    .trim()
    .replace(CONNECTOR_PATTERN, ' ')
    .replace(PERIOD_PATTERN, '')
    .replace(PUNCTUATION_PATTERN, ' ')
    .replace(WHITESPACE_PATTERN, ' ')
    .trim();
}

export function getDiagnosisTermNormalizedCandidates(value: string): string[] {
  const candidates = new Set<string>();
  const normalized = normalizeDiagnosisTerm(value);
  if (normalized) {
    candidates.add(normalized);
  }

  for (const match of value.matchAll(/\(([^()]+)\)/g)) {
    const parenthetical = normalizeDiagnosisTerm(match[1]);
    if (parenthetical) {
      candidates.add(parenthetical);
    }
  }

  return [...candidates];
}
