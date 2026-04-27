export type LegacyAliasDecision = {
  kind: 'ABBREVIATION' | 'SEARCH_ONLY';
  acceptedForMatch: boolean;
  source: string;
};

export function inferLegacyAliasDecision(
  term: string,
  ambiguous: boolean,
): LegacyAliasDecision {
  if (ambiguous) {
    return {
      kind: 'SEARCH_ONLY',
      acceptedForMatch: false,
      source: 'legacy_synonym_ambiguous',
    };
  }

  const compact = term.replace(/[^A-Za-z0-9]/g, '');
  if (compact.length > 1 && compact.length <= 5 && !/\s/.test(term)) {
    return {
      kind: 'ABBREVIATION',
      acceptedForMatch: true,
      source: 'legacy_synonym_abbreviation',
    };
  }

  return {
    kind: 'SEARCH_ONLY',
    acceptedForMatch: false,
    source: 'legacy_synonym_search_only',
  };
}
