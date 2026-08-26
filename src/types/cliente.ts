export type ClienteStatus = 'ativo' | 'inativo'

export const CLIENTE_STATUS_LABEL: Record<ClienteStatus, string> = {
  ativo: 'Ativo',
  inativo: 'Inativo',
}

export interface ClienteDadosEmpresa {
  razaoSocial: string
  nomeFantasia: string
  cnpj: string
  segmento: string
  inscricaoEstadual: string
  site: string
}

export interface ClienteEndereco {
  cep: string
  endereco: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
}

export interface ClienteContato {
  responsavel: string
  cargo: string
  whatsapp: string
  telefone: string
  email: string
}

/**
 * Login de usuários do cliente NÃO fica mais aqui — um cliente pode ter
 * vários usuários (gestor + operadores), gerenciados separadamente em
 * src/types/usuarioCliente.ts e src/services/usuarioClienteService.ts.
 */
export interface Cliente {
  id: string
  empresa: ClienteDadosEmpresa
  endereco: ClienteEndereco
  contato: ClienteContato
  status: ClienteStatus
  observacoes: string
  criadoEm: string
  atualizadoEm: string
}

export interface ClienteFormData {
  empresa: ClienteDadosEmpresa
  endereco: ClienteEndereco
  contato: ClienteContato
  status: ClienteStatus
  observacoes: string
}

export function criarClienteFormVazio(): ClienteFormData {
  return {
    empresa: {
      razaoSocial: '',
      nomeFantasia: '',
      cnpj: '',
      segmento: '',
      inscricaoEstadual: '',
      site: '',
    },
    endereco: {
      cep: '',
      endereco: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      estado: '',
    },
    contato: {
      responsavel: '',
      cargo: '',
      whatsapp: '',
      telefone: '',
      email: '',
    },
    status: 'ativo',
    observacoes: '',
  }
}

export function clienteParaFormData(cliente: Cliente): ClienteFormData {
  return {
    empresa: { ...cliente.empresa },
    endereco: { ...cliente.endereco },
    contato: { ...cliente.contato },
    status: cliente.status,
    observacoes: cliente.observacoes,
  }
}

export const SEGMENTOS_DISPONIVEIS = [
  'Administração Pública',
  'Construção Civil',
  'Saúde',
  'Educação',
  'Tecnologia da Informação',
  'Alimentação',
  'Serviços Gerais',
  'Outro',
]

export const ESTADOS_BRASILEIROS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
]
