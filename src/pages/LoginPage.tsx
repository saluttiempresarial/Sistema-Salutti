import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Logo } from '@/components/Logo'
import { TextField } from '@/components/TextField'
import { Button } from '@/components/Button'
import { IconeDocumento, IconeGrafico, IconeMartelo } from '@/components/icones'
import { ROLE_HOME_ROUTE } from '@/types/auth'

const DESTAQUES = [
  { Icone: IconeDocumento, texto: 'Licitações analisadas pela equipe da Salutti' },
  { Icone: IconeMartelo, texto: 'Acompanhamento de propostas, disputas e resultados' },
  { Icone: IconeGrafico, texto: 'Indicadores para decidir com segurança' },
]

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
    <div className="grid min-h-screen lg:grid-cols-[1.15fr_1fr]">
      {/* Painel da marca: só em telas largas. */}
      <aside className="relative hidden overflow-hidden bg-forest-deep text-white lg:flex lg:flex-col lg:justify-between lg:p-14">
        <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full border border-white/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 h-[26rem] w-[26rem] rounded-full border border-white/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-48 -left-32 h-[30rem] w-[30rem] rounded-full border border-white/10" />

        <div className="relative inline-flex w-fit rounded-xl bg-paper px-5 py-3">
          <Logo />
        </div>

        <div className="relative max-w-xl">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-brass-light">
            Consultoria Estratégica para o Mercado Público
          </p>
          <div aria-hidden="true" className="mt-4 h-0.5 w-14 bg-brass" />
          <h1 className="mt-6 font-display text-4xl font-semibold leading-tight xl:text-5xl">
            Inteligência, planejamento e segurança nas contratações públicas.
          </h1>
          <ul className="mt-10 space-y-4">
            {DESTAQUES.map(({ Icone, texto }) => (
              <li key={texto} className="flex items-center gap-3 font-body text-base text-white/85">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-brass-light">
                  <Icone className="h-5 w-5" />
                </span>
                {texto}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative font-body text-xs text-white/60">
          © {new Date().getFullYear()} Salutti · Acesso restrito a usuários autorizados
        </p>
      </aside>

      {/* Painel do acesso. */}
      <main className="flex min-h-screen flex-col bg-paper px-6 py-10 sm:px-12">
        <div className="mb-10 flex justify-center lg:hidden">
          <Logo size="lg" />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
          <h2 className="font-display text-3xl font-semibold text-forest-deep">Entrar no sistema</h2>
          <p className="mb-8 mt-2 font-body text-sm text-ink-soft">
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

            <Button type="submit" isLoading={isSubmitting} className="mt-2 w-full py-3 text-base">
              Entrar
            </Button>
          </form>

          <p className="mt-6 font-body text-sm text-ink-soft">
            Primeiro acesso ou esqueceu a senha? Fale com a Salutti.
          </p>
        </div>
        <p className="mt-8 text-center font-body text-xs text-ink-soft lg:hidden">
          © {new Date().getFullYear()} Salutti · Acesso restrito a usuários autorizados
        </p>
      </main>
    </div>
  )
}
