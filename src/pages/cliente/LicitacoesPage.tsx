// src/pages/cliente/LicitacoesPage.tsx
//
// Tela Licitações do Portal do Cliente (rota /cliente/licitacoes) — a tabela
// completa "Minhas licitações". Clicar numa licitação abre a tela de detalhes
// (/cliente/licitacoes/:id), onde ficam os botões de decisão.
//
// 19/10: os cartões, o calendário e "Próximos eventos" passaram para a página
// inicial (InicioPage.tsx, rota /cliente). Aqui ficam só a tabela (computador
// largo) ou a lista de cartões (tablet), ordenadas pelo prazo mais próximo.

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { licitacaoService } from '@/services/licitacaoService'
import { TabelaMinhasLicitacoes } from '@/components/dashboard/TabelaMinhasLicitacoes'
import type { Licitacao } from '@/types/licitacao'

export function LicitacoesPage() {
  const { user } = useAuth()
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!user?.clienteId) {
      setCarregando(false)
      return
    }
    let ativo = true
    licitacaoService.listarPorCliente(user.clienteId).then((itens) => {
      if (!ativo) return
      setLicitacoes(itens)
      setCarregando(false)
    })
    return () => {
      ativo = false
    }
  }, [user?.clienteId])

  const container = 'mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8'

  if (!user?.clienteId) {
    return (
      <div className={container}>
        <h1 className="mb-4 font-display text-2xl font-semibold text-forest-deep sm:text-3xl">
          Bem-vindo, {user?.name ?? 'Cliente'}
        </h1>
        <div className="rounded-2xl border border-ink-soft/10 bg-white p-6 shadow-soft">
          <p className="font-body text-sm text-ink-soft">
            Este login não está vinculado a um registro de cliente ainda. Peça para a equipe Salutti
            associar seu usuário a um cliente cadastrado.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={container}>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-forest-deep sm:text-3xl">Licitações</h1>
        <p className="font-body text-sm text-ink-soft">Todas as licitações atribuídas a você.</p>
      </header>

      <TabelaMinhasLicitacoes licitacoes={licitacoes} carregando={carregando} />
    </div>
  )
}
