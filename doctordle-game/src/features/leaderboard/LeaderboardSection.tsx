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
  const isCurrentUserInTopList = Boolean(
    currentUserId && leaderboard.some((entry) => entry.userId === currentUserId),
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
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-opacity duration-200">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Leaderboard</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">Top players</h2>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleModeChange('daily')}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              mode === 'daily'
                ? 'border-sky-200 bg-sky-50 text-sky-700'
                : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            Daily
          </button>
          <button
            type="button"
            onClick={handleModeChange('weekly')}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              mode === 'weekly'
                ? 'border-sky-200 bg-sky-50 text-sky-700'
                : 'border-slate-200 bg-white text-slate-600'
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
          <p className="text-sm text-slate-600">Loading leaderboard...</p>
        ) : leaderboard.length === 0 ? (
          <p className="text-sm text-slate-600">No entries yet.</p>
        ) : (
          <div className="min-h-[240px] overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead>
                <tr className="text-xs uppercase tracking-[0.12em] text-slate-500">
                  <th className="pb-2">Rank #</th>
                  <th className="pb-2">User</th>
                  <th className="pb-2">Score</th>
                  <th className="pb-2">Attempts</th>
                  <th className="pb-2">Completion time</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry) => {
                  const isCurrentUser = entry.userId === currentUserId

                  return (
                    <tr
                      key={`${mode}-${entry.rank}-${entry.userId}`}
                      className={`border-t border-slate-100 transition-colors ${
                        isCurrentUser ? 'border-l-4 border-l-sky-500 bg-sky-50 font-semibold' : ''
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
          <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sm text-slate-700">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">Your position</p>
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
