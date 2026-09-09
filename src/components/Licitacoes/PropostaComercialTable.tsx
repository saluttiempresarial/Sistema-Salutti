// src/components/Licitacoes/PropostaComercialTable.tsx
//
// Tabela dos 3 blocos da aba "Produtos" da planilha real da Salutti —
// Itens (Referência) / Proposta Comercial / Análise da Proposta — em
// formato de tabela (linhas/colunas), igual à planilha.
//
// Componente COMPARTILHADO entre a página de Proposta Comercial do
// Cliente e a do Admin: o layout e as colunas são exatamente os mesmos
// nos dois lugares (mesma regra do "tem que ter exatamente as mesmas
// informações que a planilha") — o que muda entre os dois é só quem pode
// editar o quê, controlado pelas props abaixo.
//
// - Bloco Itens (Referência): Grupo, Item, Descrição, Unid., Quant.,
//   Valor Unit. Referência — editável quando `podeEditarItens` (Admin).
//   Cliente e Funcionário só visualizam.
// - Bloco Proposta Comercial: Cód. Produto, Descrição (produto ofertado),
//   Fabricante, Modelo, Preço Mínimo — editável quando
//   `podeEditarPropostaComercial` (Cliente e Admin). Funcionário só
//   visualiza.
// - Bloco Análise da Proposta: % diferença e Status — sempre calculado
//   automaticamente, ninguém edita (ver classificarStatusProposta em
//   utils/licitacaoCalculos.ts para a regra exata, extraída da fórmula
//   real da planilha).
//
// Taxa de Frete: UM campo só, no topo — aplicada a todos os itens.
// "+ Frete", "Valor Total", "% vs. Referência" e o Status só aparecem
// depois que a Taxa de Frete for preenchida (mesmo que seja 0).

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { Licitacao, ItemLicitacao, PropostaClienteItem } from '@/types/licitacao'
import { formatarMoeda } from '@/utils/prazoUtils'
import { calcularAnaliseItem, classificarStatusProposta } from '@/utils/licitacaoCalculos'

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
  /** Admin: true. Cliente/Funcionário: false — só o Admin edita os dados
   *  de referência (preenchidos originalmente pelo Analista). */
  podeEditarItens: boolean
  /** Cliente e Admin: true. Funcionário: false. */
  podeEditarPropostaComercial: boolean
  salvando?: boolean
  onSalvar: (payload: SalvarPropostaComercialPayload) => Promise<void>
  /** Texto do botão de salvar — varia entre "Confirmar participação"
   *  (Cliente) e "Salvar alterações" (Admin). */
  textoBotaoSalvar?: string
}

/** Input compacto usado dentro das células da tabela — sem label própria
 *  (a coluna do cabeçalho já identifica o campo). */
function InputCelula(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full min-w-[90px] rounded-md border border-ink-soft/25 px-2 py-1.5 font-body text-sm text-ink outline-none focus:border-forest focus:ring-1 focus:ring-forest-mist ${props.className ?? ''}`}
    />
  )
}

export function PropostaComercialTable({
  licitacao,
  podeEditarItens,
  podeEditarPropostaComercial,
  salvando,
  onSalvar,
  textoBotaoSalvar = 'Salvar alterações',
}: PropostaComercialTableProps) {
  const [formPorItem, setFormPorItem] = useState<Record<string, PropostaItemForm>>({})
  const [referenciaPorItem, setReferenciaPorItem] = useState<Record<string, ItemReferenciaForm>>({})
  const [taxaFrete, setTaxaFrete] = useState<number | ''>('')

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
  }, [licitacao])

  function atualizarItem<K extends keyof PropostaItemForm>(itemId: string, campo: K, valor: PropostaItemForm[K]) {
    setFormPorItem((atual) => ({
      ...atual,
      [itemId]: { ...atual[itemId], [campo]: valor },
    }))
  }

  function atualizarReferencia<K extends keyof ItemReferenciaForm>(
    itemId: string,
    campo: K,
    valor: ItemReferenciaForm[K]
  ) {
    setReferenciaPorItem((atual) => ({
      ...atual,
      [itemId]: { ...atual[itemId], [campo]: valor },
    }))
  }

  // Só calcula depois que a Taxa de Frete foi preenchida (mesmo que seja
  // 0) — antes disso, "+ Frete"/"Valor Total"/"%"/Status ficam em branco.
  const taxaPreenchida = taxaFrete !== ''
  const taxaFreteNumero = taxaFrete === '' ? 0 : Number(taxaFrete)

  const analisePorItem = useMemo(() => {
    const mapa: Record<string, ReturnType<typeof calcularAnaliseItem>> = {}
    licitacao.itens.forEach((item) => {
      const form = formPorItem[item.id]
      const precoMinimo = form?.precoMinimo === '' || form?.precoMinimo == null ? undefined : Number(form.precoMinimo)
      // Usa o item "ao vivo" (com o preço mínimo digitado agora) para o
      // cálculo, mesmo que ainda não tenha sido salvo — reflete o que a
      // pessoa está digitando na tela.
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

  function LinhaItem({ item }: { item: ItemLicitacao }) {
    const form = formPorItem[item.id]
    const ref = referenciaPorItem[item.id]
    if (!form || !ref) return null
    const analise = analisePorItem[item.id]
    const status = classificarStatusProposta(analise?.percentualDiferenca ?? null)

    return (
      <tr className="border-t border-ink-soft/10">
        <td className="whitespace-nowrap px-3 py-2 align-top">
          <p className="font-body text-sm font-medium text-ink">{item.numero}</p>
        </td>

        {/* --- Bloco Itens (Referência) --- */}
        <td className="min-w-[220px] px-3 py-2 align-top">
          {podeEditarItens ? (
            <InputCelula value={ref.descricao} onChange={(e) => atualizarReferencia(item.id, 'descricao', e.target.value)} />
          ) : (
            <p className="font-body text-sm text-ink">{item.descricao}</p>
          )}
        </td>
        <td className="px-3 py-2 align-top">
          {podeEditarItens ? (
            <InputCelula
              value={ref.unidadeMedida}
              onChange={(e) => atualizarReferencia(item.id, 'unidadeMedida', e.target.value)}
            />
          ) : (
            <p className="whitespace-nowrap font-body text-sm text-ink-soft">{item.unidadeMedida}</p>
          )}
        </td>
        <td className="px-3 py-2 align-top">
          {podeEditarItens ? (
            <InputCelula
              type="number"
              value={ref.quantidade}
              onChange={(e) => atualizarReferencia(item.id, 'quantidade', Number(e.target.value))}
            />
          ) : (
            <p className="whitespace-nowrap font-body text-sm text-ink-soft">{item.quantidade}</p>
          )}
        </td>
        <td className="px-3 py-2 align-top">
          {podeEditarItens ? (
            <InputCelula
              type="number"
              value={ref.precoReferencia}
              onChange={(e) => atualizarReferencia(item.id, 'precoReferencia', Number(e.target.value))}
            />
          ) : (
            <p className="whitespace-nowrap font-body text-sm text-ink-soft">{formatarMoeda(item.precoReferencia)}</p>
          )}
        </td>

        {/* --- Bloco Proposta Comercial --- */}
        <td className="min-w-[110px] px-3 py-2 align-top">
          {podeEditarPropostaComercial ? (
            <InputCelula
              value={form.codigoInterno}
              onChange={(e) => atualizarItem(item.id, 'codigoInterno', e.target.value)}
            />
          ) : (
            <p className="font-body text-sm text-ink">{form.codigoInterno || '—'}</p>
          )}
        </td>
        <td className="min-w-[200px] px-3 py-2 align-top">
          {podeEditarPropostaComercial ? (
            <InputCelula
              value={form.descricaoProduto}
              onChange={(e) => atualizarItem(item.id, 'descricaoProduto', e.target.value)}
            />
          ) : (
            <p className="font-body text-sm text-ink">{form.descricaoProduto || '—'}</p>
          )}
        </td>
        <td className="min-w-[130px] px-3 py-2 align-top">
          {podeEditarPropostaComercial ? (
            <InputCelula value={form.marca} onChange={(e) => atualizarItem(item.id, 'marca', e.target.value)} />
          ) : (
            <p className="font-body text-sm text-ink">{form.marca || '—'}</p>
          )}
        </td>
        <td className="min-w-[130px] px-3 py-2 align-top">
          {podeEditarPropostaComercial ? (
            <InputCelula value={form.modelo} onChange={(e) => atualizarItem(item.id, 'modelo', e.target.value)} />
          ) : (
            <p className="font-body text-sm text-ink">{form.modelo || '—'}</p>
          )}
        </td>
        <td className="px-3 py-2 align-top">
          {podeEditarPropostaComercial ? (
            <InputCelula
              type="number"
              value={form.precoMinimo}
              onChange={(e) =>
                atualizarItem(item.id, 'precoMinimo', e.target.value === '' ? '' : Number(e.target.value))
              }
            />
          ) : (
            <p className="whitespace-nowrap font-body text-sm text-ink">
              {form.precoMinimo !== '' ? formatarMoeda(Number(form.precoMinimo)) : '—'}
            </p>
          )}
        </td>
        <td className="whitespace-nowrap px-3 py-2 align-top font-body text-sm text-ink">
          {analise?.precoComFrete != null ? formatarMoeda(analise.precoComFrete) : '—'}
        </td>
        <td className="whitespace-nowrap px-3 py-2 align-top font-body text-sm font-medium text-forest-deep">
          {analise?.valorTotal != null ? formatarMoeda(analise.valorTotal) : '—'}
        </td>

        {/* --- Bloco Análise da Proposta (sempre calculado, nunca editável) --- */}
        <td className="whitespace-nowrap px-3 py-2 align-top font-body text-sm text-ink-soft">
          {analise?.percentualDiferenca != null ? `${(analise.percentualDiferenca * 100).toFixed(1)}%` : '—'}
        </td>
        <td className="whitespace-nowrap px-3 py-2 align-top">
          <span className={`rounded-full px-2.5 py-1 font-body text-xs font-medium ${status.classe}`}>
            {status.label}
          </span>
        </td>
      </tr>
    )
  }

  const itensIndividuais = licitacao.itens.filter((i) => !i.grupoId)
  const podeEditarAlgumaCoisa = podeEditarItens || podeEditarPropostaComercial

  return (
    <div className="space-y-5">
      <p className="font-body text-sm text-ink-soft">
        {podeEditarPropostaComercial
          ? 'Preencha o preço mínimo de cada item e a taxa de frete que você quer aplicar. Os cálculos de valor com frete e a análise de competitividade só aparecem depois que a taxa de frete for preenchida.'
          : 'Visualização da proposta comercial preenchida e da análise de competitividade, calculada automaticamente.'}
      </p>

      <div className="rounded-lg border border-ink-soft/15 bg-paper-2/40 p-4">
        {podeEditarPropostaComercial ? (
          <>
            <TextField
              label="Taxa de frete (%)"
              type="number"
              value={taxaFrete}
              onChange={(e) => setTaxaFrete(e.target.value === '' ? '' : Number(e.target.value))}
              className="max-w-xs"
              placeholder="Ex: 5"
            />
            <p className="mt-1.5 font-body text-xs text-ink-soft">
              Aplicada automaticamente a todos os itens. Preencha com 0 se não for cobrar frete — os totais só
              aparecem depois de preenchida.
            </p>
          </>
        ) : (
          <p className="font-body text-sm text-ink">
            <span className="font-mono text-xs uppercase tracking-wide text-ink-soft">Taxa de frete: </span>
            {taxaFrete !== '' ? `${taxaFrete}%` : 'Não preenchida ainda'}
          </p>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-ink-soft/15">
        <table className="w-full font-body text-sm">
          <thead className="bg-paper-2 text-left text-xs uppercase tracking-wide text-ink-soft">
            <tr>
              <th rowSpan={2} className="whitespace-nowrap border-r border-ink-soft/10 px-3 py-2 align-bottom">
                Item
              </th>
              <th colSpan={4} className="whitespace-nowrap border-r border-ink-soft/10 px-3 py-2 text-center">
                Itens (Referência)
              </th>
              <th colSpan={5} className="whitespace-nowrap border-r border-ink-soft/10 px-3 py-2 text-center">
                Proposta Comercial
              </th>
              <th colSpan={2} className="whitespace-nowrap px-3 py-2 text-center">
                Análise da Proposta
              </th>
            </tr>
            <tr>
              <th className="whitespace-nowrap px-3 py-2">Descrição</th>
              <th className="whitespace-nowrap px-3 py-2">Unid.</th>
              <th className="whitespace-nowrap px-3 py-2">Quant.</th>
              <th className="whitespace-nowrap border-r border-ink-soft/10 px-3 py-2">Valor Unit. Ref.</th>
              <th className="whitespace-nowrap px-3 py-2">Cód. Produto</th>
              <th className="whitespace-nowrap px-3 py-2">Descrição</th>
              <th className="whitespace-nowrap px-3 py-2">Fabricante</th>
              <th className="whitespace-nowrap px-3 py-2">Modelo</th>
              <th className="whitespace-nowrap border-r border-ink-soft/10 px-3 py-2">Preço Mínimo (R$)</th>
              <th className="whitespace-nowrap px-3 py-2">Diferença</th>
              <th className="whitespace-nowrap px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {licitacao.grupos.map((grupo) => {
              const itensDoGrupo = licitacao.itens.filter((i) => i.grupoId === grupo.id)
              return (
                <>
                  <tr key={`grupo-${grupo.id}`} className="border-t border-ink-soft/10 bg-forest-mist/30">
                    <td colSpan={12} className="px-3 py-2 font-body text-sm font-semibold text-forest-deep">
                      {grupo.numero} — {grupo.nome}
                    </td>
                  </tr>
                  {itensDoGrupo.map((item) => (
                    <LinhaItem key={item.id} item={item} />
                  ))}
                </>
              )
            })}

            {itensIndividuais.length > 0 && licitacao.grupos.length > 0 && (
              <tr className="border-t border-ink-soft/10 bg-paper-2/60">
                <td colSpan={12} className="px-3 py-2 font-body text-sm font-semibold text-ink">
                  Itens individuais
                </td>
              </tr>
            )}

            {itensIndividuais.map((item) => (
              <LinhaItem key={item.id} item={item} />
            ))}

            {licitacao.itens.length === 0 && (
              <tr>
                <td colSpan={12} className="px-3 py-6 text-center font-body text-sm italic text-ink-soft">
                  Nenhum item cadastrado nesta licitação ainda.
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
