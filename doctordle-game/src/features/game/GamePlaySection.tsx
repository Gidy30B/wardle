import { useEffect, useMemo, useState } from 'react'
import CaseCard from '../../components/CaseCard'
import FeedbackPanel from '../../components/FeedbackPanel'
import type { GameFlowState } from './useGameFlow'
import type { GameResult } from './game.types'
import GameKeyboard from './GameKeyboard'

type GamePlaySectionProps = {
  state: GameFlowState
  caseData: Parameters<typeof CaseCard>[0]['caseData']
  caseLoading: boolean
  error: string | null
  guess: string
  onGuessChange: (value: string) => void
  onSubmit: () => void
  submitDisabled: boolean
  result?: GameResult | null
  attemptLabels?: Array<{ guess: string; label: 'correct' | 'close' | 'wrong' }>
  finalResult?: GameResult | null
  blockReason?: string | null
  xpEarned?: number
  streak?: number
  onContinue?: () => void
  onWhy?: () => void
  canOpenExplanation: boolean
  onOpenExplanation: () => void
}

export default function GamePlaySection({
  state,
  caseData,
  caseLoading,
  error,
  guess,
  onGuessChange,
  onSubmit,
  submitDisabled,
  result,
  attemptLabels = [],
  finalResult,
  blockReason,
  xpEarned = 0,
  streak = 0,
  onContinue,
  onWhy,
  canOpenExplanation,
  onOpenExplanation,
}: GamePlaySectionProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (state.type !== 'WAITING') {
      return
    }

    const tick = () => {
      const current = Date.now()
      setNow(current)
      const remaining = state.nextCaseAt.getTime() - current
      if (remaining <= 0) {
        return undefined
      }

      return window.setTimeout(tick, Math.min(1000, remaining))
    }

    const timeout = tick()

    return () => {
      if (timeout !== undefined) {
        window.clearTimeout(timeout)
      }
    }
  }, [state])

  const waitingCountdownText = useMemo(() => {
    if (state.type !== 'WAITING') {
      return null
    }

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
  const shouldShowCaseCard = state.type !== 'WAITING'
  const activeResult = state.type === 'WAITING' ? null : finalResult ?? result ?? null

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 px-2 pb-2">
        {shouldShowCaseCard ? (
          <CaseCard
            caseData={caseData}
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
            <p className="mt-1 text-2xl font-semibold text-white">{waitingCountdownText ?? '00:00:00'}</p>
          </section>
        ) : null}

        {!caseLoading && !caseData && blockReason ? (
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center text-sm text-white/70">
            {blockReason}
          </section>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-white/10 bg-black px-2 py-2">
        <div className="space-y-3">
          {shouldShowKeyboard ? (
            <section>
              <div className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center text-sm text-white">
                {guess || <span className="text-white/30">Type diagnosis...</span>}
              </div>
            </section>
          ) : null}

          {activeResult ? (
            <FeedbackPanel
              result={activeResult}
              hasActiveSession={state.type !== 'WAITING'}
              currentStreak={streak}
              xpEarned={xpEarned}
              attemptLabels={attemptLabels}
            />
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

          {shouldShowKeyboard ? (
            <div
              style={{
                paddingBottom: 'env(safe-area-inset-bottom)',
              }}
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
      </div>
    </section>
  )
}
