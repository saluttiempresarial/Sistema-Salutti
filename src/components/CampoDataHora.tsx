// src/components/CampoDataHora.tsx
//
// Campo de data e hora com data (calendário do navegador) + hora e minuto em
// listas fixas. Substitui o <input type="datetime-local"> nativo, cujas colunas
// de hora/minuto rolam sem "travar" no valor escolhido (09/11/2026).
//
// O valor entra e sai no formato "AAAA-MM-DDTHH:mm" (hora local), o mesmo do
// datetime-local — então pode trocar um pelo outro sem mexer na lógica.

interface CampoDataHoraProps {
  value: string
  onChange: (valor: string) => void
  disabled?: boolean
  /** Hora usada quando a data é escolhida e ainda não há horário. */
  horaPadrao?: string
  /** Classe visual dos campos (a mesma dos outros campos da tela). */
  className?: string
  ariaLabel?: string
}

const HORAS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTOS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

export function CampoDataHora({
  value,
  onChange,
  disabled,
  horaPadrao = '09:00',
  className = '',
  ariaLabel = 'Data e hora',
}: CampoDataHoraProps) {
  const [data = '', hora = ''] = value ? value.split('T') : []
  const [hh = '', mm = ''] = hora ? hora.split(':') : []

  function montar(novaData: string, novaHora: string, novoMinuto: string) {
    if (!novaData) {
      onChange('')
      return
    }
    onChange(`${novaData}T${novaHora || horaPadrao.slice(0, 2)}:${novoMinuto || horaPadrao.slice(3, 5)}`)
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        aria-label={`${ariaLabel} — data`}
        value={data}
        disabled={disabled}
        onChange={(e) => montar(e.target.value, hh, mm)}
        className={`${className} min-w-0 flex-1`}
      />
      <select
        aria-label={`${ariaLabel} — hora`}
        value={hh}
        disabled={disabled || !data}
        onChange={(e) => montar(data, e.target.value, mm)}
        className={`${className} !w-[4.5rem] shrink-0`}
      >
        {HORAS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="text-sm text-ink-soft">:</span>
      <select
        aria-label={`${ariaLabel} — minuto`}
        value={mm}
        disabled={disabled || !data}
        onChange={(e) => montar(data, hh, e.target.value)}
        className={`${className} !w-[4.5rem] shrink-0`}
      >
        {MINUTOS.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  )
}
