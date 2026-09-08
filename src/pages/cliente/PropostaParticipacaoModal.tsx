// src/pages/cliente/PropostaParticipacaoModal.tsx
//
// Aberto pelo Portal do Cliente ao clicar "Quero Participar" — estrutura
// alinhada 1:1 com a planilha real da Salutti (aba "Produtos", blocos
// "Proposta Comercial" e "Análise da Proposta"):
//
// - Itens agrupados por Lote/Grupo (igual o cadastro do Admin), com uma
//   seção separada para itens individuais.
// - Por item: Código do Produto, Fabricante, Modelo, Preço Mínimo (R$) —
//   os únicos campos que o cliente preenche. Quantidade é fixa (vem da
//   Análise do Edital, feita pelo Admin/Funcionário) — não editável aqui.
// - Taxa de Frete: UM campo só, no topo, preenchido pelo próprio cliente
//   "conforme ele quer" — aplicado automaticamente a todos os itens ao
//   calcular "Preço + Frete" e "Valor Total".
// - Análise da Proposta: calculada ao vivo por item — % de diferença do
//   preço (com frete) vs. o valor de referência do edital, e um status
//   (🚀 Forte / ⚖️ Positiva / ❌ Não participar / = Referência), com os
//   mesmos limiares de classificação da planilha (querda de +40% = Forte).

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

  const taxaFreteNumero = taxaFrete === '' ? 0 : Number(taxaFrete)

  const analisePorItem = useMemo(() => {
    const mapa: Record<string, { precoComFrete: number | null; valorTotal: number | null; percentualDiferenca: number | null }> = {}
    if (!licitacao) return mapa
    licitacao.itens.forEach((item) => {
      const form = formPorItem[item.id]
      const precoMinimo = form?.precoMinimo === '' || form?.precoMinimo == null ? null : Number(form.precoMinimo)
      if (precoMinimo == null) {
        mapa[item.id] = { precoComFrete: null, valorTotal: null, percentualDiferenca: null }
        return
      }
      const precoComFrete = precoMinimo * (1 + taxaFreteNumero / 100)
      const valorTotal = precoComFrete * item.quantidade
      const percentualDiferenca = item.precoReferencia > 0 ? precoComFrete / item.precoReferencia - 1 : null
      mapa[item.id] = { precoComFrete, valorTotal, percentualDiferenca }
    })
    return mapa
  }, [licitacao, formPorItem, taxaFreteNumero])

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

  function renderItem(item: ItemLicitacao) {
    const form = formPorItem[item.id]
    if (!form) return null
    const analise = analisePorItem[item.id]
    const status = classificarStatus(analise?.percentualDiferenca ?? null)

    return (
      <div key={item.id} className="rounded-lg border border-ink-soft/15 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-body text-sm font-semibold text-ink">Item {item.numero}</p>
            <p className="mt-0.5 font-body text-xs text-ink-soft">
              Qtde: {item.quantidade} {item.unidadeMedida} · Referência: {formatarMoeda(item.precoReferencia)}
            </p>
          </div>
          <span className={`rounded-full px-2.5 py-1 font-body text-xs font-medium ${status.classe}`}>
            {status.label}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <TextField
            label="Cód. do produto"
            value={form.codigoInterno}
            onChange={(e) => atualizarItem(item.id, 'codigoInterno', e.target.value)}
          />
          <TextField
            label="Fabricante"
            value={form.marca}
            onChange={(e) => atualizarItem(item.id, 'marca', e.target.value)}
          />
          <TextField
            label="Modelo"
            value={form.modelo}
            onChange={(e) => atualizarItem(item.id, 'modelo', e.target.value)}
          />
          <TextField
            label="Preço mínimo (R$)"
            type="number"
            value={form.precoMinimo}
            onChange={(e) =>
              atualizarItem(item.id, 'precoMinimo', e.target.value === '' ? '' : Number(e.target.value))
            }
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-ink-soft/10 pt-3 sm:grid-cols-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">+ Frete</p>
            <p className="mt-0.5 font-body text-sm text-ink">
              {analise?.precoComFrete != null ? formatarMoeda(analise.precoComFrete) : '—'}
            </p>
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Valor total</p>
            <p className="mt-0.5 font-body text-sm font-medium text-forest-deep">
              {analise?.valorTotal != null ? formatarMoeda(analise.valorTotal) : '—'}
            </p>
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">% vs. referência</p>
            <p className="mt-0.5 font-body text-sm text-ink">
              {analise?.percentualDiferenca != null ? `${(analise.percentualDiferenca * 100).toFixed(1)}%` : '—'}
            </p>
          </div>
        </div>
      </div>
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
            Preencha o preço mínimo de cada item e a taxa de frete que você quer aplicar. O sistema calcula
            automaticamente o valor com frete e mostra o quão competitiva sua proposta fica frente ao valor de
            referência do edital.
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
              Aplicada automaticamente a todos os itens abaixo. Deixe em branco ou 0 se não for cobrar frete.
            </p>
          </div>

          <div className="space-y-4">
            {licitacao.grupos.map((grupo) => {
              const itensDoGrupo = licitacao.itens.filter((i) => i.grupoId === grupo.id)
              return (
                <div key={grupo.id} className="rounded-xl border border-ink-soft/15 p-4">
                  <p className="mb-3 font-body text-sm font-semibold text-ink">
                    {grupo.numero} — {grupo.nome}
                  </p>
                  <div className="space-y-3">{itensDoGrupo.map(renderItem)}</div>
                </div>
              )
            })}

            {(itensIndividuais.length > 0 || licitacao.grupos.length === 0) && (
              <div className="space-y-3">
                {licitacao.grupos.length > 0 && (
                  <p className="font-body text-sm font-semibold text-ink">Itens individuais</p>
                )}
                {itensIndividuais.map(renderItem)}
              </div>
            )}

            {licitacao.itens.length === 0 && (
              <p className="font-body text-sm italic text-ink-soft">Nenhum item cadastrado nesta licitação ainda.</p>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
