import { getVisibleStreak } from '../user-progress/streakVisibility'

type StreakBadgeProps = {
  streak: number
}

export default function StreakBadge({ streak }: StreakBadgeProps) {
  const visibleStreak = getVisibleStreak(streak)
  if (visibleStreak == null) {
    return null
  }

  return (
    <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
      🔥 {visibleStreak}
    </span>
  )
}
