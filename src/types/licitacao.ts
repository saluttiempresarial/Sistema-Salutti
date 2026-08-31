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
// no momento em que ele clica "Quero Participar" (fora das 5 abas do
// cadastro de licitações, que é tela exclusiva do Admin/Funcionário):
// - quantidadeOfertada: pode ser diferente da quantidade do edital
// - valorInicial: valor ideal/inicial que o cliente gostaria de vender
// - precoMinimo: valor MÍNIMO que o cliente autoriza a Salutti a vender
//   (já considerando o frete, se houver) — piso para os lances durante a
//   disputa ao vivo, quando o valor de fato pode variar entre o inicial e
//   este mínimo
// - marca / modelo: do produto ofertado
// - codigoInterno: existe na estrutura de dados mas não é preenchido pelo
//   cliente (não aparece no Portal) — reservado para uso futuro do Admin

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
// Cliente — ver NOTA DE ESCOPO 2 no topo do arquivo.
export interface PropostaClienteItem {
  codigoInterno?: string; // não preenchido pelo cliente hoje — reservado
  marca?: string;
  modelo?: string;
  quantidadeOfertada?: number; // pode diferir da quantidade solicitada no edital
  valorInicial?: number; // valor ideal/inicial que o cliente gostaria de vender
  precoMinimo?: number; // valor mínimo autorizado (com frete já considerado) — piso para os lances
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
