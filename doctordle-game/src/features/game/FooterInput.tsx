import GuessInput from '../../components/GuessInput'

type FooterInputProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  hasActiveSession: boolean
  isLoading: boolean
  isGameOver: boolean
  blockReason: string | null
}

export default function FooterInput({
  value,
  onChange,
  onSubmit,
  hasActiveSession,
  isLoading,
  isGameOver,
  blockReason,
}: FooterInputProps) {
  const isBlocked = !hasActiveSession && !isLoading && !isGameOver

  return (
    <div className="space-y-2">
      <GuessInput
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        hasActiveSession={hasActiveSession}
        isLoading={isLoading}
        isGameOver={isGameOver}
      />

      {isBlocked && (
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-3">
          <p className="text-sm font-semibold text-white">Daily case complete</p>
          <p className="mt-1 text-xs text-white/70">Practice unlimited cases with Premium</p>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-400"
            >
              Go Premium
            </button>
            <button
              type="button"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/10"
            >
              Maybe later
            </button>
          </div>

          {blockReason ? <p className="mt-2 text-[11px] text-white/50">{blockReason}</p> : null}
        </div>
      )}
    </div>
  )
}
