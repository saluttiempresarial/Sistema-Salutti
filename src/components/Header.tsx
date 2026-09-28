import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/Button'
import { ROLE_LABEL } from '@/types/auth'

/**
 * Cabeçalho do sistema (app React separado do site institucional estático).
 * O botão "Entrar" leva para a tela de login; quando há sessão ativa,
 * mostra o nome/perfil do usuário e um botão de sair.
 *
 * Espaçamento vertical reduzido (py-4 → py-2.5) em 28/09, a pedido do
 * Márcio: o cabeçalho estava ocupando espaço demais no topo das telas.
 */
export function Header() {
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="border-b border-ink-soft/10 bg-paper">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-2.5">
        <Link to={isAuthenticated && user ? `/${user.role}` : '/'}>
          <Logo />
        </Link>

        {isAuthenticated && user ? (
          <div className="flex items-center gap-4">
            <div className="text-right leading-tight">
              <p className="font-body text-sm font-semibold text-ink">{user.name}</p>
              <p className="font-mono text-[11px] uppercase tracking-wide text-brass">
                {ROLE_LABEL[user.role]}
              </p>
            </div>
            <Button variant="ghost" onClick={handleLogout}>
              Sair
            </Button>
          </div>
        ) : (
          <Button variant="primary" onClick={() => navigate('/login')}>
            Entrar
          </Button>
        )}
      </div>
    </header>
  )
}
