// src/pages/admin/CalendarioPage.tsx
//
// Calendário mensal com as sessões de licitação e os prazos internos —
// usa a mesma carteira (completa ou restrita) que a tela de Licitações,
// via usePermissoes(). Rota compartilhada entre Admin e Funcionário
// (/admin/calendario), no mesmo padrão já usado em Licitações/Disputas.
// Só mostra licitações ativas (exclui ganho/perdido), como o Dashboard.

import { useEffect, useState } from 'react'
import { usePermissoes } from '@/hooks/usePermissoes'
import { licitacaoService } from '@/services/licitacaoService'
import { CalendarioLicitacoes } from '@/components/licitacoes/CalendarioLicitacoes'
import { Licitacao } from '@/types/licitacao'

export function CalendarioPage() {
  const { carregando: carregandoPermissoes, restricaoDados } = usePermissoes()
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (carregandoPermissoes) return
    let ativo = true
    setCarregando(true)
    licitacaoService.listarAtivas(restricaoDados ?? {}).then((itens) => {
      if (!ativo) return
      setLicitacoes(itens)
      setCarregando(false)
    })
    return () => {
      ativo = false
    }
  }, [carregandoPermissoes, restricaoDados])

  return (
    <div className="min-h-screen bg-paper p-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl text-ink">Calendário</h1>
        <p className="font-body text-sm text-ink-soft">Sessões de licitação e prazos internos da carteira.</p>
      </header>

      {carregando ? (
        <p className="font-body text-sm text-ink-soft">Carregando...</p>
      ) : (
        <CalendarioLicitacoes licitacoes={licitacoes} />
      )}
    </div>
  )
}
