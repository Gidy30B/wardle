import { UserButton } from '@clerk/clerk-react'

type AppHeaderProps = {
  onOpenMenu: () => void
}

export default function AppHeader({ onOpenMenu }: AppHeaderProps) {
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

      <UserButton afterSignOutUrl="/" />
    </div>
  )
}
