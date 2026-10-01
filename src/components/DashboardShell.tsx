import type { ReactNode } from 'react'
import { Header } from '@/components/Header'

interface DashboardShellProps {
  title: string
  subtitle?: string
  children: ReactNode
  /** false quando a página já está dentro do AdminLayout/ClienteLayout
   *  (que já têm sua própria sidebar) — evita mostrar o cabeçalho antigo
   *  duas vezes. Padrão: true, para não quebrar telas que ainda usam
   *  DashboardShell sozinho. */
  showHeader?: boolean
  /** Conteúdo exibido no canto direito do título da página (ex.: o botão
   *  "Sair", nas telas do Cliente que usam ClienteLayout em vez do Header
   *  — ver BotaoSair.tsx, 01/10). Opcional; quando omitido, o título ocupa
   *  a linha inteira como antes. */
  headerActions?: ReactNode
}

/** Estrutura compartilhada pelos três dashboards (admin, funcionário, cliente),
 *  para manter consistência visual e evitar repetição de markup. */
export function DashboardShell({
  title,
  subtitle,
  children,
  showHeader = true,
  headerActions,
}: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-paper">
      {showHeader && <Header />}
      <main className="mx-auto max-w-6xl px-6 py-4">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-forest-deep">{title}</h1>
            {subtitle && <p className="mt-1 font-body text-sm text-ink-soft">{subtitle}</p>}
          </div>
          {headerActions && <div className="shrink-0 pt-1">{headerActions}</div>}
        </div>
        {children}
      </main>
    </div>
  )
}

interface StatCardProps {
  label: string
  value: string
  hint?: string
}

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="rounded-xl border border-ink-soft/10 bg-white p-5 shadow-soft">
      <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold text-forest-deep">{value}</p>
      {hint && <p className="mt-1 font-body text-xs text-ink-soft">{hint}</p>}
    </div>
  )
}
