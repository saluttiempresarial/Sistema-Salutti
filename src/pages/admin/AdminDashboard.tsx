import { useEffect, useMemo, useState } from 'react'
import { DashboardShell, StatCard } from '@/components/DashboardShell'
import { useAuth } from '@/context/AuthContext'
import { licitacaoService } from '@/services/licitacaoService'
import { classificarUrgenciaPrazo } from '@/utils/prazoUtils'
import type { Licitacao } from '@/types/licitacao'

function formatarMoedaResumida(valor: number): string {
  if (valor >= 1_000_000) return `R$ ${(valor / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (valor >= 1_000) return `R$ ${(valor / 1_000).toFixed(0)}mil`
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function AdminDashboard() {
  const { user } = useAuth()
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true
    licitacaoService.listar({ pageSize: 1000 }).then((resLicitacoes) => {
      if (!ativo) return
      setLicitacoes(resLicitacoes.itens)
      setCarregando(false)
    })
    return () => {
      ativo = false
    }
  }, [])

  const licitacoesAtivas = useMemo(
    () => licitacoes.filter((l) => l.status !== 'ganho' && l.status !== 'perdido'),
    [licitacoes]
  )

  const prazosUrgentes = useMemo(
    () =>
      licitacoesAtivas.filter((l) => {
        const urgencia = classificarUrgenciaPrazo(l.dataEfetivaLicitacao || l.dataLicitacao)
        return urgencia === 'vencido' || urgencia === 'atencao'
      }),
    [licitacoesAtivas]
  )

  const taxaVitoria = useMemo(() => {
    const finalizadas = licitacoes.filter((l) => l.status === 'ganho' || l.status === 'perdido')
    if (finalizadas.length === 0) return null
    const ganhas = finalizadas.filter((l) => l.status === 'ganho').length
    return Math.round((ganhas / finalizadas.length) * 100)
  }, [licitacoes])

  const valorEmDisputa = useMemo(
    () => licitacoesAtivas.reduce((soma, l) => soma + (l.valorTotalLicitacao ?? 0), 0),
    [licitacoesAtivas]
  )

  return (
    <DashboardShell
      showHeader={false}
      title={`Olá, ${user?.name ?? 'Administrador'}`}
      subtitle="Visão geral do sistema."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Licitações ativas"
          value={carregando ? '—' : String(licitacoesAtivas.length)}
        />
        <StatCard
          label="Prazos vencendo (7 dias)"
          value={carregando ? '—' : String(prazosUrgentes.length)}
          hint={prazosUrgentes.length > 0 ? 'Confira em Licitações' : undefined}
        />
        <StatCard
          label="Taxa de vitória"
          value={carregando ? '—' : taxaVitoria === null ? '—' : `${taxaVitoria}%`}
          hint={taxaVitoria === null ? 'Sem licitações finalizadas ainda' : undefined}
        />
        <StatCard
          label="Valor em disputa"
          value={carregando ? '—' : formatarMoedaResumida(valorEmDisputa)}
          hint="Licitações ativas com valor público"
        />
      </div>
    </DashboardShell>
  )
}
