// src/components/dashboard/CartaoResumo.tsx
//
// Cartão de resumo da tela inicial: ícone em destaque, título, número grande
// e uma legenda. Cada cartão tem uma cor própria (verde, dourado ou azul) e,
// quando recebe `to`, vira um atalho para a tela correspondente.
// `compacto` é a versão menor, usada para indicadores secundários.

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { IconeSetaDireita } from '@/components/icones'

export type TomCartao = 'verde' | 'dourado' | 'azul'

const TONS: Record<TomCartao, { icone: string; titulo: string }> = {
  verde: { icone: 'bg-forest-mist text-forest', titulo: 'text-forest' },
  dourado: { icone: 'bg-brass-pale text-brass', titulo: 'text-brass' },
  azul: { icone: 'bg-sky-50 text-sky-600', titulo: 'text-sky-700' },
}

interface CartaoResumoProps {
  titulo: string
  valor: string
  legenda?: string
  icone: ReactNode
  tom: TomCartao
  to?: string
  compacto?: boolean
}

export function CartaoResumo({ titulo, valor, legenda, icone, tom, to, compacto = false }: CartaoResumoProps) {
  const cores = TONS[tom]

  const conteudo = (
    <>
      <div
        className={`flex shrink-0 items-center justify-center rounded-2xl ${cores.icone} ${
          compacto ? 'h-11 w-11' : 'h-14 w-14 sm:h-16 sm:w-16'
        }`}
      >
        {icone}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`font-mono text-[11px] font-semibold uppercase sm:text-xs ${cores.titulo}`}>
          {titulo}
        </p>
        <p
          className={`font-display font-semibold leading-none text-forest-deep ${
            compacto ? 'mt-1.5 text-2xl' : 'mt-2 text-4xl sm:text-5xl'
          }`}
        >
          {valor}
        </p>
        {legenda && <p className="mt-1.5 font-body text-sm text-ink-soft">{legenda}</p>}
      </div>
      {to && <IconeSetaDireita className="h-5 w-5 text-ink-soft/60 transition-transform group-hover:translate-x-0.5" />}
    </>
  )

  const classes = `group flex items-center gap-4 rounded-2xl border border-ink-soft/10 bg-white shadow-soft ${
    compacto ? 'p-4' : 'p-5 sm:p-6'
  }`

  if (to) {
    return (
      <Link to={to} className={`${classes} transition-shadow hover:shadow-card`}>
        {conteudo}
      </Link>
    )
  }
  return <div className={classes}>{conteudo}</div>
}
