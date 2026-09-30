// src/pages/cliente/RelatoriosPage.tsx
//
// Tela de Relatórios do Portal do Cliente — placeholder por enquanto,
// como o Márcio mesmo previu ("relatórios que ainda vamos criar").
// Só ocupa o espaço de navegação já com o visual final, pra não ficar um
// link morto no menu enquanto os relatórios de verdade não são definidos.

import { DashboardShell } from '@/components/DashboardShell'

export function RelatoriosPage() {
  return (
    <DashboardShell showHeader={false} title="Relatórios">
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-ink-soft/10 bg-white p-10 text-center shadow-soft">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-10 w-10 text-brass"
        >
          <path d="M4 20V10" />
          <path d="M11 20V4" />
          <path d="M18 20v-7" />
          <path d="M3 20h18" />
        </svg>
        <h2 className="font-display text-lg font-semibold text-forest-deep">Em construção</h2>
        <p className="font-body text-sm text-ink-soft">
          Em breve você vai acompanhar aqui indicadores da sua participação em licitações.
        </p>
      </div>
    </DashboardShell>
  )
}
