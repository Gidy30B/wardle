import { memo, useCallback, type MouseEvent } from 'react'
import type {
  LeaderboardEntry,
  LeaderboardMode,
  UserLeaderboardPosition,
} from './leaderboard.types'

type LeaderboardSectionProps = {
  mode: LeaderboardMode
  onModeChange: (mode: LeaderboardMode) => void
  leaderboard: LeaderboardEntry[]
  loading: boolean
  error?: string | null
  currentUserId: string | null
  currentUserPosition: UserLeaderboardPosition | null
}

function formatCompletionTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function LeaderboardSection({
  mode,
  onModeChange,
  leaderboard,
  loading,
  error,
  currentUserId,
  currentUserPosition,
}: LeaderboardSectionProps) {
  const safeLeaderboard = Array.isArray(leaderboard) ? leaderboard : []

  const isCurrentUserInTopList = Boolean(
    currentUserId && safeLeaderboard.some((entry) => entry.userId === currentUserId),
  )

  const handleModeChange = useCallback(
    (nextMode: LeaderboardMode) => (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      event.stopPropagation()
      onModeChange(nextMode)
    },
    [onModeChange],
  )

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-sm transition-opacity duration-200">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Leaderboard</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Top players</h2>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleModeChange('daily')}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              mode === 'daily'
                ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300'
                : 'border-white/10 bg-white/5 text-white/70'
            }`}
          >
            Daily
          </button>
          <button
            type="button"
            onClick={handleModeChange('weekly')}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              mode === 'weekly'
                ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300'
                : 'border-white/10 bg-white/5 text-white/70'
            }`}
          >
            Weekly
          </button>
        </div>
      </div>

      <div className="min-h-[240px] transition-opacity duration-200">
        {error ? (
          <p className="text-sm text-rose-600">Failed to load leaderboard.</p>
        ) : loading ? (
          <p className="text-sm text-white/70">Loading leaderboard...</p>
        ) : safeLeaderboard.length === 0 ? (
          <p className="text-sm text-white/70">No entries yet.</p>
        ) : (
          <div className="min-h-[240px] overflow-x-auto">
            <table className="w-full text-left text-sm text-white/80">
              <thead>
                <tr className="text-xs uppercase tracking-[0.12em] text-white/60">
                  <th className="pb-2">Rank #</th>
                  <th className="pb-2">User</th>
                  <th className="pb-2">Score</th>
                  <th className="pb-2">Attempts</th>
                  <th className="pb-2">Completion time</th>
                </tr>
              </thead>
              <tbody>
                {(safeLeaderboard || []).map((entry) => {
                  const isCurrentUser = entry.userId === currentUserId

                  return (
                    <tr
                      key={`${mode}-${entry.rank}-${entry.userId}`}
                      className={`border-t border-white/10 transition-colors ${
                        isCurrentUser ? 'border-l-4 border-l-emerald-400 bg-emerald-500/10 font-semibold' : ''
                      }`}
                    >
                      <td className="py-2">{entry.rank}</td>
                      <td className="py-2">
                        {isCurrentUser ? 'You' : `Player ${entry.userId.slice(0, 4)}`}
                      </td>
                      <td className="py-2">{entry.score}</td>
                      <td className="py-2">{entry.attemptsCount}</td>
                      <td className="py-2">{formatCompletionTime(entry.completedAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && currentUserId && !isCurrentUserInTopList && (
          <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-white/80">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-300">Your position</p>
            {currentUserPosition ? (
              <div className="mt-2 grid grid-cols-5 gap-2">
                <p>#{currentUserPosition.rank}</p>
                <p className="col-span-1">You</p>
                <p>{currentUserPosition.score}</p>
                <p>{currentUserPosition.attemptsCount}</p>
                <p>{formatCompletionTime(currentUserPosition.completedAt)}</p>
              </div>
            ) : (
              <p className="mt-2">Complete a game to enter this leaderboard.</p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

export default memo(LeaderboardSection)
