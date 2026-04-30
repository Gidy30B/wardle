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
  xpTotal: number | null
  organizationName: string | null
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
  xpTotal,
  organizationName,
  onPlay,
}: RankTabPageProps) {
  // TODO(data-gap): accuracy is hidden because current progress/leaderboard models do not expose it yet.
  const accuracy = null

  return (
    <main className="flex h-full min-h-0 w-full flex-1 flex-col overflow-y-auto px-1 pb-6 pt-1 sm:px-2">
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
        xpTotal={xpTotal}
        organizationName={organizationName}
        accuracy={accuracy}
        onPlay={onPlay}
      />
    </main>
  )
}
