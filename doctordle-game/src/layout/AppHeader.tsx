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
    <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenMenu}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700"
          aria-label="Open menu"
        >
          ☰
        </button>
        <div className="text-lg font-bold tracking-tight text-slate-950">Wardle</div>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <div className="font-semibold text-orange-500">🔥 {progressSummary.streak}</div>
        <div className="rounded-full bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700">
          {progressSummary.rank}
        </div>
      </div>

      <UserButton afterSignOutUrl="/" />
    </div>
  )
}
