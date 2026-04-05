import type { UserProgress } from './game.types'
import { Trophy, Star } from 'lucide-react'

type ProgressSectionProps = {
  progress: UserProgress | null
  loading: boolean
}

export default function ProgressSection({ progress, loading }: ProgressSectionProps) {
  if (loading && !progress) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/5 p-3 shadow-sm">
        <p className="text-sm text-white/70">Loading progress...</p>
      </section>
    )
  }

  if (!progress) {
    return null
  }

  const xp = progress.xpTotal ?? 0
  const level = progress.level ?? 1

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-3 shadow-sm">
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="flex flex-col items-center">
          <Trophy className="h-5 w-5 text-emerald-400" />
          <p className="text-sm font-semibold text-white">Lv {level}</p>
          <p className="text-xs text-white/70">Level</p>
        </div>

        <div className="flex flex-col items-center">
          <Star className="h-5 w-5 text-amber-400" />
          <p className="text-sm font-semibold text-white">{xp}</p>
          <p className="text-xs text-white/70">XP</p>
        </div>
      </div>
    </section>
  )
}
