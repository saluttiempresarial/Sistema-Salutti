// src/pages/HomePage.tsx
//
// Página de entrada do sistema (antes do login). Um único botão de acesso, o
// posicionamento da Salutti, três blocos genéricos do que o sistema oferece
// (sem detalhar funcionalidades internas numa página pública) e a orientação
// para quem ainda não tem acesso ou esqueceu a senha.

import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/Button'
import { IconeGrafico, IconeMartelo, IconeSino } from '@/components/icones'
import { ROLE_HOME_ROUTE } from '@/types/auth'

const BENEFICIOS = [
  {
    Icone: IconeSino,
    titulo: 'Oportunidades',
    texto: 'Receba as licitações analisadas pela Salutti e decida se quer participar.',
  },
  {
    Icone: IconeMartelo,
    titulo: 'Disputas',
    texto: 'Acompanhe propostas, lances e resultados de cada sessão.',
  },
  {
    Icone: IconeGrafico,
    titulo: 'Relatórios',
    texto: 'Veja os indicadores de desempenho da sua empresa no Mercado Público.',
  },
]

export function HomePage() {
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()

  if (isAuthenticated && user) {
    return <Navigate to={ROLE_HOME_ROUTE[user.role]} replace />
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="border-b border-ink-soft/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-2.5">
          <Link to="/" aria-label="Página inicial">
            <Logo />
          </Link>
          <p className="font-body text-sm text-ink-soft">Precisa de ajuda? Fale com a Salutti.</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-16 text-center sm:py-24">
        <p className="font-mono text-xs font-medium uppercase tracking-wider text-brass">
          Consultoria Estratégica para o Mercado Público
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold text-forest-deep sm:text-4xl">
          Sistema Salutti Licitações
        </h1>
        <p className="mx-auto mt-4 max-w-xl font-body text-base text-ink-soft">
          Acompanhe oportunidades, decisões e resultados das suas licitações em um só lugar.
        </p>
        <Button className="mt-8 px-8 py-3 text-base" onClick={() => navigate('/login')}>
          Entrar no sistema
        </Button>
        <p className="mt-3 font-body text-sm text-ink-soft">
          Primeiro acesso ou esqueceu a senha? Fale com a Salutti.
        </p>

        <ul className="mt-16 grid gap-4 text-left sm:grid-cols-3">
          {BENEFICIOS.map(({ Icone, titulo, texto }) => (
            <li key={titulo} className="rounded-xl border border-ink-soft/15 bg-white p-5 shadow-soft">
              <Icone className="h-6 w-6 text-forest" aria-hidden="true" />
              <h2 className="mt-3 font-display text-lg text-ink">{titulo}</h2>
              <p className="mt-1 font-body text-sm text-ink-soft">{texto}</p>
            </li>
          ))}
        </ul>
      </main>

      <footer className="border-t border-ink-soft/10 py-4 text-center font-body text-xs text-ink-soft">
        © {new Date().getFullYear()} Salutti · Acesso restrito a usuários autorizados
      </footer>
    </div>
  )
}
