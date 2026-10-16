// src/components/ClienteNotificacoes.tsx
//
// Sino do Portal do Cliente (16/10, a pedido do Márcio): avisa o cliente das
// licitações que estão AGUARDANDO A DECISÃO DELE e ainda dentro do prazo para
// responder, com a etiqueta "Nova" nas cadastradas nos últimos 3 dias. O número
// no sino é a quantidade dessas licitações. Usa só as licitações do próprio
// cliente que já existem (nada de tabela nova) e as mesmas regras de prazo da
// tela de Licitações dele (prazoPropostaClienteInfo).
//
// A lista é lida ao abrir cada tela do portal; depois que o cliente decide, a
// licitação some do sino na tela seguinte.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { licitacaoService } from '@/services/licitacaoService'
import { Etiqueta } from '@/components/dashboard/Etiqueta'
import { IconeSino } from '@/components/icones'
import type { Licitacao } from '@/types/licitacao'
import type { TomEtiqueta } from '@/utils/eventosPainel'
import { prazoPropostaClienteInfo } from '@/utils/licitacaoCalculos'
import { calcularPrazoInterno } from '@/utils/prazoUtils'

const MAXIMO_NA_LISTA = 5
const DIAS_COMO_NOVA = 3

const TOM_POR_URGENCIA: Record<'vencido' | 'atencao' | 'ok', TomEtiqueta> = {
  vencido: 'danger',
  atencao: 'warning',
  ok: 'success',
}

interface Pendencia {
  licitacao: Licitacao
  prazoTexto: string
  tom: TomEtiqueta
  nova: boolean
  prazoInterno: number
}

export function ClienteNotificacoes() {
  const { user } = useAuth()
  const clienteId = user?.clienteId
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([])
  const [carregando, setCarregando] = useState(Boolean(clienteId))
  const [aberto, setAberto] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!clienteId) return
    let ativo = true
    setCarregando(true)
    licitacaoService
      .listarPorCliente(clienteId)
      .then((itens) => {
        if (ativo) setLicitacoes(itens)
      })
      .catch(() => {
        if (ativo) setLicitacoes([])
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
  }, [clienteId])

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

  // Aguardando decisão, em andamento e com o prazo de resposta ainda aberto,
  // da que vence primeiro para a que vence depois.
  const pendencias = useMemo<Pendencia[]>(() => {
    const agora = Date.now()
    const limiteNova = agora - DIAS_COMO_NOVA * 24 * 60 * 60 * 1000
    return licitacoes
      .filter((l) => l.decisaoCliente === 'pendente' && l.status !== 'ganho' && l.status !== 'perdido')
      .map((licitacao) => {
        const prazo = prazoPropostaClienteInfo(licitacao)
        return {
          licitacao,
          prazoTexto: prazo.texto,
          tom: TOM_POR_URGENCIA[prazo.urgencia],
          nova: new Date(licitacao.criadoEm).getTime() >= limiteNova,
          prazoInterno: calcularPrazoInterno(licitacao.dataEfetivaLicitacao || licitacao.dataLicitacao).getTime(),
          encerrado: prazo.texto === 'Prazo encerrado',
        }
      })
      .filter((p) => !p.encerrado)
      .sort((a, b) => a.prazoInterno - b.prazoInterno)
  }, [licitacoes])

  if (!clienteId) return null

  const total = pendencias.length

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        aria-label={total > 0 ? `Notificações: ${total} aguardando sua decisão` : 'Notificações'}
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
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-ink-soft/10 bg-white shadow-card">
          <div className="border-b border-ink-soft/10 px-4 py-3">
            <p className="font-display text-base font-semibold text-forest-deep">Notificações</p>
          </div>

          {carregando && <p className="px-4 py-5 text-center font-body text-sm text-ink-soft">Carregando...</p>}

          {!carregando && total === 0 && (
            <p className="px-4 py-5 text-center font-body text-sm text-ink-soft">
              Nenhuma licitação aguardando a sua decisão.
            </p>
          )}

          {!carregando && total > 0 && (
            <div>
              <p className="px-4 pb-1 pt-3 font-mono text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                Aguardando sua decisão ({total})
              </p>
              <ul>
                {pendencias.slice(0, MAXIMO_NA_LISTA).map(({ licitacao, prazoTexto, tom, nova }) => (
                  <li key={licitacao.id}>
                    <Link
                      to={`/cliente/licitacoes/${licitacao.id}`}
                      onClick={() => setAberto(false)}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-paper-2/60"
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate font-body text-sm font-semibold text-ink">
                            Nº {licitacao.numeroPregao}
                          </span>
                          {nova && (
                            <span className="shrink-0 rounded-full bg-forest px-1.5 py-0.5 font-body text-[10px] font-bold uppercase leading-none text-white">
                              Nova
                            </span>
                          )}
                        </span>
                        <span className="block truncate font-body text-xs text-ink-soft" title={licitacao.orgao}>
                          {licitacao.orgao}
                        </span>
                      </span>
                      <Etiqueta rotulo={prazoTexto} tom={tom} />
                    </Link>
                  </li>
                ))}
              </ul>
              {total > MAXIMO_NA_LISTA && (
                <p className="px-4 pb-2 font-body text-xs text-ink-soft">
                  e mais {total - MAXIMO_NA_LISTA} {total - MAXIMO_NA_LISTA === 1 ? 'licitação' : 'licitações'}
                </p>
              )}
            </div>
          )}

          <Link
            to="/cliente"
            onClick={() => setAberto(false)}
            className="block border-t border-ink-soft/10 px-4 py-3 text-center font-body text-sm font-semibold text-forest hover:bg-forest-mist/50"
          >
            Ver todas as licitações
          </Link>
        </div>
      )}
    </div>
  )
}
