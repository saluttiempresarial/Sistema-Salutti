// src/components/dashboard/ProximosEventos.tsx
//
// Painel lateral "Próximos eventos": prazos internos e sessões públicas das
// licitações ativas, do mais antigo ao mais novo (inclui o que venceu nos
// últimos 7 dias). Tudo derivado das licitações já cadastradas — ver
// utils/eventosPainel.ts. Cada evento leva à proposta da licitação.
//
// Também é usado no Portal do Cliente (16/10): lá os eventos levam ao detalhe
// da licitação, o prazo se chama "Data de retorno" e não há "Ver todos"
// (o calendário já é a própria tela). Os valores padrão são os do Admin.

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { Licitacao } from '@/types/licitacao'
import {
  eventosDasLicitacoes,
  formatarHora,
  proximosEventos,
  rotuloDia,
  type TomEtiqueta,
} from '@/utils/eventosPainel'
import { Etiqueta } from './Etiqueta'
import { IconeAlerta, IconeCalendario, IconeMartelo, IconeRelogio, IconeSetaDireita } from '@/components/icones'

const COR_DATA: Record<TomEtiqueta, string> = {
  danger: 'border-red-400 bg-red-50 text-red-700',
  warning: 'border-brass bg-brass-pale/60 text-brass',
  success: 'border-forest bg-forest-mist text-forest-deep',
  info: 'border-sky-400 bg-sky-50 text-sky-700',
  neutral: 'border-slate-300 bg-slate-50 text-slate-600',
}

const COR_ICONE: Record<TomEtiqueta, string> = {
  danger: 'text-red-600',
  warning: 'text-brass',
  success: 'text-forest',
  info: 'text-sky-600',
  neutral: 'text-slate-500',
}

interface ProximosEventosProps {
  licitacoes: Licitacao[]
  carregando?: boolean
  limite?: number
  /** Endereço aberto ao clicar num evento. Padrão: proposta da licitação (Admin). */
  rotaLicitacao?: (licitacaoId: string) => string
  /** Destino do link "Ver todos"; `null` esconde o link. Padrão: calendário do Admin. */
  linkVerTodos?: string | null
  /** Nome do evento de prazo. Padrão: "Prazo interno". */
  rotuloPrazo?: string
}

export function ProximosEventos({
  licitacoes,
  carregando = false,
  limite = 6,
  rotaLicitacao = (id) => `/admin/licitacoes/${id}/proposta`,
  linkVerTodos = '/admin/calendario',
  rotuloPrazo = 'Prazo interno',
}: ProximosEventosProps) {
  const eventos = useMemo(() => {
    const agora = new Date()
    return proximosEventos(eventosDasLicitacoes(licitacoes, agora), agora, limite)
  }, [licitacoes, limite])

  const agora = new Date()

  return (
    <section className="flex h-full flex-col rounded-2xl border border-ink-soft/10 bg-white p-5 shadow-soft sm:p-6">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <IconeCalendario className="h-6 w-6 text-forest" />
          <h2 className="font-display text-xl font-semibold text-forest-deep">Próximos eventos</h2>
        </div>
        {linkVerTodos && (
          <Link
            to={linkVerTodos}
            className="inline-flex items-center gap-1 font-body text-sm font-semibold text-forest hover:underline"
          >
            Ver todos
            <IconeSetaDireita className="h-4 w-4" />
          </Link>
        )}
      </header>

      <div className="flex-1 space-y-3">
        {carregando && <p className="py-6 text-center font-body text-sm text-ink-soft">Carregando...</p>}

        {!carregando && eventos.length === 0 && (
          <p className="py-6 text-center font-body text-sm text-ink-soft">Nenhum evento próximo.</p>
        )}

        {!carregando &&
          eventos.map((evento) => (
            <Link
              key={evento.id}
              to={rotaLicitacao(evento.licitacaoId)}
              className="flex items-center gap-3 rounded-xl border border-ink-soft/10 p-3 transition-colors hover:bg-paper-2/60"
            >
              <div
                className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border-l-4 ${COR_DATA[evento.tom]}`}
              >
                <span className="font-display text-xl font-semibold leading-none">
                  {String(evento.data.getDate()).padStart(2, '0')}
                </span>
                <span className="mt-0.5 font-mono text-[10px] font-semibold uppercase">
                  {evento.data.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-body text-sm font-semibold text-ink">
                  {evento.tipo === 'prazo' ? (
                    <IconeAlerta className={`h-4 w-4 ${COR_ICONE[evento.tom]}`} />
                  ) : (
                    <IconeMartelo className={`h-4 w-4 ${COR_ICONE[evento.tom]}`} />
                  )}
                  {evento.tipo === 'prazo' ? rotuloPrazo : 'Sessão pública'}
                </p>
                <p className="truncate font-body text-sm text-ink-soft" title={evento.orgao}>
                  Nº {evento.numeroPregao}
                </p>
                <p className="mt-0.5 flex items-center gap-1 font-body text-xs text-ink-soft">
                  <IconeRelogio className="h-3.5 w-3.5" />
                  {rotuloDia(evento.data, agora)} • {formatarHora(evento.data)}
                </p>
              </div>

              <Etiqueta rotulo={evento.etiqueta} tom={evento.tom} />
            </Link>
          ))}
      </div>

      <footer className="mt-4 border-t border-ink-soft/10 pt-4">
        <p className="mb-2 font-display text-base font-semibold text-forest-deep">Legenda</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 font-body text-xs text-ink-soft">
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-forest" /> Sessão
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Prazo vencido
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-brass" /> Prazo próximo
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-forest-mist ring-1 ring-forest/30" /> Prazo ok
          </li>
        </ul>
      </footer>
    </section>
  )
}
