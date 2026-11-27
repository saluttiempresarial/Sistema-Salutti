// src/pages/cliente/LicitacaoDetalhePage.tsx
//
// Tela cheia com os detalhes completos de uma licitação, aberta pelo
// Cliente ao clicar numa linha da tabela do Dashboard (substitui o antigo
// modal de leitura — agora é uma página própria, com rota /cliente/licitacoes/:id).
// Mesmo conteúdo que o Administrador vê no LicitacaoFormModal (Informações
// Gerais, Habilitação, Declarações, Condições Comerciais, Outras Exigências,
// Itens) em modo leitura — sem a aba "Ponto de Atenção" (notas internas da
// Salutti) — mais os botões de decisão (Quero Participar / Não vou
// participar) no rodapé.
//
// Habilitação/Declarações/Outras Exigências viraram um checklist em 25/09
// (ver ItemChecklistExigencia em types/licitacao) — cada aba mostra só os
// itens que o Analista já marcou (Exigido/Não exigido), com o detalhamento
// ao lado. Ver ChecklistLeitura, abaixo.
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
// Balão "ⓘ" com a explicação de cada exigência (Guia de Exigências do Edital).
import { InfoTooltip } from '@/components/InfoTooltip'
import { DocumentosEditalLeitura } from '@/components/DocumentosEdital'
import { explicacaoDaExigencia } from '@/data/explicacaoExigencias'
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
  ItemChecklistExigencia,
  StatusExigencia,
  STATUS_EXIGENCIA_LABEL,
} from '@/types/licitacao'
import { formatarDataHora, formatarMoeda, formatarNumero } from '@/utils/prazoUtils'
import { totalReferenciaItem, totalReferenciaGrupo, totalReferenciaOportunidade, licitacaoExclusivaMeEpp, podeEditarPropostaCliente, DIAS_UTEIS_LIMITE_EDICAO_PROPOSTA_CLIENTE } from '@/utils/licitacaoCalculos'
import { PorteEmpresa } from '@/types/cliente'
import { MOTIVOS_ESCOLHIDOS_CLIENTE, rotuloDoMotivo, textoDosMotivos } from '@/types/motivoNaoParticipacao'
import type { MotivoEscolhidoCliente, MotivoNaoParticipacao } from '@/types/motivoNaoParticipacao'

const TABS = [
  { id: 'gerais', label: 'Informações Gerais' },
  { id: 'habilitacao', label: 'Habilitação' },
  { id: 'declaracoes', label: 'Declarações' },
  { id: 'comerciais', label: 'Cond. Comerciais' },
  { id: 'outras', label: 'Outras Exigências' },
  { id: 'itens', label: 'Itens' },
]

// Aba de checklist sem nenhum item marcado não aparece para o Cliente (23/11/2026).
function temItemMarcado(...listas: Array<ItemChecklistExigencia[] | undefined>): boolean {
  return listas.some((lista) => (lista ?? []).some((item) => item.status != null))
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

// Versão somente-leitura de uma seção de checklist (Habilitação —
// Jurídica/Fiscal/Econômico-Financeira/Técnica —, Declarações ou Outras
// Exigências). Mostra só os itens que o Analista já marcou (Exigido/Não
// exigido); um item ainda sem marcação não aparece — evita listar dezenas
// de linhas "não definido" para o Cliente.
function ChecklistLeitura({ titulo, itens }: { titulo?: string; itens: ItemChecklistExigencia[] }) {
  const itensMarcados = itens.filter((item) => item.status != null)
  // Seção sem nenhuma exigência registrada não aparece para o Cliente (23/11/2026).
  if (itensMarcados.length === 0) return null
  return (
    <div className="space-y-2">
      {titulo && <p className="font-body text-sm font-semibold text-ink">{titulo}</p>}
      <div className="overflow-hidden rounded-xl border border-ink-soft/15">
        {itensMarcados.map((item) => (
          <ItemChecklistLeitura key={item.id} item={item} />
        ))}
      </div>
    </div>
  )
}

// Uma linha do checklist para o Cliente (23/11/2026): o que ele olha primeiro é
// "Exigido" ou "Não exigido", então a situação fica numa etiqueta de largura
// fixa, alinhada à esquerda, e o texto do edital (detalhamento) fica recolhido
// atrás de "Ver detalhes". Itens "Não exigido" ficam em tom mais apagado.
function ItemChecklistLeitura({ item }: { item: ItemChecklistExigencia }) {
  const [aberto, setAberto] = useState(false)
  const exigido = item.status === 'exigido'
  return (
    <div className="border-b border-ink-soft/10 px-3 py-2.5 last:border-b-0">
      <div className="flex items-center gap-3">
        <span
          className={`w-24 shrink-0 whitespace-nowrap rounded-md px-2 py-1 text-center font-body text-xs font-semibold ${
            exigido ? 'bg-forest text-white' : 'bg-paper-2 text-ink-soft'
          }`}
        >
          {STATUS_EXIGENCIA_LABEL[item.status as StatusExigencia]}
        </span>
        <p className={`min-w-0 flex-1 font-body text-sm ${exigido ? 'font-medium text-ink' : 'text-ink-soft'}`}>
          {item.label}
          {explicacaoDaExigencia(item.id) && (
            <span className="ml-1.5 inline-block align-middle">
              <InfoTooltip titulo={item.label} texto={explicacaoDaExigencia(item.id) as string} />
            </span>
          )}
        </p>
        {item.detalhamento && (
          <button
            type="button"
            onClick={() => setAberto((atual) => !atual)}
            aria-expanded={aberto}
            className="shrink-0 font-body text-xs font-semibold text-forest hover:underline"
          >
            {aberto ? 'Ocultar' : 'Ver detalhes'}
          </button>
        )}
      </div>
      {aberto && item.detalhamento && (
        <p className="ml-[6.75rem] mt-1.5 rounded-md bg-paper-2/60 px-2.5 py-1.5 font-body text-xs text-ink-soft">
          {item.detalhamento}
        </p>
      )}
    </div>
  )
}

// Item da lista da aba "Itens". Item exclusivo para ME/EPP (Microempresa e
// Empresa de Pequeno Porte) ganha selo dourado e faixa lateral (25/11/2026),
// para a exclusividade ser a primeira coisa que se vê — antes era só um texto
// pequeno na linha de baixo.
function ItemLeitura({ item }: { item: ItemLicitacao }) {
  return (
    <div
      className={`rounded-lg p-4 ${
        item.exclusivoMeEpp ? 'border-l-4 border-brass bg-brass-pale/40' : 'bg-paper-2/60'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-body text-sm font-semibold text-ink">Item {item.numero}</p>
          <p className="mt-0.5 font-body text-xs text-ink-soft">
            {formatarNumero(item.quantidade)} {item.unidadeMedida} × {formatarMoeda(item.precoReferencia)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {item.exclusivoMeEpp && (
            <span className="whitespace-nowrap rounded-full border border-brass bg-brass-pale px-2.5 py-0.5 font-body text-[11px] font-bold uppercase tracking-wide text-brass">
              Exclusivo ME/EPP
            </span>
          )}
          <p className="font-body text-sm font-medium text-forest-deep">{formatarMoeda(totalReferenciaItem(item))}</p>
        </div>
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

// Licitações cadastradas antes de 25/09 não têm os campos de checklist (ou
// têm o formato antigo, de texto livre) — em vez de quebrar a tela, essas
// abas simplesmente aparecem vazias ("Nenhuma exigência registrada ainda."),
// mesma decisão aplicada no formulário do Analista (LicitacaoFormModal).
function normalizarChecklist(valor: unknown): ItemChecklistExigencia[] {
  return Array.isArray(valor) ? (valor as ItemChecklistExigencia[]) : []
}

function normalizarHabilitacaoLeitura(valor: unknown) {
  const h = (valor ?? {}) as Record<string, unknown>
  return {
    juridica: normalizarChecklist(h.juridica),
    fiscalSocialTrabalhista: normalizarChecklist(h.fiscalSocialTrabalhista),
    economicoFinanceira: normalizarChecklist(h.economicoFinanceira),
    tecnica: normalizarChecklist(h.tecnica),
  }
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
  const [motivosEscolhidos, setMotivosEscolhidos] = useState<MotivoEscolhidoCliente[]>([])
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
      setLicitacao(
        resultado
          ? {
              ...resultado,
              habilitacao: normalizarHabilitacaoLeitura(resultado.habilitacao),
              declaracoes: normalizarChecklist(resultado.declaracoes),
              outrasExigencias: normalizarChecklist(resultado.outrasExigencias),
            }
          : resultado
      )
      setCarregando(false)
    })
    return () => {
      ativo = false
    }
  }, [id])

  // Quando o "Não vou participar" acontece por um bloqueio do sistema (licitação
  // exclusiva ME/EPP e empresa "Demais"), o motivo é registrado sozinho e o
  // cliente não precisa escolher. Nos demais casos a escolha do motivo é
  // obrigatória (migração 052). Empresa ME/EPP não tem mais bloqueio pela
  // empresa inteira (24/11/2026): ela escolhe participar ou não, como as demais.
  const motivoAutomatico: MotivoNaoParticipacao | null =
    porteCliente === 'demais' && licitacao && licitacao.itens.length > 0 && licitacaoExclusivaMeEpp(licitacao.itens)
      ? 'exclusiva_me_epp'
      : null
  // Vários motivos podem ser marcados. O PRINCIPAL é o primeiro na ordem da
  // lista e alimenta os indicadores; todos ficam gravados (migração 064).
  const motivosOrdenados = MOTIVOS_ESCOLHIDOS_CLIENTE.map((m) => m.chave as MotivoEscolhidoCliente).filter((c) =>
    motivosEscolhidos.includes(c)
  )
  const motivoParaGravar: MotivoNaoParticipacao | '' =
    motivoAutomatico ?? (motivosOrdenados.length > 0 ? motivosOrdenados[0] : '')
  const explicacaoObrigatoria = !motivoAutomatico && motivosOrdenados.includes('outro')
  const recusaValida = motivoParaGravar !== '' && (!explicacaoObrigatoria || motivoRecusa.trim() !== '')

  async function confirmarRecusa() {
    if (!user || !id || motivoParaGravar === '' || !recusaValida) return
    setDecidindo(true)
    try {
      await licitacaoService.registrarDecisaoCliente(id, 'recusar', user.name, {
        motivoNaoParticipacao: motivoParaGravar,
        motivosNaoParticipacao: motivoAutomatico ? undefined : motivosOrdenados,
        motivoRecusa: explicacaoObrigatoria ? motivoRecusa.trim() || undefined : undefined,
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
          <Tabs
            tabs={TABS.filter((aba) => {
              if (aba.id === 'habilitacao') {
                return temItemMarcado(
                  licitacao.habilitacao.juridica,
                  licitacao.habilitacao.fiscalSocialTrabalhista,
                  licitacao.habilitacao.economicoFinanceira,
                  licitacao.habilitacao.tecnica
                )
              }
              if (aba.id === 'declaracoes') return temItemMarcado(licitacao.declaracoes)
              if (aba.id === 'outras') return temItemMarcado(licitacao.outrasExigencias)
              return true
            })}
            activeTab={abaAtiva}
            onChange={setAbaAtiva}
          />

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
                {/* "Estado / Município" removido daqui (24/09) — o nome do
                    órgão já costuma trazer a cidade/UF (ex.: "Prefeitura
                    Municipal de Nova Campina/SP"), então repetir num campo
                    à parte só duplicava a mesma informação. */}
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
                <Campo
                  label="Valor total"
                  value={licitacao.valorTotalLicitacao != null ? formatarMoeda(licitacao.valorTotalLicitacao) : 'Sigiloso'}
                />
                <DocumentosEditalLeitura licitacaoId={licitacao.id} />
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
              <div className="space-y-5">
                <ChecklistLeitura titulo="Habilitação jurídica" itens={licitacao.habilitacao.juridica} />
                <ChecklistLeitura
                  titulo="Regularidade fiscal, social e trabalhista"
                  itens={licitacao.habilitacao.fiscalSocialTrabalhista}
                />
                <ChecklistLeitura
                  titulo="Qualificação econômico-financeira"
                  itens={licitacao.habilitacao.economicoFinanceira}
                />
                <ChecklistLeitura titulo="Qualificação técnica" itens={licitacao.habilitacao.tecnica} />
              </div>
            )}

            {abaAtiva === 'declaracoes' && (
              <div className="space-y-5">
                <ChecklistLeitura itens={licitacao.declaracoes} />
              </div>
            )}

            {/* Reestruturado a pedido do Márcio (24/09, ajustado no mesmo dia):
                "Intervalo de lances" costuma vir como um texto longo (a
                cláusula toda, copiada do edital) — ao lado de um campo curto
                como "Validade da proposta" sobrava muito espaço vazio e
                ficava desalinhado. Agora ele fica sozinho numa linha cheia, e
                os campos curtos (validade, local/prazo de entrega,
                pagamento) ficam agrupados em linhas de 3 colunas. */}
            {abaAtiva === 'comerciais' && (
              <div className="space-y-4">
                <Campo
                  label="Intervalo de lances"
                  value={
                    licitacao.condicoesComerciais.tipoIntervaloLances === 'valor'
                      ? licitacao.condicoesComerciais.valorIntervaloLances != null
                        ? formatarMoeda(licitacao.condicoesComerciais.valorIntervaloLances)
                        : undefined
                      : licitacao.condicoesComerciais.tipoIntervaloLances === 'percentual'
                      ? licitacao.condicoesComerciais.percentualIntervaloLances != null
                        ? `${licitacao.condicoesComerciais.percentualIntervaloLances}%`
                        : undefined
                      : undefined
                  }
                />
                <Campo
                  label="Detalhamento do intervalo de lances"
                  value={licitacao.condicoesComerciais.intervaloLancesDetalhe}
                />

                <div className="grid grid-cols-3 gap-4">
                  <Campo label="Local de entrega" value={licitacao.condicoesComerciais.localEntrega} />
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
                </div>

                <div className="grid grid-cols-3 gap-4">
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
                </div>

                {licitacao.condicoesComerciais.possuiGarantias && (
                  <Campo label="Garantias" value={licitacao.condicoesComerciais.garantiasDetalhe || 'Sim'} />
                )}
              </div>
            )}

            {abaAtiva === 'outras' && (
              <div className="space-y-5">
                <ChecklistLeitura itens={licitacao.outrasExigencias} />
              </div>
            )}

            {abaAtiva === 'itens' && (
              <div className="space-y-4">
                {licitacao.grupos.map((grupo) => {
                  const itensDoGrupo = licitacao.itens.filter((i) => i.grupoId === grupo.id)
                  const exclusivosDoGrupo = itensDoGrupo.filter((i) => i.exclusivoMeEpp).length
                  return (
                    <div key={grupo.id} className="overflow-hidden rounded-xl border-2 border-forest">
                      {/* Cabeçalho verde: diferencia o grupo dos itens individuais (25/11/2026). */}
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-forest px-4 py-3 text-white">
                        <p className="font-body text-sm font-bold">
                          {grupo.numero} — {grupo.nome}
                          <span className="ml-2 text-xs font-normal opacity-85">
                            | {itensDoGrupo.length} {itensDoGrupo.length === 1 ? 'item' : 'itens'}
                          </span>
                        </p>
                        {exclusivosDoGrupo > 0 && (
                          <span className="whitespace-nowrap rounded-full bg-white px-2.5 py-0.5 font-body text-[11px] font-bold text-forest-deep">
                            {exclusivosDoGrupo} {exclusivosDoGrupo === 1 ? 'exclusivo' : 'exclusivos'} ME/EPP
                          </span>
                        )}
                      </div>
                      <div className="space-y-2 border-l-8 border-forest-mist bg-white p-3 pl-4">
                        {itensDoGrupo.map((item) => (
                          <ItemLeitura key={item.id} item={item} />
                        ))}
                        {itensDoGrupo.length === 0 && (
                          <p className="font-body text-xs italic text-ink-soft">Nenhum item neste grupo.</p>
                        )}
                      </div>
                      <p className="bg-forest-mist px-4 py-2 text-right font-body text-sm font-semibold text-forest-deep">
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
                {motivoAutomatico ? (
                  <p className="rounded-lg bg-paper-2/60 px-3 py-2 font-body text-xs text-ink-soft">
                    Motivo registrado: {rotuloDoMotivo(motivoAutomatico)}.
                  </p>
                ) : (
                  <fieldset className="space-y-1.5">
                    <legend className="mb-1.5 font-mono text-xs uppercase tracking-wide text-ink-soft">
                      Motivo para não participar (obrigatório) — pode marcar mais de um
                    </legend>
                    {MOTIVOS_ESCOLHIDOS_CLIENTE.map((m) => (
                      <div key={m.chave} className="flex items-center gap-2">
                        <label className="flex cursor-pointer items-center gap-2 font-body text-sm text-ink">
                          <input
                            type="checkbox"
                            name="motivo-nao-participacao"
                            value={m.chave}
                            checked={motivosEscolhidos.includes(m.chave as MotivoEscolhidoCliente)}
                            onChange={() =>
                              setMotivosEscolhidos((atual) =>
                                atual.includes(m.chave as MotivoEscolhidoCliente)
                                  ? atual.filter((c) => c !== m.chave)
                                  : [...atual, m.chave as MotivoEscolhidoCliente]
                              )
                            }
                            className="h-4 w-4 accent-forest"
                          />
                          {m.rotulo}
                        </label>
                        <InfoTooltip titulo={m.rotulo} texto={m.descricao} />
                      </div>
                    ))}
                  </fieldset>
                )}
                {explicacaoObrigatoria && (
                  <TextAreaField
                    label="Explique o motivo (obrigatório)"
                    value={motivoRecusa}
                    onChange={(e) => setMotivoRecusa(e.target.value)}
                    rows={2}
                    autoFocus
                  />
                )}
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setRecusando(false)} disabled={decidindo}>
                    Cancelar
                  </Button>
                  <Button onClick={confirmarRecusa} disabled={decidindo || !recusaValida}>
                    {decidindo ? 'Salvando...' : 'Confirmar recusa'}
                  </Button>
                </div>
              </div>
            ) : licitacao.decisaoCliente === 'pendente' ? (
              !podeEditarPropostaCliente(licitacao) ? (
                <p className="rounded-lg bg-brass-pale/60 px-3 py-2 font-body text-xs text-brass">
                  🔒 O prazo para participar desta licitação já encerrou (até {DIAS_UTEIS_LIMITE_EDICAO_PROPOSTA_CLIENTE}{' '}
                  dias úteis antes da sessão, às 18h30).
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
                  {licitacao.decisaoCliente === 'recusar' &&
                    licitacao.motivoNaoParticipacao &&
                    ` — ${textoDosMotivos(licitacao.motivoNaoParticipacao, licitacao.motivosNaoParticipacao)}`}
                  {licitacao.motivoRecusaCliente && ` — "${licitacao.motivoRecusaCliente}"`}
                </p>
                {licitacao.decisaoCliente === 'participar' && (
                  podeEditarPropostaCliente(licitacao) ? (
                    <Button onClick={() => navigate(`/cliente/licitacoes/${id}/proposta`)} disabled={decidindo}>
                      Editar proposta
                    </Button>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div>
                        <Button onClick={() => navigate(`/cliente/licitacoes/${id}/proposta`)}>
                          Ver minha proposta
                        </Button>
                      </div>
                      <p className="rounded-lg bg-paper-2/60 px-3 py-2 font-body text-xs text-ink-soft">
                        O prazo para editar a proposta já encerrou (até {DIAS_UTEIS_LIMITE_EDICAO_PROPOSTA_CLIENTE} dias
                        úteis antes da sessão da licitação, às 18h30).
                      </p>
                    </div>
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
