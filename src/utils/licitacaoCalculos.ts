// src/utils/licitacaoCalculos.ts
//
// Cálculos automáticos previstos na seção 5 da Especificação Funcional
// v2.1. Centralizados aqui para não duplicar a lógica entre o formulário
// (LicitacaoFormModal) e outras telas que precisem exibir os mesmos totais
// (ex.: RelatoriosPage, Portal do Cliente, quando forem revisados).

import { ItemLicitacao } from '@/types/licitacao';

/** Total de referência de um item: valor unitário de referência × quantidade. */
export function totalReferenciaItem(item: ItemLicitacao): number {
  return item.precoReferencia * item.quantidade;
}

/** Soma dos totais de referência de todos os itens que compõem um grupo. */
export function totalReferenciaGrupo(itens: ItemLicitacao[], grupoId: string): number {
  return itens
    .filter((item) => item.grupoId === grupoId)
    .reduce((soma, item) => soma + totalReferenciaItem(item), 0);
}

/**
 * Valor total de referência da oportunidade inteira: soma de todos os itens
 * selecionados, sejam eles de grupo ou individuais (spec 4.2, Aba 5,
 * "Importante: no final de tudo, deve aparecer o total da oportunidade").
 */
export function totalReferenciaOportunidade(itens: ItemLicitacao[]): number {
  return itens.reduce((soma, item) => soma + totalReferenciaItem(item), 0);
}

/** Total que o cliente informou para um item (preço mínimo × quantidade). */
export function totalClienteItem(item: ItemLicitacao): number | null {
  const precoMinimo = item.propostaCliente?.precoMinimo;
  if (precoMinimo == null) return null;
  return precoMinimo * item.quantidade;
}

/**
 * Competitividade do item: valor de referência dividido pela soma do valor
 * digitado pelo cliente com o valor do frete (spec seção 5). Retorna null
 * quando o cliente ainda não preencheu o preço mínimo.
 */
export function competitividadeItem(item: ItemLicitacao, valorFrete = 0): number | null {
  const precoMinimo = item.propostaCliente?.precoMinimo;
  if (precoMinimo == null) return null;
  const denominador = precoMinimo + valorFrete;
  if (denominador === 0) return null;
  return item.precoReferencia / denominador;
}

// ---------------------------------------------------------------------------
// Análise da Proposta — bloco "Produtos" da planilha real da Salutti.
//
// Regra extraída DIRETO da fórmula da planilha (coluna STATUS), não é uma
// estimativa: Diferença% = (Preço Mínimo + Frete) ÷ Valor Unit. Referência − 1
//   - Diferença = 0%        -> "= Referência"
//   - 0% a −40% (exclusive)  -> "⚖️ Positiva"
//   - abaixo de −40%         -> "🚀 Forte"
//   - acima de 0%            -> "❌ Não participar"
//
// Usada tanto na página de Proposta Comercial do Cliente quanto na do Admin
// — precisa ser a MESMA regra nos dois lugares, por isso fica centralizada
// aqui em vez de duplicada em cada tela.
// ---------------------------------------------------------------------------

export interface AnaliseItemProposta {
  precoComFrete: number | null;
  valorTotal: number | null;
  percentualDiferenca: number | null;
}

/** Calcula preço com frete, valor total e % de diferença vs. referência
 *  para um item — null em cada campo enquanto o preço mínimo ou a taxa de
 *  frete ainda não tiverem sido preenchidos. */
export function calcularAnaliseItem(
  item: ItemLicitacao,
  taxaFretePercentual: number,
  taxaFretePreenchida: boolean
): AnaliseItemProposta {
  const precoMinimo = item.propostaCliente?.precoMinimo;
  if (!taxaFretePreenchida || precoMinimo == null) {
    return { precoComFrete: null, valorTotal: null, percentualDiferenca: null };
  }
  const precoComFrete = precoMinimo * (1 + taxaFretePercentual / 100);
  const valorTotal = precoComFrete * item.quantidade;
  const percentualDiferenca = item.precoReferencia > 0 ? precoComFrete / item.precoReferencia - 1 : null;
  return { precoComFrete, valorTotal, percentualDiferenca };
}

export type ChaveStatusProposta = 'indefinido' | 'referencia' | 'positiva' | 'forte' | 'nao_participar';

export interface StatusAnaliseProposta {
  chave: ChaveStatusProposta;
  label: string;
  classe: string;
}

/** Classificação de competitividade — mesmos limiares e textos da planilha
 *  real (coluna "Análise da Proposta"): corte fixo em -40%. */
export function classificarStatusProposta(percentualDiferenca: number | null): StatusAnaliseProposta {
  if (percentualDiferenca === null) {
    return { chave: 'indefinido', label: '— Sem preço', classe: 'bg-paper-2 text-ink-soft' };
  }
  if (percentualDiferenca === 0) {
    return { chave: 'referencia', label: '= Referência', classe: 'bg-paper-2 text-ink-soft' };
  }
  if (percentualDiferenca < 0) {
    if (percentualDiferenca <= -0.4) {
      return { chave: 'forte', label: '🚀 Forte', classe: 'bg-forest text-white' };
    }
    return { chave: 'positiva', label: '⚖️ Positiva', classe: 'bg-forest-mist text-forest-deep' };
  }
  return { chave: 'nao_participar', label: '❌ Não participar', classe: 'bg-red-50 text-red-700' };
}
