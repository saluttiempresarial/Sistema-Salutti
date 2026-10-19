// src/components/dashboard/TabelaMinhasLicitacoes.tsx
//
// Tabela "Minhas licitações" do Portal do Cliente, usada na página inicial
// (/cliente, com limite de linhas e link "Ver todas") e na tela Licitações
// (/cliente/licitacoes, completa). No computador largo é uma tabela; no tablet,
// uma lista de cartões. Ordenada pelo prazo interno mais próximo de vencer.
// Clicar numa licitação abre o detalhe (/cliente/licitacoes/:id).

import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Etiqueta } from '@/components/dashboard/Etiqueta'
import { IconeDocumento, IconeSetaDireita } from '@/components/icones'
import { DECISAO_CLIENTE_LABEL, type DecisaoCliente, type Licitacao } from '@/types/licitacao'
import type { TomEtiqueta } from '@/utils/eventosPainel'
import { formatarDataHora, formatarMoeda, calcularPrazoInterno, classificarUrgenciaPrazo } from '@/utils/prazoUtils'
import { prazoPropostaClienteInfo } from '@/utils/licitacaoCalculos'

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

interface TabelaMinhasLicitacoesProps {
  licitacoes: Licitacao[]
  carregando: boolean
  /** Máximo de linhas mostradas (sem limite quando omitido). */
  limite?: number
  /** Quando há mais licitações que o limite, mostra este link ("Ver todas"). */
  linkVerTodas?: string
}

export function TabelaMinhasLicitacoes({ licitacoes, carregando, limite, linkVerTodas }: TabelaMinhasLicitacoesProps) {
  const navigate = useNavigate()

  // Ordenada pelo prazo interno mais próximo de vencer primeiro.
  const ordenadas = useMemo(() => {
    return [...licitacoes].sort((a, b) => {
      const prazoA = calcularPrazoInterno(a.dataEfetivaLicitacao || a.dataLicitacao).getTime()
      const prazoB = calcularPrazoInterno(b.dataEfetivaLicitacao || b.dataLicitacao).getTime()
      return prazoA - prazoB
    })
  }, [licitacoes])

  const visiveis = limite ? ordenadas.slice(0, limite) : ordenadas
  const restantes = ordenadas.length - visiveis.length

  return (
    <section className="rounded-2xl border border-ink-soft/10 bg-white p-4 shadow-soft sm:p-6">
      <header className="mb-4 flex items-center gap-2.5">
        <IconeDocumento className="h-6 w-6 text-forest" />
        <h2 className="font-display text-xl font-semibold text-forest-deep">Minhas licitações</h2>
      </header>

      {carregando && (
        <p className="py-8 text-center font-body text-sm text-ink-soft">Carregando suas licitações...</p>
      )}

      {!carregando && visiveis.length === 0 && (
        <p className="py-8 text-center font-body text-sm text-ink-soft">
          Nenhuma licitação atribuída a você ainda.
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
                  <th className="whitespace-nowrap px-3 py-3">Número</th>
                  <th className="whitespace-nowrap px-3 py-3">Cidade / UF</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right">Valor total</th>
                  <th className="whitespace-nowrap px-3 py-3">Data da licitação</th>
                  <th className="whitespace-nowrap px-3 py-3">Data de retorno</th>
                  <th className="whitespace-nowrap px-3 py-3">Prazo para proposta</th>
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
                        {licitacao.portal && <p className="truncate text-xs text-ink-soft">{licitacao.portal}</p>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-medium text-ink">{licitacao.numeroPregao}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-ink-soft">
                        {[licitacao.municipio, licitacao.estado].filter(Boolean).join(' / ')}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-ink-soft">
                        {licitacao.valorTotalLicitacao != null ? formatarMoeda(licitacao.valorTotalLicitacao) : 'Sigiloso'}
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
                        <dt className="text-ink-soft">Data da licitação</dt>
                        <dd className="text-ink">{formatarDataHora(dataReferencia)}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-soft">Data de retorno</dt>
                        <dd className={URGENCIA_CLASSE[urgencia]}>{formatarDataHora(prazo.toISOString())}</dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-ink-soft">Prazo para proposta</dt>
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
