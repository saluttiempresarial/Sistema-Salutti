// src/utils/licitacaoCampos.ts
//
// Regras de dois campos do cadastro da licitação (04/11, a pedido do Márcio):
//   - Distância da matriz: é sempre em km. A pessoa digita só o número e o
//     sistema mostra "120 km". Valores antigos como "120km" continuam valendo.
//   - CAPAG (Capacidade de Pagamento do ente público): A, B, C ou N/D (não
//     disponível). A nota C aparece em vermelho.

import type { CondicoesComerciais, GrupoItens, ItemLicitacao } from '@/types/licitacao'

export const OPCOES_CAPAG = ['A', 'B', 'C', 'N/D'] as const
export type NotaCapag = (typeof OPCOES_CAPAG)[number]

/** Leva um valor antigo ou lido do edital (ex.: "B (3,96%)", "n/d") para uma
 *  das opções válidas; devolve '' quando não dá para reconhecer. */
export function normalizarCapag(valor?: string | null): NotaCapag | '' {
  const texto = (valor ?? '').trim().toUpperCase()
  if (!texto) return ''
  if (texto.startsWith('N/D') || texto.startsWith('ND') || texto.startsWith('N D')) return 'N/D'
  const primeira = texto[0]
  return primeira === 'A' || primeira === 'B' || primeira === 'C' ? primeira : ''
}

/** Número de km de um valor como "120", "120km" ou "120 km"; '' se não houver. */
export function extrairKm(valor?: string | null): string {
  const achado = (valor ?? '').match(/\d+(?:[.,]\d+)?/)
  return achado ? achado[0] : ''
}

/** Texto do campo ao digitar: mantém o que a pessoa escreve enquanto só há
 *  números, ponto ou vírgula; um valor antigo (ex.: "120km") vira só o número. */
export function valorCampoKm(valor?: string | null): string {
  const texto = valor ?? ''
  return /^[\d.,]*$/.test(texto) ? texto : extrairKm(texto)
}

/** Distância para exibição: "120 km". Texto livre antigo que não é um número
 *  de km (ex.: "cerca de 2h de viagem") aparece como foi escrito. */
export function formatarDistanciaKm(valor?: string | null): string {
  const texto = (valor ?? '').trim()
  if (!texto) return ''
  if (/^[\d.,\s]+(km)?$/i.test(texto)) return `${extrairKm(texto)} km`
  return texto
}

// ---------------------------------------------------------------------------
// Regras para salvar a licitação (04/11, a pedido do Márcio): não pode salvar
// sem itens, sem as condições comerciais, com número de item repetido, nem
// com itens/grupos que não combinam com a Estrutura escolhida.
// ---------------------------------------------------------------------------

/** O que a Estrutura permite cadastrar na aba Itens. */
export function permissoesDaEstrutura(estrutura?: string | null): { grupos: boolean; individuais: boolean } {
  if (estrutura === 'item') return { grupos: false, individuais: true }
  if (estrutura === 'lote_grupo') return { grupos: true, individuais: false }
  if (estrutura === 'item_lote_grupo') return { grupos: true, individuais: true }
  return { grupos: false, individuais: false } // Estrutura ainda não escolhida
}

/** Compara números de item sem se confundir com espaços, maiúsculas e zeros à esquerda ("01" = "1"). */
export function chaveNumero(numero?: string | null): string {
  return (numero ?? '').trim().toLowerCase().replace(/^0+(?=\d)/, '')
}

/** Ids dos itens cujo número aparece mais de uma vez na licitação (números em branco não entram). */
export function idsItensComNumeroRepetido(itens: ItemLicitacao[]): Set<string> {
  const porNumero = new Map<string, string[]>()
  itens.forEach((item) => {
    const chave = chaveNumero(item.numero)
    if (!chave) return
    porNumero.set(chave, [...(porNumero.get(chave) ?? []), item.id])
  })
  const repetidos = new Set<string>()
  porNumero.forEach((ids) => {
    if (ids.length > 1) ids.forEach((id) => repetidos.add(id))
  })
  return repetidos
}

/** Números de grupo que aparecem mais de uma vez. */
export function numerosDeGrupoRepetidos(grupos: GrupoItens[]): string[] {
  const vistos = new Set<string>()
  const repetidos = new Set<string>()
  grupos.forEach((g) => {
    const chave = chaveNumero(g.numero)
    if (!chave) return
    if (vistos.has(chave)) repetidos.add(g.numero.trim())
    vistos.add(chave)
  })
  return [...repetidos]
}

/** Condições comerciais obrigatórias que ainda estão em branco. Intervalo de
 *  lances e garantias continuam opcionais (nem todo edital tem). */
export function condicoesComerciaisFaltando(cond: CondicoesComerciais, ehServico: boolean): string[] {
  const faltando: string[] = []
  if (!cond.recebimentoBanco) faltando.push('Recebimento em qual banco')
  if (cond.prazoPagamentoDias == null) faltando.push('Prazo de pagamento')
  if (cond.prazoEntregaDias == null) faltando.push(ehServico ? 'Prazo para início da execução' : 'Prazo de entrega')
  if (cond.validadePropostaDias == null) faltando.push('Validade da proposta')
  if (!cond.localEntrega.trim()) faltando.push(ehServico ? 'Local de execução' : 'Local de entrega')
  if (ehServico) {
    if (!cond.prazoVigencia?.trim()) faltando.push('Prazo de execução / vigência')
    if (!cond.reajusteRepactuacao?.trim()) faltando.push('Reajuste / repactuação')
    if (!cond.subcontratacao) faltando.push('Subcontratação')
    if (!cond.exigePlanilhaCustos) faltando.push('Exige planilha de custos')
  }
  return faltando
}
