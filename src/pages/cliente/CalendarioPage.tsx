// src/pages/cliente/CalendarioPage.tsx
//
// Calendário mensal do Portal do Cliente — as mesmas sessões e prazos que
// já apareciam no Dashboard dele, em tela própria (a pedido do Márcio em 30/09).
//
// Redesenho (16/10, a pedido do Márcio): calendário ampliado, com o painel
// "Próximos eventos" ao lado — mesmo visual do Admin/Funcionário. O painel só
// mostra licitações ainda em andamento (ganho/perdido e as que o cliente
// recusou ficam de fora), e cada evento abre o detalhe da licitação.

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { licitacaoService } from '@/services/licitacaoService'
import { CalendarioLicitacoes } from '@/components/Licitacoes/CalendarioLicitacoes'
import { ProximosEventos } from '@/components/dashboard/ProximosEventos'
import { Licitacao } from '@/types/licitacao'

export function CalendarioPage() {
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

  const emAndamento = useMemo(
    () =>
      licitacoes.filter(
        (l) => l.status !== 'ganho' && l.status !== 'perdido' && l.decisaoCliente !== 'recusar'
      ),
    [licitacoes]
  )

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-forest-deep sm:text-3xl">Calendário</h1>
        <p className="font-body text-sm text-ink-soft">Sessões das suas licitações.</p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="rounded-2xl border border-ink-soft/10 bg-white p-5 shadow-soft sm:p-6">
          {carregando ? (
            <p className="py-10 text-center font-body text-sm text-ink-soft">Carregando...</p>
          ) : (
            <CalendarioLicitacoes
              licitacoes={licitacoes}
              amplo
              mostrarLegenda={false}
              rotuloPrazo="Data de retorno"
            />
          )}
        </section>

        <ProximosEventos
          licitacoes={emAndamento}
          carregando={carregando}
          rotaLicitacao={(id) => `/cliente/licitacoes/${id}`}
          linkVerTodos={null}
          rotuloPrazo="Data de retorno"
        />
      </div>
    </div>
  )
}
