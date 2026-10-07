// src/pages/admin/licitacoes/LicitacaoFormModal.tsx
//
// Formulário de criação/edição de Licitação — originalmente construído a
// partir da Especificação Funcional v2.1, seção 4.2, com 5 abas. Reordenado
// e ampliado para 7 em 25/09, a partir do documento
// "Estrutura_Tela_Exigencias_Edital_SALUTTI_Final.docx":
//   1. Informações Gerais
//   2. Habilitação      (agora um checklist — ver tipos em licitacao.ts)
//   3. Declarações       (nova)
//   4. Condições Comerciais
//   5. Outras Exigências (nova — mapeada da seção "Aceitação do Produto" do documento)
//   6. Itens
//   7. Ponto de Atenção
//
// O campo "Cliente vinculado" e "Status" não fazem parte de nenhuma das 7
// abas descritas na spec, mas são necessários para o fluxo de atribuição de
// licitações a clientes (seção 2.1/6.1) — foram colocados na Aba 1.
//
// Usa os componentes genéricos do projeto (Modal, Tabs, TextField,
// SelectField, TextAreaField, CheckboxField, Button).
//
// PROP "carregando": true enquanto a página busca o registro completo
// (grupos/itens) via licitacaoService.buscarPorId() antes de abrir em modo
// edição — a listagem não traz esses dados, por design. Mostra um estado
// simples de carregamento no lugar do formulário enquanto isso acontece.

import { useEffect, useState, ReactNode } from 'react';
import { Modal } from '../../../components/Modal';
import { Tabs } from '../../../components/Tabs';
import { TextField } from '../../../components/TextField';
import { SelectField } from '../../../components/SelectField';
import { TextAreaField } from '../../../components/TextAreaField';
import { CheckboxField } from '../../../components/CheckboxField';
import { Button } from '../../../components/Button';
import {
  Licitacao,
  LicitacaoFormData,
  StatusLicitacao,
  STATUS_LICITACAO_LABEL,
  FormaPagamento,
  FORMA_PAGAMENTO_LABEL,
  ModalidadeLicitacao,
  MODALIDADE_LICITACAO_LABEL,
  MODALIDADE_LICITACAO_DESCRICAO,
  ParticipacaoLicitacao,
  PARTICIPACAO_LICITACAO_LABEL,
  PARTICIPACAO_LICITACAO_DESCRICAO,
  EstruturaLicitacao,
  ESTRUTURA_LICITACAO_LABEL,
  TipoContratacaoLicitacao,
  TIPO_CONTRATACAO_LICITACAO_LABEL,
  ProcedimentoLicitacao,
  PROCEDIMENTO_LICITACAO_LABEL,
  Habilitacao,
  CondicoesComerciais,
  ItemLicitacao,
  GrupoItens,
  DECISAO_CLIENTE_LABEL,
  ItemChecklistExigencia,
  StatusExigencia,
  criarChecklistVazio,
  criarHabilitacaoVazia,
  HABILITACAO_JURIDICA_ITENS,
  HABILITACAO_FISCAL_ITENS,
  HABILITACAO_ECONOMICO_FINANCEIRA_ITENS,
  HABILITACAO_TECNICA_ITENS,
  DECLARACOES_ITENS,
  OUTRAS_EXIGENCIAS_ITENS,
} from '../../../types/licitacao';
import { clienteService } from '../../../services/clienteService';
import { PorteEmpresa } from '../../../types/cliente';
import { calcularPrazoInterno, formatarDataHora, formatarMoeda, classificarUrgenciaPrazo } from '../../../utils/prazoUtils';
import { totalReferenciaItem, totalReferenciaGrupo, totalReferenciaOportunidade } from '../../../utils/licitacaoCalculos';
// Funções de formatação/conversão numérica BR (vírgula decimal, ponto de
// milhar) — centralizadas aqui (02/10) para não ficarem duplicadas entre
// este arquivo e PropostaComercialCards.tsx, o que já causou um bug real
// (ver comentário no próprio utilitário).
import { numeroParaCampoDecimal, campoParaNumeroDecimal, aplicarMascaraAoDigitar } from '../../../utils/formatoNumerico';
// Importação de edital por IA (05/10, a pedido do Márcio) — pré-preenche o
// formulário a partir do PDF do edital; nunca grava sozinha, sempre fica
// como rascunho para o Admin/Analista revisar e confirmar antes de salvar.
import { editalIaService } from '../../../services/editalIaService';
import type { ExtracaoEditalIA, ItemChecklistExtraidoIA } from '../../../types/extracaoEditalIA';

// Balão "ⓘ" com a explicação de cada exigência dos checklists (texto do
// Guia de Exigências do Edital — ver src/data/explicacaoExigencias.ts).
import { InfoTooltip } from '../../../components/InfoTooltip';
import { explicacaoDaExigencia } from '../../../data/explicacaoExigencias';

// Chave geral da importação de edital por IA. Mantida em false enquanto a
// função extrair-edital-ia não estiver publicada (falta chave da API +
// deploy). Para reativar: troque para true — nada mais precisa mudar.
const IMPORTACAO_EDITAL_IA_ATIVA = false;

// Monta a lista de abas com a contagem de itens de checklist ainda sem
// marcação (Exigido/Não exigido) ao lado do nome — para o Analista ver de
// longe onde falta preencher, sem precisar entrar em cada aba. O item
// "Outras" de cada seção não entra nessa contagem (ver itensPendentes).
function construirTabs(pendentesHabilitacao: number, pendentesDeclaracoes: number, pendentesOutras: number) {
  const comContagem = (label: string, pendentes: number) => (pendentes > 0 ? `${label} (${pendentes})` : label);
  return [
    { id: 'gerais', label: 'Informações Gerais' },
    { id: 'habilitacao', label: comContagem('Habilitação', pendentesHabilitacao) },
    { id: 'declaracoes', label: comContagem('Declarações', pendentesDeclaracoes) },
    { id: 'comerciais', label: 'Cond. Comerciais' },
    { id: 'outras', label: comContagem('Outras Exigências', pendentesOutras) },
    { id: 'itens', label: 'Itens' },
    { id: 'atencao', label: 'Ponto de Atenção' },
  ];
}

// Um item conta como "pendente" quando ainda não foi marcado Exigido/Não
// exigido — exceto o item "Outras" de cada seção, que é sempre opcional (o
// Analista só usa se o edital tiver alguma exigência fora da lista fixa) e
// nunca bloqueia o salvamento.
function itensPendentes(itens: ItemChecklistExigencia[]): ItemChecklistExigencia[] {
  return itens.filter((item) => item.status == null && item.label !== 'Outras');
}

function gerarIdLocal(prefixo: string): string {
  return `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Rascunho local (só no navegador) do formulário de NOVA licitação — não
// se aplica à edição de uma licitação já existente (essa já está salva de
// verdade no banco). Guarda automaticamente enquanto a pessoa digita, para
// não perder o preenchimento se ela precisar sair da página no meio.
const CHAVE_RASCUNHO_NOVA_LICITACAO = 'salutti:rascunho-nova-licitacao';

function lerRascunhoSalvo(): LicitacaoFormData | null {
  try {
    const bruto = window.localStorage.getItem(CHAVE_RASCUNHO_NOVA_LICITACAO);
    return bruto ? (JSON.parse(bruto) as LicitacaoFormData) : null;
  } catch {
    return null;
  }
}

function salvarRascunho(dados: LicitacaoFormData) {
  try {
    window.localStorage.setItem(CHAVE_RASCUNHO_NOVA_LICITACAO, JSON.stringify(dados));
  } catch {
    // Armazenamento cheio ou indisponível (modo privado, etc.) — o
    // rascunho é só uma conveniência, não é crítico falhar silenciosamente.
  }
}

function limparRascunho() {
  try {
    window.localStorage.removeItem(CHAVE_RASCUNHO_NOVA_LICITACAO);
  } catch {
    // idem acima
  }
}

/** Converte um ISO string (UTC, como salvo no banco/estado) para o formato
 *  "AAAA-MM-DDTHH:mm" que o input datetime-local espera, respeitando o
 *  fuso horário LOCAL do navegador — ao contrário de um slice() direto no
 *  ISO (que pega a hora em UTC e "engana" o campo, fazendo 09:30 local
 *  aparecer como 12:30 depois de salvo, no fuso do Brasil UTC-3). */
function paraInputDatetimeLocal(isoString?: string): string {
  if (!isoString) return '';
  const data = new Date(isoString);
  if (Number.isNaN(data.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}T${pad(data.getHours())}:${pad(data.getMinutes())}`;
}

function criarFormularioVazio(): LicitacaoFormData {
  return {
    dataLicitacao: '',
    portal: '',
    objeto: '',
    numeroPregao: '',
    orgao: '',
    estado: '',
    municipio: '',
    distanciaMatriz: '',
    modalidade: '',
    formaDisputa: '',
    modoDisputa: '',
    participacao: '',
    estrutura: '',
    tipoContratacao: '',
    procedimento: '',
    capag: '',
    linkEdital: '',
    nomesArquivosEdital: [] as string[],
    valorTotalLicitacao: undefined,

    clienteId: '',
    status: 'pendente',

    habilitacao: criarHabilitacaoVazia(),
    declaracoes: criarChecklistVazio(DECLARACOES_ITENS),

    condicoesComerciais: {
      formaPagamento: 'credito_conta',
      recebimentoBanco: '',
      possuiGarantias: false,
      localEntrega: '',
    },

    outrasExigencias: criarChecklistVazio(OUTRAS_EXIGENCIAS_ITENS),

    pontosAtencao: '',

    grupos: [],
    itens: [],

    decisaoCliente: 'pendente',
    cobrarFrete: false,
    statusProposta: 'rascunho',

    // Nova licitação sempre começa com o prazo de proposta no fluxo
    // automático (não liberado manualmente) — ver prazoPropostaLiberado em
    // licitacao.ts.
    prazoPropostaLiberado: false,

    observacoes: '',
  };
}

// Garante que uma licitação carregada do banco (edição) ou de um rascunho
// antigo salvo no navegador tenha o formato novo de checklist. Licitações
// cadastradas antes de 25/09 não têm esses campos (ou têm o formato antigo,
// de texto livre) — decisão tomada com o Márcio: elas reabrem com o
// checklist em branco, em vez de quebrar a tela ou tentar migrar o texto
// livre automaticamente.
//
// Um array VAZIO conta como "ainda não preenchido", não como "checklist
// legitimamente sem itens" — os itens de cada seção são fixos (vêm de
// HABILITACAO_JURIDICA_ITENS etc.), então o app nunca produz um checklist
// com 0 itens por conta própria. Um array vazio normalmente significa que a
// coluna do banco ainda não existe (migração 018 não rodada) ou veio
// nula — nos dois casos, a solução é semear com os itens fixos da seção,
// não deixar a tabela em branco.
function estaPreenchido(valor: unknown): valor is ItemChecklistExigencia[] {
  return Array.isArray(valor) && valor.length > 0;
}

function normalizarHabilitacao(valor: unknown): Habilitacao {
  const h = (valor ?? {}) as Partial<Habilitacao>;
  return {
    juridica: estaPreenchido(h.juridica) ? h.juridica : criarChecklistVazio(HABILITACAO_JURIDICA_ITENS),
    fiscalSocialTrabalhista: estaPreenchido(h.fiscalSocialTrabalhista)
      ? h.fiscalSocialTrabalhista
      : criarChecklistVazio(HABILITACAO_FISCAL_ITENS),
    economicoFinanceira: estaPreenchido(h.economicoFinanceira)
      ? h.economicoFinanceira
      : criarChecklistVazio(HABILITACAO_ECONOMICO_FINANCEIRA_ITENS),
    tecnica: estaPreenchido(h.tecnica) ? h.tecnica : criarChecklistVazio(HABILITACAO_TECNICA_ITENS),
  };
}

function normalizarChecklistCampo(
  valor: unknown,
  definicao: ReadonlyArray<{ id: string; label: string }>
): ItemChecklistExigencia[] {
  return estaPreenchido(valor) ? valor : criarChecklistVazio(definicao);
}

// Aplica o que a IA extraiu do edital sobre um checklist em branco (lista
// fixa de ids/labels) — só ids que batem com a lista fixa são aplicados;
// qualquer id desconhecido devolvido pela IA é ignorado (a validação na
// Edge Function já devia ter barrado isso, mas o front-end não confia
// cegamente). Itens não mencionados na extração ficam sem status, como se
// o formulário tivesse acabado de ser criado — aguardando revisão manual.
function mesclarChecklistComExtracao(
  checklistVazio: ItemChecklistExigencia[],
  itensExtraidos: ItemChecklistExtraidoIA[] | undefined
): ItemChecklistExigencia[] {
  if (!itensExtraidos || itensExtraidos.length === 0) return checklistVazio;
  const porId = new Map(itensExtraidos.map((item) => [item.id, item]));
  return checklistVazio.map((item) => {
    const extraido = porId.get(item.id);
    if (!extraido) return item;
    return { ...item, status: extraido.status, detalhamento: extraido.detalhamento };
  });
}

interface LicitacaoFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dados: LicitacaoFormData) => Promise<void>;
  licitacaoEmEdicao?: Licitacao | null;
  /** true enquanto a página está buscando o registro completo (grupos/itens)
   *  antes de abrir em modo edição — mostra um estado de carregamento no
   *  lugar do formulário. Opcional: se omitida, o formulário renderiza
   *  normalmente assim que `licitacaoEmEdicao` chegar. */
  carregando?: boolean;
}

// Agrupa um bloco de campos da aba "Informações Gerais" num card com título —
// só reorganização visual (02/10, a pedido do Márcio), nenhum campo foi
// adicionado, removido ou teve sua lógica alterada.
function SecaoFormulario({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-soft/15 p-4">
      <p className="mb-3.5 font-body text-sm font-semibold text-ink">{titulo}</p>
      <div className="grid grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

export function LicitacaoFormModal({ isOpen, onClose, onSave, licitacaoEmEdicao, carregando: carregandoDados }: LicitacaoFormModalProps) {
  const [abaAtiva, setAbaAtiva] = useState('gerais');
  const [form, setForm] = useState<LicitacaoFormData>(criarFormularioVazio());
  const [salvando, setSalvando] = useState(false);
  const [clientes, setClientes] = useState<Array<{ value: string; label: string; porte: PorteEmpresa }>>([]);
  const [rascunhoRestaurado, setRascunhoRestaurado] = useState(false);
  // Texto exibido no campo "Valor total da licitação" — separado do número
  // em `form.valorTotalLicitacao` porque um <input type="number"> nativo
  // não aceita o padrão brasileiro (ponto de milhar + vírgula decimal): a
  // pessoa digitava "4.575.501,40" e o navegador silenciosamente descartava
  // os separadores extras, salvando um valor completamente errado (ex.:
  // 4,58) sem nenhum aviso. Ver numeroParaCampoDecimal/campoParaNumeroDecimal.
  const [valorTotalTexto, setValorTotalTexto] = useState('');
  // Texto dos campos "Valor (R$)" / "Percentual (%)" do Intervalo de
  // lances — mesmo motivo do valorTotalTexto acima (BR-mask em vez de
  // <input type="number"> nativo). Só um dos dois é mostrado por vez,
  // conforme tipoIntervaloLances.
  const [valorIntervaloLancesTexto, setValorIntervaloLancesTexto] = useState('');
  const [percentualIntervaloLancesTexto, setPercentualIntervaloLancesTexto] = useState('');
  // Campos "clicar para escrever": só viram caixa de digitação quando o
  // analista/admin clica no valor; ao sair do campo, voltam a ser texto.
  const [editandoValorIntervaloLances, setEditandoValorIntervaloLances] = useState(false);
  const [editandoPercentualIntervaloLances, setEditandoPercentualIntervaloLances] = useState(false);
  // Mensagem exibida quando o Analista tenta salvar sem marcar algum item
  // do checklist (Habilitação/Declarações/Outras Exigências) — ver
  // handleSalvar.
  const [erroChecklist, setErroChecklist] = useState<string | null>(null);
  // Importação de edital por IA — ver editalIaService.ts. "importando" cobre
  // tanto o upload do PDF quanto a chamada à Edge Function (uma única
  // operação do ponto de vista do Analista). "camposComBaixaConfianca" vem
  // da própria extração e vira o aviso "confira com atenção" depois de
  // aplicada; fica vazio antes da primeira importação ou após descartada.
  const [importandoEdital, setImportandoEdital] = useState(false);
  const [erroImportacaoEdital, setErroImportacaoEdital] = useState<string | null>(null);
  const [camposComBaixaConfianca, setCamposComBaixaConfianca] = useState<string[]>([]);
  const clienteEhDemais = clientes.find((c) => c.value === form.clienteId)?.porte === 'demais';

  useEffect(() => {
    if (!isOpen) return;
    setAbaAtiva('gerais');
    setErroChecklist(null);

    if (licitacaoEmEdicao) {
      // Editando uma licitação existente — rascunho local não se aplica.
      setForm({
        ...licitacaoEmEdicao,
        habilitacao: normalizarHabilitacao(licitacaoEmEdicao.habilitacao),
        declaracoes: normalizarChecklistCampo(licitacaoEmEdicao.declaracoes, DECLARACOES_ITENS),
        outrasExigencias: normalizarChecklistCampo(licitacaoEmEdicao.outrasExigencias, OUTRAS_EXIGENCIAS_ITENS),
      });
      setValorTotalTexto(numeroParaCampoDecimal(licitacaoEmEdicao.valorTotalLicitacao, 10, 2));
      setValorIntervaloLancesTexto(
        numeroParaCampoDecimal(licitacaoEmEdicao.condicoesComerciais.valorIntervaloLances, 4, 2)
      );
      setPercentualIntervaloLancesTexto(
        numeroParaCampoDecimal(licitacaoEmEdicao.condicoesComerciais.percentualIntervaloLances, 4)
      );
      setRascunhoRestaurado(false);
      return;
    }

    // Nova licitação: se existir um rascunho salvo no navegador, restaura.
    const rascunho = lerRascunhoSalvo();
    if (rascunho) {
      setForm({
        ...rascunho,
        habilitacao: normalizarHabilitacao(rascunho.habilitacao),
        declaracoes: normalizarChecklistCampo(rascunho.declaracoes, DECLARACOES_ITENS),
        outrasExigencias: normalizarChecklistCampo(rascunho.outrasExigencias, OUTRAS_EXIGENCIAS_ITENS),
      });
      setValorTotalTexto(numeroParaCampoDecimal(rascunho.valorTotalLicitacao, 10, 2));
      setValorIntervaloLancesTexto(numeroParaCampoDecimal(rascunho.condicoesComerciais.valorIntervaloLances, 4, 2));
      setPercentualIntervaloLancesTexto(
        numeroParaCampoDecimal(rascunho.condicoesComerciais.percentualIntervaloLances, 4)
      );
      setRascunhoRestaurado(true);
    } else {
      setForm(criarFormularioVazio());
      setValorTotalTexto('');
      setValorIntervaloLancesTexto('');
      setPercentualIntervaloLancesTexto('');
      setRascunhoRestaurado(false);
    }
  }, [isOpen, licitacaoEmEdicao]);

  // Salva o formulário no navegador a cada mudança (só em modo "nova
  // licitação" — editar uma já existente não usa rascunho local). Um
  // pequeno atraso evita gravar a cada tecla digitada.
  useEffect(() => {
    if (!isOpen || licitacaoEmEdicao) return;
    const temConteudo =
      form.portal || form.numeroPregao || form.orgao || form.objeto || form.dataLicitacao || form.itens.length > 0;
    if (!temConteudo) return;
    const timer = window.setTimeout(() => salvarRascunho(form), 500);
    return () => window.clearTimeout(timer);
  }, [form, isOpen, licitacaoEmEdicao]);

  function descartarRascunho() {
    limparRascunho();
    setForm(criarFormularioVazio());
    setValorTotalTexto('');
    setRascunhoRestaurado(false);
  }

  useEffect(() => {
    if (!isOpen) return;
    let ativo = true;
    // 200 cobre a carteira inteira sem precisar de paginação aqui — a
    // lista de clientes deste seletor não costuma passar disso.
    clienteService.list({ page: 1, pageSize: 200 }).then((resultado) => {
      if (!ativo) return;
      setClientes(resultado.data.map((c) => ({ value: c.id, label: c.empresa.nomeFantasia, porte: c.empresa.porte })));
    });
    return () => {
      ativo = false;
    };
  }, [isOpen]);

  function atualizarCampo<K extends keyof LicitacaoFormData>(campo: K, valor: LicitacaoFormData[K]) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  // Atualiza um item de uma das 4 subseções de Habilitação (juridica,
  // fiscalSocialTrabalhista, economicoFinanceira, tecnica) pelo seu id.
  function atualizarItemHabilitacao(
    subsecao: keyof Habilitacao,
    id: string,
    patch: Partial<Pick<ItemChecklistExigencia, 'status' | 'detalhamento'>>
  ) {
    setForm((atual) => ({
      ...atual,
      habilitacao: {
        ...atual.habilitacao,
        [subsecao]: atual.habilitacao[subsecao].map((item) =>
          item.id === id ? { ...item, ...patch } : item
        ),
      },
    }));
  }

  // Mesma lógica acima, para os checklists de Declarações e Outras
  // Exigências — que ficam direto na raiz do formulário, não dentro de
  // Habilitação.
  function atualizarItemChecklist(
    campo: 'declaracoes' | 'outrasExigencias',
    id: string,
    patch: Partial<Pick<ItemChecklistExigencia, 'status' | 'detalhamento'>>
  ) {
    setForm((atual) => ({
      ...atual,
      [campo]: atual[campo].map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  }

  function atualizarCondicoes<K extends keyof CondicoesComerciais>(campo: K, valor: CondicoesComerciais[K]) {
    setForm((atual) => ({ ...atual, condicoesComerciais: { ...atual.condicoesComerciais, [campo]: valor } }));
  }

  // --- Aba 5 — Itens: grupos e itens ------------------------------------

  function adicionarGrupo() {
    const numero = String(form.grupos.length + 1);
    const novoGrupo: GrupoItens = { id: gerarIdLocal('grp'), numero, nome: `Grupo ${numero}` };
    setForm((atual) => ({ ...atual, grupos: [...atual.grupos, novoGrupo] }));
  }

  function renumerarGrupo(id: string, numero: string) {
    setForm((atual) => ({
      ...atual,
      grupos: atual.grupos.map((g) => (g.id === id ? { ...g, numero } : g)),
    }));
  }

  function renomearGrupo(id: string, nome: string) {
    setForm((atual) => ({
      ...atual,
      grupos: atual.grupos.map((g) => (g.id === id ? { ...g, nome } : g)),
    }));
  }

  function removerGrupo(id: string) {
    // Remove o grupo e os itens que pertenciam a ele — para manter um item
    // órfão, seria preciso "desvincular" antes de excluir o grupo.
    setForm((atual) => ({
      ...atual,
      grupos: atual.grupos.filter((g) => g.id !== id),
      itens: atual.itens.filter((i) => i.grupoId !== id),
    }));
  }

  function adicionarItem(grupoId?: string) {
    const novoItem: ItemLicitacao = {
      id: gerarIdLocal('item'),
      grupoId,
      numero: '',
      descricao: '',
      unidadeMedida: '',
      quantidade: 1,
      precoReferencia: 0,
      exclusivoMeEpp: false,
    };
    setForm((atual) => ({ ...atual, itens: [...atual.itens, novoItem] }));
  }

  function atualizarItem<K extends keyof ItemLicitacao>(id: string, campo: K, valor: ItemLicitacao[K]) {
    setForm((atual) => ({
      ...atual,
      itens: atual.itens.map((item) => (item.id === id ? { ...item, [campo]: valor } : item)),
    }));
  }

  function removerItem(id: string) {
    setForm((atual) => ({ ...atual, itens: atual.itens.filter((i) => i.id !== id) }));
  }

  // Pré-preenche o formulário com o que a IA extraiu do PDF do edital.
  // Nunca salva sozinha — só popula o estado, exatamente como se o
  // Analista tivesse digitado tudo à mão. "estrutura"/"participacao" vêm
  // da IA já nos valores de enum corretos (EstruturaLicitacao/
  // ParticipacaoLicitacao), conforme o prompt da Edge Function.
  function aplicarExtracaoIA(extracao: ExtracaoEditalIA) {
    const novosGrupos: GrupoItens[] = extracao.grupos.map((g) => ({
      id: gerarIdLocal('grp'),
      numero: g.numero,
      nome: g.nome,
    }));
    const grupoIdPorNumero = new Map(novosGrupos.map((g) => [g.numero, g.id]));

    const novosItens: ItemLicitacao[] = extracao.itens.map((item) => ({
      id: gerarIdLocal('item'),
      grupoId: item.grupoNumero ? grupoIdPorNumero.get(item.grupoNumero) : undefined,
      numero: item.numero,
      descricao: item.descricao,
      unidadeMedida: item.unidadeMedida,
      quantidade: item.quantidade,
      precoReferencia: item.precoReferencia,
      exclusivoMeEpp: item.exclusivoMeEpp,
    }));

    setForm((atual) => ({
      ...atual,
      dataLicitacao: extracao.dataLicitacao ?? atual.dataLicitacao,
      portal: extracao.portal,
      objeto: extracao.objeto,
      numeroPregao: extracao.numeroPregao,
      orgao: extracao.orgao,
      estado: extracao.estado,
      municipio: extracao.municipio,
      modalidade: extracao.modalidade,
      estrutura: extracao.estrutura,
      tipoContratacao: extracao.tipoContratacao,
      procedimento: extracao.procedimento,
      formaDisputa: extracao.formaDisputa,
      modoDisputa: extracao.modoDisputa,
      participacao: extracao.participacao,
      capag: extracao.capag ?? atual.capag,
      valorTotalLicitacao: extracao.valorTotalLicitacao ?? atual.valorTotalLicitacao,

      habilitacao: {
        juridica: mesclarChecklistComExtracao(atual.habilitacao.juridica, extracao.habilitacao.juridica),
        fiscalSocialTrabalhista: mesclarChecklistComExtracao(
          atual.habilitacao.fiscalSocialTrabalhista,
          extracao.habilitacao.fiscalSocialTrabalhista
        ),
        economicoFinanceira: mesclarChecklistComExtracao(
          atual.habilitacao.economicoFinanceira,
          extracao.habilitacao.economicoFinanceira
        ),
        tecnica: mesclarChecklistComExtracao(atual.habilitacao.tecnica, extracao.habilitacao.tecnica),
      },

      declaracoes: mesclarChecklistComExtracao(atual.declaracoes, extracao.declaracoes),
      outrasExigencias: mesclarChecklistComExtracao(atual.outrasExigencias, extracao.outrasExigencias),

      condicoesComerciais: {
        ...atual.condicoesComerciais,
        ...extracao.condicoesComerciais,
      },

      grupos: novosGrupos,
      itens: novosItens,

      pontosAtencao: [atual.pontosAtencao, extracao.pontosAtencao].filter(Boolean).join('\n\n'),
    }));

    // Campos de texto mascarado (BR) não vêm do spread acima — precisam
    // ser reformatados manualmente, mesmo padrão usado ao carregar uma
    // licitação existente (ver useEffect de abertura do modal).
    setValorTotalTexto(numeroParaCampoDecimal(extracao.valorTotalLicitacao, 10, 2));
    setValorIntervaloLancesTexto(
      numeroParaCampoDecimal(extracao.condicoesComerciais.valorIntervaloLances, 4, 2)
    );
    setPercentualIntervaloLancesTexto(
      numeroParaCampoDecimal(extracao.condicoesComerciais.percentualIntervaloLances, 4)
    );

    setCamposComBaixaConfianca(extracao.camposComBaixaConfianca ?? []);
  }

  async function handleImportarEdital(arquivo: File) {
    setImportandoEdital(true);
    setErroImportacaoEdital(null);
    try {
      const { extracao } = await editalIaService.extrairDoPdf(arquivo);
      aplicarExtracaoIA(extracao);
      setAbaAtiva('gerais');
    } catch (erro) {
      setErroImportacaoEdital(erro instanceof Error ? erro.message : 'Erro desconhecido ao importar o edital.');
    } finally {
      setImportandoEdital(false);
    }
  }

  async function handleSalvar() {
    // Bloqueia o salvamento se faltar algum campo obrigatório da aba
    // "Informações Gerais" — sem essa checagem, o formulário deixava
    // enviar "clienteId" vazio pro banco, que rejeitava com um erro
    // críptico de UUID inválido ("invalid input syntax for type uuid: ''"),
    // sem nenhuma mensagem clara pro Analista. A pedido do Márcio (05/10).
    const camposObrigatoriosFaltando: string[] = [];
    if (!form.portal) camposObrigatoriosFaltando.push('Portal');
    if (!form.numeroPregao) camposObrigatoriosFaltando.push('Número do pregão');
    if (!form.orgao) camposObrigatoriosFaltando.push('Órgão');
    if (!form.estado) camposObrigatoriosFaltando.push('Estado (UF)');
    if (!form.municipio) camposObrigatoriosFaltando.push('Município');
    if (!form.dataLicitacao) camposObrigatoriosFaltando.push('Data e horário da licitação');
    if (!form.modalidade) camposObrigatoriosFaltando.push('Modalidade');
    if (!form.clienteId) camposObrigatoriosFaltando.push('Cliente vinculado');
    if (!form.status) camposObrigatoriosFaltando.push('Status');

    if (camposObrigatoriosFaltando.length > 0) {
      setAbaAtiva('gerais');
      setErroChecklist(
        `Preencha os campos obrigatórios antes de salvar (aba "Informações Gerais"): ${camposObrigatoriosFaltando.join(', ')}.`
      );
      return;
    }

    // Bloqueia o salvamento se a licitação for "Exclusiva ME/EPP" e o
    // cliente vinculado NÃO for ME/EPP (porte "Demais") — por definição
    // legal (Lei 14.133/2021), uma empresa "Demais" não pode participar de
    // licitação exclusiva, então não faz sentido registrar essa licitação
    // pra esse cliente. A pedido do Márcio (02/10).
    if (form.participacao === 'exclusiva_me_epp' && clienteEhDemais) {
      setAbaAtiva('gerais');
      setErroChecklist(
        'Esta licitação está marcada como "Exclusiva ME/EPP" (campo "Participação"), mas o cliente vinculado é classificado como "Demais" — ele não pode participar de uma licitação exclusiva. Ajuste o campo ou verifique o cliente vinculado antes de salvar.'
      );
      return;
    }

    // Bloqueia o salvamento se sobrar algum item do checklist sem marcação
    // (Exigido/Não exigido) — exceto o item "Outras" de cada seção, que é
    // opcional. Leva o Analista direto pra primeira aba com pendência.
    const pendencias = [
      { aba: 'habilitacao', label: 'Habilitação', quantidade: pendentesHabilitacao },
      { aba: 'declaracoes', label: 'Declarações', quantidade: pendentesDeclaracoes },
      { aba: 'outras', label: 'Outras Exigências', quantidade: pendentesOutras },
    ].filter((p) => p.quantidade > 0);

    if (pendencias.length > 0) {
      setAbaAtiva(pendencias[0].aba);
      setErroChecklist(
        `Marque "Exigido" ou "Não exigido" em todos os itens antes de salvar (o item "Outras" de cada seção é opcional). Faltam: ${pendencias
          .map((p) => `${p.label} (${p.quantidade})`)
          .join(', ')}.`
      );
      return;
    }
    setErroChecklist(null);

    setSalvando(true);
    try {
      await onSave(form);
      if (!licitacaoEmEdicao) limparRascunho();
      onClose();
    } finally {
      setSalvando(false);
    }
  }

  const pendentesHabilitacao =
    itensPendentes(form.habilitacao.juridica).length +
    itensPendentes(form.habilitacao.fiscalSocialTrabalhista).length +
    itensPendentes(form.habilitacao.economicoFinanceira).length +
    itensPendentes(form.habilitacao.tecnica).length;
  const pendentesDeclaracoes = itensPendentes(form.declaracoes).length;
  const pendentesOutras = itensPendentes(form.outrasExigencias).length;
  const tabs = construirTabs(pendentesHabilitacao, pendentesDeclaracoes, pendentesOutras);

  const dataParaPrazo = form.dataEfetivaLicitacao || form.dataLicitacao;
  const prazoInterno = dataParaPrazo ? calcularPrazoInterno(dataParaPrazo) : null;
  const urgencia = dataParaPrazo ? classificarUrgenciaPrazo(dataParaPrazo) : null;

  const itensIndividuais = form.itens.filter((i) => !i.grupoId);
  const totalOportunidade = totalReferenciaOportunidade(form.itens);

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={licitacaoEmEdicao ? `Editar licitação — ${licitacaoEmEdicao.numeroPregao}` : 'Nova licitação'}
      size="full"
      footer={
        carregandoDados ? undefined : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={handleSalvar} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar licitação'}
            </Button>
          </>
        )
      }
    >
      {carregandoDados ? (
        <div className="flex min-h-[320px] items-center justify-center">
          <p className="font-body text-sm text-ink-soft">Carregando dados da licitação...</p>
        </div>
      ) : (
        <>
          <Tabs tabs={tabs} activeTab={abaAtiva} onChange={setAbaAtiva} />

          {/* Importação de edital por IA — só faz sentido numa licitação
              nova; numa edição já existe dado real, importar por cima
              poderia sobrescrever algo que o Analista já confirmou. */}
          {IMPORTACAO_EDITAL_IA_ATIVA && !licitacaoEmEdicao && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-forest/20 bg-forest/5 px-3 py-2">
              <label className="flex cursor-pointer items-center gap-2 font-body text-xs font-semibold text-forest">
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  disabled={importandoEdital}
                  onChange={(e) => {
                    const arquivo = e.target.files?.[0];
                    e.target.value = ''; // permite re-selecionar o mesmo arquivo depois
                    if (arquivo) void handleImportarEdital(arquivo);
                  }}
                />
                <span className="rounded-md border border-forest/30 bg-white px-3 py-1.5">
                  {importandoEdital ? 'Lendo edital...' : '📄 Importar edital (PDF)'}
                </span>
              </label>
              <p className="font-body text-xs text-ink-soft">
                A IA lê o PDF e pré-preenche o formulário — revise tudo antes de salvar.
              </p>
            </div>
          )}

          {erroImportacaoEdital && (
            <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 font-body text-xs text-red-700">
              Falha ao importar o edital: {erroImportacaoEdital}
            </div>
          )}

          {camposComBaixaConfianca.length > 0 && (
            <div className="mb-4 rounded-lg border border-brass/40 bg-brass-pale px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <p className="font-body text-xs text-brass">
                  <span className="font-semibold">Confira com atenção</span> — a IA teve baixa certeza
                  nestes campos ao ler o edital: {camposComBaixaConfianca.join(', ')}.
                </p>
                <button
                  type="button"
                  onClick={() => setCamposComBaixaConfianca([])}
                  className="whitespace-nowrap font-body text-xs font-semibold text-brass underline hover:no-underline"
                >
                  Já conferi
                </button>
              </div>
            </div>
          )}

          {erroChecklist && (
            <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 font-body text-xs text-red-700">
              {erroChecklist}
            </div>
          )}

          {rascunhoRestaurado && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-brass-pale px-3 py-2">
              <p className="font-body text-xs text-brass">
                Rascunho restaurado do preenchimento anterior, salvo automaticamente neste navegador.
              </p>
              <button
                type="button"
                onClick={descartarRascunho}
                className="whitespace-nowrap font-body text-xs font-semibold text-brass underline hover:no-underline"
              >
                Descartar e começar do zero
              </button>
            </div>
          )}

          <div className="mt-5 min-h-[320px]">
        {/* Aba 1 — Informações Gerais */}
        {abaAtiva === 'gerais' && (
          <div className="space-y-4">
            <SecaoFormulario titulo="Datas e prazos">
              <TextField
                label="Data e horário da licitação *"
                required
                type="datetime-local"
                value={paraInputDatetimeLocal(form.dataLicitacao)}
                onChange={(e) =>
                  atualizarCampo(
                    'dataLicitacao',
                    e.target.value ? new Date(e.target.value).toISOString() : ''
                  )
                }
              />
              <TextField
                label="Data efetiva (se suspensa e remarcada)"
                type="datetime-local"
                value={paraInputDatetimeLocal(form.dataEfetivaLicitacao)}
                onChange={(e) =>
                  atualizarCampo('dataEfetivaLicitacao', e.target.value ? new Date(e.target.value).toISOString() : undefined)
                }
              />
              {prazoInterno && (
                <div
                  className={`col-span-2 rounded-lg border px-4 py-3 font-body text-sm ${
                    urgencia === 'vencido'
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : urgencia === 'atencao'
                      ? 'border-brass/40 bg-brass-pale text-brass'
                      : 'border-forest/30 bg-forest-mist text-forest-deep'
                  }`}
                >
                  <strong>Limite de retorno do cliente (automático):</strong> {formatarDataHora(prazoInterno.toISOString())}
                  {urgencia === 'vencido' && ' — já vencido!'}
                  {urgencia === 'atencao' && ' — atenção, prazo próximo!'}
                  {licitacaoEmEdicao && (
                    <span className="ml-1 text-xs opacity-80">
                      (cadastrada em {formatarDataHora(licitacaoEmEdicao.criadoEm)})
                    </span>
                  )}
                </div>
              )}
            </SecaoFormulario>

            <SecaoFormulario titulo="Identificação">
              <TextField
                label="Portal *"
                required
                value={form.portal}
                onChange={(e) => atualizarCampo('portal', e.target.value)}
              />
              <TextField
                label="Número do pregão *"
                required
                value={form.numeroPregao}
                onChange={(e) => atualizarCampo('numeroPregao', e.target.value)}
              />
              <div className="col-span-2">
                <SelectField
                  label="Objeto da licitação"
                  value={form.objeto}
                  onChange={(e) => atualizarCampo('objeto', e.target.value)}
                  placeholder="Selecione"
                  options={[
                    { value: 'Produto', label: 'Produto' },
                    { value: 'Serviços', label: 'Serviços' },
                    { value: 'Obra', label: 'Obra' },
                    { value: 'Serviços Técnicos', label: 'Serviços Técnicos' },
                  ]}
                />
              </div>
            </SecaoFormulario>

            <SecaoFormulario titulo="Órgão e localização">
              <div className="col-span-2">
                <TextField
                  label="Órgão *"
                  required
                  value={form.orgao}
                  onChange={(e) => atualizarCampo('orgao', e.target.value)}
                />
              </div>
              <TextField
                label="Estado (UF) *"
                required
                maxLength={2}
                value={form.estado}
                onChange={(e) => atualizarCampo('estado', e.target.value.toUpperCase())}
                placeholder="SP"
              />
              <TextField
                label="Município *"
                required
                value={form.municipio}
                onChange={(e) => atualizarCampo('municipio', e.target.value)}
              />
              <TextField
                label="Distância da matriz"
                value={form.distanciaMatriz}
                onChange={(e) => atualizarCampo('distanciaMatriz', e.target.value)}
              />
              <TextField
                label="CAPAG"
                value={form.capag}
                onChange={(e) => atualizarCampo('capag', e.target.value)}
              />
            </SecaoFormulario>

            <SecaoFormulario titulo="Modalidade e regras de disputa">
              <div>
                <SelectField
                  label="Modalidade *"
                  required
                  value={form.modalidade}
                  onChange={(e) => atualizarCampo('modalidade', e.target.value as ModalidadeLicitacao)}
                  placeholder="Selecione"
                  options={Object.entries(MODALIDADE_LICITACAO_LABEL).map(([value, label]) => ({ value, label }))}
                />
                {form.modalidade && (
                  <p className="mt-1 font-body text-xs text-ink-soft">
                    {MODALIDADE_LICITACAO_DESCRICAO[form.modalidade as ModalidadeLicitacao]}
                  </p>
                )}
              </div>
              <div>
                <SelectField
                  label="Participação"
                  value={form.participacao}
                  onChange={(e) => atualizarCampo('participacao', e.target.value as ParticipacaoLicitacao)}
                  placeholder="Selecione"
                  options={Object.entries(PARTICIPACAO_LICITACAO_LABEL).map(([value, label]) => ({ value, label }))}
                />
                {form.participacao && (
                  <p className="mt-1 font-body text-xs text-ink-soft">
                    {PARTICIPACAO_LICITACAO_DESCRICAO[form.participacao as ParticipacaoLicitacao]}
                  </p>
                )}
              </div>
              <SelectField
                label="Forma de disputa"
                value={form.formaDisputa}
                onChange={(e) => atualizarCampo('formaDisputa', e.target.value)}
                placeholder="Selecione"
                options={[
                  { value: 'Menor Preço', label: 'Menor Preço' },
                  { value: 'Maior Desconto', label: 'Maior Desconto' },
                ]}
              />
              <SelectField
                label="Modo de disputa"
                value={form.modoDisputa}
                onChange={(e) => atualizarCampo('modoDisputa', e.target.value)}
                placeholder="Selecione"
                options={[
                  { value: 'Aberto', label: 'Aberto' },
                  { value: 'Fechado', label: 'Fechado' },
                  { value: 'Aberto/Fechado', label: 'Aberto/Fechado' },
                  { value: 'Fechado/Aberto', label: 'Fechado/Aberto' },
                ]}
              />
              <SelectField
                label="Estrutura"
                value={form.estrutura}
                onChange={(e) => atualizarCampo('estrutura', e.target.value as EstruturaLicitacao)}
                placeholder="Selecione"
                options={Object.entries(ESTRUTURA_LICITACAO_LABEL).map(([value, label]) => ({ value, label }))}
              />
              <SelectField
                label="Tipo de contratação"
                value={form.tipoContratacao}
                onChange={(e) => atualizarCampo('tipoContratacao', e.target.value as TipoContratacaoLicitacao)}
                placeholder="Selecione"
                options={Object.entries(TIPO_CONTRATACAO_LICITACAO_LABEL).map(([value, label]) => ({ value, label }))}
              />
              <SelectField
                label="Procedimento"
                value={form.procedimento}
                onChange={(e) => atualizarCampo('procedimento', e.target.value as ProcedimentoLicitacao)}
                placeholder="Selecione"
                options={Object.entries(PROCEDIMENTO_LICITACAO_LABEL).map(([value, label]) => ({ value, label }))}
              />
            </SecaoFormulario>

            <SecaoFormulario titulo="Valor e edital">
              <TextField
                label="Valor total da licitação (R$)"
                type="text"
                value={valorTotalTexto}
                onChange={(e) => {
                  const textoFormatado = aplicarMascaraAoDigitar(e.target.value, 10);
                  setValorTotalTexto(textoFormatado);
                  atualizarCampo('valorTotalLicitacao', campoParaNumeroDecimal(textoFormatado, 10));
                }}
                onBlur={() => setValorTotalTexto(numeroParaCampoDecimal(campoParaNumeroDecimal(valorTotalTexto, 10), 10, 2))}
              />
              <TextField
                label="Link do edital"
                value={form.linkEdital ?? ''}
                onChange={(e) => atualizarCampo('linkEdital', e.target.value)}
                placeholder="https://..."
              />
              <div className="col-span-2">
                <label className="mb-1.5 block font-mono text-xs uppercase tracking-wide text-ink-soft">
                  Documentos do edital
                </label>
                <input
                  type="file"
                  multiple
                  onChange={(e) =>
                    atualizarCampo('nomesArquivosEdital', Array.from(e.target.files ?? []).map((arquivo) => arquivo.name))
                  }
                  className="block w-full font-body text-sm text-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-forest-mist file:px-3.5 file:py-2 file:font-body file:text-sm file:font-medium file:text-forest-deep"
                />

                {(form.nomesArquivosEdital ?? []).length > 0 && (
                  <div className="mt-1.5 font-body text-xs text-ink-soft">
                    <p>
                      {(form.nomesArquivosEdital ?? []).length}{' '}
                      {(form.nomesArquivosEdital ?? []).length === 1 ? 'arquivo selecionado' : 'arquivos selecionados'}:
                    </p>
                    <ul className="ml-4 list-disc">
                      {(form.nomesArquivosEdital ?? []).map((nome, indice) => (
                        <li key={`${nome}-${indice}`} className="flex items-center gap-2">
                          <span>{nome}</span>
                          <button
                            type="button"
                            onClick={() =>
                              atualizarCampo(
                                'nomesArquivosEdital',
                                (form.nomesArquivosEdital ?? []).filter((_, i) => i !== indice)
                              )
                            }
                            className="font-body text-xs font-semibold text-red-600 hover:underline"
                          >
                            Remover
                          </button>
                        </li>
                      ))}
                    </ul>
                    <p className="italic">(upload simulado — sem backend de arquivos ainda)</p>
                  </div>
                )}
              </div>
            </SecaoFormulario>

            <SecaoFormulario titulo="Vinculação">
              <SelectField
                label="Cliente vinculado *"
                required
                value={form.clienteId}
                onChange={(e) => atualizarCampo('clienteId', e.target.value)}
                placeholder="Selecione um cliente"
                options={clientes}
              />
              <SelectField
                label="Status *"
                required
                value={form.status}
                onChange={(e) => atualizarCampo('status', e.target.value as StatusLicitacao)}
                options={Object.entries(STATUS_LICITACAO_LABEL).map(([value, label]) => ({ value, label }))}
              />
            </SecaoFormulario>

            {licitacaoEmEdicao && (
              <div className="rounded-lg border border-ink-soft/15 bg-forest-mist/30 px-4 py-3 font-body text-sm">
                <p className="mb-0.5 font-medium text-ink">Decisão do cliente (Portal do Cliente)</p>
                <p className="text-ink-soft">
                  {DECISAO_CLIENTE_LABEL[licitacaoEmEdicao.decisaoCliente]}
                  {licitacaoEmEdicao.decisaoClienteEm && ` em ${formatarDataHora(licitacaoEmEdicao.decisaoClienteEm)}`}
                  {licitacaoEmEdicao.motivoRecusaCliente && ` — "${licitacaoEmEdicao.motivoRecusaCliente}"`}
                </p>
                <p className="mt-1 text-xs text-ink-soft/70">
                  Essa decisão é registrada pelo próprio cliente no Portal do Cliente, não é editável por aqui.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Aba 2 — Habilitação (checklist, 4 subseções) */}
        {abaAtiva === 'habilitacao' && (
          <div className="space-y-6">
            <ChecklistSection
              titulo="Habilitação jurídica"
              itens={form.habilitacao.juridica}
              onChangeStatus={(id, status) => atualizarItemHabilitacao('juridica', id, { status })}
              onChangeDetalhamento={(id, detalhamento) => atualizarItemHabilitacao('juridica', id, { detalhamento })}
            />

            <ChecklistSection
              titulo="Regularidade fiscal, social e trabalhista"
              itens={form.habilitacao.fiscalSocialTrabalhista}
              onChangeStatus={(id, status) => atualizarItemHabilitacao('fiscalSocialTrabalhista', id, { status })}
              onChangeDetalhamento={(id, detalhamento) =>
                atualizarItemHabilitacao('fiscalSocialTrabalhista', id, { detalhamento })
              }
            />

            <ChecklistSection
              titulo="Qualificação econômico-financeira"
              itens={form.habilitacao.economicoFinanceira}
              onChangeStatus={(id, status) => atualizarItemHabilitacao('economicoFinanceira', id, { status })}
              onChangeDetalhamento={(id, detalhamento) =>
                atualizarItemHabilitacao('economicoFinanceira', id, { detalhamento })
              }
            />

            <ChecklistSection
              titulo="Qualificação técnica"
              itens={form.habilitacao.tecnica}
              onChangeStatus={(id, status) => atualizarItemHabilitacao('tecnica', id, { status })}
              onChangeDetalhamento={(id, detalhamento) => atualizarItemHabilitacao('tecnica', id, { detalhamento })}
            />
          </div>
        )}

        {/* Aba 3 — Declarações (checklist) */}
        {abaAtiva === 'declaracoes' && (
          <div className="space-y-6">
            <ChecklistSection
              itens={form.declaracoes}
              onChangeStatus={(id, status) => atualizarItemChecklist('declaracoes', id, { status })}
              onChangeDetalhamento={(id, detalhamento) => atualizarItemChecklist('declaracoes', id, { detalhamento })}
            />
          </div>
        )}

        {/* Aba 4 — Condições Comerciais */}
        {abaAtiva === 'comerciais' && (
          <div className="space-y-5">
            <div className="rounded-xl border border-ink-soft/15 p-4">
              <p className="mb-3 font-mono text-xs uppercase tracking-wide text-ink-soft">Intervalo de lances</p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => atualizarCondicoes('tipoIntervaloLances', 'valor')}
                    className={`rounded-md border px-3 py-2 font-body text-xs font-semibold transition-colors ${
                      form.condicoesComerciais.tipoIntervaloLances === 'valor'
                        ? 'border-forest bg-forest text-white'
                        : 'border-ink-soft/25 text-ink-soft hover:border-forest/50'
                    }`}
                  >
                    Valor (R$)
                  </button>
                  <button
                    type="button"
                    onClick={() => atualizarCondicoes('tipoIntervaloLances', 'percentual')}
                    className={`rounded-md border px-3 py-2 font-body text-xs font-semibold transition-colors ${
                      form.condicoesComerciais.tipoIntervaloLances === 'percentual'
                        ? 'border-forest bg-forest text-white'
                        : 'border-ink-soft/25 text-ink-soft hover:border-forest/50'
                    }`}
                  >
                    Percentual (%)
                  </button>
                </div>

                {form.condicoesComerciais.tipoIntervaloLances === 'valor' && (
                  <div className="w-40">
                    {editandoValorIntervaloLances ? (
                      <TextField
                        label="Valor (R$)"
                        type="text"
                        autoFocus
                        value={valorIntervaloLancesTexto}
                        onChange={(e) => {
                          const textoFormatado = aplicarMascaraAoDigitar(e.target.value, 4);
                          setValorIntervaloLancesTexto(textoFormatado);
                          atualizarCondicoes('valorIntervaloLances', campoParaNumeroDecimal(textoFormatado, 4));
                        }}
                        onBlur={() => {
                          setValorIntervaloLancesTexto((atual) =>
                            numeroParaCampoDecimal(campoParaNumeroDecimal(atual, 4), 4, 2)
                          );
                          setEditandoValorIntervaloLances(false);
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditandoValorIntervaloLances(true)}
                        className="w-full rounded-md border border-transparent px-1 py-2 text-left font-body text-sm text-ink hover:border-ink-soft/25"
                      >
                        <span className="block font-body text-xs font-semibold text-ink-soft">Valor (R$)</span>
                        {valorIntervaloLancesTexto || <span className="text-ink-soft">clique para preencher</span>}
                      </button>
                    )}
                  </div>
                )}

                {form.condicoesComerciais.tipoIntervaloLances === 'percentual' && (
                  <div className="w-40">
                    {editandoPercentualIntervaloLances ? (
                      <TextField
                        label="Percentual (%)"
                        type="text"
                        autoFocus
                        value={percentualIntervaloLancesTexto}
                        onChange={(e) => {
                          const textoFormatado = aplicarMascaraAoDigitar(e.target.value, 4);
                          setPercentualIntervaloLancesTexto(textoFormatado);
                          atualizarCondicoes('percentualIntervaloLances', campoParaNumeroDecimal(textoFormatado, 4));
                        }}
                        onBlur={() => {
                          setPercentualIntervaloLancesTexto((atual) =>
                            numeroParaCampoDecimal(campoParaNumeroDecimal(atual, 4), 4)
                          );
                          setEditandoPercentualIntervaloLances(false);
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditandoPercentualIntervaloLances(true)}
                        className="w-full rounded-md border border-transparent px-1 py-2 text-left font-body text-sm text-ink hover:border-ink-soft/25"
                      >
                        <span className="block font-body text-xs font-semibold text-ink-soft">Percentual (%)</span>
                        {percentualIntervaloLancesTexto || <span className="text-ink-soft">clique para preencher</span>}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-3">
                <label className="mb-1 block font-body text-xs font-semibold text-ink-soft">
                  Detalhamento (opcional)
                </label>
                <textarea
                  value={form.condicoesComerciais.intervaloLancesDetalhe ?? ''}
                  onChange={(e) => atualizarCondicoes('intervaloLancesDetalhe', e.target.value)}
                  rows={1}
                  className="w-full resize-y rounded-md border border-ink-soft/25 px-3 py-1.5 font-body text-sm text-ink focus:border-forest focus:outline-none"
                  style={{ minHeight: '2.25rem', height: '2.25rem' }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <SelectField
                label="Forma de pagamento"
                value={form.condicoesComerciais.formaPagamento}
                onChange={(e) => atualizarCondicoes('formaPagamento', e.target.value as FormaPagamento)}
                options={Object.entries(FORMA_PAGAMENTO_LABEL).map(([value, label]) => ({ value, label }))}
              />
              <SelectField
                label="Recebimento em qual banco"
                value={form.condicoesComerciais.recebimentoBanco}
                onChange={(e) => atualizarCondicoes('recebimentoBanco', e.target.value)}
                placeholder="Selecione"
                options={[
                  { value: 'Banco do Brasil', label: 'Banco do Brasil' },
                  { value: 'Outros', label: 'Outros' },
                ]}
              />
              <TextField
                label="Prazo de pagamento (dias)"
                type="number"
                min={0}
                value={form.condicoesComerciais.prazoPagamentoDias ?? ''}
                onChange={(e) => {
                  if (e.target.value === '') {
                    atualizarCondicoes('prazoPagamentoDias', undefined);
                    return;
                  }
                  const numero = Number(e.target.value);
                  atualizarCondicoes('prazoPagamentoDias', Number.isNaN(numero) ? undefined : Math.max(0, numero));
                }}
              />
              <TextField
                label="Prazo de entrega (dias)"
                type="number"
                min={0}
                maxLength={2}
                value={form.condicoesComerciais.prazoEntregaDias ?? ''}
                onChange={(e) => {
                  if (e.target.value === '') {
                    atualizarCondicoes('prazoEntregaDias', undefined);
                    return;
                  }
                  const numero = Number(e.target.value);
                  atualizarCondicoes(
                    'prazoEntregaDias',
                    Number.isNaN(numero) ? undefined : Math.min(99, Math.max(0, numero))
                  );
                }}
              />
              <TextField
                label="Validade da proposta (dias)"
                type="number"
                min={0}
                maxLength={3}
                value={form.condicoesComerciais.validadePropostaDias ?? ''}
                onChange={(e) => {
                  if (e.target.value === '') {
                    atualizarCondicoes('validadePropostaDias', undefined);
                    return;
                  }
                  const numero = Number(e.target.value);
                  atualizarCondicoes(
                    'validadePropostaDias',
                    Number.isNaN(numero) ? undefined : Math.min(999, Math.max(0, numero))
                  );
                }}
              />
            </div>

            <TextAreaField
              label="Local de entrega"
              value={form.condicoesComerciais.localEntrega}
              onChange={(e) => atualizarCondicoes('localEntrega', e.target.value)}
              rows={2}
            />

            <CheckboxField
              label="Possui garantias?"
              checked={form.condicoesComerciais.possuiGarantias}
              onChange={(e) => atualizarCondicoes('possuiGarantias', e.target.checked)}
            />
            {form.condicoesComerciais.possuiGarantias && (
              <TextAreaField
                label="Detalhamento das garantias"
                value={form.condicoesComerciais.garantiasDetalhe ?? ''}
                onChange={(e) => atualizarCondicoes('garantiasDetalhe', e.target.value)}
                rows={2}
              />
            )}

          </div>
        )}

        {/* Aba 5 — Outras Exigências (checklist — mapeada da seção "Aceitação do Produto" do documento) */}
        {abaAtiva === 'outras' && (
          <div className="space-y-6">
            <ChecklistSection
              itens={form.outrasExigencias}
              onChangeStatus={(id, status) => atualizarItemChecklist('outrasExigencias', id, { status })}
              onChangeDetalhamento={(id, detalhamento) =>
                atualizarItemChecklist('outrasExigencias', id, { detalhamento })
              }
            />
          </div>
        )}

        {/* Aba 6 — Itens */}
        {abaAtiva === 'itens' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="font-body text-sm text-ink-soft">
                Cadastre os itens individuais ou organize-os em grupos. O total da oportunidade é calculado
                automaticamente a partir do preço de referência × quantidade de cada item.
              </p>
              <div className="flex shrink-0 gap-2">
                <Button variant="ghost" onClick={adicionarGrupo} className="whitespace-nowrap">
                  + Novo grupo
                </Button>
                <Button variant="ghost" onClick={() => adicionarItem()} className="whitespace-nowrap">
                  + Item individual
                </Button>
              </div>
            </div>

            {form.grupos.map((grupo) => {
              const itensDoGrupo = form.itens.filter((i) => i.grupoId === grupo.id);
              return (
                <div key={grupo.id} className="rounded-xl border border-ink-soft/15 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <input
                      value={grupo.numero}
                      onChange={(e) => renumerarGrupo(grupo.id, e.target.value)}
                      placeholder="Nº"
                      className="w-14 rounded-md border border-transparent bg-transparent font-body text-sm font-semibold text-ink hover:border-ink-soft/20 focus:border-forest focus:outline-none"
                    />
                    <input
                      value={grupo.nome}
                      onChange={(e) => renomearGrupo(grupo.id, e.target.value)}
                      className="flex-1 rounded-md border border-transparent bg-transparent font-body text-sm font-semibold text-ink hover:border-ink-soft/20 focus:border-forest focus:outline-none"
                    />
                    <div className="flex shrink-0 gap-2">
                      <Button variant="ghost" onClick={() => adicionarItem(grupo.id)} className="text-xs">
                        + Item no grupo
                      </Button>
                      <button
                        type="button"
                        onClick={() => removerGrupo(grupo.id)}
                        className="font-body text-xs text-red-600 hover:underline"
                      >
                        Excluir grupo
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {itensDoGrupo.map((item) => (
                      <ItemLicitacaoRow key={item.id} item={item} onChange={atualizarItem} onRemover={removerItem} clienteEhDemais={clienteEhDemais} />
                    ))}
                    {itensDoGrupo.length === 0 && (
                      <p className="font-body text-xs italic text-ink-soft">Nenhum item neste grupo ainda.</p>
                    )}
                  </div>

                  <p className="mt-3 text-right font-body text-sm font-medium text-forest-deep">
                    Total do grupo: {formatarMoeda(totalReferenciaGrupo(form.itens, grupo.id))}
                  </p>
                </div>
              );
            })}

            {(itensIndividuais.length > 0 || form.grupos.length === 0) && (
              <div className="rounded-xl border border-ink-soft/15 p-4">
                <p className="mb-3 font-body text-sm font-semibold text-ink">Itens individuais</p>
                <div className="space-y-3">
                  {itensIndividuais.map((item) => (
                    <ItemLicitacaoRow key={item.id} item={item} onChange={atualizarItem} onRemover={removerItem} clienteEhDemais={clienteEhDemais} />
                  ))}
                  {itensIndividuais.length === 0 && (
                    <p className="font-body text-xs italic text-ink-soft">Nenhum item individual ainda.</p>
                  )}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-forest/30 bg-forest-mist px-4 py-3 text-right">
              <span className="font-body text-sm font-semibold text-forest-deep">
                Total da oportunidade: {formatarMoeda(totalOportunidade)}
              </span>
            </div>
          </div>
        )}

        {/* Aba 7 — Ponto de Atenção */}
        {abaAtiva === 'atencao' && (
          <div className="space-y-2">
            <p className="font-body text-sm text-ink-soft">
              Riscos, restrições, observações e estratégia. Futuramente será preenchido automaticamente pela IA a
              partir da leitura do edital.
            </p>
            <TextAreaField
              label="Pontos de atenção"
              value={form.pontosAtencao}
              onChange={(e) => atualizarCampo('pontosAtencao', e.target.value)}
              rows={8}
            />
          </div>
        )}
          </div>
        </>
      )}
    </Modal>
  );
}

// Tabela de checklist de exigências — usada nas abas Habilitação (uma por
// subseção), Declarações e Outras Exigências. Cada linha tem 3 colunas: o
// nome fixo da exigência (não editável), um seletor Exigido/Não exigido
// (o "status" — o Analista marca o que o edital pede) e um campo de texto
// livre curto para anotar a variação específica ("Opções / Detalhamento").
// Não replica as sub-opções do documento original (ex.: "☐ Estadual ☐
// Municipal") como checkboxes separados — um único campo de texto cobre
// isso, a pedido do Márcio.
function ChecklistSection({
  titulo,
  itens,
  onChangeStatus,
  onChangeDetalhamento,
}: {
  titulo?: string;
  itens: ItemChecklistExigencia[];
  onChangeStatus: (id: string, status: StatusExigencia) => void;
  onChangeDetalhamento: (id: string, detalhamento: string) => void;
}) {
  return (
    <div className="space-y-2">
      {titulo && <p className="font-body text-sm font-semibold text-ink">{titulo}</p>}
      <div className="overflow-hidden rounded-xl border border-ink-soft/15">
        <div className="grid grid-cols-12 gap-2 border-b border-ink-soft/10 bg-paper-2/60 px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-ink-soft">
          <div className="col-span-4">Exigência</div>
          <div className="col-span-3">Status</div>
          <div className="col-span-5">Opções / Detalhamento</div>
        </div>
        {itens.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-12 items-center gap-2 border-b border-ink-soft/10 px-3 py-2.5 last:border-b-0"
          >
            <div className="col-span-4 flex items-center gap-1.5 pr-2 font-body text-sm text-ink">
              <span>{item.label}</span>
              {explicacaoDaExigencia(item.id) && (
                <InfoTooltip titulo={item.label} texto={explicacaoDaExigencia(item.id) as string} />
              )}
            </div>
            <div className="col-span-3 flex gap-1.5">
              <button
                type="button"
                onClick={() => onChangeStatus(item.id, 'exigido')}
                className={`flex-1 rounded-md border px-2 py-1.5 font-body text-xs font-semibold transition-colors ${
                  item.status === 'exigido'
                    ? 'border-forest bg-forest text-white'
                    : 'border-ink-soft/25 text-ink-soft hover:border-forest/50'
                }`}
              >
                Exigido
              </button>
              <button
                type="button"
                onClick={() => onChangeStatus(item.id, 'nao_exigido')}
                className={`flex-1 rounded-md border px-2 py-1.5 font-body text-xs font-semibold transition-colors ${
                  item.status === 'nao_exigido'
                    ? 'border-ink-soft bg-ink-soft text-white'
                    : 'border-ink-soft/25 text-ink-soft hover:border-ink-soft/50'
                }`}
              >
                Não exigido
              </button>
            </div>
            <div className="col-span-5">
              <input
                value={item.detalhamento}
                onChange={(e) => onChangeDetalhamento(item.id, e.target.value)}
                className="w-full rounded-md border border-ink-soft/20 bg-white px-2.5 py-1.5 font-body text-sm text-ink focus:border-forest focus:outline-none"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Linha de edição de um item — reutilizada tanto dentro de grupos quanto na
// lista de itens individuais.
function ItemLicitacaoRow({
  item,
  onChange,
  onRemover,
  clienteEhDemais,
}: {
  item: ItemLicitacao;
  onChange: <K extends keyof ItemLicitacao>(id: string, campo: K, valor: ItemLicitacao[K]) => void;
  onRemover: (id: string) => void;
  /** true quando o cliente atribuído a esta licitação é classificado como
   *  "Demais" — usado só pra mostrar um aviso quando o item também é
   *  marcado "Exclusivo para ME/EPP" (esse cliente não vai poder enviar
   *  proposta nele). Não impede o cadastro — o dado pode estar certo
   *  mesmo assim, é uma informação real do edital. */
  clienteEhDemais?: boolean;
}) {
  // Mesmo problema do "Valor total da licitação" (ver numeroParaCampoDecimal
  // no topo do arquivo): um <input type="number"> nativo não entende
  // separador de milhar nem vírgula decimal. Preço unitário de referência
  // pode vir do edital com muitas casas decimais (ex.: 4,57550140) — usamos
  // o mesmo limite de 10 casas do "Valor total da licitação" em vez de 6,
  // que estava truncando/arredondando valores digitados com mais precisão.
  const [precoTexto, setPrecoTexto] = useState(() => numeroParaCampoDecimal(item.precoReferencia, 10, 2));
  // Mesmo padrão BR (ponto de milhar) aplicado à quantidade — um pregão pode
  // ter itens com quantidades grandes (ex.: 10.000 unidades), e o
  // <input type="number"> nativo não exibe separador de milhar.
  const [qtdeTexto, setQtdeTexto] = useState(() => numeroParaCampoDecimal(item.quantidade, 0));

  return (
    <div className="relative rounded-lg bg-paper-2/60 p-3">
      <button
        type="button"
        onClick={() => onRemover(item.id)}
        aria-label="Remover item"
        className="absolute right-2 top-2 rounded-md p-1 text-ink-soft/50 hover:bg-red-50 hover:text-red-600"
      >
        ✕
      </button>

      <div className="flex flex-wrap items-end gap-2 pr-8">
        <div className="w-16 shrink-0">
          <TextField
            label="Nº"
            value={item.numero}
            onChange={(e) => onChange(item.id, 'numero', e.target.value)}
          />
        </div>
        <div className="w-32 shrink-0">
          <TextField
            label="Unidade de medida"
            value={item.unidadeMedida}
            onChange={(e) => onChange(item.id, 'unidadeMedida', e.target.value)}
          />
        </div>
        <div className="w-28 shrink-0">
          <TextField
            label="Qtde"
            type="text"
            value={qtdeTexto}
            onChange={(e) => {
              const textoFormatado = aplicarMascaraAoDigitar(e.target.value, 0);
              setQtdeTexto(textoFormatado);
              onChange(item.id, 'quantidade', campoParaNumeroDecimal(textoFormatado, 0) ?? 0);
            }}
            onBlur={() => setQtdeTexto(numeroParaCampoDecimal(campoParaNumeroDecimal(qtdeTexto, 0), 0))}
          />
        </div>
        <div className="w-44 shrink-0">
          <TextField
            label="Valor Unit. Referência"
            type="text"
            value={precoTexto}
            onChange={(e) => {
              const textoFormatado = aplicarMascaraAoDigitar(e.target.value, 10);
              setPrecoTexto(textoFormatado);
              onChange(item.id, 'precoReferencia', campoParaNumeroDecimal(textoFormatado, 10) ?? 0);
            }}
            onBlur={() => setPrecoTexto(numeroParaCampoDecimal(campoParaNumeroDecimal(precoTexto, 10), 10, 2))}
          />
        </div>
        <div className="w-48 shrink-0">
          <p className="mb-1.5 whitespace-nowrap font-mono text-xs uppercase tracking-wide text-ink-soft">
            Total Referência
          </p>
          <div className="whitespace-nowrap rounded-md border border-ink-soft/20 bg-white px-3 py-2.5 font-body text-sm font-medium text-ink">
            {formatarMoeda(totalReferenciaItem(item))}
          </div>
        </div>
      </div>

      <div className="mt-2">
        <TextAreaField
          label="Descrição"
          value={item.descricao}
          onChange={(e) => onChange(item.id, 'descricao', e.target.value)}
          rows={3}
        />
      </div>

      {/* "Exclusivo para ME/EPP" só se aplica a item individual — a pedido
          do Márcio (02/10): quando o item pertence a um grupo, a
          exclusividade é decidida no nível do grupo/lote (regra de
          licitação), não item a item, então o checkbox não aparece aqui
          para itens dentro de grupo. */}
      {!item.grupoId && (
        <div className="mt-2">
          <CheckboxField
            label="Exclusivo para ME/EPP"
            checked={item.exclusivoMeEpp}
            onChange={(e) => onChange(item.id, 'exclusivoMeEpp', e.target.checked)}
          />
          {item.exclusivoMeEpp && clienteEhDemais && (
            <p className="mt-1.5 rounded-md bg-brass-pale/60 px-2.5 py-1.5 font-body text-xs text-brass">
              ⚠️ O cliente desta licitação é classificado como "Demais" — ele não vai poder enviar proposta
              neste item (o sistema bloqueia isso automaticamente na Proposta Comercial dele).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
