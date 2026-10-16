// src/components/icones.tsx
//
// Conjunto único de ícones do sistema (SVGs desenhados à mão, sem nenhuma
// biblioteca nova): mesmo traço (1.75), mesmo arredondamento e mesma grade
// de 24x24 em todos, para o menu, o cabeçalho, os cartões e as tabelas
// ficarem padronizados (15/10, redesenho do dashboard).
// O tamanho vem do `className` (ex.: "h-5 w-5").

import type { ReactNode } from 'react'

interface IconeProps {
  className?: string
}

function Svg({ className = 'h-5 w-5', children }: IconeProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      {children}
    </svg>
  )
}

export function IconeInicio(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-6h4v6" />
    </Svg>
  )
}

export function IconePessoa(props: IconeProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6" />
    </Svg>
  )
}

export function IconePessoas(props: IconeProps) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M2.5 20c0-3 2.9-5.5 6.5-5.5s6.5 2.5 6.5 5.5" />
      <circle cx="17" cy="8.5" r="2.3" />
      <path d="M15.8 14.8c2.6.5 4.7 2.4 4.7 5.2" />
    </Svg>
  )
}

export function IconeDocumento(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
      <path d="M9 13l2 2 4-4" />
    </Svg>
  )
}

export function IconeMartelo(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M14 4l6 6" />
      <path d="M9.5 8.5l6 6" />
      <path d="M3 21l6-6" />
      <path d="M11.5 6.5l-7 7 2 2 7-7z" />
      <path d="M4 21h6" />
    </Svg>
  )
}

export function IconeGrafico(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M4 20V10" />
      <path d="M11 20V4" />
      <path d="M18 20v-7" />
      <path d="M3 20h18" />
    </Svg>
  )
}

export function IconeTendencia(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </Svg>
  )
}

export function IconeCalendario(props: IconeProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17" />
      <path d="M8 3v4M16 3v4" />
    </Svg>
  )
}

export function IconeCalendarioRelogio(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M20 12V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h6" />
      <path d="M4 10h16" />
      <path d="M8 3v4M16 3v4" />
      <circle cx="17.5" cy="17.5" r="3.5" />
      <path d="M17.5 16v1.8l1.2.7" />
    </Svg>
  )
}

export function IconeEngrenagem(props: IconeProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M4.6 6.6l1.6 1.6M17.8 15.8l1.6 1.6M3 12h2.2M18.8 12H21M4.6 17.4l1.6-1.6M17.8 8.2l1.6-1.6" />
    </Svg>
  )
}

export function IconeBusca(props: IconeProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </Svg>
  )
}

export function IconeSino(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </Svg>
  )
}

export function IconeMenu(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Svg>
  )
}

export function IconeFechar(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  )
}

export function IconeOlho(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  )
}

export function IconeLapis(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z" />
      <path d="M14.5 6.5l3 3" />
    </Svg>
  )
}

export function IconeLixeira(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M10 11v5M14 11v5" />
    </Svg>
  )
}

export function IconeFiltro(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M4 6h16M7 12h10M10 18h4" />
    </Svg>
  )
}

export function IconeSetaDireita(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M9 6l6 6-6 6" />
    </Svg>
  )
}

export function IconeSetaEsquerda(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M15 6l-6 6 6 6" />
    </Svg>
  )
}

export function IconeAlerta(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M12 4l9.5 16.5h-19z" />
      <path d="M12 10.5v4" />
      <path d="M12 17.5h.01" />
    </Svg>
  )
}

export function IconeRelogio(props: IconeProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  )
}

export function IconeMoeda(props: IconeProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M14.6 9.4c-.4-.9-1.4-1.4-2.6-1.4-1.5 0-2.6.8-2.6 2s1 1.7 2.6 2 2.6.8 2.6 2-1.1 2-2.6 2c-1.2 0-2.2-.5-2.6-1.4" />
      <path d="M12 6.5V8M12 16v1.5" />
    </Svg>
  )
}

export function IconeSair(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </Svg>
  )
}
