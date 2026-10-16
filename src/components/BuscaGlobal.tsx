// src/components/BuscaGlobal.tsx
//
// Busca do cabeçalho (atalho Ctrl + K, ou ⌘ + K no Mac). Procura licitações
// da carteira de quem está logado por número do pregão, órgão e objeto
// (consulta ao banco, todas as situações) e também pelo nome do cliente e
// pelo município (entre as licitações ativas já carregadas). Setas
// navegam, Enter abre, Esc fecha. Respeita as permissões: funcionário com
// acesso restrito só encontra licitações dos clientes vinculados a ele.
// O resultado leva à proposta da licitação; "Ver todos os resultados" leva à
// tela de Licitações já filtrada.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDebounce } from '@/hooks/useDebounce'
import { usePermissoes } from '@/hooks/usePermissoes'
import { useLicitacoesInternas } from '@/hooks/useLicitacoesInternas'
import { licitacaoService } from '@/services/licitacaoService'
import { STATUS_LICITACAO_LABEL, type Licitacao } from '@/types/licitacao'
import { IconeBusca } from '@/components/icones'

const MAXIMO_RESULTADOS = 8

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export function BuscaGlobal() {
  const navigate = useNavigate()
  const { carregando: carregandoPermissoes, restricaoDados } = usePermissoes()
  const { licitacoes: ativas, nomesClientes } = useLicitacoesInternas()

  const [termo, setTermo] = useState('')
  const [aberto, setAberto] = useState(false)
  const [indiceAtivo, setIndiceAtivo] = useState(-1)
  const [remotos, setRemotos] = useState<Licitacao[]>([])
  const [buscando, setBuscando] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const termoLimpo = termo.trim()
  const termoAdiado = useDebounce(termoLimpo, 300)

  // Consulta ao banco: número do pregão, órgão e objeto (todas as situações).
  useEffect(() => {
    if (carregandoPermissoes || termoAdiado.length < 2) {
      setRemotos([])
      setBuscando(false)
      return
    }
    let ativo = true
    setBuscando(true)
    licitacaoService
      .listar({ busca: termoAdiado, page: 1, pageSize: MAXIMO_RESULTADOS, ...restricaoDados })
      .then((resultado) => {
        if (!ativo) return
        setRemotos(resultado.itens)
        setBuscando(false)
      })
      .catch(() => {
        if (!ativo) return
        setRemotos([])
        setBuscando(false)
      })
    return () => {
      ativo = false
    }
    // restricaoDados é estável (useMemo em usePermissoes).
  }, [termoAdiado, carregandoPermissoes, restricaoDados])

  // Resultados = consulta ao banco + licitações ativas cujo cliente ou
  // município bate com o texto (a consulta ao banco não cobre esses dois).
  const resultados = useMemo(() => {
    if (termoLimpo.length < 2) return []
    const alvo = normalizar(termoLimpo)
    const locais = ativas.filter((licitacao) =>
      normalizar(`${nomesClientes[licitacao.clienteId] ?? ''} ${licitacao.municipio ?? ''}`).includes(alvo)
    )
    const vistos = new Set<string>()
    const juntos: Licitacao[] = []
    ;[...remotos, ...locais].forEach((licitacao) => {
      if (vistos.has(licitacao.id)) return
      vistos.add(licitacao.id)
      juntos.push(licitacao)
    })
    return juntos.slice(0, MAXIMO_RESULTADOS)
  }, [termoLimpo, remotos, ativas, nomesClientes])

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
    navigate(`/admin/licitacoes/${licitacao.id}/proposta`)
  }

  function verTodos() {
    const busca = termoLimpo
    fechar()
    setTermo('')
    navigate(`/admin/licitacoes?busca=${encodeURIComponent(busca)}`)
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
      if (indiceAtivo >= 0 && resultados[indiceAtivo]) abrirLicitacao(resultados[indiceAtivo])
      else if (termoLimpo.length >= 2) verTodos()
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
        placeholder="Buscar licitações, clientes ou palavras-chave..."
        aria-label="Buscar licitações, clientes ou palavras-chave"
        role="combobox"
        aria-expanded={mostrarPainel}
        aria-controls="busca-global-resultados"
        autoComplete="off"
        className="w-full rounded-xl border border-ink-soft/15 bg-white py-2.5 pl-11 pr-4 font-body text-sm text-ink shadow-soft placeholder:text-ink-soft/70 focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20 sm:pr-24"
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-ink-soft/15 bg-paper px-2 py-0.5 font-mono text-[11px] text-ink-soft sm:block">
        Ctrl + K
      </kbd>

      {mostrarPainel && (
        <div
          id="busca-global-resultados"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-ink-soft/10 bg-white shadow-card"
        >
          {resultados.length === 0 ? (
            <p className="px-4 py-5 text-center font-body text-sm text-ink-soft">
              {buscando ? 'Buscando...' : 'Nenhuma licitação encontrada.'}
            </p>
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
                      <span className="shrink-0 text-xs text-ink-soft">{STATUS_LICITACAO_LABEL[licitacao.status]}</span>
                    </span>
                    <span className="block truncate text-xs text-ink-soft">
                      {licitacao.orgao}
                      {nomesClientes[licitacao.clienteId] ? ` · ${nomesClientes[licitacao.clienteId]}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {resultados.length > 0 && (
            <button
              type="button"
              onClick={verTodos}
              className="block w-full border-t border-ink-soft/10 px-4 py-2.5 text-left font-body text-sm font-semibold text-forest hover:bg-forest-mist/50"
            >
              Ver todos os resultados em Licitações
            </button>
          )}
        </div>
      )}
    </div>
  )
}
