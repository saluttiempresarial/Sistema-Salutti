// src/pages/cliente/LicitacaoDetalheModal.tsx
//
// Visualização completa e em modo leitura de uma licitação, aberta pelo
// Cliente no Portal do Cliente (ClienteDashboard.tsx). Mesmo conteúdo que
// o Administrador vê no LicitacaoFormModal (Informações Gerais,
// Habilitação, Condições Comerciais, Itens) — só que sem nenhum campo
// editável, e sem a aba "Pontos de Atenção" (notas internas da Salutti,
// não destinadas ao cliente).

import { useState } from 'react'
import { Modal } from '@/components/Modal'
import { Tabs } from '@/components/Tabs'
import { Button } from '@/components/Button'
import {
  Licitacao,
  ItemLicitacao,
  ModalidadeLicitacao,
  MODALIDADE_LICITACAO_LABEL,
  FormaPagamento,
  FORMA_PAGAMENTO_LABEL,
} from '@/types/licitacao'
import { formatarDataHora, formatarMoeda } from '@/utils/prazoUtils'
import { totalReferenciaItem, totalReferenciaGrupo, totalReferenciaOportunidade } from '@/utils/licitacaoCalculos'

const TABS = [
  { id: 'gerais', label: 'Informações Gerais' },
  { id: 'habilitacao', label: 'Habilitação' },
  { id: 'comerciais', label: 'Cond. Comerciais' },
  { id: 'itens', label: 'Itens' },
]

interface LicitacaoDetalheModalProps {
  isOpen: boolean
  onClose: () => void
  licitacao: Licitacao | null
  carregando?: boolean
}

function Campo({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-0.5 font-body text-sm text-ink">{value}</p>
    </div>
  )
}

function ItemLeitura({ item }: { item: ItemLicitacao }) {
  return (
    <div className="rounded-lg bg-paper-2/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-body text-sm font-semibold text-ink">Item {item.numero}</p>
          <p className="mt-0.5 font-body text-xs text-ink-soft">
            {item.quantidade} {item.unidadeMedida} × {formatarMoeda(item.precoReferencia)}
            {item.exclusivoMeEpp && ' · Exclusivo ME/EPP'}
          </p>
        </div>
        <p className="font-body text-sm font-medium text-forest-deep">{formatarMoeda(totalReferenciaItem(item))}</p>
      </div>
      {item.descricao && (
        <div className="mt-3 border-t border-ink-soft/10 pt-3">
          <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Descrição</p>
          <p className="mt-1 whitespace-pre-line font-body text-sm leading-relaxed text-ink-soft">
            {item.descricao}
          </p>
        </div>
      )}
    </div>
  )
}

export function LicitacaoDetalheModal({ isOpen, onClose, licitacao, carregando }: LicitacaoDetalheModalProps) {
  const [abaAtiva, setAbaAtiva] = useState('gerais')

  const itensIndividuais = licitacao?.itens.filter((i) => !i.grupoId) ?? []

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={licitacao ? `${licitacao.numeroPregao} — ${licitacao.orgao}` : 'Detalhes da licitação'}
      size="xl"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      {carregando || !licitacao ? (
        <div className="flex min-h-[320px] items-center justify-center">
          <p className="font-body text-sm text-ink-soft">Carregando detalhes...</p>
        </div>
      ) : (
        <>
          <Tabs tabs={TABS} activeTab={abaAtiva} onChange={setAbaAtiva} />

          <div className="mt-5 min-h-[320px] space-y-5">
            {abaAtiva === 'gerais' && (
              <div className="grid grid-cols-2 gap-4">
                <Campo
                  label="Data e horário da sessão"
                  value={formatarDataHora(licitacao.dataEfetivaLicitacao || licitacao.dataLicitacao)}
                />
                <Campo label="Portal" value={licitacao.portal} />
                <Campo label="Órgão" value={licitacao.orgao} />
                <Campo label="Estado / Município" value={`${licitacao.municipio}/${licitacao.estado}`} />
                <div className="col-span-2">
                  <Campo label="Objeto" value={licitacao.objeto} />
                </div>
                <Campo
                  label="Modalidade"
                  value={MODALIDADE_LICITACAO_LABEL[licitacao.modalidade as ModalidadeLicitacao] ?? licitacao.modalidade}
                />
                <Campo
                  label="Valor total"
                  value={licitacao.valorTotalLicitacao != null ? formatarMoeda(licitacao.valorTotalLicitacao) : 'Sigiloso'}
                />
                {licitacao.linkEdital && (
                  <div className="col-span-2">
                    <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Link do edital</p>
                    <a
                      href={licitacao.linkEdital}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 block break-all font-body text-sm text-forest underline"
                    >
                      {licitacao.linkEdital}
                    </a>
                  </div>
                )}
              </div>
            )}

            {abaAtiva === 'habilitacao' && (
              <div className="space-y-4">
                <Campo label="Qualificação técnica" value={licitacao.habilitacao.qualificacaoTecnica} />
                <Campo
                  label="Qualificação econômico-financeira"
                  value={licitacao.habilitacao.qualificacaoEconomicoFinanceira}
                />
                <Campo label="Regularidade fiscal e trabalhista" value={licitacao.habilitacao.regularidadeFiscal} />
                <Campo label="Exigência de atestado" value={licitacao.habilitacao.exigeAtestado} />
                <Campo label="Exigência de amostras" value={licitacao.habilitacao.exigeAmostras} />
                <Campo label="Outros requisitos" value={licitacao.habilitacao.outrosRequisitos} />
                {!licitacao.habilitacao.qualificacaoTecnica &&
                  !licitacao.habilitacao.qualificacaoEconomicoFinanceira &&
                  !licitacao.habilitacao.regularidadeFiscal &&
                  !licitacao.habilitacao.exigeAtestado &&
                  !licitacao.habilitacao.exigeAmostras &&
                  !licitacao.habilitacao.outrosRequisitos && (
                    <p className="font-body text-sm italic text-ink-soft">Nenhuma exigência registrada ainda.</p>
                  )}
              </div>
            )}

            {abaAtiva === 'comerciais' && (
              <div className="grid grid-cols-2 gap-4">
                <Campo label="Intervalo de lances" value={licitacao.condicoesComerciais.intervaloLances} />
                <Campo
                  label="Forma de pagamento"
                  value={
                    FORMA_PAGAMENTO_LABEL[licitacao.condicoesComerciais.formaPagamento as FormaPagamento] ??
                    licitacao.condicoesComerciais.formaPagamento
                  }
                />
                <Campo label="Recebimento em qual banco" value={licitacao.condicoesComerciais.recebimentoBanco} />
                <Campo
                  label="Prazo de pagamento"
                  value={
                    licitacao.condicoesComerciais.prazoPagamentoDias
                      ? `${licitacao.condicoesComerciais.prazoPagamentoDias} dias`
                      : undefined
                  }
                />
                <Campo
                  label="Prazo de entrega"
                  value={
                    licitacao.condicoesComerciais.prazoEntregaDias
                      ? `${licitacao.condicoesComerciais.prazoEntregaDias} dias`
                      : undefined
                  }
                />
                <Campo
                  label="Validade da proposta"
                  value={
                    licitacao.condicoesComerciais.validadePropostaDias
                      ? `${licitacao.condicoesComerciais.validadePropostaDias} dias`
                      : undefined
                  }
                />
                <div className="col-span-2">
                  <Campo label="Local de entrega" value={licitacao.condicoesComerciais.localEntrega} />
                </div>
                {licitacao.condicoesComerciais.possuiGarantias && (
                  <div className="col-span-2">
                    <Campo label="Garantias" value={licitacao.condicoesComerciais.garantiasDetalhe || 'Sim'} />
                  </div>
                )}
              </div>
            )}

            {abaAtiva === 'itens' && (
              <div className="space-y-4">
                {licitacao.grupos.map((grupo) => {
                  const itensDoGrupo = licitacao.itens.filter((i) => i.grupoId === grupo.id)
                  return (
                    <div key={grupo.id} className="rounded-xl border border-ink-soft/15 p-4">
                      <p className="mb-3 font-body text-sm font-semibold text-ink">
                        {grupo.numero} — {grupo.nome}
                      </p>
                      <div className="space-y-2">
                        {itensDoGrupo.map((item) => (
                          <ItemLeitura key={item.id} item={item} />
                        ))}
                        {itensDoGrupo.length === 0 && (
                          <p className="font-body text-xs italic text-ink-soft">Nenhum item neste grupo.</p>
                        )}
                      </div>
                      <p className="mt-3 text-right font-body text-sm font-medium text-forest-deep">
                        Total do grupo: {formatarMoeda(totalReferenciaGrupo(licitacao.itens, grupo.id))}
                      </p>
                    </div>
                  )
                })}

                {(itensIndividuais.length > 0 || licitacao.grupos.length === 0) && (
                  <div className="rounded-xl border border-ink-soft/15 p-4">
                    <p className="mb-3 font-body text-sm font-semibold text-ink">Itens individuais</p>
                    <div className="space-y-2">
                      {itensIndividuais.map((item) => (
                        <ItemLeitura key={item.id} item={item} />
                      ))}
                      {itensIndividuais.length === 0 && (
                        <p className="font-body text-xs italic text-ink-soft">Nenhum item individual ainda.</p>
                      )}
                    </div>
                  </div>
                )}

                {licitacao.itens.length > 0 && (
                  <div className="rounded-xl border border-forest/30 bg-forest-mist px-4 py-3 text-right">
                    <span className="font-body text-sm font-semibold text-forest-deep">
                      Total da oportunidade: {formatarMoeda(totalReferenciaOportunidade(licitacao.itens))}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </Modal>
  )
}
