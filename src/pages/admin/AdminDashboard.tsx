import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DashboardShell, StatCard } from '@/components/DashboardShell'
import { useAuth } from '@/context/AuthContext'
import { licitacaoService } from '@/services/licitacaoService'
import { clienteService } from '@/services/clienteService'
import { funcionarioService } from '@/services/funcionarioService'
import { classificarUrgenciaPrazo } from '@/utils/prazoUtils'
import type { Licitacao } from '@/types/licitacao'
import type { Cliente } from '@/types/cliente'
import type { Funcionario } from '@/types/funcionario'

function formatarMoedaResumida(valor: number): string {
  if (valor >= 1_000_000) return `R$ ${(valor / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (valor >= 1_000) return `R$ ${(valor / 1_000).toFixed(0)}mil`
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function AdminDashboard() {
  const { user } = useAuth()
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true
    Promise.all([
      licitacaoService.listar({ pageSize: 1000 }),
      clienteService.list({ page: 1, pageSize: 1000 }),
      funcionarioService.list({ page: 1, pageSize: 1000 }),
    ]).then(([resLicitacoes, resClientes, resFuncionarios]) => {
      if (!ativo) return
      setLicitacoes(resLicitacoes.itens)
      setClientes(resClientes.data)
      setFuncionarios(resFuncionarios.data)
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

  const usuariosAtivosHint = useMemo(() => {
    const funcionariosAtivos = funcionarios.filter((f) => f.acesso.status === 'ativo')
    const admins = funcionariosAtivos.filter((f) => f.acesso.perfil === 'admin').length
    const equipe = funcionariosAtivos.length - admins
    return `${clientes.length} clientes, ${equipe} funcionários, ${admins} admins`
  }, [clientes, funcionarios])

  return (
    <DashboardShell
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

      <div className="mt-8 rounded-xl border border-ink-soft/10 bg-white p-6 shadow-soft">
        <h2 className="font-display text-lg font-semibold text-forest-deep">
          Área do administrador
        </h2>
        <p className="mt-2 font-body text-sm text-ink-soft">
          {carregando ? 'Carregando...' : usuariosAtivosHint}
          {' — '}Cadastro de Clientes e de Funcionários são exclusivos do perfil{' '}
          <strong>Administrador</strong>; Licitações, Disputas e Relatórios
          também são acessíveis pelo perfil <strong>Funcionário</strong>.
        </p>

        <div className="mt-4 flex flex-col gap-2">
          <Link
            to="/admin/clientes"
            className="inline-flex w-fit items-center gap-1.5 font-body text-sm font-semibold text-forest hover:underline"
          >
            Ir para Cadastro de Clientes →
          </Link>
          <Link
            to="/admin/funcionarios"
            className="inline-flex w-fit items-center gap-1.5 font-body text-sm font-semibold text-forest hover:underline"
          >
            Ir para Cadastro de Funcionários →
          </Link>
          <Link
            to="/admin/licitacoes"
            className="inline-flex w-fit items-center gap-1.5 font-body text-sm font-semibold text-forest hover:underline"
          >
            Ir para Licitações →
          </Link>
          <Link
            to="/admin/disputas"
            className="inline-flex w-fit items-center gap-1.5 font-body text-sm font-semibold text-forest hover:underline"
          >
            Ir para Disputas →
          </Link>
          <Link
            to="/admin/relatorios"
            className="inline-flex w-fit items-center gap-1.5 font-body text-sm font-semibold text-forest hover:underline"
          >
            Ir para Relatórios →
          </Link>
          <Link
            to="/admin/configuracoes"
            className="inline-flex w-fit items-center gap-1.5 font-body text-sm font-semibold text-forest hover:underline"
          >
            Ir para Configurações →
          </Link>
        </div>
      </div>
    </DashboardShell>
  )
}
