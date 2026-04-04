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
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close bottom sheet"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      <div className="animate-slide-up relative max-h-[80%] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300" />
        {children}
      </div>
    </div>
  )
}
