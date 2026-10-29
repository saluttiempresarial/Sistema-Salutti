// src/utils/descricaoFiltrosIndicadores.ts
//
// Texto dos filtros ativos do painel de Indicadores, para o cabeçalho da
// impressão (e, na próxima etapa, para a aba "Filtros aplicados" do Excel).
// Só descreve; não calcula nada.

import { MODALIDADE_LICITACAO_LABEL } from '../types/licitacao'
import type { ModalidadeLicitacao } from '../types/licitacao'
import { ESFERA_LICITACAO_LABEL } from '../types/licitacao'
import type { EsferaLicitacao } from '../types/licitacao'
import {
  FILTRO_SEM_ESFERA,
  FILTRO_SEM_FAMILIA,
  ROTULO_RESULTADO_LICITACAO,
  type ClienteResumo,
  type FasePipeline,
  type FiltrosIndicadores,
  type OpcaoFiltro,
} from '../types/indicadores'
import type { FamiliaProduto } from '../services/familiaProdutoService'

const ROTULO_FASE: Record<FasePipeline, string> = {
  aguardando_cliente: 'Aguardando o cliente',
  sem_decisao: 'Sessão passou sem decisão',
  proposta: 'Proposta em preparo',
  em_disputa: 'Em disputa',
  finalizada: 'Finalizadas',
  recusada: 'Recusadas pelo cliente',
}

function dataBR(iso: string): string {
  const [a, m, d] = iso.split('-')
  return a && m && d ? `${d}/${m}/${a}` : iso
}

export interface ContextoDescricaoFiltros {
  clientes: ClienteResumo[]
  familias: FamiliaProduto[]
  orgaos: OpcaoFiltro[]
  marcas: OpcaoFiltro[]
  analistas: OpcaoFiltro[]
}

/** Lista "Rótulo: valor" dos filtros ativos, na ordem da barra de filtros. */
export function descreverFiltros(filtros: FiltrosIndicadores, ctx: ContextoDescricaoFiltros): string[] {
  const linhas: string[] = []

  if (filtros.dataDe || filtros.dataAte) {
    const de = filtros.dataDe ? dataBR(filtros.dataDe) : 'início'
    const ate = filtros.dataAte ? dataBR(filtros.dataAte) : 'hoje'
    linhas.push(`Período da sessão: de ${de} até ${ate}`)
  } else {
    linhas.push('Período da sessão: todo o período')
  }

  if (filtros.clienteId) {
    linhas.push(`Cliente: ${ctx.clientes.find((c) => c.id === filtros.clienteId)?.nome ?? '—'}`)
  }
  if (filtros.analistaId) {
    linhas.push(`Analista: ${ctx.analistas.find((a) => a.value === filtros.analistaId)?.label ?? '—'}`)
  }
  if (filtros.modalidade) {
    linhas.push(`Modalidade: ${MODALIDADE_LICITACAO_LABEL[filtros.modalidade as ModalidadeLicitacao] ?? filtros.modalidade}`)
  }
  if (filtros.familiaId) {
    const nome =
      filtros.familiaId === FILTRO_SEM_FAMILIA
        ? 'Sem família'
        : (ctx.familias.find((f) => f.id === filtros.familiaId)?.nome ?? '—')
    linhas.push(`Família: ${nome}`)
  }
  if (filtros.orgao) {
    linhas.push(`Órgão: ${ctx.orgaos.find((o) => o.value === filtros.orgao)?.label ?? filtros.orgao}`)
  }
  if (filtros.uf) linhas.push(`UF: ${filtros.uf}`)
  if (filtros.esfera) {
    linhas.push(
      `Esfera: ${
        filtros.esfera === FILTRO_SEM_ESFERA
          ? 'Não informada'
          : (ESFERA_LICITACAO_LABEL[filtros.esfera as EsferaLicitacao] ?? filtros.esfera)
      }`,
    )
  }
  if (filtros.marca) {
    linhas.push(`Marca: ${ctx.marcas.find((m) => m.value === filtros.marca)?.label ?? filtros.marca}`)
  }
  if (filtros.resultado) linhas.push(`Resultado da licitação: ${ROTULO_RESULTADO_LICITACAO[filtros.resultado]}`)
  if (filtros.fase) linhas.push(`Status: ${ROTULO_FASE[filtros.fase]}`)

  linhas.push(
    filtros.incluirProvisorios
      ? 'Resultados: definitivos e provisórios (em análise)'
      : 'Resultados: somente definitivos (disputa homologada)',
  )
  return linhas
}
