import type { InputHTMLAttributes } from 'react'
import { useId, useState } from 'react'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

function IconOlho() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function IconOlhoFechado() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
    >
      <path d="M3 3l18 18" />
      <path d="M10.6 5.2A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a13.2 13.2 0 0 1-3.4 4.2M6.6 6.6C4 8.3 2 12 2 12s3.5 7 10 7c1.3 0 2.5-.2 3.6-.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  )
}

/** Campo de senha ganha um botão de "mostrar/ocultar" automaticamente —
 *  qualquer <TextField type="password" .../> no sistema já tem o olho,
 *  sem precisar mexer em cada tela (login, cadastro de funcionário, troca
 *  de senha etc.). Outros tipos de campo continuam exatamente como antes. */
export function TextField({ label, error, id, className = '', type, ...rest }: TextFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const ehSenha = type === 'password'
  const tipoReal = ehSenha ? (mostrarSenha ? 'text' : 'password') : type

  const inputClasses = `rounded-lg border px-3.5 py-2.5 font-body text-sm text-ink outline-none transition-colors focus:border-forest focus:ring-2 focus:ring-forest-mist ${
    error ? 'border-red-400' : 'border-ink-soft/25'
  }`

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="font-mono text-xs uppercase tracking-wide text-ink-soft">
        {label}
      </label>

      {ehSenha ? (
        <div className={`relative ${className}`}>
          <input
            id={fieldId}
            type={tipoReal}
            className={`w-full pr-10 ${inputClasses}`}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${fieldId}-error` : undefined}
            {...rest}
          />
          <button
            type="button"
            onClick={() => setMostrarSenha((atual) => !atual)}
            aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-soft/60 hover:text-ink-soft"
          >
            {mostrarSenha ? <IconOlhoFechado /> : <IconOlho />}
          </button>
        </div>
      ) : (
        <input
          id={fieldId}
          type={type}
          className={`${inputClasses} ${className}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          {...rest}
        />
      )}

      {error && (
        <p id={`${fieldId}-error`} className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
