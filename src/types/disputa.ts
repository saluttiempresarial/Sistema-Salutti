// src/types/disputa.ts
//
// Registro do resultado da sessão de disputa (Cap. 5 do PRD: "Disputas —
// SIGA Pregão"). Relação 1:1 com Licitação — cada licitação tem, no
// máximo, uma disputa registrada (a sessão em si acontece fora do sistema,
// no app do SIGA Pregão; aqui só guardamos o resultado).
//
// REESTRUTURADO em 28/09, a pedido do Márcio: o resultado deixou de ser um
// valor único pra disputa inteira (posição/oferta/vencedor de uma vez só)
// e passou a ser por ITEM — ou por GRUPO inteiro, quando os itens estão
// agrupados (a disputa/lance no pregão acontece pelo grupo como um todo,
// não item por item). Alinhado 1:1 com a planilha real da Salutti (aba
// "Produtos", bloco "RESULTADO DA LICITAÇÃO"):
//   - Item avulso: Valor Fechado é o preço UNITÁRIO; Total = Valor Fechado
//     × quantidade do item.
//   - Grupo: Valor Fechado é o valor TOTAL já fechado pro grupo inteiro
//     (soma), porque os itens de um grupo costumam ter unidades/preços
//     diferentes entre si — não faz sentido um "unitário" pro grupo.
// Em ambos os casos, % Acima do Mínimo = (Valor Fechado ÷ Preço Mínimo já
// com frete) − 1 — mesma fórmula da planilha (coluna Z/T), só que aplicada
// ao total no caso do grupo.
//
// AJUSTADO em 29/09, a pedido do Márcio: Posição, Valor Fechado e Total são
// os três preenchidos manualmente por admin/analista (Total deixou de ser
// calculado automaticamente como Valor Fechado × quantidade — na prática o
// valor total mostrado no portal pode diferir um pouco da multiplicação
// simples, por arredondamento). Só o % Acima do Mínimo continua automático,
// calculado a partir do Valor Fechado, como já era.
//
// REESTRUTURADO de novo em 30/09, a pedido do Márcio: o resultado deixou
// de ser por GRUPO INTEIRO e passou a ser por ITEM INDIVIDUAL sempre
// (mesmo dentro de um grupo) — ver comentário no topo de
// DisputaFormModal.tsx. `totalFechado` ficou sem uso nesta tela (Total e %
// Acima do Mínimo saíram do card) — o campo continua aqui só para não
// exigir uma migração de banco; código novo não deve mais preenchê-lo.
// `valorFechado` continua com o mesmo nome no código (evita renomear a
// coluna no banco), mas agora é chamado de "Valor ofertado" na tela — é o
// valor que o Analista/Admin registra depois da disputa, sempre unitário
// (já que toda linha agora é um item, nunca mais um grupo agregado).
// `grupoId` também deixou de ser usado nas linhas novas (sempre null a
// partir daqui), mas continua no tipo para ler disputas antigas.

export type ResultadoDisputa = 'em_andamento' | 'ganho' | 'perdido' | 'homologado';

export const RESULTADO_DISPUTA_LABEL: Record<ResultadoDisputa, string> = {
  em_andamento: 'Em andamento',
  ganho: 'Ganho',
  perdido: 'Perdido',
  homologado: 'Homologado',
};

/** Resultado de CADA item na disputa (migração 036) — alimenta os relatórios
 *  (produtos ganhos, perdas evitáveis, distância da derrota etc.). Preenchido
 *  pelo Analista/Admin; o sistema não deduz. */
export type ResultadoItemDisputa =
  | 'arrematado_analise'
  | 'perdido_analise'
  | 'convocado'
  | 'ganho'
  | 'perdido'
  | 'perdido_habilitacao'
  | 'fracassado'
  | 'deserto'
  | 'cancelado';

// Ordem e textos conforme o layout aprovado em 26/10 (migração 059). "Em
// análise" e "Convocado" são resultados PROVISÓRIOS; "Ganho/Perdido
// (homologado)" só valem com a data de homologação.
export const RESULTADO_ITEM_DISPUTA_LABEL: Record<ResultadoItemDisputa, string> = {
  arrematado_analise: 'Arrematado – em análise',
  perdido_analise: 'Perdido – em análise',
  convocado: 'Convocado',
  ganho: 'Ganho (homologado)',
  perdido: 'Perdido (homologado)',
  // Ganho no lance, mas perdido depois: desclassificação na aceitação da
  // proposta, inabilitação ou recurso (migração 054, 22/10).
  perdido_habilitacao: 'Ganho no lance, perdido na aceitação/habilitação',
  fracassado: 'Item fracassado',
  deserto: 'Item deserto',
  cancelado: 'Item cancelado',
};

/** Resultados que ainda dependem da homologação (provisórios). */
export const RESULTADOS_EM_ANALISE: ResultadoItemDisputa[] = ['arrematado_analise', 'perdido_analise', 'convocado'];

/** Resultados de perda (para exibir o "Motivo da perda"). */
export const RESULTADOS_DE_PERDA: ResultadoItemDisputa[] = ['perdido_analise', 'perdido', 'perdido_habilitacao'];

/** Motivo da perda (migração 059). */
export type MotivoPerda =
  | 'preco'
  | 'desclassificado_proposta'
  | 'inabilitado'
  | 'item_cancelado'
  | 'desistencia_cliente';

export const MOTIVO_PERDA_LABEL: Record<MotivoPerda, string> = {
  preco: 'Preço',
  desclassificado_proposta: 'Desclassificado na proposta',
  inabilitado: 'Inabilitado',
  item_cancelado: 'Item cancelado',
  desistencia_cliente: 'Desistência do cliente',
};

/** Situação do PROCESSO no órgão (migração 059). */
export type SituacaoProcesso =
  | 'em_julgamento'
  | 'em_habilitacao'
  | 'em_fase_recursal'
  | 'adjudicada'
  | 'homologada'
  | 'suspensa'
  | 'deserta'
  | 'fracassada'
  | 'revogada'
  | 'anulada';

export const SITUACAO_PROCESSO_LABEL: Record<SituacaoProcesso, string> = {
  em_julgamento: 'Em julgamento (aceitação da proposta)',
  em_habilitacao: 'Em habilitação',
  em_fase_recursal: 'Em fase recursal',
  adjudicada: 'Adjudicada',
  homologada: 'Homologada',
  suspensa: 'Suspensa',
  deserta: 'Deserta',
  fracassada: 'Fracassada',
  revogada: 'Revogada',
  anulada: 'Anulada',
};

/** Ação pendente do processo (migração 059). */
export type AcaoPendente =
  | 'nenhuma'
  | 'enviar_proposta_ajustada'
  | 'enviar_amostra'
  | 'responder_diligencia'
  | 'enviar_documentos_complementares'
  | 'apresentar_recurso'
  | 'apresentar_contrarrazoes';

export const ACAO_PENDENTE_LABEL: Record<AcaoPendente, string> = {
  nenhuma: 'Nenhuma',
  enviar_proposta_ajustada: 'Enviar proposta ajustada',
  enviar_amostra: 'Enviar amostra',
  responder_diligencia: 'Responder diligência',
  enviar_documentos_complementares: 'Enviar documentos complementares',
  apresentar_recurso: 'Apresentar recurso',
  apresentar_contrarrazoes: 'Apresentar contrarrazões',
};

/** Motivo da perda na aceitação/habilitação (migração 054). A ETAPA e a
 *  ORIGEM não são digitadas: saem do motivo (ver tabelas abaixo). */
export type MotivoPerdaHabilitacao =
  | 'desclass_documentacao_produto'
  | 'desclass_amostra_especificacao'
  | 'desclass_erro_proposta'
  | 'inabil_documento_habilitacao'
  | 'inabil_qualificacao'
  | 'perdido_recurso';

export const MOTIVO_PERDA_HABILITACAO_LABEL: Record<MotivoPerdaHabilitacao, string> = {
  desclass_documentacao_produto: 'Desclassificação — documentação do produto (ficha técnica, catálogo, registro, certificação)',
  desclass_amostra_especificacao: 'Desclassificação — amostra reprovada ou especificação não atendida',
  desclass_erro_proposta: 'Desclassificação — erro na proposta (preço, marca, modelo)',
  inabil_documento_habilitacao: 'Inabilitação — documento de habilitação vencido ou faltante',
  inabil_qualificacao: 'Inabilitação — qualificação técnica ou econômico-financeira',
  perdido_recurso: 'Perdido em recurso',
};

export type EtapaPerdaHabilitacao = 'Desclassificação' | 'Inabilitação' | 'Recurso';
export type OrigemPerdaHabilitacao = 'Indústria' | 'Produto' | 'Salutti' | 'Cliente' | 'Recurso';

export const ETAPA_ORIGEM_PERDA_HABILITACAO: Record<
  MotivoPerdaHabilitacao,
  { etapa: EtapaPerdaHabilitacao; origem: OrigemPerdaHabilitacao }
> = {
  desclass_documentacao_produto: { etapa: 'Desclassificação', origem: 'Indústria' },
  desclass_amostra_especificacao: { etapa: 'Desclassificação', origem: 'Produto' },
  desclass_erro_proposta: { etapa: 'Desclassificação', origem: 'Salutti' },
  inabil_documento_habilitacao: { etapa: 'Inabilitação', origem: 'Cliente' },
  inabil_qualificacao: { etapa: 'Inabilitação', origem: 'Cliente' },
  perdido_recurso: { etapa: 'Recurso', origem: 'Recurso' },
};

/** Motivo da perda evitável (item 12 do documento de relatórios). */
export type MotivoPerdaEvitavel =
  | 'lance_nao_chegou_minimo'
  | 'nao_classificado_etapa_fechada'
  | 'erro_cadastro_proposta'
  | 'outro';

export const MOTIVO_PERDA_EVITAVEL_LABEL: Record<MotivoPerdaEvitavel, string> = {
  lance_nao_chegou_minimo: 'Lance não chegou ao mínimo',
  nao_classificado_etapa_fechada: 'Não classificado para a etapa fechada',
  erro_cadastro_proposta: 'Erro no cadastro da proposta',
  outro: 'Outro',
};

/** Situação da disputa: com "Homologado em" preenchido o resultado é
 *  DEFINITIVO; sem data, é PROVISÓRIO. */
export type SituacaoDisputa = 'provisoria' | 'definitiva';

export function situacaoDaDisputa(disputa: Pick<Disputa, 'homologadoEm'>): SituacaoDisputa {
  return disputa.homologadoEm ? 'definitiva' : 'provisoria';
}

export const SITUACAO_DISPUTA_LABEL: Record<SituacaoDisputa, string> = {
  provisoria: 'Provisória',
  definitiva: 'Definitiva',
};

/** Um item avulso é preenchido com `itemId`; um grupo inteiro é preenchido
 *  com `grupoId`. Nunca os dois ao mesmo tempo — ver constraint no banco
 *  (disputa_itens_item_xor_grupo, migração 021). */
export interface DisputaResultadoLinha {
  id: string;
  disputaId: string;
  itemId?: string;
  grupoId?: string;
  posicao?: number; // classificação obtida na disputa (ex.: 1, 2, 22...)
  valorFechado?: number; // unitário (item avulso) ou total (grupo)
  totalFechado?: number; // preenchido manualmente — não é mais Valor Fechado × quantidade
  resultadoItem?: ResultadoItemDisputa; // resultado deste item (migração 036)
  valorVencedor?: number; // unitário do vencedor — só quando resultadoItem = 'perdido'
  nomeVencedor?: string; // empresa vencedora — só quando resultadoItem = 'perdido'
  observacao?: string;
  // Campos de gestão (migração 054, 22/10):
  motivoPerdaHabilitacao?: MotivoPerdaHabilitacao; // só quando resultadoItem = 'perdido_habilitacao'
  motivoPerdaEvitavel?: MotivoPerdaEvitavel; // só quando resultadoItem = 'perdido'
  vitoriaPorConvocacao?: boolean; // só quando resultadoItem = 'ganho'
  cnpjVencedor?: string; // 14 dígitos, sem pontuação — só quando resultadoItem = 'perdido'
  /** Motivo da perda (migração 059): resultados de perda. */
  motivoPerda?: MotivoPerda;
}

export type DisputaResultadoLinhaFormData = Omit<DisputaResultadoLinha, 'id' | 'disputaId'>;

export interface Disputa {
  id: string;
  licitacaoId: string;

  dataSessaoRealizada?: string; // ISO datetime — quando a sessão de fato ocorreu
  resultado: ResultadoDisputa;
  /** Data da homologação. Vazio = resultado provisório; preenchido = definitivo (migração 054). */
  homologadoEm?: string;
  /** Situação do processo no órgão (migração 059). */
  situacaoProcesso?: SituacaoProcesso;
  acaoPendente?: AcaoPendente;
  /** ISO datetime — prazo da ação pendente. */
  prazoAcao?: string;
  /** Data da adjudicação (yyyy-mm-dd). */
  adjudicadaEm?: string;
  observacoes: string;
  linkAtaSigaPregao?: string; // link/registro da ata no app do SIGA Pregão

  itens: DisputaResultadoLinha[]; // 1 linha por item avulso ou por grupo

  criadoEm: string;
  atualizadoEm: string;
}

export type DisputaFormData = Omit<Disputa, 'id' | 'criadoEm' | 'atualizadoEm' | 'itens'> & {
  itens: DisputaResultadoLinhaFormData[];
};
