import type { RequestJson } from '../../lib/api'
import { getDiagnosisDictionaryApi } from './game.api'
import { buildDiagnosisRegistrySearchIndex } from './diagnosisRegistry.search'
import type {
  DiagnosisDictionary,
  DiagnosisDictionaryIndex,
} from './diagnosisRegistry.types'

const DIAGNOSIS_DICTIONARY_STORAGE_KEY = 'doctordle.diagnosis-dictionary.v1'
const DIAGNOSIS_DICTIONARY_CACHE_TTL_MS = 1000 * 60 * 60 * 12

type PersistedDiagnosisDictionaryCache = {
  version: string
  cachedAt: number
  dictionary: DiagnosisDictionary
}

export type DiagnosisDictionaryCacheSnapshot = {
  dictionary: DiagnosisDictionary
  index: DiagnosisDictionaryIndex
  source: 'memory' | 'persistent'
  cachedAt: number
  stale: boolean
}

let cachedDictionary: DiagnosisDictionary | null = null
let cachedIndex: DiagnosisDictionaryIndex | null = null
let cachedAtMs: number | null = null
let refreshRequest: Promise<DiagnosisDictionaryIndex> | null = null
let refreshAttemptedThisSession = false

export function getCachedDiagnosisDictionarySnapshot(): DiagnosisDictionaryCacheSnapshot | null {
  if (cachedDictionary && cachedIndex && cachedAtMs !== null) {
    return {
      dictionary: cachedDictionary,
      index: cachedIndex,
      source: 'memory',
      cachedAt: cachedAtMs,
      stale: shouldRefreshPersistedDiagnosisDictionaryCache({
        version: cachedDictionary.version,
        cachedAt: cachedAtMs,
        dictionary: cachedDictionary,
      }),
    }
  }

  const persistedCache = readPersistedDiagnosisDictionaryCache()
  if (!persistedCache) {
    return null
  }

  setMemoryDiagnosisDictionaryCache(
    persistedCache.dictionary,
    persistedCache.cachedAt,
  )

  return {
    dictionary: cachedDictionary!,
    index: cachedIndex!,
    source: 'persistent',
    cachedAt: persistedCache.cachedAt,
    stale: shouldRefreshPersistedDiagnosisDictionaryCache(persistedCache),
  }
}

export function shouldRefreshDiagnosisDictionary(
  snapshot: DiagnosisDictionaryCacheSnapshot | null,
): boolean {
  if (!snapshot) {
    return true
  }

  return !refreshAttemptedThisSession && (snapshot.source === 'persistent' || snapshot.stale)
}

export async function refreshDiagnosisDictionaryIndex(
  request: RequestJson,
): Promise<DiagnosisDictionaryIndex> {
  if (refreshRequest) {
    return refreshRequest
  }

  refreshAttemptedThisSession = true

  refreshRequest = (async () => {
    const dictionary = await getDiagnosisDictionaryApi(request)
    writePersistedDiagnosisDictionaryCache(dictionary)
    setMemoryDiagnosisDictionaryCache(dictionary, Date.now())
    return cachedIndex!
  })()

  try {
    return await refreshRequest
  } finally {
    refreshRequest = null
  }
}

export function readPersistedDiagnosisDictionaryCache(): PersistedDiagnosisDictionaryCache | null {
  const rawValue = readDiagnosisDictionaryStorageValue()
  return parsePersistedDiagnosisDictionaryCache(rawValue)
}

export function writePersistedDiagnosisDictionaryCache(
  dictionary: DiagnosisDictionary,
): void {
  const cacheEntry: PersistedDiagnosisDictionaryCache = {
    version: dictionary.version,
    cachedAt: Date.now(),
    dictionary,
  }

  writeDiagnosisDictionaryStorageValue(JSON.stringify(cacheEntry))
}

export function parsePersistedDiagnosisDictionaryCache(
  rawValue: string | null,
): PersistedDiagnosisDictionaryCache | null {
  if (!rawValue) {
    return null
  }

  try {
    const parsedValue = JSON.parse(rawValue) as Partial<PersistedDiagnosisDictionaryCache>

    if (
      typeof parsedValue !== 'object' ||
      parsedValue === null ||
      typeof parsedValue.version !== 'string' ||
      typeof parsedValue.cachedAt !== 'number' ||
      !isDiagnosisDictionary(parsedValue.dictionary)
    ) {
      return null
    }

    return {
      version: parsedValue.version,
      cachedAt: parsedValue.cachedAt,
      dictionary: parsedValue.dictionary,
    }
  } catch {
    return null
  }
}

export function shouldRefreshPersistedDiagnosisDictionaryCache(
  cacheEntry: PersistedDiagnosisDictionaryCache,
  nowMs = Date.now(),
): boolean {
  return nowMs - cacheEntry.cachedAt >= DIAGNOSIS_DICTIONARY_CACHE_TTL_MS
}

function setMemoryDiagnosisDictionaryCache(
  dictionary: DiagnosisDictionary,
  cachedAt: number,
): void {
  cachedDictionary = dictionary
  cachedIndex = buildDiagnosisRegistrySearchIndex(dictionary)
  cachedAtMs = cachedAt
}

function readDiagnosisDictionaryStorageValue(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage.getItem(DIAGNOSIS_DICTIONARY_STORAGE_KEY)
  } catch {
    return null
  }
}

function writeDiagnosisDictionaryStorageValue(value: string): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(DIAGNOSIS_DICTIONARY_STORAGE_KEY, value)
  } catch {
    // Ignore storage failures and keep the in-memory cache alive.
  }
}

function isDiagnosisDictionary(value: unknown): value is DiagnosisDictionary {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('version' in value) ||
    !('generatedAt' in value) ||
    !('items' in value)
  ) {
    return false
  }

  const dictionary = value as DiagnosisDictionary

  return (
    typeof dictionary.version === 'string' &&
    typeof dictionary.generatedAt === 'string' &&
    Array.isArray(dictionary.items) &&
    dictionary.items.every((item) => {
      if (
        typeof item !== 'object' ||
        item === null ||
        typeof item.id !== 'string' ||
        typeof item.label !== 'string' ||
        !Array.isArray(item.aliases) ||
        typeof item.priority !== 'number'
      ) {
        return false
      }

      return item.aliases.every((alias) => typeof alias === 'string')
    })
  )
}
