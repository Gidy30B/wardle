import type { HTMLAttributes, ReactNode } from 'react'

type SurfaceCardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode
  as?: 'section' | 'div'
  eyebrow?: string
  title?: string
}

export default function SurfaceCard({
  as = 'section',
  children,
  eyebrow,
  title,
  className,
  ...props
}: SurfaceCardProps) {
  const Component = as

  return (
    <Component
      {...props}
      className={[
        'rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(26,60,94,0.2),rgba(30,30,44,0.88))] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.24)] backdrop-blur-xl md:p-5 lg:p-6',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--wardle-color-teal)]/80">
          {eyebrow}
        </p>
      ) : null}
      {title ? (
        <h2 className="mt-2 text-lg font-extrabold text-[var(--wardle-color-mint)] md:text-xl">
          {title}
        </h2>
      ) : null}
      <div className={eyebrow || title ? 'mt-4' : ''}>{children}</div>
    </Component>
  )
}
