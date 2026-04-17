interface GameKeyboardProps {
  className?: string
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  disabled?: boolean
}

export default function GameKeyboard({ className, value, onChange, onSubmit, disabled = false }: GameKeyboardProps) {
  const row1 = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P']
  const row2 = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L']
  const row3 = ['Z', 'X', 'C', 'V', 'B', 'N', 'M']

  const handleSpace = () => {
    if (disabled) return
    onChange(value + ' ')
  }

  const handleKeyPress = (letter: string) => {
    if (disabled) return
    onChange(value + letter)
  }

  const handleBackspace = () => {
    if (disabled) return
    onChange(value.slice(0, -1))
  }

  const handleSubmit = () => {
    if (disabled) return
    onSubmit()
  }

  return (
    <div className={`grid h-auto grid-rows-4 gap-1 border-t border-white/10 bg-black/80 px-2 pb-2 ${className ?? ''}`}>
      {/* Row 1: Q W E R T Y U I O P */}
      <div className="flex gap-1 justify-center">
        {row1.map((letter) => (
          <button
            key={letter}
            onClick={() => handleKeyPress(letter)}
            disabled={disabled}
            className="h-9 flex-1 rounded bg-white/10 text-sm text-white transition hover:bg-white/20 active:bg-white/30 disabled:opacity-50"
          >
            {letter}
          </button>
        ))}
      </div>

      {/* Row 2: A S D F G H J K L (offset) */}
      <div className="flex gap-1 justify-center px-4">
        {row2.map((letter) => (
          <button
            key={letter}
            onClick={() => handleKeyPress(letter)}
            disabled={disabled}
            className="h-9 flex-1 rounded bg-white/10 text-sm text-white transition hover:bg-white/20 active:bg-white/30 disabled:opacity-50"
          >
            {letter}
          </button>
        ))}
      </div>

      {/* Row 3: Z X C V B N M */}
      <div className="flex gap-1 justify-center px-2">
        {row3.map((letter) => (
          <button
            key={letter}
            onClick={() => handleKeyPress(letter)}
            disabled={disabled}
            className="h-9 flex-1 rounded bg-white/10 text-sm text-white transition hover:bg-white/20 active:bg-white/30 disabled:opacity-50"
          >
            {letter}
          </button>
        ))}
      </div>

      {/* Row 4: ENTER SPACE BACKSPACE */}
      <div className="flex gap-1 justify-center">
        <button
          onClick={handleSubmit}
          disabled={disabled}
          className="h-9 rounded bg-emerald-500/80 px-3 text-sm text-white transition hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-50 whitespace-nowrap"
        >
          ENTER
        </button>
        <button
          onClick={handleSpace}
          disabled={disabled}
          className="h-9 flex-1 rounded bg-white/10 text-white transition hover:bg-white/20 active:bg-white/30 disabled:opacity-50"
          title="Space"
        />
        <button
          onClick={handleBackspace}
          disabled={disabled}
          className="h-9 rounded bg-white/10 px-3 text-sm text-white transition hover:bg-white/20 active:bg-white/30 disabled:opacity-50 whitespace-nowrap"
        >
          ⌫
        </button>
      </div>
    </div>
  )
}
