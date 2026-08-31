// src/services/licitacaoService.ts
//
// Camada de serviço do módulo de Licitações — conectada ao Supabase
// (tabelas `licitacoes`, `grupos_itens_licitacao`, `itens_licitacao`).
// Segue o mesmo padrão de `clienteService.ts`/`funcionarioService.ts`.
//
// DECISÃO DE DESIGN (grupos/itens): a cada criação/edição, os grupos e
// itens antigos da licitação são apagados e a lista nova é inserida por
// completo (em vez de calcular um diff item a item). Mais simples e sem
// risco de dessincronia — o "custo" é que os itens ganham um novo UUID a
// cada edição, o que hoje não tem efeito prático (nada referencia o id de
// um item individual fora da própria licitação).
//
// DECISÃO DE DESIGN (histórico): assim como em funcionarioService.ts, o
// histórico não fica embutido no registro — vem da tabela
// historico_acoes, filtrada por entidade_tipo='licitacao'.

import { supabase } from '@/lib/supabaseClient'
import type {
  Licitacao,
  LicitacaoFormData,
  StatusLicitacao,
  GrupoItens,
  ItemLicitacao,
  PropostaClienteItem,
} from '@/types/licitacao'

export interface FiltroLicitacoes {
  busca?: string // número do pregão, órgão ou objeto
  status?: string
  page?: number
  pageSize?: number
  // Permissões granulares (ver src/hooks/usePermissoes.ts): quando informados,
  // restringe às licitações desses clientes OU explicitamente atribuídas.
  clienteIds?: string[]
  licitacaoIds?: string[]
}

export interface ResultadoPaginado<T> {
  itens: T[]
  total: number
  page: number
  pageSize: number
}

/** Formato de uma linha vinda direto da tabela `licitacoes` do Postgres. */
interface LicitacaoRow {
  id: string
  cliente_id: string
  data_licitacao: string
  data_efetiva_licitacao: string | null
  portal: string
  objeto: string
  numero_pregao: string
  orgao: string
  estado: string
  municipio: string
  distancia_matriz: string | null
  modalidade: Licitacao['modalidade']
  forma_disputa: string
  modo_disputa: string
  participacao: string
  capag: string | null
  restricoes_me_epp: string | null
  link_edital: string | null
  arquivo_edital_path: string | null
  valor_total_licitacao: number | null
  status: StatusLicitacao
  habilitacao: Licitacao['habilitacao']
  condicoes_comerciais: Licitacao['condicoesComerciais']
  pontos_atencao: string | null
  decisao_cliente: Licitacao['decisaoCliente']
  motivo_recusa_cliente: string | null
  decisao_cliente_em: string | null
  cobrar_frete: boolean
  percentual_frete: number | null
  status_proposta: Licitacao['statusProposta']
  observacoes: string | null
  criado_em: string
  atualizado_em: string
}

interface GrupoRow {
  id: string
  licitacao_id: string
  numero: string | null
  nome: string
}

interface ItemRow {
  id: string
  licitacao_id: string
  grupo_id: string | null
  numero: string
  descricao: string
  unidade_medida: string
  quantidade: number
  preco_referencia: number
  exclusivo_me_epp: boolean
  proposta_codigo_interno: string | null
  proposta_marca: string | null
  proposta_modelo: string | null
  proposta_quantidade_ofertada: number | null
  proposta_valor_inicial: number | null
  proposta_preco_minimo: number | null
}

interface HistoricoRow {
  id: string
  data: string
  usuario: string | null
  descricao: string
}

function paraGrupo(row: GrupoRow): GrupoItens {
  return { id: row.id, numero: row.numero ?? '', nome: row.nome }
}

function paraItem(row: ItemRow): ItemLicitacao {
  const propostaCliente =
    row.proposta_codigo_interno ||
    row.proposta_marca ||
    row.proposta_modelo ||
    row.proposta_quantidade_ofertada != null ||
    row.proposta_valor_inicial != null ||
    row.proposta_preco_minimo != null
      ? {
          codigoInterno: row.proposta_codigo_interno ?? undefined,
          marca: row.proposta_marca ?? undefined,
          modelo: row.proposta_modelo ?? undefined,
          quantidadeOfertada: row.proposta_quantidade_ofertada ?? undefined,
          valorInicial: row.proposta_valor_inicial ?? undefined,
          precoMinimo: row.proposta_preco_minimo ?? undefined,
        }
      : undefined

  return {
    id: row.id,
    grupoId: row.grupo_id ?? undefined,
    numero: row.numero,
    descricao: row.descricao,
    unidadeMedida: row.unidade_medida,
    quantidade: row.quantidade,
    precoReferencia: row.preco_referencia,
    exclusivoMeEpp: row.exclusivo_me_epp,
    propostaCliente,
  }
}

function paraLicitacao(
  row: LicitacaoRow,
  grupos: GrupoRow[] = [],
  itens: ItemRow[] = [],
  historico: HistoricoRow[] = []
): Licitacao {
  return {
    id: row.id,
    dataLicitacao: row.data_licitacao,
    dataEfetivaLicitacao: row.data_efetiva_licitacao ?? undefined,
    portal: row.portal,
    objeto: row.objeto,
    numeroPregao: row.numero_pregao,
    orgao: row.orgao,
    estado: row.estado,
    municipio: row.municipio,
    distanciaMatriz: row.distancia_matriz ?? '',
    modalidade: row.modalidade,
    formaDisputa: row.forma_disputa,
    modoDisputa: row.modo_disputa,
    participacao: row.participacao,
    capag: row.capag ?? '',
    restricoesMeEpp: row.restricoes_me_epp ?? '',
    linkEdital: row.link_edital ?? undefined,
    nomeArquivoEdital: row.arquivo_edital_path ?? undefined,
    valorTotalLicitacao: row.valor_total_licitacao ?? undefined,
    clienteId: row.cliente_id,
    status: row.status,
    habilitacao: row.habilitacao,
    condicoesComerciais: row.condicoes_comerciais,
    pontosAtencao: row.pontos_atencao ?? '',
    grupos: grupos.map(paraGrupo),
    itens: itens.map(paraItem),
    decisaoCliente: row.decisao_cliente,
    motivoRecusaCliente: row.motivo_recusa_cliente ?? undefined,
    decisaoClienteEm: row.decisao_cliente_em ?? undefined,
    cobrarFrete: row.cobrar_frete,
    percentualFrete: row.percentual_frete ?? undefined,
    statusProposta: row.status_proposta,
    observacoes: row.observacoes ?? '',
    historico: historico.map((h) => ({
      id: h.id,
      data: h.data,
      usuario: h.usuario ?? 'Sistema',
      acao: h.descricao,
    })),
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  }
}

/** Colunas da licitação em si (sem grupos/itens/histórico, tratados à parte). */
function paraColunasLicitacao(dados: LicitacaoFormData) {
  return {
    cliente_id: dados.clienteId,
    data_licitacao: dados.dataLicitacao,
    data_efetiva_licitacao: dados.dataEfetivaLicitacao || null,
    portal: dados.portal,
    objeto: dados.objeto,
    numero_pregao: dados.numeroPregao,
    orgao: dados.orgao,
    estado: dados.estado,
    municipio: dados.municipio,
    distancia_matriz: dados.distanciaMatriz || null,
    modalidade: dados.modalidade,
    forma_disputa: dados.formaDisputa,
    modo_disputa: dados.modoDisputa,
    participacao: dados.participacao,
    capag: dados.capag,
    restricoes_me_epp: dados.restricoesMeEpp,
    link_edital: dados.linkEdital || null,
    arquivo_edital_path: dados.nomeArquivoEdital || null,
    valor_total_licitacao: dados.valorTotalLicitacao ?? null,
    status: dados.status,
    habilitacao: dados.habilitacao,
    condicoes_comerciais: dados.condicoesComerciais,
    pontos_atencao: dados.pontosAtencao,
    decisao_cliente: dados.decisaoCliente,
    motivo_recusa_cliente: dados.motivoRecusaCliente || null,
    decisao_cliente_em: dados.decisaoClienteEm || null,
    cobrar_frete: dados.cobrarFrete,
    percentual_frete: dados.cobrarFrete ? dados.percentualFrete ?? null : null,
    status_proposta: dados.statusProposta,
    observacoes: dados.observacoes,
  }
}

/** Apaga grupos/itens antigos e insere a lista nova por completo (decisão
 *  de design B — ver comentário no topo do arquivo). Grupos precisam ser
 *  inseridos primeiro, para os itens poderem referenciar o novo grupo_id. */
async function substituirGruposEItens(
  licitacaoId: string,
  grupos: GrupoItens[],
  itens: ItemLicitacao[]
) {
  const { error: erroDeleteItens } = await supabase
    .from('itens_licitacao')
    .delete()
    .eq('licitacao_id', licitacaoId)
  if (erroDeleteItens) throw new Error(erroDeleteItens.message)

  const { error: erroDeleteGrupos } = await supabase
    .from('grupos_itens_licitacao')
    .delete()
    .eq('licitacao_id', licitacaoId)
  if (erroDeleteGrupos) throw new Error(erroDeleteGrupos.message)

  // Mapa "id antigo do grupo (do form) -> novo id gerado pelo banco", para
  // os itens conseguirem apontar para o grupo certo depois do reinsert.
  const mapaGrupoIds = new Map<string, string>()

  if (grupos.length > 0) {
    const { data: gruposInseridos, error: erroInsertGrupos } = await supabase
      .from('grupos_itens_licitacao')
      .insert(grupos.map((g) => ({ licitacao_id: licitacaoId, numero: g.numero, nome: g.nome })))
      .select('id, nome')
    if (erroInsertGrupos) throw new Error(erroInsertGrupos.message)

    // Casa pela ordem (mesma ordem de entrada/retorno) — assume nomes não
    // precisam ser únicos, então casar por índice é mais seguro que por nome.
    grupos.forEach((grupoOriginal, index) => {
      const inserido = gruposInseridos?.[index]
      if (inserido) mapaGrupoIds.set(grupoOriginal.id, inserido.id)
    })
  }

  if (itens.length > 0) {
    const { error: erroInsertItens } = await supabase.from('itens_licitacao').insert(
      itens.map((item) => ({
        licitacao_id: licitacaoId,
        grupo_id: item.grupoId ? mapaGrupoIds.get(item.grupoId) ?? null : null,
        numero: item.numero,
        descricao: item.descricao,
        unidade_medida: item.unidadeMedida,
        quantidade: item.quantidade,
        preco_referencia: item.precoReferencia,
        exclusivo_me_epp: item.exclusivoMeEpp,
        proposta_codigo_interno: item.propostaCliente?.codigoInterno || null,
        proposta_marca: item.propostaCliente?.marca || null,
        proposta_modelo: item.propostaCliente?.modelo || null,
        proposta_quantidade_ofertada: item.propostaCliente?.quantidadeOfertada ?? null,
        proposta_valor_inicial: item.propostaCliente?.valorInicial ?? null,
        proposta_preco_minimo: item.propostaCliente?.precoMinimo ?? null,
      }))
    )
    if (erroInsertItens) throw new Error(erroInsertItens.message)
  }
}

async function buscarGruposEItens(licitacaoId: string): Promise<{ grupos: GrupoRow[]; itens: ItemRow[] }> {
  const [{ data: grupos, error: erroGrupos }, { data: itens, error: erroItens }] = await Promise.all([
    supabase.from('grupos_itens_licitacao').select('*').eq('licitacao_id', licitacaoId),
    supabase.from('itens_licitacao').select('*').eq('licitacao_id', licitacaoId).order('numero'),
  ])
  if (erroGrupos) throw new Error(erroGrupos.message)
  if (erroItens) throw new Error(erroItens.message)
  return { grupos: (grupos as GrupoRow[]) ?? [], itens: (itens as ItemRow[]) ?? [] }
}

async function buscarHistorico(licitacaoId: string): Promise<HistoricoRow[]> {
  const { data, error } = await supabase
    .from('historico_acoes')
    .select('id, data, usuario, descricao')
    .eq('entidade_tipo', 'licitacao')
    .eq('entidade_id', licitacaoId)
    .order('data', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as HistoricoRow[]) ?? []
}

async function registrarHistorico(licitacaoId: string, descricao: string, usuario: string) {
  const { error } = await supabase.from('historico_acoes').insert({
    entidade_tipo: 'licitacao',
    entidade_id: licitacaoId,
    descricao,
    usuario,
  })
  if (error) throw new Error(error.message)
}

/** Aplica a restrição de permissões (carteira do funcionário) via filtro
 *  OR no próprio Supabase, em vez de trazer tudo e filtrar no cliente.
 *  Genérico em vez de tipado contra o builder do supabase-js diretamente
 *  (que exige o Database completo gerado) — só exige que o objeto tenha
 *  um método .or() que devolve o mesmo tipo, que é o suficiente aqui. */
function aplicarRestricaoPermissao<T extends { or: (filters: string) => T }>(
  query: T,
  clienteIds?: string[],
  licitacaoIds?: string[]
): T {
  if (!clienteIds && !licitacaoIds) return query
  const condicoes: string[] = []
  if (clienteIds && clienteIds.length > 0) {
    condicoes.push(`cliente_id.in.(${clienteIds.join(',')})`)
  }
  if (licitacaoIds && licitacaoIds.length > 0) {
    condicoes.push(`id.in.(${licitacaoIds.join(',')})`)
  }
  if (condicoes.length === 0) return query
  return query.or(condicoes.join(','))
}

export const licitacaoService = {
  async listar(filtro: FiltroLicitacoes = {}): Promise<ResultadoPaginado<Licitacao>> {
    const { busca = '', status = '', page = 1, pageSize = 10, clienteIds, licitacaoIds } = filtro
    const inicio = (page - 1) * pageSize
    const fim = inicio + pageSize - 1

    let query = supabase
      .from('licitacoes')
      .select('*', { count: 'exact' })
      .order('data_licitacao', { ascending: true })

    query = aplicarRestricaoPermissao(query, clienteIds, licitacaoIds)

    if (status) query = query.eq('status', status)

    const termo = busca.trim()
    if (termo) {
      query = query.or(
        `numero_pregao.ilike.%${termo}%,orgao.ilike.%${termo}%,objeto.ilike.%${termo}%`
      )
    }

    const { data, error, count } = await query.range(inicio, fim)
    if (error) throw new Error(error.message)

    const linhas = data as LicitacaoRow[]
    const itens = linhas.map((row) => paraLicitacao(row))

    return { itens, total: count ?? 0, page, pageSize }
  },

  // Usado pelo Portal do Cliente: todas as licitações de um cliente
  // específico, sem paginação, mais recentes primeiro.
  async listarPorCliente(clienteId: string): Promise<Licitacao[]> {
    const { data, error } = await supabase
      .from('licitacoes')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('criado_em', { ascending: false })
    if (error) throw new Error(error.message)
    return ((data as LicitacaoRow[]) ?? []).map((row) => paraLicitacao(row))
  },

  // Todas as licitações ainda em andamento (exclui 'ganho'/'perdido'), sem
  // paginação, ordenadas pela sessão mais próxima primeiro.
  async listarAtivas(restricao: { clienteIds?: string[]; licitacaoIds?: string[] } = {}): Promise<Licitacao[]> {
    let query = supabase.from('licitacoes').select('*').not('status', 'in', '(ganho,perdido)')
    query = aplicarRestricaoPermissao(query, restricao.clienteIds, restricao.licitacaoIds)
    const { data, error } = await query.order('data_licitacao', { ascending: true })
    if (error) throw new Error(error.message)
    return ((data as LicitacaoRow[]) ?? []).map((row) => paraLicitacao(row))
  },

  async buscarPorId(id: string): Promise<Licitacao | null> {
    const { data, error } = await supabase.from('licitacoes').select('*').eq('id', id).maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return null

    const row = data as LicitacaoRow
    const [{ grupos, itens }, historico] = await Promise.all([
      buscarGruposEItens(id),
      buscarHistorico(id),
    ])
    return paraLicitacao(row, grupos, itens, historico)
  },

  async criar(dados: LicitacaoFormData, usuario: string): Promise<Licitacao> {
    const { data, error } = await supabase
      .from('licitacoes')
      .insert(paraColunasLicitacao(dados))
      .select()
      .single()
    if (error) throw new Error(error.message)

    const row = data as LicitacaoRow
    await substituirGruposEItens(row.id, dados.grupos, dados.itens)
    await registrarHistorico(row.id, 'Licitação cadastrada no sistema', usuario)

    const [{ grupos, itens }, historico] = await Promise.all([
      buscarGruposEItens(row.id),
      buscarHistorico(row.id),
    ])
    return paraLicitacao(row, grupos, itens, historico)
  },

  async atualizar(id: string, dados: Partial<LicitacaoFormData>, usuario: string): Promise<Licitacao> {
    // Precisa do registro completo antes, já que dados pode ser parcial
    // (atualizarStatus/registrarDecisaoCliente chamam com poucos campos).
    const atual = await this.buscarPorId(id)
    if (!atual) throw new Error('Licitação não encontrada')

    const mesclado: LicitacaoFormData = { ...atual, ...dados }

    const { data, error } = await supabase
      .from('licitacoes')
      .update(paraColunasLicitacao(mesclado))
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)

    // Só reescreve grupos/itens se eles vieram explicitamente no payload —
    // chamadas parciais (ex: atualizarStatus) não devem apagar os itens.
    if (dados.grupos !== undefined || dados.itens !== undefined) {
      await substituirGruposEItens(id, mesclado.grupos, mesclado.itens)
    }

    await registrarHistorico(id, 'Dados da licitação atualizados', usuario)

    const row = data as LicitacaoRow
    const [{ grupos, itens }, historico] = await Promise.all([
      buscarGruposEItens(id),
      buscarHistorico(id),
    ])
    return paraLicitacao(row, grupos, itens, historico)
  },

  async atualizarStatus(id: string, status: StatusLicitacao, usuario: string): Promise<Licitacao> {
    return this.atualizar(id, { status }, usuario)
  },

  // Chamado pelo Portal do Cliente (spec 2.3 / 6.2 — botões "Quero Participar" / "Não vou participar").
  async registrarDecisaoCliente(
    id: string,
    decisao: 'participar' | 'recusar',
    nomeCliente: string,
    opcoes: { motivoRecusa?: string; cobrarFrete?: boolean; percentualFrete?: number } = {}
  ): Promise<Licitacao> {
    const agora = new Date().toISOString()
    const descricao =
      decisao === 'participar'
        ? 'Cliente confirmou participação nesta licitação'
        : `Cliente recusou participar${opcoes.motivoRecusa ? ` — motivo: ${opcoes.motivoRecusa}` : ''}`

    const atualizada = await this.atualizar(
      id,
      {
        decisaoCliente: decisao,
        decisaoClienteEm: agora,
        motivoRecusaCliente: decisao === 'recusar' ? opcoes.motivoRecusa : undefined,
        cobrarFrete: opcoes.cobrarFrete ?? false,
        percentualFrete: opcoes.cobrarFrete ? opcoes.percentualFrete : undefined,
      },
      nomeCliente
    )

    // registrarHistorico já rodou dentro de atualizar() com uma mensagem
    // genérica — aqui sobrescrevemos a última entrada com uma descrição
    // mais específica dessa ação.
    const historico = await buscarHistorico(id)
    if (historico.length > 0) {
      await supabase.from('historico_acoes').update({ descricao }).eq('id', historico[0].id)
    }

    return atualizada
  },

  // Chamado pelo Portal do Cliente ao clicar "Quero Participar" — salva a
  // proposta preenchida por item (quantidade ofertada, valor inicial,
  // valor mínimo, marca, modelo). Diferente de criar()/atualizar(), aqui
  // os itens NÃO são apagados e reinseridos — só os campos proposta_* de
  // cada linha já existente são atualizados, preservando o id do item.
  async registrarPropostaCliente(
    licitacaoId: string,
    itens: Array<{ id: string; propostaCliente: PropostaClienteItem }>
  ): Promise<void> {
    await Promise.all(
      itens.map(({ id, propostaCliente }) =>
        supabase
          .from('itens_licitacao')
          .update({
            proposta_marca: propostaCliente.marca || null,
            proposta_modelo: propostaCliente.modelo || null,
            proposta_quantidade_ofertada: propostaCliente.quantidadeOfertada ?? null,
            proposta_valor_inicial: propostaCliente.valorInicial ?? null,
            proposta_preco_minimo: propostaCliente.precoMinimo ?? null,
          })
          .eq('id', id)
          .eq('licitacao_id', licitacaoId)
      )
    ).then((resultados) => {
      const erro = resultados.find((r) => r.error)?.error
      if (erro) throw new Error(erro.message)
    })
  },

  async excluir(id: string): Promise<void> {
    const { error } = await supabase.from('licitacoes').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },
}
