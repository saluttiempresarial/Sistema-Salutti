import { supabase } from '@/lib/supabaseClient'
import { maskCNPJ } from '@/utils/masks'
import type { Cliente, ClienteFormData, ClienteStatus, PorteEmpresa } from '@/types/cliente'

/**
 * Camada de serviço do módulo de Clientes — conectada ao Supabase (tabela
 * `clientes`). O login dos usuários do cliente é gerenciado à parte, em
 * `usuarioClienteService.ts` (ver comentário em src/types/cliente.ts).
 *
 * Nenhuma página/componente que já usava este service precisa mudar —
 * a assinatura de cada função continua a mesma de quando os dados vinham
 * do mock, só o corpo de cada uma mudou.
 */

export interface ClienteListParams {
  search?: string
  status?: ClienteStatus | 'todos'
  page: number
  pageSize: number
}

export interface ClienteListResult {
  data: Cliente[]
  total: number
}

/** Formato de uma linha vinda direto da tabela `clientes` do Postgres
 *  (nomes de coluna em snake_case, conforme 001_schema_inicial.sql). */
interface ClienteRow {
  id: string
  razao_social: string
  nome_fantasia: string
  cnpj: string
  segmento: string | null
  porte: PorteEmpresa
  inscricao_estadual: string | null
  site: string | null
  cep: string | null
  endereco: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  contato_responsavel: string | null
  contato_cargo: string | null
  contato_whatsapp: string | null
  contato_telefone: string | null
  contato_email: string | null
  status: ClienteStatus
  observacoes: string | null
  criado_em: string
  atualizado_em: string
}

function paraCliente(row: ClienteRow): Cliente {
  return {
    id: row.id,
    empresa: {
      razaoSocial: row.razao_social,
      nomeFantasia: row.nome_fantasia,
      cnpj: maskCNPJ(row.cnpj), // banco guarda só dígitos; aqui reaplica "00.000.000/0000-00" pra exibição
      segmento: row.segmento ?? '',
      porte: row.porte ?? 'demais',
      inscricaoEstadual: row.inscricao_estadual ?? '',
      site: row.site ?? '',
    },
    endereco: {
      cep: row.cep ?? '',
      endereco: row.endereco ?? '',
      numero: row.numero ?? '',
      complemento: row.complemento ?? '',
      bairro: row.bairro ?? '',
      cidade: row.cidade ?? '',
      estado: row.estado ?? '',
    },
    contato: {
      responsavel: row.contato_responsavel ?? '',
      cargo: row.contato_cargo ?? '',
      whatsapp: row.contato_whatsapp ?? '',
      telefone: row.contato_telefone ?? '',
      email: row.contato_email ?? '',
    },
    status: row.status,
    observacoes: row.observacoes ?? '',
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  }
}

/** Converte o formulário para o formato de colunas que o Supabase espera
 *  num insert/update (sem o "id"/"criado_em"/"atualizado_em", que o
 *  próprio banco cuida). */
function paraColunas(formData: ClienteFormData) {
  return {
    razao_social: formData.empresa.razaoSocial,
    nome_fantasia: formData.empresa.nomeFantasia,
    cnpj: formData.empresa.cnpj.replace(/\D/g, ''), // guarda só dígitos — evita duplicar por causa de máscara (12.345/0001-90 vs 12345000190)
    segmento: formData.empresa.segmento,
    porte: formData.empresa.porte,
    inscricao_estadual: formData.empresa.inscricaoEstadual,
    site: formData.empresa.site,
    cep: formData.endereco.cep,
    endereco: formData.endereco.endereco,
    numero: formData.endereco.numero,
    complemento: formData.endereco.complemento,
    bairro: formData.endereco.bairro,
    cidade: formData.endereco.cidade,
    estado: formData.endereco.estado,
    contato_responsavel: formData.contato.responsavel,
    contato_cargo: formData.contato.cargo,
    contato_whatsapp: formData.contato.whatsapp,
    contato_telefone: formData.contato.telefone,
    contato_email: formData.contato.email,
    status: formData.status,
    observacoes: formData.observacoes,
  }
}

export const clienteService = {
  async list(params: ClienteListParams): Promise<ClienteListResult> {
    const { search = '', status = 'todos', page, pageSize } = params
    const inicio = (page - 1) * pageSize
    const fim = inicio + pageSize - 1

    let query = supabase
      .from('clientes')
      .select('*', { count: 'exact' })
      .order('razao_social', { ascending: true })

    if (status !== 'todos') {
      query = query.eq('status', status)
    }

    const termo = search.trim()
    if (termo) {
      const digitos = termo.replace(/\D/g, '')
      // Busca por razão social OU nome fantasia OU CNPJ (só dígitos).
      const filtros = [`razao_social.ilike.%${termo}%`, `nome_fantasia.ilike.%${termo}%`]
      if (digitos) filtros.push(`cnpj.ilike.%${digitos}%`)
      query = query.or(filtros.join(','))
    }

    const { data, error, count } = await query.range(inicio, fim)
    if (error) throw new Error(error.message)

    return {
      data: (data as ClienteRow[]).map(paraCliente),
      total: count ?? 0,
    }
  },

  async getById(id: string): Promise<Cliente | null> {
    const { data, error } = await supabase.from('clientes').select('*').eq('id', id).maybeSingle()
    if (error) throw new Error(error.message)
    return data ? paraCliente(data as ClienteRow) : null
  },

  async create(formData: ClienteFormData): Promise<Cliente> {
    const { data, error } = await supabase
      .from('clientes')
      .insert(paraColunas(formData))
      .select()
      .single()
    if (error) throw new Error(error.message)
    return paraCliente(data as ClienteRow)
  },

  async update(id: string, formData: ClienteFormData): Promise<Cliente> {
    const { data, error } = await supabase
      .from('clientes')
      .update(paraColunas(formData))
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return paraCliente(data as ClienteRow)
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('clientes').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  /** Verifica se já existe outro cliente com o mesmo CNPJ (usado na validação do formulário). */
  async cnpjJaCadastrado(cnpj: string, ignorarId?: string): Promise<boolean> {
    const digitos = cnpj.replace(/\D/g, '')
    let query = supabase.from('clientes').select('id').eq('cnpj', digitos)
    if (ignorarId) query = query.neq('id', ignorarId)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return (data?.length ?? 0) > 0
  },
}
