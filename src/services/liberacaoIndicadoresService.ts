import { supabase } from '@/lib/supabaseClient'

/**
 * Liberação de nível 1 dos Indicadores (tabela `relatorio_liberacao_perfil`,
 * migração 037): o Administrador liga ou desliga cada indicador para os
 * perfis Analista e Cliente, igual para todos os clientes. O Administrador
 * sempre vê todos os indicadores. Indicador sem linha para o perfil conta
 * como FECHADO.
 */

export type PerfilLiberacao = 'analista' | 'cliente'

export const PERFIS_LIBERACAO: { chave: PerfilLiberacao; rotulo: string }[] = [
  { chave: 'analista', rotulo: 'Analista' },
  { chave: 'cliente', rotulo: 'Cliente' },
]

/** Catálogo da primeira entrega. As chaves devem ser as mesmas da migração 037. */
export const CATALOGO_INDICADORES: { chave: string; nome: string; descricao: string }[] = [
  { chave: 'funil', nome: 'Funil de licitações', descricao: 'Analisadas, participou e ganhou' },
  { chave: 'taxa_vitoria', nome: 'Taxa de vitória', descricao: 'Por quantidade e por valor, com comparação com o período anterior' },
  { chave: 'volume_periodo', nome: 'Volume por período', descricao: 'Licitações e valor de referência por mês' },
  { chave: 'familias', nome: 'Famílias de produtos', descricao: 'Itens cotados e itens ganhos por família' },
  { chave: 'ganho_sobre_minimo', nome: 'Ganho sobre o mínimo', descricao: 'Quanto se vendeu acima do preço mínimo do cliente' },
  { chave: 'perdas_evitaveis', nome: 'Perdas evitáveis', descricao: 'Uso interno: vencedor com preço ainda acima do mínimo do cliente' },
  { chave: 'orgaos', nome: 'Órgãos', descricao: 'Participações e vitórias por órgão' },
  { chave: 'concorrentes', nome: 'Concorrentes que mais vencem', descricao: 'Quem mais ganhou do cliente' },
]

/** indicador -> perfil -> liberado. Sempre traz todos os indicadores do catálogo. */
export type LiberacaoIndicadores = Record<string, Record<PerfilLiberacao, boolean>>

interface LiberacaoRow {
  indicador: string
  perfil: PerfilLiberacao
  liberado: boolean
}

function mapaFechado(): LiberacaoIndicadores {
  const mapa: LiberacaoIndicadores = {}
  for (const ind of CATALOGO_INDICADORES) mapa[ind.chave] = { analista: false, cliente: false }
  return mapa
}

async function listar(): Promise<LiberacaoIndicadores> {
  const { data, error } = await supabase
    .from('relatorio_liberacao_perfil')
    .select('indicador, perfil, liberado')
  if (error) throw new Error(`Não foi possível carregar a liberação dos indicadores: ${error.message}`)

  const mapa = mapaFechado()
  for (const row of (data ?? []) as LiberacaoRow[]) {
    if (mapa[row.indicador]) mapa[row.indicador][row.perfil] = row.liberado
  }
  return mapa
}

/** Grava a liberação completa (todas as combinações do catálogo). Só o
 *  Administrador ativo consegue, pela regra de segurança do banco. */
async function salvar(mapa: LiberacaoIndicadores): Promise<void> {
  const agora = new Date().toISOString()
  const linhas = CATALOGO_INDICADORES.flatMap((ind) =>
    PERFIS_LIBERACAO.map((perfil) => ({
      indicador: ind.chave,
      perfil: perfil.chave,
      liberado: mapa[ind.chave]?.[perfil.chave] ?? false,
      atualizado_em: agora,
    })),
  )
  const { error } = await supabase
    .from('relatorio_liberacao_perfil')
    .upsert(linhas, { onConflict: 'indicador,perfil' })
  if (error) throw new Error(`Não foi possível salvar a liberação dos indicadores: ${error.message}`)
}

export const liberacaoIndicadoresService = { listar, salvar }
