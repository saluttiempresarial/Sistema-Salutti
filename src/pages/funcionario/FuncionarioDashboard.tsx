// src/pages/funcionario/FuncionarioDashboard.tsx
//
// Painel do Funcionário — visão de trabalho do dia a dia da equipe interna
// da Salutti (spec 2.2: cadastra licitações, acompanha prazos, altera a
// data de retorno do cliente). Mostra as licitações ativas (não
// finalizadas) de toda a carteira — diferente do Portal do Cliente, que só
// mostra as de um cliente — com destaque para prazos vencendo e decisões
// de cliente pendentes, e atalhos para os mesmos módulos operacionais que
// o Administrador usa (Licitações, Disputas, Relatórios — agora também
// liberados para o perfil Funcionário no App.tsx).
//
// Desde a implementação das permissões granulares (usePermissoes), um
// funcionário com modoAcesso 'restrito' só vê aqui as licitações dos
// clientes vinculados a ele (+ atribuições pontuais) — `restricaoDados`
// abaixo é repassado direto para licitacaoService.listarAtivas().
//
// Nome do cliente: vem de clienteService.list() (Supabase real) — antes
// usava mockClientesResumo, migrado junto com a limpeza dos últimos mocks.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DashboardShell, StatCard } from '@/components/DashboardShell'
import { useAuth } from '@/context/AuthContext'
import { usePermissoes } from '@/hooks/usePermissoes'
import { StatusPill, StatusTone } from '@/components/StatusPill'
import { licitacaoService } from '@/services/licitacaoService'
import { clienteService } from '@/services/clienteService'
import {
  Licitacao,
  StatusLicitacao,
  STATUS_LICITACAO_LABEL,
  DECISAO_CLIENTE_LABEL,
} from '@/types/licitacao'
import { formatarDataHora, classificarUrgenciaPrazo } from '@/utils/prazoUtils'

const STATUS_TONE: Record<StatusLicitacao, StatusTone> = {
  pendente: 'neutral',
  em_analise: 'info',
  enviado: 'warning',
  ganho: 'success',
  perdido: 'danger',
}

export function FuncionarioDashboard() {
  const { user } = useAuth()
  const { carregando: carregandoPermissoes, restricaoDados, podeAcessarModulo } = usePermissoes()
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([])
  const [nomesClientes, setNomesClientes] = useState<Record<string, string>>({})
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (carregandoPermissoes) return
    let ativo = true
    setCarregando(true)
    licitacaoService.listarAtivas(restricaoDados ?? {}).then((itens) => {
      if (ativo) {
        setLicitacoes(itens)
        setCarregando(false)
      }
    })
    return () => {
      ativo = false
    }
  }, [carregandoPermissoes, restricaoDados])

  // Busca os nomes dos clientes referenciados nas licitações carregadas —
  // 200 cobre a carteira inteira sem precisar de paginação aqui.
  useEffect(() => {
    let ativo = true
    clienteService.list({ page: 1, pageSize: 200 }).then((resultado) => {
      if (!ativo) return
      const mapa: Record<string, string> = {}
      resultado.data.forEach((c) => {
        mapa[c.id] = c.empresa.nomeFantasia
      })
      setNomesClientes(mapa)
    })
    return () => {
      ativo = false
    }
  }, [])

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
    <DashboardShell
      title={`Olá, ${user?.name ?? 'Funcionário'}`}
      subtitle="Licitações ativas da carteira — acompanhe prazos e decisões pendentes dos clientes."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Licitações ativas" value={String(licitacoes.length)} />
        <StatCard
          label="Prazos vencidos ou próximos"
          value={String(comPrazoUrgente.length)}
          hint={comPrazoUrgente.length > 0 ? 'Confira a lista abaixo' : undefined}
        />
        <StatCard label="Aguardando decisão do cliente" value={String(aguardandoCliente.length)} />
      </div>

      <div className="mt-8 rounded-xl border border-ink-soft/10 bg-white p-6 shadow-soft">
        <h2 className="font-display text-lg font-semibold text-forest-deep">Área do funcionário</h2>
        <p className="mt-2 font-body text-sm text-ink-soft">
          Cadastro de Clientes e de Funcionários são exclusivos do perfil <strong>Administrador</strong>.
          Os módulos abaixo dependem das permissões configuradas no seu cadastro.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {podeAcessarModulo('licitacoes') && (
            <Link
              to="/admin/licitacoes"
              className="inline-flex w-fit items-center gap-1.5 font-body text-sm font-semibold text-forest hover:underline"
            >
              Ir para Licitações →
            </Link>
          )}
          {podeAcessarModulo('disputas') && (
            <Link
              to="/admin/disputas"
              className="inline-flex w-fit items-center gap-1.5 font-body text-sm font-semibold text-forest hover:underline"
            >
              Ir para Disputas →
            </Link>
          )}
          {podeAcessarModulo('relatorios') && (
            <Link
              to="/admin/relatorios"
              className="inline-flex w-fit items-center gap-1.5 font-body text-sm font-semibold text-forest hover:underline"
            >
              Ir para Relatórios →
            </Link>
          )}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 font-display text-lg font-semibold text-forest-deep">Licitações ativas</h2>

        {carregando && (
          <div className="rounded-xl border border-ink-soft/10 bg-white p-6 text-center font-body text-sm text-ink-soft shadow-soft">
            Carregando...
          </div>
        )}

        {!carregando && licitacoes.length === 0 && (
          <div className="rounded-xl border border-ink-soft/10 bg-white p-6 text-center font-body text-sm text-ink-soft shadow-soft">
            Nenhuma licitação ativa no momento.
          </div>
        )}

        {!carregando && licitacoes.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-ink-soft/10 bg-white shadow-soft">
            <table className="w-full font-body text-sm">
              <thead className="bg-paper-2 text-left text-xs uppercase tracking-wide text-ink-soft">
                <tr>
                  <th className="px-4 py-3">Pregão</th>
                  <th className="px-4 py-3">Órgão</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Sessão</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Decisão do cliente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal-3/10">
                {licitacoes.map((licitacao) => {
                  const dataReferencia = licitacao.dataEfetivaLicitacao || licitacao.dataLicitacao
                  const urgencia = classificarUrgenciaPrazo(dataReferencia)
                  return (
                    <tr key={licitacao.id} className="hover:bg-paper-2/60">
                      <td className="px-4 py-3 font-medium text-ink">{licitacao.numeroPregao}</td>
                      <td className="px-4 py-3 text-ink-soft">{licitacao.orgao}</td>
                      <td className="px-4 py-3 text-ink-soft">{nomesClientes[licitacao.clienteId] ?? '—'}</td>
                      <td className="px-4 py-3 text-ink-soft">
                        {formatarDataHora(dataReferencia)}
                        {urgencia === 'vencido' && <span className="ml-2 text-xs font-medium text-red-600">⚠ vencido</span>}
                        {urgencia === 'atencao' && <span className="ml-2 text-xs font-medium text-brass">⚠ próximo</span>}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill label={STATUS_LICITACAO_LABEL[licitacao.status]} tone={STATUS_TONE[licitacao.status]} />
                      </td>
                      <td className="px-4 py-3 text-ink-soft">{DECISAO_CLIENTE_LABEL[licitacao.decisaoCliente]}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
