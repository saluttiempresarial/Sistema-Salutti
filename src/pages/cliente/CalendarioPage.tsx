// src/pages/cliente/CalendarioPage.tsx
//
// Calendário mensal do Portal do Cliente — as mesmas sessões e prazos que
// já apareciam no Dashboard dele, agora em tela própria (deixou de ficar
// "solto" no fim da página de Licitações, a pedido do Márcio em 30/09).
//
// Ajustado para usar DashboardShell com showHeader={false}, o mesmo
// padrão já usado em AdminDashboard.tsx — dá o título/subtítulo e o
// padding de página de forma consistente com o resto do sistema, dentro
// do ClienteLayout (que já tem a sidebar, sem o Header antigo).

import { useEffect, useState } from 'react'
import { DashboardShell } from '@/components/DashboardShell'
import { BotaoSair } from '@/components/BotaoSair'
import { useAuth } from '@/context/AuthContext'
import { licitacaoService } from '@/services/licitacaoService'
import { CalendarioLicitacoes } from '@/components/Licitacoes/CalendarioLicitacoes'
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

  return (
    <DashboardShell
      showHeader={false}
      title="Calendário"
      subtitle="Sessões das suas licitações."
      headerActions={<BotaoSair />}
    >
      {carregando ? (
        <p className="font-body text-sm text-ink-soft">Carregando...</p>
      ) : (
        <div className="w-fit rounded-xl border-2 border-forest bg-white p-5 shadow-soft">
          <CalendarioLicitacoes licitacoes={licitacoes} />
        </div>
      )}
    </DashboardShell>
  )
}
