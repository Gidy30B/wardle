import { useCallback, useEffect, useRef, useState } from 'react'
import { useApi } from '../../../lib/api'
import type { DiagnosisDictionaryAvailability } from '../diagnosisInput.state'
import {
  getCachedDiagnosisDictionarySnapshot,
  refreshDiagnosisDictionaryIndex,
  shouldRefreshDiagnosisDictionary,
} from '../diagnosisRegistry.cache'
import type { DiagnosisDictionaryIndex } from '../diagnosisRegistry.types'

export function useDiagnosisDictionaryIndex() {
  const { request } = useApi()
  const isMountedRef = useRef(true)
  const requestRef = useRef<Promise<DiagnosisDictionaryIndex> | null>(null)
  const initialSnapshot = getCachedDiagnosisDictionarySnapshot()

  const [index, setIndex] = useState<DiagnosisDictionaryIndex | null>(
    () => initialSnapshot?.index ?? null,
  )
  const [availability, setAvailability] =
    useState<DiagnosisDictionaryAvailability>(() =>
      initialSnapshot ? 'ready' : 'loading',
    )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ensureLoaded = useCallback(async () => {
    const cachedSnapshot = getCachedDiagnosisDictionarySnapshot()

    if (cachedSnapshot && isMountedRef.current) {
      setIndex(cachedSnapshot.index)
      setAvailability('ready')
      setError(null)
    }

    if (requestRef.current) {
      return cachedSnapshot?.index ?? requestRef.current
    }

    if (!shouldRefreshDiagnosisDictionary(cachedSnapshot)) {
      if (!cachedSnapshot) {
        throw new Error('Diagnosis dictionary unavailable')
      }

      return cachedSnapshot.index
    }

    const shouldBlockOnRefresh = !cachedSnapshot
    const task = (async () => {
      if (shouldBlockOnRefresh && isMountedRef.current) {
        setIsLoading(true)
        setAvailability('loading')
      }

      try {
        const nextIndex = await refreshDiagnosisDictionaryIndex(request)

        if (!isMountedRef.current) {
          return nextIndex
        }

        setIndex(nextIndex)
        setAvailability('ready')
        setError(null)
        return nextIndex
      } catch (exception) {
        const message =
          exception instanceof Error
            ? exception.message
            : 'Unable to refresh diagnosis dictionary'

        if (!isMountedRef.current) {
          throw exception
        }

        setError(message)

        if (cachedSnapshot) {
          setAvailability('ready')
          return cachedSnapshot.index
        }

        setAvailability('unavailable')
        throw exception
      } finally {
        if (shouldBlockOnRefresh && isMountedRef.current) {
          setIsLoading(false)
        }

        requestRef.current = null
      }
    })()

    requestRef.current = task

    if (cachedSnapshot) {
      void task
      return cachedSnapshot.index
    }

    return task
  }, [request])

  useEffect(() => {
    isMountedRef.current = true
    void ensureLoaded().catch(() => undefined)

    return () => {
      isMountedRef.current = false
    }
  }, [ensureLoaded])

  return {
    index,
    availability,
    isLoading,
    error,
    ensureLoaded,
  }
}
