import { useEffect, useRef } from 'react'

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

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <form
      className="flex items-center gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={isDisabled}
        placeholder="Enter diagnosis"
        className="h-14 flex-1 rounded-2xl border border-slate-300 bg-white px-4 text-base text-slate-950 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:bg-slate-100"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
      />
      <button
        type="submit"
        disabled={isDisabled || !value.trim()}
        className="h-14 rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {isLoading ? 'Sending...' : !hasActiveSession ? 'Unavailable' : isGameOver ? 'Trial ended' : 'Submit'}
      </button>
    </form>
  )
}
