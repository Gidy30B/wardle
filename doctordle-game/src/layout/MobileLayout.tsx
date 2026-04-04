import type { ReactNode } from 'react'

type MobileLayoutProps = {
  children: ReactNode
  header?: ReactNode
  footer: ReactNode
}

export default function MobileLayout({ children, header, footer }: MobileLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col sm:px-6">
        {header}

        <main className="flex-1 p-3">
          <div className="space-y-4">{children}</div>
        </main>

        <footer className="sticky bottom-0 border-t border-slate-200 bg-slate-100/95 px-4 pb-[env(safe-area-inset-bottom)] pt-3 backdrop-blur">
          {footer}
        </footer>
      </div>
    </div>
  )
}
