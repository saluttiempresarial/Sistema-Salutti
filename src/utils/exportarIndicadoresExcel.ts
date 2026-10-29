// src/utils/exportarIndicadoresExcel.ts
//
// Baixa em Excel os Indicadores que estão na tela: a aba "Filtros aplicados" e uma
// aba por card VISÍVEL. A regra de visibilidade é a mesma do painel (liberação do
// perfil, filtro de resultado, "Clientes sem atividade" e "Performance por analista"),
// então ninguém baixa o que não vê. Cards sem dados não geram aba.

import * as XLSX from 'xlsx'
import { CARDS_OCULTOS_POR_RESULTADO } from '../components/indicadores/IndicadoresGraficos'
import type { ChaveIndicador } from '../components/indicadores/IndicadoresGraficos'
import { SITUACAO_INATIVIDADE_LABEL } from '../types/indicadores'
import type { IndicadoresAdmin, ResultadoLicitacaoFiltro } from '../types/indicadores'
import { MOTIVO_PERDA_EVITAVEL_LABEL } from '../types/disputa'

type Tipo = 'txt' | 'int' | 'brl' | 'pct' | 'dec'
type Celula = string | number | null | undefined

interface Bloco {
  titulo?: string
  cabecalho: string[]
  tipos: Tipo[]
  linhas: Celula[][]
}

interface Aba {
  nome: string
  blocos: Bloco[]
}

export interface OpcoesExportacaoIndicadores {
  indicadores: IndicadoresAdmin
  visiveis?: ReadonlySet<string>
  ocultarVazios: boolean
  ocultarClientesSemAtividade: boolean
  resultadoFiltro?: ResultadoLicitacaoFiltro
  linhasFiltros: string[]
  emitidoPor: string
}

const FORMATOS: Record<Tipo, string | undefined> = {
  txt: undefined,
  int: '#,##0',
  brl: '"R$" #,##0.00',
  pct: '0.0"%"',
  dec: '#,##0.0',
}

function data(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString('pt-BR')
}

function dia(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString('pt-BR')
}

function bloco(titulo: string | undefined, colunas: Array<[string, Tipo]>, linhas: Celula[][]): Bloco {
  return { titulo, cabecalho: colunas.map((c) => c[0]), tipos: colunas.map((c) => c[1]), linhas }
}

/** Pares "Indicador / Valor" (resumos). */
function resumo(titulo: string | undefined, pares: Array<[string, Celula, Tipo]>): Bloco {
  return {
    titulo,
    cabecalho: ['Indicador', 'Valor'],
    tipos: ['txt', 'txt'],
    // O tipo vale por linha: guardamos o formato junto do número (ver montarPlanilha).
    linhas: pares.map(([rotulo, valor, tipo]) => [rotulo, valor, tipo]),
  }
}

function nomeAba(nome: string, usados: Set<string>): string {
  const base = nome.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31).trim() || 'Aba'
  let final = base
  let n = 2
  while (usados.has(final.toLowerCase())) {
    const sufixo = ` ${n++}`
    final = base.slice(0, 31 - sufixo.length) + sufixo
  }
  usados.add(final.toLowerCase())
  return final
}

function montarPlanilha(aba: Aba): XLSX.WorkSheet {
  const matriz: Celula[][] = []
  const formatos: Array<{ r: number; c: number; z: string }> = []
  const larguras: number[] = []
  const medir = (c: number, v: Celula) => {
    const t = v === null || v === undefined ? 0 : String(v).length
    larguras[c] = Math.min(Math.max(larguras[c] ?? 10, t + 2), 60)
  }
  aba.blocos.forEach((b, i) => {
    if (i > 0) matriz.push([])
    if (b.titulo) matriz.push([b.titulo.toUpperCase()])
    matriz.push(b.cabecalho)
    b.cabecalho.forEach((h, c) => medir(c, h))
    const ehResumo = b.cabecalho.length === 2 && b.cabecalho[0] === 'Indicador' && b.cabecalho[1] === 'Valor'
    for (const linha of b.linhas) {
      const r = matriz.length
      if (ehResumo) {
        matriz.push([linha[0], linha[1]])
        const fmt = FORMATOS[(linha[2] as Tipo) ?? 'txt']
        if (fmt && typeof linha[1] === 'number') formatos.push({ r, c: 1, z: fmt })
        medir(0, linha[0])
        medir(1, linha[1])
      } else {
        matriz.push(linha.map((v) => (v === undefined ? null : v)))
        linha.forEach((v, c) => {
          const fmt = FORMATOS[b.tipos[c] ?? 'txt']
          if (fmt && typeof v === 'number') formatos.push({ r, c, z: fmt })
          medir(c, v)
        })
      }
    }
  })
  const ws = XLSX.utils.aoa_to_sheet(matriz)
  for (const f of formatos) {
    const cel = ws[XLSX.utils.encode_cell({ r: f.r, c: f.c })]
    if (cel) cel.z = f.z
  }
  ws['!cols'] = larguras.map((w) => ({ wch: w }))
  return ws
}

function dadosDasAbas(op: OpcoesExportacaoIndicadores): Aba[] {
  const { indicadores: i, visiveis, resultadoFiltro } = op
  const ocultosPorResultado = resultadoFiltro ? CARDS_OCULTOS_POR_RESULTADO[resultadoFiltro] : undefined
  const ver = (chave: ChaveIndicador) => (!visiveis || visiveis.has(chave)) && !ocultosPorResultado?.has(chave)
  const abas: Aba[] = []
  const add = (nome: string, ...blocos: Bloco[]) => {
    const comDados = blocos.filter((b) => b.linhas.length > 0)
    if (comDados.length > 0) abas.push({ nome, blocos: comDados })
  }

  if (ver('funil')) {
    const r = i.relatorioPrincipal
    add(
      'Relatório principal',
      resumo(undefined, [
        ['Licitações cadastradas', r.cadastradas, 'int'],
        ['Em preparação (não liberadas)', r.emPreparacao, 'int'],
        ['Enviadas ao cliente', r.enviadas, 'int'],
        ['Retornadas pelo cliente', r.retornadas, 'int'],
        ['Sem retorno', r.semRetorno, 'int'],
        ['Não participação (total)', r.naoParticipacao, 'int'],
        ['  por recusa do cliente', r.naoParticipacaoRecusa, 'int'],
        ['  por bloqueio do sistema', r.naoParticipacaoBloqueio, 'int'],
        ['Participou', r.participou, 'int'],
        ['Arrematadas em análise', r.arrematadasEmAnalise, 'int'],
        ['Perdidas em análise', r.perdidasEmAnalise, 'int'],
        ['Ganhas (homologadas)', r.ganhas, 'int'],
        ['Perdidas (homologadas)', r.perdidas, 'int'],
        ['Aguardando resultado', r.aguardandoResultado, 'int'],
      ]),
      bloco('Funil', [['Etapa', 'txt'], ['Quantidade', 'int']], i.funil.map((e) => [e.rotulo, e.quantidade])),
    )
  }

  if (ver('taxa_vitoria')) {
    const t = i.taxaVitoria.atual
    add(
      'Taxa de vitória',
      resumo(undefined, [
        ['Itens/grupos ganhos', t.ganhos, 'int'],
        ['Itens/grupos perdidos', t.perdidos, 'int'],
        ['Taxa por quantidade', t.percentualQuantidade, 'pct'],
        ['Taxa por valor', t.percentualValor, 'pct'],
        ['Valor adjudicado', t.valorAdjudicado, 'brl'],
        ['Valor disputado', t.valorDisputado, 'brl'],
        ['Participações para cada vitória', t.umACada, 'dec'],
      ]),
      bloco(
        'Mês a mês',
        [['Mês', 'txt'], ['Ganhos', 'int'], ['Perdidos', 'int'], ['Taxa por quantidade', 'pct'], ['Taxa por valor', 'pct']],
        i.taxaVitoriaPorMes.map((m) => [m.rotulo, m.ganhos, m.perdidos, m.percentualQuantidade, m.percentualValor]),
      ),
    )
  }

  if (ver('volume_periodo')) {
    add(
      'Volume por mês',
      bloco(undefined, [['Mês', 'txt'], ['Licitações', 'int'], ['Valor de referência', 'brl']], i.volumePorMes.map((m) => [m.rotulo, m.licitacoes, m.valor])),
    )
  }

  if (ver('pipeline')) {
    add(
      'Pipeline',
      bloco(
        undefined,
        [['Fase', 'txt'], ['Licitações', 'int'], ['Valor de referência', 'brl'], ['Ganhas', 'int'], ['Perdidas', 'int']],
        i.pipeline.etapas.map((e) => [e.rotulo, e.quantidade, e.valorReferencia, e.ganhas ?? null, e.perdidas ?? null]),
      ),
    )
  }

  if (ver('prazos_proximos')) {
    add(
      'Prazos próximos',
      bloco(
        undefined,
        [['Cliente', 'txt'], ['Pregão', 'txt'], ['Órgão', 'txt'], ['Sessão', 'txt'], ['Prazo interno', 'txt'], ['Urgência', 'txt'], ['Decisão do cliente', 'txt']],
        i.prazosProximos.linhas.map((p) => [p.clienteNome, p.numeroPregao, p.orgao, data(p.dataSessao), data(p.prazoInterno), String(p.urgencia), p.decisaoCliente]),
      ),
    )
  }

  if (ver('tempo_resposta')) {
    const t = i.tempoResposta
    const cols: Array<[string, Tipo]> = [['Nome', 'txt'], ['Mediana (dias úteis)', 'dec'], ['Média (dias úteis)', 'dec'], ['Licitações', 'int']]
    add(
      'Tempos de resposta',
      resumo('Resposta do cliente (dias úteis)', [
        ['Licitações com decisão', t.quantidade, 'int'],
        ['Mediana', t.medianaDias, 'dec'],
        ['Média', t.mediaDias, 'dec'],
        ['Aguardando decisão', t.aguardando, 'int'],
        ['Antecedência da liberação até a sessão (mediana)', t.envio.antecedencia.medianaDias, 'dec'],
        ['Janela do cliente (mediana)', t.envio.janelaCliente.medianaDias, 'dec'],
        ['Licitações com janela curta (menos de 2 dias úteis)', t.envio.janelaCurta, 'int'],
      ]),
      bloco('Por cliente', cols, t.porCliente.map((c) => [c.nome, c.medianaDias, c.mediaDias, c.quantidade])),
      // Ranking por analista: só o Administrador (sem lista de liberação).
      bloco('Por analista', cols, !visiveis ? t.porAnalista.map((c) => [c.nome, c.medianaDias, c.mediaDias, c.quantidade]) : []),
    )
  }

  if (ver('clientes_sem_atividade') && !op.ocultarClientesSemAtividade) {
    add(
      'Clientes sem atividade',
      bloco(
        undefined,
        [['Cliente', 'txt'], ['Situação', 'txt'], ['Nível', 'int'], ['Dias da situação', 'int'], ['Dias desde a última atividade', 'int'], ['Último envio', 'txt'], ['Última resposta', 'txt'], ['Última participação', 'txt'], ['Valor adjudicado', 'brl'], ['Ação sugerida', 'txt']],
        i.clientesSemAtividade.linhas.map((c) => [
          c.nome,
          SITUACAO_INATIVIDADE_LABEL[c.situacao].nome,
          c.nivel,
          c.diasDaSituacao,
          c.dias,
          dia(c.ultimoEnvio),
          dia(c.ultimaResposta),
          dia(c.ultimaParticipacao),
          c.valorAdjudicado,
          SITUACAO_INATIVIDADE_LABEL[c.situacao].acao,
        ]),
      ),
    )
  }

  if (ver('valor_por_cliente')) {
    add(
      'Valor por cliente',
      bloco(
        undefined,
        [['Cliente', 'txt'], ['Em disputa', 'brl'], ['Adjudicado', 'brl'], ['Licitações ganhas', 'int'], ['Enviadas', 'int'], ['Participações', 'int'], ['Taxa de vitória', 'pct'], ['Ganho sobre o mínimo', 'pct'], ['Valor da carteira', 'brl'], ['Peso na carteira', 'pct']],
        i.valorPorCliente.map((c) => [c.nome, c.valorEmDisputa, c.valorAdjudicado, c.licitacoesGanhas, c.enviadas, c.participacoes, c.taxaVitoria, c.ganhoSobreMinimo, c.valorCarteira, c.pesoCarteira]),
      ),
      bloco(
        'Carteira por segmento',
        [['Segmento', 'txt'], ['Valor', 'brl'], ['Percentual', 'pct'], ['Licitações', 'int']],
        i.concentracaoCarteira.porSegmento.map((s) => [s.nome, s.valor, s.percentual, s.licitacoes]),
      ),
    )
  }

  // Quadro por analista: exige linhas e só existe para o Administrador.
  if (ver('performance_analista')) {
    const linhas = op.ocultarVazios ? i.performanceAnalistas.filter((a) => a.licitacoes > 0) : i.performanceAnalistas
    add(
      'Performance por analista',
      bloco(
        undefined,
        [['Analista', 'txt'], ['Clientes', 'int'], ['Licitações', 'int'], ['Enviadas', 'int'], ['Participações', 'int'], ['Ganhos', 'int'], ['Perdidos', 'int'], ['Taxa de vitória', 'pct'], ['Valor adjudicado', 'brl'], ['Perdas evitáveis', 'int'], ['Valor das perdas evitáveis', 'brl']],
        linhas.map((a) => [a.nome, a.clientes, a.licitacoes, a.enviadas, a.participacoes, a.ganhos, a.perdidos, a.taxaVitoria, a.valorAdjudicado, a.perdasEvitaveis, a.valorPerdasEvitaveis]),
      ),
    )
  }

  if (ver('desempenho_modalidade')) {
    add(
      'Modalidade',
      bloco(undefined, [['Modalidade', 'txt'], ['Licitações', 'int'], ['Participou', 'int'], ['Ganhou', 'int'], ['Taxa', 'pct']], i.desempenhoModalidade.map((m) => [m.nome, m.licitacoes, m.participou, m.ganhou, m.taxa])),
    )
  }

  if (ver('mercado_uf_esfera')) {
    const cols = (primeira: string): Array<[string, Tipo]> => [[primeira, 'txt'], ['Licitações', 'int'], ['Participou', 'int'], ['Ganhou', 'int'], ['Taxa', 'pct']]
    add(
      'Mercado UF e esfera',
      bloco('Por UF', cols('UF'), i.mercadoUfEsfera.porUf.map((t) => [t.nome, t.licitacoes, t.participou, t.ganhou, t.taxa])),
      bloco('Por esfera', cols('Esfera'), i.mercadoUfEsfera.porEsfera.map((t) => [t.nome, t.licitacoes, t.participou, t.ganhou, t.taxa])),
    )
  }

  if (ver('motivos_nao_participacao')) {
    const m = i.motivosNaoParticipacao
    add(
      'Motivos de não participação',
      resumo(undefined, [
        ['Licitações sem participação', m.total, 'int'],
        ['Valor de referência descartado', m.valorReferenciaDescartado, 'brl'],
        ['Sem resposta (quantidade)', m.semResposta.quantidade, 'int'],
        ['Sem resposta (valor de referência)', m.semResposta.valorReferencia, 'brl'],
        ['Recusas decididas pelo cliente', m.recusasCliente, 'int'],
        ['"Outro" sobre as recusas', m.percentualOutro, 'pct'],
        ['Falha de triagem sobre as recusas', m.percentualTriagem, 'pct'],
      ]),
      bloco('Por motivo', [['Motivo', 'txt'], ['Grupo', 'txt'], ['Origem', 'txt'], ['Quantidade', 'int'], ['Percentual', 'pct']], m.motivos.map((x) => [x.nome, String(x.grupo), x.origem === 'cliente' ? 'Cliente' : 'Sistema', x.quantidade, x.percentual])),
      bloco('Por grupo', [['Grupo', 'txt'], ['Quantidade', 'int'], ['Percentual', 'pct']], m.porGrupo.map((g) => [g.nome, g.quantidade, g.percentual])),
      bloco('Textos digitados em "Outro"', [['Pregão', 'txt'], ['Cliente', 'txt'], ['Texto', 'txt']], m.textosOutro.map((t) => [t.numeroPregao, t.cliente, t.texto])),
    )
  }

  if (ver('familias')) {
    add('Famílias', bloco(undefined, [['Família', 'txt'], ['Itens cotados', 'int'], ['Itens ganhos', 'int']], i.familias.map((f) => [f.nome, f.cotadas, f.ganhas])))
  }

  if (ver('ganho_sobre_minimo')) {
    const g = i.ganhoSobreMinimo
    add(
      'Ganho sobre o mínimo',
      resumo(undefined, [
        ['Ganho sobre o mínimo (geral)', g.geral, 'pct'],
        ['Valor ganho acima do mínimo', g.valorGanho, 'brl'],
        ['Valor fechado', g.valorFechado, 'brl'],
        ['Itens no limite', g.faixas.noLimite, 'int'],
        ['Itens saudáveis', g.faixas.saudavel, 'int'],
        ['Itens fortes', g.faixas.forte, 'int'],
        ['Ganhos sem mínimo informado', g.semMinimo, 'int'],
      ]),
      bloco('Por família', [['Família', 'txt'], ['Percentual', 'pct'], ['Quantidade', 'int']], g.porFamilia.map((f) => [f.nome, f.percentual, f.quantidade])),
      bloco('Por marca', [['Marca', 'txt'], ['Percentual', 'pct'], ['Valor ganho', 'brl'], ['Quantidade', 'int']], g.porMarca.map((m) => [m.nome, m.percentual, m.valorGanho, m.quantidade])),
    )
  }

  if (ver('taxa_vitoria_familia')) {
    const t = i.taxaVitoriaFamilia
    add(
      'Taxa por família',
      resumo(undefined, [['Taxa geral', t.geral, 'pct'], ['Ganhos', t.ganhos, 'int'], ['Disputados', t.disputados, 'int']]),
      bloco(
        'Por família',
        [['Família', 'txt'], ['Ganhos', 'int'], ['Disputados', 'int'], ['Taxa por quantidade', 'pct'], ['Taxa por valor', 'pct'], ['Ganho sobre o mínimo', 'pct'], ['Amostra pequena', 'txt'], ['Leitura', 'txt']],
        t.porFamilia.map((f) => [f.nome, f.ganhos, f.disputados, f.percentual, f.percentualValor, f.ganhoSobreMinimo, f.amostraPequena ? 'Sim' : 'Não', f.leitura ?? '']),
      ),
    )
  }

  if (ver('marcas')) {
    add(
      'Marcas',
      bloco(undefined, [['Marca', 'txt'], ['Cotadas', 'int'], ['Ganhas', 'int']], i.marcas.map((m) => [m.nome, m.cotadas, m.ganhas])),
      bloco(
        'Categorias de serviço',
        [['Categoria', 'txt'], ['Cotadas', 'int'], ['Ganhas', 'int']],
        i.categoriasServico.map((c) => [c.nome, c.cotadas, c.ganhas]),
      ),
    )
  }

  if (ver('perdas_evitaveis')) {
    const p = i.perdasEvitaveis
    add(
      'Perdas evitáveis',
      bloco(
        undefined,
        [['Pregão', 'txt'], ['Cliente', 'txt'], ['Item/grupo', 'txt'], ['Grupo', 'txt'], ['Nosso valor', 'brl'], ['Valor do vencedor', 'brl'], ['Mínimo do cliente', 'brl'], ['Vencedor', 'txt'], ['Motivo', 'txt']],
        p.linhas.map((l) => [l.numeroPregao, l.cliente, l.rotulo, l.ehGrupo ? 'Sim' : 'Não', l.valorNosso, l.valorVencedor, l.valorMinimo, l.nomeVencedor, l.motivo ? MOTIVO_PERDA_EVITAVEL_LABEL[l.motivo] ?? String(l.motivo) : '']),
      ),
      bloco('Por motivo', [['Motivo', 'txt'], ['Quantidade', 'int'], ['Valor do vencedor', 'brl']], p.porMotivo.map((m) => [m.nome, m.quantidade, m.valorVencedor])),
      bloco('Por analista', [['Analista', 'txt'], ['Quantidade', 'int'], ['Valor do vencedor', 'brl']], !visiveis ? (p.porAnalista ?? []).map((a) => [a.nome, a.quantidade, a.valorVencedor]) : []),
    )
  }

  if (ver('perdas_habilitacao')) {
    const p = i.perdasHabilitacao
    add(
      'Perdas na habilitação',
      resumo(undefined, [['Quantidade', p.quantidade, 'int'], ['Valor perdido', p.valorPerdido, 'brl']]),
      bloco('Por origem', [['Origem', 'txt'], ['Quantidade', 'int'], ['Valor', 'brl']], p.porOrigem.map((o) => [o.origem, o.quantidade, o.valor])),
      bloco(
        'Detalhe',
        [['Pregão', 'txt'], ['Órgão', 'txt'], ['Cliente', 'txt'], ['Item/grupo', 'txt'], ['Valor', 'brl'], ['Etapa', 'txt'], ['Motivo', 'txt'], ['Origem', 'txt'], ['Resultado', 'txt']],
        p.linhas.map((l) => [l.numeroPregao, l.orgao, l.cliente, l.rotulo, l.valor, l.etapa, l.motivo, l.origem, l.definitiva ? 'Definitivo' : 'Provisório']),
      ),
    )
  }

  if (ver('vitorias_convocacao')) {
    add(
      'Vitórias por convocação',
      bloco(
        undefined,
        [['Pregão', 'txt'], ['Órgão', 'txt'], ['Cliente', 'txt'], ['Item/grupo', 'txt'], ['Valor', 'brl'], ['Resultado', 'txt']],
        i.vitoriasConvocacao.linhas.map((l) => [l.numeroPregao, l.orgao, l.cliente, l.rotulo, l.valor, l.definitiva ? 'Definitivo' : 'Provisório']),
      ),
    )
  }

  if (ver('alerta_acompanhamento')) {
    add(
      'Alerta de acompanhamento',
      bloco(
        undefined,
        [['Pregão', 'txt'], ['Órgão', 'txt'], ['Cliente', 'txt'], ['Item/grupo', 'txt'], ['Posição', 'int'], ['Nosso valor', 'brl'], ['Valor do vencedor', 'brl'], ['Vencedor', 'txt']],
        i.alertaAcompanhamento.map((l) => [l.numeroPregao, l.orgao, l.cliente, l.rotulo, l.posicao, l.valorNosso, l.valorVencedor, l.nomeVencedor]),
      ),
    )
  }

  if (ver('valor_adjudicado')) {
    add(
      'Valor adjudicado',
      bloco(
        undefined,
        [['Mês', 'txt'], ['Valor', 'brl'], ['Registro de preços (SRP)', 'brl'], ['Convencional', 'brl'], ['Licitações ganhas', 'int']],
        i.valorAdjudicado.porMes.map((m) => [m.rotulo, m.valor, m.valorSrp, m.valorConvencional, m.licitacoesGanhas]),
      ),
      resumo('Total', [['Valor adjudicado total', i.valorAdjudicado.total, 'brl'], ['Licitações ganhas', i.valorAdjudicado.licitacoesGanhas, 'int']]),
    )
  }

  if (ver('ticket_medio')) {
    add(
      'Ticket médio',
      resumo(undefined, [['Ticket médio', i.valorAdjudicado.ticketMedio, 'brl'], ['Valor adjudicado total', i.valorAdjudicado.total, 'brl'], ['Licitações ganhas', i.valorAdjudicado.licitacoesGanhas, 'int']]),
    )
  }

  const pctFam = (nome: string, d: { geral: number | null; quantidade: number; porFamilia: Array<{ nome: string; percentual: number | null; quantidade: number }> }) =>
    add(nome, resumo(undefined, [['Geral', d.geral, 'pct'], ['Itens considerados', d.quantidade, 'int']]), bloco('Por família', [['Família', 'txt'], ['Percentual', 'pct'], ['Quantidade', 'int']], d.porFamilia.map((f) => [f.nome, f.percentual, f.quantidade])))

  if (ver('desconto_medio')) pctFam('Desconto médio', i.descontoMedio)

  if (ver('fora_de_mercado')) {
    const f = i.foraDeMercado
    add(
      'Fora de mercado',
      resumo(undefined, [
        ['Itens fora de mercado', f.quantidade, 'int'],
        ['Base com vencedor identificado', f.baseComVencedor, 'int'],
        ['Percentual', f.percentual, 'pct'],
        ['Distância média', f.distanciaMedia, 'pct'],
        ['Possivelmente inexequíveis', f.possivelmenteInexequiveis, 'int'],
      ]),
      bloco(
        'Detalhe',
        [['Pregão', 'txt'], ['Cliente', 'txt'], ['Item/grupo', 'txt'], ['Nosso valor', 'brl'], ['Valor do vencedor', 'brl'], ['Mínimo do cliente', 'brl'], ['Abaixo do mínimo', 'pct'], ['Possivelmente inexequível', 'txt']],
        f.linhas.map((l) => [l.numeroPregao, l.cliente, l.rotulo, l.valorNosso, l.valorVencedor, l.valorMinimo, l.percentualAbaixo, l.possivelmenteInexequivel ? 'Sim' : 'Não']),
      ),
    )
  }

  if (ver('distancia_derrota')) {
    const d = i.distanciaDerrota
    add(
      'Distância da derrota',
      resumo(undefined, [
        ['Distância média', d.geral, 'pct'],
        ['Perdas consideradas', d.quantidade, 'int'],
        ['Reais acima do vencedor (soma)', d.valorAcima, 'brl'],
        ['Perdas até 3% acima', d.faixas.ate3, 'int'],
        ['Perdas de 3% a 10% acima', d.faixas.de3a10, 'int'],
        ['Perdas acima de 10%', d.faixas.acima10, 'int'],
      ]),
      bloco('Por família', [['Família', 'txt'], ['Percentual', 'pct'], ['Quantidade', 'int']], d.porFamilia.map((f) => [f.nome, f.percentual, f.quantidade])),
      bloco('Por marca', [['Marca', 'txt'], ['Percentual', 'pct'], ['Reais acima', 'brl'], ['Quantidade', 'int']], d.porMarca.map((m) => [m.nome, m.percentual, m.valorAcima, m.quantidade])),
      bloco(
        'Perdas por até 3%',
        [['Pregão', 'txt'], ['Órgão', 'txt'], ['Cliente', 'txt'], ['Item/grupo', 'txt'], ['Nosso valor', 'brl'], ['Valor do vencedor', 'brl'], ['Acima do vencedor', 'pct'], ['Vencedor', 'txt']],
        d.perdasPorPouco.map((l) => [l.numeroPregao, l.orgao, l.cliente, l.rotulo, l.valorNosso, l.valorVencedor, l.percentual, l.nomeVencedor]),
      ),
    )
  }

  if (ver('orgaos')) {
    add(
      'Órgãos',
      bloco(
        undefined,
        [['Órgão', 'txt'], ['CNPJ', 'txt'], ['UASG', 'txt'], ['Licitações', 'int'], ['Participações', 'int'], ['Vitórias', 'int'], ['Taxa de vitória', 'pct'], ['Valor adjudicado', 'brl']],
        i.orgaos.map((o) => [o.orgao, o.cnpj ?? '', o.uasg ?? '', o.licitacoes, o.participacoes, o.vitorias, o.taxaVitoria, o.valorAdjudicado]),
      ),
    )
  }

  if (ver('concorrentes')) {
    add(
      'Concorrentes',
      bloco(
        undefined,
        [['Concorrente', 'txt'], ['CNPJ', 'txt'], ['Vitórias', 'int'], ['Licitações', 'int'], ['Valor total', 'brl'], ['Distância média', 'pct'], ['Famílias em que vence', 'txt']],
        i.concorrentes.map((c) => [c.nome, c.cnpj ?? '', c.vitorias, c.licitacoes, c.valorTotal, c.distanciaMedia, c.familias.map((f) => `${f.nome} (${f.vitorias})`).join('; ')]),
      ),
      bloco(
        'Contra quem perdemos, por família',
        [['Família', 'txt'], ['Perdas', 'int'], ['Concorrentes que mais ganharam de nós', 'txt']],
        i.concorrentesFamilia.map((f) => [f.nome, f.perdas, f.concorrentes.map((c) => `${c.nome} (${c.vitorias})`).join('; ')]),
      ),
    )
  }

  if (ver('produtos_nunca_ganhos')) {
    add(
      'Produtos nunca ganhos',
      resumo(undefined, [['Produtos disputados', i.produtosNuncaGanhos.totalProdutos, 'int'], ['Nunca ganhos', i.produtosNuncaGanhos.quantidade, 'int']]),
      bloco('Produtos', [['Produto', 'txt'], ['Perdas', 'int']], i.produtosNuncaGanhos.linhas.map((p) => [p.nome, p.perdas])),
    )
  }

  return abas
}

/** Gera e baixa o .xlsx. Devolve quantas abas de indicadores foram incluídas. */
export function exportarIndicadoresExcel(op: OpcoesExportacaoIndicadores): number {
  const abas = dadosDasAbas(op)
  const livro = XLSX.utils.book_new()
  const usados = new Set<string>()

  const filtros: Bloco = bloco(
    undefined,
    [['Filtros aplicados', 'txt']],
    [
      [`Emitido em ${new Date().toLocaleString('pt-BR')} por ${op.emitidoPor || '—'}`],
      [`Licitações consideradas: ${op.indicadores.totalLicitacoes}`],
      [],
      ...op.linhasFiltros.map((l) => [l]),
    ],
  )
  XLSX.utils.book_append_sheet(livro, montarPlanilha({ nome: 'Filtros', blocos: [filtros] }), nomeAba('Filtros aplicados', usados))

  for (const aba of abas) {
    XLSX.utils.book_append_sheet(livro, montarPlanilha(aba), nomeAba(aba.nome, usados))
  }
  const hoje = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(livro, `Indicadores Salutti ${hoje}.xlsx`)
  return abas.length
}
