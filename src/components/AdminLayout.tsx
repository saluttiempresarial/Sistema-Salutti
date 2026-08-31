// src/components/AdminLayout.tsx
//
// Estrutura compartilhada por todas as telas do Admin/Funcionário: o
// Header de sempre no topo, e o novo menu lateral fixo (AdminSidebar) à
// esquerda do conteúdo da página. Aplicado direto nas rotas em App.tsx,
// para não precisar alterar cada página individualmente.

import type { ReactNode } from 'react'
import { Header } from '@/components/Header'
import { AdminSidebar } from '@/components/AdminSidebar'

export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <Header />
      <div className="flex">
        <AdminSidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
