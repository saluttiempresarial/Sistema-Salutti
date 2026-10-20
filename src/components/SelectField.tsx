import type { SelectHTMLAttributes } from 'react'
import { useId } from 'react'

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
  options: Array<{ value: string; label: string }>
  placeholder?: string
}

/** Select com o mesmo visual/comportamento do TextField (label, erro, foco). */
export function SelectField({
  label,
  error,
  options,
  placeholder,
  id,
  className = '',
  ...rest
}: SelectFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="font-mono text-xs uppercase tracking-wide text-ink-soft">
        {label}
      </label>
      <select
        id={fieldId}
        className={`rounded-lg border bg-white px-3.5 py-2.5 font-body text-sm text-ink outline-none transition-colors focus:border-forest focus:ring-2 focus:ring-forest-mist ${
          error ? 'border-red-400' : 'border-ink-soft/25'
        } ${className}`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        {...rest}
        // Valor nulo (ex.: licitação antiga ou leitura de edital sem o campo)
        // vira texto vazio; sem isso o React avisa no console e trata o campo
        // como não controlado. Só vale quando o campo é controlado (`value`).
        {...('value' in rest ? { value: rest.value ?? '' } : {})}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${fieldId}-error`} className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
