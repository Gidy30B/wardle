import { useAuth } from '@clerk/clerk-react'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildRoundViewModel } from './buildRoundViewModel'
import {
  deriveDiagnosisInputState,
  deriveDiagnosisSubmitMode,
  reconcileDiagnosisSelectionAfterTextChange,
  type DiagnosisDictionaryAvailability,
} from './diagnosisInput.state'
import {
  getCachedDiagnosisDictionarySnapshot,
  refreshDiagnosisDictionaryIndex,
  shouldRefreshDiagnosisDictionary,
} from './diagnosisRegistry.cache'
import {
  normalizeDiagnosisSearchText,
  searchDiagnosisRegistryIndex,
} from './diagnosisRegistry.search'
import { hasDisplayableExplanation } from './gameExplanation'
import type { DiagnosisDictionaryIndex } from './diagnosisRegistry.types'
import { startGameApi, submitGuessApi } from './game.api'
import type {
  DiagnosisSelection,
  DiagnosisSuggestion,
  GameCase,
  GameResult,
  StartGameResponse,
} from './game.types'
import { subscribe } from './events/game.eventBus'
import { useUserProgress } from '../user-progress/useUserProgress'
import { useApi } from '../../lib/api'
import { useUserSettings } from '../profile/useUserSettings'

const SUBMIT_ACK_DELAY_MS = 180
const FINAL_TRANSITION_DELAY_MS = 250
const MIN_AUTOCOMPLETE_QUERY_LENGTH = 1
const AUTOCOMPLETE_LIMIT = 5

export type GameAttempt = {
  guess: string
  label: 'correct' | 'close' | 'wrong'
}

export type GameRewardState = {
  xp: number
  streak?: number
  receivedAt: number
} | null

type SessionTimingState = {
  startedAt: string
  completedAt: string | null
} | null

export type GameEngineMode =
  | { type: 'LOADING' }
  | { type: 'PLAYING' }
  | { type: 'SUBMITTING' }
  | { type: 'FINAL_FEEDBACK'; result: GameResult }
  | { type: 'WAITING'; nextCaseAt: Date }
  | { type: 'BLOCKED'; reason: string | null }

function isFinalResult(result: GameResult): boolean {
  return (
    result.gameOver ||
    result.label === 'correct' ||
    result.gameOverReason === 'correct' ||
    result.gameOverReason === 'clues_exhausted'
  )
}

function isDailyLimitMessage(message: string): boolean {
  return /daily free limit reached/i.test(message)
}

function formatCountdown(target: Date, nowMs: number): string {
  const msLeft = Math.max(0, target.getTime() - nowMs)
  const totalSeconds = Math.floor(msLeft / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const hh = String(hours).padStart(2, '0')
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')

  return `${hh}:${mm}:${ss}`
}

function formatElapsedTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = safeSeconds % 60

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

function delay(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function toDiagnosisSelection(
  suggestion: DiagnosisSuggestion,
): DiagnosisSelection {
  return {
    diagnosisRegistryId: suggestion.diagnosisRegistryId,
    displayLabel: suggestion.displayLabel,
  }
}

function findExactDiagnosisSelection(
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

    return entry.aliases.some((alias) => alias.normalizedValue === normalizedValue)
  })

  return match
    ? {
        diagnosisRegistryId: match.id,
        displayLabel: match.label,
      }
    : null
}

export function useGameEngine() {
  const { isLoaded, isSignedIn } = useAuth()
  const { request } = useApi()
  const queryClient = useQueryClient()
  const { progress } = useUserProgress()
  const settingsQuery = useUserSettings()
  const settings = settingsQuery.data
  const showTimer = settings?.showTimer ?? true
  const autocompleteEnabled = settings?.autocompleteEnabled ?? true
  const didInitRef = useRef(false)
  const isMountedRef = useRef(true)
  const sessionRequestRef = useRef<Promise<void> | null>(null)
  const registryRequestRef = useRef<Promise<DiagnosisDictionaryIndex> | null>(null)
  const submitRequestRef = useRef(false)

  const [mode, setMode] = useState<GameEngineMode>({ type: 'LOADING' })
  const [guess, setGuess] = useState('')
  const [selectedDiagnosis, setSelectedDiagnosis] = useState<DiagnosisSelection | null>(null)
  const [staleSelection, setStaleSelection] = useState<DiagnosisSelection | null>(null)
  const [suggestions, setSuggestions] = useState<DiagnosisSuggestion[]>([])
  const [registryIndex, setRegistryIndex] = useState<DiagnosisDictionaryIndex | null>(
    () => getCachedDiagnosisDictionarySnapshot()?.index ?? null,
  )
  const [dictionaryAvailability, setDictionaryAvailability] =
    useState<DiagnosisDictionaryAvailability>(() =>
      getCachedDiagnosisDictionarySnapshot() ? 'ready' : 'loading',
    )
  const [isRegistryLoading, setIsRegistryLoading] = useState(false)
  const [registryError, setRegistryError] = useState<string | null>(null)
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(0)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionTiming, setSessionTiming] = useState<SessionTimingState>(null)
  const [caseData, setCaseData] = useState<GameCase | null>(null)
  const [clueIndex, setClueIndex] = useState(0)
  const [latestResult, setLatestResult] = useState<GameResult | null>(null)
  const [latestPlayedLearningResult, setLatestPlayedLearningResult] =
    useState<GameResult | null>(null)
  const [attempts, setAttempts] = useState<GameAttempt[]>([])
  const [error, setError] = useState<string | null>(null)
  const [reward, setReward] = useState<GameRewardState>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const diagnosisInputState = useMemo(
    () =>
      deriveDiagnosisInputState({
        text: guess,
        selectedDiagnosis,
        staleSelection,
      }),
    [guess, selectedDiagnosis, staleSelection],
  )

  const diagnosisSubmitMode = useMemo(
    () =>
      deriveDiagnosisSubmitMode({
        diagnosisInputState,
        dictionaryAvailability,
      }),
    [diagnosisInputState, dictionaryAvailability],
  )

  const clearGameplayState = useCallback(() => {
    setSessionId(null)
    setSessionTiming(null)
    setCaseData(null)
    setClueIndex(0)
    setGuess('')
    setSelectedDiagnosis(null)
    setStaleSelection(null)
    setSuggestions([])
    setHighlightedSuggestionIndex(0)
    setLatestResult(null)
    setAttempts([])
  }, [])

  const ensureDiagnosisRegistryLoaded = useCallback(async () => {
    const cachedSnapshot = getCachedDiagnosisDictionarySnapshot()

    if (cachedSnapshot && isMountedRef.current) {
      setRegistryIndex(cachedSnapshot.index)
      setDictionaryAvailability('ready')
      setRegistryError(null)
    }

    if (registryRequestRef.current) {
      return cachedSnapshot?.index ?? registryRequestRef.current
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
        setIsRegistryLoading(true)
        setDictionaryAvailability('loading')
      }

      try {
        const nextRegistryIndex = await refreshDiagnosisDictionaryIndex(request)

        if (!isMountedRef.current) {
          return nextRegistryIndex
        }

        setRegistryIndex(nextRegistryIndex)
        setDictionaryAvailability('ready')
        setRegistryError(null)
        return nextRegistryIndex
      } catch (exception) {
        const message =
          exception instanceof Error ? exception.message : 'Unable to refresh diagnosis dictionary'

        if (!isMountedRef.current) {
          throw exception
        }

        setRegistryError(message)

        if (cachedSnapshot) {
          setDictionaryAvailability('ready')
          return cachedSnapshot.index
        }

        setDictionaryAvailability('unavailable')
        throw exception
      } finally {
        if (shouldBlockOnRefresh && isMountedRef.current) {
          setIsRegistryLoading(false)
        }

        registryRequestRef.current = null
      }
    })()

    registryRequestRef.current = task

    if (cachedSnapshot) {
      void task
      return cachedSnapshot.index
    }

    return task
  }, [request])

  const startSession = useCallback(async () => {
    if (sessionRequestRef.current) {
      return sessionRequestRef.current
    }

    const task = (async () => {
      setMode({ type: 'LOADING' })
      setError(null)
      void ensureDiagnosisRegistryLoaded().catch(() => undefined)

      try {
        const session: StartGameResponse = await startGameApi(request)

        if (!isMountedRef.current) {
          return
        }

        if (session.state === 'waiting') {
          clearGameplayState()
          setError(null)
          setMode({ type: 'WAITING', nextCaseAt: new Date(session.nextCaseAt) })
          return
        }

        setSessionId(session.sessionId)
        setSessionTiming(
          session.startedAt
            ? {
                startedAt: session.startedAt,
                completedAt: session.completedAt ?? null,
              }
            : null,
        )
        setCaseData(session.case)
        setClueIndex(session.case.clueIndex)
        setGuess('')
        setSelectedDiagnosis(null)
        setStaleSelection(null)
        setSuggestions([])
        setHighlightedSuggestionIndex(0)
        setLatestResult(null)
        setAttempts([])
        setError(null)
        setMode({ type: 'PLAYING' })
      } catch (exception) {
        if (!isMountedRef.current) {
          return
        }

        const message = exception instanceof Error ? exception.message : 'Unknown error'

        clearGameplayState()

        if (isDailyLimitMessage(message)) {
          setError(null)
          setMode({ type: 'BLOCKED', reason: message })
          return
        }

        setError(message)
        setMode({ type: 'BLOCKED', reason: null })
      } finally {
        sessionRequestRef.current = null
      }
    })()

    sessionRequestRef.current = task
    return task
  }, [clearGameplayState, ensureDiagnosisRegistryLoaded, request])

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!isLoaded || !isSignedIn || didInitRef.current) {
      return
    }

    didInitRef.current = true
    void startSession()
  }, [isLoaded, isSignedIn, startSession])

  useEffect(() => {
    return subscribe((event) => {
      if (event.type !== 'REWARD_TRIGGERED') {
        return
      }

      // Reward visuals and progress refresh stay websocket-driven because the
      // backend applies rewards asynchronously after the guess response.
      setReward({
        xp: event.xp,
        streak: event.streak,
        receivedAt: Date.now(),
      })

      void queryClient.invalidateQueries({ queryKey: ['leaderboard'] })
      void queryClient.invalidateQueries({ queryKey: ['progress'] })
    })
  }, [queryClient])

  const shouldTick =
    mode.type === 'WAITING' ||
    Boolean(showTimer && sessionTiming?.startedAt && !sessionTiming.completedAt)

  useEffect(() => {
    if (!shouldTick) {
      return
    }

    setNowMs(Date.now())

    const interval = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [shouldTick])

  useEffect(() => {
    if (mode.type !== 'WAITING') {
      return
    }

    const delayMs = mode.nextCaseAt.getTime() - Date.now()

    if (delayMs <= 0) {
      void startSession()
      return
    }

    const timeout = window.setTimeout(() => {
      void startSession()
    }, delayMs)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [mode, startSession])

  useEffect(() => {
    if (
      mode.type !== 'PLAYING' ||
      !sessionId ||
      !autocompleteEnabled ||
      diagnosisInputState.mode === 'selected'
    ) {
      setSuggestions([])
      setHighlightedSuggestionIndex(0)
      return
    }

    const query = guess.trim()
    if (
      query.length < MIN_AUTOCOMPLETE_QUERY_LENGTH ||
      !registryIndex ||
      dictionaryAvailability === 'unavailable'
    ) {
      setSuggestions([])
      setHighlightedSuggestionIndex(0)
      return
    }

    const nextSuggestions = searchDiagnosisRegistryIndex(
      registryIndex,
      query,
      AUTOCOMPLETE_LIMIT,
    )

    setSuggestions(nextSuggestions)
    setHighlightedSuggestionIndex((current) =>
      nextSuggestions.length === 0 ? 0 : Math.min(current, nextSuggestions.length - 1),
    )
  }, [
    diagnosisInputState.mode,
    autocompleteEnabled,
    dictionaryAvailability,
    guess,
    mode.type,
    registryIndex,
    sessionId,
  ])

  const isAutocompleteLoading =
    autocompleteEnabled &&
    mode.type === 'PLAYING' &&
    diagnosisInputState.mode !== 'selected' &&
    diagnosisInputState.mode !== 'empty' &&
    isRegistryLoading &&
    dictionaryAvailability !== 'unavailable'
  const autocompleteError =
    autocompleteEnabled &&
    mode.type === 'PLAYING' &&
    diagnosisInputState.mode !== 'selected' &&
    diagnosisInputState.mode !== 'empty'
      ? registryError
      : null

  const applyGuessTextChange = useCallback((nextGuess: string) => {
    setGuess(nextGuess)

    const nextSelectionState = autocompleteEnabled
      ? reconcileDiagnosisSelectionAfterTextChange({
          nextText: nextGuess,
          selectedDiagnosis,
          staleSelection,
        })
      : {
          selectedDiagnosis: findExactDiagnosisSelection(registryIndex, nextGuess),
          staleSelection: null,
        }

    setSelectedDiagnosis(nextSelectionState.selectedDiagnosis)
    setStaleSelection(nextSelectionState.staleSelection)
    setHighlightedSuggestionIndex(0)
  }, [autocompleteEnabled, registryIndex, selectedDiagnosis, staleSelection])

  const submitGuess = useCallback(async () => {
    const trimmed = guess.trim()

    if (
      mode.type !== 'PLAYING' ||
      !sessionId ||
      diagnosisSubmitMode === 'blocked' ||
      submitRequestRef.current
    ) {
      return undefined
    }

    submitRequestRef.current = true
    setMode({ type: 'SUBMITTING' })
    setError(null)

    try {
      const clueIndexAtSubmit = clueIndex
      // The submit response is the source of truth for correctness and finality.
      const response = await submitGuessApi(request, {
        sessionId,
        diagnosisRegistryId: selectedDiagnosis!.diagnosisRegistryId,
        guess: trimmed || selectedDiagnosis!.displayLabel,
      })

      if (!isMountedRef.current) {
        return response
      }

      setSessionTiming((current) => {
        if (!response.startedAt && !response.completedAt) {
          return current
        }

        const currentStartedAt = current?.startedAt
        if (!response.startedAt && !currentStartedAt) {
          return current
        }

        return {
          startedAt: response.startedAt ?? currentStartedAt!,
          completedAt: response.completedAt ?? current?.completedAt ?? null,
        }
      })

      const isTerminalResponse = isFinalResult(response)
      const isCorrectTerminalResponse =
        isTerminalResponse &&
        (response.label === 'correct' || response.gameOverReason === 'correct')

      setLatestResult(response)
      setClueIndex(isCorrectTerminalResponse ? clueIndexAtSubmit : response.clueIndex)
      if (response.case && !isCorrectTerminalResponse) {
        setCaseData(response.case)
      }
      setAttempts((previous) => [
        ...previous,
        {
          guess: trimmed,
          label: response.label,
        },
      ])
      setGuess('')
      setSelectedDiagnosis(null)
      setStaleSelection(null)
      setSuggestions([])
      setHighlightedSuggestionIndex(0)

      await delay(SUBMIT_ACK_DELAY_MS)

      if (!isMountedRef.current) {
        return response
      }

      if (isTerminalResponse) {
        if (hasDisplayableExplanation(response.explanation)) {
          setLatestPlayedLearningResult(response)
        }

        await delay(FINAL_TRANSITION_DELAY_MS)

        if (!isMountedRef.current) {
          return response
        }

        setMode({ type: 'FINAL_FEEDBACK', result: response })
        return response
      }

      setMode({ type: 'PLAYING' })
      return response
    } catch (exception) {
      if (isMountedRef.current) {
        setError(exception instanceof Error ? exception.message : 'Unknown error')
        setMode(sessionId ? { type: 'PLAYING' } : { type: 'BLOCKED', reason: null })
      }

      throw exception instanceof Error ? exception : new Error('Unknown error')
    } finally {
      submitRequestRef.current = false
    }
  }, [
    diagnosisSubmitMode,
    guess,
    mode.type,
    request,
    selectedDiagnosis,
    sessionId,
  ])

  const continueGame = useCallback(() => {
    if (mode.type !== 'FINAL_FEEDBACK') {
      return
    }

    clearGameplayState()
    setError(null)
    void startSession()
  }, [clearGameplayState, mode, startSession])

  const reloadSession = useCallback(async () => {
    await startSession()
  }, [startSession])

  const clearGuess = useCallback(() => {
    if (mode.type !== 'PLAYING') {
      return
    }

    setGuess('')
    setSelectedDiagnosis(null)
    setStaleSelection(null)
    setSuggestions([])
    setHighlightedSuggestionIndex(0)
  }, [mode.type])

  const backspaceGuess = useCallback(() => {
    if (mode.type !== 'PLAYING' || guess.length === 0) {
      return
    }

    applyGuessTextChange(guess.slice(0, -1))
  }, [applyGuessTextChange, guess, mode.type])

  const appendGuessCharacter = useCallback((value: string) => {
    if (mode.type !== 'PLAYING' || value.length === 0) {
      return
    }

    applyGuessTextChange(`${guess}${value}`.toUpperCase())
  }, [applyGuessTextChange, guess, mode.type])

  const changeGuess = useCallback((value: string) => {
    if (mode.type !== 'PLAYING') {
      return
    }

    applyGuessTextChange(value.toUpperCase())
  }, [applyGuessTextChange, mode.type])

  const selectSuggestion = useCallback((suggestion: DiagnosisSuggestion) => {
    if (mode.type !== 'PLAYING') {
      return
    }

    setGuess(suggestion.displayLabel)
    setSelectedDiagnosis(toDiagnosisSelection(suggestion))
    setStaleSelection(null)
    setSuggestions([])
    setHighlightedSuggestionIndex(0)
  }, [mode.type])

  const clearSelectedSuggestion = useCallback(() => {
    if (mode.type !== 'PLAYING' || !selectedDiagnosis) {
      return false
    }

    setSelectedDiagnosis(null)
    setStaleSelection(null)
    setHighlightedSuggestionIndex(0)
    return true
  }, [mode.type, selectedDiagnosis])

  const moveSuggestionHighlight = useCallback((direction: -1 | 1) => {
    if (mode.type !== 'PLAYING' || suggestions.length === 0 || diagnosisInputState.mode === 'selected') {
      return
    }

    setHighlightedSuggestionIndex((current) => {
      const next = current + direction
      if (next < 0) {
        return suggestions.length - 1
      }

      if (next >= suggestions.length) {
        return 0
      }

      return next
    })
  }, [diagnosisInputState.mode, mode.type, suggestions.length])

  const selectHighlightedSuggestion = useCallback(() => {
    if (mode.type !== 'PLAYING' || suggestions.length === 0 || diagnosisInputState.mode === 'selected') {
      return false
    }

    const suggestion = suggestions[highlightedSuggestionIndex]
    if (!suggestion) {
      return false
    }

    selectSuggestion(suggestion)
    return true
  }, [
    diagnosisInputState.mode,
    highlightedSuggestionIndex,
    mode.type,
    selectSuggestion,
    suggestions,
  ])

  const waitingCountdownText = useMemo(() => {
    if (mode.type !== 'WAITING') {
      return null
    }

    return formatCountdown(mode.nextCaseAt, nowMs)
  }, [mode, nowMs])

  const elapsedSeconds = useMemo(() => {
    if (!sessionTiming?.startedAt) {
      return null
    }

    const startedAtMs = Date.parse(sessionTiming.startedAt)
    if (!Number.isFinite(startedAtMs)) {
      return null
    }

    const completedAtMs = sessionTiming.completedAt
      ? Date.parse(sessionTiming.completedAt)
      : null
    if (completedAtMs !== null && !Number.isFinite(completedAtMs)) {
      return null
    }

    return Math.max(
      0,
      Math.floor(((completedAtMs ?? nowMs) - startedAtMs) / 1000),
    )
  }, [nowMs, sessionTiming])

  const elapsedTimeText = useMemo(() => {
    return !showTimer || elapsedSeconds === null ? null : formatElapsedTime(elapsedSeconds)
  }, [elapsedSeconds, showTimer])

  const isLoadingCase = mode.type === 'LOADING'
  const isSubmitting = mode.type === 'SUBMITTING'
  const isWaiting = mode.type === 'WAITING'
  const isBlocked = mode.type === 'BLOCKED'
  const isFinalFeedback = mode.type === 'FINAL_FEEDBACK'
  const isPlaying = mode.type === 'PLAYING'
  const waitingMsRemaining =
    mode.type === 'WAITING' ? Math.max(0, mode.nextCaseAt.getTime() - nowMs) : null
  const finalResult = mode.type === 'FINAL_FEEDBACK' ? mode.result : null
  const canOpenExplanation = hasDisplayableExplanation(latestResult?.explanation)
  const canSubmit =
    isPlaying &&
    Boolean(sessionId) &&
    diagnosisSubmitMode === 'selected-id'
  const unavailableReason = mode.type === 'BLOCKED' ? mode.reason : null

  const roundViewModel = useMemo(
    () =>
      buildRoundViewModel({
        mode,
        sessionId,
        caseData,
        clueIndex,
        guess,
        diagnosisInputState,
        diagnosisSubmitMode,
        dictionaryAvailability,
        selectedDiagnosis,
        suggestions,
        isAutocompleteLoading,
        autocompleteError,
        highlightedSuggestionIndex,
        attempts,
        latestResult,
        reward,
        elapsedSeconds,
        elapsedTimeText,
        isLoadingCase,
        error,
        waitingCountdownText,
        unavailableReason,
        progress,
        canRetry: Boolean(error),
        canOpenExplanation,
        canSubmit,
        submitDisabled: !canSubmit || isSubmitting,
      }),
    [
      attempts,
      autocompleteError,
      canOpenExplanation,
      canSubmit,
      caseData,
      clueIndex,
      diagnosisInputState,
      diagnosisSubmitMode,
      dictionaryAvailability,
      error,
      elapsedSeconds,
      elapsedTimeText,
      guess,
      highlightedSuggestionIndex,
      isAutocompleteLoading,
      isLoadingCase,
      isSubmitting,
      latestResult,
      mode,
      progress,
      reward,
      selectedDiagnosis,
      sessionTiming,
      sessionId,
      suggestions,
      unavailableReason,
      waitingCountdownText,
    ],
  )

  return {
    mode,
    sessionId,
    caseData,
    clueIndex,
    guess,
    attempts,
    latestResult,
    latestPlayedLearningResult,
    finalResult,
    explanation: latestResult?.explanation ?? null,
    latestPlayedExplanation: latestPlayedLearningResult?.explanation ?? null,
    progress,
    error,
    reward,
    waitingCountdownText,
    waitingMsRemaining,
    elapsedSeconds,
    elapsedTimeText,
    hasActiveSession: Boolean(sessionId),
    canSubmit,
    submitDisabled: !canSubmit || isSubmitting,
    canOpenExplanation,
    roundViewModel,
    isLoadingCase,
    isSubmitting,
    isWaiting,
    isBlocked,
    isFinalFeedback,
    isPlaying,
    unavailableReason,
    suggestions,
    isAutocompleteLoading,
    autocompleteError,
    highlightedSuggestionIndex,
    selectedDiagnosis,
    diagnosisInputState,
    diagnosisSubmitMode,
    dictionaryAvailability,
    appendGuessCharacter,
    changeGuess,
    clearGuess,
    backspaceGuess,
    selectSuggestion,
    clearSelectedSuggestion,
    moveSuggestionHighlight,
    selectHighlightedSuggestion,
    submitGuess,
    continueGame,
    reloadSession,
  }
}
