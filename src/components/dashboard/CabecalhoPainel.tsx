// src/components/dashboard/CabecalhoPainel.tsx
//
// Topo da tela inicial (Administrador e Funcionário): saudação com o nome de
// quem está logado, uma linha de apoio e a frase institucional à direita.

import { FraseInstitucional } from './FraseInstitucional'

interface CabecalhoPainelProps {
  nome: string
  /** Linha de apoio abaixo da saudação (o Portal do Cliente usa a própria). */
  subtitulo?: string
}

export function CabecalhoPainel({
  nome,
  subtitulo = 'Acompanhe suas licitações, prazos e decisões em um só lugar.',
}: CabecalhoPainelProps) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold text-forest-deep sm:text-3xl">
          Olá, {nome} <span aria-hidden="true">👋</span>
        </h1>
        <p className="mt-1 font-body text-sm text-ink-soft sm:text-base">
          {subtitulo}
        </p>
      </div>
      <FraseInstitucional />
    </div>
  )
}
