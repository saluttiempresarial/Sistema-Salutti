// src/components/Licitacoes/CalendarioLicitacoes.tsx
//
// Calendário mensal: mostra a data da sessão de cada licitação e o
// prazo interno já calculado (N dias úteis antes — ver prazoUtils.ts).
// Usa só dado que já existe, sem nenhum conceito novo de "evento".
// Reutilizado pelo Admin/Funcionário (carteira completa ou restrita) e
// pelo Portal do Cliente (só as licitações dele) — cada página passa a
// lista de licitações já filtrada; este componente só desenha a grade.
//
// Modo `amplo` (15/10, redesenho do painel): ocupa a largura toda, com
// células mais altas, dia de hoje destacado, dias dos meses vizinhos
// esmaecidos e botão "Hoje". No celular mostra pontos coloridos no lugar dos
// textos. Sem `amplo` o componente continua igual ao de antes (Portal do
// Cliente).
//
// Visões Semana e Dia (16/10, a pedido do Márcio): no modo `amplo` há um
// seletor Mês | Semana | Dia. A semana vira uma lista de 7 dias (domingo a
// sábado) e o dia uma lista de horários, ambas com hora, tipo (sessão ou
// prazo), número e órgão — sem rolagem horizontal. Os eventos são os mesmos
// do mês (sessão + prazo interno); nada novo é consultado.

import { useMemo, useState } from 'react'
import { Licitacao } from '@/types/licitacao'
import { calcularPrazoInterno, classificarUrgenciaPrazo, UrgenciaPrazo } from '@/utils/prazoUtils'
import { IconeSetaDireita, IconeSetaEsquerda } from '@/components/icones'

const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']

interface EventoDia {
  tipo: 'sessao' | 'prazo'
  label: string
  urgencia: UrgenciaPrazo
  data: Date
  numero: string
  orgao: string
}

type Visao = 'mes' | 'semana' | 'dia'

const VISOES: { valor: Visao; rotulo: string }[] = [
  { valor: 'mes', rotulo: 'Mês' },
  { valor: 'semana', rotulo: 'Semana' },
  { valor: 'dia', rotulo: 'Dia' },
]

function chaveDia(data: Date): string {
  return `${data.getFullYear()}-${data.getMonth()}-${data.getDate()}`
}

function maiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function formatarHoraEvento(data: Date): string {
  return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function diaMesCurto(data: Date): string {
  return data.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '')
}

function LinhaEvento({ evento, rotuloPrazo }: { evento: EventoDia; rotuloPrazo: string }) {
  return (
    <li className={`flex items-center gap-3 rounded-lg px-3 py-2 ${URGENCIA_ESTILO[evento.urgencia]}`}>
      <span className="w-12 shrink-0 font-mono text-xs font-semibold">{formatarHoraEvento(evento.data)}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-body text-sm font-semibold">
          {evento.tipo === 'prazo' ? rotuloPrazo : 'Sessão pública'} • {evento.numero}
        </p>
        <p className="truncate font-body text-xs opacity-80" title={evento.orgao}>
          {evento.orgao}
        </p>
      </div>
    </li>
  )
}

const URGENCIA_ESTILO: Record<UrgenciaPrazo, string> = {
  vencido: 'bg-red-50 text-red-700',
  atencao: 'bg-brass-pale text-brass',
  ok: 'bg-forest-mist text-forest-deep',
}

const URGENCIA_PONTO: Record<UrgenciaPrazo, string> = {
  vencido: 'bg-red-500',
  atencao: 'bg-brass',
  ok: 'bg-forest',
}

interface CalendarioLicitacoesProps {
  licitacoes: Licitacao[]
  /** Versão grande, para o painel inicial e a tela do calendário. */
  amplo?: boolean
  /** Mostra a legenda de cores acima da grade (padrão: sim). */
  mostrarLegenda?: boolean
  /** Nome do evento de prazo nas visões Semana e Dia. Padrão: "Prazo interno". */
  rotuloPrazo?: string
}

interface Celula {
  data: Date
  foraDoMes: boolean
}

export function CalendarioLicitacoes({
  licitacoes,
  amplo = false,
  mostrarLegenda = true,
  rotuloPrazo = 'Prazo interno',
}: CalendarioLicitacoesProps) {
  const [visao, setVisao] = useState<Visao>('mes')
  // Data de referência: o mês exibido (visão Mês), a semana que a contém
  // (visão Semana) ou o próprio dia (visão Dia).
  const [dataRef, setDataRef] = useState(() => {
    const hoje = new Date()
    return new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  })
  const mesReferencia = useMemo(() => new Date(dataRef.getFullYear(), dataRef.getMonth(), 1), [dataRef])

  // Eventos de todas as licitações, por dia (chave ano-mês-dia), em ordem de horário.
  const eventosPorChave = useMemo(() => {
    const mapa = new Map<string, EventoDia[]>()

    function adicionar(data: Date, evento: Omit<EventoDia, 'data'>) {
      const chave = chaveDia(data)
      const lista = mapa.get(chave) ?? []
      lista.push({ ...evento, data })
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
        numero: licitacao.numeroPregao,
        orgao: licitacao.orgao,
      })

      const prazo = calcularPrazoInterno(dataSessaoISO)
      adicionar(prazo, {
        tipo: 'prazo',
        label: `Prazo: ${licitacao.numeroPregao}`,
        urgencia,
        numero: licitacao.numeroPregao,
        orgao: licitacao.orgao,
      })
    })

    mapa.forEach((lista) => lista.sort((a, b) => a.data.getTime() - b.data.getTime()))
    return mapa
  }, [licitacoes])

  // Eventos do dia, na grade mensal (dias de outros meses ficam vazios, como sempre).
  function eventosDoDia(data: Date): EventoDia[] {
    return eventosPorChave.get(chaveDia(data)) ?? []
  }

  const celulas = useMemo(() => {
    const ano = mesReferencia.getFullYear()
    const mes = mesReferencia.getMonth()
    const primeiroDiaSemana = new Date(ano, mes, 1).getDay()
    const diasNoMes = new Date(ano, mes + 1, 0).getDate()

    const lista: Celula[] = []
    // Dias do mês anterior que completam a primeira semana.
    for (let i = primeiroDiaSemana; i > 0; i--) {
      lista.push({ data: new Date(ano, mes, 1 - i), foraDoMes: true })
    }
    for (let d = 1; d <= diasNoMes; d++) lista.push({ data: new Date(ano, mes, d), foraDoMes: false })
    // Dias do mês seguinte que completam a última semana.
    let proximo = 1
    while (lista.length % 7 !== 0) {
      lista.push({ data: new Date(ano, mes + 1, proximo++), foraDoMes: true })
    }
    return lista
  }, [mesReferencia])

  // Avança ou volta uma unidade da visão atual: mês, semana ou dia.
  function deslocar(sentido: -1 | 1) {
    setDataRef((atual) => {
      if (!amplo || visao === 'mes') return new Date(atual.getFullYear(), atual.getMonth() + sentido, 1)
      const passo = visao === 'semana' ? 7 : 1
      return new Date(atual.getFullYear(), atual.getMonth(), atual.getDate() + sentido * passo)
    })
  }

  const mesAnterior = () => deslocar(-1)
  const mesProximo = () => deslocar(1)

  function irParaHoje() {
    const agora = new Date()
    setDataRef(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()))
  }

  // Semana (domingo a sábado) que contém a data de referência.
  const diasDaSemana = useMemo(() => {
    const inicio = new Date(dataRef.getFullYear(), dataRef.getMonth(), dataRef.getDate() - dataRef.getDay())
    return Array.from({ length: 7 }, (_, i) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i))
  }, [dataRef])

  const nomeMesBruto = mesReferencia.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  // "outubro de 2026" -> "Outubro de 2026" (só a primeira letra; o `capitalize` do CSS deixava "De").
  const nomeMes = nomeMesBruto.charAt(0).toUpperCase() + nomeMesBruto.slice(1)
  const tituloSemana = (() => {
    const inicio = diasDaSemana[0]
    const fim = diasDaSemana[6]
    if (inicio.getFullYear() !== fim.getFullYear()) {
      return `${diaMesCurto(inicio)} de ${inicio.getFullYear()} – ${diaMesCurto(fim)} de ${fim.getFullYear()}`
    }
    return `${diaMesCurto(inicio)} – ${diaMesCurto(fim)} de ${fim.getFullYear()}`
  })()
  const tituloDia = maiuscula(
    dataRef.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  )
  const tituloVisao = visao === 'semana' ? tituloSemana : visao === 'dia' ? tituloDia : nomeMes
  const unidade = visao === 'semana' ? 'semana' : visao === 'dia' ? 'dia' : 'mês'

  const hoje = new Date()
  const ehHoje = (data: Date) =>
    data.getFullYear() === hoje.getFullYear() &&
    data.getMonth() === hoje.getMonth() &&
    data.getDate() === hoje.getDate()

  const legenda = (
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
  )

  if (amplo) {
    return (
      <div className="w-full">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={mesAnterior}
              aria-label={`${maiuscula(unidade)} anterior`}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-soft/20 text-ink-soft hover:bg-forest-mist hover:text-forest-deep"
            >
              <IconeSetaEsquerda className="h-4 w-4" />
            </button>
            <p
              className={`text-center font-display text-lg font-semibold text-forest-deep ${
                visao === 'mes' ? 'min-w-[10rem]' : 'min-w-[12rem]'
              }`}
            >
              {tituloVisao}
            </p>
            <button
              type="button"
              onClick={mesProximo}
              aria-label={`Próxim${visao === 'semana' ? 'a' : 'o'} ${unidade}`}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-soft/20 text-ink-soft hover:bg-forest-mist hover:text-forest-deep"
            >
              <IconeSetaDireita className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={irParaHoje}
              className="ml-1 rounded-lg border border-ink-soft/20 px-3 py-1.5 font-body text-sm font-semibold text-forest-deep hover:bg-forest-mist"
            >
              Hoje
            </button>
          </div>
          <div className="flex items-center gap-3">
            {mostrarLegenda && legenda}
            <div role="group" aria-label="Visão do calendário" className="flex rounded-lg border border-ink-soft/20 p-0.5">
              {VISOES.map((opcao) => (
                <button
                  key={opcao.valor}
                  type="button"
                  onClick={() => setVisao(opcao.valor)}
                  aria-pressed={visao === opcao.valor}
                  className={`rounded-md px-3 py-1.5 font-body text-sm font-semibold transition-colors ${
                    visao === opcao.valor ? 'bg-forest text-white' : 'text-ink-soft hover:bg-forest-mist hover:text-forest-deep'
                  }`}
                >
                  {opcao.rotulo}
                </button>
              ))}
            </div>
          </div>
        </div>

        {visao === 'semana' && (
          <ul className="divide-y divide-ink-soft/10 overflow-hidden rounded-xl border border-ink-soft/10">
            {diasDaSemana.map((dia) => {
              const eventos = eventosDoDia(dia)
              const hojeAqui = ehHoje(dia)
              return (
                <li key={chaveDia(dia)} className={`flex gap-4 p-3 sm:p-4 ${hojeAqui ? 'bg-mint/15' : 'bg-white'}`}>
                  <div className="w-16 shrink-0 text-center">
                    <p className="font-mono text-[11px] font-semibold uppercase text-ink-soft">
                      {DIAS_SEMANA[dia.getDay()]}
                    </p>
                    <p
                      className={`mx-auto mt-1 flex h-9 w-9 items-center justify-center rounded-full font-display text-lg font-semibold ${
                        hojeAqui ? 'bg-mint/60 text-forest-deep' : 'text-forest-deep'
                      }`}
                    >
                      {dia.getDate()}
                    </p>
                  </div>
                  {eventos.length === 0 ? (
                    <p className="self-center font-body text-sm text-ink-soft/70">Sem eventos</p>
                  ) : (
                    <ul className="min-w-0 flex-1 space-y-1.5">
                      {eventos.map((evento, i) => (
                        <LinhaEvento key={i} evento={evento} rotuloPrazo={rotuloPrazo} />
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {visao === 'dia' && (
          <div className="rounded-xl border border-ink-soft/10 p-4 sm:p-5">
            {eventosDoDia(dataRef).length === 0 ? (
              <p className="py-10 text-center font-body text-sm text-ink-soft">Nenhum evento neste dia.</p>
            ) : (
              <ul className="space-y-2">
                {eventosDoDia(dataRef).map((evento, i) => (
                  <LinhaEvento key={i} evento={evento} rotuloPrazo={rotuloPrazo} />
                ))}
              </ul>
            )}
          </div>
        )}

        {visao === 'mes' && (
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-ink-soft/10 bg-ink-soft/10">
            {DIAS_SEMANA.map((dia) => (
              <div
                key={dia}
                className="bg-paper-2 px-1 py-2.5 text-center font-mono text-[10px] font-semibold uppercase tracking-wide text-ink-soft sm:text-xs"
              >
                {dia}
              </div>
            ))}

            {celulas.map((celula, index) => {
              const eventos = celula.foraDoMes ? [] : eventosDoDia(celula.data)
              const hojeAqui = ehHoje(celula.data)
              return (
                <div
                  key={index}
                  className={`min-h-[64px] p-1 sm:min-h-[96px] sm:p-2 xl:min-h-[112px] ${celula.foraDoMes ? 'bg-paper/60' : 'bg-white'}`}
                >
                  <span
                    className={`inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1 font-body text-xs sm:h-7 sm:min-w-[1.75rem] sm:text-sm ${
                      hojeAqui
                        ? 'bg-mint/50 font-semibold text-forest-deep'
                        : celula.foraDoMes
                          ? 'text-ink-soft/40'
                          : 'text-ink-soft'
                    }`}
                  >
                    {celula.data.getDate()}
                  </span>

                  {/* Celular: pontos coloridos */}
                  <div className="mt-1 flex flex-wrap gap-1 sm:hidden">
                    {eventos.slice(0, 4).map((evento, i) => (
                      <span
                        key={i}
                        title={evento.label}
                        className={`h-2 w-2 rounded-full ${URGENCIA_PONTO[evento.urgencia]}`}
                      />
                    ))}
                  </div>

                  {/* Tablet e computador: textos */}
                  <div className="mt-1 hidden flex-col gap-1 sm:flex">
                    {eventos.slice(0, 3).map((evento, i) => (
                      <p
                        key={i}
                        className={`truncate rounded-md px-1.5 py-0.5 font-body text-[11px] font-medium ${URGENCIA_ESTILO[evento.urgencia]}`}
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
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Versão compacta original (Portal do Cliente).
  return (
    <div className="max-w-xl">
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
          <p className="font-display text-base font-semibold text-forest-deep">{nomeMes}</p>
          <button
            type="button"
            onClick={mesProximo}
            aria-label="Próximo mês"
            className="rounded-md border border-ink-soft/20 px-2.5 py-1 font-body text-sm text-ink-soft hover:bg-paper-2"
          >
            ›
          </button>
        </div>

        {mostrarLegenda && legenda}
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-ink-soft/10 bg-ink-soft/10">
        {DIAS_SEMANA.map((dia) => (
          <div
            key={dia}
            className="bg-paper-2 px-1.5 py-1.5 text-center font-mono text-[10px] uppercase tracking-wide text-ink-soft"
          >
            {dia}
          </div>
        ))}

        {celulas.map((celula, index) => {
          const eventos = celula.foraDoMes ? [] : eventosDoDia(celula.data)
          return (
            <div key={index} className="min-h-[56px] bg-white p-1">
              {!celula.foraDoMes && (
                <>
                  <p className="font-body text-[11px] text-ink-soft">{celula.data.getDate()}</p>
                  <div className="mt-0.5 flex flex-col gap-0.5">
                    {eventos.slice(0, 2).map((evento, i) => (
                      <p
                        key={i}
                        className={`truncate rounded px-1 py-px font-body text-[10px] ${URGENCIA_ESTILO[evento.urgencia]}`}
                        title={evento.label}
                      >
                        {evento.tipo === 'prazo' ? '⏱ ' : ''}
                        {evento.label}
                      </p>
                    ))}
                    {eventos.length > 2 && (
                      <p className="font-body text-[10px] text-ink-soft">+{eventos.length - 2} mais</p>
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
