// src/components/ClienteTopBar.tsx
//
// Barra superior do Portal do Cliente: botão do menu (só no tablet), o sino de
// notificações (licitações aguardando a decisão do cliente), o perfil
// de quem está logado e o botão "Sair" sempre visível (FIXO no topo, a pedido
// do Márcio em 14/10 — a barra acompanha a rolagem). Mesmo visual da
// AdminTopBar, sem a busca global (que usa dados internos da Salutti).

import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ROLE_LABEL } from '@/types/auth'
import { ClienteNotificacoes } from '@/components/ClienteNotificacoes'
import { IconeMenu, IconeSair } from '@/components/icones'

interface ClienteTopBarProps {
  onAbrirMenu: () => void
}

export function ClienteTopBar({ onAbrirMenu }: ClienteTopBarProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const iniciais = (user?.name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join('')

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-30 border-b border-ink-soft/10 bg-paper/95 backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onAbrirMenu}
          aria-label="Abrir o menu"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-forest-deep hover:bg-forest-mist lg:hidden"
        >
          <IconeMenu className="h-6 w-6" />
        </button>

        <div className="flex-1" />

        <ClienteNotificacoes />

        <div className="hidden h-8 w-px bg-ink-soft/15 sm:block" />

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest-deep font-body text-sm font-semibold text-white">
            {iniciais || '—'}
          </div>
          <div className="hidden text-left leading-tight sm:block">
            <p className="max-w-[14rem] truncate font-body text-sm font-semibold text-ink">{user?.name ?? '—'}</p>
            <p className="font-mono text-[11px] uppercase tracking-wide text-brass">
              {user ? ROLE_LABEL[user.role] : ''}
            </p>
          </div>
        </div>

        <div className="hidden h-8 w-px bg-ink-soft/15 sm:block" />

        <button
          type="button"
          onClick={handleLogout}
          aria-label="Sair"
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 font-body text-sm font-semibold text-ink-soft transition-colors hover:bg-ink-soft/10 hover:text-ink"
        >
          <IconeSair className="h-[18px] w-[18px]" />
          Sair
        </button>
      </div>
    </header>
  )
}
