import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'
import { wardleColors, wardleGradients, type WardleButtonVariant } from '../../theme/tokens'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: WardleButtonVariant
  block?: boolean
}

function getVariantStyle(variant: WardleButtonVariant): CSSProperties {
  switch (variant) {
    case 'secondary':
      return {
        background: 'transparent',
        borderColor: wardleColors.teal,
        color: wardleColors.teal,
      }
    case 'amber':
      return {
        background: wardleGradients.amber,
        borderColor: 'transparent',
        color: wardleColors.white,
      }
    case 'ghost':
      return {
        background: 'rgba(255,255,255,0.06)',
        borderColor: 'rgba(255,255,255,0.1)',
        color: wardleColors.mint,
      }
    default:
      return {
        background: wardleGradients.primary,
        borderColor: 'transparent',
        color: wardleColors.white,
      }
  }
}

export default function Button({
  children,
  variant = 'primary',
  block = true,
  className,
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={[
        'rounded-[14px] border px-4 py-3 text-sm font-bold tracking-[0.01em] transition',
        'disabled:cursor-not-allowed disabled:opacity-50',
        block ? 'w-full' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        ...getVariantStyle(variant),
        boxShadow: variant === 'primary' ? '0 16px 34px rgba(0,180,166,0.2)' : undefined,
        ...style,
      }}
    >
      {children}
    </button>
  )
}
