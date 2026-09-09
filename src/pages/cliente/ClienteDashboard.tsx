// src/pages/cliente/ClienteDashboard.tsx
//
// Portal do Cliente — a tabela é a visão principal (Portal, Órgão, Número,
// Cidade, Estado, Valor total, Data da licitação, Data de retorno),
// ordenada pela data de retorno mais próxima primeiro. Clicar numa linha
// abre a tela cheia de detalhes (LicitacaoDetalhePage, rota
// /cliente/licitacoes/:id), que concentra a leitura completa e os botões
// de decisão (Quero Participar / Não vou participar) — substituiu o modal
// e o antigo cartão por licitação, que duplicavam a mesma informação.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardShell, StatCard } from '@/components/DashboardShell'
import { useAuth } from '@/context/AuthContext'
import { licitacaoService } from '@/services/licitacaoService'
import { CalendarioLicitacoes } from '@/components/Licitacoes/CalendarioLicitacoes'
import { Licitacao } from '@/types/licitacao'
import { formatarDataHora, formatarMoeda, calcularPrazoInterno, classificarUrgenciaPrazo } from '@/utils/prazoUtils'

const URGENCIA_CLASSE: Record<string, string> = {
  vencido: 'font-medium text-red-600',
  atencao: 'font-medium text-brass',
  ok: 'font-medium text-forest-deep',
}

export function ClienteDashboard() {
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
      <DashboardShell title={`Bem-vindo, ${user?.name ?? 'Cliente'}`}>
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
      title={`Bem-vindo, ${user.name}`}
      subtitle="Acompanhe suas licitações e confirme sua participação."
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
        <div
          className="mt-8 overflow-x-auto rounded-xl border border-ink-soft/10 bg-white shadow-soft [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <table className="w-full font-body text-sm">
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
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8">
        <h2 className="mb-3 font-display text-lg font-semibold text-forest-deep">Calendário</h2>
        <div className="rounded-xl border border-ink-soft/10 bg-white p-5 shadow-soft">
          <CalendarioLicitacoes licitacoes={licitacoes} />
        </div>
      </div>
    </DashboardShell>
  )
}
