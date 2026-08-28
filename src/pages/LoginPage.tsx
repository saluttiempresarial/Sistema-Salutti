import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Logo } from '@/components/Logo'
import { TextField } from '@/components/TextField'
import { Button } from '@/components/Button'
import { ROLE_HOME_ROUTE } from '@/types/auth'

export function LoginPage() {
  const { login, isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Se já está logado, não faz sentido mostrar a tela de login de novo.
  if (isAuthenticated && user) {
    const from = (location.state as { from?: string } | undefined)?.from
    return <Navigate to={from ?? ROLE_HOME_ROUTE[user.role]} replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(undefined)
    setIsSubmitting(true)

    const result = await login({ email, password })

    setIsSubmitting(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    // Depois do login, o Context já tem o usuário atualizado — a rota
    // /redirecionando lê o perfil e manda para o dashboard correto,
    // respeitando também de onde o usuário veio (`from`), se houver.
    const from = (location.state as { from?: string } | undefined)?.from
    navigate(from ?? '/redirecionando', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-forest-deep px-4">
      <div className="w-full max-w-sm rounded-2xl bg-paper p-8 shadow-card">
        <div className="mb-6 flex justify-center">
          <Logo size="lg" />
        </div>
        <h1 className="mb-1 text-center font-display text-xl font-semibold text-forest-deep">
          Entrar no sistema
        </h1>
        <p className="mb-6 text-center font-body text-sm text-ink-soft">
          Acesse com as credenciais do seu perfil.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <TextField
            label="E-mail"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <TextField
            label="Senha"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <Button type="submit" isLoading={isSubmitting} className="mt-2 w-full">
            Entrar
          </Button>
        </form>
      </div>
    </div>
  )
}
