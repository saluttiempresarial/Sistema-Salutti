// src/components/dashboard/PainelLicitacoesAtivas.tsx
//
// Tabela "Licitações ativas" da tela inicial (Administrador e Funcionário):
// busca, filtros (status, decisão do cliente e prazo) e ações acima da
// tabela; status coloridos; em telas menores a tabela vira uma lista de
// cartões, sem rolagem horizontal. Mostra as 8 primeiras e leva à tela
// completa de Licitações. Só usa dados já carregados — nenhuma consulta nova.

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { StatusPill, type StatusTone } from '@/components/StatusPill'
import {
  DECISAO_CLIENTE_LABEL,
  STATUS_LICITACAO_LABEL,
  type DecisaoCliente,
  type Licitacao,
  type StatusLicitacao,
} from '@/types/licitacao'
import { calcularPrazoInterno, classificarUrgenciaPrazo } from '@/utils/prazoUtils'
import { formatarDataCurta, formatarHora } from '@/utils/eventosPainel'
import {
  IconeAlerta,
  IconeBusca,
  IconeDocumento,
  IconeFiltro,
  IconeLapis,
  IconeOlho,
  IconeSetaDireita,
} from '@/components/icones'

const LIMITE_LINHAS = 8

const STATUS_TONE: Record<StatusLicitacao, StatusTone> = {
  pendente: 'neutral',
  em_analise: 'info',
  enviado: 'warning',
  ganho: 'success',
  perdido: 'danger',
}

const DECISAO_CLASSES: Record<DecisaoCliente, string> = {
  participar: 'bg-forest-mist text-forest-deep',
  recusar: 'bg-slate-100 text-slate-600',
  pendente: 'bg-brass-pale text-brass',
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

function Decisao({ valor }: { valor: DecisaoCliente }) {
  return (
    <span className={`inline-flex rounded-2xl px-2.5 py-1 font-body text-xs font-medium leading-snug ${DECISAO_CLASSES[valor]}`}>
      {DECISAO_CLIENTE_LABEL[valor]}
    </span>
  )
}

function Acoes({ licitacao, podeEditar }: { licitacao: Licitacao; podeEditar: boolean }) {
  const classe =
    'inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-forest-mist hover:text-forest-deep'
  return (
    <div className="flex items-center justify-end gap-1">
      <Link
        to={`/admin/licitacoes/${licitacao.id}/proposta`}
        title="Ver proposta"
        aria-label={`Ver proposta da licitação ${licitacao.numeroPregao}`}
        className={classe}
      >
        <IconeOlho className="h-[18px] w-[18px]" />
      </Link>
      {podeEditar && (
        <Link
          to={`/admin/licitacoes?editar=${licitacao.id}`}
          title="Editar licitação"
          aria-label={`Editar a licitação ${licitacao.numeroPregao}`}
          className={classe}
        >
          <IconeLapis className="h-[18px] w-[18px]" />
        </Link>
      )}
    </div>
  )
}

type FiltroPrazo = '' | 'vencido' | 'proximo'

interface PainelLicitacoesAtivasProps {
  licitacoes: Licitacao[]
  nomesClientes: Record<string, string>
  carregando: boolean
  podeEditar: boolean
}

export function PainelLicitacoesAtivas({
  licitacoes,
  nomesClientes,
  carregando,
  podeEditar,
}: PainelLicitacoesAtivasProps) {
  const [busca, setBusca] = useState('')
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [status, setStatus] = useState<'' | StatusLicitacao>('')
  const [decisao, setDecisao] = useState<'' | DecisaoCliente>('')
  const [prazo, setPrazo] = useState<FiltroPrazo>('')

  const filtrosAtivos = [status, decisao, prazo].filter(Boolean).length

  const filtradas = useMemo(() => {
    const termo = normalizar(busca.trim())
    return licitacoes.filter((licitacao) => {
      if (status && licitacao.status !== status) return false
      if (decisao && licitacao.decisaoCliente !== decisao) return false
      if (prazo) {
        const urgencia = classificarUrgenciaPrazo(licitacao.dataEfetivaLicitacao || licitacao.dataLicitacao)
        if (prazo === 'vencido' && urgencia !== 'vencido') return false
        if (prazo === 'proximo' && urgencia !== 'atencao') return false
      }
      if (!termo) return true
      const alvo = normalizar(
        [licitacao.numeroPregao, licitacao.objeto, licitacao.orgao, nomesClientes[licitacao.clienteId] ?? ''].join(' ')
      )
      return alvo.includes(termo)
    })
  }, [licitacoes, nomesClientes, busca, status, decisao, prazo])

  const visiveis = filtradas.slice(0, LIMITE_LINHAS)

  function limparFiltros() {
    setStatus('')
    setDecisao('')
    setPrazo('')
  }

  function dadosDaLinha(licitacao: Licitacao) {
    const referencia = licitacao.dataEfetivaLicitacao || licitacao.dataLicitacao
    const sessao = new Date(referencia)
    const prazoInterno = calcularPrazoInterno(referencia)
    return {
      sessao,
      prazoInterno,
      urgencia: classificarUrgenciaPrazo(referencia),
      cliente: nomesClientes[licitacao.clienteId] ?? '—',
    }
  }

  const selectClasse =
    'w-full rounded-lg border border-ink-soft/20 bg-white px-3 py-2 font-body text-sm text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20'

  return (
    <section className="rounded-2xl border border-ink-soft/10 bg-white p-5 shadow-soft sm:p-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-forest-mist text-forest">
            <IconeDocumento className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold text-forest-deep">Licitações ativas</h2>
            <p className="font-body text-sm text-ink-soft">
              Acompanhe o status das suas licitações e mantenha-se sempre atualizado.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative sm:w-72">
            <IconeBusca className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-soft" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nº, cliente ou objeto..."
              aria-label="Buscar licitações ativas"
              className="w-full rounded-lg border border-ink-soft/20 bg-white py-2.5 pl-10 pr-3 font-body text-sm text-ink placeholder:text-ink-soft/70 focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
            />
          </div>

          <button
            type="button"
            onClick={() => setMostrarFiltros((aberto) => !aberto)}
            aria-expanded={mostrarFiltros}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-ink-soft/20 bg-white px-4 py-2.5 font-body text-sm font-semibold text-forest-deep transition-colors hover:bg-forest-mist"
          >
            <IconeFiltro className="h-[18px] w-[18px]" />
            Filtros
            {filtrosAtivos > 0 && (
              <span className="rounded-full bg-forest px-1.5 py-px font-mono text-[11px] text-white">
                {filtrosAtivos}
              </span>
            )}
          </button>

          {podeEditar && (
            <Link
              to="/admin/licitacoes?nova=1"
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-forest px-4 py-2.5 font-body text-sm font-semibold text-white transition-colors hover:bg-forest-deep"
            >
              <span aria-hidden="true" className="text-base leading-none">
                +
              </span>
              Nova Licitação
            </Link>
          )}
        </div>
      </header>

      {mostrarFiltros && (
        <div className="mt-4 grid gap-3 rounded-xl border border-ink-soft/10 bg-paper-2/50 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block font-body text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as '' | StatusLicitacao)}
              className={`${selectClasse} mt-1 font-normal normal-case tracking-normal`}
            >
              <option value="">Todos</option>
              {(Object.keys(STATUS_LICITACAO_LABEL) as StatusLicitacao[])
                .filter((s) => s !== 'ganho' && s !== 'perdido')
                .map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LICITACAO_LABEL[s]}
                  </option>
                ))}
            </select>
          </label>
          <label className="block font-body text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Decisão do cliente
            <select
              value={decisao}
              onChange={(e) => setDecisao(e.target.value as '' | DecisaoCliente)}
              className={`${selectClasse} mt-1 font-normal normal-case tracking-normal`}
            >
              <option value="">Todas</option>
              {(Object.keys(DECISAO_CLIENTE_LABEL) as DecisaoCliente[]).map((d) => (
                <option key={d} value={d}>
                  {DECISAO_CLIENTE_LABEL[d]}
                </option>
              ))}
            </select>
          </label>
          <label className="block font-body text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Prazo interno
            <select
              value={prazo}
              onChange={(e) => setPrazo(e.target.value as FiltroPrazo)}
              className={`${selectClasse} mt-1 font-normal normal-case tracking-normal`}
            >
              <option value="">Todos</option>
              <option value="vencido">Vencido</option>
              <option value="proximo">Próximo (menos de 24 h)</option>
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={limparFiltros}
              disabled={filtrosAtivos === 0}
              className="rounded-lg px-3 py-2 font-body text-sm font-semibold text-forest-deep hover:underline disabled:cursor-not-allowed disabled:text-ink-soft/50 disabled:no-underline"
            >
              Limpar filtros
            </button>
          </div>
        </div>
      )}

      <div className="mt-5">
        {carregando && <p className="py-10 text-center font-body text-sm text-ink-soft">Carregando...</p>}

        {!carregando && licitacoes.length === 0 && (
          <p className="py-10 text-center font-body text-sm text-ink-soft">Nenhuma licitação ativa no momento.</p>
        )}

        {!carregando && licitacoes.length > 0 && filtradas.length === 0 && (
          <p className="py-10 text-center font-body text-sm text-ink-soft">
            Nenhuma licitação encontrada com a busca e os filtros escolhidos.
          </p>
        )}

        {!carregando && visiveis.length > 0 && (
          <>
            {/* Tabela: telas largas */}
            <div className="hidden overflow-hidden rounded-xl border border-ink-soft/10 2xl:block">
              <table className="w-full table-fixed font-body text-sm">
                <thead className="bg-paper-2/70 text-left font-mono text-[11px] uppercase tracking-wide text-ink-soft">
                  <tr>
                    <th className="w-[10%] px-4 py-3.5">Nº</th>
                    <th className="w-[17%] px-4 py-3.5">Objeto</th>
                    <th className="w-[15%] px-4 py-3.5">Cliente</th>
                    <th className="w-[13%] px-4 py-3.5">Prazo</th>
                    <th className="w-[11%] px-4 py-3.5">Sessão</th>
                    <th className="w-[11%] px-4 py-3.5">Status</th>
                    <th className="w-[14%] px-4 py-3.5">Decisão do cliente</th>
                    <th className="w-[8%] px-4 py-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-soft/10">
                  {visiveis.map((licitacao) => {
                    const { sessao, prazoInterno, urgencia, cliente } = dadosDaLinha(licitacao)
                    return (
                      <tr key={licitacao.id} className="align-middle transition-colors hover:bg-paper-2/50">
                        <td className="px-4 py-4">
                          <p className="break-words font-semibold text-ink">{licitacao.numeroPregao}</p>
                        </td>
                        <td className="px-4 py-4 text-ink-soft">
                          <p className="line-clamp-2" title={licitacao.objeto}>
                            {licitacao.objeto || '—'}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-ink-soft">
                          <p className="line-clamp-2" title={cliente}>
                            {cliente}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="flex items-center gap-1.5 font-medium text-ink">
                            {formatarDataCurta(prazoInterno)}
                            {urgencia === 'vencido' && <IconeAlerta className="h-4 w-4 text-red-600" />}
                            {urgencia === 'atencao' && <IconeAlerta className="h-4 w-4 text-brass" />}
                          </p>
                          <p
                            className={`text-xs ${
                              urgencia === 'vencido'
                                ? 'font-semibold text-red-600'
                                : urgencia === 'atencao'
                                  ? 'font-semibold text-brass'
                                  : 'text-ink-soft'
                            }`}
                          >
                            {formatarHora(prazoInterno)}
                            {urgencia === 'vencido' && ' · Vencido'}
                            {urgencia === 'atencao' && ' · Próximo'}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-medium text-ink">{formatarDataCurta(sessao)}</p>
                          <p className="text-xs text-ink-soft">{formatarHora(sessao)}</p>
                        </td>
                        <td className="px-4 py-4">
                          <StatusPill
                            label={STATUS_LICITACAO_LABEL[licitacao.status]}
                            tone={STATUS_TONE[licitacao.status]}
                          />
                        </td>
                        <td className="px-4 py-4">
                          <Decisao valor={licitacao.decisaoCliente} />
                        </td>
                        <td className="px-4 py-4">
                          <Acoes licitacao={licitacao} podeEditar={podeEditar} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Cartões: celular e tablet */}
            <ul className="grid gap-3 sm:grid-cols-2 2xl:hidden">
              {visiveis.map((licitacao) => {
                const { sessao, prazoInterno, urgencia, cliente } = dadosDaLinha(licitacao)
                return (
                  <li key={licitacao.id} className="rounded-xl border border-ink-soft/10 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 break-words font-body text-sm font-semibold text-ink">
                        Nº {licitacao.numeroPregao}
                      </p>
                      <StatusPill
                        label={STATUS_LICITACAO_LABEL[licitacao.status]}
                        tone={STATUS_TONE[licitacao.status]}
                      />
                    </div>
                    <p className="mt-1 line-clamp-2 font-body text-sm text-ink-soft">{licitacao.objeto || '—'}</p>
                    <p className="mt-0.5 font-body text-sm text-ink-soft">{cliente}</p>

                    <dl className="mt-3 grid grid-cols-2 gap-3 font-body text-xs">
                      <div>
                        <dt className="font-mono uppercase tracking-wide text-ink-soft">Prazo</dt>
                        <dd
                          className={`mt-0.5 text-sm font-medium ${
                            urgencia === 'vencido' ? 'text-red-600' : urgencia === 'atencao' ? 'text-brass' : 'text-ink'
                          }`}
                        >
                          {formatarDataCurta(prazoInterno)} {formatarHora(prazoInterno)}
                          {urgencia === 'vencido' && ' · Vencido'}
                          {urgencia === 'atencao' && ' · Próximo'}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-mono uppercase tracking-wide text-ink-soft">Sessão</dt>
                        <dd className="mt-0.5 text-sm font-medium text-ink">
                          {formatarDataCurta(sessao)} {formatarHora(sessao)}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-ink-soft/10 pt-3">
                      <Decisao valor={licitacao.decisaoCliente} />
                      <Acoes licitacao={licitacao} podeEditar={podeEditar} />
                    </div>
                  </li>
                )
              })}
            </ul>

            <div className="mt-4 flex flex-col items-center justify-between gap-2 sm:flex-row">
              <p className="font-body text-xs text-ink-soft">
                Mostrando {visiveis.length} de {filtradas.length}{' '}
                {filtradas.length === 1 ? 'licitação ativa' : 'licitações ativas'}
              </p>
              <Link
                to="/admin/licitacoes"
                className="inline-flex items-center gap-1 font-body text-sm font-semibold text-forest hover:underline"
              >
                Ver todas as licitações
                <IconeSetaDireita className="h-4 w-4" />
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
