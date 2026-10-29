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

import type { MotivoNaoParticipacao } from './motivoNaoParticipacao';

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

// Esfera do órgão (19/10): campo OPCIONAL, usado no indicador "Mercado por UF e
// por esfera". Hoje o Analista escolhe à mão; quando a leitura do edital por IA
// passar a devolvê-la, ela pré-preenche o campo.
export type EsferaLicitacao = 'municipal' | 'estadual' | 'federal' | 'distrital';

export const ESFERA_LICITACAO_LABEL: Record<EsferaLicitacao, string> = {
  municipal: 'Municipal',
  estadual: 'Estadual',
  federal: 'Federal',
  distrital: 'Distrital',
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
//
// REMOÇÃO (02/10, a pedido do Márcio): "Débito em conta" tirado da lista —
// não é uma opção real de recebimento usada pela Salutti. Esse campo é
// salvo dentro do bloco único `condicoesComerciais` (JSON), sem CHECK
// CONSTRAINT própria no banco, então tirar a opção daqui é seguro e não
// exige nenhuma migração.
export type FormaPagamento = 'credito_conta' | 'boleto' | 'pix' | 'outros';

export const FORMA_PAGAMENTO_LABEL: Record<FormaPagamento, string> = {
  credito_conta: 'Crédito em conta',
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
export function criarHabilitacaoVazia(tipo: TipoObjeto = 'produto'): Habilitacao {
  const listas = listasDeExigencias(tipo);
  return {
    juridica: criarChecklistVazio(listas.juridica),
    fiscalSocialTrabalhista: criarChecklistVazio(listas.fiscalSocialTrabalhista),
    economicoFinanceira: criarChecklistVazio(listas.economicoFinanceira),
    tecnica: criarChecklistVazio(listas.tecnica),
  };
}

// ---------------------------------------------------------------------------
// Tipo de objeto (29/10) — as listas de exigências mudam conforme o objeto
// ---------------------------------------------------------------------------
// "Produto" usa as listas acima. "Serviços" usa a lista da planilha de análise
// de edital de serviços (ASTRON, 29/10). "Obra" e "Serviços Técnicos" seguem com
// a lista de produto até a Salutti definir as listas próprias.
//
// Os checklists são salvos inteiros (id, nome e marcação) nas colunas JSON da
// licitação; por isso trocar a lista não exige migração do banco. Itens que
// existem nas duas listas usam o MESMO id, então a marcação é aproveitada quando
// o analista troca o objeto.
export type TipoObjeto = 'produto' | 'servicos';

export const OBJETOS_LICITACAO = ['Produto', 'Serviços', 'Obra', 'Serviços Técnicos'] as const;

/** Descobre o tipo de lista a partir do texto do objeto (campo livre, pois a
 *  leitura por IA também preenche). Só "Serviços" tem lista própria por enquanto. */
export function tipoDoObjeto(objeto?: string | null): TipoObjeto {
  const normalizado = (objeto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  return normalizado === 'servicos' || normalizado === 'servico' ? 'servicos' : 'produto';
}

type DefinicaoItens = ReadonlyArray<{ id: string; label: string }>;

export interface ListasExigencias {
  juridica: DefinicaoItens;
  fiscalSocialTrabalhista: DefinicaoItens;
  economicoFinanceira: DefinicaoItens;
  tecnica: DefinicaoItens;
  declaracoes: DefinicaoItens;
  /** Vazia em "Serviços": a planilha não tem a seção (os itens equivalentes
   *  ficam na qualificação técnica). A aba "Outras Exigências" some. */
  outras: DefinicaoItens;
}

export const SERVICOS_HABILITACAO_JURIDICA_ITENS = [
  { id: 'ato_constitutivo_objeto_compativel', label: 'Ato constitutivo / contrato social consolidado, com objeto compatível com o serviço' },
  { id: 'doc_identificacao_socios', label: 'Documento de identificação dos sócios ou administradores' },
  { id: 'aceita_sicaf', label: 'Aceita o SICAF (Sistema de Cadastramento Unificado de Fornecedores) em substituição aos documentos' },
] as const;

export const SERVICOS_HABILITACAO_FISCAL_ITENS = [
  { id: 'cartao_cnpj', label: 'CNPJ (Cadastro Nacional da Pessoa Jurídica) com CNAE (Classificação Nacional de Atividades Econômicas) compatível com o serviço' },
  { id: 'inscricao_estadual_municipal', label: 'Inscrição no cadastro de contribuintes municipal (ISS (Imposto Sobre Serviços)) e/ou estadual' },
  { id: 'cnd_federal', label: 'Certidão Conjunta de Débitos Federais (Receita Federal e PGFN (Procuradoria-Geral da Fazenda Nacional))' },
  { id: 'cnd_estadual', label: 'Certidão de regularidade com a Fazenda Estadual' },
  { id: 'cnd_municipal', label: 'Certidão de regularidade com a Fazenda Municipal' },
  { id: 'fgts_crf', label: 'CRF (Certificado de Regularidade do FGTS (Fundo de Garantia do Tempo de Serviço))' },
  { id: 'cndt', label: 'CNDT (Certidão Negativa de Débitos Trabalhistas)' },
] as const;

export const SERVICOS_HABILITACAO_ECONOMICO_FINANCEIRA_ITENS = [
  { id: 'balanco_patrimonial', label: 'Balanço patrimonial e demonstrações contábeis (informar se do último exercício ou dos dois últimos)' },
  { id: 'indices_economico_financeiros', label: 'Índices contábeis mínimos – LG (Liquidez Geral), LC (Liquidez Corrente) e SG (Solvência Geral) (informar os valores)' },
  { id: 'capital_ou_patrimonio_minimo', label: 'Capital social ou patrimônio líquido mínimo (até 10% do valor estimado – art. 69, § 4º)' },
  { id: 'certidao_falencia', label: 'Certidão negativa de falência ou recuperação judicial' },
  { id: 'compromissos_assumidos', label: 'Declaração / relação de compromissos assumidos (contratos em andamento)' },
] as const;

export const SERVICOS_HABILITACAO_TECNICA_ITENS = [
  { id: 'atestado_capacidade_tecnica', label: 'Atestado de capacidade técnica da empresa (informar a parcela relevante e o quantitativo mínimo – até 50%, art. 67, § 2º)' },
  { id: 'profissional_tecnico_quadro', label: 'Atestado ou comprovação de profissional responsável (técnico-profissional) no quadro da empresa' },
  { id: 'equipe_tecnica_minima', label: 'Indicação da equipe técnica mínima (ex.: diretor, cinegrafista, editor, técnico de áudio, fotógrafo)' },
  { id: 'equipamentos_minimos', label: 'Relação de equipamentos mínimos (câmeras, áudio, iluminação, mesa de corte, transmissão, drone)' },
  { id: 'registro_conselho_profissional', label: 'Registro da empresa ou dos profissionais em entidade profissional (ex.: DRT (Registro Profissional) de radialista/jornalista, CREA (Conselho Regional de Engenharia e Agronomia))' },
  { id: 'registro_ancine', label: 'Registro na ANCINE (Agência Nacional do Cinema)' },
  { id: 'certificado_cenp', label: 'Certificado do CENP (Conselho Executivo das Normas-Padrão) – típico de agência de publicidade (Lei nº 12.232/2010)' },
  { id: 'art_rrt_responsavel', label: 'Responsável técnico com ART/RRT (Anotação/Registro de Responsabilidade Técnica) – estruturas, palco ou elétrica em eventos' },
  { id: 'vistoria_visita_tecnica', label: 'Vistoria / visita técnica (ou declaração de conhecimento das condições do local)' },
  { id: 'amostra_portfolio_prova_conceito', label: 'Amostra, portfólio, vídeo-piloto ou prova de conceito' },
  { id: 'proposta_tecnica', label: 'Proposta técnica (julgamento por melhor técnica ou técnica e preço)' },
  { id: 'licencas_autorizacoes_servico', label: 'Licenças e autorizações específicas (ex.: drone – ANAC/DECEA, alvarás de evento, cessão de direitos autorais e de imagem)' },
] as const;

// O último item ("Outros requisitos") é opcional: o id começa com "outras_" (ver
// itemEhOpcional).
export const SERVICOS_DECLARACOES_ITENS = [
  { id: 'cumprimento_requisitos_habilitacao', label: 'Declaração de cumprimento dos requisitos de habilitação' },
  { id: 'reserva_cargos_pcd', label: 'Declaração de reserva de cargos para PcD (Pessoa com Deficiência) e reabilitados da Previdência' },
  { id: 'proposta_compativel_custos_trabalhistas', label: 'Declaração de que a proposta cobre os custos trabalhistas' },
  { id: 'nao_emprego_menor', label: 'Declaração de não emprego de menor (art. 7º, XXXIII, da Constituição Federal)' },
  { id: 'enquadramento_me_epp', label: 'Declaração de enquadramento como ME/EPP (Microempresa e Empresa de Pequeno Porte), se for usar o benefício' },
  { id: 'outras_declaracoes', label: 'Outros requisitos de habilitação (descrever no campo de detalhes)' },
] as const;

/** Listas de exigências de cada tipo de objeto. */
export function listasDeExigencias(tipo: TipoObjeto): ListasExigencias {
  if (tipo === 'servicos') {
    return {
      juridica: SERVICOS_HABILITACAO_JURIDICA_ITENS,
      fiscalSocialTrabalhista: SERVICOS_HABILITACAO_FISCAL_ITENS,
      economicoFinanceira: SERVICOS_HABILITACAO_ECONOMICO_FINANCEIRA_ITENS,
      tecnica: SERVICOS_HABILITACAO_TECNICA_ITENS,
      declaracoes: SERVICOS_DECLARACOES_ITENS,
      outras: [],
    };
  }
  return {
    juridica: HABILITACAO_JURIDICA_ITENS,
    fiscalSocialTrabalhista: HABILITACAO_FISCAL_ITENS,
    economicoFinanceira: HABILITACAO_ECONOMICO_FINANCEIRA_ITENS,
    tecnica: HABILITACAO_TECNICA_ITENS,
    declaracoes: DECLARACOES_ITENS,
    outras: OUTRAS_EXIGENCIAS_ITENS,
  };
}

/** Item que nunca bloqueia o salvamento: o "Outras" de cada seção de produto e o
 *  "Outros requisitos" de serviços (todos com id "outras_…"). */
export function itemEhOpcional(item: { id: string; label: string }): boolean {
  return item.label === 'Outras' || item.id.startsWith('outras_');
}

/** Resultado de trocar o tipo de objeto sobre checklists já preenchidos. */
export interface ConversaoChecklists {
  habilitacao: Habilitacao;
  declaracoes: ItemChecklistExigencia[];
  outrasExigencias: ItemChecklistExigencia[];
  /** Itens com marcação ou detalhe que não existem na lista nova (serão perdidos). */
  descartados: ItemChecklistExigencia[];
}

/** Monta as listas do tipo novo e aproveita a marcação dos itens de mesmo id. */
export function converterChecklists(
  atual: {
    habilitacao: Habilitacao;
    declaracoes: ItemChecklistExigencia[];
    outrasExigencias: ItemChecklistExigencia[];
  },
  tipoNovo: TipoObjeto
): ConversaoChecklists {
  const listas = listasDeExigencias(tipoNovo);
  const todosAtuais = [
    ...atual.habilitacao.juridica,
    ...atual.habilitacao.fiscalSocialTrabalhista,
    ...atual.habilitacao.economicoFinanceira,
    ...atual.habilitacao.tecnica,
    ...atual.declaracoes,
    ...atual.outrasExigencias,
  ];
  const porId = new Map(todosAtuais.map((item) => [item.id, item]));
  const aproveitados = new Set<string>();

  const montar = (definicao: DefinicaoItens): ItemChecklistExigencia[] =>
    definicao.map(({ id, label }) => {
      const anterior = porId.get(id);
      if (!anterior || (anterior.status == null && !anterior.detalhamento.trim())) {
        return { id, label, status: undefined, detalhamento: '' };
      }
      aproveitados.add(id);
      return { id, label, status: anterior.status, detalhamento: anterior.detalhamento };
    });

  const habilitacao: Habilitacao = {
    juridica: montar(listas.juridica),
    fiscalSocialTrabalhista: montar(listas.fiscalSocialTrabalhista),
    economicoFinanceira: montar(listas.economicoFinanceira),
    tecnica: montar(listas.tecnica),
  };
  const declaracoes = montar(listas.declaracoes);
  const outrasExigencias = montar(listas.outras);

  const descartados = todosAtuais.filter(
    (item) => (item.status != null || item.detalhamento.trim() !== '') && !aproveitados.has(item.id)
  );
  return { habilitacao, declaracoes, outrasExigencias, descartados };
}

// ---------------------------------------------------------------------------
// Aba 3 — Condições Comerciais
// ---------------------------------------------------------------------------
// Intervalo de lances (25/09): deixou de ser um campo de texto livre único
// — agora o Analista marca se o edital define o intervalo por Valor (R$)
// ou por Percentual (%), preenche o número correspondente, e opcionalmente
// anota o texto da regra por extenso em intervaloLancesDetalhe (ex.: "O
// intervalo mínimo entre cada lance será o valor/percentual marcado em
// campo próprio na plataforma BBMNET...").
export type TipoIntervaloLances = 'valor' | 'percentual';

export interface CondicoesComerciais {
  tipoIntervaloLances?: TipoIntervaloLances;
  valorIntervaloLances?: number; // em R$ — só quando tipoIntervaloLances === 'valor'
  percentualIntervaloLances?: number; // em % — só quando tipoIntervaloLances === 'percentual'
  intervaloLancesDetalhe?: string; // texto livre complementar, opcional
  formaPagamento: FormaPagamento;
  recebimentoBanco: string; // "Banco do Brasil" ou "Outros" — seletor fixo
  prazoPagamentoDias?: number;
  possuiGarantias: boolean;
  garantiasDetalhe?: string; // abre quando possuiGarantias = true
  // Em "Serviços", prazoEntregaDias é o "prazo para início da execução" e
  // localEntrega é o "local de execução do serviço" (mesmos campos, outro rótulo
  // — ver rotulosCondicoes).
  prazoEntregaDias?: number; // até 2 dígitos
  localEntrega: string; // detalhamento aberto
  validadePropostaDias?: number; // até 3 dígitos

  // Só para objeto "Serviços" (29/10, planilha de análise de serviços):
  prazoVigencia?: string; // "Prazo de execução / vigência do contrato", texto livre (ex.: "12 meses")
  reajusteRepactuacao?: string; // índice e data-base
  subcontratacao?: SubcontratacaoServico; // art. 122 da Lei 14.133/2021
  exigePlanilhaCustos?: 'sim' | 'nao'; // exige planilha de custos e formação de preços?
}

export type SubcontratacaoServico = 'permitida' | 'permitida_com_limite' | 'vedada' | 'omisso';

export const SUBCONTRATACAO_SERVICO_LABEL: Record<SubcontratacaoServico, string> = {
  permitida: 'Permitida',
  permitida_com_limite: 'Permitida com limite',
  vedada: 'Vedada',
  omisso: 'Edital omisso',
};

export const SUBCONTRATACAO_SERVICO_DESCRICAO: Record<SubcontratacaoServico, string> = {
  permitida: 'O edital admite subcontratar partes do objeto, conforme o art. 122.',
  permitida_com_limite: 'O edital admite subcontratar até o percentual ou as parcelas que indicar.',
  vedada: 'O edital proíbe subcontratar: todo o serviço deve ser executado pela própria empresa.',
  omisso: 'O edital não trata do tema: pedir esclarecimento antes de contar com terceiros.',
};

/** Rótulos das condições comerciais conforme o tipo de objeto. */
export function rotulosCondicoes(tipo: TipoObjeto) {
  return tipo === 'servicos'
    ? {
        prazo: 'Prazo para início da execução (dias)',
        prazoCurto: 'Prazo para início da execução',
        local: 'Local de execução do serviço',
      }
    : { prazo: 'Prazo de entrega (dias)', prazoCurto: 'Prazo de entrega', local: 'Local de entrega' };
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
  /** Marcas que compõem o item (cestas básicas/natalinas e kits) — opcional, até 30 (migração 056). */
  marcasComposicao?: string[];
  /** Só em licitação de Serviços (migração 061): categoria do serviço ofertado — obrigatória no item com valor, no lugar de marca e modelo. */
  categoriaServico?: string;
  /** Só em licitação de Serviços (migração 061): observações do serviço — opcional. */
  observacoes?: string;
}

/** Categorias de serviço da planilha de análise (aba BASE DE INFORMAÇÕES). O texto é gravado como está. */
export const CATEGORIAS_SERVICO = [
  'Produção audiovisual (vídeo institucional/publicitário)',
  'Captação e cobertura de eventos (foto e vídeo)',
  'Transmissão ao vivo (streaming)',
  'Podcast / videocast',
  'Conteúdo para redes sociais',
  'Animação / motion graphics',
  'Edição e pós-produção',
  'Locução, trilha e áudio',
  'Fotografia',
  'Imagens aéreas (drone)',
  'Eventos e ativações (produção e cenografia)',
  'Locação de equipamentos audiovisuais',
  'Outro (descrever em Observações)',
] as const;

export interface GrupoItens {
  id: string;
  numero: string; // ex.: "1", "2" — número do grupo
  nome: string; // ex.: "Grupo 1"
}

// Decisão do Admin/Analista sobre um ITEM INDIVIDUAL (sem grupo) cujo preço
// ficou acima do valor de referência (migração 032). Ausente = pendente
// (ninguém decidiu ainda). Grupos acima da referência não têm decisão —
// são bloqueados automaticamente (regra de 06/10, Márcio).
export type DecisaoAcimaReferencia = 'liberado' | 'barrado';

export interface ItemLicitacao {
  id: string;
  grupoId?: string; // presente = item pertence a um grupo; ausente = item individual
  numero: string;
  descricao: string;
  unidadeMedida: string;
  quantidade: number;
  precoReferencia: number; // valor unitário de referência (edital) — preenchido pelo Admin
  exclusivoMeEpp: boolean;
  familiaId?: string; // família de produto do cliente (relatórios) — opcional
  propostaCliente?: PropostaClienteItem;
  decisaoAcimaReferencia?: DecisaoAcimaReferencia;
  decisaoAcimaReferenciaPor?: string; // quem decidiu
  decisaoAcimaReferenciaEm?: string; // ISO datetime
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
  orgaoCnpj?: string; // CNPJ do órgão, só números (opcional) — relatórios por órgão
  orgaoUasg?: string; // UASG (Unidade Administrativa de Serviços Gerais), opcional
  estado: string; // UF
  esfera?: EsferaLicitacao; // opcional: municipal, estadual, federal ou distrital
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
  // "restricoesMeEpp" removido (02/10) — era redundante com "participacao",
  // que já tem as opções "Exclusiva ME/EPP" / "Ampla concorrência".
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
  // Motivo padronizado da recusa (lista fixa, obrigatório ao recusar — migração 052).
  // O texto livre acima passa a ser só a explicação complementar.
  motivoNaoParticipacao?: MotivoNaoParticipacao;
  decisaoClienteEm?: string;
  // Liberação ao cliente (22/10, migrações 054 e 055): enquanto estiver vazio,
  // a licitação NÃO aparece no Portal do Cliente. Quem libera é o Administrador
  // ou o Analista, pelo botão "Liberar para o cliente". Preenchido pelo banco.
  liberadaAoClienteEm?: string;
  liberadaAoClientePor?: string;
  cobrarFrete: boolean;
  percentualFrete?: number; // só relevante quando cobrarFrete = true
  statusProposta: StatusProposta;
  // Liberação manual do prazo de edição do Cliente (29/09, a pedido do
  // Márcio) — só o Admin pode ligar/desligar (ver
  // liberar_prazo_proposta_cliente, migração 023). Quando true, o Cliente
  // pode editar a Proposta Comercial mesmo depois do prazo automático (4
  // dias úteis antes da sessão, 18h30) ter vencido — até a data/hora
  // definida em `prazoPropostaLiberadoAte`, escolhida pelo próprio Admin
  // no momento em que libera (não é mais um número fixo de dias — o Admin
  // decide até quando o Cliente pode editar).
  prazoPropostaLiberado: boolean;
  // Data/hora-limite (ISO) escolhida pelo Admin até quando a liberação
  // manual vale. Só tem sentido quando `prazoPropostaLiberado` é true —
  // depois desse instante o Cliente volta a ficar bloqueado automaticamente,
  // mesmo que ninguém tenha "travado" manualmente.
  prazoPropostaLiberadoAte?: string;

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
