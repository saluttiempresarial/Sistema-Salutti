// src/pages/admin/CalendarioPage.tsx
//
// Calendário mensal com as sessões de licitação e os prazos internos —
// usa a mesma carteira (completa ou restrita) que a tela de Licitações,
// via useLicitacoesInternas (que aplica usePermissoes). Rota compartilhada
// entre Admin e Funcionário (/admin/calendario), no mesmo padrão já usado
// em Licitações/Disputas. Só mostra licitações ativas (exclui ganho/perdido),
// como o painel inicial.
//
// Redesenho (15/10, a pedido do Márcio): calendário ampliado, com o painel
// "Próximos eventos" ao lado.

import { useLicitacoesInternas } from '@/hooks/useLicitacoesInternas'
import { CalendarioLicitacoes } from '@/components/Licitacoes/CalendarioLicitacoes'
import { ProximosEventos } from '@/components/dashboard/ProximosEventos'

export function CalendarioPage() {
  const { licitacoes, carregando } = useLicitacoesInternas()

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-forest-deep sm:text-3xl">Calendário</h1>
        <p className="font-body text-sm text-ink-soft">Sessões de licitação e prazos internos da carteira.</p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="rounded-2xl border border-ink-soft/10 bg-white p-5 shadow-soft sm:p-6">
          {carregando ? (
            <p className="py-10 text-center font-body text-sm text-ink-soft">Carregando...</p>
          ) : (
            <CalendarioLicitacoes licitacoes={licitacoes} amplo mostrarLegenda={false} />
          )}
        </section>

        <ProximosEventos licitacoes={licitacoes} carregando={carregando} />
      </div>
    </div>
  )
}
