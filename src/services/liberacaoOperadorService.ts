import { supabase } from '@/lib/supabaseClient'

/**
 * Liberação de nível 2 dos Indicadores (migrações 039 e 040): o Responsável
 * (perfil 'gestor') da empresa decide quais indicadores cada Operador da
 * própria empresa pode ver. Só podem ser repassados os indicadores que o
 * Administrador já liberou ao perfil Cliente (nível 1).
 *
 * A leitura passa pela função `relatorio_operadores_responsavel()`, que só
 * responde ao Responsável ativo e só traz Operadores da mesma empresa. A
 * gravação usa a tabela `relatorio_liberacao_operador`, protegida por regra
 * de segurança no banco.
 */

export interface OperadorLiberacao {
  usuarioId: string
  nome: string
  email: string
  /** indicador -> liberado (valor efetivo: decisão gravada ou padrão). */
  liberacoes: Record<string, boolean>
}

export interface LiberacaoOperadores {
  /** Chaves liberadas pelo Administrador ao perfil Cliente (nível 1). */
  indicadores: string[]
  operadores: OperadorLiberacao[]
}

interface RespostaRpc {
  indicadores: string[]
  operadores: {
    usuario_id: string
    nome: string
    email: string
    liberacoes: Record<string, boolean>
  }[]
}

/** Lê os Operadores da empresa do Responsável logado. Devolve `null` quando o
 *  usuário logado não é Responsável ativo de uma empresa. */
async function carregar(): Promise<LiberacaoOperadores | null> {
  const { data, error } = await supabase.rpc('relatorio_operadores_responsavel')
  if (error) throw new Error(`Não foi possível carregar a liberação dos Operadores: ${error.message}`)
  if (data === null || data === undefined) return null

  const resposta = data as RespostaRpc
  return {
    indicadores: resposta.indicadores ?? [],
    operadores: (resposta.operadores ?? []).map((op) => ({
      usuarioId: op.usuario_id,
      nome: op.nome,
      email: op.email,
      liberacoes: op.liberacoes ?? {},
    })),
  }
}

/** Grava a liberação de UM Operador (todos os indicadores informados).
 *  A regra de segurança do banco recusa a gravação se o Operador não for da
 *  empresa do Responsável logado. */
async function salvar(usuarioId: string, liberacoes: Record<string, boolean>): Promise<void> {
  const agora = new Date().toISOString()
  const linhas = Object.entries(liberacoes).map(([indicador, liberado]) => ({
    usuario_id: usuarioId,
    indicador,
    liberado,
    atualizado_em: agora,
  }))
  if (linhas.length === 0) return

  const { error } = await supabase
    .from('relatorio_liberacao_operador')
    .upsert(linhas, { onConflict: 'usuario_id,indicador' })
  if (error) throw new Error(`Não foi possível salvar a liberação do Operador: ${error.message}`)
}

/** Indicadores que o usuário de cliente logado (Responsável ou Operador) pode
 *  ver, já considerando os dois níveis de liberação. Devolve `null` quando o
 *  usuário não é usuário ativo de cliente. */
async function indicadoresDoUsuarioLogado(): Promise<string[] | null> {
  const { data, error } = await supabase.rpc('relatorio_indicadores_cliente')
  if (error) throw new Error(`Não foi possível carregar os indicadores liberados: ${error.message}`)
  if (data === null || data === undefined) return null
  return data as string[]
}

export const liberacaoOperadorService = { carregar, salvar, indicadoresDoUsuarioLogado }
