import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { usePermissoes } from '@/hooks/usePermissoes'
import type { UserRole } from '@/types/auth'
import type { ModuloPermissao } from '@/types/funcionario'
import { ROLE_HOME_ROUTE } from '@/types/auth'

interface ProtectedRouteProps {
  children: ReactNode
  /** Se informado, além de logado o usuário precisa ter um destes perfis. */
  allowedRoles?: UserRole[]
  /** Se informado, além do perfil (role), o usuário precisa ter permissão
   *  de visualização neste módulo — checado via usePermissoes(). Admins
   *  sempre passam; a checagem só tem efeito prático para role 'funcionario'
   *  (Clientes/Funcionários/Configurações já ficam de fora do funcionário
   *  só por `allowedRoles`, sem precisar disto). */
  requiredModule?: ModuloPermissao
}

/** Rota da tela obrigatória de troca de senha — mantida aqui, e não só no
 *  Login, porque é o ProtectedRoute quem precisa reconhecê-la para não
 *  criar um loop de redirecionamento nela mesma (ver checagem abaixo). */
const ROTA_TROCAR_SENHA = '/trocar-senha'

/**
 * Protege uma rota simulando o comportamento que um backend real teria:
 * - Sem sessão -> redireciona para /login, guardando de onde veio.
 * - Logado mas com `forcarTrocaSenha` pendente -> redireciona para
 *   /trocar-senha, qualquer que seja a rota (exceto ela mesma). Antes,
 *   essa obrigatoriedade só era aplicada no momento do login — quem
 *   recarregava a página (F5) ou acessava outra URL direto driblava a
 *   troca obrigatória, porque nada aqui revalidava a flag depois.
 * - Logado mas com perfil não autorizado -> redireciona para o dashboard
 *   correto do próprio perfil (evita que um cliente acesse /admin, etc.).
 * - Funcionário sem permissão de visualização no módulo (`requiredModule`)
 *   -> redireciona para o próprio painel, com um aviso.
 */
export function ProtectedRoute({ children, allowedRoles, requiredModule }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth()
  const { carregando: carregandoPermissoes, podeAcessarModulo } = usePermissoes()
  const location = useLocation()

  if (isLoading || (requiredModule && carregandoPermissoes)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <p className="font-mono text-sm uppercase tracking-widest text-ink-soft">
          Carregando…
        </p>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (user.forcarTrocaSenha && location.pathname !== ROTA_TROCAR_SENHA) {
    return <Navigate to={ROTA_TROCAR_SENHA} replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={`/${user.role}`} replace />
  }

  if (requiredModule && !podeAcessarModulo(requiredModule)) {
    return <Navigate to={ROLE_HOME_ROUTE[user.role]} replace state={{ semPermissao: requiredModule }} />
  }

  return <>{children}</>
}
