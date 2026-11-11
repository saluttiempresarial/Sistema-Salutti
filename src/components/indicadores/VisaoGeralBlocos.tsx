// src/components/indicadores/VisaoGeralBlocos.tsx
//
// Blocos visuais da aba "Visão geral" dos indicadores: moldura de cartão mais
// leve, funil enxuto, rosca de resultados e ranking de órgãos em barras
// horizontais. Só desenham números já calculados em utils/indicadoresCalculos.ts
// (nenhuma regra nova).

import type { ReactNode } from 'react'
import type { BarraOrgao, RelatorioPrincipal, ResultadoLicitacaoFiltro } from '../../types/indicadores'
import { formatarNumero } from '../../utils/prazoUtils'

const COR_GANHO = '#0B5C3C'
const COR_ANALISE = '#A9822F'
const COR_PERDIDA = '#C9C4B2'
const COR_AGUARDANDO = '#E3DFD2'

export function CartaoVisao({
  titulo,
  ajuda,
  children,
  className = '',
}: {
  titulo: string
  /** Texto de apoio, visível ao passar o mouse no ícone "?". */
  ajuda?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-2xl border border-ink-soft/10 bg-white p-5 shadow-soft ${className}`}>
      <h3 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
        {titulo}
        {ajuda && (
          <span
            title={ajuda}
            aria-label={ajuda}
            className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-ink-soft/40 font-body text-[10px] font-normal text-ink-soft"
          >
            ?
          </span>
        )}
      </h3>
      <div className="mt-4">{children}</div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Funil do período
// ---------------------------------------------------------------------------
const TONS_FUNIL = ['#9CC9B0', '#6FAE8A', '#3F8A63', '#0B5C3C']

export function FunilPeriodo({
  dados,
  resultadoFiltro,
}: {
  dados: RelatorioPrincipal
  resultadoFiltro?: ResultadoLicitacaoFiltro
}) {
  if (dados.cadastradas === 0) {
    return <p className="py-6 text-center font-body text-sm text-ink-soft">Sem dados para os filtros escolhidos.</p>
  }
  const ultima =
    resultadoFiltro === 'perdido'
      ? { rotulo: 'Perdidas', quantidade: dados.perdidas + dados.perdidasEmAnalise }
      : resultadoFiltro === 'ganho'
        ? { rotulo: 'Ganhas', quantidade: dados.ganhas + dados.arrematadasEmAnalise }
        : { rotulo: 'Ganhas (homologado)', quantidade: dados.ganhas }
  const etapas = [
    { rotulo: 'Enviadas ao cliente', quantidade: dados.enviadas },
    { rotulo: 'Retornadas', quantidade: dados.retornadas },
    { rotulo: 'Participou', quantidade: dados.participou },
    ultima,
  ]
  const maximo = Math.max(...etapas.map((e) => e.quantidade), 1)
  return (
    <ol className="space-y-3">
      {etapas.map((etapa, i) => {
        const anterior = i > 0 ? etapas[i - 1].quantidade : 0
        const conversao = i > 0 && anterior > 0 ? `${formatarNumero((etapa.quantidade / anterior) * 100, 0)}%` : null
        return (
          <li key={etapa.rotulo}>
            <div className="flex items-baseline justify-between font-body text-sm">
              <span className="text-ink">{etapa.rotulo}</span>
              <span className="text-ink">
                <strong>{formatarNumero(etapa.quantidade)}</strong>
                {conversao && <span className="ml-2 text-xs text-ink-soft">{conversao} da etapa anterior</span>}
              </span>
            </div>
            <div className="mt-1 h-3 rounded-full bg-forest-mist">
              <div
                className="h-3 rounded-full"
                style={{
                  width: `${Math.max((etapa.quantidade / maximo) * 100, 2)}%`,
                  backgroundColor: TONS_FUNIL[i],
                }}
              />
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// ---------------------------------------------------------------------------
// Rosca: resultado das disputas
// ---------------------------------------------------------------------------
export function RoscaResultados({ dados }: { dados: RelatorioPrincipal }) {
  const fatias = [
    { rotulo: 'Ganhas', valor: dados.ganhas, cor: COR_GANHO },
    { rotulo: 'Perdidas', valor: dados.perdidas, cor: COR_PERDIDA },
    { rotulo: 'Em análise', valor: dados.arrematadasEmAnalise + dados.perdidasEmAnalise, cor: COR_ANALISE },
    { rotulo: 'Aguardando resultado', valor: dados.aguardandoResultado, cor: COR_AGUARDANDO },
  ]
  const total = fatias.reduce((s, f) => s + f.valor, 0)
  if (total === 0) {
    return <p className="py-6 text-center font-body text-sm text-ink-soft">Nenhuma disputa nos filtros escolhidos.</p>
  }
  const raio = 34
  const circunferencia = 2 * Math.PI * raio
  let acumulado = 0
  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 100 100" className="h-32 w-32 shrink-0" role="img" aria-label="Resultado das disputas">
        <circle cx="50" cy="50" r={raio} fill="none" stroke="#F0EEE6" strokeWidth="14" />
        {fatias
          .filter((f) => f.valor > 0)
          .map((f) => {
            const tamanho = (f.valor / total) * circunferencia
            const deslocamento = -acumulado
            acumulado += tamanho
            return (
              <circle
                key={f.rotulo}
                cx="50"
                cy="50"
                r={raio}
                fill="none"
                stroke={f.cor}
                strokeWidth="14"
                strokeDasharray={`${tamanho} ${circunferencia - tamanho}`}
                strokeDashoffset={deslocamento}
                transform="rotate(-90 50 50)"
              />
            )
          })}
        <text x="50" y="50" textAnchor="middle" className="fill-ink font-display" fontSize="16" fontWeight="600">
          {formatarNumero(total)}
        </text>
        <text x="50" y="62" textAnchor="middle" className="fill-ink-soft font-body" fontSize="7">
          disputas
        </text>
      </svg>
      <ul className="space-y-1.5 font-body text-sm">
        {fatias.map((f) => (
          <li key={f.rotulo} className="flex items-center gap-2 text-ink">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: f.cor }} aria-hidden="true" />
            <span>{f.rotulo}</span>
            <strong className="ml-1">{formatarNumero(f.valor)}</strong>
            <span className="text-xs text-ink-soft">({formatarNumero((f.valor / total) * 100, 0)}%)</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Ranking de órgãos em barras horizontais
// ---------------------------------------------------------------------------
export function RankingOrgaos({ barras }: { barras: BarraOrgao[] }) {
  const lista = [...barras].filter((b) => b.participacoes > 0).sort((a, b) => b.participacoes - a.participacoes).slice(0, 6)
  if (lista.length === 0) {
    return <p className="py-6 text-center font-body text-sm text-ink-soft">Sem participações nos filtros escolhidos.</p>
  }
  const maximo = Math.max(...lista.map((b) => b.participacoes), 1)
  return (
    <div>
      <ul className="space-y-3">
        {lista.map((b) => (
          <li key={b.orgao} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 font-body text-sm">
            <span className="truncate text-ink" title={b.orgao}>
              {b.orgao}
            </span>
            <div className="h-3 rounded-full bg-forest-mist" aria-hidden="true">
              <div className="h-3 rounded-full" style={{ width: `${(b.participacoes / maximo) * 100}%`, backgroundColor: COR_ANALISE }}>
                <div className="h-3 rounded-full" style={{ width: `${(b.vitorias / b.participacoes) * 100}%`, backgroundColor: COR_GANHO }} />
              </div>
            </div>
            <span className="whitespace-nowrap text-xs text-ink-soft">
              {formatarNumero(b.vitorias)} de {formatarNumero(b.participacoes)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-center gap-4 font-body text-xs text-ink-soft">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COR_ANALISE }} aria-hidden="true" />
          Participações
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COR_GANHO }} aria-hidden="true" />
          Com vitória
        </span>
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Barras horizontais "participou x com vitória" (modalidade, esfera, UF)
// ---------------------------------------------------------------------------
export interface LinhaResultado {
  chave: string
  nome: string
  licitacoes: number
  participou: number
  ganhou: number
  /** ganhou ÷ participou, em %; null = sem participação. */
  taxa: number | null
}

export function BarrasResultado({
  linhas,
  rotuloTotal = 'Participou',
  rotuloGanho = 'Com vitória',
}: {
  linhas: LinhaResultado[]
  rotuloTotal?: string
  rotuloGanho?: string
}) {
  if (linhas.length === 0) {
    return <p className="py-6 text-center font-body text-sm text-ink-soft">Sem dados para os filtros escolhidos.</p>
  }
  const maximo = Math.max(...linhas.map((l) => l.participou), 1)
  return (
    <div>
      <ul className="space-y-3">
        {linhas.map((l) => (
          <li key={l.chave} className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-3 font-body text-sm">
            <span className="truncate text-ink" title={`${l.nome}: ${formatarNumero(l.licitacoes)} ${l.licitacoes === 1 ? 'licitação' : 'licitações'}`}>
              {l.nome}
            </span>
            <div className="h-3 rounded-full bg-forest-mist" aria-hidden="true">
              <div
                className="h-3 rounded-full"
                style={{ width: `${l.participou > 0 ? Math.max((l.participou / maximo) * 100, 3) : 0}%`, backgroundColor: COR_ANALISE }}
              >
                <div
                  className="h-3 rounded-full"
                  style={{ width: `${l.participou > 0 ? (l.ganhou / l.participou) * 100 : 0}%`, backgroundColor: COR_GANHO }}
                />
              </div>
            </div>
            <span className="whitespace-nowrap text-xs text-ink-soft">
              {formatarNumero(l.ganhou)} de {formatarNumero(l.participou)}
              <strong className="ml-2 text-ink">{l.taxa === null ? '—' : `${formatarNumero(l.taxa, 0)}%`}</strong>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-center gap-4 font-body text-xs text-ink-soft">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COR_ANALISE }} aria-hidden="true" />
          {rotuloTotal}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COR_GANHO }} aria-hidden="true" />
          {rotuloGanho}
        </span>
        <span>Percentual: ganho sobre o total</span>
      </p>
    </div>
  )
}
