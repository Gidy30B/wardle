type ProgressState =
  | 'correct'
  | 'danger'
  | 'warning'
  | 'active'
  | 'revealed'
  | 'locked'

type ReactGameProgressProps = {
  states: ProgressState[]
}

export default function ReactGameProgress({
  states,
}: ReactGameProgressProps) {
  return (
    <div className="flex gap-1.5">
      {states.map((state, index) => {
        const className =
          state === 'correct'
            ? 'bg-[var(--wardle-color-teal)]'
            : state === 'danger'
              ? 'bg-[var(--wardle-color-red)]'
              : state === 'warning'
                ? 'bg-[var(--wardle-color-amber)]'
                : state === 'active'
                  ? 'bg-[rgba(0,180,166,0.42)]'
                  : state === 'revealed'
                    ? 'bg-[rgba(0,180,166,0.22)]'
                    : 'bg-white/8'

        return (
          <span
            key={`${state}-${index}`}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${className}`}
            style={state !== 'locked' ? { animation: 'wardle-progress-bloom 220ms ease-out' } : undefined}
          />
        )
      })}
    </div>
  )
}
