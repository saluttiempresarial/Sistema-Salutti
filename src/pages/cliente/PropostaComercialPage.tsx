// src/pages/admin/licitacoes/PropostaComercialPage.tsx
//
// Tela cheia de Proposta Comercial — rota /admin/licitacoes/:id/proposta.
// Acessada a partir da listagem de Licitações (LicitacoesPage), botão
// "Ver proposta" por linha.
//
// Usa o MESMO componente de cartões que o Cliente usa (PropostaComercialCards)
// — garante que Admin e Cliente sempre vejam exatamente as mesmas informações,
// só em formato de cartões por Grupo → Item em vez da tabela densa antiga.
// A diferença é só de permissão:
//   - Admin: edita tudo (Itens de referência + Proposta Comercial)
//   - Funcionário: só visualiza (nenhum dos dois blocos é editável aqui)
//
// Diferente da página do Cliente, aqui não existe "decisão" a registrar —
// é só edição/consulta dos dados, então ao salvar a página recarrega os
// dados e permanece aberta (não navega embora).

import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { useAuth } from '@/context/AuthContext'
import { licitacaoService } from '@/services/licitacaoService'
import { clienteService } from '@/services/clienteService'
import { PropostaComercialCards, SalvarPropostaComercialPayload } from '@/components/Licitacoes/PropostaComercialCards'
import {
  Licitacao,
  ModalidadeLicitacao,
  ParticipacaoLicitacao,
  EstruturaLicitacao,
  TipoContratacaoLicitacao,
  ProcedimentoLicitacao,
  MODALIDADE_LICITACAO_LABEL,
  PARTICIPACAO_LICITACAO_LABEL,
  ESTRUTURA_LICITACAO_LABEL,
  TIPO_CONTRATACAO_LICITACAO_LABEL,
  PROCEDIMENTO_LICITACAO_LABEL,
  STATUS_LICITACAO_LABEL,
  DECISAO_CLIENTE_LABEL,
  STATUS_PROPOSTA_LABEL,
  FORMA_PAGAMENTO_LABEL,
  ItemChecklistExigencia,
  STATUS_EXIGENCIA_LABEL,
} from '@/types/licitacao'
import { formatarDataHora } from '@/utils/prazoUtils'
import {
  calcularAnaliseItem,
  classificarStatusProposta,
  totalReferenciaItem,
  podeEditarPropostaCliente,
  podeAdminPreencherPropostaDiretamente,
  propostaComercialTravadaDeVez,
  DIAS_UTEIS_LIMITE_EDICAO_PROPOSTA_CLIENTE,
  DIAS_UTEIS_LIMITE_ABSOLUTO_PROPOSTA,
} from '@/utils/licitacaoCalculos'

// Converte uma seção do checklist de exigências (Habilitação, Declarações
// ou Outras Exigências) nas linhas Campo/Valor do relatório exportado.
// Só entram os itens que o Analista já marcou (status preenchido) — um item
// ainda sem marcação não tem informação útil para o relatório. O nome da
// seção (ex.: "Habilitação jurídica") prefixa o rótulo de cada linha, para
// diferenciar itens de mesmo nome ("Outras") entre as diferentes seções.
function linhasChecklist(
  secao: string,
  itens: ItemChecklistExigencia[]
): { Campo: string; Valor: string }[] {
  return itens
    .filter((item) => item.status != null)
    .map((item) => ({
      Campo: `${secao} — ${item.label}`,
      Valor: item.detalhamento
        ? `${STATUS_EXIGENCIA_LABEL[item.status as keyof typeof STATUS_EXIGENCIA_LABEL]} (${item.detalhamento})`
        : STATUS_EXIGENCIA_LABEL[item.status as keyof typeof STATUS_EXIGENCIA_LABEL],
    }))
}

export function PropostaComercialPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  // Liberar/travar o prazo do Cliente (29/09, atualizado no mesmo dia a
  // pedido do Márcio): o Analista (Funcionário) também pode usar essa
  // função agora, não é mais exclusivo do Admin. A RLS/RPC
  // (funcionario_acessa_licitacao, migração 023) continua restringindo pela
  // carteira dele — aqui na tela só decide se o bloco aparece.
  const podeGerenciarPrazoCliente = isAdmin || user?.role === 'funcionario'
  const usuarioAtual = user?.name ?? 'Usuário atual'

  const [licitacao, setLicitacao] = useState<Licitacao | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [salvoEm, setSalvoEm] = useState<number | null>(null)
  const [exportando, setExportando] = useState(false)
  const [alterandoPrazo, setAlterandoPrazo] = useState(false)
  const [mostrarFormLiberar, setMostrarFormLiberar] = useState(false)
  const [novaDataLiberacao, setNovaDataLiberacao] = useState('')
  const [novaHoraLiberacao, setNovaHoraLiberacao] = useState('18:30')
  const [erroLiberacao, setErroLiberacao] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (!id) return
    setCarregando(true)
    const resultado = await licitacaoService.buscarPorId(id)
    setLicitacao(resultado)
    setCarregando(false)
  }, [id])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function handleSalvar(payload: SalvarPropostaComercialPayload) {
    if (!id) return
    setSalvando(true)
    try {
      const tarefas: Promise<unknown>[] = [licitacaoService.registrarPropostaCliente(id, payload.propostaPorItem)]
      if (payload.itensReferencia) {
        tarefas.push(licitacaoService.atualizarItensReferencia(id, payload.itensReferencia))
      }
      await Promise.all(tarefas)
      await carregar()
      setSalvoEm(Date.now())
    } finally {
      setSalvando(false)
    }
  }

  // Travar o prazo do Cliente de volta — Admin ou Analista (o banco também
  // valida via RPC restrita a is_admin_ativo() OR funcionario_acessa_licitacao(),
  // migração 023, então nem uma chamada direta à API passa por quem não
  // tem permissão).
  async function handleTravarPrazo() {
    if (!id) return
    setAlterandoPrazo(true)
    try {
      await licitacaoService.liberarPrazoPropostaCliente(id, false, usuarioAtual)
      await carregar()
    } finally {
      setAlterandoPrazo(false)
    }
  }

  // Liberar o prazo do Cliente até a data/hora que quem está liberando
  // escolheu (não é mais um número fixo de dias — Admin/Analista decide).
  async function handleConfirmarLiberacao() {
    if (!id || !novaDataLiberacao || !novaHoraLiberacao) {
      setErroLiberacao('Informe a data e o horário.')
      return
    }
    const liberadoAte = new Date(`${novaDataLiberacao}T${novaHoraLiberacao}:00`)
    if (Number.isNaN(liberadoAte.getTime())) {
      setErroLiberacao('Data/horário inválidos.')
      return
    }
    setErroLiberacao(null)
    setAlterandoPrazo(true)
    try {
      await licitacaoService.liberarPrazoPropostaCliente(id, true, usuarioAtual, liberadoAte.toISOString())
      setMostrarFormLiberar(false)
      setNovaDataLiberacao('')
      await carregar()
    } catch (erro) {
      setErroLiberacao(erro instanceof Error ? erro.message : 'Não foi possível liberar o prazo.')
    } finally {
      setAlterandoPrazo(false)
    }
  }

  // Exporta TODAS as informações preenchidas desta licitação — não só o
  // que aparece na tabela em tela. Três abas:
  //   1. "Licitação"  — todos os campos do cadastro (Abas 1 a 4 da spec:
  //      Informações Gerais, Habilitação, Condições Comerciais, Pontos de
  //      Atenção) + decisão do cliente, num layout Campo/Valor (mais fácil
  //      de ler numa licitação só do que uma linha larga).
  //   2. "Itens"      — um item por linha, com a referência do Analista e a
  //      Proposta Comercial preenchida pelo Cliente, usando exatamente os
  //      mesmos cálculos de análise (calcularAnaliseItem/classificarStatusProposta)
  //      da tela, para os números baterem 1:1 com o que o Admin está vendo.
  //   3. "Histórico"  — registro de ações da licitação.
  async function exportarExcel() {
    if (!licitacao || !isAdmin) return
    setExportando(true)
    try {
      const cliente = await clienteService.getById(licitacao.clienteId)
      const nomeCliente = cliente?.empresa.nomeFantasia ?? '—'

      const camposLicitacao: { Campo: string; Valor: string | number }[] = [
        { Campo: 'Número do pregão', Valor: licitacao.numeroPregao },
        { Campo: 'Portal', Valor: licitacao.portal },
        { Campo: 'Órgão', Valor: licitacao.orgao },
        { Campo: 'Cidade', Valor: licitacao.municipio },
        { Campo: 'Estado', Valor: licitacao.estado },
        { Campo: 'Distância da matriz', Valor: licitacao.distanciaMatriz || '—' },
        { Campo: 'Data da licitação', Valor: formatarDataHora(licitacao.dataLicitacao) },
        {
          Campo: 'Data efetiva (se suspensa/remarcada)',
          Valor: licitacao.dataEfetivaLicitacao ? formatarDataHora(licitacao.dataEfetivaLicitacao) : '—',
        },
        { Campo: 'Objeto', Valor: licitacao.objeto },
        {
          Campo: 'Modalidade',
          Valor: MODALIDADE_LICITACAO_LABEL[licitacao.modalidade as ModalidadeLicitacao] ?? licitacao.modalidade,
        },
        {
          Campo: 'Participação',
          Valor: PARTICIPACAO_LICITACAO_LABEL[licitacao.participacao as ParticipacaoLicitacao] ?? licitacao.participacao,
        },
        {
          Campo: 'Estrutura',
          Valor: ESTRUTURA_LICITACAO_LABEL[licitacao.estrutura as EstruturaLicitacao] ?? licitacao.estrutura,
        },
        {
          Campo: 'Tipo de contratação',
          Valor:
            TIPO_CONTRATACAO_LICITACAO_LABEL[licitacao.tipoContratacao as TipoContratacaoLicitacao] ??
            licitacao.tipoContratacao,
        },
        {
          Campo: 'Procedimento',
          Valor: PROCEDIMENTO_LICITACAO_LABEL[licitacao.procedimento as ProcedimentoLicitacao] ?? licitacao.procedimento,
        },
        { Campo: 'Forma de disputa', Valor: licitacao.formaDisputa || '—' },
        { Campo: 'Modo de disputa', Valor: licitacao.modoDisputa || '—' },
        { Campo: 'CAPAG', Valor: licitacao.capag || '—' },
        { Campo: 'Link do edital', Valor: licitacao.linkEdital || '—' },
        {
          Campo: 'Documentos do edital',
          Valor: licitacao.nomesArquivosEdital?.length ? licitacao.nomesArquivosEdital.join(', ') : '—',
        },
        {
          Campo: 'Valor total da licitação',
          Valor: licitacao.valorTotalLicitacao != null ? licitacao.valorTotalLicitacao : 'Sigiloso',
        },
        { Campo: 'Status', Valor: STATUS_LICITACAO_LABEL[licitacao.status] },
        { Campo: 'Cliente', Valor: nomeCliente },

        ...linhasChecklist('Habilitação jurídica', licitacao.habilitacao.juridica),
        ...linhasChecklist('Regularidade fiscal, social e trabalhista', licitacao.habilitacao.fiscalSocialTrabalhista),
        ...linhasChecklist('Qualificação econômico-financeira', licitacao.habilitacao.economicoFinanceira),
        ...linhasChecklist('Qualificação técnica', licitacao.habilitacao.tecnica),
        ...linhasChecklist('Declarações', licitacao.declaracoes),
        ...linhasChecklist('Outras exigências', licitacao.outrasExigencias),

        {
          Campo: 'Intervalo entre lances',
          Valor:
            licitacao.condicoesComerciais.tipoIntervaloLances === 'valor'
              ? licitacao.condicoesComerciais.valorIntervaloLances != null
                ? `R$ ${licitacao.condicoesComerciais.valorIntervaloLances}`
                : '—'
              : licitacao.condicoesComerciais.tipoIntervaloLances === 'percentual'
              ? licitacao.condicoesComerciais.percentualIntervaloLances != null
                ? `${licitacao.condicoesComerciais.percentualIntervaloLances}%`
                : '—'
              : '—',
        },
        {
          Campo: 'Detalhamento do intervalo de lances',
          Valor: licitacao.condicoesComerciais.intervaloLancesDetalhe || '—',
        },
        {
          Campo: 'Forma de pagamento',
          Valor: FORMA_PAGAMENTO_LABEL[licitacao.condicoesComerciais.formaPagamento] ?? licitacao.condicoesComerciais.formaPagamento,
        },
        { Campo: 'Recebimento (banco)', Valor: licitacao.condicoesComerciais.recebimentoBanco || '—' },
        { Campo: 'Prazo de pagamento (dias)', Valor: licitacao.condicoesComerciais.prazoPagamentoDias ?? '—' },
        { Campo: 'Possui garantias', Valor: licitacao.condicoesComerciais.possuiGarantias ? 'Sim' : 'Não' },
        { Campo: 'Detalhe das garantias', Valor: licitacao.condicoesComerciais.garantiasDetalhe || '—' },
        { Campo: 'Prazo de entrega (dias)', Valor: licitacao.condicoesComerciais.prazoEntregaDias ?? '—' },
        { Campo: 'Local de entrega', Valor: licitacao.condicoesComerciais.localEntrega || '—' },
        { Campo: 'Validade da proposta (dias)', Valor: licitacao.condicoesComerciais.validadePropostaDias ?? '—' },

        { Campo: 'Pontos de atenção', Valor: licitacao.pontosAtencao || '—' },

        { Campo: 'Decisão do cliente', Valor: DECISAO_CLIENTE_LABEL[licitacao.decisaoCliente] },
        { Campo: 'Motivo da recusa', Valor: licitacao.motivoRecusaCliente || '—' },
        {
          Campo: 'Decisão registrada em',
          Valor: licitacao.decisaoClienteEm ? formatarDataHora(licitacao.decisaoClienteEm) : '—',
        },
        { Campo: 'Cobra frete', Valor: licitacao.cobrarFrete ? 'Sim' : 'Não' },
        { Campo: 'Percentual de frete', Valor: licitacao.percentualFrete != null ? `${licitacao.percentualFrete}%` : '—' },
        { Campo: 'Status da proposta', Valor: STATUS_PROPOSTA_LABEL[licitacao.statusProposta] },

        { Campo: 'Observações', Valor: licitacao.observacoes || '—' },
        { Campo: 'Cadastrado em', Valor: formatarDataHora(licitacao.criadoEm) },
        { Campo: 'Atualizado em', Valor: formatarDataHora(licitacao.atualizadoEm) },
      ]

      const taxaFretePreenchida = licitacao.percentualFrete != null
      const taxaFreteNumero = licitacao.percentualFrete ?? 0

      const linhasItens = licitacao.itens.map((item) => {
        const grupo = licitacao.grupos.find((g) => g.id === item.grupoId)
        const analise = calcularAnaliseItem(item, taxaFreteNumero, taxaFretePreenchida)
        const status = classificarStatusProposta(analise.percentualDiferenca)
        return {
          Grupo: grupo ? grupo.nome : 'Item individual',
          Item: item.numero,
          'Descrição (referência)': item.descricao,
          Unidade: item.unidadeMedida,
          Quantidade: item.quantidade,
          'Valor unit. referência': item.precoReferencia,
          'Valor total referência': totalReferenciaItem(item),
          'Exclusivo ME/EPP': item.exclusivoMeEpp ? 'Sim' : 'Não',
          'Cód. produto': item.propostaCliente?.codigoInterno || '—',
          'Descrição ofertada': item.propostaCliente?.descricaoProduto || '—',
          Fabricante: item.propostaCliente?.marca || '—',
          Modelo: item.propostaCliente?.modelo || '—',
          'Preço mínimo (R$)': item.propostaCliente?.precoMinimo ?? '—',
          'Preço com frete (R$)': analise.precoComFrete ?? '—',
          'Valor total ofertado (R$)': analise.valorTotal ?? '—',
          'Diferença vs. referência': analise.percentualDiferenca != null ? `${(analise.percentualDiferenca * 100).toFixed(1)}%` : '—',
          Status: status.label,
        }
      })

      const linhasHistorico = licitacao.historico.map((h) => ({
        Data: formatarDataHora(h.data),
        Usuário: h.usuario,
        Ação: h.acao,
      }))

      const livro = XLSX.utils.book_new()

      const planilhaLicitacao = XLSX.utils.json_to_sheet(camposLicitacao)
      planilhaLicitacao['!cols'] = [{ wch: 34 }, { wch: 60 }]
      XLSX.utils.book_append_sheet(livro, planilhaLicitacao, 'Licitação')

      const planilhaItens = XLSX.utils.json_to_sheet(linhasItens)
      planilhaItens['!cols'] = [
        { wch: 16 }, // Grupo
        { wch: 8 }, // Item
        { wch: 40 }, // Descrição referência
        { wch: 10 }, // Unidade
        { wch: 10 }, // Quantidade
        { wch: 16 }, // Valor unit. referência
        { wch: 16 }, // Valor total referência
        { wch: 14 }, // ME/EPP
        { wch: 16 }, // Cód. produto
        { wch: 30 }, // Descrição ofertada
        { wch: 18 }, // Fabricante
        { wch: 16 }, // Modelo
        { wch: 16 }, // Preço mínimo
        { wch: 16 }, // Preço com frete
        { wch: 18 }, // Valor total ofertado
        { wch: 16 }, // Diferença
        { wch: 18 }, // Status
      ]
      XLSX.utils.book_append_sheet(livro, planilhaItens, 'Itens')

      if (linhasHistorico.length > 0) {
        const planilhaHistorico = XLSX.utils.json_to_sheet(linhasHistorico)
        planilhaHistorico['!cols'] = [{ wch: 20 }, { wch: 24 }, { wch: 60 }]
        XLSX.utils.book_append_sheet(livro, planilhaHistorico, 'Histórico')
      }

      const numeroArquivo = licitacao.numeroPregao.replace(/[\\/:*?"<>|]/g, '-')
      const hoje = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(livro, `licitacao-${numeroArquivo}-${hoje}.xlsx`)
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="min-h-screen bg-paper p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            to="/admin/licitacoes"
            className="mb-2 inline-flex items-center gap-1.5 font-body text-sm font-semibold text-forest hover:underline"
          >
            ← Voltar para Licitações
          </Link>
          <h1 className="font-display text-2xl text-ink">
            {licitacao ? `Proposta Comercial — ${licitacao.numeroPregao}` : 'Proposta Comercial'}
          </h1>
          {licitacao && <p className="font-body text-sm text-ink-soft">{licitacao.objeto}</p>}
        </div>
        <div className="flex items-center gap-3">
          {salvoEm && (
            <span className="rounded-full bg-forest-mist px-3 py-1.5 font-body text-xs font-medium text-forest-deep">
              Alterações salvas
            </span>
          )}
          {licitacao && isAdmin && (
            <button
              type="button"
              onClick={exportarExcel}
              disabled={exportando}
              className="inline-flex items-center gap-2 rounded-lg border border-forest/30 bg-white px-4 py-2.5 font-body text-sm font-semibold text-forest-deep transition-colors hover:bg-forest-mist disabled:cursor-not-allowed disabled:text-ink-soft"
            >
              {exportando ? 'Exportando...' : '⭳ Exportar Excel'}
            </button>
          )}
        </div>
      </div>

      {carregando || !licitacao ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <p className="font-body text-sm text-ink-soft">Carregando itens...</p>
        </div>
      ) : (
        <div className="rounded-xl border border-ink-soft/10 bg-white p-6 shadow-soft">
          {!isAdmin && (
            <p className="mb-4 rounded-lg bg-paper-2/60 px-3 py-2 font-body text-xs text-ink-soft">
              Modo somente leitura — apenas o Administrador pode editar os itens e a proposta comercial.
            </p>
          )}

          {/* Prazo do Cliente — Admin e Analista veem o controle de
              liberar/travar (29/09, atualizado no mesmo dia a pedido do
              Márcio). Quem libera escolhe a data/hora até quando vale —
              não é mais um número fixo de dias. Trava ABSOLUTA (mesmo dia,
              novo pedido): a partir de 1 dia útil antes da sessão, 18h30,
              ninguém mais preenche a Proposta Comercial — nem Cliente, nem
              Admin, nem Analista preenchendo direto — então some tudo (o
              formulário de edição também fica bloqueado, via
              podeAdminPreencherPropostaDiretamente). */}
          {podeGerenciarPrazoCliente && licitacao.decisaoCliente !== 'recusar' && (
            propostaComercialTravadaDeVez(licitacao) ? (
              <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5">
                <p className="font-body text-xs text-red-700">
                  🔒 Prazo encerrado definitivamente ({DIAS_UTEIS_LIMITE_ABSOLUTO_PROPOSTA} dia útil antes da sessão,
                  18h30). Ninguém pode mais preencher ou editar a Proposta Comercial desta licitação — nem o
                  Cliente, nem o Admin, nem o Analista.
                </p>
              </div>
            ) : licitacao.prazoPropostaLiberado && licitacao.prazoPropostaLiberadoAte ? (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-forest-mist bg-forest-mist/40 px-3 py-2.5">
                <p className="font-body text-xs text-forest-deep">
                  🔓 Prazo liberado manualmente até{' '}
                  <strong>
                    {new Date(licitacao.prazoPropostaLiberadoAte).toLocaleDateString('pt-BR')}{' '}
                    {new Date(licitacao.prazoPropostaLiberadoAte).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </strong>{' '}
                  — o Cliente pode editar a proposta até lá, mesmo com o prazo automático vencido.
                </p>
                <button
                  type="button"
                  onClick={handleTravarPrazo}
                  disabled={alterandoPrazo}
                  className="whitespace-nowrap font-body text-xs font-semibold text-forest-deep hover:underline disabled:opacity-60"
                >
                  {alterandoPrazo ? 'Travando...' : 'Travar novamente'}
                </button>
              </div>
            ) : (
              !podeEditarPropostaCliente(licitacao) && (
                <div className="mb-4 rounded-lg border border-brass-pale bg-brass-pale/40 px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-body text-xs text-brass">
                      🔒 O prazo do Cliente encerrou (mais de {DIAS_UTEIS_LIMITE_EDICAO_PROPOSTA_CLIENTE} dias úteis
                      antes da sessão, 18h30). Ele não consegue mais editar a proposta.
                    </p>
                    {!mostrarFormLiberar && (
                      <button
                        type="button"
                        onClick={() => setMostrarFormLiberar(true)}
                        className="whitespace-nowrap font-body text-xs font-semibold text-forest-deep hover:underline"
                      >
                        Liberar novamente para o Cliente
                      </button>
                    )}
                  </div>

                  {mostrarFormLiberar && (
                    <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-brass-pale/60 pt-3">
                      <label className="flex flex-col gap-1">
                        <span className="font-body text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                          Liberar até a data
                        </span>
                        <input
                          type="date"
                          value={novaDataLiberacao}
                          onChange={(e) => setNovaDataLiberacao(e.target.value)}
                          className="rounded-lg border border-ink-soft/20 bg-white px-2.5 py-1.5 font-body text-sm text-ink"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="font-body text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                          Horário
                        </span>
                        <input
                          type="time"
                          value={novaHoraLiberacao}
                          onChange={(e) => setNovaHoraLiberacao(e.target.value)}
                          className="rounded-lg border border-ink-soft/20 bg-white px-2.5 py-1.5 font-body text-sm text-ink"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleConfirmarLiberacao}
                        disabled={alterandoPrazo}
                        className="rounded-lg bg-forest px-3.5 py-1.5 font-body text-xs font-semibold text-white hover:bg-forest-deep disabled:opacity-60"
                      >
                        {alterandoPrazo ? 'Liberando...' : 'Confirmar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMostrarFormLiberar(false)
                          setErroLiberacao(null)
                        }}
                        disabled={alterandoPrazo}
                        className="font-body text-xs font-semibold text-ink-soft hover:underline disabled:opacity-60"
                      >
                        Cancelar
                      </button>
                      {erroLiberacao && (
                        <p className="w-full font-body text-xs text-red-700">{erroLiberacao}</p>
                      )}
                    </div>
                  )}
                </div>
              )
            )
          )}

          <PropostaComercialCards
            licitacao={licitacao}
            podeEditarItens={isAdmin}
            podeEditarPropostaComercial={isAdmin && podeAdminPreencherPropostaDiretamente(licitacao)}
            salvando={salvando}
            onSalvar={handleSalvar}
            textoBotaoSalvar="Salvar alterações"
            ocultarNaoParticiparPorPadrao
          />
        </div>
      )}
    </div>
  )
}
