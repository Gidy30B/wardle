import { useEffect, useRef, useState } from 'react'
import GamePlaySection from '../features/game/GamePlaySection'
import { useGameEngine } from '../features/game/useGameEngine'
import { useLeaderboard } from '../features/leaderboard/leaderboard.hook'
import LeaderboardSection from '../features/leaderboard/LeaderboardSection'
import ExplanationPage from './ExplanationPage'
import type { LeaderboardMode } from '../features/game/game.types'
import BottomSheet from '../components/ui/BottomSheet'

type SheetType = 'leaderboard' | 'explanation' | 'menu' | 'howto' | null

export default function GamePage() {
  const [activeSheet, setActiveSheet] = useState<SheetType>(null)
  const [mode, setMode] = useState<LeaderboardMode>('daily')
  const transitionTimeoutRef = useRef<number | null>(null)
  const game = useGameEngine()
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
      <div className="h-[100dvh] overflow-hidden bg-black text-white">
        <main className="h-full min-h-0 w-full overflow-hidden pb-[env(safe-area-inset-bottom)]">
          <GamePlaySection
            mode={game.mode}
            caseData={game.caseData}
            clueIndex={game.clueIndex}
            caseLoading={game.isLoadingCase}
            error={game.error}
            guess={game.guess}
            onGuessChange={game.changeGuess}
            onClearGuess={game.clearGuess}
            onBackspace={game.backspaceGuess}
            onSubmit={game.submitGuess}
            submitDisabled={game.submitDisabled}
            guesses={game.attempts}
            blockReason={game.unavailableReason}
            waitingCountdownText={game.waitingCountdownText}
            onContinue={game.continueGame}
            onWhy={() => openSheet('explanation')}
            onOpenExplanation={() => openSheet('explanation')}
            onOpenMenu={() => openSheet('menu')}
            onReload={game.reloadSession}
            reward={game.reward}
            canOpenExplanation={game.canOpenExplanation}
          />
        </main>
      </div>

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
        ) : null}
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
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white/80 transition hover:border-white/20 hover:bg-white/10 md:px-4 md:py-2.5"
              onClick={() => openSheet('leaderboard')}
            >
              Leaderboard
            </button>
          </div>

          <div>
            <p className="mb-1 text-xs text-white/60">Learn</p>
            <button
              type="button"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white/80 transition hover:border-white/20 hover:bg-white/10 md:px-4 md:py-2.5"
              onClick={() => openSheet('howto')}
            >
              How to play
            </button>
          </div>

          <div>
            <p className="mb-1 text-xs text-white/60">Account</p>
            <button
              type="button"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white/80 transition hover:border-white/20 hover:bg-white/10 md:px-4 md:py-2.5"
              onClick={() => setActiveSheet(null)}
            >
              Progress
            </button>
          </div>

          <div className="border-t border-white/10 pt-4">
            <p className="text-sm text-white/70">Unlock unlimited cases</p>
            <button
              type="button"
              className="mt-2 w-full rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 md:px-4 md:py-2.5"
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
            <li>Read the revealed clinical clues.</li>
            <li>Submit your best diagnosis guess.</li>
            <li>Wrong guesses reveal more clues.</li>
            <li>Score improves with fewer attempts.</li>
          </ul>
        </div>
      </BottomSheet>
    </>
  )
}
