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
}

export interface ClienteResumo {
  id: string;
  nome: string;
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
  resultado?: ResultadoItemDisputa;
  valorOfertado: number | null;
  valorMinimoComFrete: number | null;
  /** Valor de referência do edital (preço de referência × quantidade; no
   *  grupo, a soma dos itens). null = sem referência informada. */
  valorReferencia: number | null;
  valorVencedor: number | null;
  nomeVencedor?: string;
}
