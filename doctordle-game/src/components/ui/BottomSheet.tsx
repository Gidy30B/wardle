import type { ReactNode } from 'react'

type BottomSheetProps = {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
}

export default function BottomSheet({ isOpen, onClose, children }: BottomSheetProps) {
  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center sm:p-4 lg:p-6">
      <button
        type="button"
        aria-label="Close bottom sheet"
        className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,180,166,0.12),transparent_32%),rgba(3,7,14,0.78)]"
        onClick={onClose}
      />

      <div className="animate-slide-up relative max-h-[80%] overflow-y-auto rounded-t-[28px] border-t border-white/10 bg-[linear-gradient(180deg,rgba(19,33,49,0.98),rgba(8,14,24,0.98))] p-4 shadow-[0_40px_100px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:max-h-[88vh] sm:w-full sm:max-w-4xl sm:rounded-[32px] sm:border sm:p-5 lg:max-w-5xl lg:p-6">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/20 sm:hidden" />
        {children}
      </div>
    </div>
  )
}
