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

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      logout,
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
