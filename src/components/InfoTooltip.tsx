// src/components/InfoTooltip.tsx
//
// Ícone "ⓘ" com balão de explicação, usado ao lado do nome de cada exigência
// dos checklists (Habilitação, Declarações, Outras Exigências).
//
// Comportamento (pedido do Márcio, 07/10):
//   - Computador: passar o mouse sobre o ícone abre o balão; tirar o mouse
//     fecha. Clicar FIXA o balão aberto (bom para ler textos longos); novo
//     clique, tecla Esc ou clique fora fecha.
//   - Celular/tablet (toque): tocar abre; tocar de novo, ou tocar fora, fecha.
//   - Teclado: o ícone é um botão — Tab foca (abre o balão) e Enter/Espaço fixa.
//
// O balão é desenhado num "portal" (direto no <body>, com posição fixa), para
// não ser cortado pela rolagem de um modal ou de uma tabela. Ele se ajusta à
// largura da tela e vira para cima se faltar espaço embaixo. Rolar a tela ou
// redimensionar a janela fecha o balão (evita ele ficar solto longe do ícone).
//
// As quebras de linha do texto (\n) são respeitadas — algumas explicações
// têm listas.

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface InfoTooltipProps {
  /** Nome da exigência — aparece em destaque no topo do balão. */
  titulo?: string
  /** Texto da explicação. */
  texto: string
  className?: string
}

const LARGURA_BALAO = 320
const MARGEM_TELA = 8
const DISTANCIA_ICONE = 6

export function InfoTooltip({ titulo, texto, className = '' }: InfoTooltipProps) {
  const idBalao = useId()
  const botaoRef = useRef<HTMLButtonElement>(null)
  const balaoRef = useRef<HTMLDivElement>(null)
  const [passandoMouse, setPassandoMouse] = useState(false)
  const [fixado, setFixado] = useState(false)
  const [posicao, setPosicao] = useState<{ left: number; top: number; largura: number } | null>(null)

  const visivel = passandoMouse || fixado

  function fechar() {
    setPassandoMouse(false)
    setFixado(false)
  }

  // Calcula a posição do balão sempre que ele abre: centralizado no ícone,
  // abaixo dele, sem sair da tela.
  useLayoutEffect(() => {
    if (!visivel || !botaoRef.current) {
      setPosicao(null)
      return
    }
    const icone = botaoRef.current.getBoundingClientRect()
    const largura = Math.min(LARGURA_BALAO, window.innerWidth - 2 * MARGEM_TELA)
    const centro = icone.left + icone.width / 2 - largura / 2
    const left = Math.max(MARGEM_TELA, Math.min(centro, window.innerWidth - largura - MARGEM_TELA))
    setPosicao({ left, top: icone.bottom + DISTANCIA_ICONE, largura })
  }, [visivel])

  // Depois de desenhado, mede a altura real: se não couber embaixo e couber
  // em cima, vira para cima.
  useLayoutEffect(() => {
    if (!visivel || !posicao || !balaoRef.current || !botaoRef.current) return
    const altura = balaoRef.current.getBoundingClientRect().height
    const icone = botaoRef.current.getBoundingClientRect()
    const cabeEmbaixo = icone.bottom + DISTANCIA_ICONE + altura <= window.innerHeight - MARGEM_TELA
    const cabeEmCima = icone.top - DISTANCIA_ICONE - altura >= MARGEM_TELA
    if (!cabeEmbaixo && cabeEmCima) {
      const novoTop = icone.top - DISTANCIA_ICONE - altura
      if (Math.abs(novoTop - posicao.top) > 1) setPosicao({ ...posicao, top: novoTop })
    }
  }, [visivel, posicao])

  // Fecha com Esc, com clique fora (quando fixado) e ao rolar/redimensionar.
  useEffect(() => {
    if (!visivel) return

    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') fechar()
    }
    function aoClicarFora(e: PointerEvent) {
      const alvo = e.target as Node
      if (botaoRef.current?.contains(alvo) || balaoRef.current?.contains(alvo)) return
      fechar()
    }

    document.addEventListener('keydown', aoTeclar)
    document.addEventListener('pointerdown', aoClicarFora)
    window.addEventListener('scroll', fechar, true)
    window.addEventListener('resize', fechar)
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      document.removeEventListener('pointerdown', aoClicarFora)
      window.removeEventListener('scroll', fechar, true)
      window.removeEventListener('resize', fechar)
    }
  }, [visivel])

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        aria-label={titulo ? `Explicação: ${titulo}` : 'Explicação'}
        aria-expanded={visivel}
        aria-describedby={visivel ? idBalao : undefined}
        // Só o mouse abre por "hover" — no toque, o pointerenter simulado
        // abriria e o clique fecharia logo em seguida.
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') setPassandoMouse(true)
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') setPassandoMouse(false)
        }}
        onFocus={() => setPassandoMouse(true)}
        onBlur={() => setPassandoMouse(false)}
        onClick={(e) => {
          // Dentro de um <label>/linha clicável, o clique no ícone não pode
          // marcar a opção nem fechar/abrir nada ao redor.
          e.preventDefault()
          e.stopPropagation()
          if (fixado) fechar()
          else setFixado(true)
        }}
        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-forest transition-colors hover:bg-forest-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 ${
          fixado ? 'bg-forest-mist' : ''
        } ${className}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5" />
          <circle cx="12" cy="7.8" r="0.6" fill="currentColor" />
        </svg>
      </button>

      {visivel &&
        posicao &&
        createPortal(
          <div
            ref={balaoRef}
            id={idBalao}
            role="tooltip"
            style={{ position: 'fixed', left: posicao.left, top: posicao.top, width: posicao.largura }}
            className="z-[1000] rounded-xl border border-ink-soft/15 bg-white p-3 font-body shadow-lg"
          >
            {titulo && <p className="mb-1 text-xs font-bold text-forest-deep">{titulo}</p>}
            <p className="whitespace-pre-line text-xs leading-relaxed text-ink">{texto}</p>
          </div>,
          document.body,
        )}
    </>
  )
}
