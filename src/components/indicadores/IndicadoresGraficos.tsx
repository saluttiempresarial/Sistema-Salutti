// src/components/indicadores/IndicadoresGraficos.tsx
//
// Painel visual dos indicadores (os 8 da primeira entrega, os 5 de preço e
// competitividade: valor adjudicado, ticket médio, desconto médio, fora de
// mercado e distância da derrota, os 2 de gestão interna: pipeline e prazos
// dos próximos 7 dias, e os 4 de produtos e marcas: taxa de vitória por
// família, marcas, produtos nunca ganhos e concorrentes por família). Recebe os números já
// calculados (utils/indicadoresCalculos.ts) e só os desenha. Cores: verde da
// marca para o que importa (ganhos), verde-claro para o total de referência e
// dourado para alertas/comparações — nunca só a cor carrega o sentido: todo
// gráfico tem legenda e valores no rótulo ou na dica.

import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type {
  ClientesSemAtividade,
  DesempenhoModalidade,
  MercadoUfEsfera,
  MotivosNaoParticipacao,
  FatiaCarteira,
  TempoResposta,
  ValorCliente,
  BarraFamilia,
  BarraOrgao,
  Concorrente,
  ForaDeMercado,
  IndicadoresAdmin,
  IndicadorPercentual,
  Pipeline,
  PrazosProximos,
  ProdutosNuncaGanhos,
  TaxaVitoria,
  TaxaVitoriaFamilia,
  TaxaFamilia,
  ForaDeMercadoGrupo,
  TaxaVitoriaMes,
  DistanciaDerrota,
  ValorAdjudicado,
} from '../../types/indicadores'
import { FILTRO_SEM_ESFERA, SITUACAO_INATIVIDADE_LABEL } from '../../types/indicadores'
import { MOTIVO_PERDA_EVITAVEL_LABEL } from '../../types/disputa'
import { formatarDataHora, formatarMoeda, formatarNumero } from '../../utils/prazoUtils'

const COR_GANHO = '#0B5C3C' // forest
const COR_REFERENCIA = '#9CC9B0' // forest claro
const COR_ALERTA = '#A9822F' // brass
const COR_GRADE = '#E3E7E4'
const COR_TEXTO = '#4A5A50'

const ESTILO_DICA = {
  borderRadius: 8,
  border: '1px solid #D5DBD7',
  fontFamily: '"Source Sans 3", sans-serif',
  fontSize: 13,
}

function formatarPercentual(valor: number | null): string {
  return valor === null ? '—' : `${formatarNumero(valor, 1)}%`
}

// Com filtro ativo, o painel esconde os cards que não têm dado nenhum (o card
// cujo conteúdo inteiro é a mensagem "sem dados").
const OcultarVaziosContexto = createContext(false)

function Cartao({
  titulo,
  subtitulo,
  children,
  className = '',
}: {
  titulo: string
  subtitulo?: string
  children: ReactNode
  className?: string
}) {
  const ocultarVazios = useContext(OcultarVaziosContexto)
  return (
    <section
      className={`h-full rounded-xl border border-ink-soft/15 bg-white p-5 shadow-soft ${
        ocultarVazios ? 'has-[>div>[data-vazio]]:hidden' : ''
      } ${className}`}
    >
      <h3 className="font-display text-lg text-ink">{titulo}</h3>
      {subtitulo && <p className="mt-0.5 font-body text-sm text-ink-soft">{subtitulo}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function SemDados({ texto = 'Sem dados para os filtros escolhidos.' }: { texto?: string }) {
  return (
    <p data-vazio className="py-8 text-center font-body text-sm text-ink-soft">
      {texto}
    </p>
  )
}

// ---------------------------------------------------------------------------
// 1. Relatório principal: total de licitações e funil
// ---------------------------------------------------------------------------
function RelatorioPrincipalBloco({ dados }: { dados: IndicadoresAdmin['relatorioPrincipal'] }) {
  if (dados.cadastradas === 0) return <SemDados />
  const pct = (parte: number, todo: number) => (todo > 0 ? formatarPercentual((parte / todo) * 100) : '—')
  const Numero = ({ valor, rotulo, nota, destaque }: { valor: number; rotulo: string; nota?: string; destaque?: boolean }) => (
    <div className="rounded bg-forest-mist p-3">
      <p className={`font-display ${destaque ? 'text-3xl text-forest-deep' : 'text-2xl text-ink'}`}>{formatarNumero(valor)}</p>
      <p className="font-body text-xs text-ink">{rotulo}</p>
      {nota && <p className="font-body text-[11px] text-ink-soft">{nota}</p>}
    </div>
  )
  const etapas = [
    { chave: 'enviadas', rotulo: 'Enviadas', quantidade: dados.enviadas },
    { chave: 'retornadas', rotulo: 'Retornadas', quantidade: dados.retornadas },
    { chave: 'participou', rotulo: 'Participou', quantidade: dados.participou },
    { chave: 'ganhas', rotulo: 'Ganhas (homologado)', quantidade: dados.ganhas },
  ]
  const maximo = Math.max(...etapas.map((e) => e.quantidade), 1)
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Numero valor={dados.enviadas} rotulo="Enviadas ao cliente" nota={dados.emPreparacao > 0 ? `+ ${formatarNumero(dados.emPreparacao)} em preparação` : undefined} destaque />
        <Numero valor={dados.retornadas} rotulo="Retornadas" nota="o cliente respondeu" />
        <Numero valor={dados.semRetorno} rotulo="Sem retorno" nota="paradas com o cliente" />
        <Numero
          valor={dados.naoParticipacao}
          rotulo="Não participação"
          nota={`${formatarNumero(dados.naoParticipacaoRecusa)} recusa · ${formatarNumero(dados.naoParticipacaoBloqueio)} bloqueio do sistema`}
        />
        <Numero valor={dados.participou} rotulo="Participou" />
        <Numero valor={dados.aguardandoResultado} rotulo="Aguardando resultado" nota="sem resultado lançado" />
      </div>

      <p className="mt-4 font-mono text-[11px] uppercase tracking-wide text-ink-soft">Resultado das licitações disputadas</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Numero valor={dados.arrematadasEmAnalise} rotulo="Arrematadas em análise" nota="1º no lance; falta aceitação e homologação" />
        <Numero valor={dados.perdidasEmAnalise} rotulo="Perdidas em análise" nota="outro em 1º; sem homologação" />
        <Numero valor={dados.ganhas} rotulo="Ganhas" nota="ao menos 1 item ou grupo, homologado" destaque />
        <Numero valor={dados.perdidas} rotulo="Perdidas" nota="nenhum item ganho, homologado" />
      </div>

      <p className="mt-4 font-mono text-[11px] uppercase tracking-wide text-ink-soft">Funil</p>
      <ol className="mt-2 space-y-2">
        {etapas.map((etapa, i) => {
          const anterior = i > 0 ? etapas[i - 1].quantidade : 0
          return (
            <li key={etapa.chave}>
              <div className="flex items-baseline justify-between font-body text-sm">
                <span className="text-ink">{etapa.rotulo}</span>
                <span className="text-ink">
                  <strong>{formatarNumero(etapa.quantidade)}</strong>
                  {i > 0 && anterior > 0 && (
                    <span className="ml-2 text-ink-soft">({pct(etapa.quantidade, anterior)} da etapa anterior)</span>
                  )}
                </span>
              </div>
              <div className="mt-1 h-5 rounded bg-forest-mist">
                <div
                  className="h-5 rounded"
                  style={{ width: `${Math.max((etapa.quantidade / maximo) * 100, 2)}%`, backgroundColor: i === etapas.length - 1 ? COR_GANHO : COR_REFERENCIA }}
                />
              </div>
            </li>
          )
        })}
      </ol>
      <p className="mt-3 font-body text-xs text-ink-soft">
        Resultados em análise ainda não são definitivos: dependem da homologação. O bloqueio do sistema (ME/EPP) não é resposta do
        cliente, por isso também continua em "sem retorno".
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 2. Taxa de vitória
// ---------------------------------------------------------------------------
function CartaoTaxa({
  titulo,
  principal,
  detalhe,
  extra,
}: {
  titulo: string
  principal: number | null
  detalhe: string
  extra?: string
}) {
  return (
    <div className="rounded-lg bg-forest-mist/60 p-4">
      <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">{titulo}</p>
      <p className="mt-1 font-display text-4xl text-forest-deep">{formatarPercentual(principal)}</p>
      <p className="mt-1 font-body text-sm text-ink-soft">{detalhe}</p>
      {extra && <p className="mt-1 font-body text-sm text-ink">{extra}</p>}
    </div>
  )
}

function EvolucaoTaxaMensal({ meses }: { meses: TaxaVitoriaMes[] }) {
  const [tipo, setTipo] = useState<'linhas' | 'barras'>('linhas')
  if (meses.length === 0) return null
  const dados = meses.map((m) => ({
    rotulo: m.rotulo,
    quantidade: m.percentualQuantidade === null ? null : Math.round(m.percentualQuantidade * 10) / 10,
    valor: m.percentualValor === null ? null : Math.round(m.percentualValor * 10) / 10,
    ganhos: m.ganhos,
    perdidos: m.perdidos,
  }))
  const eixos = (
    <>
      <CartesianGrid vertical={false} stroke={COR_GRADE} />
      <XAxis dataKey="rotulo" tick={{ fill: COR_TEXTO, fontSize: 12 }} tickLine={false} axisLine={false} />
      <YAxis domain={[0, 100]} unit="%" tick={{ fill: COR_TEXTO, fontSize: 12 }} tickLine={false} axisLine={false} width={44} />
      <Tooltip
        contentStyle={ESTILO_DICA}
        formatter={(valor) => (valor == null ? '—' : `${formatarNumero(Number(valor), 1)}%`)}
        labelFormatter={(rotulo, itens) => {
          const p = itens?.[0]?.payload as { ganhos?: number; perdidos?: number } | undefined
          return `${rotulo} — ${formatarNumero(p?.ganhos ?? 0)} ganhos, ${formatarNumero(p?.perdidos ?? 0)} perdidos`
        }}
      />
      <Legend wrapperStyle={{ fontSize: 12, color: COR_TEXTO }} />
    </>
  )
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-wide text-ink-soft">Evolução mês a mês (mês da sessão)</p>
        <div className="flex gap-1 font-body text-xs">
          {(['linhas', 'barras'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={`rounded px-2 py-1 ${tipo === t ? 'bg-forest text-white' : 'bg-forest-mist text-ink'}`}
            >
              {t === 'linhas' ? 'Linhas' : 'Barras'}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {tipo === 'linhas' ? (
            <LineChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              {eixos}
              <Line type="monotone" dataKey="quantidade" name="Por quantidade" stroke={COR_GANHO} strokeWidth={2} dot connectNulls />
              <Line type="monotone" dataKey="valor" name="Por valor" stroke={COR_ALERTA} strokeWidth={2} dot connectNulls />
            </LineChart>
          ) : (
            <BarChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              {eixos}
              <Bar dataKey="quantidade" name="Por quantidade" fill={COR_GANHO} radius={[3, 3, 0, 0]} />
              <Bar dataKey="valor" name="Por valor" fill={COR_REFERENCIA} radius={[3, 3, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      <p className="mt-1 font-body text-xs text-ink-soft">
        Cada mês usa os próprios totais. Sem comparação com o período anterior por enquanto.
      </p>
    </div>
  )
}

function TaxaVitoriaBloco({ atual, meses }: { atual: TaxaVitoria; meses: TaxaVitoriaMes[] }) {
  if (atual.ganhos + atual.perdidos === 0) return <SemDados texto="Nenhum item ganho ou perdido nos filtros escolhidos." />
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <CartaoTaxa
          titulo="Por quantidade"
          principal={atual.percentualQuantidade}
          detalhe={`${formatarNumero(atual.ganhos)} ganhos de ${formatarNumero(atual.ganhos + atual.perdidos)} disputados`}
          extra={atual.umACada !== null ? `1 a cada ${formatarNumero(atual.umACada, 1)} participações` : 'Nenhum ganho ainda'}
        />
        <CartaoTaxa
          titulo="Por valor"
          principal={atual.percentualValor}
          detalhe={`${formatarMoeda(atual.valorAdjudicado)} de ${formatarMoeda(atual.valorDisputado)}`}
        />
      </div>
      <EvolucaoTaxaMensal meses={meses} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// 3. Volume por mês
// ---------------------------------------------------------------------------
function VolumeMensal({ dados }: { dados: IndicadoresAdmin['volumePorMes'] }) {
  if (dados.length === 0) return <SemDados />
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={COR_GRADE} />
          <XAxis dataKey="rotulo" tick={{ fill: COR_TEXTO, fontSize: 12 }} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: COR_TEXTO, fontSize: 12 }} tickLine={false} axisLine={false} width={32} />
          <Tooltip
            contentStyle={ESTILO_DICA}
            cursor={{ fill: '#E7F0EA' }}
            formatter={(valor) => [formatarNumero(Number(valor)), 'Licitações']}
            labelFormatter={(rotulo, itens) => {
              const valor = (itens?.[0]?.payload as { valor?: number } | undefined)?.valor ?? 0
              return `${rotulo} — valor de referência ${formatarMoeda(valor)}`
            }}
          />
          <Bar dataKey="licitacoes" name="Licitações" fill={COR_GANHO} radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 4. Famílias (cotadas x ganhas) e 7. Órgãos (participações x vitórias)
// ---------------------------------------------------------------------------
function BarrasDuplas({
  dados,
  chaveRotulo,
  chaveTotal,
  chaveGanho,
  rotuloTotal,
  rotuloGanho,
}: {
  dados: Array<Record<string, string | number>>
  chaveRotulo: string
  chaveTotal: string
  chaveGanho: string
  rotuloTotal: string
  rotuloGanho: string
}) {
  if (dados.length === 0) return <SemDados />
  const altura = Math.max(dados.length * 46 + 48, 160)
  return (
    <div style={{ height: altura }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke={COR_GRADE} />
          <XAxis type="number" allowDecimals={false} tick={{ fill: COR_TEXTO, fontSize: 12 }} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey={chaveRotulo}
            width={190}
            tick={{ fill: COR_TEXTO, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: string) => (v.length > 30 ? `${v.slice(0, 29)}…` : v)}
          />
          <Tooltip contentStyle={ESTILO_DICA} cursor={{ fill: '#E7F0EA' }} />
          <Legend wrapperStyle={{ fontSize: 13, fontFamily: '"Source Sans 3", sans-serif' }} />
          <Bar dataKey={chaveTotal} name={rotuloTotal} fill={COR_REFERENCIA} radius={[0, 4, 4, 0]} maxBarSize={16} />
          <Bar dataKey={chaveGanho} name={rotuloGanho} fill={COR_GANHO} radius={[0, 4, 4, 0]} maxBarSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function Familias({ barras }: { barras: BarraFamilia[] }) {
  return (
    <BarrasDuplas
      dados={barras.map((b) => ({ nome: b.nome, cotadas: b.cotadas, ganhas: b.ganhas }))}
      chaveRotulo="nome"
      chaveTotal="cotadas"
      chaveGanho="ganhas"
      rotuloTotal="Cotadas"
      rotuloGanho="Ganhas"
    />
  )
}

function Orgaos({ barras }: { barras: BarraOrgao[] }) {
  if (barras.length === 0) return <SemDados />
  return (
    <div>
      <BarrasDuplas
        dados={barras.map((b) => ({ orgao: b.orgao, participacoes: b.participacoes, vitorias: b.vitorias }))}
        chaveRotulo="orgao"
        chaveTotal="participacoes"
        chaveGanho="vitorias"
        rotuloTotal="Participações"
        rotuloGanho="Com vitória"
      />
      {barras.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left font-body text-sm">
            <thead>
              <tr className="border-b border-ink-soft/20 font-mono text-xs uppercase tracking-wide text-ink-soft">
                <th className="py-2 pr-3 font-normal">Órgão</th>
                <th className="py-2 pr-3 text-right font-normal">Licitações</th>
                <th className="py-2 pr-3 text-right font-normal">Taxa de vitória</th>
                <th className="py-2 text-right font-normal">Valor adjudicado</th>
              </tr>
            </thead>
            <tbody>
              {barras.map((b) => (
                <tr key={b.orgao} className="border-b border-ink-soft/10 align-top">
                  <td className="py-2 pr-3 text-ink">
                    {b.orgao}
                    {(b.cnpj || b.uasg) && (
                      <div className="text-xs text-ink-soft">
                        {b.cnpj && `CNPJ ${formatarCnpjExibicao(b.cnpj)}`}
                        {b.cnpj && b.uasg && ' · '}
                        {b.uasg && `UASG ${b.uasg}`}
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right text-ink">
                    {formatarNumero(b.licitacoes)}
                    {b.licitacoes >= 3 && <div className="text-xs" style={{ color: COR_ALERTA }}>comprador recorrente</div>}
                  </td>
                  <td className="py-2 pr-3 text-right text-ink">
                    {b.taxaVitoria !== null ? formatarPercentual(b.taxaVitoria) : '—'}
                    <div className="text-xs text-ink-soft">
                      {formatarNumero(b.vitorias)} de {formatarNumero(b.participacoes)}
                    </div>
                  </td>
                  <td className="py-2 text-right text-ink">{formatarMoeda(b.valorAdjudicado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 font-body text-xs text-ink-soft">
            Recorrente: 3 ou mais licitações do mesmo órgão no período (referência interna).
          </p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 5. Ganho sobre o mínimo
// ---------------------------------------------------------------------------
function GanhoSobreMinimoBloco({ dados }: { dados: IndicadoresAdmin['ganhoSobreMinimo'] }) {
  const linhas = dados.porFamilia.filter((f) => f.percentual !== null)
  if (dados.geral === null && linhas.length === 0) {
    return <SemDados texto="Nenhum item ganho com preço mínimo informado." />
  }
  const maximo = Math.max(...linhas.map((l) => Math.abs(l.percentual ?? 0)), 1)
  return (
    <div>
      <p className="font-display text-4xl text-forest-deep">{formatarPercentual(dados.geral)}</p>
      <p className="font-body text-sm text-ink-soft">
        acima do mínimo com frete (média ponderada pelo valor), nos itens ganhos
      </p>
      <p className="mt-2 font-body text-sm text-ink">
        <strong>{formatarMoeda(dados.valorGanho)}</strong> acima do mínimo em{' '}
        <strong>{formatarMoeda(dados.valorFechado)}</strong> fechados
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center font-body text-xs">
        <div className="rounded bg-forest-mist p-2">
          <p className="font-display text-xl text-ink">{formatarNumero(dados.faixas.noLimite)}</p>
          <p className="text-ink-soft">No limite (até 3%): rever o mínimo</p>
        </div>
        <div className="rounded bg-forest-mist p-2">
          <p className="font-display text-xl text-ink">{formatarNumero(dados.faixas.saudavel)}</p>
          <p className="text-ink-soft">Saudável (3% a 10%)</p>
        </div>
        <div className="rounded bg-forest-mist p-2">
          <p className="font-display text-xl text-ink">{formatarNumero(dados.faixas.forte)}</p>
          <p className="text-ink-soft">Forte (acima de 10%)</p>
        </div>
      </div>
      {dados.semMinimo > 0 && (
        <p className="mt-3 font-body text-xs text-ink-soft">
          {formatarNumero(dados.semMinimo)} {dados.semMinimo === 1 ? 'item ganho está' : 'itens ganhos estão'} sem preço
          mínimo informado e {dados.semMinimo === 1 ? 'ficou' : 'ficaram'} fora deste cálculo.
        </p>
      )}
      {dados.porMarca.length > 0 && (
        <div className="mt-4">
          <p className="font-mono text-[11px] uppercase tracking-wide text-ink-soft">Por marca (itens com preço próprio)</p>
          <ul className="mt-2 space-y-1">
            {dados.porMarca.map((m) => (
              <li key={m.chave} className="flex justify-between font-body text-sm">
                <span className="text-ink">
                  {m.nome} <span className="text-ink-soft">({formatarNumero(m.quantidade)})</span>
                </span>
                <span className="text-ink">
                  <strong>{formatarPercentual(m.percentual)}</strong>{' '}
                  <span className="text-ink-soft">· {formatarMoeda(m.valorGanho)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-4 font-mono text-[11px] uppercase tracking-wide text-ink-soft">Por família</p>
      <ul className="mt-2 space-y-2">
        {linhas.map((l) => (
          <li key={l.chave} className="font-body text-sm">
            <div className="flex justify-between">
              <span className="text-ink">
                {l.nome} <span className="text-ink-soft">({formatarNumero(l.quantidade)})</span>
              </span>
              <strong className="text-ink">{formatarPercentual(l.percentual)}</strong>
            </div>
            <div className="mt-1 h-2 rounded bg-forest-mist">
              <div
                className="h-2 rounded"
                style={{ width: `${Math.max((Math.abs(l.percentual ?? 0) / maximo) * 100, 2)}%`, backgroundColor: COR_GANHO }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Performance por analista (só o Administrador)
// ---------------------------------------------------------------------------
const AMOSTRA_MINIMA_ANALISTA = 5

function PerformanceAnalistasBloco({ dados }: { dados: IndicadoresAdmin['performanceAnalistas'] }) {
  if (dados.length === 0) return <SemDados />
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left font-body text-sm">
          <thead>
            <tr className="border-b border-ink-soft/20 font-mono text-xs uppercase tracking-wide text-ink-soft">
              <th className="py-2 pr-3 font-normal">Analista</th>
              <th className="py-2 pr-3 text-right font-normal">Enviadas</th>
              <th className="py-2 pr-3 text-right font-normal">Participações</th>
              <th className="py-2 pr-3 text-right font-normal">Taxa de vitória</th>
              <th className="py-2 pr-3 text-right font-normal">Adjudicado</th>
              <th className="py-2 text-right font-normal">Perdas evitáveis</th>
            </tr>
          </thead>
          <tbody>
            {dados.map((a) => {
              const disputados = a.ganhos + a.perdidos
              return (
                <tr key={a.id} className="border-b border-ink-soft/10 align-top">
                  <td className="py-2 pr-3 text-ink">
                    {a.nome}
                    <div className="text-xs text-ink-soft">
                      {formatarNumero(a.clientes)} {a.clientes === 1 ? 'cliente' : 'clientes'}
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-right text-ink">{formatarNumero(a.enviadas)}</td>
                  <td className="py-2 pr-3 text-right text-ink">{formatarNumero(a.participacoes)}</td>
                  <td className="py-2 pr-3 text-right text-ink">
                    {formatarPercentual(a.taxaVitoria)}
                    <div className="text-xs text-ink-soft">
                      {formatarNumero(a.ganhos)} de {formatarNumero(disputados)}
                    </div>
                    {disputados > 0 && disputados < AMOSTRA_MINIMA_ANALISTA && (
                      <div className="text-xs" style={{ color: COR_ALERTA }}>
                        amostra pequena
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right text-ink">{formatarMoeda(a.valorAdjudicado)}</td>
                  <td className="py-2 text-right text-ink">
                    {formatarNumero(a.perdasEvitaveis)}
                    {a.perdasEvitaveis > 0 && (
                      <div className="text-xs text-ink-soft">{formatarMoeda(a.valorPerdasEvitaveis)}</div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 font-body text-xs text-ink-soft">
        Cada analista aparece com os clientes da sua carteira (aba Permissões do Funcionário); a taxa de vitória conta
        itens e grupos. Com menos de {AMOSTRA_MINIMA_ANALISTA} disputados, o percentual oscila muito. Valor adjudicado
        não é faturamento.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 6. Perdas evitáveis
// ---------------------------------------------------------------------------
function PerdasEvitaveisBloco({ dados }: { dados: IndicadoresAdmin['perdasEvitaveis'] }) {
  if (dados.linhas.length === 0) {
    return <SemDados texto="Nenhuma perda evitável: nenhum vencedor ficou acima do mínimo do cliente." />
  }
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left font-body text-sm">
          <thead>
            <tr className="border-b border-ink-soft/20 font-mono text-xs uppercase tracking-wide text-ink-soft">
              <th className="py-2 pr-3 font-normal">Licitação</th>
              <th className="py-2 pr-3 font-normal">Item / grupo</th>
              <th className="py-2 pr-3 text-right font-normal">Nosso valor</th>
              <th className="py-2 pr-3 text-right font-normal">Vencedor</th>
              <th className="py-2 pr-3 text-right font-normal">Mínimo c/ frete</th>
              <th className="py-2 font-normal">Por que foi evitável</th>
            </tr>
          </thead>
          <tbody>
            {dados.linhas.map((l, i) => (
              <tr key={`${l.licitacaoId}-${l.rotulo}-${i}`} className="border-b border-ink-soft/10 align-top">
                <td className="py-2 pr-3 text-ink">
                  {l.numeroPregao}
                  <div className="text-xs text-ink-soft">{l.cliente}</div>
                </td>
                <td className="py-2 pr-3 text-ink">{l.rotulo}</td>
                <td className="py-2 pr-3 text-right text-ink">{l.valorNosso != null ? formatarMoeda(l.valorNosso) : '—'}</td>
                <td className="py-2 pr-3 text-right text-ink">
                  {formatarMoeda(l.valorVencedor)}
                  <div className="text-xs text-ink-soft">{l.nomeVencedor || 'não informado'}</div>
                </td>
                <td className="py-2 pr-3 text-right text-ink">{formatarMoeda(l.valorMinimo)}</td>
                <td className="py-2 text-ink">
                  {l.motivo ? MOTIVO_PERDA_EVITAVEL_LABEL[l.motivo] : <span className="text-ink-soft">não informado</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dados.porMotivo.length > 0 && (
        <div className="mt-4">
          <h4 className="font-mono text-xs uppercase tracking-wide text-ink-soft">Principais motivos</h4>
          <ul className="mt-2 space-y-1">
            {dados.porMotivo.map((m) => (
              <li key={m.chave} className="flex justify-between font-body text-sm text-ink">
                <span>
                  {m.nome} <span className="text-ink-soft">({formatarNumero(m.quantidade)})</span>
                </span>
                <strong>{formatarMoeda(m.valorVencedor)}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
      {dados.porAnalista && dados.porAnalista.length > 0 && (
        <div className="mt-4">
          <h4 className="font-mono text-xs uppercase tracking-wide text-ink-soft">Ranking por analista (carteira)</h4>
          <ul className="mt-2 space-y-1">
            {dados.porAnalista.map((a) => (
              <li key={a.nome} className="flex justify-between font-body text-sm text-ink">
                <span>
                  {a.nome} <span className="text-ink-soft">({formatarNumero(a.quantidade)})</span>
                </span>
                <strong>{formatarMoeda(a.valorVencedor)}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-3 font-body text-sm text-ink">
        Total que teria sido adjudicado com um lance até o valor do vencedor:{' '}
        <strong style={{ color: COR_ALERTA }}>{formatarMoeda(dados.totalVencedor)}</strong>
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 5. Distância da derrota: faixas, reais acima do vencedor, marcas e perdas por pouco
// ---------------------------------------------------------------------------
function DistanciaDerrotaBloco({ dados }: { dados: DistanciaDerrota }) {
  if (dados.quantidade === 0) return <SemDados texto="Nenhuma perda por preço com valor do vencedor informado." />
  return (
    <div>
      <p className="font-display text-4xl text-forest-deep">{formatarPercentual(dados.geral)}</p>
      <p className="font-body text-sm text-ink-soft">
        acima do valor do vencedor, em média, nas perdas por preço ({formatarNumero(dados.quantidade)}{' '}
        {dados.quantidade === 1 ? 'item ou grupo' : 'itens e grupos'})
      </p>
      <p className="mt-2 font-body text-sm text-ink">
        <strong style={{ color: COR_ALERTA }}>{formatarMoeda(dados.valorAcima)}</strong> acima do vencedor, somados no período
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center font-body text-xs">
        <div className="rounded bg-forest-mist p-2">
          <p className="font-display text-xl text-ink">{formatarNumero(dados.faixas.ate3)}</p>
          <p className="text-ink-soft">Até 3% (perdemos por pouco)</p>
        </div>
        <div className="rounded bg-forest-mist p-2">
          <p className="font-display text-xl text-ink">{formatarNumero(dados.faixas.de3a10)}</p>
          <p className="text-ink-soft">De 3% a 10%</p>
        </div>
        <div className="rounded bg-forest-mist p-2">
          <p className="font-display text-xl text-ink">{formatarNumero(dados.faixas.acima10)}</p>
          <p className="text-ink-soft">Acima de 10%</p>
        </div>
      </div>

      {dados.porMarca.length > 0 && (
        <div className="mt-4">
          <p className="font-mono text-[11px] uppercase tracking-wide text-ink-soft">Por marca perdida (itens com marca)</p>
          <ul className="mt-2 space-y-1">
            {dados.porMarca.map((m) => (
              <li key={m.chave} className="flex justify-between font-body text-sm">
                <span className="text-ink">
                  {m.nome} <span className="text-ink-soft">({formatarNumero(m.quantidade)})</span>
                </span>
                <span className="text-ink">
                  <strong>{formatarPercentual(m.percentual)}</strong>{' '}
                  <span className="text-ink-soft">· {formatarMoeda(m.valorAcima)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {dados.porFamilia.some((f) => f.percentual !== null) && (
        <div className="mt-4">
          <p className="font-mono text-[11px] uppercase tracking-wide text-ink-soft">Por família</p>
          <ul className="mt-2 space-y-1">
            {dados.porFamilia
              .filter((f) => f.percentual !== null)
              .map((f) => (
                <li key={f.chave} className="flex justify-between font-body text-sm">
                  <span className="text-ink">
                    {f.nome} <span className="text-ink-soft">({formatarNumero(f.quantidade)})</span>
                  </span>
                  <strong className="text-ink">{formatarPercentual(f.percentual)}</strong>
                </li>
              ))}
          </ul>
        </div>
      )}

      {dados.perdasPorPouco.length > 0 && (
        <div className="mt-4">
          <p className="font-mono text-[11px] uppercase tracking-wide text-ink-soft">Perdas por até 3%: quase ganhamos</p>
          <div className="mt-2 max-h-72 overflow-auto">
            <table className="w-full min-w-[520px] text-left font-body text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-ink-soft/20 font-mono text-xs uppercase tracking-wide text-ink-soft">
                  <th className="py-2 pr-3 font-normal">Licitação</th>
                  <th className="py-2 pr-3 font-normal">Item / grupo</th>
                  <th className="py-2 pr-3 text-right font-normal">Nosso preço</th>
                  <th className="py-2 text-right font-normal">Vencedor</th>
                </tr>
              </thead>
              <tbody>
                {dados.perdasPorPouco.map((l, i) => (
                  <tr key={`${l.licitacaoId}-${l.rotulo}-${i}`} className="border-b border-ink-soft/10 align-top">
                    <td className="py-2 pr-3 text-ink">
                      {l.numeroPregao}
                      <div className="text-xs text-ink-soft">
                        {l.orgao} · {l.cliente}
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-ink">{l.rotulo}</td>
                    <td className="py-2 pr-3 text-right text-ink">
                      {formatarMoeda(l.valorNosso)}
                      <div className="text-xs text-ink-soft">+{formatarPercentual(l.percentual)}</div>
                    </td>
                    <td className="py-2 text-right text-ink">
                      {formatarMoeda(l.valorVencedor)}
                      <div className="text-xs text-ink-soft">{l.nomeVencedor}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Perdas na habilitação, vitórias por convocação e alerta de acompanhamento
// ---------------------------------------------------------------------------
function PerdasHabilitacaoBloco({ dados }: { dados: IndicadoresAdmin['perdasHabilitacao'] }) {
  if (dados.quantidade === 0) {
    return <SemDados texto="Nenhum item ou grupo perdido na aceitação/habilitação nos filtros escolhidos." />
  }
  return (
    <div>
      <p className="font-display text-4xl" style={{ color: COR_ALERTA }}>
        {formatarMoeda(dados.valorPerdido)}
      </p>
      <p className="font-body text-sm text-ink-soft">
        deixaram de ser adjudicados em {formatarNumero(dados.quantidade)} {dados.quantidade === 1 ? 'item ou grupo' : 'itens ou grupos'}
      </p>
      <ul className="mt-3 flex flex-wrap gap-2 font-body text-xs">
        {dados.porOrigem.map((o) => (
          <li key={o.origem} className="rounded bg-forest-mist px-2 py-1 text-ink">
            <strong>{o.origem}</strong>: {formatarNumero(o.quantidade)} · {formatarMoeda(o.valor)}
          </li>
        ))}
      </ul>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left font-body text-sm">
          <thead>
            <tr className="border-b border-ink-soft/20 font-mono text-xs uppercase tracking-wide text-ink-soft">
              <th className="py-2 pr-3 font-normal">Licitação</th>
              <th className="py-2 pr-3 font-normal">Item / grupo</th>
              <th className="py-2 pr-3 font-normal">Etapa e motivo</th>
              <th className="py-2 pr-3 font-normal">Origem</th>
              <th className="py-2 text-right font-normal">Valor</th>
            </tr>
          </thead>
          <tbody>
            {dados.linhas.map((l, i) => (
              <tr key={`${l.licitacaoId}-${l.rotulo}-${i}`} className="border-b border-ink-soft/10 align-top">
                <td className="py-2 pr-3 text-ink">
                  {l.numeroPregao}
                  <div className="text-xs text-ink-soft">
                    {l.orgao} · {l.cliente}
                  </div>
                </td>
                <td className="py-2 pr-3 text-ink">{l.rotulo}</td>
                <td className="py-2 pr-3 text-ink">
                  {l.etapa}
                  <div className="text-xs text-ink-soft">{l.motivo}</div>
                </td>
                <td className="py-2 pr-3 text-ink">{l.origem}</td>
                <td className="py-2 text-right text-ink">{l.valor != null ? formatarMoeda(l.valor) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 font-body text-xs text-ink-soft">
        Na taxa de vitória conta como perdida; fica fora da distância da derrota e das perdas evitáveis, porque não foi perda por
        preço. Inabilitação tem origem no cliente; na desclassificação a origem só aparece quando o motivo detalhado foi registrado.
      </p>
    </div>
  )
}

function VitoriasConvocacaoBloco({ dados }: { dados: IndicadoresAdmin['vitoriasConvocacao'] }) {
  if (dados.quantidade === 0) {
    return <SemDados texto="Nenhuma vitória por convocação nos filtros escolhidos." />
  }
  return (
    <div>
      <p className="font-display text-4xl text-forest-deep">{formatarMoeda(dados.valor)}</p>
      <p className="font-body text-sm text-ink-soft">
        em {formatarNumero(dados.quantidade)} {dados.quantidade === 1 ? 'vitória' : 'vitórias'} vindas da desclassificação de concorrentes
      </p>
      <ul className="mt-3 space-y-2">
        {dados.linhas.map((l, i) => (
          <li key={`${l.licitacaoId}-${l.rotulo}-${i}`} className="flex justify-between gap-3 font-body text-sm">
            <span className="text-ink">
              {l.numeroPregao} · {l.rotulo}
              <span className="block text-xs text-ink-soft">
                {l.orgao} · {l.cliente}
                {!l.definitiva && ' · provisória'}
              </span>
            </span>
            <strong className="shrink-0 text-ink">{l.valor != null ? formatarMoeda(l.valor) : '—'}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

function AlertaAcompanhamentoBloco({ dados }: { dados: IndicadoresAdmin['alertaAcompanhamento'] }) {
  if (dados.length === 0) {
    return <SemDados texto="Nenhuma perda em análise com o cliente em 2º ou 3º lugar." />
  }
  return (
    <ul className="space-y-2">
      {dados.map((l, i) => (
        <li key={`${l.licitacaoId}-${l.rotulo}-${i}`} className="flex justify-between gap-3 font-body text-sm">
          <span className="text-ink">
            {l.numeroPregao} · {l.rotulo}
            <span className="block text-xs text-ink-soft">
              {l.orgao} · {l.cliente} · 1º lugar: {l.nomeVencedor}
              {l.valorVencedor != null ? ` (${formatarMoeda(l.valorVencedor)})` : ''}
            </span>
          </span>
          <span className="shrink-0 text-right text-ink">
            <strong style={{ color: COR_ALERTA }}>{l.posicao}º lugar</strong>
            <span className="block text-xs text-ink-soft">{l.valorNosso != null ? formatarMoeda(l.valorNosso) : '—'}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// Preço e competitividade: valor adjudicado e ticket médio
// ---------------------------------------------------------------------------
const NOTA_ADJUDICADO = 'Valor adjudicado não é faturamento: em registro de preços, só vira receita com o empenho.'

const FORMATO_COMPACTO = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })

function ValorAdjudicadoBloco({ dados }: { dados: ValorAdjudicado }) {
  if (dados.porMes.length === 0 || dados.total === 0) {
    return <SemDados texto="Nenhum item ou grupo ganho nos filtros escolhidos." />
  }
  return (
    <div>
      <p className="font-display text-4xl text-forest-deep">{formatarMoeda(dados.total)}</p>
      <p className="font-body text-sm text-ink-soft">
        em {formatarNumero(dados.licitacoesGanhas)} {dados.licitacoesGanhas === 1 ? 'licitação ganha' : 'licitações ganhas'}
      </p>
      <div className="mt-4 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados.porMes} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={COR_GRADE} />
            <XAxis dataKey="rotulo" tick={{ fill: COR_TEXTO, fontSize: 12 }} tickLine={false} axisLine={false} />
            <YAxis
              tick={{ fill: COR_TEXTO, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={52}
              tickFormatter={(v: number) => FORMATO_COMPACTO.format(v)}
            />
            <Tooltip
              contentStyle={ESTILO_DICA}
              cursor={{ fill: '#E7F0EA' }}
              formatter={(valor, nome) => [formatarMoeda(Number(valor)), String(nome)]}
              labelFormatter={(rotulo, itens) => {
                const ganhas = (itens?.[0]?.payload as { licitacoesGanhas?: number } | undefined)?.licitacoesGanhas ?? 0
                return `${rotulo} — ${formatarNumero(ganhas)} ${ganhas === 1 ? 'licitação ganha' : 'licitações ganhas'}`
              }}
            />
            <Legend wrapperStyle={{ fontSize: 13, fontFamily: '"Source Sans 3", sans-serif' }} />
            <Bar dataKey="valorConvencional" name="Contratação convencional" stackId="adj" fill={COR_GANHO} maxBarSize={40} />
            <Bar dataKey="valorSrp" name="Registro de Preços (SRP)" stackId="adj" fill={COR_REFERENCIA} radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 font-body text-xs text-ink-soft">{NOTA_ADJUDICADO}</p>
      <p className="mt-1 font-body text-xs text-ink-soft">
        Em Sistema de Registro de Preços (SRP), o valor é o máximo potencial da ata, não o que será efetivamente
        empenhado. Mês de referência: data da sessão realizada.
      </p>
    </div>
  )
}

function TicketMedioBloco({ dados }: { dados: ValorAdjudicado }) {
  if (dados.ticketMedio === null) return <SemDados texto="Nenhuma licitação ganha nos filtros escolhidos." />
  return (
    <div>
      <p className="font-display text-4xl text-forest-deep">{formatarMoeda(dados.ticketMedio)}</p>
      <p className="font-body text-sm text-ink-soft">
        por licitação ganha: {formatarMoeda(dados.total)} em {formatarNumero(dados.licitacoesGanhas)}{' '}
        {dados.licitacoesGanhas === 1 ? 'licitação' : 'licitações'}
      </p>
      <p className="mt-3 font-body text-xs text-ink-soft">{NOTA_ADJUDICADO}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Preço e competitividade: desconto médio e distância da derrota (mesmo
// desenho: percentual geral + barras por família)
// ---------------------------------------------------------------------------
function PercentualPorFamiliaBloco({
  dados,
  textoGeral,
  semDados,
}: {
  dados: IndicadorPercentual
  /** Frase que explica o número grande, já considerando o sinal. */
  textoGeral: (geral: number) => string
  semDados: string
}) {
  const linhas = dados.porFamilia.filter((f) => f.percentual !== null)
  if (dados.geral === null && linhas.length === 0) return <SemDados texto={semDados} />
  const maximo = Math.max(...linhas.map((l) => Math.abs(l.percentual ?? 0)), 1)
  return (
    <div>
      <p className="font-display text-4xl text-forest-deep">{formatarPercentual(dados.geral)}</p>
      {dados.geral !== null && (
        <p className="font-body text-sm text-ink-soft">
          {textoGeral(dados.geral)} ({formatarNumero(dados.quantidade)}{' '}
          {dados.quantidade === 1 ? 'item ou grupo' : 'itens e grupos'})
        </p>
      )}
      <ul className="mt-4 space-y-2">
        {linhas.map((l) => (
          <li key={l.chave} className="font-body text-sm">
            <div className="flex justify-between">
              <span className="text-ink">
                {l.nome} <span className="text-ink-soft">({formatarNumero(l.quantidade)})</span>
              </span>
              <strong className="text-ink">{formatarPercentual(l.percentual)}</strong>
            </div>
            <div className="mt-1 h-2 rounded bg-forest-mist">
              <div
                className="h-2 rounded"
                style={{
                  width: `${Math.max((Math.abs(l.percentual ?? 0) / maximo) * 100, 2)}%`,
                  backgroundColor: (l.percentual ?? 0) < 0 ? COR_ALERTA : COR_GANHO,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Preço e competitividade: fora de mercado (não mostra o nome do vencedor)
// ---------------------------------------------------------------------------
const LIMITE_FORA_DE_MERCADO = 10

function ForaDeMercadoBloco({ dados }: { dados: ForaDeMercado }) {
  if (dados.baseComVencedor === 0) {
    return <SemDados texto="Nenhum item perdido com valor do vencedor informado." />
  }
  if (dados.quantidade === 0) {
    return (
      <SemDados
        texto={`Nenhum vencedor ficou abaixo do mínimo do cliente (${formatarNumero(dados.baseComVencedor)} ${
          dados.baseComVencedor === 1 ? 'perda analisada' : 'perdas analisadas'
        }).`}
      />
    )
  }
  const visiveis = dados.linhas.slice(0, LIMITE_FORA_DE_MERCADO)
  return (
    <div>
      <p className="font-display text-4xl text-forest-deep">{formatarPercentual(dados.percentual)}</p>
      <p className="font-body text-sm text-ink-soft">
        {formatarNumero(dados.quantidade)} de {formatarNumero(dados.baseComVencedor)} itens perdidos tiveram vencedor
        abaixo do mínimo do cliente
      </p>
      {dados.distanciaMedia !== null && (
        <p className="mt-1 font-body text-sm text-ink-soft">
          Em média, o vencedor ficou {formatarPercentual(dados.distanciaMedia)} abaixo do mínimo com frete.
        </p>
      )}
      {dados.possivelmenteInexequiveis > 0 && (
        <p className="mt-2 rounded bg-brass-pale/60 p-2 font-body text-xs text-ink">
          <strong>{formatarNumero(dados.possivelmenteInexequiveis)}</strong>{' '}
          {dados.possivelmenteInexequiveis === 1 ? 'vencedor fechou' : 'vencedores fecharam'} 30% ou mais abaixo do mínimo: preço
          possivelmente inexequível (referência interna, não é critério legal).
        </p>
      )}
      {dados.composicao.total > 0 && (
        <div className="mt-4">
          <p className="font-mono text-[11px] uppercase tracking-wide text-ink-soft">
            Composição das perdas definitivas ({formatarNumero(dados.composicao.total)})
          </p>
          <ul className="mt-2 grid grid-cols-2 gap-2 font-body text-xs sm:grid-cols-4">
            {[
              ['Fora de mercado', dados.composicao.foraDeMercado],
              ['Perda evitável', dados.composicao.perdaEvitavel],
              ['Perdida na habilitação', dados.composicao.perdidaHabilitacao],
              ['Sem preço do vencedor', dados.composicao.semPrecoVencedor],
            ].map(([nome, q]) => (
              <li key={nome as string} className="rounded bg-forest-mist p-2 text-center">
                <p className="font-display text-xl text-ink">{formatarNumero(q as number)}</p>
                <p className="text-ink-soft">{nome}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {[
        ['Famílias mais recorrentes', dados.porFamilia],
        ['Marcas mais recorrentes', dados.porMarca],
      ].map(([titulo, lista]) =>
        (lista as ForaDeMercadoGrupo[]).length > 0 ? (
          <div key={titulo as string} className="mt-4">
            <p className="font-mono text-[11px] uppercase tracking-wide text-ink-soft">{titulo as string}</p>
            <ul className="mt-2 space-y-1">
              {(lista as ForaDeMercadoGrupo[]).map((g) => (
                <li key={g.chave} className="flex justify-between font-body text-sm">
                  <span className="text-ink">
                    {g.nome} <span className="text-ink-soft">({formatarNumero(g.quantidade)})</span>
                  </span>
                  <span className="text-ink-soft">{formatarPercentual(g.distanciaMedia)} abaixo do mínimo</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null
      )}
      <ul className="mt-4 divide-y divide-ink-soft/10">
        {visiveis.map((l, i) => (
          <li key={`${l.licitacaoId}-${l.rotulo}-${i}`} className="py-2 font-body text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-ink">
                {l.numeroPregao} <span className="text-ink-soft">· {l.rotulo}</span>
              </span>
              <strong className="shrink-0" style={{ color: COR_ALERTA }}>
                {formatarPercentual(l.percentualAbaixo)} abaixo
              </strong>
            </div>
            <div className="text-xs text-ink-soft">
              Vencedor {formatarMoeda(l.valorVencedor)} · nosso mínimo c/ frete {formatarMoeda(l.valorMinimo)}
            </div>
          </li>
        ))}
      </ul>
      {dados.linhas.length > LIMITE_FORA_DE_MERCADO && (
        <p className="mt-2 font-body text-xs text-ink-soft">
          Mostrando os {LIMITE_FORA_DE_MERCADO} maiores de {formatarNumero(dados.linhas.length)}.
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Produtos e marcas
// ---------------------------------------------------------------------------
const LEITURA_FAMILIA: Record<NonNullable<TaxaFamilia['leitura']>, { texto: string; cor: string }> = {
  forte: { texto: 'Família forte: priorizar', cor: COR_GANHO },
  no_limite: { texto: 'Ganha no limite: rever preço mínimo', cor: COR_ALERTA },
  preco_alto: { texto: 'Preço alto demais: há espaço para reduzir', cor: COR_ALERTA },
  dificil: { texto: 'Mercado difícil: avaliar se vale disputar', cor: '#9B2C2C' },
}

function TaxaVitoriaFamiliaBloco({ dados }: { dados: TaxaVitoriaFamilia }) {
  if (dados.disputados === 0) return <SemDados texto="Nenhum item ou grupo ganho ou perdido nos filtros escolhidos." />
  return (
    <div>
      <p className="font-display text-4xl text-forest-deep">{formatarPercentual(dados.geral)}</p>
      <p className="font-body text-sm text-ink-soft">
        {formatarNumero(dados.ganhos)} {dados.ganhos === 1 ? 'ganho' : 'ganhos'} de {formatarNumero(dados.disputados)}{' '}
        {dados.disputados === 1 ? 'disputado' : 'disputados'}
      </p>
      <ul className="mt-4 space-y-3">
        {dados.porFamilia.map((f) => (
          <li key={f.chave} className="font-body text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-ink">{f.nome}</span>
              {f.amostraPequena ? (
                <strong className="shrink-0 text-ink">
                  {formatarNumero(f.ganhos)} de {formatarNumero(f.disputados)}
                </strong>
              ) : (
                <strong className="shrink-0 text-ink">{formatarPercentual(f.percentual)}</strong>
              )}
            </div>
            {!f.amostraPequena && (
              <div className="mt-1 h-2 rounded bg-forest-mist">
                <div
                  className="h-2 rounded"
                  style={{ width: `${Math.max(f.percentual ?? 0, f.ganhos > 0 ? 2 : 0)}%`, backgroundColor: COR_GANHO }}
                />
              </div>
            )}
            <p className="mt-1 text-xs text-ink-soft">
              {f.amostraPequena
                ? 'Menos de 5 disputados: amostra pequena'
                : `${formatarNumero(f.ganhos)} de ${formatarNumero(f.disputados)} por quantidade · ${formatarPercentual(f.percentualValor)} por valor`}
              {' · ganho sobre o mínimo: '}
              {f.ganhoSobreMinimo !== null ? formatarPercentual(f.ganhoSobreMinimo) : 'sem base'}
            </p>
            {f.leitura && (
              <p className="mt-0.5 text-xs font-semibold" style={{ color: LEITURA_FAMILIA[f.leitura].cor }}>
                {LEITURA_FAMILIA[f.leitura].texto}
              </p>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 font-body text-xs text-ink-soft">
        Leitura (referência interna): taxa alta = igual ou acima da taxa geral do período; ganho alto = acima de 3% sobre o mínimo.
      </p>
    </div>
  )
}

function MarcasBloco({ barras }: { barras: IndicadoresAdmin['marcas'] }) {
  if (barras.length === 0) return <SemDados texto="Nenhum item cotado pelo cliente nos filtros escolhidos." />
  return (
    <div>
      <BarrasDuplas
        dados={barras.map((b) => ({ nome: b.nome, cotadas: b.cotadas, ganhas: b.ganhas }))}
        chaveRotulo="nome"
        chaveTotal="cotadas"
        chaveGanho="ganhas"
        rotuloTotal="Cotadas"
        rotuloGanho="Ganhas"
      />
      <p className="mt-2 font-body text-xs text-ink-soft">
        Só itens avulsos: o resultado de um grupo é do grupo inteiro e não tem marca.
      </p>
    </div>
  )
}

const LIMITE_PRODUTOS_NUNCA_GANHOS = 10

function ProdutosNuncaGanhosBloco({ dados }: { dados: ProdutosNuncaGanhos }) {
  if (dados.totalProdutos === 0) {
    return (
      <SemDados texto="Nenhum produto identificado entre os itens ganhos ou perdidos (informe código, marca/modelo ou descrição na proposta)." />
    )
  }
  if (dados.quantidade === 0) {
    return <SemDados texto="Todos os produtos já disputados ganharam ao menos uma vez." />
  }
  return (
    <div>
      <p className="font-display text-4xl text-forest-deep">{formatarNumero(dados.quantidade)}</p>
      <p className="font-body text-sm text-ink-soft">
        de {formatarNumero(dados.totalProdutos)} {dados.totalProdutos === 1 ? 'produto disputado' : 'produtos disputados'}{' '}
        nunca ganharam
      </p>
      <ul className="mt-4 divide-y divide-ink-soft/10">
        {dados.linhas.slice(0, LIMITE_PRODUTOS_NUNCA_GANHOS).map((l) => (
          <li key={l.chave} className="flex items-baseline justify-between gap-3 py-2 font-body text-sm">
            <span className="text-ink">{l.nome}</span>
            <strong className="shrink-0" style={{ color: COR_ALERTA }}>
              {formatarNumero(l.perdas)} {l.perdas === 1 ? 'perda' : 'perdas'}
            </strong>
          </li>
        ))}
      </ul>
      {dados.quantidade > LIMITE_PRODUTOS_NUNCA_GANHOS && (
        <p className="mt-2 font-body text-xs text-ink-soft">
          Mostrando os {LIMITE_PRODUTOS_NUNCA_GANHOS} mais perdidos de {formatarNumero(dados.quantidade)}.
        </p>
      )}
      <p className="mt-2 font-body text-xs text-ink-soft">
        Só produtos já disputados (ganho ou perdido): produto ainda sem resultado não conta como derrota.
      </p>
    </div>
  )
}


// ---------------------------------------------------------------------------
// Pipeline — licitações por fase (uso interno)
// ---------------------------------------------------------------------------
function PipelineBloco({ dados }: { dados: Pipeline }) {
  if (dados.total === 0) return <SemDados />
  const maximo = Math.max(...dados.etapas.map((e) => e.quantidade), 1)
  return (
    <div>
      <ul className="space-y-3">
        {dados.etapas.map((etapa) => {
          const largura = etapa.quantidade === 0 ? 0 : Math.max((etapa.quantidade / maximo) * 100, 2)
          const finalizada = etapa.chave === 'finalizada'
          return (
            <li key={etapa.chave}>
              <div className="flex items-baseline justify-between gap-3 font-body text-sm">
                <span className="text-ink">{etapa.rotulo}</span>
                <span className="shrink-0 text-ink">
                  <strong>{formatarNumero(etapa.quantidade)}</strong>
                  {etapa.quantidade > 0 && (
                    <span className="ml-2 text-ink-soft">· ref. {FORMATO_COMPACTO.format(etapa.valorReferencia)}</span>
                  )}
                </span>
              </div>
              <div className="mt-1 h-4 rounded bg-forest-mist">
                <div
                  className="h-4 rounded"
                  style={{ width: `${largura}%`, backgroundColor: finalizada ? COR_GANHO : COR_REFERENCIA }}
                />
              </div>
              {finalizada && etapa.quantidade > 0 && (
                <p className="mt-1 font-body text-xs text-ink-soft">
                  {formatarNumero(etapa.ganhas ?? 0)} {(etapa.ganhas ?? 0) === 1 ? 'ganha' : 'ganhas'} ·{' '}
                  {formatarNumero(etapa.perdidas ?? 0)} {(etapa.perdidas ?? 0) === 1 ? 'perdida' : 'perdidas'}
                </p>
              )}
            </li>
          )
        })}
      </ul>
      {dados.resultadoALancar > 0 && (
        <p className="mt-4 rounded-lg bg-brass-pale px-3 py-2 font-body text-sm text-ink">
          <strong>{formatarNumero(dados.resultadoALancar)}</strong>{' '}
          {dados.resultadoALancar === 1 ? 'licitação em disputa com a sessão já realizada' : 'licitações em disputa com a sessão já realizada'}
          : falta lançar o resultado.
        </p>
      )}
      <p className="mt-3 font-body text-xs text-ink-soft">
        &quot;Aguardando o cliente&quot; inclui as licitações ainda em análise pela Salutti. Valores em reais (referência).
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Prazos dos próximos 7 dias (uso interno)
// ---------------------------------------------------------------------------
const LIMITE_PRAZOS = 10

const ROTULO_URGENCIA = {
  vencido: 'Prazo vencido',
  atencao: 'Vence em até 24 h',
  ok: 'No prazo',
} as const

const CLASSE_URGENCIA = {
  vencido: 'bg-red-50 text-red-700',
  atencao: 'bg-brass-pale text-ink',
  ok: 'bg-forest-mist text-forest-deep',
} as const

const ROTULO_DECISAO = {
  pendente: 'Cliente sem decisão',
  participar: 'Cliente vai participar',
  recusar: 'Cliente recusou',
} as const

function PrazosBloco({ dados }: { dados: PrazosProximos }) {
  if (dados.linhas.length === 0) {
    return <SemDados texto={`Nenhum prazo interno vencido ou vencendo nos próximos ${dados.janelaDias} dias.`} />
  }
  const visiveis = dados.linhas.slice(0, LIMITE_PRAZOS)
  return (
    <div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg bg-paper-2 px-2 py-3">
          <p className="font-display text-3xl text-red-700">{formatarNumero(dados.vencidos)}</p>
          <p className="font-body text-xs text-ink-soft">com prazo vencido</p>
        </div>
        <div className="rounded-lg bg-paper-2 px-2 py-3">
          <p className="font-display text-3xl text-ink">{formatarNumero(dados.vencendoEm24h)}</p>
          <p className="font-body text-xs text-ink-soft">vencem em até 24 h</p>
        </div>
        <div className="rounded-lg bg-paper-2 px-2 py-3">
          <p className="font-display text-3xl text-ink">{formatarNumero(dados.semDecisaoDoCliente)}</p>
          <p className="font-body text-xs text-ink-soft">sem decisão do cliente</p>
        </div>
      </div>
      <ul className="mt-4 divide-y divide-ink-soft/10">
        {visiveis.map((l) => (
          <li key={l.licitacaoId} className="py-2 font-body text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-ink">
                {l.numeroPregao} <span className="text-ink-soft">· {l.orgao}</span>
              </span>
              <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${CLASSE_URGENCIA[l.urgencia]}`}>
                {ROTULO_URGENCIA[l.urgencia]}
              </span>
            </div>
            <div className="text-xs text-ink-soft">
              {l.clienteNome} · prazo interno {formatarDataHora(l.prazoInterno)} · sessão {formatarDataHora(l.dataSessao)} ·{' '}
              {ROTULO_DECISAO[l.decisaoCliente]}
            </div>
          </li>
        ))}
      </ul>
      {dados.linhas.length > LIMITE_PRAZOS && (
        <p className="mt-2 font-body text-xs text-ink-soft">
          Mostrando os {LIMITE_PRAZOS} mais urgentes de {formatarNumero(dados.linhas.length)}.
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 8. Concorrentes
// ---------------------------------------------------------------------------
function formatarCnpjExibicao(cnpj: string): string {
  const d = cnpj.replace(/\D/g, '')
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : cnpj
}

function Concorrentes({ lista }: { lista: Concorrente[] }) {
  const [aberto, setAberto] = useState<string | null>(null)
  if (lista.length === 0) return <SemDados texto="Nenhum vencedor informado nos itens perdidos." />
  const maximo = Math.max(...lista.map((c) => c.vitorias), 1)
  return (
    <ol className="space-y-3">
      {lista.map((c, i) => {
        const chave = c.cnpj ?? c.nome
        const expandido = aberto === chave
        return (
          <li key={chave} className="font-body text-sm">
            <button
              type="button"
              onClick={() => setAberto(expandido ? null : chave)}
              aria-expanded={expandido}
              className="block w-full text-left"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-ink">
                  <span className="mr-2 font-mono text-xs text-ink-soft">{i + 1}.</span>
                  {c.nome}
                  {c.cnpj && <span className="ml-2 text-xs text-ink-soft">{formatarCnpjExibicao(c.cnpj)}</span>}
                </span>
                <span className="shrink-0 text-ink">
                  <strong>{formatarNumero(c.vitorias)}</strong> {c.vitorias === 1 ? 'item/grupo' : 'itens/grupos'} ·{' '}
                  {formatarNumero(c.licitacoes)} {c.licitacoes === 1 ? 'licitação' : 'licitações'} · {formatarMoeda(c.valorTotal)}
                </span>
              </div>
              <div className="mt-1 h-2 rounded bg-brass-pale/60">
                <div className="h-2 rounded" style={{ width: `${(c.vitorias / maximo) * 100}%`, backgroundColor: COR_ALERTA }} />
              </div>
              <p className="mt-1 text-xs text-ink-soft">
                {c.distanciaMedia !== null
                  ? `Fechou em média ${formatarPercentual(c.distanciaMedia)} abaixo do nosso preço`
                  : 'Sem nosso preço informado para medir a distância'}
                {' · '}
                {expandido ? 'ocultar famílias' : 'ver famílias em que vence'}
              </p>
            </button>
            {expandido && (
              <ul className="mt-2 space-y-0.5 rounded bg-forest-mist/60 p-2 text-xs text-ink">
                {c.familias.map((f) => (
                  <li key={f.nome} className="flex justify-between gap-3">
                    <span>{f.nome}</span>
                    <span className="text-ink-soft">
                      {formatarNumero(f.vitorias)} {f.vitorias === 1 ? 'vitória' : 'vitórias'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ol>
  )
}

// ---------------------------------------------------------------------------
// Gestão da carteira e da operação (lote 1)
// ---------------------------------------------------------------------------

function formatarDias(valor: number | null): string {
  if (valor === null) return '—'
  return `${formatarNumero(valor, 1)} ${valor === 1 ? 'dia útil' : 'dias úteis'}`
}

function Medida({ titulo, medida, nota }: { titulo: string; medida: { medianaDias: number | null; mediaDias: number | null; quantidade: number }; nota?: string }) {
  return (
    <div className="rounded bg-forest-mist p-3">
      <p className="font-mono text-[11px] uppercase tracking-wide text-ink-soft">{titulo}</p>
      <p className="mt-1 font-display text-3xl text-forest-deep">{formatarDias(medida.medianaDias)}</p>
      <p className="font-body text-xs text-ink-soft">
        mediana · média {formatarDias(medida.mediaDias)} · {formatarNumero(medida.quantidade)}{' '}
        {medida.quantidade === 1 ? 'licitação' : 'licitações'}
      </p>
      {nota && <p className="mt-1 font-body text-[11px] text-ink-soft">{nota}</p>}
    </div>
  )
}

function ListaTempos({ titulo, linhas }: { titulo: string; linhas: TempoResposta['porCliente'] }) {
  if (linhas.length === 0) return null
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-wide text-ink-soft">{titulo}</p>
      <ul className="mt-2 max-h-64 space-y-1 overflow-auto">
        {linhas.map((l) => (
          <li key={l.chave} className="flex justify-between gap-3 font-body text-sm">
            <span className="text-ink">
              {l.nome} <span className="text-ink-soft">({formatarNumero(l.quantidade)})</span>
            </span>
            <span className="shrink-0 text-ink">
              <strong>{formatarDias(l.medianaDias)}</strong> <span className="text-ink-soft">· média {formatarDias(l.mediaDias)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TempoRespostaBloco({ dados, mostrarAnalistas }: { dados: TempoResposta; mostrarAnalistas: boolean }) {
  const semEnvio = dados.envio.antecedencia.quantidade === 0
  if (dados.quantidade === 0 && semEnvio) {
    return <SemDados texto="Nenhuma licitação liberada ao cliente nos filtros escolhidos." />
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Medida titulo="Antecedência do envio" medida={dados.envio.antecedencia} nota="liberação → sessão" />
        <Medida titulo="Janela do cliente" medida={dados.envio.janelaCliente} nota="liberação → prazo do cliente (sessão − 3 dias úteis)" />
        <Medida
          titulo="Tempo de resposta"
          medida={{ medianaDias: dados.medianaDias, mediaDias: dados.mediaDias, quantidade: dados.quantidade }}
          nota={`liberação → decisão · ${formatarNumero(dados.aguardando)} aguardando`}
        />
      </div>
      {dados.envio.janelaCurta > 0 && (
        <p className="rounded bg-brass-pale/60 p-2 font-body text-xs text-ink">
          <strong>{formatarNumero(dados.envio.janelaCurta)}</strong>{' '}
          {dados.envio.janelaCurta === 1 ? 'licitação foi liberada' : 'licitações foram liberadas'} com menos de 2 dias úteis para o
          cliente decidir.
        </p>
      )}
      <p className="font-body text-sm text-ink">
        Liberações fora do prazo (Administrador reabriu depois do prazo do cliente):{' '}
        <strong>
          {dados.envio.reaberturasForaDoPrazo === null ? 'indisponível' : formatarNumero(dados.envio.reaberturasForaDoPrazo)}
        </strong>
      </p>
      <div className={`grid gap-6 ${mostrarAnalistas ? 'lg:grid-cols-2' : ''}`}>
        <ListaTempos titulo="Tempo de resposta por cliente (mais lentos primeiro)" linhas={dados.porCliente} />
        {mostrarAnalistas && <ListaTempos titulo="Tempo de resposta por analista (quem liberou)" linhas={dados.porAnalista} />}
      </div>
      <p className="font-body text-xs text-ink-soft">
        Tudo em dias úteis (segunda a sexta, sem considerar feriados). Mediana como número principal, média ao lado.
      </p>
    </div>
  )
}


const COR_NIVEL: Record<0 | 1 | 2 | 3, string> = {
  0: 'bg-forest-mist text-forest ring-forest/20',
  1: 'bg-brass-pale text-brass ring-brass/30',
  2: 'bg-orange-50 text-orange-800 ring-orange-200',
  3: 'bg-red-50 text-red-800 ring-red-200',
}

function dataCurta(iso?: string): string {
  return iso ? formatarDataHora(iso).slice(0, 10) : '—'
}

function ClientesSemAtividadeBloco({ dados }: { dados: ClientesSemAtividade }) {
  if (dados.linhas.length === 0) return <SemDados />
  const emAlerta = dados.linhas.filter((l) => l.situacao !== 'ok')
  const ativos = dados.linhas.length - emAlerta.length
  return (
    <div className="space-y-3">
      {emAlerta.length === 0 ? (
        <p className="font-body text-sm text-ink">Nenhum cliente parado: todos dentro das faixas.</p>
      ) : (
        <ul className="divide-y divide-ink-soft/10">
          {emAlerta.map((l) => {
            const def = SITUACAO_INATIVIDADE_LABEL[l.situacao]
            return (
              <li key={l.clienteId} className="py-2 font-body text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-ink">{l.nome}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    {l.valorAdjudicado > 0 && (
                      <span className="text-xs text-ink-soft">{formatarMoeda(l.valorAdjudicado)} adjudicado</span>
                    )}
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${COR_NIVEL[l.nivel]}`}>
                      {def.nome}
                      {l.diasDaSituacao !== null ? ` · ${formatarNumero(l.diasDaSituacao)} dias` : ' · nunca'}
                    </span>
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {def.significa}. <strong className="text-ink">{def.acao}.</strong> Último envio {dataCurta(l.ultimoEnvio)} · última
                  resposta {dataCurta(l.ultimaResposta)} · última participação {dataCurta(l.ultimaParticipacao)}
                </p>
              </li>
            )
          })}
        </ul>
      )}
      {ativos > 0 && (
        <p className="font-body text-xs text-ink-soft">
          {formatarNumero(ativos)} {ativos === 1 ? 'cliente ativo' : 'clientes ativos'} (dentro das faixas).
        </p>
      )}
      <p className="font-body text-xs text-ink-soft">
        Faixas (Configurações): {formatarNumero(dados.faixas.faixa1Dias)}, {formatarNumero(dados.faixas.faixa2Dias)} e{' '}
        {formatarNumero(dados.faixas.faixa3Dias)} dias, da mais leve para a mais grave. Ordem pelo risco: faixa mais grave primeiro e,
        dentro dela, maior valor adjudicado. Só os filtros de cliente e de analista valem aqui.
      </p>
    </div>
  )
}

/** Acima desse peso (%), o cliente é destacado como concentração da carteira. */
const LIMITE_CONCENTRACAO = 30

function FatiasBarras({ fatias, destacarAcimaDe }: { fatias: FatiaCarteira[]; destacarAcimaDe?: number }) {
  return (
    <ul className="space-y-2">
      {fatias.map((f) => (
        <li key={f.chave} className="font-body text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-ink">{f.nome}</span>
            <span className="shrink-0 text-ink-soft">
              {destacarAcimaDe !== undefined && f.percentual > destacarAcimaDe && f.chave !== 'outros' && (
                <strong className="mr-2" style={{ color: COR_ALERTA }}>
                  acima de {destacarAcimaDe}%
                </strong>
              )}
              {formatarPercentual(f.percentual)} · {formatarMoeda(f.valor)}
            </span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-forest-mist">
            <div
              className={`h-full rounded-full ${destacarAcimaDe !== undefined && f.percentual > destacarAcimaDe && f.chave !== 'outros' ? 'bg-brass' : 'bg-forest'}`}
              style={{ width: `${Math.min(100, Math.max(f.percentual, 0.5))}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

function ValorPorClienteBloco({ dados, segmentos }: { dados: ValorCliente[]; segmentos: FatiaCarteira[] }) {
  if (dados.length === 0) return <SemDados />
  return (
    <div>
    <div className="max-h-[28rem] overflow-auto">
      <table className="w-full min-w-[800px] font-body text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b border-ink-soft/15 text-left font-mono text-[11px] uppercase tracking-wide text-ink-soft">
            <th className="py-2 pr-3 font-semibold">Cliente</th>
            <th className="py-2 pr-3 text-right font-semibold">Peso na carteira</th>
            <th className="py-2 pr-3 text-right font-semibold">Enviadas</th>
            <th className="py-2 pr-3 text-right font-semibold">Participações</th>
            <th className="py-2 pr-3 text-right font-semibold">Taxa de vitória</th>
            <th className="py-2 pr-3 text-right font-semibold">Em disputa</th>
            <th className="py-2 pr-3 text-right font-semibold">Adjudicado</th>
            <th className="py-2 text-right font-semibold">Ganho s/ mínimo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-soft/10">
          {dados.map((c) => (
            <tr key={c.chave}>
              <td className="max-w-[220px] truncate py-2 pr-3 text-ink">{c.nome}</td>
              <td className="py-2 pr-3 text-right text-ink-soft">
                {formatarPercentual(c.pesoCarteira)}
                {c.pesoCarteira > LIMITE_CONCENTRACAO && (
                  <div className="text-xs font-semibold" style={{ color: COR_ALERTA }}>
                    acima de {LIMITE_CONCENTRACAO}%
                  </div>
                )}
              </td>
              <td className="py-2 pr-3 text-right text-ink-soft">{formatarNumero(c.enviadas)}</td>
              <td className="py-2 pr-3 text-right text-ink-soft">{formatarNumero(c.participacoes)}</td>
              <td className="py-2 pr-3 text-right text-ink-soft">{c.taxaVitoria !== null ? formatarPercentual(c.taxaVitoria) : '—'}</td>
              <td className="py-2 pr-3 text-right text-ink-soft">{formatarMoeda(c.valorEmDisputa)}</td>
              <td className="py-2 pr-3 text-right font-semibold text-forest">
                {formatarMoeda(c.valorAdjudicado)}
                <div className="text-xs font-normal text-ink-soft">{formatarNumero(c.licitacoesGanhas)} ganhas</div>
              </td>
              <td className="py-2 text-right text-ink-soft">{c.ganhoSobreMinimo !== null ? formatarPercentual(c.ganhoSobreMinimo) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 font-body text-xs text-ink-soft">
        Em disputa = valor de referência das licitações com participação confirmada e sem resultado. Adjudicado não é
        faturamento. Peso na carteira = valor de referência das licitações do cliente ÷ total do período.
      </p>
    </div>
    {segmentos.length > 0 && (
      <div className="mt-5">
        <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Por segmento</p>
        <FatiasBarras fatias={segmentos} />
      </div>
    )}
    </div>
  )
}

function ModalidadeBloco({ dados }: { dados: DesempenhoModalidade[] }) {
  if (dados.length === 0) return <SemDados />
  return (
    <div className="space-y-4">
      <BarrasDuplas
        dados={dados.map((m) => ({ modalidade: m.nome, participou: m.participou, ganhou: m.ganhou }))}
        chaveRotulo="modalidade"
        chaveTotal="participou"
        chaveGanho="ganhou"
        rotuloTotal="Participou"
        rotuloGanho="Com vitória"
      />
      <ul className="font-body text-sm text-ink-soft">
        {dados.map((m) => (
          <li key={m.chave}>
            <strong className="text-ink">{m.nome}:</strong> {formatarNumero(m.licitacoes)}{' '}
            {m.licitacoes === 1 ? 'licitação' : 'licitações'} · taxa de vitória {formatarPercentual(m.taxa)}
          </li>
        ))}
      </ul>
    </div>
  )
}

function UfEsferaBloco({ dados }: { dados: MercadoUfEsfera }) {
  if (dados.porUf.length === 0 && dados.porEsfera.length === 0) return <SemDados />
  const semEsfera = dados.porEsfera.find((e) => e.chave === FILTRO_SEM_ESFERA)
  const totalEsferas = dados.porEsfera.reduce((soma, e) => soma + e.licitacoes, 0)
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <h4 className="font-mono text-xs uppercase tracking-wide text-ink-soft">Por esfera</h4>
        <BarrasDuplas
          dados={dados.porEsfera.map((e) => ({ esfera: e.nome, participou: e.participou, ganhou: e.ganhou }))}
          chaveRotulo="esfera"
          chaveTotal="participou"
          chaveGanho="ganhou"
          rotuloTotal="Participou"
          rotuloGanho="Com vitória"
        />
        <ul className="font-body text-sm text-ink-soft">
          {dados.porEsfera.map((e) => (
            <li key={e.chave}>
              <strong className="text-ink">{e.nome}:</strong> {formatarNumero(e.licitacoes)}{' '}
              {e.licitacoes === 1 ? 'licitação' : 'licitações'} · taxa de vitória {formatarPercentual(e.taxa)}
            </li>
          ))}
        </ul>
        {semEsfera && (
          <p className="rounded-lg bg-paper-2/60 px-3 py-2 font-body text-xs text-ink-soft">
            {formatarNumero(semEsfera.licitacoes)} de {formatarNumero(totalEsferas)}{' '}
            {totalEsferas === 1 ? 'licitação está' : 'licitações estão'} sem esfera informada. A esfera é
            opcional e escolhida no cadastro da licitação.
          </p>
        )}
      </div>
      <div className="space-y-3">
        <h4 className="font-mono text-xs uppercase tracking-wide text-ink-soft">Por UF (10 com mais licitações)</h4>
        <BarrasDuplas
          dados={dados.porUf.map((u) => ({ uf: u.nome, participou: u.participou, ganhou: u.ganhou }))}
          chaveRotulo="uf"
          chaveTotal="participou"
          chaveGanho="ganhou"
          rotuloTotal="Participou"
          rotuloGanho="Com vitória"
        />
        <ul className="font-body text-sm text-ink-soft">
          {dados.porUf.map((u) => (
            <li key={u.chave}>
              <strong className="text-ink">{u.nome}:</strong> {formatarNumero(u.licitacoes)}{' '}
              {u.licitacoes === 1 ? 'licitação' : 'licitações'} · taxa de vitória {formatarPercentual(u.taxa)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function MotivosNaoParticipacaoBloco({ dados }: { dados: MotivosNaoParticipacao }) {
  if (dados.total === 0) return <SemDados texto="Nenhuma licitação sem participação nos filtros escolhidos." />
  const maximo = Math.max(...dados.motivos.map((m) => m.quantidade), 1)
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-3">
        <p className="font-body text-sm text-ink">
          <strong>{formatarNumero(dados.total)}</strong>{' '}
          {dados.total === 1 ? 'licitação sem participação do cliente' : 'licitações sem participação do cliente'} ·{' '}
          <strong>{formatarMoeda(dados.valorReferenciaDescartado)}</strong> em valor de referência descartado
        </p>
        {dados.semResposta.quantidade > 0 && (
          <p className="rounded bg-brass-pale/60 p-2 font-body text-xs text-ink">
            <strong>Falha de processo:</strong> {formatarNumero(dados.semResposta.quantidade)} sem resposta do cliente (
            {formatarPercentual(dados.semResposta.percentual)}), somando {formatarMoeda(dados.semResposta.valorReferencia)} em valor de
            referência. Não é decisão do cliente: é oportunidade parada.
          </p>
        )}
        <ul className="space-y-3">
          {dados.motivos.map((m) => (
            <li key={m.chave}>
              <div className="flex items-baseline justify-between gap-3 font-body text-sm">
                <span className="text-ink">{m.nome}</span>
                <span className="shrink-0 text-ink">
                  <strong>{formatarNumero(m.quantidade)}</strong>
                  <span className="ml-2 text-ink-soft">({formatarPercentual(m.percentual)})</span>
                </span>
              </div>
              <div className="mt-1 h-3 rounded bg-forest-mist">
                <div
                  className="h-3 rounded"
                  style={{
                    width: `${Math.max((m.quantidade / maximo) * 100, 2)}%`,
                    backgroundColor: m.origem === 'cliente' ? COR_GANHO : COR_REFERENCIA,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
        {dados.percentualOutro !== null && dados.percentualOutro > 15 && (
          <p className="rounded bg-brass-pale/60 p-2 font-body text-xs text-ink">
            "Outro" é {formatarPercentual(dados.percentualOutro)} das recusas (acima de 15%): sinal de que falta um motivo na lista.
          </p>
        )}
        {dados.percentualTriagem !== null && dados.percentualTriagem >= 30 && (
          <p className="rounded bg-brass-pale/60 p-2 font-body text-xs text-ink">
            "Produto não trabalhado" e "especificação não atendida" somam {formatarPercentual(dados.percentualTriagem)} das recusas:
            indício de falha na triagem da Salutti (referência interna: a partir de 30%).
          </p>
        )}
        {dados.textosOutro.length > 0 && (
          <div>
            <h4 className="font-mono text-xs uppercase tracking-wide text-ink-soft">Textos de "Outro"</h4>
            <ul className="mt-1 space-y-1 font-body text-xs text-ink">
              {dados.textosOutro.map((t) => (
                <li key={t.licitacaoId}>
                  <span className="text-ink-soft">
                    {t.numeroPregao} · {t.cliente}:
                  </span>{' '}
                  {t.texto}
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="flex flex-wrap gap-x-4 gap-y-1 font-body text-xs text-ink-soft">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COR_GANHO }} />
            Escolhido pelo cliente
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COR_REFERENCIA }} />
            Registrado pelo sistema
          </span>
        </p>
      </div>
      <div className="space-y-3">
        <h4 className="font-mono text-xs uppercase tracking-wide text-ink-soft">Por grupo de motivo</h4>
        <ul className="space-y-1.5 font-body text-sm text-ink-soft">
          {dados.porGrupo.map((g) => (
            <li key={g.grupo} className="flex items-baseline justify-between gap-3">
              <strong className="font-semibold text-ink">{g.nome}</strong>
              <span>
                {formatarNumero(g.quantidade)} ({formatarPercentual(g.percentual)})
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Painel completo
// ---------------------------------------------------------------------------
/** Chaves dos indicadores (as mesmas da liberação — migrações 037, 042, 043 e 044). */
export type ChaveIndicador =
  | 'funil'
  | 'taxa_vitoria'
  | 'volume_periodo'
  | 'familias'
  | 'ganho_sobre_minimo'
  | 'perdas_evitaveis'
  | 'performance_analista'
  | 'perdas_habilitacao'
  | 'vitorias_convocacao'
  | 'alerta_acompanhamento'
  | 'orgaos'
  | 'concorrentes'
  | 'valor_adjudicado'
  | 'ticket_medio'
  | 'desconto_medio'
  | 'fora_de_mercado'
  | 'distancia_derrota'
  | 'pipeline'
  | 'prazos_proximos'
  | 'taxa_vitoria_familia'
  | 'marcas'
  | 'produtos_nunca_ganhos'
  | 'tempo_resposta'
  | 'clientes_sem_atividade'
  | 'valor_por_cliente'
  | 'desempenho_modalidade'
  | 'mercado_uf_esfera'
  | 'motivos_nao_participacao'

interface IndicadoresGraficosProps {
  indicadores: IndicadoresAdmin
  /** Indicadores que o perfil pode ver. Sem esta propriedade, mostra todos
   *  (Administrador). */
  visiveis?: ReadonlySet<string>
  /** Esconde os cards sem dados (usado quando há filtro ativo). */
  ocultarVazios?: boolean
}

export function IndicadoresGraficos({ indicadores, visiveis, ocultarVazios = false }: IndicadoresGraficosProps) {
  const ver = (chave: ChaveIndicador) => !visiveis || visiveis.has(chave)

  if (visiveis && visiveis.size === 0) {
    return (
      <p className="rounded-xl border border-ink-soft/15 bg-white p-8 text-center font-body text-sm text-ink-soft shadow-soft">
        Nenhum indicador foi liberado para o seu perfil. Fale com o administrador.
      </p>
    )
  }

  return (
    <OcultarVaziosContexto.Provider value={ocultarVazios}>
    <div className="grid grid-flow-dense gap-5 lg:grid-cols-2">
      {/* Os três indicadores principais vêm primeiro, para todos os perfis. */}
      {ver('funil') && (
        <Cartao titulo="Relatório principal" subtitulo="Total de licitações do período: enviadas, retornadas, disputadas e resultado (por licitação)">
          <RelatorioPrincipalBloco dados={indicadores.relatorioPrincipal} />
        </Cartao>
      )}

      {ver('taxa_vitoria') && (
        <Cartao titulo="Taxa de vitória" subtitulo="Contagem por item: só itens e grupos ganhos ou perdidos">
          <TaxaVitoriaBloco atual={indicadores.taxaVitoria.atual} meses={indicadores.taxaVitoriaPorMes} />
        </Cartao>
      )}

      {ver('volume_periodo') && (
        <Cartao titulo="Volume por mês" subtitulo="Licitações por mês da sessão (passe o mouse para ver o valor)" className="lg:col-span-2">
          <VolumeMensal dados={indicadores.volumePorMes} />
        </Cartao>
      )}

      {ver('pipeline') && (
        <Cartao titulo="Pipeline" subtitulo="Licitações por fase, da decisão do cliente ao resultado">
          <PipelineBloco dados={indicadores.pipeline} />
        </Cartao>
      )}

      {ver('prazos_proximos') && (
        <Cartao
          titulo="Prazos dos próximos 7 dias"
          subtitulo="Licitações em aberto com prazo interno vencido ou vencendo (ignora o filtro de período)"
        >
          <PrazosBloco dados={indicadores.prazosProximos} />
        </Cartao>
      )}


      {ver('tempo_resposta') && (
        <Cartao
          titulo="Tempos de envio e de resposta"
          subtitulo="Com quanta antecedência a Salutti libera a licitação e quanto o cliente demora a responder (dias úteis)"
          className="lg:col-span-2"
        >
          <TempoRespostaBloco dados={indicadores.tempoResposta} mostrarAnalistas={!visiveis} />
        </Cartao>
      )}

      {ver('clientes_sem_atividade') && (
        <Cartao titulo="Clientes sem atividade" subtitulo="Risco de perder o cliente: do mais parado para o mais ativo">
          <ClientesSemAtividadeBloco dados={indicadores.clientesSemAtividade} />
        </Cartao>
      )}

      {ver('valor_por_cliente') && (
        <Cartao titulo="Valor por cliente" subtitulo="Valor em disputa, valor adjudicado e peso na carteira (todos os clientes, do maior valor adjudicado para o menor)">
          <ValorPorClienteBloco dados={indicadores.valorPorCliente} segmentos={indicadores.concentracaoCarteira.porSegmento} />
        </Cartao>
      )}

      {ver('performance_analista') && indicadores.performanceAnalistas.length > 0 && (
        <Cartao
          titulo="Performance por analista"
          subtitulo="Resultado da carteira de cada analista, dentro dos filtros escolhidos (uso interno)"
          className="lg:col-span-2"
        >
          <PerformanceAnalistasBloco dados={indicadores.performanceAnalistas} />
        </Cartao>
      )}

      {ver('desempenho_modalidade') && (
        <Cartao titulo="Desempenho por modalidade" subtitulo="Participações x licitações com vitória">
          <ModalidadeBloco dados={indicadores.desempenhoModalidade} />
        </Cartao>
      )}

      {ver('mercado_uf_esfera') && (
        <Cartao
          titulo="Mercado por UF e por esfera"
          subtitulo="Participações x licitações com vitória, por estado e por esfera do órgão"
          className="lg:col-span-2"
        >
          <UfEsferaBloco dados={indicadores.mercadoUfEsfera} />
        </Cartao>
      )}

      {ver('motivos_nao_participacao') && (
        <Cartao
          titulo="Motivos de não participação"
          subtitulo="Por que o cliente não participou: recusas com motivo escolhido e licitações sem resposta"
          className="lg:col-span-2"
        >
          <MotivosNaoParticipacaoBloco dados={indicadores.motivosNaoParticipacao} />
        </Cartao>
      )}

      {ver('familias') && (
        <Cartao titulo="Famílias de produtos" subtitulo="Itens cotados x itens ganhos (10 maiores)">
          <Familias barras={indicadores.familias} />
        </Cartao>
      )}

      {ver('ganho_sobre_minimo') && (
        <Cartao titulo="Ganho sobre o mínimo" subtitulo="Quanto vendemos acima do mínimo do cliente">
          <GanhoSobreMinimoBloco dados={indicadores.ganhoSobreMinimo} />
        </Cartao>
      )}

      {ver('taxa_vitoria_familia') && (
        <Cartao titulo="Taxa de vitória por família" subtitulo="Ganhos ÷ disputados, por quantidade (10 mais disputadas)">
          <TaxaVitoriaFamiliaBloco dados={indicadores.taxaVitoriaFamilia} />
        </Cartao>
      )}

      {ver('marcas') && (
        <Cartao titulo="Marcas" subtitulo="Itens cotados x itens ganhos por marca (10 maiores; inclui as marcas de cestas e kits)">
          <MarcasBloco barras={indicadores.marcas} />
        </Cartao>
      )}

      {ver('perdas_evitaveis') && (
        <Cartao
          titulo="Perdas evitáveis"
          subtitulo="Perdemos para um vencedor cujo preço ainda cobria o mínimo do cliente"
          className="lg:col-span-2"
        >
          <PerdasEvitaveisBloco dados={indicadores.perdasEvitaveis} />
        </Cartao>
      )}

      {ver('perdas_habilitacao') && (
        <Cartao
          titulo="Perdas na habilitação"
          subtitulo="Ganhamos no lance, mas perdemos na aceitação ou na habilitação: valor, motivo e origem"
          className="lg:col-span-2"
        >
          <PerdasHabilitacaoBloco dados={indicadores.perdasHabilitacao} />
        </Cartao>
      )}

      {ver('vitorias_convocacao') && (
        <Cartao titulo="Vitórias por convocação" subtitulo="Ganhamos porque concorrentes foram desclassificados">
          <VitoriasConvocacaoBloco dados={indicadores.vitoriasConvocacao} />
        </Cartao>
      )}

      {ver('alerta_acompanhamento') && (
        <Cartao
          titulo="Alerta de acompanhamento"
          subtitulo="Perdidas em análise com o cliente em 2º ou 3º lugar: pode haver convocação se o 1º for desclassificado"
        >
          <AlertaAcompanhamentoBloco dados={indicadores.alertaAcompanhamento} />
        </Cartao>
      )}

      {ver('valor_adjudicado') && (
        <Cartao
          titulo="Valor adjudicado por mês"
          subtitulo="Valor dos itens e grupos ganhos, pelo mês da sessão"
          className="lg:col-span-2"
        >
          <ValorAdjudicadoBloco dados={indicadores.valorAdjudicado} />
        </Cartao>
      )}

      {ver('ticket_medio') && (
        <Cartao titulo="Ticket médio" subtitulo="Valor adjudicado por licitação ganha (ao menos 1 item ganho)">
          <TicketMedioBloco dados={indicadores.valorAdjudicado} />
        </Cartao>
      )}

      {ver('desconto_medio') && (
        <Cartao titulo="Desconto médio sobre a referência" subtitulo="Quanto ganhamos abaixo do valor de referência do edital">
          <PercentualPorFamiliaBloco
            dados={indicadores.descontoMedio}
            textoGeral={(g) =>
              g < 0 ? 'acima do valor de referência, em média, nos itens ganhos' : 'abaixo do valor de referência, em média, nos itens ganhos'
            }
            semDados="Nenhum item ganho com valor de referência informado."
          />
        </Cartao>
      )}

      {ver('fora_de_mercado') && (
        <Cartao titulo="Fora de mercado" subtitulo="Perdemos para um vencedor com preço abaixo do mínimo do cliente">
          <ForaDeMercadoBloco dados={indicadores.foraDeMercado} />
        </Cartao>
      )}

      {ver('distancia_derrota') && (
        <Cartao titulo="Distância da derrota" subtitulo="Nas perdas por preço, quanto ficamos acima do vencedor">
          <DistanciaDerrotaBloco dados={indicadores.distanciaDerrota} />
        </Cartao>
      )}

      {ver('orgaos') && (
        <Cartao titulo="Órgãos" subtitulo="Participações x licitações com vitória (10 maiores)">
          <Orgaos barras={indicadores.orgaos} />
        </Cartao>
      )}

      {ver('concorrentes') && (
        <Cartao titulo="Concorrentes que mais vencem" subtitulo="Quem ganhou de nós (10 maiores)">
          <Concorrentes lista={indicadores.concorrentes} />
        </Cartao>
      )}

      {ver('produtos_nunca_ganhos') && (
        <Cartao titulo="Produtos nunca ganhos" subtitulo="Produtos disputados sem nenhuma vitória (revisão de portfólio)">
          <ProdutosNuncaGanhosBloco dados={indicadores.produtosNuncaGanhos} />
        </Cartao>
      )}

    </div>
    </OcultarVaziosContexto.Provider>
  )
}
