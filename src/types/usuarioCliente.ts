/**
 * Usuários com login no Portal do Cliente. Um Cliente pode ter vários:
 * um "gestor" (acesso total aos dados daquele cliente, pode gerenciar os
 * outros usuários) e quantos "operadores" precisar (acesso mais restrito,
 * definido pelo gestor) — conforme a especificação funcional (seção 2.3).
 */

export type UsuarioClientePerfil = 'gestor' | 'operador'
export type UsuarioClienteStatus = 'ativo' | 'inativo'

export const USUARIO_CLIENTE_PERFIL_LABEL: Record<UsuarioClientePerfil, string> = {
  gestor: 'Gestor',
  operador: 'Operador',
}

export const USUARIO_CLIENTE_STATUS_LABEL: Record<UsuarioClienteStatus, string> = {
  ativo: 'Ativo',
  inativo: 'Inativo',
}

export interface UsuarioCliente {
  id: string
  clienteId: string
  nome: string
  email: string
  cargo: string
  whatsapp: string
  telefone: string
  perfil: UsuarioClientePerfil
  status: UsuarioClienteStatus
  forcarTrocaSenha: boolean
  criadoEm: string
  atualizadoEm: string
}

export interface UsuarioClienteFormData {
  nome: string
  email: string
  cargo: string
  whatsapp: string
  telefone: string
  perfil: UsuarioClientePerfil
  status: UsuarioClienteStatus
  senhaTemporaria: string
  confirmarSenha: string
}

export function criarUsuarioClienteFormVazio(): UsuarioClienteFormData {
  return {
    nome: '',
    email: '',
    cargo: '',
    whatsapp: '',
    telefone: '',
    perfil: 'operador',
    status: 'ativo',
    senhaTemporaria: '',
    confirmarSenha: '',
  }
}

export function usuarioClienteParaFormData(u: UsuarioCliente): UsuarioClienteFormData {
  return {
    nome: u.nome,
    email: u.email,
    cargo: u.cargo,
    whatsapp: u.whatsapp,
    telefone: u.telefone,
    perfil: u.perfil,
    status: u.status,
    senhaTemporaria: '',
    confirmarSenha: '',
  }
}
