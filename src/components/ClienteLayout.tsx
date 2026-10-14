// src/components/ClienteLayout.tsx
//
// Estrutura de layout do Portal do Cliente: sidebar fixa (ClienteSidebar)
// + área de conteúdo rolável — mesmo padrão do AdminLayout usado por
// Admin/Funcionário. Substitui o DashboardShell + Header nas telas
// internas do Cliente (Licitações, Calendário, Indicadores, Relatórios).
//
// "Sair" FIXO (14/10, a pedido do Márcio): uma faixa no topo da área de
// conteúdo, que acompanha a rolagem, traz o botão "Sair" em todas as telas
// desta estrutura. Os "Sair" que as páginas colocavam no título (via
// DashboardShell/headerActions) ficam ocultos aqui dentro (SairFixoContext),
// para não aparecerem duas vezes — sem precisar mexer em cada página.

import type { ReactNode } from 'react'
import { ClienteSidebar } from './ClienteSidebar'
import { BotaoSair, SairFixoContext } from './BotaoSair'

interface ClienteLayoutProps {
  children: ReactNode
}

export function ClienteLayout({ children }: ClienteLayoutProps) {
  return (
    <div className="flex min-h-screen bg-paper">
      <ClienteSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-40 flex justify-end border-b border-ink-soft/10 bg-paper px-6 py-1.5">
          <BotaoSair />
        </div>
        <SairFixoContext.Provider value={true}>
          <main className="flex-1 overflow-y-auto">{children}</main>
        </SairFixoContext.Provider>
      </div>
    </div>
  )
}
