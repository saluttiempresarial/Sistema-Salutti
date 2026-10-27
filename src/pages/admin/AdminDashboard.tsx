// src/pages/admin/AdminDashboard.tsx
//
// Tela inicial do Administrador: visão geral do sistema. Mesmo painel do
// Funcionário (cartões, calendário, próximos eventos e licitações ativas),
// mais dois indicadores só do Administrador: taxa de vitória e valor em
// disputa.
//
// Redesenho (15/10, a pedido do Márcio). A taxa de vitória continua sendo
// ganhas ÷ (ganhas + perdidas), agora calculada pelo total que o banco
// informa de cada situação, em vez de baixar até 1000 licitações só para
// contar. O cartão "Prazos vencendo (7 dias)" passou a se chamar "Prazos
// vencidos ou próximos": a regra (prazo vencido, ou a menos de 24 h de vencer)
// sempre foi essa — o "7 dias" do título não correspondia ao cálculo.

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useLicitacoesInternas } from '@/hooks/useLicitacoesInternas'
import { relatorioIndicadoresService } from '@/services/relatorioIndicadoresService'
import { calcularTaxaVitoria, montarUnidades } from '@/utils/indicadoresCalculos'
import { CalendarioLicitacoes } from '@/components/Licitacoes/CalendarioLicitacoes'
import { CabecalhoPainel } from '@/components/dashboard/CabecalhoPainel'
import { CartaoResumo } from '@/components/dashboard/CartaoResumo'
import { useAcoesDisputa } from '@/hooks/useAcoesDisputa'
import { ProximosEventos } from '@/components/dashboard/ProximosEventos'
import { PainelLicitacoesAtivas } from '@/components/dashboard/PainelLicitacoesAtivas'
import {
  IconeCalendario,
  IconeCalendarioRelogio,
  IconeDocumento,
  IconeMoeda,
  IconePessoas,
  IconeTendencia,
} from '@/components/icones'
import { classificarUrgenciaPrazo } from '@/utils/prazoUtils'

function formatarMoedaResumida(valor: number): string {
  if (valor >= 1_000_000) return `R$ ${(valor / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (valor >= 1_000) return `R$ ${(valor / 1_000).toFixed(0)}mil`
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Legenda do cartão de prazos: separa prazos de licitações e ações da disputa.
function legendaPrazos(licitacoes: number, acoes: number): string {
  if (acoes === 0) return 'requerem atenção'
  const ac = `${acoes} ${acoes === 1 ? 'ação da disputa' : 'ações da disputa'}`
  return licitacoes === 0 ? ac : `${licitacoes} ${licitacoes === 1 ? 'licitação' : 'licitações'} · ${ac}`
}

export function AdminDashboard() {
  const { user } = useAuth()
  const { licitacoes: ativas, nomesClientes, carregando, podeEditar } = useLicitacoesInternas()
  const { alertas: acoes, carregando: carregandoAcoes } = useAcoesDisputa()
  const [finalizadas, setFinalizadas] = useState<{ ganhas: number; perdidas: number } | null>(null)

  useEffect(() => {
    let ativo = true
    // Mesma regra do painel de Indicadores: itens/grupos de disputas com
    // resultado definitivo; perdido na habilitação conta como perdido.
    relatorioIndicadoresService
      .carregarDadosBase()
      .then((base) => {
        const taxa = calcularTaxaVitoria(montarUnidades(base.licitacoes, base.disputas))
        if (ativo) setFinalizadas({ ganhas: taxa.ganhos, perdidas: taxa.perdidos })
      })
      .catch(() => {
        if (ativo) setFinalizadas(null)
      })
    return () => {
      ativo = false
    }
  }, [])

  const prazosUrgentes = useMemo(
    () =>
      ativas.filter((l) => {
        const urgencia = classificarUrgenciaPrazo(l.dataEfetivaLicitacao || l.dataLicitacao)
        return urgencia === 'vencido' || urgencia === 'atencao'
      }),
    [ativas]
  )

  const aguardandoCliente = useMemo(() => ativas.filter((l) => l.decisaoCliente === 'pendente'), [ativas])

  const taxaVitoria = useMemo(() => {
    if (!finalizadas) return null
    const total = finalizadas.ganhas + finalizadas.perdidas
    if (total === 0) return null
    return Math.round((finalizadas.ganhas / total) * 100)
  }, [finalizadas])

  const valorEmDisputa = useMemo(
    () => ativas.reduce((soma, l) => soma + (l.valorTotalLicitacao ?? 0), 0),
    [ativas]
  )

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <CabecalhoPainel nome={user?.name ?? 'Administrador'} />

      <div className="grid gap-4 md:grid-cols-3">
        <CartaoResumo
          titulo="Licitações ativas"
          valor={carregando ? '—' : String(ativas.length)}
          legenda="em andamento"
          icone={<IconeDocumento className="h-8 w-8" />}
          tom="verde"
          to="/admin/licitacoes"
        />
        <CartaoResumo
          titulo="Prazos vencidos ou próximos"
          valor={carregando || carregandoAcoes ? '—' : String(prazosUrgentes.length + acoes.length)}
          legenda={legendaPrazos(prazosUrgentes.length, acoes.length)}
          icone={<IconeCalendarioRelogio className="h-8 w-8" />}
          tom="dourado"
          to="/admin/calendario"
        />
        <CartaoResumo
          titulo="Aguardando decisão do cliente"
          valor={carregando ? '—' : String(aguardandoCliente.length)}
          legenda="em análise"
          icone={<IconePessoas className="h-8 w-8" />}
          tom="azul"
          to="/admin/licitacoes"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <CartaoResumo
          compacto
          titulo="Taxa de vitória"
          valor={taxaVitoria === null ? '—' : `${taxaVitoria}%`}
          legenda={taxaVitoria === null ? 'Sem resultados definitivos ainda' : 'ganhos entre os resultados definitivos'}
          icone={<IconeTendencia className="h-6 w-6" />}
          tom="verde"
        />
        <CartaoResumo
          compacto
          titulo="Valor em disputa"
          valor={carregando ? '—' : formatarMoedaResumida(valorEmDisputa)}
          legenda="Licitações ativas com valor público"
          icone={<IconeMoeda className="h-6 w-6" />}
          tom="dourado"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="rounded-2xl border border-ink-soft/10 bg-white p-5 shadow-soft sm:p-6">
          <div className="mb-4 flex items-center gap-2.5">
            <IconeCalendario className="h-6 w-6 text-forest" />
            <h2 className="font-display text-xl font-semibold text-forest-deep">Calendário</h2>
          </div>
          {carregando ? (
            <p className="py-10 text-center font-body text-sm text-ink-soft">Carregando...</p>
          ) : (
            <CalendarioLicitacoes licitacoes={ativas} amplo mostrarLegenda={false} />
          )}
        </section>

        <ProximosEventos licitacoes={ativas} carregando={carregando} />
      </div>

      <PainelLicitacoesAtivas
        licitacoes={ativas}
        nomesClientes={nomesClientes}
        carregando={carregando}
        podeEditar={podeEditar}
      />
    </div>
  )
}
