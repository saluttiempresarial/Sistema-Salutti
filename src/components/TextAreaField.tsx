import type { TextareaHTMLAttributes } from 'react'
import { useId } from 'react'

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
}

export function TextAreaField({ label, error, id, className = '', ...rest }: TextAreaFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="font-body text-xs font-semibold text-ink-soft">
        {label}
      </label>
      <textarea
        id={fieldId}
        className={`min-h-[140px] resize-y rounded-lg border px-3.5 py-2.5 font-body text-sm text-ink outline-none transition-colors focus:border-forest focus:ring-2 focus:ring-forest-mist ${
          error ? 'border-red-400' : 'border-ink-soft/25'
        } ${className}`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        {...rest}
      />
      {error && (
        <p id={`${fieldId}-error`} className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
