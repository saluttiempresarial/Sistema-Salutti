// src/pages/cliente/CalendarioPage.tsx
//
// Calendário mensal do Portal do Cliente — as mesmas sessões e prazos que
// já aparecem no Dashboard dele, agora em formato de calendário.

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { licitacaoService } from '@/services/licitacaoService'
import { CalendarioLicitacoes } from '@/components/licitacoes/CalendarioLicitacoes'
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
    <div className="min-h-screen bg-paper p-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl text-ink">Calendário</h1>
        <p className="font-body text-sm text-ink-soft">Sessões das suas licitações.</p>
      </header>

      {carregando ? (
        <p className="font-body text-sm text-ink-soft">Carregando...</p>
      ) : (
        <CalendarioLicitacoes licitacoes={licitacoes} />
      )}
    </div>
  )
}
