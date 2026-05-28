export function normalizeGraphText(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s/%+.-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function compactGraphText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildGraphDedupeKey(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => normalizeGraphText(part ?? ''))
    .join('|');
}
