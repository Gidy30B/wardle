import { memo, useCallback, type MouseEvent } from 'react'
import Button from '../../components/ui/Button'
import WardleLogo from '../../components/brand/WardleLogo'
import type {
  LeaderboardEntry,
  LeaderboardMode,
  UserLeaderboardPosition,
} from './leaderboard.types'
import type { AppIconSet } from '../../theme/icons'

type LeaderboardSectionProps = {
  iconSet: AppIconSet
  mode: LeaderboardMode
  onModeChange: (mode: LeaderboardMode) => void
  leaderboard: LeaderboardEntry[]
  loading: boolean
  error?: string | null
  currentUserId: string | null
  currentUserPosition: UserLeaderboardPosition | null
  currentStreak: number | null
  xpTotal: number | null
  organizationName: string | null
  accuracy: number | null
  onPlay: () => void
}

function formatCompletionTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatScore(score: number) {
  if (score >= 1000) {
    return `${(score / 1000).toFixed(1)}k`
  }

  return String(score)
}

function getDisplayName(entry: LeaderboardEntry, currentUserId: string | null) {
  if (entry.userId === currentUserId) {
    return 'You'
  }

  if (entry.displayName?.trim()) {
    return entry.displayName.trim()
  }

  return `Player ${entry.userId.slice(0, 4)}`
}

function getInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
    .slice(0, 2)

  return initials || '?'
}

function LeaderboardSection({
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
  accuracy,
  onPlay,
}: LeaderboardSectionProps) {
  const safeLeaderboard = Array.isArray(leaderboard) ? leaderboard : []
  const maxScore = Math.max(
    ...safeLeaderboard.map((entry) => entry.score),
    currentUserPosition?.score ?? 0,
    1,
  )
  const topThree = safeLeaderboard.slice(0, 3)
  const podiumEntries = [topThree[1], topThree[0], topThree[2]].filter(
    (entry): entry is LeaderboardEntry => Boolean(entry),
  )

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
    <section className="w-full">
      <div className="overflow-hidden rounded-[26px] border border-white/[0.06] bg-[var(--wardle-color-charcoal)] shadow-[0_22px_54px_rgba(0,0,0,0.22)] transition-opacity duration-200">
      <div className="relative overflow-hidden bg-[linear-gradient(145deg,rgba(26,60,94,0.94),rgba(30,30,44,0.96)_68%)] px-5 py-5">
        <div className="pointer-events-none absolute -right-16 -top-16 size-44 rounded-full bg-[rgba(0,180,166,0.18)] blur-3xl" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-white/[0.06]" />
        <div className="relative mb-4 flex items-center justify-between gap-4">
          <WardleLogo size="sm" />
          <div className="text-sm font-semibold text-white/55">{iconSet.rank} Leaderboard</div>
        </div>

        <div className="wardle-nav-pill relative mb-3">
          {(['global', 'school', 'friends'] as const).map((scope) => {
            const isGlobal = scope === 'global'

            return (
              <button
                key={scope}
                type="button"
                disabled={!isGlobal}
                title={isGlobal ? undefined : 'Coming soon when leaderboard profiles expose this scope.'}
                className={`px-3 py-2 text-xs font-semibold capitalize transition ${
                  isGlobal
                    ? 'bg-[var(--wardle-color-teal)] text-white'
                    : 'cursor-not-allowed text-white/32'
                }`}
              >
                {scope}
              </button>
            )
          })}
        </div>

        <div className="relative flex flex-wrap gap-2">
          <PeriodButton active={mode === 'daily'} onClick={handleModeChange('daily')}>
            Daily
          </PeriodButton>
          <PeriodButton active={mode === 'weekly'} onClick={handleModeChange('weekly')}>
            Weekly
          </PeriodButton>
          <button
            type="button"
            disabled
            title="Coming soon when the leaderboard API supports all-time rankings."
            className="cursor-not-allowed rounded-full border border-transparent px-3 py-1.5 text-xs font-semibold text-white/32"
          >
            All-time
          </button>
        </div>
      </div>

      <div className="min-h-[240px] px-5 py-4 transition-opacity duration-200">
        {error ? (
          <p className="text-sm text-rose-300/90">Failed to load leaderboard.</p>
        ) : loading ? (
          <p className="text-sm text-white/70">Loading leaderboard...</p>
        ) : safeLeaderboard.length === 0 ? (
          <p className="text-sm text-white/70">No entries yet.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-end justify-center gap-2 sm:gap-3">
              {podiumEntries.map((entry, index) => (
                <PodiumPlayer
                  key={`${mode}-podium-${entry.rank}-${entry.userId}`}
                  entry={entry}
                  index={index}
                  displayName={getDisplayName(entry, currentUserId)}
                  school={getPodiumSchoolName({
                    entry,
                    currentUserId,
                    organizationName,
                  })}
                />
              ))}
            </div>

            {safeLeaderboard.length < 2 ? (
              <p className="rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-sm leading-6 text-white/62">
                More players will appear here after completing today&apos;s case.
              </p>
            ) : null}

            <div className="space-y-2">
              {safeLeaderboard.slice(3).map((entry, index) => (
                <LeaderboardRow
                  key={`${mode}-${entry.rank}-${entry.userId}`}
                  entry={entry}
                  displayName={getDisplayName(entry, currentUserId)}
                  meta={getEntryMeta({
                    entry,
                    currentUserId,
                    currentStreak,
                    organizationName,
                    includeTime: true,
                    iconSet,
                  })}
                  isCurrentUser={entry.userId === currentUserId}
                  progressWidth={`${Math.max(4, Math.round((entry.score / maxScore) * 100))}%`}
                  animationDelay={`${0.1 + index * 0.05}s`}
                />
              ))}
            </div>
          </div>
        )}

        {!loading && currentUserId && !isCurrentUserInTopList ? (
          currentUserPosition ? (
            <div className="mt-3 border-t border-white/10 pt-3">
              <LeaderboardRow
                entry={currentUserPosition}
                displayName="You"
                meta={getEntryMeta({
                  entry: currentUserPosition,
                  currentUserId,
                  currentStreak,
                  organizationName,
                  includeTime: true,
                  iconSet,
                })}
                isCurrentUser
                progressWidth={`${Math.max(
                  4,
                  Math.round((currentUserPosition.score / maxScore) * 100),
                )}%`}
                animationDelay="0s"
              />
            </div>
          ) : (
            <p className="mt-4 rounded-[20px] border border-[var(--wardle-color-teal)]/30 bg-[rgba(0,180,166,0.1)] p-4 text-sm text-white/70">
              Complete a game to enter this leaderboard.
            </p>
          )
        ) : null}
      </div>

      <div className="px-5 pb-5">
        <div className="rounded-[16px] border border-[rgba(0,180,166,0.25)] bg-[linear-gradient(135deg,rgba(0,180,166,0.15),rgba(26,60,94,0.4))] p-4">
          <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[var(--wardle-color-teal)]">
            Your Stats This {mode === 'daily' ? 'Day' : 'Week'}
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <RankStat label={`${iconSet.rank} Rank`} value={currentUserPosition ? `#${currentUserPosition.rank}` : '--'} />
            <RankStat label={`${iconSet.streak} Streak`} value={currentStreak != null ? String(currentStreak) : '--'} />
            <RankStat
              label={`${iconSet.time} Points`}
              value={
                xpTotal != null
                  ? formatScore(xpTotal)
                  : currentUserPosition
                    ? formatScore(currentUserPosition.score)
                    : '--'
              }
            />
            <RankStat label={`${iconSet.accuracy} Accuracy`} value={accuracy != null ? `${Math.round(accuracy)}%` : '--'} />
          </div>
          <div className="mt-3">
            <Button type="button" variant="ghost" onClick={onPlay} className="py-2.5 text-xs">
              Play today's case
            </Button>
          </div>
        </div>
      </div>
      </div>
    </section>
  )
}

function PeriodButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: (event: MouseEvent<HTMLButtonElement>) => void
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? 'border-[rgba(244,162,97,0.28)] bg-[rgba(244,162,97,0.2)] text-[var(--wardle-color-amber)]'
          : 'border-transparent text-white/55 hover:bg-white/[0.06]'
      }`}
    >
      {children}
    </button>
  )
}

function PodiumPlayer({
  entry,
  index,
  displayName,
  school,
}: {
  entry: LeaderboardEntry
  index: number
  displayName: string
  school: string
}) {
  const colors = ['#8A9BB0', '#F4A261', '#CD7F32']
  const heights = ['h-[90px]', 'h-[110px]', 'h-[75px]']
  const badge = entry.rank === 1 ? '\u{1F3C6}' : entry.rank === 2 ? '\u{1F948}' : '\u{1F949}'

  return (
    <div className="min-w-0 flex-1 text-center">
      <div className="mb-1.5">
        <div
          className="mx-auto mb-1 flex size-[42px] items-center justify-center rounded-full text-[18px] font-black text-white"
          style={{
            background: `linear-gradient(135deg, ${colors[index]}, ${colors[index]}88)`,
            boxShadow: `0 4px 16px ${colors[index]}44`,
          }}
        >
          {getInitials(displayName)}
        </div>
        <div className="truncate text-[11px] font-bold text-[var(--wardle-color-mint)]">
          {displayName}
        </div>
        <div className="truncate text-[10px] text-white/42">{school}</div>
      </div>
      <div
        className={`${heights[index]} flex flex-col items-center justify-start rounded-t-[8px] border px-2 pt-2`}
        style={{
          borderColor: `${colors[index]}44`,
          background: `linear-gradient(180deg, ${colors[index]}33, ${colors[index]}11)`,
        }}
      >
        <div className="text-[20px]">{badge}</div>
        <div className="mt-1 text-xs font-black" style={{ color: colors[index] }}>
          {formatScore(entry.score)}
        </div>
      </div>
    </div>
  )
}

function LeaderboardRow({
  entry,
  displayName,
  meta,
  isCurrentUser,
  progressWidth,
  animationDelay,
}: {
  entry: LeaderboardEntry
  displayName: string
  meta: string
  isCurrentUser: boolean
  progressWidth: string
  animationDelay: string
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-[14px] border p-3 transition-colors ${
        isCurrentUser
          ? 'border-[rgba(0,180,166,0.35)] bg-[rgba(0,180,166,0.1)]'
          : 'border-white/5 bg-[rgba(26,60,94,0.2)]'
      }`}
      style={{ animation: `wardle-slide-up 0.28s ease ${animationDelay} both` }}
    >
      <div
        className={`flex size-7 shrink-0 items-center justify-center rounded-[8px] text-xs font-bold ${
          isCurrentUser
            ? 'bg-[var(--wardle-color-teal)] text-white'
            : 'bg-white/[0.07] text-white/55'
        }`}
      >
        {entry.rank}
      </div>
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--wardle-color-navy),rgba(0,180,166,0.34))] text-sm font-black text-[var(--wardle-color-mint)]">
        {getInitials(displayName)}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={`truncate text-sm font-bold ${
            isCurrentUser ? 'text-[var(--wardle-color-teal)]' : 'text-[var(--wardle-color-mint)]'
          }`}
        >
          {displayName}
          {isCurrentUser ? (
            <span className="ml-1 text-[10px] text-[var(--wardle-color-teal)]">(You)</span>
          ) : null}
        </div>
        <div className="truncate text-[11px] text-white/45">{meta}</div>
      </div>
      <div className="w-16 shrink-0 text-right">
        <div className="text-sm font-bold text-[var(--wardle-color-mint)]">{formatScore(entry.score)}</div>
        <div className="mt-1 h-1 rounded-full bg-white/[0.07]">
          <div
            className={`h-full rounded-full ${
              isCurrentUser ? 'bg-[var(--wardle-color-teal)]' : 'bg-white/45'
            }`}
            style={{ width: progressWidth }}
          />
        </div>
      </div>
    </div>
  )
}

function getEntryMeta({
  entry,
  currentUserId,
  currentStreak,
  organizationName,
  includeTime,
  iconSet,
}: {
  entry: LeaderboardEntry
  currentUserId: string | null
  currentStreak: number | null
  organizationName: string | null
  includeTime: boolean
  iconSet: AppIconSet
}) {
  const parts: string[] = []

  const publicOrganizationName =
    entry.organizationName ?? (entry.userId === currentUserId ? organizationName : null)
  const publicStreak = entry.streak ?? (entry.userId === currentUserId ? currentStreak : null)

  if (publicOrganizationName) {
    parts.push(publicOrganizationName)
  }

  if (publicStreak != null) {
    parts.push(`${iconSet.streak} ${publicStreak}`)
  }

  parts.push(`${iconSet.clues} ${entry.attemptsCount} attempts`)

  if (includeTime) {
    parts.push(`${iconSet.time} ${formatCompletionTime(entry.completedAt)}`)
  }

  return parts.join(' - ')
}

function getPodiumSchoolName({
  entry,
  currentUserId,
  organizationName,
}: {
  entry: LeaderboardEntry
  currentUserId: string | null
  organizationName: string | null
}) {
  return entry.organizationName ?? (entry.userId === currentUserId ? organizationName : null) ?? '--'
}

function RankStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-base font-black text-[var(--wardle-color-mint)]">{value}</div>
      <div className="mt-1 text-[10px] text-white/45">{label}</div>
    </div>
  )
}

export default memo(LeaderboardSection)
