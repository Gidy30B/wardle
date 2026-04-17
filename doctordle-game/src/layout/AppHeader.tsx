import { UserButton } from '@clerk/clerk-react'
import { Menu } from 'lucide-react'

type AppHeaderProps = {
  onOpenMenu: () => void
}

export default function AppHeader({ onOpenMenu }: AppHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3 backdrop-blur-md md:px-6 md:py-4 xl:px-8">
      <div className="flex items-center gap-2 md:gap-3">
        <button
          type="button"
          onClick={onOpenMenu}
          className="inline-flex items-center justify-center rounded-lg border border-white/10 px-2.5 py-1.5 text-sm text-white/70 transition hover:border-white/20 hover:bg-white/10 hover:text-white md:px-3"
          aria-label="Open menu"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div className="text-lg font-bold tracking-tight text-white md:text-xl">Wardle</div>
      </div>

      <UserButton afterSignOutUrl="/" />
    </div>
  )
}
