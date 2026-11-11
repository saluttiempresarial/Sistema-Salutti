// src/components/indicadores/FaixaIndicadoresResumo.tsx
//
// Faixa de indicadores-chave no topo da aba "Visão geral": os números que a
// diretoria olha primeiro. Cada um mostra a tendência (gráfico pequeno, mês a
// mês), a variação contra o período anterior de mesma duração e o valor desse
// período anterior (só quando o filtro de período tem data inicial e final).
// Usa os mesmos números dos cards abaixo: nenhum cálculo novo.

import type { ReactNode } from 'react'
import type { IndicadoresAdmin } from '../../types/indicadores'
import { formatarNumero } from '../../utils/prazoUtils'

export type ChaveFaixa = 'funil' | 'taxa_vitoria' | 'valor_adjudicado' | 'prazos_proximos'

/** Um mês da série que alimenta os gráficos pequenos de "enviadas" e "participação". */
export interface PontoSerieResumo {
  mes: string // yyyy-mm
  rotulo: string
  enviadas: number
  participacao: number | null
}

interface FaixaProps {
  atual: IndicadoresAdmin
  /** Mesmo recorte no período anterior; ausente = sem comparação. */
  anterior?: IndicadoresAdmin | null
  /** Série mensal para os gráficos pequenos. */
  serie?: PontoSerieResumo[]
  /** Informa se o perfil pode ver o indicador de origem de cada número. */
  pode: (chave: ChaveFaixa) => boolean
}

function percentualParticipacao(i: IndicadoresAdmin): number | null {
  const { participou, enviadas } = i.relatorioPrincipal
  return enviadas > 0 ? (participou / enviadas) * 100 : null
}

function moedaCompacta(valor: number): string {
  const abs = Math.abs(valor)
  if (abs >= 1_000_000) return `R$ ${formatarNumero(valor / 1_000_000, 1)} mi`
  if (abs >= 1_000) return `R$ ${formatarNumero(valor / 1_000, 1)} mil`
  return `R$ ${formatarNumero(valor, 0)}`
}

type Variacao = { texto: string; sentido: 'alta' | 'baixa' | 'igual' } | null

/** Variação relativa (contagens e valores). */
function variacaoRelativa(atual: number, anterior: number | undefined): Variacao {
  if (anterior === undefined || anterior === 0) return null
  const v = ((atual - anterior) / anterior) * 100
  if (Math.abs(v) < 0.05) return { texto: 'igual ao período anterior', sentido: 'igual' }
  return { texto: `${v > 0 ? '▲' : '▼'} ${formatarNumero(Math.abs(v), 0)}% vs. anterior`, sentido: v > 0 ? 'alta' : 'baixa' }
}

/** Variação em pontos percentuais (taxas). */
function variacaoPontos(atual: number | null, anterior: number | null | undefined): Variacao {
  if (atual === null || anterior === null || anterior === undefined) return null
  const v = atual - anterior
  if (Math.abs(v) < 0.05) return { texto: 'igual ao período anterior', sentido: 'igual' }
  return { texto: `${v > 0 ? '▲' : '▼'} ${formatarNumero(Math.abs(v), 1)} p.p. vs. anterior`, sentido: v > 0 ? 'alta' : 'baixa' }
}

function Tendencia({ valores, cor }: { valores: number[]; cor: string }) {
  if (valores.length < 2) return <div className="h-7" aria-hidden="true" />
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const amplitude = max - min || 1
  const pontos = valores
    .map((v, i) => `${(i / (valores.length - 1)) * 100},${26 - ((v - min) / amplitude) * 22}`)
    .join(' ')
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-7 w-full" role="img" aria-label="Tendência mês a mês">
      <polyline points={pontos} fill="none" stroke={cor} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

function Kpi({
  titulo,
  valor,
  tendencia,
  corTendencia = '#0B5C3C',
  variacao,
  anterior,
  nota,
  alerta,
}: {
  titulo: string
  valor: ReactNode
  tendencia?: number[]
  corTendencia?: string
  variacao?: Variacao
  /** Valor do período anterior, já formatado. */
  anterior?: string
  nota?: string
  alerta?: boolean
}) {
  const cor =
    variacao?.sentido === 'alta' ? 'text-forest-deep' : variacao?.sentido === 'baixa' ? 'text-red-700' : 'text-ink-soft'
  return (
    <div className={`flex flex-col rounded-2xl border p-4 shadow-soft ${alerta ? 'border-brass/50' : 'border-ink-soft/10'} bg-white`}>
      <p className="font-body text-xs text-ink-soft">{titulo}</p>
      <p className="mt-1 font-display text-3xl font-semibold text-forest-deep">{valor}</p>
      {tendencia !== undefined && (
        <div className="mt-2">
          <Tendencia valores={tendencia} cor={corTendencia} />
        </div>
      )}
      {variacao && <p className={`mt-2 font-body text-xs font-medium ${cor}`}>{variacao.texto}</p>}
      {anterior && <p className="font-body text-xs text-ink-soft">Período anterior: {anterior}</p>}
      {nota && <p className="mt-2 font-body text-xs text-ink-soft">{nota}</p>}
    </div>
  )
}

export function FaixaIndicadoresResumo({ atual, anterior, serie = [], pode }: FaixaProps) {
  const pct = (v: number | null) => (v === null ? '—' : `${formatarNumero(v, 1)}%`)
  const cartoes: ReactNode[] = []

  if (pode('funil')) {
    const part = percentualParticipacao(atual)
    const partAnterior = anterior ? percentualParticipacao(anterior) : undefined
    cartoes.push(
      <Kpi
        key="enviadas"
        titulo="Enviadas ao cliente"
        valor={formatarNumero(atual.relatorioPrincipal.enviadas)}
        tendencia={serie.map((p) => p.enviadas)}
        variacao={variacaoRelativa(atual.relatorioPrincipal.enviadas, anterior?.relatorioPrincipal.enviadas)}
        anterior={anterior ? formatarNumero(anterior.relatorioPrincipal.enviadas) : undefined}
      />,
      <Kpi
        key="participacao"
        titulo="Taxa de participação"
        valor={pct(part)}
        corTendencia="#A9822F"
        tendencia={serie.filter((p) => p.participacao !== null).map((p) => p.participacao as number)}
        variacao={variacaoPontos(part, partAnterior)}
        anterior={anterior && partAnterior !== null && partAnterior !== undefined ? pct(partAnterior) : undefined}
        nota="participou ÷ enviadas"
      />,
    )
  }
  if (pode('taxa_vitoria')) {
    const taxa = atual.taxaVitoria.atual.percentualQuantidade
    const taxaAnterior = anterior?.taxaVitoria.atual.percentualQuantidade
    cartoes.push(
      <Kpi
        key="vitoria"
        titulo="Taxa de vitória"
        valor={pct(taxa)}
        tendencia={atual.taxaVitoriaPorMes.filter((m) => m.percentualQuantidade !== null).map((m) => m.percentualQuantidade as number)}
        variacao={variacaoPontos(taxa, taxaAnterior)}
        anterior={anterior && taxaAnterior !== null && taxaAnterior !== undefined ? pct(taxaAnterior) : undefined}
        nota="por item, só ganhos ou perdidos"
      />,
    )
  }
  if (pode('valor_adjudicado')) {
    cartoes.push(
      <Kpi
        key="valor"
        titulo="Valor adjudicado"
        valor={moedaCompacta(atual.valorAdjudicado.total)}
        tendencia={atual.valorAdjudicado.porMes.map((m) => m.valor)}
        variacao={variacaoRelativa(atual.valorAdjudicado.total, anterior?.valorAdjudicado.total)}
        anterior={anterior ? moedaCompacta(anterior.valorAdjudicado.total) : undefined}
        nota="não é faturamento"
      />,
    )
  }
  if (pode('prazos_proximos')) {
    const n = atual.prazosProximos.vencidos + atual.prazosProximos.vencendoEm24h
    cartoes.push(
      <Kpi
        key="atencao"
        titulo="Requer atenção"
        valor={formatarNumero(n)}
        alerta={n > 0}
        nota={n > 0 ? 'prazos vencidos ou vencendo em 24 h' : 'nenhum prazo crítico'}
      />,
    )
  }

  if (cartoes.length === 0) return null
  return <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-5">{cartoes}</div>
}
