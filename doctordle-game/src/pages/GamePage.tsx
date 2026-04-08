import { useCallback, useEffect, useRef, useState } from 'react'
import { useGameSession } from '../features/game/useGameSession'
import GamePlaySection from '../features/game/GamePlaySection'
import { FloatingReward } from '../features/game/FloatingReward'
import ProgressSection from '../features/game/ProgressSection'
import { useGameFlow } from '../features/game/useGameFlow'
import { useGameEvents } from '../features/game/events/useGameEvents'
import type { GameEvent } from '../features/game/events/game.events'
import { useLeaderboard } from '../features/leaderboard/leaderboard.hook'
import LeaderboardSection from '../features/leaderboard/LeaderboardSection'
import { useUserProgress } from '../features/user-progress/useUserProgress'
import ExplanationPage from './ExplanationPage'
import type { LeaderboardMode } from '../features/game/game.types'
import AppHeader from '../layout/AppHeader'
import BottomSheet from '../components/ui/BottomSheet'

type SheetType = 'leaderboard' | 'explanation' | 'menu' | 'howto' | null

export default function GamePage() {
  const [activeSheet, setActiveSheet] = useState<SheetType>(null)
  const [mode, setMode] = useState<LeaderboardMode>('daily')
  const transitionTimeoutRef = useRef<number | null>(null)
  const progress = useUserProgress()
  const game = useGameSession()
  const leaderboard = useLeaderboard(mode)
  const flow = useGameFlow(game)

  const handleGameEvent = useCallback((event: GameEvent) => {
    if (event.type !== 'RESULT_RECEIVED') return

    console.log('[GameEvent:RESULT_RECEIVED]', event.result)
  }, [])

  useGameEvents(handleGameEvent)

  const openSheet = (sheet: Exclude<SheetType, null>) => {
    if (transitionTimeoutRef.current !== null) {
      window.clearTimeout(transitionTimeoutRef.current)
    }

    if (activeSheet === null) {
      setActiveSheet(sheet)
      return
    }

    setActiveSheet(null)
    transitionTimeoutRef.current = window.setTimeout(() => {
      setActiveSheet(sheet)
      transitionTimeoutRef.current = null
    }, 150)
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveSheet(null)
      }
    }

    window.addEventListener('keydown', handler)

    return () => {
      window.removeEventListener('keydown', handler)
      if (transitionTimeoutRef.current !== null) {
        window.clearTimeout(transitionTimeoutRef.current)
      }
    }
  }, [])

  return (
    <>
      <div className="flex h-[100dvh] flex-col overflow-hidden bg-black">
        <div className="mx-auto flex h-full min-h-0 w-full max-w-md flex-col">
          <header className="shrink-0 border-b border-white/10 bg-black">
            <AppHeader onOpenMenu={() => openSheet('menu')} />
          </header>

          <main className="flex-1 min-h-0 px-2">
            <div className="flex flex-col gap-3 py-2">
              {flow.state.type === 'WAITING' ? (
                <ProgressSection
                  progress={progress.progress}
                  loading={progress.loading}
                  onOpenLeaderboard={() => openSheet('leaderboard')}
                />
              ) : null}

              <GamePlaySection
                state={flow.state}
                caseData={game.caseData}
                caseLoading={game.caseLoading}
                error={game.error}
                guess={game.guess}
                onGuessChange={game.setGuess}
                onSubmit={flow.submitGuess}
                submitDisabled={flow.isSubmitting || game.loading || !game.canSubmit}
                result={game.result}
                attemptLabels={game.attemptLabels}
                finalResult={flow.state.type === 'FINAL_FEEDBACK' ? flow.state.result : null}
                blockReason={game.blockReason}
                xpEarned={game.xpEarned}
                streak={progress.progress?.currentStreak}
                onContinue={flow.continueGame}
                onWhy={() => openSheet('explanation')}
                onOpenExplanation={() => openSheet('explanation')}
                canOpenExplanation={Boolean(game.explanation)}
              />
            </div>
          </main>
        </div>
      </div>

      <FloatingReward />

      <BottomSheet isOpen={activeSheet === 'leaderboard'} onClose={() => setActiveSheet(null)}>
        <LeaderboardSection
          mode={mode}
          onModeChange={setMode}
          leaderboard={leaderboard.leaderboard}
          loading={leaderboard.loading}
          error={leaderboard.error}
          currentUserId={leaderboard.currentUserId}
          currentUserPosition={leaderboard.currentUserPosition}
        />
      </BottomSheet>

      <BottomSheet isOpen={activeSheet === 'explanation'} onClose={() => setActiveSheet(null)}>
        {game.explanation ? (
          <ExplanationPage explanation={game.explanation} onBack={() => setActiveSheet(null)} />
        ) : (
          <p className="text-sm text-white/70">No explanation available yet.</p>
        )}
      </BottomSheet>

      <BottomSheet isOpen={activeSheet === 'menu'} onClose={() => setActiveSheet(null)}>
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Wardle</h2>
            <button type="button" onClick={() => setActiveSheet(null)} className="text-sm text-white/70">
              Close
            </button>
          </div>

          <div>
            <p className="mb-1 text-xs text-white/60">Play</p>
            <button
              type="button"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white/80"
              onClick={() => openSheet('leaderboard')}
            >
              Leaderboard
            </button>
          </div>

          <div>
            <p className="mb-1 text-xs text-white/60">Learn</p>
            <button
              type="button"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white/80"
              onClick={() => openSheet('howto')}
            >
              How to play
            </button>
          </div>

          <div>
            <p className="mb-1 text-xs text-white/60">Account</p>
            <button
              type="button"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white/80"
              onClick={() => setActiveSheet(null)}
            >
              Progress
            </button>
          </div>

          <div className="border-t border-white/10 pt-4">
            <p className="text-sm text-white/70">Unlock unlimited cases</p>
            <button
              type="button"
              className="mt-2 w-full rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-white"
            >
              Go Premium
            </button>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet isOpen={activeSheet === 'howto'} onClose={() => setActiveSheet(null)}>
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-white">How to play</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-white/70">
            <li>Read the history and revealed symptoms.</li>
            <li>Submit your best diagnosis guess.</li>
            <li>Wrong guesses reveal more clues.</li>
            <li>Score improves with fewer attempts.</li>
          </ul>
        </div>
      </BottomSheet>
    </>
  )
}
