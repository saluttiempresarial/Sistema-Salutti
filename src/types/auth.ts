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
  // Vincula um login de perfil "cliente" ao registro da linha em
  // usuarios_cliente (diferente de clienteId, que é a empresa) — usado
  // para identificar qual usuário específico da empresa está logado.
  // Só existe (e só faz sentido) para role === 'cliente'.
  usuarioClienteId?: string
  // true quando a pessoa precisa trocar a senha no próximo login (ex.:
  // senha temporária definida pelo Admin no cadastro). Hoje só vem
  // preenchido para funcionário — ver authService.ts.
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
  /** Reconsulta a sessão atual (authService.getSession) e atualiza o `user`
   *  em memória — necessário depois de qualquer ação que mude um dado já
   *  carregado no AuthUser sem passar por um novo login, como a troca de
   *  senha obrigatória zerando `forcarTrocaSenha`. */
  refreshUser: () => Promise<void>
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
