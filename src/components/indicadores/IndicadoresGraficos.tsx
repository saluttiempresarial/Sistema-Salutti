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

import type { ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type {
  Aproveitamento,
  ClientesSemAtividade,
  ConcentracaoCarteira,
  DesempenhoModalidade,
  FatiaCarteira,
  TempoResposta,
  ValorCliente,
  BarraFamilia,
  BarraOrgao,
  Concorrente,
  ConcorrentesFamilia,
  ForaDeMercado,
  IndicadoresAdmin,
  IndicadorPercentual,
  Pipeline,
  PrazosProximos,
  ProdutosNuncaGanhos,
  TaxaVitoria,
  TaxaVitoriaFamilia,
  ValorAdjudicado,
} from '../../types/indicadores'
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
  return (
    <section className={`rounded-xl border border-ink-soft/15 bg-white p-5 shadow-soft ${className}`}>
      <h3 className="font-display text-lg text-ink">{titulo}</h3>
      {subtitulo && <p className="mt-0.5 font-body text-sm text-ink-soft">{subtitulo}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function SemDados({ texto = 'Sem dados para os filtros escolhidos.' }: { texto?: string }) {
  return <p className="py-8 text-center font-body text-sm text-ink-soft">{texto}</p>
}

// ---------------------------------------------------------------------------
// 1. Funil
// ---------------------------------------------------------------------------
function Funil({ etapas }: { etapas: IndicadoresAdmin['funil'] }) {
  const maximo = Math.max(...etapas.map((e) => e.quantidade), 0)
  if (maximo === 0) return <SemDados />
  return (
    <ol className="space-y-3">
      {etapas.map((etapa, i) => {
        const largura = Math.max((etapa.quantidade / maximo) * 100, 2)
        const anterior = i > 0 ? etapas[i - 1].quantidade : 0
        const conversao = i > 0 && anterior > 0 ? (etapa.quantidade / anterior) * 100 : null
        return (
          <li key={etapa.chave}>
            <div className="flex items-baseline justify-between font-body text-sm">
              <span className="text-ink">{etapa.rotulo}</span>
              <span className="text-ink">
                <strong>{formatarNumero(etapa.quantidade)}</strong>
                {conversao !== null && (
                  <span className="ml-2 text-ink-soft">({formatarPercentual(conversao)} da etapa anterior)</span>
                )}
              </span>
            </div>
            <div className="mt-1 h-6 rounded bg-forest-mist">
              <div
                className="h-6 rounded"
                style={{ width: `${largura}%`, backgroundColor: i === etapas.length - 1 ? COR_GANHO : COR_REFERENCIA }}
              />
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// ---------------------------------------------------------------------------
// 2. Taxa de vitória
// ---------------------------------------------------------------------------
function VariacaoPeriodo({ atual, anterior }: { atual: number | null; anterior: number | null }) {
  if (atual === null || anterior === null) {
    return <p className="mt-2 font-body text-xs text-ink-soft">Sem período anterior para comparar.</p>
  }
  const diferenca = atual - anterior
  const sinal = diferenca > 0 ? '▲' : diferenca < 0 ? '▼' : '='
  const cor = diferenca > 0 ? 'text-forest' : diferenca < 0 ? 'text-red-700' : 'text-ink-soft'
  return (
    <p className={`mt-2 font-body text-sm ${cor}`}>
      {sinal} {formatarNumero(Math.abs(diferenca), 1)} p.p. vs. período anterior ({formatarPercentual(anterior)})
    </p>
  )
}

function CartaoTaxa({
  titulo,
  principal,
  detalhe,
  anterior,
}: {
  titulo: string
  principal: number | null
  detalhe: string
  anterior: number | null
}) {
  return (
    <div className="rounded-lg bg-forest-mist/60 p-4">
      <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">{titulo}</p>
      <p className="mt-1 font-display text-4xl text-forest-deep">{formatarPercentual(principal)}</p>
      <p className="mt-1 font-body text-sm text-ink-soft">{detalhe}</p>
      <VariacaoPeriodo atual={principal} anterior={anterior} />
    </div>
  )
}

function TaxaVitoriaBloco({ atual, anterior }: { atual: TaxaVitoria; anterior: TaxaVitoria | null }) {
  if (atual.ganhos + atual.perdidos === 0) return <SemDados texto="Nenhum item ganho ou perdido nos filtros escolhidos." />
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <CartaoTaxa
        titulo="Por quantidade"
        principal={atual.percentualQuantidade}
        detalhe={`${formatarNumero(atual.ganhos)} ganhos de ${formatarNumero(atual.ganhos + atual.perdidos)} disputados`}
        anterior={anterior?.percentualQuantidade ?? null}
      />
      <CartaoTaxa
        titulo="Por valor"
        principal={atual.percentualValor}
        detalhe={`${formatarMoeda(atual.valorAdjudicado)} de ${formatarMoeda(atual.valorDisputado)}`}
        anterior={anterior?.percentualValor ?? null}
      />
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
  return (
    <BarrasDuplas
      dados={barras.map((b) => ({ orgao: b.orgao, participacoes: b.participacoes, vitorias: b.vitorias }))}
      chaveRotulo="orgao"
      chaveTotal="participacoes"
      chaveGanho="vitorias"
      rotuloTotal="Participações"
      rotuloGanho="Com vitória"
    />
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
      <p className="font-body text-sm text-ink-soft">acima do mínimo com frete, em média, nos itens ganhos</p>
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
              <th className="py-2 text-right font-normal">Mínimo c/ frete</th>
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
                <td className="py-2 text-right text-ink">{formatarMoeda(l.valorMinimo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 font-body text-sm text-ink">
        Total que teria sido adjudicado com um lance até o valor do vencedor:{' '}
        <strong style={{ color: COR_ALERTA }}>{formatarMoeda(dados.totalVencedor)}</strong>
      </p>
    </div>
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
              formatter={(valor) => [formatarMoeda(Number(valor)), 'Valor adjudicado']}
              labelFormatter={(rotulo, itens) => {
                const ganhas = (itens?.[0]?.payload as { licitacoesGanhas?: number } | undefined)?.licitacoesGanhas ?? 0
                return `${rotulo} — ${formatarNumero(ganhas)} ${ganhas === 1 ? 'licitação ganha' : 'licitações ganhas'}`
              }}
            />
            <Bar dataKey="valor" name="Valor adjudicado" fill={COR_GANHO} radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 font-body text-xs text-ink-soft">{NOTA_ADJUDICADO}</p>
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
function TaxaVitoriaFamiliaBloco({ dados }: { dados: TaxaVitoriaFamilia }) {
  if (dados.disputados === 0) return <SemDados texto="Nenhum item ou grupo ganho ou perdido nos filtros escolhidos." />
  return (
    <div>
      <p className="font-display text-4xl text-forest-deep">{formatarPercentual(dados.geral)}</p>
      <p className="font-body text-sm text-ink-soft">
        {formatarNumero(dados.ganhos)} {dados.ganhos === 1 ? 'ganho' : 'ganhos'} de {formatarNumero(dados.disputados)}{' '}
        {dados.disputados === 1 ? 'disputado' : 'disputados'}
      </p>
      <ul className="mt-4 space-y-2">
        {dados.porFamilia.map((f) => (
          <li key={f.chave} className="font-body text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-ink">
                {f.nome}{' '}
                <span className="text-ink-soft">
                  ({formatarNumero(f.ganhos)} de {formatarNumero(f.disputados)})
                </span>
              </span>
              <strong className="shrink-0 text-ink">{formatarPercentual(f.percentual)}</strong>
            </div>
            <div className="mt-1 h-2 rounded bg-forest-mist">
              <div
                className="h-2 rounded"
                style={{ width: `${Math.max(f.percentual ?? 0, f.ganhos > 0 ? 2 : 0)}%`, backgroundColor: COR_GANHO }}
              />
            </div>
          </li>
        ))}
      </ul>
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

function ConcorrentesFamiliaBloco({ dados }: { dados: ConcorrentesFamilia[] }) {
  if (dados.length === 0) return <SemDados texto="Nenhum vencedor informado nos itens perdidos." />
  return (
    <ul className="space-y-4">
      {dados.map((f) => (
        <li key={f.chave} className="font-body text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <strong className="text-ink">{f.nome}</strong>
            <span className="shrink-0 text-xs text-ink-soft">
              {formatarNumero(f.perdas)} {f.perdas === 1 ? 'perda' : 'perdas'}
            </span>
          </div>
          <ol className="mt-1 space-y-0.5">
            {f.concorrentes.map((c, i) => (
              <li key={c.nome} className="flex items-baseline justify-between gap-3 text-ink">
                <span>
                  <span className="mr-2 font-mono text-xs text-ink-soft">{i + 1}.</span>
                  {c.nome}
                </span>
                <span className="shrink-0 text-ink-soft">
                  {formatarNumero(c.vitorias)} {c.vitorias === 1 ? 'vitória' : 'vitórias'}
                </span>
              </li>
            ))}
          </ol>
        </li>
      ))}
    </ul>
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
function Concorrentes({ lista }: { lista: Concorrente[] }) {
  if (lista.length === 0) return <SemDados texto="Nenhum vencedor informado nos itens perdidos." />
  const maximo = Math.max(...lista.map((c) => c.vitorias), 1)
  return (
    <ol className="space-y-3">
      {lista.map((c, i) => (
        <li key={c.nome} className="font-body text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-ink">
              <span className="mr-2 font-mono text-xs text-ink-soft">{i + 1}.</span>
              {c.nome}
            </span>
            <span className="shrink-0 text-ink">
              <strong>{formatarNumero(c.vitorias)}</strong> {c.vitorias === 1 ? 'vitória' : 'vitórias'} ·{' '}
              {formatarMoeda(c.valorTotal)}
            </span>
          </div>
          <div className="mt-1 h-2 rounded bg-brass-pale/60">
            <div className="h-2 rounded" style={{ width: `${(c.vitorias / maximo) * 100}%`, backgroundColor: COR_ALERTA }} />
          </div>
        </li>
      ))}
    </ol>
  )
}

// ---------------------------------------------------------------------------
// Gestão da carteira e da operação (lote 1)
// ---------------------------------------------------------------------------
function AproveitamentoBloco({ dados }: { dados: Aproveitamento }) {
  if (dados.analisadas === 0) return <SemDados />
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <div>
          <p className="font-display text-4xl text-forest">{formatarPercentual(dados.percentual)}</p>
          <p className="font-body text-sm text-ink-soft">das licitações analisadas tiveram participação confirmada</p>
        </div>
        <ul className="font-body text-sm text-ink-soft">
          <li><strong className="text-ink">{formatarNumero(dados.analisadas)}</strong> analisadas</li>
          <li><strong className="text-ink">{formatarNumero(dados.participou)}</strong> participou</li>
          <li><strong className="text-ink">{formatarNumero(dados.recusou)}</strong> recusou</li>
          <li><strong className="text-ink">{formatarNumero(dados.semDecisao)}</strong> sem decisão</li>
        </ul>
      </div>
      {dados.porCliente.length > 1 && (
        <BarrasDuplas
          dados={dados.porCliente.map((c) => ({ cliente: c.nome, analisadas: c.analisadas, participou: c.participou }))}
          chaveRotulo="cliente"
          chaveTotal="analisadas"
          chaveGanho="participou"
          rotuloTotal="Analisadas"
          rotuloGanho="Participou"
        />
      )}
    </div>
  )
}

function formatarDias(valor: number | null): string {
  if (valor === null) return '—'
  return `${formatarNumero(valor, 1)} ${valor === 1 ? 'dia' : 'dias'}`
}

function TempoRespostaBloco({ dados }: { dados: TempoResposta }) {
  if (dados.quantidade === 0) {
    return (
      <SemDados
        texto={
          dados.aguardando > 0
            ? `Nenhuma decisão registrada ainda. ${formatarNumero(dados.aguardando)} aguardando o cliente.`
            : undefined
        }
      />
    )
  }
  const altura = Math.max(dados.porCliente.length * 40 + 40, 120)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
        <div>
          <p className="font-display text-4xl text-forest">{formatarDias(dados.mediaDias)}</p>
          <p className="font-body text-sm text-ink-soft">em média, do cadastro à decisão</p>
        </div>
        <div>
          <p className="font-display text-2xl text-ink">{formatarDias(dados.medianaDias)}</p>
          <p className="font-body text-sm text-ink-soft">mediana (metade decide mais rápido)</p>
        </div>
        <p className="font-body text-sm text-ink-soft">
          {formatarNumero(dados.quantidade)} {dados.quantidade === 1 ? 'decisão' : 'decisões'} · {formatarNumero(dados.aguardando)} aguardando
        </p>
      </div>
      {dados.porCliente.length > 1 && (
        <div style={{ height: altura }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados.porCliente} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke={COR_GRADE} />
              <XAxis type="number" tick={{ fill: COR_TEXTO, fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="nome"
                width={190}
                tick={{ fill: COR_TEXTO, fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: string) => (v.length > 30 ? `${v.slice(0, 29)}…` : v)}
              />
              <Tooltip contentStyle={ESTILO_DICA} cursor={{ fill: '#E7F0EA' }} formatter={(v) => [formatarDias(Number(v)), 'Média']} />
              <Bar dataKey="mediaDias" name="Média em dias" fill={COR_ALERTA} radius={[0, 4, 4, 0]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

/** Faixas de alerta da última atividade do cliente. */
function faixaAtividade(dias: number): { rotulo: string; classe: string } {
  if (dias >= 90) return { rotulo: `${formatarNumero(dias)} dias`, classe: 'bg-red-50 text-red-800 ring-red-200' }
  if (dias >= 30) return { rotulo: `${formatarNumero(dias)} dias`, classe: 'bg-brass-pale text-brass ring-brass/30' }
  return { rotulo: dias === 0 ? 'hoje' : `${formatarNumero(dias)} ${dias === 1 ? 'dia' : 'dias'}`, classe: 'bg-forest-mist text-forest ring-forest/20' }
}

function ClientesSemAtividadeBloco({ dados }: { dados: ClientesSemAtividade }) {
  // Do mais parado para o mais ativo; quem nunca teve licitação vai para o fim.
  const comLicitacao = dados.linhas.filter((l) => l.dias !== null)
  const semLicitacao = dados.linhas.filter((l) => l.dias === null)
  const mostradas = comLicitacao.slice(0, 10)

  if (dados.linhas.length === 0) return <SemDados />

  return (
    <div className="space-y-3">
      {mostradas.length > 0 && (
        <ul className="divide-y divide-ink-soft/10">
          {mostradas.map((l) => {
            const faixa = faixaAtividade(l.dias ?? 0)
            return (
              <li key={l.clienteId} className="flex items-center justify-between gap-3 py-2 font-body text-sm">
                <span className="min-w-0 truncate text-ink">{l.nome}</span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-ink-soft">
                    última atividade em {l.ultimaAtividade ? formatarDataHora(l.ultimaAtividade).slice(0, 10) : '—'}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${faixa.classe}`}>
                    {faixa.rotulo}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {comLicitacao.length > mostradas.length && (
        <p className="font-body text-xs text-ink-soft">e mais {formatarNumero(comLicitacao.length - mostradas.length)} clientes.</p>
      )}

      {semLicitacao.length > 0 && (
        <div className="border-t border-ink-soft/10 pt-3">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
            Sem nenhuma licitação cadastrada ({formatarNumero(semLicitacao.length)})
          </p>
          <p className="mt-1 font-body text-sm text-ink">{semLicitacao.map((l) => l.nome).join(' · ')}</p>
        </div>
      )}

      <p className="font-body text-xs text-ink-soft">
        Dias desde o último cadastro de licitação ou decisão do cliente. Verde: menos de 30 dias · dourado: 30 a 89 · vermelho: 90 ou mais.
        Este quadro ignora os filtros.
      </p>
    </div>
  )
}

function FatiasBarras({ fatias }: { fatias: FatiaCarteira[] }) {
  return (
    <ul className="space-y-2">
      {fatias.map((f) => (
        <li key={f.chave} className="font-body text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-ink">{f.nome}</span>
            <span className="shrink-0 text-ink-soft">
              {formatarPercentual(f.percentual)} · {formatarMoeda(f.valor)}
            </span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-forest-mist">
            <div
              className="h-full rounded-full bg-forest"
              style={{ width: `${Math.min(100, Math.max(f.percentual, 0.5))}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

function ConcentracaoBloco({ dados }: { dados: ConcentracaoCarteira }) {
  if (dados.total <= 0) return <SemDados />
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Por cliente</p>
        <FatiasBarras fatias={dados.porCliente} />
      </div>
      <div>
        <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Por segmento</p>
        <FatiasBarras fatias={dados.porSegmento} />
      </div>
    </div>
  )
}

function ValorPorClienteBloco({ dados }: { dados: ValorCliente[] }) {
  if (dados.length === 0) return <SemDados />
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] font-body text-sm">
        <thead>
          <tr className="border-b border-ink-soft/15 text-left font-mono text-[11px] uppercase tracking-wide text-ink-soft">
            <th className="py-2 pr-3 font-semibold">Cliente</th>
            <th className="py-2 pr-3 text-right font-semibold">Em disputa</th>
            <th className="py-2 pr-3 text-right font-semibold">Adjudicado</th>
            <th className="py-2 text-right font-semibold">Ganhas</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-soft/10">
          {dados.map((c) => (
            <tr key={c.chave}>
              <td className="max-w-[220px] truncate py-2 pr-3 text-ink">{c.nome}</td>
              <td className="py-2 pr-3 text-right text-ink-soft">{formatarMoeda(c.valorEmDisputa)}</td>
              <td className="py-2 pr-3 text-right font-semibold text-forest">{formatarMoeda(c.valorAdjudicado)}</td>
              <td className="py-2 text-right text-ink-soft">{formatarNumero(c.licitacoesGanhas)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 font-body text-xs text-ink-soft">
        Em disputa = valor de referência das licitações com participação confirmada e sem resultado. Adjudicado não é faturamento.
      </p>
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
  | 'concorrentes_familia'
  | 'aproveitamento'
  | 'tempo_resposta'
  | 'clientes_sem_atividade'
  | 'concentracao_carteira'
  | 'valor_por_cliente'
  | 'desempenho_modalidade'

interface IndicadoresGraficosProps {
  indicadores: IndicadoresAdmin
  /** Indicadores que o perfil pode ver. Sem esta propriedade, mostra todos
   *  (Administrador). */
  visiveis?: ReadonlySet<string>
}

export function IndicadoresGraficos({ indicadores, visiveis }: IndicadoresGraficosProps) {
  const ver = (chave: ChaveIndicador) => !visiveis || visiveis.has(chave)

  if (visiveis && visiveis.size === 0) {
    return (
      <p className="rounded-xl border border-ink-soft/15 bg-white p-8 text-center font-body text-sm text-ink-soft shadow-soft">
        Nenhum indicador foi liberado para o seu perfil. Fale com o administrador.
      </p>
    )
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
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

      {ver('aproveitamento') && (
        <Cartao titulo="Aproveitamento" subtitulo="Licitações analisadas x licitações em que o cliente participou">
          <AproveitamentoBloco dados={indicadores.aproveitamento} />
        </Cartao>
      )}

      {ver('tempo_resposta') && (
        <Cartao titulo="Tempo de resposta do cliente" subtitulo="Dias entre o cadastro da licitação e a decisão (clientes mais lentos primeiro)">
          <TempoRespostaBloco dados={indicadores.tempoResposta} />
        </Cartao>
      )}

      {ver('clientes_sem_atividade') && (
        <Cartao titulo="Clientes sem atividade" subtitulo="Risco de perder o cliente: do mais parado para o mais ativo">
          <ClientesSemAtividadeBloco dados={indicadores.clientesSemAtividade} />
        </Cartao>
      )}

      {ver('valor_por_cliente') && (
        <Cartao titulo="Valor por cliente" subtitulo="Valor em disputa e valor adjudicado (10 maiores)">
          <ValorPorClienteBloco dados={indicadores.valorPorCliente} />
        </Cartao>
      )}

      {ver('concentracao_carteira') && (
        <Cartao
          titulo="Concentração da carteira"
          subtitulo="Peso de cada cliente e de cada segmento no valor de referência das licitações"
          className="lg:col-span-2"
        >
          <ConcentracaoBloco dados={indicadores.concentracaoCarteira} />
        </Cartao>
      )}

      {ver('desempenho_modalidade') && (
        <Cartao titulo="Desempenho por modalidade" subtitulo="Participações x licitações com vitória">
          <ModalidadeBloco dados={indicadores.desempenhoModalidade} />
        </Cartao>
      )}

      {ver('funil') && (
        <Cartao titulo="Funil de licitações" subtitulo="Contagem por licitação: analisadas → participou → ganhou (ao menos 1 item ganho)">
          <Funil etapas={indicadores.funil} />
        </Cartao>
      )}

      {ver('taxa_vitoria') && (
        <Cartao titulo="Taxa de vitória" subtitulo="Contagem por item: só itens e grupos ganhos ou perdidos">
          <TaxaVitoriaBloco atual={indicadores.taxaVitoria.atual} anterior={indicadores.taxaVitoria.anterior} />
        </Cartao>
      )}

      {ver('volume_periodo') && (
        <Cartao titulo="Volume por mês" subtitulo="Licitações por mês da sessão (passe o mouse para ver o valor)" className="lg:col-span-2">
          <VolumeMensal dados={indicadores.volumePorMes} />
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
        <Cartao titulo="Marcas" subtitulo="Itens cotados x itens ganhos por marca (10 maiores)">
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
          <PercentualPorFamiliaBloco
            dados={indicadores.distanciaDerrota}
            textoGeral={() => 'acima do valor do vencedor, em média, nas perdas por preço'}
            semDados="Nenhuma perda por preço com valor do vencedor informado."
          />
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

      {ver('concorrentes_familia') && (
        <Cartao titulo="Contra quem perdemos, por família" subtitulo="Os 3 concorrentes que mais ganharam de nós em cada família">
          <ConcorrentesFamiliaBloco dados={indicadores.concorrentesFamilia} />
        </Cartao>
      )}
    </div>
  )
}
