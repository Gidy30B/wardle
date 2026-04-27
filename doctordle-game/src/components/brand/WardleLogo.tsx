import { wardleColors } from '../../theme/tokens'

type WardleLogoProps = {
  size?: 'sm' | 'md' | 'lg'
  subtitle?: string | null
  className?: string
}

const sizeMap = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-[2rem]',
} as const

export default function WardleLogo({
  size = 'md',
  subtitle = null,
  className,
}: WardleLogoProps) {
  return (
    <div className={className}>
      <div className={`flex items-baseline gap-0.5 font-black uppercase tracking-[-0.04em] ${sizeMap[size]}`}>
        {['W', 'A', 'R', 'D', 'L'].map((letter) => (
          <span key={letter} className="text-[var(--wardle-color-mint)]">
            {letter}
          </span>
        ))}
        <span style={{ color: wardleColors.teal }}>E</span>
      </div>
      {subtitle ? (
        <p className="mt-1 text-[11px] uppercase tracking-[0.24em] text-white/45">
          {subtitle}
        </p>
      ) : null}
    </div>
  )
}
