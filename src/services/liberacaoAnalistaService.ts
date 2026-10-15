import { supabase } from '@/lib/supabaseClient'

/**
 * Liberação dos Indicadores POR ANALISTA (tabela `relatorio_liberacao_analista`
 * e função `relatorio_indicadores_analista()`, migração 046).
 *
 * A coluna "Analista" da liberação de nível 1 (`liberacaoIndicadoresService`)
 * é o PADRÃO de todos os analistas. Aqui ficam só as EXCEÇÕES de cada analista:
 * linha gravada = vale a linha (aberto ou fechado); sem linha = vale o padrão.
 * A exceção vale nos dois sentidos. Só o Administrador grava; o analista só lê
 * as próprias linhas.
 */

export interface AnalistaResumo {
  id: string
  nome: string
  email: string
}

/** funcionarioId -> indicador -> liberado (somente as exceções gravadas). */
export type ExcecoesPorAnalista = Record<string, Record<string, boolean>>

interface FuncionarioRow {
  id: string
  nome_completo: string
  email: string
}

interface ExcecaoRow {
  funcionario_id: string
  indicador: string
  liberado: boolean
}

/** Analistas ativos (perfil "funcionario"), em ordem alfabética. O
 *  Administrador não entra: ele sempre vê todos os indicadores. */
async function listarAnalistas(): Promise<AnalistaResumo[]> {
  const { data, error } = await supabase
    .from('funcionarios')
    .select('id, nome_completo, email')
    .eq('perfil', 'funcionario')
    .eq('status', 'ativo')
    .order('nome_completo', { ascending: true })
  if (error) throw new Error(`Não foi possível carregar os analistas: ${error.message}`)

  return ((data ?? []) as FuncionarioRow[]).map((f) => ({
    id: f.id,
    nome: f.nome_completo,
    email: f.email,
  }))
}

/** Todas as exceções gravadas, agrupadas por analista. */
async function carregarExcecoes(): Promise<ExcecoesPorAnalista> {
  const { data, error } = await supabase
    .from('relatorio_liberacao_analista')
    .select('funcionario_id, indicador, liberado')
  if (error) throw new Error(`Não foi possível carregar a liberação por analista: ${error.message}`)

  const mapa: ExcecoesPorAnalista = {}
  for (const row of (data ?? []) as ExcecaoRow[]) {
    if (!mapa[row.funcionario_id]) mapa[row.funcionario_id] = {}
    mapa[row.funcionario_id][row.indicador] = row.liberado
  }
  return mapa
}

/** Dado o padrão (coluna "Analista") e o que o Administrador marcou para um
 *  analista, devolve só o que DIFERE do padrão — são essas as exceções. */
function diferencasDoPadrao(
  padrao: Record<string, boolean>,
  marcado: Record<string, boolean>,
): Record<string, boolean> {
  const excecoes: Record<string, boolean> = {}
  for (const [indicador, liberado] of Object.entries(marcado)) {
    if (liberado !== (padrao[indicador] ?? false)) excecoes[indicador] = liberado
  }
  return excecoes
}

/** Substitui as exceções de UM analista: grava as informadas e apaga as demais
 *  (um indicador que voltou a ser igual ao padrão deixa de ser exceção). */
async function salvarExcecoes(funcionarioId: string, excecoes: Record<string, boolean>): Promise<void> {
  const chaves = Object.keys(excecoes)

  if (chaves.length === 0) {
    await restaurarPadrao(funcionarioId)
    return
  }

  const agora = new Date().toISOString()
  const linhas = chaves.map((indicador) => ({
    funcionario_id: funcionarioId,
    indicador,
    liberado: excecoes[indicador],
    atualizado_em: agora,
  }))
  const { error: erroGravacao } = await supabase
    .from('relatorio_liberacao_analista')
    .upsert(linhas, { onConflict: 'funcionario_id,indicador' })
  if (erroGravacao) throw new Error(`Não foi possível salvar a liberação do analista: ${erroGravacao.message}`)

  const { error: erroLimpeza } = await supabase
    .from('relatorio_liberacao_analista')
    .delete()
    .eq('funcionario_id', funcionarioId)
    .not('indicador', 'in', `(${chaves.map((c) => `"${c}"`).join(',')})`)
  if (erroLimpeza) throw new Error(`Não foi possível atualizar a liberação do analista: ${erroLimpeza.message}`)
}

/** Apaga todas as exceções de um analista: ele volta a seguir o padrão. */
async function restaurarPadrao(funcionarioId: string): Promise<void> {
  const { error } = await supabase
    .from('relatorio_liberacao_analista')
    .delete()
    .eq('funcionario_id', funcionarioId)
  if (error) throw new Error(`Não foi possível voltar o analista ao padrão: ${error.message}`)
}

/** Indicadores que o analista logado pode ver (padrão + exceções dele). Devolve
 *  `null` quando o usuário logado não é analista ativo. */
async function indicadoresDoAnalistaLogado(): Promise<string[] | null> {
  const { data, error } = await supabase.rpc('relatorio_indicadores_analista')
  if (error) throw new Error(`Não foi possível carregar os indicadores liberados: ${error.message}`)
  if (data === null || data === undefined) return null
  return data as string[]
}

export const liberacaoAnalistaService = {
  listarAnalistas,
  carregarExcecoes,
  diferencasDoPadrao,
  salvarExcecoes,
  restaurarPadrao,
  indicadoresDoAnalistaLogado,
}
