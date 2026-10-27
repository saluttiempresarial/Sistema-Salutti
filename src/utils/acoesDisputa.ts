// src/utils/acoesDisputa.ts
//
// Alertas das ações pendentes da Disputa (migração 059): para cada disputa com
// ação pendente, compara o prazo da ação com o momento atual.
//   - vencida: prazo já passou;
//   - proxima: falta pouco para o prazo (janela de 48 h para recurso e
//     contrarrazões, que têm prazo legal; 24 h para as demais ações);
//   - sem_prazo: há ação pendente, mas o prazo não foi informado.
// Ações com prazo ainda distante não geram alerta. Nenhum dado novo: tudo vem
// de `acaoPendente` e `prazoAcao` da própria disputa.

import type { AcaoPendente, Disputa } from '@/types/disputa'
import { ACAO_PENDENTE_LABEL } from '@/types/disputa'
import type { Licitacao } from '@/types/licitacao'

export type SituacaoAlertaAcao = 'vencida' | 'proxima' | 'sem_prazo'

export interface AlertaAcaoDisputa {
  disputaId: string
  licitacaoId: string
  numeroPregao: string
  orgao: string
  clienteId?: string
  acao: AcaoPendente
  acaoRotulo: string
  /** Prazo da ação (null quando não informado). */
  prazo: Date | null
  situacao: SituacaoAlertaAcao
}

const HORA_MS = 3_600_000

/** Ações com prazo legal: avisar com mais antecedência. */
const ACOES_PRAZO_LEGAL: ReadonlySet<AcaoPendente> = new Set<AcaoPendente>([
  'apresentar_recurso',
  'apresentar_contrarrazoes',
])

export function janelaDeAvisoHoras(acao: AcaoPendente): number {
  return ACOES_PRAZO_LEGAL.has(acao) ? 48 : 24
}

const ORDEM: Record<SituacaoAlertaAcao, number> = { vencida: 0, proxima: 1, sem_prazo: 2 }

export function alertasDeAcoesDisputa(
  disputas: Disputa[],
  licitacaoPorId: Map<string, Licitacao>,
  agora: Date = new Date()
): AlertaAcaoDisputa[] {
  const alertas: AlertaAcaoDisputa[] = []

  disputas.forEach((d) => {
    if (!d.acaoPendente || d.acaoPendente === 'nenhuma') return
    const licitacao = licitacaoPorId.get(d.licitacaoId)
    if (!licitacao) return

    const prazoBruto = d.prazoAcao ? new Date(d.prazoAcao) : null
    const prazo = prazoBruto && !isNaN(prazoBruto.getTime()) ? prazoBruto : null

    let situacao: SituacaoAlertaAcao
    if (!prazo) situacao = 'sem_prazo'
    else if (prazo.getTime() < agora.getTime()) situacao = 'vencida'
    else if (prazo.getTime() - agora.getTime() <= janelaDeAvisoHoras(d.acaoPendente) * HORA_MS) situacao = 'proxima'
    else return

    alertas.push({
      disputaId: d.id,
      licitacaoId: d.licitacaoId,
      numeroPregao: licitacao.numeroPregao,
      orgao: licitacao.orgao,
      clienteId: licitacao.clienteId,
      acao: d.acaoPendente,
      acaoRotulo: ACAO_PENDENTE_LABEL[d.acaoPendente],
      prazo,
      situacao,
    })
  })

  return alertas.sort((a, b) => {
    if (a.situacao !== b.situacao) return ORDEM[a.situacao] - ORDEM[b.situacao]
    return (a.prazo?.getTime() ?? 0) - (b.prazo?.getTime() ?? 0)
  })
}

export const ROTULO_SITUACAO_ACAO: Record<SituacaoAlertaAcao, string> = {
  vencida: 'Vencida',
  proxima: 'Prazo próximo',
  sem_prazo: 'Sem prazo',
}
