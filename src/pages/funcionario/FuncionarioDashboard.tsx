// src/pages/funcionario/FuncionarioDashboard.tsx
//
// Tela inicial do Funcionário — visão de trabalho do dia a dia da equipe
// interna da Salutti (spec 2.2: cadastra licitações, acompanha prazos, altera
// a data de retorno do cliente). Mostra as licitações ativas (não
// finalizadas) da carteira, com destaque para prazos vencendo e decisões de
// cliente pendentes, e atalhos para os módulos operacionais.
//
// Um funcionário com modoAcesso 'restrito' só vê aqui as licitações dos
// clientes vinculados a ele (+ atribuições pontuais) — a restrição é
// aplicada em useLicitacoesInternas (mesma regra de usePermissoes).
//
// Redesenho (15/10, a pedido do Márcio): saudação com a frase institucional,
// três cartões de resumo, calendário ampliado ao lado do painel "Próximos
// eventos" e a tabela de licitações ativas com busca, filtros e ações.
// Foto de perfil: fica no avatar do menu lateral (AdminSidebar.tsx).

import { useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useLicitacoesInternas } from '@/hooks/useLicitacoesInternas'
import { CalendarioLicitacoes } from '@/components/Licitacoes/CalendarioLicitacoes'
import { CabecalhoPainel } from '@/components/dashboard/CabecalhoPainel'
import { CartaoResumo } from '@/components/dashboard/CartaoResumo'
import { ProximosEventos } from '@/components/dashboard/ProximosEventos'
import { PainelLicitacoesAtivas } from '@/components/dashboard/PainelLicitacoesAtivas'
import { IconeCalendario, IconeCalendarioRelogio, IconeDocumento, IconePessoas } from '@/components/icones'
import { classificarUrgenciaPrazo } from '@/utils/prazoUtils'

export function FuncionarioDashboard() {
  const { user } = useAuth()
  const { licitacoes, nomesClientes, carregando, podeEditar } = useLicitacoesInternas()

  const comPrazoUrgente = useMemo(
    () =>
      licitacoes.filter((l) => {
        const urgencia = classificarUrgenciaPrazo(l.dataEfetivaLicitacao || l.dataLicitacao)
        return urgencia === 'vencido' || urgencia === 'atencao'
      }),
    [licitacoes]
  )

  const aguardandoCliente = useMemo(
    () => licitacoes.filter((l) => l.decisaoCliente === 'pendente'),
    [licitacoes]
  )

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <CabecalhoPainel nome={user?.name ?? 'Funcionário'} />

      <div className="grid gap-4 md:grid-cols-3">
        <CartaoResumo
          titulo="Licitações ativas"
          valor={carregando ? '—' : String(licitacoes.length)}
          legenda="em andamento"
          icone={<IconeDocumento className="h-8 w-8" />}
          tom="verde"
          to="/admin/licitacoes"
        />
        <CartaoResumo
          titulo="Prazos vencidos ou próximos"
          valor={carregando ? '—' : String(comPrazoUrgente.length)}
          legenda="requerem atenção"
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="rounded-2xl border border-ink-soft/10 bg-white p-5 shadow-soft sm:p-6">
          <div className="mb-4 flex items-center gap-2.5">
            <IconeCalendario className="h-6 w-6 text-forest" />
            <h2 className="font-display text-xl font-semibold text-forest-deep">Calendário</h2>
          </div>
          {carregando ? (
            <p className="py-10 text-center font-body text-sm text-ink-soft">Carregando...</p>
          ) : (
            <CalendarioLicitacoes licitacoes={licitacoes} amplo mostrarLegenda={false} />
          )}
        </section>

        <ProximosEventos licitacoes={licitacoes} carregando={carregando} />
      </div>

      <PainelLicitacoesAtivas
        licitacoes={licitacoes}
        nomesClientes={nomesClientes}
        carregando={carregando}
        podeEditar={podeEditar}
      />
    </div>
  )
}
