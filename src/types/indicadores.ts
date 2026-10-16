// src/types/indicadores.ts
//
// Tipos do painel de Indicadores (Relatórios e Dashboards — Especificação de
// 07/10/2026, seção 8: primeira entrega, 8 indicadores do Administrador).
//
// Os números são calculados no próprio sistema (ver utils/indicadoresCalculos.ts)
// a partir de dados base carregados uma única vez, para ficarem idênticos aos
// da tela de Disputa (mesmo mínimo c/ frete).

import type { Licitacao } from './licitacao';
import type { Disputa, ResultadoItemDisputa } from './disputa';
import type { FamiliaProduto } from '../services/familiaProdutoService';

/** Valor do filtro de família para itens que ainda não têm família. */
export const FILTRO_SEM_FAMILIA = 'sem-familia';

export interface FiltrosIndicadores {
  dataDe?: string; // YYYY-MM-DD, pela data da sessão
  dataAte?: string; // YYYY-MM-DD
  clienteId?: string;
  modalidade?: string;
  familiaId?: string; // id da família, ou FILTRO_SEM_FAMILIA
  /** Nome do órgão já normalizado (sem acento, maiúsculas nem espaços extras). */
  orgao?: string;
  /** Marca da proposta do cliente, já normalizada: só licitações com ao menos
   *  um item dessa marca; os resultados passam a considerar só esses itens. */
  marca?: string;
  /** Resultado da licitação (ver ResultadoLicitacaoFiltro). */
  resultado?: ResultadoLicitacaoFiltro;
  /** Fase no pipeline — filtro "Status", só para Administrador e Analista. */
  fase?: FasePipeline;
}

/** Resultado de uma licitação para o filtro "Resultado". "Não participou" =
 *  o cliente recusou ou a sessão passou sem ele decidir. */
export type ResultadoLicitacaoFiltro = 'ganho' | 'perdido' | 'em_andamento' | 'nao_participou';

export const ROTULO_RESULTADO_LICITACAO: Record<ResultadoLicitacaoFiltro, string> = {
  ganho: 'Ganho',
  perdido: 'Perdido',
  em_andamento: 'Em andamento',
  nao_participou: 'Não participou',
};

/** Opção de lista suspensa dos filtros (valor normalizado + nome para exibir). */
export interface OpcaoFiltro {
  value: string;
  label: string;
}

export interface ClienteResumo {
  id: string;
  nome: string;
  /** Segmento do cadastro do cliente (só no painel interno). */
  segmento?: string;
}

/** Tudo o que os cálculos precisam, carregado de uma vez. */
export interface DadosBaseIndicadores {
  licitacoes: Licitacao[]; // com grupos e itens
  disputas: Disputa[]; // com as linhas de resultado
  familias: FamiliaProduto[]; // inclusive inativas (para exibir nomes antigos)
  clientes: ClienteResumo[];
}

// ---------------------------------------------------------------------------
// Indicador 1 — Funil
// ---------------------------------------------------------------------------
export interface EtapaFunil {
  chave: 'analisadas' | 'participou' | 'ganhou';
  rotulo: string;
  quantidade: number;
}

// ---------------------------------------------------------------------------
// Indicador 2 — Taxa de vitória (quantidade e valor)
// ---------------------------------------------------------------------------
export interface TaxaVitoria {
  ganhos: number; // itens/grupos ganhos
  perdidos: number; // itens/grupos perdidos
  valorAdjudicado: number; // valor ofertado dos ganhos
  valorDisputado: number; // valor ofertado dos ganhos + perdidos
  percentualQuantidade: number | null; // null = nada disputado
  percentualValor: number | null;
}

export interface TaxaVitoriaComparada {
  atual: TaxaVitoria;
  /** Mesmo cálculo no período anterior de igual duração; null quando o
   *  filtro de período não está completo (De e Até). */
  anterior: TaxaVitoria | null;
}

// ---------------------------------------------------------------------------
// Indicador 3 — Volume por período
// ---------------------------------------------------------------------------
export interface VolumeMes {
  mes: string; // YYYY-MM
  rotulo: string; // ex.: "out/2026"
  licitacoes: number;
  valor: number; // valor de referência
}

// ---------------------------------------------------------------------------
// Indicadores 4 e 5 — Famílias
// ---------------------------------------------------------------------------
/** Chave especial da barra que reúne os GRUPOS (o resultado do grupo é do
 *  lote inteiro e não tem família). */
export const CHAVE_GRUPOS = 'grupos';
export const CHAVE_SEM_FAMILIA = FILTRO_SEM_FAMILIA;

export interface BarraFamilia {
  chave: string; // id da família, CHAVE_SEM_FAMILIA ou CHAVE_GRUPOS
  nome: string;
  cotadas: number; // itens (ou grupos) com preço mínimo informado pelo cliente
  ganhas: number; // itens (ou grupos) ganhos
}

export interface GanhoSobreMinimoFamilia {
  chave: string;
  nome: string;
  /** (ofertado − mínimo c/ frete) ÷ mínimo, só nos ganhos. null = sem base. */
  percentual: number | null;
  quantidade: number; // itens (ou grupos) ganhos que entraram no cálculo
}

export interface GanhoSobreMinimo {
  geral: number | null;
  porFamilia: GanhoSobreMinimoFamilia[];
}

// ---------------------------------------------------------------------------
// Indicador 6 — Perdas evitáveis
// ---------------------------------------------------------------------------
export interface PerdaEvitavel {
  licitacaoId: string;
  numeroPregao: string;
  cliente: string;
  rotulo: string; // "3 — Café..." ou "Grupo 2"
  ehGrupo: boolean;
  valorNosso: number | null; // nosso valor ofertado (total)
  valorVencedor: number; // valor do vencedor (total)
  valorMinimo: number; // mínimo c/ frete (total)
  nomeVencedor: string;
}

export interface PerdasEvitaveis {
  linhas: PerdaEvitavel[];
  /** Soma dos valores dos vencedores nesses itens: o que teria sido adjudicado
   *  com um lance até esse valor. */
  totalVencedor: number;
}

// ---------------------------------------------------------------------------
// Preço e competitividade — Valor adjudicado, Ticket médio, Fora de mercado,
// Distância da derrota e Desconto médio (Especificação, seções 3.3 e 3.5)
// ---------------------------------------------------------------------------
export interface ValorAdjudicadoMes {
  mes: string; // YYYY-MM
  rotulo: string; // ex.: "out/2026"
  /** Valor ofertado dos itens/grupos ganhos nas licitações do mês. */
  valor: number;
  licitacoesGanhas: number;
}

/** Valor adjudicado NÃO é faturamento: em registro de preços só vira receita
 *  com empenho. A tela deve sempre dizer "valor adjudicado". */
export interface ValorAdjudicado {
  total: number;
  /** Licitações com ao menos um item/grupo ganho (mesma regra do funil). */
  licitacoesGanhas: number;
  /** total ÷ licitacoesGanhas; null = nenhuma licitação ganha. */
  ticketMedio: number | null;
  porMes: ValorAdjudicadoMes[];
}

/** Percentual geral e por família (cálculo ponderado por valor). */
export interface PercentualPorFamilia {
  chave: string; // id da família, CHAVE_SEM_FAMILIA ou CHAVE_GRUPOS
  nome: string;
  percentual: number | null;
  quantidade: number; // itens (ou grupos) que entraram no cálculo
}

export interface IndicadorPercentual {
  geral: number | null;
  /** Quantidade de itens/grupos que entraram no cálculo geral. */
  quantidade: number;
  porFamilia: PercentualPorFamilia[];
}

export interface ItemForaDeMercado {
  licitacaoId: string;
  numeroPregao: string;
  cliente: string;
  rotulo: string; // "3 — Café..." ou "Grupo 2"
  ehGrupo: boolean;
  valorNosso: number | null; // nosso valor ofertado (total)
  valorVencedor: number; // valor do vencedor (total)
  valorMinimo: number; // mínimo c/ frete (total)
  /** (mínimo − vencedor) ÷ mínimo, em %: quanto o vencedor ficou abaixo. */
  percentualAbaixo: number;
}

/** Perdidos em que o vencedor ficou ABAIXO do mínimo c/ frete do cliente: o
 *  preço dele não compete naquele produto. Não traz o nome do vencedor. */
export interface ForaDeMercado {
  quantidade: number;
  /** Perdidos com valor do vencedor e mínimo informados (base do percentual). */
  baseComVencedor: number;
  /** quantidade ÷ baseComVencedor, em %; null = sem base. */
  percentual: number | null;
  /** Distância média abaixo do mínimo, ponderada por valor; null = sem itens. */
  distanciaMedia: number | null;
  linhas: ItemForaDeMercado[];
}

// ---------------------------------------------------------------------------
// Indicadores 7 e 8 — Órgãos e concorrentes
// ---------------------------------------------------------------------------
export interface BarraOrgao {
  orgao: string;
  participacoes: number; // licitações em que o cliente confirmou participação
  vitorias: number; // licitações com ao menos um item/grupo ganho
}

export interface Concorrente {
  nome: string;
  vitorias: number; // itens/grupos que ele ganhou de nós
  valorTotal: number; // soma dos valores dele nesses itens/grupos
}

// ---------------------------------------------------------------------------
// Produtos e marcas (taxa por família, marcas, produtos nunca ganhos e
// concorrentes por família)
// ---------------------------------------------------------------------------
/** Chave da barra "Sem marca" (itens cotados sem marca informada). */
export const CHAVE_SEM_MARCA = 'sem-marca';

export interface TaxaFamilia {
  chave: string; // id da família, CHAVE_SEM_FAMILIA ou CHAVE_GRUPOS
  nome: string;
  ganhos: number;
  disputados: number; // ganhos + perdidos
  percentual: number | null; // ganhos ÷ disputados
}

/** Taxa de vitória por quantidade, por família: só itens e grupos ganhos ou
 *  perdidos (a mesma base da taxa de vitória geral). */
export interface TaxaVitoriaFamilia {
  geral: number | null;
  ganhos: number;
  disputados: number;
  porFamilia: TaxaFamilia[]; // até 10, das mais disputadas para as menos
}

export interface BarraMarca {
  chave: string; // marca normalizada ou CHAVE_SEM_MARCA
  nome: string; // como foi digitada pela primeira vez
  cotadas: number; // itens soltos com preço mínimo informado pelo cliente
  ganhas: number; // itens soltos ganhos
}

export interface ProdutoNuncaGanho {
  chave: string;
  nome: string;
  perdas: number; // vezes em que foi disputado e perdido
}

/** Produtos disputados (ganho ou perdido) que nunca ganharam: base para a
 *  revisão de portfólio do cliente. */
export interface ProdutosNuncaGanhos {
  totalProdutos: number; // produtos distintos já disputados
  quantidade: number; // quantos deles nunca ganharam
  linhas: ProdutoNuncaGanho[]; // até 10, dos mais perdidos
}

export interface ConcorrenteNaFamilia {
  nome: string;
  vitorias: number;
}

export interface ConcorrentesFamilia {
  chave: string; // id da família, CHAVE_SEM_FAMILIA ou CHAVE_GRUPOS
  nome: string;
  perdas: number; // itens/grupos perdidos com o vencedor identificado
  concorrentes: ConcorrenteNaFamilia[]; // até 3, os que mais ganharam de nós
}

// ---------------------------------------------------------------------------
// Pipeline — licitações por fase (gestão da carteira, uso interno)
// ---------------------------------------------------------------------------
/** Fases calculadas a partir da decisão do cliente, da proposta e do
 *  resultado da disputa (nenhum campo novo no banco). */
export type FasePipeline =
  | 'aguardando_cliente' // cliente ainda não decidiu e a sessão não passou
  | 'sem_decisao' // a sessão já passou e o cliente não decidiu
  | 'proposta' // cliente confirmou participação, proposta ainda não enviada
  | 'em_disputa' // proposta enviada, sem resultado final da disputa
  | 'finalizada' // ganha ou perdida
  | 'recusada'; // cliente recusou participar

export interface EtapaPipeline {
  chave: FasePipeline;
  rotulo: string;
  quantidade: number;
  valorReferencia: number; // soma do valor de referência das licitações da fase
  /** Só na fase "finalizada": quantas foram ganhas e quantas perdidas. */
  ganhas?: number;
  perdidas?: number;
}

export interface Pipeline {
  etapas: EtapaPipeline[];
  total: number;
  /** Sessão já ocorreu e o resultado ainda não foi lançado (fase em_disputa
   *  com a sessão no passado) — pendência de trabalho para o analista. */
  resultadoALancar: number;
}

// ---------------------------------------------------------------------------
// Prazos dos próximos 7 dias (gestão da operação, uso interno)
// ---------------------------------------------------------------------------
export type UrgenciaPrazoIndicador = 'vencido' | 'atencao' | 'ok';

export interface PrazoProximo {
  licitacaoId: string;
  clienteNome: string;
  numeroPregao: string;
  orgao: string;
  dataSessao: string; // ISO
  prazoInterno: string; // ISO — prazo interno da Salutti (regra de Configurações)
  urgencia: UrgenciaPrazoIndicador;
  decisaoCliente: 'pendente' | 'participar' | 'recusar';
}

export interface PrazosProximos {
  /** Janela olhada, em dias (7). */
  janelaDias: number;
  /** Licitações em aberto com sessão futura cujo prazo interno já passou ou
   *  vence na janela, da mais urgente para a menos urgente. */
  linhas: PrazoProximo[];
  vencidos: number;
  vencendoEm24h: number;
  /** Quantas dessas ainda estão sem decisão do cliente. */
  semDecisaoDoCliente: number;
}

// ---------------------------------------------------------------------------
// Gestão da carteira e da operação (lote 1 — Especificação, seções 3.1 a 3.3 e 3.6)
// ---------------------------------------------------------------------------
export interface AproveitamentoCliente {
  chave: string;
  nome: string;
  analisadas: number;
  participou: number;
}

/** Analisadas × participadas: de todas as licitações apresentadas, em quantas
 *  o cliente decidiu participar. */
export interface Aproveitamento {
  analisadas: number;
  participou: number;
  recusou: number;
  semDecisao: number;
  /** participou ÷ analisadas, em %; null = sem licitações. */
  percentual: number | null;
  /** Até 10 clientes, os que mais tiveram licitações. */
  porCliente: AproveitamentoCliente[];
}

export interface TempoRespostaCliente {
  chave: string;
  nome: string;
  mediaDias: number;
  quantidade: number;
}

/** Tempo entre o cadastro da licitação e a decisão do cliente (participar ou
 *  recusar). Ainda não existe a data de envio da análise: usa-se a data de
 *  cadastro, que é quando a licitação fica visível para o cliente. */
export interface TempoResposta {
  quantidade: number; // licitações com decisão e data da decisão
  mediaDias: number | null;
  medianaDias: number | null;
  aguardando: number; // ainda sem decisão
  /** Até 10 clientes, dos mais lentos para os mais rápidos. */
  porCliente: TempoRespostaCliente[];
}

export interface ClienteSemAtividade {
  clienteId: string;
  nome: string;
  /** ISO da última atividade (cadastro de licitação ou decisão); undefined = nunca teve licitação. */
  ultimaAtividade?: string;
  /** Dias desde a última atividade; null = nunca teve licitação. */
  dias: number | null;
}

export interface ClientesSemAtividade {
  /** Todos os clientes visíveis, dos mais parados para os mais ativos. O filtro
   *  de "X dias" é feito na tela. */
  linhas: ClienteSemAtividade[];
}

export interface FatiaCarteira {
  chave: string;
  nome: string;
  valor: number; // valor de referência
  percentual: number; // do total da carteira
  licitacoes: number;
}

export interface ConcentracaoCarteira {
  total: number;
  porCliente: FatiaCarteira[]; // 8 maiores + "Outros"
  porSegmento: FatiaCarteira[];
}

export interface ValorCliente {
  chave: string;
  nome: string;
  /** Valor de referência das licitações com participação confirmada e ainda sem resultado. */
  valorEmDisputa: number;
  /** Valor dos itens e grupos ganhos (não é faturamento). */
  valorAdjudicado: number;
  licitacoesGanhas: number;
}

export interface DesempenhoModalidade {
  chave: string;
  nome: string;
  licitacoes: number;
  participou: number;
  ganhou: number;
  /** ganhou ÷ participou, em %; null = sem participação. */
  taxa: number | null;
}

export interface IndicadoresAdmin {
  funil: EtapaFunil[];
  taxaVitoria: TaxaVitoriaComparada;
  volumePorMes: VolumeMes[];
  familias: BarraFamilia[]; // top 10 já ordenado
  ganhoSobreMinimo: GanhoSobreMinimo;
  perdasEvitaveis: PerdasEvitaveis;
  valorAdjudicado: ValorAdjudicado;
  foraDeMercado: ForaDeMercado;
  /** (nosso valor ÷ valor do vencedor) − 1, só nas perdas por preço. */
  distanciaDerrota: IndicadorPercentual;
  /** 1 − (ofertado ÷ referência do edital), só nos ganhos. */
  descontoMedio: IndicadorPercentual;
  orgaos: BarraOrgao[]; // top 10
  concorrentes: Concorrente[]; // top 10
  /** Taxa de vitória por família (por quantidade). */
  taxaVitoriaFamilia: TaxaVitoriaFamilia;
  /** Marcas mais cotadas e mais ganhas (top 10). */
  marcas: BarraMarca[];
  /** Produtos disputados que nunca ganharam. */
  produtosNuncaGanhos: ProdutosNuncaGanhos;
  /** Contra quem perdemos em cada família (até 5 famílias). */
  concorrentesFamilia: ConcorrentesFamilia[];
  /** Licitações por fase (respeita todos os filtros). */
  pipeline: Pipeline;
  /** Prazos internos dos próximos 7 dias (respeita cliente, modalidade e
   *  família; ignora o período, porque olha sempre a partir de agora). */
  prazosProximos: PrazosProximos;
  aproveitamento: Aproveitamento;
  tempoResposta: TempoResposta;
  /** Ignora os filtros (olha sempre a atividade mais recente de cada cliente). */
  clientesSemAtividade: ClientesSemAtividade;
  concentracaoCarteira: ConcentracaoCarteira;
  valorPorCliente: ValorCliente[]; // 10 maiores por valor adjudicado
  desempenhoModalidade: DesempenhoModalidade[];
  /** Quantidade de licitações consideradas após os filtros. */
  totalLicitacoes: number;
}

/** Uma linha de resultado de disputa já resolvida (item ou grupo) com todos
 *  os valores em TOTAL (unitário × quantidade, quando for item). */
export interface UnidadeResultado {
  licitacaoId: string;
  clienteId: string;
  tipo: 'item' | 'grupo';
  rotulo: string;
  familiaId?: string; // só itens
  /** Marca informada pelo cliente na proposta (só itens). */
  marca?: string;
  /** Produto ofertado pelo cliente (só itens): código interno, marca e modelo
   *  ou descrição, nessa ordem de preferência. */
  produtoChave?: string;
  produtoNome?: string;
  resultado?: ResultadoItemDisputa;
  valorOfertado: number | null;
  valorMinimoComFrete: number | null;
  /** Valor de referência do edital (preço de referência × quantidade; no
   *  grupo, a soma dos itens). null = sem referência informada. */
  valorReferencia: number | null;
  valorVencedor: number | null;
  nomeVencedor?: string;
}
