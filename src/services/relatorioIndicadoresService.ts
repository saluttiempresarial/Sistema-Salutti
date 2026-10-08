// src/services/relatorioIndicadoresService.ts
//
// Carrega, de uma só vez, os dados base dos Indicadores (licitações com
// itens, disputas com resultados, famílias e clientes). Os números em si são
// calculados em utils/indicadoresCalculos.ts. O acesso respeita o RLS: cada
// perfil só recebe as linhas que pode ver.

import { licitacaoService } from './licitacaoService'
import { disputaService } from './disputaService'
import { familiaProdutoService } from './familiaProdutoService'
import { clienteService } from './clienteService'
import type { DadosBaseIndicadores } from '../types/indicadores'

async function carregarDadosBase(restricao: { clienteIds?: string[]; licitacaoIds?: string[] } = {}): Promise<DadosBaseIndicadores> {
  const [licitacoes, disputas, familias, clientes] = await Promise.all([
    licitacaoService.listarCompletas(restricao),
    disputaService.listarTodas(),
    familiaProdutoService.listarTodas(),
    clienteService.list({ page: 1, pageSize: 500 }),
  ])

  return {
    licitacoes,
    disputas,
    familias,
    clientes: clientes.data.map((c) => ({
      id: c.id,
      nome: c.empresa.nomeFantasia || c.empresa.razaoSocial,
    })),
  }
}

export const relatorioIndicadoresService = { carregarDadosBase }
