import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

type BottomSheetProps = {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  ariaLabel?: string
  className?: string
}

export default function BottomSheet({
  isOpen,
  onClose,
  children,
  ariaLabel = 'Bottom sheet',
  className = '',
}: BottomSheetProps) {
  if (!isOpen || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className={`fixed inset-x-0 bottom-0 top-0 z-[90] flex h-[100dvh] w-screen flex-col justify-end ${className}`}
    >
      <button
        type="button"
        aria-label="Close bottom sheet"
        className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,180,166,0.12),transparent_32%),rgba(3,7,14,0.78)]"
        onClick={onClose}
      />

      <div className="animate-slide-up relative max-h-[calc(100dvh-var(--wardle-bottom-nav-height)-0.75rem)] w-full overflow-y-auto rounded-t-[28px] border-t border-white/10 bg-[linear-gradient(180deg,rgba(19,33,49,0.98),rgba(8,14,24,0.98))] p-4 shadow-[0_40px_100px_rgba(0,0,0,0.42)] backdrop-blur-xl">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/20 sm:hidden" />
        {children}
      </div>
    </div>,
    document.body,
  )
}
