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
      {!hasActiveSession && blockReason && <p className="text-sm text-white/60">{blockReason}</p>}
    </div>
  )
}
