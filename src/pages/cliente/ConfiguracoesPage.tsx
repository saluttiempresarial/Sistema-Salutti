// src/pages/cliente/ConfiguracoesPage.tsx
//
// Configurações do Portal do Cliente (11/11, a pedido da Melissa/Márcio): a
// liberação de indicadores por Operador saiu de Relatórios, porque é uma
// configuração de acesso, não um relatório. Só o Responsável (gestor) da
// empresa vê esta página; para os demais a seção não é exibida.

import { LiberacaoOperadoresSecao } from '@/components/indicadores/LiberacaoOperadoresSecao'

export function ConfiguracoesPage() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-forest-deep sm:text-3xl">Configurações</h1>
        <p className="font-body text-sm text-ink-soft">Defina o que cada Operador da sua empresa pode ver.</p>
      </header>
      <LiberacaoOperadoresSecao />
    </div>
  )
}
