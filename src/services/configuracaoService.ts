// src/services/configuracaoService.ts
//
// Camada de serviço do módulo de Configurações — conectada ao Supabase
// (tabela `configuracoes`, linha única de configuração do sistema, mais a
// tabela `links_rapidos`, separada por ter uma lista de tamanho variável).
// Segue o mesmo padrão dos demais services.
//
// Outros services (`licitacaoService.ts`) e páginas (`MesaDeTrabalhoPage`)
// consultam este service para a regra de prazo interno e para os links
// rápidos, em vez de ter esses valores fixos espalhados pelo código.

import { supabase } from '@/lib/supabaseClient'
import {
  ConfiguracoesSistema,
  DadosEmpresa,
  RegraPrazoInterno,
  LinkRapido,
  FaixasInatividade,
  FAIXAS_INATIVIDADE_PADRAO,
} from '../types/configuracoes'

/** Formato da linha única da tabela `configuracoes` do Postgres. */
interface ConfiguracaoRow {
  id: boolean
  razao_social: string | null
  nome_fantasia: string | null
  cnpj: string | null
  endereco: string | null
  telefone: string | null
  email: string | null
  dias_uteis_antes: number
  horario_limite: string // formato "HH:mm:ss", vindo do tipo `time` do Postgres
  inatividade_faixa_1_dias?: number | null // migração 054
  inatividade_faixa_2_dias?: number | null
  inatividade_faixa_3_dias?: number | null
  atualizado_em: string
}

interface LinkRapidoRow {
  id: string
  label: string
  url: string
  ordem: number | null
}

/** O Postgres devolve `time` como "HH:mm:ss" — o front usa só "HH:mm". */
function paraHorarioCurto(horario: string): string {
  return horario.slice(0, 5)
}

function paraLinkRapido(row: LinkRapidoRow): LinkRapido {
  return { id: row.id, label: row.label, url: row.url }
}

async function buscarLinksRapidos(): Promise<LinkRapido[]> {
  const { data, error } = await supabase
    .from('links_rapidos')
    .select('*')
    .order('ordem', { ascending: true, nullsFirst: false })
  if (error) throw new Error(error.message)
  return ((data as LinkRapidoRow[]) ?? []).map(paraLinkRapido)
}

async function buscarConfiguracaoRow(): Promise<ConfiguracaoRow> {
  const { data, error } = await supabase.from('configuracoes').select('*').eq('id', true).single()
  if (error) throw new Error(error.message)
  return data as ConfiguracaoRow
}

function paraFaixasInatividade(row: ConfiguracaoRow): FaixasInatividade {
  return {
    faixa1Dias: row.inatividade_faixa_1_dias ?? FAIXAS_INATIVIDADE_PADRAO.faixa1Dias,
    faixa2Dias: row.inatividade_faixa_2_dias ?? FAIXAS_INATIVIDADE_PADRAO.faixa2Dias,
    faixa3Dias: row.inatividade_faixa_3_dias ?? FAIXAS_INATIVIDADE_PADRAO.faixa3Dias,
  }
}

/** Mensagem de erro se as faixas forem inválidas (ou null). Mesma regra do
 *  banco: inteiros, 1 ≤ faixa 1 < faixa 2 < faixa 3. */
export function validarFaixasInatividade(f: FaixasInatividade): string | null {
  const todas = [f.faixa1Dias, f.faixa2Dias, f.faixa3Dias]
  if (todas.some((d) => !Number.isInteger(d) || d < 1)) {
    return 'Informe as três faixas em dias inteiros, a partir de 1.'
  }
  if (!(f.faixa1Dias < f.faixa2Dias && f.faixa2Dias < f.faixa3Dias)) {
    return 'As faixas precisam ser crescentes: a 1ª menor que a 2ª, e a 2ª menor que a 3ª.'
  }
  return null
}

function paraConfiguracoesSistema(row: ConfiguracaoRow, links: LinkRapido[]): ConfiguracoesSistema {
  return {
    dadosEmpresa: {
      razaoSocial: row.razao_social ?? '',
      nomeFantasia: row.nome_fantasia ?? '',
      cnpj: row.cnpj ?? '',
      endereco: row.endereco ?? '',
      telefone: row.telefone ?? '',
      email: row.email ?? '',
    },
    regraPrazoInterno: {
      diasUteisAntes: row.dias_uteis_antes,
      horario: paraHorarioCurto(row.horario_limite),
    },
    faixasInatividade: paraFaixasInatividade(row),
    linksRapidos: links,
    atualizadoEm: row.atualizado_em,
  }
}

export const configuracaoService = {
  // ATENÇÃO: com dados vindos do Supabase, não há mais como ler a regra de
  // prazo de forma síncrona (localStorage era síncrono; uma consulta ao
  // banco não é). Qualquer código que chamava obterRegraPrazoSync() precisa
  // ser ajustado para buscar a regra de forma assíncrona (ex.: uma vez, no
  // carregamento da página, guardando o resultado em estado/contexto) e
  // usar esse valor já carregado em vez de chamar este service de novo.
  // Ver src/utils/prazoUtils.ts — os cálculos de prazo devem passar a
  // receber a regra como parâmetro em vez de lê-la diretamente daqui.
  //
  // 19/10: a regra é lida pela função obter_regra_prazo_interno() (migração
  // 050), que devolve só os dois campos da regra e vale para qualquer usuário
  // logado — o Cliente não tem permissão de ler a tabela `configuracoes`
  // inteira (dados cadastrais da Salutti) e isso gerava erro 406 no console.
  // Se a função ainda não existir no banco, cai para a leitura direta da
  // tabela, como antes.
  async obterRegraPrazo(): Promise<RegraPrazoInterno> {
    const { data, error } = await supabase.rpc('obter_regra_prazo_interno')
    const linha = Array.isArray(data) ? data[0] : data
    if (!error && linha) {
      return { diasUteisAntes: linha.dias_uteis_antes, horario: paraHorarioCurto(linha.horario_limite) }
    }
    const row = await buscarConfiguracaoRow()
    return { diasUteisAntes: row.dias_uteis_antes, horario: paraHorarioCurto(row.horario_limite) }
  },

  async obter(): Promise<ConfiguracoesSistema> {
    const [row, links] = await Promise.all([buscarConfiguracaoRow(), buscarLinksRapidos()])
    return paraConfiguracoesSistema(row, links)
  },

  async atualizarDadosEmpresa(dados: DadosEmpresa): Promise<ConfiguracoesSistema> {
    const { error } = await supabase
      .from('configuracoes')
      .update({
        razao_social: dados.razaoSocial,
        nome_fantasia: dados.nomeFantasia,
        cnpj: dados.cnpj,
        endereco: dados.endereco,
        telefone: dados.telefone,
        email: dados.email,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', true)
    if (error) throw new Error(error.message)
    return this.obter()
  },

  async atualizarRegraPrazo(regra: RegraPrazoInterno): Promise<ConfiguracoesSistema> {
    const { error } = await supabase
      .from('configuracoes')
      .update({
        dias_uteis_antes: regra.diasUteisAntes,
        horario_limite: `${regra.horario}:00`,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', true)
    if (error) throw new Error(error.message)
    return this.obter()
  },

  async atualizarFaixasInatividade(faixas: FaixasInatividade): Promise<ConfiguracoesSistema> {
    const erro = validarFaixasInatividade(faixas)
    if (erro) throw new Error(erro)
    const { error } = await supabase
      .from('configuracoes')
      .update({
        inatividade_faixa_1_dias: faixas.faixa1Dias,
        inatividade_faixa_2_dias: faixas.faixa2Dias,
        inatividade_faixa_3_dias: faixas.faixa3Dias,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', true)
    if (error) throw new Error(error.message)
    return this.obter()
  },

  // Apaga os links antigos e insere a lista nova por completo — mesma
  // decisão de design já usada para grupos/itens em licitacaoService.ts:
  // mais simples e sem risco de dessincronia entre linhas.
  async atualizarLinksRapidos(links: LinkRapido[]): Promise<ConfiguracoesSistema> {
    const { error: erroDelete } = await supabase.from('links_rapidos').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (erroDelete) throw new Error(erroDelete.message)

    if (links.length > 0) {
      const { error: erroInsert } = await supabase.from('links_rapidos').insert(
        links.map((link, index) => ({ label: link.label, url: link.url, ordem: index }))
      )
      if (erroInsert) throw new Error(erroInsert.message)
    }

    const { error: erroTouch } = await supabase
      .from('configuracoes')
      .update({ atualizado_em: new Date().toISOString() })
      .eq('id', true)
    if (erroTouch) throw new Error(erroTouch.message)

    return this.obter()
  },

  // Atalho usado pela Mesa de Trabalho.
  async obterLinksRapidos(): Promise<LinkRapido[]> {
    return buscarLinksRapidos()
  },
}
