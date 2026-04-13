import { useEffect, useMemo, useState } from 'react'
import type { GameCase, GameResult } from './game.types'
import type { GameFlowState } from './useGameFlow'
import FeedbackPanel from '../../components/FeedbackPanel'
import GameKeyboard from './GameKeyboard'
import ClueTimeline from './components/ClueTimeline'

type GamePlaySectionProps = {
  state: GameFlowState
  caseData: GameCase | null
  clueIndex: number
  caseLoading: boolean
  error: string | null
  guess: string
  onGuessChange: (value: string) => void
  onSubmit: () => void
  submitDisabled: boolean
  result?: GameResult | null
  guesses?: Array<{ guess: string; label: 'correct' | 'close' | 'wrong' }>
  finalResult?: GameResult | null
  blockReason?: string | null
  xpEarned?: number
  onContinue?: () => void
  onWhy?: () => void
  canOpenExplanation: boolean
  onOpenExplanation: () => void
}

export default function GamePlaySection({
  state,
  caseData,
  clueIndex,
  caseLoading,
  error,
  guess,
  onGuessChange,
  onSubmit,
  submitDisabled,
  result: _result,
  guesses = [],
  finalResult: _finalResult,
  blockReason,
  xpEarned: _xpEarned = 0,
  onContinue,
  onWhy,
  canOpenExplanation,
  onOpenExplanation,
}: GamePlaySectionProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (state.type !== 'WAITING') return

    const tick = () => {
      const current = Date.now()
      setNow(current)
      const remaining = state.nextCaseAt.getTime() - current
      if (remaining <= 0) return undefined
      return window.setTimeout(tick, Math.min(1000, remaining))
    }

    const timeout = tick()

    return () => {
      if (timeout !== undefined) window.clearTimeout(timeout)
    }
  }, [state])

  const waitingCountdownText = useMemo(() => {
    if (state.type !== 'WAITING') return null

    const msLeft = Math.max(0, state.nextCaseAt.getTime() - now)
    const totalSeconds = Math.floor(msLeft / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    const hh = String(hours).padStart(2, '0')
    const mm = String(minutes).padStart(2, '0')
    const ss = String(seconds).padStart(2, '0')
    return `${hh}:${mm}:${ss}`
  }, [now, state])

  const shouldShowKeyboard = state.type === 'PLAYING' || state.type === 'SUBMITTING'
  const latestAttempt = guesses.at(-1)

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex-1 min-h-0 space-y-3 overflow-y-auto overscroll-y-contain px-2 pb-3">
        {state.type !== 'WAITING' ? (
          <ClueTimeline
            clues={caseData?.clues ?? []}
            clueIndex={clueIndex}
            isLoading={caseLoading}
            error={error}
            onOpenExplanation={onOpenExplanation}
            canOpenExplanation={canOpenExplanation}
          />
        ) : null}

        {state.type === 'WAITING' ? (
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-sm text-white/60">Case completed</p>
            <p className="text-sm text-white/70">Next case available in</p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {waitingCountdownText ?? '00:00:00'}
            </p>
          </section>
        ) : null}

        {!caseLoading && !caseData && blockReason ? (
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center text-sm text-white/70">
            {blockReason}
          </section>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-white/10 bg-black/95 px-2 py-2 backdrop-blur-sm">
        <div className="space-y-1.5">
          {latestAttempt ? <FeedbackPanel latestAttempt={latestAttempt} /> : null}

          {shouldShowKeyboard ? (
            <section>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <div className="flex-1 text-sm text-white">
                  {guess ? (
                    <>
                      {guess}
                      <span className="ml-0.5 animate-pulse">|</span>
                    </>
                  ) : (
                    <span className="text-white/30">Enter diagnosis...</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={!guess || submitDisabled}
                  className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Submit
                </button>
              </div>
            </section>
          ) : null}

          {state.type === 'FINAL_FEEDBACK' ? (
            <section className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onContinue}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Continue
              </button>
              <button
                type="button"
                onClick={onWhy ?? onOpenExplanation}
                disabled={!canOpenExplanation}
                className="rounded-xl bg-emerald-500 px-3 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Why this answer?
              </button>
            </section>
          ) : null}
        </div>

        {shouldShowKeyboard ? (
          <div
            className="px-2 pt-1"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <GameKeyboard
              value={guess}
              onChange={onGuessChange}
              onSubmit={onSubmit}
              disabled={submitDisabled}
            />
          </div>
        ) : null}
      </div>
    </section>
  )
}
