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
import { configuracaoService } from './configuracaoService'
import { funcionarioService } from './funcionarioService'
import { supabase } from '@/lib/supabaseClient'
import type { AnalistaCarteira, DadosBaseIndicadores, ReaberturaDecisao } from '../types/indicadores'

/** Reaberturas de decisão feitas pelo Administrador (histórico das licitações,
 *  gravado pela função reabrir_decisao_cliente, migração 053). Só o
 *  Administrador consegue ler esse histórico; para os demais perfis, ou se a
 *  consulta falhar, devolve undefined e o indicador mostra "indisponível". */
async function carregarReaberturas(): Promise<ReaberturaDecisao[] | undefined> {
  try {
    const { data, error } = await supabase
      .from('historico_acoes')
      .select('entidade_id, data')
      .eq('entidade_tipo', 'licitacao')
      .like('descricao', 'Administrador reabriu a decisão do cliente%')
    if (error || !data) return undefined
    return (data as { entidade_id: string; data: string }[]).map((r) => ({ licitacaoId: r.entidade_id, em: r.data }))
  } catch {
    return undefined
  }
}

/** Analistas ativos que têm clientes vinculados (aba Permissões do Funcionário).
 *  Se não puder ler (ou falhar), devolve undefined e o filtro por analista não aparece. */
async function carregarAnalistas(): Promise<AnalistaCarteira[] | undefined> {
  try {
    const resultado = await funcionarioService.list({ status: 'ativo', page: 1, pageSize: 200 })
    return resultado.data
      .filter((f) => f.permissoes.clientesVinculados.length > 0)
      .map((f) => ({
        id: f.id,
        nome: f.pessoal.nomeCompleto,
        clienteIds: [...f.permissoes.clientesVinculados],
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  } catch {
    return undefined
  }
}

async function carregarDadosBase(restricao: { clienteIds?: string[]; licitacaoIds?: string[] } = {}): Promise<DadosBaseIndicadores> {
  const [licitacoes, disputas, familias, clientes, reaberturas, analistas, faixasInatividade] = await Promise.all([
    licitacaoService.listarCompletas(restricao),
    disputaService.listarTodas(),
    familiaProdutoService.listarTodas(),
    clienteService.list({ page: 1, pageSize: 500 }),
    carregarReaberturas(),
    carregarAnalistas(),
    // Faixas de inatividade (Configurações). Se o perfil não puder ler, usa o padrão 7/14/21.
    configuracaoService.obter().then(
      (c) => c.faixasInatividade,
      () => undefined
    ),
  ])

  return {
    reaberturas,
    analistas,
    faixasInatividade,
    licitacoes,
    disputas,
    familias,
    clientes: clientes.data.map((c) => ({
      id: c.id,
      nome: c.empresa.nomeFantasia || c.empresa.razaoSocial,
      segmento: c.empresa.segmento,
      porte: c.empresa.porte,
    })),
  }
}

/** Dados base do painel do CLIENTE: licitações, itens e famílias pelas regras
 *  normais (cada cliente só recebe os próprios) e as disputas pela função da
 *  migração 038. `null` = o usuário não tem acesso ao painel. */
async function carregarDadosBaseCliente(): Promise<DadosBaseIndicadores | null> {
  const [licitacoes, disputas, familias] = await Promise.all([
    licitacaoService.listarCompletas(),
    disputaService.listarDoCliente(),
    familiaProdutoService.listarTodas(),
  ])
  if (disputas === null) return null

  const idsClientes = Array.from(new Set(licitacoes.map((l) => l.clienteId)))
  return {
    licitacoes,
    disputas,
    familias,
    clientes: idsClientes.map((id) => ({ id, nome: 'Sua empresa' })),
  }
}

export const relatorioIndicadoresService = { carregarDadosBase, carregarDadosBaseCliente }
