// src/pages/admin/indicadores/IndicadoresPage.tsx
//
// Painel de Indicadores (Relatórios e Dashboards — Especificação de
// 07/10/2026). Um único motor para os três perfis:
// - Administrador: todos os clientes e todos os indicadores.
// - Analista (funcionário): só os clientes da sua carteira e só os indicadores
//   liberados para o perfil Analista (Configurações > Liberação de Indicadores).
// - Cliente (Responsável ou Operador): só a própria empresa e só os
//   indicadores liberados nos dois níveis (Administrador ao perfil Cliente e,
//   para o Operador, o Responsável). Os resultados das disputas vêm da função
//   do banco `relatorio_disputas_cliente` (migrações 038 e 039). O Responsável
//   também vê, ao final da página, a liberação dos seus Operadores.
// Filtros: período, cliente, modalidade, família, órgão, marca, resultado e,
// só para a equipe da Salutti, status (fase do pipeline).
// Carrega os dados uma vez e recalcula os números no navegador a cada mudança
// de filtro, para ficarem idênticos aos da tela de Disputa.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiltrosIndicadoresBar } from '../../../components/indicadores/FiltrosIndicadoresBar'
import { IndicadoresGraficos } from '../../../components/indicadores/IndicadoresGraficos'
import { LiberacaoOperadoresSecao } from '../../../components/indicadores/LiberacaoOperadoresSecao'
import { useAuth } from '../../../context/AuthContext'
import { usePermissoes } from '../../../hooks/usePermissoes'
import { liberacaoAnalistaService } from '../../../services/liberacaoAnalistaService'
import { liberacaoOperadorService } from '../../../services/liberacaoOperadorService'
import { relatorioIndicadoresService } from '../../../services/relatorioIndicadoresService'
import {
  calcularIndicadoresAdmin,
  listarOpcoesMarcas,
  listarOpcoesOrgaos,
} from '../../../utils/indicadoresCalculos'
import type { DadosBaseIndicadores, FiltrosIndicadores } from '../../../types/indicadores'
import { formatarNumero } from '../../../utils/prazoUtils'
import { descreverFiltros } from '../../../utils/descricaoFiltrosIndicadores'

export function IndicadoresPage({ embutido = false }: { embutido?: boolean } = {}) {
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
        // Lista efetiva: cruza a liberação do Administrador (nível 1) com a do
        // Responsável para o Operador (nível 2), calculada no banco.
        const [base, chaves] = await Promise.all([
          relatorioIndicadoresService.carregarDadosBaseCliente(),
          liberacaoOperadorService.indicadoresDoUsuarioLogado(),
        ])
        if (base === null || chaves === null) {
          setSemAcesso(true)
          setDados(null)
        } else {
          setDados(base)
          setVisiveis(new Set(chaves))
        }
        return
      }

      const [base, chavesAnalista] = await Promise.all([
        relatorioIndicadoresService.carregarDadosBase(restricaoDados ?? {}),
        // Analista: padrão da coluna "Analista" + exceções dele (migração 046).
        ehAdmin ? Promise.resolve(null) : liberacaoAnalistaService.indicadoresDoAnalistaLogado(),
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
        setVisiveis(new Set(chavesAnalista ?? []))
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

  // Opções dos filtros de órgão e marca: só o que existe nos dados que este
  // perfil enxerga (a carteira do Analista ou a própria empresa do Cliente).
  const opcoesOrgaos = useMemo(() => (dados ? listarOpcoesOrgaos(dados.licitacoes) : []), [dados])
  const opcoesAnalistas = useMemo(
    () => (!ehCliente && dados?.analistas ? dados.analistas.map((a) => ({ value: a.id, label: a.nome })) : []),
    [dados, ehCliente],
  )
  const opcoesMarcas = useMemo(() => (dados ? listarOpcoesMarcas(dados.licitacoes) : []), [dados])

  // Há algum filtro de recorte ativo (a caixa de provisórios não conta).
  const { incluirProvisorios: _provisorios, ...recortes } = filtros
  const filtrando = Object.values(recortes).some(Boolean)
  // "Clientes sem atividade" só obedece cliente e analista: com qualquer outro
  // recorte ativo (período, resultado, status etc.), o card some.
  const { clienteId: _cliente, analistaId: _analista, ...outrosRecortes } = recortes
  const filtrandoAlemDeClienteEAnalista = Object.values(outrosRecortes).some(Boolean)

  // Impressão: o navegador usa o título da página como nome do PDF.
  const imprimir = useCallback(() => {
    const tituloAnterior = document.title
    const hoje = new Date().toISOString().slice(0, 10)
    document.title = `Indicadores Salutti ${hoje}`
    const restaurar = () => {
      document.title = tituloAnterior
      window.removeEventListener('afterprint', restaurar)
    }
    window.addEventListener('afterprint', restaurar)
    window.print()
  }, [])

  const linhasFiltros = useMemo(
    () =>
      dados
        ? descreverFiltros(filtros, {
            clientes: dados.clientes,
            familias: dados.familias,
            orgaos: opcoesOrgaos,
            marcas: opcoesMarcas,
            analistas: opcoesAnalistas,
          })
        : [],
    [dados, filtros, opcoesOrgaos, opcoesMarcas, opcoesAnalistas],
  )

  return (
    <div className={embutido ? 'space-y-5' : 'min-h-screen space-y-5 bg-paper p-8'}>
      <header className={embutido ? 'hidden' : undefined}>
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
          Os indicadores não estão disponíveis para o seu usuário.
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
          {/* Cabeçalho que só aparece no papel: quem emitiu, quando e com quais filtros. */}
          <div className="print-only border-b border-ink-soft/30 pb-3">
            <p className="font-display text-xl text-ink">Salutti — Relatório de Indicadores</p>
            <p className="font-body text-xs text-ink-soft">
              Emitido em {new Date().toLocaleString('pt-BR')} por {user?.name ?? '—'}
            </p>
            <ul className="mt-2 font-body text-xs text-ink">
              {linhasFiltros.map((linha) => (
                <li key={linha}>{linha}</li>
              ))}
            </ul>
          </div>

          <div className="no-print flex justify-end">
            <button
              type="button"
              onClick={imprimir}
              className="rounded-md border border-forest/40 px-4 py-2 font-body text-sm font-medium text-forest-deep hover:bg-forest-mist"
            >
              Imprimir / salvar em PDF
            </button>
          </div>

          <div className="no-print">
            <FiltrosIndicadoresBar
              filtros={filtros}
              onChange={setFiltros}
              clientes={dados.clientes}
              familias={dados.familias}
              mostrarCliente={!ehCliente}
              mostrarStatus={!ehCliente}
              orgaos={opcoesOrgaos}
              marcas={opcoesMarcas}
              analistas={opcoesAnalistas}
            />
          </div>
          <p className="font-body text-sm text-ink-soft">
            {formatarNumero(indicadores.totalLicitacoes)}{' '}
            {indicadores.totalLicitacoes === 1 ? 'licitação considerada' : 'licitações consideradas'} nos filtros escolhidos.
          </p>
          {filtrando && indicadores.totalLicitacoes === 0 && (
            <p className="rounded-xl border border-ink-soft/15 bg-white p-6 text-center font-body text-sm text-ink-soft shadow-soft">
              Nenhuma licitação atende a todos os filtros escolhidos ao mesmo tempo. Ajuste ou limpe os filtros.
            </p>
          )}
          <IndicadoresGraficos
            indicadores={indicadores}
            visiveis={visiveis}
            ocultarVazios={filtrando}
            ocultarClientesSemAtividade={filtrandoAlemDeClienteEAnalista}
            resultadoFiltro={filtros.resultado === 'ganho' || filtros.resultado === 'perdido' ? filtros.resultado : undefined}
          />
        </>
      )}

      {ehCliente && !carregando && (
        <div className="no-print">
          <LiberacaoOperadoresSecao />
        </div>
      )}
    </div>
  )
}
