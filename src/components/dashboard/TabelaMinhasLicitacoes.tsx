// src/components/dashboard/TabelaMinhasLicitacoes.tsx
//
// Tabela "Minhas licitações" do Portal do Cliente, usada na página inicial
// (/cliente, com limite de linhas e link "Ver todas") e na tela Licitações
// (/cliente/licitacoes, completa). No computador largo é uma tabela; no tablet,
// uma lista de cartões. Ordenada pelo prazo interno mais próximo de vencer.
// Clicar numa licitação abre o detalhe (/cliente/licitacoes/:id).

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Etiqueta } from '@/components/dashboard/Etiqueta'
import { IconeDocumento, IconeSetaDireita } from '@/components/icones'
import { DECISAO_CLIENTE_LABEL, type DecisaoCliente, type Licitacao } from '@/types/licitacao'
import type { TomEtiqueta } from '@/utils/eventosPainel'
import { formatarDataHora, formatarMoeda, calcularPrazoInterno, classificarUrgenciaPrazo } from '@/utils/prazoUtils'
import {
  prazoPropostaClienteInfo,
  situacaoAnaliseCliente,
  valorParticipacaoCliente,
  type SituacaoAnaliseCliente,
} from '@/utils/licitacaoCalculos'

type FiltroAnalise = SituacaoAnaliseCliente | 'todos'

const OPCOES_FILTRO: { valor: FiltroAnalise; rotulo: string }[] = [
  { valor: 'pendente', rotulo: 'Pendente' },
  { valor: 'em_analise', rotulo: 'Em análise' },
  { valor: 'analisada', rotulo: 'Analisadas' },
  { valor: 'todos', rotulo: 'Todos' },
]

const URGENCIA_CLASSE: Record<string, string> = {
  vencido: 'font-medium text-red-600',
  atencao: 'font-medium text-brass',
  ok: 'font-medium text-forest-deep',
}

const TOM_DECISAO: Record<DecisaoCliente, TomEtiqueta> = {
  pendente: 'warning',
  participar: 'success',
  recusar: 'neutral',
}

function PrazoProposta({ licitacao }: { licitacao: Licitacao }) {
  if (licitacao.decisaoCliente === 'recusar') return <span className="text-ink-soft">—</span>
  const info = prazoPropostaClienteInfo(licitacao)
  return <span className={URGENCIA_CLASSE[info.urgencia]}>{info.texto}</span>
}

function ValorParticipacao({ licitacao }: { licitacao: Licitacao }) {
  if (licitacao.decisaoCliente === 'recusar') return <span className="text-ink-soft">—</span>
  const valor = valorParticipacaoCliente(licitacao)
  return <span>{valor != null ? formatarMoeda(valor) : '—'}</span>
}

interface TabelaMinhasLicitacoesProps {
  licitacoes: Licitacao[]
  carregando: boolean
  /** Máximo de linhas mostradas (sem limite quando omitido). */
  limite?: number
  /** Quando há mais licitações que o limite, mostra este link ("Ver todas"). */
  linkVerTodas?: string
  /** Mostra o filtro Pendente / Em análise / Analisadas / Todos (tela Licitações). */
  comFiltro?: boolean
}

export function TabelaMinhasLicitacoes({ licitacoes, carregando, limite, linkVerTodas, comFiltro }: TabelaMinhasLicitacoesProps) {
  const navigate = useNavigate()
  const [filtro, setFiltro] = useState<FiltroAnalise>('todos')

  const contagens = useMemo(() => {
    const c: Record<FiltroAnalise, number> = { pendente: 0, em_analise: 0, analisada: 0, todos: licitacoes.length }
    licitacoes.forEach((l) => {
      c[situacaoAnaliseCliente(l)] += 1
    })
    return c
  }, [licitacoes])

  // Ordenada pelo prazo interno mais próximo de vencer primeiro.
  const ordenadas = useMemo(() => {
    const base =
      comFiltro && filtro !== 'todos' ? licitacoes.filter((l) => situacaoAnaliseCliente(l) === filtro) : licitacoes
    return [...base].sort((a, b) => {
      const prazoA = calcularPrazoInterno(a.dataEfetivaLicitacao || a.dataLicitacao).getTime()
      const prazoB = calcularPrazoInterno(b.dataEfetivaLicitacao || b.dataLicitacao).getTime()
      return prazoA - prazoB
    })
  }, [licitacoes, comFiltro, filtro])

  const visiveis = limite ? ordenadas.slice(0, limite) : ordenadas
  const restantes = ordenadas.length - visiveis.length

  return (
    <section className="rounded-2xl border border-ink-soft/10 bg-white p-4 shadow-soft sm:p-6">
      <header className="mb-4 flex items-center gap-2.5">
        <IconeDocumento className="h-6 w-6 text-forest" />
        <h2 className="font-display text-xl font-semibold text-forest-deep">Minhas licitações</h2>
      </header>

      {comFiltro && !carregando && licitacoes.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar licitações">
          {OPCOES_FILTRO.map((opcao) => (
            <button
              key={opcao.valor}
              type="button"
              onClick={() => setFiltro(opcao.valor)}
              aria-pressed={filtro === opcao.valor}
              className={`rounded-full border px-4 py-1.5 font-body text-sm transition-colors ${
                filtro === opcao.valor
                  ? 'border-forest bg-forest font-semibold text-white'
                  : 'border-ink-soft/20 bg-white text-ink hover:bg-paper-2'
              }`}
            >
              {opcao.rotulo} ({contagens[opcao.valor]})
            </button>
          ))}
        </div>
      )}

      {carregando && (
        <p className="py-8 text-center font-body text-sm text-ink-soft">Carregando suas licitações...</p>
      )}

      {!carregando && visiveis.length === 0 && (
        <p className="py-8 text-center font-body text-sm text-ink-soft">
          {comFiltro && licitacoes.length > 0 && filtro !== 'todos'
            ? 'Nenhuma licitação nesta situação.'
            : 'Nenhuma licitação atribuída a você ainda.'}
        </p>
      )}

      {!carregando && visiveis.length > 0 && (
        <>
          {/* Computador largo: tabela */}
          <div className="hidden overflow-hidden rounded-xl border border-ink-soft/10 2xl:block">
            <table className="w-full font-body text-sm">
              <thead className="bg-paper-2 text-left text-xs uppercase tracking-wide text-ink-soft">
                <tr>
                  <th className="px-4 py-3">Órgão</th>
                  <th className="whitespace-nowrap px-3 py-3">Plataforma</th>
                  <th className="whitespace-nowrap px-3 py-3">Número</th>
                  <th className="whitespace-nowrap px-3 py-3">Cidade / UF</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right">Valor total</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right">Valor da participação</th>
                  <th className="whitespace-nowrap px-3 py-3">Data da licitação</th>
                  <th className="whitespace-nowrap px-3 py-3">Limite de retorno</th>
                  <th className="whitespace-nowrap px-3 py-3">Prazo para alteração</th>
                  <th className="whitespace-nowrap px-3 py-3">Decisão</th>
                  <th className="w-10 px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-soft/10">
                {visiveis.map((licitacao) => {
                  const dataReferencia = licitacao.dataEfetivaLicitacao || licitacao.dataLicitacao
                  const urgencia = classificarUrgenciaPrazo(dataReferencia)
                  const prazo = calcularPrazoInterno(dataReferencia)
                  return (
                    <tr key={licitacao.id} className="hover:bg-paper-2/50">
                      <td className="max-w-[260px] px-4 py-3">
                        <button
                          type="button"
                          onClick={() => navigate(`/cliente/licitacoes/${licitacao.id}`)}
                          title={licitacao.orgao}
                          className="block w-full truncate text-left font-medium text-ink hover:text-forest-deep hover:underline"
                        >
                          {licitacao.orgao}
                        </button>
                      </td>
                      <td className="max-w-[160px] truncate px-3 py-3 text-ink-soft" title={licitacao.portal}>
                        {licitacao.portal || '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-medium text-ink">{licitacao.numeroPregao}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-ink-soft">
                        {[licitacao.municipio, licitacao.estado].filter(Boolean).join(' / ')}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-ink-soft">
                        {licitacao.valorTotalLicitacao != null ? formatarMoeda(licitacao.valorTotalLicitacao) : 'Sigiloso'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-medium text-ink">
                        <ValorParticipacao licitacao={licitacao} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-ink-soft">{formatarDataHora(dataReferencia)}</td>
                      <td className={`whitespace-nowrap px-3 py-3 ${URGENCIA_CLASSE[urgencia]}`}>
                        {formatarDataHora(prazo.toISOString())}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <PrazoProposta licitacao={licitacao} />
                      </td>
                      <td className="px-3 py-3">
                        <Etiqueta rotulo={DECISAO_CLIENTE_LABEL[licitacao.decisaoCliente]} tom={TOM_DECISAO[licitacao.decisaoCliente]} />
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => navigate(`/cliente/licitacoes/${licitacao.id}`)}
                          aria-label={`Abrir ${licitacao.numeroPregao}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-forest-mist hover:text-forest-deep"
                        >
                          <IconeSetaDireita className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Tablet e notebook: lista de cartões */}
          <ul className="grid gap-3 md:grid-cols-2 2xl:hidden">
            {visiveis.map((licitacao) => {
              const dataReferencia = licitacao.dataEfetivaLicitacao || licitacao.dataLicitacao
              const urgencia = classificarUrgenciaPrazo(dataReferencia)
              const prazo = calcularPrazoInterno(dataReferencia)
              return (
                <li key={licitacao.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/cliente/licitacoes/${licitacao.id}`)}
                    className="block w-full rounded-xl border border-ink-soft/10 p-4 text-left transition-colors hover:bg-paper-2/60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-body text-sm font-semibold text-ink">{licitacao.numeroPregao}</p>
                        <p className="line-clamp-2 font-body text-sm text-ink-soft" title={licitacao.orgao}>
                          {licitacao.orgao}
                        </p>
                      </div>
                      <Etiqueta rotulo={DECISAO_CLIENTE_LABEL[licitacao.decisaoCliente]} tom={TOM_DECISAO[licitacao.decisaoCliente]} />
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 font-body text-xs">
                      <div>
                        <dt className="text-ink-soft">Plataforma</dt>
                        <dd className="truncate text-ink">{licitacao.portal || '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-soft">Cidade / UF</dt>
                        <dd className="text-ink">{[licitacao.municipio, licitacao.estado].filter(Boolean).join(' / ') || '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-soft">Valor total</dt>
                        <dd className="text-ink">
                          {licitacao.valorTotalLicitacao != null ? formatarMoeda(licitacao.valorTotalLicitacao) : 'Sigiloso'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-ink-soft">Valor da participação</dt>
                        <dd className="text-ink">
                          <ValorParticipacao licitacao={licitacao} />
                        </dd>
                      </div>
                      <div>
                        <dt className="text-ink-soft">Data da licitação</dt>
                        <dd className="text-ink">{formatarDataHora(dataReferencia)}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-soft">Limite de retorno</dt>
                        <dd className={URGENCIA_CLASSE[urgencia]}>{formatarDataHora(prazo.toISOString())}</dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-ink-soft">Prazo para alteração</dt>
                        <dd>
                          <PrazoProposta licitacao={licitacao} />
                        </dd>
                      </div>
                    </dl>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {restantes > 0 && linkVerTodas && (
        <p className="mt-4 font-body text-sm text-ink-soft">
          e mais {restantes}.{' '}
          <Link to={linkVerTodas} className="font-semibold text-forest hover:underline">
            Ver todas as licitações
          </Link>
        </p>
      )}
    </section>
  )
}
