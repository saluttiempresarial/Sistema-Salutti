import { supabase } from '@/lib/supabaseClient'

/**
 * Liberação de nível 1 dos Indicadores (tabela `relatorio_liberacao_perfil`,
 * migração 037): o Administrador liga ou desliga cada indicador para os
 * perfis Analista e Cliente, igual para todos os clientes. O Administrador
 * sempre vê todos os indicadores. Indicador sem linha para o perfil conta
 * como FECHADO.
 */

export type PerfilLiberacao = 'analista' | 'cliente'

export const PERFIS_LIBERACAO: { chave: PerfilLiberacao; rotulo: string }[] = [
  { chave: 'analista', rotulo: 'Analista' },
  { chave: 'cliente', rotulo: 'Cliente' },
]

/** Catálogo de indicadores. As chaves devem ser as mesmas das migrações 037 (primeira entrega), 060 (perdas na habilitação, convocação e alerta), 042 (preço e competitividade), 043 (pipeline e prazos), 044 (produtos e marcas), 049 (gestão da carteira e da operação) e 051 (mercado por UF e por esfera) e 052 (motivos de não participação). */
export const CATALOGO_INDICADORES: { chave: string; nome: string; descricao: string }[] = [
  { chave: 'pipeline', nome: 'Pipeline', descricao: 'Uso interno: licitações por fase, da decisão do cliente ao resultado' },
  { chave: 'prazos_proximos', nome: 'Prazos dos próximos 7 dias', descricao: 'Uso interno: prazos internos vencidos ou vencendo' },
  { chave: 'funil', nome: 'Relatório principal (total e funil)', descricao: 'Enviadas, retornadas, resultado das licitações e funil' },
  { chave: 'taxa_vitoria', nome: 'Taxa de vitória', descricao: 'Por quantidade e por valor, "1 a cada X" e evolução mês a mês' },
  { chave: 'volume_periodo', nome: 'Volume por período', descricao: 'Licitações e valor de referência por mês' },
  { chave: 'familias', nome: 'Famílias de produtos', descricao: 'Itens cotados e itens ganhos por família' },
  { chave: 'taxa_vitoria_familia', nome: 'Taxa de vitória por família', descricao: 'Itens ganhos sobre itens disputados, por família de produtos' },
  { chave: 'marcas', nome: 'Marcas mais cotadas e mais ganhas', descricao: 'Marcas dos itens cotados e dos itens ganhos' },
  { chave: 'produtos_nunca_ganhos', nome: 'Produtos cotados e nunca ganhos', descricao: 'Produtos já disputados que nunca foram ganhos (revisão de portfólio)' },
  { chave: 'ganho_sobre_minimo', nome: 'Ganho sobre o mínimo', descricao: 'Quanto se vendeu acima do preço mínimo do cliente' },
  { chave: 'perdas_evitaveis', nome: 'Perdas evitáveis', descricao: 'Uso interno: vencedor com preço ainda acima do mínimo do cliente' },
  { chave: 'valor_adjudicado', nome: 'Valor adjudicado por mês', descricao: 'Valor dos itens ganhos por mês (não é faturamento)' },
  { chave: 'ticket_medio', nome: 'Ticket médio', descricao: 'Valor adjudicado por licitação ganha' },
  { chave: 'desconto_medio', nome: 'Desconto médio sobre a referência', descricao: 'Quanto se ganhou abaixo do valor de referência do edital' },
  { chave: 'fora_de_mercado', nome: 'Fora de mercado', descricao: 'Perdas em que o vencedor ficou abaixo do mínimo do cliente' },
  { chave: 'distancia_derrota', nome: 'Distância da derrota', descricao: 'Nas perdas por preço, quanto o cliente ficou acima do vencedor' },
  { chave: 'orgaos', nome: 'Órgãos', descricao: 'Participações e vitórias por órgão' },
  { chave: 'concorrentes', nome: 'Concorrentes que mais vencem', descricao: 'Quem mais ganhou do cliente, com CNPJ, distância de preço e famílias em que vence' },
  { chave: 'tempo_resposta', nome: 'Tempos de envio e de resposta', descricao: 'Uso interno: antecedência do envio, janela do cliente e tempo de resposta, em dias úteis' },
  { chave: 'clientes_sem_atividade', nome: 'Clientes sem atividade', descricao: 'Uso interno: sem envio, sem resposta ou sem participação, pelas faixas de Configurações' },
  { chave: 'concentracao_carteira', nome: 'Concentração da carteira', descricao: 'Uso interno: peso de cada cliente (destaque acima de 30%) e de cada segmento' },
  { chave: 'perdas_habilitacao', nome: 'Perdas na habilitação', descricao: 'Ganho no lance, perdido na aceitação ou na habilitação: valor, motivo e origem' },
  { chave: 'vitorias_convocacao', nome: 'Vitórias por convocação', descricao: 'Vitórias vindas da desclassificação de concorrentes, com o valor' },
  { chave: 'alerta_acompanhamento', nome: 'Alerta de acompanhamento', descricao: 'Uso interno: perdidas em análise com o cliente em 2º ou 3º lugar' },
  { chave: 'valor_por_cliente', nome: 'Valor por cliente', descricao: 'Uso interno: ficha por cliente com enviadas, participações, taxa de vitória, valores e ganho sobre o mínimo' },
  { chave: 'desempenho_modalidade', nome: 'Desempenho por modalidade', descricao: 'Participações e vitórias por modalidade (pregão, concorrência)' },
  { chave: 'motivos_nao_participacao', nome: 'Motivos de não participação', descricao: 'Por que o cliente não participou: motivos escolhidos por ele e registros do sistema (sem resposta, bloqueio ME/EPP)' },
  { chave: 'mercado_uf_esfera', nome: 'Mercado por UF e por esfera', descricao: 'Licitações, participações e vitórias por estado e por esfera (municipal, estadual, federal, distrital)' },
]

/** Indicadores que o funcionário (Operador) do cliente NUNCA vê: o documento
 *  diz "Não" para ele (valores totais, margem ou operação da Salutti). Nem o
 *  Responsável consegue abri-los. Mesma lista da função
 *  relatorio_indicadores_vetados_operador() da migração 060. */
export const INDICADORES_VETADOS_FUNCIONARIO: ReadonlySet<string> = new Set([
  'valor_adjudicado',
  'ganho_sobre_minimo',
  'marcas',
  'perdas_habilitacao',
  'tempo_resposta',
  'perdas_evitaveis',
  'valor_por_cliente',
  'clientes_sem_atividade',
  'concentracao_carteira',
  'alerta_acompanhamento',
  'ticket_medio',
  'desconto_medio',
  'pipeline',
  'prazos_proximos',
  'aproveitamento',
])

/** indicador -> perfil -> liberado. Sempre traz todos os indicadores do catálogo. */
export type LiberacaoIndicadores = Record<string, Record<PerfilLiberacao, boolean>>

interface LiberacaoRow {
  indicador: string
  perfil: PerfilLiberacao
  liberado: boolean
}

function mapaFechado(): LiberacaoIndicadores {
  const mapa: LiberacaoIndicadores = {}
  for (const ind of CATALOGO_INDICADORES) mapa[ind.chave] = { analista: false, cliente: false }
  return mapa
}

async function listar(): Promise<LiberacaoIndicadores> {
  const { data, error } = await supabase
    .from('relatorio_liberacao_perfil')
    .select('indicador, perfil, liberado')
  if (error) throw new Error(`Não foi possível carregar a liberação dos indicadores: ${error.message}`)

  const mapa = mapaFechado()
  for (const row of (data ?? []) as LiberacaoRow[]) {
    if (mapa[row.indicador]) mapa[row.indicador][row.perfil] = row.liberado
  }
  return mapa
}

/** Grava a liberação completa (todas as combinações do catálogo). Só o
 *  Administrador ativo consegue, pela regra de segurança do banco. */
async function salvar(mapa: LiberacaoIndicadores): Promise<void> {
  const agora = new Date().toISOString()
  const linhas = CATALOGO_INDICADORES.flatMap((ind) =>
    PERFIS_LIBERACAO.map((perfil) => ({
      indicador: ind.chave,
      perfil: perfil.chave,
      liberado: mapa[ind.chave]?.[perfil.chave] ?? false,
      atualizado_em: agora,
    })),
  )
  const { error } = await supabase
    .from('relatorio_liberacao_perfil')
    .upsert(linhas, { onConflict: 'indicador,perfil' })
  if (error) throw new Error(`Não foi possível salvar a liberação dos indicadores: ${error.message}`)
}

export const liberacaoIndicadoresService = { listar, salvar }
