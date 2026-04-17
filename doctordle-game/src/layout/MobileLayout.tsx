import type { ReactNode } from 'react'

type MobileLayoutProps = {
  children: ReactNode
  header?: ReactNode
  footer: ReactNode
}

export default function MobileLayout({ children, header, footer }: MobileLayoutProps) {
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-black text-white">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col px-3 md:px-6 lg:px-8">
        {header}

        <main className="flex flex-1 min-h-0 py-3 md:py-4">
          <div className="mx-auto h-full w-full max-w-[42rem]">{children}</div>
        </main>

        {footer ? (
          <footer className="h-[72px] shrink-0 border-t border-white/10 bg-black/80 pb-[env(safe-area-inset-bottom)] backdrop-blur">
            <div className="mx-auto flex h-full w-full max-w-[42rem] items-center px-2 md:px-3">
              {footer}
            </div>
          </footer>
        ) : null}
      </div>
    </div>
  )
}
