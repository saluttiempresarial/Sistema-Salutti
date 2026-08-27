import { supabase } from '@/lib/supabaseClient'
import type { Funcionario, FuncionarioFormData, FuncionarioStatus } from '@/types/funcionario'

/**
 * Camada de serviço do módulo de Funcionários — conectada ao Supabase
 * (tabela `funcionarios`). Segue o mesmo padrão de `clienteService.ts`.
 *
 * IMPORTANTE (login): a criação/redefinição de senha via
 * `supabase.auth.admin.createUser` exige a service_role key, que nunca
 * pode ficar no front-end. Por enquanto, este service só grava a "ficha"
 * do funcionário na tabela `funcionarios` — o login (Supabase Auth) e o
 * vínculo de `auth_user_id` continuam feitos manualmente pelo painel do
 * Supabase até existir uma Edge Function dedicada para isso.
 *
 * IMPORTANTE (histórico): diferente do mock, o histórico não fica dentro
 * do registro do funcionário — vem da tabela `historico_acoes`, filtrada
 * por entidade_tipo='funcionario' e entidade_id=<id do funcionário>.
 */

export interface FuncionarioListParams {
  search?: string
  status?: FuncionarioStatus | 'todos'
  page: number
  pageSize: number
}

export interface FuncionarioListResult {
  data: Funcionario[]
  total: number
}

/** Formato de uma linha vinda direto da tabela `funcionarios` do Postgres. */
interface FuncionarioRow {
  id: string
  auth_user_id: string | null
  nome_completo: string
  cpf: string | null
  data_nascimento: string | null
  telefone: string | null
  whatsapp: string | null
  email: string
  cargo: string | null
  departamento: string | null
  data_admissao: string | null
  observacoes_cargo: string | null
  perfil: 'admin' | 'funcionario'
  status: FuncionarioStatus
  forcar_troca_senha: boolean
  modo_acesso: 'total' | 'restrito'
  clientes_vinculados: string[] | null
  licitacoes_atribuidas: string[] | null
  modulos: Funcionario['permissoes']['modulos']
  observacoes_administrativas: string | null
  criado_em: string
  atualizado_em: string
}

interface HistoricoRow {
  id: string
  data: string
  usuario: string | null
  descricao: string
}

function paraFuncionario(row: FuncionarioRow, historico: HistoricoRow[] = []): Funcionario {
  return {
    id: row.id,
    pessoal: {
      nomeCompleto: row.nome_completo,
      cpf: row.cpf ?? '',
      dataNascimento: row.data_nascimento ?? '',
      telefone: row.telefone ?? '',
      whatsapp: row.whatsapp ?? '',
      email: row.email,
    },
    cargo: {
      cargo: row.cargo ?? '',
      departamento: row.departamento ?? '',
      dataAdmissao: row.data_admissao ?? '',
      observacoes: row.observacoes_cargo ?? '',
    },
    acesso: {
      emailLogin: row.email,
      perfil: row.perfil,
      status: row.status,
      forcarTrocaSenha: row.forcar_troca_senha,
    },
    permissoes: {
      modoAcesso: row.modo_acesso,
      clientesVinculados: row.clientes_vinculados ?? [],
      licitacoesAtribuidas: row.licitacoes_atribuidas ?? [],
      modulos: row.modulos,
    },
    observacoesAdministrativas: row.observacoes_administrativas ?? '',
    historico: historico.map((h) => ({
      id: h.id,
      data: h.data,
      autor: h.usuario ?? 'Sistema',
      descricao: h.descricao,
    })),
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  }
}

/** Converte o formulário para as colunas que o Supabase espera num
 *  insert/update (sem id/criado_em/atualizado_em/auth_user_id — este
 *  último é vinculado manualmente, à parte). */
function paraColunas(formData: FuncionarioFormData) {
  return {
    nome_completo: formData.pessoal.nomeCompleto,
    cpf: formData.pessoal.cpf,
    data_nascimento: formData.pessoal.dataNascimento || null,
    telefone: formData.pessoal.telefone,
    whatsapp: formData.pessoal.whatsapp,
    email: formData.pessoal.email,
    cargo: formData.cargo.cargo,
    departamento: formData.cargo.departamento,
    data_admissao: formData.cargo.dataAdmissao || null,
    observacoes_cargo: formData.cargo.observacoes,
    perfil: formData.acesso.perfil,
    status: formData.acesso.status,
    forcar_troca_senha: formData.acesso.forcarTrocaSenha,
    modo_acesso: formData.permissoes.modoAcesso,
    clientes_vinculados: formData.permissoes.clientesVinculados,
    licitacoes_atribuidas: formData.permissoes.licitacoesAtribuidas,
    modulos: formData.permissoes.modulos,
    observacoes_administrativas: formData.observacoesAdministrativas,
  }
}

async function buscarHistorico(funcionarioId: string): Promise<HistoricoRow[]> {
  const { data, error } = await supabase
    .from('historico_acoes')
    .select('id, data, usuario, descricao')
    .eq('entidade_tipo', 'funcionario')
    .eq('entidade_id', funcionarioId)
    .order('data', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as HistoricoRow[]) ?? []
}

async function registrarHistorico(funcionarioId: string, descricao: string, autor: string) {
  const { error } = await supabase.from('historico_acoes').insert({
    entidade_tipo: 'funcionario',
    entidade_id: funcionarioId,
    descricao,
    usuario: autor,
  })
  if (error) throw new Error(error.message)
}

function correspondeABusca(termoBusca: string) {
  const termo = termoBusca.trim()
  return termo ? [`nome_completo.ilike.%${termo}%`, `email.ilike.%${termo}%`, `cargo.ilike.%${termo}%`] : []
}

export const funcionarioService = {
  async list(params: FuncionarioListParams): Promise<FuncionarioListResult> {
    const { search = '', status = 'todos', page, pageSize } = params
    const inicio = (page - 1) * pageSize
    const fim = inicio + pageSize - 1

    let query = supabase
      .from('funcionarios')
      .select('*', { count: 'exact' })
      .order('nome_completo', { ascending: true })

    if (status !== 'todos') {
      query = query.eq('status', status)
    }

    const filtros = correspondeABusca(search)
    if (filtros.length) {
      query = query.or(filtros.join(','))
    }

    const { data, error, count } = await query.range(inicio, fim)
    if (error) throw new Error(error.message)

    return {
      data: (data as FuncionarioRow[]).map((row) => paraFuncionario(row)),
      total: count ?? 0,
    }
  },

  async getById(id: string): Promise<Funcionario | null> {
    const { data, error } = await supabase.from('funcionarios').select('*').eq('id', id).maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return null

    const historico = await buscarHistorico(id)
    return paraFuncionario(data as FuncionarioRow, historico)
  },

  async create(formData: FuncionarioFormData, autor: string): Promise<Funcionario> {
    const { data, error } = await supabase
      .from('funcionarios')
      .insert(paraColunas(formData))
      .select()
      .single()
    if (error) throw new Error(error.message)

    const row = data as FuncionarioRow
    await registrarHistorico(row.id, 'Cadastro inicial do funcionário.', autor)

    return paraFuncionario(row, await buscarHistorico(row.id))
  },

  async update(id: string, formData: FuncionarioFormData, autor: string): Promise<Funcionario> {
    const { data, error } = await supabase
      .from('funcionarios')
      .update(paraColunas(formData))
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)

    await registrarHistorico(
      id,
      formData.senhaTemporaria ? 'Dados atualizados e senha redefinida.' : 'Dados do cadastro atualizados.',
      autor
    )

    return paraFuncionario(data as FuncionarioRow, await buscarHistorico(id))
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('funcionarios').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  /** Verifica se já existe outro funcionário com o mesmo e-mail de login. */
  async emailLoginJaCadastrado(email: string, ignorarId?: string): Promise<boolean> {
    const alvo = email.trim().toLowerCase()
    let query = supabase.from('funcionarios').select('id').ilike('email', alvo)
    if (ignorarId) query = query.neq('id', ignorarId)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return (data?.length ?? 0) > 0
  },
}
