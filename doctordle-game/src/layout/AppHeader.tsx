import { UserButton } from '@clerk/clerk-react'

type AppHeaderProps = {
  progressSummary: {
    streak: number
    rank: string
  }
  onOpenMenu: () => void
}

export default function AppHeader({ progressSummary, onOpenMenu }: AppHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenMenu}
          className="rounded-md border border-white/10 px-2 py-1 text-sm text-white/70"
          aria-label="Open menu"
        >
          ☰
        </button>
        <div className="text-lg font-bold tracking-tight text-white">Wardle</div>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <div className="font-semibold text-orange-500">🔥 {progressSummary.streak}</div>
        <div className="rounded-full bg-emerald-500/20 px-2 py-1 text-xs font-semibold text-emerald-400">
          {progressSummary.rank}
        </div>
      </div>

      <UserButton afterSignOutUrl="/" />
    </div>
  )
}
