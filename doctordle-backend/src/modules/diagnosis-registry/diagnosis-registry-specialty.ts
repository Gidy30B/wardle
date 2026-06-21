export const ORTHOPAEDICS_SPECIALTY = 'Orthopaedics';

const SPECIALTY_CANONICAL_BY_NORMALIZED = new Map<string, string>([
  ['orthopaedics', ORTHOPAEDICS_SPECIALTY],
  ['orthopaedic', ORTHOPAEDICS_SPECIALTY],
  ['orthopedics', ORTHOPAEDICS_SPECIALTY],
  ['orthopedic', ORTHOPAEDICS_SPECIALTY],
]);

export function normalizeSpecialtyDisplayName(
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed) {
    return null;
  }

  return SPECIALTY_CANONICAL_BY_NORMALIZED.get(normalizeSpecialtyKey(trimmed)) ?? trimmed;
}

function normalizeSpecialtyKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
