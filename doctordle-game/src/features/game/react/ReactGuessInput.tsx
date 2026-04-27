import type { KeyboardEvent } from 'react'
import Button from '../../../components/ui/Button'
import type { RoundDiagnosisSuggestion } from '../round.types'

type GuessInputTone = 'neutral' | 'warning' | 'danger' | 'success'

type ReactGuessInputProps = {
  value: string
  suggestions: RoundDiagnosisSuggestion[]
  highlightedSuggestionIndex: number
  canEdit: boolean
  canSubmit: boolean
  submitDisabled: boolean
  isSubmitting: boolean
  tone: GuessInputTone
  statusLabel: string | null
  attemptsRemaining: number
  onChange: (value: string) => void
  onSubmit: () => void
  onSelectSuggestion: (index: number) => void
  onMoveSuggestionHighlight: (direction: -1 | 1) => void
  onSelectHighlightedSuggestion: () => boolean
}

export default function ReactGuessInput({
  value,
  suggestions,
  highlightedSuggestionIndex,
  canEdit,
  canSubmit,
  submitDisabled,
  isSubmitting,
  tone,
  statusLabel,
  attemptsRemaining,
  onChange,
  onSubmit,
  onSelectSuggestion,
  onMoveSuggestionHighlight,
  onSelectHighlightedSuggestion,
}: ReactGuessInputProps) {
  const borderClass =
    tone === 'danger'
      ? 'border-[rgba(224,92,92,0.6)]'
      : tone === 'warning'
        ? 'border-[rgba(244,162,97,0.55)]'
        : tone === 'success'
          ? 'border-[rgba(0,180,166,0.55)]'
          : 'border-[rgba(0,180,166,0.3)]'

  const statusClass =
    tone === 'danger'
      ? 'text-[var(--wardle-color-red)]'
      : tone === 'warning'
        ? 'text-[var(--wardle-color-amber)]'
        : tone === 'success'
          ? 'text-[var(--wardle-color-teal)]'
          : 'text-white/50'

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()

      if (canSubmit) {
        onSubmit()
        return
      }

      void onSelectHighlightedSuggestion()
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      onMoveSuggestionHighlight(1)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      onMoveSuggestionHighlight(-1)
    }
  }

  return (
    <div className="border-t border-white/8 bg-[rgba(30,30,44,0.96)] px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-3xl">
        {suggestions.length > 0 ? (
          <div className="mb-2 overflow-hidden rounded-[16px] border border-[rgba(0,180,166,0.2)] bg-[var(--wardle-color-navy)]">
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.diagnosisRegistryId}
                type="button"
                onClick={() => onSelectSuggestion(index)}
                className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition ${
                  highlightedSuggestionIndex === index
                    ? 'bg-white/8 text-[var(--wardle-color-mint)]'
                    : 'text-white/75'
                } ${index < suggestions.length - 1 ? 'border-b border-white/6' : ''}`}
              >
                <span>{suggestion.displayLabel}</span>
                <span className="font-brand-mono text-[9px] uppercase tracking-[0.16em] text-white/35">
                  {suggestion.matchKind.replace('_', ' ')}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex items-center gap-2.5">
          <div className={`flex min-w-0 flex-1 items-center rounded-[16px] border bg-[rgba(26,60,94,0.42)] px-4 py-3 transition ${borderClass}`}>
            <input
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!canEdit}
              placeholder="Type your diagnosis..."
              className="w-full bg-transparent text-sm text-[var(--wardle-color-mint)] outline-none placeholder:text-white/28 disabled:cursor-not-allowed disabled:text-white/40"
            />
          </div>

          <Button
            type="button"
            block={false}
            onClick={onSubmit}
            disabled={!canEdit || !canSubmit || submitDisabled}
            className="flex h-[50px] w-[52px] items-center justify-center rounded-[16px] px-0 py-0 text-xl"
          >
            {isSubmitting ? '...' : '→'}
          </Button>
        </div>

        <div className="mt-2 flex items-center justify-between gap-3">
          <p className={`text-xs ${statusClass}`}>{statusLabel ?? 'Select a diagnosis suggestion to submit.'}</p>
          <p className="text-xs text-white/42">{attemptsRemaining} attempts left</p>
        </div>
      </div>
    </div>
  )
}
