import type { ReactNode } from 'react'

type MobileLayoutProps = {
  children: ReactNode
  header?: ReactNode
  footer: ReactNode
}

export default function MobileLayout({ children, header, footer }: MobileLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col sm:px-6">
        {header}

        <main className="flex-1 p-3">
          <div className="space-y-4">{children}</div>
        </main>

        <footer className="sticky bottom-0 border-t border-white/10 bg-black/80 px-4 pb-[env(safe-area-inset-bottom)] pt-3 backdrop-blur">
          {footer}
        </footer>
      </div>
    </div>
  )
}
