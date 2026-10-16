// src/components/ClienteLayout.tsx
//
// Estrutura de layout do Portal do Cliente: menu lateral (ClienteSidebar) à
// esquerda e, ao lado dele, a barra superior fixa (ClienteTopBar: perfil e
// "Sair") sobre o conteúdo — mesmo padrão do AdminLayout usado por
// Admin/Funcionário. No tablet o menu vira uma gaveta, aberta pelo botão da
// barra superior. Substitui o DashboardShell + Header nas telas internas do
// Cliente (Licitações, Calendário, Indicadores, Relatórios).
//
// "Sair" FIXO (14/10, a pedido do Márcio): a barra superior traz o botão
// "Sair" em todas as telas desta estrutura. Os "Sair" que as páginas colocam
// no título (via DashboardShell/headerActions) ficam ocultos aqui dentro
// (SairFixoContext), para não aparecerem duas vezes — sem precisar mexer em
// cada página.
//
// Redesenho de 16/10 (a pedido do Márcio): mesmo visual do Admin/Funcionário.

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { ClienteSidebar } from './ClienteSidebar'
import { ClienteTopBar } from './ClienteTopBar'
import { SairFixoContext } from './BotaoSair'

interface ClienteLayoutProps {
  children: ReactNode
}

export function ClienteLayout({ children }: ClienteLayoutProps) {
  const [menuAberto, setMenuAberto] = useState(false)
  const { pathname } = useLocation()

  // Fecha a gaveta ao trocar de página.
  useEffect(() => {
    setMenuAberto(false)
  }, [pathname])

  // Esc fecha a gaveta; com ela aberta, a página de trás não rola.
  useEffect(() => {
    if (!menuAberto) return
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') setMenuAberto(false)
    }
    document.addEventListener('keydown', aoTeclar)
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      document.body.style.overflow = overflowAnterior
    }
  }, [menuAberto])

  return (
    <div className="flex min-h-screen bg-paper">
      <ClienteSidebar aberta={menuAberto} onFechar={() => setMenuAberto(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <ClienteTopBar onAbrirMenu={() => setMenuAberto(true)} />
        <SairFixoContext.Provider value={true}>
          <main className="min-w-0 flex-1">{children}</main>
        </SairFixoContext.Provider>
      </div>
    </div>
  )
}
