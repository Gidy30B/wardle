import type { DiagnosisSuggestion } from './game.types'
import type {
  DiagnosisDictionary,
  DiagnosisDictionaryIndex,
  DiagnosisSuggestionMatchKind,
} from './diagnosisRegistry.types'

const CONNECTOR_PATTERN = /[-_/]+/g
const PERIOD_PATTERN = /[.]+/g
const PUNCTUATION_PATTERN = /[^\p{L}\p{N}\s]/gu
const WHITESPACE_PATTERN = /\s+/g
const DEFAULT_SUGGESTION_LIMIT = 8
const MIN_DIAGNOSIS_SEARCH_TOKEN_LENGTH = 2

type RankedSuggestion = DiagnosisSuggestion & {
  bucket: number
  priority: number
}

export function normalizeDiagnosisSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(CONNECTOR_PATTERN, ' ')
    .replace(PERIOD_PATTERN, '')
    .replace(PUNCTUATION_PATTERN, ' ')
    .replace(WHITESPACE_PATTERN, ' ')
    .trim()
}

export function normalizeDiagnosisSearchTokens(value: string): string[] {
  const normalized = normalizeDiagnosisSearchText(value)

  if (!normalized) {
    return []
  }

  return normalized
    .split(' ')
    .filter((token) => token.length >= MIN_DIAGNOSIS_SEARCH_TOKEN_LENGTH)
}

function normalizeDiagnosisSearchPhrase(value: string): string {
  return normalizeDiagnosisSearchTokens(value).join(' ')
}

export function buildDiagnosisRegistrySearchIndex(
  dictionary: DiagnosisDictionary,
): DiagnosisDictionaryIndex {
  return {
    version: dictionary.version,
    generatedAt: dictionary.generatedAt,
    entries: dictionary.items.map((item) => ({
      id: item.id,
      label: item.label,
      labelNormalized: normalizeDiagnosisSearchText(item.label),
      labelSearchText: normalizeDiagnosisSearchPhrase(item.label),
      aliases: dedupeAliases(item.aliases).map((alias) => ({
        value: alias,
        normalizedValue: normalizeDiagnosisSearchText(alias),
        searchText: normalizeDiagnosisSearchPhrase(alias),
      })),
      priority: item.priority,
      category: item.category,
    })),
  }
}

export function searchDiagnosisRegistryIndex(
  index: DiagnosisDictionaryIndex,
  query: string,
  limit = DEFAULT_SUGGESTION_LIMIT,
): DiagnosisSuggestion[] {
  const normalizedQuery = normalizeDiagnosisSearchPhrase(query)
  if (!normalizedQuery) {
    return []
  }

  const safeLimit = Math.max(1, Math.min(DEFAULT_SUGGESTION_LIMIT, Math.floor(limit) || DEFAULT_SUGGESTION_LIMIT))

  return index.entries
    .map((entry) => rankDiagnosisSuggestion(entry, normalizedQuery))
    .filter((suggestion): suggestion is RankedSuggestion => suggestion !== null)
    .sort((left, right) => {
      if (left.bucket !== right.bucket) {
        return left.bucket - right.bucket
      }

      if (left.priority !== right.priority) {
        return right.priority - left.priority
      }

      return left.displayLabel.localeCompare(right.displayLabel)
    })
    .slice(0, safeLimit)
    .map(({ bucket: _bucket, priority: _priority, ...suggestion }) => suggestion)
}

function rankDiagnosisSuggestion(
  entry: DiagnosisDictionaryIndex['entries'][number],
  normalizedQuery: string,
): RankedSuggestion | null {
  const labelMatch = getMatchBucket(entry.labelSearchText, normalizedQuery, false)
  const aliasMatch = entry.aliases
    .map((alias) => ({
      alias,
      bucket: getMatchBucket(alias.searchText, normalizedQuery, true),
    }))
    .filter(
      (
        candidate,
      ): candidate is {
        alias: DiagnosisDictionaryIndex['entries'][number]['aliases'][number]
        bucket: number
      } => candidate.bucket !== null,
    )
    .sort((left, right) => left.bucket - right.bucket)[0]

  if (labelMatch === null && !aliasMatch) {
    return null
  }

  if (labelMatch !== null && (!aliasMatch || labelMatch <= aliasMatch.bucket)) {
    return {
      diagnosisRegistryId: entry.id,
      displayLabel: entry.label,
      matchKind: labelMatch === 0 ? 'label_prefix' : 'label_contains',
      priority: entry.priority,
      bucket: labelMatch,
    }
  }

  return {
    diagnosisRegistryId: entry.id,
    displayLabel: entry.label,
    matchKind: aliasMatch.bucket === 1 ? 'alias_prefix' : 'alias_contains',
    priority: entry.priority,
    bucket: aliasMatch.bucket,
  }
}

function getMatchBucket(
  normalizedValue: string,
  normalizedQuery: string,
  aliasMatch: boolean,
): number | null {
  if (!normalizedValue || !normalizedQuery) {
    return null
  }

  if (normalizedValue === normalizedQuery || normalizedValue.startsWith(normalizedQuery)) {
    return aliasMatch ? 1 : 0
  }

  if (normalizedValue.includes(normalizedQuery)) {
    return aliasMatch ? 3 : 2
  }

  return null
}

function dedupeAliases(aliases: string[]): string[] {
  const seen = new Set<string>()
  const deduped: string[] = []

  for (const alias of aliases) {
    const normalizedAlias = normalizeDiagnosisSearchText(alias)
    const normalizedSearchAlias = normalizeDiagnosisSearchPhrase(alias)

    if (!normalizedAlias || !normalizedSearchAlias || seen.has(normalizedAlias)) {
      continue
    }

    seen.add(normalizedAlias)
    deduped.push(alias)
  }

  return deduped
}

export function isDiagnosisSelectionCurrent(
  selectionLabel: string,
  typedText: string,
): boolean {
  return normalizeDiagnosisSearchText(selectionLabel) === normalizeDiagnosisSearchText(typedText)
}

export type { DiagnosisSuggestionMatchKind }
