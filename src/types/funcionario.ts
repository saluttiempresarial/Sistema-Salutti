/**
 * Tipos do módulo de Cadastro de Funcionários.
 *
 * Segue exatamente o mesmo princípio de src/types/cliente.ts: a integração
 * futura com Supabase deve trocar apenas `src/services/funcionarioService.ts`,
 * mantendo este contrato de dados sem exigir mudanças em componentes ou páginas.
 */

export type FuncionarioStatus = 'ativo' | 'inativo'

export const FUNCIONARIO_STATUS_LABEL: Record<FuncionarioStatus, string> = {
  ativo: 'Ativo',
  inativo: 'Inativo',
}

/** Perfil de acesso do funcionário dentro do sistema (não confundir com o
 *  perfil de autenticação em src/types/auth.ts, que também inclui "cliente"). */
export type FuncionarioPerfil = 'admin' | 'funcionario'

export const FUNCIONARIO_PERFIL_LABEL: Record<FuncionarioPerfil, string> = {
  admin: 'Administrador',
  funcionario: 'Funcionário',
}

/** Aba 1 — Dados Pessoais */
export interface FuncionarioDadosPessoais {
  nomeCompleto: string
  cpf: string
  dataNascimento: string
  telefone: string
  whatsapp: string
  email: string
}

/** Aba 2 — Cargo */
export interface FuncionarioCargo {
  cargo: string
  departamento: string
  dataAdmissao: string
  observacoes: string
}

/** Aba 3 — Acesso ao sistema.
 *  `senhaTemporaria`/`confirmarSenha` só existem no formulário (nunca são
 *  devolvidos pelo service em listagens/leitura) — na integração com
 *  Supabase Auth, esses dois campos deixam de existir aqui e passam a ser
 *  usados apenas para chamar supabase.auth.admin.createUser /
 *  updateUserById no momento do envio do formulário. */
export interface FuncionarioAcesso {
  emailLogin: string
  perfil: FuncionarioPerfil
  status: FuncionarioStatus
  forcarTrocaSenha: boolean
}

/** Se o funcionário enxerga a carteira inteira da Salutti ('total') ou
 *  apenas os clientes/licitações explicitamente vinculados a ele
 *  ('restrito'). O perfil Administrador sempre tem acesso total, independente
 *  deste campo (ver src/hooks/usePermissoes.ts). */
export type ModoAcesso = 'total' | 'restrito'

export const MODO_ACESSO_LABEL: Record<ModoAcesso, string> = {
  total: 'Acesso total à carteira',
  restrito: 'Acesso restrito (somente vínculos abaixo)',
}

/** Ação que pode ser concedida por módulo. Hoje só leitura/edição — exclusão
 *  fica implícita em 'editar' para não multiplicar checkboxes sem necessidade
 *  real ainda. */
export type AcaoPermissao = 'visualizar' | 'editar'

export type ModuloPermissao =
  | 'clientes'
  | 'funcionarios'
  | 'licitacoes'
  | 'disputas'
  | 'relatorios'
  | 'configuracoes'

export const MODULO_PERMISSAO_LABEL: Record<ModuloPermissao, string> = {
  clientes: 'Clientes',
  funcionarios: 'Funcionários',
  licitacoes: 'Licitações',
  disputas: 'Disputas',
  relatorios: 'Relatórios',
  configuracoes: 'Configurações',
}

export type PermissoesPorModulo = Record<ModuloPermissao, AcaoPermissao[]>

/** Aba 4 — Permissões. `modoAcesso` controla se `clientesVinculados` /
 *  `licitacoesAtribuidas` chegam a ser aplicados (em 'total' eles ficam
 *  guardados mas não restringem nada). `modulos` é a permissão granular por
 *  módulo/ação prevista na especificação ("acesso total ou restrito" +
 *  ações específicas). */
export interface FuncionarioPermissoes {
  modoAcesso: ModoAcesso
  clientesVinculados: string[]
  licitacoesAtribuidas: string[]
  modulos: PermissoesPorModulo
}

/** Permissões padrão de um Funcionário recém-criado: acesso total à
 *  carteira (preserva o comportamento atual do sistema) e os módulos
 *  operacionais liberados (Licitações, Disputas, Relatórios em leitura),
 *  sem acesso a Clientes/Funcionários/Configurações — que continuam
 *  exclusivos do Administrador via `allowedRoles` nas rotas. */
export function criarPermissoesPadrao(): FuncionarioPermissoes {
  return {
    modoAcesso: 'total',
    clientesVinculados: [],
    licitacoesAtribuidas: [],
    modulos: {
      clientes: [],
      funcionarios: [],
      licitacoes: ['visualizar', 'editar'],
      disputas: ['visualizar', 'editar'],
      relatorios: ['visualizar'],
      configuracoes: [],
    },
  }
}

/** Aba 5 — Histórico. Cada entrada representa uma alteração administrativa
 *  registrada no cadastro do funcionário (mockado; futuramente viria de uma
 *  tabela de auditoria no Supabase). */
export interface FuncionarioHistoricoEntrada {
  id: string
  data: string
  autor: string
  descricao: string
}

export interface Funcionario {
  id: string
  pessoal: FuncionarioDadosPessoais
  cargo: FuncionarioCargo
  acesso: FuncionarioAcesso
  permissoes: FuncionarioPermissoes
  /** URL pública da foto de perfil (Supabase Storage, bucket
   *  "funcionarios-fotos") — enviada pelo próprio funcionário no Dashboard
   *  dele, não faz parte do formulário de cadastro/edição do Admin. */
  fotoUrl?: string
  observacoesAdministrativas: string
  historico: FuncionarioHistoricoEntrada[]
  criadoEm: string
  atualizadoEm: string
}

/** Formato usado pelo formulário de criação/edição — inclui os campos de
 *  senha (aba "Acesso ao Sistema") que não fazem parte do registro salvo. */
export interface FuncionarioFormData {
  pessoal: FuncionarioDadosPessoais
  cargo: FuncionarioCargo
  acesso: FuncionarioAcesso
  permissoes: FuncionarioPermissoes
  senhaTemporaria: string
  confirmarSenha: string
  observacoesAdministrativas: string
}

export function criarFuncionarioFormVazio(): FuncionarioFormData {
  return {
    pessoal: {
      nomeCompleto: '',
      cpf: '',
      dataNascimento: '',
      telefone: '',
      whatsapp: '',
      email: '',
    },
    cargo: {
      cargo: '',
      departamento: '',
      dataAdmissao: '',
      observacoes: '',
    },
    acesso: {
      emailLogin: '',
      perfil: 'funcionario',
      status: 'ativo',
      forcarTrocaSenha: true,
    },
    permissoes: criarPermissoesPadrao(),
    senhaTemporaria: '',
    confirmarSenha: '',
    observacoesAdministrativas: '',
  }
}

export function funcionarioParaFormData(funcionario: Funcionario): FuncionarioFormData {
  return {
    pessoal: { ...funcionario.pessoal },
    cargo: { ...funcionario.cargo },
    acesso: { ...funcionario.acesso },
    permissoes: {
      modoAcesso: funcionario.permissoes.modoAcesso,
      clientesVinculados: [...funcionario.permissoes.clientesVinculados],
      licitacoesAtribuidas: [...funcionario.permissoes.licitacoesAtribuidas],
      modulos: {
        clientes: [...funcionario.permissoes.modulos.clientes],
        funcionarios: [...funcionario.permissoes.modulos.funcionarios],
        licitacoes: [...funcionario.permissoes.modulos.licitacoes],
        disputas: [...funcionario.permissoes.modulos.disputas],
        relatorios: [...funcionario.permissoes.modulos.relatorios],
        configuracoes: [...funcionario.permissoes.modulos.configuracoes],
      },
    },
    senhaTemporaria: '',
    confirmarSenha: '',
    observacoesAdministrativas: funcionario.observacoesAdministrativas,
  }
}

export const DEPARTAMENTOS_DISPONIVEIS = [
  'Diretoria',
  'Comercial',
  'Licitações',
  'Jurídico',
  'Financeiro',
  'Tecnologia da Informação',
  'Atendimento ao Cliente',
  'Administrativo',
]
