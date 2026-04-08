import type { ReactNode } from 'react'

type MobileLayoutProps = {
  children: ReactNode
  header?: ReactNode
  footer: ReactNode
}

export default function MobileLayout({ children, header, footer }: MobileLayoutProps) {
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-black text-white">
      <div className="mx-auto flex h-full w-full max-w-md flex-col sm:px-6">
        {header}

        <main className="flex flex-1 min-h-0 p-3">
          <div className="h-full w-full">{children}</div>
        </main>

        {footer ? (
          <footer className="h-[72px] shrink-0 border-t border-white/10 px-2 flex items-center bg-black/80 pb-[env(safe-area-inset-bottom)] backdrop-blur">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  )
}
