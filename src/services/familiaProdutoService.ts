import { supabase } from '@/lib/supabaseClient'

/**
 * Famílias de produto de cada cliente (tabela `familias_produto`, migração
 * 033). Servem para agrupar os itens das licitações nos relatórios e
 * dashboards. Cada cliente só enxerga/usa as próprias famílias.
 */

export interface FamiliaProduto {
  id: string
  clienteId: string
  nome: string
  ativo: boolean
}

interface FamiliaRow {
  id: string
  cliente_id: string
  nome: string
  ativo: boolean
}

function paraFamilia(row: FamiliaRow): FamiliaProduto {
  return { id: row.id, clienteId: row.cliente_id, nome: row.nome, ativo: row.ativo }
}

/** Famílias ativas de um cliente, em ordem alfabética. */
async function listarAtivasPorCliente(clienteId: string): Promise<FamiliaProduto[]> {
  const { data, error } = await supabase
    .from('familias_produto')
    .select('id, cliente_id, nome, ativo')
    .eq('cliente_id', clienteId)
    .eq('ativo', true)
    .order('nome', { ascending: true })
  if (error) throw new Error(error.message)
  return ((data as FamiliaRow[]) ?? []).map(paraFamilia)
}

/** Todas as famílias (ativas e inativas) que o usuário enxerga — o RLS já
 *  restringe por perfil. Usado pelos relatórios para exibir o nome mesmo de
 *  famílias desativadas depois. */
async function listarTodas(): Promise<FamiliaProduto[]> {
  const { data, error } = await supabase
    .from('familias_produto')
    .select('id, cliente_id, nome, ativo')
    .order('nome', { ascending: true })
  if (error) throw new Error(error.message)
  return ((data as FamiliaRow[]) ?? []).map(paraFamilia)
}

/** Cria uma família nova para o cliente. Se já existir uma com o mesmo nome
 *  (ignorando maiúsculas/minúsculas), devolve a existente em vez de duplicar. */
async function criar(clienteId: string, nome: string): Promise<FamiliaProduto> {
  const nomeLimpo = nome.trim()
  if (!nomeLimpo) throw new Error('Informe o nome da família.')

  const { data, error } = await supabase
    .from('familias_produto')
    .insert({ cliente_id: clienteId, nome: nomeLimpo })
    .select('id, cliente_id, nome, ativo')
    .single()

  if (!error) return paraFamilia(data as FamiliaRow)

  // 23505 = violação do índice único (cliente + nome sem diferenciar caixa)
  if (error.code === '23505') {
    const { data: existente, error: erroBusca } = await supabase
      .from('familias_produto')
      .select('id, cliente_id, nome, ativo')
      .eq('cliente_id', clienteId)
      .ilike('nome', nomeLimpo.replace(/[%_\\]/g, '\\$&'))
      .limit(1)
      .maybeSingle()
    if (erroBusca) throw new Error(erroBusca.message)
    if (existente) {
      const familia = paraFamilia(existente as FamiliaRow)
      if (!familia.ativo) {
        const { error: erroReativar } = await supabase
          .from('familias_produto')
          .update({ ativo: true })
          .eq('id', familia.id)
        if (erroReativar) throw new Error(erroReativar.message)
        familia.ativo = true
      }
      return familia
    }
  }
  throw new Error(error.message)
}

export const familiaProdutoService = { listarAtivasPorCliente, listarTodas, criar }
