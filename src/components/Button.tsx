import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  isLoading?: boolean
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-forest text-white hover:bg-forest-deep focus-visible:outline-forest disabled:bg-forest/50',
  secondary:
    'bg-brass text-white hover:bg-brass-light focus-visible:outline-brass disabled:bg-brass/50',
  ghost:
    'bg-transparent text-forest-deep hover:bg-forest-mist focus-visible:outline-forest disabled:text-ink-soft',
}

export function Button({
  variant = 'primary',
  isLoading = false,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-body text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...rest}
    >
      {isLoading ? 'Entrando…' : children}
    </button>
  )
}
