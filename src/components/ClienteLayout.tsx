// src/components/ClienteLayout.tsx
//
// Estrutura de layout do Portal do Cliente: sidebar fixa (ClienteSidebar)
// + área de conteúdo rolável — mesmo padrão do AdminLayout usado por
// Admin/Funcionário. Substitui o DashboardShell + Header nas telas
// internas do Cliente (Licitações, Calendário, Relatórios).

import type { ReactNode } from 'react'
import { ClienteSidebar } from './ClienteSidebar'

interface ClienteLayoutProps {
  children: ReactNode
}

export function ClienteLayout({ children }: ClienteLayoutProps) {
  return (
    <div className="flex min-h-screen bg-paper">
      <ClienteSidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
