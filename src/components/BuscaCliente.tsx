// src/components/BuscaCliente.tsx
//
// Busca do cabeçalho do Portal do Cliente (atalho Ctrl + K, ou ⌘ + K no Mac).
// Procura só entre as licitações do próprio cliente (as que a Salutti já
// liberou para ele), por número, órgão, objeto, município, portal e UASG
// (Unidade Administrativa de Serviços Gerais). Setas navegam, Enter abre,
// Esc fecha. O resultado leva ao detalhe da licitação no portal do cliente.
// Mesmo visual da BuscaGlobal da equipe, mas sem dados internos da Salutti.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { licitacaoService } from '@/services/licitacaoService'
import { DECISAO_CLIENTE_LABEL, type Licitacao } from '@/types/licitacao'
import { IconeBusca } from '@/components/icones'

const MAXIMO_RESULTADOS = 8

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export function BuscaCliente() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const clienteId = user?.clienteId

  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([])
  const [termo, setTermo] = useState('')
  const [aberto, setAberto] = useState(false)
  const [indiceAtivo, setIndiceAtivo] = useState(-1)

  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Carrega as licitações do cliente uma vez (o banco já entrega só as liberadas).
  useEffect(() => {
    if (!clienteId) return
    let ativo = true
    licitacaoService
      .listarPorCliente(clienteId)
      .then((itens) => {
        if (ativo) setLicitacoes(itens)
      })
      .catch(() => {
        if (ativo) setLicitacoes([])
      })
    return () => {
      ativo = false
    }
  }, [clienteId])

  const termoLimpo = termo.trim()

  const resultados = useMemo(() => {
    if (termoLimpo.length < 2) return []
    const alvo = normalizar(termoLimpo)
    return licitacoes
      .filter((licitacao) =>
        normalizar(
          [
            licitacao.numeroPregao,
            licitacao.orgao,
            licitacao.objeto,
            licitacao.municipio,
            licitacao.portal,
            licitacao.orgaoUasg,
          ]
            .filter(Boolean)
            .join(' ')
        ).includes(alvo)
      )
      .slice(0, MAXIMO_RESULTADOS)
  }, [termoLimpo, licitacoes])

  // Atalho Ctrl + K / ⌘ + K.
  useEffect(() => {
    function aoPressionar(evento: globalThis.KeyboardEvent) {
      if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k') {
        evento.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
        setAberto(true)
      }
    }
    window.addEventListener('keydown', aoPressionar)
    return () => window.removeEventListener('keydown', aoPressionar)
  }, [])

  // Fecha ao clicar fora.
  useEffect(() => {
    function aoClicar(evento: MouseEvent) {
      if (!containerRef.current?.contains(evento.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', aoClicar)
    return () => document.removeEventListener('mousedown', aoClicar)
  }, [])

  useEffect(() => {
    setIndiceAtivo(-1)
  }, [termoLimpo])

  function fechar() {
    setAberto(false)
    setIndiceAtivo(-1)
  }

  function abrirLicitacao(licitacao: Licitacao) {
    fechar()
    setTermo('')
    navigate(`/cliente/licitacoes/${licitacao.id}`)
  }

  function aoTeclar(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'Escape') {
      fechar()
      inputRef.current?.blur()
    } else if (evento.key === 'ArrowDown') {
      evento.preventDefault()
      setAberto(true)
      setIndiceAtivo((atual) => Math.min(atual + 1, resultados.length - 1))
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault()
      setIndiceAtivo((atual) => Math.max(atual - 1, -1))
    } else if (evento.key === 'Enter') {
      evento.preventDefault()
      const escolhida = indiceAtivo >= 0 ? resultados[indiceAtivo] : resultados.length === 1 ? resultados[0] : undefined
      if (escolhida) abrirLicitacao(escolhida)
    }
  }

  const mostrarPainel = aberto && termoLimpo.length >= 2

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <IconeBusca className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-soft" />
      <input
        ref={inputRef}
        value={termo}
        onChange={(e) => {
          setTermo(e.target.value)
          setAberto(true)
        }}
        onFocus={() => setAberto(true)}
        onKeyDown={aoTeclar}
        placeholder="Buscar licitações ou palavras-chave..."
        aria-label="Buscar licitações ou palavras-chave"
        role="combobox"
        aria-expanded={mostrarPainel}
        aria-controls="busca-cliente-resultados"
        autoComplete="off"
        className="w-full rounded-xl border border-ink-soft/15 bg-white py-2.5 pl-11 pr-4 font-body text-sm text-ink shadow-soft placeholder:text-ink-soft/70 focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20 sm:pr-24"
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-ink-soft/15 bg-paper px-2 py-0.5 font-mono text-[11px] text-ink-soft sm:block">
        Ctrl + K
      </kbd>

      {mostrarPainel && (
        <div
          id="busca-cliente-resultados"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-ink-soft/10 bg-white shadow-card"
        >
          {resultados.length === 0 ? (
            <p className="px-4 py-5 text-center font-body text-sm text-ink-soft">Nenhuma licitação encontrada.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto py-1">
              {resultados.map((licitacao, indice) => (
                <li key={licitacao.id} role="option" aria-selected={indice === indiceAtivo}>
                  <button
                    type="button"
                    onClick={() => abrirLicitacao(licitacao)}
                    onMouseEnter={() => setIndiceAtivo(indice)}
                    className={`block w-full px-4 py-2.5 text-left font-body ${
                      indice === indiceAtivo ? 'bg-forest-mist/70' : 'hover:bg-paper-2/60'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-semibold text-ink">Nº {licitacao.numeroPregao}</span>
                      <span className="shrink-0 text-xs text-ink-soft">
                        {DECISAO_CLIENTE_LABEL[licitacao.decisaoCliente]}
                      </span>
                    </span>
                    <span className="block truncate text-xs text-ink-soft">{licitacao.orgao}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
