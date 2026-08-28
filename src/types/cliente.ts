export type ClienteStatus = 'ativo' | 'inativo'

export const CLIENTE_STATUS_LABEL: Record<ClienteStatus, string> = {
  ativo: 'Ativo',
  inativo: 'Inativo',
}

/** Porte da empresa — ME/EPP tem restrições legais de participação em
 *  licitações de ampla concorrência (Lei Complementar 123/2006) e, por
 *  regra da Salutti, não pode ter proposta enviada em nenhuma licitação
 *  através do sistema (ver bloqueio no fluxo de envio de proposta). */
export type PorteEmpresa = 'me_epp' | 'demais'

export const PORTE_EMPRESA_LABEL: Record<PorteEmpresa, string> = {
  me_epp: 'ME/EPP',
  demais: 'Demais',
}

export interface ClienteDadosEmpresa {
  razaoSocial: string
  nomeFantasia: string
  cnpj: string
  segmento: string
  inscricaoEstadual: string
  site: string
  porte: PorteEmpresa
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
      porte: 'demais',
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
