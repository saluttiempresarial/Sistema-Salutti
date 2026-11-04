// src/components/SeletorUnidadeMedida.tsx
//
// Campo "Unidade de medida" do item: lista com as 15 unidades mais usadas e,
// no fim, "Outra", que abre um campo de texto "Especifique a unidade".
// Guarda só a sigla (ex.: "CX"). Valores antigos escritos à mão que não estão
// na lista aparecem em "Outra" com o texto preservado.

import { useId, useState } from 'react'
import { UNIDADES_MEDIDA, unidadeDaLista } from '@/utils/unidadesMedida'

const OUTRA = '__outra'

interface SeletorUnidadeMedidaProps {
  valor: string
  onChange: (valor: string) => void
  /** "formulario" (cadastro da licitação) ou "compacto" (dados de referência da proposta). */
  estilo?: 'formulario' | 'compacto'
  label?: string
}

const ROTULO = {
  formulario: 'font-mono text-xs uppercase tracking-wide text-ink-soft',
  compacto: 'font-body text-[10px] font-semibold uppercase tracking-wide text-ink-soft',
}
const CAMPO = {
  formulario:
    'w-full rounded-lg border border-ink-soft/25 bg-white px-3.5 py-2.5 font-body text-sm text-ink outline-none transition-colors focus:border-forest focus:ring-2 focus:ring-forest-mist',
  compacto:
    'w-full rounded-lg border border-forest/30 bg-forest-mist/20 px-3 py-2 font-body text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20',
}

export function SeletorUnidadeMedida({
  valor,
  onChange,
  estilo = 'formulario',
  label = 'Unidade de medida',
}: SeletorUnidadeMedidaProps) {
  const id = useId()
  const daLista = unidadeDaLista(valor)
  // "Outra" fica ativa quando a pessoa a escolheu ou quando o valor gravado não é da lista.
  const [outraEscolhida, setOutraEscolhida] = useState(false)
  const modoOutra = outraEscolhida || (valor.trim() !== '' && !daLista)

  const valorSelect = modoOutra ? OUTRA : (daLista?.sigla ?? '')

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={ROTULO[estilo]}>
        {label}
      </label>
      <select
        id={id}
        value={valorSelect}
        onChange={(e) => {
          if (e.target.value === OUTRA) {
            setOutraEscolhida(true)
            onChange('')
            return
          }
          setOutraEscolhida(false)
          onChange(e.target.value)
        }}
        className={CAMPO[estilo]}
      >
        <option value="" disabled>
          Selecione
        </option>
        {UNIDADES_MEDIDA.map((u) => (
          <option key={u.sigla} value={u.sigla}>
            {u.sigla} ({u.nome})
          </option>
        ))}
        <option value={OUTRA}>Outra</option>
      </select>
      {modoOutra && (
        <input
          type="text"
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Especifique a unidade"
          aria-label="Especifique a unidade"
          className={CAMPO[estilo]}
        />
      )}
    </div>
  )
}
