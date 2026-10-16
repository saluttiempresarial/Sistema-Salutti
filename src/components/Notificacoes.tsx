// src/components/Notificacoes.tsx
//
// Sino do cabeçalho: avisa sobre prazos internos vencidos ou próximos (menos
// de 24 h) e sobre licitações aguardando decisão do cliente. Usa apenas as
// licitações ativas já carregadas para a carteira de quem está logado (nada
// de tabela nova): a contagem do sino é a de prazos vencidos ou próximos.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLicitacoesInternas } from '@/hooks/useLicitacoesInternas'
import { alertasDePrazo, eventosDasLicitacoes, formatarHora, rotuloDia } from '@/utils/eventosPainel'
import { Etiqueta } from '@/components/dashboard/Etiqueta'
import { IconeSino } from '@/components/icones'

const MAXIMO_NA_LISTA = 5

export function Notificacoes() {
  const { licitacoes, carregando } = useLicitacoesInternas()
  const [aberto, setAberto] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const alertas = useMemo(() => alertasDePrazo(eventosDasLicitacoes(licitacoes)), [licitacoes])
  const aguardandoDecisao = useMemo(
    () => licitacoes.filter((l) => l.decisaoCliente === 'pendente').length,
    [licitacoes]
  )

  useEffect(() => {
    function aoClicar(evento: MouseEvent) {
      if (!containerRef.current?.contains(evento.target as Node)) setAberto(false)
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') setAberto(false)
    }
    document.addEventListener('mousedown', aoClicar)
    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.removeEventListener('mousedown', aoClicar)
      document.removeEventListener('keydown', aoTeclar)
    }
  }, [])

  const total = alertas.length
  const agora = new Date()

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        aria-label={total > 0 ? `Notificações: ${total} prazos vencidos ou próximos` : 'Notificações'}
        aria-expanded={aberto}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl text-forest-deep transition-colors hover:bg-forest-mist"
      >
        <IconeSino className="h-6 w-6" />
        {total > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 font-body text-[10px] font-bold leading-none text-white ring-2 ring-paper">
            {total > 9 ? '9+' : total}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-ink-soft/10 bg-white shadow-card">
          <div className="border-b border-ink-soft/10 px-4 py-3">
            <p className="font-display text-base font-semibold text-forest-deep">Notificações</p>
          </div>

          {carregando && <p className="px-4 py-5 text-center font-body text-sm text-ink-soft">Carregando...</p>}

          {!carregando && total === 0 && aguardandoDecisao === 0 && (
            <p className="px-4 py-5 text-center font-body text-sm text-ink-soft">Nenhuma notificação por enquanto.</p>
          )}

          {!carregando && total > 0 && (
            <div>
              <p className="px-4 pb-1 pt-3 font-mono text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                Prazos vencidos ou próximos ({total})
              </p>
              <ul>
                {alertas.slice(0, MAXIMO_NA_LISTA).map((alerta) => (
                  <li key={alerta.id}>
                    <Link
                      to={`/admin/licitacoes/${alerta.licitacaoId}/proposta`}
                      onClick={() => setAberto(false)}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-paper-2/60"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-body text-sm font-semibold text-ink">
                          Nº {alerta.numeroPregao}
                        </span>
                        <span className="block truncate font-body text-xs text-ink-soft">
                          {rotuloDia(alerta.data, agora)} • {formatarHora(alerta.data)}
                        </span>
                      </span>
                      <Etiqueta rotulo={alerta.etiqueta} tom={alerta.tom} />
                    </Link>
                  </li>
                ))}
              </ul>
              {total > MAXIMO_NA_LISTA && (
                <p className="px-4 pb-2 font-body text-xs text-ink-soft">
                  e mais {total - MAXIMO_NA_LISTA} {total - MAXIMO_NA_LISTA === 1 ? 'prazo' : 'prazos'}
                </p>
              )}
            </div>
          )}

          {!carregando && aguardandoDecisao > 0 && (
            <Link
              to="/admin/licitacoes"
              onClick={() => setAberto(false)}
              className="block border-t border-ink-soft/10 px-4 py-3 font-body text-sm text-ink hover:bg-paper-2/60"
            >
              <span className="font-semibold">{aguardandoDecisao}</span>{' '}
              {aguardandoDecisao === 1 ? 'licitação aguarda' : 'licitações aguardam'} a decisão do cliente
            </Link>
          )}

          <Link
            to="/admin/calendario"
            onClick={() => setAberto(false)}
            className="block border-t border-ink-soft/10 px-4 py-3 text-center font-body text-sm font-semibold text-forest hover:bg-forest-mist/50"
          >
            Abrir o calendário
          </Link>
        </div>
      )}
    </div>
  )
}
