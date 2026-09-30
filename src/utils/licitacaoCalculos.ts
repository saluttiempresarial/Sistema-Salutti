// src/utils/licitacaoCalculos.ts
//
// Cálculos automáticos previstos na seção 5 da Especificação Funcional
// v2.1. Centralizados aqui para não duplicar a lógica entre o formulário
// (LicitacaoFormModal) e outras telas que precisem exibir os mesmos totais
// (ex.: RelatoriosPage, Portal do Cliente, quando forem revisados).

import { ItemLicitacao, Licitacao } from '@/types/licitacao';

// Quantidade de DIAS ÚTEIS de antecedência (pula sábado e domingo), antes
// da data da sessão, em que o Cliente ainda pode editar a Proposta
// Comercial já enviada — e o horário-limite dentro desse dia (decidido com
// o Márcio, 28/09; antes eram 3 dias corridos, sem horário fixo). Depois
// desse prazo, a edição fica bloqueada.
export const DIAS_UTEIS_LIMITE_EDICAO_PROPOSTA_CLIENTE = 4;
export const HORA_LIMITE_EDICAO_PROPOSTA_CLIENTE = { hora: 18, minuto: 30 };

// Trava ABSOLUTA da Proposta Comercial (29/09, atualizado no mesmo dia a
// pedido do Márcio): a partir de 1 dia ÚTIL antes da sessão, às 18h30,
// NINGUÉM mais preenche ou edita a Proposta Comercial — nem o Cliente, nem
// o Admin, nem o Analista, e uma liberação manual não pode ir além desse
// ponto. Ex.: sessão hoje (29/09) -> trava ontem (28/09) às 18h30. Mesmo
// horário-limite do prazo do Cliente, por consistência.
export const DIAS_UTEIS_LIMITE_ABSOLUTO_PROPOSTA = 1;

/** Subtrai `dias` dias ÚTEIS de `data` (pula sábado e domingo — feriados
 *  não entram nessa conta, só fins de semana). */
function subtrairDiasUteis(data: Date, dias: number): Date {
  const resultado = new Date(data);
  let restantes = dias;
  while (restantes > 0) {
    resultado.setDate(resultado.getDate() - 1);
    const diaSemana = resultado.getDay(); // 0 = domingo, 6 = sábado
    if (diaSemana !== 0 && diaSemana !== 6) {
      restantes--;
    }
  }
  return resultado;
}

/** Data/hora-limite para o Cliente editar a Proposta Comercial: `dias`
 *  dias úteis antes da sessão, sempre às 18h30 daquele dia útil. */
function calcularLimiteEdicao(dataSessao: Date): Date {
  const limite = subtrairDiasUteis(dataSessao, DIAS_UTEIS_LIMITE_EDICAO_PROPOSTA_CLIENTE);
  limite.setHours(HORA_LIMITE_EDICAO_PROPOSTA_CLIENTE.hora, HORA_LIMITE_EDICAO_PROPOSTA_CLIENTE.minuto, 0, 0);
  return limite;
}

/** Data/hora-limite ABSOLUTA (1 dia útil antes da sessão, 18h30) — depois
 *  disso a Proposta Comercial trava de vez, sem exceção nenhuma. */
function calcularLimiteAbsoluto(dataSessao: Date): Date {
  const limite = subtrairDiasUteis(dataSessao, DIAS_UTEIS_LIMITE_ABSOLUTO_PROPOSTA);
  limite.setHours(HORA_LIMITE_EDICAO_PROPOSTA_CLIENTE.hora, HORA_LIMITE_EDICAO_PROPOSTA_CLIENTE.minuto, 0, 0);
  return limite;
}

/** true quando a Proposta Comercial já passou do limite absoluto (1 dia
 *  útil antes da sessão, 18h30) — a partir daí ninguém mais edita, nem
 *  Cliente, nem Admin, nem Analista, e liberação manual não tem efeito. */
export function propostaComercialTravadaDeVez(
  licitacao: Pick<Licitacao, 'dataLicitacao' | 'dataEfetivaLicitacao'>
): boolean {
  const dataSessao = new Date(licitacao.dataEfetivaLicitacao || licitacao.dataLicitacao);
  return new Date() > calcularLimiteAbsoluto(dataSessao);
}

/** true enquanto o Admin/Analista ainda podem preencher a Proposta
 *  Comercial diretamente (sem depender do prazo do Cliente) — só false
 *  depois do limite absoluto. */
export function podeAdminPreencherPropostaDiretamente(
  licitacao: Pick<Licitacao, 'dataLicitacao' | 'dataEfetivaLicitacao'>
): boolean {
  return !propostaComercialTravadaDeVez(licitacao);
}

/**
 * true quando o Cliente ainda pode editar a Proposta Comercial que já
 * enviou — considera a data efetiva da sessão (se a licitação foi
 * remarcada) ou a data original, subtraindo os dias úteis de antecedência
 * e travando às 18h30 do dia-limite.
 *
 * `prazoPropostaLiberado` + `prazoPropostaLiberadoAte` (29/09, atualizado no
 * mesmo dia): quando o Admin ou o Analista libera manualmente (ver
 * liberar_prazo_proposta_cliente, migração 023), o Cliente pode editar
 * mesmo com o prazo automático já vencido — até a data/hora que quem
 * liberou escolheu (`prazoPropostaLiberadoAte`), não é mais um número
 * fixo de dias. Mas isso nunca ultrapassa a trava absoluta (1 dia útil
 * antes da sessão, 18h30) — checada primeiro, sem exceção.
 */
export function podeEditarPropostaCliente(
  licitacao: Pick<
    Licitacao,
    'dataLicitacao' | 'dataEfetivaLicitacao' | 'prazoPropostaLiberado' | 'prazoPropostaLiberadoAte'
  >
): boolean {
  if (propostaComercialTravadaDeVez(licitacao)) return false;

  if (licitacao.prazoPropostaLiberado && licitacao.prazoPropostaLiberadoAte) {
    if (new Date() <= new Date(licitacao.prazoPropostaLiberadoAte)) return true;
  }

  const dataSessao = new Date(licitacao.dataEfetivaLicitacao || licitacao.dataLicitacao);
  const limiteEdicao = calcularLimiteEdicao(dataSessao);
  return new Date() <= limiteEdicao;
}

/**
 * Texto e classificação de urgência do prazo de proposta, para exibir
 * na listagem principal do Cliente (ex.: "Faltam 2 dias", "Prazo
 * encerrado"). A classificação usa as mesmas classes de cor já usadas
 * para o prazo interno (vermelho/amarelo/verde).
 */
export function prazoPropostaClienteInfo(
  licitacao: Pick<
    Licitacao,
    'dataLicitacao' | 'dataEfetivaLicitacao' | 'prazoPropostaLiberado' | 'prazoPropostaLiberadoAte'
  >
): { texto: string; urgencia: 'vencido' | 'atencao' | 'ok' } {
  if (propostaComercialTravadaDeVez(licitacao)) {
    // Texto exibido só pro Cliente (ClienteDashboard e
    // PropostaComercialPage-cliente, únicos que chamam esta função) — a
    // pedido do Márcio (30/09), sem mencionar que é a Salutti quem
    // preenche a partir daqui, informação que não é da conta do Cliente.
    return { texto: 'Prazo encerrado', urgencia: 'vencido' };
  }

  if (licitacao.prazoPropostaLiberado && licitacao.prazoPropostaLiberadoAte) {
    const liberadoAte = new Date(licitacao.prazoPropostaLiberadoAte);
    if (new Date() <= liberadoAte) {
      return {
        texto: `Liberado até ${liberadoAte.toLocaleDateString('pt-BR')} ${liberadoAte.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
        urgencia: 'ok',
      };
    }
  }

  const dataSessao = new Date(licitacao.dataEfetivaLicitacao || licitacao.dataLicitacao);
  const limiteEdicao = calcularLimiteEdicao(dataSessao);
  const diffMs = limiteEdicao.getTime() - new Date().getTime();
  const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDias < 0) return { texto: 'Prazo encerrado', urgencia: 'vencido' };
  if (diffDias === 0) return { texto: 'Encerra hoje', urgencia: 'vencido' };
  if (diffDias === 1) return { texto: 'Falta 1 dia', urgencia: 'atencao' };
  if (diffDias <= 3) return { texto: `Faltam ${diffDias} dias`, urgencia: 'atencao' };
  return { texto: `Faltam ${diffDias} dias`, urgencia: 'ok' };
}


/** Total de referência de um item: valor unitário de referência × quantidade. */
export function totalReferenciaItem(item: ItemLicitacao): number {
  return item.precoReferencia * item.quantidade;
}

/**
 * Detecta se a licitação inteira é exclusiva ME/EPP (todos os itens
 * marcados como exclusivoMeEpp — diferente do caso mais comum, que é só
 * um item ou outro dentro de uma licitação mista). Usada pra bloquear o
 * "Quero Participar" de vez pra uma empresa "Demais", em vez de deixar
 * ela abrir a Proposta Comercial e ver todos os itens travados um a um.
 */
export function licitacaoExclusivaMeEpp(itens: ItemLicitacao[]): boolean {
  return itens.length > 0 && itens.every((item) => item.exclusivoMeEpp);
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
 *  para um item — null em cada campo enquanto o preço mínimo ainda não
 *  tiver sido preenchido.
 *
 *  `taxaFretePreenchida` é mantido no parâmetro por compatibilidade com
 *  quem já chama esta função, mas NÃO bloqueia mais o cálculo: muitas
 *  licitações (ex.: só itens, sem grupo, como a do café) não cobram frete
 *  e o campo "Frete (%)" fica em branco de propósito — travar o cálculo
 *  do item inteiro nesse caso fazia o valor digitado pelo cliente nunca
 *  ser contabilizado no total, mesmo já preenchido. Frete em branco agora
 *  é tratado como 0% (quem chama já passa `taxaFretePercentual ?? 0`). */
export function calcularAnaliseItem(
  item: ItemLicitacao,
  taxaFretePercentual: number,
  _taxaFretePreenchida: boolean
): AnaliseItemProposta {
  const precoMinimo = item.propostaCliente?.precoMinimo;
  if (precoMinimo == null) {
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
      return { chave: 'forte', label: '🚀 Super competitivo', classe: 'bg-forest text-white' };
    }
    return { chave: 'positiva', label: '⚖️ Competitivo', classe: 'bg-yellow-400 text-ink' };
  }
  return { chave: 'nao_participar', label: '📈 Acima da referência', classe: 'bg-red-600 text-white' };
}
