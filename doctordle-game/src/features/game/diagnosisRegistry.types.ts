export type DiagnosisSuggestionMatchKind =
  | 'label_prefix'
  | 'alias_prefix'
  | 'label_contains'
  | 'alias_contains'

export type DiagnosisDictionaryItem = {
  id: string
  label: string
  aliases: string[]
  priority: number
  category?: string
}

export type DiagnosisDictionary = {
  version: string
  generatedAt: string
  items: DiagnosisDictionaryItem[]
}

export type DiagnosisRegistryVersion = {
  version: string
  generatedAt: string
  diagnosisCount: number
  aliasCount: number
  selectionRequired: boolean
  autocompleteEnabled: boolean
}

export type DiagnosisDictionaryIndex = {
  version: string
  generatedAt: string
  entries: Array<{
    id: string
    label: string
    labelNormalized: string
    labelSearchText: string
    aliases: Array<{
      value: string
      normalizedValue: string
      searchText: string
    }>
    priority: number
    category?: string
  }>
}
