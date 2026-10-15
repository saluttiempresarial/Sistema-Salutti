// src/utils/propostaPendencias.ts
//
// Pendências de identificação na Proposta Comercial (pedido do Márcio, 15/10).
// Marca/Fabricante e Modelo/Versão são obrigatórios em toda licitação, mas o
// sistema só considera o item "preenchido" pelo valor. Este módulo localiza os
// itens que o cliente vai orçar (têm valor) e estão sem marca e/ou modelo, para
// a equipe (Administrador e Analista) ser avisada sem abrir licitação por
// licitação. Só cálculo de tela: não altera nenhum dado nem o banco.
//
// Regra:
//  - o item entra quando tem valor preenchido e falta marca e/ou modelo (vale
//    também para itens dentro de grupos);
//  - item sem valor não entra: pode ser um item que o cliente decidiu não
//    cotar, e o preenchimento parcial de grupos já tem aviso próprio;
//  - licitação recusada pelo cliente não entra.

import type { ItemLicitacao, Licitacao } from '../types/licitacao'
import {
  DIAS_UTEIS_LIMITE_EDICAO_PROPOSTA_CLIENTE,
  propostaComercialTravadaDeVez,
} from './licitacaoCalculos'

export type FaltaIdentificacao = 'marca' | 'modelo' | 'marca_modelo'

export const ROTULO_FALTA_IDENTIFICACAO: Record<FaltaIdentificacao, string> = {
  marca: 'Falta marca',
  modelo: 'Falta modelo',
  marca_modelo: 'Falta marca e modelo',
}

/** O que falta no item, ou null quando está completo (ou sem valor). */
export function faltaIdentificacaoDoItem(item: ItemLicitacao): FaltaIdentificacao | null {
  const p = item.propostaCliente
  if (!p || p.precoMinimo == null) return null
  const semMarca = !(p.marca ?? '').trim()
  const semModelo = !(p.modelo ?? '').trim()
  if (semMarca && semModelo) return 'marca_modelo'
  if (semMarca) return 'marca'
  if (semModelo) return 'modelo'
  return null
}

/** Urgência do aviso: "normal" antes da janela dos 4 dias úteis; "urgente" a
 *  partir do dia-limite do cliente (4 dias úteis antes da sessão); "travada"
 *  depois do prazo definitivo (1 dia útil antes), quando só o Administrador
 *  consegue corrigir. */
export type UrgenciaPendencia = 'normal' | 'urgente' | 'travada'

export interface PendenciaIdentificacao {
  /** Quantidade de itens com algo faltando. */
  itens: number
  /** Mensagem curta para a etiqueta, ex.: "Falta marca e modelo em 2 itens". */
  mensagem: string
  urgencia: UrgenciaPendencia
}

function subtrairDiasUteis(data: Date, dias: number): Date {
  const resultado = new Date(data)
  let restantes = dias
  while (restantes > 0) {
    resultado.setDate(resultado.getDate() - 1)
    const diaSemana = resultado.getDay()
    if (diaSemana !== 0 && diaSemana !== 6) restantes--
  }
  return resultado
}

function urgenciaDaLicitacao(
  licitacao: Pick<Licitacao, 'dataLicitacao' | 'dataEfetivaLicitacao'>,
  agora: Date,
): UrgenciaPendencia {
  if (propostaComercialTravadaDeVez(licitacao)) return 'travada'
  const sessao = new Date(licitacao.dataEfetivaLicitacao || licitacao.dataLicitacao)
  const diaLimite = subtrairDiasUteis(sessao, DIAS_UTEIS_LIMITE_EDICAO_PROPOSTA_CLIENTE)
  diaLimite.setHours(0, 0, 0, 0)
  return agora >= diaLimite ? 'urgente' : 'normal'
}

/** Monta a pendência a partir da lista do que falta em cada item. Usada pela
 *  tela da proposta (que tem os itens) e pela lista de Licitações (que só tem
 *  as contagens vindas do banco). Licitação recusada ou sem faltas: null. */
export function pendenciaDeFaltas(
  licitacao: Pick<Licitacao, 'dataLicitacao' | 'dataEfetivaLicitacao' | 'decisaoCliente'>,
  faltas: FaltaIdentificacao[],
  agora: Date = new Date(),
): PendenciaIdentificacao | null {
  if (licitacao.decisaoCliente === 'recusar') return null
  if (faltas.length === 0) return null

  const soMarca = faltas.every((f) => f === 'marca')
  const soModelo = faltas.every((f) => f === 'modelo')
  const o = soMarca ? 'marca' : soModelo ? 'modelo' : 'marca/modelo'
  const mensagem = `Falta ${o} em ${faltas.length} ${faltas.length === 1 ? 'item' : 'itens'}`

  return { itens: faltas.length, mensagem, urgencia: urgenciaDaLicitacao(licitacao, agora) }
}

/** Pendência de marca/modelo de uma licitação com os itens carregados, ou null
 *  quando não há nada a avisar. `agora` existe para os testes. */
export function pendenciaIdentificacaoDaLicitacao(
  licitacao: Licitacao,
  agora: Date = new Date(),
): PendenciaIdentificacao | null {
  const faltas = licitacao.itens
    .map(faltaIdentificacaoDoItem)
    .filter((f): f is FaltaIdentificacao => f !== null)
  return pendenciaDeFaltas(licitacao, faltas, agora)
}
