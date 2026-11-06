// src/pages/admin/AdminDashboard.tsx
//
// Tela inicial do Administrador: visão geral do sistema. Mesmo painel do
// Funcionário (cartões, calendário, próximas licitações e licitações ativas).
// Em 04/11 o cartão de prazos foi dividido em dois, "Prazos vencidos" e
// "Prazos próximos" (vencem até o próximo dia útil) — ver CartoesPrazos.tsx.
// Em 06/11 (Márcio) saíram os cartões "Taxa de vitória" e "Valor em disputa":
// esses números ficam só nos Relatórios e Indicadores.

import { useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useLicitacoesInternas } from '@/hooks/useLicitacoesInternas'
import { CalendarioLicitacoes } from '@/components/Licitacoes/CalendarioLicitacoes'
import { CabecalhoPainel } from '@/components/dashboard/CabecalhoPainel'
import { CartaoResumo } from '@/components/dashboard/CartaoResumo'
import { CartoesPrazos } from '@/components/dashboard/CartoesPrazos'
import { useAcoesDisputa } from '@/hooks/useAcoesDisputa'
import { ProximosEventos } from '@/components/dashboard/ProximosEventos'
import { PainelLicitacoesAtivas } from '@/components/dashboard/PainelLicitacoesAtivas'
import {
  IconeCalendario,
  IconeDocumento,
  IconePessoas,
} from '@/components/icones'

export function AdminDashboard() {
  const { user } = useAuth()
  const { licitacoes: todasAtivas, nomesClientes, carregando, podeEditar } = useLicitacoesInternas()
  // "Licitações ativas" = só as que já foram enviadas (liberadas) ao cliente
  // (05/11, Márcio). As ainda não liberadas ficam na tela Licitações.
  const ativas = useMemo(() => todasAtivas.filter((l) => !!l.liberadaAoClienteEm), [todasAtivas])
  const { alertas: acoes, carregando: carregandoAcoes } = useAcoesDisputa()
  // Só conta quem já foi liberada ao cliente: licitação ainda não liberada não está
  // esperando decisão de ninguém (correção de 04/11).
  const aguardandoCliente = useMemo(
    () => ativas.filter((l) => !!l.liberadaAoClienteEm && l.decisaoCliente === 'pendente'),
    [ativas]
  )

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <CabecalhoPainel nome={user?.name ?? 'Administrador'} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CartaoResumo
          titulo="Licitações ativas"
          valor={carregando ? '—' : String(ativas.length)}
          legenda="em andamento"
          icone={<IconeDocumento className="h-8 w-8" />}
          tom="verde"
          to="/admin/licitacoes"
        />
        <CartoesPrazos
          licitacoes={ativas}
          acoes={acoes}
          carregando={carregando || carregandoAcoes}
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
