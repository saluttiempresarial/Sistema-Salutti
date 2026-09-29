// src/services/disputaService.ts
//
// Camada de serviço do módulo de Disputas — conectada ao Supabase (tabela
// `disputas` + `disputa_itens`, 1-para-muitos desde a migração 021).
// Segue o mesmo padrão de `licitacaoService.ts`.
//
// PONTO IMPORTANTE: quando o resultado da disputa é definido como "ganho"
// ou "perdido", este service atualiza automaticamente o `status` da
// Licitação correspondente (via `licitacaoService.atualizarStatus`), para
// que a Mesa de Trabalho e a listagem de Licitações reflitam o resultado
// sem precisar de uma segunda edição manual. "homologado" não muda o
// status da licitação — é só uma etapa posterior ao "ganho".
//
// disputa_itens (linhas de resultado por item/grupo): igual ao padrão já
// usado em `atualizarLinksRapidos` (configuracaoService) e nos
// grupos/itens de `licitacaoService` — ao salvar, apaga tudo que já
// existia pra essa disputa e insere a lista nova por completo. Mais
// simples e sem risco de linha órfã ficando pra trás.

import { supabase } from '@/lib/supabaseClient'
import {
  Disputa,
  DisputaFormData,
  DisputaResultadoLinha,
  DisputaResultadoLinhaFormData,
  ResultadoDisputa,
} from '../types/disputa'
import { licitacaoService } from './licitacaoService'

/** Formato de uma linha vinda direto da tabela `disputas` do Postgres. */
interface DisputaRow {
  id: string
  licitacao_id: string
  data_sessao_realizada: string | null
  resultado: ResultadoDisputa
  observacoes: string | null
  link_ata_siga_pregao: string | null
  criado_em: string
  atualizado_em: string
}

/** Formato de uma linha da tabela `disputa_itens`. */
interface DisputaItemRow {
  id: string
  disputa_id: string
  item_id: string | null
  grupo_id: string | null
  posicao: number | null
  valor_fechado: number | null
  total_fechado: number | null
  criado_em: string
  atualizado_em: string
}

function paraDisputaResultadoLinha(row: DisputaItemRow): DisputaResultadoLinha {
  return {
    id: row.id,
    disputaId: row.disputa_id,
    itemId: row.item_id ?? undefined,
    grupoId: row.grupo_id ?? undefined,
    posicao: row.posicao ?? undefined,
    valorFechado: row.valor_fechado ?? undefined,
    totalFechado: row.total_fechado ?? undefined,
  }
}

function paraDisputa(row: DisputaRow, itensRows: DisputaItemRow[]): Disputa {
  return {
    id: row.id,
    licitacaoId: row.licitacao_id,
    dataSessaoRealizada: row.data_sessao_realizada ?? undefined,
    resultado: row.resultado,
    observacoes: row.observacoes ?? '',
    linkAtaSigaPregao: row.link_ata_siga_pregao ?? undefined,
    itens: itensRows.map(paraDisputaResultadoLinha),
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  }
}

/** Converte o formulário para as colunas que o Supabase espera num
 *  insert/update da tabela `disputas` (sem id/criado_em/atualizado_em/
 *  itens, que são tratados à parte). */
function paraColunasDisputa(dados: Partial<Omit<DisputaFormData, 'itens'>>) {
  const colunas: Record<string, unknown> = {}
  if (dados.licitacaoId !== undefined) colunas.licitacao_id = dados.licitacaoId
  if (dados.dataSessaoRealizada !== undefined) colunas.data_sessao_realizada = dados.dataSessaoRealizada || null
  if (dados.resultado !== undefined) colunas.resultado = dados.resultado
  if (dados.observacoes !== undefined) colunas.observacoes = dados.observacoes
  if (dados.linkAtaSigaPregao !== undefined) colunas.link_ata_siga_pregao = dados.linkAtaSigaPregao || null
  return colunas
}

function paraColunasItem(linha: DisputaResultadoLinhaFormData, disputaId: string) {
  return {
    disputa_id: disputaId,
    item_id: linha.itemId ?? null,
    grupo_id: linha.grupoId ?? null,
    posicao: linha.posicao ?? null,
    valor_fechado: linha.valorFechado ?? null,
    total_fechado: linha.totalFechado ?? null,
  }
}

async function buscarItensDaDisputa(disputaId: string): Promise<DisputaItemRow[]> {
  const { data, error } = await supabase.from('disputa_itens').select('*').eq('disputa_id', disputaId)
  if (error) throw new Error(error.message)
  return (data as DisputaItemRow[]) ?? []
}

/** Apaga as linhas de resultado já salvas pra essa disputa e insere a
 *  lista nova por completo — mesma decisão de design já usada em outros
 *  1-para-muitos do sistema (ver nota no topo do arquivo). */
async function salvarItensDaDisputa(disputaId: string, itens: DisputaResultadoLinhaFormData[]): Promise<void> {
  const { error: erroDelete } = await supabase.from('disputa_itens').delete().eq('disputa_id', disputaId)
  if (erroDelete) throw new Error(erroDelete.message)

  if (itens.length > 0) {
    const { error: erroInsert } = await supabase
      .from('disputa_itens')
      .insert(itens.map((linha) => paraColunasItem(linha, disputaId)))
    if (erroInsert) throw new Error(erroInsert.message)
  }
}

async function sincronizarStatusLicitacao(licitacaoId: string, resultado: ResultadoDisputa, usuario: string) {
  // "homologado" não muda o status da licitação — é uma etapa posterior ao
  // "ganho", que é quando o status já deve ter virado 'ganho'.
  if (resultado === 'ganho' || resultado === 'perdido') {
    await licitacaoService.atualizarStatus(licitacaoId, resultado, usuario)
  }
}

export const disputaService = {
  async buscarPorLicitacao(licitacaoId: string): Promise<Disputa | null> {
    const { data, error } = await supabase
      .from('disputas')
      .select('*')
      .eq('licitacao_id', licitacaoId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return null

    const row = data as DisputaRow
    const itensRows = await buscarItensDaDisputa(row.id)
    return paraDisputa(row, itensRows)
  },

  async listarTodas(): Promise<Disputa[]> {
    const { data, error } = await supabase
      .from('disputas')
      .select('*')
      .order('atualizado_em', { ascending: false })
    if (error) throw new Error(error.message)

    const rows = (data as DisputaRow[]) ?? []
    if (rows.length === 0) return []

    const { data: todosItens, error: erroItens } = await supabase
      .from('disputa_itens')
      .select('*')
      .in('disputa_id', rows.map((r) => r.id))
    if (erroItens) throw new Error(erroItens.message)

    const itensPorDisputa = new Map<string, DisputaItemRow[]>()
    ;((todosItens as DisputaItemRow[]) ?? []).forEach((item) => {
      itensPorDisputa.set(item.disputa_id, [...(itensPorDisputa.get(item.disputa_id) ?? []), item])
    })

    return rows.map((row) => paraDisputa(row, itensPorDisputa.get(row.id) ?? []))
  },

  async criar(dados: DisputaFormData, usuario: string): Promise<Disputa> {
    const { itens, ...dadosDisputa } = dados
    const { data, error } = await supabase
      .from('disputas')
      .insert(paraColunasDisputa(dadosDisputa))
      .select()
      .single()
    if (error) throw new Error(error.message)

    const row = data as DisputaRow
    await salvarItensDaDisputa(row.id, itens)
    await sincronizarStatusLicitacao(row.licitacao_id, row.resultado, usuario)

    const itensRows = await buscarItensDaDisputa(row.id)
    return paraDisputa(row, itensRows)
  },

  async atualizar(id: string, dados: Partial<DisputaFormData>, usuario: string): Promise<Disputa> {
    const { itens, ...dadosDisputa } = dados
    const { data, error } = await supabase
      .from('disputas')
      .update(paraColunasDisputa(dadosDisputa))
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)

    const row = data as DisputaRow
    if (itens !== undefined) {
      await salvarItensDaDisputa(id, itens)
    }
    if (dados.resultado) {
      await sincronizarStatusLicitacao(row.licitacao_id, row.resultado, usuario)
    }

    const itensRows = await buscarItensDaDisputa(id)
    return paraDisputa(row, itensRows)
  },

  async excluir(id: string): Promise<void> {
    // disputa_itens some junto via "on delete cascade" (migração 021).
    const { error } = await supabase.from('disputas').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },
}
