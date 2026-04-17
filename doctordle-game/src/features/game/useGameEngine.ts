import { useAuth } from '@clerk/clerk-react'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { startGameApi, submitGuessApi } from './game.api'
import type { GameCase, GameResult } from './game.types'
import { useApi } from '../../lib/api'
import { subscribe } from './events/game.eventBus'

const SUBMIT_ACK_DELAY_MS = 180
const FINAL_TRANSITION_DELAY_MS = 250

export type GameAttempt = {
  guess: string
  label: 'correct' | 'close' | 'wrong'
}

export type GameRewardState = {
  xp: number
  streak?: number
  receivedAt: number
} | null

export type GameEngineMode =
  | { type: 'LOADING' }
  | { type: 'PLAYING' }
  | { type: 'SUBMITTING' }
  | { type: 'FINAL_FEEDBACK'; result: GameResult }
  | { type: 'WAITING'; nextCaseAt: Date }
  | { type: 'BLOCKED'; reason: string | null }

function getDefaultNextCaseAt(now = new Date()): Date {
  const next = new Date(now)
  next.setUTCHours(24, 0, 0, 0)
  return next
}

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

function delay(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export function useGameEngine() {
  const { isLoaded, isSignedIn } = useAuth()
  const { request } = useApi()
  const queryClient = useQueryClient()
  const didInitRef = useRef(false)
  const isMountedRef = useRef(true)
  const sessionRequestRef = useRef<Promise<void> | null>(null)
  const submitRequestRef = useRef(false)

  const [mode, setMode] = useState<GameEngineMode>({ type: 'LOADING' })
  const [guess, setGuess] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [caseData, setCaseData] = useState<GameCase | null>(null)
  const [clueIndex, setClueIndex] = useState(0)
  const [latestResult, setLatestResult] = useState<GameResult | null>(null)
  const [attempts, setAttempts] = useState<GameAttempt[]>([])
  const [error, setError] = useState<string | null>(null)
  const [reward, setReward] = useState<GameRewardState>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const clearGameplayState = useCallback(() => {
    setSessionId(null)
    setCaseData(null)
    setClueIndex(0)
    setGuess('')
    setLatestResult(null)
    setAttempts([])
  }, [])

  const startSession = useCallback(async () => {
    if (sessionRequestRef.current) {
      return sessionRequestRef.current
    }

    const task = (async () => {
      setMode({ type: 'LOADING' })
      setError(null)

      try {
        const session = await startGameApi(request)

        if (!isMountedRef.current) {
          return
        }

        setSessionId(session.sessionId)
        setCaseData(session.case)
        setClueIndex(session.case.clueIndex)
        setGuess('')
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
  }, [clearGameplayState, request])

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

  useEffect(() => {
    if (mode.type !== 'WAITING') {
      return
    }

    setNowMs(Date.now())

    const interval = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [mode.type])

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

  const submitGuess = useCallback(async () => {
    const trimmed = guess.trim()

    if (mode.type !== 'PLAYING' || !sessionId || !trimmed || submitRequestRef.current) {
      return undefined
    }

    submitRequestRef.current = true
    setMode({ type: 'SUBMITTING' })
    setError(null)

    try {
      // The submit response is the source of truth for correctness and finality.
      const response = await submitGuessApi(request, { guess: trimmed, sessionId })

      if (!isMountedRef.current) {
        return response
      }

      setLatestResult(response)
      setClueIndex(response.clueIndex)
      if (response.case) {
        setCaseData(response.case)
      }
      setAttempts((previous) => [...previous, { guess: trimmed, label: response.label }])
      setGuess('')

      await delay(SUBMIT_ACK_DELAY_MS)

      if (!isMountedRef.current) {
        return response
      }

      if (isFinalResult(response)) {
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
  }, [guess, mode.type, request, sessionId])

  const continueGame = useCallback(() => {
    if (mode.type !== 'FINAL_FEEDBACK') {
      return
    }

    clearGameplayState()
    setError(null)
    // The backend does not currently return the next playable timestamp, so
    // the waiting lifecycle falls back to the next UTC midnight and then
    // re-checks session availability before returning to play.
    setMode({ type: 'WAITING', nextCaseAt: getDefaultNextCaseAt() })
  }, [clearGameplayState, mode])

  const reloadSession = useCallback(async () => {
    await startSession()
  }, [startSession])

  const clearGuess = useCallback(() => {
    if (mode.type !== 'PLAYING') {
      return
    }

    setGuess('')
  }, [mode.type])

  const backspaceGuess = useCallback(() => {
    if (mode.type !== 'PLAYING') {
      return
    }

    setGuess((current) => current.slice(0, -1))
  }, [mode.type])

  const waitingCountdownText = useMemo(() => {
    if (mode.type !== 'WAITING') {
      return null
    }

    return formatCountdown(mode.nextCaseAt, nowMs)
  }, [mode, nowMs])

  const isLoadingCase = mode.type === 'LOADING'
  const isSubmitting = mode.type === 'SUBMITTING'
  const isWaiting = mode.type === 'WAITING'
  const isBlocked = mode.type === 'BLOCKED'
  const isFinalFeedback = mode.type === 'FINAL_FEEDBACK'
  const isPlaying = mode.type === 'PLAYING'
  const waitingMsRemaining = mode.type === 'WAITING' ? Math.max(0, mode.nextCaseAt.getTime() - nowMs) : null
  const finalResult = mode.type === 'FINAL_FEEDBACK' ? mode.result : null
  const canOpenExplanation = Boolean(latestResult?.explanation)
  const canSubmit = isPlaying && Boolean(sessionId) && guess.trim().length > 0

  return {
    mode,
    caseData,
    clueIndex,
    guess,
    attempts,
    latestResult,
    finalResult,
    explanation: latestResult?.explanation ?? null,
    error,
    reward,
    waitingCountdownText,
    waitingMsRemaining,
    hasActiveSession: Boolean(sessionId),
    canSubmit,
    submitDisabled: !canSubmit || isSubmitting,
    canOpenExplanation,
    isLoadingCase,
    isSubmitting,
    isWaiting,
    isBlocked,
    isFinalFeedback,
    isPlaying,
    unavailableReason: mode.type === 'BLOCKED' ? mode.reason : null,
    changeGuess: setGuess,
    clearGuess,
    backspaceGuess,
    submitGuess,
    continueGame,
    reloadSession,
  }
}
