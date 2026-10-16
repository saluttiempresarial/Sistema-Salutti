// src/utils/eventosPainel.ts
//
// Eventos do painel inicial e das notificações, derivados das licitações que
// já existem (nenhum dado novo): para cada licitação ativa, o prazo interno
// da Salutti (calcularPrazoInterno) e a sessão pública. As etiquetas seguem
// as mesmas regras de urgência já usadas no calendário (prazoUtils).

import type { Licitacao } from '@/types/licitacao'
import { calcularPrazoInterno, classificarUrgenciaPrazo } from '@/utils/prazoUtils'

export type TomEtiqueta = 'danger' | 'warning' | 'success' | 'info' | 'neutral'

export interface EventoPainel {
  id: string
  tipo: 'prazo' | 'sessao'
  data: Date
  licitacaoId: string
  numeroPregao: string
  orgao: string
  etiqueta: string
  tom: TomEtiqueta
}

function mesmoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  )
}

export function inicioDoDia(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate())
}

export function eventosDasLicitacoes(licitacoes: Licitacao[], agora: Date = new Date()): EventoPainel[] {
  const eventos: EventoPainel[] = []

  licitacoes.forEach((licitacao) => {
    const sessaoISO = licitacao.dataEfetivaLicitacao || licitacao.dataLicitacao
    if (!sessaoISO) return
    const sessao = new Date(sessaoISO)
    if (Number.isNaN(sessao.getTime())) return

    const urgencia = classificarUrgenciaPrazo(sessaoISO, agora)
    eventos.push({
      id: `${licitacao.id}-prazo`,
      tipo: 'prazo',
      data: calcularPrazoInterno(sessaoISO),
      licitacaoId: licitacao.id,
      numeroPregao: licitacao.numeroPregao,
      orgao: licitacao.orgao,
      etiqueta: urgencia === 'vencido' ? 'Vencido' : urgencia === 'atencao' ? 'Próximo' : 'No prazo',
      tom: urgencia === 'vencido' ? 'danger' : urgencia === 'atencao' ? 'warning' : 'success',
    })

    const jaPassou = sessao.getTime() < agora.getTime()
    eventos.push({
      id: `${licitacao.id}-sessao`,
      tipo: 'sessao',
      data: sessao,
      licitacaoId: licitacao.id,
      numeroPregao: licitacao.numeroPregao,
      orgao: licitacao.orgao,
      etiqueta: jaPassou ? 'Encerrada' : mesmoDia(sessao, agora) ? 'Hoje' : 'Agendada',
      tom: jaPassou ? 'neutral' : 'info',
    })
  })

  return eventos.sort((a, b) => a.data.getTime() - b.data.getTime())
}

/** Eventos do painel "Próximos eventos": de 7 dias atrás em diante (para
 *  mostrar também o que acabou de vencer), do mais antigo ao mais novo. */
export function proximosEventos(eventos: EventoPainel[], agora: Date = new Date(), limite = 6): EventoPainel[] {
  const corte = inicioDoDia(agora).getTime() - 7 * 24 * 60 * 60 * 1000
  return eventos.filter((e) => e.data.getTime() >= corte).slice(0, limite)
}

/** Prazos vencidos ou próximos (alvo do sino): os próximos primeiro, do mais
 *  perto de vencer ao mais longe; depois os vencidos, do mais recente. */
export function alertasDePrazo(eventos: EventoPainel[]): EventoPainel[] {
  const prazos = eventos.filter((e) => e.tipo === 'prazo' && (e.tom === 'danger' || e.tom === 'warning'))
  const proximos = prazos.filter((e) => e.tom === 'warning').sort((a, b) => a.data.getTime() - b.data.getTime())
  const vencidos = prazos.filter((e) => e.tom === 'danger').sort((a, b) => b.data.getTime() - a.data.getTime())
  return [...proximos, ...vencidos]
}

/** "Hoje", "Amanhã", "Ontem" ou o dia da semana abreviado ("Qua"). */
export function rotuloDia(data: Date, agora: Date = new Date()): string {
  const diferenca = Math.round((inicioDoDia(data).getTime() - inicioDoDia(agora).getTime()) / 86_400_000)
  if (diferenca === 0) return 'Hoje'
  if (diferenca === 1) return 'Amanhã'
  if (diferenca === -1) return 'Ontem'
  const dia = data.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
  return dia.charAt(0).toUpperCase() + dia.slice(1)
}

export function formatarHora(data: Date): string {
  return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function formatarDataCurta(data: Date): string {
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
