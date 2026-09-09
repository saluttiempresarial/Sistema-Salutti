/**
 * Tipos do módulo de autenticação.
 *
 * Isolados aqui para que, na integração futura com Supabase, baste
 * trocar a implementação de `AuthService` (ver src/services/authService.ts)
 * sem precisar alterar componentes ou o Context — os tipos e o contrato
 * de uso (login/logout/user) permanecem os mesmos.
 */

export type UserRole = 'admin' | 'funcionario' | 'cliente'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  // Vincula um login de perfil "cliente" ao registro de cliente correspondente
  // (mockClientesResumo / clienteService) — necessário para o Portal do
  // Cliente buscar "minhas licitações" via licitacaoService.listarPorCliente().
  // Só existe (e só faz sentido) para role === 'cliente'.
  clienteId?: string
  // Vincula um login de perfil "funcionario" ao registro correspondente em
  // funcionarioService/MOCK_FUNCIONARIOS — necessário para carregar as
  // permissões granulares do funcionário (ver src/hooks/usePermissoes.ts).
  // Só existe (e só faz sentido) para role === 'funcionario'.
  funcionarioId?: string
  // Vincula um login de perfil "cliente" ao registro do usuário (não da
  // empresa) em usuarios_cliente/usuarioClienteService — necessário para
  // ações que precisam saber qual usuário do cliente está logado (distinto
  // de `clienteId`, que identifica a empresa). Só existe para role === 'cliente'.
  usuarioClienteId?: string
  // Indica se o usuário precisa trocar a senha no próximo acesso (definido
  // pelo admin/funcionário ao criar ou resetar o acesso). Só se aplica a
  // role === 'funcionario' hoje — usuários de cliente têm o próprio campo
  // equivalente em usuarioCliente.ts.
  forcarTrocaSenha?: boolean
}

/** Formato mockado hoje; ao integrar com Supabase, o campo `password`
 *  deixa de existir aqui e passa a ser validado no backend/Auth. */
export interface MockCredential extends AuthUser {
  password: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>
  logout: () => void
}

/** Mapa de para onde cada perfil deve ser redirecionado após o login. */
export const ROLE_HOME_ROUTE: Record<UserRole, string> = {
  admin: '/admin',
  funcionario: '/funcionario',
  cliente: '/cliente',
}

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Administrador',
  funcionario: 'Funcionário',
  cliente: 'Cliente',
}
