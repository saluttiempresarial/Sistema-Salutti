import { supabase } from '@/lib/supabaseClient'
import type { UsuarioCliente, UsuarioClienteFormData } from '@/types/usuarioCliente'

/**
 * Camada de serviço dos usuários (gestor/operador) de cada Cliente —
 * tabela `usuarios_cliente` no Supabase.
 *
 * IMPORTANTE sobre login de verdade: criar a LINHA em `usuarios_cliente`
 * (feito aqui) é só metade do trabalho — falta vincular essa pessoa a um
 * login real do Supabase Auth (campo auth_user_id, hoje sempre nulo até
 * isso ser feito). Enviar convite por e-mail exige a "service_role key"
 * (a chave "perigosa" que nunca pode ficar no código do site) rodando
 * dentro de uma Supabase Edge Function — isso é um passo separado, ainda
 * não implementado. Por ora, o cadastro fica pronto no banco, mas a
 * pessoa ainda não consegue logar de fato.
 */

export interface UsuarioClienteListResult {
  data: UsuarioCliente[]
}

interface UsuarioClienteRow {
  id: string
  cliente_id: string
  nome: string
  email: string
  cargo: string | null
  whatsapp: string | null
  telefone: string | null
  perfil: 'gestor' | 'operador'
  status: 'ativo' | 'inativo'
  forcar_troca_senha: boolean
  criado_em: string
  atualizado_em: string
}

function paraUsuarioCliente(row: UsuarioClienteRow): UsuarioCliente {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    nome: row.nome,
    email: row.email,
    cargo: row.cargo ?? '',
    whatsapp: row.whatsapp ?? '',
    telefone: row.telefone ?? '',
    perfil: row.perfil,
    status: row.status,
    forcarTrocaSenha: row.forcar_troca_senha,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  }
}

function paraColunas(clienteId: string, formData: UsuarioClienteFormData) {
  return {
    cliente_id: clienteId,
    nome: formData.nome,
    email: formData.email,
    cargo: formData.cargo,
    whatsapp: formData.whatsapp,
    telefone: formData.telefone,
    perfil: formData.perfil,
    status: formData.status,
  }
}

export const usuarioClienteService = {
  async listarPorCliente(clienteId: string): Promise<UsuarioCliente[]> {
    const { data, error } = await supabase
      .from('usuarios_cliente')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('perfil', { ascending: true }) // gestor antes de operador
      .order('nome', { ascending: true })
    if (error) throw new Error(error.message)
    return (data as UsuarioClienteRow[]).map(paraUsuarioCliente)
  },

  async create(clienteId: string, formData: UsuarioClienteFormData): Promise<UsuarioCliente> {
    const { data, error } = await supabase
      .from('usuarios_cliente')
      .insert(paraColunas(clienteId, formData))
      .select()
      .single()
    if (error) throw new Error(error.message)
    return paraUsuarioCliente(data as UsuarioClienteRow)
  },

  async update(id: string, formData: UsuarioClienteFormData): Promise<UsuarioCliente> {
    const { data, error } = await supabase
      .from('usuarios_cliente')
      .update({
        nome: formData.nome,
        email: formData.email,
        cargo: formData.cargo,
        whatsapp: formData.whatsapp,
        telefone: formData.telefone,
        perfil: formData.perfil,
        status: formData.status,
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return paraUsuarioCliente(data as UsuarioClienteRow)
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('usuarios_cliente').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  async emailJaCadastrado(email: string, ignorarId?: string): Promise<boolean> {
    let query = supabase.from('usuarios_cliente').select('id').eq('email', email.trim().toLowerCase())
    if (ignorarId) query = query.neq('id', ignorarId)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return (data?.length ?? 0) > 0
  },
}
