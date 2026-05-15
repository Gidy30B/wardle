import type { DiagnosisDictionaryIndex } from '../diagnosisRegistry.types'
import {
  normalizeDiagnosisSearchText,
  searchDiagnosisRegistryIndex,
} from '../diagnosisRegistry.search'
import type { DiagnosisSelection, DiagnosisSuggestion } from '../game.types'

export const MIN_DIAGNOSIS_AUTOCOMPLETE_QUERY_LENGTH = 1
export const DEFAULT_DIAGNOSIS_AUTOCOMPLETE_LIMIT = 5

export function searchDiagnosisAutocomplete(
  index: DiagnosisDictionaryIndex | null,
  query: string,
  limit = DEFAULT_DIAGNOSIS_AUTOCOMPLETE_LIMIT,
): DiagnosisSuggestion[] {
  if (
    !index ||
    query.trim().length < MIN_DIAGNOSIS_AUTOCOMPLETE_QUERY_LENGTH
  ) {
    return []
  }

  return searchDiagnosisRegistryIndex(index, query, limit)
}

export function toDiagnosisSelection(
  suggestion: DiagnosisSuggestion,
): DiagnosisSelection {
  return {
    diagnosisRegistryId: suggestion.diagnosisRegistryId,
    displayLabel: suggestion.displayLabel,
  }
}

export function findExactDiagnosisSelection(
  index: DiagnosisDictionaryIndex | null,
  value: string,
): DiagnosisSelection | null {
  const normalizedValue = normalizeDiagnosisSearchText(value)

  if (!index || !normalizedValue) {
    return null
  }

  const match = index.entries.find((entry) => {
    if (entry.labelNormalized === normalizedValue) {
      return true
    }

    return entry.aliases.some(
      (alias) => alias.normalizedValue === normalizedValue,
    )
  })

  return match
    ? {
        diagnosisRegistryId: match.id,
        displayLabel: match.label,
      }
    : null
}
