// src/components/dashboard/Etiqueta.tsx
//
// Etiqueta (selo) colorida do painel: prazo vencido, próximo, no prazo,
// sessão pública etc. Mesmas cores do restante do sistema (verde, dourado,
// vermelho), com um tom azul para sessões.

import type { TomEtiqueta } from '@/utils/eventosPainel'

const CLASSES: Record<TomEtiqueta, string> = {
  danger: 'bg-red-50 text-red-700 ring-red-200',
  warning: 'bg-brass-pale text-brass ring-brass/25',
  success: 'bg-forest-mist text-forest-deep ring-forest/20',
  info: 'bg-sky-50 text-sky-700 ring-sky-200',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
}

interface EtiquetaProps {
  rotulo: string
  tom: TomEtiqueta
  className?: string
}

export function Etiqueta({ rotulo, tom, className = '' }: EtiquetaProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 font-body text-xs font-semibold ring-1 ring-inset ${CLASSES[tom]} ${className}`}
    >
      {rotulo}
    </span>
  )
}
