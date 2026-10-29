// src/pages/cliente/RelatoriosPage.tsx
//
// Relatórios do Portal do Cliente (29/10, a pedido do Márcio): os Indicadores
// ficam dentro de Relatórios, como na área da equipe. Para o cliente há uma
// única aba, "Indicadores"; as abas Licitações e Disputas são de uso interno.
// O que cada usuário enxerga continua sendo decidido pela liberação de
// indicadores (Administrador e, para o Operador, o Responsável).

import { IndicadoresPage } from '@/pages/admin/indicadores/IndicadoresPage'

export function RelatoriosPage() {
  return (
    <div className="min-h-screen bg-paper p-8">
      <header className="no-print mb-6">
        <h1 className="font-display text-2xl text-ink">Relatórios</h1>
        <p className="font-body text-sm text-ink-soft">
          Desempenho das suas licitações e disputas. Os filtros valem para todos os gráficos.
        </p>
      </header>

      <div className="no-print mb-5 flex gap-1 border-b border-charcoal-3/15 font-body">
        <span className="relative px-4 py-2.5 text-sm font-medium text-forest-deep">
          Indicadores
          <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brass" />
        </span>
      </div>

      <IndicadoresPage embutido />
    </div>
  )
}
