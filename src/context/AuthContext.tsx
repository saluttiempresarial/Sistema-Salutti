import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { authService } from '@/services/authService'
import type { AuthContextValue, AuthUser, LoginCredentials } from '@/types/auth'

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Restaura a sessão salva no Supabase Auth ao recarregar a página.
  useEffect(() => {
    authService.getSession().then((session) => {
      setUser(session)
      setIsLoading(false)
    })
  }, [])

  async function login(credentials: LoginCredentials) {
    const { user: found, error } = await authService.signIn(credentials)
    if (found) {
      setUser(found)
      return { success: true }
    }
    return { success: false, error: error ?? 'Não foi possível entrar.' }
  }

  function logout() {
    authService.signOut()
    setUser(null)
  }

  // Reconsulta a sessão e atualiza o `user` em memória, sem exigir um novo
  // login. Usado pela tela de troca de senha obrigatória: depois de trocar
  // a senha e zerar `forcar_troca_senha` no banco (authService.limparForcarTrocaSenha),
  // o `user` guardado aqui ainda estaria com `forcarTrocaSenha: true` até a
  // próxima vez que a sessão fosse recarregada (ex.: um F5) — o que criava
  // a sensação de loop na tela de troca de senha. Chamando refreshUser()
  // logo em seguida, o ProtectedRoute já libera a navegação na mesma hora.
  async function refreshUser() {
    const atualizado = await authService.getSession()
    setUser(atualizado)
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      logout,
      refreshUser,
    }),
    [user, isLoading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de um <AuthProvider>')
  }
  return ctx
}
