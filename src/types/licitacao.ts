// src/types/licitacao.ts
//
// Contrato de dados do módulo de Licitações — reconstruído a partir da
// Especificação Funcional v2.1, seção 4.2 (5 abas do cadastro) e 4.3
// (decisão do cliente, incorporada ao cadastro de licitações).
//
// Qualquer tela ou service que consuma licitações deve depender apenas
// destes tipos — assim, trocar o mock por uma API real (Supabase/PostgreSQL)
// não exige mudar nada além de `licitacaoService.ts`.
//
// NOTA DE ESCOPO: o módulo separado de "Propostas Comerciais" foi removido
// pela spec (seção 4.3) — os campos de condições de pagamento, prazo de
// entrega e validade já são cobertos pela Aba 3 (Condições Comerciais)
// deste tipo. `PropostasPage`/`PropostaFormModal` ficam obsoletos e não
// foram atualizados nesta passada (não estão roteados no App.tsx).
//
// NOTA DE ESCOPO 2: os campos que o CLIENTE preenche ao decidir participar
// (`ItemLicitacao.propostaCliente`) são preenchidos no Portal do Cliente,
// no momento em que ele clica "Quero Participar" — estrutura alinhada 1:1
// com a planilha real da Salutti (abas "Proposta Comercial" e "Análise da
// Proposta"):
// - codigoInterno / marca / modelo: identificação do produto ofertado
// - precoMinimo: único valor de preço informado pelo cliente por item
// - quantidade: NÃO é preenchida aqui — vem fixa de ItemLicitacao.quantidade
// - frete: NÃO é por item — é uma taxa única (Licitacao.percentualFrete),
//   aplicada a todos os itens da proposta de uma vez, calculando "preço +
//   frete" e "% de diferença vs. referência" automaticamente (mesma lógica
//   e mesmos limiares de classificação da planilha: "🚀 Forte" quando o
//   desconto passa de 40%, "⚖️ Positiva" entre 0% e 40% de desconto,
//   "❌ Não participar" quando o valor fica acima da referência).

export type StatusLicitacao =
  | 'pendente'
  | 'em_analise'
  | 'enviado'
  | 'ganho'
  | 'perdido';

export const STATUS_LICITACAO_LABEL: Record<StatusLicitacao, string> = {
  pendente: 'Pendente',
  em_analise: 'Em Análise',
  enviado: 'Enviado',
  ganho: 'Ganho',
  perdido: 'Perdido',
};

export type ModalidadeLicitacao = 'pregao_eletronico' | 'concorrencia';

export const MODALIDADE_LICITACAO_LABEL: Record<ModalidadeLicitacao, string> = {
  pregao_eletronico: 'Pregão',
  concorrencia: 'Concorrência',
};

// Texto de apoio exibido junto ao dropdown de Modalidade, explicando a
// diferença entre as duas opções (definição combinada com o Márcio).
export const MODALIDADE_LICITACAO_DESCRICAO: Record<ModalidadeLicitacao, string> = {
  pregao_eletronico: 'Aquisição de bens e contratação de serviços comuns.',
  concorrencia: 'Contratação de maior complexidade.',
};

export type ParticipacaoLicitacao = 'exclusiva_me_epp' | 'ampla_concorrencia';

export const PARTICIPACAO_LICITACAO_LABEL: Record<ParticipacaoLicitacao, string> = {
  exclusiva_me_epp: 'Exclusiva ME/EPP',
  ampla_concorrencia: 'Ampla concorrência',
};

export const PARTICIPACAO_LICITACAO_DESCRICAO: Record<ParticipacaoLicitacao, string> = {
  exclusiva_me_epp: 'Participação exclusiva.',
  ampla_concorrencia: 'Participação geral.',
};

// Substituiu o antigo campo "Participação" (Individual / Por lote), que
// não tinha relação com ME/EPP — esse conceito de organização dos itens
// agora mora aqui, com nome próprio.
export type EstruturaLicitacao = 'item' | 'lote_grupo';

export const ESTRUTURA_LICITACAO_LABEL: Record<EstruturaLicitacao, string> = {
  item: 'Item',
  lote_grupo: 'Lote/Grupo',
};

export type TipoContratacaoLicitacao = 'licitacao' | 'dispensa' | 'inexigibilidade';

export const TIPO_CONTRATACAO_LICITACAO_LABEL: Record<TipoContratacaoLicitacao, string> = {
  licitacao: 'Licitação',
  dispensa: 'Dispensa',
  inexigibilidade: 'Inexigibilidade',
};

export type ProcedimentoLicitacao = 'convencional' | 'srp';

export const PROCEDIMENTO_LICITACAO_LABEL: Record<ProcedimentoLicitacao, string> = {
  convencional: 'Contratação convencional',
  srp: 'Sistema de Registro de Preços (SRP)',
};

export type DecisaoCliente = 'pendente' | 'participar' | 'recusar';

export const DECISAO_CLIENTE_LABEL: Record<DecisaoCliente, string> = {
  pendente: 'Aguardando decisão',
  participar: 'Confirmou participação',
  recusar: 'Recusou participar',
};

export type StatusProposta = 'rascunho' | 'enviada' | 'recusada';

export const STATUS_PROPOSTA_LABEL: Record<StatusProposta, string> = {
  rascunho: 'Rascunho',
  enviada: 'Enviada',
  recusada: 'Recusada',
};

// Aba 3 — Condições Comerciais: "Forma de pagamento (crédito em conta,
// boleto, pix ou outros)" — únicas opções explicitadas na spec.
export type FormaPagamento = 'credito_conta' | 'debito_conta' | 'boleto' | 'pix' | 'outros';

export const FORMA_PAGAMENTO_LABEL: Record<FormaPagamento, string> = {
  credito_conta: 'Crédito em conta',
  debito_conta: 'Débito em conta',
  boleto: 'Boleto',
  pix: 'Pix',
  outros: 'Outros',
};

export interface HistoricoAcao {
  id: string;
  data: string; // ISO date
  usuario: string;
  acao: string;
}

// ---------------------------------------------------------------------------
// Aba 2 — Habilitação / Aba 3 — Declarações / Aba 5 — Outras Exigências
//
// Reestruturado em 25/09 a partir do documento
// "Estrutura_Tela_Exigencias_Edital_SALUTTI_Final.docx": os campos de texto
// livre por assunto (Qualificação técnica, Regularidade fiscal etc.) saem
// de vez — cada linha do edital vira um item de checklist com 3 colunas:
// Exigência (nome fixo do requisito), Status (Exigido / Não exigido — o
// Analista marca o que o edital pede) e Opções/Detalhamento (texto livre
// curto, para anotar a variação específica: "Estadual", "Mínimo LG 1,0",
// prazo, órgão emissor etc. — sem recriar sub-checkboxes pra cada opção
// possível do documento, que ficaria pesado demais pra manter).
//
// SUBSTITUI TOTALMENTE o modelo antigo — decisão tomada com o Márcio
// (25/09): licitações já cadastradas antes dessa mudança voltam a abrir
// com o checklist em branco; o texto livre antigo continua salvo no banco,
// só não aparece mais nesta tela.
// ---------------------------------------------------------------------------

export type StatusExigencia = 'exigido' | 'nao_exigido';

export const STATUS_EXIGENCIA_LABEL: Record<StatusExigencia, string> = {
  exigido: 'Exigido',
  nao_exigido: 'Não exigido',
};

// Uma linha do checklist. `status` fica undefined até o Analista marcar —
// não force nem "exigido" nem "não exigido" como padrão, pra não passar a
// falsa impressão de que já foi conferido no edital.
export interface ItemChecklistExigencia {
  id: string; // chave estável do item dentro da seção (ex.: "contrato_social")
  label: string; // nome da exigência, sempre o mesmo texto do documento
  status?: StatusExigencia;
  detalhamento: string; // "Opções / Detalhamento" — texto livre
}

/** Cria a lista inicial (em branco) de uma seção do checklist a partir dos
 *  pares id/label fixos definidos abaixo — usado tanto pelo formulário
 *  (nova licitação) quanto para completar seções que uma licitação antiga
 *  ainda não tenha (edição de licitação salva antes de algum item novo ser
 *  adicionado ao checklist). */
export function criarChecklistVazio(
  definicao: ReadonlyArray<{ id: string; label: string }>
): ItemChecklistExigencia[] {
  return definicao.map(({ id, label }) => ({ id, label, status: undefined, detalhamento: '' }));
}

export const HABILITACAO_JURIDICA_ITENS = [
  { id: 'contrato_social', label: 'Contrato social / ato constitutivo' },
  { id: 'doc_identificacao_socios', label: 'Documento de identificação dos sócios/administradores' },
  { id: 'procuracao_credenciamento', label: 'Procuração / credenciamento do representante' },
  { id: 'autorizacao_funcionamento', label: 'Autorização para funcionamento' },
  { id: 'outras_juridica', label: 'Outras' },
] as const;

export const HABILITACAO_FISCAL_ITENS = [
  { id: 'cartao_cnpj', label: 'Cartão CNPJ' },
  { id: 'inscricao_estadual_municipal', label: 'Inscrição estadual / municipal' },
  { id: 'cnd_federal', label: 'CND Federal (RFB/PGFN)' },
  { id: 'cnd_estadual', label: 'CND Estadual' },
  { id: 'cnd_municipal', label: 'CND Municipal' },
  { id: 'fgts_crf', label: 'FGTS (CRF)' },
  { id: 'cndt', label: 'CNDT (Certidão Trabalhista)' },
  { id: 'outras_fiscal', label: 'Outras' },
] as const;

export const HABILITACAO_ECONOMICO_FINANCEIRA_ITENS = [
  { id: 'balanco_patrimonial', label: 'Balanço patrimonial e demonstrações contábeis' },
  { id: 'indices_economico_financeiros', label: 'Índices econômico-financeiros' },
  { id: 'declaracao_contador', label: 'Declaração do contador atestando os índices' },
  { id: 'certidao_falencia', label: 'Certidão de falência / recuperação judicial' },
  { id: 'capital_social_minimo', label: 'Capital social mínimo' },
  { id: 'patrimonio_liquido_minimo', label: 'Patrimônio líquido mínimo' },
  { id: 'outras_economico_financeira', label: 'Outras' },
] as const;

export const HABILITACAO_TECNICA_ITENS = [
  { id: 'atestado_capacidade_tecnica', label: 'Atestado de capacidade técnica' },
  { id: 'responsavel_tecnico', label: 'Responsável técnico (CAT/ART)' },
  { id: 'registro_conselho_profissional', label: 'Registro em conselho profissional' },
  { id: 'vistoria_visita_tecnica', label: 'Vistoria / visita técnica' },
  { id: 'indicacao_equipe_instalacoes', label: 'Indicação de equipe, instalações e equipamentos' },
  { id: 'outras_tecnica', label: 'Outras' },
] as const;

export interface Habilitacao {
  juridica: ItemChecklistExigencia[];
  fiscalSocialTrabalhista: ItemChecklistExigencia[];
  economicoFinanceira: ItemChecklistExigencia[];
  tecnica: ItemChecklistExigencia[];
}

export const DECLARACOES_ITENS = [
  { id: 'cumprimento_requisitos_habilitacao', label: 'Cumprimento dos requisitos de habilitação' },
  { id: 'reserva_cargos_pcd', label: 'Reserva de cargos para PcD e reabilitados' },
  { id: 'nao_emprego_menor', label: 'Não emprego de menor' },
  { id: 'enquadramento_me_epp', label: 'Enquadramento como ME/EPP' },
  { id: 'proposta_compativel_custos_trabalhistas', label: 'Proposta compatível com custos trabalhistas' },
  { id: 'inexistencia_fato_impeditivo', label: 'Inexistência de fato impeditivo' },
  { id: 'elaboracao_independente_proposta', label: 'Elaboração independente de proposta' },
  { id: 'outras_declaracoes', label: 'Outras' },
] as const;

// "Outras Exigências" — mapeado da seção "Aceitação do Produto" do
// documento SALUTTI; renomeado a pedido do Márcio (25/09) pra cobrir
// exigências que não são estritamente sobre o produto (ex.: licença de
// funcionamento específica de algum órgão) sem precisar criar mais uma aba.
export const OUTRAS_EXIGENCIAS_ITENS = [
  { id: 'amostra', label: 'Amostra' },
  { id: 'catalogo_folder_tecnico', label: 'Catálogo / folder técnico' },
  { id: 'ficha_tecnica_produto', label: 'Ficha técnica do produto' },
  { id: 'fispq_fds', label: 'FISPQ / FDS' },
  { id: 'laudo_tecnico_ensaio', label: 'Laudo técnico / de ensaio' },
  { id: 'certificacao', label: 'Certificação' },
  { id: 'registro_anvisa', label: 'Registro ANVISA' },
  { id: 'registros_especificos', label: 'Registros específicos' },
  { id: 'licenca_autorizacao_especifica', label: 'Licença / autorização específica' },
  { id: 'indicacao_marca_modelo', label: 'Indicação de marca / modelo' },
  { id: 'garantia_assistencia_tecnica', label: 'Garantia do produto / assistência técnica' },
  { id: 'instalacao', label: 'Instalação' },
  { id: 'outras_exigencias', label: 'Outras' },
] as const;

/** Habilitação em branco — todas as 4 subseções com seus itens fixos,
 *  nenhum status marcado ainda. Usada tanto pelo formulário quanto (via
 *  `completarChecklist`, no service) pra preencher itens novos do checklist
 *  em licitações salvas antes deles existirem. */
export function criarHabilitacaoVazia(): Habilitacao {
  return {
    juridica: criarChecklistVazio(HABILITACAO_JURIDICA_ITENS),
    fiscalSocialTrabalhista: criarChecklistVazio(HABILITACAO_FISCAL_ITENS),
    economicoFinanceira: criarChecklistVazio(HABILITACAO_ECONOMICO_FINANCEIRA_ITENS),
    tecnica: criarChecklistVazio(HABILITACAO_TECNICA_ITENS),
  };
}

// ---------------------------------------------------------------------------
// Aba 3 — Condições Comerciais
// ---------------------------------------------------------------------------
export interface CondicoesComerciais {
  intervaloLances: string;
  formaPagamento: FormaPagamento;
  recebimentoBanco: string; // "Banco do Brasil" ou "Outros" — seletor fixo
  prazoPagamentoDias?: number;
  possuiGarantias: boolean;
  garantiasDetalhe?: string; // abre quando possuiGarantias = true
  prazoEntregaDias?: number; // até 2 dígitos
  localEntrega: string; // detalhamento aberto
  validadePropostaDias?: number; // até 3 dígitos
}

// ---------------------------------------------------------------------------
// Aba 5 — Itens
// ---------------------------------------------------------------------------

// Preenchido pelo CLIENTE ao clicar "Quero Participar" no Portal do
// Cliente — estrutura alinhada 1:1 com a planilha real da Salutti (abas
// "Proposta Comercial" / "Análise da Proposta" da planilha de Produtos):
// - codigoInterno / marca / modelo: identificação do produto ofertado
// - precoMinimo: único valor de preço que o cliente informa (a planilha
//   real não separa "valor inicial" de "valor mínimo" — é um valor só)
// A quantidade NÃO é preenchida aqui — vem fixa de ItemLicitacao.quantidade
// (definida pelo Analista na Análise do Edital), igual na planilha real.
// O frete também não é por item: é uma taxa única (Licitacao.percentualFrete)
// aplicada a todos os itens da proposta de uma vez.
export interface PropostaClienteItem {
  codigoInterno?: string;
  descricaoProduto?: string; // descrição do produto ofertado pelo cliente (planilha real: coluna "Descrição" do bloco Proposta Comercial — diferente da Descrição do item de referência)
  marca?: string;
  modelo?: string;
  precoMinimo?: number;
}

export interface GrupoItens {
  id: string;
  numero: string; // ex.: "1", "2" — número do grupo
  nome: string; // ex.: "Grupo 1"
}

export interface ItemLicitacao {
  id: string;
  grupoId?: string; // presente = item pertence a um grupo; ausente = item individual
  numero: string;
  descricao: string;
  unidadeMedida: string;
  quantidade: number;
  precoReferencia: number; // valor unitário de referência (edital) — preenchido pelo Admin
  exclusivoMeEpp: boolean;
  propostaCliente?: PropostaClienteItem;
}

// ---------------------------------------------------------------------------
// Licitação — registro completo
// ---------------------------------------------------------------------------
export interface Licitacao {
  id: string;

  // Aba 1 — Informações Gerais
  dataLicitacao: string; // ISO datetime — data e horário originais da sessão
  dataEfetivaLicitacao?: string; // ISO datetime — só preenchido se a licitação for suspensa e remarcada
  portal: string;
  objeto: string;
  numeroPregao: string;
  orgao: string;
  estado: string; // UF
  municipio: string;
  distanciaMatriz: string; // texto livre, ex: "120km" ou "cerca de 2h de viagem"
  modalidade: string;
  estrutura: string; // dropdown: Item / Lote-Grupo — antes era "participacao" (Individual/Por lote)
  tipoContratacao: string; // dropdown: Licitação / Dispensa / Inexigibilidade
  procedimento: string; // dropdown: Contratação convencional / Sistema de Registro de Preços (SRP)
  formaDisputa: string;
  modoDisputa: string; // dropdown: Aberto / Fechado / Aberto-Fechado / Fechado-Aberto
  participacao: string; // dropdown: Exclusiva ME/EPP / Ampla concorrência (antes era Individual/Por lote — ver EstruturaLicitacao)
  capag: string; // texto livre, ex: "B (3,96%)"
  restricoesMeEpp: string; // texto livre, ex: "Não é exclusiva. A preferência para ME/EPP não será aplicada"
  linkEdital?: string;
  nomesArquivosEdital?: string[]; // simula o upload dos documentos do edital (mock) — qualquer tipo de arquivo, vários por licitação; real vai para Supabase Storage
  valorTotalLicitacao?: number; // ausente/undefined = orçamento sigiloso

  // Vinculação operacional — não é uma das 5 abas da spec, mas necessária
  // para o fluxo de atribuição de licitações a clientes (seção 2.1 e 6.1)
  clienteId: string;
  status: StatusLicitacao;

  // Aba 2 — Habilitação
  habilitacao: Habilitacao;

  // Aba 3 — Declarações
  declaracoes: ItemChecklistExigencia[];

  // Aba 4 — Condições Comerciais
  condicoesComerciais: CondicoesComerciais;

  // Aba 5 — Outras Exigências (mapeada da seção "Aceitação do Produto" do
  // documento SALUTTI)
  outrasExigencias: ItemChecklistExigencia[];

  // Aba 6 — Pontos de Atenção
  pontosAtencao: string;

  // Aba 7 — Itens
  grupos: GrupoItens[];
  itens: ItemLicitacao[];
  // Contagem de itens cadastrados — usada na listagem (LicitacoesPage) para
  // indicar rapidamente se o Analista já cadastrou itens nesta licitação,
  // sem precisar carregar o array `itens` completo (que listar() não traz,
  // por design). Em telas que já carregam os itens completos (buscarPorId),
  // é sempre igual a itens.length.
  totalItens?: number;

  // Seção 4.3 — Decisão do Cliente (fora das 5 abas do cadastro)
  decisaoCliente: DecisaoCliente;
  motivoRecusaCliente?: string;
  decisaoClienteEm?: string;
  cobrarFrete: boolean;
  percentualFrete?: number; // só relevante quando cobrarFrete = true
  statusProposta: StatusProposta;

  observacoes: string;
  historico: HistoricoAcao[];

  criadoEm: string; // "Data de cadastro" — automática
  atualizadoEm: string;
}

// Payload usado pelo formulário de criação/edição (sem campos derivados/controlados pelo sistema)
export type LicitacaoFormData = Omit<
  Licitacao,
  'id' | 'historico' | 'criadoEm' | 'atualizadoEm'
>;
