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
    <div className="grid min-h-screen font-['Manrope',sans-serif] lg:grid-cols-[1.15fr_1fr]">
      {/* Painel da marca: só em telas largas. */}
      <aside className="relative hidden overflow-hidden bg-forest-deep text-white lg:flex lg:flex-col lg:justify-between lg:p-16">
        {/* Textura geométrica muito sutil: malha fina de linhas, esmaecida nas bordas. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-100 [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_85%)]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />
        <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full border border-white/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 h-[26rem] w-[26rem] rounded-full border border-white/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-48 -left-32 h-[30rem] w-[30rem] rounded-full border border-white/10" />

        <img
          src={`${import.meta.env.BASE_URL}brand/logo-salutti-claro.png`}
          alt="Salutti"
          className="relative h-14 w-auto self-start"
        />

        <div className="relative max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brass-light">
            Consultoria Estratégica para o Mercado Público
          </p>
          <div aria-hidden="true" className="mt-5 h-px w-24 bg-brass-light" />
          <h1 className="mt-8 font-['Lora',serif] text-4xl font-semibold leading-[1.15] tracking-tight xl:text-[3.25rem]">
            Inteligência, planejamento e segurança nas contratações públicas.
          </h1>
          <ul className="mt-12 space-y-6">
            {DESTAQUES.map(({ Icone, texto }) => (
              <li key={texto} className="flex items-center gap-4 text-base text-white/85">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brass-light/50 text-brass-light">
                  <Icone className="h-[18px] w-[18px]" />
                </span>
                {texto}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/50">
          © {new Date().getFullYear()} Salutti · Acesso restrito a usuários autorizados
        </p>
      </aside>

      {/* Painel do acesso. */}
      <main className="flex min-h-screen flex-col bg-paper px-6 py-10 sm:px-12">
        <div className="mb-10 flex justify-center lg:hidden">
          <Logo size="lg" />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
          <h2 className="font-['Lora',serif] text-4xl font-semibold tracking-tight text-forest-deep">Entrar no sistema</h2>
          <p className="mb-9 mt-3 text-base text-ink-soft">
            Acesse com as credenciais do seu perfil.
          </p>

          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 [&_button]:font-['Manrope',sans-serif] [&_button]:font-bold [&_input]:font-['Manrope',sans-serif] [&_label]:font-['Manrope',sans-serif] [&_p]:font-['Manrope',sans-serif]"
            noValidate
          >
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

          <p className="mt-6 text-sm text-ink-soft">
            Primeiro acesso ou esqueceu a senha? Fale com a Salutti.
          </p>
        </div>
        <p className="mt-8 text-center text-xs text-ink-soft lg:hidden">
          © {new Date().getFullYear()} Salutti · Acesso restrito a usuários autorizados
        </p>
      </main>
    </div>
  )
}
