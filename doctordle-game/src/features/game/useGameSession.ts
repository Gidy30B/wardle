import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQueryClient } from '@tanstack/react-query'
import { startGameApi, submitGuessApi } from './game.api'
import type { GameCase, GameResult, RequestState } from './game.types'
import { useApi } from '../../lib/api'

export function useGameSession() {
  const { isLoaded, isSignedIn } = useAuth()
  const { request } = useApi()
  const queryClient = useQueryClient()
  const hasStartedRef = useRef(false)
  const submittingRef = useRef(false)
  const [guess, setGuess] = useState('')
  const [result, setResult] = useState<GameResult | null>(null)
  const [attemptLabels, setAttemptLabels] = useState<Array<'correct' | 'close' | 'wrong'>>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [caseData, setCaseData] = useState<GameCase | null>(null)
  const [caseLoading, setCaseLoading] = useState(true)
  const [requestState, setRequestState] = useState<RequestState>('loading')
  const [error, setError] = useState<string | null>(null)

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
          setResult(null)
          setAttemptLabels([])
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

  const submitGuess = useCallback(async () => {
    const trimmed = guess.trim()
    if (!trimmed || !sessionId || submittingRef.current || requestState !== 'idle' || result?.gameOver) {
      return
    }

    submittingRef.current = true
    setRequestState('submitting')

    try {
      const response = await submitGuessApi(request, { guess: trimmed, sessionId })
      setResult(response)
      setAttemptLabels((previous) => [...previous, response.label])
      if (response.case) {
        setCaseData(response.case)
      }
      await queryClient.invalidateQueries({ queryKey: ['leaderboard'] })
      await queryClient.invalidateQueries({ queryKey: ['progress'] })
      setError(null)
      setGuess('')
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Unknown error')
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
    caseLoading,
    loading,
    error,
    submitGuess,
    isGameOver,
    attemptLabels,
    explanation: result?.explanation ?? null,
    hasActiveSession,
    canSubmit,
    blockReason,
    requestState,
  }
}
