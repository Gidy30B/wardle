import { useEffect, useRef, useState } from 'react'
import MobileLayout from '../layout/MobileLayout'
import { useGameSession } from '../features/game/useGameSession'
import GamePlaySection from '../features/game/GamePlaySection'
import ProgressSection from '../features/game/ProgressSection'
import FeedbackSection from '../features/game/FeedbackSection'
import FooterInput from '../features/game/FooterInput'
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
  const game = useGameSession()
  const progress = useUserProgress()
  const leaderboard = useLeaderboard(mode)

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
      <MobileLayout
        header={<AppHeader onOpenMenu={() => openSheet('menu')} />}
        footer={
          <FooterInput
            value={game.guess}
            onChange={game.setGuess}
            onSubmit={game.submitGuess}
            hasActiveSession={game.hasActiveSession}
            isLoading={game.loading}
            isGameOver={game.isGameOver}
            blockReason={game.blockReason}
          />
        }
      >
        <ProgressSection
          progress={progress.progress}
          loading={progress.loading}
          onOpenLeaderboard={() => openSheet('leaderboard')}
        />

        <GamePlaySection
          caseData={game.caseData}
          caseLoading={game.caseLoading}
          error={game.error}
          onOpenExplanation={() => openSheet('explanation')}
          canOpenExplanation={Boolean(game.explanation)}
        />
        <FeedbackSection
          result={game.result}
          currentStreak={progress.progress?.currentStreak ?? 0}
          xpEarned={progress.xpEarned}
          attemptLabels={game.attemptLabels}
        />
      </MobileLayout>

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
