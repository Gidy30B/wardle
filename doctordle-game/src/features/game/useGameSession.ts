import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQueryClient } from '@tanstack/react-query'
import { startGameApi, submitGuessApi } from './game.api'
import type { GameCase, GameResult, RequestState } from './game.types'
import { useApi } from '../../lib/api'
import { emit, subscribe } from './events/game.eventBus'

type UseGameSessionOptions = {
  currentStreak?: number
}

export function useGameSession(_options: UseGameSessionOptions = {}) {
  const { isLoaded, isSignedIn } = useAuth()
  const { request } = useApi()
  const queryClient = useQueryClient()
  const debug = import.meta.env.DEV
  const hasStartedRef = useRef(false)
  const submittingRef = useRef(false)
  const [guess, setGuess] = useState('')
  const [result, setResult] = useState<GameResult | null>(null)
  const [guesses, setGuesses] = useState<
    Array<{ guess: string; label: 'correct' | 'close' | 'wrong' }>
  >([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [caseData, setCaseData] = useState<GameCase | null>(null)
  const [clueIndex, setClueIndex] = useState(0)
  const [caseLoading, setCaseLoading] = useState(true)
  const [requestState, setRequestState] = useState<RequestState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [xpEarned, setXpEarned] = useState(0)

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return
    }

    if (hasStartedRef.current) {
      return
    }

    hasStartedRef.current = true
    let active = true

    async function initializeSession() {
      let hasActiveSession = false
      setRequestState('loading')

      try {
        try {
          const session = await startGameApi(request)
          if (!active) {
            return
          }

          hasActiveSession = true
          setSessionId(session.sessionId)
          setCaseData(session.case)
          setClueIndex(session.case.clueIndex)
          setResult(null)
          setGuesses([])
          setXpEarned(0)
          setError(null)
        } catch (exception) {
          if (!active) {
            return
          }

          setError(exception instanceof Error ? exception.message : 'Unknown error')
        }
      } catch (exception) {
        if (!active) {
          return
        }

        setError(exception instanceof Error ? exception.message : 'Unknown error')
      } finally {
        if (active) {
          setCaseLoading(false)
          setRequestState(hasActiveSession ? 'idle' : 'blocked')
        }
      }
    }

    void initializeSession()

    return () => {
      active = false
    }
  }, [isLoaded, isSignedIn, request])

  useEffect(() => {
    return subscribe((event) => {
      if (debug) {
        console.log('[UI RECEIVED EVENT]', event.type)
      }

      if (event.type === 'REWARD_TRIGGERED') {
        if (debug) {
          console.log('[UI STATE UPDATE] REWARD_TRIGGERED', event)
        }

        setXpEarned(event.xp)
        void queryClient.invalidateQueries({ queryKey: ['leaderboard'] })
        void queryClient.invalidateQueries({ queryKey: ['progress'] })
      }
    })
  }, [debug, queryClient])

  const submitGuess = useCallback(async (): Promise<GameResult> => {
    const trimmed = guess.trim()
    if (!trimmed || !sessionId || submittingRef.current || requestState !== 'idle' || result?.gameOver) {
      throw new Error('Cannot submit guess in current state')
    }

    submittingRef.current = true
    setRequestState('submitting')

    try {
      emit({ type: 'SUBMIT_GUESS' })
      const response = await submitGuessApi(request, { guess: trimmed, sessionId })
      setResult(response)
      setClueIndex(response.clueIndex)
      if (response.case) {
        setCaseData(response.case)
      }
      setGuesses((previous) => [...previous, { guess: trimmed, label: response.label }])
      emit({ type: 'RESULT_RECEIVED', result: response })
      setXpEarned(0)
      setError(null)
      setGuess('')
      return response
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Unknown error')
      throw exception instanceof Error ? exception : new Error('Unknown error')
    } finally {
      submittingRef.current = false
      setRequestState(sessionId ? 'idle' : 'blocked')
    }
  }, [guess, request, requestState, result?.gameOver, sessionId])

  const hasActiveSession = Boolean(sessionId)
  const loading = requestState === 'submitting'
  const isGameOver = Boolean(result?.gameOver)
  const canSubmit = hasActiveSession && !loading && !isGameOver
  const blockReason = !hasActiveSession && !caseLoading ? 'Daily limit reached. Come back tomorrow.' : null

  return {
    guess,
    setGuess,
    result,
    caseData,
    clueIndex,
    caseLoading,
    loading,
    error,
    xpEarned,
    submitGuess,
    isGameOver,
    guesses,
    explanation: result?.explanation ?? null,
    hasActiveSession,
    canSubmit,
    blockReason,
    requestState,
  }
}
