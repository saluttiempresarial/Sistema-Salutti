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
// (Código interno, Marca, Modelo, Preço Mínimo por item — spec 4.3 e 6.2)
// foram modelados em `ItemLicitacao.propostaCliente` para a estrutura de
// dados ficar completa, mas a TELA de preenchimento (Portal do Cliente)
// não faz parte das 5 abas do cadastro de licitações e não foi construída
// nesta passada.

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

export type ModalidadeLicitacao =
  | 'pregao_eletronico'
  | 'concorrencia'
  | 'tomada_de_precos'
  | 'convite'
  | 'dispensa'
  | 'inexigibilidade';

export const MODALIDADE_LICITACAO_LABEL: Record<ModalidadeLicitacao, string> = {
  pregao_eletronico: 'Pregão Eletrônico',
  concorrencia: 'Concorrência',
  tomada_de_precos: 'Tomada de Preços',
  convite: 'Convite',
  dispensa: 'Dispensa',
  inexigibilidade: 'Inexigibilidade',
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
// Aba 2 — Habilitação (Critérios de Habilitação)
// ---------------------------------------------------------------------------
export interface Habilitacao {
  qualificacaoTecnica: string; // preenchido pelo analista (ou futuramente pela IA)
  qualificacaoEconomicoFinanceira: string;
  regularidadeFiscal: string; // rótulo exibido: "Regularidade Fiscal e Trabalhista"
  exigeAtestado: string; // rótulo exibido: "Exigência de Atestado de Fornecimento?" — texto descritivo, ex: "Sim, para ambos os itens..."
  exigeAmostras: string; // rótulo exibido: "Exigência de Amostras?" — texto descritivo, ex: "Sim. O licitante classificado em primeiro lugar deverá apresentar a amostra"
  prazoEntregaAmostraDias?: number; // só relevante quando exigeAmostras estiver preenchido
  outrosRequisitos: string;
}

// ---------------------------------------------------------------------------
// Aba 3 — Condições Comerciais
// ---------------------------------------------------------------------------
export interface CondicoesComerciais {
  intervaloLances: string;
  formaPagamento: FormaPagamento;
  recebimentoBanco: string; // ex.: "Banco do Brasil" — campo livre, spec cita BB como exemplo
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

// Preenchido pelo CLIENTE ao decidir participar (spec 4.3 / 6.2). Estrutura
// de dados prevista aqui; tela do Portal do Cliente é um módulo à parte.
export interface PropostaClienteItem {
  codigoInterno?: string;
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
  precoReferencia: number; // valor unitário de referência
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
  formaDisputa: string;
  modoDisputa: string; // dropdown: Aberto / Fechado / Aberto-Fechado / Fechado-Aberto
  participacao: string; // dropdown: Individual / Por lote
  capag: string; // texto livre, ex: "B (3,96%)"
  restricoesMeEpp: string; // texto livre, ex: "Não é exclusiva. A preferência para ME/EPP não será aplicada"
  linkEdital?: string;
  nomeArquivoEdital?: string; // simula o upload do PDF do edital (mock); real vai para Supabase Storage
  valorTotalLicitacao?: number; // ausente/undefined = orçamento sigiloso

  // Vinculação operacional — não é uma das 5 abas da spec, mas necessária
  // para o fluxo de atribuição de licitações a clientes (seção 2.1 e 6.1)
  clienteId: string;
  status: StatusLicitacao;

  // Aba 2 — Habilitação
  habilitacao: Habilitacao;

  // Aba 3 — Condições Comerciais
  condicoesComerciais: CondicoesComerciais;

  // Aba 4 — Pontos de Atenção
  pontosAtencao: string;

  // Aba 5 — Itens
  grupos: GrupoItens[];
  itens: ItemLicitacao[];

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
