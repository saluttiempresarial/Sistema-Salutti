import { supabase } from '@/lib/supabaseClient'
import type { UsuarioCliente, UsuarioClienteFormData } from '@/types/usuarioCliente'
import { loginUsuarioService } from '@/services/loginUsuarioService'

/**
 * Camada de serviço dos usuários (gestor/operador) de cada Cliente —
 * tabela `usuarios_cliente` no Supabase.
 *
 * Login de verdade (Supabase Auth + auth_user_id) é criado/redefinido via
 * a Edge Function `gerenciar-login-usuario` (ver loginUsuarioService) —
 * ela é quem tem acesso à service_role key, nunca este arquivo.
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

    const row = data as UsuarioClienteRow

    if (formData.senhaTemporaria) {
      try {
        await loginUsuarioService.criar('usuarios_cliente', row.id, formData.email, formData.senhaTemporaria)
      } catch (erroLogin) {
        // Ver o mesmo comentário em funcionarioService.create — sem isso,
        // uma falha na criação do login deixa um cadastro "órfão" pra
        // trás, travando o e-mail pra uma nova tentativa.
        await supabase.from('usuarios_cliente').delete().eq('id', row.id)
        throw erroLogin
      }
    }

    return paraUsuarioCliente(row)
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

    if (formData.senhaTemporaria) {
      await loginUsuarioService.redefinirSenha('usuarios_cliente', id, formData.email, formData.senhaTemporaria)
    }

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
