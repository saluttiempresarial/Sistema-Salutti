// src/components/BotaoSair.tsx
//
// Botão de "Sair" reutilizável — mesma lógica que já existia no Header.tsx
// antigo (logout + redireciona para /login). Usado no cabeçalho de página
// (DashboardShell, via a prop headerActions) nas telas do Portal do
// Cliente que agora usam a ClienteSidebar em vez do Header — a pedido do
// Márcio (01/10), o "Sair" fica no canto direito do título da página
// (ex.: "Bem-vindo, JOANA"), não dentro da sidebar.

import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export function BotaoSair() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-body text-sm font-medium text-ink-soft transition-colors hover:bg-ink-soft/10 hover:text-ink"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 shrink-0"
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="M16 17l5-5-5-5" />
        <path d="M21 12H9" />
      </svg>
      Sair
    </button>
  )
}
