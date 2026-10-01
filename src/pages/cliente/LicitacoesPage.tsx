// src/pages/cliente/LicitacoesPage.tsx
//
// Tela principal do Portal do Cliente — cards de indicadores + tabela de
// licitações. É o mesmo conteúdo que antes vivia em ClienteDashboard.tsx,
// agora sem o calendário embutido no final (que virou tela própria, ver
// CalendarioPage.tsx), e usando DashboardShell com showHeader={false} —
// mesmo padrão do AdminDashboard.tsx — já que o Header antigo dá lugar à
// ClienteSidebar dentro do ClienteLayout.
//
// ClienteDashboard.tsx fica sem uso depois desta mudança (rota /cliente
// passa a apontar pra cá) — pode apagá-lo do projeto quando confirmar que
// está tudo funcionando, do mesmo jeito que fez com o
// PropostaComercialTable.tsx.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardShell, StatCard } from '@/components/DashboardShell'
import { BotaoSair } from '@/components/BotaoSair'
import { useAuth } from '@/context/AuthContext'
import { licitacaoService } from '@/services/licitacaoService'
import { Licitacao } from '@/types/licitacao'
import { formatarDataHora, formatarMoeda, calcularPrazoInterno, classificarUrgenciaPrazo } from '@/utils/prazoUtils'
import { prazoPropostaClienteInfo } from '@/utils/licitacaoCalculos'

const URGENCIA_CLASSE: Record<string, string> = {
  vencido: 'font-medium text-red-600',
  atencao: 'font-medium text-brass',
  ok: 'font-medium text-forest-deep',
}

export function LicitacoesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([])
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    if (!user?.clienteId) {
      setCarregando(false)
      return
    }
    setCarregando(true)
    const itens = await licitacaoService.listarPorCliente(user.clienteId)
    setLicitacoes(itens)
    setCarregando(false)
  }, [user?.clienteId])

  useEffect(() => {
    carregar()
  }, [carregar])

  const aguardandoDecisao = useMemo(
    () => licitacoes.filter((l) => l.decisaoCliente === 'pendente'),
    [licitacoes]
  )
  const participando = useMemo(
    () => licitacoes.filter((l) => l.decisaoCliente === 'participar'),
    [licitacoes]
  )

  // Ordenada pelo prazo interno mais próximo de vencer primeiro.
  const licitacoesPorPrazo = useMemo(() => {
    return [...licitacoes].sort((a, b) => {
      const prazoA = calcularPrazoInterno(a.dataEfetivaLicitacao || a.dataLicitacao).getTime()
      const prazoB = calcularPrazoInterno(b.dataEfetivaLicitacao || b.dataLicitacao).getTime()
      return prazoA - prazoB
    })
  }, [licitacoes])

  if (!user?.clienteId) {
    return (
      <DashboardShell showHeader={false} title={`Bem-vindo, ${user?.name ?? 'Cliente'}`} headerActions={<BotaoSair />}>
        <div className="rounded-xl border border-ink-soft/10 bg-white p-6 shadow-soft">
          <p className="font-body text-sm text-ink-soft">
            Este login não está vinculado a um registro de cliente ainda. Peça para a equipe Salutti
            associar seu usuário a um cliente cadastrado.
          </p>
        </div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell
      showHeader={false}
      title={`Bem-vindo, ${user.name}`}
      subtitle="Acompanhe suas licitações e confirme sua participação."
      headerActions={<BotaoSair />}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Licitações acompanhadas" value={String(licitacoes.length)} />
        <StatCard
          label="Aguardando sua decisão"
          value={String(aguardandoDecisao.length)}
          hint={aguardandoDecisao.length > 0 ? 'Responda o quanto antes — o prazo é curto' : undefined}
        />
        <StatCard label="Participando" value={String(participando.length)} />
      </div>

      {carregando && (
        <div className="mt-8 rounded-xl border border-ink-soft/10 bg-white p-6 text-center font-body text-sm text-ink-soft shadow-soft">
          Carregando suas licitações...
        </div>
      )}

      {!carregando && licitacoesPorPrazo.length === 0 && (
        <div className="mt-8 rounded-xl border border-ink-soft/10 bg-white p-6 text-center font-body text-sm text-ink-soft shadow-soft">
          Nenhuma licitação atribuída a você ainda.
        </div>
      )}

      {!carregando && licitacoesPorPrazo.length > 0 && (
        <>
          <p className="mt-8 flex items-center gap-1.5 font-body text-xs text-ink-soft">
            <span aria-hidden="true">↔</span>
            Arraste a tabela para o lado para ver todas as colunas.
          </p>
          <div className="mt-2 overflow-x-auto rounded-xl border border-ink-soft/10 bg-white shadow-soft">
            <table className="w-full min-w-[960px] font-body text-sm">
            <thead className="bg-paper-2 text-left text-xs uppercase tracking-wide text-ink-soft">
              <tr>
                <th className="whitespace-nowrap px-4 py-3">Portal</th>
                <th className="max-w-[220px] px-4 py-3">Órgão</th>
                <th className="whitespace-nowrap px-4 py-3">Número</th>
                <th className="whitespace-nowrap px-4 py-3">Cidade</th>
                <th className="whitespace-nowrap px-4 py-3">Estado</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Valor total</th>
                <th className="whitespace-nowrap px-4 py-3">Data da licitação</th>
                <th className="whitespace-nowrap px-4 py-3">Data de retorno</th>
                <th className="whitespace-nowrap px-4 py-3">Prazo para proposta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-3/10">
              {licitacoesPorPrazo.map((licitacao) => {
                const dataReferencia = licitacao.dataEfetivaLicitacao || licitacao.dataLicitacao
                const urgencia = classificarUrgenciaPrazo(dataReferencia)
                const prazo = calcularPrazoInterno(dataReferencia)
                return (
                  <tr key={licitacao.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{licitacao.portal}</td>
                    <td className="max-w-[220px] px-4 py-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/cliente/licitacoes/${licitacao.id}`)}
                        title={licitacao.orgao}
                        className="block w-full text-left text-ink-soft hover:text-forest-deep hover:underline"
                      >
                        {licitacao.orgao}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-ink">{licitacao.numeroPregao}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{licitacao.municipio}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{licitacao.estado}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-ink-soft">
                      {licitacao.valorTotalLicitacao != null ? formatarMoeda(licitacao.valorTotalLicitacao) : 'Sigiloso'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{formatarDataHora(dataReferencia)}</td>
                    <td className={`whitespace-nowrap px-4 py-3 ${URGENCIA_CLASSE[urgencia]}`}>
                      {formatarDataHora(prazo.toISOString())}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {licitacao.decisaoCliente === 'recusar' ? (
                        <span className="text-ink-soft">—</span>
                      ) : (
                        <span className={URGENCIA_CLASSE[prazoPropostaClienteInfo(licitacao).urgencia]}>
                          {prazoPropostaClienteInfo(licitacao).texto}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </>
      )}
    </DashboardShell>
  )
}
