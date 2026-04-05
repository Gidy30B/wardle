import type { UserProgress } from './game.types'
import { Trophy, Star } from 'lucide-react'
import { motion } from 'framer-motion'

const rankOrder = ['Intern', 'Resident', 'Registrar', 'Consultant', 'Attending'] as const

type ProgressSectionProps = {
  progress: UserProgress | null
  loading: boolean
  onOpenLeaderboard: () => void
}

export default function ProgressSection({ progress, loading, onOpenLeaderboard }: ProgressSectionProps) {
  if (loading && !progress) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/5 p-3 shadow-sm">
        <p className="text-sm text-white/70">Loading progress...</p>
        <button
          type="button"
          onClick={onOpenLeaderboard}
          className="mt-2 text-xs font-medium text-emerald-400 transition hover:text-emerald-300"
        >
          View leaderboard →
        </button>
      </section>
    )
  }

  if (!progress) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/5 p-3 shadow-sm">
        <button
          type="button"
          onClick={onOpenLeaderboard}
          className="text-xs font-medium text-emerald-400 transition hover:text-emerald-300"
        >
          View leaderboard →
        </button>
      </section>
    )
  }

  const xp = progress.xpTotal ?? 0
  const level = progress.level ?? 1
  const streak = progress.currentStreak ?? 0
  const currentRank = progress.rank ?? 'Intern'
  const currentRankIndex = Math.max(
    0,
    rankOrder.findIndex((rank) => rank.toLowerCase() === currentRank.toLowerCase()),
  )
  const nextRank = rankOrder[Math.min(currentRankIndex + 1, rankOrder.length - 1)]

  const xpCurrentLevel = Math.max(0, progress.xpCurrentLevel ?? 0)
  const xpToNextLevel = Math.max(1, progress.xpToNextLevel ?? 1)
  const progressRatio = Math.max(0, Math.min(1, xpCurrentLevel / xpToNextLevel))
  const isNearRankUp = progressRatio > 0.8
  const progressTone =
    progressRatio < 0.3 ? 'bg-rose-400' : progressRatio <= 0.7 ? 'bg-amber-400' : 'bg-emerald-400'
  const progressGlow = isNearRankUp ? 'shadow-[0_0_14px_rgba(52,211,153,0.5)]' : ''

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-3 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">Rank Progress</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-300">
              {currentRank}
            </span>
            <span className="text-xs text-white/50">→</span>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/70">{nextRank}</span>
          </div>
        </div>

        <div className="text-right">
          <p className="text-sm font-semibold text-orange-400">🔥 {streak}</p>
          <p className="text-xs text-white/60">Current streak</p>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
        <div className="mb-2 flex items-center justify-between text-xs">
          <p className="text-white/70">XP to next rank</p>
          <p className="font-semibold text-white/80">
            {xpCurrentLevel} / {xpToNextLevel}
          </p>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <motion.div
            className={`h-full rounded-full ${progressTone} ${progressGlow} transition-[width,background-color,box-shadow] duration-500 ease-out`}
            initial={{ width: 0 }}
            animate={{ width: `${progressRatio * 100}%` }}
            style={{ width: `${progressRatio * 100}%` }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          />
        </div>

        <div className="mt-2 flex items-center justify-between text-xs text-white/60">
          <div className="flex items-center gap-1.5">
            <Trophy className="h-4 w-4 text-emerald-400" />
            <span>Lv {level}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Star className="h-4 w-4 text-amber-400" />
            <span>{xp} XP total</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenLeaderboard}
        className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-emerald-300 transition hover:bg-white/10"
      >
        View leaderboard →
      </button>
    </section>
  )
}
