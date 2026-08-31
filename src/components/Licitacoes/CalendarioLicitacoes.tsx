// src/components/licitacoes/CalendarioLicitacoes.tsx
//
// Calendário mensal simples: mostra a data da sessão de cada licitação e o
// prazo interno já calculado (N dias úteis antes — ver prazoUtils.ts).
// Usa só dado que já existe, sem nenhum conceito novo de "evento".
// Reutilizado pelo Admin/Funcionário (carteira completa ou restrita) e
// pelo Portal do Cliente (só as licitações dele) — cada página passa a
// lista de licitações já filtrada; este componente só desenha a grade.

import { useMemo, useState } from 'react'
import { Licitacao } from '@/types/licitacao'
import { calcularPrazoInterno, classificarUrgenciaPrazo, UrgenciaPrazo } from '@/utils/prazoUtils'

const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']

interface EventoDia {
  tipo: 'sessao' | 'prazo'
  label: string
  urgencia: UrgenciaPrazo
}

const URGENCIA_ESTILO: Record<UrgenciaPrazo, string> = {
  vencido: 'bg-red-50 text-red-700',
  atencao: 'bg-brass-pale text-brass',
  ok: 'bg-forest-mist text-forest-deep',
}

interface CalendarioLicitacoesProps {
  licitacoes: Licitacao[]
}

export function CalendarioLicitacoes({ licitacoes }: CalendarioLicitacoesProps) {
  const [mesReferencia, setMesReferencia] = useState(() => {
    const hoje = new Date()
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  })

  const eventosPorDia = useMemo(() => {
    const mapa = new Map<string, EventoDia[]>()

    function adicionar(data: Date, evento: EventoDia) {
      if (data.getFullYear() !== mesReferencia.getFullYear() || data.getMonth() !== mesReferencia.getMonth()) {
        return
      }
      const chave = String(data.getDate())
      const lista = mapa.get(chave) ?? []
      lista.push(evento)
      mapa.set(chave, lista)
    }

    licitacoes.forEach((licitacao) => {
      const dataSessaoISO = licitacao.dataEfetivaLicitacao || licitacao.dataLicitacao
      const dataSessao = new Date(dataSessaoISO)
      const urgencia = classificarUrgenciaPrazo(dataSessaoISO)

      adicionar(dataSessao, {
        tipo: 'sessao',
        label: licitacao.numeroPregao,
        urgencia,
      })

      const prazo = calcularPrazoInterno(dataSessaoISO)
      adicionar(prazo, {
        tipo: 'prazo',
        label: `Prazo: ${licitacao.numeroPregao}`,
        urgencia,
      })
    })

    return mapa
  }, [licitacoes, mesReferencia])

  const celulas = useMemo(() => {
    const ano = mesReferencia.getFullYear()
    const mes = mesReferencia.getMonth()
    const primeiroDiaSemana = new Date(ano, mes, 1).getDay()
    const diasNoMes = new Date(ano, mes + 1, 0).getDate()

    const lista: Array<{ dia: number | null }> = []
    for (let i = 0; i < primeiroDiaSemana; i++) lista.push({ dia: null })
    for (let d = 1; d <= diasNoMes; d++) lista.push({ dia: d })
    return lista
  }, [mesReferencia])

  function mesAnterior() {
    setMesReferencia((atual) => new Date(atual.getFullYear(), atual.getMonth() - 1, 1))
  }

  function mesProximo() {
    setMesReferencia((atual) => new Date(atual.getFullYear(), atual.getMonth() + 1, 1))
  }

  const nomeMes = mesReferencia.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={mesAnterior}
            aria-label="Mês anterior"
            className="rounded-md border border-ink-soft/20 px-2.5 py-1 font-body text-sm text-ink-soft hover:bg-paper-2"
          >
            ‹
          </button>
          <p className="font-display text-lg font-semibold capitalize text-forest-deep">{nomeMes}</p>
          <button
            type="button"
            onClick={mesProximo}
            aria-label="Próximo mês"
            className="rounded-md border border-ink-soft/20 px-2.5 py-1 font-body text-sm text-ink-soft hover:bg-paper-2"
          >
            ›
          </button>
        </div>

        <div className="flex flex-wrap gap-3 font-body text-xs text-ink-soft">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-forest" /> Sessão
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Prazo vencido
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-brass" /> Prazo próximo
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-forest-mist" /> Prazo ok
          </span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-ink-soft/10 bg-ink-soft/10">
        {DIAS_SEMANA.map((dia) => (
          <div
            key={dia}
            className="bg-paper-2 px-2 py-2 text-center font-mono text-[11px] uppercase tracking-wide text-ink-soft"
          >
            {dia}
          </div>
        ))}

        {celulas.map((celula, index) => {
          const eventos = celula.dia != null ? eventosPorDia.get(String(celula.dia)) ?? [] : []
          return (
            <div key={index} className="min-h-[92px] bg-white p-1.5">
              {celula.dia != null && (
                <>
                  <p className="font-body text-xs text-ink-soft">{celula.dia}</p>
                  <div className="mt-1 flex flex-col gap-1">
                    {eventos.slice(0, 3).map((evento, i) => (
                      <p
                        key={i}
                        className={`truncate rounded px-1.5 py-0.5 font-body text-[11px] ${URGENCIA_ESTILO[evento.urgencia]}`}
                        title={evento.label}
                      >
                        {evento.tipo === 'prazo' ? '⏱ ' : ''}
                        {evento.label}
                      </p>
                    ))}
                    {eventos.length > 3 && (
                      <p className="font-body text-[11px] text-ink-soft">+{eventos.length - 3} mais</p>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
