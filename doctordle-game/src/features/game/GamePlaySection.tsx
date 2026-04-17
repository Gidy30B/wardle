import { useCallback, useMemo, useRef } from 'react'
import type { GameCase } from './game.types'
import type { GameAttempt, GameEngineMode, GameRewardState } from './useGameEngine'
import PhaserGameSession from './phaser/PhaserGameSession'
import type { PhaserGameSessionIntents, PhaserGameSessionSnapshot } from './phaser/gameSessionBridge'

type GamePlaySectionProps = {
  mode: GameEngineMode
  caseData: GameCase | null
  clueIndex: number
  caseLoading: boolean
  error: string | null
  guess: string
  onGuessChange: (value: string) => void
  onClearGuess: () => void
  onBackspace: () => void
  onSubmit: () => void
  submitDisabled: boolean
  guesses?: GameAttempt[]
  blockReason?: string | null
  waitingCountdownText?: string | null
  onContinue?: () => void
  onWhy?: () => void
  onReload?: () => void
  onOpenMenu: () => void
  reward: GameRewardState
  canOpenExplanation: boolean
  onOpenExplanation: () => void
}

export default function GamePlaySection({
  mode,
  caseData,
  clueIndex,
  caseLoading,
  error,
  guess,
  onGuessChange,
  onClearGuess,
  onBackspace,
  onSubmit,
  submitDisabled,
  guesses = [],
  blockReason,
  waitingCountdownText,
  onContinue,
  onWhy,
  onReload,
  onOpenMenu,
  reward,
  canOpenExplanation,
  onOpenExplanation,
}: GamePlaySectionProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const latestAttempt = guesses.at(-1)
  const unavailableMessage = error ?? blockReason ?? 'No case available right now.'
  const visibleClues = useMemo(() => {
    return (caseData?.clues ?? [])
      .filter((clue) => clue.order <= clueIndex)
      .map((clue, _index, array) => ({
        id: clue.id,
        type: clue.type,
        value: clue.value,
        isNewest: clue.id === array[array.length - 1]?.id,
      }))
  }, [caseData, clueIndex])

  const headerStatus = useMemo(() => {
    if (mode.type === 'SUBMITTING') {
      return 'Checking'
    }

    if (mode.type === 'FINAL_FEEDBACK') {
      return latestAttempt?.label === 'correct' ? 'Solved' : 'Round over'
    }

    if (latestAttempt?.label === 'close') {
      return 'Close'
    }

    if (latestAttempt?.label === 'wrong') {
      return 'Keep going'
    }

    return null
  }, [latestAttempt?.label, mode.type])

  const snapshot = useMemo<PhaserGameSessionSnapshot>(
    () => ({
      mode: mode.type,
      isLoading: caseLoading,
      totalClues: caseData?.clues.length ?? 0,
      revealedClueCount: visibleClues.length,
      visibleClues,
      latestAttempt: latestAttempt ?? null,
      guess,
      canEditGuess: mode.type === 'PLAYING',
      submitDisabled,
      canOpenExplanation,
      waitingCountdownText: mode.type === 'WAITING' ? waitingCountdownText ?? '00:00:00' : null,
      unavailableReason: mode.type === 'BLOCKED' ? unavailableMessage : null,
      canRetry: mode.type === 'BLOCKED' && Boolean(error),
      feedbackLabel: latestAttempt?.label ?? null,
      finalDiagnosis: mode.type === 'FINAL_FEEDBACK' ? latestAttempt?.guess ?? null : null,
      headerStatus,
      reward,
    }),
    [
      canOpenExplanation,
      caseLoading,
      caseData?.clues.length,
      error,
      headerStatus,
      guess,
      latestAttempt,
      mode.type,
      reward,
      submitDisabled,
      unavailableMessage,
      visibleClues,
      waitingCountdownText,
    ],
  )

  const intents = useMemo<PhaserGameSessionIntents>(
    () => ({
      onKeyPress: (value: string) => {
        if (mode.type !== 'PLAYING') {
          return
        }

        onGuessChange(`${guess}${value}`.toUpperCase())
      },
      onSubmit,
      onContinue: onContinue ?? (() => undefined),
      onOpenExplanation: onWhy ?? onOpenExplanation,
      onOpenMenu,
      onClearGuess,
      onBackspace,
      onReload: onReload ?? (() => undefined),
    }),
    [guess, mode.type, onBackspace, onClearGuess, onContinue, onGuessChange, onOpenExplanation, onOpenMenu, onReload, onSubmit, onWhy],
  )

  const handleHiddenInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onGuessChange(event.target.value.toUpperCase())
    },
    [onGuessChange],
  )

  const handleHiddenInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        onSubmit()
      }
    },
    [onSubmit],
  )

  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden">
      <input
        ref={inputRef}
        value={guess}
        onChange={handleHiddenInputChange}
        onKeyDown={handleHiddenInputKeyDown}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        className="pointer-events-none absolute left-0 top-0 h-px w-px opacity-0"
        aria-label="Diagnosis input"
      />

      <div className="flex-1 min-h-0">
        <PhaserGameSession snapshot={snapshot} intents={intents} className="h-full w-full" />
      </div>
    </section>
  )
}
