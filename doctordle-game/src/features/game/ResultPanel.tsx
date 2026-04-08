import type { GameResult } from './game.types'

type ResultPanelProps = {
  result: GameResult | null
  xpEarned: number
  streak?: number
}

export default function ResultPanel({ result, xpEarned, streak = 0 }: ResultPanelProps) {
  if (!result) {
    return null
  }

  const isCorrect = result.label === 'correct'

  return (
    <div className="animate-[fadeIn_0.25s_ease] rounded-2xl bg-white/5 p-4 text-center">
      <p className="text-lg font-semibold text-white">
        {isCorrect ? 'Correct diagnosis' : 'Incorrect diagnosis'}
      </p>

      <p className="mt-1 text-sm text-white/60">+{xpEarned} XP</p>
      <p className="text-sm text-white/60">Streak: {streak}</p>
    </div>
  )
}