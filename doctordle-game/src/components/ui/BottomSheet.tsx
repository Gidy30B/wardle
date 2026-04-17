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
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      <div className="animate-slide-up relative max-h-[80%] overflow-y-auto rounded-t-2xl bg-black/80 p-4 shadow-xl backdrop-blur-xl sm:max-h-[88vh] sm:w-full sm:max-w-3xl sm:rounded-3xl sm:border sm:border-white/10 sm:p-5 lg:max-w-5xl lg:p-6">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
        {children}
      </div>
    </div>
  )
}
