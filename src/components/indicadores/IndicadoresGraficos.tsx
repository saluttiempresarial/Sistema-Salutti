// src/components/indicadores/IndicadoresGraficos.tsx
//
// Painel visual dos 8 indicadores do Administrador. Recebe os números já
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
  BarraFamilia,
  BarraOrgao,
  Concorrente,
  IndicadoresAdmin,
  TaxaVitoria,
} from '../../types/indicadores'
import { formatarMoeda, formatarNumero } from '../../utils/prazoUtils'

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
// Painel completo
// ---------------------------------------------------------------------------
/** Chaves dos indicadores (as mesmas da liberação — migração 037). */
export type ChaveIndicador =
  | 'funil'
  | 'taxa_vitoria'
  | 'volume_periodo'
  | 'familias'
  | 'ganho_sobre_minimo'
  | 'perdas_evitaveis'
  | 'orgaos'
  | 'concorrentes'

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
      {ver('funil') && (
        <Cartao titulo="Funil de licitações" subtitulo="Analisadas → participou → ganhou">
          <Funil etapas={indicadores.funil} />
        </Cartao>
      )}

      {ver('taxa_vitoria') && (
        <Cartao titulo="Taxa de vitória" subtitulo="Só itens e grupos ganhos ou perdidos">
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

      {ver('perdas_evitaveis') && (
        <Cartao
          titulo="Perdas evitáveis"
          subtitulo="Perdemos para um vencedor cujo preço ainda cobria o mínimo do cliente"
          className="lg:col-span-2"
        >
          <PerdasEvitaveisBloco dados={indicadores.perdasEvitaveis} />
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
    </div>
  )
}
