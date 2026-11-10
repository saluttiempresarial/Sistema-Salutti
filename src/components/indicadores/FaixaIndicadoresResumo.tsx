// src/components/indicadores/FaixaIndicadoresResumo.tsx
//
// Faixa de indicadores-chave no topo da aba "Visão geral": os números que a
// diretoria olha primeiro, cada um comparado ao período anterior de mesma
// duração (só quando o filtro de período tem data inicial e final). Usa os
// mesmos números dos cards abaixo (nenhum cálculo novo): enviadas, taxa de
// participação, taxa de vitória, valor adjudicado e o que requer atenção.

import type { ReactNode } from 'react'
import type { IndicadoresAdmin } from '../../types/indicadores'
import { formatarNumero } from '../../utils/prazoUtils'

export type ChaveFaixa = 'funil' | 'taxa_vitoria' | 'valor_adjudicado' | 'prazos_proximos'

interface FaixaProps {
  atual: IndicadoresAdmin
  /** Mesmo recorte no período anterior; ausente = sem comparação. */
  anterior?: IndicadoresAdmin | null
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
  return { texto: `${v > 0 ? '▲' : '▼'} ${formatarNumero(Math.abs(v), 0)}% vs. período anterior`, sentido: v > 0 ? 'alta' : 'baixa' }
}

/** Variação em pontos percentuais (taxas). */
function variacaoPontos(atual: number | null, anterior: number | null | undefined): Variacao {
  if (atual === null || anterior === null || anterior === undefined) return null
  const v = atual - anterior
  if (Math.abs(v) < 0.05) return { texto: 'igual ao período anterior', sentido: 'igual' }
  return { texto: `${v > 0 ? '▲' : '▼'} ${formatarNumero(Math.abs(v), 1)} p.p. vs. período anterior`, sentido: v > 0 ? 'alta' : 'baixa' }
}

function Kpi({ titulo, valor, variacao, nota, alerta }: { titulo: string; valor: ReactNode; variacao?: Variacao; nota?: string; alerta?: boolean }) {
  const cor =
    variacao?.sentido === 'alta' ? 'text-forest-deep' : variacao?.sentido === 'baixa' ? 'text-red-700' : 'text-ink-soft'
  return (
    <div className={`rounded-xl border p-4 shadow-soft ${alerta ? 'border-brass/50 bg-white' : 'border-ink-soft/15 bg-white'}`}>
      <p className="font-body text-xs text-ink-soft">{titulo}</p>
      <p className="mt-1 font-display text-3xl text-ink">{valor}</p>
      {variacao && <p className={`mt-1 font-body text-xs ${cor}`}>{variacao.texto}</p>}
      {nota && <p className="mt-1 font-body text-xs text-ink-soft">{nota}</p>}
    </div>
  )
}

export function FaixaIndicadoresResumo({ atual, anterior, pode }: FaixaProps) {
  const pct = (v: number | null) => (v === null ? '—' : `${formatarNumero(v, 1)}%`)
  const cartoes: ReactNode[] = []

  if (pode('funil')) {
    cartoes.push(
      <Kpi
        key="enviadas"
        titulo="Licitações enviadas ao cliente"
        valor={formatarNumero(atual.relatorioPrincipal.enviadas)}
        variacao={variacaoRelativa(atual.relatorioPrincipal.enviadas, anterior?.relatorioPrincipal.enviadas)}
      />,
      <Kpi
        key="participacao"
        titulo="Taxa de participação"
        valor={pct(percentualParticipacao(atual))}
        variacao={variacaoPontos(percentualParticipacao(atual), anterior ? percentualParticipacao(anterior) : undefined)}
        nota="participou ÷ enviadas"
      />,
    )
  }
  if (pode('taxa_vitoria')) {
    cartoes.push(
      <Kpi
        key="vitoria"
        titulo="Taxa de vitória"
        valor={pct(atual.taxaVitoria.atual.percentualQuantidade)}
        variacao={variacaoPontos(
          atual.taxaVitoria.atual.percentualQuantidade,
          anterior?.taxaVitoria.atual.percentualQuantidade,
        )}
        nota="por item, só definitivos ganhos ou perdidos"
      />,
    )
  }
  if (pode('valor_adjudicado')) {
    cartoes.push(
      <Kpi
        key="valor"
        titulo="Valor adjudicado"
        valor={moedaCompacta(atual.valorAdjudicado.total)}
        variacao={variacaoRelativa(atual.valorAdjudicado.total, anterior?.valorAdjudicado.total)}
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
  return <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">{cartoes}</div>
}
