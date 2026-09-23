// src/pages/cliente/LicitacaoDetalhePage.tsx
//
// Tela cheia com os detalhes completos de uma licitação, aberta pelo
// Cliente ao clicar numa linha da tabela do Dashboard (substitui o antigo
// modal de leitura — agora é uma página própria, com rota /cliente/licitacoes/:id).
// Mesmo conteúdo que o Administrador vê no LicitacaoFormModal (Informações
// Gerais, Habilitação, Condições Comerciais, Itens) em modo leitura — sem a
// aba "Pontos de Atenção" (notas internas da Salutti) — mais os botões de
// decisão (Quero Participar / Não vou participar) no rodapé.
//
// "Quero Participar" navega para /cliente/licitacoes/:id/proposta — página
// própria com a tabela de Proposta Comercial (deixou de ser um modal por
// cima desta página: a tabela, igual à planilha real da Salutti, tem
// colunas demais para caber num popup).

import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DashboardShell } from '@/components/DashboardShell'
import { useAuth } from '@/context/AuthContext'
import { Tabs } from '@/components/Tabs'
import { Button } from '@/components/Button'
import { TextAreaField } from '@/components/TextAreaField'
import { licitacaoService } from '@/services/licitacaoService'
import { clienteService } from '@/services/clienteService'
import {
  Licitacao,
  ItemLicitacao,
  ModalidadeLicitacao,
  MODALIDADE_LICITACAO_LABEL,
  EstruturaLicitacao,
  ESTRUTURA_LICITACAO_LABEL,
  TipoContratacaoLicitacao,
  TIPO_CONTRATACAO_LICITACAO_LABEL,
  ProcedimentoLicitacao,
  PROCEDIMENTO_LICITACAO_LABEL,
  ParticipacaoLicitacao,
  PARTICIPACAO_LICITACAO_LABEL,
  FormaPagamento,
  FORMA_PAGAMENTO_LABEL,
  DECISAO_CLIENTE_LABEL,
} from '@/types/licitacao'
import { formatarDataHora, formatarMoeda } from '@/utils/prazoUtils'
import { totalReferenciaItem, totalReferenciaGrupo, totalReferenciaOportunidade, licitacaoExclusivaMeEpp, podeEditarPropostaCliente, DIAS_LIMITE_EDICAO_PROPOSTA_CLIENTE } from '@/utils/licitacaoCalculos'
import { PorteEmpresa } from '@/types/cliente'

const TABS = [
  { id: 'gerais', label: 'Informações Gerais' },
  { id: 'habilitacao', label: 'Habilitação' },
  { id: 'comerciais', label: 'Cond. Comerciais' },
  { id: 'itens', label: 'Itens' },
]

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

export function LicitacaoDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [licitacao, setLicitacao] = useState<Licitacao | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [abaAtiva, setAbaAtiva] = useState('gerais')

  const [recusando, setRecusando] = useState(false)
  const [motivoRecusa, setMotivoRecusa] = useState('')
  const [decidindo, setDecidindo] = useState(false)
  const [porteCliente, setPorteCliente] = useState<PorteEmpresa | null>(null)

  // Porte da empresa do cliente logado — usado pra bloquear "Quero
  // Participar" de vez quando a licitação inteira é exclusiva ME/EPP e a
  // empresa é "Demais" (ver licitacaoExclusivaMeEpp em licitacaoCalculos).
  useEffect(() => {
    if (!user?.clienteId) return
    let ativo = true
    clienteService.getById(user.clienteId).then((cliente) => {
      if (ativo && cliente) setPorteCliente(cliente.empresa.porte)
    })
    return () => {
      ativo = false
    }
  }, [user?.clienteId])

  useEffect(() => {
    if (!id) return
    let ativo = true
    setCarregando(true)
    licitacaoService.buscarPorId(id).then((resultado) => {
      if (!ativo) return
      setLicitacao(resultado)
      setCarregando(false)
    })
    return () => {
      ativo = false
    }
  }, [id])

  async function confirmarRecusa() {
    if (!user || !id) return
    setDecidindo(true)
    try {
      await licitacaoService.registrarDecisaoCliente(id, 'recusar', user.name, {
        motivoRecusa: motivoRecusa.trim() || undefined,
      })
      navigate('/cliente')
    } finally {
      setDecidindo(false)
    }
  }

  const itensIndividuais = licitacao?.itens.filter((i) => !i.grupoId) ?? []

  return (
    <DashboardShell
      title={licitacao ? `${licitacao.numeroPregao} — ${licitacao.orgao}` : 'Detalhes da licitação'}
      subtitle={licitacao?.objeto}
    >
      <Link
        to="/cliente"
        className="mb-4 inline-flex items-center gap-1.5 font-body text-sm font-semibold text-forest hover:underline"
      >
        ← Voltar
      </Link>

      {carregando || !licitacao ? (
        <div className="mt-6 flex min-h-[240px] items-center justify-center">
          <p className="font-body text-sm text-ink-soft">Carregando detalhes...</p>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-ink-soft/10 bg-white p-6 shadow-soft">
          <Tabs tabs={TABS} activeTab={abaAtiva} onChange={setAbaAtiva} />

          <div className="mt-5 min-h-[280px] space-y-5">
            {abaAtiva === 'gerais' && (
              <div className="grid grid-cols-2 gap-4">
                <Campo label="Número do pregão" value={licitacao.numeroPregao} />
                <Campo
                  label="Data e horário da sessão"
                  value={formatarDataHora(licitacao.dataEfetivaLicitacao || licitacao.dataLicitacao)}
                />
                <Campo label="Portal" value={licitacao.portal} />
                <Campo label="Órgão" value={licitacao.orgao} />
                <Campo label="Estado / Município" value={`${licitacao.municipio}/${licitacao.estado}`} />
                <Campo label="Distância da matriz" value={licitacao.distanciaMatriz} />
                <div className="col-span-2">
                  <Campo label="Objeto" value={licitacao.objeto} />
                </div>
                <Campo
                  label="Modalidade"
                  value={MODALIDADE_LICITACAO_LABEL[licitacao.modalidade as ModalidadeLicitacao] ?? licitacao.modalidade}
                />
                <Campo
                  label="Estrutura"
                  value={ESTRUTURA_LICITACAO_LABEL[licitacao.estrutura as EstruturaLicitacao] ?? licitacao.estrutura}
                />
                <Campo
                  label="Tipo de contratação"
                  value={
                    TIPO_CONTRATACAO_LICITACAO_LABEL[licitacao.tipoContratacao as TipoContratacaoLicitacao] ??
                    licitacao.tipoContratacao
                  }
                />
                <Campo
                  label="Procedimento"
                  value={PROCEDIMENTO_LICITACAO_LABEL[licitacao.procedimento as ProcedimentoLicitacao] ?? licitacao.procedimento}
                />
                <Campo label="Critério de julgamento" value={licitacao.formaDisputa} />
                <Campo label="Modo de disputa" value={licitacao.modoDisputa} />
                <Campo
                  label="Participação"
                  value={PARTICIPACAO_LICITACAO_LABEL[licitacao.participacao as ParticipacaoLicitacao] ?? licitacao.participacao}
                />
                <Campo label="CAPAG" value={licitacao.capag} />
                <div className="col-span-2">
                  <Campo label="Restrições ME/EPP" value={licitacao.restricoesMeEpp} />
                </div>
                <Campo
                  label="Valor total"
                  value={licitacao.valorTotalLicitacao != null ? formatarMoeda(licitacao.valorTotalLicitacao) : 'Sigiloso'}
                />
                {licitacao.nomesArquivosEdital && licitacao.nomesArquivosEdital.length > 0 && (
                  <div className="col-span-2">
                    <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Documentos do edital</p>
                    <p className="mt-0.5 font-body text-sm text-ink">{licitacao.nomesArquivosEdital.join(', ')}</p>
                  </div>
                )}
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

          <div className="mt-6 border-t border-ink-soft/10 pt-4">
            {recusando ? (
              <div className="space-y-3">
                <TextAreaField
                  label="Motivo da recusa (opcional)"
                  value={motivoRecusa}
                  onChange={(e) => setMotivoRecusa(e.target.value)}
                  rows={2}
                  placeholder="Ex: fora do nosso escopo de atuação no momento"
                />
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setRecusando(false)} disabled={decidindo}>
                    Cancelar
                  </Button>
                  <Button onClick={confirmarRecusa} disabled={decidindo}>
                    {decidindo ? 'Salvando...' : 'Confirmar recusa'}
                  </Button>
                </div>
              </div>
            ) : licitacao.decisaoCliente === 'pendente' ? (
              !podeEditarPropostaCliente(licitacao) ? (
                <p className="rounded-lg bg-brass-pale/60 px-3 py-2 font-body text-xs text-brass">
                  🔒 O prazo para participar desta licitação já encerrou (até {DIAS_LIMITE_EDICAO_PROPOSTA_CLIENTE}{' '}
                  dias antes da sessão).
                </p>
              ) : licitacao.itens.length > 0 && licitacaoExclusivaMeEpp(licitacao.itens) && porteCliente === 'demais' ? (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="rounded-lg bg-brass-pale/60 px-3 py-2 font-body text-xs text-brass">
                    🔒 Esta licitação é exclusiva para participação de empresas ME/EPP — sua empresa não pode
                    enviar proposta aqui.
                  </p>
                  <Button variant="ghost" onClick={() => setRecusando(true)} disabled={decidindo}>
                    Não vou participar
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => navigate(`/cliente/licitacoes/${id}/proposta`)} disabled={decidindo}>
                    Quero Participar
                  </Button>
                  <Button variant="ghost" onClick={() => setRecusando(true)} disabled={decidindo}>
                    Não vou participar
                  </Button>
                </div>
              )
            ) : (
              <div className="space-y-2">
                <p className="font-body text-xs text-ink-soft">
                  {DECISAO_CLIENTE_LABEL[licitacao.decisaoCliente]}
                  {licitacao.decisaoClienteEm && ` em ${formatarDataHora(licitacao.decisaoClienteEm)}`}
                  {licitacao.motivoRecusaCliente && ` — "${licitacao.motivoRecusaCliente}"`}
                </p>
                {licitacao.decisaoCliente === 'participar' && (
                  podeEditarPropostaCliente(licitacao) ? (
                    <Button onClick={() => navigate(`/cliente/licitacoes/${id}/proposta`)} disabled={decidindo}>
                      Editar proposta
                    </Button>
                  ) : (
                    <p className="rounded-lg bg-paper-2/60 px-3 py-2 font-body text-xs text-ink-soft">
                      O prazo para editar a proposta já encerrou (até {DIAS_LIMITE_EDICAO_PROPOSTA_CLIENTE} dias
                      antes da sessão da licitação).
                    </p>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </DashboardShell>
  )
}
