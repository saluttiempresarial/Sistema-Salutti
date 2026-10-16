// src/components/AdminLayout.tsx
//
// Estrutura compartilhada por todas as telas do Admin/Funcionário: menu
// lateral (AdminSidebar) à esquerda e, ao lado dele, a barra superior fixa
// (AdminTopBar: busca, notificações, perfil e "Sair") sobre o conteúdo da
// página. No celular e no tablet o menu vira uma gaveta, aberta pelo botão
// da barra superior. Aplicado direto nas rotas em App.tsx, para não precisar
// alterar cada página individualmente.
//
// Redesenho de 15/10 (a pedido do Márcio): antes o Header antigo ficava em
// cima de tudo e o menu abaixo dele; agora o menu ocupa a altura toda, como
// no Portal do Cliente (ClienteLayout).

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { AdminSidebar } from '@/components/AdminSidebar'
import { AdminTopBar } from '@/components/AdminTopBar'

export function AdminLayout({ children }: { children: ReactNode }) {
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
      <AdminSidebar aberta={menuAberto} onFechar={() => setMenuAberto(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopBar onAbrirMenu={() => setMenuAberto(true)} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
