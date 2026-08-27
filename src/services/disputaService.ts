// src/services/disputaService.ts
//
// Camada de serviço do módulo de Disputas — conectada ao Supabase (tabela
// `disputas`). Segue o mesmo padrão de `licitacaoService.ts`.
//
// PONTO IMPORTANTE: quando o resultado da disputa é definido como "ganho"
// ou "perdido", este service atualiza automaticamente o `status` da
// Licitação correspondente (via `licitacaoService.atualizarStatus`), para
// que a Mesa de Trabalho e a listagem de Licitações reflitam o resultado
// sem precisar de uma segunda edição manual.

import { supabase } from '@/lib/supabaseClient'
import { Disputa, DisputaFormData, ResultadoDisputa } from '../types/disputa'
import { licitacaoService } from './licitacaoService'

/** Formato de uma linha vinda direto da tabela `disputas` do Postgres. */
interface DisputaRow {
  id: string
  licitacao_id: string
  data_sessao_realizada: string | null
  valor_nossa_oferta_final: number | null
  valor_vencedor: number | null
  nome_vencedor: string | null
  posicao_final: number | null
  resultado: ResultadoDisputa
  observacoes: string | null
  link_ata_siga_pregao: string | null
  criado_em: string
  atualizado_em: string
}

function paraDisputa(row: DisputaRow): Disputa {
  return {
    id: row.id,
    licitacaoId: row.licitacao_id,
    dataSessaoRealizada: row.data_sessao_realizada ?? undefined,
    valorNossaOfertaFinal: row.valor_nossa_oferta_final ?? undefined,
    valorVencedor: row.valor_vencedor ?? undefined,
    nomeVencedor: row.nome_vencedor ?? undefined,
    posicaoFinal: row.posicao_final ?? undefined,
    resultado: row.resultado,
    observacoes: row.observacoes ?? '',
    linkAtaSigaPregao: row.link_ata_siga_pregao ?? undefined,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  }
}

/** Converte o formulário para as colunas que o Supabase espera num
 *  insert/update (sem id/criado_em/atualizado_em, que o próprio banco cuida). */
function paraColunas(dados: Partial<DisputaFormData>) {
  const colunas: Record<string, unknown> = {}
  if (dados.licitacaoId !== undefined) colunas.licitacao_id = dados.licitacaoId
  if (dados.dataSessaoRealizada !== undefined) colunas.data_sessao_realizada = dados.dataSessaoRealizada || null
  if (dados.valorNossaOfertaFinal !== undefined) colunas.valor_nossa_oferta_final = dados.valorNossaOfertaFinal ?? null
  if (dados.valorVencedor !== undefined) colunas.valor_vencedor = dados.valorVencedor ?? null
  if (dados.nomeVencedor !== undefined) colunas.nome_vencedor = dados.nomeVencedor || null
  if (dados.posicaoFinal !== undefined) colunas.posicao_final = dados.posicaoFinal ?? null
  if (dados.resultado !== undefined) colunas.resultado = dados.resultado
  if (dados.observacoes !== undefined) colunas.observacoes = dados.observacoes
  if (dados.linkAtaSigaPregao !== undefined) colunas.link_ata_siga_pregao = dados.linkAtaSigaPregao || null
  return colunas
}

async function sincronizarStatusLicitacao(licitacaoId: string, resultado: ResultadoDisputa, usuario: string) {
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
    return data ? paraDisputa(data as DisputaRow) : null
  },

  async listarTodas(): Promise<Disputa[]> {
    const { data, error } = await supabase
      .from('disputas')
      .select('*')
      .order('atualizado_em', { ascending: false })
    if (error) throw new Error(error.message)
    return ((data as DisputaRow[]) ?? []).map(paraDisputa)
  },

  async criar(dados: DisputaFormData, usuario: string): Promise<Disputa> {
    const { data, error } = await supabase
      .from('disputas')
      .insert(paraColunas(dados))
      .select()
      .single()
    if (error) throw new Error(error.message)

    const row = data as DisputaRow
    await sincronizarStatusLicitacao(row.licitacao_id, row.resultado, usuario)
    return paraDisputa(row)
  },

  async atualizar(id: string, dados: Partial<DisputaFormData>, usuario: string): Promise<Disputa> {
    const { data, error } = await supabase
      .from('disputas')
      .update(paraColunas(dados))
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)

    const row = data as DisputaRow
    if (dados.resultado) {
      await sincronizarStatusLicitacao(row.licitacao_id, row.resultado, usuario)
    }
    return paraDisputa(row)
  },

  async excluir(id: string): Promise<void> {
    const { error } = await supabase.from('disputas').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },
}
