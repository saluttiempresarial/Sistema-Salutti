// src/types/motivoNaoParticipacao.ts
//
// Lista padronizada de motivos pelos quais uma licitação termina sem
// participação do cliente (Especificação de Relatórios e Dashboards, seção
// 3.6 — indicador "Motivos de não participação"). Lista definida pelo Márcio
// em 19/10 (8 motivos, com nome curto e explicação em balão ⓘ).
//
// Três origens:
//   1. ESCOLHIDOS PELO CLIENTE — ele escolhe um motivo obrigatório ao clicar
//      em "Não vou participar" (8 chaves; "outro" exige explicação).
//   2. REGISTRADOS PELO SISTEMA ao gravar a recusa — quando o clique em "Não
//      vou participar" acontece por um bloqueio (empresa ME/EPP, ou licitação
//      exclusiva para ME/EPP e empresa "Demais"), o motivo é gravado sozinho.
//   3. CALCULADOS na leitura (não ficam gravados) — "sem resposta" (a sessão
//      passou sem decisão) e "não classificado" (recusas antigas, anteriores
//      a esta lista, que só têm texto livre).
//
// As chaves abaixo precisam ser as mesmas da restrição do banco (migração 052).

export type MotivoEscolhidoCliente =
  | 'preco_referencia_baixo'
  | 'margem_insuficiente'
  | 'prazo_entrega'
  | 'frete_distancia'
  | 'produto_nao_trabalha'
  | 'especificacao_nao_atende'
  | 'fornecedor_nao_localizado'
  | 'outro'

export type MotivoRegistradoSistema = 'bloqueio_porte' | 'exclusiva_me_epp'

/** Motivos que ficam gravados na licitação. */
export type MotivoNaoParticipacao = MotivoEscolhidoCliente | MotivoRegistradoSistema

/** Motivos que só existem no cálculo do indicador. */
export type MotivoCalculado = 'sem_resposta' | 'nao_classificado'

export type ChaveMotivoIndicador = MotivoNaoParticipacao | MotivoCalculado

export type GrupoMotivo = 'preco' | 'prazos_logistica' | 'produto' | 'outro' | 'sistema'

export const GRUPO_MOTIVO_LABEL: Record<GrupoMotivo, string> = {
  preco: 'Preço e margem',
  prazos_logistica: 'Prazo e logística',
  produto: 'Produto e fornecimento',
  outro: 'Outro',
  sistema: 'Registrado pelo sistema',
}

export interface DefinicaoMotivo {
  chave: ChaveMotivoIndicador
  rotulo: string
  grupo: GrupoMotivo
  /** 'cliente' = escolhido pelo cliente; 'sistema' = automático. */
  origem: 'cliente' | 'sistema'
  /** Explicação mostrada no balão ⓘ ao lado do motivo (só nos escolhidos pelo cliente). */
  descricao?: string
}

/** Motivos que o cliente escolhe, na ordem em que aparecem na lista. */
export const MOTIVOS_ESCOLHIDOS_CLIENTE: ReadonlyArray<DefinicaoMotivo & { chave: MotivoEscolhidoCliente; descricao: string }> = [
  {
    chave: 'preco_referencia_baixo',
    rotulo: 'Preço de referência baixo',
    grupo: 'preco',
    origem: 'cliente',
    descricao: 'O valor de referência do órgão está abaixo do que o mercado pratica, então não é possível ofertar de forma competitiva.',
  },
  {
    chave: 'margem_insuficiente',
    rotulo: 'Margem insuficiente',
    grupo: 'preco',
    origem: 'cliente',
    descricao: 'Mesmo com um preço de referência razoável, depois de custo, frete e impostos a margem de lucro não compensa.',
  },
  {
    chave: 'prazo_entrega',
    rotulo: 'Prazo de entrega',
    grupo: 'prazos_logistica',
    origem: 'cliente',
    descricao: 'O prazo de entrega exigido no edital é menor do que a empresa consegue cumprir.',
  },
  {
    chave: 'frete_distancia',
    rotulo: 'Frete ou distância',
    grupo: 'prazos_logistica',
    origem: 'cliente',
    descricao: 'O local de entrega é distante ou o custo do frete torna a operação inviável.',
  },
  {
    chave: 'produto_nao_trabalha',
    rotulo: 'Produto não trabalhado',
    grupo: 'produto',
    origem: 'cliente',
    descricao: 'A empresa não trabalha com o produto ou com o item pedido no edital.',
  },
  {
    chave: 'especificacao_nao_atende',
    rotulo: 'Especificação não atendida',
    grupo: 'produto',
    origem: 'cliente',
    descricao: 'O produto da empresa não atende às especificações técnicas descritas no edital ou no termo de referência.',
  },
  {
    chave: 'fornecedor_nao_localizado',
    rotulo: 'Fornecedor não localizado',
    grupo: 'produto',
    origem: 'cliente',
    descricao: 'Não foi possível encontrar um fornecedor para o produto ou o item, ou nenhum deles consegue atender nas condições do edital.',
  },
  {
    chave: 'outro',
    rotulo: 'Outro',
    grupo: 'outro',
    origem: 'cliente',
    descricao: 'Outro motivo não previsto na lista. Neste caso, explique o motivo no campo de texto.',
  },
]

const MOTIVOS_SISTEMA: ReadonlyArray<DefinicaoMotivo> = [
  { chave: 'bloqueio_porte', rotulo: 'Empresa ME/EPP (bloqueio do sistema)', grupo: 'sistema', origem: 'sistema' },
  { chave: 'exclusiva_me_epp', rotulo: 'Licitação exclusiva ME/EPP (bloqueio do sistema)', grupo: 'sistema', origem: 'sistema' },
  { chave: 'sem_resposta', rotulo: 'Sem resposta do cliente (a sessão passou sem decisão)', grupo: 'sistema', origem: 'sistema' },
  { chave: 'nao_classificado', rotulo: 'Não classificado (recusa anterior à lista de motivos)', grupo: 'sistema', origem: 'sistema' },
]

export const TODOS_OS_MOTIVOS: ReadonlyArray<DefinicaoMotivo> = [...MOTIVOS_ESCOLHIDOS_CLIENTE, ...MOTIVOS_SISTEMA]

export function definicaoDoMotivo(chave: string): DefinicaoMotivo | undefined {
  return TODOS_OS_MOTIVOS.find((m) => m.chave === chave)
}

/** Texto do motivo para exibir (rótulo completo; a chave se não for conhecida). */
export function rotuloDoMotivo(chave: string | undefined | null): string {
  if (!chave) return ''
  return definicaoDoMotivo(chave)?.rotulo ?? chave
}
