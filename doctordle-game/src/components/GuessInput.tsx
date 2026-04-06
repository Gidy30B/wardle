import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

type GuessInputProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  hasActiveSession?: boolean
  isLoading?: boolean
  isGameOver?: boolean
}

export default function GuessInput({
  value,
  onChange,
  onSubmit,
  hasActiveSession,
  isLoading,
  isGameOver,
}: GuessInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const isDisabled = Boolean(!hasActiveSession || isLoading || isGameOver)
  const isPremiumLocked = !hasActiveSession && !isLoading && !isGameOver
  const hasValue = value.trim().length > 0

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <form
      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-2"
      onSubmit={(event) => {
        event.preventDefault()
        if (isPremiumLocked) {
          console.log('Go Premium clicked')
          return
        }

        onSubmit()
      }}
    >
      <motion.input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={isDisabled}
        placeholder={
          isGameOver
            ? 'Trial complete'
            : !hasActiveSession
            ? 'Session unavailable'
            : 'Enter diagnosis...'
        }
        className={`
          h-14 flex-1 rounded-xl px-4 text-base outline-none transition-all
          border border-white/10 bg-black/20 text-white placeholder:text-white/40

          focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/10

          ${isDisabled ? 'cursor-not-allowed opacity-60' : ''}
        `}
        whileFocus={{ scale: 1.01 }}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
      />

      <motion.button
        type="submit"
        disabled={isLoading || isGameOver || (!value.trim() && hasActiveSession)}
        whileTap={{ scale: 0.96 }}
        whileHover={!isLoading && !isGameOver && (hasValue || isPremiumLocked) ? { scale: 1.02 } : {}}
        className={`h-14 rounded-xl px-5 text-sm font-semibold transition active:scale-[0.99]
          ${
            isPremiumLocked || hasValue
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
              : 'border border-white/10 bg-white/5 text-white/80'
          }
          disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-white/40
        `}
      >
        {isLoading
          ? 'Sending...'
          : isPremiumLocked
          ? 'Go Premium'
          : isGameOver
          ? 'Trial ended'
          : 'Submit'}
      </motion.button>
    </form>
  )
}
