import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import type { GameResult } from './game.types'
import { useGameSession } from './useGameSession'

export type GameFlowState =
  | { type: 'PLAYING' }
  | { type: 'SUBMITTING' }
  | { type: 'FINAL_FEEDBACK'; result: GameResult }
  | { type: 'WAITING'; nextCaseAt: Date }

export type GameFlowEvent =
  | { type: 'SUBMIT_GUESS' }
  | { type: 'SUBMIT_SUCCESS'; result: GameResult }
  | { type: 'SUBMIT_ERROR' }
  | { type: 'CONTINUE'; gameOver: boolean; nextCaseAt?: Date }
  | { type: 'NEXT_CASE_READY' }

type UseGameFlowOptions = {
  onSubmitSuccess?: (result: GameResult) => void
}

type GameFlowGame = Pick<
  ReturnType<typeof useGameSession>,
  'submitGuess' | 'result' | 'hasActiveSession' | 'isGameOver'
> & {
  nextCaseAt?: Date
}

const SUBMIT_ACK_DELAY_MS = 180
const FINAL_TRANSITION_DELAY_MS = 250

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

export function gameFlowReducer(state: GameFlowState, event: GameFlowEvent): GameFlowState {
  switch (state.type) {
    case 'PLAYING': {
      if (event.type === 'SUBMIT_GUESS') {
        return { type: 'SUBMITTING' }
      }

      return state
    }
    case 'SUBMITTING': {
      if (event.type === 'SUBMIT_SUCCESS') {
        if (isFinalResult(event.result)) {
          return { type: 'FINAL_FEEDBACK', result: event.result }
        }

        return { type: 'PLAYING' }
      }

      if (event.type === 'SUBMIT_ERROR') {
        return { type: 'PLAYING' }
      }

      return state
    }
    case 'FINAL_FEEDBACK': {
      if (event.type === 'CONTINUE') {
        if (event.gameOver) {
          return {
            type: 'WAITING',
            nextCaseAt: event.nextCaseAt ?? getDefaultNextCaseAt(),
          }
        }

        return { type: 'PLAYING' }
      }

      return state
    }
    case 'WAITING': {
      if (event.type === 'NEXT_CASE_READY') {
        return { type: 'PLAYING' }
      }

      return state
    }
    default: {
      const _exhaustive: never = state
      void _exhaustive
      return state
    }
  }
}

export function useGameFlow(game: GameFlowGame, options?: UseGameFlowOptions) {
  const [state, dispatch] = useReducer(gameFlowReducer, { type: 'PLAYING' })
  const submittingRef = useRef(false)
  const didEntrySyncRef = useRef(false)
  const isMountedRef = useRef(true)

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const submitGuess = useCallback(async () => {
    if (state.type !== 'PLAYING' || submittingRef.current) {
      return
    }

    submittingRef.current = true
    dispatch({ type: 'SUBMIT_GUESS' })

    try {
      const result = (await game.submitGuess()) as GameResult

      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, SUBMIT_ACK_DELAY_MS)
      })

      if (isFinalResult(result)) {
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, FINAL_TRANSITION_DELAY_MS)
        })
      }

      if (!isMountedRef.current) {
        return
      }

      options?.onSubmitSuccess?.(result)

      dispatch({ type: 'SUBMIT_SUCCESS', result })
    } catch {
      if (!isMountedRef.current) {
        return
      }

      dispatch({ type: 'SUBMIT_ERROR' })
    } finally {
      submittingRef.current = false
    }
  }, [game, options?.onSubmitSuccess, state.type])

  const continueGame = useCallback(() => {
    dispatch({
      type: 'CONTINUE',
      gameOver: game.isGameOver,
      nextCaseAt: game.nextCaseAt,
    })
  }, [game.isGameOver, game.nextCaseAt])

  useEffect(() => {
    if (didEntrySyncRef.current) {
      return
    }

    didEntrySyncRef.current = true

    if (!game.hasActiveSession) {
      if (game.isGameOver) {
        dispatch({
          type: 'CONTINUE',
          gameOver: true,
          nextCaseAt: game.nextCaseAt,
        })
      } else if (game.result) {
        dispatch({
          type: 'SUBMIT_SUCCESS',
          result: game.result,
        })
      }
    }
  }, [game.hasActiveSession, game.isGameOver, game.nextCaseAt, game.result])

  useEffect(() => {
    if (state.type !== 'WAITING') {
      return
    }

    const delay = state.nextCaseAt.getTime() - Date.now()

    if (delay <= 0) {
      dispatch({ type: 'NEXT_CASE_READY' })
      return
    }

    const timeout = window.setTimeout(() => {
      dispatch({ type: 'NEXT_CASE_READY' })
    }, delay)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [state])

  const flags = useMemo(
    () => ({
      isPlaying: state.type === 'PLAYING',
      isSubmitting: state.type === 'SUBMITTING',
      isFinalFeedback: state.type === 'FINAL_FEEDBACK',
      isWaiting: state.type === 'WAITING',
    }),
    [state.type],
  )

  return {
    state,
    dispatch,
    submitGuess,
    continueGame,
    ...flags,
  }
}
