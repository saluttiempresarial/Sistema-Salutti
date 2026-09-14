// src/components/Licitacoes/PropostaComercialTable.tsx
//
// Tela de Proposta Comercial — tabela única, densa, estilo planilha (NÃO
// vira cards em nenhum tamanho de tela — decisão explícita, já que um
// lote pode ter 120+ itens e cards tornariam a navegação inviável).
//
// Características desta versão:
// - Cabeçalho fixo durante rolagem vertical (sticky), dentro de um
//   container com altura máxima e scroll próprio — a rolagem horizontal
//   acontece SÓ dentro da tabela, nunca na página inteira.
// - Colunas "Grupo", "Item" e "Descrição" fixas durante rolagem
//   horizontal (sticky left), para nunca perder a identidade da linha.
// - JÁ TESTAMOS larguras em % (sem rolagem horizontal) e revertemos:
//   em telas reais isso cortava/sobrepunha texto ("Grup", "ME/EP", "500"
//   sobre "9720") — pior que ter uma barra de rolagem. Largura fixa em
//   px + rolagem horizontal é a versão sem esse problema.
// - Campos editáveis (Proposta Comercial) com fundo verde-claro,
//   visualmente diferentes dos campos somente-leitura (Itens de
//   Referência, quando quem está vendo não pode editá-los), que aparecem
//   com fundo neutro e um ícone de cadeado.
// - Busca por descrição/código + filtro por status.
// - Barra de progresso ("X de Y itens preenchidos").
// - Status sempre com ícone + texto + cor (nunca só cor).
//
// Estrutura de 3 blocos, igual à planilha real da Salutti — Itens
// (Referência) / Proposta Comercial / Análise da Proposta — mantida
// desde a primeira versão, só a apresentação visual mudou:
// - Bloco Itens (Referência): editável quando `podeEditarItens` (Admin).
//   Cliente e Funcionário só visualizam (bloqueado/cadeado).
// - Bloco Proposta Comercial: editável quando `podeEditarPropostaComercial`
//   (Cliente e Admin). Funcionário só visualiza. "+ Frete" e "Valor Total"
//   são sempre calculados, nunca editáveis diretamente.
// - Bloco Análise da Proposta: sempre calculado, ninguém edita (ver
//   classificarStatusProposta em utils/licitacaoCalculos.ts — regra
//   extraída da fórmula real da planilha, corte em -40%).

import { memo, useMemo, useState, useEffect } from 'react'
import { Button } from '@/components/Button'
import { Licitacao, ItemLicitacao, PropostaClienteItem } from '@/types/licitacao'
import { formatarMoeda } from '@/utils/prazoUtils'
import {
  calcularAnaliseItem,
  classificarStatusProposta,
  AnaliseItemProposta,
  ChaveStatusProposta,
} from '@/utils/licitacaoCalculos'

// Largura de CADA uma das 19 colunas, em pixels fixos — testamos larguras
// proporcionais (%) para tentar eliminar a rolagem horizontal, mas em
// telas reais (mesmo 1920px, dependendo do zoom/layout) isso cortava e
// sobrepunha texto ("Grup", "ME/EP", "500" sobre "9720") — pior que ter
// uma barra de rolagem. Voltamos ao valor fixo em px, testado sem esse
// problema; a rolagem horizontal é aceitável, texto ilegível não é.
const LARGURA_COL_GRUPO = 72
const LARGURA_COL_ITEM = 76
const LARGURA_COL_DESCRICAO_REF = 260
const LARGURAS_COLUNAS = [
  LARGURA_COL_GRUPO, // Grupo — fixa
  LARGURA_COL_ITEM, // Item (referência) — fixa
  LARGURA_COL_DESCRICAO_REF, // Descrição (referência) — fixa
  88, // ME/EPP
  96, // Unid.
  88, // Quant.
  118, // Valor unit. ref.
  130, // Valor total ref.
  150, // Valor total ref. (grupo)
  76, // Item (repetido, bloco Proposta Comercial)
  140, // Cód. produto
  220, // Descrição ofertada
  150, // Fabricante
  140, // Modelo
  130, // Preço mínimo R$
  170, // Preço mínimo R$ + frete
  140, // Valor total
  100, // Diferença
  170, // Status
] as const

interface PropostaItemForm {
  codigoInterno: string
  descricaoProduto: string
  marca: string
  modelo: string
  precoMinimo: number | ''
}

interface ItemReferenciaForm {
  descricao: string
  unidadeMedida: string
  quantidade: number
  precoReferencia: number
}

function formVazioParaItem(item: ItemLicitacao): PropostaItemForm {
  const atual = item.propostaCliente
  return {
    codigoInterno: atual?.codigoInterno ?? '',
    descricaoProduto: atual?.descricaoProduto ?? '',
    marca: atual?.marca ?? '',
    modelo: atual?.modelo ?? '',
    precoMinimo: atual?.precoMinimo ?? '',
  }
}

function referenciaFormParaItem(item: ItemLicitacao): ItemReferenciaForm {
  return {
    descricao: item.descricao,
    unidadeMedida: item.unidadeMedida,
    quantidade: item.quantidade,
    precoReferencia: item.precoReferencia,
  }
}

export interface SalvarPropostaComercialPayload {
  itensReferencia?: Array<Pick<ItemLicitacao, 'id' | 'descricao' | 'unidadeMedida' | 'quantidade' | 'precoReferencia'>>
  propostaPorItem: Array<{ id: string; propostaCliente: PropostaClienteItem }>
  incluirFrete: boolean
  percentualFrete?: number
}

interface PropostaComercialTableProps {
  licitacao: Licitacao
  podeEditarItens: boolean
  podeEditarPropostaComercial: boolean
  /** Barra de resumo (totais + progresso) — true na tela do Cliente. */
  mostrarResumo?: boolean
  salvando?: boolean
  onSalvar: (payload: SalvarPropostaComercialPayload) => Promise<void>
  textoBotaoSalvar?: string
}

/** Input de campo EDITÁVEL — fundo verde-claro, para se diferenciar
 *  visualmente dos campos somente-leitura (regra explícita do pedido). */
function InputEditavel(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full min-w-[80px] rounded-md border border-forest/30 bg-forest-mist/40 px-2 py-1 font-body text-sm text-ink outline-none focus:border-forest focus:bg-white focus:ring-1 focus:ring-forest-mist ${props.className ?? ''}`}
    />
  )
}

/** Célula somente-leitura de um campo que É editável por OUTRO perfil
 *  (ex.: Cliente vendo os Itens de Referência, que só o Admin edita) —
 *  fundo neutro + cadeado, sinalizando "bloqueado pra você". */
function CampoBloqueado({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-paper-2/70 px-2 py-1">
      <span aria-hidden className="text-xs text-ink-soft/60">
        🔒
      </span>
      <span className="font-body text-sm text-ink-soft">{children}</span>
    </div>
  )
}

/** Texto com truncamento em 2 linhas + "ver mais/ver menos" — evita que uma
 *  descrição longa (especificação de edital) estique a linha inteira da
 *  tabela. Estado isolado: expandir uma célula não re-renderiza as outras. */
const TextoComVerMais = memo(function TextoComVerMais({ texto }: { texto: string }) {
  const [expandido, setExpandido] = useState(false)
  if (!texto) return <span className="font-body text-sm text-ink-soft">—</span>
  return (
    <div className="min-w-[160px] max-w-[260px]">
      <p className={`font-body text-sm text-ink ${expandido ? '' : 'line-clamp-2'}`}>{texto}</p>
      {texto.length > 90 && (
        <button
          type="button"
          onClick={() => setExpandido((atual) => !atual)}
          className="font-body text-xs font-semibold text-forest hover:underline"
        >
          {expandido ? 'ver menos' : 'ver mais'}
        </button>
      )}
    </div>
  )
})

interface LinhaItemProps {
  item: ItemLicitacao
  form: PropostaItemForm
  referencia: ItemReferenciaForm
  analise: AnaliseItemProposta | undefined
  podeEditarItens: boolean
  podeEditarPropostaComercial: boolean
  /** Número do grupo/lote deste item, ou '—' quando a licitação não usa
   *  grupos (nem toda licitação tem lote — precisa suportar os dois casos). */
  grupoLabel: string
  /** Subtotal do grupo (soma do Valor Total Referência de todos os itens
   *  do grupo) — só preenchido na PRIMEIRA linha de cada grupo, igual à
   *  planilha original (coluna I, fórmula =SOMA(...), aparece uma vez por
   *  grupo). null nas demais linhas do mesmo grupo. */
  subtotalGrupo: number | null
  onChangeItem: <K extends keyof PropostaItemForm>(itemId: string, campo: K, valor: PropostaItemForm[K]) => void
  onChangeReferencia: <K extends keyof ItemReferenciaForm>(
    itemId: string,
    campo: K,
    valor: ItemReferenciaForm[K]
  ) => void
}

/** Linha de item — componente PRÓPRIO (fora da função principal) e
 *  memoizado, para não recriar a linha inteira a cada tecla digitada
 *  (essencial com 100+ itens). */
const LinhaItem = memo(function LinhaItem({
  item,
  form,
  referencia,
  analise,
  podeEditarItens,
  podeEditarPropostaComercial,
  grupoLabel,
  subtotalGrupo,
  onChangeItem,
  onChangeReferencia,
}: LinhaItemProps) {
  const status = classificarStatusProposta(analise?.percentualDiferenca ?? null)
  const valorTotalReferencia = referencia.quantidade * referencia.precoReferencia

  return (
    <tr className="group border-t border-ink-soft/10 align-top hover:bg-paper-2/30">
      {/* --- Colunas fixas na rolagem horizontal: Grupo + Item + Descrição --- */}
      <td
        className="sticky z-10 whitespace-nowrap border-r border-ink-soft/10 bg-white px-3 py-2 group-hover:bg-[#FBFAF6]"
        style={{ left: 0 }}
      >
        <p className="font-body text-sm text-ink-soft">{grupoLabel}</p>
      </td>
      <td
        className="sticky z-10 whitespace-nowrap border-r border-ink-soft/10 bg-white px-3 py-2 group-hover:bg-[#FBFAF6]"
        style={{ left: LARGURA_COL_GRUPO }}
      >
        <p className="font-body text-sm font-medium text-ink">{item.numero}</p>
      </td>
      <td
        className="sticky z-10 border-r border-ink-soft/10 bg-white px-3 py-2 group-hover:bg-[#FBFAF6]"
        style={{ left: LARGURA_COL_GRUPO + LARGURA_COL_ITEM }}
      >
        {podeEditarItens ? (
          <textarea
            value={referencia.descricao}
            onChange={(e) => onChangeReferencia(item.id, 'descricao', e.target.value)}
            rows={2}
            className="w-full resize-y rounded-md border border-forest/30 bg-forest-mist/40 px-2 py-1 font-body text-sm text-ink outline-none focus:border-forest focus:bg-white focus:ring-1 focus:ring-forest-mist"
          />
        ) : (
          <TextoComVerMais texto={item.descricao} />
        )}
      </td>

      {/* --- Bloco Itens (Referência) --- */}
      <td className="whitespace-nowrap px-3 py-2">
        <p className="font-body text-sm text-ink-soft">{item.exclusivoMeEpp ? 'Sim' : 'Não'}</p>
      </td>
      <td className="px-3 py-2">
        {podeEditarItens ? (
          <InputEditavel
            value={referencia.unidadeMedida}
            onChange={(e) => onChangeReferencia(item.id, 'unidadeMedida', e.target.value)}
          />
        ) : (
          <p className="whitespace-nowrap font-body text-sm text-ink-soft">{item.unidadeMedida}</p>
        )}
      </td>
      <td className="px-3 py-2">
        {podeEditarItens ? (
          <InputEditavel
            type="number"
            value={referencia.quantidade}
            onChange={(e) => onChangeReferencia(item.id, 'quantidade', Number(e.target.value))}
          />
        ) : (
          <p className="whitespace-nowrap font-body text-sm text-ink-soft">{item.quantidade}</p>
        )}
      </td>
      <td className="px-3 py-2">
        {podeEditarItens ? (
          <InputEditavel
            type="number"
            value={referencia.precoReferencia}
            onChange={(e) => onChangeReferencia(item.id, 'precoReferencia', Number(e.target.value))}
          />
        ) : (
          <p className="whitespace-nowrap font-body text-sm text-ink-soft">{formatarMoeda(item.precoReferencia)}</p>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2">
        <p className="font-body text-sm text-ink-soft">{formatarMoeda(valorTotalReferencia)}</p>
      </td>
      <td className="whitespace-nowrap border-r border-ink-soft/10 px-3 py-2">
        <p className="font-body text-sm font-semibold text-ink-soft">
          {subtotalGrupo != null ? formatarMoeda(subtotalGrupo) : ''}
        </p>
      </td>

      {/* --- Bloco Proposta Comercial --- */}
      <td className="whitespace-nowrap px-3 py-2">
        <p className="font-body text-sm text-ink-soft">{item.numero}</p>
      </td>
      <td className="px-3 py-2">
        {podeEditarPropostaComercial ? (
          <InputEditavel
            value={form.codigoInterno}
            onChange={(e) => onChangeItem(item.id, 'codigoInterno', e.target.value)}
          />
        ) : (
          <CampoBloqueado>{form.codigoInterno || '—'}</CampoBloqueado>
        )}
      </td>
      <td className="px-3 py-2">
        {podeEditarPropostaComercial ? (
          <textarea
            value={form.descricaoProduto}
            onChange={(e) => onChangeItem(item.id, 'descricaoProduto', e.target.value)}
            rows={2}
            className="w-full min-w-[160px] resize-y rounded-md border border-forest/30 bg-forest-mist/40 px-2 py-1 font-body text-sm text-ink outline-none focus:border-forest focus:bg-white focus:ring-1 focus:ring-forest-mist"
          />
        ) : (
          <TextoComVerMais texto={form.descricaoProduto} />
        )}
      </td>
      <td className="px-3 py-2">
        {podeEditarPropostaComercial ? (
          <InputEditavel value={form.marca} onChange={(e) => onChangeItem(item.id, 'marca', e.target.value)} />
        ) : (
          <CampoBloqueado>{form.marca || '—'}</CampoBloqueado>
        )}
      </td>
      <td className="px-3 py-2">
        {podeEditarPropostaComercial ? (
          <InputEditavel value={form.modelo} onChange={(e) => onChangeItem(item.id, 'modelo', e.target.value)} />
        ) : (
          <CampoBloqueado>{form.modelo || '—'}</CampoBloqueado>
        )}
      </td>
      <td className="px-3 py-2">
        {podeEditarPropostaComercial ? (
          <InputEditavel
            type="number"
            value={form.precoMinimo}
            onChange={(e) => onChangeItem(item.id, 'precoMinimo', e.target.value === '' ? '' : Number(e.target.value))}
          />
        ) : (
          <CampoBloqueado>{form.precoMinimo !== '' ? formatarMoeda(Number(form.precoMinimo)) : '—'}</CampoBloqueado>
        )}
      </td>
      <td className="whitespace-nowrap bg-forest-mist/20 px-3 py-2">
        <p className="font-body text-sm font-medium text-ink">
          {analise?.precoComFrete != null ? formatarMoeda(analise.precoComFrete) : '—'}
        </p>
      </td>
      <td className="whitespace-nowrap border-r border-ink-soft/10 px-3 py-2">
        <p className="font-body text-sm font-medium text-forest-deep">
          {analise?.valorTotal != null ? formatarMoeda(analise.valorTotal) : '—'}
        </p>
      </td>

      {/* --- Bloco Análise da Proposta (compacto, sempre calculado) --- */}
      <td className="whitespace-nowrap px-3 py-2">
        <p className="font-body text-sm text-ink-soft">
          {analise?.percentualDiferenca != null ? `${(analise.percentualDiferenca * 100).toFixed(1)}%` : '—'}
        </p>
      </td>
      <td className="whitespace-nowrap px-3 py-2">
        <span className={`inline-block rounded-full px-2.5 py-1 font-body text-xs font-medium ${status.classe}`}>
          {status.label}
        </span>
      </td>
    </tr>
  )
})

/** Item da barra de resumo — ícone num círculo + rótulo + valor. */
function EstatisticaResumo({
  icone,
  label,
  valor,
  corValor = 'text-ink',
}: {
  icone: string
  label: string
  valor: string
  corValor?: string
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper-2 text-base" aria-hidden>
        {icone}
      </span>
      <div>
        <p className="font-body text-xs text-ink-soft">{label}</p>
        <p className={`font-display text-lg ${corValor}`}>{valor}</p>
      </div>
    </div>
  )
}

interface ResumoProposta {
  forte: number
  positiva: number
  naoParticipar: number
  semPreco: number
  valorTotalReferencia: number
  valorTotalProposta: number
  itensPreenchidos: number
  totalItens: number
}

const FILTROS_STATUS: Array<{ chave: ChaveStatusProposta | 'todos'; label: string }> = [
  { chave: 'todos', label: 'Todos' },
  { chave: 'forte', label: '🚀 Forte' },
  { chave: 'positiva', label: '⚖️ Positiva' },
  { chave: 'nao_participar', label: '❌ Não participar' },
  { chave: 'indefinido', label: '— Sem preço' },
]

export function PropostaComercialTable({
  licitacao,
  podeEditarItens,
  podeEditarPropostaComercial,
  mostrarResumo = false,
  salvando,
  onSalvar,
  textoBotaoSalvar = 'Salvar alterações',
}: PropostaComercialTableProps) {
  const [formPorItem, setFormPorItem] = useState<Record<string, PropostaItemForm>>(() => {
    const inicial: Record<string, PropostaItemForm> = {}
    licitacao.itens.forEach((item) => {
      inicial[item.id] = formVazioParaItem(item)
    })
    return inicial
  })
  const [referenciaPorItem, setReferenciaPorItem] = useState<Record<string, ItemReferenciaForm>>(() => {
    const inicial: Record<string, ItemReferenciaForm> = {}
    licitacao.itens.forEach((item) => {
      inicial[item.id] = referenciaFormParaItem(item)
    })
    return inicial
  })
  const [taxaFrete, setTaxaFrete] = useState<number | ''>(licitacao.percentualFrete ?? '')
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<ChaveStatusProposta | 'todos'>('todos')
  const [filtroPreenchimento, setFiltroPreenchimento] = useState<'todos' | 'preenchidos' | 'pendentes'>('todos')
  const [mostrarFiltrosAvancados, setMostrarFiltrosAvancados] = useState(false)

  useEffect(() => {
    const inicialProposta: Record<string, PropostaItemForm> = {}
    const inicialReferencia: Record<string, ItemReferenciaForm> = {}
    licitacao.itens.forEach((item) => {
      inicialProposta[item.id] = formVazioParaItem(item)
      inicialReferencia[item.id] = referenciaFormParaItem(item)
    })
    setFormPorItem(inicialProposta)
    setReferenciaPorItem(inicialReferencia)
    setTaxaFrete(licitacao.percentualFrete ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [licitacao.id])

  function atualizarItem<K extends keyof PropostaItemForm>(itemId: string, campo: K, valor: PropostaItemForm[K]) {
    setFormPorItem((atual) => ({ ...atual, [itemId]: { ...atual[itemId], [campo]: valor } }))
  }

  function atualizarReferencia<K extends keyof ItemReferenciaForm>(
    itemId: string,
    campo: K,
    valor: ItemReferenciaForm[K]
  ) {
    setReferenciaPorItem((atual) => ({ ...atual, [itemId]: { ...atual[itemId], [campo]: valor } }))
  }

  const taxaPreenchida = taxaFrete !== ''
  const taxaFreteNumero = taxaFrete === '' ? 0 : Number(taxaFrete)

  const analisePorItem = useMemo(() => {
    const mapa: Record<string, AnaliseItemProposta> = {}
    licitacao.itens.forEach((item) => {
      const form = formPorItem[item.id]
      const precoMinimo = form?.precoMinimo === '' || form?.precoMinimo == null ? undefined : Number(form.precoMinimo)
      const itemComPropostaAoVivo: ItemLicitacao = {
        ...item,
        precoReferencia: podeEditarItens
          ? referenciaPorItem[item.id]?.precoReferencia ?? item.precoReferencia
          : item.precoReferencia,
        propostaCliente: { ...item.propostaCliente, precoMinimo },
      }
      mapa[item.id] = calcularAnaliseItem(itemComPropostaAoVivo, taxaFreteNumero, taxaPreenchida)
    })
    return mapa
  }, [licitacao, formPorItem, referenciaPorItem, taxaFreteNumero, taxaPreenchida, podeEditarItens])

  const resumo = useMemo<ResumoProposta>(() => {
    const acc: ResumoProposta = {
      forte: 0,
      positiva: 0,
      naoParticipar: 0,
      semPreco: 0,
      valorTotalReferencia: 0,
      valorTotalProposta: 0,
      itensPreenchidos: 0,
      totalItens: licitacao.itens.length,
    }
    licitacao.itens.forEach((item) => {
      const referencia = referenciaPorItem[item.id]
      if (referencia) acc.valorTotalReferencia += referencia.quantidade * referencia.precoReferencia
      const analise = analisePorItem[item.id]
      if (analise?.valorTotal != null) acc.valorTotalProposta += analise.valorTotal
      const form = formPorItem[item.id]
      if (form?.precoMinimo !== '' && form?.precoMinimo != null) acc.itensPreenchidos += 1
      const status = classificarStatusProposta(analise?.percentualDiferenca ?? null)
      if (status.chave === 'forte') acc.forte += 1
      else if (status.chave === 'positiva') acc.positiva += 1
      else if (status.chave === 'nao_participar') acc.naoParticipar += 1
      else if (status.chave === 'indefinido') acc.semPreco += 1
    })
    return acc
  }, [licitacao, referenciaPorItem, analisePorItem, formPorItem])

  // Filtra por busca (descrição de referência, descrição ofertada ou
  // código do produto) e por status — mantém a estrutura de grupos,
  // só ocultando grupos que ficaram sem nenhum item após o filtro.
  const itensFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return licitacao.itens.filter((item) => {
      const form = formPorItem[item.id]
      const preenchido = form?.precoMinimo !== '' && form?.precoMinimo != null
      if (filtroPreenchimento === 'preenchidos' && !preenchido) return false
      if (filtroPreenchimento === 'pendentes' && preenchido) return false
      if (filtroStatus !== 'todos') {
        const analise = analisePorItem[item.id]
        const status = classificarStatusProposta(analise?.percentualDiferenca ?? null)
        if (status.chave !== filtroStatus) return false
      }
      if (termo) {
        const alvo = `${item.numero} ${item.descricao} ${form?.descricaoProduto ?? ''} ${form?.codigoInterno ?? ''}`.toLowerCase()
        if (!alvo.includes(termo)) return false
      }
      return true
    })
  }, [licitacao.itens, busca, filtroStatus, filtroPreenchimento, analisePorItem, formPorItem])

  // Subtotal por grupo/lote (2º campo "Valor Total Referência R$" da
  // planilha original — fórmula =SOMA(...) por grupo). Calculado sobre
  // TODOS os itens do grupo (não só os filtrados pela busca), para o
  // subtotal continuar correto mesmo com um filtro ativo.
  const subtotalPorGrupo = useMemo(() => {
    const mapa: Record<string, number> = {}
    licitacao.itens.forEach((item) => {
      if (!item.grupoId) return
      const ref = referenciaPorItem[item.id]
      if (!ref) return
      mapa[item.grupoId] = (mapa[item.grupoId] ?? 0) + ref.quantidade * ref.precoReferencia
    })
    return mapa
  }, [licitacao.itens, referenciaPorItem])

  const grupoNumeroPorId = useMemo(() => {
    const mapa: Record<string, string> = {}
    licitacao.grupos.forEach((g) => {
      mapa[g.id] = g.numero
    })
    return mapa
  }, [licitacao.grupos])

  async function handleSalvar() {
    const propostaPorItem = licitacao.itens.map((item) => {
      const form = formPorItem[item.id]
      const propostaCliente: PropostaClienteItem = {
        codigoInterno: form.codigoInterno || undefined,
        descricaoProduto: form.descricaoProduto || undefined,
        marca: form.marca || undefined,
        modelo: form.modelo || undefined,
        precoMinimo: form.precoMinimo === '' ? undefined : Number(form.precoMinimo),
      }
      return { id: item.id, propostaCliente }
    })

    const itensReferencia = podeEditarItens
      ? licitacao.itens.map((item) => {
          const ref = referenciaPorItem[item.id]
          return { id: item.id, ...ref }
        })
      : undefined

    await onSalvar({
      itensReferencia,
      propostaPorItem,
      incluirFrete: taxaFreteNumero > 0,
      percentualFrete: taxaFreteNumero > 0 ? taxaFreteNumero : undefined,
    })
  }

  const podeEditarAlgumaCoisa = podeEditarItens || podeEditarPropostaComercial

  function renderLinha(item: ItemLicitacao, ehPrimeiroDoGrupo: boolean) {
    return (
      <LinhaItem
        key={item.id}
        item={item}
        form={formPorItem[item.id]}
        referencia={referenciaPorItem[item.id]}
        analise={analisePorItem[item.id]}
        podeEditarItens={podeEditarItens}
        podeEditarPropostaComercial={podeEditarPropostaComercial}
        grupoLabel={item.grupoId ? grupoNumeroPorId[item.grupoId] ?? '—' : '—'}
        subtotalGrupo={ehPrimeiroDoGrupo && item.grupoId ? subtotalPorGrupo[item.grupoId] ?? null : null}
        onChangeItem={atualizarItem}
        onChangeReferencia={atualizarReferencia}
      />
    )
  }

  const progressoPct = resumo.totalItens > 0 ? Math.round((resumo.itensPreenchidos / resumo.totalItens) * 100) : 0

  return (
    <div className="space-y-4">
      {/* --- Barra de resumo: totais + progresso, estilo ícone-em-círculo --- */}
      {mostrarResumo && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-xl border border-ink-soft/15 bg-white p-4 shadow-soft">
          <EstatisticaResumo icone="📋" label="Total de itens" valor={String(resumo.totalItens)} />
          <EstatisticaResumo icone="✅" label="Preenchidos" valor={String(resumo.itensPreenchidos)} corValor="text-forest-deep" />
          <EstatisticaResumo icone="🕐" label="Pendentes" valor={String(resumo.totalItens - resumo.itensPreenchidos)} />
          <div className="min-w-[180px] flex-1">
            <div className="mb-1 flex items-center justify-between font-body text-xs text-ink-soft">
              <span>
                Progresso: {resumo.itensPreenchidos} de {resumo.totalItens} itens preenchidos
              </span>
              <span className="font-semibold text-ink">{progressoPct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-paper-2">
              <div className="h-full rounded-full bg-forest transition-all" style={{ width: `${progressoPct}%` }} />
            </div>
          </div>
          <EstatisticaResumo icone="💰" label="Valor referência" valor={formatarMoeda(resumo.valorTotalReferencia)} />
          <EstatisticaResumo
            icone="💰"
            label="Valor da proposta"
            valor={formatarMoeda(resumo.valorTotalProposta)}
            corValor="text-forest-deep"
          />
        </div>
      )}

      {/* --- Busca + Frete + filtro rápido de preenchimento + filtros avançados --- */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" aria-hidden>
            🔍
          </span>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por item, código ou descrição..."
            className="w-full rounded-md border border-ink-soft/25 py-2 pl-9 pr-3 font-body text-sm text-ink outline-none focus:border-forest focus:ring-1 focus:ring-forest-mist"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { chave: 'todos' as const, label: 'Todos' },
              { chave: 'preenchidos' as const, label: '✅ Preenchidos' },
              { chave: 'pendentes' as const, label: '🕐 Pendentes' },
            ]
          ).map((f) => (
            <button
              key={f.chave}
              type="button"
              onClick={() => setFiltroPreenchimento(f.chave)}
              className={`rounded-full border px-3 py-1.5 font-body text-xs font-medium transition-colors ${
                filtroPreenchimento === f.chave
                  ? 'border-forest bg-forest text-white'
                  : 'border-ink-soft/25 bg-white text-ink-soft hover:bg-paper-2'
              }`}
            >
              {f.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setMostrarFiltrosAvancados((atual) => !atual)}
            className={`rounded-full border px-3 py-1.5 font-body text-xs font-medium transition-colors ${
              mostrarFiltrosAvancados || filtroStatus !== 'todos'
                ? 'border-forest bg-forest-mist text-forest-deep'
                : 'border-ink-soft/25 bg-white text-ink-soft hover:bg-paper-2'
            }`}
          >
            ⚙️ Filtros{filtroStatus !== 'todos' ? ' (1)' : ''}
          </button>
        </div>
      </div>

      {mostrarFiltrosAvancados && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-ink-soft/15 bg-paper-2/40 p-3">
          <span className="mr-1 font-body text-xs text-ink-soft">Status da análise:</span>
          {FILTROS_STATUS.map((f) => {
            const contagem =
              f.chave === 'todos'
                ? resumo.totalItens
                : f.chave === 'forte'
                ? resumo.forte
                : f.chave === 'positiva'
                ? resumo.positiva
                : f.chave === 'nao_participar'
                ? resumo.naoParticipar
                : resumo.semPreco
            return (
              <button
                key={f.chave}
                type="button"
                onClick={() => setFiltroStatus(f.chave)}
                className={`rounded-full border px-3 py-1.5 font-body text-xs font-medium transition-colors ${
                  filtroStatus === f.chave
                    ? 'border-forest bg-forest text-white'
                    : 'border-ink-soft/25 bg-white text-ink-soft hover:bg-paper-2'
                }`}
              >
                {f.label} ({contagem})
              </button>
            )
          })}
        </div>
      )}

      {(busca || filtroStatus !== 'todos' || filtroPreenchimento !== 'todos') && (
        <p className="font-body text-xs text-ink-soft">
          Mostrando {itensFiltrados.length} de {licitacao.itens.length} itens.
        </p>
      )}

      {/* --- Tabela: cabeçalho fixo + colunas Item/Descrição fixas — scroll interno --- */}
      <div className="max-h-[65vh] overflow-auto rounded-xl border border-ink-soft/15">
        <table className="w-full table-fixed border-separate border-spacing-0 font-body text-sm">
          <colgroup>
            {LARGURAS_COLUNAS.map((largura, i) => (
              <col key={i} style={{ width: largura }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th
                className="sticky left-0 top-0 z-30 h-9 border-r border-white/20 bg-charcoal"
                style={{ left: 0 }}
              />
              <th
                className="sticky top-0 z-30 h-9 border-r border-white/20 bg-charcoal"
                style={{ left: LARGURA_COL_GRUPO }}
              />
              <th
                className="sticky top-0 z-30 h-9 border-r border-white/20 bg-charcoal"
                style={{ left: LARGURA_COL_GRUPO + LARGURA_COL_ITEM }}
              />
              <th
                colSpan={6}
                className="sticky top-0 z-20 h-9 border-r border-white/20 bg-charcoal px-3 py-1.5 text-left font-body text-[11px] font-semibold uppercase tracking-wide text-white"
              >
                ● Referência
              </th>
              <th
                colSpan={8}
                className="sticky top-0 z-20 h-9 border-r border-white/20 bg-forest px-3 py-1.5 text-left font-body text-[11px] font-semibold uppercase tracking-wide text-white"
              >
                ● Proposta comercial
              </th>
              <th
                colSpan={2}
                className="sticky top-0 z-20 h-9 bg-brass px-3 py-1.5 text-left font-body text-[11px] font-semibold uppercase tracking-wide text-white"
              >
                ● Análise da proposta
              </th>
            </tr>
            <tr className="bg-white text-left text-xs text-ink-soft">
              <th
                className="sticky top-9 z-30 whitespace-nowrap border-r border-ink-soft/10 bg-white px-3 py-2"
                style={{ left: 0 }}
              >
                Grupo
              </th>
              <th
                className="sticky top-9 z-30 whitespace-nowrap border-r border-ink-soft/10 bg-white px-3 py-2"
                style={{ left: LARGURA_COL_GRUPO }}
              >
                Item
              </th>
              <th
                className="sticky top-9 z-30 whitespace-nowrap border-r border-ink-soft/10 bg-white px-3 py-2"
                style={{ left: LARGURA_COL_GRUPO + LARGURA_COL_ITEM }}
              >
                Descrição
              </th>
              <th className="sticky top-9 z-20 leading-tight bg-white px-3 py-2">ME/EPP</th>
              <th className="sticky top-9 z-20 leading-tight bg-white px-3 py-2">Unid.</th>
              <th className="sticky top-9 z-20 leading-tight bg-white px-3 py-2">Quant.</th>
              <th className="sticky top-9 z-20 leading-tight bg-white px-3 py-2">Valor unit. ref.</th>
              <th className="sticky top-9 z-20 leading-tight bg-white px-3 py-2">Valor total ref.</th>
              <th className="sticky top-9 z-20 leading-tight border-r border-ink-soft/10 bg-white px-3 py-2" title="Subtotal do grupo/lote (soma dos itens do grupo) — aparece uma vez por grupo, igual à planilha original">
                Valor total ref. (grupo)
              </th>
              <th className="sticky top-9 z-20 leading-tight bg-white px-3 py-2">Item</th>
              <th className="sticky top-9 z-20 leading-tight bg-white px-3 py-2">Cód. produto</th>
              <th className="sticky top-9 z-20 leading-tight bg-white px-3 py-2">Descrição ofertada</th>
              <th className="sticky top-9 z-20 leading-tight bg-white px-3 py-2">Fabricante</th>
              <th className="sticky top-9 z-20 leading-tight bg-white px-3 py-2">Modelo</th>
              <th className="sticky top-9 z-20 leading-tight bg-white px-3 py-2">Preço mínimo R$</th>
              <th className="sticky top-9 z-20 bg-forest-mist/60 px-2 py-2 align-bottom">
                <div className="mx-auto mb-1.5 flex w-fit flex-col items-center gap-0.5 rounded-md bg-forest px-2.5 py-1">
                  <span className="font-body text-[9px] font-semibold uppercase tracking-wide text-white/80">
                    Frete
                  </span>
                  {podeEditarPropostaComercial ? (
                    <input
                      type="number"
                      value={taxaFrete}
                      onChange={(e) => setTaxaFrete(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="0"
                      className="w-14 rounded border-0 bg-white px-1 py-0.5 text-center font-body text-xs font-semibold text-ink outline-none focus:ring-2 focus:ring-white"
                    />
                  ) : (
                    <span className="font-body text-xs font-semibold text-white">
                      {taxaFrete !== '' ? `${taxaFrete}%` : '—'}
                    </span>
                  )}
                </div>
                <span className="block text-center leading-tight">Preço mínimo + frete (R$)</span>
              </th>
              <th className="sticky top-9 z-20 leading-tight border-r border-ink-soft/10 bg-white px-3 py-2">
                Valor total
              </th>
              <th className="sticky top-9 z-20 leading-tight bg-white px-3 py-2">Diferença</th>
              <th className="sticky top-9 z-20 leading-tight bg-white px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const gruposJaExibidos = new Set<string>()
              return itensFiltrados.map((item) => {
                let ehPrimeiroDoGrupo = false
                if (item.grupoId && !gruposJaExibidos.has(item.grupoId)) {
                  gruposJaExibidos.add(item.grupoId)
                  ehPrimeiroDoGrupo = true
                }
                return renderLinha(item, ehPrimeiroDoGrupo)
              })
            })()}

            {itensFiltrados.length === 0 && (
              <tr>
                <td colSpan={19} className="px-3 py-6 text-center font-body text-sm italic text-ink-soft">
                  {licitacao.itens.length === 0
                    ? 'Nenhum item cadastrado nesta licitação ainda.'
                    : 'Nenhum item encontrado com esse filtro/busca.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {podeEditarAlgumaCoisa && (
        <div className="flex justify-end">
          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando ? 'Salvando...' : textoBotaoSalvar}
          </Button>
        </div>
      )}
    </div>
  )
}
