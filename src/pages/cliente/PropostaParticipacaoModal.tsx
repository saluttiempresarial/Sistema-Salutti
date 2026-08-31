// src/pages/cliente/PropostaParticipacaoModal.tsx
//
// Aberto pelo Portal do Cliente ao clicar "Quero Participar" — o cliente
// preenche, por item, a quantidade que está de fato ofertando (pode
// diferir da quantidade do edital), o valor inicial/ideal de venda e o
// valor mínimo que autoriza a Salutti a negociar durante a disputa ao
// vivo (piso para os lances), além de marca e modelo. No final, indica se
// deseja incluir frete, antes de confirmar a participação.

import { useEffect, useState } from 'react'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { CheckboxField } from '@/components/CheckboxField'
import { Licitacao, ItemLicitacao, PropostaClienteItem } from '@/types/licitacao'
import { formatarMoeda } from '@/utils/prazoUtils'

interface PropostaItemForm {
  quantidadeOfertada: number | ''
  valorInicial: number | ''
  precoMinimo: number | ''
  marca: string
  modelo: string
}

function formVazioParaItem(item: ItemLicitacao): PropostaItemForm {
  const atual = item.propostaCliente
  return {
    quantidadeOfertada: atual?.quantidadeOfertada ?? item.quantidade,
    valorInicial: atual?.valorInicial ?? '',
    precoMinimo: atual?.precoMinimo ?? '',
    marca: atual?.marca ?? '',
    modelo: atual?.modelo ?? '',
  }
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
  const [incluirFrete, setIncluirFrete] = useState(false)
  const [percentualFrete, setPercentualFrete] = useState<number | ''>('')

  useEffect(() => {
    if (!licitacao) return
    const inicial: Record<string, PropostaItemForm> = {}
    licitacao.itens.forEach((item) => {
      inicial[item.id] = formVazioParaItem(item)
    })
    setFormPorItem(inicial)
    setIncluirFrete(licitacao.cobrarFrete ?? false)
    setPercentualFrete(licitacao.percentualFrete ?? '')
  }, [licitacao])

  function atualizarItem<K extends keyof PropostaItemForm>(itemId: string, campo: K, valor: PropostaItemForm[K]) {
    setFormPorItem((atual) => ({
      ...atual,
      [itemId]: { ...atual[itemId], [campo]: valor },
    }))
  }

  async function handleConfirmar() {
    if (!licitacao) return
    const propostas = licitacao.itens.map((item) => {
      const form = formPorItem[item.id]
      const propostaCliente: PropostaClienteItem = {
        quantidadeOfertada: form.quantidadeOfertada === '' ? undefined : Number(form.quantidadeOfertada),
        valorInicial: form.valorInicial === '' ? undefined : Number(form.valorInicial),
        precoMinimo: form.precoMinimo === '' ? undefined : Number(form.precoMinimo),
        marca: form.marca || undefined,
        modelo: form.modelo || undefined,
      }
      return { id: item.id, propostaCliente }
    })

    await onConfirmar(
      propostas,
      incluirFrete,
      incluirFrete && percentualFrete !== '' ? Number(percentualFrete) : undefined
    )
  }

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
            Preencha o que você quer ofertar para cada item. O valor mínimo é o piso que você autoriza a Salutti a
            negociar durante a disputa — já considerando o frete, se for cobrar.
          </p>

          <div className="space-y-4">
            {licitacao.itens.map((item) => {
              const form = formPorItem[item.id]
              if (!form) return null
              return (
                <div key={item.id} className="rounded-lg border border-ink-soft/15 p-4">
                  <p className="font-body text-sm font-semibold text-ink">
                    {item.numero} — {item.descricao}
                  </p>
                  <p className="mt-0.5 font-body text-xs text-ink-soft">
                    Solicitado no edital: {item.quantidade} {item.unidadeMedida} · Referência:{' '}
                    {formatarMoeda(item.precoReferencia)}
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <TextField
                      label="Quantidade ofertada"
                      type="number"
                      value={form.quantidadeOfertada}
                      onChange={(e) =>
                        atualizarItem(
                          item.id,
                          'quantidadeOfertada',
                          e.target.value === '' ? '' : Number(e.target.value)
                        )
                      }
                    />
                    <TextField
                      label="Valor inicial (R$)"
                      type="number"
                      value={form.valorInicial}
                      onChange={(e) =>
                        atualizarItem(item.id, 'valorInicial', e.target.value === '' ? '' : Number(e.target.value))
                      }
                    />
                    <TextField
                      label="Valor mínimo (R$)"
                      type="number"
                      value={form.precoMinimo}
                      onChange={(e) =>
                        atualizarItem(item.id, 'precoMinimo', e.target.value === '' ? '' : Number(e.target.value))
                      }
                    />
                    <TextField
                      label="Marca/Fabricante"
                      value={form.marca}
                      onChange={(e) => atualizarItem(item.id, 'marca', e.target.value)}
                    />
                    <TextField
                      label="Modelo/Versão"
                      value={form.modelo}
                      onChange={(e) => atualizarItem(item.id, 'modelo', e.target.value)}
                    />
                  </div>
                </div>
              )
            })}

            {licitacao.itens.length === 0 && (
              <p className="font-body text-sm italic text-ink-soft">Nenhum item cadastrado nesta licitação ainda.</p>
            )}
          </div>

          <div className="space-y-3 border-t border-ink-soft/10 pt-4">
            <CheckboxField
              label="Incluir frete?"
              checked={incluirFrete}
              onChange={(e) => setIncluirFrete(e.target.checked)}
            />
            {incluirFrete && (
              <TextField
                label="Percentual de frete (%)"
                type="number"
                value={percentualFrete}
                onChange={(e) => setPercentualFrete(e.target.value === '' ? '' : Number(e.target.value))}
                className="max-w-xs"
              />
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
