// src/pages/admin/indicadores/IndicadoresPage.tsx
//
// Painel de Indicadores (Relatórios e Dashboards — Especificação de
// 07/10/2026). Um único motor para os três perfis:
// - Administrador: todos os clientes e todos os indicadores.
// - Analista (funcionário): só os clientes da sua carteira e só os indicadores
//   liberados para o perfil Analista (Configurações > Liberação de Indicadores).
// - Cliente (Responsável): só a própria empresa e só os indicadores liberados
//   ao perfil Cliente. Os resultados das disputas vêm da função do banco
//   `relatorio_disputas_cliente` (migração 038); o Operador não tem acesso.
// Carrega os dados uma vez e recalcula os números no navegador a cada mudança
// de filtro, para ficarem idênticos aos da tela de Disputa.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiltrosIndicadoresBar } from '../../../components/indicadores/FiltrosIndicadoresBar'
import { IndicadoresGraficos } from '../../../components/indicadores/IndicadoresGraficos'
import { useAuth } from '../../../context/AuthContext'
import { usePermissoes } from '../../../hooks/usePermissoes'
import { liberacaoIndicadoresService } from '../../../services/liberacaoIndicadoresService'
import { relatorioIndicadoresService } from '../../../services/relatorioIndicadoresService'
import { calcularIndicadoresAdmin } from '../../../utils/indicadoresCalculos'
import type { DadosBaseIndicadores, FiltrosIndicadores } from '../../../types/indicadores'
import { formatarNumero } from '../../../utils/prazoUtils'

export function IndicadoresPage() {
  const { user } = useAuth()
  const ehCliente = user?.role === 'cliente'
  const { carregando: carregandoPermissoes, ehAdmin, restricaoDados } = usePermissoes()

  const [dados, setDados] = useState<DadosBaseIndicadores | null>(null)
  const [visiveis, setVisiveis] = useState<ReadonlySet<string> | undefined>(undefined)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [semAcesso, setSemAcesso] = useState(false)
  const [filtros, setFiltros] = useState<FiltrosIndicadores>({})

  const carregar = useCallback(async () => {
    if (carregandoPermissoes) return
    setCarregando(true)
    setErro(null)
    setSemAcesso(false)
    try {
      if (ehCliente) {
        const [base, liberacao] = await Promise.all([
          relatorioIndicadoresService.carregarDadosBaseCliente(),
          liberacaoIndicadoresService.listar(),
        ])
        if (base === null) {
          setSemAcesso(true)
          setDados(null)
        } else {
          setDados(base)
          setVisiveis(
            new Set(
              Object.entries(liberacao)
                .filter(([, perfis]) => perfis.cliente)
                .map(([chave]) => chave),
            ),
          )
        }
        return
      }

      const [base, liberacao] = await Promise.all([
        relatorioIndicadoresService.carregarDadosBase(restricaoDados ?? {}),
        ehAdmin ? Promise.resolve(null) : liberacaoIndicadoresService.listar(),
      ])

      if (ehAdmin) {
        setDados(base)
        setVisiveis(undefined)
      } else {
        // Analista: mantém só o que pertence à carteira (mesma lógica da tela
        // de Relatórios) e só os clientes/famílias dessas licitações.
        const idsLicitacoes = new Set(base.licitacoes.map((l) => l.id))
        const idsClientes = new Set(base.licitacoes.map((l) => l.clienteId))
        setDados({
          licitacoes: base.licitacoes,
          disputas: base.disputas.filter((d) => idsLicitacoes.has(d.licitacaoId)),
          familias: base.familias.filter((f) => idsClientes.has(f.clienteId)),
          clientes: base.clientes.filter((c) => idsClientes.has(c.id)),
        })
        setVisiveis(
          new Set(
            Object.entries(liberacao ?? {})
              .filter(([, perfis]) => perfis.analista)
              .map(([chave]) => chave),
          ),
        )
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar os indicadores.')
    } finally {
      setCarregando(false)
    }
  }, [carregandoPermissoes, ehAdmin, ehCliente, restricaoDados])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const indicadores = useMemo(
    () => (dados ? calcularIndicadoresAdmin(dados, filtros) : null),
    [dados, filtros],
  )

  return (
    <div className="min-h-screen space-y-5 bg-paper p-8">
      <header>
        <h1 className="font-display text-2xl text-ink">Indicadores</h1>
        <p className="font-body text-sm text-ink-soft">
          {ehAdmin
            ? 'Desempenho das licitações e disputas. Os filtros valem para todos os gráficos.'
            : ehCliente
              ? 'Desempenho das suas licitações e disputas. Os filtros valem para todos os gráficos.'
              : 'Desempenho das licitações e disputas dos clientes da sua carteira. Os filtros valem para todos os gráficos.'}
        </p>
      </header>

      {carregando && <p className="py-10 text-center font-body text-sm text-ink-soft">Carregando indicadores...</p>}

      {semAcesso && !carregando && (
        <p className="rounded-xl border border-ink-soft/15 bg-white p-8 text-center font-body text-sm text-ink-soft shadow-soft">
          Os indicadores estão disponíveis apenas para o Responsável da empresa.
        </p>
      )}

      {erro && !carregando && (
        <div role="alert" className="rounded-lg bg-red-50 p-4 font-body text-sm text-red-700">
          {erro}{' '}
          <button type="button" onClick={() => void carregar()} className="underline">
            Tentar novamente
          </button>
        </div>
      )}

      {dados && indicadores && !carregando && (
        <>
          <FiltrosIndicadoresBar
            filtros={filtros}
            onChange={setFiltros}
            clientes={dados.clientes}
            familias={dados.familias}
            mostrarCliente={!ehCliente}
          />
          <p className="font-body text-sm text-ink-soft">
            {formatarNumero(indicadores.totalLicitacoes)}{' '}
            {indicadores.totalLicitacoes === 1 ? 'licitação considerada' : 'licitações consideradas'} nos filtros escolhidos.
          </p>
          <IndicadoresGraficos indicadores={indicadores} visiveis={visiveis} />
        </>
      )}
    </div>
  )
}
