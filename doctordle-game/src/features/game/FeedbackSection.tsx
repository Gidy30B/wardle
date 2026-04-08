import FeedbackPanel from '../../components/FeedbackPanel'
import type { GameResult } from './game.types'

type FeedbackSectionProps = {
  result: GameResult | null
  hasActiveSession: boolean
  currentStreak: number
  xpEarned: number
  attemptLabels: Array<{ guess: string; label: 'correct' | 'close' | 'wrong' }>
}

export default function ResultContent({
  result,
  hasActiveSession,
  currentStreak,
  xpEarned,
  attemptLabels,
}: FeedbackSectionProps) {
  return (
    <>
      <FeedbackPanel
        result={result}
        hasActiveSession={hasActiveSession}
        currentStreak={currentStreak}
        xpEarned={xpEarned}
        attemptLabels={attemptLabels}
      />
    </>
  )
}
