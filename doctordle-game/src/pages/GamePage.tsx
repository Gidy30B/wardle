import { useEffect, useMemo, useRef, useState } from 'react'
import { useGameSession } from '../features/game/useGameSession'
import GamePlaySection from '../features/game/GamePlaySection'
import { FloatingReward } from '../features/game/FloatingReward'
import ProgressSection from '../features/game/ProgressSection'
import GameKeyboard from '../features/game/GameKeyboard'
import { useGameFlow } from '../features/game/useGameFlow'
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
  const [now, setNow] = useState(() => Date.now())
  const transitionTimeoutRef = useRef<number | null>(null)
  const game = useGameSession()
  const progress = useUserProgress()
  const leaderboard = useLeaderboard(mode)

  const flow = useGameFlow(game)

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

  useEffect(() => {
    if (flow.state.type !== 'WAITING') {
      return
    }

    const waitingState = flow.state

    const tick = () => {
      const current = Date.now()
      setNow(current)
      const remaining = waitingState.nextCaseAt.getTime() - current
      if (remaining <= 0) {
        return undefined
      }

      const timeout = window.setTimeout(tick, Math.min(1000, remaining))
      return timeout
    }

    const initialTimeout = tick()

    return () => {
      if (initialTimeout !== undefined) {
        window.clearTimeout(initialTimeout)
      }
    }
  }, [flow.state])

  const waitingCountdownText = useMemo(() => {
    if (flow.state.type !== 'WAITING') {
      return null
    }

    const msLeft = Math.max(0, flow.state.nextCaseAt.getTime() - now)
    const totalSeconds = Math.floor(msLeft / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    const hh = String(hours).padStart(2, '0')
    const mm = String(minutes).padStart(2, '0')
    const ss = String(seconds).padStart(2, '0')
    return `${hh}:${mm}:${ss}`
  }, [flow.state, now])

  const renderScreen = () => {
    switch (flow.state.type) {
      case 'PLAYING':
      case 'SUBMITTING':
        return (
          <GamePlaySection
            caseData={game.caseData}
            caseLoading={game.caseLoading}
            error={game.error}
            attemptLabels={game.attemptLabels}
            onOpenExplanation={() => openSheet('explanation')}
            canOpenExplanation={Boolean(game.explanation)}
          />
        )
      case 'FINAL_FEEDBACK':
        return (
          <GamePlaySection
            caseData={game.caseData}
            caseLoading={false}
            error={null}
            attemptLabels={game.attemptLabels}
            finalResult={flow.state.result}
            streak={progress.progress?.currentStreak}
            onContinue={flow.continueGame}
            onWhy={() => openSheet('explanation')}
            onOpenExplanation={() => openSheet('explanation')}
            canOpenExplanation={Boolean(game.explanation)}
          />
        )
      case 'WAITING':
        return (
          <div className="space-y-3">
            <ProgressSection
              progress={progress.progress}
              loading={progress.loading}
              onOpenLeaderboard={() => openSheet('leaderboard')}
            />
            <section className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
              <p className="text-sm text-white/60">Case completed</p>
              <p className="text-sm text-white/70">Next case available in</p>
              <p className="mt-1 text-2xl font-semibold text-white">{waitingCountdownText ?? '00:00:00'}</p>
            </section>
          </div>
        )
      default:
        return null
    }
  }

  // Helper to get badge color for attempt result  
  const getBadgeColor = (label: 'correct' | 'close' | 'wrong') => {
    switch (label) {
      case 'correct':
        return 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200'
      case 'close':
        return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-200'
      case 'wrong':
        return 'bg-gray-500/20 border-gray-500/50 text-gray-300'
    }
  }

  return (
    <>
      <div className="min-h-screen flex flex-col bg-black">
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
          <header className="shrink-0 border-b border-white/10 bg-black">
            <AppHeader onOpenMenu={() => openSheet('menu')} />
          </header>

          <main className="flex-1 px-2">
            <div className="flex flex-col gap-3 py-2">
              {renderScreen()}

              <section>
                {game.attemptLabels.length > 0 && (() => {
                  const latest = game.attemptLabels.at(-1)

                  if (!latest) {
                    return null
                  }

                  return (
                    <div
                      className={`w-full rounded-lg border px-3 py-2 text-center text-sm ${getBadgeColor(latest.label)}`}
                    >
                      {latest.guess}
                    </div>
                  )
                })()}
              </section>

              <section>
                <div className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center text-sm text-white">
                  {game.guess || <span className="text-white/30">Type diagnosis…</span>}
                </div>
              </section>
            </div>
          </main>

          <div className="shrink-0" />

          <div
            className="sticky bottom-0 bg-black"
            style={{
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
          >
            <GameKeyboard
              value={game.guess}
              onChange={game.setGuess}
              onSubmit={flow.submitGuess}
              disabled={flow.isSubmitting || game.loading}
            />
          </div>
        </div>
      </div>

      <FloatingReward reward={progress.rewardEvent} />

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
              🏆 Leaderboard
            </button>
          </div>

          <div>
            <p className="mb-1 text-xs text-white/60">Learn</p>
            <button
              type="button"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white/80"
              onClick={() => openSheet('howto')}
            >
              💡 How to play
            </button>
          </div>

          <div>
            <p className="mb-1 text-xs text-white/60">Account</p>
            <button
              type="button"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white/80"
              onClick={() => setActiveSheet(null)}
            >
              📊 Progress
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
