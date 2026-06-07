import LeaderboardSection from '../../leaderboard/LeaderboardSection'
import type {
  LeaderboardEntry,
  LeaderboardMode,
  UserLeaderboardPosition,
} from '../../leaderboard/leaderboard.types'
import type { AppIconSet } from '../../../theme/icons'

type RankTabPageProps = {
  iconSet: AppIconSet
  mode: LeaderboardMode
  onModeChange: (mode: LeaderboardMode) => void
  leaderboard: LeaderboardEntry[]
  loading: boolean
  error: string | null
  currentUserId: string | null
  currentUserPosition: UserLeaderboardPosition | null
  currentStreak: number | null
  organizationName: string | null
  accuracy: number | null
  onPlay: () => void
}

export default function RankTabPage({
  iconSet,
  mode,
  onModeChange,
  leaderboard,
  loading,
  error,
  currentUserId,
  currentUserPosition,
  currentStreak,
  organizationName,
  accuracy,
  onPlay,
}: RankTabPageProps) {
  return (
    <main className="flex h-full min-h-0 w-full flex-1 flex-col overflow-y-auto bg-[var(--wardle-color-charcoal)] pb-6">
      <LeaderboardSection
        iconSet={iconSet}
        mode={mode}
        onModeChange={onModeChange}
        leaderboard={leaderboard}
        loading={loading}
        error={error}
        currentUserId={currentUserId}
        currentUserPosition={currentUserPosition}
        currentStreak={currentStreak}
        organizationName={organizationName}
        accuracy={accuracy}
        onPlay={onPlay}
      />
    </main>
  )
}
