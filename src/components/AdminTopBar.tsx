// src/components/AdminTopBar.tsx
//
// Barra superior das telas internas (Administrador e Funcionário): botão do
// menu (só no celular e no tablet), busca global, notificações e o perfil de
// quem está logado, com o botão "Sair" sempre visível (FIXO no topo, a pedido
// do Márcio em 14/10 — a barra acompanha a rolagem).
// O antigo Header.tsx continua existindo para as telas que ainda o usam.

import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ROLE_LABEL } from '@/types/auth'
import { BuscaGlobal } from '@/components/BuscaGlobal'
import { Notificacoes } from '@/components/Notificacoes'
import { IconeMenu, IconeSair } from '@/components/icones'
import { limparCacheLicitacoesInternas } from '@/hooks/useLicitacoesInternas'
import { limparCacheAcoesDisputa } from '@/hooks/useAcoesDisputa'
import { usePermissoes } from '@/hooks/usePermissoes'

interface AdminTopBarProps {
  onAbrirMenu: () => void
}

export function AdminTopBar({ onAbrirMenu }: AdminTopBarProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { podeAcessarModulo } = usePermissoes()

  const iniciais = (user?.name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join('')

  function handleLogout() {
    limparCacheLicitacoesInternas()
    limparCacheAcoesDisputa()
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-30 border-b border-ink-soft/10 bg-paper/95 backdrop-blur">
      <div className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onAbrirMenu}
          aria-label="Abrir o menu"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-forest-deep hover:bg-forest-mist lg:hidden"
        >
          <IconeMenu className="h-6 w-6" />
        </button>

        <div className="min-w-0 flex-1">{podeAcessarModulo('licitacoes') && <BuscaGlobal />}</div>

        {podeAcessarModulo('licitacoes') && <Notificacoes />}

        <div className="hidden h-8 w-px bg-ink-soft/15 sm:block" />

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest-deep font-body text-sm font-semibold text-white">
            {iniciais || '—'}
          </div>
          <div className="hidden text-left leading-tight md:block">
            <p className="max-w-[12rem] truncate font-body text-sm font-semibold text-ink">{user?.name ?? '—'}</p>
            <p className="font-mono text-[11px] uppercase tracking-wide text-brass">
              {user ? ROLE_LABEL[user.role] : ''}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          aria-label="Sair"
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-2.5 font-body text-sm font-semibold text-ink-soft transition-colors hover:bg-ink-soft/10 hover:text-ink sm:px-3"
        >
          <IconeSair className="h-[18px] w-[18px]" />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </div>
    </header>
  )
}
