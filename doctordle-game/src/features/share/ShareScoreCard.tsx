import DesignedShareCard from './DesignedShareCard'
import type { GameAttempt } from '../game/useGameEngine'

type ShareScoreCardProps = {
  attempts: GameAttempt[]
  score: number
  streak: number
  result: 'correct' | 'failed'
  onClose: () => void
}

export default function ShareScoreCard({
  attempts,
  score,
  streak,
  result,
  onClose,
}: ShareScoreCardProps) {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col gap-4 px-1 pb-10 pt-1 sm:px-2">
      <DesignedShareCard
        data={{
          caseId: null,
          result,
          attemptsUsed: attempts.length,
          cluesUsed: attempts.length,
          totalClues: Math.max(6, attempts.length),
          score,
          streak,
          xpTotal: null,
          school: null,
          attemptLabels: attempts.map((attempt) => attempt.label),
        }}
        onClose={onClose}
      />
    </main>
  )
}
