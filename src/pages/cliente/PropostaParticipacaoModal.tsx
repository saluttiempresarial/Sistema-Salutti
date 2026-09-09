// src/pages/cliente/PropostaParticipacaoModal.tsx
//
// Aberto pelo Portal do Cliente ao clicar "Quero Participar" — estrutura
// alinhada 1:1 com a planilha real da Salutti (aba "Produtos", blocos
// "Proposta Comercial" e "Análise da Proposta"), agora em formato de
// TABELA (linhas/colunas), igual à planilha, em vez de cartões empilhados.
//
// - Itens agrupados por Lote/Grupo (linha de cabeçalho de grupo dentro da
//   própria tabela), com uma seção separada para itens individuais.
// - Por item: Código do Produto, Fabricante, Modelo, Preço Mínimo (R$) —
//   os únicos campos que o cliente preenche. Quantidade é fixa (vem da
//   Análise do Edital) — não editável aqui.
// - Taxa de Frete: UM campo só, no topo, preenchido pelo próprio cliente
//   "conforme ele quer" — aplicado a todos os itens.
// - IMPORTANTE: "+ Frete", "Valor Total", "% vs. Referência" e o Status só
//   são calculados DEPOIS que o cliente preencher a Taxa de Frete (mesmo
//   que seja 0) — antes disso, ficam como "—", para deixar claro que o
//   frete ainda não entrou na conta.

import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { Licitacao, ItemLicitacao, PropostaClienteItem } from '@/types/licitacao'
import { formatarMoeda } from '@/utils/prazoUtils'

interface PropostaItemForm {
  codigoInterno: string
  marca: string
  modelo: string
  precoMinimo: number | ''
}

function formVazioParaItem(item: ItemLicitacao): PropostaItemForm {
  const atual = item.propostaCliente
  return {
    codigoInterno: atual?.codigoInterno ?? '',
    marca: atual?.marca ?? '',
    modelo: atual?.modelo ?? '',
    precoMinimo: atual?.precoMinimo ?? '',
  }
}

/** Classificação de competitividade — mesmos limiares e textos da
 *  planilha real (coluna "Análise da Proposta"). */
function classificarStatus(percentualDiferenca: number | null): { label: string; classe: string } {
  if (percentualDiferenca === null) {
    return { label: '—', classe: 'bg-paper-2 text-ink-soft' }
  }
  if (percentualDiferenca === 0) {
    return { label: '= Referência', classe: 'bg-paper-2 text-ink-soft' }
  }
  if (percentualDiferenca < 0) {
    if (percentualDiferenca <= -0.4) {
      return { label: '🚀 Forte', classe: 'bg-forest text-white' }
    }
    return { label: '⚖️ Positiva', classe: 'bg-forest-mist text-forest-deep' }
  }
  return { label: '❌ Não participar', classe: 'bg-red-50 text-red-700' }
}

interface PropostaParticipacaoModalProps {
  isOpen: boolean
  onClose: () => void
  licitacao: Licitacao | null
  carregando?: boolean
  salvando?: boolean
  onConfirmar: (
    propostas: Array<{ id: string; propostaCliente: PropostaClienteItem }>,
    incluirFrete: boolean,
    percentualFrete?: number
  ) => Promise<void>
}

/** Input compacto usado dentro das células da tabela — sem label própria
 *  (a coluna do cabeçalho já identifica o campo). */
function InputCelula(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full min-w-[90px] rounded-md border border-ink-soft/25 px-2 py-1.5 font-body text-sm text-ink outline-none focus:border-forest focus:ring-1 focus:ring-forest-mist"
    />
  )
}

export function PropostaParticipacaoModal({
  isOpen,
  onClose,
  licitacao,
  carregando,
  salvando,
  onConfirmar,
}: PropostaParticipacaoModalProps) {
  const [formPorItem, setFormPorItem] = useState<Record<string, PropostaItemForm>>({})
  const [taxaFrete, setTaxaFrete] = useState<number | ''>('')

  useEffect(() => {
    if (!licitacao) return
    const inicial: Record<string, PropostaItemForm> = {}
    licitacao.itens.forEach((item) => {
      inicial[item.id] = formVazioParaItem(item)
    })
    setFormPorItem(inicial)
    setTaxaFrete(licitacao.percentualFrete ?? '')
  }, [licitacao])

  function atualizarItem<K extends keyof PropostaItemForm>(itemId: string, campo: K, valor: PropostaItemForm[K]) {
    setFormPorItem((atual) => ({
      ...atual,
      [itemId]: { ...atual[itemId], [campo]: valor },
    }))
  }

  // Só calcula depois que a Taxa de Frete foi preenchida (mesmo que seja
  // 0) — antes disso, "+ Frete"/"Valor Total"/"%"/Status ficam em branco,
  // para deixar claro que o frete ainda não entrou na conta.
  const taxaPreenchida = taxaFrete !== ''
  const taxaFreteNumero = taxaFrete === '' ? 0 : Number(taxaFrete)

  const analisePorItem = useMemo(() => {
    const mapa: Record<
      string,
      { precoComFrete: number | null; valorTotal: number | null; percentualDiferenca: number | null }
    > = {}
    if (!licitacao) return mapa
    licitacao.itens.forEach((item) => {
      const form = formPorItem[item.id]
      const precoMinimo = form?.precoMinimo === '' || form?.precoMinimo == null ? null : Number(form.precoMinimo)
      if (!taxaPreenchida || precoMinimo == null) {
        mapa[item.id] = { precoComFrete: null, valorTotal: null, percentualDiferenca: null }
        return
      }
      const precoComFrete = precoMinimo * (1 + taxaFreteNumero / 100)
      const valorTotal = precoComFrete * item.quantidade
      const percentualDiferenca = item.precoReferencia > 0 ? precoComFrete / item.precoReferencia - 1 : null
      mapa[item.id] = { precoComFrete, valorTotal, percentualDiferenca }
    })
    return mapa
  }, [licitacao, formPorItem, taxaFreteNumero, taxaPreenchida])

  async function handleConfirmar() {
    if (!licitacao) return
    const propostas = licitacao.itens.map((item) => {
      const form = formPorItem[item.id]
      const propostaCliente: PropostaClienteItem = {
        codigoInterno: form.codigoInterno || undefined,
        marca: form.marca || undefined,
        modelo: form.modelo || undefined,
        precoMinimo: form.precoMinimo === '' ? undefined : Number(form.precoMinimo),
      }
      return { id: item.id, propostaCliente }
    })

    await onConfirmar(propostas, taxaFreteNumero > 0, taxaFreteNumero > 0 ? taxaFreteNumero : undefined)
  }

  function LinhaItem({ item }: { item: ItemLicitacao }) {
    const form = formPorItem[item.id]
    if (!form) return null
    const analise = analisePorItem[item.id]
    const status = classificarStatus(analise?.percentualDiferenca ?? null)

    return (
      <tr className="border-t border-ink-soft/10">
        <td className="whitespace-nowrap px-3 py-2 align-top">
          <p className="font-body text-sm font-medium text-ink">{item.numero}</p>
          <p className="mt-0.5 font-body text-xs text-ink-soft">
            {item.quantidade} {item.unidadeMedida}
          </p>
        </td>
        <td className="whitespace-nowrap px-3 py-2 align-top font-body text-sm text-ink-soft">
          {formatarMoeda(item.precoReferencia)}
        </td>
        <td className="px-3 py-2 align-top">
          <InputCelula
            value={form.codigoInterno}
            onChange={(e) => atualizarItem(item.id, 'codigoInterno', e.target.value)}
          />
        </td>
        <td className="px-3 py-2 align-top">
          <InputCelula value={form.marca} onChange={(e) => atualizarItem(item.id, 'marca', e.target.value)} />
        </td>
        <td className="px-3 py-2 align-top">
          <InputCelula value={form.modelo} onChange={(e) => atualizarItem(item.id, 'modelo', e.target.value)} />
        </td>
        <td className="px-3 py-2 align-top">
          <InputCelula
            type="number"
            value={form.precoMinimo}
            onChange={(e) =>
              atualizarItem(item.id, 'precoMinimo', e.target.value === '' ? '' : Number(e.target.value))
            }
          />
        </td>
        <td className="whitespace-nowrap px-3 py-2 align-top font-body text-sm text-ink">
          {analise?.precoComFrete != null ? formatarMoeda(analise.precoComFrete) : '—'}
        </td>
        <td className="whitespace-nowrap px-3 py-2 align-top font-body text-sm font-medium text-forest-deep">
          {analise?.valorTotal != null ? formatarMoeda(analise.valorTotal) : '—'}
        </td>
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

  const itensIndividuais = licitacao?.itens.filter((i) => !i.grupoId) ?? []

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={licitacao ? `Sua proposta — ${licitacao.numeroPregao}` : 'Sua proposta'}
      size="xl"
      footer={
        carregando || !licitacao ? undefined : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmar} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Confirmar participação'}
            </Button>
          </>
        )
      }
    >
      {carregando || !licitacao ? (
        <div className="flex min-h-[280px] items-center justify-center">
          <p className="font-body text-sm text-ink-soft">Carregando itens...</p>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="font-body text-sm text-ink-soft">
            Preencha o preço mínimo de cada item e a taxa de frete que você quer aplicar. Os cálculos de valor com
            frete e a análise de competitividade só aparecem depois que a taxa de frete for preenchida.
          </p>

          <div className="rounded-lg border border-ink-soft/15 bg-paper-2/40 p-4">
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
          </div>

          <div className="overflow-x-auto rounded-xl border border-ink-soft/15">
            <table className="w-full font-body text-sm">
              <thead className="bg-paper-2 text-left text-xs uppercase tracking-wide text-ink-soft">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2">Item / Qtde</th>
                  <th className="whitespace-nowrap px-3 py-2">Referência</th>
                  <th className="whitespace-nowrap px-3 py-2">Cód. Produto</th>
                  <th className="whitespace-nowrap px-3 py-2">Fabricante</th>
                  <th className="whitespace-nowrap px-3 py-2">Modelo</th>
                  <th className="whitespace-nowrap px-3 py-2">Preço Mínimo (R$)</th>
                  <th className="whitespace-nowrap px-3 py-2">+ Frete</th>
                  <th className="whitespace-nowrap px-3 py-2">Valor Total</th>
                  <th className="whitespace-nowrap px-3 py-2">% vs. Ref.</th>
                  <th className="whitespace-nowrap px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {licitacao.grupos.map((grupo) => {
                  const itensDoGrupo = licitacao.itens.filter((i) => i.grupoId === grupo.id)
                  return (
                    <>
                      <tr key={`grupo-${grupo.id}`} className="border-t border-ink-soft/10 bg-forest-mist/30">
                        <td colSpan={10} className="px-3 py-2 font-body text-sm font-semibold text-forest-deep">
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
                    <td colSpan={10} className="px-3 py-2 font-body text-sm font-semibold text-ink">
                      Itens individuais
                    </td>
                  </tr>
                )}

                {itensIndividuais.map((item) => (
                  <LinhaItem key={item.id} item={item} />
                ))}

                {licitacao.itens.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-6 text-center font-body text-sm italic text-ink-soft">
                      Nenhum item cadastrado nesta licitação ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  )
}
